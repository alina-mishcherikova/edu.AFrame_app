(() => {
  const startScreen = document.getElementById("startScreen");
  const startBtn = document.getElementById("startBtn");
  const startError = document.getElementById("startError");
  const sceneEl = document.querySelector("a-scene");
  const arHint = document.getElementById("arHint");
  const debugPanel = document.getElementById("debugPanel");
  const debugLogEl = document.getElementById("debugLog");

  window.__XR_STATE__ = {
    mode: "placement",
  };

  const maxDebugLines = 15;
  const debugLines = [];

  window.debugLog = function (message, type = "info") {
    const timestamp = new Date().toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const colors = {
      info: "#0f0",
      warn: "#ff0",
      error: "#f00",
      success: "#0ff",
    };

    const line = `<div style="color: ${colors[type] || colors.info}">[${timestamp}] ${message}</div>`;
    debugLines.push(line);

    if (debugLines.length > maxDebugLines) {
      debugLines.shift();
    }

    debugLogEl.innerHTML = debugLines.join("");
    debugPanel.scrollTop = debugPanel.scrollHeight;
  };

  function showError(msg) {
    startError.textContent = msg;
    startError.classList.remove("hidden");
  }

  startBtn.addEventListener("click", async () => {
    try {
      startBtn.disabled = true;
      startBtn.textContent = "Starting...";

      await sceneEl.enterAR();

      startScreen.style.display = "none";
      arHint.style.display = "block";
      arHint.textContent = "👆 Tap to place | 🎮 Grip to switch mode";
      debugPanel.style.display = "block";

      setTimeout(() => {
        arHint.style.display = "none";
      }, 5000);
    } catch (e) {
      console.error(e);
      startBtn.disabled = false;
      startBtn.textContent = "START AR";
      showError("Cannot start AR: " + (e?.message || e));
    }
  });

  sceneEl.addEventListener("exit-vr", () => {
    arHint.style.display = "none";
    debugPanel.style.display = "none";
    startScreen.style.display = "flex";
  });
})();
