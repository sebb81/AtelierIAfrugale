import base64
import json
import math
import os
import platform
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, WebSocket, HTTPException, Request, UploadFile, File, Form
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
EMOTION_SMILE_RATIO_BASE = 0.34
EMOTION_MOUTH_OPEN_SURPRISE = 0.08
EMOTION_CORNER_SMILE = -0.005
EMOTION_CORNER_SAD = 0.012

LLM_BASE_URL = "http://localhost:8033/v1"
LLM_CHAT_ENDPOINT = f"{LLM_BASE_URL}/chat/completions"
LLM_MODEL = "mistral"
LLM_TIMEOUT = 30
LLM_SYSTEM_PROMPT = (
    "Tu es un assistant IA local. Reponds en francais, de maniere claire et "
    "structuree. Si l'utilisateur demande du code, donne un exemple minimal et "
    "correct."
)
LLM_DEFAULT_PARAMS = {
    "temperature": 0.3,
    "top_p": 0.9,
    "presence_penalty": 0.6,
    "frequency_penalty": 1.5,
    "max_tokens": 768,
}
LLM_MAX_MESSAGES = 20

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_CHUNK_SIZE = 1200
DEFAULT_CHUNK_OVERLAP = 200
DEFAULT_TOP_K = 6
DEFAULT_MIN_SCORE = 0.25
RAG_SYSTEM_PROMPT = (
    "Tu es un assistant IA local. "
    "Tu dois repondre en francais. "
    "Si un CONTEXTE DOCUMENTAIRE est fourni, utilise-le en priorite et cite tes "
    "sources avec les numeros entre crochets (ex: [1], [2]). "
    "Si le contexte ne contient pas l'information, dis-le clairement et propose "
    "quoi chercher."
)
RAG_STORE = {
    "docs": [],
    "sources": [],
    "embeds": [],
    "norms": [],
    "hashes": set(),
}
RAG_LOCK = threading.Lock()
_EMBEDDING_MODEL = None

ASR_VARIANT = "tiny"
ASR_DEFAULT_LANGUAGE = "fr"
ASR_SUPPORTED_LANGUAGES = {"fr", "en", "es", "de", "it"}
ASR_TARGET_SAMPLE_RATE = 16000
ASR_LOCK = threading.Lock()
_ASR_BACKEND = None

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


def _normalize_chat_messages(messages) -> list[dict]:
    if not messages:
        return []
    normalized = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).lower()
        if role not in {"user", "assistant"}:
            continue
        content = str(msg.get("content", "")).strip()
        if not content:
            continue
        normalized.append({"role": role, "content": content})
    return normalized


def _call_llm_chat(system_prompt: str, messages: list[dict]) -> dict:
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "stream": False,
    }
    payload.update(LLM_DEFAULT_PARAMS)
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        LLM_CHAT_ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as response:
        data = response.read()
    return json.loads(data)


def _get_embedding_model():
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is not None:
        return _EMBEDDING_MODEL
    with RAG_LOCK:
        if _EMBEDDING_MODEL is not None:
            return _EMBEDDING_MODEL
        try:
            from sentence_transformers import SentenceTransformer
        except Exception as exc:
            raise RuntimeError(
                "Installez sentence-transformers pour activer la mission RAG."
            ) from exc
        _EMBEDDING_MODEL = SentenceTransformer(EMBEDDING_MODEL_NAME)
        return _EMBEDDING_MODEL


def _reset_rag_store():
    with RAG_LOCK:
        RAG_STORE["docs"].clear()
        RAG_STORE["sources"].clear()
        RAG_STORE["embeds"].clear()
        RAG_STORE["norms"].clear()
        RAG_STORE["hashes"].clear()


def _rag_counts() -> dict:
    with RAG_LOCK:
        return {
            "chunks": len(RAG_STORE["docs"]),
            "sources": len(set(RAG_STORE["sources"])),
        }


def _text_from_bytes(name: str, data: bytes):
    name_lower = name.lower()
    if name_lower.endswith(".pdf"):
        try:
            import fitz
        except Exception:
            return "", "Erreur : installez PyMuPDF via `pip install pymupdf`."
        try:
            doc = fitz.open(stream=data, filetype="pdf")
            pages = []
            for page in doc:
                pages.append(page.get_text())
            return "\n".join(pages), None
        except Exception as exc:
            return "", f"Erreur de lecture PDF (PyMuPDF) : {exc}"
    return data.decode("utf-8", errors="ignore"), None


def _chunk_text(text: str, max_chars: int, overlap: int):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, current = [], ""

    effective_overlap = min(overlap, max_chars - 1) if max_chars > 1 else 0
    step = max(1, max_chars - effective_overlap)

    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 2 <= max_chars:
            current = f"{current}\n\n{paragraph}" if current else paragraph
            continue

        if current:
            chunks.append(current)

        if len(paragraph) <= max_chars:
            current = paragraph
        else:
            for i in range(0, len(paragraph), step):
                chunks.append(paragraph[i : i + max_chars])
            current = ""

    if current:
        chunks.append(current)

    return chunks


def _dot_product(left, right):
    return sum(l * r for l, r in zip(left, right))


def _vector_norm(vec):
    return math.sqrt(sum(x * x for x in vec))


def _embed_texts(texts):
    model = _get_embedding_model()
    embeds = model.encode(texts, normalize_embeddings=True)
    return embeds.tolist()


def _retrieve_chunks(query: str, top_k: int, min_score: float):
    with RAG_LOCK:
        docs = list(RAG_STORE["docs"])
        sources = list(RAG_STORE["sources"])
        embeds = list(RAG_STORE["embeds"])
        norms = list(RAG_STORE["norms"])

    if not docs:
        return []

    query_emb = _embed_texts([query])[0]
    qn = _vector_norm(query_emb)
    if qn == 0:
        return []

    query_keywords = [w.lower() for w in query.split() if len(w) > 3]

    scored = []
    for idx, emb in enumerate(embeds):
        denom = qn * norms[idx]
        cosine = _dot_product(query_emb, emb) / denom if denom else 0.0

        chunk_lower = docs[idx].lower()
        bonus = 0.0
        for kw in query_keywords:
            if kw in chunk_lower:
                bonus += 0.05
        bonus = min(bonus, 0.30)

        score = cosine + bonus
        scored.append((score, idx))

    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for score, idx in scored[:top_k]:
        if score < min_score:
            continue
        results.append(
            {
                "score": float(score),
                "text": docs[idx],
                "source": sources[idx],
            }
        )
    return results


def _build_context_block(results):
    if not results:
        return ""
    lines = ["### CONTEXTE DOCUMENTAIRE"]
    for i, r in enumerate(results, start=1):
        src = r["source"]
        chunk = r["text"].strip()
        lines.append(f"[{i}] Source: {src}\n{chunk}\n")
    return "\n".join(lines)


def _get_asr_backend():
    global _ASR_BACKEND
    if _ASR_BACKEND is not None:
        return _ASR_BACKEND
    with ASR_LOCK:
        if _ASR_BACKEND is not None:
            return _ASR_BACKEND
        try:
            import whisper  # type: ignore

            model = whisper.load_model(ASR_VARIANT)
            _ASR_BACKEND = ("whisper", model)
            return _ASR_BACKEND
        except Exception:
            pass

        try:
            from transformers import pipeline  # type: ignore

            asr = pipeline(
                "automatic-speech-recognition",
                model=f"openai/whisper-{ASR_VARIANT}",
                device="cpu",
            )
            _ASR_BACKEND = ("transformers", asr)
            return _ASR_BACKEND
        except Exception as exc:
            _ASR_BACKEND = ("none", str(exc))
            return _ASR_BACKEND


def _transcribe_audio_bytes(audio_bytes: bytes, language: str, suffix: str = ".wav"):
    backend_name, backend = _get_asr_backend()
    if backend_name == "none":
        return None, (
            "Aucun backend Whisper local disponible.\n\n"
            "Installez l'un des deux:\n"
            "- `pip install -U openai-whisper`\n"
            "ou\n"
            "- `pip install -U transformers accelerate` (et torch)\n\n"
            f"Detail: {backend}"
        )

    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        with open(tmp_path, "wb") as handle:
            handle.write(audio_bytes)

        if backend_name == "whisper":
            result = backend.transcribe(tmp_path, language=language, fp16=False)
            text = (result.get("text") or "").strip()
            return text, None

        out = backend(tmp_path, generate_kwargs={"language": language})
        text = (out.get("text") if isinstance(out, dict) else str(out)).strip()
        return text, None
    except Exception as exc:
        return None, f"Erreur de transcription: {exc}"
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


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


@app.post("/api/chat")
async def chat(payload: dict):
    system_prompt = str(payload.get("system_prompt") or LLM_SYSTEM_PROMPT)
    messages = _normalize_chat_messages(payload.get("messages"))
    if len(messages) > LLM_MAX_MESSAGES:
        messages = messages[-LLM_MAX_MESSAGES:]
    if not messages:
        raise HTTPException(status_code=400, detail="Aucun message a traiter.")
    try:
        data = _call_llm_chat(system_prompt, messages)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail=(
                "Impossible de contacter le serveur llama.cpp. "
                f"Verifiez {LLM_CHAT_ENDPOINT}."
            ),
        )
    try:
        reply = data["choices"][0]["message"]["content"]
    except Exception:
        raise HTTPException(status_code=502, detail="Reponse LLM invalide.")
    return {
        "reply": reply,
        "model": data.get("model"),
        "usage": data.get("usage"),
    }


@app.get("/api/rag/state")
def rag_state():
    return _rag_counts()


@app.post("/api/rag/reset")
def rag_reset():
    _reset_rag_store()
    return _rag_counts()


@app.post("/api/rag/index")
async def rag_index(
    files: list[UploadFile] = File(...),
    chunk_size: int = Form(DEFAULT_CHUNK_SIZE),
    overlap: int = Form(DEFAULT_CHUNK_OVERLAP),
):
    if not files:
        raise HTTPException(status_code=400, detail="Aucun fichier fourni.")

    chunk_size = max(200, min(int(chunk_size), 4000))
    overlap = max(0, min(int(overlap), chunk_size - 1))

    added_chunks = 0
    errors = []

    for up in files:
        if not up.filename:
            continue
        data = await up.read()
        text, err = _text_from_bytes(up.filename, data)
        if err:
            errors.append(f"{up.filename} - {err}")
            continue

        chunks = _chunk_text(text, chunk_size, overlap)
        if not chunks:
            continue

        with RAG_LOCK:
            known_hashes = set(RAG_STORE["hashes"])

        new_chunks = []
        new_sources = []
        for chunk in chunks:
            h = hash(chunk)
            if h in known_hashes:
                continue
            known_hashes.add(h)
            new_chunks.append(chunk)
            new_sources.append(up.filename)

        if not new_chunks:
            continue

        try:
            embeds = _embed_texts(new_chunks)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        norms = [_vector_norm(e) for e in embeds]

        with RAG_LOCK:
            for idx, chunk in enumerate(new_chunks):
                h = hash(chunk)
                if h in RAG_STORE["hashes"]:
                    continue
                RAG_STORE["hashes"].add(h)
                RAG_STORE["docs"].append(chunk)
                RAG_STORE["sources"].append(new_sources[idx])
                RAG_STORE["embeds"].append(embeds[idx])
                RAG_STORE["norms"].append(norms[idx])
                added_chunks += 1

    counts = _rag_counts()
    return {
        "added_chunks": added_chunks,
        "chunks": counts["chunks"],
        "sources": counts["sources"],
        "errors": errors,
    }


@app.post("/api/rag/chat")
async def rag_chat(payload: dict):
    system_prompt = str(payload.get("system_prompt") or RAG_SYSTEM_PROMPT)
    messages = _normalize_chat_messages(payload.get("messages"))
    query = str(payload.get("query") or "").strip()

    if not query and messages:
        for msg in reversed(messages):
            if msg["role"] == "user":
                query = msg["content"]
                break

    if not query:
        raise HTTPException(status_code=400, detail="Aucune question fournie.")

    try:
        top_k = int(payload.get("top_k", DEFAULT_TOP_K))
    except (TypeError, ValueError):
        top_k = DEFAULT_TOP_K
    top_k = max(1, min(top_k, 20))

    try:
        min_score = float(payload.get("min_score", DEFAULT_MIN_SCORE))
    except (TypeError, ValueError):
        min_score = DEFAULT_MIN_SCORE
    min_score = max(0.0, min(min_score, 1.0))

    try:
        results = _retrieve_chunks(query, top_k, min_score)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    context_block = _build_context_block(results)
    llm_messages = []
    if context_block:
        llm_messages.append({"role": "system", "content": context_block})
    if messages:
        llm_messages.extend(messages)
    else:
        llm_messages.append({"role": "user", "content": query})

    try:
        data = _call_llm_chat(system_prompt, llm_messages)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail=(
                "Impossible de contacter le serveur llama.cpp. "
                f"Verifiez {LLM_CHAT_ENDPOINT}."
            ),
        )
    try:
        reply = data["choices"][0]["message"]["content"]
    except Exception:
        raise HTTPException(status_code=502, detail="Reponse LLM invalide.")

    return {
        "reply": reply,
        "sources": results,
        "model": data.get("model"),
        "usage": data.get("usage"),
    }


@app.post("/api/audio/transcribe")
async def audio_transcribe(
    file: UploadFile = File(...),
    language: str = Form(ASR_DEFAULT_LANGUAGE),
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Aucun fichier audio fourni.")
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Fichier audio vide.")

    lang = (language or ASR_DEFAULT_LANGUAGE).lower()
    if lang not in ASR_SUPPORTED_LANGUAGES:
        lang = ASR_DEFAULT_LANGUAGE

    suffix = Path(file.filename).suffix or ".wav"
    text, err = _transcribe_audio_bytes(audio_bytes, lang, suffix=suffix)
    if err:
        raise HTTPException(status_code=503, detail=err)
    return {"text": text or "", "language": lang}


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
