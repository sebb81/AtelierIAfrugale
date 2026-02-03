import { dom } from "./dom.js";
import { currentPage, state } from "./state.js";
import { updateBadges } from "./ui.js";

let recorder = null;
let chunks = [];
let streamRef = null;

const STOPWORDS = new Set([
  "je", "tu", "il", "elle", "nous", "vous", "ils", "elles",
  "le", "la", "les", "un", "une", "des", "du", "de", "d",
  "et", "ou", "mais", "donc", "or", "ni", "car",
  "pour", "par", "avec", "sans", "dans", "sur", "sous", "chez",
  "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes",
  "son", "sa", "ses", "notre", "vos", "leur", "leurs",
  "est", "suis", "es", "sommes", "etes", "sont",
  "a", "as", "avons", "avez", "ont",
  "que", "qui", "quoi", "dont", "ou",
  "au", "aux"
]);

function setAudioStatus(message) {
  if (!dom.audioStatus) return;
  if (!message) {
    dom.audioStatus.hidden = true;
    dom.audioStatus.textContent = "";
    return;
  }
  dom.audioStatus.hidden = false;
  dom.audioStatus.textContent = message;
}

function setAudioButtons(recording) {
  if (dom.audioRecord) dom.audioRecord.disabled = recording;
  if (dom.audioStop) dom.audioStop.disabled = !recording;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function wordCount(text) {
  const tokens = normalizeText(text).match(/\b\w+\b/g);
  return tokens ? tokens.length : 0;
}

function concisionStars(count) {
  if (count <= 4) return "*****";
  if (count <= 6) return "****";
  if (count <= 8) return "***";
  if (count <= 12) return "**";
  return "*";
}

function importantWords(text) {
  const tokens = normalizeText(text).match(/\b\w+\b/g) || [];
  return tokens.filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function keywordPreservation(a, b) {
  const base = new Set(importantWords(a));
  if (!base.size) return 1;
  const cand = new Set(importantWords(b));
  let kept = 0;
  base.forEach((word) => {
    if (cand.has(word)) kept += 1;
  });
  return kept / Math.max(1, base.size);
}

function nextLabel() {
  const count = state.audioAttempts.length;
  if (count === 0) return "Phrase 1 (complete)";
  if (count === 1) return "Phrase 2 (plus courte)";
  if (count === 2) return "Phrase 3 (mots-cles)";
  return `Phrase ${count + 1}`;
}

function renderAttempts() {
  if (!dom.audioAttempts) return;
  dom.audioAttempts.innerHTML = "";
  state.audioAttempts.forEach((attempt) => {
    const wrapper = document.createElement("div");
    wrapper.className = "audio-attempt";

    const head = document.createElement("div");
    head.className = "audio-attempt-head";
    const meta = document.createElement("span");
    meta.textContent = attempt.label;
    const stats = document.createElement("span");
    stats.textContent = `${attempt.words} mots - ${attempt.chars} caracteres - ${attempt.stars}`;

    head.appendChild(meta);
    head.appendChild(stats);

    const body = document.createElement("div");
    body.className = "audio-attempt-text";
    body.textContent = attempt.transcript || "(vide)";

    wrapper.appendChild(head);
    wrapper.appendChild(body);
    dom.audioAttempts.appendChild(wrapper);
  });
}

function renderFeedback() {
  if (!dom.audioFeedback || !dom.audioFeedbackBody) return;
  if (state.audioAttempts.length < 2) {
    dom.audioFeedback.hidden = true;
    dom.audioFeedbackBody.textContent = "";
    return;
  }
  const first = state.audioAttempts[0].transcript;
  const last = state.audioAttempts[state.audioAttempts.length - 1].transcript;
  const score = keywordPreservation(first, last);
  const percent = Math.round(score * 100);
  let message = `Conservation des mots-cles : ${percent}%.\n`;
  if (score >= 0.7) {
    message += "Pari reussi : la concision garde le sens.";
  } else if (score >= 0.4) {
    message += "Zone grise : des elements importants disparaissent.";
  } else {
    message += "Limite atteinte : trop de perte de sens.";
  }
  dom.audioFeedback.hidden = false;
  dom.audioFeedbackBody.textContent = message;
}

function addAttempt(transcript) {
  const label = nextLabel();
  const words = wordCount(transcript);
  const chars = transcript.trim().length;
  const stars = concisionStars(words);
  state.audioAttempts.push({ label, transcript, words, chars, stars });
  renderAttempts();
  renderFeedback();

  if (state.audioAttempts.length >= 3 && !state.badgeState.mission5) {
    state.badgeState.mission5 = true;
    updateBadges();
  }
}

async function transcribeAudio(blob) {
  const endpoint = currentPage.audioEndpoint || "/api/audio/transcribe";
  const language = dom.audioLanguage ? dom.audioLanguage.value : "fr";
  const formData = new FormData();
  const ext = blob.type && blob.type.includes("ogg") ? "ogg" : "webm";
  formData.append("file", blob, `recording.${ext}`);
  formData.append("language", language);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });
  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }
  if (!response.ok) {
    const detail = data?.detail || data?.error || "Erreur serveur.";
    throw new Error(detail);
  }
  return data?.text || "";
}

async function handleRecord() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setAudioStatus("Microphone non disponible.");
    return;
  }
  if (recorder) return;
  try {
    streamRef = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(streamRef);
    chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = async () => {
      setAudioButtons(false);
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      chunks = [];
      recorder = null;
      if (streamRef) {
        streamRef.getTracks().forEach((track) => track.stop());
        streamRef = null;
      }
      if (dom.audioPlayback) {
        dom.audioPlayback.src = URL.createObjectURL(blob);
        dom.audioPlayback.hidden = false;
      }
      try {
        setAudioStatus("Transcription en cours...");
        const text = await transcribeAudio(blob);
        setAudioStatus(null);
        addAttempt(text);
      } catch (err) {
        setAudioStatus(err.message || "Erreur inconnue.");
      }
    };
    recorder.start();
    setAudioButtons(true);
    setAudioStatus("Enregistrement en cours...");
  } catch (err) {
    setAudioStatus("Acces micro refuse.");
  }
}

function handleStop() {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
}

function clearAttempts() {
  state.audioAttempts = [];
  renderAttempts();
  renderFeedback();
  if (dom.audioPlayback) {
    dom.audioPlayback.hidden = true;
    dom.audioPlayback.src = "";
  }
  setAudioStatus(null);
}

export function setupAudio() {
  if (!currentPage.showAudio) return;
  if (!dom.audioPanel) return;

  renderAttempts();
  renderFeedback();
  setAudioButtons(false);

  if (dom.audioRecord) {
    dom.audioRecord.addEventListener("click", () => handleRecord());
  }
  if (dom.audioStop) {
    dom.audioStop.addEventListener("click", () => handleStop());
  }
  if (dom.audioClear) {
    dom.audioClear.addEventListener("click", () => clearAttempts());
  }
}
