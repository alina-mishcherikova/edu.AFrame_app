AFRAME.registerComponent("selection-menu", {
  init() {
    // Menu container attached to controller
    this.menu = document.createElement("a-entity");
    this.menu.setAttribute("visible", "false");
    this.menu.setAttribute("scale", "0.6 0.6 0.6");
    if (this.el && this.el.sceneEl) {
      this.el.sceneEl.appendChild(this.menu);
    } else {
      // fallback: wait for DOM load and append to the first a-scene
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.querySelector("a-scene");
        if (s && !s.contains(this.menu)) s.appendChild(this.menu);
      });
    }

    // Toggle menu on grab
    this.el.addEventListener("gripdown", () => this.toggleMenu(true));
    this.el.addEventListener("gripup", () => this.toggleMenu(false));

    // Build menu when scene's hit-test component is ready
    this.buildMenu = this.buildMenu.bind(this);
    this._buildRetries = 0;
    if (this.el.sceneEl.hasLoaded) this.buildMenu();
    else this.el.sceneEl.addEventListener("loaded", this.buildMenu);
  },

  toggleMenu(open) {
    this.menu.setAttribute("visible", open);
    if (open) {
      // place the menu once in front of the camera (world-space)
      var sceneEl = this.el.sceneEl;
      var camEl =
        sceneEl.querySelector("[camera]") ||
        (sceneEl.camera && sceneEl.camera.el);
      if (camEl && typeof THREE !== "undefined" && camEl.object3D) {
        const worldPos = new THREE.Vector3();
        camEl.object3D.getWorldPosition(worldPos);
        const forward = new THREE.Vector3();
        camEl.object3D.getWorldDirection(forward);
        const dist = 0.8; // fixed distance in front of camera
        const targetPos = worldPos.clone().add(forward.multiplyScalar(dist));
        this.menu.object3D.position.copy(targetPos);
        // make menu face the camera once
        this.menu.object3D.lookAt(worldPos);
        // freeze rotation (do not add billboard)
        this.menu.object3D.rotation.x = this.menu.object3D.rotation.x;
        this.menu.object3D.rotation.y = this.menu.object3D.rotation.y;
        this.menu.object3D.rotation.z = this.menu.object3D.rotation.z;
      }
    }
  },

  buildMenu() {
    const hitComp = this.el.sceneEl.components["ar-hit-test"];
    // If the hit-test component isn't registered yet, retry a few times.
    if (!hitComp) {
      if (this._buildRetries < 20) {
        this._buildRetries++;
        setTimeout(this.buildMenu, 100);
        return;
      }
      // give up gracefully after retries
      return;
    }
    const paintings = (hitComp && hitComp.paintingsData) || [];
    const sculptures = (hitComp && hitComp.sculpturesData) || [];

    // Clear old
    while (this.menu.firstChild) this.menu.removeChild(this.menu.firstChild);

    const items = [];
    for (let i = 0; i < paintings.length; i++) {
      const p = paintings[i];
      items.push({ id: p.id, label: p.name, type: "painting" });
    }
    for (let i = 0; i < sculptures.length; i++) {
      const s = sculptures[i];
      items.push({ id: s.id, label: s.name, type: "sculpture" });
    }

    //Layout
    const cols = 3;
    const spacingX = 0.2;
    const spacingY = 0.2;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * spacingX - (spacingX * (cols - 1)) / 2;
      const y = row * -spacingY;

      // clickable background plane
      const btn = document.createElement("a-plane");
      btn.classList.add("ui-btn");
      btn.classList.add("clickable");
      btn.setAttribute("width", "0.14");
      btn.setAttribute("height", "0.14");
      btn.setAttribute("position", `${x} ${y} 0`);
      btn.setAttribute(
        "material",
        "color: #442660; shader: flat; opacity: 0.0",
      );
      btn.setAttribute("cursor-clickable", "");

      // Lightweight text label instead of heavy GLTF thumbnail
      const thumb = document.createElement("a-text");
      const shortLabel =
        it.label.length > 12 ? it.label.slice(0, 11) + "…" : it.label;
      thumb.setAttribute("value", shortLabel);
      thumb.setAttribute("align", "center");
      thumb.setAttribute("width", "0.28");
      thumb.setAttribute("color", "#e8d5ff");
      thumb.setAttribute("position", "0 0 0.02");
      thumb.setAttribute("wrap-count", "14");

      // small type tag (painting = purple, sculpture = teal)
      const typeTag = document.createElement("a-text");
      typeTag.setAttribute("value", it.type === "painting" ? "🖼" : "🗿");
      typeTag.setAttribute("align", "center");
      typeTag.setAttribute("width", "0.18");
      typeTag.setAttribute(
        "color",
        it.type === "painting" ? "#c084fc" : "#34d399",
      );
      typeTag.setAttribute("position", "0 -0.05 0.02");

      const frame = document.createElement("a-plane");
      frame.setAttribute("width", "0.16");
      frame.setAttribute("height", "0.16");
      frame.setAttribute("position", `0 0 -0.02`);
      frame.setAttribute(
        "material",
        "color: #331849; shader: flat; opacity: 0.85; side: double",
      );

      // hover
      btn.addEventListener("mouseenter", () => {
        btn.setAttribute("material", "opacity: 1");
        btn.object3D.scale.set(1.1, 1.1, 1.1);
        btn.sceneEl.components["ar-hit-test"] &&
          (btn.sceneEl.components["ar-hit-test"].isPointerOverUI = true);
      });
      btn.addEventListener("mouseleave", () => {
        btn.setAttribute("material", "opacity: 0.0");
        btn.object3D.scale.set(1, 1, 1);
        btn.sceneEl.components["ar-hit-test"] &&
          (btn.sceneEl.components["ar-hit-test"].isPointerOverUI = false);
      });

      btn.addEventListener("click", () => {
        window.__XR_STATE__ = window.__XR_STATE__ || {};
        window.__XR_STATE__.selected = { id: it.id, type: it.type };

        frame.setAttribute(
          "material",
          "color: #90fbac; shader: flat; opacity: 0.95",
        );
        setTimeout(() => {
          this.menu.setAttribute("visible", "false");
          frame.setAttribute(
            "material",
            "color: #331849; shader: flat; opacity: 0.85",
          );
        }, 180);
      });

      btn.appendChild(frame);
      btn.appendChild(thumb);
      btn.appendChild(typeTag);
      this.menu.appendChild(btn);
    }
  },
});
