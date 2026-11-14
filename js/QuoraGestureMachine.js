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

            const isWholeMove = Boolean(e.altKey || e.metaKey);
            const originalVertices = hitCurve.ann.vertices.map(v => [v.point[0], v.point[1]]);

            this._pendingBend = {
              curve: hitCurve.ann, segIdx: hitCurve.segIdx, startPt: pt,
              inserted: false, didDrag: false, isWholeMove, originalVertices
            };
            if (isWholeMove) this.component.showKnotToast('↔ Moving Whole Arrow (Alt+Drag)');
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
          const pt = this.getStagePt(e);
          this.component._lastStageMousePt = pt;

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
            const marqueeEl = document.getElementById('qa-marquee-box');
            if (marqueeEl) {
              marqueeEl.setAttribute('x', Math.min(this.marqueeStart[0], pt[0]));
              marqueeEl.setAttribute('y', Math.min(this.marqueeStart[1], pt[1]));
              marqueeEl.setAttribute('width', Math.abs(pt[0] - this.marqueeStart[0]));
              marqueeEl.setAttribute('height', Math.abs(pt[1] - this.marqueeStart[1]));
            }
            return;
          }

          if (this._pendingBend) {
            const dx = pt[0] - this._pendingBend.startPt[0];
            const dy = pt[1] - this._pendingBend.startPt[1];
            if (Math.hypot(dx, dy) > 3) {
              this._pendingBend.didDrag = true;
              if (this._pendingBend.isWholeMove) {
                this._pendingBend.curve.vertices.forEach((v, idx) => {
                  const orig = this._pendingBend.originalVertices[idx];
                  if (orig) { v.point[0] = Math.round(orig[0] + dx); v.point[1] = Math.round(orig[1] + dy); }
                });
                this.component.commitCurveGeometryUpdate();
              } else {
                if (!this._pendingBend.inserted) {
                  this.component.strokeManager.addKnotOnCurve(this._pendingBend.curve, this._pendingBend.segIdx);
                  this.component.exposeBezierHandles(this._pendingBend.curve);
                  this._pendingBend.inserted = true;
                }
                const activeKnot = this._pendingBend.curve.vertices[this.component._activeKnotIdx];
                if (activeKnot) {
                  activeKnot.point[0] = pt[0]; activeKnot.point[1] = pt[1];
                  this.component.commitCurveGeometryUpdate();
                }
              }
            }
            return;
          }

          if (this.component.stageState.activeTool === 'paint') {
            let ring = document.getElementById('qa-paint-cursor-ring');
            if (!ring) {
              ring = makeElement('svg:circle', { id: 'qa-paint-cursor-ring', fill: 'none', style: { pointerEvents: 'none' } });
              this.component.controlsLayer.appendChild(ring);
            }
            const isErase = (this.component.stageState.brushMode === 'erase');
            ring.setAttribute('cx', pt[0]);
            ring.setAttribute('cy', pt[1]);
            ring.setAttribute('r', String((this.component.stageState.brushSize || 32) / 2));
            ring.setAttribute('stroke', isErase ? '#00f2fe' : '#f59e0b');
            ring.setAttribute('stroke-width', '1.4');
            ring.setAttribute('stroke-dasharray', isErase ? '4,3' : 'none');
          } else {
            const ring = document.getElementById('qa-paint-cursor-ring');
            if (ring) ring.remove();
          }

          if (!this.isDrawing && !this.component._isDrawingActive && !this.component.isInteracting() && !this.component._penNodes) {
            if (this.component.stageState.activeTool !== 'paint') {
              this.updateSpatialHover(pt);
              if (this.component.knotManager) {
                this.component.knotManager.updateHoveredDeleteTarget(pt);
                const curve = this.component.getActiveCurve();
                if (curve) this.component.knotManager.updateDynamicMidpointCandidate(curve, this.component.controlsLayer, this.component.stageState);
              }
            }
            return;
          } else {
            this.clearHoverHighlight();
          }

          if (!this.isDrawing) return;

          if (this.component.stageState.activeTool === 'paint') {
            const paintTether = this.component.stageState.paintTetherLength !== undefined ? this.component.stageState.paintTetherLength : 12;

            if (this.component.stageState.brushMode === 'erase') {
              const plate = this.component.hitTestImagePlate(pt) || this.component.stageState.activeImage || this.component.stageState.placedImages?.[0];
              if (plate) {
                let targetPt = pt;
                if (paintTether > 0 && this._lastErasePt) {
                  const dist = Math.hypot(pt[0] - this._lastErasePt[0], pt[1] - this._lastErasePt[1]);
                  if (dist <= paintTether) return;
                  const ux = (pt[0] - this._lastErasePt[0]) / dist;
                  const uy = (pt[1] - this._lastErasePt[1]) / dist;
                  targetPt = [pt[0] - ux * paintTether, pt[1] - uy * paintTether];
                }
                this.component.imageManager.eraseImagePlatePixels(
                  plate, targetPt[0], targetPt[1],
                  (this.component.stageState.brushSize || 32) / 2,
                  this.component.stageState.brushSoftness || 0,
                  this._lastErasePt ? this._lastErasePt[0] : null,
                  this._lastErasePt ? this._lastErasePt[1] : null
                );
                this._lastErasePt = targetPt;
              }
              return;
            }

            if (this.component.stageState.brushMode === 'rect') { this.component.previewBlockoutRect(this.strokePoints[0], pt); return; }
            if (this.component.stageState.brushMode === 'oval') { this.component.previewBlockoutOval(this.strokePoints[0], pt); return; }

            const lastPaintPt = this.strokePoints[this.strokePoints.length - 1];
            const pDist = Math.hypot(pt[0] - lastPaintPt[0], pt[1] - lastPaintPt[1]);
            if (paintTether > 0) {
              if (pDist > paintTether) {
                const ux = (pt[0] - lastPaintPt[0]) / pDist;
                const uy = (pt[1] - lastPaintPt[1]) / pDist;
                this.strokePoints.push([pt[0] - ux * paintTether, pt[1] - uy * paintTether]);
              }
              if (!this.activeTetherLine) {
                this.activeTetherLine = makeElement('svg:line', { id: 'qa-drawstring-line', stroke: 'rgba(245, 158, 11, 0.85)', 'stroke-width': '1.4', 'stroke-dasharray': '2,2' });
                this.component.controlsLayer.appendChild(this.activeTetherLine);
              }
              const tip = this.strokePoints[this.strokePoints.length - 1];
              this.activeTetherLine.setAttribute('x1', tip[0]);
              this.activeTetherLine.setAttribute('y1', tip[1]);
              this.activeTetherLine.setAttribute('x2', pt[0]);
              this.activeTetherLine.setAttribute('y2', pt[1]);
            } else {
              this.strokePoints.push(pt);
            }

            const pathD = this.getSmoothPath(this.strokePoints);
            if (!this.svgSurface._paintPreview) {
              this.svgSurface._paintPreview = makeElement('svg:path', {
                stroke: this.component.stageState.brushColor,
                'stroke-width': String(this.component.stageState.brushSize),
                'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
                ...(this.component.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
              });
              this.component.paintLayer.appendChild(this.svgSurface._paintPreview);
            }
            this.svgSurface._paintPreview.setAttribute('d', pathD);
            return;
          }

          const baseW = this.component.stageState.curveStrokeWidth || 3.2;
          const z = this.component.stageState.cadStrokeMode ? (this.component.stageState.zoom || 1.0) : 1.0;
          const curW = baseW / z;
          const isNeon = (this.component.stageState.lineStyle === 'neon');

          if (e.shiftKey) {
            this.hasExceededDeadzone = true;
            if (this.deadzoneCircle) { this.deadzoneCircle.remove(); this.deadzoneCircle = null; }
            if (this.cursorEraseCircle) { this.cursorEraseCircle.style.display = 'none'; }
            if (this.cuspMarkersGroup) { this.cuspMarkersGroup.innerHTML = ''; }
            this._prevCursorPt = pt;
            this.strokePoints = [this.startPt, pt];
            this.tetherState = { cuspIndices: [], inSlackRedirect: false, slackIncomingDir: null, cuspAngleDeg: 45 };
            const curCol = this.component.stageState.currentColor || '#00e676';
            const straightD = `M ${this.startPt[0]} ${this.startPt[1]} L ${pt[0]} ${pt[1]}`;

            if (isNeon) {
              const coreTint = this.component.strokeManager.getLuminousCoreColor(curCol);
              if (!this.svgSurface._previewGlow) {
                this.svgSurface._previewGlow = makeElement('svg:path', {
                  stroke: curCol, 'stroke-width': String((baseW + 10) / z), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
                  style: { pointerEvents: 'none', filter: 'url(#qa-neon-glow)', opacity: '0.92' }
                });
                this.component.glowLayer.appendChild(this.svgSurface._previewGlow);
              }
              this.svgSurface._previewGlow.setAttribute('d', straightD);
              this.svgSurface._previewGlow.style.display = 'block';

              if (!this.svgSurface._preview) {
                this.svgSurface._preview = makeElement('svg:path', {
                  stroke: coreTint, 'stroke-width': String(Math.max(2.0, baseW * 0.78) / z), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
                  style: { pointerEvents: 'none', filter: 'url(#qa-neon-core)' }
                });
                this.component.strokeLayer.appendChild(this.svgSurface._preview);
              }
              this.svgSurface._preview.setAttribute('d', straightD);
              this.svgSurface._preview.setAttribute('stroke', coreTint);
              this.svgSurface._preview.setAttribute('stroke-width', String(Math.max(2.0, baseW * 0.78) / z));
            } else {
              if (this.svgSurface._previewGlow) this.svgSurface._previewGlow.style.display = 'none';
              if (!this.svgSurface._preview) {
                this.svgSurface._preview = makeElement('svg:path', {
                  stroke: curCol, 'stroke-width': String(curW), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: { pointerEvents: 'none' }
                });
                this.component.strokeLayer.appendChild(this.svgSurface._preview);
              }
              this.svgSurface._preview.setAttribute('d', straightD);
              this.svgSurface._preview.setAttribute('stroke', curCol);
              this.svgSurface._preview.setAttribute('stroke-width', String(curW));
            }

            if (this.component.stageState.hasArrow) {
              const dHead = Math.hypot(pt[0] - this.startPt[0], pt[1] - this.startPt[1]) || 1;
              const arrow = this.component.strokeManager.renderConcaveArrowhead(
                this.startPt, [(pt[0] - this.startPt[0]) / dHead, (pt[1] - this.startPt[1]) / dHead],
                curCol, 2.0, baseW, this.component.stageState.lineStyle
              );
              if (this.svgSurface._previewArrow) this.svgSurface._previewArrow.remove();
              if (this.svgSurface._previewArrowGlow) this.svgSurface._previewArrowGlow.remove();
              if (arrow.glow) { this.svgSurface._previewArrowGlow = arrow.glow; this.component.glowLayer.appendChild(this.svgSurface._previewArrowGlow); }
              this.svgSurface._previewArrow = arrow.foreground;
              this.component.strokeLayer.appendChild(this.svgSurface._previewArrow);
            }
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

          const tetherLen = this.component.stageState.tetherLength || 32;
          const baseEraseR = this.component.stageState.eraseRadius || 20;
          const eraseR = Math.max(8, Math.min(baseEraseR, Math.round(tetherLen * 0.62)));

          if (!this.cursorEraseCircle) {
            this.cursorEraseCircle = makeElement('svg:circle', {
              id: 'qa-cursor-erase-circle', fill: 'rgba(255, 255, 255, 0.03)',
              stroke: 'rgba(255, 255, 255, 0.5)', 'stroke-width': String(1.2 / z),
              'stroke-dasharray': `${3 / z},${3 / z}`, style: { pointerEvents: 'none' }
            });
            this.component.controlsLayer.appendChild(this.cursorEraseCircle);
          }
          this.cursorEraseCircle.style.display = 'block';
          this.cursorEraseCircle.setAttribute('cx', pt[0]);
          this.cursorEraseCircle.setAttribute('cy', pt[1]);
          this.cursorEraseCircle.setAttribute('r', String(eraseR));
          this.cursorEraseCircle.setAttribute('stroke-width', String(1.2 / z));
          this.cursorEraseCircle.setAttribute('stroke-dasharray', `${3 / z},${3 / z}`);

          if (e.ctrlKey || e.metaKey) {
            this.component._clutchActive = true;
            const last = this.strokePoints[this.strokePoints.length - 1];
            const newR = Math.max(12, Math.min(180, Math.hypot(pt[0] - last[0], pt[1] - last[1])));
            this.component.stageState.tetherLength = Math.round(newR);
            const clutchEraseR = Math.max(8, Math.min(baseEraseR, Math.round(newR * 0.62)));
            this.cursorEraseCircle.setAttribute('r', String(clutchEraseR));
            this.cursorEraseCircle.setAttribute('stroke', 'rgba(255, 215, 0, 0.55)');
            if (!this.activeTetherLine) {
              this.activeTetherLine = makeElement('svg:line', { id: 'qa-drawstring-line', stroke: '#ffd700', 'stroke-width': '1.8', 'stroke-dasharray': '3,3' });
              this.component.controlsLayer.appendChild(this.activeTetherLine);
            }
            this.activeTetherLine.setAttribute('x1', last[0]);
            this.activeTetherLine.setAttribute('y1', last[1]);
            this.activeTetherLine.setAttribute('x2', pt[0]);
            this.activeTetherLine.setAttribute('y2', pt[1]);
            this._prevCursorPt = pt;
            this.component.showKnotToast(`⏸️ Tether: ${Math.round(newR)}px (Hold Ctrl)`);
            return;
          } else {
            this.component._clutchActive = false;
          }

          if (!this.activeTetherLine) {
            this.activeTetherLine = makeElement('svg:line', { id: 'qa-drawstring-line', stroke: 'rgba(255, 255, 255, 0.85)', 'stroke-width': '1.8' });
            this.component.controlsLayer.appendChild(this.activeTetherLine);
          }

          const step = StudioGeometry.stepDrawstringTether(this.strokePoints, pt, tetherLen, eraseR, this._prevCursorPt, this.tetherState);
          this._prevCursorPt = pt;
          this.strokePoints = step.points;
          this.tetherState.cuspIndices = step.cuspIndices;
          this.tetherState.inSlackRedirect = step.inSlackRedirect;
          this.tetherState.slackIncomingDir = step.slackIncomingDir;

          const curTip = step.curTip;
          const didRewind = step.didRewind;
          const isSlack = step.isSlack;

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

          if (!this.cuspMarkersGroup) {
            this.cuspMarkersGroup = makeElement('svg:g', { id: 'qa-stroke-cusp-markers', style: { pointerEvents: 'none' } });
            this.component.controlsLayer.appendChild(this.cuspMarkersGroup);
          }
          this.cuspMarkersGroup.innerHTML = '';
          const invScale = 1 / (this.component.stageState.zoom || 1.0);
          step.cuspIndices.forEach(idx => {
            const cp = this.strokePoints[idx];
            if (!cp) return;
            const s = 9 * invScale;
            this.cuspMarkersGroup.appendChild(makeElement('svg:rect', {
              x: cp[0] - s / 2, y: cp[1] - s / 2, width: s, height: s, rx: String(1.5 * invScale),
              transform: `rotate(45, ${cp[0]}, ${cp[1]})`,
              fill: '#f59e0b', stroke: '#ffffff', 'stroke-width': String(1.5 * invScale)
            }));
          });
          if (step.pendingCusp) {
            const s = 11 * invScale;
            this.cuspMarkersGroup.appendChild(makeElement('svg:rect', {
              x: curTip[0] - s / 2, y: curTip[1] - s / 2, width: s, height: s, rx: String(1.5 * invScale),
              transform: `rotate(45, ${curTip[0]}, ${curTip[1]})`,
              fill: 'rgba(245, 158, 11, 0.35)', stroke: '#ffd700', 'stroke-width': String(1.8 * invScale)
            }));
          }

          const dToOrigin = Math.hypot(curTip[0] - this.startPt[0], curTip[1] - this.startPt[1]);
          const isLoopClosing = (this.strokePoints.length > 8 && dToOrigin < 24);
          const pointsForSpline = [...this.strokePoints];
          if (isLoopClosing) pointsForSpline.push([this.startPt[0], this.startPt[1]]);
          else if (pointsForSpline.length === 1) pointsForSpline.push(curTip);

          const previewD = this.getSmoothPath(pointsForSpline);
          const curCol = isLoopClosing ? '#00f2fe' : (this.component.stageState.currentColor || '#00e676');

          if (isNeon) {
            const coreTint = this.component.strokeManager.getLuminousCoreColor(curCol);
            if (!this.svgSurface._previewGlow) {
              this.svgSurface._previewGlow = makeElement('svg:path', {
                stroke: curCol, 'stroke-width': String((baseW + 10) / z), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
                style: { pointerEvents: 'none', filter: 'url(#qa-neon-glow)', opacity: '0.92' }
              });
              this.component.glowLayer.appendChild(this.svgSurface._previewGlow);
            }
            this.svgSurface._previewGlow.setAttribute('d', previewD);
            this.svgSurface._previewGlow.setAttribute('stroke', curCol);
            this.svgSurface._previewGlow.setAttribute('stroke-width', String((baseW + 10) / z));
            this.svgSurface._previewGlow.style.display = 'block';

            if (!this.svgSurface._preview) {
              this.svgSurface._preview = makeElement('svg:path', {
                stroke: coreTint, 'stroke-width': String(Math.max(2.0, baseW * 0.78) / z), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
                style: { pointerEvents: 'none', filter: 'url(#qa-neon-core)' }
              });
              this.component.strokeLayer.appendChild(this.svgSurface._preview);
            }
            this.svgSurface._preview.setAttribute('d', previewD);
            this.svgSurface._preview.setAttribute('stroke', coreTint);
            this.svgSurface._preview.setAttribute('stroke-width', String(Math.max(2.0, baseW * 0.78) / z));
            this.svgSurface._preview.style.filter = 'url(#qa-neon-core)';
          } else {
            if (this.svgSurface._previewGlow) this.svgSurface._previewGlow.style.display = 'none';
            if (!this.svgSurface._preview) {
              this.svgSurface._preview = makeElement('svg:path', {
                stroke: curCol, 'stroke-width': String(curW), fill: isLoopClosing ? 'rgba(0, 242, 254, 0.08)' : 'none',
                'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: { pointerEvents: 'none' }
              });
              this.component.strokeLayer.appendChild(this.svgSurface._preview);
            }
            this.svgSurface._preview.setAttribute('d', previewD);
            this.svgSurface._preview.setAttribute('stroke', curCol);
            this.svgSurface._preview.setAttribute('stroke-width', String(curW));
            this.svgSurface._preview.style.filter = 'none';
          }

          if (this.component.stageState.hasArrow && !isLoopClosing && this.strokePoints.length >= 2) {
            const p0 = pointsForSpline[0], p1 = pointsForSpline[1];
            const dHead = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
            const arrow = this.component.strokeManager.renderConcaveArrowhead(
              p0, [(p1[0] - p0[0]) / dHead, (p1[1] - p0[1]) / dHead], curCol, 2.0, baseW, this.component.stageState.lineStyle
            );
            if (this.svgSurface._previewArrow) { this.svgSurface._previewArrow.remove(); this.svgSurface._previewArrow = null; }
            if (this.svgSurface._previewArrowGlow) { this.svgSurface._previewArrowGlow.remove(); this.svgSurface._previewArrowGlow = null; }
            if (arrow.glow) { this.svgSurface._previewArrowGlow = arrow.glow; this.component.glowLayer.appendChild(this.svgSurface._previewArrowGlow); }
            this.svgSurface._previewArrow = arrow.foreground;
            this.component.strokeLayer.appendChild(this.svgSurface._previewArrow);
          } else {
            if (this.svgSurface._previewArrow) { this.svgSurface._previewArrow.remove(); this.svgSurface._previewArrow = null; }
            if (this.svgSurface._previewArrowGlow) { this.svgSurface._previewArrowGlow.remove(); this.svgSurface._previewArrowGlow = null; }
          }
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
}

globalThis.QuoraGestureMachine = QuoraGestureMachine;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraGestureMachine;