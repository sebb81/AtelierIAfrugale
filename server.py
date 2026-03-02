import base64
import json
import hashlib
import math
import os
import platform
import re
import sqlite3
import tempfile
import threading
import time
import unicodedata
import urllib.request
from collections import Counter
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    Request,
    UploadFile,
    File,
    Form,
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

app = FastAPI()

APP_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = APP_DIR / "frontend"
TEMPLATES_DIR = APP_DIR / "templates"
RAG_DOCS_DIR_CANDIDATES = [APP_DIR / "docRAG", APP_DIR / "docRag"]
RAG_DOCS_DIR = next(
    (candidate for candidate in RAG_DOCS_DIR_CANDIDATES if candidate.exists()),
    RAG_DOCS_DIR_CANDIDATES[0],
)
RAG_DB_PATH = APP_DIR / "rag_local.sqlite3"
RAG_ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
MODEL_URL = "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task"
MODEL_PATH = APP_DIR / "models" / "gesture_recognizer.task"
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

EMBEDDING_MODEL_NAME = "paraphrase-multilingual-mpnet-base-v2"
DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 180
DEFAULT_TOP_K = 8
DEFAULT_MIN_SCORE = 0.25
RAG_CHUNK_ALGO_VERSION = "v2"
RAG_GROUNDING_MODE = "strict"
RAG_DEFAULT_SOURCE_CAP = 2
RAG_DEFAULT_SCORE_MODE = "adaptive_relative"
RAG_RETRIEVAL_ABS_MIN = 0.35
RAG_RETRIEVAL_REL_GAP = 0.15
RAG_LEXICAL_BONUS_MAX = 0.12
RAG_MIN_QUERY_TERM_LEN = 5
RAG_FALLBACK_REPLY = "Information non trouvée clairement dans les documents indexés."
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
RAG_SYSTEM_PROMPT = (
    "Tu es un assistant RAG strict. "
    "Tu dois repondre en francais uniquement a partir du CONTEXTE DOCUMENTAIRE. "
    "N'utilise pas de connaissance externe et ne devine pas. "
    "Si le contexte est insuffisant, reponds exactement: "
    f"\"{RAG_FALLBACK_REPLY}\". "
    "Reponse courte en bullet points. "
    "Ajoute des citations obligatoires avec les numeros [1], [2], etc."
)
RAG_STOPWORDS = {
    "about",
    "after",
    "ainsi",
    "alors",
    "also",
    "among",
    "avec",
    "been",
    "before",
    "being",
    "between",
    "both",
    "cette",
    "comme",
    "comment",
    "dans",
    "debut",
    "depuis",
    "des",
    "does",
    "donc",
    "dont",
    "elle",
    "elles",
    "encore",
    "entre",
    "est",
    "etait",
    "etre",
    "for",
    "from",
    "have",
    "into",
    "just",
    "leur",
    "leurs",
    "mais",
    "meme",
    "moins",
    "notre",
    "nous",
    "only",
    "par",
    "parce",
    "pendant",
    "plus",
    "pour",
    "pourquoi",
    "quand",
    "quel",
    "quelle",
    "quelles",
    "quels",
    "sont",
    "sur",
    "that",
    "their",
    "then",
    "there",
    "these",
    "they",
    "this",
    "tout",
    "tous",
    "une",
    "uses",
    "using",
    "votre",
    "vous",
    "what",
    "when",
    "where",
    "which",
    "with",
    "your",
}
RAG_STORE = {
    "docs": [],
    "sources": [],
    "embeds": [],
    "norms": [],
}
RAG_LOCK = threading.Lock()
_EMBEDDING_MODEL = None

ASR_VARIANT = "tiny"
ASR_DEFAULT_LANGUAGE = "fr"
ASR_SUPPORTED_LANGUAGES = {"fr", "en", "es", "de", "it"}
ASR_TARGET_SAMPLE_RATE = 16000
ASR_LOCK = threading.Lock()
_ASR_BACKEND = None
_MODEL_BYTES_CACHE = {}

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

app.mount("/static", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")


@app.on_event("startup")
def _bootstrap_rag_store():
    _init_rag_db()
    try:
        _sync_rag_from_doc_folder()
    except Exception as exc:
        print(f"[rag] initial sync failed: {exc}")
        try:
            _load_rag_store_from_db()
        except Exception as load_exc:
            print(f"[rag] failed to load persisted store: {load_exc}")
            _clear_rag_store_memory()


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


def _read_model_bytes(model_path: str) -> bytes:
    # MediaPipe can mis-handle Windows absolute paths in some environments.
    # Loading bytes avoids path resolution issues entirely.
    key = str(Path(model_path).resolve())
    cached = _MODEL_BYTES_CACHE.get(key)
    if cached is not None:
        return cached
    data = Path(model_path).read_bytes()
    _MODEL_BYTES_CACHE[key] = data
    return data


def _create_video_recognizer(model_path: str, config: dict):
    applied = config.copy()
    warning = None
    model_bytes = _read_model_bytes(model_path)
    base_options = mp_python.BaseOptions(model_asset_buffer=model_bytes)

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


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _normalize_for_match(text: str) -> str:
    return _strip_accents(text.lower())


def _tokenize_text(text: str) -> list[str]:
    normalized = _normalize_for_match(text)
    return TOKEN_PATTERN.findall(normalized)


def _extract_query_terms(query: str) -> list[str]:
    terms = []
    seen = set()
    for token in _tokenize_text(query):
        if len(token) < RAG_MIN_QUERY_TERM_LEN:
            continue
        if token in RAG_STOPWORDS:
            continue
        if token in seen:
            continue
        seen.add(token)
        terms.append(token)
    return terms


def _has_citation(text: str) -> bool:
    return bool(re.search(r"\[\d+\]", text or ""))


def _unique_source_names(results: list[dict]) -> list[str]:
    seen = set()
    names = []
    for item in results:
        source = str(item.get("source", "")).strip()
        if not source or source in seen:
            continue
        seen.add(source)
        names.append(source)
    return names


def _split_sentences(text: str) -> list[str]:
    compact = re.sub(r"\s+", " ", text or "").strip()
    if not compact:
        return []
    raw_parts = re.split(r"(?<=[\.\!\?;:])\s+| \u2022 ", compact)
    out = []
    for part in raw_parts:
        sentence = part.strip(" -\t")
        if len(sentence) < 40:
            continue
        if sentence.endswith("?"):
            continue
        out.append(sentence)
    return out


def _build_extractive_fallback_reply(query: str, results: list[dict]) -> str:
    if not results:
        return RAG_FALLBACK_REPLY

    query_terms = _extract_query_terms(query)
    candidates = []
    for idx, item in enumerate(results, start=1):
        base_score = float(item.get("score", 0.0))
        for sentence in _split_sentences(str(item.get("text", ""))):
            sent_tokens = set(_tokenize_text(sentence))
            if query_terms:
                hit_count = sum(1 for term in query_terms if term in sent_tokens)
                term_score = hit_count / max(1, len(query_terms))
            else:
                term_score = 0.0
            score = term_score + (base_score * 0.1)
            candidates.append(
                {
                    "score": score,
                    "sentence": sentence,
                    "idx": idx,
                    "source": str(item.get("source", "Source")),
                }
            )

    candidates.sort(key=lambda item: item["score"], reverse=True)

    selected = []
    used_text = set()
    for candidate in candidates:
        key = _normalize_for_match(candidate["sentence"])
        if key in used_text:
            continue
        used_text.add(key)
        selected.append(candidate)
        if len(selected) >= 2:
            break

    if not selected:
        first = results[0]
        snippet = re.sub(r"\s+", " ", str(first.get("text", ""))).strip()
        snippet = snippet[:260].rstrip()
        if snippet and snippet[-1] not in ".!?":
            snippet = f"{snippet}..."
        selected = [
            {
                "sentence": snippet or RAG_FALLBACK_REPLY,
                "idx": 1,
                "source": str(first.get("source", "Source")),
            }
        ]

    answer_lines = [f"- {item['sentence']} [{item['idx']}]" for item in selected]
    used_indices = sorted({int(item["idx"]) for item in selected})
    source_lines = [
        f"- [{idx}] {str(results[idx - 1].get('source', 'Source'))}"
        for idx in used_indices
        if 1 <= idx <= len(results)
    ]
    if source_lines:
        answer_lines.append("")
        answer_lines.append("Sources :")
        answer_lines.extend(source_lines)
    return "\n".join(answer_lines)


def _build_natural_fallback_reply(query: str, results: list[dict]) -> str:
    if not results:
        return RAG_FALLBACK_REPLY

    source_names = _unique_source_names(results)
    context_block = _build_context_block(results)
    style_prompt = (
        "Tu reformules une reponse RAG en francais naturel. "
        "Utilise uniquement le CONTEXTE DOCUMENTAIRE fourni. "
        "Ne copie pas de longs extraits textuels. "
        "Reponds en 2-4 phrases maximum, de facon claire et concrete. "
        "Mentionne explicitement les noms exacts des documents utilises. "
        "N'utilise pas les citations numeriques [1], [2], etc. "
        f"Si la preuve est insuffisante, reponds exactement: \"{RAG_FALLBACK_REPLY}\"."
    )
    prompt_user = (
        f"Question utilisateur: {query}\n"
        f"Documents recuperes: {', '.join(source_names) if source_names else 'Aucun'}"
    )

    try:
        data = _call_llm_chat(
            style_prompt,
            [
                {"role": "system", "content": context_block},
                {"role": "user", "content": prompt_user},
            ],
        )
        candidate = str(data["choices"][0]["message"]["content"]).strip()
        if not candidate:
            raise ValueError("Empty answer")
        if candidate == RAG_FALLBACK_REPLY:
            return candidate

        if source_names and not any(name in candidate for name in source_names):
            candidate = (
                f"{candidate}\n\nDocuments utilisés : {', '.join(source_names)}."
            )
        return candidate
    except Exception:
        return _build_extractive_fallback_reply(query, results)


def _suggest_rag_config(source_files: list[Path]) -> dict:
    source_count = len(source_files)
    total_bytes = 0
    max_pdf_bytes = 0
    for path in source_files:
        try:
            size = int(path.stat().st_size)
        except Exception:
            size = 0
        total_bytes += size
        if path.suffix.lower() == ".pdf":
            max_pdf_bytes = max(max_pdf_bytes, size)

    if max_pdf_bytes >= 250_000 or total_bytes >= 400_000:
        chunk_size, overlap = 700, 140
    elif total_bytes >= 150_000:
        chunk_size, overlap = 850, 140
    else:
        chunk_size, overlap = 1000, 180

    top_k = min(10, max(8, source_count * 2))
    return {
        "chunk_size": chunk_size,
        "overlap": overlap,
        "top_k": top_k,
        "source_cap": RAG_DEFAULT_SOURCE_CAP,
        "score_mode": RAG_DEFAULT_SCORE_MODE,
        "embedding_model": EMBEDDING_MODEL_NAME,
    }


def _build_rag_index_signature(config: dict) -> str:
    payload = {
        "chunk_size": int(config["chunk_size"]),
        "overlap": int(config["overlap"]),
        "embedding_model": str(config["embedding_model"]),
        "chunk_algo_version": RAG_CHUNK_ALGO_VERSION,
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


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
        try:
            _EMBEDDING_MODEL = SentenceTransformer(EMBEDDING_MODEL_NAME)
        except Exception as exc:
            raise RuntimeError(
                "Impossible de charger le modele d'embedding "
                f"'{EMBEDDING_MODEL_NAME}'. Verifiez le telechargement et la "
                "disponibilite reseau."
            ) from exc
        return _EMBEDDING_MODEL


def _connect_rag_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(RAG_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _init_rag_db():
    RAG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect_rag_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rag_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rag_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                file_hash TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                mtime_ns INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL DEFAULT 0,
                indexed_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rag_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding TEXT NOT NULL,
                norm REAL NOT NULL,
                UNIQUE(document_id, chunk_index),
                FOREIGN KEY(document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_rag_documents_name ON rag_documents(name)"
        )
        conn.commit()


def _rag_meta_get(conn: sqlite3.Connection, key: str, default: str | None = None) -> str | None:
    row = conn.execute("SELECT value FROM rag_meta WHERE key = ?", (key,)).fetchone()
    if row is None:
        return default
    return str(row["value"])


def _rag_meta_set(conn: sqlite3.Connection, key: str, value: str):
    conn.execute(
        """
        INSERT INTO rag_meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, value),
    )


def _load_runtime_rag_config(conn: sqlite3.Connection) -> dict | None:
    raw = _rag_meta_get(conn, "rag_runtime_config")
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    required = {
        "chunk_size",
        "overlap",
        "top_k",
        "source_cap",
        "score_mode",
        "embedding_model",
    }
    if not required.issubset(set(data.keys())):
        return None
    return data


def _clear_rag_store_memory():
    with RAG_LOCK:
        RAG_STORE["docs"].clear()
        RAG_STORE["sources"].clear()
        RAG_STORE["embeds"].clear()
        RAG_STORE["norms"].clear()


def _load_rag_store_from_db():
    _init_rag_db()
    docs = []
    sources = []
    embeds = []
    norms = []
    with _connect_rag_db() as conn:
        rows = conn.execute(
            """
            SELECT d.name AS source, c.content, c.embedding, c.norm
            FROM rag_chunks c
            JOIN rag_documents d ON d.id = c.document_id
            ORDER BY d.name ASC, c.chunk_index ASC
            """
        ).fetchall()
    for row in rows:
        try:
            embedding = json.loads(row["embedding"])
        except Exception:
            continue
        docs.append(row["content"])
        sources.append(row["source"])
        embeds.append(embedding)
        norms.append(float(row["norm"]))
    with RAG_LOCK:
        RAG_STORE["docs"] = docs
        RAG_STORE["sources"] = sources
        RAG_STORE["embeds"] = embeds
        RAG_STORE["norms"] = norms


def _coerce_rag_runtime_config(config: dict) -> dict:
    normalized = dict(config)
    chunk_size, overlap = _normalize_rag_chunk_params(
        int(normalized.get("chunk_size", DEFAULT_CHUNK_SIZE)),
        int(normalized.get("overlap", DEFAULT_CHUNK_OVERLAP)),
    )
    normalized["chunk_size"] = chunk_size
    normalized["overlap"] = overlap
    normalized["top_k"] = max(1, min(int(normalized.get("top_k", DEFAULT_TOP_K)), 20))
    normalized["source_cap"] = max(
        1,
        min(int(normalized.get("source_cap", RAG_DEFAULT_SOURCE_CAP)), 6),
    )
    normalized["score_mode"] = str(
        normalized.get("score_mode", RAG_DEFAULT_SCORE_MODE)
    )
    normalized["embedding_model"] = str(
        normalized.get("embedding_model", EMBEDDING_MODEL_NAME)
    )
    return normalized


def _current_rag_runtime_config(source_files: list[Path] | None = None) -> dict:
    _init_rag_db()
    if source_files is None:
        source_files = _list_docrag_files()
    suggested = _suggest_rag_config(source_files)
    with _connect_rag_db() as conn:
        runtime = _load_runtime_rag_config(conn) or suggested
    return _coerce_rag_runtime_config(runtime)


def _rag_state(source_files: list[Path] | None = None, config: dict | None = None) -> dict:
    _init_rag_db()
    if source_files is None:
        source_files = _list_docrag_files()
    suggested = _suggest_rag_config(source_files)
    with _connect_rag_db() as conn:
        rows = conn.execute(
            "SELECT name, chunk_count FROM rag_documents ORDER BY name ASC"
        ).fetchall()
        runtime_config = _load_runtime_rag_config(conn) or suggested
    files = [
        {"name": str(row["name"]), "chunks": int(row["chunk_count"])}
        for row in rows
    ]
    chunk_total = sum(item["chunks"] for item in files)
    effective_config = _coerce_rag_runtime_config(config or runtime_config)
    return {
        "chunks": chunk_total,
        "sources": len(files),
        "files": files,
        "config": effective_config,
    }


def _normalize_rag_chunk_params(chunk_size: int, overlap: int) -> tuple[int, int]:
    normalized_chunk_size = max(200, min(int(chunk_size), 4000))
    normalized_overlap = max(0, min(int(overlap), normalized_chunk_size - 1))
    return normalized_chunk_size, normalized_overlap


def _list_docrag_files() -> list[Path]:
    if not RAG_DOCS_DIR.exists():
        return []
    files = []
    for path in RAG_DOCS_DIR.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in RAG_ALLOWED_EXTENSIONS:
            continue
        files.append(path)
    return sorted(files, key=lambda path: path.as_posix().lower())


def _sync_rag_from_doc_folder(
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> dict:
    _init_rag_db()
    RAG_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    source_files = _list_docrag_files()
    suggested = _suggest_rag_config(source_files)

    raw_chunk_size = int(chunk_size) if chunk_size is not None else int(suggested["chunk_size"])
    raw_overlap = int(overlap) if overlap is not None else int(suggested["overlap"])
    normalized_chunk_size, normalized_overlap = _normalize_rag_chunk_params(
        raw_chunk_size,
        raw_overlap,
    )

    runtime_config = {
        "chunk_size": normalized_chunk_size,
        "overlap": normalized_overlap,
        "top_k": int(suggested["top_k"]),
        "source_cap": int(suggested["source_cap"]),
        "score_mode": str(suggested["score_mode"]),
        "embedding_model": EMBEDDING_MODEL_NAME,
    }
    runtime_config["top_k"] = max(1, min(runtime_config["top_k"], 20))
    runtime_config["source_cap"] = max(1, min(runtime_config["source_cap"], 6))
    index_signature = _build_rag_index_signature(runtime_config)

    errors = []
    indexed_files = 0
    updated_files = 0
    stale_doc_ids = []
    force_reindex = False

    with _connect_rag_db() as conn:
        previous_signature = _rag_meta_get(conn, "rag_index_signature", "")
        force_reindex = previous_signature != index_signature

        existing_rows = conn.execute(
            "SELECT id, name, file_hash FROM rag_documents"
        ).fetchall()
        existing_by_name = {str(row["name"]): row for row in existing_rows}
        current_names = set()

        for file_path in source_files:
            rel_name = str(file_path.relative_to(RAG_DOCS_DIR)).replace("\\", "/")
            current_names.add(rel_name)

            try:
                payload = file_path.read_bytes()
                stat = file_path.stat()
            except Exception as exc:
                errors.append(f"{rel_name} - Erreur de lecture: {exc}")
                continue

            file_hash = hashlib.sha256(payload).hexdigest()
            existing = existing_by_name.get(rel_name)
            if (
                existing
                and not force_reindex
                and str(existing["file_hash"]) == file_hash
            ):
                continue

            text, err = _text_from_bytes(rel_name, payload)
            if err:
                errors.append(f"{rel_name} - {err}")
                continue

            chunks = _chunk_text(
                text,
                runtime_config["chunk_size"],
                runtime_config["overlap"],
            )
            embeds = []
            norms = []
            if chunks:
                try:
                    embeds = _embed_texts(chunks)
                except RuntimeError as exc:
                    errors.append(f"{rel_name} - {exc}")
                    continue
                norms = [_vector_norm(embedding) for embedding in embeds]

            now_ts = int(time.time())
            if existing:
                doc_id = int(existing["id"])
                conn.execute("DELETE FROM rag_chunks WHERE document_id = ?", (doc_id,))
                conn.execute(
                    """
                    UPDATE rag_documents
                    SET file_hash = ?, size_bytes = ?, mtime_ns = ?, chunk_count = ?, indexed_at = ?
                    WHERE id = ?
                    """,
                    (
                        file_hash,
                        int(stat.st_size),
                        int(stat.st_mtime_ns),
                        len(chunks),
                        now_ts,
                        doc_id,
                    ),
                )
                updated_files += 1
            else:
                cursor = conn.execute(
                    """
                    INSERT INTO rag_documents (name, file_hash, size_bytes, mtime_ns, chunk_count, indexed_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rel_name,
                        file_hash,
                        int(stat.st_size),
                        int(stat.st_mtime_ns),
                        len(chunks),
                        now_ts,
                    ),
                )
                doc_id = int(cursor.lastrowid)
                indexed_files += 1

            if chunks:
                conn.executemany(
                    """
                    INSERT INTO rag_chunks (document_id, chunk_index, content, embedding, norm)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            doc_id,
                            idx,
                            chunks[idx],
                            json.dumps(embeds[idx], ensure_ascii=False),
                            float(norms[idx]),
                        )
                        for idx in range(len(chunks))
                    ],
                )

        stale_doc_ids = [
            int(row["id"])
            for row in existing_rows
            if str(row["name"]) not in current_names
        ]
        for doc_id in stale_doc_ids:
            conn.execute("DELETE FROM rag_documents WHERE id = ?", (doc_id,))

        _rag_meta_set(conn, "rag_index_signature", index_signature)
        _rag_meta_set(
            conn,
            "rag_runtime_config",
            json.dumps(runtime_config, ensure_ascii=False),
        )
        conn.commit()

    _load_rag_store_from_db()
    state = _rag_state(source_files=source_files, config=runtime_config)
    return {
        "indexed_files": indexed_files,
        "updated_files": updated_files,
        "removed_files": len(stale_doc_ids),
        "errors": errors,
        "chunks": state["chunks"],
        "sources": state["sources"],
        "files": state["files"],
        "config": state["config"],
        "index_signature_changed": force_reindex,
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


def _retrieve_chunks(
    query: str,
    top_k: int,
    min_score: float,
    source_cap: int = RAG_DEFAULT_SOURCE_CAP,
    score_mode: str = RAG_DEFAULT_SCORE_MODE,
) -> tuple[list[dict], dict]:
    with RAG_LOCK:
        docs = list(RAG_STORE["docs"])
        sources = list(RAG_STORE["sources"])
        embeds = list(RAG_STORE["embeds"])
        norms = list(RAG_STORE["norms"])

    if not docs:
        return [], {
            "effective_min_score": max(0.0, min(float(min_score), 1.0)),
            "top_score": 0.0,
            "candidate_count": 0,
            "score_mode": str(score_mode),
            "selected_sources": [],
        }

    query_emb = _embed_texts([query])[0]
    qn = _vector_norm(query_emb)
    if qn == 0:
        return [], {
            "effective_min_score": max(0.0, min(float(min_score), 1.0)),
            "top_score": 0.0,
            "candidate_count": 0,
            "score_mode": str(score_mode),
            "selected_sources": [],
        }

    query_terms = _extract_query_terms(query)
    chunk_token_sets = [set(_tokenize_text(doc)) for doc in docs]
    term_doc_freq = Counter()
    for term in query_terms:
        term_doc_freq[term] = sum(1 for tokens in chunk_token_sets if term in tokens)
    term_idf = {
        term: math.log((len(docs) + 1) / (term_doc_freq[term] + 1)) + 1.0
        for term in query_terms
    }
    idf_total = sum(term_idf.values()) or 1.0

    scored = []
    for idx, emb in enumerate(embeds):
        denom = qn * norms[idx]
        cosine = _dot_product(query_emb, emb) / denom if denom else 0.0
        lexical_raw = 0.0
        if query_terms:
            chunk_tokens = chunk_token_sets[idx]
            for term in query_terms:
                if term in chunk_tokens:
                    lexical_raw += term_idf[term]
        lexical_norm = lexical_raw / idf_total
        lexical_bonus = min(RAG_LEXICAL_BONUS_MAX, lexical_norm * RAG_LEXICAL_BONUS_MAX)
        score = cosine + lexical_bonus
        scored.append(
            {
                "score": float(score),
                "cosine": float(cosine),
                "lexical_bonus": float(lexical_bonus),
                "idx": idx,
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)
    top_score = scored[0]["score"] if scored else 0.0
    if score_mode == RAG_DEFAULT_SCORE_MODE:
        effective_min = max(RAG_RETRIEVAL_ABS_MIN, top_score - RAG_RETRIEVAL_REL_GAP)
    else:
        effective_min = max(0.0, min(float(min_score), 1.0))

    selected = []
    selected_source_counts = Counter()
    limited_source_cap = max(1, min(int(source_cap), 6))
    limited_top_k = max(1, min(int(top_k), 20))

    for item in scored:
        if len(selected) >= limited_top_k:
            break
        if item["score"] < effective_min:
            continue
        source_name = sources[item["idx"]]
        if selected_source_counts[source_name] >= limited_source_cap:
            continue
        selected_source_counts[source_name] += 1
        selected.append(
            {
                "score": item["score"],
                "text": docs[item["idx"]],
                "source": source_name,
                "cosine": item["cosine"],
                "lexical_bonus": item["lexical_bonus"],
            }
        )

    if len(selected) < limited_top_k:
        relaxed_min = max(RAG_RETRIEVAL_ABS_MIN, effective_min - 0.20)
        for item in scored:
            if len(selected) >= limited_top_k:
                break
            if item["score"] < relaxed_min:
                continue
            source_name = sources[item["idx"]]
            if selected_source_counts[source_name] >= limited_source_cap:
                continue
            selected_source_counts[source_name] += 1
            selected.append(
                {
                    "score": item["score"],
                    "text": docs[item["idx"]],
                    "source": source_name,
                    "cosine": item["cosine"],
                    "lexical_bonus": item["lexical_bonus"],
                }
            )

    retrieval_meta = {
        "effective_min_score": float(effective_min),
        "top_score": float(top_score),
        "candidate_count": len(scored),
        "score_mode": str(score_mode),
        "selected_sources": sorted(selected_source_counts.keys()),
    }
    return selected, retrieval_meta


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
    return _sync_rag_from_doc_folder()


@app.post("/api/rag/reset")
def rag_reset():
    return _sync_rag_from_doc_folder()


@app.post("/api/rag/index")
def rag_index():
    return _sync_rag_from_doc_folder()


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

    runtime_config = _current_rag_runtime_config()
    top_k = int(runtime_config["top_k"])
    source_cap = int(runtime_config["source_cap"])
    score_mode = str(runtime_config["score_mode"])
    min_score = DEFAULT_MIN_SCORE

    try:
        results, retrieval_meta = _retrieve_chunks(
            query=query,
            top_k=top_k,
            min_score=min_score,
            source_cap=source_cap,
            score_mode=score_mode,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    grounding_fallback = not bool(results)
    fallback_reason = "no_results" if grounding_fallback else None
    data = {}
    if grounding_fallback:
        reply = RAG_FALLBACK_REPLY
    else:
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
            reply = str(data["choices"][0]["message"]["content"])
        except Exception:
            raise HTTPException(status_code=502, detail="Reponse LLM invalide.")
        if not _has_citation(reply):
            reply = _build_natural_fallback_reply(query, results)
            if reply == RAG_FALLBACK_REPLY:
                grounding_fallback = True
                fallback_reason = "missing_citation_no_support"
            else:
                grounding_fallback = False
                fallback_reason = "missing_citation_rephrased"
        else:
            fallback_reason = None

    retrieval = {
        "used_top_k": top_k,
        "used_min_score": float(retrieval_meta.get("effective_min_score", min_score)),
        "source_cap": source_cap,
        "selected_sources": retrieval_meta.get("selected_sources", []),
        "grounding_mode": RAG_GROUNDING_MODE,
        "grounding_fallback": grounding_fallback,
        "grounding_fallback_reason": fallback_reason,
        "score_mode": retrieval_meta.get("score_mode", score_mode),
        "top_score": float(retrieval_meta.get("top_score", 0.0)),
    }

    return {
        "reply": reply,
        "sources": results,
        "model": data.get("model"),
        "usage": data.get("usage"),
        "retrieval": retrieval,
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
        print("[ws] model unavailable")
        await ws.send_text(json.dumps({"error": "Modele MediaPipe indisponible."}))
        await ws.close()
        return

    current_config = DEFAULT_MP_CONFIG.copy()
    active_model_path = MODEL_CHOICES.get(current_config["model"], model_path)
    try:
        recognizer, applied_config, warning = _create_video_recognizer(
            str(active_model_path), current_config
        )
    except Exception as exc:
        print(f"[ws] recognizer init failed: {exc}")
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
            try:
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
                            except Exception as exc:
                                print(f"[ws] config apply failed: {exc}")
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
                            "gesture": {
                                "label": label,
                                "score": score,
                                "raw": raw_label,
                            },
                            "metrics": {"inference_ms": inference_ms},
                        }
                    )
                )
            except Exception:
                # Keep the socket alive on occasional malformed frames or decode errors.
                continue
    except WebSocketDisconnect as exc:
        print(f"[ws] client disconnected (code={exc.code})")
    except Exception as exc:
        print(f"[ws] unexpected error: {exc}")
    finally:
        try:
            recognizer.close()
        except Exception:
            pass


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
            try:
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
                continue
    except WebSocketDisconnect as exc:
        print(f"[ws/emotion] client disconnected (code={exc.code})")
    except Exception as exc:
        print(f"[ws/emotion] unexpected error: {exc}")
    finally:
        try:
            face_mesh.close()
        except Exception:
            pass
