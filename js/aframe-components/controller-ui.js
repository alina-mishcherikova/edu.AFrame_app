// Clean up existing component to avoid conflicts on reload
if (AFRAME.components["controller-ui"]) {
  delete AFRAME.components["controller-ui"];
}

AFRAME.registerComponent("controller-ui", {
  init() {
    this.menuVisible = false;
    this.menu = document.createElement("a-entity");
    this.menu.setAttribute("visible", "false");
    this.menu.setAttribute("position", "0 0 -0.12");
    this.el.appendChild(this.menu);

    this.menu.appendChild(
      this.makeBtn("Reset", "-0.07 0.03 0", () => {
        const root = document.getElementById("exhibitRoot");
        root.setAttribute("visible", "false");
        root.__built = false;
        root.innerHTML = "";
        console.log("Reset exhibit");
        window.__UI_CLICKED__ = true;
      }),
    );

    this.menu.appendChild(
      this.makeBtn("Info", "0.07 0.03 0", () => {
        console.log("Info clicked (placeholder)");
        window.__UI_CLICKED__ = true;
      }),
    );

    this.el.addEventListener("squeezestart", () => {
      this.menu.setAttribute("visible", "true");
    });
    this.el.addEventListener("squeezeend", () => {
      this.menu.setAttribute("visible", "false");
    });
  },

  makeBtn(label, pos, onClick) {
    const wrap = document.createElement("a-entity");
    wrap.setAttribute("position", pos);

    const plane = document.createElement("a-plane");
    plane.classList.add("ui-btn");
    plane.setAttribute("width", "0.10");
    plane.setAttribute("height", "0.05");
    plane.setAttribute("material", "color: #222; opacity: 0.9");
    wrap.appendChild(plane);

    const text = document.createElement("a-text");
    text.setAttribute("value", label);
    text.setAttribute("align", "center");
    text.setAttribute("width", "0.6");
    text.setAttribute("position", "0 0 0.01");
    wrap.appendChild(text);

    plane.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });

    return wrap;
  },
});
