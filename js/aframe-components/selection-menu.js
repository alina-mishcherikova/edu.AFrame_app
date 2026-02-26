AFRAME.registerComponent("selection-menu", {
  init: function () {
    var self = this;
    // Menu container attached to controller
    this.menu = document.createElement("a-entity");
    this.menu.setAttribute("visible", "false");
    this.menu.setAttribute("scale", "0.6 0.6 0.6");
    if (this.el && this.el.sceneEl) {
      this.el.sceneEl.appendChild(this.menu);
    } else {
      // fallback: wait for DOM load and append to the first a-scene
      document.addEventListener("DOMContentLoaded", function () {
        var s = document.querySelector("a-scene");
        if (s && !s.contains(self.menu)) {
          s.appendChild(self.menu);
        }
      });
    }

    // Toggle menu on grab
    this.el.addEventListener("gripdown", function () {
      self.toggleMenu(true);
    });
    this.el.addEventListener("gripup", function () {
      self.toggleMenu(false);
    });

    // Build menu when scene's hit-test component is ready
    this.buildMenu = this.buildMenu.bind(this);
    this._buildRetries = 0;
    // Delay first build slightly so module scripts (hit-test.js) have time to register
    if (this.el.sceneEl.hasLoaded) {
      setTimeout(this.buildMenu, 200);
    } else {
      this.el.sceneEl.addEventListener("loaded", function () {
        setTimeout(self.buildMenu, 200);
      });
    }
  },

  toggleMenu: function (open) {
    var visVal;
    if (open) {
      visVal = "true";
    } else {
      visVal = "false";
    }
    this.menu.setAttribute("visible", visVal);
    if (open) {
      var sceneEl = this.el.sceneEl;
      if (typeof THREE === "undefined") return;

      // Prefer the XR camera in AR mode for accurate head position
      var threeCamera =
        (sceneEl.renderer &&
          sceneEl.renderer.xr &&
          sceneEl.renderer.xr.isPresenting &&
          sceneEl.renderer.xr.getCamera()) ||
        sceneEl.camera;

      if (threeCamera) {
        const worldPos = new THREE.Vector3();
        const forward = new THREE.Vector3();
        threeCamera.getWorldPosition(worldPos);
        threeCamera.getWorldDirection(forward);
        const dist = 0.8;
        const targetPos = worldPos.clone().add(forward.multiplyScalar(dist));
        this.menu.object3D.position.copy(targetPos);
        this.menu.object3D.lookAt(worldPos);
      }
    }
  },

  buildMenu: function () {
    const hitComp = this.el.sceneEl.components["ar-hit-test"];
    // If the hit-test component isn't registered yet, retry a few times.
    if (!hitComp) {
      if (this._buildRetries < 50) {
        this._buildRetries++;
        setTimeout(this.buildMenu, 200);
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
      items.push({
        id: p.id,
        label: p.name,
        type: "painting",
        thumbnailScale: p.thumbnailScale || "0.005 0.005 0.005",
        thumbnailRotation: p.thumbnailRotation || "0 180 0",
      });
    }
    for (let i = 0; i < sculptures.length; i++) {
      const s = sculptures[i];
      items.push({
        id: s.id,
        label: s.name,
        type: "sculpture",
        thumbnailScale: s.thumbnailScale || "0.025 0.025 0.025",
        thumbnailRotation: s.thumbnailRotation || "0 135 0",
      });
    }

    //Layout
    var cols = 3;
    var spacingX = 0.22;
    var spacingY = 0.26;
    var capturedMenu = this.menu;

    for (var i = 0; i < items.length; i++) {
      let it = items[i];
      let col = i % cols;
      let row = Math.floor(i / cols);
      let x = col * spacingX - (spacingX * (cols - 1)) / 2;
      let y = row * -spacingY;

      // clickable background plane
      let btn = document.createElement("a-plane");
      btn.classList.add("ui-btn");
      btn.classList.add("clickable");
      btn.setAttribute("width", "0.18");
      btn.setAttribute("height", "0.22");
      btn.setAttribute("position", x + " " + y + " 0");
      btn.setAttribute(
        "material",
        "color: #331849; shader: flat; opacity: 0.85; side: double",
      );
      btn.setAttribute("cursor-clickable", "");

      // GLTF 3D thumbnail
      let thumb = document.createElement("a-entity");
      thumb.setAttribute("gltf-model", it.id);
      thumb.setAttribute("scale", it.thumbnailScale);
      thumb.setAttribute("rotation", it.thumbnailRotation);
      thumb.setAttribute("position", "0 0.03 0.04");

      // text label below thumbnail
      let label = document.createElement("a-text");
      let shortLabel;
      if (it.label.length > 12) {
        shortLabel = it.label.slice(0, 11) + "\u2026";
      } else {
        shortLabel = it.label;
      }
      label.setAttribute("value", shortLabel);
      label.setAttribute("align", "center");
      label.setAttribute("width", "0.32");
      label.setAttribute("color", "#e8d5ff");
      label.setAttribute("position", "0 -0.085 0.02");
      label.setAttribute("wrap-count", "14");

      // type indicator dot
      let typeDot = document.createElement("a-circle");
      typeDot.setAttribute("radius", "0.012");
      let dotColor;
      if (it.type === "painting") {
        dotColor = "#c084fc";
      } else {
        dotColor = "#34d399";
      }
      typeDot.setAttribute("material", "color: " + dotColor + "; shader: flat");
      typeDot.setAttribute("position", "0.07 0.095 0.02");

      // border frame (highlight on hover/select)
      let frame = document.createElement("a-plane");
      frame.setAttribute("width", "0.20");
      frame.setAttribute("height", "0.24");
      frame.setAttribute("position", "0 0 -0.01");
      frame.setAttribute(
        "material",
        "color: #442660; shader: flat; opacity: 0.0; side: double",
      );

      // captured refs for event listeners
      let capturedBtn = btn;
      let capturedIt = it;

      // hover
      btn.addEventListener("mouseenter", function () {
        capturedBtn.setAttribute(
          "material",
          "color: #5a2d82; shader: flat; opacity: 1; side: double",
        );
        capturedBtn.object3D.scale.set(1.08, 1.08, 1.08);
        var hitComp = capturedBtn.sceneEl.components["ar-hit-test"];
        if (hitComp) {
          hitComp.isPointerOverUI = true;
        }
      });
      btn.addEventListener("mouseleave", function () {
        capturedBtn.setAttribute(
          "material",
          "color: #331849; shader: flat; opacity: 0.85; side: double",
        );
        capturedBtn.object3D.scale.set(1, 1, 1);
        var hitComp = capturedBtn.sceneEl.components["ar-hit-test"];
        if (hitComp) {
          hitComp.isPointerOverUI = false;
        }
      });

      btn.addEventListener("click", function () {
        window.__XR_STATE__ = window.__XR_STATE__ || {};
        window.__XR_STATE__.selected = {
          id: capturedIt.id,
          type: capturedIt.type,
        };

        capturedBtn.setAttribute(
          "material",
          "color: #90fbac; shader: flat; opacity: 0.95; side: double",
        );
        setTimeout(function () {
          capturedMenu.setAttribute("visible", "false");
          capturedBtn.setAttribute(
            "material",
            "color: #331849; shader: flat; opacity: 0.85; side: double",
          );
        }, 180);
      });

      btn.appendChild(frame);
      btn.appendChild(thumb);
      btn.appendChild(label);
      btn.appendChild(typeDot);
      this.menu.appendChild(btn);
    }
  },
});
