if (AFRAME.components["ar-reticle"]) {
  delete AFRAME.components["ar-reticle"];
}

AFRAME.registerComponent("ar-reticle", {
  init() {
    this.el.object3D.matrixAutoUpdate = false;
  },
});

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
    this.isPlacing = false;

    this.onXRFrame = this.onXRFrame.bind(this);
    this.onSelect = this.onSelect.bind(this);

    this.sceneEl.addEventListener("enter-vr", () => this.setupXR());
    this.sceneEl.addEventListener("exit-vr", () => this.cleanupXR());
  },

  showARMessage(text, color = "#00ff00") {
    const existingMsg = document.getElementById("arMessage");
    if (existingMsg) existingMsg.parentNode.removeChild(existingMsg);

    const msg = document.createElement("a-entity");
    msg.id = "arMessage";
    msg.setAttribute("position", "0 1.5 -1");

    const bg = document.createElement("a-plane");
    bg.setAttribute("width", "1.5");
    bg.setAttribute("height", "0.3");
    bg.setAttribute("material", "color: #000000; opacity: 0.8; shader: flat");
    msg.appendChild(bg);

    const txt = document.createElement("a-text");
    txt.setAttribute("value", text);
    txt.setAttribute("align", "center");
    txt.setAttribute("width", "2");
    txt.setAttribute("color", color);
    txt.setAttribute("position", "0 0 0.01");
    msg.appendChild(txt);

    this.sceneEl.appendChild(msg);

    setTimeout(() => {
      if (msg && msg.parentNode) msg.parentNode.removeChild(msg);
    }, 3000);
  },

  async setupXR() {
    const session = this.sceneEl.renderer?.xr?.getSession?.();
    if (!session) return;

    session.addEventListener("select", this.onSelect);

    try {
      this.refSpace = await session.requestReferenceSpace("local-floor");
      this.viewerSpace = await session.requestReferenceSpace("viewer");
      this.hitTestSource = await session.requestHitTestSource({
        space: this.viewerSpace,
      });
      session.requestAnimationFrame(this.onXRFrame);

      setTimeout(() => {
        this.showARMessage("Placement Mode Active", "#00ff00");
      }, 1000);
    } catch (e) {
      this.showARMessage("Hit-test error: " + e.message, "#ff0000");
    }
  },

  cleanupXR() {
    const session = this.sceneEl.renderer?.xr?.getSession?.();
    if (session) session.removeEventListener("select", this.onSelect);
    if (this.hitTestSource) {
      try {
        this.hitTestSource.cancel();
      } catch (_) {}
    }
    this.reticleEl.setAttribute("visible", false);
  },

  onSelect() {
    if (this.isPlacing) {
      this.showARMessage("Wait...", "#ffff00");
      return;
    }

    const mode = window.__XR_STATE__?.mode || "placement";

    if (mode === "visit") {
      this.showARMessage("Visit Mode - Cannot Place", "#ff0000");
      return;
    }

    if (!this.latestHitMatrix) {
      this.showARMessage("No Surface Detected", "#ff0000");
      return;
    }

    if (this.placed >= this.data.maxPlaces) {
      this.showARMessage("Max Exhibits Placed", "#ff0000");
      return;
    }

    this.isPlacing = true;

    const placementGroup = document.createElement("a-entity");
    const groupObj = placementGroup.object3D;
    groupObj.matrix.copy(this.latestHitMatrix);
    groupObj.matrix.decompose(
      groupObj.position,
      groupObj.quaternion,
      groupObj.scale,
    );

    const table = document.createElement("a-entity");
    table.setAttribute("gltf-model", "#table");
    table.setAttribute("scale", "0.7 0.7 0.7");
    placementGroup.appendChild(table);

    const sculptures = ["#chickenLessons", "#imposter"];
    const randomSculpture =
      sculptures[Math.floor(Math.random() * sculptures.length)];

    const sculptureWrapper = document.createElement("a-entity");
    sculptureWrapper.setAttribute("scale", "0.4 0.4 0.4");

    const statue = document.createElement("a-entity");
    statue.setAttribute("gltf-model", randomSculpture);

    sculptureWrapper.appendChild(statue);
    placementGroup.appendChild(sculptureWrapper);

    table.addEventListener("model-loaded", () => {
      const tableObj = table.getObject3D("mesh");
      if (tableObj) {
        const box = new THREE.Box3().setFromObject(tableObj);
        const size = new THREE.Vector3();
        box.getSize(size);

        const tableHeight = size.y;
        sculptureWrapper.setAttribute("position", `0 ${tableHeight * 0.5} 0`);
      } else {
        sculptureWrapper.setAttribute("position", "0 0.5 0");
      }
    });

    this.exhibitRoot.appendChild(placementGroup);
    this.exhibitRoot.setAttribute("visible", true);
    this.placed++;

    this.showARMessage(`Exhibit ${this.placed} Placed!`, "#00ff00");

    if (this.placed >= this.data.maxPlaces) {
      this.reticleEl.setAttribute("visible", false);
    }

    setTimeout(() => {
      this.isPlacing = false;
    }, 500);
  },

  onXRFrame(t, frame) {
    frame.session.requestAnimationFrame(this.onXRFrame);

    if (!this.hitTestSource || !this.refSpace) return;

    const mode = window.__XR_STATE__?.mode || "placement";
    if (mode === "visit") {
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    if (this.placed >= this.data.maxPlaces) {
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    const results = frame.getHitTestResults(this.hitTestSource);
    if (!results.length) {
      this.reticleEl.setAttribute("visible", false);
      this.latestHitMatrix = null;
      return;
    }

    const pose = results[0].getPose(this.refSpace);
    if (!pose) {
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    const hitMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
    const normalY = hitMatrix.elements[5];

    if (normalY < 0.75) {
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    const position = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
    const camera = this.sceneEl.camera;
    if (camera && position.distanceTo(camera.position) < 0.3) {
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    this.latestHitMatrix = hitMatrix;
    this.reticleObj.matrix.copy(hitMatrix);
    this.reticleEl.setAttribute("visible", true);
  },
});
