if (AFRAME.components["ar-reticle"]) {
  delete AFRAME.components["ar-reticle"];
}

AFRAME.registerComponent("ar-reticle", {
  init() {
    this.el.object3D.matrixAutoUpdate = false;
  },
});

// Component for billboard effect - always face camera (Y axis only)
AFRAME.registerComponent("billboard", {
  init: function () {
    this.camera = null;
  },
  tick: function () {
    if (!this.camera) {
      this.camera = this.el.sceneEl.camera;
    }
    if (this.camera) {
      var cameraPos = this.camera.position;
      var objectPos = this.el.object3D.position;

      var dx = cameraPos.x - objectPos.x;
      var dz = cameraPos.z - objectPos.z;
      var angle = Math.atan2(dx, dz);

      this.el.object3D.rotation.y = angle;
    }
  },
});

// Component for making elements clickable in AR
AFRAME.registerComponent("cursor-clickable", {
  init: function () {
    var self = this;
    this.el.addEventListener("mouseenter", function () {
      self.el.setAttribute("scale", "1.1 1.1 1.1");
    });
    this.el.addEventListener("mouseleave", function () {
      self.el.setAttribute("scale", "1 1 1");
    });
  },
});

if (AFRAME.components["ar-hit-test"]) {
  delete AFRAME.components["ar-hit-test"];
}

AFRAME.registerComponent("ar-hit-test", {
  schema: {
    maxPlaces: { type: "int", default: 1 },
  },

  sculpturesData: [
    {
      id: "#chickenLessons",
      name: "Chicken Lessons",
      author: "Unknown Artist",
      year: "2024",
      description: "A fascinating sculpture depicting the wisdom of nature",
      facts: "This piece explores the connection between animals and education",
    },
    {
      id: "#imposter",
      name: "Imposter",
      author: "Digital Creator",
      year: "2023",
      description: "A modern interpretation of identity and perception",
      facts: "Inspired by contemporary social phenomena and digital culture",
    },
    {
      id: "#plant",
      name: "Plant",
      author: "Nature Sculptor",
      year: "2024",
      description: "An organic form celebrating natural beauty",
      facts:
        "Created to remind viewers of the importance of environmental conservation",
    },
    {
      id: "#lava-three",
      name: "Lava Three",
      author: "Fire Artist",
      year: "2022",
      description: "A dynamic piece representing volcanic energy",
      facts: "The design was inspired by actual lava flow patterns",
    },
  ],

  init() {
    this.sceneEl = this.el.sceneEl;
    this.reticleEl = document.getElementById("reticle");
    this.reticleObj = this.reticleEl.object3D;
    this.exhibitRoot = document.getElementById("exhibitRoot");
    this.placed = 0;
    this.isPlacing = false;
    this.currentSculptureIndex = 0;
    this.placedPositions = [];

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
    bg.setAttribute("material", "color: #1a1a2e; opacity: 0.9; shader: flat");
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

  showInfoPanel(sculptureId) {
    const existingPanel = document.getElementById("infoPanel");
    if (existingPanel) {
      existingPanel.parentNode.removeChild(existingPanel);
      return;
    }

    const sculptureInfo = this.sculpturesData.find(function (item) {
      return item.id === sculptureId;
    });

    if (!sculptureInfo) {
      return;
    }

    const panel = document.createElement("a-entity");
    panel.id = "infoPanel";
    panel.setAttribute("position", "-0.2 1.8 -1.5");
    panel.setAttribute("billboard", "");

    const panelBg = document.createElement("a-plane");
    panelBg.setAttribute("width", "0.9");
    panelBg.setAttribute("height", "0.5");
    panelBg.setAttribute(
      "material",
      "color: #ffffff; shader: flat; opacity: 0.95",
    );
    panel.appendChild(panelBg);

    const closeButton = document.createElement("a-plane");
    closeButton.setAttribute("width", "0.15");
    closeButton.setAttribute("height", "0.15");
    closeButton.setAttribute("position", "0.37 0.17 0.01");
    closeButton.setAttribute("material", "color: #667eea; shader: flat");
    closeButton.setAttribute("class", "clickable");
    closeButton.setAttribute("cursor-clickable", "");
    panel.appendChild(closeButton);

    const closeText = document.createElement("a-text");
    closeText.setAttribute("value", "X");
    closeText.setAttribute("align", "center");
    closeText.setAttribute("width", "0.4");
    closeText.setAttribute("color", "#ffffff");
    closeText.setAttribute("position", "0.37 0.17 0.02");
    panel.appendChild(closeText);

    const infoText = document.createElement("a-text");
    const textContent =
      sculptureInfo.name +
      "\n" +
      "Author: " +
      sculptureInfo.author +
      "\n" +
      "Year: " +
      sculptureInfo.year +
      "\n" +
      sculptureInfo.description +
      "\n" +
      "Fun Fact:\n" +
      sculptureInfo.facts +
      "\n";
    infoText.setAttribute("value", textContent);
    infoText.setAttribute("align", "center");
    infoText.setAttribute("width", "0.5");
    infoText.setAttribute("color", "#1f2937");
    infoText.setAttribute("position", "0 0.04 0.01");
    infoText.setAttribute("wrap-count", "28");
    panel.appendChild(infoText);

    this.sceneEl.appendChild(panel);

    var self = this;
    closeButton.addEventListener("click", function () {
      if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    });
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
    this.placedPositions = [];
    this.placed = 0;
    this.currentSculptureIndex = 0;
  },

  onSelect() {
    if (this.isPlacing) {
      this.showARMessage("Wait...", "#ffff00");
      return;
    }

    const mode = window.__XR_STATE__?.mode || "placement";

    if (mode === "visit") {
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

    const newPosition = new THREE.Vector3().setFromMatrixPosition(
      this.latestHitMatrix,
    );

    for (let i = 0; i < this.placedPositions.length; i++) {
      const existingPos = this.placedPositions[i];
      const distance = newPosition.distanceTo(existingPos);
      if (distance < 0.6) {
        this.showARMessage("Too Close! Min 60cm Apart", "#ff0000");
        return;
      }
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

    const selectedSculptureData =
      this.sculpturesData[this.currentSculptureIndex];
    const selectedSculpture = selectedSculptureData.id;
    this.currentSculptureIndex = this.currentSculptureIndex + 1;

    const sculptureWrapper = document.createElement("a-entity");
    sculptureWrapper.setAttribute("scale", "0.4 0.4 0.4");

    const statue = document.createElement("a-entity");
    statue.setAttribute("gltf-model", selectedSculpture);

    sculptureWrapper.appendChild(statue);
    placementGroup.appendChild(sculptureWrapper);

    // Create grey platform on top of table
    const platform = document.createElement("a-plane");
    platform.setAttribute("rotation", "-90 0 0");
    platform.setAttribute("width", "0.5");
    platform.setAttribute("height", "0.5");
    platform.setAttribute(
      "material",
      "color: #9ca3af; shader: flat; side: double",
    );
    placementGroup.appendChild(platform);

    // Create info button
    const infoBubble = document.createElement("a-entity");
    infoBubble.setAttribute("rotation", "0 180 0");

    const buttonBorder = document.createElement("a-plane");
    buttonBorder.setAttribute("width", "0.2");
    buttonBorder.setAttribute("height", "0.12");
    buttonBorder.setAttribute("class", "clickable");
    buttonBorder.setAttribute("cursor-clickable", "");
    buttonBorder.setAttribute(
      "material",
      "color: #667eea; shader: flat; side: double",
    );
    buttonBorder.setAttribute("position", "0 0 -0.001");
    infoBubble.appendChild(buttonBorder);

    const bubbleText = document.createElement("a-text");
    bubbleText.setAttribute("value", "Info");
    bubbleText.setAttribute("align", "center");
    bubbleText.setAttribute("width", "0.6");
    bubbleText.setAttribute("color", "#ffffff");
    bubbleText.setAttribute("position", "0 0 0.01");
    infoBubble.appendChild(bubbleText);

    placementGroup.appendChild(infoBubble);

    var self = this;
    buttonBorder.addEventListener("click", function () {
      self.showInfoPanel(selectedSculpture);
    });

    table.addEventListener("model-loaded", () => {
      const tableObj = table.getObject3D("mesh");
      if (tableObj) {
        const box = new THREE.Box3().setFromObject(tableObj);
        const size = new THREE.Vector3();
        box.getSize(size);

        const tableHeight = size.y;
        const tableTop = tableHeight * 1;

        let sculptureHeight;
        if (
          selectedSculpture === "#chickenLessons" ||
          selectedSculpture === "#plant"
        ) {
          sculptureHeight = tableTop * 1;
          platform.setAttribute("position", `0 ${sculptureHeight - 0.15}  0`);
        } else {
          sculptureHeight = tableTop * 0.7;
          platform.setAttribute("position", `0 ${sculptureHeight + 0.02} 0`);
        }

        sculptureWrapper.setAttribute("position", `0 ${sculptureHeight} 0`);
        infoBubble.setAttribute("position", `0.25 ${sculptureHeight + 0.2} 0`);
      } else {
        sculptureWrapper.setAttribute("position", "0 1 0");
        platform.setAttribute("position", "0 1 0");
        infoBubble.setAttribute("position", "0.25 1.2 0");
      }
    });

    this.exhibitRoot.appendChild(placementGroup);
    this.exhibitRoot.setAttribute("visible", true);
    this.placedPositions.push(newPosition);
    this.placed++;

    if (this.placed >= this.data.maxPlaces) {
      this.reticleEl.setAttribute("visible", false);

      // Automatically switch to visit mode
      if (!window.__XR_STATE__) {
        window.__XR_STATE__ = {};
      }
      window.__XR_STATE__.mode = "visit";
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
