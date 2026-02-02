import base64
import json
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    model_complexity=0,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

app.mount("/static", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")


@app.get("/")
def index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/mission{mission_id}")
def mission_page(mission_id: int):
    if mission_id < 1 or mission_id > 5:
        raise HTTPException(status_code=404)
    return FileResponse(FRONTEND_DIR / f"mission{mission_id}.html")

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data_url = await ws.receive_text()

            # data_url = "data:image/jpeg;base64,...."
            b64 = data_url.split(",", 1)[1]
            jpg_bytes = base64.b64decode(b64)

            arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)  # BGR
            if frame is None:
                await ws.send_text(json.dumps({"landmarks": None}))
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = hands.process(rgb)

            out = []
            if res.multi_hand_landmarks:
                for hand_lms in res.multi_hand_landmarks:
                    pts = [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in hand_lms.landmark]
                    out.append(pts)

            await ws.send_text(json.dumps({"landmarks": out if out else None}))
    except Exception:
        # client disconnected or error
        pass
