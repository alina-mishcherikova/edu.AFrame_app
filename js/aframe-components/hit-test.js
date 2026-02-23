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
  schema: {},

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

  // Paintings placed on walls
  paintingsData: [
    {
      id: "#monaLisa",
      name: "Mona Lisa",
      author: "Leonardo da Vinci",
      year: "1503",
      description: "One of the most famous portraits in the world",
      facts: "The painting is kept in the Louvre Museum in Paris",
      scale: "0.05 0.05 0.05",
      rotation: "0 180 0",
    },
    {
      id: "#cowPainting",
      name: "Cow Painting",
      author: "Unknown Artist",
      year: "2024",
      description: "A contemporary take on pastoral art",
      facts: "Inspired by the Dutch Golden Age tradition of animal painting",
      scale: "0.6 0.6 0.6",
      rotation: "0 270 0",
    },
    {
      id: "#ImpressionistPainting1",
      name: "Impressionist Painting 1",
      author: "Unknown Artist",
      year: "2024",
      description: "An impressionist interpretation of a table setting",
      facts:
        "Inspired by the French Impressionist movement of the 19th century",
      scale: "0.1 0.1 0.1",
    },
    {
      id: "#ImpressionistPainting2",
      name: "Impressionist Painting 2",
      author: "Unknown Artist",
      year: "2024",
      description: "An impressionist interpretation of a table setting",
      facts:
        "Inspired by the French Impressionist movement of the 19th century",
      scale: "0.6 0.6 0.6",
      rotation: "0 180 -90",
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
    this.currentPaintingIndex = 0;
    this.placedPositions = [];
    this.isWall = false; // true when reticle is aimed at a vertical surface
    this.totalItems = this.sculpturesData.length + this.paintingsData.length;

    this.onXRFrame = this.onXRFrame.bind(this);
    this.onSelect = this.onSelect.bind(this);

    var self = this;
    this.sceneEl.addEventListener("enter-vr", function () {
      self.setupXR();
    });
    this.sceneEl.addEventListener("exit-vr", function () {
      self.cleanupXR();
    });
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

    setTimeout(function () {
      msg.remove();
    }, 3000);
  },

  showInfoPanel(sculptureId) {
    const existingPanel = document.getElementById("infoPanel");
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    // Search in both sculptures and paintings data
    var sculptureInfo = null;
    for (var i = 0; i < this.sculpturesData.length; i++) {
      if (this.sculpturesData[i].id === sculptureId) {
        sculptureInfo = this.sculpturesData[i];
        break;
      }
    }
    if (!sculptureInfo) {
      for (var i = 0; i < this.paintingsData.length; i++) {
        if (this.paintingsData[i].id === sculptureId) {
          sculptureInfo = this.paintingsData[i];
          break;
        }
      }
    }

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
    const textContent = `${sculptureInfo.name}
Author: ${sculptureInfo.author}
Year: ${sculptureInfo.year}
${sculptureInfo.description}
Fun Fact:
${sculptureInfo.facts}
`;
    infoText.setAttribute("value", textContent);
    infoText.setAttribute("align", "center");
    infoText.setAttribute("width", "0.5");
    infoText.setAttribute("color", "#1f2937");
    infoText.setAttribute("position", "0 0.04 0.01");
    infoText.setAttribute("wrap-count", "28");
    panel.appendChild(infoText);

    this.sceneEl.appendChild(panel);

    closeButton.addEventListener("click", function () {
      panel.remove();
    });
  },

  // Helper: play blip sound on info panel open
  playInfoSound() {
    const snd = document.getElementById("infoSound");
    if (!snd) return;
    snd.currentTime = 0;
    snd.play().catch((err) => console.warn("Info sound blocked:", err));
  },

  async setupXR() {
    // Wait up to 500ms for the session to become available
    let session = null;
    for (let i = 0; i < 10; i++) {
      session = this.sceneEl.renderer?.xr?.getSession?.();
      if (session) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!session) {
      this.showARMessage("XR session not found", "#ff0000");
      return;
    }

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
    this.currentPaintingIndex = 0;
    this.latestHitMatrix = null;
    this.isWall = false;
    if (window.__XR_STATE__) window.__XR_STATE__.mode = "placement";
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

    if (this.placed >= this.totalItems) {
      this.showARMessage("All Exhibits Placed", "#ff0000");
      return;
    }

    // Check if items of the current surface type are exhausted
    if (this.isWall && this.currentPaintingIndex >= this.paintingsData.length) {
      this.showARMessage("All Paintings Placed — aim at the floor", "#ffff00");
      return;
    }
    if (
      !this.isWall &&
      this.currentSculptureIndex >= this.sculpturesData.length
    ) {
      this.showARMessage("All Sculptures Placed — aim at a wall", "#ffff00");
      return;
    }

    const newPosition = new THREE.Vector3().setFromMatrixPosition(
      this.latestHitMatrix,
    );

    var tooClose = false;
    for (var i = 0; i < this.placedPositions.length; i++) {
      if (newPosition.distanceTo(this.placedPositions[i]) < 0.6) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) {
      this.showARMessage("Too Close! Min 60cm Apart", "#ff0000");
      return;
    }

    this.isPlacing = true;

    const placementGroup = document.createElement("a-entity");
    const groupObj = placementGroup.object3D;

    if (this.isWall) {
      // For wall placement: keep the group strictly vertical.
      // Only extract position from the hit matrix and compute a Y-only rotation
      // from the wall normal (Y axis of the hit matrix, projected onto the XZ plane).
      const pos = new THREE.Vector3().setFromMatrixPosition(
        this.latestHitMatrix,
      );
      groupObj.position.copy(pos);

      // Wall normal = Y column of the hit matrix (elements[4], [5], [6])
      const wallNX = this.latestHitMatrix.elements[4];
      const wallNZ = this.latestHitMatrix.elements[6];

      // Rotate only around Y so the painting faces outward from the wall toward the viewer
      groupObj.rotation.set(0, Math.atan2(wallNX, wallNZ), 0);
      groupObj.matrixAutoUpdate = true;
    } else {
      groupObj.matrix.copy(this.latestHitMatrix);
      groupObj.matrix.decompose(
        groupObj.position,
        groupObj.quaternion,
        groupObj.scale,
      );
    }

    if (this.isWall) {
      // --- WALL: place a painting ---
      const paintingData = this.paintingsData[this.currentPaintingIndex];
      this.currentPaintingIndex++;

      const painting = document.createElement("a-entity");
      painting.setAttribute("gltf-model", paintingData.id);
      painting.setAttribute("scale", paintingData.scale || "0.6 0.6 0.6");
      // Rotate so the painting faces outward from the wall
      painting.setAttribute("rotation", paintingData.rotation || "0 180 0");
      placementGroup.appendChild(painting);

      // Info button next to the painting
      const infoBtn = document.createElement("a-plane");
      infoBtn.setAttribute("width", "0.2");
      infoBtn.setAttribute("height", "0.12");
      infoBtn.setAttribute("class", "clickable");
      infoBtn.setAttribute("cursor-clickable", "");
      infoBtn.setAttribute(
        "material",
        "color: #667eea; shader: flat; side: double",
      );
      infoBtn.setAttribute("position", "0.35 0.2 0.01");
      placementGroup.appendChild(infoBtn);

      const infoBtnText = document.createElement("a-text");
      infoBtnText.setAttribute("value", "Info");
      infoBtnText.setAttribute("align", "center");
      infoBtnText.setAttribute("width", "0.6");
      infoBtnText.setAttribute("color", "#ffffff");
      infoBtnText.setAttribute("position", "0.35 0.2 0.02");
      placementGroup.appendChild(infoBtnText);

      var hitTestComp = this;
      var capturedPaintingId = paintingData.id;
      infoBtn.addEventListener("click", function () {
        hitTestComp.playInfoSound();
        hitTestComp.showInfoPanel(capturedPaintingId);
      });
    } else {
      // --- FLOOR: place a table + sculpture ---
      const table = document.createElement("a-entity");
      table.setAttribute("gltf-model", "#table");
      table.setAttribute("scale", "0.7 0.7 0.7");
      placementGroup.appendChild(table);

      const selectedSculptureData =
        this.sculpturesData[this.currentSculptureIndex];
      const selectedSculpture = selectedSculptureData.id;
      this.currentSculptureIndex++;

      const sculptureWrapper = document.createElement("a-entity");
      sculptureWrapper.setAttribute("scale", "0.4 0.4 0.4");

      const statue = document.createElement("a-entity");
      statue.setAttribute("gltf-model", selectedSculpture);
      sculptureWrapper.appendChild(statue);
      placementGroup.appendChild(sculptureWrapper);

      // Grey platform on top of table
      const platform = document.createElement("a-plane");
      platform.setAttribute("rotation", "-90 0 0");
      platform.setAttribute("width", "0.5");
      platform.setAttribute("height", "0.5");
      platform.setAttribute(
        "material",
        "color: #9ca3af; shader: flat; side: double",
      );
      placementGroup.appendChild(platform);

      // Info button
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

      var hitTestComp2 = this;
      var capturedSculptureId = selectedSculpture;
      buttonBorder.addEventListener("click", function () {
        hitTestComp2.playInfoSound();
        hitTestComp2.showInfoPanel(capturedSculptureId);
      });

      table.addEventListener("model-loaded", function () {
        const tableObj = table.getObject3D("mesh");
        if (tableObj) {
          const box = new THREE.Box3().setFromObject(tableObj);
          const size = new THREE.Vector3();
          box.getSize(size);
          const tableTop = size.y;

          let sculptureHeight;
          if (
            selectedSculpture === "#chickenLessons" ||
            selectedSculpture === "#plant"
          ) {
            sculptureHeight = tableTop * 1;
            platform.setAttribute("position", `0 ${sculptureHeight - 0.15} 0`);
          } else {
            sculptureHeight = tableTop * 0.7;
            platform.setAttribute("position", `0 ${sculptureHeight + 0.02} 0`);
          }
          sculptureWrapper.setAttribute("position", `0 ${sculptureHeight} 0`);
          infoBubble.setAttribute(
            "position",
            `0.25 ${sculptureHeight + 0.2} 0`,
          );
        } else {
          sculptureWrapper.setAttribute("position", "0 1 0");
          platform.setAttribute("position", "0 1 0");
          infoBubble.setAttribute("position", "0.25 1.2 0");
        }
      });
    }

    this.exhibitRoot.appendChild(placementGroup);
    this.exhibitRoot.setAttribute("visible", true);
    this.placedPositions.push(newPosition);
    this.placed++;

    if (this.placed >= this.totalItems) {
      this.reticleEl.setAttribute("visible", false);
      window.__XR_STATE__.mode = "visit";
      this.showARMessage(
        "All Exhibits Placed! Enjoy the exhibit 🎨",
        "#00ff00",
      );
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

    if (this.placed >= this.totalItems) {
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

    // normalY ≈ 1.0 → floor, normalY ≈ 0.0 → wall
    const isWall = Math.abs(normalY) < 0.25;

    if (!isWall && normalY < 0.75) {
      // Surface is neither a clear floor nor a wall — hide reticle
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    const position = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
    const camera = this.sceneEl.camera;
    if (camera && position.distanceTo(camera.position) < 0.3) {
      this.reticleEl.setAttribute("visible", false);
      return;
    }

    // Check distance to existing placed items
    var isTooClose = false;
    for (var i = 0; i < this.placedPositions.length; i++) {
      if (position.distanceTo(this.placedPositions[i]) < 0.6) {
        isTooClose = true;
        break;
      }
    }

    // Update reticle color:
    var color;
    if (isTooClose) {
      color = "#ff0000";
    } else if (isWall) {
      color = "#00ffff";
    } else {
      color = "#00ff00";
    }
    this.reticleEl.setAttribute("material", "color", color);

    this.isWall = isWall;
    this.latestHitMatrix = hitMatrix;
    this.reticleObj.matrix.copy(hitMatrix);
    this.reticleObj.matrixWorldNeedsUpdate = true;
    this.reticleEl.setAttribute("visible", true);
  },
});
