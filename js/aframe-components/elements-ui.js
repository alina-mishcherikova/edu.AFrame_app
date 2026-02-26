// Utilities extracted from hit-test.js for AR UI (messages, info panel, sounds)
export function showARMessage(sceneEl, text, color = "#00ff00") {
  // Do not show AR placement messages when in visit mode
  if (window.__XR_STATE__ && window.__XR_STATE__.mode === "visit") return;
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

  // append to scene so it respects scene transforms
  (sceneEl || document.body).appendChild(msg);

  setTimeout(function () {
    msg.remove();
  }, 3000);
}

export function showInfoPanel(
  sceneEl,
  sculpturesData,
  paintingsData,
  sculptureId,
) {
  const existingPanel = document.getElementById("infoPanel");
  if (existingPanel) {
    existingPanel.remove();
    return;
  }

  // Search in both sculptures and paintings data
  var sculptureInfo = null;
  for (var i = 0; i < sculpturesData.length; i++) {
    if (sculpturesData[i].id === sculptureId) {
      sculptureInfo = sculpturesData[i];
      break;
    }
  }
  if (!sculptureInfo) {
    for (var j = 0; j < paintingsData.length; j++) {
      if (paintingsData[j].id === sculptureId) {
        sculptureInfo = paintingsData[j];
        break;
      }
    }
  }

  if (!sculptureInfo) return;

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

  (sceneEl || document.body).appendChild(panel);

  closeButton.addEventListener("click", function () {
    panel.remove();
  });
}

export function playInfoSound() {
  const snd = document.getElementById("infoSound");
  if (!snd) return;
  snd.currentTime = 0;
  snd.play().catch(function (err) {
    console.warn("Info sound blocked:", err);
  });
}

// parseRot: take a rotation value or an object and always return a numeric array [x, y, z]. Missing or invalid values become 0.

export function parseRot(rot) {
  // If it's a string, split by spaces and convert each part to a number.
  if (typeof rot === "string") {
    // split into string parts
    const parts = rot.split(" ");
    let x = 0;
    let y = 0;
    let z = 0;
    if (parts[0] !== undefined) {
      const n = Number(parts[0]);
      if (!isNaN(n)) x = n;
    }
    if (parts[1] !== undefined) {
      const n = Number(parts[1]);
      if (!isNaN(n)) y = n;
    }
    if (parts[2] !== undefined) {
      const n = Number(parts[2]);
      if (!isNaN(n)) z = n;
    }
    return [x, y, z];
  }

  // If it's an object with x/y/z properties,
  if (rot && typeof rot === "object") {
    let x = 0;
    let y = 0;
    let z = 0;
    if (rot.x !== undefined) {
      const n = Number(rot.x);
      if (!isNaN(n)) x = n;
    }
    if (rot.y !== undefined) {
      const n = Number(rot.y);
      if (!isNaN(n)) y = n;
    }
    if (rot.z !== undefined) {
      const n = Number(rot.z);
      if (!isNaN(n)) z = n;
    }
    return [x, y, z];
  }

  // Fallback when rot is missing or in an unexpected format.
  return [0, 0, 0];
}

// bindModeVisibility: make `iconEl` visible in "placement" mode and `visitEl` visible in "visit" mode. Listens for the global `xr-mode-changed` event and also initializes visibility immediately.
export function bindModeVisibility(iconEl, visitEl) {
  function updateVisibility(ev) {
    var mode =
      (ev && ev.detail && ev.detail.mode) ||
      (window.__XR_STATE__ && window.__XR_STATE__.mode) ||
      "placement";
    if (iconEl && iconEl.setAttribute) {
      if (mode === "placement") {
        iconPlaneVisible(iconEl, true);
      } else {
        iconPlaneVisible(iconEl, false);
      }
    }
    if (visitEl && visitEl.setAttribute) {
      if (mode === "visit") {
        visitEl.setAttribute("visible", true);
      } else {
        visitEl.setAttribute("visible", false);
      }
    }
  }

  // Small helper to guard setAttribute calls for icon planes
  function iconPlaneVisible(el, visible) {
    if (el && el.setAttribute) {
      el.setAttribute("visible", visible);
    }
  }

  updateVisibility();
  document.addEventListener("xr-mode-changed", updateVisibility);
}
