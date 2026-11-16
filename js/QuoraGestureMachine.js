/**
 * QuoraGestureMachine
 * Pure, encapsulated gesture engine for QuoraToys:
 * • Touchdown deadzone radius detection (R = 32px)
 * • Kinetic drawstring tether dampening
 * • Shift-key constrained ruler-straight arrows & lines
 * • Direct curve segment grabbing & rubber-wire bending
 * • Open-curve endpoint extension & auto-closing loop snapping
 * • Tether-Clutch Hand-Rest pause machine (Ctrl key)
 * • Shift+Drag marquee multi-knot selection
 * • Spatial hover detection & ephemeral knot pick targets
 */
class QuoraGestureMachine {

  constructor(component) {
      this.component = component;
      this.isDrawing = false;
      this.isMarquee = false;
      this.marqueeStart = null;
      this.strokePoints = [];
      this.startPt = null;
      this.hasExceededDeadzone = false;
      this.extendingCurve = null;
      this.extendAtTail = true;

      this.deadzoneCircle = null;
      this.cursorEraseCircle = null;
      this.tipPointIndicator = null;
      this.activeTetherLine = null;
      this.cuspMarkersGroup = null;
      this.pauseTimer = null;
      this._prevCursorPt = null;
      this.tetherState = { cuspIndices: [], inSlackRedirect: false, slackIncomingDir: null, cuspAngleDeg: 45 };
    }

  init(svgSurface, stageBox) {
        this.svgSurface = svgSurface;
        this.stageBox = stageBox;
        const pointerHost = this.component.viewport || svgSurface;

        pointerHost.addEventListener('mousedown', (e) => {
          if (e.button === 1 || (e.button === 0 && this.component._isSpaceDown)) return;
          if (e.target.closest('.qa-edge-handle, #qa-knot-mod-toast, #qa-curve-analysis-hud')) return;
          this.onMouseDown(e);
        });
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        pointerHost.addEventListener('contextmenu', (e) => this.onContextMenu(e));

        pointerHost.addEventListener('wheel', (e) => {
          if (this.isDrawing) {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY < 0 ? 0.5 : -0.5;
            const curW = this.component.stageState.curveStrokeWidth || 3.2;
            const nextW = Math.max(1.0, Math.min(24.0, Math.round((curW + delta) * 10) / 10));
            this.component.stageState.curveStrokeWidth = nextW;

            if (this.component.widthValueLbl) {
              this.component.widthValueLbl.textContent = `${nextW}px`;
            }

            const z = this.component.stageState.cadStrokeMode ? (this.component.stageState.zoom || 1.0) : 1.0;
            const curWComp = nextW / z;

            if (this.svgSurface._preview) {
              this.svgSurface._preview.setAttribute('stroke-width', String(curWComp));
            }
            if (this.svgSurface._previewGlow) {
              this.svgSurface._previewGlow.setAttribute('stroke-width', String((nextW + 10) / z));
            }

            this.component.showKnotToast(`Width: ${nextW}px`);
          }
        }, { passive: false });

        window.addEventListener('keydown', (e) => {
          if (!this.isDrawing) return;
          if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

          if (['1', '2', '3', '4', '5', '6'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const paletteMap = {
              '1': '#00f2fe', '2': '#00e676', '3': '#ffd700',
              '4': '#ff2d55', '5': '#c084fc', '6': '#ffffff'
            };
            const chosen = paletteMap[e.key];
            if (chosen) {
              e.preventDefault();
              this.component.stageState.currentColor = chosen;
              if (this.component.colorIndicatorDot) this.component.colorIndicatorDot.style.background = chosen;
              if (this.svgSurface._preview) this.svgSurface._preview.setAttribute('stroke', chosen);
              if (this.svgSurface._previewGlow) this.svgSurface._previewGlow.setAttribute('stroke', chosen);
              if (this.svgSurface._previewArrow) this.svgSurface._previewArrow.setAttribute('stroke', chosen);
              this.component.showKnotToast(`Color: ${chosen} (Key ${e.key})`);
              return;
            }
          }

          if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            this.component.stageState.hasArrow = !this.component.stageState.hasArrow;
            if (this.component.arrowModeBtns) {
              const m = this.component.stageState.hasArrow ? 'tip' : 'none';
              this.component.stageState.arrowMode = m;
              Object.entries(this.component.arrowModeBtns).forEach(([k, b]) => b.classList.toggle('primary', k === m));
            }
            if (!this.component.stageState.hasArrow) {
              if (this.svgSurface._previewArrow) {
                this.svgSurface._previewArrow.remove();
                this.svgSurface._previewArrow = null;
              }
              if (this.svgSurface._previewArrowGlow) {
                this.svgSurface._previewArrowGlow.remove();
                this.svgSurface._previewArrowGlow = null;
              }
            }
            this.component.showKnotToast(`Arrowhead: ${this.component.stageState.hasArrow ? 'ON' : 'OFF'}`);
            return;
          }
        });
      }
  getStagePt(e) {
    const rect = this.stageBox.getBoundingClientRect();
    const z = this.component.stageState.zoom || 1.0;
    return [(e.clientX - rect.left) / z, (e.clientY - rect.top) / z];
  }

  cleanupGestureIndicators() {
      if (this.pauseTimer) clearTimeout(this.pauseTimer);
      if (this.deadzoneCircle) { this.deadzoneCircle.remove(); this.deadzoneCircle = null; }
      if (this.cursorEraseCircle) { this.cursorEraseCircle.remove(); this.cursorEraseCircle = null; }
      if (this.tipPointIndicator) { this.tipPointIndicator.remove(); this.tipPointIndicator = null; }
      if (this.activeTetherLine) { this.activeTetherLine.remove(); this.activeTetherLine = null; }
      if (this.cuspMarkersGroup) { this.cuspMarkersGroup.remove(); this.cuspMarkersGroup = null; }
      if (this.svgSurface && this.svgSurface._preview) { this.svgSurface._preview.remove(); this.svgSurface._preview = null; }
      if (this.svgSurface && this.svgSurface._previewGlow) { this.svgSurface._previewGlow.remove(); this.svgSurface._previewGlow = null; }
      if (this.svgSurface && this.svgSurface._previewArrow) { this.svgSurface._previewArrow.remove(); this.svgSurface._previewArrow = null; }
      if (this.svgSurface && this.svgSurface._previewArrowShadow) { this.svgSurface._previewArrowShadow.remove(); this.svgSurface._previewArrowShadow = null; }
      if (this.svgSurface && this.svgSurface._previewArrowGlow) { this.svgSurface._previewArrowGlow.remove(); this.svgSurface._previewArrowGlow = null; }

      this._prevCursorPt = null;

      const dial = document.getElementById('qa-transient-cursor-dial');
      if (dial) dial.remove();
      const clutch = document.getElementById('qa-clutch-rest-badge');
      if (clutch) clutch.remove();

      if (this.component && this.component.inSituHud) {
        this.component.inSituHud.hideCursorReticle();
        this.component.inSituHud.hideTransientCursorDial();
      }
    }
  onMouseDown(e) {
          if (e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle-group, .qa-segment-midpoint-group, .qa-movable-label-group, .qa-image-plate-control, #qa-keyin-matrix-hud, #qa-transient-cursor-dial, .qa-selectable-callout, .qa-movable-text-badge, #qa-knot-context-menu, #qa-inline-tail-editor, #qa-callout-editor-dock, #qa-export-bounds-overlay')) return;

          if (this.component._commitActiveInlineEditor) {
            this.component._commitActiveInlineEditor();
          }

          const pt = this.getStagePt(e);
          this.component._lastStageMousePt = pt;
          const isPaintMode = (this.component.stageState.activeTool === 'paint');

          if (this.component._isDefiningExportRect) {
            this._isDrawingExportRect = true;
            this._exportRectStart = pt;
            let preview = document.getElementById('qa-export-rect-preview');
            if (!preview) {
              preview = makeElement('svg:rect', {
                id: 'qa-export-rect-preview', x: pt[0], y: pt[1], width: 0, height: 0,
                fill: 'rgba(255, 215, 0, 0.12)', stroke: '#ffd700', 'stroke-width': '2', 'stroke-dasharray': '6,4',
                style: { pointerEvents: 'none' }
              });
              this.component.controlsLayer.appendChild(preview);
            }
            return;
          }

          if (e.shiftKey && this.component.getActiveCurve() && !this.isDrawing && !isPaintMode) {
            const hitCurve = this.component.findNearestCurveAtPoint(pt, 16);
            if (!hitCurve) {
              this.isMarquee = true;
              this.marqueeStart = pt;
              let marqueeEl = document.getElementById('qa-marquee-box');
              if (!marqueeEl) {
                marqueeEl = makeElement('svg:rect', {
                  id: 'qa-marquee-box', x: pt[0], y: pt[1], width: 0, height: 0,
                  fill: 'rgba(0, 242, 254, 0.08)', stroke: '#00f2fe', 'stroke-width': '1.5', 'stroke-dasharray': '4,3',
                  style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 4px rgba(0,242,254,0.5))' }
                });
                this.component.controlsLayer.appendChild(marqueeEl);
              }
              return;
            }
          }

          if (!isPaintMode) {
            const hitCurve = this.component.findNearestCurveAtPoint(pt, 24);
            if (hitCurve) {
              const closestKnotIdx = (hitCurve.t < 0.5) ? hitCurve.segIdx : Math.min((hitCurve.ann.vertices?.length || 1) - 1, hitCurve.segIdx + 1);
              this.component._activeKnotIdx = closestKnotIdx;
              if (!this.component._selectedKnotIndices) this.component._selectedKnotIndices = new Set();
              this.component._selectedKnotIndices.clear();
              this.component._selectedKnotIndices.add(closestKnotIdx);

              this.component.selectItem(hitCurve.ann);
              this.component.updateDynamicMidpointCandidate?.(hitCurve.ann);

              // Whole-entity move: Alt/Meta+Drag, or the panel's "Move whole" mode
              const altHeld = Boolean(e.altKey || e.metaKey);
              const isWholeMove = Boolean(altHeld || this.component.stageState.moveWholeMode);
              const originalVertices = hitCurve.ann.vertices.map(v => [v.point[0], v.point[1]]);

              this._pendingBend = {
                curve: hitCurve.ann, segIdx: hitCurve.segIdx, startPt: pt,
                inserted: false, didDrag: false, isWholeMove, originalVertices
              };
              if (isWholeMove) {
                this.component.showKnotToast(altHeld
                  ? '↔ Moving whole entity (Alt+Drag)'
                  : '✥ Move mode: dragging whole entity');
              }
              return;
            }
            this._pendingBend = null;

            const hitPlate = this.component.hitTestImagePlate(pt);
            if (hitPlate && !e.shiftKey) {
              this.component.stageState.activeImage = hitPlate;
              this.component.stageState.selectedItem = null;
              this.component.controlsLayer.innerHTML = '';
              this.component.renderStage();
              return;
            }

            const curCurve = this.component.getActiveCurve();
            if (curCurve && curCurve.vertices && curCurve.vertices.length >= 2 && !curCurve.isClosed) {
              const vHead = curCurve.vertices[0].point;
              const vTail = curCurve.vertices[curCurve.vertices.length - 1].point;
              if (Math.hypot(pt[0] - vTail[0], pt[1] - vTail[1]) < 20) {
                this.extendingCurve = curCurve; this.extendAtTail = true;
                this.component.showKnotToast('↔ Extending curve from tail...');
              } else if (Math.hypot(pt[0] - vHead[0], pt[1] - vHead[1]) < 20) {
                this.extendingCurve = curCurve; this.extendAtTail = false;
                this.component.showKnotToast('↔ Extending curve from head...');
              } else {
                this.extendingCurve = null;
              }
            } else {
              this.extendingCurve = null;
            }
          }

          if (this.component.stageState.activeTool === 'text') {
            this.component.promptDirectTextBadge(pt[0], pt[1]);
            return;
          }

          if (this.component._handRestActive) {
            this.component._handRestActive = false;
            this.isDrawing = true;
            this.component._isDrawingActive = true;
            this._prevCursorPt = pt;
            this.component.hideClutchHandRestBadge();
            return;
          }

          if (!isPaintMode) {
            const hadSelection = Boolean(this.component.stageState.selectedItem || this.component.stageState.activeImage);
            if (hadSelection && !this.extendingCurve) this.component.deselectAll();
          }

          this.cleanupGestureIndicators();
          this.isDrawing = true;
          this.component._isDrawingActive = true;
          this.startPt = pt;
          this._prevCursorPt = pt;
          this.hasExceededDeadzone = false;
          this.strokePoints = [pt];
          this.tetherState = { cuspIndices: [], inSlackRedirect: false, slackIncomingDir: null, cuspAngleDeg: 45 };
          this._lastErasePt = pt;

          if (isPaintMode && this.component.stageState.brushMode === 'erase') {
            const plate = this.component.hitTestImagePlate(pt) || this.component.stageState.activeImage || this.component.stageState.placedImages?.[0];
            if (plate) {
              this.component.imageManager.eraseImagePlatePixels(
                plate, pt[0], pt[1],
                (this.component.stageState.brushSize || 32) / 2,
                this.component.stageState.brushSoftness || 0
              );
            } else {
              this.component.showKnotToast('Drop or paste an image first to erase pixels');
            }
            return;
          }

          if (!isPaintMode) {
            this.deadzoneCircle = makeElement('svg:circle', {
              id: 'qa-deadzone-circle', cx: pt[0], cy: pt[1], r: '6',
              fill: 'rgba(255, 255, 255, 0.15)', stroke: '#00f2fe', 'stroke-width': '1.2', 'stroke-dasharray': '2,2',
              style: { pointerEvents: 'none' }
            });
            this.component.controlsLayer.appendChild(this.deadzoneCircle);

            this.tipPointIndicator = makeElement('svg:circle', {
              id: 'qa-tip-point', cx: pt[0], cy: pt[1], r: '3.5', fill: '#ffffff',
              stroke: '#00e676', 'stroke-width': '1.5', style: { pointerEvents: 'none' }
            });
            this.component.controlsLayer.appendChild(this.tipPointIndicator);
          }
        }
  onMouseMove(e) {
    try {
      const comp = this.component;
      const st = comp.stageState;
      const pt = this.getStagePt(e);
      comp._lastStageMousePt = pt;

      if (this._isDrawingExportRect && this._exportRectStart) {
        const preview = document.getElementById('qa-export-rect-preview');
        if (preview) {
          preview.setAttribute('x', Math.min(this._exportRectStart[0], pt[0]));
          preview.setAttribute('y', Math.min(this._exportRectStart[1], pt[1]));
          preview.setAttribute('width', Math.abs(pt[0] - this._exportRectStart[0]));
          preview.setAttribute('height', Math.abs(pt[1] - this._exportRectStart[1]));
        }
        return;
      }

      if (this.isMarquee && this.marqueeStart) {
        const box = document.getElementById('qa-marquee-box');
        if (box) {
          box.setAttribute('x', Math.min(this.marqueeStart[0], pt[0]));
          box.setAttribute('y', Math.min(this.marqueeStart[1], pt[1]));
          box.setAttribute('width', Math.abs(pt[0] - this.marqueeStart[0]));
          box.setAttribute('height', Math.abs(pt[1] - this.marqueeStart[1]));
        }
        return;
      }

      if (this._pendingBend) {
        const b = this._pendingBend;
        const dx = pt[0] - b.startPt[0], dy = pt[1] - b.startPt[1];
        if (Math.hypot(dx, dy) > 3) {
          b.didDrag = true;
          if (b.isWholeMove) {
            b.curve.vertices.forEach((v, idx) => {
              const orig = b.originalVertices[idx];
              if (orig) { v.point[0] = Math.round(orig[0] + dx); v.point[1] = Math.round(orig[1] + dy); }
            });
          } else {
            if (!b.inserted) {
              comp.strokeManager.addKnotOnCurve(b.curve, b.segIdx);
              comp.exposeBezierHandles(b.curve);
              b.inserted = true;
            }
            const k = b.curve.vertices[comp._activeKnotIdx];
            if (k) { k.point[0] = pt[0]; k.point[1] = pt[1]; }
          }
          comp.commitCurveGeometryUpdate();
        }
        return;
      }

      const isPaint = st.activeTool === 'paint';
      let ring = document.getElementById('qa-paint-cursor-ring');
      if (isPaint) {
        if (!ring) {
          ring = makeElement('svg:circle', { id: 'qa-paint-cursor-ring', fill: 'none', style: { pointerEvents: 'none' } });
          comp.controlsLayer.appendChild(ring);
        }
        const isErase = st.brushMode === 'erase';
        ring.setAttribute('cx', pt[0]);
        ring.setAttribute('cy', pt[1]);
        ring.setAttribute('r', String((st.brushSize || 32) / 2));
        ring.setAttribute('stroke', isErase ? '#00f2fe' : '#f59e0b');
        ring.setAttribute('stroke-width', '1.4');
        ring.setAttribute('stroke-dasharray', isErase ? '4,3' : 'none');
      } else if (ring) {
        ring.remove();
      }

      if (!this.isDrawing && !comp._isDrawingActive && !comp.isInteracting() && !comp._penNodes) {
        if (!isPaint) {
          this.updateSpatialHover(pt);
          if (comp.knotManager) {
            comp.knotManager.updateHoveredDeleteTarget(pt);
            const curve = comp.getActiveCurve();
            if (curve) comp.knotManager.updateDynamicMidpointCandidate(curve, comp.controlsLayer, st);
          }
        }
        return;
      }
      this.clearHoverHighlight();
      if (!this.isDrawing) return;
      if (isPaint) return this._handlePaintMove(pt);

      const baseW = st.curveStrokeWidth || 3.2;
      const z = st.cadStrokeMode ? (st.zoom || 1.0) : 1.0;
      const isNeon = st.lineStyle === 'neon';
      const curCol = st.currentColor || '#00e676';

      if (e.shiftKey) {
        this.hasExceededDeadzone = true;
        if (this.deadzoneCircle) { this.deadzoneCircle.remove(); this.deadzoneCircle = null; }
        if (this.cursorEraseCircle) this.cursorEraseCircle.style.display = 'none';
        if (this.cuspMarkersGroup) this.cuspMarkersGroup.innerHTML = '';
        this._prevCursorPt = pt;
        this.strokePoints = [this.startPt, pt];
        this.tetherState = { cuspIndices: [], inSlackRedirect: false, slackIncomingDir: null, cuspAngleDeg: 45 };
        this._renderStrokePreview(`M ${this.startPt[0]} ${this.startPt[1]} L ${pt[0]} ${pt[1]}`, curCol, baseW, z, isNeon, false);
        this._renderArrowPreview(st.hasArrow, this.startPt, pt, curCol, baseW, st.lineStyle);
        return;
      }

      if (!this.hasExceededDeadzone && Math.hypot(pt[0] - this.startPt[0], pt[1] - this.startPt[1]) > 4) {
        this.hasExceededDeadzone = true;
        if (this.deadzoneCircle) { this.deadzoneCircle.remove(); this.deadzoneCircle = null; }
      }
      if (!this.hasExceededDeadzone) {
        if (this.tipPointIndicator) {
          this.tipPointIndicator.setAttribute('cx', this.startPt[0]);
          this.tipPointIndicator.setAttribute('cy', this.startPt[1]);
        }
        this._prevCursorPt = pt;
        return;
      }

      const tetherLen = st.tetherLength || 32;
      const baseEraseR = st.eraseRadius || 20;
      const eraseR = Math.max(8, Math.min(baseEraseR, Math.round(tetherLen * 0.62)));

      if (!this.cursorEraseCircle) {
        this.cursorEraseCircle = makeElement('svg:circle', {
          id: 'qa-cursor-erase-circle', fill: 'rgba(255, 255, 255, 0.03)',
          stroke: 'rgba(255, 255, 255, 0.5)', style: { pointerEvents: 'none' }
        });
        comp.controlsLayer.appendChild(this.cursorEraseCircle);
      }
      this.cursorEraseCircle.style.display = 'block';
      this.cursorEraseCircle.setAttribute('cx', pt[0]);
      this.cursorEraseCircle.setAttribute('cy', pt[1]);
      this.cursorEraseCircle.setAttribute('r', String(eraseR));
      this.cursorEraseCircle.setAttribute('stroke-width', String(1.2 / z));
      this.cursorEraseCircle.setAttribute('stroke-dasharray', `${3 / z},${3 / z}`);

      if (!this.activeTetherLine) {
        this.activeTetherLine = makeElement('svg:line', { id: 'qa-drawstring-line', stroke: 'rgba(255, 255, 255, 0.85)', 'stroke-width': '1.8' });
        comp.controlsLayer.appendChild(this.activeTetherLine);
      }

      if (e.ctrlKey || e.metaKey) {
        comp._clutchActive = true;
        const last = this.strokePoints[this.strokePoints.length - 1];
        const newR = Math.max(12, Math.min(180, Math.hypot(pt[0] - last[0], pt[1] - last[1])));
        st.tetherLength = Math.round(newR);
        this.cursorEraseCircle.setAttribute('r', String(Math.max(8, Math.min(baseEraseR, Math.round(newR * 0.62)))));
        this.cursorEraseCircle.setAttribute('stroke', 'rgba(255, 215, 0, 0.55)');
        this.activeTetherLine.setAttribute('x1', last[0]);
        this.activeTetherLine.setAttribute('y1', last[1]);
        this.activeTetherLine.setAttribute('x2', pt[0]);
        this.activeTetherLine.setAttribute('y2', pt[1]);
        this.activeTetherLine.setAttribute('stroke', '#ffd700');
        this.activeTetherLine.setAttribute('stroke-dasharray', '3,3');
        this._prevCursorPt = pt;
        comp.showKnotToast(`⏸️ Tether: ${Math.round(newR)}px (Hold Ctrl)`);
        return;
      }
      comp._clutchActive = false;

      const step = StudioGeometry.stepDrawstringTether(this.strokePoints, pt, tetherLen, eraseR, this._prevCursorPt, this.tetherState);
      this._prevCursorPt = pt;
      this.strokePoints = step.points;
      Object.assign(this.tetherState, {
        cuspIndices: step.cuspIndices,
        inSlackRedirect: step.inSlackRedirect,
        slackIncomingDir: step.slackIncomingDir
      });

      const { curTip, didRewind, isSlack } = step;
      if (this.tipPointIndicator) {
        this.tipPointIndicator.setAttribute('cx', curTip[0]);
        this.tipPointIndicator.setAttribute('cy', curTip[1]);
        this.tipPointIndicator.setAttribute('stroke', didRewind ? '#f59e0b' : '#00e676');
      }

      this.activeTetherLine.setAttribute('x1', curTip[0]);
      this.activeTetherLine.setAttribute('y1', curTip[1]);
      this.activeTetherLine.setAttribute('x2', pt[0]);
      this.activeTetherLine.setAttribute('y2', pt[1]);
      this.activeTetherLine.setAttribute('stroke', didRewind ? '#f59e0b' : (isSlack ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.9)'));
      this.activeTetherLine.setAttribute('stroke-dasharray', isSlack ? `${3 / z},${3 / z}` : 'none');

      this.cursorEraseCircle.setAttribute('stroke', didRewind ? '#f59e0b' : 'rgba(255, 255, 255, 0.5)');
      this.cursorEraseCircle.setAttribute('fill', didRewind ? 'rgba(245, 158, 11, 0.14)' : 'rgba(255, 255, 255, 0.03)');

      this._updateCuspMarkers(step.cuspIndices, curTip, step.pendingCusp, 1 / (st.zoom || 1.0));

      const isLoopClosing = this.strokePoints.length > 8 && Math.hypot(curTip[0] - this.startPt[0], curTip[1] - this.startPt[1]) < 24;
      const ptsForSpline = isLoopClosing ? [...this.strokePoints, [this.startPt[0], this.startPt[1]]] : (this.strokePoints.length === 1 ? [curTip, curTip] : this.strokePoints);
      const strokeColor = isLoopClosing ? '#00f2fe' : curCol;

      this._renderStrokePreview(this.getSmoothPath(ptsForSpline), strokeColor, baseW, z, isNeon, isLoopClosing);
      this._renderArrowPreview(st.hasArrow && !isLoopClosing && this.strokePoints.length >= 2, ptsForSpline[0], ptsForSpline[1], strokeColor, baseW, st.lineStyle);
    } catch (err) {
      QuoraLogger.getInstance().log('error', 1, 'Error in onMouseMove: ' + err.message);
    }
  }
  onMouseUp(e) {
        if (this._isDrawingExportRect && this._exportRectStart) {
          this._isDrawingExportRect = false;
          const pt = this.getStagePt(e);
          const preview = document.getElementById('qa-export-rect-preview');
          if (preview) preview.remove();

          const x = Math.max(0, Math.round(Math.min(this._exportRectStart[0], pt[0])));
          const y = Math.max(0, Math.round(Math.min(this._exportRectStart[1], pt[1])));
          const w = Math.round(Math.abs(pt[0] - this._exportRectStart[0]));
          const h = Math.round(Math.abs(pt[1] - this._exportRectStart[1]));
          this._exportRectStart = null;
          this.component.toggleExportAreaMode(false);

          if (w > 20 && h > 20) {
            this.component.stageState.exportRect = { x, y, width: w, height: h };
            this.component.renderStage();
            this.component.showKnotToast(`📐 Export Area set: ${w}×${h}px`);
          }
          return;
        }

        if (this._pendingBend) {
          const clickedCurve = this._pendingBend.curve;
          const didDrag = this._pendingBend.didDrag;
          const insertedOrMoved = (this._pendingBend.inserted || this._pendingBend.isWholeMove);
          this._pendingBend = null;

          if (insertedOrMoved) {
            this.component.exposeBezierHandles(clickedCurve);
            this.component.renderStage();
          } else if (!didDrag && clickedCurve) {
            this.component.triggerTextOnActiveOrCanvas();
          }
          return;
        }

        if (this.isMarquee && this.marqueeStart) {
          this.isMarquee = false;
          const pt = this.getStagePt(e);
          const minX = Math.min(this.marqueeStart[0], pt[0]), maxX = Math.max(this.marqueeStart[0], pt[0]);
          const minY = Math.min(this.marqueeStart[1], pt[1]), maxY = Math.max(this.marqueeStart[1], pt[1]);
          const marqueeEl = document.getElementById('qa-marquee-box');
          if (marqueeEl) marqueeEl.remove();

          const curve = this.component.getActiveCurve();
          if (curve && curve.vertices) {
            if (!this.component._selectedKnotIndices) this.component._selectedKnotIndices = new Set();
            let selectedCount = 0;
            curve.vertices.forEach((v, idx) => {
              if (v.point[0] >= minX && v.point[0] <= maxX && v.point[1] >= minY && v.point[1] <= maxY) {
                this.component._selectedKnotIndices.add(idx);
                selectedCount++;
              }
            });
            if (selectedCount > 0) {
              this.component.exposeBezierHandles(curve);
              this.component.showKnotToast(`Selected ${selectedCount} knot${selectedCount === 1 ? '' : 's'}`);
            }
          }
          this.marqueeStart = null;
          return;
        }

        if (!this.isDrawing) return;

        if (e.ctrlKey || e.metaKey || this.component._clutchActive) {
          this.component._handRestActive = true;
          this.isDrawing = false;
          this.component._isDrawingActive = false;
          this.component.showClutchHandRestBadge(this.strokePoints[this.strokePoints.length - 1]);
          return;
        }

        this.isDrawing = false;
        this.component._isDrawingActive = false;
        const cuspIndices = [...(this.tetherState?.cuspIndices || [])];
        this.cleanupGestureIndicators();

        if (this.component.stageState.activeTool === 'paint') {
          const pt = this.getStagePt(e);
          if (this.component.stageState.brushMode === 'erase') { this.strokePoints = []; return; }
          if (this.component.stageState.brushMode === 'rect') this.component.commitBlockoutRect(this.strokePoints[0], pt);
          else if (this.component.stageState.brushMode === 'oval') this.component.commitBlockoutOval(this.strokePoints[0], pt);
          else if (this.svgSurface._paintPreview) {
            this.component.stageState.annotations.push({
              type: 'paint', points: [...this.strokePoints],
              color: this.component.stageState.brushColor, width: this.component.stageState.brushSize,
              softness: this.component.stageState.brushSoftness, element: this.svgSurface._paintPreview
            });
            this.svgSurface._paintPreview = null;
            this.component.renderStage();
          }
          this.strokePoints = [];
          return;
        }

        if (!this.hasExceededDeadzone) {
          this.strokePoints = [];
          this.extendingCurve = null;
          return;
        }

        if (this.strokePoints.length >= 2) {
          const lastPt = this.strokePoints[this.strokePoints.length - 1];
          const shouldCloseLoop = (this.strokePoints.length > 8 && Math.hypot(lastPt[0] - this.startPt[0], lastPt[1] - this.startPt[1]) < 24);
          if (shouldCloseLoop) this.strokePoints[this.strokePoints.length - 1] = [this.startPt[0], this.startPt[1]];

          if (this.extendingCurve && this.extendingCurve.vertices) {
            const fitted = StudioGeometry.fitPolylineWithCusps(this.strokePoints, cuspIndices);
            const extensionVertices = this.component.beziersToVertices(fitted.beziers, fitted.vertexCuspIndices);
            if (extensionVertices.length > 0) {
              if (this.extendAtTail) this.extendingCurve.vertices.push(...extensionVertices.slice(1));
              else this.extendingCurve.vertices.unshift(...extensionVertices.slice(0, -1));
              this.component.commitCurveGeometryUpdate();
              this.component.exposeBezierHandles(this.extendingCurve);
              this.component.showKnotToast('↔ Curve extended');
            }
            this.extendingCurve = null;
            this.strokePoints = [];
            return;
          }

          const fitted = StudioGeometry.fitPolylineWithCusps(this.strokePoints, cuspIndices);
          if (fitted.beziers && fitted.beziers.length > 0) {
            const hasArrow = shouldCloseLoop ? false : this.component.stageState.hasArrow;
            this.component.commitSpline(fitted.beziers, this.component.stageState.currentColor, hasArrow, null, fitted.vertexCuspIndices);
            const lastCurve = this.component.getActiveCurve();
            if (lastCurve) {
              if (shouldCloseLoop) {
                lastCurve.isClosed = true;
                lastCurve.arrowEnd = 'none';
                this.component.commitCurveGeometryUpdate();
                this.component.showKnotToast('🔄 Snapped Closed: Loop Ring');
              } else if (fitted.vertexCuspIndices.length > 0) {
                this.component.showKnotToast(`◆ Locked ${fitted.vertexCuspIndices.length} cusp corner(s)`);
              } else {
                this.component.showKnotToast('🏹 Click pale "Note…" box or curve to type');
              }
            }
          }
        }
        this.strokePoints = [];
      }
  onContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle')) return;

    if (this.component._penNodes && this.component._penNodes.length >= 2) {
      this.component.commitPenNodes();
      return;
    } else if (this.component._penNodes) {
      this.component.cancelPenNodes();
      return;
    }

    if (this.isDrawing) {
      this.isDrawing = false;
      this.component._isDrawingActive = false;
      this.cleanupGestureIndicators();
      this.strokePoints = [];
      this.component.showKnotToast('Stroke canceled');
    }
  }

  updateSpatialHover(mousePt) {
      // Strictly isolate hover so it never interrupts or competes with active drawing/dragging
      if (this.isDrawing || this.component._isDrawingActive || this.component.isInteracting() || (this.component._penNodes && this.component._penNodes.length > 0)) {
        this.clearHoverHighlight();
        return;
      }

      const hit = this.component.findNearestCurveAtPoint(mousePt, this.component._hoveredCurve ? 36 : 24);
      if (hit) {
        if (this.component._hoveredCurve !== hit.ann) {
          this.clearHoverHighlight();
          this.component._hoveredCurve = hit.ann;
          this.renderHoverGhostCurve(hit.ann);
          if (this.component.stageState.selectedItem !== hit.ann) {
            this.renderEphemeralKnotHandles(hit.ann);
          }
        }
      } else {
        this.clearHoverHighlight();
      }
    }
  renderEphemeralKnotHandles(curveRecord) {
    this.component.controlsLayer.querySelectorAll('.qa-ephemeral-knots').forEach(el => el.remove());
    if (!curveRecord || !curveRecord.vertices) return;

    const g = makeElement('svg:g', { className: 'qa-ephemeral-knots' });

    curveRecord.vertices.forEach((v, idx) => {
      const circle = makeElement('svg:circle', {
        cx: v.point[0], cy: v.point[1], r: '4.5',
        fill: 'rgba(0, 242, 254, 0.45)', stroke: 'rgba(255, 255, 255, 0.75)', 'stroke-width': '1.2',
        style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 3px rgba(0,242,254,0.4))' }
      });

      const hitArea = makeElement('svg:circle', {
        cx: v.point[0], cy: v.point[1], r: '14', fill: 'transparent',
        style: { cursor: 'move', pointerEvents: 'all' },
        title: 'Click to drag point immediately'
      });

      hitArea.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();

        this.component.stageState.selectedItem = curveRecord;
        this.component._activeKnotIdx = idx;
        this.component.exposeBezierHandles(curveRecord);

        const targetHandle = this.component.controlsLayer.querySelectorAll('.qa-on-curve-knot-handle')[idx];
        if (targetHandle) {
          targetHandle.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true, cancelable: true,
            clientX: e.clientX, clientY: e.clientY, button: 0
          }));
        }
      });

      g.append(circle, hitArea);
    });

    this.component.controlsLayer.appendChild(g);
  }

  clearHoverHighlight() {
    this.component._hoveredCurve = null;
    const glow = document.getElementById('qa-active-hover-glow');
    if (glow) glow.remove();
    this.component.controlsLayer.querySelectorAll('.qa-ephemeral-knots').forEach(el => el.remove());
  }

  renderHoverGhostCurve(ann) {
      if (!ann || !ann.elements?.[1]) return;
      const d = ann.elements[1].querySelector('path')?.getAttribute('d') || ann.elements[1].getAttribute('d');
      if (!d) return;

      let glow = document.getElementById('qa-active-hover-glow');
      if (!glow) {
        glow = makeElement('svg:path', {
          id: 'qa-active-hover-glow',
          className: 'qa-hover-ghost-curve',
          fill: 'none',
          stroke: ann.color || '#00f2fe',
          'stroke-width': '12',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          style: {
            pointerEvents: 'none',
            filter: `drop-shadow(0 0 8px ${ann.color || '#00f2fe'})`,
            transition: 'opacity 0.25s ease'
          }
        });
        this.component.glowLayer.appendChild(glow);
      }
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', ann.color || '#00f2fe');
    }

  getSmoothPath(pts) {
      return StudioGeometry.smoothPolylineToSvgD(pts);
    }

  _renderStrokePreview(d, color, baseW, z, isNeon, isLoopClosing = false) {
    const comp = this.component;
    const svg = this.svgSurface;

    if (isNeon) {
      const coreTint = comp.strokeManager.getLuminousCoreColor(color);
      if (!svg._previewGlow) {
        svg._previewGlow = makeElement('svg:path', {
          fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: { pointerEvents: 'none', filter: 'url(#qa-neon-glow)', opacity: '0.92' }
        });
        comp.glowLayer.appendChild(svg._previewGlow);
      }
      svg._previewGlow.setAttribute('d', d);
      svg._previewGlow.setAttribute('stroke', color);
      svg._previewGlow.setAttribute('stroke-width', String((baseW + 10) / z));
      svg._previewGlow.style.display = 'block';

      if (!svg._preview) {
        svg._preview = makeElement('svg:path', {
          fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: { pointerEvents: 'none' }
        });
        comp.strokeLayer.appendChild(svg._preview);
      }
      svg._preview.setAttribute('d', d);
      svg._preview.setAttribute('stroke', coreTint);
      svg._preview.setAttribute('stroke-width', String(Math.max(2.0, baseW * 0.78) / z));
      svg._preview.setAttribute('fill', 'none');
      svg._preview.style.filter = 'url(#qa-neon-core)';
      return;
    }

    if (svg._previewGlow) svg._previewGlow.style.display = 'none';
    if (!svg._preview) {
      svg._preview = makeElement('svg:path', {
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: { pointerEvents: 'none' }
      });
      comp.strokeLayer.appendChild(svg._preview);
    }
    svg._preview.setAttribute('d', d);
    svg._preview.setAttribute('stroke', color);
    svg._preview.setAttribute('stroke-width', String(baseW / z));
    svg._preview.setAttribute('fill', isLoopClosing ? 'rgba(0, 242, 254, 0.08)' : 'none');
    svg._preview.style.filter = 'none';
  }

  _renderArrowPreview(show, p0, p1, color, baseW, lineStyle) {
      const comp = this.component;
      const svg = this.svgSurface;
      if (svg._previewArrow) { svg._previewArrow.remove(); svg._previewArrow = null; }
      if (svg._previewArrowShadow) { svg._previewArrowShadow.remove(); svg._previewArrowShadow = null; }
      if (svg._previewArrowGlow) { svg._previewArrowGlow.remove(); svg._previewArrowGlow = null; }
      if (!show || !p0 || !p1) return;

      const dHead = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const tangent = [(p1[0] - p0[0]) / dHead, (p1[1] - p0[1]) / dHead];
      const arrowStyle = comp.stageState.arrowStyle || 'concave';
      const arrow = comp.strokeManager.renderConcaveArrowhead(p0, tangent, color, 2.0, baseW, lineStyle, arrowStyle);
      if (arrow.shadow) {
        svg._previewArrowShadow = arrow.shadow;
        comp.shadowLayer.appendChild(arrow.shadow);
      }
      if (arrow.glow) {
        svg._previewArrowGlow = arrow.glow;
        comp.glowLayer.appendChild(arrow.glow);
      }
      svg._previewArrow = arrow.foreground;
      comp.strokeLayer.appendChild(arrow.foreground);
    }
  _updateCuspMarkers(cuspIndices, curTip, pendingCusp, invScale) {
    if (!this.cuspMarkersGroup) {
      this.cuspMarkersGroup = makeElement('svg:g', { id: 'qa-stroke-cusp-markers', style: { pointerEvents: 'none' } });
      this.component.controlsLayer.appendChild(this.cuspMarkersGroup);
    }
    this.cuspMarkersGroup.innerHTML = '';

    const addDiamond = (pt, size, fill, stroke, strokeW) => {
      this.cuspMarkersGroup.appendChild(makeElement('svg:rect', {
        x: pt[0] - size / 2, y: pt[1] - size / 2, width: size, height: size, rx: String(1.5 * invScale),
        transform: `rotate(45, ${pt[0]}, ${pt[1]})`, fill, stroke, 'stroke-width': String(strokeW * invScale)
      }));
    };

    cuspIndices.forEach(idx => {
      const cp = this.strokePoints[idx];
      if (cp) addDiamond(cp, 9 * invScale, '#f59e0b', '#ffffff', 1.5);
    });
    if (pendingCusp) addDiamond(curTip, 11 * invScale, 'rgba(245, 158, 11, 0.35)', '#ffd700', 1.8);
  }

  _handlePaintMove(pt) {
    const comp = this.component;
    const st = comp.stageState;
    const mode = st.brushMode;

    if (mode === 'erase') {
      const plate = comp.hitTestImagePlate(pt) || st.activeImage || st.placedImages?.[0];
      if (!plate) return;
      const paintTether = st.paintTetherLength ?? 12;
      let targetPt = pt;
      if (paintTether > 0 && this._lastErasePt) {
        const dist = Math.hypot(pt[0] - this._lastErasePt[0], pt[1] - this._lastErasePt[1]);
        if (dist <= paintTether) return;
        targetPt = [pt[0] - ((pt[0] - this._lastErasePt[0]) / dist) * paintTether, pt[1] - ((pt[1] - this._lastErasePt[1]) / dist) * paintTether];
      }
      comp.imageManager.eraseImagePlatePixels(
        plate, targetPt[0], targetPt[1], (st.brushSize || 32) / 2, st.brushSoftness || 0,
        this._lastErasePt?.[0] ?? null, this._lastErasePt?.[1] ?? null
      );
      this._lastErasePt = targetPt;
      return;
    }

    if (mode === 'rect') return comp.previewBlockoutRect(this.strokePoints[0], pt);
    if (mode === 'oval') return comp.previewBlockoutOval(this.strokePoints[0], pt);

    const paintTether = st.paintTetherLength ?? 12;
    const lastPt = this.strokePoints[this.strokePoints.length - 1];
    const pDist = Math.hypot(pt[0] - lastPt[0], pt[1] - lastPt[1]);

    if (paintTether > 0) {
      if (pDist > paintTether) {
        this.strokePoints.push([pt[0] - ((pt[0] - lastPt[0]) / pDist) * paintTether, pt[1] - ((pt[1] - lastPt[1]) / pDist) * paintTether]);
      }
      if (!this.activeTetherLine) {
        this.activeTetherLine = makeElement('svg:line', {
          id: 'qa-drawstring-line', stroke: 'rgba(245, 158, 11, 0.85)', 'stroke-width': '1.4', 'stroke-dasharray': '2,2'
        });
        comp.controlsLayer.appendChild(this.activeTetherLine);
      }
      const tip = this.strokePoints[this.strokePoints.length - 1];
      this.activeTetherLine.setAttribute('x1', tip[0]);
      this.activeTetherLine.setAttribute('y1', tip[1]);
      this.activeTetherLine.setAttribute('x2', pt[0]);
      this.activeTetherLine.setAttribute('y2', pt[1]);
    } else {
      this.strokePoints.push(pt);
    }

    const svg = this.svgSurface;
    if (!svg._paintPreview) {
      svg._paintPreview = makeElement('svg:path', {
        stroke: st.brushColor, 'stroke-width': String(st.brushSize),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
        ...(st.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
      });
      comp.paintLayer.appendChild(svg._paintPreview);
    }
    svg._paintPreview.setAttribute('d', this.getSmoothPath(this.strokePoints));
  }
}

globalThis.QuoraGestureMachine = QuoraGestureMachine;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraGestureMachine;