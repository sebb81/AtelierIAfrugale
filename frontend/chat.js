import { dom } from "./dom.js";
import { currentPage, state } from "./state.js";
import { updateBadges } from "./ui.js";

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

async function sendChatMessage(text) {
  const endpoint = currentPage.chatEndpoint || "/api/chat";
  const systemPrompt = dom.chatSystem && dom.chatSystem.value.trim()
    ? dom.chatSystem.value.trim()
    : currentPage.chatSystemPrompt || "";

  addMessage("user", text);
  setChatStatus(null);
  setChatBusy(true);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        messages: state.chatMessages
      })
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

    if (!state.badgeState.mission3) {
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

  if (dom.chatSystem) {
    dom.chatSystem.value = currentPage.chatSystemPrompt || "";
  }
  if (dom.chatInput && currentPage.chatPlaceholder) {
    dom.chatInput.placeholder = currentPage.chatPlaceholder;
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
    });
  }
}
