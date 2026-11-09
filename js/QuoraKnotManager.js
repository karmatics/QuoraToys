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
        const isEndpoint = (idx === 0 || idx === vertices.length - 1);
        const isSelected = this.component._selectedKnotIndices.has(idx);
        const isDeleteTarget = (idx === this._hoveredDeleteKnotIdx);
        const isCusp = Boolean(v.isCusp);

        const fatTarget = makeElement('svg:circle', {
          cx: v.point[0], cy: v.point[1], r: '14', fill: 'transparent',
          style: { cursor: 'move', pointerEvents: 'all' },
          title: isCusp ? '⚡ Cusp point (Sharp Corner) • Press C to rejoin as smooth curve' : 'Click to drag point • Shift-click to multi-select'
        });

        let nodeMarker;
        if (isCusp) {
          nodeMarker = makeElement('svg:rect', {
            x: v.point[0] - (isSelected ? 5.5 : 4.5),
            y: v.point[1] - (isSelected ? 5.5 : 4.5),
            width: isSelected ? '11' : '9',
            height: isSelected ? '11' : '9',
            rx: '1.5',
            transform: `rotate(45, ${v.point[0]}, ${v.point[1]})`,
            fill: isSelected ? '#00f2fe' : '#f59e0b',
            stroke: '#ffffff',
            'stroke-width': isSelected ? '2' : '1.2',
            className: 'qa-on-curve-knot-handle',
            style: {
              pointerEvents: 'none',
              filter: isSelected ? 'drop-shadow(0 0 8px #00f2fe)' : 'drop-shadow(0 0 6px #f59e0b)'
            }
          });
        } else if (isTip || isTail) {
          nodeMarker = makeElement('svg:circle', {
            cx: v.point[0], cy: v.point[1],
            r: isDeleteTarget ? '6' : (isSelected ? '5' : '3.8'),
            fill: isDeleteTarget ? '#f59e0b' : (isSelected ? '#00f2fe' : 'none'),
            stroke: isDeleteTarget ? '#ffffff' : (isSelected ? '#00f2fe' : '#ffd700'),
            'stroke-width': isSelected ? '2.5' : '1.5',
            className: 'qa-on-curve-knot-handle',
            style: {
              pointerEvents: 'none',
              filter: isDeleteTarget ? 'drop-shadow(0 0 6px #f59e0b)' : (isSelected ? 'drop-shadow(0 0 8px #00f2fe)' : 'none')
            }
          });
        } else {
          nodeMarker = makeElement('svg:circle', {
            cx: v.point[0], cy: v.point[1],
            r: isDeleteTarget ? '6.5' : (isSelected ? '6.0' : '3.5'),
            fill: isDeleteTarget ? '#f59e0b' : (isSelected ? '#00f2fe' : '#00e676'),
            stroke: '#ffffff',
            'stroke-width': isSelected ? '2.2' : '1.2',
            className: 'qa-on-curve-knot-handle',
            style: {
              pointerEvents: 'none',
              filter: isDeleteTarget ? 'drop-shadow(0 0 8px #f59e0b)' : (isSelected ? 'drop-shadow(0 0 10px #00f2fe)' : 'none')
            }
          });
        }

        // Endpoint Hover: Immediately project the tangency line with grace corridor
        if (isEndpoint) {
          fatTarget.addEventListener('mouseenter', () => {
            if (this._isDraggingKnot || this._isDraggingRay) return;
            if (this._endpointRayHideTimer) {
              clearTimeout(this._endpointRayHideTimer);
              this._endpointRayHideTimer = null;
            }
            this.component._activeKnotIdx = idx;
            this.renderOutboundTangentRay(curveRecord, idx, controlsLayer, stageState);
          });

          fatTarget.addEventListener('mouseleave', () => {
            if (this._isDraggingKnot || this._isDraggingRay) return;
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
          this.deleteKnotAtIndex(curveRecord, idx, controlsLayer, stageState);
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
          if (origBeziers) {
            curveRecord.beziers = JSON.parse(JSON.stringify(origBeziers));
          }

          if (ghostCurveEl) {
            ghostCurveEl.remove();
            ghostCurveEl = null;
          }

          window.removeEventListener('mousemove', onDrag);
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('keydown', onKeyDownCancel);
          window.removeEventListener('contextmenu', onContextMenuCancel, true);

          this.component.commitCurveGeometryUpdate();
          this.exposeHandles(curveRecord, controlsLayer, stageState);
          this.component.showKnotToast('↺ Reverted to previous curve state');
        };

        const onKeyDownCancel = (ev) => {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            cancelAndRevertDrag();
          }
        };

        const onContextMenuCancel = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          cancelAndRevertDrag();
        };

        fatTarget.addEventListener('mousedown', (e) => {
          if (e.button === 2) return;
          e.stopPropagation();

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
          this._isDraggingKnot = true;

          if (!v.isExplicitTangent && !v.isCusp) {
            v.tangentAngleOffset = 0;
            v.curvature = 1.0;
            v.balance = 1.0;
          }
          if (vertices[idx - 1] && !vertices[idx - 1].isExplicitTangent && !vertices[idx - 1].isCusp) {
            vertices[idx - 1].tangentAngleOffset = 0;
            vertices[idx - 1].curvature = 1.0;
            vertices[idx - 1].balance = 1.0;
          }
          if (vertices[idx + 1] && !vertices[idx + 1].isExplicitTangent && !vertices[idx + 1].isCusp) {
            vertices[idx + 1].tangentAngleOffset = 0;
            vertices[idx + 1].curvature = 1.0;
            vertices[idx + 1].balance = 1.0;
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

          const currentPathD = curveRecord.elements[1]?.querySelector('path')?.getAttribute('d') ||
                                curveRecord.elements[1]?.getAttribute('d');

          const existingGhost = document.getElementById('qa-drag-ghost-curve');
          if (existingGhost) existingGhost.remove();

          ghostCurveEl = makeElement('svg:path', {
            id: 'qa-drag-ghost-curve',
            d: currentPathD,
            fill: 'none',
            stroke: 'rgba(0, 242, 254, 0.25)',
            'stroke-width': '12',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-dasharray': '8,6',
            style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(0, 242, 254, 0.4))' }
          });
          this.component.glowLayer.appendChild(ghostCurveEl);

          startPtsMap.clear();
          this.component._selectedKnotIndices.forEach(kIdx => {
            const kv = vertices[kIdx];
            if (kv) startPtsMap.set(kIdx, [kv.point[0], kv.point[1]]);
          });

          const startClientX = e.clientX;
          const startClientY = e.clientY;

          controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

          window.addEventListener('keydown', onKeyDownCancel);
          window.addEventListener('contextmenu', onContextMenuCancel, true);

          // Hardware accelerated 60 FPS update (does NOT wipe canvas on each move)
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

            this.component.commitCurveGeometryUpdate();
            this.renderOutboundTangentRay(curveRecord, idx, controlsLayer, stageState);
          };

          const onUp = () => {
            dragging = false;
            this._isDraggingKnot = false;
            if (ghostCurveEl) {
              ghostCurveEl.remove();
              ghostCurveEl = null;
            }
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
      const rayLength = 52;
      const isStart = (knotIdx === 0);
      const isTail = (knotIdx === vertices.length - 1);
      const isInterior = (!isStart && !isTail);

      // Compute tangent directly from the curve's actual Bézier control points
      let tangentRayDir = [1, 0];
      if (isStart && v.controlPoints[1]) {
        const dx = pt[0] - v.controlPoints[1][0];
        const dy = pt[1] - v.controlPoints[1][1];
        const len = Math.hypot(dx, dy) || 1;
        tangentRayDir = [dx / len, dy / len];
      } else if (isTail && v.controlPoints[0]) {
        const dx = pt[0] - v.controlPoints[0][0];
        const dy = pt[1] - v.controlPoints[0][1];
        const len = Math.hypot(dx, dy) || 1;
        tangentRayDir = [dx / len, dy / len];
      } else if (v.controlPoints[1]) {
        const dx = v.controlPoints[1][0] - pt[0];
        const dy = v.controlPoints[1][1] - pt[1];
        const len = Math.hypot(dx, dy) || 1;
        tangentRayDir = [dx / len, dy / len];
      }

      const actualAngle = Math.atan2(tangentRayDir[1], tangentRayDir[0]);

      // Natural counterfactual baseline for magnetic snapping
      const forwardNatural = (typeof UpdateControlPoints !== 'undefined' && typeof UpdateControlPoints.computeCounterfactualTangent === 'function')
        ? UpdateControlPoints.computeCounterfactualTangent(vertices, knotIdx)
        : [1, 0];

      const naturalRayDir = isStart ? [-forwardNatural[0], -forwardNatural[1]] : forwardNatural;
      const naturalAngle = Math.atan2(naturalRayDir[1], naturalRayDir[0]);

      let offsetRad = actualAngle - naturalAngle;
      while (offsetRad > Math.PI) offsetRad -= Math.PI * 2;
      while (offsetRad < -Math.PI) offsetRad += Math.PI * 2;

      const isExplicit = Boolean(v.isExplicitTangent && Math.abs(offsetRad) > 0.005);

      const g = makeElement('svg:g', { id: 'qa-outbound-tangent-ray' });

      g.addEventListener('mouseenter', () => {
        this._isOverRay = true;
        if (this._endpointRayHideTimer) {
          clearTimeout(this._endpointRayHideTimer);
          this._endpointRayHideTimer = null;
        }
      });

      g.addEventListener('mouseleave', () => {
        this._isOverRay = false;
      });

      // Baseline guide when explicitly altered
      if (isExplicit) {
        const naturalEnd = [pt[0] + Math.cos(naturalAngle) * (rayLength - 8), pt[1] + Math.sin(naturalAngle) * (rayLength - 8)];
        g.appendChild(makeElement('svg:line', {
          x1: pt[0], y1: pt[1], x2: naturalEnd[0], y2: naturalEnd[1],
          stroke: 'rgba(255, 255, 255, 0.22)', 'stroke-width': '1.0', 'stroke-dasharray': '2,3',
          style: { pointerEvents: 'none' }
        }));

        const arcR = 24;
        const arcStart = [pt[0] + Math.cos(naturalAngle) * arcR, pt[1] + Math.sin(naturalAngle) * arcR];
        const arcEnd = [pt[0] + Math.cos(actualAngle) * arcR, pt[1] + Math.sin(actualAngle) * arcR];
        const sweepFlag = (offsetRad > 0) ? 1 : 0;
        const arcD = `M ${arcStart[0]} ${arcStart[1]} A ${arcR} ${arcR} 0 0 ${sweepFlag} ${arcEnd[0]} ${arcEnd[1]}`;

        g.appendChild(makeElement('svg:path', {
          d: arcD, fill: 'none', stroke: 'rgba(255, 215, 0, 0.45)', 'stroke-width': '1.2',
          style: { pointerEvents: 'none' }
        }));

        const deg = Math.round(offsetRad * (180 / Math.PI));
        const midAngle = naturalAngle + (offsetRad / 2);
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
          stroke: isExplicit ? 'rgba(255, 215, 0, 0.4)' : 'rgba(56, 189, 248, 0.32)',
          'stroke-width': '1.0', 'stroke-dasharray': '3,3', 'stroke-linecap': 'round',
          style: { pointerEvents: 'none' }
        }));
      }

      const rayEnd = [pt[0] + Math.cos(actualAngle) * rayLength, pt[1] + Math.sin(actualAngle) * rayLength];

      const line = makeElement('svg:line', {
        x1: pt[0], y1: pt[1], x2: rayEnd[0], y2: rayEnd[1],
        stroke: isExplicit ? '#ffd700' : 'rgba(56, 189, 248, 0.45)',
        'stroke-width': '1.0', 'stroke-linecap': 'round',
        style: { pointerEvents: 'none' }
      });

      const handle = makeElement('svg:rect', {
        x: rayEnd[0] - 3.5, y: rayEnd[1] - 3.5, width: '7', height: '7', rx: '1.2',
        transform: `rotate(45, ${rayEnd[0]}, ${rayEnd[1]})`,
        fill: isExplicit ? '#ffd700' : '#38bdf8',
        stroke: '#090d16', 'stroke-width': '1.2',
        style: { cursor: 'crosshair', filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' },
        title: isExplicit ? 'Explicitly locked tangent • Double-click to reset to natural baseline' : 'Implicit baseline tangent • Drag to set explicit angle'
      });

      handle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        v.tangentAngleOffset = 0;
        v.isExplicitTangent = false;
        this.component.commitCurveGeometryUpdate();
        this.exposeHandles(curveRecord, controlsLayer, stageState);
        this.component.showKnotToast('⚡ Reset to Natural Baseline (Implicit)');
      });

      let draggingRay = false;
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        draggingRay = true;
        this._isDraggingRay = true;

        controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

        // Direct in-place DOM updates during drag to avoid continuous node destruction
        const onRayMove = (ev) => {
          if (!draggingRay) return;
          const rect = this.component.stageBox.getBoundingClientRect();
          const z = stageState.zoom || 1.0;
          const mX = (ev.clientX - rect.left) / z;
          const mY = (ev.clientY - rect.top) / z;

          const cursorAngle = Math.atan2(mY - pt[1], mX - pt[0]);
          let deltaAngle = cursorAngle - naturalAngle;

          while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
          while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

          if (Math.abs(deltaAngle) < 0.087) {
            deltaAngle = 0;
            v.isExplicitTangent = false;
            this.component.showKnotToast('⚡ Snapped to Baseline (Natural)');
          } else {
            v.isExplicitTangent = true;
          }

          v.tangentAngleOffset = deltaAngle;
          this.component.commitCurveGeometryUpdate();

          const curAng = naturalAngle + deltaAngle;
          const newEnd = [pt[0] + Math.cos(curAng) * rayLength, pt[1] + Math.sin(curAng) * rayLength];
          line.setAttribute('x2', newEnd[0]);
          line.setAttribute('y2', newEnd[1]);
          handle.setAttribute('x', newEnd[0] - 3.5);
          handle.setAttribute('y', newEnd[1] - 3.5);
          handle.setAttribute('transform', `rotate(45, ${newEnd[0]}, ${newEnd[1]})`);
          handle.setAttribute('fill', v.isExplicitTangent ? '#ffd700' : '#38bdf8');
        };

        const onRayUp = () => {
          draggingRay = false;
          this._isDraggingRay = false;
          window.removeEventListener('mousemove', onRayMove);
          window.removeEventListener('mouseup', onRayUp);
          this.renderOutboundTangentRay(curveRecord, knotIdx, controlsLayer, stageState);
          this.renderSegmentMidpointIndicators(curveRecord, controlsLayer, stageState);
          this.component.updateDynamicKeyInHUD();
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

  updateDynamicMidpointCandidate(curveRecord, controlsLayer, stageState) {
    controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

    // STRICT SUPPRESSION: Never show virtual divider points if moving or in non-pick situations
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
    let minDistance = 45; // Must be within 45px proximity to candidate segment
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
      title: `Click or drag to split segment ${closestSegIdx + 1} with a new knot`
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
    let newKnot = null;

    g.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isDraggingMid = true;

      controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());

      if (!curveRecord.vertices || curveRecord.vertices.length === 0) {
        curveRecord.vertices = this.component.beziersToVertices(curveRecord.beziers);
      }

      newKnot = new BezierVertex([closestMidPt[0], closestMidPt[1]]);
      newKnot.curvature = 1.0;
      newKnot.balance = 1.0;
      newKnot.tangentAngleOffset = 0;

      curveRecord.vertices.splice(closestSegIdx + 1, 0, newKnot);
      this.component._activeKnotIdx = closestSegIdx + 1;

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
        this.exposeHandles(curveRecord, controlsLayer, stageState);
        this.component.showKnotToast(`✓ Inserted knot #${closestSegIdx + 2}`);
      };

      window.addEventListener('mousemove', onMidDrag);
      window.addEventListener('mouseup', onMidUp);
    });

    g.append(hitArea, dot);
    controlsLayer.appendChild(g);
  }
}

globalThis.QuoraKnotManager = QuoraKnotManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraKnotManager;