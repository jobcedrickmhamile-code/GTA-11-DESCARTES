document.addEventListener("DOMContentLoaded", () => {
  // Page Navigation Elements
  const landingPage = document.getElementById("landing-page");
  const appWorkspace = document.getElementById("app-workspace");
  const startAppBtn = document.getElementById("start-app-btn");
  const backHomeBtn = document.getElementById("back-home-btn");

  // Floating Drawer Elements
  const floatingPanel = document.getElementById("floating-panel");
  const togglePanelBtn = document.getElementById("toggle-panel-btn");
  const equationsList = document.getElementById("equations-list");

  // Canvas Setup
  const canvas = document.getElementById("graph-canvas");
  const ctx = canvas.getContext("2d");
  const canvasWrapper = document.getElementById("canvas-wrapper");

  // Tools & Reference Image Elements
  const bgUpload = document.getElementById("bg-upload");
  const imageControls = document.getElementById("image-controls");
  const bgOpacity = document.getElementById("bg-opacity");
  const removeBgBtn = document.getElementById("remove-bg-btn");
  const clearAllBtn = document.getElementById("clear-all-btn");
  
  // Export & Copy All Controls
  const exportImgBtn = document.getElementById("export-img-btn");
  const copyAllBtn = document.getElementById("copy-all-btn");

  // Viewport Controls
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const resetViewBtn = document.getElementById("reset-view");

  // Highlight Palette when Hovered/Selected
  const highlightColors = [
    "#187a3d", "#2563eb", "#d97706", "#9333ea", "#dc2626", "#0891b2"
  ];
  let colorIndex = 0;

  // Coordinate System Settings
  let scale = 45; // Pixels per grid unit
  let originX = 0;
  let originY = 0;

  // Workspace States
  let isDrawing = false;
  let currentStroke = [];
  let curves = [];
  let activeCurveId = null; // Currently highlighted curve ID
  let bgImage = null;
  let bgImageOpacity = 0.4;

  // --- PAGE TRANSITIONS ---
  startAppBtn.addEventListener("click", () => {
    landingPage.classList.add("hidden");
    appWorkspace.classList.remove("hidden");
    initCanvas();
  });

  backHomeBtn.addEventListener("click", () => {
    appWorkspace.classList.add("hidden");
    landingPage.classList.remove("hidden");
  });

  // Fixed Panel Collapse Toggle
  togglePanelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    floatingPanel.classList.toggle("collapsed");
  });

  // --- CANVAS INITIALIZATION & COORDINATES ---
  function initCanvas() {
    canvas.width = canvasWrapper.clientWidth;
    canvas.height = canvasWrapper.clientHeight;
    originX = canvas.width / 2;
    originY = canvas.height / 2;
    render();
  }

  function screenToMath(px, py) {
    return {
      x: (px - originX) / scale,
      y: (originY - py) / scale
    };
  }

  function mathToScreen(x, y) {
    return {
      x: originX + x * scale,
      y: originY - y * scale
    };
  }

  // --- RENDER PIPELINE ---
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill canvas background white so exported PNG isn't transparent
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Reference Background Image
    if (bgImage) {
      ctx.save();
      ctx.globalAlpha = bgImageOpacity;
      const imgW = bgImage.width;
      const imgH = bgImage.height;
      ctx.drawImage(bgImage, originX - imgW / 2, originY - imgH / 2, imgW, imgH);
      ctx.restore();
    }

    // 2. Render Light Cartesian Grid (Desmos Style)
    drawGrid();

    // 3. Render Curves (Solid Black by default, Colored on Hover/Selection)
    curves.forEach(curve => drawCurve(curve));

    // 4. Render Active Freehand Drawing Stroke
    if (isDrawing && currentStroke.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#187a3d";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(currentStroke[0].px, currentStroke[0].py);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].px, currentStroke[i].py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawGrid() {
    const leftMath = screenToMath(0, 0).x;
    const rightMath = screenToMath(canvas.width, 0).x;
    const topMath = screenToMath(0, 0).y;
    const bottomMath = screenToMath(0, canvas.height).y;

    let gridStep = 1;
    if (scale < 25) gridStep = 5;
    if (scale > 90) gridStep = 0.5;

    // Light Grid Lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const startX = Math.floor(leftMath / gridStep) * gridStep;
    for (let x = startX; x <= rightMath; x += gridStep) {
      const px = mathToScreen(x, 0).x;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
    }
    const startY = Math.floor(bottomMath / gridStep) * gridStep;
    for (let y = startY; y <= topMath; y += gridStep) {
      const py = mathToScreen(0, y).y;
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
    }
    ctx.stroke();

    // Dark Main Axes (X and Y)
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    // Y Axis
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);

    // X Axis
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

    // Number Labels
    ctx.fillStyle = "#64748b";
    ctx.font = "11px 'Fira Code', monospace";

    for (let x = startX; x <= rightMath; x += gridStep) {
      if (Math.abs(x) < 0.001) continue;
      const pt = mathToScreen(x, 0);
      ctx.fillText(x.toString(), pt.x - 6, originY + 16);
    }

    for (let y = startY; y <= topMath; y += gridStep) {
      if (Math.abs(y) < 0.001) continue;
      const pt = mathToScreen(0, y);
      ctx.fillText(y.toString(), originX + 8, pt.y + 4);
    }
  }

  function drawCurve(curve) {
    const isHighlighted = (curve.id === activeCurveId);
    
    // Default is SOLID BLACK, highlighted gets its highlight color + thicker stroke
    ctx.strokeStyle = isHighlighted ? curve.highlightColor : "#000000";
    ctx.lineWidth = isHighlighted ? 4 : 2.5;

    ctx.beginPath();

    if (curve.type === "line" || curve.type === "parabola") {
      const startX = Math.min(curve.domain.min, curve.domain.max);
      const endX = Math.max(curve.domain.min, curve.domain.max);
      const step = (endX - startX) / 100 || 0.01;

      let started = false;
      for (let x = startX; x <= endX; x += step) {
        let y = (curve.type === "line") 
          ? (curve.m * x + curve.b) 
          : (curve.a * x * x + curve.b * x + curve.c);

        const pt = mathToScreen(x, y);
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
    } else if (curve.type === "parametric") {
      let started = false;
      for (let t = 0; t <= 1; t += 0.01) {
        const x = Math.pow(1 - t, 2) * curve.p0.x + 2 * (1 - t) * t * curve.p1.x + Math.pow(t, 2) * curve.p2.x;
        const y = Math.pow(1 - t, 2) * curve.p0.y + 2 * (1 - t) * t * curve.p1.y + Math.pow(t, 2) * curve.p2.y;
        const pt = mathToScreen(x, y);

        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
    }

    ctx.stroke();
  }

  // --- DRAWING STROKE EVENT LISTENERS ---
  canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    currentStroke = [];
    addPoint(e);
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    addPoint(e);
    render();
  });

  canvas.addEventListener("mouseup", () => {
    if (!isDrawing) return;
    isDrawing = false;
    processStroke(currentStroke);
    currentStroke = [];
    render();
  });

  function addPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathPt = screenToMath(px, py);
    currentStroke.push({ px, py, x: mathPt.x, y: mathPt.y });
  }

  // --- MATHEMATICAL RECOGNITION ALGORITHMS ---
  function processStroke(pts) {
    if (pts.length < 3) return;

    const chosenHighlightColor = highlightColors[colorIndex % highlightColors.length];
    colorIndex++;

    const xCoords = pts.map(p => p.x);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);

    // 1. Linear Fit
    const lineFit = fitLine(pts);
    if (lineFit.rSquared > 0.90) {
      curves.push({
        id: Date.now(),
        type: "line",
        highlightColor: chosenHighlightColor,
        m: lineFit.m,
        b: lineFit.b,
        domain: { min: minX, max: maxX },
        equationText: `y = ${lineFit.m.toFixed(2)}x ${lineFit.b >= 0 ? '+' : '-'} ${Math.abs(lineFit.b).toFixed(2)}`
      });
      updateEquationsUI();
      return;
    }

    // 2. Parabolic Fit
    const quadFit = fitParabola(pts);
    if (quadFit.rSquared > 0.85) {
      const signB = quadFit.b >= 0 ? '+' : '-';
      const signC = quadFit.c >= 0 ? '+' : '-';
      curves.push({
        id: Date.now(),
        type: "parabola",
        highlightColor: chosenHighlightColor,
        a: quadFit.a,
        b: quadFit.b,
        c: quadFit.c,
        domain: { min: minX, max: maxX },
        equationText: `y = ${quadFit.a.toFixed(2)}x² ${signB} ${Math.abs(quadFit.b).toFixed(2)}x ${signC} ${Math.abs(quadFit.c).toFixed(2)}`
      });
      updateEquationsUI();
      return;
    }

    // 3. Parametric Spline Fallback
    const p0 = pts[0];
    const p2 = pts[pts.length - 1];
    const midIdx = Math.floor(pts.length / 2);
    const p1 = {
      x: 2 * pts[midIdx].x - 0.5 * p0.x - 0.5 * p2.x,
      y: 2 * pts[midIdx].y - 0.5 * p0.y - 0.5 * p2.y
    };

    curves.push({
      id: Date.now(),
      type: "parametric",
      highlightColor: chosenHighlightColor,
      p0, p1, p2,
      equationText: `f(t) = bezier(${p0.x.toFixed(1)}, ${p1.x.toFixed(1)}, ${p2.x.toFixed(1)})`
    });
    updateEquationsUI();
  }

  function fitLine(pts) {
    const n = pts.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let p of pts) {
      sumX += p.x; sumY += p.y;
      sumXY += p.x * p.y; sumXX += p.x * p.x;
    }
    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    let ssTot = 0, ssRes = 0;
    const meanY = sumY / n;
    for (let p of pts) {
      const predY = m * p.x + b;
      ssTot += Math.pow(p.y - meanY, 2);
      ssRes += Math.pow(p.y - predY, 2);
    }
    return { m, b, rSquared: 1 - (ssRes / (ssTot || 1)) };
  }

  function fitParabola(pts) {
    const n = pts.length;
    let sX = 0, sY = 0, sX2 = 0, sX3 = 0, sX4 = 0, sXY = 0, sX2Y = 0;
    for (let p of pts) {
      const x = p.x, y = p.y, x2 = x * x;
      sX += x; sY += y;
      sX2 += x2; sX3 += x2 * x; sX4 += x2 * x2;
      sXY += x * y; sX2Y += x2 * y;
    }

    const D = n * (sX2 * sX4 - sX3 * sX3) - sX * (sX * sX4 - sX2 * sX3) + sX2 * (sX * sX3 - sX2 * sX2);
    const Da = sY * (sX2 * sX4 - sX3 * sX3) - sX * (sXY * sX4 - sX2Y * sX3) + sX2 * (sXY * sX3 - sX2Y * sX2);
    const Db = n * (sXY * sX4 - sX2Y * sX3) - sY * (sX * sX4 - sX2 * sX3) + sX2 * (sX * sX2Y - sXY * sX2);
    const Dc = n * (sX2 * sX2Y - sX3 * sXY) - sX * (sX * sX2Y - sX3 * sY) + sY * (sX * sX3 - sX2 * sX2);

    const a = Da / D || 0;
    const b = Db / D || 0;
    const c = Dc / D || 0;

    let ssTot = 0, ssRes = 0;
    const meanY = sY / n;
    for (let p of pts) {
      const predY = a * p.x * p.x + b * p.x + c;
      ssTot += Math.pow(p.y - meanY, 2);
      ssRes += Math.pow(p.y - predY, 2);
    }
    return { a, b, c, rSquared: 1 - (ssRes / (ssTot || 1)) };
  }

  // --- UI DRAWER UPDATES & HOVER HIGHLIGHTING ---
  function updateEquationsUI() {
    if (curves.length === 0) {
      equationsList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-pen-line"></i>
          <p>Draw any curve or line on the Cartesian plane to generate its function.</p>
        </div>`;
      return;
    }

    equationsList.innerHTML = "";
    curves.forEach((curve) => {
      const card = document.createElement("div");
      card.className = "equation-card";
      
      const dotColor = (curve.id === activeCurveId) ? curve.highlightColor : "#000000";
      
      card.innerHTML = `
        <div class="color-dot" style="background-color: ${dotColor};"></div>
        <div class="math-text">${curve.equationText}</div>
        <div class="card-actions">
          <button class="action-btn copy" title="Copy Text"><i class="fa-regular fa-copy"></i></button>
          <button class="action-btn delete" title="Delete Graph"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;

      card.addEventListener("mouseenter", () => {
        activeCurveId = curve.id;
        updateEquationsUI();
        render();
      });

      card.addEventListener("mouseleave", () => {
        activeCurveId = null;
        updateEquationsUI();
        render();
      });

      card.querySelector(".copy").addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(curve.equationText);
      });

      card.querySelector(".delete").addEventListener("click", (e) => {
        e.stopPropagation();
        curves = curves.filter(c => c.id !== curve.id);
        if (activeCurveId === curve.id) activeCurveId = null;
        updateEquationsUI();
        render();
      });

      equationsList.appendChild(card);
    });
  }

  // --- EXPORT & COPY ALL LOGIC ---
  exportImgBtn.addEventListener("click", () => {
    // Ensure canvas renders without active hover highlighting
    activeCurveId = null;
    render();

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `GTA11-GraphArt-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  });

  copyAllBtn.addEventListener("click", () => {
    if (curves.length === 0) {
      alert("No equations to copy yet! Draw on the graph first.");
      return;
    }

    const allEquationsText = curves
      .map((c, idx) => `${idx + 1}. ${c.equationText}`)
      .join("\n");

    navigator.clipboard.writeText(allEquationsText).then(() => {
      const originalText = copyAllBtn.querySelector("span").textContent;
      copyAllBtn.querySelector("span").textContent = "Copied!";
      setTimeout(() => {
        copyAllBtn.querySelector("span").textContent = originalText;
      }, 2000);
    });
  });

  // --- BACKGROUND REFERENCE CONTROLS ---
  bgUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        bgImage = img;
        imageControls.classList.remove("hidden");
        render();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  removeBgBtn.addEventListener("click", () => {
    bgImage = null;
    bgUpload.value = "";
    imageControls.classList.add("hidden");
    render();
  });

  bgOpacity.addEventListener("input", (e) => {
    bgImageOpacity = parseFloat(e.target.value);
    render();
  });

  clearAllBtn.addEventListener("click", () => {
    curves = [];
    activeCurveId = null;
    updateEquationsUI();
    render();
  });

  // --- NAVIGATION CONTROLS ---
  zoomInBtn.addEventListener("click", () => { scale *= 1.2; render(); });
  zoomOutBtn.addEventListener("click", () => { scale /= 1.2; render(); });
  resetViewBtn.addEventListener("click", () => {
    scale = 45;
    originX = canvas.width / 2;
    originY = canvas.height / 2;
    render();
  });

  window.addEventListener("resize", () => {
    if (!appWorkspace.classList.contains("hidden")) {
      initCanvas();
    }
  });
});