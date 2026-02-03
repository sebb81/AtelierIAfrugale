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

FACE_GUIDE_INDICES = {
    "left_cheek": 234,
    "right_cheek": 454,
    "forehead": 10,
    "chin": 152,
    "mouth_left": 61,
    "mouth_right": 291,
    "upper_lip": 13,
    "lower_lip": 14,
}
EMOTION_SMILE_RATIO_BASE = 0.43
EMOTION_MOUTH_OPEN_SURPRISE = 0.065
EMOTION_CORNER_SMILE = -0.01
EMOTION_CORNER_SAD = 0.012

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


def _dist(a, b) -> float:
    dx = a.x - b.x
    dy = a.y - b.y
    return float((dx * dx + dy * dy) ** 0.5)


def _point(lm) -> dict:
    return {"x": float(lm.x), "y": float(lm.y)}


def _extract_face_guides(landmarks) -> dict:
    points = {key: landmarks[idx] for key, idx in FACE_GUIDE_INDICES.items()}
    return {
        "face_width": [_point(points["left_cheek"]), _point(points["right_cheek"])],
        "face_height": [_point(points["forehead"]), _point(points["chin"])],
        "mouth_width": [_point(points["mouth_left"]), _point(points["mouth_right"])],
        "mouth_height": [_point(points["upper_lip"]), _point(points["lower_lip"])],
    }


def _estimate_emotion(landmarks) -> tuple[str, dict]:
    points = {key: landmarks[idx] for key, idx in FACE_GUIDE_INDICES.items()}

    face_width = _dist(points["left_cheek"], points["right_cheek"])
    face_height = _dist(points["forehead"], points["chin"])
    mouth_width = _dist(points["mouth_left"], points["mouth_right"])
    mouth_height = _dist(points["upper_lip"], points["lower_lip"])
    mouth_center_y = (points["upper_lip"].y + points["lower_lip"].y) / 2
    corners_y = (points["mouth_left"].y + points["mouth_right"].y) / 2

    mouth_open_ratio = mouth_height / max(face_height, 1e-6)
    smile_width_ratio = mouth_width / max(face_width, 1e-6)
    corner_delta = corners_y - mouth_center_y

    if mouth_open_ratio > EMOTION_MOUTH_OPEN_SURPRISE:
        label = "Surpris"
    elif corner_delta < EMOTION_CORNER_SMILE and smile_width_ratio > EMOTION_SMILE_RATIO_BASE:
        label = "Sourire"
    elif corner_delta > EMOTION_CORNER_SAD:
        label = "Triste"
    else:
        label = "Neutre"

    metrics = {
        "mouth_open_ratio": float(mouth_open_ratio),
        "smile_width_ratio": float(smile_width_ratio),
        "corner_delta": float(corner_delta),
    }
    return label, metrics


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


@app.websocket("/ws/emotion")
async def ws_emotion(ws: WebSocket):
    await ws.accept()
    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    try:
        while True:
            payload = await ws.receive_text()
            if payload.lstrip().startswith("{"):
                continue

            data_url = payload
            if "," not in data_url:
                await ws.send_text(
                    json.dumps(
                        {
                            "type": "emotion",
                            "face": False,
                            "emotion": {"label": "Aucun visage detecte"},
                        }
                    )
                )
                continue
            b64 = data_url.split(",", 1)[1]
            jpg_bytes = base64.b64decode(b64)

            arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                await ws.send_text(
                    json.dumps(
                        {
                            "type": "emotion",
                            "face": False,
                            "emotion": {"label": "Aucun visage detecte"},
                        }
                    )
                )
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            start_ts = time.perf_counter()
            results = face_mesh.process(rgb)
            inference_ms = (time.perf_counter() - start_ts) * 1000.0

            if not results.multi_face_landmarks:
                await ws.send_text(
                    json.dumps(
                        {
                            "type": "emotion",
                            "face": False,
                            "emotion": {"label": "Aucun visage detecte"},
                            "metrics": {"inference_ms": inference_ms},
                        }
                    )
                )
                continue

            face_landmarks = results.multi_face_landmarks[0].landmark
            label, metrics = _estimate_emotion(face_landmarks)
            metrics["inference_ms"] = float(inference_ms)
            guides = _extract_face_guides(face_landmarks)

            await ws.send_text(
                json.dumps(
                    {
                        "type": "emotion",
                        "face": True,
                        "emotion": {"label": label},
                        "metrics": metrics,
                        "guides": guides,
                    }
                )
            )
    except Exception:
        pass
    finally:
        face_mesh.close()
