import { applyNavigation, applyPageConfig, renderMissionCards, renderStep, setStatus } from "./ui.js";
import { bindConfigControls } from "./config.js";
import { currentPage } from "./state.js";
import { setupCamera } from "./camera.js";
import { connectWebSocket } from "./ws.js";
import { setupChat } from "./chat.js";
import { setupAudio } from "./audio.js";
import { bindMission1AcceptanceControl } from "./gesture.js";

async function boot() {
  applyPageConfig();
  applyNavigation();
  renderStep();
  renderMissionCards();
  bindConfigControls();
  bindMission1AcceptanceControl();
  setupChat();
  setupAudio();
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
