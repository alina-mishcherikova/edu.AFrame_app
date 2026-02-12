AFRAME.registerComponent("controller-ui", {
  init() {
    this.menu = document.createElement("a-entity");
    this.menu.setAttribute("visible", "false");
    this.menu.setAttribute("position", "0 0 -0.12");
    this.el.appendChild(this.menu);

    this.menu.appendChild(this.makeBtn("Info"));
    this.menu.appendChild(this.makeBtn("Reset"));

    this.el.addEventListener("squeezestart", () => {
      this.menu.setAttribute("visible", "true");
    });

    this.el.addEventListener("squeezeend", () => {
      this.menu.setAttribute("visible", "false");
    });
  },

  makeBtn(label) {
    const btn = document.createElement("a-plane");
    btn.classList.add("ui-btn");
    btn.setAttribute("width", "0.1");
    btn.setAttribute("height", "0.05");
    btn.setAttribute("material", "color: #222");
    btn.addEventListener("click", () => {});
    return btn;
  },
});
