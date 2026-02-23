(() => {
  const startScreen = document.getElementById("startScreen");
  const startBtn = document.getElementById("startBtn");
  const startError = document.getElementById("startError");
  const sceneEl = document.querySelector("a-scene");

  window.__XR_STATE__ = {
    mode: "placement",
  };

  function showError(msg) {
    startError.textContent = msg;
    startError.classList.remove("hidden");
  }

  function startAmbient() {
    const ambient = document.getElementById("ambientSound");
    if (!ambient) return;
    ambient.loop = true; // ensure loop is set via JS — A-Frame may strip HTML attribute
    ambient.volume = 0.3;
    // play() returns a Promise — must catch rejection to avoid unhandled error
    ambient
      .play()
      .catch((err) => console.warn("Ambient blocked by browser:", err));
  }

  function stopAmbient() {
    const ambient = document.getElementById("ambientSound");
    if (!ambient) return;
    ambient.pause();
    ambient.currentTime = 0;
  }

  // Block button until A-Frame renderer is fully initialized
  startBtn.disabled = true;
  startBtn.textContent = "Loading...";

  // If scene is already loaded (e.g. cached), enable immediately
  if (sceneEl.hasLoaded) {
    startBtn.disabled = false;
    startBtn.textContent = "START AR";
  } else {
    sceneEl.addEventListener("loaded", () => {
      startBtn.disabled = false;
      startBtn.textContent = "START AR";
    });
  }

  startBtn.addEventListener("click", async () => {
    try {
      startBtn.disabled = true;
      startBtn.textContent = "Starting...";

      await sceneEl.enterAR();

      startScreen.style.display = "none";

      // Start looping ambient music — called after user gesture so autoplay is allowed
      startAmbient();
    } catch (e) {
      console.error(e);
      startBtn.disabled = false;
      startBtn.textContent = "START AR";
      showError("Cannot start AR: " + (e?.message || e));
    }
  });

  sceneEl.addEventListener("exit-vr", () => {
    startScreen.style.display = "flex";
    startBtn.disabled = false;
    startBtn.textContent = "START AR";
    stopAmbient();
  });
})();
