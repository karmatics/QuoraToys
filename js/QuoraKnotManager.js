class QuoraKnotManager {
  constructor(component) {
    this.component = component;
  }

  exposeHandles(curveRecord, controlsLayer, stageState) {
    controlsLayer.innerHTML = '';
    if (!curveRecord || !curveRecord.vertices) return;

    stageState.selectedItem = curveRecord;
    const vertices = curveRecord.vertices;

    if (!this.component._selectedKnotIndices) {
      this.component._selectedKnotIndices = new Set();
    }
    if (this.component._activeKnotIdx !== null && this.component._selectedKnotIndices.size === 0) {
      this.component._selectedKnotIndices.add(this.component._activeKnotIdx);
    }

    vertices.forEach((v, idx) => {
      const isTip = (idx === 0 && curveRecord.arrowEnd === 'tip');
      const isTail = (idx === vertices.length - 1 && curveRecord.arrowEnd === 'tail');
      const isSelected = this.component._selectedKnotIndices.has(idx);
      const isDeleteTarget = (idx === this._hoveredDeleteKnotIdx);

      const fatTarget = makeElement('svg:circle', {
        cx: v.point[0], cy: v.point[1], r: '14', fill: 'transparent',
        style: { cursor: 'move', pointerEvents: 'all' },
        title: 'Click to drag point • Shift-click to multi-select'
      });

      let nodeCircle;
      if (isTip || isTail) {
        nodeCircle = makeElement('svg:circle', {
          cx: v.point[0], cy: v.point[1],
          r: isDeleteTarget ? '6' : (isSelected ? '5' : '3.8'),
          fill: isDeleteTarget ? '#f59e0b' : (isSelected ? '#00f2fe' : 'none'),
          stroke: isDeleteTarget ? '#ffffff' : (isSelected ? '#00f2fe' : '#ffd700'),
          'stroke-width': isSelected ? '2.5' : '1.5',
          className: 'qa-on-curve-knot-handle',
          style: {
            pointerEvents: 'none',
            filter: isDeleteTarget ? 'drop-shadow(0 0 6px #f59e0b)' : (isSelected ? 'drop-shadow(0 0 8px #00f2fe)' : 'none'),
            transition: 'r 0.12s ease, fill 0.12s ease'
          }
        });
      } else {
        nodeCircle = makeElement('svg:circle', {
          cx: v.point[0], cy: v.point[1],
          r: isDeleteTarget ? '6.5' : (isSelected ? '6.0' : '3.5'),
          fill: isDeleteTarget ? '#f59e0b' : (isSelected ? '#00f2fe' : '#00e676'),
          stroke: '#ffffff',
          'stroke-width': isSelected ? '2.2' : '1.2',
          className: 'qa-on-curve-knot-handle',
          style: {
            pointerEvents: 'none',
            filter: isDeleteTarget ? 'drop-shadow(0 0 8px #f59e0b)' : (isSelected ? 'drop-shadow(0 0 10px #00f2fe)' : 'none'),
            transition: 'r 0.12s ease, fill 0.12s ease'
          }
        });
      }

      fatTarget.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.deleteKnotAtIndex(curveRecord, idx, controlsLayer, stageState);
      });

      let dragging = false;
      const startPtsMap = new Map();

      fatTarget.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();

        // Shift-click toggles selection membership
        if (e.shiftKey) {
          if (this.component._selectedKnotIndices.has(idx)) {
            this.component._selectedKnotIndices.delete(idx);
          } else {
            this.component._selectedKnotIndices.add(idx);
          }
        } else {
          if (!this.component._selectedKnotIndices.has(idx)) {
            this.component._selectedKnotIndices.clear();
            this.component._selectedKnotIndices.add(idx);
          }
        }

        this.component._activeKnotIdx = idx;
        dragging = true;

        // LOOSEN CONSTRAINTS ON POINT GRAB:
        // Release explicit angular offsets on grabbed point and adjacent points
        // so the curve naturally responds to point movement
        v.tangentAngleOffset = 0;
        v.curvature = 1.0;
        v.balance = 1.0;
        if (vertices[idx - 1]) {
          vertices[idx - 1].tangentAngleOffset = 0;
          vertices[idx - 1].curvature = 1.0;
          vertices[idx - 1].balance = 1.0;
        }
        if (vertices[idx + 1]) {
          vertices[idx + 1].tangentAngleOffset = 0;
          vertices[idx + 1].curvature = 1.0;
          vertices[idx + 1].balance = 1.0;
        }

        // Snapshot starting positions
        startPtsMap.clear();
        this.component._selectedKnotIndices.forEach(kIdx => {
          const kv = vertices[kIdx];
          if (kv) startPtsMap.set(kIdx, [kv.point[0], kv.point[1]]);
        });

        const startClientX = e.clientX;
        const startClientY = e.clientY;

        // Suppress halfway midpoint split indicators during active drag
        controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

        const onDrag = (ev) => {
          if (!dragging) return;
          const z = stageState.zoom || 1.0;
          const dx = (ev.clientX - startClientX) / z;
          const dy = (ev.clientY - startClientY) / z;

          startPtsMap.forEach((origPt, kIdx) => {
            const kv = vertices[kIdx];
            if (kv) {
              kv.point[0] = Math.round(origPt[0] + dx);
              kv.point[1] = Math.round(origPt[1] + dy);
            }
          });

          // Re-relax geometry smoothly across the spline
          this.component.commitCurveGeometryUpdate();
          this.component.renderStage();
          this.renderOutboundTangentRay(curveRecord, idx, controlsLayer, stageState);
        };

        const onUp = () => {
          dragging = false;
          window.removeEventListener('mousemove', onDrag);
          window.removeEventListener('mouseup', onUp);
          this.exposeHandles(curveRecord, controlsLayer, stageState);
        };

        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', onUp);
      });

      controlsLayer.appendChild(fatTarget);
      controlsLayer.appendChild(nodeCircle);
    });

    this.renderOutboundTangentRay(curveRecord, this.component._activeKnotIdx, controlsLayer, stageState);
    this.renderSegmentMidpointIndicators(curveRecord, controlsLayer, stageState);
    this.component.updateDynamicKeyInHUD();
  }
  renderOutboundTangentRay(curveRecord, knotIdx, controlsLayer, stageState) {
    const existing = document.getElementById('qa-outbound-tangent-ray');
    if (existing) existing.remove();

    const vertices = curveRecord.vertices;
    if (!vertices || vertices.length < 2) return;
    const v = vertices[knotIdx] || vertices[0];
    const pt = v.point;
    const rayLength = 52;
    const isStart = (knotIdx === 0);
    const isTail = (knotIdx === vertices.length - 1);
    const isInterior = (!isStart && !isTail);

    // Natural forward tangent along the curve direction
    const forwardNatural = (typeof UpdateControlPoints !== 'undefined' && typeof UpdateControlPoints.computeCounterfactualTangent === 'function')
      ? UpdateControlPoints.computeCounterfactualTangent(vertices, knotIdx)
      : [1, 0];

    // Outbound ray trajectory:
    // - Tail knot (end of curve): continues outward forward (+forwardNatural)
    // - Head knot (start of curve): projects outward backwards (-forwardNatural)
    // - Interior knot: projects outward forward (+forwardNatural) with symmetric reverse line
    const naturalRayDir = isStart ? [-forwardNatural[0], -forwardNatural[1]] : forwardNatural;
    const naturalAngle = Math.atan2(naturalRayDir[1], naturalRayDir[0]);

    const offset = v.tangentAngleOffset || 0;
    const isConstrained = Math.abs(offset) > 0.001;
    const actualAngle = naturalAngle + offset;

    const g = makeElement('svg:g', { id: 'qa-outbound-tangent-ray' });

    // Baseline guide when constrained
    if (isConstrained) {
      const naturalEnd = [pt[0] + Math.cos(naturalAngle) * (rayLength - 8), pt[1] + Math.sin(naturalAngle) * (rayLength - 8)];
      g.appendChild(makeElement('svg:line', {
        x1: pt[0], y1: pt[1], x2: naturalEnd[0], y2: naturalEnd[1],
        stroke: 'rgba(255, 255, 255, 0.22)', 'stroke-width': '1.0', 'stroke-dasharray': '2,3',
        style: { pointerEvents: 'none' }
      }));

      const arcR = 24;
      const arcStart = [pt[0] + Math.cos(naturalAngle) * arcR, pt[1] + Math.sin(naturalAngle) * arcR];
      const arcEnd = [pt[0] + Math.cos(actualAngle) * arcR, pt[1] + Math.sin(actualAngle) * arcR];
      const sweepFlag = (offset > 0) ? 1 : 0;
      const arcD = `M ${arcStart[0]} ${arcStart[1]} A ${arcR} ${arcR} 0 0 ${sweepFlag} ${arcEnd[0]} ${arcEnd[1]}`;

      g.appendChild(makeElement('svg:path', {
        d: arcD, fill: 'none', stroke: 'rgba(255, 215, 0, 0.45)', 'stroke-width': '1.2',
        style: { pointerEvents: 'none' }
      }));

      const deg = Math.round(offset * (180 / Math.PI));
      const midAngle = naturalAngle + (offset / 2);
      const lblX = pt[0] + Math.cos(midAngle) * (arcR + 12);
      const lblY = pt[1] + Math.sin(midAngle) * (arcR + 12);

      g.appendChild(makeElement('svg:text', {
        x: lblX, y: lblY, fill: '#ffd700', 'font-size': '9px', 'font-family': 'monospace',
        'text-anchor': 'middle', style: { pointerEvents: 'none', opacity: 0.85 }
      }, `${deg > 0 ? '+' : ''}${deg}°`));
    }

    // Interior knots: symmetric collinear tangent line extending in opposite direction
    if (isInterior) {
      const oppAngle = actualAngle + Math.PI;
      const oppEnd = [pt[0] + Math.cos(oppAngle) * (rayLength * 0.75), pt[1] + Math.sin(oppAngle) * (rayLength * 0.75)];

      g.appendChild(makeElement('svg:line', {
        x1: pt[0], y1: pt[1], x2: oppEnd[0], y2: oppEnd[1],
        stroke: isConstrained ? 'rgba(255, 215, 0, 0.35)' : 'rgba(56, 189, 248, 0.32)',
        'stroke-width': '1.0', 'stroke-dasharray': '3,3', 'stroke-linecap': 'round',
        style: { pointerEvents: 'none' }
      }));
    }

    const rayEnd = [pt[0] + Math.cos(actualAngle) * rayLength, pt[1] + Math.sin(actualAngle) * rayLength];

    const line = makeElement('svg:line', {
      x1: pt[0], y1: pt[1], x2: rayEnd[0], y2: rayEnd[1],
      stroke: isConstrained ? '#ffd700' : 'rgba(56, 189, 248, 0.45)',
      'stroke-width': '1.0', 'stroke-linecap': 'round',
      style: { pointerEvents: 'none' }
    });

    const handle = makeElement('svg:rect', {
      x: rayEnd[0] - 3.5, y: rayEnd[1] - 3.5, width: '7', height: '7', rx: '1.2',
      transform: `rotate(45, ${rayEnd[0]}, ${rayEnd[1]})`,
      fill: isConstrained ? '#ffd700' : '#38bdf8',
      stroke: '#090d16', 'stroke-width': '1.2',
      style: { cursor: 'crosshair', filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' },
      title: 'Drag to adjust outbound angle • Snaps to natural baseline • Double-click to reset'
    });

    handle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      v.tangentAngleOffset = 0;
      const localScope = (stageState.dragLockMode === 'single')
        ? { start: Math.max(0, knotIdx - 1), end: Math.min(vertices.length - 1, knotIdx + 1) }
        : null;
      this.component.commitCurveGeometryUpdate(localScope);
      this.exposeHandles(curveRecord, controlsLayer, stageState);
      this.component.showKnotToast('⚡ Reset to Natural Tangent (0°)');
    });

    let draggingRay = false;
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      draggingRay = true;

      const onRayMove = (ev) => {
        if (!draggingRay) return;
        const rect = this.component.stageBox.getBoundingClientRect();
        const z = stageState.zoom || 1.0;
        const mX = (ev.clientX - rect.left) / z;
        const mY = (ev.clientY - rect.top) / z;

        const cursorAngle = Math.atan2(mY - pt[1], mX - pt[0]);
        let offsetRad = cursorAngle - naturalAngle;

        while (offsetRad > Math.PI) offsetRad -= Math.PI * 2;
        while (offsetRad < -Math.PI) offsetRad += Math.PI * 2;

        // Magnetic snap within 5 degrees
        if (Math.abs(offsetRad) < 0.087) {
          offsetRad = 0;
          this.component.showKnotToast('⚡ Snapped to Baseline (0°)');
        }

        v.tangentAngleOffset = offsetRad;

        // Constrain update to immediate neighbor segments during single knot adjustment
        const localScope = (stageState.dragLockMode === 'single')
          ? { start: Math.max(0, knotIdx - 1), end: Math.min(vertices.length - 1, knotIdx + 1) }
          : null;

        this.component.commitCurveGeometryUpdate(localScope);
        this.renderOutboundTangentRay(curveRecord, knotIdx, controlsLayer, stageState);
        this.component.updateDynamicKeyInHUD();
      };

      const onRayUp = () => {
        draggingRay = false;
        window.removeEventListener('mousemove', onRayMove);
        window.removeEventListener('mouseup', onRayUp);
      };

      window.addEventListener('mousemove', onRayMove);
      window.addEventListener('mouseup', onRayUp);
    });

    g.append(line, handle);
    controlsLayer.appendChild(g);
  }

  renderSegmentMidpointIndicators(curveRecord, controlsLayer, stageState) {
    controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

    // Only display halfway split dots in steady pick mode (when curve is active and not during drag)
    if (!curveRecord || !curveRecord.beziers || this.component._isDrawingActive || stageState.selectedItem !== curveRecord) {
      return;
    }

    curveRecord.beziers.forEach((seg, segIdx) => {
      const midPt = CurveFitter.bezier_q(seg, 0.5);

      const g = makeElement('svg:g', {
        className: 'qa-segment-midpoint-group',
        style: { cursor: 'pointer' },
        title: `Click midpoint to split segment ${segIdx + 1} with a new knot`
      });

      const hitArea = makeElement('svg:circle', {
        cx: midPt[0], cy: midPt[1], r: '14', fill: 'transparent'
      });

      const dot = makeElement('svg:circle', {
        cx: midPt[0], cy: midPt[1], r: '3.5',
        fill: '#f59e0b', stroke: '#ffffff', 'stroke-width': '1.2',
        style: { transition: 'r 0.15s ease, fill 0.15s ease', pointerEvents: 'none' }
      });

      g.addEventListener('mouseenter', () => {
        dot.setAttribute('r', '5.5');
        dot.setAttribute('fill', '#ffd700');
        dot.style.filter = 'drop-shadow(0 0 6px #f59e0b)';
      });

      g.addEventListener('mouseleave', () => {
        dot.setAttribute('r', '3.5');
        dot.setAttribute('fill', '#f59e0b');
        dot.style.filter = '';
      });

      let isDraggingMid = false;
      let newKnot = null;

      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDraggingMid = true;

        // Remove midpoint dots immediately once a split drag starts
        controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

        if (!curveRecord.vertices || curveRecord.vertices.length === 0) {
          curveRecord.vertices = this.component.beziersToVertices(curveRecord.beziers);
        }

        newKnot = new BezierVertex([midPt[0], midPt[1]]);
        newKnot.curvature = 1.0;
        newKnot.balance = 1.0;
        newKnot.tangentAngleOffset = 0;

        curveRecord.vertices.splice(segIdx + 1, 0, newKnot);
        this.component._activeKnotIdx = segIdx + 1;

        this.component.commitCurveGeometryUpdate();
        this.exposeHandles(curveRecord, controlsLayer, stageState);

        const onMidDrag = (ev) => {
          if (!isDraggingMid) return;
          const rect = this.component.stageBox.getBoundingClientRect();
          const z = stageState.zoom || 1.0;
          newKnot.point[0] = (ev.clientX - rect.left) / z;
          newKnot.point[1] = (ev.clientY - rect.top) / z;
          this.component.commitCurveGeometryUpdate();
          this.exposeHandles(curveRecord, controlsLayer, stageState);
        };

        const onMidUp = () => {
          isDraggingMid = false;
          window.removeEventListener('mousemove', onMidDrag);
          window.removeEventListener('mouseup', onMidUp);
          this.renderSegmentMidpointIndicators(curveRecord, controlsLayer, stageState);
          this.component.showKnotToast(`✓ Inserted knot #${segIdx + 2}`);
        };

        window.addEventListener('mousemove', onMidDrag);
        window.addEventListener('mouseup', onMidUp);
      });

      g.append(hitArea, dot);
      controlsLayer.appendChild(g);
    });
  }
  cycleKnotCurvature(knot) {
      if (!knot) return;
      const presets = [1.0, 1.5, 2.0, 0.6];
      const cur = knot.curvature || 1.0;
      const nextVal = presets[(presets.findIndex(v => Math.abs(v - cur) < 0.15) + 1) % presets.length];
      knot.curvature = nextVal;
      this.component.commitCurveGeometryUpdate();
      this.component.showKnotToast(`Curvature: ${nextVal.toFixed(1)}`);
  }

  cycleKnotBalance(knot) {
      if (!knot) return;
      const presets = [1.0, 0.5, 1.5];
      const cur = knot.balance || 1.0;
      const nextVal = presets[(presets.findIndex(v => Math.abs(v - cur) < 0.15) + 1) % presets.length];
      knot.balance = nextVal;
      this.component.commitCurveGeometryUpdate();
      this.component.showKnotToast(`Balance: ${nextVal.toFixed(1)}`);
  }

  deleteClosestKnot(curveRecord, mousePt) {
      if (!curveRecord || !curveRecord.vertices || curveRecord.vertices.length === 0) return false;
      const vertices = curveRecord.vertices;

      // Find knot closest to the cursor point
      let closestIdx = 0;
      let minD = Infinity;

      vertices.forEach((v, idx) => {
        const d = Math.hypot(v.point[0] - mousePt[0], v.point[1] - mousePt[1]);
        if (d < minD) {
          minD = d;
          closestIdx = idx;
        }
      });

      // If only 2 endpoints remain, deleting removes the entire curve
      if (vertices.length <= 2) {
        this.component.deleteSelectedEntity();
        return true;
      }

      return this.deleteKnotAtIndex(curveRecord, closestIdx, this.component.controlsLayer, this.component.stageState);
  }

  deleteKnotAtIndex(curveRecord, idx, controlsLayer, stageState) {
      const vertices = curveRecord.vertices;
      if (!vertices || vertices.length <= 2) {
        this.component.deleteSelectedEntity();
        return true;
      }

      const knotNum = idx + 1;
      vertices.splice(idx, 1);
      this.component._activeKnotIdx = Math.max(0, Math.min(idx, vertices.length - 1));
      this.component.commitCurveGeometryUpdate();
      this.exposeHandles(curveRecord, controlsLayer, stageState);
      this.component.showKnotToast(`🗑️ Deleted knot #${knotNum} (${vertices.length} remaining)`);
      this.component.updateDynamicKeyInHUD();
      return true;
  }

  updateHoveredDeleteTarget(mousePt) {
      const curve = this.component.getActiveCurve();
      if (!curve || !curve.vertices || curve.vertices.length === 0) {
        if (this._hoveredDeleteKnotIdx !== null) {
          this._hoveredDeleteKnotIdx = null;
        }
        return;
      }

      let closestIdx = null;
      let minD = 50; // 50px attraction radius

      curve.vertices.forEach((v, idx) => {
        const d = Math.hypot(v.point[0] - mousePt[0], v.point[1] - mousePt[1]);
        if (d < minD) {
          minD = d;
          closestIdx = idx;
        }
      });

      if (this._hoveredDeleteKnotIdx !== closestIdx) {
        this._hoveredDeleteKnotIdx = closestIdx;
        // Refresh knot handles so the closest one shows the subtle delete aura
        this.exposeHandles(curve, this.component.controlsLayer, this.component.stageState);
      }
  }
}

globalThis.QuoraKnotManager = QuoraKnotManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraKnotManager;