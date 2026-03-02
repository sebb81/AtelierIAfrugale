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
  const fileLabel = sources > 1 ? "fichiers" : "fichier";
  dom.ragCounts.textContent = `Chunks : ${chunks} \u00b7 ${sources} ${fileLabel}`;
}

function renderRagFiles(files) {
  if (!dom.ragFileList) return;
  dom.ragFileList.innerHTML = "";
  if (!files || files.length === 0) {
    const item = document.createElement("li");
    item.className = "rag-file-item empty";
    item.textContent = "Aucun fichier present dans le RAG.";
    dom.ragFileList.appendChild(item);
    return;
  }
  files.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "rag-file-item";
    const chunks = Number(entry?.chunks || 0);
    const chunkLabel = chunks > 1 ? "chunks" : "chunk";
    item.textContent = `${entry?.name || "fichier"} \u00b7 ${chunks} ${chunkLabel}`;
    dom.ragFileList.appendChild(item);
  });
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
    if (!response.ok) throw new Error("Impossible de charger l'etat RAG.");
    const data = await response.json();
    state.ragRuntimeConfig = data?.config || null;
    if (dom.ragTopK && state.ragRuntimeConfig?.top_k) {
      dom.ragTopK.value = String(state.ragRuntimeConfig.top_k);
    }
    updateRagCounts({ chunks: data?.chunks, sources: data?.sources });
    renderRagFiles(data?.files || []);
    if (Array.isArray(data?.errors) && data.errors.length) {
      setChatStatus(data.errors.join(" | "));
    } else {
      setChatStatus(null);
    }
  } catch (err) {
    updateRagCounts(null);
    renderRagFiles([]);
    setChatStatus(err.message || "Erreur inconnue.");
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
      payload.query = text;
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
      state.ragLastRetrieval = data?.retrieval || null;
      renderSources(data?.sources || []);
      setChatStatus(null);
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
    state.ragRuntimeConfig = {
      top_k: currentPage.ragConfig.topK
    };
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
      state.ragLastRetrieval = null;
      renderMessages();
      setChatStatus(null);
      renderSources([]);
    });
  }
  if (isRagMode()) {
    if (dom.ragMinScore) {
      dom.ragMinScore.addEventListener("input", () => updateMinScoreDisplay());
    }
  }
}
