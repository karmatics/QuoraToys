class QuoraKnotManager {
  constructor(component) {
    this.component = component;
  }

  exposeHandles(curveRecord, controlsLayer, stageState) {
    controlsLayer.innerHTML = '';
    if (!curveRecord || !curveRecord.vertices) return;

    const comp = this.component;
    const z = stageState.zoom || 1.0;
    const inv = 1 / z;
    const verts = curveRecord.vertices;
    stageState.selectedItem = curveRecord;

    if (curveRecord.color) stageState.currentColor = curveRecord.color;
    if (curveRecord.strokeWidth) stageState.curveStrokeWidth = curveRecord.strokeWidth;
    if (curveRecord.lineStyle) stageState.lineStyle = curveRecord.lineStyle;
    stageState.hasArrow = curveRecord.arrowEnd && curveRecord.arrowEnd !== 'none';

    comp.updatePaletteHighlight();
    if (comp.widthValueLbl) comp.widthValueLbl.textContent = `${curveRecord.strokeWidth || 3.2}px`;
    if (comp.loopBtn) {
      comp.loopBtn.textContent = curveRecord.isClosed ? '● Loop' : '○ Loop';
      comp.loopBtn.classList.toggle('primary', !!curveRecord.isClosed);
    }

    if (!comp._selectedKnotIndices) comp._selectedKnotIndices = new Set();
    const selSet = comp._selectedKnotIndices;
    if (comp._activeKnotIdx !== null && selSet.size === 0) selSet.add(comp._activeKnotIdx);

    verts.forEach((v, idx) => {
      const isEndpoint = idx === 0 || idx === verts.length - 1;
      const isTerminal = (idx === 0 && curveRecord.arrowEnd === 'tip') || (idx === verts.length - 1 && curveRecord.arrowEnd === 'tail');
      const isSelected = selSet.has(idx);
      const isDel = idx === this._hoveredDeleteKnotIdx;
      const isCusp = Boolean(v.isCusp);
      const [px, py] = v.point;

      const fatTarget = makeElement('svg:circle', {
        cx: px, cy: py, r: (16 * inv).toFixed(2), fill: 'transparent',
        style: { cursor: 'move', pointerEvents: 'all' },
        title: isCusp ? '⚡ Cusp point • Right-click for menu' : 'Click to drag point • Right-click for actions'
      });

      let nodeMarker;
      if (isCusp) {
        const side = (isSelected ? 11 : 9) * inv;
        nodeMarker = makeElement('svg:rect', {
          x: px - side / 2, y: py - side / 2, width: side, height: side, rx: 1.5 * inv,
          transform: `rotate(45, ${px}, ${py})`,
          fill: isSelected ? '#00f2fe' : '#f59e0b', stroke: '#ffffff', 'stroke-width': String(1.8 * inv),
          className: 'qa-on-curve-knot-handle',
          style: { pointerEvents: 'none', filter: isSelected ? 'drop-shadow(0 0 8px #00f2fe)' : 'drop-shadow(0 0 6px #f59e0b)' }
        });
      } else {
        nodeMarker = makeElement('svg:circle', {
          cx: px, cy: py, r: String((isSelected ? 6.0 : 4.0) * inv),
          fill: isDel ? '#f59e0b' : (isSelected ? '#00f2fe' : (isTerminal ? 'none' : '#00e676')),
          stroke: isDel || !isTerminal ? '#ffffff' : (isSelected ? '#00f2fe' : '#ffd700'),
          'stroke-width': String((isSelected ? (isTerminal ? 2.5 : 2.2) : (isTerminal ? 1.5 : 1.2)) * inv),
          className: 'qa-on-curve-knot-handle',
          style: { pointerEvents: 'none' }
        });
      }

      if (isEndpoint) {
        fatTarget.addEventListener('mouseenter', () => {
          if (this._isDraggingKnot || this._isDraggingRay || comp.isInteracting()) return;
          if (this._endpointRayHideTimer) { clearTimeout(this._endpointRayHideTimer); this._endpointRayHideTimer = null; }
          comp._activeKnotIdx = idx;
          this.renderOutboundTangentRay(curveRecord, idx, controlsLayer, stageState);
        });
        fatTarget.addEventListener('mouseleave', () => {
          if (this._isDraggingKnot || this._isDraggingRay || comp.isInteracting()) return;
          this._endpointRayHideTimer = setTimeout(() => {
            if (!this._isOverRay && !this._isDraggingRay && !this._isDraggingKnot && comp._activeKnotIdx !== idx) {
              document.getElementById('qa-outbound-tangent-ray')?.remove();
            }
          }, 650);
        });
      }

      fatTarget.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showKnotContextMenu(curveRecord, idx, e.clientX, e.clientY);
      });

      fatTarget.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();

        if (e.shiftKey) {
          if (selSet.has(idx)) selSet.delete(idx); else selSet.add(idx);
        } else if (!selSet.has(idx)) {
          selSet.clear();
          selSet.add(idx);
        }

        comp._activeKnotIdx = idx;
        this._isDraggingKnot = true;
        controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());
        document.getElementById('qa-outbound-tangent-ray')?.remove();

        if (verts.length >= 3 && !v.isExplicitTangent && !v.isCusp) {
          v.tangentAngleOffset = 0;
          v.curvature = 1.0;
          v.balance = 1.0;
        }

        const origBeziers = JSON.parse(JSON.stringify(curveRecord.beziers || []));
        const origVerts = verts.map(ov => ({
          point: ov.point.slice(),
          controlPoints: [ov.controlPoints[0].slice(), ov.controlPoints[1].slice()],
          tangentAngleOffset: ov.tangentAngleOffset, curvature: ov.curvature,
          balance: ov.balance, isCusp: ov.isCusp, isExplicitTangent: ov.isExplicitTangent
        }));

        document.getElementById('qa-drag-ghost-curve')?.remove();
        const ghostEl = makeElement('svg:path', {
          id: 'qa-drag-ghost-curve',
          d: StudioGeometry.beziersToSvgD(curveRecord.beziers, false),
          fill: 'none', stroke: 'rgba(0, 242, 254, 0.35)', 'stroke-width': String(7 * inv),
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(0, 242, 254, 0.45))' }
        });
        comp.glowLayer.appendChild(ghostEl);

        const startMap = new Map();
        selSet.forEach(kIdx => { if (verts[kIdx]) startMap.set(kIdx, verts[kIdx].point.slice()); });
        const sX = e.clientX, sY = e.clientY;

        const teardown = () => {
          this._isDraggingKnot = false;
          ghostEl.remove();
          window.removeEventListener('mousemove', onDrag);
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('keydown', onCancelKey);
          window.removeEventListener('contextmenu', onCancelCtx, true);
        };

        const cancelRevert = () => {
          teardown();
          curveRecord.vertices = origVerts.map(ov => Object.assign(new BezierVertex(ov.point.slice()), {
            controlPoints: [ov.controlPoints[0].slice(), ov.controlPoints[1].slice()],
            tangentAngleOffset: ov.tangentAngleOffset, curvature: ov.curvature,
            balance: ov.balance, isCusp: ov.isCusp, isExplicitTangent: ov.isExplicitTangent
          }));
          curveRecord.beziers = origBeziers;
          comp.commitCurveGeometryUpdate();
          this.exposeHandles(curveRecord, controlsLayer, stageState);
          comp.showKnotToast('↺ Reverted to previous curve state');
        };

        const onCancelKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); cancelRevert(); } };
        const onCancelCtx = (ev) => { ev.preventDefault(); ev.stopPropagation(); cancelRevert(); };
        const onDrag = (ev) => {
          const curZ = stageState.zoom || 1.0;
          const dx = (ev.clientX - sX) / curZ, dy = (ev.clientY - sY) / curZ;
          startMap.forEach((op, kIdx) => {
            if (verts[kIdx]) { verts[kIdx].point[0] = Math.round(op[0] + dx); verts[kIdx].point[1] = Math.round(op[1] + dy); }
          });
          comp.commitCurveGeometryUpdate();
        };
        const onUp = () => {
          teardown();
          this.exposeHandles(curveRecord, controlsLayer, stageState);
          comp.renderStage();
        };

        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('keydown', onCancelKey);
        window.addEventListener('contextmenu', onCancelCtx, true);
      });

      controlsLayer.appendChild(fatTarget);
      controlsLayer.appendChild(nodeMarker);
    });

    this.renderOutboundTangentRay(curveRecord, comp._activeKnotIdx, controlsLayer, stageState);
    this.updateDynamicMidpointCandidate(curveRecord, controlsLayer, stageState);
    comp.updateDynamicKeyInHUD();
  }

  renderOutboundTangentRay(curveRecord, knotIdx, controlsLayer, stageState) {
    document.getElementById('qa-outbound-tangent-ray')?.remove();
    const vertices = curveRecord.vertices;
    if (!vertices || vertices.length < 2) return;

    const comp = this.component;
    const v = vertices[knotIdx] || vertices[0];
    const pt = v.point;
    const rayLen = 68, arcR = 26, textR = rayLen + 26;
    const isStart = knotIdx === 0, isTail = knotIdx === vertices.length - 1, isInterior = !isStart && !isTail;
    const setAttrs = (el, attrs) => Object.entries(attrs).forEach(([k, val]) => el.setAttribute(k, val));

    const forwardNat = (typeof UpdateControlPoints !== 'undefined' && UpdateControlPoints.computeCounterfactualTangent)
      ? UpdateControlPoints.computeCounterfactualTangent(vertices, knotIdx) : [1, 0];

    const g = makeElement('svg:g', {
      id: 'qa-outbound-tangent-ray',
      onmouseenter: () => {
        this._isOverRay = true;
        if (this._endpointRayHideTimer) { clearTimeout(this._endpointRayHideTimer); this._endpointRayHideTimer = null; }
      },
      onmouseleave: () => { this._isOverRay = false; }
    });

    const attachWingHandle = (wingSide, dirVec, natDir, isExplicit) => {
      const actualAng = Math.atan2(dirVec[1], dirVec[0]);
      const natAng = Math.atan2(natDir[1], natDir[0]);
      const offsetRad = StudioGeometry.normalizeAngle(actualAng - natAng);
      const ptAt = (ang, r) => [pt[0] + Math.cos(ang) * r, pt[1] + Math.sin(ang) * r];
      const rayEnd = ptAt(actualAng, rayLen);
      const natEnd = ptAt(natAng, rayLen - 10);
      const arcStart = ptAt(natAng, arcR);
      const arcEnd = ptAt(actualAng, arcR);
      const lblPt = ptAt(actualAng, textR);
      const activeCol = v.isCusp ? '#f59e0b' : (isExplicit ? '#ffd700' : '#00f2fe');
      const deg = Math.round(offsetRad * (180 / Math.PI));

      const baselineLine = makeElement('svg:line', {
        x1: pt[0], y1: pt[1], x2: natEnd[0], y2: natEnd[1],
        stroke: 'rgba(255, 255, 255, 0.35)', 'stroke-width': '1.2', 'stroke-dasharray': '2,3',
        style: { pointerEvents: 'none', display: isExplicit ? 'block' : 'none' }
      });
      const angleArc = makeElement('svg:path', {
        d: `M ${arcStart[0]} ${arcStart[1]} A ${arcR} ${arcR} 0 0 ${offsetRad > 0 ? 1 : 0} ${arcEnd[0]} ${arcEnd[1]}`,
        fill: 'none', stroke: v.isCusp ? 'rgba(245, 158, 11, 0.75)' : 'rgba(255, 215, 0, 0.75)', 'stroke-width': '1.8',
        style: { pointerEvents: 'none', display: isExplicit ? 'block' : 'none' }
      });
      const oppLine = (isInterior && !v.isCusp) ? makeElement('svg:line', {
        x1: pt[0], y1: pt[1], x2: ptAt(actualAng + Math.PI, rayLen * 0.75)[0], y2: ptAt(actualAng + Math.PI, rayLen * 0.75)[1],
        stroke: isExplicit ? 'rgba(255, 215, 0, 0.45)' : 'rgba(56, 189, 248, 0.35)',
        'stroke-width': '1.2', 'stroke-dasharray': '3,3', 'stroke-linecap': 'round', style: { pointerEvents: 'none' }
      }) : null;

      const badgeBackdrop = makeElement('svg:rect', {
        x: lblPt[0] - 22, y: lblPt[1] - 9, width: '44', height: '18', rx: '4',
        fill: 'rgba(9, 13, 22, 0.94)', stroke: v.isCusp ? '#f59e0b' : '#ffd700', 'stroke-width': '1.2'
      });
      const degreeLabel = makeElement('svg:text', {
        x: lblPt[0], y: lblPt[1] + 3.5, fill: v.isCusp ? '#f59e0b' : '#ffd700', 'font-size': '10px',
        'font-family': 'monospace', 'text-anchor': 'middle', 'dominant-baseline': 'middle', style: { fontWeight: 'bold' }
      }, `${deg > 0 ? '+' : ''}${deg}°`);
      const degreeBadge = makeElement('svg:g', {
        className: 'qa-telemetry-degree-badge', style: { pointerEvents: 'none', display: isExplicit ? 'block' : 'none' }
      }, [badgeBackdrop, degreeLabel]);

      const line = makeElement('svg:line', {
        x1: pt[0], y1: pt[1], x2: rayEnd[0], y2: rayEnd[1],
        stroke: v.isCusp ? '#f59e0b' : (isExplicit ? '#ffd700' : 'rgba(56, 189, 248, 0.65)'),
        'stroke-width': '1.5', 'stroke-linecap': 'round', style: { pointerEvents: 'none' }
      });
      const handleNode = makeElement('svg:circle', {
        className: 'qa-tangent-handle-node', cx: rayEnd[0], cy: rayEnd[1], r: '6',
        fill: activeCol, stroke: '#070a13', 'stroke-width': '2.0',
        style: { filter: `drop-shadow(0 0 6px ${activeCol})`, pointerEvents: 'none' }
      });
      const fatHitArea = makeElement('svg:circle', {
        cx: rayEnd[0], cy: rayEnd[1], r: '18', fill: 'transparent', style: { pointerEvents: 'all' },
        title: v.isCusp ? 'Drag cusp wing (snap 0° collinear to restore smooth point)' : 'Drag tangent • Alt+Drag to break into cusp • Dbl-click reset',
        onmouseenter: () => handleNode.setAttribute('r', '8'),
        onmouseleave: () => handleNode.setAttribute('r', '6'),
        ondblclick: (e) => {
          e.stopPropagation();
          Object.assign(v, { tangentAngleOffset: 0, cuspInAngleOffset: 0, cuspOutAngleOffset: 0, isCusp: false, isExplicitTangent: false });
          comp.commitCurveGeometryUpdate();
          this.exposeHandles(curveRecord, controlsLayer, stageState);
          comp.showKnotToast('⚡ Reset to Natural Baseline');
        }
      });

      const showBadge = (ang, txt, badgeCol, bw) => {
        const lp = ptAt(ang, textR);
        degreeBadge.style.display = 'block';
        setAttrs(badgeBackdrop, { x: lp[0] - bw / 2, y: lp[1] - 9, width: bw, stroke: badgeCol });
        setAttrs(degreeLabel, { x: lp[0], y: lp[1] + 3.5, fill: badgeCol });
        degreeLabel.textContent = txt;
      };

      fatHitArea.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._isDraggingRay = true;
        controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

        if (isInterior && !v.isCusp && e.altKey) {
          StudioGeometry.setVertexCuspState(vertices, knotIdx, true);
          comp.commitCurveGeometryUpdate();
          comp.showKnotToast('◆ Broke smooth knot into cusp');
        }

        let snappedToSmooth = false, collinearSmoothDir = null, collinearGuide = null;

        const onRayMove = (ev) => {
          const rect = comp.stageBox.getBoundingClientRect();
          const z = stageState.zoom || 1.0;
          const curAng = Math.atan2((ev.clientY - rect.top) / z - pt[1], (ev.clientX - rect.left) / z - pt[0]);

          if (isInterior && v.isCusp) {
            baselineLine.style.display = angleArc.style.display = 'none';
            const otherCp = wingSide === 'in' ? v.controlPoints[1] : v.controlPoints[0];
            const otherDir = StudioGeometry.normalize([otherCp[0] - pt[0], otherCp[1] - pt[1]]);
            const colAng = Math.atan2(-otherDir[1], -otherDir[0]);
            const kink = StudioGeometry.normalizeAngle(curAng - colAng);
            snappedToSmooth = Math.abs(kink) < 0.095;
            const finalAng = snappedToSmooth ? colAng : curAng;
            collinearSmoothDir = wingSide === 'out' ? [Math.cos(colAng), Math.sin(colAng)] : otherDir;

            if (wingSide === 'in') {
              const nIn = v._naturalInTangent || [-1, 0];
              v.cuspInAngleOffset = StudioGeometry.normalizeAngle(finalAng - Math.atan2(nIn[1], nIn[0]));
            } else {
              const nOut = v._naturalOutTangent || [1, 0];
              v.cuspOutAngleOffset = StudioGeometry.normalizeAngle(finalAng - Math.atan2(nOut[1], nOut[0]));
            }
            comp.commitCurveGeometryUpdate();

            const end = ptAt(finalAng, rayLen);
            const col = snappedToSmooth ? '#00f2fe' : '#f59e0b';
            setAttrs(line, { x2: end[0], y2: end[1], stroke: col });
            setAttrs(fatHitArea, { cx: end[0], cy: end[1] });
            setAttrs(handleNode, { cx: end[0], cy: end[1], fill: col });

            if (snappedToSmooth) {
              if (!collinearGuide) {
                collinearGuide = makeElement('svg:line', { id: 'qa-cusp-collinear-guide', stroke: '#00f2fe', 'stroke-width': '1.5', 'stroke-dasharray': '4,3', style: { pointerEvents: 'none' } });
                g.appendChild(collinearGuide);
              }
              setAttrs(collinearGuide, {
                x1: pt[0] - collinearSmoothDir[0] * rayLen, y1: pt[1] - collinearSmoothDir[1] * rayLen,
                x2: pt[0] + collinearSmoothDir[0] * rayLen, y2: pt[1] + collinearSmoothDir[1] * rayLen
              });
              collinearGuide.style.display = 'block';
            } else if (collinearGuide) {
              collinearGuide.style.display = 'none';
            }

            showBadge(finalAng, snappedToSmooth ? '⚡ 0° SMOOTH' : `${Math.round(Math.abs(kink) * (180 / Math.PI))}°`, col, snappedToSmooth ? 82 : 48);
            return;
          }

          let delta = StudioGeometry.normalizeAngle(curAng - natAng);
          const isSnapped = Math.abs(delta) < 0.087;
          v.isExplicitTangent = !isSnapped;
          v.tangentAngleOffset = isSnapped ? 0 : delta;
          comp.commitCurveGeometryUpdate();

          const resolvedAng = natAng + v.tangentAngleOffset;
          const end = ptAt(resolvedAng, rayLen);
          setAttrs(line, { x2: end[0], y2: end[1] });
          setAttrs(fatHitArea, { cx: end[0], cy: end[1] });
          setAttrs(handleNode, { cx: end[0], cy: end[1], fill: v.isExplicitTangent ? '#ffd700' : '#00f2fe' });

          if (oppLine) {
            const oppEnd = ptAt(resolvedAng + Math.PI, rayLen * 0.75);
            setAttrs(oppLine, { x2: oppEnd[0], y2: oppEnd[1] });
          }

          if (Math.abs(v.tangentAngleOffset) > 0.005 || isSnapped) {
            baselineLine.style.display = angleArc.style.display = 'block';
            const aEnd = ptAt(resolvedAng, arcR);
            angleArc.setAttribute('d', `M ${arcStart[0]} ${arcStart[1]} A ${arcR} ${arcR} 0 0 ${v.tangentAngleOffset > 0 ? 1 : 0} ${aEnd[0]} ${aEnd[1]}`);
            const liveDeg = Math.round(v.tangentAngleOffset * (180 / Math.PI));
            showBadge(resolvedAng, isSnapped ? '⚡ 0° SNAP' : `${liveDeg > 0 ? '+' : ''}${liveDeg}°`, isSnapped ? '#00f2fe' : '#ffd700', isSnapped ? 68 : 44);
          } else {
            baselineLine.style.display = angleArc.style.display = degreeBadge.style.display = 'none';
          }
        };

        const onRayUp = () => {
          this._isDraggingRay = false;
          collinearGuide?.remove();
          window.removeEventListener('mousemove', onRayMove);
          window.removeEventListener('mouseup', onRayUp);
          if (isInterior && v.isCusp && snappedToSmooth && collinearSmoothDir) {
            StudioGeometry.setVertexCuspState(vertices, knotIdx, false, collinearSmoothDir);
            comp.commitCurveGeometryUpdate();
            comp.showKnotToast('● Snapped 0° Smooth Point');
          }
          this.exposeHandles(curveRecord, controlsLayer, stageState);
          comp.updateDynamicKeyInHUD();
        };

        window.addEventListener('mousemove', onRayMove);
        window.addEventListener('mouseup', onRayUp);
      });

      g.append(baselineLine, angleArc, ...(oppLine ? [oppLine] : []), degreeBadge, line, makeElement('svg:g', { className: 'qa-tangent-handle-group', style: { cursor: 'crosshair', pointerEvents: 'all' } }, [fatHitArea, handleNode]));
    };

    if (isStart && v.controlPoints[1]) {
      attachWingHandle('out', StudioGeometry.normalize([pt[0] - v.controlPoints[1][0], pt[1] - v.controlPoints[1][1]]), [-forwardNat[0], -forwardNat[1]], Boolean(v.isExplicitTangent && Math.abs(v.tangentAngleOffset || 0) > 0.005));
    } else if (isTail && v.controlPoints[0]) {
      attachWingHandle('in', StudioGeometry.normalize([pt[0] - v.controlPoints[0][0], pt[1] - v.controlPoints[0][1]]), forwardNat, Boolean(v.isExplicitTangent && Math.abs(v.tangentAngleOffset || 0) > 0.005));
    } else if (isInterior) {
      const outDir = StudioGeometry.normalize([v.controlPoints[1][0] - pt[0], v.controlPoints[1][1] - pt[1]]);
      if (v.isCusp) {
        attachWingHandle('in', StudioGeometry.normalize([v.controlPoints[0][0] - pt[0], v.controlPoints[0][1] - pt[1]]), v._naturalInTangent || [-1, 0], Math.abs(v.cuspInAngleOffset || 0) > 0.01);
        attachWingHandle('out', outDir, v._naturalOutTangent || [1, 0], Math.abs(v.cuspOutAngleOffset || 0) > 0.01);
      } else {
        attachWingHandle('out', outDir, forwardNat, Boolean(v.isExplicitTangent && Math.abs(v.tangentAngleOffset || 0) > 0.005));
      }
    }

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

      // Clear stale implicit offsets on newly adjacent knots so deleting a knot stays smooth
      [idx - 1, idx].forEach(nIdx => {
        const nv = vertices[nIdx];
        if (nv && !nv.isExplicitTangent && !nv.isCusp) {
          nv.tangentAngleOffset = 0;
          nv.curvature = 1.0;
          nv.balance = 1.0;
        }
      });

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

  updateDynamicMidpointCandidate(curveRecord, controlsLayer, stageState) {
      controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

      if (
        !curveRecord ||
        !curveRecord.beziers ||
        this._isDraggingKnot ||
        this._isDraggingRay ||
        this.component._isDrawingActive ||
        this.component.isInteracting() ||
        stageState.selectedItem !== curveRecord
      ) {
        return;
      }

      const mousePt = this.component._lastStageMousePt;
      if (!mousePt) return;

      let closestSegIdx = -1;
      let minDistance = 45;
      let closestMidPt = null;

      curveRecord.beziers.forEach((seg, segIdx) => {
        const mid = CurveFitter.bezier_q(seg, 0.5);
        const d = Math.hypot(mid[0] - mousePt[0], mid[1] - mousePt[1]);
        if (d < minDistance) {
          minDistance = d;
          closestSegIdx = segIdx;
          closestMidPt = mid;
        }
      });

      if (closestSegIdx === -1 || !closestMidPt) return;

      const g = makeElement('svg:g', {
        className: 'qa-segment-midpoint-group',
        style: { cursor: 'pointer' },
        title: `Click or drag to split segment ${closestSegIdx + 1}`
      });

      const hitArea = makeElement('svg:circle', {
        cx: closestMidPt[0], cy: closestMidPt[1], r: '14', fill: 'transparent'
      });
      const dot = makeElement('svg:circle', {
        cx: closestMidPt[0], cy: closestMidPt[1], r: '4',
        fill: '#f59e0b', stroke: '#ffffff', 'stroke-width': '1.2',
        style: { filter: 'drop-shadow(0 0 6px #f59e0b)', pointerEvents: 'none' }
      });

      let isDraggingMid = false;

      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDraggingMid = true;
        controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

        this.component.strokeManager.addKnotOnCurve(curveRecord, closestSegIdx, 0.5);
        const insertedIdx = closestSegIdx + 1;
        const newKnot = curveRecord.vertices[insertedIdx];

        const onMidDrag = (ev) => {
          if (!isDraggingMid || !newKnot) return;
          const rect = this.component.stageBox.getBoundingClientRect();
          const z = stageState.zoom || 1.0;
          newKnot.point[0] = Math.round((ev.clientX - rect.left) / z);
          newKnot.point[1] = Math.round((ev.clientY - rect.top) / z);
          this.component.commitCurveGeometryUpdate();
          this.exposeHandles(curveRecord, controlsLayer, stageState);
        };

        const onMidUp = () => {
          isDraggingMid = false;
          window.removeEventListener('mousemove', onMidDrag);
          window.removeEventListener('mouseup', onMidUp);
          this.exposeHandles(curveRecord, controlsLayer, stageState);
        };

        window.addEventListener('mousemove', onMidDrag);
        window.addEventListener('mouseup', onMidUp);
      });

      g.append(hitArea, dot);
      controlsLayer.appendChild(g);
    }

  showKnotContextMenu(curveRecord, knotIdx, screenX, screenY) {
    document.getElementById('qa-knot-context-menu')?.remove();
    if (!this._lastKnotAction) this._lastKnotAction = 'delete';

    const comp = this.component;
    const actions = [
      ['delete', '🗑️ Delete Knot', 'Del', () => this.deleteKnotAtIndex(curveRecord, knotIdx, comp.controlsLayer, comp.stageState)],
      ['tangent', '📐 Adjust Tangency', '[ / ]', () => { comp._activeKnotIdx = knotIdx; this.renderOutboundTangentRay(curveRecord, knotIdx, comp.controlsLayer, comp.stageState); }],
      ['curvature', '〰️ Tune Curvature', '+ / -', () => this.cycleKnotCurvature(curveRecord.vertices[knotIdx])],
      ['balance', '⚖️ Cycle Balance', 'B', () => this.cycleKnotBalance(curveRecord.vertices[knotIdx])],
      ['cusp', '⚡ Toggle Cusp (Corner)', 'C', () => { comp._activeKnotIdx = knotIdx; comp.executeKeyInCommand('toggle_cusp'); }],
      ['straighten', '📏 Straighten Line', 'S', () => comp.executeKeyInCommand('straighten')]
    ];

    const onOutClick = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('pointerdown', onOutClick);
      }
    };

    const menu = makeElement('div', {
      id: 'qa-knot-context-menu',
      style: {
        position: 'fixed', top: `${screenY + 6}px`, left: `${screenX + 6}px`,
        background: 'rgba(9, 13, 22, 0.96)', border: '1.5px solid #00f2fe',
        borderRadius: '10px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.85), 0 0 16px rgba(0,242,254,0.3)',
        zIndex: '2147483647', fontFamily: 'monospace', fontSize: '11px', minWidth: '190px',
        backdropFilter: 'blur(12px)', userSelect: 'none'
      }
    }, actions.map(([id, label, key, fn]) => {
      const isDef = this._lastKnotAction === id;
      return makeElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer',
          background: isDef ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
          border: isDef ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid transparent',
          color: isDef ? '#00f2fe' : '#f8fafc', fontWeight: isDef ? 'bold' : 'normal'
        },
        onmouseenter: (e) => { e.currentTarget.style.background = 'rgba(0, 242, 254, 0.2)'; },
        onmouseleave: (e) => { e.currentTarget.style.background = isDef ? 'rgba(0, 242, 254, 0.15)' : 'transparent'; },
        onclick: (e) => {
          e.stopPropagation();
          this._lastKnotAction = id;
          menu.remove();
          document.removeEventListener('pointerdown', onOutClick);
          fn();
        }
      }, [
        makeElement('span', {}, isDef ? `★ ${label}` : label),
        makeElement('span', { style: { color: '#64748b', fontSize: '9.5px' } }, key)
      ]);
    }));

    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('pointerdown', onOutClick), 60);
  }

  deleteKnotNearPoint(curveRecord, pt, maxDist = 50) {
      if (!curveRecord || !curveRecord.vertices || curveRecord.vertices.length <= 2 || !pt) return false;

      let idx = -1;
      let best = maxDist;
      curveRecord.vertices.forEach((v, i) => {
        const d = Math.hypot(v.point[0] - pt[0], v.point[1] - pt[1]);
        if (d < best) {
          best = d;
          idx = i;
        }
      });

      if (idx < 0) return false;
      this._hoveredDeleteKnotIdx = null;
      return this.deleteKnotAtIndex(curveRecord, idx, this.component.controlsLayer, this.component.stageState);
    }
}

globalThis.QuoraKnotManager = QuoraKnotManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraKnotManager;