import { sculpturesData, paintingsData } from "../data/exhibits.js";
import {
  showARMessage,
  showInfoPanel,
  playInfoSound,
  parseRot,
  bindModeVisibility,
} from "./elements-ui.js";

if (AFRAME.components["ar-reticle"]) {
  delete AFRAME.components["ar-reticle"];
}

AFRAME.registerComponent("ar-reticle", {
  init() {
    this.el.object3D.matrixAutoUpdate = false;
  },
});

// Component for billboard
AFRAME.registerComponent("billboard", {
  init: function () {
    // cache references to avoid repeated lookups
    this.camera = this.el.sceneEl && this.el.sceneEl.camera;
    this.obj3D = this.el.object3D;
    this._lookAtTarget = new THREE.Vector3();
  },
  tick: function () {
    // lazy-find camera if it wasn't available during init
    const cam =
      this.camera || (this.camera = this.el.sceneEl && this.el.sceneEl.camera);
    if (!cam) return;
    // point toward camera but keep the object's Y (so only yaw changes)
    this._lookAtTarget.set(
      cam.position.x,
      this.obj3D.position.y,
      cam.position.z,
    );
    this.obj3D.lookAt(this._lookAtTarget);
    // ensure only Y rotation remains (zero pitch/roll)
    this.obj3D.rotation.x = 0;
    this.obj3D.rotation.z = 0;
  },
});

// Component for making elements clickable in AR
AFRAME.registerComponent("cursor-clickable", {
  init: function () {
    var el = this.el;
    el.addEventListener("mouseenter", function () {
      el.setAttribute("scale", "1.1 1.1 1.1");
    });
    el.addEventListener("mouseleave", function () {
      el.setAttribute("scale", "1 1 1");
    });
  },
});

if (AFRAME.components["ar-hit-test"]) {
  delete AFRAME.components["ar-hit-test"];
}

AFRAME.registerComponent("ar-hit-test", {
  init() {
    // load exhibit data from module imports
    this.sculpturesData = sculpturesData;
    this.paintingsData = paintingsData;
    this.sceneEl = this.el.sceneEl;
    this.reticleEl = document.getElementById("reticle");
    this.reticleObj = this.reticleEl.object3D;
    this.exhibitRoot = document.getElementById("exhibitRoot");
    this.placed = 0;
    this.isPlacing = false;
    this.isPointerOverUI = false;
    this.currentSculptureIndex = 0;
    this.currentPaintingIndex = 0;
    this.placedPositions = [];
    this.isWall = false; // true when reticle is aimed at a vertical surface
    this.replacePending = null; // { group, type, id }
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

  async setupXR() {
    // Wait up to 500ms for the session to become available
    let session = null;
    for (let i = 0; i < 10; i++) {
      session = this.sceneEl.renderer?.xr?.getSession?.();
      if (session) break;
      await new Promise(function (r) {
        setTimeout(r, 50);
      });
    }
    if (!session) {
      showARMessage(this.sceneEl, "XR session not found", "#ff0000");
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
      showARMessage(this.sceneEl, "Hit-test error: " + e.message, "#ff0000");
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
    if (window.__XR_STATE__) {
      document.dispatchEvent(
        new CustomEvent("xr-mode-changed", { detail: { mode: "placement" } }),
      );
    }
  },

  onSelect() {
    // bindModeVisibility was moved to elements-ui.js
    if (this.isPlacing) {
      showARMessage(this.sceneEl, "Wait...", "#ffff00");
      return;
    }

    if (this.isPointerOverUI) {
      showARMessage(this.sceneEl, "UI focused — cannot place", "#ffff00");
      return;
    }

    const mode = window.__XR_STATE__?.mode || "placement";

    // If a replacement is pending, move that group to the current hit position
    if (this.replacePending) {
      if (!this.latestHitMatrix) {
        showARMessage(this.sceneEl, "No Surface Detected", "#ff0000");
        return;
      }

      const newPosition = new THREE.Vector3().setFromMatrixPosition(
        this.latestHitMatrix,
      );

      // Prevent placing sculptures on walls and paintings on the floor
      if (this.replacePending.type === "sculpture" && this.isWall) {
        showARMessage(
          this.sceneEl,
          "Cannot place sculpture on a wall",
          "#ffff00",
        );
        return;
      }
      if (this.replacePending.type === "painting" && !this.isWall) {
        showARMessage(
          this.sceneEl,
          "Cannot place painting on the floor",
          "#ffff00",
        );
        return;
      }

      // ensure not too close to other items
      var tooCloseReplace = false;
      for (var ri = 0; ri < this.placedPositions.length; ri++) {
        if (newPosition.distanceTo(this.placedPositions[ri]) < 0.6) {
          tooCloseReplace = true;
          break;
        }
      }
      if (tooCloseReplace) {
        showARMessage(this.sceneEl, "Too Close! Min 60cm Apart", "#ff0000");
        return;
      }

      try {
        var pending = this.replacePending;
        var groupObj = pending.group.object3D;
        if (this.isWall) {
          const pos = new THREE.Vector3().setFromMatrixPosition(
            this.latestHitMatrix,
          );
          groupObj.position.copy(pos);
          const wallNX = this.latestHitMatrix.elements[4];
          const wallNZ = this.latestHitMatrix.elements[6];
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

        // re-add to scene (if needed), show group and update tracking
        if (!this.exhibitRoot.contains(pending.group)) {
          this.exhibitRoot.appendChild(pending.group);
        }
        try {
          pending.group.setAttribute("visible", true);
        } catch (e) {}
        this.exhibitRoot.setAttribute("visible", true);
        this.placedPositions.push(newPosition);
        this.placed++;
        try {
          pending.group.object3D.matrixWorldNeedsUpdate = true;
        } catch (e) {}
        showARMessage(this.sceneEl, "Item moved", "#00ff00");
      } catch (e) {
        console.error(e);
        showARMessage(this.sceneEl, "Replace error", "#ff0000");
      }

      this.replacePending = null;
      return;
    }

    if (mode === "visit") {
      return;
    }

    if (!this.latestHitMatrix) {
      showARMessage(this.sceneEl, "No Surface Detected", "#ff0000");
      return;
    }

    // Check if items of the current surface type are exhausted
    if (this.isWall && this.currentPaintingIndex >= this.paintingsData.length) {
      showARMessage(
        this.sceneEl,
        "All Paintings Placed — aim at the floor",
        "#ffff00",
      );
      return;
    }
    if (
      !this.isWall &&
      this.currentSculptureIndex >= this.sculpturesData.length
    ) {
      showARMessage(
        this.sceneEl,
        "All Sculptures Placed — aim at a wall",
        "#ffff00",
      );
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
      showARMessage(this.sceneEl, "Too Close! Min 60cm Apart", "#ff0000");
      return;
    }

    this.isPlacing = true;
    try {
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
        // If user selected a specific item via menu, use that
        const selected = window.__XR_STATE__?.selected;
        let paintingData = null;
        if (selected && selected.type === "painting") {
          for (var pi = 0; pi < this.paintingsData.length; pi++) {
            if (this.paintingsData[pi].id === selected.id) {
              paintingData = this.paintingsData[pi];
              break;
            }
          }
          if (!paintingData) {
            showARMessage(
              this.sceneEl,
              "Selected painting not available",
              "#ff0000",
            );
            this.isPlacing = false;
            return;
          }
        } else {
          paintingData = this.paintingsData[this.currentPaintingIndex];
          this.currentPaintingIndex++;
        }

        const painting = document.createElement("a-entity");
        painting.setAttribute("gltf-model", paintingData.id);
        painting.setAttribute("scale", paintingData.scale || "0.6 0.6 0.6");
        // Rotate so the painting faces outward from the wall
        painting.setAttribute("rotation", paintingData.rotation || "0 180 0");
        placementGroup.appendChild(painting);

        // Rotate container (matches sculpture button layout)
        const rotateContainer = document.createElement("a-entity");
        rotateContainer.setAttribute("rotation", "0 180 0");
        rotateContainer.setAttribute("position", "0.6 0.15 0.12");

        const rotateBtnInner = document.createElement("a-plane");
        rotateBtnInner.setAttribute("width", "0.2");
        rotateBtnInner.setAttribute("height", "0.12");
        rotateBtnInner.setAttribute("class", "clickable");
        rotateBtnInner.setAttribute("cursor-clickable", "");
        rotateBtnInner.setAttribute(
          "material",
          "color: #667eea; shader: flat; side: double",
        );
        rotateBtnInner.setAttribute("position", "0 0 0.12");
        rotateContainer.appendChild(rotateBtnInner);

        const iconPlane = document.createElement("a-plane");
        iconPlane.setAttribute("width", "0.1");
        iconPlane.setAttribute("height", "0.1");
        iconPlane.setAttribute(
          "material",
          "src: media/icons/reset-right-line.svg; shader: flat; transparent: true; side: double",
        );
        // center rotate icon slightly in front of painting
        try {
          iconPlane.setAttribute("position", "0 0 0.11");
          iconPlane.setAttribute(
            "visible",
            window.__XR_STATE__ && window.__XR_STATE__.mode === "placement",
          );
        } catch (e) {}
        rotateContainer.appendChild(iconPlane);

        // Rotate-left button (opposite direction) for paintings
        const rotateBtnInnerLeft = document.createElement("a-plane");
        rotateBtnInnerLeft.setAttribute("width", "0.2");
        rotateBtnInnerLeft.setAttribute("height", "0.12");
        rotateBtnInnerLeft.setAttribute("class", "clickable");
        rotateBtnInnerLeft.setAttribute("cursor-clickable", "");
        rotateBtnInnerLeft.setAttribute(
          "material",
          "color: #667eea; shader: flat; side: double",
        );
        // left rotate positioned to the right of the center button for equal spacing
        rotateBtnInnerLeft.setAttribute("position", "0.25 0 0.12");
        rotateContainer.appendChild(rotateBtnInnerLeft);

        const iconPlaneLeft = document.createElement("a-plane");
        iconPlaneLeft.setAttribute("width", "0.1");
        iconPlaneLeft.setAttribute("height", "0.1");
        iconPlaneLeft.setAttribute(
          "material",
          "src: media/icons/reset-left-line.svg; shader: flat; transparent: true; side: double",
        );
        // left rotate icon slightly in front
        try {
          iconPlaneLeft.setAttribute("position", "0.25 0 0.11");
          iconPlaneLeft.setAttribute(
            "visible",
            window.__XR_STATE__ && window.__XR_STATE__.mode === "placement",
          );
        } catch (e) {}
        rotateContainer.appendChild(iconPlaneLeft);

        // (bindings moved after infoContainer is created)

        // info icon plane (same structure as rotate icons)
        const infoIcon = document.createElement("a-plane");
        infoIcon.setAttribute("width", "0.1");
        infoIcon.setAttribute("height", "0.1");
        infoIcon.setAttribute(
          "material",
          "src: media/icons/information-line.svg; shader: flat; transparent: true; side: double",
        );
        infoIcon.setAttribute("position", "0 0 -0.01");

        const infoContainer = document.createElement("a-entity");
        infoContainer.setAttribute("position", "0.6 0.15 0");
        infoContainer.setAttribute("rotation", "0 180 0");
        infoContainer.appendChild(infoIcon);

        placementGroup.appendChild(rotateContainer);
        placementGroup.appendChild(infoContainer);

        var hitTestComp = this;
        var capturedPainting = painting;

        // Bind mode visibility for these elements (bind to container)
        bindModeVisibility(iconPlane, infoContainer);
        try {
          bindModeVisibility(iconPlaneLeft, infoContainer);
          bindModeVisibility(rotateBtnInnerLeft, infoContainer);
        } catch (e) {}

        rotateBtnInner.addEventListener("mouseenter", function () {
          hitTestComp.isPointerOverUI = true;
        });
        rotateBtnInner.addEventListener("mouseleave", function () {
          hitTestComp.isPointerOverUI = false;
        });
        rotateBtnInner.addEventListener("click", function () {
          const mode = window.__XR_STATE__?.mode || "placement";

          if (mode === "visit") {
            playInfoSound();
            showInfoPanel(
              hitTestComp.sceneEl,
              hitTestComp.sculpturesData,
              hitTestComp.paintingsData,
              paintingData.id,
            );
            return;
          }

          const currentRotation = capturedPainting.getAttribute("rotation");
          const [x, y, z] = parseRot(currentRotation);
          if (paintingData && paintingData.id === "#cowPainting") {
            capturedPainting.setAttribute("rotation", {
              x: x + 30,
              y: y,
              z: z,
            });
          } else {
            capturedPainting.setAttribute("rotation", {
              x: x,
              y: y,
              z: z + 30,
            });
          }
        });

        // Left-rotate handler: rotate -30 degrees
        rotateBtnInnerLeft.addEventListener("mouseenter", function () {
          hitTestComp.isPointerOverUI = true;
        });
        rotateBtnInnerLeft.addEventListener("mouseleave", function () {
          hitTestComp.isPointerOverUI = false;
        });
        rotateBtnInnerLeft.addEventListener("click", function () {
          const mode = window.__XR_STATE__?.mode || "placement";
          if (mode === "visit") return;
          // Rotate in the opposite direction of the right rotate button
          const currentRotation = capturedPainting.getAttribute("rotation");
          // Transform rotation to a consistent format and parse out x/y/z as numbers
          const [x, y, z] = parseRot(currentRotation);
          if (paintingData && paintingData.id === "#cowPainting") {
            capturedPainting.setAttribute("rotation", {
              x: x - 30,
              y: y,
              z: z,
            });
          } else {
            capturedPainting.setAttribute("rotation", {
              x: x,
              y: y,
              z: z - 30,
            });
          }
        });

        // --- Replace button
        const replaceBtnInner = document.createElement("a-plane");
        replaceBtnInner.setAttribute("width", "0.2");
        replaceBtnInner.setAttribute("height", "0.12");
        replaceBtnInner.setAttribute("class", "clickable");
        replaceBtnInner.setAttribute("cursor-clickable", "");
        replaceBtnInner.setAttribute(
          "material",
          "color: #10b981; shader: flat; side: double",
        );
        replaceBtnInner.setAttribute("position", "-0.25 0 0.12");
        rotateContainer.appendChild(replaceBtnInner);

        // Add exchange icon to the replace button
        const replaceIcon = document.createElement("a-plane");
        replaceIcon.setAttribute("width", "0.12");
        replaceIcon.setAttribute("height", "0.12");
        replaceIcon.setAttribute(
          "material",
          "src: media/icons/exchange-line.svg; shader: flat; transparent: true; side: double",
        );
        // nudge forward so it isn't occluded by the button plane or painting
        try {
          replaceIcon.setAttribute("position", "-0.25 0 0.11");
          replaceIcon.setAttribute(
            "visible",
            window.__XR_STATE__ && window.__XR_STATE__.mode === "placement",
          );
        } catch (e) {}
        replaceIcon.id = "replaceIconPainting";
        rotateContainer.appendChild(replaceIcon);
        // Ensure the icon hides in visit mode like the replace button (bind to container)
        bindModeVisibility(replaceIcon, infoContainer);

        // Bind visibility on the clickable plane so the whole button hides in visit mode
        bindModeVisibility(replaceBtnInner, infoContainer);

        replaceBtnInner.addEventListener("mouseenter", function () {
          hitTestComp.isPointerOverUI = true;
        });
        replaceBtnInner.addEventListener("mouseleave", function () {
          hitTestComp.isPointerOverUI = false;
        });
        replaceBtnInner.addEventListener("click", function () {
          // Mark this placementGroup as pending replacement and remove from scene
          try {
            // Find and remove position associated with this placementGroup
            var idx = -1;
            var pos = placementGroup.object3D.position;
            for (var k = 0; k < hitTestComp.placedPositions.length; k++) {
              if (hitTestComp.placedPositions[k].distanceTo(pos) < 0.01) {
                idx = k;
                break;
              }
            }
            if (idx >= 0) hitTestComp.placedPositions.splice(idx, 1);
            // hide the group instead of removing it from the DOM so GLTF components stay initialized
            try {
              placementGroup.setAttribute("visible", false);
            } catch (e) {}
            if (hitTestComp.placed > 0) hitTestComp.placed--;
            hitTestComp.replacePending = {
              group: placementGroup,
              type: "painting",
              id: paintingData.id,
            };
            showARMessage(
              hitTestComp.sceneEl,
              "Picked for move — select new location",
              "#ffff00",
            );
            // ensure we're in placement mode
            if (window.__XR_STATE__) {
              window.__XR_STATE__.mode = "placement";
              document.dispatchEvent(
                new CustomEvent("xr-mode-changed", {
                  detail: { mode: "placement" },
                }),
              );
            }
          } catch (err) {
            console.error(err);
            showARMessage(hitTestComp.sceneEl, "Replace error", "#ff0000");
          }
        });
      } else {
        // --- FLOOR
        const table = document.createElement("a-entity");
        table.setAttribute("gltf-model", "#table");
        table.setAttribute("scale", "0.7 0.7 0.7");
        placementGroup.appendChild(table);

        // Check menu selection first
        const sel = window.__XR_STATE__?.selected;
        let selectedSculpture;
        if (sel && sel.type === "sculpture") {
          var sdata = null;
          for (var si = 0; si < this.sculpturesData.length; si++) {
            if (this.sculpturesData[si].id === sel.id) {
              sdata = this.sculpturesData[si];
              break;
            }
          }
          if (!sdata) {
            showARMessage(
              this.sceneEl,
              "Selected sculpture not available",
              "#ff0000",
            );
            this.isPlacing = false;
            return;
          }
          selectedSculpture = sdata.id;
        } else {
          const selectedSculptureData =
            this.sculpturesData[this.currentSculptureIndex];
          selectedSculpture = selectedSculptureData.id;
          this.currentSculptureIndex++;
        }

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

        // Rotate button
        const rotateBubble = document.createElement("a-entity");
        rotateBubble.setAttribute("rotation", "0 180 0");
        // move sculpture buttons further away from the sculpture
        rotateBubble.setAttribute("position", "-0.5 0.3 0.01");

        const rotateBtnBorder = document.createElement("a-plane");
        rotateBtnBorder.setAttribute("width", "0.2");
        rotateBtnBorder.setAttribute("height", "0.12");
        rotateBtnBorder.setAttribute("class", "clickable");
        rotateBtnBorder.setAttribute("cursor-clickable", "");
        rotateBtnBorder.setAttribute(
          "material",
          "color: #667eea; shader: flat; side: double",
        );
        rotateBtnBorder.setAttribute("position", "-0.3 0 -0.001");
        rotateBubble.appendChild(rotateBtnBorder);

        const iconPlane2 = document.createElement("a-plane");
        iconPlane2.setAttribute("width", "0.1");
        iconPlane2.setAttribute("height", "0.1");
        iconPlane2.setAttribute(
          "material",
          "src: media/icons/reset-right-line.svg; shader: flat; transparent: true; side: double",
        );
        iconPlane2.setAttribute("position", "-0.3 0 0.01");
        rotateBubble.appendChild(iconPlane2);

        // Rotate-left button (opposite direction) for sculptures
        const rotateBtnBorderLeft = document.createElement("a-plane");
        rotateBtnBorderLeft.setAttribute("width", "0.15");
        rotateBtnBorderLeft.setAttribute("height", "0.12");
        rotateBtnBorderLeft.setAttribute("class", "clickable");
        rotateBtnBorderLeft.setAttribute("cursor-clickable", "");
        rotateBtnBorderLeft.setAttribute(
          "material",
          "color: #667eea; shader: flat; side: double",
        );
        rotateBtnBorderLeft.setAttribute("position", "-0.08 0 -0.001");
        rotateBubble.appendChild(rotateBtnBorderLeft);

        const iconPlane2Left = document.createElement("a-plane");
        iconPlane2Left.setAttribute("width", "0.1");
        iconPlane2Left.setAttribute("height", "0.1");
        iconPlane2Left.setAttribute(
          "material",
          "src: media/icons/reset-left-line.svg; shader: flat; transparent: true; side: double",
        );
        iconPlane2Left.setAttribute("position", "-0.08 0 0.01");
        rotateBubble.appendChild(iconPlane2Left);

        // (binds moved below after bubbleContainer is created)

        placementGroup.appendChild(rotateBubble);

        // info icon plane (same structure as rotate icons)
        const bubbleIcon = document.createElement("a-plane");
        bubbleIcon.setAttribute("width", "0.1");
        bubbleIcon.setAttribute("height", "0.1");
        bubbleIcon.setAttribute(
          "material",
          "src: media/icons/information-line.svg; shader: flat; transparent: true; side: double",
        );
        bubbleIcon.setAttribute("position", "0.8 0 -0.01");

        const bubbleContainer = document.createElement("a-entity");
        bubbleContainer.setAttribute("position", "0.5 0 0");
        // cancel parent rotation so sculpture icon stays upright
        bubbleContainer.setAttribute("rotation", "0 180 0");
        bubbleContainer.appendChild(bubbleIcon);

        rotateBubble.appendChild(bubbleContainer);

        // Bind left-rotate icon/button now that bubbleContainer exists
        try {
          bindModeVisibility(iconPlane2Left, bubbleContainer);
          bindModeVisibility(rotateBtnBorderLeft, bubbleContainer);
        } catch (e) {}

        var hitTestComp2 = this;
        var capturedSculptureWrapper = sculptureWrapper;
        var capturedSculptureId = selectedSculpture;

        // Bind mode visibility for these two elements (bind to container so billboard can be applied)
        bindModeVisibility(iconPlane2, bubbleContainer);

        rotateBtnBorder.addEventListener("mouseenter", function () {
          hitTestComp2.isPointerOverUI = true;
        });
        rotateBtnBorder.addEventListener("mouseleave", function () {
          hitTestComp2.isPointerOverUI = false;
        });
        rotateBtnBorder.addEventListener("click", function () {
          const mode = window.__XR_STATE__?.mode || "placement";

          if (mode === "visit") {
            playInfoSound();
            showInfoPanel(
              hitTestComp2.sceneEl,
              hitTestComp2.sculpturesData,
              hitTestComp2.paintingsData,
              capturedSculptureId,
            );
            return;
          }

          const currentRotation =
            capturedSculptureWrapper.getAttribute("rotation");
          const [x, y, z] = parseRot(currentRotation);
          // Rotate 30 degrees around Y axis
          capturedSculptureWrapper.setAttribute("rotation", {
            x: x,
            y: y + 30,
            z: z,
          });
        });

        // Left-rotate handler for sculptures
        rotateBtnBorderLeft.addEventListener("mouseenter", function () {
          hitTestComp2.isPointerOverUI = true;
        });
        rotateBtnBorderLeft.addEventListener("mouseleave", function () {
          hitTestComp2.isPointerOverUI = false;
        });
        rotateBtnBorderLeft.addEventListener("click", function () {
          const mode = window.__XR_STATE__?.mode || "placement";
          if (mode === "visit") return;
          const currentRotation =
            capturedSculptureWrapper.getAttribute("rotation");
          const [x, y, z] = parseRot(currentRotation);
          capturedSculptureWrapper.setAttribute("rotation", {
            x: x,
            y: y - 30,
            z: z,
          });
        });

        // --- Replace button for sculptures
        const replaceBtnBorder = document.createElement("a-plane");
        replaceBtnBorder.setAttribute("width", "0.2");
        replaceBtnBorder.setAttribute("height", "0.12");
        replaceBtnBorder.setAttribute("class", "clickable");
        replaceBtnBorder.setAttribute("cursor-clickable", "");
        replaceBtnBorder.setAttribute(
          "material",
          "color: #10b981; shader: flat; side: double",
        );
        replaceBtnBorder.setAttribute("position", "-0.55 0 -0.001");
        rotateBubble.appendChild(replaceBtnBorder);

        // Exchange icon for sculpture replace button
        const replaceIcon2 = document.createElement("a-plane");
        replaceIcon2.setAttribute("width", "0.12");
        replaceIcon2.setAttribute("height", "0.12");
        replaceIcon2.setAttribute(
          "material",
          "src: media/icons/exchange-line.svg; shader: flat; transparent: true; side: double",
        );
        replaceIcon2.setAttribute("position", "-0.55 0 0.02");
        // set initial visibility according to current mode
        try {
          replaceIcon2.setAttribute(
            "visible",
            window.__XR_STATE__ && window.__XR_STATE__.mode === "placement",
          );
        } catch (e) {}
        rotateBubble.appendChild(replaceIcon2);

        // Bind sculpture replace icon visibility to visit/placement mode (bind to container)
        bindModeVisibility(replaceIcon2, bubbleContainer);

        // don't add a separate icon image; bind the clickable border so the whole
        // button hides in visit mode (bind to container)
        bindModeVisibility(replaceBtnBorder, bubbleContainer);

        replaceBtnBorder.addEventListener("mouseenter", function () {
          hitTestComp2.isPointerOverUI = true;
        });
        replaceBtnBorder.addEventListener("mouseleave", function () {
          hitTestComp2.isPointerOverUI = false;
        });
        replaceBtnBorder.addEventListener("click", function () {
          try {
            var idx2 = -1;
            var pos2 = placementGroup.object3D.position;
            for (var kk = 0; kk < hitTestComp2.placedPositions.length; kk++) {
              if (hitTestComp2.placedPositions[kk].distanceTo(pos2) < 0.01) {
                idx2 = kk;
                break;
              }
            }
            if (idx2 >= 0) hitTestComp2.placedPositions.splice(idx2, 1);
            try {
              placementGroup.setAttribute("visible", false);
            } catch (e) {}
            if (hitTestComp2.placed > 0) hitTestComp2.placed--;
            hitTestComp2.replacePending = {
              group: placementGroup,
              type: "sculpture",
              id: capturedSculptureId,
            };
            showARMessage(
              hitTestComp2.sceneEl,
              "Picked for move — select new location",
              "#ffff00",
            );
            if (window.__XR_STATE__) {
              window.__XR_STATE__.mode = "placement";
              document.dispatchEvent(
                new CustomEvent("xr-mode-changed", {
                  detail: { mode: "placement" },
                }),
              );
            }
          } catch (err2) {
            console.error(err2);
            showARMessage(hitTestComp2.sceneEl, "Replace error", "#ff0000");
          }
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
              platform.setAttribute(
                "position",
                `0 ${sculptureHeight - 0.15} 0`,
              );
            } else {
              sculptureHeight = tableTop * 0.7;
              platform.setAttribute(
                "position",
                `0 ${sculptureHeight + 0.02} 0`,
              );
            }
            sculptureWrapper.setAttribute("position", `0 ${sculptureHeight} 0`);
            rotateBubble.setAttribute(
              "position",
              `0.23 ${sculptureHeight + 0.2} 0`,
            );
          } else {
            sculptureWrapper.setAttribute("position", "0 1 0");
            platform.setAttribute("position", "0 1 0");
            rotateBubble.setAttribute("position", "0.23 1.2 0");
          }
        });
      }

      this.exhibitRoot.appendChild(placementGroup);
      this.exhibitRoot.setAttribute("visible", true);
      this.placedPositions.push(newPosition);
      this.placed++;

      if (this.placed >= this.totalItems) {
        this.reticleEl.setAttribute("visible", false);
        if (window.__XR_STATE__) {
          window.__XR_STATE__.mode = "visit";
          document.dispatchEvent(
            new CustomEvent("xr-mode-changed", { detail: { mode: "visit" } }),
          );
        }
        showARMessage(
          this.sceneEl,
          "All Exhibits Placed! Enjoy the exhibit 🎨",
          "#00ff00",
        );
      }
    } catch (e) {
      this.isPlacing = false;
      showARMessage(
        this.sceneEl,
        "Placement error: " + (e?.message || e),
        "#ff0000",
      );
      console.error(e);
      return;
    }

    var selfComp = this;
    setTimeout(function () {
      selfComp.isPlacing = false;
    }, 500);
  },

  onXRFrame(frame) {
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
    const results = frame.getHitTestResults(this.hitTestSource); // WebXR scans the real world
    if (!results.length) {
      this.reticleEl.setAttribute("visible", false);
      this.latestHitMatrix = null;
      return;
    }
    const pose = results[0].getPose(this.refSpace); // Use the closest hit test result
    if (!pose) {
      this.reticleEl.setAttribute("visible", false);
      return;
    }
    const hitMatrix = new THREE.Matrix4().fromArray(pose.transform.matrix); // Hit matrix transforms
    const normalY = hitMatrix.elements[5]; // What kind of surface was hit?

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

    this.isWall = isWall;
    this.latestHitMatrix = hitMatrix;
    this.reticleObj.matrix.copy(hitMatrix); // Update reticle position
    this.reticleObj.matrixWorldNeedsUpdate = true;
    this.reticleEl.setAttribute("visible", true);
  },
});
