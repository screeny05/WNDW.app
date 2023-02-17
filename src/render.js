const { ipcRenderer } = require("electron");

const videoElement = document.querySelector("video");
const videoWrapper = document.getElementById("videoWrapper");

videoWrapper.addEventListener("scroll", () => emitSourceChange());
window.addEventListener("resize", () => emitSourceChange());

const emitSourceChange = () => {
  if (!videoElement) {
    return;
  }

  const desktopWidth = videoElement.videoWidth;
  const sourceShrinkFactor = 1 / (videoWrapper.scrollWidth / desktopWidth);

  const x = Math.round(videoWrapper.scrollLeft * sourceShrinkFactor);
  const width = Math.round(videoWrapper.clientWidth * sourceShrinkFactor);
  const y = Math.round(videoWrapper.scrollTop * sourceShrinkFactor);
  const height = Math.round(videoWrapper.clientHeight * sourceShrinkFactor);

  ipcRenderer.send("source-bounds-change", {
    x,
    y,
    width,
    height,
  });
};

ipcRenderer.on("bounds-x", (e, val) => {
  videoWrapper.scrollBy({ left: val });
});

ipcRenderer.on("sharing-start", (_, source) => {
  selectSource(source);
});

ipcRenderer.on("sharing-stop", () => {
  videoElement.pause();
  videoElement.srcObject = null;
  videoElement.load();
});

async function selectSource(source) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: source.id,
      },
    },
  });

  videoElement.srcObject = stream;
  videoElement.onloadedmetadata = (e) => {
    videoElement.play();
    emitSourceChange();
  };
  videoWrapper.style.height = "100vh";
}
