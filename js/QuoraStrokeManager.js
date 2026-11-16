/**
 * QuoraStrokeManager
 * Dedicated mathematical engine for Bézier spline synthesis, reverse parameter derivation,
 * curve geometry updates, on-curve knot splitting, and concave arrowhead generation.
 */
class QuoraStrokeManager {
  constructor(component) {
    this.component = component;
  }

  beziersToVertices(beziers, cuspVertexIndices = []) {
      return StudioGeometry.beziersToVertices(beziers, cuspVertexIndices);
    }
  verticesToBeziers(vertices) {
      return StudioGeometry.verticesToBeziers(vertices);
    }

  commitSpline(beziers, color, hasArrow, existingVertices = null, cuspVertexIndices = []) {
      if (!beziers || beziers.length === 0) return;

      const comp = this.component;
      const st = comp.stageState;
      const p = st.prefs || {};
      const lineStyle = st.lineStyle || p.lineStyle || 'classic';
      const baseW = st.curveStrokeWidth || p.curveStrokeWidth || 3.2;
      const d = StudioGeometry.beziersToSvgD(beziers, false);

      const shadowPath = makeElement('svg:path', {
        transform: 'translate(2, 2)',
        stroke: 'rgba(10, 15, 25, 0.95)',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none'
      });
      const glowPath = makeElement('svg:path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none'
      });
      const splineGroup = makeElement('svg:g', { className: 'qa-spline-group' });

      const vertices = existingVertices || this.beziersToVertices(beziers, cuspVertexIndices);
      const arrowMode = hasArrow ? (st.arrowMode || 'tip') : 'none';
      const arrowStyle = st.arrowStyle || p.arrowStyle || 'concave';

      const curveRecord = {
        id: 'curve_' + Date.now(),
        type: 'curve',
        beziers,
        vertices,
        color,
        strokeWidth: baseW,
        lineStyle,
        arrowEnd: arrowMode,
        arrowStyle,
        textEnd: arrowMode === 'tail' ? 'tip' : 'tail',
        text: '',
        hasTextBox: st.hasBorder,
        boxStyle: st.boxStyle || p.boxStyle || 'bracket',
        fontFamily: st.fontFamily || p.fontFamily,
        fontSize: st.fontSize || p.fontSize || 20,
        connectEdge: null,
        elements: [shadowPath, splineGroup, glowPath]
      };

      comp.shadowLayer.appendChild(shadowPath);
      comp.glowLayer.appendChild(glowPath);
      comp.strokeLayer.appendChild(splineGroup);

      this._applySplineVisuals(curveRecord, d, baseW, lineStyle);
      this._syncArrowheads(curveRecord, baseW, lineStyle);

      st.annotations.push(curveRecord);
      comp.selectItem(curveRecord);
      comp.updateDynamicKeyInHUD();
    }
  updateCurveGeometry() {
    const comp = this.component;
    const curve = comp.getActiveCurve();
    if (!curve || !curve.vertices || curve.vertices.length < 2) return;

    curve.beziers = this.verticesToBeziers(curve.vertices);
    const d = StudioGeometry.beziersToSvgD(curve.beziers, !!curve.isClosed);
    const lineStyle = curve.lineStyle || 'classic';
    const baseW = curve.strokeWidth || comp.stageState.curveStrokeWidth || 3.2;

    this._applySplineVisuals(curve, d, baseW, lineStyle);
    this._syncArrowheads(curve, baseW, lineStyle);
    comp.renderStage();
  }

  renderConcaveArrowhead(p0, exitTangent, color, shadowOffset = 2.0, strokeWidth = 3.2, lineStyle = 'classic', arrowStyle = 'concave') {
      const st = this.component.stageState;
      const p = st.prefs || {};
      const z = st.cadStrokeMode ? (st.zoom || 1.0) : 1.0;
      const glowOp = p.curveGlowOpacity !== undefined ? p.curveGlowOpacity : 0.90;
      const geo = StudioGeometry.computeTerminalMarker(p0, exitTangent, strokeWidth, z, arrowStyle);

      let arrowShadow = null;
      let arrowGlow = null;
      let arrowForeground = null;

      if (geo.kind === 'circle') {
        if (lineStyle === 'classic') {
          arrowShadow = makeElement('svg:circle', {
            cx: String(geo.cx), cy: String(geo.cy), r: String(geo.r + 0.8 / z),
            transform: `translate(${shadowOffset}, ${shadowOffset})`,
            fill: 'rgba(10, 15, 25, 0.95)', stroke: 'none'
          });
          arrowForeground = makeElement('svg:circle', {
            cx: String(geo.cx), cy: String(geo.cy), r: String(geo.r),
            fill: color, stroke: 'none', 'data-base-r': String(geo.r * Math.sqrt(z))
          });
        } else {
          const coreTint = this.getLuminousCoreColor(color);
          arrowGlow = makeElement('svg:circle', {
            cx: String(geo.cx), cy: String(geo.cy), r: String(geo.r + 2.5 / z),
            fill: color, stroke: 'none', 'data-base-r': String((geo.r + 2.5 / z) * Math.sqrt(z)),
            style: { filter: 'url(#qa-neon-glow)', opacity: String(glowOp) }
          });
          arrowForeground = makeElement('svg:circle', {
            cx: String(geo.cx), cy: String(geo.cy), r: String(geo.r),
            fill: coreTint, stroke: 'none', 'data-base-r': String(geo.r * Math.sqrt(z)),
            style: { filter: 'url(#qa-neon-core)' }
          });
        }
        return { shadow: arrowShadow, foreground: arrowForeground, glow: arrowGlow };
      }

      if (lineStyle === 'classic') {
        arrowShadow = makeElement('svg:path', {
          d: geo.d, transform: `translate(${shadowOffset}, ${shadowOffset})`,
          stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(geo.shadowWidth), fill: 'none',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        });
        arrowForeground = makeElement('svg:path', {
          d: geo.d, stroke: color, 'stroke-width': String(geo.effectiveWidth), fill: 'none',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        });
      } else if (lineStyle === 'neon') {
        const coreTint = this.getLuminousCoreColor(color);
        arrowGlow = makeElement('svg:path', {
          d: geo.d, stroke: color, 'stroke-width': String(geo.glowWidth), fill: 'none',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: { filter: 'url(#qa-neon-glow)', opacity: String(glowOp) }
        });
        arrowForeground = makeElement('svg:path', {
          d: geo.d, stroke: coreTint, 'stroke-width': String(geo.coreWidth), fill: 'none',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: { filter: 'url(#qa-neon-core)' }
        });
      }

      return { shadow: arrowShadow, foreground: arrowForeground, glow: arrowGlow };
    }
  swapCurveTerminals(curve) {
      if (!curve || !curve.beziers || curve.beziers.length === 0) return;

      if (curve.arrowEnd === 'tip' || curve.arrowEnd === 'tail') {
        curve.arrowEnd = (curve.arrowEnd === 'tail') ? 'tip' : 'tail';
        curve.textEnd = (curve.arrowEnd === 'tail') ? 'tip' : 'tail';
      } else {
        curve.textEnd = (curve.textEnd === 'tip') ? 'tail' : 'tip';
      }

      if (this.component.stageState.selectedItem === curve && this.component.arrowModeBtns) {
        this.component.stageState.arrowMode = curve.arrowEnd;
        Object.entries(this.component.arrowModeBtns).forEach(([k, b]) => b.classList.toggle('primary', k === curve.arrowEnd));
      }

      this.updateCurveGeometry();
      this.component.exposeBezierHandles(curve);
      this.component.showKnotToast(`⇄ Flipped: Text at ${curve.textEnd.toUpperCase()}`);
    }
  addKnotOnCurve(curve, targetIdx, t = 0.5) {
      if (!curve || !curve.vertices || curve.vertices.length < 2) return;
      const idx = Math.max(0, Math.min(targetIdx || 0, curve.vertices.length - 2));
      const seg = curve.beziers?.[idx];

      if (seg && seg.length === 4) {
        const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
        const p0 = seg[0], p1 = seg[1], p2 = seg[2], p3 = seg[3];
        const p01 = lerp(p0, p1, t);
        const p12 = lerp(p1, p2, t);
        const p23 = lerp(p2, p3, t);
        const p012 = lerp(p01, p12, t);
        const p123 = lerp(p12, p23, t);
        const midPt = lerp(p012, p123, t);

        const leftSeg = [p0.slice(), p01, p012, midPt.slice()];
        const rightSeg = [midPt.slice(), p123, p23, p3.slice()];

        const prevFlags = curve.vertices.map(v => ({
          isExplicit: Boolean(v.isExplicitTangent),
          offset: v.tangentAngleOffset || 0,
          isCusp: Boolean(v.isCusp)
        }));
        prevFlags.splice(idx + 1, 0, { isExplicit: false, offset: 0, isCusp: false });

        curve.beziers.splice(idx, 1, leftSeg, rightSeg);
        const newVerts = this.beziersToVertices(curve.beziers);

        newVerts.forEach((nv, k) => {
          const f = prevFlags[k];
          if (f) {
            nv.isCusp = f.isCusp;
            if (f.isExplicit) {
              nv.isExplicitTangent = true;
              nv.tangentAngleOffset = f.offset;
            }
          }
        });

        curve.vertices = newVerts;
      } else {
        const pA = curve.vertices[idx].point;
        const pB = curve.vertices[idx + 1].point;
        const newKnot = new BezierVertex([(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2]);
        curve.vertices.splice(idx + 1, 0, newKnot);
      }

      this.component._activeKnotIdx = idx + 1;
      this.updateCurveGeometry();
      this.component.exposeBezierHandles(curve);
      this.component.showKnotToast(`✓ Point inserted on curve at #${idx + 2}`);
    }

  getLuminousCoreColor(colorStr) {
      const sat = this.component.stageState?.prefs?.textCoreSaturation ?? 0.40;
      return StudioGeometry.getLuminousCoreColor(colorStr, sat);
    }

  applyCadZoomCompensation(zoomLevel = 1.0) {
      const z = Math.max(0.1, zoomLevel || 1.0);
      const annotations = this.component.stageState.annotations || [];
      const p = this.component.stageState.prefs || {};
      const glowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10;

      annotations.forEach(ann => {
        if (ann.type === 'curve' && ann.elements) {
          const [shadowEl, splineGroup, glowPath] = ann.elements;
          const baseW = ann.strokeWidth || 3.2;
          const compW = baseW / z;
          const lineStyle = ann.lineStyle || 'classic';

          if (shadowEl) shadowEl.setAttribute('stroke-width', String((baseW + 2.3) / z));
          if (glowPath) glowPath.setAttribute('stroke-width', String((baseW + glowPad) / z));

          if (splineGroup) {
            const paths = splineGroup.querySelectorAll('path');
            if (lineStyle === 'neon' && paths.length > 0) {
              paths[0].setAttribute('stroke-width', String(Math.max(2.0, baseW * 0.78) / z));
            } else if (paths.length > 0) {
              paths[0].setAttribute('stroke-width', String(compW));
            }
          }

          ['_arrowFg', '_arrowFgTail'].forEach(k => {
            const el = ann[k];
            if (!el) return;
            if (el.tagName === 'circle') {
              const baseR = parseFloat(el.dataset.baseR);
              if (baseR) el.setAttribute('r', String(baseR / Math.sqrt(z)));
            } else {
              el.setAttribute('stroke-width', String(lineStyle === 'neon' ? 2.5 / z : compW));
            }
          });
          ['_arrowSh', '_arrowShTail'].forEach(k => {
            const el = ann[k];
            if (el && el.tagName !== 'circle') el.setAttribute('stroke-width', String((baseW + 2.4) / z));
          });
          ['_arrowGlow', '_arrowGlowTail'].forEach(k => {
            const el = ann[k];
            if (el && el.tagName !== 'circle') el.setAttribute('stroke-width', String((baseW + glowPad) / z));
          });
        } else if ((ann.type === 'circle_callout' || ann.type === 'box_callout') && ann.elements) {
          const [shadowEl, fgEl, glowEl] = ann.elements;
          const baseW = ann.strokeWidth || 3.2;
          if (shadowEl) shadowEl.setAttribute('stroke-width', String((baseW + 2.3) / z));
          if (glowEl) glowEl.setAttribute('stroke-width', String((baseW + glowPad) / z));
          if (fgEl) fgEl.setAttribute('stroke-width', String((ann.lineStyle === 'neon' ? Math.max(2.0, baseW * 0.78) : baseW) / z));
        }
      });
    }
  _applySplineVisuals(curve, d, baseW, lineStyle) {
    const comp = this.component;
    const st = comp.stageState;
    const p = st.prefs || {};
    const z = st.cadStrokeMode ? (st.zoom || 1.0) : 1.0;
    const sw = baseW / z;
    const glowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10;
    const glowOp = p.curveGlowOpacity !== undefined ? p.curveGlowOpacity : 0.90;
    const [shadowPath, splineGroup, glowPath] = curve.elements;

    if (shadowPath) {
      shadowPath.setAttribute('d', d);
      shadowPath.setAttribute('stroke-width', String((baseW + 2.3) / z));
      shadowPath.style.display = lineStyle === 'classic' ? 'block' : 'none';
    }

    if (glowPath) {
      glowPath.setAttribute('d', d);
      glowPath.setAttribute('stroke', curve.color);
      glowPath.setAttribute('stroke-width', String((baseW + glowPad) / z));
      glowPath.style.display = lineStyle === 'neon' ? 'block' : 'none';
      glowPath.style.filter = 'url(#qa-neon-glow)';
      glowPath.style.opacity = String(glowOp);
    }

    if (splineGroup) {
      splineGroup.innerHTML = '';
      const isNeon = lineStyle === 'neon';
      splineGroup.appendChild(makeElement('svg:path', {
        d,
        stroke: isNeon ? this.getLuminousCoreColor(curve.color) : curve.color,
        'stroke-width': String(isNeon ? Math.max(2.0, baseW * 0.78) / z : sw),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
        ...(isNeon ? { style: { filter: 'url(#qa-neon-core)' } } : {})
      }));
    }
  }

  _syncArrowheads(curve, baseW, lineStyle) {
      const comp = this.component;
      ['_arrowFg', '_arrowSh', '_arrowGlow', '_arrowFgTail', '_arrowShTail', '_arrowGlowTail'].forEach(k => {
        if (curve[k]) {
          curve[k].remove();
          curve[k] = null;
        }
      });

      if (curve.isClosed || !curve.beziers || curve.beziers.length === 0) return;
      const mode = curve.arrowEnd;
      const style = curve.arrowStyle || comp.stageState.arrowStyle || 'concave';

      const mountArrow = (pt, refPt, suffix) => {
        const dist = Math.hypot(refPt[0] - pt[0], refPt[1] - pt[1]) || 1;
        const tangent = [(refPt[0] - pt[0]) / dist, (refPt[1] - pt[1]) / dist];
        const arrow = this.renderConcaveArrowhead(pt, tangent, curve.color, 2.0, baseW, lineStyle, style);
        curve[`_arrowSh${suffix}`] = arrow.shadow;
        curve[`_arrowFg${suffix}`] = arrow.foreground;
        curve[`_arrowGlow${suffix}`] = arrow.glow;
        if (arrow.shadow) comp.shadowLayer.appendChild(arrow.shadow);
        if (arrow.glow) comp.glowLayer.appendChild(arrow.glow);
        comp.strokeLayer.appendChild(arrow.foreground);
      };

      if (mode === 'tip' || mode === 'both') {
        mountArrow(curve.beziers[0][0], curve.beziers[0][1], '');
      }
      if (mode === 'tail' || mode === 'both') {
        const lastSeg = curve.beziers[curve.beziers.length - 1];
        mountArrow(lastSeg[3], lastSeg[2], 'Tail');
      }
    }
}

globalThis.QuoraStrokeManager = QuoraStrokeManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraStrokeManager;