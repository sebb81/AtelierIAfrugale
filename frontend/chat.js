import { dom } from "./dom.js";
import { currentPage, state } from "./state.js";
import { updateBadges } from "./ui.js";

function isRagMode() {
  return currentPage.chatMode === "rag";
}

function setChatStatus(message) {
  if (!dom.chatStatus) return;
  if (!message) {
    dom.chatStatus.hidden = true;
    dom.chatStatus.textContent = "";
    return;
  }
  dom.chatStatus.hidden = false;
  dom.chatStatus.textContent = message;
}

function setChatBusy(isBusy) {
  state.chatBusy = isBusy;
  if (dom.chatSend) dom.chatSend.disabled = isBusy;
  if (dom.chatInput) dom.chatInput.disabled = isBusy;
}

function renderMessages() {
  if (!dom.chatLog) return;
  dom.chatLog.innerHTML = "";
  state.chatMessages.forEach((msg) => {
    const row = document.createElement("div");
    row.className = `chat-message ${msg.role}`;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = msg.content;
    row.appendChild(bubble);
    dom.chatLog.appendChild(row);
  });
  dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
}

function addMessage(role, content) {
  state.chatMessages.push({ role, content });
  renderMessages();
}

function updateRagCounts(counts) {
  if (!dom.ragCounts) return;
  const chunks = counts?.chunks ?? 0;
  const sources = counts?.sources ?? 0;
  dom.ragCounts.textContent = `Chunks : ${chunks} \u00b7 Sources : ${sources}`;
}

function updateMinScoreDisplay() {
  if (!dom.ragMinScore || !dom.ragMinScoreValue) return;
  dom.ragMinScoreValue.textContent = Number(dom.ragMinScore.value).toFixed(2);
}

function renderSources(sources) {
  if (!dom.ragSources || !dom.ragSourceList) return;
  if (!sources || !sources.length) {
    dom.ragSources.hidden = true;
    dom.ragSourceList.innerHTML = "";
    return;
  }
  dom.ragSources.hidden = false;
  dom.ragSourceList.innerHTML = "";
  sources.forEach((item, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "rag-source";
    const header = document.createElement("div");
    header.className = "rag-source-head";
    const score = Number(item.score || 0);
    header.textContent = `[${index + 1}] ${item.source || "Source"} \u00b7 score ${score.toFixed(3)}`;
    const body = document.createElement("div");
    body.className = "rag-source-text";
    body.textContent = item.text || "";
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    dom.ragSourceList.appendChild(wrapper);
  });
}

async function fetchRagState() {
  const endpoint = currentPage.ragStateEndpoint || "/api/rag/state";
  try {
    const response = await fetch(endpoint);
    if (!response.ok) return;
    const data = await response.json();
    updateRagCounts({ chunks: data?.chunks, sources: data?.sources });
  } catch (err) {
    updateRagCounts(null);
  }
}

async function resetRagStore() {
  const endpoint = currentPage.ragResetEndpoint || "/api/rag/reset";
  setChatStatus(null);
  try {
    const response = await fetch(endpoint, { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.detail || "Erreur serveur.");
    }
    updateRagCounts({ chunks: 0, sources: 0 });
    renderSources([]);
  } catch (err) {
    setChatStatus(err.message || "Erreur inconnue.");
  }
}

async function indexRagDocuments() {
  if (!dom.ragFiles || !dom.ragFiles.files || dom.ragFiles.files.length === 0) {
    setChatStatus("Ajoutez des fichiers avant d'indexer.");
    return;
  }
  const endpoint = currentPage.ragIndexEndpoint || "/api/rag/index";
  const formData = new FormData();
  Array.from(dom.ragFiles.files).forEach((file) => formData.append("files", file));
  if (dom.ragChunkSize) formData.append("chunk_size", dom.ragChunkSize.value);
  if (dom.ragOverlap) formData.append("overlap", dom.ragOverlap.value);

  setChatStatus("Indexation en cours...");
  setChatBusy(true);
  try {
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.detail || "Erreur serveur.";
      throw new Error(detail);
    }
    updateRagCounts({ chunks: data?.chunks, sources: data?.sources });
    if (data?.errors && data.errors.length) {
      setChatStatus(data.errors.join(" | "));
    } else {
      setChatStatus(null);
    }
    if (dom.ragFiles) dom.ragFiles.value = "";
  } catch (err) {
    setChatStatus(err.message || "Erreur inconnue.");
  } finally {
    setChatBusy(false);
  }
}

async function sendChatMessage(text) {
  const endpoint = currentPage.chatEndpoint || "/api/chat";
  const systemPrompt = dom.chatSystem && dom.chatSystem.value.trim()
    ? dom.chatSystem.value.trim()
    : currentPage.chatSystemPrompt || "";

  addMessage("user", text);
  setChatStatus(null);
  setChatBusy(true);

  try {
    const payload = {
      system_prompt: systemPrompt,
      messages: state.chatMessages
    };
    if (isRagMode()) {
      const topK = dom.ragTopK ? Number(dom.ragTopK.value) : 6;
      const minScore = dom.ragMinScore ? Number(dom.ragMinScore.value) : 0.25;
      payload.query = text;
      payload.top_k = topK;
      payload.min_score = minScore;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let data = {};
    try {
      data = await response.json();
    } catch (parseErr) {
      data = {};
    }
    if (!response.ok) {
      const detail = data?.detail || data?.error || "Erreur serveur.";
      throw new Error(detail);
    }
    const reply = data?.reply || "Aucune reponse.";
    addMessage("assistant", reply);

    if (isRagMode()) {
      renderSources(data?.sources || []);
      if (!state.badgeState.mission4) {
        state.badgeState.mission4 = true;
        updateBadges();
      }
    } else if (!state.badgeState.mission3) {
      state.badgeState.mission3 = true;
      updateBadges();
    }
  } catch (err) {
    setChatStatus(err.message || "Erreur inconnue.");
  } finally {
    setChatBusy(false);
  }
}

function handleSubmit(event) {
  event.preventDefault();
  if (!dom.chatInput) return;
  const text = dom.chatInput.value.trim();
  if (!text || state.chatBusy) return;
  dom.chatInput.value = "";
  sendChatMessage(text);
}

export function setupChat() {
  if (!currentPage.showChat) return;
  if (!dom.chatPanel) return;

  if (dom.ragControls) {
    dom.ragControls.hidden = !isRagMode();
  }
  if (dom.ragSources) {
    dom.ragSources.hidden = true;
  }

  if (dom.chatSystem) {
    dom.chatSystem.value = currentPage.chatSystemPrompt || "";
  }
  if (dom.chatInput && currentPage.chatPlaceholder) {
    dom.chatInput.placeholder = currentPage.chatPlaceholder;
  }
  if (isRagMode() && currentPage.ragConfig) {
    if (dom.ragChunkSize) dom.ragChunkSize.value = currentPage.ragConfig.chunkSize;
    if (dom.ragOverlap) dom.ragOverlap.value = currentPage.ragConfig.overlap;
    if (dom.ragTopK) dom.ragTopK.value = currentPage.ragConfig.topK;
    if (dom.ragMinScore) dom.ragMinScore.value = currentPage.ragConfig.minScore;
    updateMinScoreDisplay();
    fetchRagState();
  }

  renderMessages();

  if (dom.chatForm) {
    dom.chatForm.addEventListener("submit", handleSubmit);
  }
  if (dom.chatReset) {
    dom.chatReset.addEventListener("click", () => {
      if (dom.chatSystem) {
        dom.chatSystem.value = currentPage.chatSystemPrompt || "";
      }
    });
  }
  if (dom.chatClear) {
    dom.chatClear.addEventListener("click", () => {
      state.chatMessages = [];
      renderMessages();
      setChatStatus(null);
      renderSources([]);
    });
  }
  if (isRagMode()) {
    if (dom.ragMinScore) {
      dom.ragMinScore.addEventListener("input", () => updateMinScoreDisplay());
    }
    if (dom.ragIndex) {
      dom.ragIndex.addEventListener("click", () => indexRagDocuments());
    }
    if (dom.ragReset) {
      dom.ragReset.addEventListener("click", () => resetRagStore());
    }
  }
}
