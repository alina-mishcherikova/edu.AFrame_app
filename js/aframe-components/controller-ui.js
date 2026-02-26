AFRAME.registerComponent("controller-ui", {
  init() {
    // Only attach mode cycling to the right controller
    // Read the 'hand' property correctly from oculus-touch-controls component data
    let hand = null;
    try {
      const oculusData =
        this.el.components && this.el.components["oculus-touch-controls"];
      if (oculusData && oculusData.data) {
        hand = oculusData.data.hand;
      }
    } catch (e) {}

    if (hand !== "right") {
      return;
    }

    if (!window.__XR_STATE__) {
      window.__XR_STATE__ = {
        mode: "placement",
      };
    }

    // Use button A/X for mode switching instead of grip (grip is used by selection-menu)
    this.el.addEventListener("abuttondown", () => {
      this.cycleMode();
    });
    this.el.addEventListener("xbuttondown", () => {
      this.cycleMode();
    });
    // Also allow grip on the right controller to toggle modes (left grip is used for menu)
    this.el.addEventListener("gripdown", () => {
      this.cycleMode();
    });
  },

  cycleMode() {
    const currentMode = window.__XR_STATE__?.mode || "placement";
    let newMode;
    if (currentMode === "visit") {
      newMode = "placement";
    } else {
      newMode = "visit";
    }
    window.__XR_STATE__.mode = newMode;

    // Notify listeners about mode change
    try {
      document.dispatchEvent(
        new CustomEvent("xr-mode-changed", { detail: { mode: newMode } }),
      );
    } catch (e) {}

    this.showModeMessage(newMode);
  },

  showModeMessage(mode) {
    const existingMsg = document.getElementById("modeMessage");
    if (existingMsg) existingMsg.parentNode.removeChild(existingMsg);

    const msg = document.createElement("a-entity");
    msg.id = "modeMessage";
    // position message near the user's camera with a small random offset
    const sceneEl = document.querySelector("a-scene");
    const camEl =
      sceneEl.querySelector("[camera]") ||
      (sceneEl.camera && sceneEl.camera.el);
    if (camEl && typeof THREE !== "undefined" && camEl.object3D) {
      const worldPos = new THREE.Vector3();
      camEl.object3D.getWorldPosition(worldPos);
      const forward = new THREE.Vector3();
      camEl.object3D.getWorldDirection(forward);
      const dist = 0.8 + Math.random() * 0.6; // random distance in front of camera
      const offsetX = (Math.random() - 0.5) * 0.6; // side offset
      const offsetY = (Math.random() - 0.2) * 0.6; // vertical offset
      const targetPos = worldPos
        .clone()
        .add(forward.multiplyScalar(dist))
        .add(new THREE.Vector3(offsetX, offsetY, 0));
      msg.setAttribute(
        "position",
        `${targetPos.x} ${targetPos.y} ${targetPos.z}`,
      );
      // make the HUD face the camera (uses project's billboard component)
      msg.setAttribute("billboard", "");
    } else {
      msg.setAttribute("position", "0 1.5 -1");
    }

    // decorative multi-layer color background inspired by start screen
    // soft purple glow
    const glow1 = document.createElement("a-plane");
    glow1.setAttribute("width", "1.7");
    glow1.setAttribute("height", "0.42");
    glow1.setAttribute("position", "0 0 0.005");
    glow1.setAttribute(
      "material",
      "color: #667eea; opacity: 0.12; shader: flat",
    );
    msg.appendChild(glow1);

    // warm pink offset to emulate soft highlight
    const glow2 = document.createElement("a-plane");
    glow2.setAttribute("width", "1.6");
    glow2.setAttribute("height", "0.36");
    glow2.setAttribute("position", "0.03 -0.02 0.006");
    glow2.setAttribute(
      "material",
      "color: #ff80b5; opacity: 0.08; shader: flat",
    );
    msg.appendChild(glow2);

    // main dark panel for legibility
    const bg = document.createElement("a-plane");
    bg.setAttribute("width", "1.5");
    bg.setAttribute("height", "0.3");
    bg.setAttribute("position", "0 0 0.01");
    bg.setAttribute("material", "color: #0f1724; opacity: 0.92; shader: flat");
    msg.appendChild(bg);

    // thin accent strip at top using start-screen purple
    const accent = document.createElement("a-plane");
    accent.setAttribute("width", "1.3");
    accent.setAttribute("height", "0.04");
    accent.setAttribute("position", "0 0.11 0.011");
    accent.setAttribute(
      "material",
      "color: #764ba2; opacity: 0.95; shader: flat",
    );
    msg.appendChild(accent);

    const txt = document.createElement("a-text");
    let modeText;
    if (mode === "visit") {
      modeText = "VISIT MODE";
    } else {
      modeText = "PLACEMENT MODE";
    }

    let color;
    if (mode === "visit") {
      color = "#ff6b6b";
    } else {
      color = "#00ff00";
    }
    txt.setAttribute("value", modeText);
    txt.setAttribute("align", "center");
    txt.setAttribute("width", "2");
    txt.setAttribute("color", color);
    txt.setAttribute("position", "0 0 0.02");
    txt.setAttribute("wrap-count", "24");
    txt.setAttribute("value", modeText);
    msg.appendChild(txt);

    sceneEl.appendChild(msg);

    setTimeout(() => {
      if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
    }, 2000);
  },
});
