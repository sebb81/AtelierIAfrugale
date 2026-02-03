import { dom } from "./dom.js";

export async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 960, height: 540 }
  });
  if (!dom.video || !dom.canvas) return;
  dom.video.srcObject = stream;

  await new Promise((resolve) => {
    dom.video.onloadedmetadata = resolve;
  });

  await dom.video.play();
  dom.canvas.width = dom.video.videoWidth;
  dom.canvas.height = dom.video.videoHeight;
}
