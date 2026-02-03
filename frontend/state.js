import { PAGE_CONFIG } from "./missions.js";

export const pageId = document.body.dataset.page || "home";
export const currentPage = PAGE_CONFIG[pageId] || PAGE_CONFIG.home;

export const state = {
  steps: currentPage.steps,
  badgeState: {
    mission1: false,
    mission2: false,
    mission3: false,
    mission4: false,
    mission5: false
  },
  currentStep: 0,
  bestThreshold: 0,
  holdFrames: 0,
  lastMessageAt: null,
  fps: 0,
  wsRef: null,
  chatMessages: [],
  chatBusy: false,
  audioAttempts: []
};
