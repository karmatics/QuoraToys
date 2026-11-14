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

        let d = StudioGeometry.beziersToSvgD(beziers, false);

        const p = this.component.stageState.prefs || {};
        const shadowOffset = 2.0;
        const shadowColor = 'rgba(10, 15, 25, 0.95)';
        const lineStyle = this.component.stageState.lineStyle || p.lineStyle || 'classic';
        const baseW = this.component.stageState.curveStrokeWidth || p.curveStrokeWidth || 3.2;
        const z = this.component.stageState.cadStrokeMode ? (this.component.stageState.zoom || 1.0) : 1.0;
        const sw = baseW / z;
        const glowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10;
        const glowOp = p.curveGlowOpacity !== undefined ? p.curveGlowOpacity : 0.90;

        const shadowPath = makeElement('svg:path', {
          d, transform: `translate(${shadowOffset}, ${shadowOffset})`,
          stroke: shadowColor, 'stroke-width': String((baseW + 2.3) / z), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
          style: { display: lineStyle === 'classic' ? 'block' : 'none' }
        });

        const glowPath = makeElement('svg:path', {
          d, stroke: color, 'stroke-width': String((baseW + glowPad) / z),
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
          style: {
            display: lineStyle === 'neon' ? 'block' : 'none',
            filter: 'url(#qa-neon-glow)',
            opacity: String(glowOp)
          }
        });

        const splineGroup = makeElement('svg:g', { className: 'qa-spline-group' });

        if (lineStyle === 'neon') {
          const coreTint = this.getLuminousCoreColor(color);
          const innerCore = makeElement('svg:path', {
            d, stroke: coreTint, 'stroke-width': String(Math.max(2.0, baseW * 0.78) / z), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
            style: { filter: 'url(#qa-neon-core)' }
          });
          splineGroup.appendChild(innerCore);
        } else {
          const mainSpline = makeElement('svg:path', {
            d, stroke: color, 'stroke-width': String(sw), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
          });
          splineGroup.appendChild(mainSpline);
        }

        const vertices = existingVertices || this.beziersToVertices(beziers, cuspVertexIndices);
        const arrowMode = hasArrow ? (this.component.stageState.arrowMode || 'tip') : 'none';

        const curveRecord = {
          id: 'curve_' + Date.now(),
          type: 'curve',
          beziers,
          vertices,
          color,
          strokeWidth: baseW,
          lineStyle,
          arrowEnd: arrowMode,
          textEnd: arrowMode === 'tail' ? 'tip' : 'tail',
          text: '',
          hasTextBox: this.component.stageState.hasBorder,
          boxStyle: this.component.stageState.boxStyle || p.boxStyle || 'bracket',
          fontFamily: this.component.stageState.fontFamily || p.fontFamily,
          fontSize: this.component.stageState.fontSize || p.fontSize || 20,
          connectEdge: null,
          elements: [shadowPath, splineGroup, glowPath]
        };

        this.component.shadowLayer.appendChild(shadowPath);
        this.component.glowLayer.appendChild(glowPath);
        this.component.strokeLayer.appendChild(splineGroup);

        if (arrowMode === 'tip' || arrowMode === 'both') {
          const p0 = beziers[0][0], p1 = beziers[0][1];
          const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
          const arrow = this.renderConcaveArrowhead(p0, [(p1[0] - p0[0]) / dist, (p1[1] - p0[1]) / dist], color, 2.0, baseW, lineStyle);
          curveRecord._arrowSh = arrow.shadow;
          curveRecord._arrowFg = arrow.foreground;
          curveRecord._arrowGlow = arrow.glow;
          if (arrow.shadow) this.component.shadowLayer.appendChild(arrow.shadow);
          if (arrow.glow) this.component.glowLayer.appendChild(arrow.glow);
          this.component.strokeLayer.appendChild(arrow.foreground);
        }

        if (arrowMode === 'tail' || arrowMode === 'both') {
          const lastSeg = beziers[beziers.length - 1];
          const p2 = lastSeg[2], p3 = lastSeg[3];
          const dist = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) || 1;
          const arrow = this.renderConcaveArrowhead(p3, [(p2[0] - p3[0]) / dist, (p2[1] - p3[1]) / dist], color, 2.0, baseW, lineStyle);
          curveRecord._arrowShTail = arrow.shadow;
          curveRecord._arrowFgTail = arrow.foreground;
          curveRecord._arrowGlowTail = arrow.glow;
          if (arrow.shadow) this.component.shadowLayer.appendChild(arrow.shadow);
          if (arrow.glow) this.component.glowLayer.appendChild(arrow.glow);
          this.component.strokeLayer.appendChild(arrow.foreground);
        }

        this.component.stageState.annotations.push(curveRecord);
        this.component.selectItem(curveRecord);
        this.component.updateDynamicKeyInHUD();
      }
  updateCurveGeometry() {
      const curve = this.component.getActiveCurve();
      if (!curve || !curve.vertices || curve.vertices.length < 2) return;

      curve.beziers = this.verticesToBeziers(curve.vertices);

      const [shadowEl, splineGroup, glowPath] = curve.elements || [];
      let d = 'M ' + curve.beziers[0][0].join(' ');
      for (let i = 0; i < curve.beziers.length; i++) {
        const [start, cp1, cp2, end] = curve.beziers[i];
        d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
      }
      if (curve.isClosed) d += ' Z';

      const p = this.component.stageState.prefs || {};
      const lineStyle = curve.lineStyle || 'classic';
      const baseW = curve.strokeWidth || this.component.stageState.curveStrokeWidth || 3.2;
      const z = this.component.stageState.cadStrokeMode ? (this.component.stageState.zoom || 1.0) : 1.0;
      const sw = baseW / z;
      const glowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10;
      const glowOp = p.curveGlowOpacity !== undefined ? p.curveGlowOpacity : 0.90;

      if (shadowEl) {
        shadowEl.setAttribute('d', d);
        shadowEl.setAttribute('stroke-width', String((baseW + 2.3) / z));
        shadowEl.style.display = lineStyle === 'classic' ? 'block' : 'none';
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
        if (lineStyle === 'neon') {
          const coreTint = this.getLuminousCoreColor(curve.color);
          const innerCore = makeElement('svg:path', {
            d, stroke: coreTint, 'stroke-width': String(Math.max(2.0, baseW * 0.78) / z), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
            style: { filter: 'url(#qa-neon-core)' }
          });
          splineGroup.appendChild(innerCore);
        } else {
          const mainSpline = makeElement('svg:path', {
            d, stroke: curve.color, 'stroke-width': String(sw), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
          });
          splineGroup.appendChild(mainSpline);
        }
      }

      if (curve._arrowFg) { curve._arrowFg.remove(); curve._arrowFg = null; }
      if (curve._arrowSh) { curve._arrowSh.remove(); curve._arrowSh = null; }
      if (curve._arrowGlow) { curve._arrowGlow.remove(); curve._arrowGlow = null; }
      if (curve._arrowFgTail) { curve._arrowFgTail.remove(); curve._arrowFgTail = null; }
      if (curve._arrowShTail) { curve._arrowShTail.remove(); curve._arrowShTail = null; }
      if (curve._arrowGlowTail) { curve._arrowGlowTail.remove(); curve._arrowGlowTail = null; }

      if (!curve.isClosed && curve.beziers.length > 0) {
        if (curve.arrowEnd === 'tip' || curve.arrowEnd === 'both') {
          const p0 = curve.beziers[0][0];
          const p1 = curve.beziers[0][1];
          const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
          const arrow = this.renderConcaveArrowhead(p0, [(p1[0] - p0[0]) / dist, (p1[1] - p0[1]) / dist], curve.color, 2.0, baseW, lineStyle);
          curve._arrowSh = arrow.shadow;
          curve._arrowFg = arrow.foreground;
          curve._arrowGlow = arrow.glow;
          if (arrow.shadow) this.component.shadowLayer.appendChild(arrow.shadow);
          if (arrow.glow) this.component.glowLayer.appendChild(arrow.glow);
          this.component.strokeLayer.appendChild(arrow.foreground);
        }
        if (curve.arrowEnd === 'tail' || curve.arrowEnd === 'both') {
          const lastSeg = curve.beziers[curve.beziers.length - 1];
          const p2 = lastSeg[2];
          const p3 = lastSeg[3];
          const dist = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) || 1;
          const arrow = this.renderConcaveArrowhead(p3, [(p2[0] - p3[0]) / dist, (p2[1] - p3[1]) / dist], curve.color, 2.0, baseW, lineStyle);
          curve._arrowShTail = arrow.shadow;
          curve._arrowFgTail = arrow.foreground;
          curve._arrowGlowTail = arrow.glow;
          if (arrow.shadow) this.component.shadowLayer.appendChild(arrow.shadow);
          if (arrow.glow) this.component.glowLayer.appendChild(arrow.glow);
          this.component.strokeLayer.appendChild(arrow.foreground);
        }
      }

      this.component.renderStage();
    }

  renderConcaveArrowhead(p0, exitTangent, color, shadowOffset = 2.0, strokeWidth = 3.2, lineStyle = 'classic') {
        const z = (this.component.stageState.cadStrokeMode) ? (this.component.stageState.zoom || 1.0) : 1.0;
        const geo = StudioGeometry.computeConcaveArrowPath(p0, exitTangent, strokeWidth, z);

        let arrowShadow = null;
        let arrowGlow = null;
        let arrowForeground = null;

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
            style: { filter: 'url(#qa-neon-glow)', opacity: '0.92' }
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

      annotations.forEach(ann => {
        if (ann.type === 'curve' && ann.elements) {
          const [shadowEl, splineGroup, glowPath] = ann.elements;
          const baseW = ann.strokeWidth || 3.2;
          const compW = baseW / z;
          const lineStyle = ann.lineStyle || 'classic';

          if (shadowEl) {
            shadowEl.setAttribute('stroke-width', String((baseW + 2.3) / z));
          }

          if (glowPath) {
            glowPath.setAttribute('stroke-width', String((baseW + 9) / z));
          }

          if (splineGroup) {
            const paths = splineGroup.querySelectorAll('path');
            if (lineStyle === 'neon' && paths.length >= 2) {
              paths[0].setAttribute('stroke-width', String(compW));
              paths[1].setAttribute('stroke-width', String(2.4 / z));
            } else if (paths.length > 0) {
              paths[0].setAttribute('stroke-width', String(compW));
            }
          }

          // Compensate arrowheads
          if (ann._arrowFg) {
            const fgPaths = ann._arrowFg.querySelectorAll ? ann._arrowFg.querySelectorAll('path') : [];
            if (fgPaths.length >= 2) {
              fgPaths[0].setAttribute('stroke-width', String(compW));
              fgPaths[1].setAttribute('stroke-width', String(2.0 / z));
            } else if (ann._arrowFg.setAttribute) {
              ann._arrowFg.setAttribute('stroke-width', String(compW));
            }
          }
          if (ann._arrowSh && ann._arrowSh.setAttribute) {
            ann._arrowSh.setAttribute('stroke-width', String((baseW + 2.4) / z));
          }
        }
      });
    }
}

globalThis.QuoraStrokeManager = QuoraStrokeManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraStrokeManager;