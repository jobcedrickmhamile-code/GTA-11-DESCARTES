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

  // Palette when Hovered/Selected
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
  let activeCurveId = null; 
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

    // 2. Render Cartesian Grid
    drawGrid();

    // 3. Render Curves from Equations
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

    // Axes
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

    // Numbers
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
    
    ctx.strokeStyle = isHighlighted ? curve.highlightColor : "#000000";
    ctx.lineWidth = isHighlighted ? 4 : 2.5;

    ctx.beginPath();

    if (curve.type === "vertical_line") {
      const p1 = mathToScreen(curve.xVal, curve.domain.min);
      const p2 = mathToScreen(curve.xVal, curve.domain.max);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    } 
    else if (curve.type === "line" || curve.type === "parabola") {
      const startX = curve.domain.min;
      const endX = curve.domain.max;
      const step = (endX - startX) / 100 || 0.01;

      let started = false;
      for (let x = startX; x <= endX + (step/2); x += step) {
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
      for (let t = 0; t <= 1.001; t += 0.01) {
        const x = curve.ax * t * t + curve.bx * t + curve.cx;
        const y = curve.ay * t * t + curve.by * t + curve.cy;
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

  // --- ACCURATE MATHEMATICAL FITTING ALGORITHMS ---
  function processStroke(pts) {
    if (pts.length < 3) return;

    const chosenHighlightColor = highlightColors[colorIndex % highlightColors.length];
    colorIndex++;

    const xCoords = pts.map(p => p.x);
    const yCoords = pts.map(p => p.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    // 1. Vertical Line Detection
    if (Math.abs(maxX - minX) < 0.15) {
      const avgX = (minX + maxX) / 2;
      curves.push({
        id: Date.now(),
        type: "vertical_line",
        highlightColor: chosenHighlightColor,
        xVal: avgX,
        domain: { min: minY, max: maxY },
        equationText: `x = ${avgX.toFixed(2)}  {${minY.toFixed(1)} ≤ y ≤ ${maxY.toFixed(1)}}`
      });
      updateEquationsUI();
      return;
    }

    // 2. Linear Regression (y = mx + b)
    const lineFit = fitLine(pts);
    if (lineFit.rSquared > 0.94) {
      curves.push({
        id: Date.now(),
        type: "line",
        highlightColor: chosenHighlightColor,
        m: lineFit.m,
        b: lineFit.b,
        domain: { min: minX, max: maxX },
        equationText: `y = ${lineFit.m.toFixed(2)}x ${lineFit.b >= 0 ? '+' : '-'} ${Math.abs(lineFit.b).toFixed(2)}  {${minX.toFixed(1)} ≤ x ≤ ${maxX.toFixed(1)}}`
      });
      updateEquationsUI();
      return;
    }

    // 3. Parabolic Quadratic Least-Squares Fit (y = ax² + bx + c)
    const quadFit = fitParabola(pts);
    if (quadFit && quadFit.rSquared > 0.88) {
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
        equationText: `y = ${quadFit.a.toFixed(2)}x² ${signB} ${Math.abs(quadFit.b).toFixed(2)}x ${signC} ${Math.abs(quadFit.c).toFixed(2)}  {${minX.toFixed(1)} ≤ x ≤ ${maxX.toFixed(1)}}`
      });
      updateEquationsUI();
      return;
    }

    // 4. Parametric Quadratic Fitting (x(t), y(t) for freehand curves, vertical loops, etc.)
    const paramFit = fitParametric(pts);
    curves.push({
      id: Date.now(),
      type: "parametric",
      highlightColor: chosenHighlightColor,
      ax: paramFit.ax, bx: paramFit.bx, cx: paramFit.cx,
      ay: paramFit.ay, by: paramFit.by, cy: paramFit.cy,
      equationText: `( ${paramFit.ax.toFixed(2)}t²${paramFit.bx>=0?'+':''}${paramFit.bx.toFixed(2)}t${paramFit.cx>=0?'+':''}${paramFit.cx.toFixed(2)} , ${paramFit.ay.toFixed(2)}t²${paramFit.by>=0?'+':''}${paramFit.by.toFixed(2)}t${paramFit.cy>=0?'+':''}${paramFit.cy.toFixed(2)} )`
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
    const denom = (n * sumXX - sumX * sumX);
    if (Math.abs(denom) < 1e-5) return { m: 0, b: 0, rSquared: 0 };

    const m = (n * sumXY - sumX * sumY) / denom;
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

    // Solve 3x3 System using Matrix Determinants
    const M = [
      [sX4, sX3, sX2],
      [sX3, sX2, sX],
      [sX2, sX,  n]
    ];
    const V = [sX2Y, sXY, sY];

    function det3(m) {
      return m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1])
           - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0])
           + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
    }

    const D = det3(M);
    if (Math.abs(D) < 1e-5) return null;

    const Da = det3([[V[0], M[0][1], M[0][2]], [V[1], M[1][1], M[1][2]], [V[2], M[2][1], M[2][2]]]);
    const Db = det3([[M[0][0], V[0], M[0][2]], [M[1][0], V[1], M[1][2]], [M[2][0], V[2], M[2][2]]]);
    const Dc = det3([[M[0][0], M[0][1], V[0]], [M[1][0], M[1][1], V[1]], [M[2][0], M[2][1], V[2]]]);

    const a = Da / D;
    const b = Db / D;
    const c = Dc / D;

    let ssTot = 0, ssRes = 0;
    const meanY = sY / n;
    for (let p of pts) {
      const predY = a * p.x * p.x + b * p.x + c;
      ssTot += Math.pow(p.y - meanY, 2);
      ssRes += Math.pow(p.y - predY, 2);
    }
    return { a, b, c, rSquared: 1 - (ssRes / (ssTot || 1)) };
  }

  function fitParametric(pts) {
    const n = pts.length;
    let sT = 0, sX = 0, sY = 0, sT2 = 0, sT3 = 0, sT4 = 0, sTX = 0, sT2X = 0, sTY = 0, sT2Y = 0;

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = pts[i].x;
      const y = pts[i].y;
      const t2 = t * t;

      sT += t; sT2 += t2; sT3 += t2 * t; sT4 += t2 * t2;
      sX += x; sTX += t * x; sT2X += t2 * x;
      sY += y; sTY += t * y; sT2Y += t2 * y;
    }

    function solveQuadSystem(vX) {
      const M = [
        [sT4, sT3, sT2],
        [sT3, sT2, sT],
        [sT2, sT,  n]
      ];
      function det3(m) {
        return m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1])
             - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0])
             + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
      }
      const D = det3(M);
      const Da = det3([[vX[0], M[0][1], M[0][2]], [vX[1], M[1][1], M[1][2]], [vX[2], M[2][1], M[2][2]]]);
      const Db = det3([[M[0][0], vX[0], M[0][2]], [M[1][0], vX[1], M[1][2]], [M[2][0], vX[2], M[2][2]]]);
      const Dc = det3([[M[0][0], M[0][1], vX[0]], [M[1][0], M[1][1], vX[1]], [M[2][0], M[2][1], vX[2]]]);

      return { a: Da / D, b: Db / D, c: Dc / D };
    }

    const fitX = solveQuadSystem([sT2X, sTX, sX]);
    const fitY = solveQuadSystem([sT2Y, sTY, sY]);

    return {
      ax: fitX.a, bx: fitX.b, cx: fitX.c,
      ay: fitY.a, by: fitY.b, cy: fitY.c
    };
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
