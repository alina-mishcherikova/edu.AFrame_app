AFRAME.registerComponent("controller-ui", {
  init() {
    const handedness = this.el.getAttribute("oculus-touch-controls");
    if (handedness?.hand !== "right") {
      return;
    }

    if (!window.__XR_STATE__) {
      window.__XR_STATE__ = {
        mode: "placement",
      };
    }

    this.el.addEventListener("gripdown", () => {
      this.cycleMode();
    });
  },

  cycleMode() {
    const currentMode = window.__XR_STATE__?.mode || "placement";
    const newMode = currentMode === "visit" ? "placement" : "visit";
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
    msg.setAttribute("position", "0 1.5 -1");

    const bg = document.createElement("a-plane");
    bg.setAttribute("width", "1.5");
    bg.setAttribute("height", "0.3");
    bg.setAttribute("material", "color: #1a1a2e; opacity: 0.9; shader: flat");
    msg.appendChild(bg);

    const txt = document.createElement("a-text");
    const modeText = mode === "visit" ? "VISIT MODE" : "PLACEMENT MODE";
    const color = mode === "visit" ? "#ff6b6b" : "#00ff00";
    txt.setAttribute("value", modeText);
    txt.setAttribute("align", "center");
    txt.setAttribute("width", "2");
    txt.setAttribute("color", color);
    txt.setAttribute("position", "0 0 0.01");
    msg.appendChild(txt);

    const sceneEl = document.querySelector("a-scene");
    sceneEl.appendChild(msg);

    setTimeout(() => {
      if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
    }, 2000);
  },
});
