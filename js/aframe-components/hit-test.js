// Clean up existing components to avoid conflicts on reload
if (AFRAME.components["ar-reticle"]) {
  delete AFRAME.components["ar-reticle"];
}

AFRAME.registerComponent("ar-reticle", {
  init() {
    this.el.object3D.matrixAutoUpdate = false;
  },
});

// Delete existing component if present to avoid conflicts
if (AFRAME.components["ar-hit-test"]) {
  delete AFRAME.components["ar-hit-test"];
}

AFRAME.registerComponent("ar-hit-test", {
  schema: {
    maxPlaces: { type: "int", default: 1 },
  },

  init() {
    this.sceneEl = this.el.sceneEl;
    this.reticleEl = document.getElementById("reticle");
    this.reticleObj = this.reticleEl.object3D;
    this.exhibitRoot = document.getElementById("exhibitRoot");

    this.placed = 0;

    this.hitTestSource = null;
    this.viewerSpace = null;
    this.refSpace = null;

    this.latestHitMatrix = null;

    this.onXRFrame = this.onXRFrame.bind(this);
    this.onSelect = this.onSelect.bind(this);

    this.frameCounter = 0;
    this.lastReticleState = false;

    this.sceneEl.addEventListener("enter-vr", () => this.setupXR());
    this.sceneEl.addEventListener("exit-vr", () => this.cleanupXR());
  },

  async setupXR() {
    const xr = this.sceneEl.renderer?.xr;
    const session = xr?.getSession?.();
    if (!session) {
      if (window.debugLog) window.debugLog("❌ XR сесія недоступна", "error");
      return;
    }

    if (window.debugLog) window.debugLog("🔍 Налаштування hit-test...", "info");
    session.addEventListener("select", this.onSelect);

    try {
      this.refSpace = await session.requestReferenceSpace("local-floor");
      this.viewerSpace = await session.requestReferenceSpace("viewer");
      this.hitTestSource = await session.requestHitTestSource({
        space: this.viewerSpace,
      });

      if (window.debugLog) window.debugLog("✅ Hit-test активовано", "success");
      session.requestAnimationFrame(this.onXRFrame);
    } catch (e) {
      if (window.debugLog)
        window.debugLog("❌ Помилка hit-test: " + e.message, "error");
    }
  },

  cleanupXR() {
    if (window.debugLog) window.debugLog("🧹 Очищення XR сесії", "info");

    const session = this.sceneEl.renderer?.xr?.getSession?.();
    if (session) session.removeEventListener("select", this.onSelect);

    if (this.hitTestSource) {
      try {
        this.hitTestSource.cancel();
      } catch (_) {}
    }
    this.hitTestSource = null;
    this.viewerSpace = null;
    this.refSpace = null;
    this.latestHitMatrix = null;

    this.reticleEl.setAttribute("visible", false);
  },

  onSelect(event) {
    // Ignore if clicking UI buttons
    if (
      event.target &&
      (event.target.id === "resetBtn" || event.target.id === "infoBtn")
    ) {
      return;
    }

    if (window.__UI_CLICKED__) {
      window.__UI_CLICKED__ = false;
      return;
    }

    if (!this.latestHitMatrix) {
      if (window.debugLog)
        window.debugLog("⚠️ Немає hit matrix для розміщення", "warn");
      return;
    }
    if (this.placed >= this.data.maxPlaces) {
      if (window.debugLog)
        window.debugLog(
          "🚫 Досягнуто макс. кількість (" + this.data.maxPlaces + ")",
          "warn",
        );
      return;
    }

    if (window.debugLog)
      window.debugLog(
        "🏛️ Розміщення експоната #" + (this.placed + 1),
        "success",
      );

    // Create a new group for this placement
    const placementGroup = document.createElement("a-entity");

    const groupObj = placementGroup.object3D;
    groupObj.matrix.copy(this.latestHitMatrix);
    groupObj.matrix.decompose(
      groupObj.position,
      groupObj.quaternion,
      groupObj.scale,
    );

    // Build exhibit in this group
    this.buildExhibit(placementGroup);

    // Add to root
    this.exhibitRoot.appendChild(placementGroup);
    this.exhibitRoot.setAttribute("visible", true);

    this.placed += 1;

    // Don't hide reticle, let user place more if space available
    if (this.placed >= this.data.maxPlaces) {
      this.reticleEl.setAttribute("visible", false);
      this.latestHitMatrix = null;
      if (window.debugLog)
        window.debugLog("✅ Всі експонати розміщені", "success");
    }
  },

  buildExhibit(rootEl) {
    const slots = [
      { x: -0.35, z: -0.25, title: "Exhibit A" },
      { x: 0.0, z: -0.25, title: "Exhibit B" },
      { x: 0.35, z: -0.25, title: "Exhibit C" },
    ];

    slots.forEach((s) => {
      // pedestal
      const pedestal = document.createElement("a-cylinder");
      pedestal.setAttribute("radius", "0.12");
      pedestal.setAttribute("height", "0.18");
      pedestal.setAttribute("position", `${s.x} 0 ${s.z}`);
      pedestal.setAttribute("material", "color: #ffffff; opacity: 0.9");
      rootEl.appendChild(pedestal);

      // model
      const model = document.createElement("a-entity");
      model.setAttribute("gltf-model", "#modelExhibit");
      model.setAttribute("position", `${s.x} 0.18 ${s.z}`);
      model.setAttribute("scale", "0.22 0.22 0.22");
      model.setAttribute(
        "animation",
        "property: rotation; to: 0 360 0; loop: true; dur: 12000; easing: linear",
      );
      rootEl.appendChild(model);

      // label
      const label = document.createElement("a-text");
      label.setAttribute("value", s.title);
      label.setAttribute("align", "center");
      label.setAttribute("width", "1.5");
      label.setAttribute("position", `${s.x} 0.42 ${s.z}`);
      rootEl.appendChild(label);
    });
  },

  onXRFrame(t, frame) {
    const session = frame.session;
    session.requestAnimationFrame(this.onXRFrame);

    if (!this.hitTestSource || !this.refSpace) return;

    // Don't show reticle if max places reached
    if (this.placed >= this.data.maxPlaces) {
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    const results = frame.getHitTestResults(this.hitTestSource);
    if (!results.length) {
      this.reticleEl.setAttribute("visible", false);
      this.latestHitMatrix = null;

      if (this.lastReticleState === true) {
        if (window.debugLog)
          window.debugLog("🔍 Сканування поверхонь...", "info");
        this.lastReticleState = false;
      }
      return;
    }

    const hit = results[0];
    const pose = hit.getPose(this.refSpace);
    if (!pose) return;

    // WebXR matrix -> THREE.Matrix4
    const hitMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix);

    // Extract position to check if it's reasonable (not at origin or too close)
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(hitMatrix);

    // Ignore hits that are too close (likely hitting controller or camera)
    const camera = this.sceneEl.camera;
    if (camera) {
      const distance = position.distanceTo(camera.position);
      if (distance < 0.3) {
        // Too close, likely hitting controller or self
        this.reticleEl.setAttribute("visible", false);
        if (this.lastReticleState === true) {
          if (window.debugLog)
            window.debugLog("⚠️ Відстань занадто мала (< 0.3m)", "warn");
          this.lastReticleState = false;
        }
        return;
      }
    }

    this.latestHitMatrix = hitMatrix;
    this.reticleObj.matrix.copy(this.latestHitMatrix);
    this.reticleEl.setAttribute("visible", true);

    if (this.lastReticleState === false) {
      const dist = camera
        ? position.distanceTo(camera.position).toFixed(2)
        : "?";
      if (window.debugLog)
        window.debugLog(`✅ Поверхня знайдена (${dist}m)`, "success");
      this.lastReticleState = true;
    }
  },
});
