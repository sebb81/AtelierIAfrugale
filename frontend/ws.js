import { dom } from "./dom.js";
import { state } from "./state.js";
import { setStatus } from "./ui.js";
import { applyConfigToUI, sendConfig, showConfigWarning } from "./config.js";
import { drawLandmarks, updateGestureMetrics, updateInferenceTime } from "./gesture.js";

export function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);
  state.wsRef = ws;

  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d");

  const sendWidth = 480;
  const sendHeight = dom.video
    ? Math.round((sendWidth * dom.video.videoHeight) / dom.video.videoWidth)
    : 0;
  off.width = sendWidth;
  off.height = sendHeight;

  const fpsTarget = 15;
  let timerId = null;

  ws.addEventListener("open", () => {
    setStatus("Streaming actif", true);
    sendConfig();
    timerId = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!dom.video) return;
      offCtx.drawImage(dom.video, 0, 0, sendWidth, sendHeight);
      const jpg = off.toDataURL("image/jpeg", 0.6);
      ws.send(jpg);
    }, 1000 / fpsTarget);
  });

  ws.addEventListener("message", (event) => {
    let msg = null;
    try {
      msg = JSON.parse(event.data);
    } catch (err) {
      return;
    }
    if (msg.type === "config") {
      if (msg.applied || msg.config) {
        applyConfigToUI(msg.applied || msg.config);
      }
      showConfigWarning(msg.warning || null);
      return;
    }
    if (msg.type === "error") {
      setStatus(msg.message || msg.error || "Erreur WebSocket.");
      return;
    }
    if (msg.error) {
      setStatus(msg.error);
      return;
    }
    drawLandmarks(msg.landmarks);
    updateGestureMetrics(msg.landmarks, msg.gesture);
    updateInferenceTime(msg.metrics);
  });

  ws.addEventListener("close", () => {
    if (timerId) {
      clearInterval(timerId);
    }
    state.wsRef = null;
    setStatus("WebSocket ferme. Recharge la page pour reconnecter.");
  });

  ws.addEventListener("error", () => {
    setStatus("Erreur WebSocket.");
  });
}
