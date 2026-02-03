import { dom } from "./dom.js";
import { currentPage, state } from "./state.js";
import { ALL_MISSIONS, CARD_MISSIONS } from "./missions.js";
import { DEFAULT_MP_CONFIG, REQUIRED_THRESHOLD } from "./constants.js";
import {
  applyConfigToUI,
  showConfigWarning,
  updateThresholdDisplay
} from "./config.js";

export function setStatus(text, ready = false) {
  if (!dom.statusEl) return;
  dom.statusEl.textContent = text;
  dom.statusEl.classList.toggle("ready", ready);
}

export function applyPageConfig() {
  if (dom.heroTitle) dom.heroTitle.textContent = currentPage.heroTitle;
  if (dom.heroBody) dom.heroBody.textContent = currentPage.heroBody;
  if (dom.stageTitle) dom.stageTitle.textContent = currentPage.stageTitle;
  if (dom.stageDesc) dom.stageDesc.textContent = currentPage.stageDesc;
  if (dom.missionTitle) dom.missionTitle.textContent = currentPage.missionTitle;
  if (dom.missionSubtitle) dom.missionSubtitle.textContent = currentPage.missionSubtitle;
  if (dom.kpiLabelGesture) dom.kpiLabelGesture.textContent = currentPage.kpiLabels.gesture;
  if (dom.kpiLabelConfidence) dom.kpiLabelConfidence.textContent = currentPage.kpiLabels.confidence;
  if (dom.kpiLabelFps) dom.kpiLabelFps.textContent = currentPage.kpiLabels.fps;

  if (dom.stageMedia) dom.stageMedia.hidden = !currentPage.usesCamera;
  if (dom.chatPanel) dom.chatPanel.hidden = !currentPage.showChat;
  if (dom.stagePlaceholder) {
    const showPlaceholder = !currentPage.usesCamera && !currentPage.showChat;
    dom.stagePlaceholder.hidden = !showPlaceholder;
    const placeholderTitle = dom.stagePlaceholder.querySelector("h3");
    const placeholderBody = dom.stagePlaceholder.querySelector("p");
    if (placeholderTitle) placeholderTitle.textContent = currentPage.placeholderTitle;
    if (placeholderBody) placeholderBody.textContent = currentPage.placeholderBody;
  }
  if (dom.gestureReadout) dom.gestureReadout.hidden = !currentPage.usesCamera;
  if (dom.gestureControls) {
    dom.gestureControls.hidden = !(currentPage.usesCamera && currentPage.showMpControls);
  }

  const thresholdConfig = currentPage.threshold || {
    label: "Seuil de confiance",
    min: 0,
    max: 1,
    step: 0.01,
    value: currentPage.defaultThreshold ?? 0.6
  };
  if (dom.thresholdInput) {
    dom.thresholdInput.min = thresholdConfig.min;
    dom.thresholdInput.max = thresholdConfig.max;
    dom.thresholdInput.step = thresholdConfig.step;
    dom.thresholdInput.value = thresholdConfig.value;
    updateThresholdDisplay();
  }
  if (dom.thresholdLabel) {
    dom.thresholdLabel.textContent = thresholdConfig.label || "Seuil de confiance";
  }
  const statLabels = currentPage.statLabels || {
    score: "Score geste",
    status: "Reconnaissance",
    best: "Meilleur seuil",
    badge: "Badge"
  };
  if (dom.statLabelScore) dom.statLabelScore.textContent = statLabels.score;
  if (dom.statLabelStatus) dom.statLabelStatus.textContent = statLabels.status;
  if (dom.statLabelBest) dom.statLabelBest.textContent = statLabels.best;
  if (dom.statLabelBadge) dom.statLabelBadge.textContent = statLabels.badge;

  if (!currentPage.usesCamera) {
    if (currentPage.showChat) {
      setStatus("Chatbot local pret");
    } else {
      setStatus("Module sans camera");
    }
    if (dom.gestureLabel) dom.gestureLabel.textContent = "N/A";
    if (dom.gestureConfidence) dom.gestureConfidence.textContent = "0.00";
    if (dom.gestureFps) dom.gestureFps.textContent = "0";
    showConfigWarning(null);
  } else {
    if (currentPage.showMpControls) {
      applyConfigToUI(DEFAULT_MP_CONFIG);
    }
    showConfigWarning(null);
  }
}

export function updateBadges() {
  if (!dom.scoreTotalEl) return;
  const completed = Object.values(state.badgeState).filter(Boolean).length;
  dom.scoreTotalEl.textContent = `${completed}/${ALL_MISSIONS.length}`;
  dom.badgeChips.forEach((chip) => {
    const key = chip.dataset.badge;
    const isCurrent = key === currentPage.id;
    chip.classList.toggle("active", Boolean(state.badgeState[key]));
    chip.classList.toggle("current", isCurrent && !state.badgeState[key]);
  });
}

function missionHref(id) {
  return `/${id}`;
}

export function renderMissionCards() {
  if (!dom.missionCards) return;
  if (currentPage.id !== "home") {
    dom.missionCards.hidden = true;
    return;
  }
  dom.missionCards.hidden = false;
  const grid = dom.missionCards.querySelector(".mission-cards-grid");
  if (!grid) return;
  grid.innerHTML = "";
  CARD_MISSIONS.forEach((mission) => {
    const card = document.createElement("a");
    card.classList.add("mission-tile");
    card.href = missionHref(mission.id);
    card.innerHTML = `
      <div class="mission-tile-header">
        <div class="mission-tile-icon">${mission.label}</div>
        <h3 class="mission-tile-title">${mission.title}</h3>
      </div>
      <p class="mission-tile-desc">${mission.desc}</p>
      <div class="mission-tile-status">Disponible</div>
      <span class="mission-tile-button">Commencer</span>
    `;
    grid.appendChild(card);
  });
}

function setNavState(link, href, label, enabled) {
  if (!link) return;
  link.textContent = label;
  link.href = href || "#";
  link.classList.toggle("disabled", !enabled);
}

export function applyNavigation() {
  if (!dom.navHome || !dom.navPrev || !dom.navNext) return;
  dom.navHome.href = "/";

  const missionIds = ALL_MISSIONS.map((mission) => mission.id);
  const currentIndex = missionIds.indexOf(currentPage.id);

  if (currentPage.id === "home") {
    setNavState(dom.navPrev, null, "Mission precedente", false);
    setNavState(dom.navNext, missionHref("mission1"), "Commencer mission 1", true);
    return;
  }

  const prevId = currentIndex > 0 ? missionIds[currentIndex - 1] : null;
  const nextId = currentIndex < missionIds.length - 1 ? missionIds[currentIndex + 1] : null;

  setNavState(
    dom.navPrev,
    prevId ? missionHref(prevId) : null,
    "Mission precedente",
    Boolean(prevId)
  );
  setNavState(
    dom.navNext,
    nextId ? missionHref(nextId) : null,
    "Mission suivante",
    Boolean(nextId)
  );
}

export function renderStep() {
  const step = state.steps[state.currentStep];
  if (!step) return;
  if (dom.stepTitle) dom.stepTitle.textContent = step.title;
  if (dom.stepBody) dom.stepBody.textContent = step.body;
  if (dom.stepHint) dom.stepHint.textContent = step.hint;
  if (dom.stepCounter) {
    dom.stepCounter.textContent = `Etape ${state.currentStep + 1} / ${state.steps.length}`;
  }
  if (dom.progressBar) {
    const progress = ((state.currentStep + 1) / state.steps.length) * 100;
    dom.progressBar.style.width = `${progress}%`;
  }
  if (dom.missionActiveEl) dom.missionActiveEl.textContent = step.title;
  const showChallenge = Boolean(currentPage.challenge && currentPage.usesCamera);
  if (dom.challengePanel) dom.challengePanel.hidden = !showChallenge;
  if (currentPage.id === "mission1") {
    if (dom.bestThresholdEl) dom.bestThresholdEl.textContent = state.bestThreshold.toFixed(2);
    if (dom.badgeStateEl) {
      dom.badgeStateEl.textContent = state.badgeState.mission1
        ? "Debloque"
        : `Objectif ${REQUIRED_THRESHOLD.toFixed(2)}`;
    }
  } else if (currentPage.id === "mission2") {
    if (dom.bestThresholdEl) dom.bestThresholdEl.textContent = state.bestThreshold.toFixed(2);
    if (dom.badgeStateEl) {
      dom.badgeStateEl.textContent = state.badgeState.mission2 ? "Debloque" : "Verrouille";
    }
  }
  updateBadges();
  renderMissionCards();
}
