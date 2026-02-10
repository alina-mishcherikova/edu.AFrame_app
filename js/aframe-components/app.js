(() => {
  const startScreen = document.getElementById("startScreen");
  const startBtn = document.getElementById("startBtn");
  const startError = document.getElementById("startError");
  const sceneEl = document.querySelector("a-scene");
  const arUI = document.getElementById("arUI");
  const arHint = document.getElementById("arHint");
  const resetBtn = document.getElementById("resetBtn");
  const infoBtn = document.getElementById("infoBtn");
  const debugPanel = document.getElementById("debugPanel");
  const debugLogEl = document.getElementById("debugLog");

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
    console.log(`[DEBUG] ${message}`);
  };

  function showError(msg) {
    startError.textContent = msg;
    startError.classList.remove("hidden");
  }

  startBtn.addEventListener("click", async () => {
    try {
      startBtn.disabled = true;
      startBtn.textContent = "Starting...";
      window.debugLog("🚀 Starting AR mode...", "info");

      await sceneEl.enterAR();
      window.debugLog("✅ AR mode activated", "success");

      startScreen.style.display = "none";
      startScreen.style.visibility = "hidden";
      window.debugLog("🚫 StartScreen hidden", "info");

      arUI.style.display = "flex";
      arHint.style.display = "block";

      debugPanel.style.display = "block";
      debugPanel.style.visibility = "visible";
      window.debugLog("👀 Debug panel visible", "success");

      const arOverlay = document.getElementById("arOverlay");
      window.debugLog(
        `Debug panel in DOM: ${document.body.contains(debugPanel)}`,
        "info",
      );
      window.debugLog(
        `ArOverlay in DOM: ${document.body.contains(arOverlay)}`,
        "info",
      );
      window.debugLog(
        `ArOverlay display: ${arOverlay.style.display || "default"}`,
        "info",
      );

      setTimeout(() => {
        arHint.style.display = "none";
      }, 5000);
    } catch (e) {
      console.error(e);
      window.debugLog("❌ Error starting AR: " + (e?.message || e), "error");
      startBtn.disabled = false;
      startBtn.textContent = "START AR";
      showError("Cannot start AR: " + (e?.message || e));
    }
  });

  resetBtn.addEventListener("click", () => {
    window.debugLog("🔄 Resetting exhibits", "warn");
    const root = document.getElementById("exhibitRoot");
    root.setAttribute("visible", "false");
    root.innerHTML = "";

    const hitTestComp = sceneEl.components["ar-hit-test"];
    if (hitTestComp) {
      hitTestComp.placed = 0;
      const reticleEl = document.getElementById("reticle");
      if (reticleEl && hitTestComp.hitTestSource) {
        window.debugLog("✅ Reticle active again", "success");
      }
    }
  });

  infoBtn.addEventListener("click", () => {
    alert(
      "XR Mini Exhibit\n\nTap screen to place exhibits on surfaces.\n\nUse Reset and Info buttons for control.",
    );
  });

  sceneEl.addEventListener("exit-vr", () => {
    window.debugLog("👋 Exiting AR mode", "warn");
    arUI.style.display = "none";
    arHint.style.display = "none";
    debugPanel.style.display = "none";
    startScreen.style.display = "flex";
  });

  window.debugLog("📱 App loaded", "info");
  debugPanel.style.display = "block";
  window.debugLog("✅ Debug panel active", "success");

  const styles = window.getComputedStyle(debugPanel);
  window.debugLog(
    `Display: ${styles.display}, Visibility: ${styles.visibility}, Z-index: ${styles.zIndex}`,
    "info",
  );
})();
