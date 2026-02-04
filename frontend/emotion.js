import { dom } from "./dom.js";
import { currentPage, state } from "./state.js";
import { updateBadges } from "./ui.js";
import { updateGestureBar } from "./gesture.js";

function updateFps() {
  const now = performance.now();
  if (state.lastMessageAt) {
    const dt = (now - state.lastMessageAt) / 1000;
    if (dt > 0) {
      const instant = 1 / dt;
      state.fps = state.fps * 0.8 + instant * 0.2;
    }
  }
  state.lastMessageAt = now;
  if (dom.gestureFps) {
    dom.gestureFps.textContent = state.fps ? state.fps.toFixed(1) : "0";
  }
}

function setMission2BadgeText() {
  if (!dom.badgeStateEl) return;
  dom.badgeStateEl.textContent = state.badgeState.mission2 ? "Debloque" : "Verrouille";
}

function renderMission2AcceptanceUI() {
  if (currentPage.id !== "mission2") {
    if (dom.confidenceAcceptancePanel) dom.confidenceAcceptancePanel.hidden = true;
    return;
  }

  const accepted = state.mission2Decision.accepted;
  const showPanel = accepted || state.mission2Decision.canAcceptVisible;

  if (dom.confidenceAcceptancePanel) dom.confidenceAcceptancePanel.hidden = !showPanel;
  if (dom.confidenceAcceptanceRow) dom.confidenceAcceptanceRow.hidden = !showPanel || accepted;

  if (dom.confidenceAcceptanceCheckbox) {
    dom.confidenceAcceptanceCheckbox.checked = accepted;
    dom.confidenceAcceptanceCheckbox.disabled = accepted;
  }

  if (dom.confidenceAcceptanceSummary) {
    dom.confidenceAcceptanceSummary.hidden = !accepted;
  }

  if (accepted) {
    if (dom.acceptedThresholdEl) {
      dom.acceptedThresholdEl.textContent = state.mission2Decision.acceptedThreshold.toFixed(2);
    }
    if (dom.acceptedConfidenceEl) {
      dom.acceptedConfidenceEl.textContent = `~${state.mission2Decision.acceptedConfidence.toFixed(3)}`;
    }
  }
}

export function bindMission2AcceptanceControl() {
  if (currentPage.id !== "mission2") return;
  if (!dom.confidenceAcceptanceCheckbox) return;

  if (dom.confidenceAcceptanceCheckbox.dataset.boundMission2 === "1") {
    renderMission2AcceptanceUI();
    return;
  }

  dom.confidenceAcceptanceCheckbox.dataset.boundMission2 = "1";
  dom.confidenceAcceptanceCheckbox.addEventListener("change", () => {
    if (!dom.confidenceAcceptanceCheckbox.checked) return;
    if (!state.mission2Decision.canAcceptVisible) {
      dom.confidenceAcceptanceCheckbox.checked = false;
      return;
    }

    state.mission2Decision.accepted = true;
    state.mission2Decision.acceptedThreshold = state.mission2Decision.lastThreshold;
    state.mission2Decision.acceptedConfidence = state.mission2Decision.lastScore;

    if (!state.badgeState.mission2) {
      state.badgeState.mission2 = true;
      updateBadges();
    }

    setMission2BadgeText();
    renderMission2AcceptanceUI();
  });

  renderMission2AcceptanceUI();
}

export function drawFaceGuides(guides) {
  if (!dom.ctx || !dom.canvas) return;
  dom.ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
  if (!guides) return;

  dom.ctx.lineWidth = 3;
  dom.ctx.strokeStyle = "#6fe2c7";
  dom.ctx.fillStyle = "#ffd166";

  Object.values(guides).forEach((segment) => {
    if (!Array.isArray(segment) || segment.length < 2) return;
    const [start, end] = segment;
    if (!start || !end) return;
    const sx = start.x * dom.canvas.width;
    const sy = start.y * dom.canvas.height;
    const ex = end.x * dom.canvas.width;
    const ey = end.y * dom.canvas.height;
    dom.ctx.beginPath();
    dom.ctx.moveTo(sx, sy);
    dom.ctx.lineTo(ex, ey);
    dom.ctx.stroke();

    dom.ctx.beginPath();
    dom.ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    dom.ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    dom.ctx.fill();
  });
}

export function updateEmotionMetrics(payload) {
  if (!currentPage.usesCamera || currentPage.id !== "mission2") return;
  updateFps();

  const hasFace = payload && payload.face;
  const metrics = payload && payload.metrics ? payload.metrics : null;
  const baseLabel =
    (payload && payload.emotion && payload.emotion.label) || "Aucun visage detecte";

  if (!hasFace || !metrics) {
    if (dom.gestureLabel) dom.gestureLabel.textContent = "Aucun visage detecte";
    if (dom.gestureConfidence) dom.gestureConfidence.textContent = "0.00";
    if (dom.gestureScoreEl) dom.gestureScoreEl.textContent = "0.00";
    if (dom.gestureStatusEl) dom.gestureStatusEl.textContent = "En attente";
    updateGestureBar("Aucun visage", 0);
    state.mission2Decision.canAccept = false;
    setMission2BadgeText();
    renderMission2AcceptanceUI();
    return;
  }

  const threshold = dom.thresholdInput ? Number(dom.thresholdInput.value) : 0.43;
  const smileRatio = Number(metrics.smile_width_ratio || 0);
  const validSmile = baseLabel === "Sourire" && smileRatio > threshold;
  let label = baseLabel;
  if (label === "Sourire" && !validSmile) {
    label = "Neutre";
  }

  if (dom.gestureLabel) dom.gestureLabel.textContent = label;
  if (dom.gestureConfidence) dom.gestureConfidence.textContent = smileRatio.toFixed(3);
  if (dom.gestureScoreEl) dom.gestureScoreEl.textContent = smileRatio.toFixed(3);
  if (dom.gestureStatusEl) dom.gestureStatusEl.textContent = label;

  updateGestureBar(label, smileRatio);

  state.mission2Decision.canAccept = validSmile;
  if (validSmile) {
    state.mission2Decision.canAcceptVisible = true;
    state.mission2Decision.lastScore = smileRatio;
    state.mission2Decision.lastThreshold = threshold;
    state.bestThreshold = Math.max(state.bestThreshold, threshold);
  }

  if (dom.bestThresholdEl) dom.bestThresholdEl.textContent = state.bestThreshold.toFixed(2);
  setMission2BadgeText();
  renderMission2AcceptanceUI();
}
