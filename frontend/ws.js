import { dom } from "./dom.js";
import { currentPage, state } from "./state.js";
import { setStatus } from "./ui.js";
import { applyConfigToUI, sendConfig, showConfigWarning } from "./config.js";
import { drawLandmarks, updateGestureMetrics, updateInferenceTime } from "./gesture.js";
import { drawFaceGuides, updateEmotionMetrics } from "./emotion.js";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 8000;

let reconnectTimerId = null;
let reconnectAttempts = 0;
let lifecycleBound = false;
let allowReconnect = true;
let frameInFlight = false;

function clearReconnectTimer() {
  if (!reconnectTimerId) return;
  clearTimeout(reconnectTimerId);
  reconnectTimerId = null;
}

function nextReconnectDelayMs() {
  const exp = Math.min(reconnectAttempts, 3);
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** exp);
}

function scheduleReconnect(closeEvent) {
  if (!allowReconnect || !currentPage.usesCamera) return;
  if (document.visibilityState === "hidden") return;
  if (reconnectTimerId) return;
  const delayMs = nextReconnectDelayMs();
  reconnectAttempts += 1;
  const delaySec = Math.max(1, Math.round(delayMs / 1000));
  const code =
    closeEvent && Number.isFinite(closeEvent.code) ? ` (code ${closeEvent.code})` : "";
  setStatus(`Connexion perdue${code}. Reconnexion automatique dans ${delaySec}s...`);
  reconnectTimerId = setTimeout(() => {
    reconnectTimerId = null;
    connectWebSocket();
  }, delayMs);
}

function bindWsLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;

  window.addEventListener("pagehide", () => {
    allowReconnect = false;
    clearReconnectTimer();
  });

  window.addEventListener("beforeunload", () => {
    allowReconnect = false;
    clearReconnectTimer();
  });

  window.addEventListener("pageshow", () => {
    allowReconnect = true;
    if (!currentPage.usesCamera) return;
    if (state.wsRef && state.wsRef.readyState !== WebSocket.CLOSED) return;
    connectWebSocket();
  });

  window.addEventListener("online", () => {
    if (document.visibilityState === "hidden") return;
    if (!currentPage.usesCamera) return;
    if (state.wsRef && state.wsRef.readyState !== WebSocket.CLOSED) return;
    connectWebSocket();
  });
}

export function connectWebSocket() {
  bindWsLifecycle();
  if (!currentPage.usesCamera) return;
  allowReconnect = true;
  if (state.wsRef && state.wsRef.readyState !== WebSocket.CLOSED) {
    return;
  }

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const endpoint = currentPage.wsEndpoint || "/ws";
  const ws = new WebSocket(`${protocol}://${location.host}${endpoint}`);
  state.wsRef = ws;
  clearReconnectTimer();

  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d");

  const sendWidth = currentPage.id === "mission2" ? 640 : 480;
  const sourceWidth = dom.video && dom.video.videoWidth ? dom.video.videoWidth : sendWidth;
  const sourceHeight =
    dom.video && dom.video.videoHeight ? dom.video.videoHeight : Math.round(sendWidth * 0.75);
  const sendHeight = Math.max(1, Math.round((sendWidth * sourceHeight) / Math.max(sourceWidth, 1)));
  off.width = sendWidth;
  off.height = sendHeight;

  const fpsTarget = 15;
  let timerId = null;

  ws.addEventListener("open", () => {
    reconnectAttempts = 0;
    frameInFlight = false;
    setStatus("Streaming actif", true);
    if (currentPage.showMpControls) {
      sendConfig();
    }
    timerId = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!dom.video) return;
      if (frameInFlight) return;
      if (ws.bufferedAmount > 1_000_000) return;
      try {
        offCtx.drawImage(dom.video, 0, 0, sendWidth, sendHeight);
        const jpg = off.toDataURL("image/jpeg", 0.6);
        ws.send(jpg);
        frameInFlight = true;
      } catch (err) {
        // Skip invalid frames without dropping the socket.
      }
    }, 1000 / fpsTarget);
  });

  ws.addEventListener("message", (event) => {
    frameInFlight = false;
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
    if (msg.type === "emotion") {
      drawFaceGuides(msg.guides);
      updateEmotionMetrics(msg);
      updateInferenceTime(msg.metrics);
      return;
    }
    drawLandmarks(msg.landmarks);
    updateGestureMetrics(msg.landmarks, msg.gesture);
    updateInferenceTime(msg.metrics);
  });

  ws.addEventListener("close", (event) => {
    if (timerId) {
      clearInterval(timerId);
    }
    frameInFlight = false;
    if (state.wsRef === ws) {
      state.wsRef = null;
    }
    scheduleReconnect(event);
  });

  ws.addEventListener("error", () => {
    setStatus("Erreur WebSocket. Tentative de reconnexion...");
  });
}
