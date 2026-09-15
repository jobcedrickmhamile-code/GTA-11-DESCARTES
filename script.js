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
const highlightColors = [
"#187a3d", "#2563eb", "#d97706", "#9333ea", "#dc2626", "#0891b2"
];
let colorIndex = 0;
let scale = 45;
let originX = 0;
let originY = 0;
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
if (bgImage) {
ctx.save();
ctx.globalAlpha = bgImageOpacity;
const imgW = bgImage.width;
const imgH = bgImage.height;
ctx.drawImage(bgImage, originX - imgW / 2, originY - imgH / 2, imgW, imgH);
ctx.restore();
}
drawGrid();
curves.forEach(curve => drawCurve(curve));
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
ctx.strokeStyle = "#0f172a";
ctx.lineWidth = 1.8;
ctx.beginPath();
ctx.moveTo(originX, 0);
ctx.lineTo(originX, canvas.height);
ctx.moveTo(0, originY);
ctx.lineTo(canvas.width, originY);
ctx.stroke();
ctx.fillStyle = "#64748b";
ctx.font = "11px 'Fira Code', monospace";
for (let x = startX; x <= rightMath; x += gridStep) {
if (Math.abs(x) < 0.001) continue;
const pt = mathToScreen(x, 0);
ctx.fillText(formatNumber(x, 1), pt.x - 6, originY + 16);
}
for (let y = startY; y <= topMath; y += gridStep) {
if (Math.abs(y) < 0.001) continue;
const pt = mathToScreen(0, y);
ctx.fillText(formatNumber(y, 1), originX + 8, pt.y + 4);
}
}
// --- CURVE RENDERING ---
function drawCurve(curve) {
const isHighlighted = curve.id === activeCurveId;
ctx.strokeStyle = isHighlighted ? curve.highlightColor : "#000000";
ctx.lineWidth = isHighlighted ? 4 : 2.5;
ctx.beginPath();
if (curve.type === "vertical_line") {
const p1 = mathToScreen(curve.xVal, curve.domain.min);
const p2 = mathToScreen(curve.xVal, curve.domain.max);
ctx.moveTo(p1.x, p1.y);
ctx.lineTo(p2.x, p2.y);
} else if (curve.type === "line" || curve.type === "parabola") {
const startX = curve.domain.min;
const endX = curve.domain.max;
const step = (endX - startX) / 120 || 0.01;
let started = false;
for (let x = startX; x <= endX + step / 2; x += step) {
const y = curve.type === "line"
? curve.m * x + curve.b
: curve.a * x * x + curve.b * x + curve.c;
const pt = mathToScreen(x, y);
if (!started) {
ctx.moveTo(pt.x, pt.y);
started = true;
} else {
ctx.lineTo(pt.x, pt.y);
}
}
} else if (curve.type === "circle") {
const steps = 180;
for (let i = 0; i <= steps; i++) {
const t = (i / steps) * Math.PI * 2;
const x = curve.h + curve.r * Math.cos(t);
const y = curve.k + curve.r * Math.sin(t);
const pt = mathToScreen(x, y);
if (i === 0) ctx.moveTo(pt.x, pt.y);
else ctx.lineTo(pt.x, pt.y);
}
} else if (curve.type === "cubic_bezier") {
curve.segments.forEach((seg, index) => {
const steps = 50;
for (let i = 0; i <= steps; i++) {
const t = i / steps;
const mt = 1 - t;
const x =
mt * mt * mt * seg.p0.x +
3 * mt * mt * t * seg.p1.x +
3 * mt * t * t * seg.p2.x +
t * t * t * seg.p3.x;
const y =
mt * mt * mt * seg.p0.y +
3 * mt * mt * t * seg.p1.y +
3 * mt * t * t * seg.p2.y +
t * t * t * seg.p3.y;
const pt = mathToScreen(x, y);
if (index === 0 && i === 0) ctx.moveTo(pt.x, pt.y);
else ctx.lineTo(pt.x, pt.y);
}
});
}
ctx.stroke();
}
// --- DRAWING EVENTS ---
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
canvas.addEventListener("mouseup", finishStroke);
canvas.addEventListener("mouseleave", () => {
if (isDrawing) finishStroke();
});
function finishStroke() {
if (!isDrawing) return;
isDrawing = false;
if (currentStroke.length >= 3) {
processStroke(currentStroke);
}
currentStroke = [];
render();
}
function addPoint(e) {
const rect = canvas.getBoundingClientRect();
const px = e.clientX - rect.left;
const py = e.clientY - rect.top;
const mathPt = screenToMath(px, py);
// Ignore extremely small mouse movements to reduce jitter.
const last = currentStroke[currentStroke.length - 1];
if (last && Math.hypot(px - last.px, py - last.py) < 2) return;
currentStroke.push({ px, py, x: mathPt.x, y: mathPt.y });
}
// ============================================================
// MATHEMATICAL RECOGNITION
// ============================================================
//
// Priority:
// 1. Vertical line
// 2. Linear function y = mx + b
// 3. Quadratic function y = ax² + bx + c
// 4. Circle (x-h)² + (y-k)² = r²
// 5. Cubic Bézier fallback for genuinely free-form strokes
//
// The fallback is NOT displayed as "f(t) = bezier(a,b,c)".
// It stores actual 2D control points, so the equation corresponds
// to the curve that is rendered.
function processStroke(rawPts) {
const pts = simplifyPoints(rawPts);
if (pts.length < 3) return;
const chosenHighlightColor =
highlightColors[colorIndex % highlightColors.length];
colorIndex++;
const xCoords = pts.map(p => p.x);
const yCoords = pts.map(p => p.y);
const minX = Math.min(...xCoords);
const maxX = Math.max(...xCoords);
const minY = Math.min(...yCoords);
const maxY = Math.max(...yCoords);
const width = maxX - minX;
const height = maxY - minY;
const diagonal = Math.hypot(width, height) || 1;
// 1. Vertical line
if (width <= Math.max(0.08, diagonal * 0.012)) {
const avgX = xCoords.reduce((a, b) => a + b, 0) / xCoords.length;
curves.push({
id: Date.now() + Math.random(),
type: "vertical_line",
highlightColor: chosenHighlightColor,
xVal: avgX,
domain: { min: minY, max: maxY },
equationText:
`x = ${formatNumber(avgX)} ` +
`{${formatNumber(minY, 1)} ≤ y ≤ ${formatNumber(maxY, 1)}}`
});
updateEquationsUI();
return;
}
// 2. Straight line
const lineFit = fitLine(pts);
if (lineFit && isGoodLineFit(lineFit, diagonal)) {
curves.push({
id: Date.now() + Math.random(),
type: "line",
highlightColor: chosenHighlightColor,
m: lineFit.m,
b: lineFit.b,
domain: { min: minX, max: maxX },
equationText:
`y = ${formatSignedTerm(lineFit.m, "x")} ` +
`${formatSignedConstant(lineFit.b)} ` +
`{${formatNumber(minX, 1)} ≤ x ≤ ${formatNumber(maxX, 1)}}`
});
updateEquationsUI();
return;
}
// 3. Quadratic/parabola
const quadFit = fitParabola(pts);
if (quadFit && isGoodParabolaFit(quadFit, diagonal, width)) {
curves.push({
id: Date.now() + Math.random(),
type: "parabola",
highlightColor: chosenHighlightColor,
a: quadFit.a,
b: quadFit.b,
c: quadFit.c,
domain: { min: minX, max: maxX },
equationText:
`y = ${formatNumber(quadFit.a)}x² ` +
`${formatSignedTerm(quadFit.b, "x")} ` +
`${formatSignedConstant(quadFit.c)} ` +
`{${formatNumber(minX, 1)} ≤ x ≤ ${formatNumber(maxX, 1)}}`
});
updateEquationsUI();
return;
}
// 4. Circle
const circleFit = fitCircle(pts);
if (circleFit && circleFit.normalizedError < 0.045) {
curves.push({
id: Date.now() + Math.random(),
type: "circle",
highlightColor: chosenHighlightColor,
h: circleFit.h,
k: circleFit.k,
r: circleFit.r,
equationText:
`(x ${signedShift(circleFit.h)})² + ` +
`(y ${signedShift(circleFit.k)})² = ` +
`${formatNumber(circleFit.r * circleFit.r)}`
});
updateEquationsUI();
return;
}
// 5. General freehand curve: piecewise cubic Bézier.
// This is used only when the stroke is not well described by
// a standard Cartesian function.
const segments = fitPiecewiseBezier(pts);
curves.push({
id: Date.now() + Math.random(),
type: "cubic_bezier",
highlightColor: chosenHighlightColor,
segments,
equationText: buildBezierEquationText(segments)
});
updateEquationsUI();
}
// --- POINT CLEANUP ---
function simplifyPoints(pts) {
if (pts.length <= 8) return pts.slice();
const result = [pts[0]];
for (let i = 1; i < pts.length - 1; i++) {
const prev = result[result.length - 1];
const p = pts[i];
// Keep enough points to preserve shape while removing jitter.
const distance = Math.hypot(p.x - prev.x, p.y - prev.y);
if (distance >= 0.035) {
result.push(p);
}
}
result.push(pts[pts.length - 1]);
// Avoid an excessively large regression workload.
if (result.length > 160) {
const sampled = [];
for (let i = 0; i < 160; i++) {
const index = Math.round(i * (result.length - 1) / 159);
sampled.push(result[index]);
}
return sampled;
}
return result;
}
// --- LINE FIT ---
function fitLine(pts) {
const n = pts.length;
let sumX = 0;
let sumY = 0;
let sumXY = 0;
let sumXX = 0;
for (const p of pts) {
sumX += p.x;
sumY += p.y;
sumXY += p.x * p.y;
sumXX += p.x * p.x;
}
const denom = n * sumXX - sumX * sumX;
if (Math.abs(denom) < 1e-10) return null;
const m = (n * sumXY - sumX * sumY) / denom;
const b = (sumY - m * sumX) / n;
let ssTot = 0;
let ssRes = 0;
const meanY = sumY / n;
let maxResidual = 0;
for (const p of pts) {
const predicted = m * p.x + b;
const residual = Math.abs(p.y - predicted);
maxResidual = Math.max(maxResidual, residual);
ssTot += (p.y - meanY) ** 2;
ssRes += (p.y - predicted) ** 2;
}
const rSquared = 1 - ssRes / (ssTot || 1);
return { m, b, rSquared, maxResidual };
}
function isGoodLineFit(fit, diagonal) {
const allowedError = Math.max(0.12, diagonal * 0.035);
return fit.rSquared >= 0.985 && fit.maxResidual <= allowedError;
}
// --- PARABOLA FIT ---
function fitParabola(pts) {
const n = pts.length;
let sX = 0, sY = 0;
let sX2 = 0, sX3 = 0, sX4 = 0;
let sXY = 0, sX2Y = 0;
for (const p of pts) {
const x = p.x;
const y = p.y;
const x2 = x * x;
sX += x;
sY += y;
sX2 += x2;
sX3 += x2 * x;
sX4 += x2 * x2;
sXY += x * y;
sX2Y += x2 * y;
}
const M = [
[sX4, sX3, sX2],
[sX3, sX2, sX],
[sX2, sX, n]
];
const V = [sX2Y, sXY, sY];
const solution = solve3x3(M, V);
if (!solution) return null;
const [a, b, c] = solution;
let ssTot = 0;
let ssRes = 0;
let maxResidual = 0;
const meanY = sY / n;
for (const p of pts) {
const predicted = a * p.x * p.x + b * p.x + c;
const residual = Math.abs(p.y - predicted);
maxResidual = Math.max(maxResidual, residual);
ssTot += (p.y - meanY) ** 2;
ssRes += (p.y - predicted) ** 2;
}
const rSquared = 1 - ssRes / (ssTot || 1);
return { a, b, c, rSquared, maxResidual };
}
function isGoodParabolaFit(fit, diagonal, width) {
if (width < 0.5) return false;
const allowedError = Math.max(0.16, diagonal * 0.045);
// Require a substantially better fit than a loose approximation.
return fit.rSquared >= 0.965 && fit.maxResidual <= allowedError;
}
// --- CIRCLE FIT ---
// Algebraic least-squares circle:
// x² + y² + Dx + Ey + F = 0
// center = (-D/2, -E/2)
function fitCircle(pts) {
if (pts.length < 8) return null;
let sx = 0, sy = 0;
let sxx = 0, syy = 0;
let sxy = 0;
let sxz = 0, syz = 0;
let sz = 0;
for (const p of pts) {
const x = p.x;
const y = p.y;
const z = x * x + y * y;
sx += x;
sy += y;
sxx += x * x;
syy += y * y;
sxy += x * y;
sxz += x * z;
syz += y * z;
sz += z;
}
const M = [
[sxx, sxy, sx],
[sxy, syy, sy],
[sx, sy, pts.length]
];
const V = [-sxz, -syz, -sz];
const solution = solve3x3(M, V);
if (!solution) return null;
const [D, E, F] = solution;
const h = -D / 2;
const k = -E / 2;
const radiusSquared = h * h + k * k - F;
if (radiusSquared <= 0) return null;
const r = Math.sqrt(radiusSquared);
let errorSum = 0;
let maxError = 0;
for (const p of pts) {
const distance = Math.hypot(p.x - h, p.y - k);
const error = Math.abs(distance - r);
errorSum += error * error;
maxError = Math.max(maxError, error);
}
const rmse = Math.sqrt(errorSum / pts.length);
const normalizedError = rmse / Math.max(r, 0.001);
// A circle should have enough vertical and horizontal spread.
const xs = pts.map(p => p.x);
const ys = pts.map(p => p.y);
const width = Math.max(...xs) - Math.min(...xs);
const height = Math.max(...ys) - Math.min(...ys);
if (Math.min(width, height) < Math.max(0.5, r * 0.35)) {
return null;
}
return { h, k, r, rmse, maxError, normalizedError };
}
// --- 3x3 LINEAR SOLVER ---
function solve3x3(A, b) {
const m = A.map((row, i) => [...row, b[i]]);
for (let col = 0; col < 3; col++) {
let pivot = col;
for (let row = col + 1; row < 3; row++) {
if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
pivot = row;
}
}
if (Math.abs(m[pivot][col]) < 1e-12) return null;
[m[col], m[pivot]] = [m[pivot], m[col]];
for (let row = col + 1; row < 3; row++) {
const factor = m[row][col] / m[col][col];
for (let j = col; j < 4; j++) {
m[row][j] -= factor * m[col][j];
}
}
}
const x = [0, 0, 0];
for (let row = 2; row >= 0; row--) {
let sum = m[row][3];
for (let col = row + 1; col < 3; col++) {
sum -= m[row][col] * x[col];
}
x[row] = sum / m[row][row];
}
return x;
}
// ============================================================
// PIECEWISE CUBIC BÉZIER
// ============================================================
// This is the fallback for shapes such as rocket outlines.
// Instead of pretending the whole stroke is one quadratic,
// the stroke is split into a small number of cubic segments.
//
// Each segment is based on Catmull-Rom-style tangent control
// points, which follows the actual drawn points closely.
function fitPiecewiseBezier(pts) {
if (pts.length < 4) {
return [fallbackBezier(pts)];
}
const count = Math.max(
1,
Math.min(8, Math.ceil(pts.length / 24))
);
const segments = [];
const step = (pts.length - 1) / count;
for (let s = 0; s < count; s++) {
const startIndex = Math.floor(s * step);
const endIndex = Math.max(
startIndex + 1,
Math.floor((s + 1) * step)
);
const i0 = Math.max(0, startIndex - 1);
const i1 = startIndex;
const i2 = Math.min(pts.length - 1, endIndex);
const i3 = Math.min(pts.length - 1, endIndex + 1);
const p0 = pts[i0];
const p1 = pts[i1];
const p2 = pts[i2];
const p3 = pts[i3];
segments.push({
p0: { x: p1.x, y: p1.y },
p1: {
x: p1.x + (p2.x - p0.x) / 6,
y: p1.y + (p2.y - p0.y) / 6
},
p2: {
x: p2.x - (p3.x - p1.x) / 6,
y: p2.y - (p3.y - p1.y) / 6
},
p3: { x: p2.x, y: p2.y }
});
}
return segments;
}
function fallbackBezier(pts) {
const a = pts[0];
const b = pts[pts.length - 1];
const p1 = pts[Math.floor(pts.length / 3)] || a;
const p2 = pts[Math.floor(2 * pts.length / 3)] || b;
return {
p0: { x: a.x, y: a.y },
p1: { x: p1.x, y: p1.y },
p2: { x: p2.x, y: p2.y },
p3: { x: b.x, y: b.y }
};
}
// --- EQUATION FORMATTING ---
function formatNumber(value, decimals = 2) {
if (!Number.isFinite(value)) return "0";
const rounded = Math.abs(value) < 0.005
? 0
: Number(value.toFixed(decimals));
return String(rounded);
}
function formatSignedTerm(value, variable) {
const sign = value >= 0 ? "+" : "-";
return `${sign} ${formatNumber(Math.abs(value))}${variable}`;
}
function formatSignedConstant(value) {
const sign = value >= 0 ? "+" : "-";
return `${sign} ${formatNumber(Math.abs(value))}`;
}
function signedShift(value) {
// x - h, so h positive means "- h"; h negative means "+ |h|".
return value >= 0
? `- ${formatNumber(Math.abs(value))}`
: `+ ${formatNumber(Math.abs(value))}`;
}
function pointText(p) {
return `(${formatNumber(p.x)}, ${formatNumber(p.y)})`;
}
function buildBezierEquationText(segments) {
const base =
`B(t) = (1−t)³P■ + 3(1−t)²tP■ + ` +
`3(1−t)t²P■ + t³P■`;
if (segments.length === 1) {
const s = segments[0];
return (
`${base}, 0 ≤ t ≤ 1; ` +
`P■=${pointText(s.p0)}, P■=${pointText(s.p1)}, ` +
`P■=${pointText(s.p2)}, P■=${pointText(s.p3)}`
);
}
return (
`Piecewise cubic Bézier (${segments.length} segments): ` +
segments.map((s, i) =>
`B${i + 1}: P■=${pointText(s.p0)}, ` +
`P■=${pointText(s.p1)}, P■=${pointText(s.p2)}, ` +
`P■=${pointText(s.p3)}`
).join(" | ")
);
}
// --- UI DRAWER ---
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
const dotColor =
curve.id === activeCurveId ? curve.highlightColor : "#000000";
card.innerHTML = `
<div class="color-dot" style="background-color: ${dotColor};"></div>
<div class="math-text">${escapeHtml(curve.equationText)}</div>
<div class="card-actions">
<button class="action-btn copy" title="Copy Text">
<i class="fa-regular fa-copy"></i>
</button>
<button class="action-btn delete" title="Delete Graph">
<i class="fa-solid fa-xmark"></i>
</button>
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
function escapeHtml(text) {
return String(text)
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
// --- EXPORT & COPY ALL ---
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
zoomInBtn.addEventListener("click", () => {
scale *= 1.2;
render();
});
zoomOutBtn.addEventListener("click", () => {
scale /= 1.2;
render();
});
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
