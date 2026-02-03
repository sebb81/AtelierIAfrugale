import base64
import json
import platform
import time
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, WebSocket, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

app = FastAPI()

FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
MODEL_URL = "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task"
MODEL_PATH = Path(__file__).resolve().parent / "models" / "gesture_recognizer.task"
DEFAULT_MP_CONFIG = {
    "delegate": "cpu",
    "model": "gesture_recognizer",
    "num_hands": 1,
    "min_hand_detection_confidence": 0.5,
    "min_hand_presence_confidence": 0.5,
    "min_tracking_confidence": 0.5,
}
MODEL_CHOICES = {"gesture_recognizer": MODEL_PATH}

GESTURE_LABELS = {
    "Thumb_Up": "Pouce leve",
    "Thumb_Down": "Pouce baisse",
    "Open_Palm": "Main ouverte",
    "Closed_Fist": "Poing ferme",
    "Pointing_Up": "Doigt pointe",
    "Victory": "Signe victoire (V)",
    "ILoveYou": "Je t'aime",
}

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

app.mount("/static", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")


def _ensure_model_file() -> Path | None:
    try:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        if MODEL_PATH.exists():
            return MODEL_PATH
        with urllib.request.urlopen(MODEL_URL, timeout=30) as response:
            MODEL_PATH.write_bytes(response.read())
        return MODEL_PATH
    except Exception:
        return None


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(value, high))


def _normalize_config(payload: dict | None) -> dict:
    config = DEFAULT_MP_CONFIG.copy()
    if not payload:
        return config

    delegate = str(payload.get("delegate", config["delegate"])).lower()
    if delegate in {"cpu", "gpu"}:
        config["delegate"] = delegate

    model = str(payload.get("model", config["model"])).lower()
    if model in MODEL_CHOICES:
        config["model"] = model

    try:
        num_hands = int(payload.get("num_hands", config["num_hands"]))
        config["num_hands"] = max(1, min(num_hands, 2))
    except (TypeError, ValueError):
        pass

    for key in (
        "min_hand_detection_confidence",
        "min_hand_presence_confidence",
        "min_tracking_confidence",
    ):
        try:
            value = float(payload.get(key, config[key]))
            config[key] = _clamp(value, 0.0, 1.0)
        except (TypeError, ValueError):
            pass

    return config


def _create_video_recognizer(model_path: str, config: dict):
    applied = config.copy()
    warning = None
    base_options = mp_python.BaseOptions(model_asset_path=model_path)

    if config.get("delegate") == "gpu":
        if platform.system() in {"Linux", "Darwin"}:
            base_options.delegate = mp_python.BaseOptions.Delegate.GPU
        else:
            warning = "GPU delegate indisponible sur Windows. Bascule CPU."
            applied["delegate"] = "cpu"
            base_options.delegate = mp_python.BaseOptions.Delegate.CPU
    else:
        base_options.delegate = mp_python.BaseOptions.Delegate.CPU

    options = vision.GestureRecognizerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_hands=applied["num_hands"],
        min_hand_detection_confidence=applied["min_hand_detection_confidence"],
        min_hand_presence_confidence=applied["min_hand_presence_confidence"],
        min_tracking_confidence=applied["min_tracking_confidence"],
    )
    recognizer = vision.GestureRecognizer.create_from_options(options)
    return recognizer, applied, warning


def _extract_gesture(result):
    if not result.hand_landmarks:
        return "Aucune main detectee", 0.0, None
    if not result.gestures:
        return "Geste non reconnu", 0.0, None
    for gesture_list in result.gestures:
        if not gesture_list:
            return "Geste non reconnu", 0.0, None
        top = gesture_list[0]
        raw_label = top.category_name
        score = float(top.score)
        label = GESTURE_LABELS.get(raw_label, raw_label)
        return label, score, raw_label
    return "Geste non reconnu", 0.0, None


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "page_id": "home"})


@app.get("/mission{mission_id}")
def mission_page(request: Request, mission_id: int):
    if mission_id < 1 or mission_id > 5:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "page_id": f"mission{mission_id}"},
    )


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    model_path = _ensure_model_file()
    if not model_path:
        await ws.send_text(json.dumps({"error": "Modele MediaPipe indisponible."}))
        await ws.close()
        return

    current_config = DEFAULT_MP_CONFIG.copy()
    active_model_path = MODEL_CHOICES.get(current_config["model"], model_path)
    try:
        recognizer, applied_config, warning = _create_video_recognizer(
            str(active_model_path), current_config
        )
    except Exception:
        await ws.send_text(
            json.dumps(
                {"type": "error", "message": "Impossible de charger le modele."}
            )
        )
        await ws.close()
        return
    await ws.send_text(
        json.dumps({"type": "config", "applied": applied_config, "warning": warning})
    )
    last_ts = 0
    try:
        while True:
            payload = await ws.receive_text()
            if payload.lstrip().startswith("{"):
                try:
                    msg = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if msg.get("type") == "config":
                    new_config = _normalize_config(msg.get("config") or {})
                    if new_config != current_config:
                        active_model_path = MODEL_CHOICES.get(
                            new_config["model"], model_path
                        )
                        try:
                            new_recognizer, applied_config, warning = (
                                _create_video_recognizer(
                                    str(active_model_path), new_config
                                )
                            )
                        except Exception:
                            await ws.send_text(
                                json.dumps(
                                    {
                                        "type": "error",
                                        "message": "Config invalide ou modele indisponible.",
                                    }
                                )
                            )
                            continue
                        recognizer.close()
                        recognizer = new_recognizer
                        current_config = new_config
                        last_ts = 0
                    await ws.send_text(
                        json.dumps(
                            {
                                "type": "config",
                                "applied": applied_config,
                                "warning": warning,
                            }
                        )
                    )
                continue

            data_url = payload

            # data_url = "data:image/jpeg;base64,...."
            if "," not in data_url:
                await ws.send_text(json.dumps({"landmarks": None}))
                continue
            b64 = data_url.split(",", 1)[1]
            jpg_bytes = base64.b64decode(b64)

            arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)  # BGR
            if frame is None:
                await ws.send_text(json.dumps({"landmarks": None}))
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            timestamp_ms = int(time.time() * 1000)
            if timestamp_ms <= last_ts:
                timestamp_ms = last_ts + 1
            last_ts = timestamp_ms

            start_ts = time.perf_counter()
            result = recognizer.recognize_for_video(mp_image, timestamp_ms)
            inference_ms = (time.perf_counter() - start_ts) * 1000.0

            out = []
            if result.hand_landmarks:
                for hand_lms in result.hand_landmarks:
                    pts = [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in hand_lms]
                    out.append(pts)

            label, score, raw_label = _extract_gesture(result)
            await ws.send_text(
                json.dumps(
                    {
                        "type": "result",
                        "landmarks": out if out else None,
                        "gesture": {"label": label, "score": score, "raw": raw_label},
                        "metrics": {"inference_ms": inference_ms},
                    }
                )
            )
    except Exception:
        pass
    finally:
        recognizer.close()
