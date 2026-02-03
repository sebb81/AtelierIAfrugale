import { dom } from "./dom.js";
import { DEFAULT_MP_CONFIG } from "./constants.js";
import { currentPage, state } from "./state.js";

export function updateThresholdDisplay() {
  if (!dom.thresholdInput || !dom.thresholdValue) return;
  dom.thresholdValue.textContent = Number(dom.thresholdInput.value).toFixed(2);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

export function updateNumHandsDisplay() {
  if (!dom.numHandsInput || !dom.numHandsValue) return;
  dom.numHandsValue.textContent = dom.numHandsInput.value;
}

export function updatePercentDisplay(inputEl, outputEl) {
  if (!inputEl || !outputEl) return;
  outputEl.textContent = formatPercent(Number(inputEl.value));
}

export function applyConfigToUI(config) {
  if (!config) return;
  if (dom.delegateSelect && config.delegate) {
    dom.delegateSelect.value = config.delegate;
  }
  if (dom.modelSelect && config.model) {
    dom.modelSelect.value = config.model;
  }
  if (dom.numHandsInput && Number.isFinite(config.num_hands)) {
    dom.numHandsInput.value = String(config.num_hands);
  }
  if (dom.minDetectionInput && Number.isFinite(config.min_hand_detection_confidence)) {
    dom.minDetectionInput.value = String(config.min_hand_detection_confidence);
  }
  if (dom.minPresenceInput && Number.isFinite(config.min_hand_presence_confidence)) {
    dom.minPresenceInput.value = String(config.min_hand_presence_confidence);
  }
  if (dom.minTrackingInput && Number.isFinite(config.min_tracking_confidence)) {
    dom.minTrackingInput.value = String(config.min_tracking_confidence);
  }
  updateNumHandsDisplay();
  updatePercentDisplay(dom.minDetectionInput, dom.minDetectionValue);
  updatePercentDisplay(dom.minPresenceInput, dom.minPresenceValue);
  updatePercentDisplay(dom.minTrackingInput, dom.minTrackingValue);
}

export function readConfigFromUI() {
  return {
    delegate: dom.delegateSelect ? dom.delegateSelect.value : DEFAULT_MP_CONFIG.delegate,
    model: dom.modelSelect ? dom.modelSelect.value : DEFAULT_MP_CONFIG.model,
    num_hands: dom.numHandsInput ? Number(dom.numHandsInput.value) : DEFAULT_MP_CONFIG.num_hands,
    min_hand_detection_confidence: dom.minDetectionInput
      ? Number(dom.minDetectionInput.value)
      : DEFAULT_MP_CONFIG.min_hand_detection_confidence,
    min_hand_presence_confidence: dom.minPresenceInput
      ? Number(dom.minPresenceInput.value)
      : DEFAULT_MP_CONFIG.min_hand_presence_confidence,
    min_tracking_confidence: dom.minTrackingInput
      ? Number(dom.minTrackingInput.value)
      : DEFAULT_MP_CONFIG.min_tracking_confidence
  };
}

export function showConfigWarning(message) {
  if (!dom.configWarningEl) return;
  if (!message) {
    dom.configWarningEl.hidden = true;
    dom.configWarningEl.textContent = "";
    return;
  }
  dom.configWarningEl.hidden = false;
  dom.configWarningEl.textContent = message;
}

export function sendConfig() {
  if (!currentPage.usesCamera || !currentPage.showMpControls) return;
  const payload = readConfigFromUI();
  if (state.wsRef && state.wsRef.readyState === WebSocket.OPEN) {
    state.wsRef.send(JSON.stringify({ type: "config", config: payload }));
  }
}

export function bindConfigControls() {
  if (dom.thresholdInput) {
    dom.thresholdInput.addEventListener("input", () => {
      updateThresholdDisplay();
    });
  }

  if (dom.delegateSelect) {
    dom.delegateSelect.addEventListener("change", () => {
      showConfigWarning(null);
      sendConfig();
    });
  }

  if (dom.modelSelect) {
    dom.modelSelect.addEventListener("change", () => {
      showConfigWarning(null);
      sendConfig();
    });
  }

  if (dom.numHandsInput) {
    dom.numHandsInput.addEventListener("input", () => {
      updateNumHandsDisplay();
    });
    dom.numHandsInput.addEventListener("change", () => {
      sendConfig();
    });
  }

  if (dom.minDetectionInput) {
    dom.minDetectionInput.addEventListener("input", () => {
      updatePercentDisplay(dom.minDetectionInput, dom.minDetectionValue);
    });
    dom.minDetectionInput.addEventListener("change", () => {
      sendConfig();
    });
  }

  if (dom.minPresenceInput) {
    dom.minPresenceInput.addEventListener("input", () => {
      updatePercentDisplay(dom.minPresenceInput, dom.minPresenceValue);
    });
    dom.minPresenceInput.addEventListener("change", () => {
      sendConfig();
    });
  }

  if (dom.minTrackingInput) {
    dom.minTrackingInput.addEventListener("input", () => {
      updatePercentDisplay(dom.minTrackingInput, dom.minTrackingValue);
    });
    dom.minTrackingInput.addEventListener("change", () => {
      sendConfig();
    });
  }
}
