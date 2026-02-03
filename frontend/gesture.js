import { dom } from "./dom.js";
import { currentPage, state } from "./state.js";
import { HOLD_FRAMES, REQUIRED_THRESHOLD } from "./constants.js";
import { updateBadges } from "./ui.js";

export function drawLandmarks(landmarks) {
  if (!dom.ctx || !dom.canvas) return;
  dom.ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
  if (!landmarks) return;
  const HAND_CONNECTIONS = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],
    [0, 17]
  ];

  dom.ctx.lineWidth = 3;
  dom.ctx.strokeStyle = "#ff4d4d";
  dom.ctx.fillStyle = "#64f3a1";

  for (const hand of landmarks) {
    for (const [start, end] of HAND_CONNECTIONS) {
      const a = hand[start];
      const b = hand[end];
      if (!a || !b) continue;
      const ax = a.x * dom.canvas.width;
      const ay = a.y * dom.canvas.height;
      const bx = b.x * dom.canvas.width;
      const by = b.y * dom.canvas.height;
      dom.ctx.beginPath();
      dom.ctx.moveTo(ax, ay);
      dom.ctx.lineTo(bx, by);
      dom.ctx.stroke();
    }

    hand.forEach((point) => {
      const x = point.x * dom.canvas.width;
      const y = point.y * dom.canvas.height;
      dom.ctx.beginPath();
      dom.ctx.arc(x, y, 5, 0, Math.PI * 2);
      dom.ctx.fill();
    });
  }
}

function scoreThumbUp(hand) {
  if (!hand || hand.length < 21) {
    return { score: 0, label: "Aucune main detectee" };
  }

  const thumbExtended = hand[4].y < hand[3].y && hand[3].y < hand[2].y;
  const indexFolded = hand[8].y > hand[6].y;
  const middleFolded = hand[12].y > hand[10].y;
  const ringFolded = hand[16].y > hand[14].y;
  const pinkyFolded = hand[20].y > hand[18].y;

  let score = 0;
  score += thumbExtended ? 0.5 : 0;
  score += indexFolded ? 0.125 : 0;
  score += middleFolded ? 0.125 : 0;
  score += ringFolded ? 0.125 : 0;
  score += pinkyFolded ? 0.125 : 0;

  const threshold = dom.thresholdInput ? Number(dom.thresholdInput.value) : 0;
  const label = score >= threshold ? "Pouce leve" : "Geste non reconnu";
  return { score, label };
}

export function updateMissionProgress(isValid, score) {
  if (!currentPage.usesCamera || currentPage.id !== "mission1") return;

  if (isValid) {
    state.holdFrames += 1;
    if (state.holdFrames >= HOLD_FRAMES) {
      const threshold = dom.thresholdInput ? Number(dom.thresholdInput.value) : 0;
      state.bestThreshold = Math.max(state.bestThreshold, threshold);
      state.holdFrames = 0;
    }
  } else {
    state.holdFrames = 0;
  }

  if (dom.bestThresholdEl) {
    dom.bestThresholdEl.textContent = state.bestThreshold.toFixed(2);
  }
  if (!state.badgeState.mission1 && state.bestThreshold >= REQUIRED_THRESHOLD) {
    state.badgeState.mission1 = true;
    if (dom.badgeStateEl) dom.badgeStateEl.textContent = "Debloque";
    updateBadges();
  }

  if (dom.badgeStateEl) {
    dom.badgeStateEl.textContent = state.badgeState.mission1
      ? "Debloque"
      : `Objectif ${REQUIRED_THRESHOLD.toFixed(2)}`;
  }

  if (dom.gestureScoreEl) dom.gestureScoreEl.textContent = score.toFixed(2);
}

export function updateGestureBar(label, score) {
  if (!dom.gestureBarName || !dom.gestureBarScore || !dom.gestureBarFill) return;
  const safeScore = Math.max(0, Math.min(1, Number(score) || 0));
  const percent = Math.round(safeScore * 100);
  dom.gestureBarName.textContent = label || "Aucune main";
  dom.gestureBarScore.textContent = `${percent}%`;
  dom.gestureBarFill.style.width = `${percent}%`;
}

export function updateInferenceTime(metrics) {
  if (!dom.inferenceTimeEl) return;
  if (!metrics || metrics.inference_ms === undefined || metrics.inference_ms === null) {
    dom.inferenceTimeEl.textContent = "0.0";
    return;
  }
  dom.inferenceTimeEl.textContent = Number(metrics.inference_ms).toFixed(1);
}

export function updateGestureMetrics(landmarks, gesture) {
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

  if (!landmarks || !landmarks.length) {
    if (dom.gestureLabel) dom.gestureLabel.textContent = "Aucune main";
    if (dom.gestureConfidence) dom.gestureConfidence.textContent = "0.00";
    if (dom.gestureScoreEl) dom.gestureScoreEl.textContent = "0.00";
    if (dom.gestureStatusEl) dom.gestureStatusEl.textContent = "En attente";
    updateGestureBar("Aucune main", 0);
    updateMissionProgress(false, 0);
    return;
  }

  let label = "Geste non reconnu";
  let score = 0;
  if (gesture && gesture.label) {
    label = gesture.label;
    score = Number(gesture.score || 0);
  } else {
    const fallback = scoreThumbUp(landmarks[0]);
    label = fallback.label;
    score = fallback.score;
  }

  const barLabel = gesture && gesture.raw ? gesture.raw : label;
  const threshold = dom.thresholdInput ? Number(dom.thresholdInput.value) : 0;
  const isThumb = label.toLowerCase().includes("pouce");
  const isValid = isThumb && score >= threshold;

  if (dom.gestureLabel) dom.gestureLabel.textContent = label;
  if (dom.gestureConfidence) dom.gestureConfidence.textContent = score.toFixed(2);
  if (dom.gestureStatusEl) dom.gestureStatusEl.textContent = isValid ? "Valide" : label;

  updateGestureBar(barLabel, score);
  updateMissionProgress(isValid, score);
}
