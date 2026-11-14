class QuoraKnotManager {
  constructor(component) {
    this.component = component;
  }

  exposeHandles(curveRecord, controlsLayer, stageState) {
      controlsLayer.innerHTML = '';
      if (!curveRecord || !curveRecord.vertices) return;

      stageState.selectedItem = curveRecord;

      if (curveRecord.color) stageState.currentColor = curveRecord.color;
      if (curveRecord.strokeWidth) stageState.curveStrokeWidth = curveRecord.strokeWidth;
      if (curveRecord.lineStyle) stageState.lineStyle = curveRecord.lineStyle;
      stageState.hasArrow = (curveRecord.arrowEnd && curveRecord.arrowEnd !== 'none');

      this.component.updatePaletteHighlight();
      if (this.component.widthValueLbl) this.component.widthValueLbl.textContent = `${curveRecord.strokeWidth || 3.2}px`;
      if (this.component.loopBtn) {
        this.component.loopBtn.textContent = curveRecord.isClosed ? '● Loop' : '○ Loop';
        this.component.loopBtn.classList.toggle('primary', !!curveRecord.isClosed);
      }

      const z = stageState.zoom || 1.0;
      const invScale = 1 / z;
      const vertices = curveRecord.vertices;

      if (!this.component._selectedKnotIndices) this.component._selectedKnotIndices = new Set();
      if (this.component._activeKnotIdx !== null && this.component._selectedKnotIndices.size === 0) {
        this.component._selectedKnotIndices.add(this.component._activeKnotIdx);
      }

      vertices.forEach((v, idx) => {
        const isTip = (idx === 0 && curveRecord.arrowEnd === 'tip');
        const isTail = (idx === vertices.length - 1 && curveRecord.arrowEnd === 'tail');
        const isEndpoint = (idx === 0 || idx === vertices.length - 1);
        const isSelected = this.component._selectedKnotIndices.has(idx);
        const isDeleteTarget = (idx === this._hoveredDeleteKnotIdx);
        const isCusp = Boolean(v.isCusp);

        const hitRadius = (16 * invScale).toFixed(2);
        const fatTarget = makeElement('svg:circle', {
          cx: v.point[0], cy: v.point[1], r: hitRadius, fill: 'transparent',
          style: { cursor: 'move', pointerEvents: 'all' },
          title: isCusp ? '⚡ Cusp point • Right-click for menu' : 'Click to drag point • Right-click for actions'
        });

        let nodeMarker;
        const baseR = (isSelected ? 6.0 : 4.0) * invScale;

        if (isCusp) {
          const side = (isSelected ? 11 : 9) * invScale;
          nodeMarker = makeElement('svg:rect', {
            x: v.point[0] - side / 2, y: v.point[1] - side / 2, width: side, height: side, rx: 1.5 * invScale,
            transform: `rotate(45, ${v.point[0]}, ${v.point[1]})`,
            fill: isSelected ? '#00f2fe' : '#f59e0b', stroke: '#ffffff', 'stroke-width': String(1.8 * invScale),
            className: 'qa-on-curve-knot-handle',
            style: { pointerEvents: 'none', filter: isSelected ? 'drop-shadow(0 0 8px #00f2fe)' : 'drop-shadow(0 0 6px #f59e0b)' }
          });
        } else if (isTip || isTail) {
          nodeMarker = makeElement('svg:circle', {
            cx: v.point[0], cy: v.point[1], r: String(baseR),
            fill: isDeleteTarget ? '#f59e0b' : (isSelected ? '#00f2fe' : 'none'),
            stroke: isDeleteTarget ? '#ffffff' : (isSelected ? '#00f2fe' : '#ffd700'),
            'stroke-width': String((isSelected ? 2.5 : 1.5) * invScale),
            className: 'qa-on-curve-knot-handle',
            style: { pointerEvents: 'none' }
          });
        } else {
          nodeMarker = makeElement('svg:circle', {
            cx: v.point[0], cy: v.point[1], r: String(baseR),
            fill: isDeleteTarget ? '#f59e0b' : (isSelected ? '#00f2fe' : '#00e676'),
            stroke: '#ffffff', 'stroke-width': String((isSelected ? 2.2 : 1.2) * invScale),
            className: 'qa-on-curve-knot-handle',
            style: { pointerEvents: 'none' }
          });
        }

        if (isEndpoint) {
          fatTarget.addEventListener('mouseenter', () => {
            if (this._isDraggingKnot || this._isDraggingRay || this.component.isInteracting()) return;
            if (this._endpointRayHideTimer) { clearTimeout(this._endpointRayHideTimer); this._endpointRayHideTimer = null; }
            this.component._activeKnotIdx = idx;
            this.renderOutboundTangentRay(curveRecord, idx, controlsLayer, stageState);
          });

          fatTarget.addEventListener('mouseleave', () => {
            if (this._isDraggingKnot || this._isDraggingRay || this.component.isInteracting()) return;
            this._endpointRayHideTimer = setTimeout(() => {
              if (!this._isOverRay && !this._isDraggingRay && !this._isDraggingKnot) {
                const ray = document.getElementById('qa-outbound-tangent-ray');
                if (ray && this.component._activeKnotIdx !== idx) ray.remove();
              }
            }, 650);
          });
        }

        fatTarget.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showKnotContextMenu(curveRecord, idx, e.clientX, e.clientY);
        });

        let dragging = false;
        const startPtsMap = new Map();
        let origBeziers = null;
        let origVertices = null;
        let ghostCurveEl = null;

        const cancelAndRevertDrag = () => {
          if (!dragging) return;
          dragging = false;
          this._isDraggingKnot = false;
          if (ghostCurveEl) { ghostCurveEl.remove(); ghostCurveEl = null; }
          window.removeEventListener('mousemove', onDrag);
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('keydown', onKeyDownCancel);
          window.removeEventListener('contextmenu', onContextMenuCancel, true);

          if (origVertices) {
            curveRecord.vertices = origVertices.map(ov => {
              const vObj = new BezierVertex(ov.point.slice());
              vObj.controlPoints = [ov.controlPoints[0].slice(), ov.controlPoints[1].slice()];
              vObj.tangentAngleOffset = ov.tangentAngleOffset;
              vObj.curvature = ov.curvature;
              vObj.balance = ov.balance;
              vObj.isCusp = ov.isCusp;
              vObj.isExplicitTangent = ov.isExplicitTangent;
              return vObj;
            });
          }
          if (origBeziers) curveRecord.beziers = JSON.parse(JSON.stringify(origBeziers));

          this.component.commitCurveGeometryUpdate();
          this.exposeHandles(curveRecord, controlsLayer, stageState);
          this.component.showKnotToast('↺ Reverted to previous curve state');
        };

        const onKeyDownCancel = (ev) => {
          if (ev.key === 'Escape') { ev.preventDefault(); cancelAndRevertDrag(); }
        };
        const onContextMenuCancel = (ev) => {
          ev.preventDefault(); ev.stopPropagation(); cancelAndRevertDrag();
        };

        fatTarget.addEventListener('mousedown', (e) => {
          if (e.button === 2) return;
          e.stopPropagation();

          if (e.shiftKey) {
            if (this.component._selectedKnotIndices.has(idx)) this.component._selectedKnotIndices.delete(idx);
            else this.component._selectedKnotIndices.add(idx);
          } else if (!this.component._selectedKnotIndices.has(idx)) {
            this.component._selectedKnotIndices.clear();
            this.component._selectedKnotIndices.add(idx);
          }

          this.component._activeKnotIdx = idx;
          dragging = true;
          this._isDraggingKnot = true;

          controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());
          const oldRay = document.getElementById('qa-outbound-tangent-ray');
          if (oldRay) oldRay.remove();

          // Preserve fitted arch on 2-knot curves; relax dragged knot naturally on 3+ knot curves
          if (vertices.length >= 3 && !v.isExplicitTangent && !v.isCusp) {
            v.tangentAngleOffset = 0;
            v.curvature = 1.0;
            v.balance = 1.0;
          }

          origBeziers = JSON.parse(JSON.stringify(curveRecord.beziers || []));
          origVertices = vertices.map(vert => ({
            point: vert.point.slice(),
            controlPoints: [vert.controlPoints[0].slice(), vert.controlPoints[1].slice()],
            tangentAngleOffset: vert.tangentAngleOffset,
            curvature: vert.curvature,
            balance: vert.balance,
            isCusp: vert.isCusp,
            isExplicitTangent: vert.isExplicitTangent
          }));

          let currentPathD = '';
          if (curveRecord.beziers && curveRecord.beziers.length > 0) {
            currentPathD = 'M ' + curveRecord.beziers[0][0].join(' ');
            for (let bIdx = 0; bIdx < curveRecord.beziers.length; bIdx++) {
              const [, cp1, cp2, bEnd] = curveRecord.beziers[bIdx];
              currentPathD += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${bEnd.join(' ')}`;
            }
          }

          const existingGhost = document.getElementById('qa-drag-ghost-curve');
          if (existingGhost) existingGhost.remove();

          ghostCurveEl = makeElement('svg:path', {
            id: 'qa-drag-ghost-curve', d: currentPathD, fill: 'none',
            stroke: 'rgba(0, 242, 254, 0.35)', 'stroke-width': String(7 * invScale),
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(0, 242, 254, 0.45))' }
          });
          this.component.glowLayer.appendChild(ghostCurveEl);

          startPtsMap.clear();
          this.component._selectedKnotIndices.forEach(kIdx => {
            const kv = vertices[kIdx];
            if (kv) startPtsMap.set(kIdx, [kv.point[0], kv.point[1]]);
          });

          const startClientX = e.clientX;
          const startClientY = e.clientY;
          window.addEventListener('keydown', onKeyDownCancel);
          window.addEventListener('contextmenu', onContextMenuCancel, true);

          const onDrag = (ev) => {
            if (!dragging) return;
            const curZ = stageState.zoom || 1.0;
            const dx = (ev.clientX - startClientX) / curZ;
            const dy = (ev.clientY - startClientY) / curZ;

            startPtsMap.forEach((origPt, kIdx) => {
              const kv = vertices[kIdx];
              if (kv) {
                kv.point[0] = Math.round(origPt[0] + dx);
                kv.point[1] = Math.round(origPt[1] + dy);
              }
            });
            this.component.commitCurveGeometryUpdate();
          };

          const onUp = () => {
            dragging = false;
            this._isDraggingKnot = false;
            if (ghostCurveEl) { ghostCurveEl.remove(); ghostCurveEl = null; }
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('keydown', onKeyDownCancel);
            window.removeEventListener('contextmenu', onContextMenuCancel, true);
            this.exposeHandles(curveRecord, controlsLayer, stageState);
            this.component.renderStage();
          };

          window.addEventListener('mousemove', onDrag);
          window.addEventListener('mouseup', onUp);
        });

        controlsLayer.appendChild(fatTarget);
        controlsLayer.appendChild(nodeMarker);
      });

      this.renderOutboundTangentRay(curveRecord, this.component._activeKnotIdx, controlsLayer, stageState);
      this.updateDynamicMidpointCandidate(curveRecord, controlsLayer, stageState);
      this.component.updateDynamicKeyInHUD();
    }

  renderOutboundTangentRay(curveRecord, knotIdx, controlsLayer, stageState) {
        const existing = document.getElementById('qa-outbound-tangent-ray');
        if (existing) existing.remove();

        const vertices = curveRecord.vertices;
        if (!vertices || vertices.length < 2) return;
        const v = vertices[knotIdx] || vertices[0];
        const pt = v.point;

        const rayLength = 68;
        const isStart = (knotIdx === 0);
        const isTail = (knotIdx === vertices.length - 1);
        const isInterior = (!isStart && !isTail);

        const forwardNatural = (typeof UpdateControlPoints !== 'undefined' && typeof UpdateControlPoints.computeCounterfactualTangent === 'function')
          ? UpdateControlPoints.computeCounterfactualTangent(vertices, knotIdx)
          : [1, 0];

        const g = makeElement('svg:g', { id: 'qa-outbound-tangent-ray' });
        g.addEventListener('mouseenter', () => {
          this._isOverRay = true;
          if (this._endpointRayHideTimer) { clearTimeout(this._endpointRayHideTimer); this._endpointRayHideTimer = null; }
        });
        g.addEventListener('mouseleave', () => { this._isOverRay = false; });

        const attachWingHandle = (wingSide, dirVec, natDir, isExplicit) => {
          const actualAngle = Math.atan2(dirVec[1], dirVec[0]);
          const naturalAngle = Math.atan2(natDir[1], natDir[0]);
          const offsetRad = StudioGeometry.normalizeAngle(actualAngle - naturalAngle);
          const rayEnd = [pt[0] + Math.cos(actualAngle) * rayLength, pt[1] + Math.sin(actualAngle) * rayLength];
          const naturalEnd = [pt[0] + Math.cos(naturalAngle) * (rayLength - 10), pt[1] + Math.sin(naturalAngle) * (rayLength - 10)];

          const baselineLine = makeElement('svg:line', {
            x1: pt[0], y1: pt[1], x2: naturalEnd[0], y2: naturalEnd[1],
            stroke: 'rgba(255, 255, 255, 0.35)', 'stroke-width': '1.2', 'stroke-dasharray': '2,3',
            style: { pointerEvents: 'none', display: isExplicit ? 'block' : 'none' }
          });
          g.appendChild(baselineLine);

          const arcR = 26;
          const arcStart = [pt[0] + Math.cos(naturalAngle) * arcR, pt[1] + Math.sin(naturalAngle) * arcR];
          const arcEnd = [pt[0] + Math.cos(actualAngle) * arcR, pt[1] + Math.sin(actualAngle) * arcR];
          const angleArc = makeElement('svg:path', {
            d: `M ${arcStart[0]} ${arcStart[1]} A ${arcR} ${arcR} 0 0 ${offsetRad > 0 ? 1 : 0} ${arcEnd[0]} ${arcEnd[1]}`,
            fill: 'none', stroke: v.isCusp ? 'rgba(245, 158, 11, 0.75)' : 'rgba(255, 215, 0, 0.75)', 'stroke-width': '1.8',
            style: { pointerEvents: 'none', display: isExplicit ? 'block' : 'none' }
          });
          g.appendChild(angleArc);

          let oppLine = null;
          if (isInterior && !v.isCusp) {
            const oppAngle = actualAngle + Math.PI;
            oppLine = makeElement('svg:line', {
              x1: pt[0], y1: pt[1],
              x2: pt[0] + Math.cos(oppAngle) * (rayLength * 0.75),
              y2: pt[1] + Math.sin(oppAngle) * (rayLength * 0.75),
              stroke: isExplicit ? 'rgba(255, 215, 0, 0.45)' : 'rgba(56, 189, 248, 0.35)',
              'stroke-width': '1.2', 'stroke-dasharray': '3,3', 'stroke-linecap': 'round',
              style: { pointerEvents: 'none' }
            });
            g.appendChild(oppLine);
          }

          const textRadius = rayLength + 26;
          const lblX = pt[0] + Math.cos(actualAngle) * textRadius;
          const lblY = pt[1] + Math.sin(actualAngle) * textRadius;
          const deg = Math.round(offsetRad * (180 / Math.PI));

          const degreeBadgeGroup = makeElement('svg:g', {
            className: 'qa-telemetry-degree-badge',
            style: { pointerEvents: 'none', display: isExplicit ? 'block' : 'none' }
          });
          const badgeBackdrop = makeElement('svg:rect', {
            x: lblX - 22, y: lblY - 9, width: '44', height: '18', rx: '4',
            fill: 'rgba(9, 13, 22, 0.94)', stroke: v.isCusp ? '#f59e0b' : '#ffd700', 'stroke-width': '1.2'
          });
          const degreeLabel = makeElement('svg:text', {
            x: lblX, y: lblY + 3.5, fill: v.isCusp ? '#f59e0b' : '#ffd700', 'font-size': '10px',
            'font-family': 'monospace', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
            style: { fontWeight: 'bold' }
          }, `${deg > 0 ? '+' : ''}${deg}°`);
          degreeBadgeGroup.append(badgeBackdrop, degreeLabel);
          g.appendChild(degreeBadgeGroup);

          const strokeCol = v.isCusp ? '#f59e0b' : (isExplicit ? '#ffd700' : 'rgba(56, 189, 248, 0.65)');
          const line = makeElement('svg:line', {
            x1: pt[0], y1: pt[1], x2: rayEnd[0], y2: rayEnd[1],
            stroke: strokeCol, 'stroke-width': '1.5', 'stroke-linecap': 'round', style: { pointerEvents: 'none' }
          });

          const handleGroup = makeElement('svg:g', { className: 'qa-tangent-handle-group', style: { cursor: 'crosshair', pointerEvents: 'all' } });
          const fatHitArea = makeElement('svg:circle', {
            cx: rayEnd[0], cy: rayEnd[1], r: '18', fill: 'transparent', style: { pointerEvents: 'all' },
            title: v.isCusp
              ? 'Drag cusp wing (snap 0° collinear to restore smooth point)'
              : (isInterior ? 'Drag smooth tangent • Alt+Drag to break into cusp • Dbl-click reset' : 'Drag to adjust tangent • Dbl-click reset')
          });
          const nodeCol = v.isCusp ? '#f59e0b' : (isExplicit ? '#ffd700' : '#00f2fe');
          const handleNode = makeElement('svg:circle', {
            className: 'qa-tangent-handle-node', cx: rayEnd[0], cy: rayEnd[1], r: '6',
            fill: nodeCol, stroke: '#070a13', 'stroke-width': '2.0',
            style: { filter: `drop-shadow(0 0 6px ${nodeCol})`, pointerEvents: 'none' }
          });

          handleGroup.append(fatHitArea, handleNode);
          fatHitArea.addEventListener('mouseenter', () => { handleNode.setAttribute('r', '8'); });
          fatHitArea.addEventListener('mouseleave', () => { handleNode.setAttribute('r', '6'); });
          fatHitArea.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            v.tangentAngleOffset = 0; v.cuspInAngleOffset = 0; v.cuspOutAngleOffset = 0;
            v.isCusp = false; v.isExplicitTangent = false;
            this.component.commitCurveGeometryUpdate();
            this.exposeHandles(curveRecord, controlsLayer, stageState);
            this.component.showKnotToast('⚡ Reset to Natural Baseline');
          });

          let draggingRay = false;
          let snappedToSmooth = false;
          let collinearSmoothDir = null;
          let collinearGuide = null;

          fatHitArea.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            draggingRay = true;
            this._isDraggingRay = true;
            controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

            if (isInterior && !v.isCusp && e.altKey) {
              StudioGeometry.setVertexCuspState(vertices, knotIdx, true);
              this.component.commitCurveGeometryUpdate();
              this.component.showKnotToast('◆ Broke smooth knot into cusp');
            }

            const onRayMove = (ev) => {
              if (!draggingRay) return;
              const rect = this.component.stageBox.getBoundingClientRect();
              const z = stageState.zoom || 1.0;
              const mX = (ev.clientX - rect.left) / z;
              const mY = (ev.clientY - rect.top) / z;
              const cursorAngle = Math.atan2(mY - pt[1], mX - pt[0]);

              if (isInterior && v.isCusp) {
                baselineLine.style.display = 'none';
                angleArc.style.display = 'none';

                const otherCp = wingSide === 'in' ? v.controlPoints[1] : v.controlPoints[0];
                const otherDir = StudioGeometry.normalize([otherCp[0] - pt[0], otherCp[1] - pt[1]]);
                const collinearAngle = Math.atan2(-otherDir[1], -otherDir[0]);
                const kinkDelta = StudioGeometry.normalizeAngle(cursorAngle - collinearAngle);
                snappedToSmooth = Math.abs(kinkDelta) < 0.095;
                const finalAngle = snappedToSmooth ? collinearAngle : cursorAngle;
                collinearSmoothDir = wingSide === 'out' ? [Math.cos(collinearAngle), Math.sin(collinearAngle)] : otherDir;

                if (wingSide === 'in') {
                  const nIn = v._naturalInTangent || [-1, 0];
                  v.cuspInAngleOffset = StudioGeometry.normalizeAngle(finalAngle - Math.atan2(nIn[1], nIn[0]));
                } else {
                  const nOut = v._naturalOutTangent || [1, 0];
                  v.cuspOutAngleOffset = StudioGeometry.normalizeAngle(finalAngle - Math.atan2(nOut[1], nOut[0]));
                }
                this.component.commitCurveGeometryUpdate();

                const newEnd = [pt[0] + Math.cos(finalAngle) * rayLength, pt[1] + Math.sin(finalAngle) * rayLength];
                line.setAttribute('x2', newEnd[0]); line.setAttribute('y2', newEnd[1]);
                line.setAttribute('stroke', snappedToSmooth ? '#00f2fe' : '#f59e0b');
                fatHitArea.setAttribute('cx', newEnd[0]); fatHitArea.setAttribute('cy', newEnd[1]);
                handleNode.setAttribute('cx', newEnd[0]); handleNode.setAttribute('cy', newEnd[1]);
                handleNode.setAttribute('fill', snappedToSmooth ? '#00f2fe' : '#f59e0b');

                if (snappedToSmooth) {
                  if (!collinearGuide) {
                    collinearGuide = makeElement('svg:line', {
                      id: 'qa-cusp-collinear-guide', stroke: '#00f2fe', 'stroke-width': '1.5',
                      'stroke-dasharray': '4,3', style: { pointerEvents: 'none' }
                    });
                    g.appendChild(collinearGuide);
                  }
                  collinearGuide.setAttribute('x1', pt[0] - collinearSmoothDir[0] * rayLength);
                  collinearGuide.setAttribute('y1', pt[1] - collinearSmoothDir[1] * rayLength);
                  collinearGuide.setAttribute('x2', pt[0] + collinearSmoothDir[0] * rayLength);
                  collinearGuide.setAttribute('y2', pt[1] + collinearSmoothDir[1] * rayLength);
                  collinearGuide.style.display = 'block';
                } else if (collinearGuide) {
                  collinearGuide.style.display = 'none';
                }

                degreeBadgeGroup.style.display = 'block';
                const liveX = pt[0] + Math.cos(finalAngle) * textRadius;
                const liveY = pt[1] + Math.sin(finalAngle) * textRadius;
                const bw = snappedToSmooth ? 82 : 48;
                badgeBackdrop.setAttribute('x', liveX - bw / 2); badgeBackdrop.setAttribute('y', liveY - 9);
                badgeBackdrop.setAttribute('width', bw);
                badgeBackdrop.setAttribute('stroke', snappedToSmooth ? '#00f2fe' : '#f59e0b');
                degreeLabel.setAttribute('x', liveX); degreeLabel.setAttribute('y', liveY + 3.5);
                degreeLabel.setAttribute('fill', snappedToSmooth ? '#00f2fe' : '#f59e0b');
                degreeLabel.textContent = snappedToSmooth ? '⚡ 0° SMOOTH' : `${Math.round(Math.abs(kinkDelta) * (180 / Math.PI))}°`;
                return;
              }

              let deltaAngle = StudioGeometry.normalizeAngle(cursorAngle - naturalAngle);
              const isSnapped = Math.abs(deltaAngle) < 0.087;
              if (isSnapped) { deltaAngle = 0; v.isExplicitTangent = false; }
              else { v.isExplicitTangent = true; }

              v.tangentAngleOffset = deltaAngle;
              this.component.commitCurveGeometryUpdate();

              const curAng = naturalAngle + deltaAngle;
              const newEnd = [pt[0] + Math.cos(curAng) * rayLength, pt[1] + Math.sin(curAng) * rayLength];
              line.setAttribute('x2', newEnd[0]); line.setAttribute('y2', newEnd[1]);
              fatHitArea.setAttribute('cx', newEnd[0]); fatHitArea.setAttribute('cy', newEnd[1]);
              handleNode.setAttribute('cx', newEnd[0]); handleNode.setAttribute('cy', newEnd[1]);
              handleNode.setAttribute('fill', v.isExplicitTangent ? '#ffd700' : '#00f2fe');

              if (oppLine) {
                const oppAng = curAng + Math.PI;
                oppLine.setAttribute('x2', pt[0] + Math.cos(oppAng) * (rayLength * 0.75));
                oppLine.setAttribute('y2', pt[1] + Math.sin(oppAng) * (rayLength * 0.75));
              }

              if (Math.abs(deltaAngle) > 0.005 || isSnapped) {
                baselineLine.style.display = 'block';
                angleArc.style.display = 'block';
                const aEnd = [pt[0] + Math.cos(curAng) * arcR, pt[1] + Math.sin(curAng) * arcR];
                angleArc.setAttribute('d', `M ${arcStart[0]} ${arcStart[1]} A ${arcR} ${arcR} 0 0 ${deltaAngle > 0 ? 1 : 0} ${aEnd[0]} ${aEnd[1]}`);

                degreeBadgeGroup.style.display = 'block';
                const liveDeg = Math.round(deltaAngle * (180 / Math.PI));
                const liveX = pt[0] + Math.cos(curAng) * textRadius;
                const liveY = pt[1] + Math.sin(curAng) * textRadius;
                const bw = isSnapped ? 68 : 44;
                badgeBackdrop.setAttribute('x', liveX - bw / 2); badgeBackdrop.setAttribute('y', liveY - 9);
                badgeBackdrop.setAttribute('width', bw);
                badgeBackdrop.setAttribute('stroke', isSnapped ? '#00f2fe' : '#ffd700');
                degreeLabel.setAttribute('x', liveX); degreeLabel.setAttribute('y', liveY + 3.5);
                degreeLabel.setAttribute('fill', isSnapped ? '#00f2fe' : '#ffd700');
                degreeLabel.textContent = isSnapped ? '⚡ 0° SNAP' : `${liveDeg > 0 ? '+' : ''}${liveDeg}°`;
              } else {
                baselineLine.style.display = 'none';
                angleArc.style.display = 'none';
                degreeBadgeGroup.style.display = 'none';
              }
            };

            const onRayUp = () => {
              draggingRay = false;
              this._isDraggingRay = false;
              if (collinearGuide) { collinearGuide.remove(); collinearGuide = null; }
              window.removeEventListener('mousemove', onRayMove);
              window.removeEventListener('mouseup', onRayUp);
              if (isInterior && v.isCusp && snappedToSmooth && collinearSmoothDir) {
                StudioGeometry.setVertexCuspState(vertices, knotIdx, false, collinearSmoothDir);
                this.component.commitCurveGeometryUpdate();
                this.component.showKnotToast('● Snapped 0° Smooth Point');
              }
              this.exposeHandles(curveRecord, controlsLayer, stageState);
              this.component.updateDynamicKeyInHUD();
            };

            window.addEventListener('mousemove', onRayMove);
            window.addEventListener('mouseup', onRayUp);
          });

          g.append(line, handleGroup);
        };

        if (isStart && v.controlPoints[1]) {
          const dir = StudioGeometry.normalize([pt[0] - v.controlPoints[1][0], pt[1] - v.controlPoints[1][1]]);
          attachWingHandle('out', dir, [-forwardNatural[0], -forwardNatural[1]], Boolean(v.isExplicitTangent && Math.abs(v.tangentAngleOffset || 0) > 0.005));
        } else if (isTail && v.controlPoints[0]) {
          const dir = StudioGeometry.normalize([pt[0] - v.controlPoints[0][0], pt[1] - v.controlPoints[0][1]]);
          attachWingHandle('in', dir, forwardNatural, Boolean(v.isExplicitTangent && Math.abs(v.tangentAngleOffset || 0) > 0.005));
        } else if (isInterior) {
          const outDir = StudioGeometry.normalize([v.controlPoints[1][0] - pt[0], v.controlPoints[1][1] - pt[1]]);
          if (v.isCusp) {
            const inDir = StudioGeometry.normalize([v.controlPoints[0][0] - pt[0], v.controlPoints[0][1] - pt[1]]);
            attachWingHandle('in', inDir, v._naturalInTangent || [-1, 0], Math.abs(v.cuspInAngleOffset || 0) > 0.01);
            attachWingHandle('out', outDir, v._naturalOutTangent || [1, 0], Math.abs(v.cuspOutAngleOffset || 0) > 0.01);
          } else {
            const isExp = Boolean(v.isExplicitTangent && Math.abs(v.tangentAngleOffset || 0) > 0.005);
            attachWingHandle('out', outDir, forwardNatural, isExp);
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
      const existing = document.getElementById('qa-knot-context-menu');
      if (existing) existing.remove();

      if (!this._lastKnotAction) this._lastKnotAction = 'delete';

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
      });

      const actions = [
        { id: 'delete', label: '🗑️ Delete Knot', key: 'Del', isDefault: (this._lastKnotAction === 'delete') },
        { id: 'tangent', label: '📐 Adjust Tangency', key: '[ / ]', isDefault: (this._lastKnotAction === 'tangent') },
        { id: 'curvature', label: '〰️ Tune Curvature', key: '+ / -', isDefault: (this._lastKnotAction === 'curvature') },
        { id: 'balance', label: '⚖️ Cycle Balance', key: 'B', isDefault: (this._lastKnotAction === 'balance') },
        { id: 'cusp', label: '⚡ Toggle Cusp (Corner)', key: 'C', isDefault: (this._lastKnotAction === 'cusp') },
        { id: 'straighten', label: '📏 Straighten Line', key: 'S', isDefault: (this._lastKnotAction === 'straighten') }
      ];

      const executeAction = (actId) => {
        this._lastKnotAction = actId;
        menu.remove();
        document.removeEventListener('pointerdown', onOutClick);

        if (actId === 'delete') {
          this.deleteKnotAtIndex(curveRecord, knotIdx, this.component.controlsLayer, this.component.stageState);
        } else if (actId === 'tangent') {
          this.component._activeKnotIdx = knotIdx;
          this.renderOutboundTangentRay(curveRecord, knotIdx, this.component.controlsLayer, this.component.stageState);
        } else if (actId === 'curvature') {
          this.cycleKnotCurvature(curveRecord.vertices[knotIdx]);
        } else if (actId === 'balance') {
          this.cycleKnotBalance(curveRecord.vertices[knotIdx]);
        } else if (actId === 'cusp') {
          this.component._activeKnotIdx = knotIdx;
          this.component.executeKeyInCommand('toggle_cusp');
        } else if (actId === 'straighten') {
          this.component.executeKeyInCommand('straighten');
        }
      };

      actions.forEach(act => {
        const row = makeElement('div', {
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 8px', borderRadius: '4px', cursor: 'pointer',
            background: act.isDefault ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
            border: act.isDefault ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid transparent',
            color: act.isDefault ? '#00f2fe' : '#f8fafc',
            fontWeight: act.isDefault ? 'bold' : 'normal'
          },
          onmouseenter: (e) => { e.currentTarget.style.background = 'rgba(0, 242, 254, 0.2)'; },
          onmouseleave: (e) => { e.currentTarget.style.background = act.isDefault ? 'rgba(0, 242, 254, 0.15)' : 'transparent'; },
          onclick: (e) => {
            e.stopPropagation();
            executeAction(act.id);
          }
        }, [
          makeElement('span', {}, act.isDefault ? `★ ${act.label}` : act.label),
          makeElement('span', { style: { color: '#64748b', fontSize: '9.5px' } }, act.key)
        ]);
        menu.appendChild(row);
      });

      document.body.appendChild(menu);

      const onOutClick = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('pointerdown', onOutClick);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', onOutClick), 60);
    }
}

globalThis.QuoraKnotManager = QuoraKnotManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraKnotManager;