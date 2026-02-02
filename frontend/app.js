const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const stepTitle = document.getElementById("step-title");
const stepBody = document.getElementById("step-body");
const stepHint = document.getElementById("step-hint");
const stepCounter = document.getElementById("step-counter");
const progressBar = document.getElementById("progress-bar");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const gestureLabel = document.getElementById("gesture-label");
const gestureConfidence = document.getElementById("gesture-confidence");
const gestureFps = document.getElementById("gesture-fps");
const thresholdInput = document.getElementById("threshold");
const thresholdValue = document.getElementById("threshold-value");
const gestureScoreEl = document.getElementById("gesture-score");
const gestureStatusEl = document.getElementById("gesture-status");
const bestThresholdEl = document.getElementById("best-threshold");
const badgeStateEl = document.getElementById("badge-state");
const scoreTotalEl = document.getElementById("score-total");
const missionActiveEl = document.getElementById("mission-active");
const challengePanel = document.getElementById("challenge-panel");
const badgeChips = Array.from(document.querySelectorAll(".badge-chip"));
const missionMap = document.getElementById("mission-map");
const heroTitle = document.getElementById("hero-title");
const heroBody = document.getElementById("hero-body");
const stageTitle = document.getElementById("stage-title");
const stageDesc = document.getElementById("stage-desc");
const missionTitle = document.getElementById("mission-title");
const missionSubtitle = document.getElementById("mission-subtitle");
const stageMedia = document.getElementById("stage-media");
const stagePlaceholder = document.getElementById("stage-placeholder");
const kpiLabelGesture = document.getElementById("kpi-label-gesture");
const kpiLabelConfidence = document.getElementById("kpi-label-confidence");
const kpiLabelFps = document.getElementById("kpi-label-fps");
const navHome = document.getElementById("nav-home");
const navPrev = document.getElementById("nav-prev");
const navNext = document.getElementById("nav-next");

const pageId = document.body.dataset.page || "home";
const REQUIRED_THRESHOLD = 0.75;
const HOLD_FRAMES = 10;

const ALL_MISSIONS = [
  {
    id: "mission1",
    title: "Mission 1 - Geste",
    desc: "Pouce leve, seuil de confiance."
  },
  {
    id: "mission2",
    title: "Mission 2 - Emotion",
    desc: "Face mesh et nuance emotionnelle."
  },
  {
    id: "mission3",
    title: "Mission 3 - Chatbot",
    desc: "Assistant compact et local."
  },
  {
    id: "mission4",
    title: "Mission 4 - Documents",
    desc: "RAG frugal sur documents internes."
  },
  {
    id: "mission5",
    title: "Mission 5 - Audio",
    desc: "Reconnaissance vocale sobre."
  }
];

const PAGE_CONFIG = {
  home: {
    id: "home",
    heroTitle: "Serious Game IA frugales",
    heroBody:
      "Choisis une mission et progresse dans le serious game. Chaque mission explore un arbitrage precision, latence et impact.",
    stageTitle: "Bienvenue",
    stageDesc: "Selectionne une mission pour commencer le parcours.",
    missionTitle: "Accueil",
    missionSubtitle: "Navigation libre entre missions.",
    placeholderTitle: "Choisir une mission",
    placeholderBody: "Utilise la carte des missions pour naviguer.",
    kpiLabels: {
      gesture: "Mission",
      confidence: "Etat",
      fps: "Progression"
    },
    usesCamera: false,
    defaultThreshold: 0.6,
    steps: [
      {
        id: "home",
        title: "Accueil du serious game",
        body:
          "Tu disposes de 5 missions. Commence par la mission 1 pour la detection de geste en local.",
        hint: "Objectif : tester une IA sobre a chaque etape.",
        type: "info"
      }
    ]
  },
  mission1: {
    id: "mission1",
    heroTitle: "Serious Game IA frugales",
    heroBody:
      "Un parcours d experimentation autour des IA locales et sobres. Chaque mission met en scene un arbitrage precision, latence et impact.",
    stageTitle: "Atelier vision locale",
    stageDesc: "Detection mains en direct. Rien ne sort de la machine.",
    missionTitle: "Briefing de mission",
    missionSubtitle: "Serious game IA frugale : missions courtes, badges a debloquer.",
    placeholderTitle: "Module en preparation",
    placeholderBody: "Cette mission utilise un autre capteur ou un autre type de modele.",
    kpiLabels: {
      gesture: "Geste detecte",
      confidence: "Confiance",
      fps: "FPS"
    },
    usesCamera: true,
    defaultThreshold: 0.6,
    steps: [
      {
        id: "intro",
        title: "Briefing : IA frugale",
        body:
          "Tu pilotes un labo d IA locale. Objectif : livrer de la valeur avec un budget energie minimal. Chaque mission explore un compromis entre precision, latence et sobriete.",
        hint: "Garde en tete la triade valeur, cout, empreinte.",
        type: "info"
      },
      {
        id: "mission1",
        title: "Mission 1 - Geste frugal",
        body:
          "Detecte un pouce leve en local. Ajuste le seuil de confiance pour maximiser la precision sans perdre la detection.",
        hint:
          "Defi : trouve le seuil le plus haut qui reconnait encore ton pouce leve.",
        type: "gesture"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Bravo, tu as teste un modele local. Les prochaines missions couvrent emotion, chatbot compact, RAG et audio.",
        hint: "Petit modele + bon cadrage = impact reduit.",
        type: "info"
      }
    ]
  },
  mission2: {
    id: "mission2",
    heroTitle: "Mission 2 - Emotion responsable",
    heroBody:
      "Observer une emotion sans sur-consommer. On joue sur la precision percue et la sobriete du modele.",
    stageTitle: "Atelier emotion",
    stageDesc: "Prototype sans camera : scenario de calibration emotionnelle.",
    missionTitle: "Briefing emotion",
    missionSubtitle: "Comprendre les limites, la contextuelle, et la sobriete.",
    placeholderTitle: "Capteur alternatif",
    placeholderBody: "Module emotion en preparation. Utilise un flux de donnees pre-enregistre.",
    kpiLabels: {
      gesture: "Signal",
      confidence: "Qualite",
      fps: "Latence"
    },
    usesCamera: false,
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission2",
        title: "Mission 2 - Emotion responsable",
        body:
          "Scenario : une conseillere bancaire adapte son discours a l humeur du client. Tu dois limiter la complexite du modele.",
        hint: "Defi : garder une detection stable sans modele lourd.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Moins de variables = plus de sobriete. Priorise les signaux vraiment utiles.",
        hint: "Pense a des seuils, pas a une emotion parfaite.",
        type: "info"
      }
    ]
  },
  mission3: {
    id: "mission3",
    heroTitle: "Mission 3 - Chatbot compact",
    heroBody:
      "Un assistant local, rapide, et assez bon pour le quotidien. La valeur d usage avant la taille du modele.",
    stageTitle: "Atelier chatbot",
    stageDesc: "Prototype texte : pas de camera ici.",
    missionTitle: "Briefing chatbot",
    missionSubtitle: "Composer des reponses utiles avec un modele compact.",
    placeholderTitle: "Mode texte",
    placeholderBody: "Module chatbot en preparation. Simule des reponses courtes et utiles.",
    kpiLabels: {
      gesture: "Pertinence",
      confidence: "Concision",
      fps: "Latence"
    },
    usesCamera: false,
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission3",
        title: "Mission 3 - Chatbot compact",
        body:
          "Scenario : repondre a un client en moins de 2 secondes. Tu dois garder une reponse claire et locale.",
        hint: "Defi : limiter le contexte sans perdre l essentiel.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Des prompts plus courts reduisent l energie. Utilise des patrons simples.",
        hint: "Un bon cadre bat un grand modele.",
        type: "info"
      }
    ]
  },
  mission4: {
    id: "mission4",
    heroTitle: "Mission 4 - RAG frugal",
    heroBody:
      "Limiter les documents, cibler les sources utiles, et garder la reponse locale.",
    stageTitle: "Atelier documents",
    stageDesc: "Prototype RAG : index minimal, reponse rapide.",
    missionTitle: "Briefing RAG",
    missionSubtitle: "Prioriser l impact plutot que l exhaustivite.",
    placeholderTitle: "RAG local",
    placeholderBody: "Module RAG en preparation. Travaille sur un corpus reduit.",
    kpiLabels: {
      gesture: "Couverture",
      confidence: "Precision",
      fps: "Index"
    },
    usesCamera: false,
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission4",
        title: "Mission 4 - RAG frugal",
        body:
          "Scenario : repondre a des questions internes sans charger tout l historique.",
        hint: "Defi : selectionner 5 documents utiles.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Moins de sources = moins de cout. Mesure avant d ajouter.",
        hint: "Le bruit coute plus que le manque.",
        type: "info"
      }
    ]
  },
  mission5: {
    id: "mission5",
    heroTitle: "Mission 5 - Audio sobre",
    heroBody:
      "Reconnaissance vocale locale, sans streaming. On accepte un peu d erreur pour baisser l empreinte.",
    stageTitle: "Atelier audio",
    stageDesc: "Prototype micro : pas de flux video.",
    missionTitle: "Briefing audio",
    missionSubtitle: "Garder un service utile avec un modele leger.",
    placeholderTitle: "Micro local",
    placeholderBody: "Module audio en preparation. Simule des commandes courtes.",
    kpiLabels: {
      gesture: "Clarte",
      confidence: "Robustesse",
      fps: "Latence"
    },
    usesCamera: false,
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission5",
        title: "Mission 5 - Audio sobre",
        body:
          "Scenario : dicter une commande courte. Tu ajustes le modele pour limiter la consommation.",
        hint: "Defi : reduire les erreurs sans augmenter la taille.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Un vocabulaire restreint augmente la fiabilite et diminue l energie.",
        hint: "Le contexte doit rester minimal.",
        type: "info"
      }
    ]
  }
};

const currentPage = PAGE_CONFIG[pageId] || PAGE_CONFIG.home;
let steps = currentPage.steps;

const badgeState = {
  mission1: false,
  mission2: false,
  mission3: false,
  mission4: false,
  mission5: false
};

let currentStep = 0;
let bestThreshold = 0;
let holdFrames = 0;
let lastMessageAt = null;
let fps = 0;

function setStatus(text, ready = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("ready", ready);
}

function updateThresholdDisplay() {
  thresholdValue.textContent = Number(thresholdInput.value).toFixed(2);
}

function applyPageConfig() {
  if (heroTitle) heroTitle.textContent = currentPage.heroTitle;
  if (heroBody) heroBody.textContent = currentPage.heroBody;
  if (stageTitle) stageTitle.textContent = currentPage.stageTitle;
  if (stageDesc) stageDesc.textContent = currentPage.stageDesc;
  if (missionTitle) missionTitle.textContent = currentPage.missionTitle;
  if (missionSubtitle) missionSubtitle.textContent = currentPage.missionSubtitle;
  if (kpiLabelGesture) kpiLabelGesture.textContent = currentPage.kpiLabels.gesture;
  if (kpiLabelConfidence) kpiLabelConfidence.textContent = currentPage.kpiLabels.confidence;
  if (kpiLabelFps) kpiLabelFps.textContent = currentPage.kpiLabels.fps;

  if (stageMedia) stageMedia.hidden = !currentPage.usesCamera;
  if (stagePlaceholder) {
    stagePlaceholder.hidden = currentPage.usesCamera;
    const placeholderTitle = stagePlaceholder.querySelector("h3");
    const placeholderBody = stagePlaceholder.querySelector("p");
    if (placeholderTitle) placeholderTitle.textContent = currentPage.placeholderTitle;
    if (placeholderBody) placeholderBody.textContent = currentPage.placeholderBody;
  }

  thresholdInput.value = currentPage.defaultThreshold;
  updateThresholdDisplay();

  if (!currentPage.usesCamera) {
    setStatus("Module sans camera");
    gestureLabel.textContent = "N/A";
    gestureConfidence.textContent = "0.00";
    gestureFps.textContent = "0";
  }
}

function updateBadges() {
  const completed = Object.values(badgeState).filter(Boolean).length;
  scoreTotalEl.textContent = `${completed}/${ALL_MISSIONS.length}`;
  badgeChips.forEach((chip) => {
    const key = chip.dataset.badge;
    const isCurrent = key === currentPage.id;
    chip.classList.toggle("active", Boolean(badgeState[key]));
    chip.classList.toggle("current", isCurrent && !badgeState[key]);
  });
}

function missionHref(id) {
  return `/${id}`;
}

function renderMissionMap() {
  missionMap.innerHTML = "";
  ALL_MISSIONS.forEach((mission) => {
    const item = document.createElement("a");
    item.classList.add("map-item");
    item.href = missionHref(mission.id);
    item.setAttribute("aria-label", mission.title);
    if (mission.id !== currentPage.id) item.classList.add("locked");
    if (badgeState[mission.id]) item.classList.add("done");
    if (mission.id === currentPage.id) item.classList.add("active");

    let statusText = "Bientot";
    if (mission.id === currentPage.id) statusText = "Active";
    if (badgeState[mission.id]) statusText = "Badge obtenu";

    item.innerHTML = `
      <div class="map-title">${mission.title}</div>
      <div class="map-desc">${mission.desc}</div>
      <div class="map-status">${statusText}</div>
    `;
    missionMap.appendChild(item);
  });
}

function setNavState(link, href, label, enabled) {
  link.textContent = label;
  link.href = href || "#";
  link.classList.toggle("disabled", !enabled);
}

function applyNavigation() {
  if (!navHome || !navPrev || !navNext) return;
  navHome.href = "/";

  const missionIds = ALL_MISSIONS.map((m) => m.id);
  const currentIndex = missionIds.indexOf(currentPage.id);

  if (currentPage.id === "home") {
    setNavState(navPrev, null, "Mission precedente", false);
    setNavState(navNext, missionHref("mission1"), "Commencer mission 1", true);
    return;
  }

  const prevId = currentIndex > 0 ? missionIds[currentIndex - 1] : null;
  const nextId = currentIndex < missionIds.length - 1 ? missionIds[currentIndex + 1] : null;

  setNavState(
    navPrev,
    prevId ? missionHref(prevId) : null,
    prevId ? `Mission precedente` : "Mission precedente",
    Boolean(prevId)
  );
  setNavState(
    navNext,
    nextId ? missionHref(nextId) : null,
    nextId ? `Mission suivante` : "Mission suivante",
    Boolean(nextId)
  );
}

function renderStep() {
  const step = steps[currentStep];
  stepTitle.textContent = step.title;
  stepBody.textContent = step.body;
  stepHint.textContent = step.hint;
  stepCounter.textContent = `Etape ${currentStep + 1} / ${steps.length}`;
  const progress = ((currentStep + 1) / steps.length) * 100;
  progressBar.style.width = `${progress}%`;
  prevBtn.disabled = currentStep === 0;
  nextBtn.disabled = currentStep === steps.length - 1;
  missionActiveEl.textContent = step.title;
  const showChallenge = step.type === "gesture" && currentPage.usesCamera;
  challengePanel.hidden = !showChallenge;
  if (step.id === "mission1") {
    bestThresholdEl.textContent = bestThreshold.toFixed(2);
    badgeStateEl.textContent = badgeState.mission1
      ? "Debloque"
      : `Objectif ${REQUIRED_THRESHOLD.toFixed(2)}`;
  }
  renderMissionMap();
  updateBadges();
}

prevBtn.addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep -= 1;
    renderStep();
  }
});

nextBtn.addEventListener("click", () => {
  if (currentStep < steps.length - 1) {
    currentStep += 1;
    renderStep();
  }
});

thresholdInput.addEventListener("input", () => {
  updateThresholdDisplay();
});

function drawLandmarks(landmarks) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#6fe2c7";
  for (const hand of landmarks) {
    for (const p of hand) {
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
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

  const threshold = Number(thresholdInput.value);
  const label = score >= threshold ? "Pouce leve" : "Geste non reconnu";
  return { score, label };
}

function updateMissionProgress(isValid, score) {
  if (!currentPage.usesCamera || currentPage.id !== "mission1") return;
  if (steps[currentStep].id !== "mission1") return;

  if (isValid) {
    holdFrames += 1;
    if (holdFrames >= HOLD_FRAMES) {
      const threshold = Number(thresholdInput.value);
      bestThreshold = Math.max(bestThreshold, threshold);
      holdFrames = 0;
    }
  } else {
    holdFrames = 0;
  }

  bestThresholdEl.textContent = bestThreshold.toFixed(2);
  if (!badgeState.mission1 && bestThreshold >= REQUIRED_THRESHOLD) {
    badgeState.mission1 = true;
    badgeStateEl.textContent = "Debloque";
    updateBadges();
  }

  if (badgeState.mission1) {
    badgeStateEl.textContent = "Debloque";
  } else {
    badgeStateEl.textContent = `Objectif ${REQUIRED_THRESHOLD.toFixed(2)}`;
  }

  gestureScoreEl.textContent = score.toFixed(2);
}

function updateGestureMetrics(landmarks) {
  const now = performance.now();
  if (lastMessageAt) {
    const dt = (now - lastMessageAt) / 1000;
    if (dt > 0) {
      const instant = 1 / dt;
      fps = fps * 0.8 + instant * 0.2;
    }
  }
  lastMessageAt = now;
  gestureFps.textContent = fps ? fps.toFixed(1) : "0";

  if (!landmarks || !landmarks.length) {
    gestureLabel.textContent = "Aucune main";
    gestureConfidence.textContent = "0.00";
    gestureScoreEl.textContent = "0.00";
    gestureStatusEl.textContent = "En attente";
    updateMissionProgress(false, 0);
    return;
  }

  const result = scoreThumbUp(landmarks[0]);
  const isValid = result.label === "Pouce leve";

  gestureLabel.textContent = result.label;
  gestureConfidence.textContent = result.score.toFixed(2);
  gestureStatusEl.textContent = isValid ? "Valide" : result.label;

  updateMissionProgress(isValid, result.score);
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 960, height: 540 }
  });
  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = resolve;
  });

  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);

  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d");

  const sendWidth = 480;
  const sendHeight = Math.round((sendWidth * video.videoHeight) / video.videoWidth);
  off.width = sendWidth;
  off.height = sendHeight;

  const fpsTarget = 15;
  let timerId = null;

  ws.addEventListener("open", () => {
    setStatus("Streaming actif", true);
    timerId = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      offCtx.drawImage(video, 0, 0, sendWidth, sendHeight);
      const jpg = off.toDataURL("image/jpeg", 0.6);
      ws.send(jpg);
    }, 1000 / fpsTarget);
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    drawLandmarks(msg.landmarks);
    updateGestureMetrics(msg.landmarks);
  });

  ws.addEventListener("close", () => {
    if (timerId) {
      clearInterval(timerId);
    }
    setStatus("WebSocket ferme. Recharge la page pour reconnecter.");
  });

  ws.addEventListener("error", () => {
    setStatus("Erreur WebSocket.");
  });
}

async function boot() {
  applyPageConfig();
  applyNavigation();
  renderStep();
  if (!currentPage.usesCamera) return;
  try {
    setStatus("Demande d acces a la camera...");
    await setupCamera();
    setStatus("Connexion WebSocket...");
    connectWebSocket();
  } catch (err) {
    console.error(err);
    setStatus("Impossible d acceder a la camera.");
  }
}

boot();
