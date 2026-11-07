/**
 * QuoraStrokeManager
 * Dedicated mathematical engine for Bézier spline synthesis, reverse parameter derivation,
 * curve geometry updates, on-curve knot splitting, and concave arrowhead generation.
 */
class QuoraStrokeManager {
  constructor(component) {
    this.component = component;
  }

  beziersToVertices(beziers) {
    if (!beziers || beziers.length === 0) return [];
    const n = beziers.length;
    const vertices = [];

    for (let i = 0; i <= n; i++) {
      const pt = (i < n) ? beziers[i][0].slice(0, 2) : beziers[n - 1][3].slice(0, 2);
      const v = new BezierVertex(pt);

      if (i > 0) {
        v.controlPoints[0] = beziers[i - 1][2].slice(0, 2);
      } else {
        v.controlPoints[0] = pt.slice(0, 2);
      }

      if (i < n) {
        v.controlPoints[1] = beziers[i][1].slice(0, 2);
      } else {
        v.controlPoints[1] = pt.slice(0, 2);
      }

      vertices.push(v);
    }

    // Derive precise curvature, balance, and tangent angle offset from fitted handles
    for (let i = 0; i <= n; i++) {
      const v = vertices[i];
      const prevV = vertices[i - 1];
      const nextV = vertices[i + 1];

      const dPrev = prevV ? Math.hypot(v.point[0] - prevV.point[0], v.point[1] - prevV.point[1]) : 0;
      const dNext = nextV ? Math.hypot(nextV.point[0] - v.point[0], nextV.point[1] - v.point[1]) : 0;

      const lIn = prevV ? Math.hypot(v.controlPoints[0][0] - v.point[0], v.controlPoints[0][1] - v.point[1]) : 0;
      const lOut = nextV ? Math.hypot(v.controlPoints[1][0] - v.point[0], v.controlPoints[1][1] - v.point[1]) : 0;

      const sIn = (dPrev > 1e-4) ? (3 * lIn / dPrev) : 1.0;
      const sOut = (dNext > 1e-4) ? (3 * lOut / dNext) : 1.0;

      if (prevV && nextV) {
        const sumS = sIn + sOut;
        v.curvature = Math.max(0.2, Math.min(3.0, sumS / 2));
        v.balance = sumS > 1e-4 ? Math.max(0.1, Math.min(1.9, (2 * sIn) / sumS)) : 1.0;
      } else if (nextV) {
        v.curvature = Math.max(0.2, Math.min(3.0, sOut));
        v.balance = 1.0;
      } else if (prevV) {
        v.curvature = Math.max(0.2, Math.min(3.0, sIn));
        v.balance = 1.0;
      }

      let actualTangent = null;
      if (nextV && lOut > 1e-4) {
        actualTangent = [(v.controlPoints[1][0] - v.point[0]) / lOut, (v.controlPoints[1][1] - v.point[1]) / lOut];
      } else if (prevV && lIn > 1e-4) {
        actualTangent = [(v.point[0] - v.controlPoints[0][0]) / lIn, (v.point[1] - v.controlPoints[0][1]) / lIn];
      }

      const naturalTangent = (typeof UpdateControlPoints !== 'undefined' && typeof UpdateControlPoints.computeCounterfactualTangent === 'function')
        ? UpdateControlPoints.computeCounterfactualTangent(vertices, i)
        : [1, 0];

      if (actualTangent && naturalTangent) {
        const cross = naturalTangent[0] * actualTangent[1] - naturalTangent[1] * actualTangent[0];
        const dot = naturalTangent[0] * actualTangent[0] + naturalTangent[1] * actualTangent[1];
        let angleDiff = Math.atan2(cross, dot);
        if (Math.abs(angleDiff) < 0.005) angleDiff = 0;
        v.tangentAngleOffset = angleDiff;
      } else {
        v.tangentAngleOffset = 0;
      }
    }

    return vertices;
  }

  verticesToBeziers(vertices) {
    if (!vertices || vertices.length < 2) return [];
    if (typeof UpdateControlPoints !== 'undefined') {
      UpdateControlPoints.run(vertices, 6);
    }

    const beziers = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      beziers.push([
        [vertices[i].point[0], vertices[i].point[1]],
        [vertices[i].controlPoints[1][0], vertices[i].controlPoints[1][1]],
        [vertices[i + 1].controlPoints[0][0], vertices[i + 1].controlPoints[0][1]],
        [vertices[i + 1].point[0], vertices[i + 1].point[1]]
      ]);
    }
    return beziers;
  }

  commitSpline(beziers, color, hasArrow, existingVertices = null) {
    if (!beziers || beziers.length === 0) return;

    let d = 'M ' + beziers[0][0].join(' ');
    for (let i = 0; i < beziers.length; i++) {
      const [start, cp1, cp2, end] = beziers[i];
      d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
    }

    const shadowOffset = 2.0;
    const shadowColor = 'rgba(10, 15, 25, 0.95)';

    const shadowPath = makeElement('svg:path', {
      d, transform: `translate(${shadowOffset}, ${shadowOffset})`,
      stroke: shadowColor, 'stroke-width': '5.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
    });

    const splinePath = makeElement('svg:path', {
      d, stroke: color, 'stroke-width': '3.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
    });

    const vertices = existingVertices || this.beziersToVertices(beziers);

    const curveRecord = {
      id: 'curve_' + Date.now(),
      type: 'curve',
      beziers,
      vertices,
      color,
      arrowEnd: hasArrow ? 'tip' : 'none',
      textEnd: 'tail',
      text: '',
      hasTextBox: this.component.stageState.hasBorder,
      fontFamily: this.component.stageState.fontFamily,
      fontSize: this.component.stageState.fontSize || 22,
      connectEdge: null,
      elements: [shadowPath, splinePath]
    };

    this.component.shadowLayer.appendChild(shadowPath);
    this.component.strokeLayer.appendChild(splinePath);

    if (hasArrow) {
      const p0 = beziers[0][0];
      const p1 = beziers[0][1];
      const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const arrow = this.renderConcaveArrowhead(p0, [(p1[0] - p0[0]) / dist, (p1[1] - p0[1]) / dist], color, 2.0);
      curveRecord._arrowSh = arrow.shadow;
      curveRecord._arrowFg = arrow.foreground;
      this.component.shadowLayer.appendChild(arrow.shadow);
      this.component.strokeLayer.appendChild(arrow.foreground);
    }

    this.component.stageState.annotations.push(curveRecord);
    this.component.stageState.selectedItem = curveRecord;
    this.component.renderStage();
    this.component.updateDynamicKeyInHUD();
  }

  updateCurveGeometry() {
    const curve = this.component.getActiveCurve();
    if (!curve || !curve.vertices || curve.vertices.length < 2) return;

    curve.beziers = this.verticesToBeziers(curve.vertices);

    const [shadowEl, splineEl] = curve.elements;
    let d = 'M ' + curve.beziers[0][0].join(' ');
    for (let i = 0; i < curve.beziers.length; i++) {
      const [start, cp1, cp2, end] = curve.beziers[i];
      d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
    }

    if (curve.isClosed) {
      d += ' Z';
    }

    if (splineEl) splineEl.setAttribute('d', d);
    if (shadowEl) shadowEl.setAttribute('d', d);

    if (curve._arrowFg) { curve._arrowFg.remove(); curve._arrowFg = null; }
    if (curve._arrowSh) { curve._arrowSh.remove(); curve._arrowSh = null; }

    if (!curve.isClosed) {
      if (curve.arrowEnd === 'tip') {
        const p0 = curve.beziers[0][0];
        const p1 = curve.beziers[0][1];
        const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
        const arrow = this.renderConcaveArrowhead(p0, [(p1[0] - p0[0]) / dist, (p1[1] - p0[1]) / dist], curve.color, 2.0);
        curve._arrowSh = arrow.shadow;
        curve._arrowFg = arrow.foreground;
        this.component.shadowLayer.appendChild(arrow.shadow);
        this.component.strokeLayer.appendChild(arrow.foreground);
      } else if (curve.arrowEnd === 'tail') {
        const lastSeg = curve.beziers[curve.beziers.length - 1];
        const p2 = lastSeg[2];
        const p3 = lastSeg[3];
        const dist = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) || 1;
        const arrow = this.renderConcaveArrowhead(p3, [(p2[0] - p3[0]) / dist, (p2[1] - p3[1]) / dist], curve.color, 2.0);
        curve._arrowSh = arrow.shadow;
        curve._arrowFg = arrow.foreground;
        this.component.shadowLayer.appendChild(arrow.shadow);
        this.component.strokeLayer.appendChild(arrow.foreground);
      }
    }

    this.component.renderStage();
  }

  renderConcaveArrowhead(p0, exitTangent, color, shadowOffset = 2.0) {
    const ux = exitTangent[0];
    const uy = exitTangent[1];
    const nx = -uy;
    const ny = ux;

    const barbLen = 18;
    const barbSpread = 11;
    const b1 = [p0[0] + ux * barbLen + nx * barbSpread, p0[1] + uy * barbLen + ny * barbSpread];
    const b2 = [p0[0] + ux * barbLen - nx * barbSpread, p0[1] + uy * barbLen - ny * barbSpread];
    const c1 = [p0[0] + ux * 8 + nx * 2.5, p0[1] + uy * 8 + ny * 2.5];
    const c2 = [p0[0] + ux * 8 - nx * 2.5, p0[1] + uy * 8 - ny * 2.5];

    const arrowD = `M ${b1[0]} ${b1[1]} Q ${c1[0]} ${c1[1]} ${p0[0]} ${p0[1]} M ${p0[0]} ${p0[1]} Q ${c2[0]} ${c2[1]} ${b2[0]} ${b2[1]}`;

    const arrowShadow = makeElement('svg:path', {
      d: arrowD, transform: `translate(${shadowOffset}, ${shadowOffset})`,
      stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5.5', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    const arrowForeground = makeElement('svg:path', {
      d: arrowD, stroke: color, 'stroke-width': '3.2', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    return { shadow: arrowShadow, foreground: arrowForeground };
  }

  swapCurveTerminals(curve) {
    if (!curve || !curve.beziers || curve.beziers.length === 0) return;
    curve.arrowEnd = (curve.arrowEnd === 'tail') ? 'tip' : 'tail';
    curve.textEnd = (curve.arrowEnd === 'tail') ? 'tip' : 'tail';
    this.updateCurveGeometry();
    this.component.showKnotToast(`⇄ Swapped: Arrow is now at ${curve.arrowEnd.toUpperCase()}`);
  }

  addKnotOnCurve(curve, targetIdx) {
    if (!curve || !curve.vertices || curve.vertices.length < 2) return;
    const idx = Math.max(0, Math.min(targetIdx || 0, curve.vertices.length - 2));
    const seg = curve.beziers?.[idx];

    const midPt = seg
      ? CurveFitter.bezier_q(seg, 0.5)
      : [(curve.vertices[idx].point[0] + curve.vertices[idx + 1].point[0]) / 2, (curve.vertices[idx].point[1] + curve.vertices[idx + 1].point[1]) / 2];

    const newKnot = new BezierVertex([midPt[0], midPt[1]]);
    newKnot.curvature = 1.0;
    newKnot.balance = 1.0;
    newKnot.tangentAngleOffset = 0;

    curve.vertices.splice(idx + 1, 0, newKnot);
    this.component._activeKnotIdx = idx + 1;
    this.updateCurveGeometry();
    this.component.exposeBezierHandles(curve);
    this.component.showKnotToast(`✓ Point inserted on curve at #${idx + 2}`);
  }
}

globalThis.QuoraStrokeManager = QuoraStrokeManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraStrokeManager;