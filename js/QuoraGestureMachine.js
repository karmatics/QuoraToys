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
    this.tipPointIndicator = null;
    this.activeTetherLine = null;
    this.pauseTimer = null;
  }

  init(svgSurface, stageBox) {
    this.svgSurface = svgSurface;
    this.stageBox = stageBox;

    this.svgSurface.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.stageBox.addEventListener('contextmenu', (e) => this.onContextMenu(e));
  }

  getStagePt(e) {
    const rect = this.stageBox.getBoundingClientRect();
    const z = this.component.stageState.zoom || 1.0;
    return [(e.clientX - rect.left) / z, (e.clientY - rect.top) / z];
  }

  cleanupGestureIndicators() {
      if (this.pauseTimer) clearTimeout(this.pauseTimer);
      if (this.deadzoneCircle) { this.deadzoneCircle.remove(); this.deadzoneCircle = null; }
      if (this.tipPointIndicator) { this.tipPointIndicator.remove(); this.tipPointIndicator = null; }
      if (this.activeTetherLine) { this.activeTetherLine.remove(); this.activeTetherLine = null; }
      if (this.svgSurface && this.svgSurface._preview) { this.svgSurface._preview.remove(); this.svgSurface._preview = null; }
      if (this.svgSurface && this.svgSurface._previewGlow) { this.svgSurface._previewGlow.remove(); this.svgSurface._previewGlow = null; }
      if (this.svgSurface && this.svgSurface._previewArrow) { this.svgSurface._previewArrow.remove(); this.svgSurface._previewArrow = null; }
      if (this.svgSurface && this.svgSurface._previewArrowGlow) { this.svgSurface._previewArrowGlow.remove(); this.svgSurface._previewArrowGlow = null; }

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
      // If clicked on an interactive control handle or HUD, ignore canvas click
      if (e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle-group, .qa-segment-midpoint-group, .qa-movable-label-group, .qa-image-plate-control, #qa-keyin-matrix-hud, #qa-transient-cursor-dial, .qa-selectable-callout, .qa-movable-text-badge, #qa-knot-context-menu')) return;

      const pt = this.getStagePt(e);
      this.component._lastStageMousePt = pt;
      const logger = QuoraLogger.getInstance();

      logger.log('gestures', 5, 'Canvas pointerdown', { x: Math.round(pt[0]), y: Math.round(pt[1]), tool: this.component.stageState.activeTool });

      // Shift + Canvas Drag on empty space: Marquee Multi-Knot Selection
      if (e.shiftKey && this.component.getActiveCurve() && !this.isDrawing) {
        const hitCurve = this.component.findNearestCurveAtPoint(pt, 16);
        if (!hitCurve) {
          this.isMarquee = true;
          this.marqueeStart = pt;
          let marqueeEl = document.getElementById('qa-marquee-box');
          if (!marqueeEl) {
            marqueeEl = makeElement('svg:rect', {
              id: 'qa-marquee-box',
              x: pt[0], y: pt[1], width: 0, height: 0,
              fill: 'rgba(0, 242, 254, 0.08)', stroke: '#00f2fe',
              'stroke-width': '1.5', 'stroke-dasharray': '4,3',
              style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 4px rgba(0,242,254,0.5))' }
            });
            this.component.controlsLayer.appendChild(marqueeEl);
          }
          return;
        }
      }

      // PRIORITY HIT-TESTING: Check if user is clicking a Curve or Knot first!
      // Even if it lies directly over an image plate, the knot/curve receives the interaction
      const hitCurve = this.component.findNearestCurveAtPoint(pt, 22);
      if (hitCurve && this.component.stageState.activeTool !== 'paint') {
        const closestKnotIdx = (hitCurve.t < 0.5) ? hitCurve.segIdx : Math.min((hitCurve.ann.vertices?.length || 1) - 1, hitCurve.segIdx + 1);
        this.component._activeKnotIdx = closestKnotIdx;
        if (!this.component._selectedKnotIndices) this.component._selectedKnotIndices = new Set();
        this.component._selectedKnotIndices.clear();
        this.component._selectedKnotIndices.add(closestKnotIdx);

        this.component.selectItem(hitCurve.ann);
        this.component.updateDynamicMidpointCandidate(hitCurve.ann);

        this._pendingBend = {
          curve: hitCurve.ann,
          segIdx: hitCurve.segIdx,
          startPt: pt,
          inserted: false
        };
        logger.log('knots', 3, 'Selected curve via path click', { curveId: hitCurve.ann.id, knotIdx: closestKnotIdx });
        return;
      }
      this._pendingBend = null;

      // Hit-Test Image Plates (Secondary to curve/knots)
      const hitPlate = this.component.hitTestImagePlate(pt);
      if (hitPlate && !e.shiftKey) {
        this.component.stageState.activeImage = hitPlate;
        this.component.stageState.selectedItem = null;
        this.component.controlsLayer.innerHTML = '';
        this.component.renderStage();
        logger.log('gestures', 2, 'Selected image plate', { id: hitPlate.id });
        return;
      }

      // Check for Endpoint Extension on Open Curves
      const curCurve = this.component.getActiveCurve();
      if (curCurve && curCurve.vertices && curCurve.vertices.length >= 2 && !curCurve.isClosed && this.component.stageState.activeTool !== 'paint') {
        const vHead = curCurve.vertices[0].point;
        const vTail = curCurve.vertices[curCurve.vertices.length - 1].point;
        const dTail = Math.hypot(pt[0] - vTail[0], pt[1] - vTail[1]);
        const dHead = Math.hypot(pt[0] - vHead[0], pt[1] - vHead[1]);

        if (dTail < 20) {
          this.extendingCurve = curCurve;
          this.extendAtTail = true;
          this.component.showKnotToast('↔ Extending curve from tail...');
          logger.log('knots', 3, 'Extending curve from tail');
        } else if (dHead < 20) {
          this.extendingCurve = curCurve;
          this.extendAtTail = false;
          this.component.showKnotToast('↔ Extending curve from head...');
          logger.log('knots', 3, 'Extending curve from head');
        } else {
          this.extendingCurve = null;
        }
      } else {
        this.extendingCurve = null;
      }

      if (this.component.stageState.activeTool === 'text') {
        this.component.promptDirectTextBadge(pt[0], pt[1]);
        return;
      }

      if (this.component._handRestActive) {
        this.component._handRestActive = false;
        this.isDrawing = true;
        this.component._isDrawingActive = true;
        this.component.hideClutchHandRestBadge();
        logger.log('gestures', 3, 'Resumed from hand-rest clutch');
        return;
      }

      // Clean Deselection on Empty Canvas Click
      const hadSelection = Boolean(this.component.stageState.selectedItem || this.component.stageState.activeImage);
      if (hadSelection && !this.extendingCurve) {
        this.component.deselectAll();
        this._justDeselected = true;
      } else {
        this._justDeselected = false;
      }

      // Clean up any stale previews from prior gestures
      this.cleanupGestureIndicators();

      this.isDrawing = true;
      this.component._isDrawingActive = true;
      this.startPt = pt;
      this.hasExceededDeadzone = false;
      this.strokePoints = [pt];

      this.deadzoneCircle = makeElement('svg:circle', {
        id: 'qa-deadzone-circle', cx: pt[0], cy: pt[1], r: '6',
        fill: 'rgba(255, 255, 255, 0.15)', stroke: '#00f2fe',
        'stroke-width': '1.2', 'stroke-dasharray': '2,2', style: { pointerEvents: 'none' }
      });
      this.component.controlsLayer.appendChild(this.deadzoneCircle);

      this.tipPointIndicator = makeElement('svg:circle', {
        id: 'qa-tip-point', cx: pt[0], cy: pt[1], r: '3.5', fill: '#ffffff',
        stroke: '#00e676', 'stroke-width': '1.5', style: { pointerEvents: 'none' }
      });
      this.component.controlsLayer.appendChild(this.tipPointIndicator);
    }

  onMouseMove(e) {
      try {
        const pt = this.getStagePt(e);
        this.component._lastStageMousePt = pt;
        const logger = QuoraLogger.getInstance();

        if (logger.filters.pointer) {
          logger.log('pointer', 10, 'Move', { x: Math.round(pt[0]), y: Math.round(pt[1]) });
        }

        // Handle Active Marquee Selection Box
        if (this.isMarquee && this.marqueeStart) {
          const marqueeEl = document.getElementById('qa-marquee-box');
          if (marqueeEl) {
            const x = Math.min(this.marqueeStart[0], pt[0]);
            const y = Math.min(this.marqueeStart[1], pt[1]);
            const w = Math.abs(pt[0] - this.marqueeStart[0]);
            const h = Math.abs(pt[1] - this.marqueeStart[1]);
            marqueeEl.setAttribute('x', x);
            marqueeEl.setAttribute('y', y);
            marqueeEl.setAttribute('width', w);
            marqueeEl.setAttribute('height', h);
          }
          return;
        }

        // Direct Curve Segment Bending
        if (this._pendingBend) {
          const dDrag = Math.hypot(pt[0] - this._pendingBend.startPt[0], pt[1] - this._pendingBend.startPt[1]);
          if (dDrag > 4) {
            if (!this._pendingBend.inserted) {
              this.component.strokeManager.addKnotOnCurve(this._pendingBend.curve, this._pendingBend.segIdx);
              this.component.exposeBezierHandles(this._pendingBend.curve);
              this._pendingBend.inserted = true;
              logger.log('knots', 3, 'Inserted knot for rubber-wire bending');
            }
            const activeKnot = this._pendingBend.curve.vertices[this.component._activeKnotIdx];
            if (activeKnot) {
              activeKnot.point[0] = pt[0];
              activeKnot.point[1] = pt[1];
              this.component.commitCurveGeometryUpdate();
            }
          }
          return;
        }

        // Hover is strictly isolated to when the user is IDLE (not drawing or dragging)
        if (!this.isDrawing && !this.component._isDrawingActive && !this.component.isInteracting() && !this.component._penNodes) {
          this.updateSpatialHover(pt);
          if (this.component.knotManager) {
            this.component.knotManager.updateHoveredDeleteTarget(pt);
            const curve = this.component.getActiveCurve();
            if (curve) {
              this.component.knotManager.updateDynamicMidpointCandidate(curve, this.component.controlsLayer, this.component.stageState);
            }
          }
          return;
        } else {
          this.clearHoverHighlight();
        }

        if (!this.isDrawing) return;

        if (this.component.stageState.activeTool === 'paint') {
          if (this.component.stageState.brushMode === 'erase') {
            const plate = this.component.stageState.activeImage || this.component.hitTestImagePlate(pt);
            if (plate) {
              this.component.imageManager.eraseImagePlatePixels(plate, pt[0], pt[1], this.component.stageState.brushSize / 2, this.component.stageState.brushSoftness);
            }
            return;
          }

          if (this.component.stageState.brushMode === 'rect') {
            this.component.previewBlockoutRect(this.strokePoints[0], pt);
            return;
          } else if (this.component.stageState.brushMode === 'oval') {
            this.component.previewBlockoutOval(this.strokePoints[0], pt);
            return;
          }

          this.strokePoints.push(pt);
          const pathD = this.strokePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
          if (!this.svgSurface._paintPreview) {
            this.svgSurface._paintPreview = makeElement('svg:path', {
              stroke: this.component.stageState.brushColor,
              'stroke-width': String(this.component.stageState.brushSize),
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              fill: 'none',
              ...(this.component.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
            });
            this.component.paintLayer.appendChild(this.svgSurface._paintPreview);
          }
          this.svgSurface._paintPreview.setAttribute('d', pathD);
          return;
        }

        // Shift Key Constraint: Draw Ruler-Straight Arrow/Line
        if (e.shiftKey) {
          this.hasExceededDeadzone = true;
          if (this.deadzoneCircle) {
            this.deadzoneCircle.remove();
            this.deadzoneCircle = null;
          }
          this.strokePoints = [this.startPt, pt];
          const curW = this.component.stageState.curveStrokeWidth || 3.2;

          if (!this.svgSurface._preview) {
            this.svgSurface._preview = makeElement('svg:path', {
              stroke: this.component.stageState.currentColor,
              'stroke-width': String(curW),
              fill: 'none',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round'
            });
            this.component.strokeLayer.appendChild(this.svgSurface._preview);
          }
          this.svgSurface._preview.setAttribute('d', `M ${this.startPt[0]} ${this.startPt[1]} L ${pt[0]} ${pt[1]}`);
          return;
        }

        // Responsive 4px deadzone
        const dFromStart = Math.hypot(pt[0] - this.startPt[0], pt[1] - this.startPt[1]);
        if (!this.hasExceededDeadzone && dFromStart > 4) {
          this.hasExceededDeadzone = true;
          logger.log('gestures', 4, 'Passed deadzone threshold → active drawing engaged');
          if (this.deadzoneCircle) {
            this.deadzoneCircle.remove();
            this.deadzoneCircle = null;
          }
        }

        if (!this.hasExceededDeadzone) {
          if (this.tipPointIndicator) {
            this.tipPointIndicator.setAttribute('cx', this.startPt[0]);
            this.tipPointIndicator.setAttribute('cy', this.startPt[1]);
          }
          return;
        }

        // Ctrl-Key Tether Clutch Tuning
        if (e.ctrlKey || e.metaKey) {
          this.component._clutchActive = true;
          const last = this.strokePoints[this.strokePoints.length - 1];
          const newR = Math.max(12, Math.min(180, Math.hypot(pt[0] - last[0], pt[1] - last[1])));
          this.component.stageState.tetherLength = Math.round(newR);

          if (!this.activeTetherLine) {
            this.activeTetherLine = makeElement('svg:line', {
              id: 'qa-drawstring-line', stroke: '#ffd700', 'stroke-width': '1.8', 'stroke-dasharray': '3,3'
            });
            this.component.controlsLayer.appendChild(this.activeTetherLine);
          }
          this.activeTetherLine.setAttribute('x1', last[0]);
          this.activeTetherLine.setAttribute('y1', last[1]);
          this.activeTetherLine.setAttribute('x2', pt[0]);
          this.activeTetherLine.setAttribute('y2', pt[1]);
          this.component.showKnotToast(`⏸️ Tether: ${Math.round(newR)}px (Hold Ctrl)`);
          return;
        } else {
          this.component._clutchActive = false;
        }

        if (!this.activeTetherLine) {
          this.activeTetherLine = makeElement('svg:line', {
            id: 'qa-drawstring-line', stroke: 'rgba(255, 255, 255, 0.85)', 'stroke-width': '1.8'
          });
          this.component.controlsLayer.appendChild(this.activeTetherLine);
        }

        const last = this.strokePoints[this.strokePoints.length - 1];
        const dist = Math.hypot(pt[0] - last[0], pt[1] - last[1]);
        const tetherLen = this.component.stageState.tetherLength || 32;

        if (dist > tetherLen) {
          const ux = (pt[0] - last[0]) / dist;
          const uy = (pt[1] - last[1]) / dist;
          const leadPt = [pt[0] - ux * tetherLen, pt[1] - uy * tetherLen];
          this.strokePoints.push(leadPt);

          if (this.tipPointIndicator) {
            this.tipPointIndicator.setAttribute('cx', leadPt[0]);
            this.tipPointIndicator.setAttribute('cy', leadPt[1]);
          }
        }

        const curTip = this.strokePoints[this.strokePoints.length - 1];
        this.activeTetherLine.setAttribute('x1', curTip[0]);
        this.activeTetherLine.setAttribute('y1', curTip[1]);
        this.activeTetherLine.setAttribute('x2', pt[0]);
        this.activeTetherLine.setAttribute('y2', pt[1]);

        // Proximity check for auto-loop closure preview
        const dToOrigin = Math.hypot(curTip[0] - this.startPt[0], curTip[1] - this.startPt[1]);
        const isLoopClosing = (this.strokePoints.length > 8 && dToOrigin < 24);

        // LIVE REAL-TIME SMOOTH SPLINE PREVIEW (60 FPS, No Freezing)
        const pointsForSpline = [...this.strokePoints];
        if (isLoopClosing) {
          pointsForSpline.push([this.startPt[0], this.startPt[1]]);
        } else if (pointsForSpline.length === 1) {
          pointsForSpline.push(curTip);
        }

        const previewD = this.getSmoothPath(pointsForSpline);

        const baseW = this.component.stageState.curveStrokeWidth || 3.2;
        const z = this.component.stageState.cadStrokeMode ? (this.component.stageState.zoom || 1.0) : 1.0;
        const curW = baseW / z;
        const curCol = isLoopClosing ? '#00f2fe' : (this.component.stageState.currentColor || '#00e676');
        const isNeon = (this.component.stageState.lineStyle === 'neon');

        // 1. Neon Outer Glow Layer in this.component.glowLayer
        if (isNeon) {
          const coreTint = this.component.strokeManager.getLuminousCoreColor(curCol);

          if (!this.svgSurface._previewGlow) {
            this.svgSurface._previewGlow = makeElement('svg:path', {
              stroke: curCol,
              'stroke-width': String((baseW + 10) / z),
              fill: 'none',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              style: {
                pointerEvents: 'none',
                filter: 'url(#qa-neon-glow)',
                opacity: '0.92'
              }
            });
            this.component.glowLayer.appendChild(this.svgSurface._previewGlow);
          }
          this.svgSurface._previewGlow.setAttribute('d', previewD);
          this.svgSurface._previewGlow.setAttribute('stroke', curCol);
          this.svgSurface._previewGlow.setAttribute('stroke-width', String((baseW + 10) / z));
          this.svgSurface._previewGlow.style.display = 'block';

          // 2. Neon Inner Core (Narrow 2.5px plasma blade in this.component.strokeLayer)
          if (!this.svgSurface._preview) {
            this.svgSurface._preview = makeElement('svg:path', {
              stroke: coreTint,
              'stroke-width': String(2.5 / z),
              fill: 'none',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              style: {
                pointerEvents: 'none',
                filter: 'url(#qa-neon-core)'
              }
            });
            this.component.strokeLayer.appendChild(this.svgSurface._preview);
          }
          this.svgSurface._preview.setAttribute('d', previewD);
          this.svgSurface._preview.setAttribute('stroke', coreTint);
          this.svgSurface._preview.setAttribute('stroke-width', String(2.5 / z));
          this.svgSurface._preview.style.filter = 'url(#qa-neon-core)';
        } else {
          if (this.svgSurface._previewGlow) {
            this.svgSurface._previewGlow.style.display = 'none';
          }

          // Classic Crisp Stroke in this.component.strokeLayer
          if (!this.svgSurface._preview) {
            this.svgSurface._preview = makeElement('svg:path', {
              stroke: curCol,
              'stroke-width': String(curW),
              fill: isLoopClosing ? 'rgba(0, 242, 254, 0.08)' : 'none',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              style: { pointerEvents: 'none' }
            });
            this.component.strokeLayer.appendChild(this.svgSurface._preview);
          }
          this.svgSurface._preview.setAttribute('d', previewD);
          this.svgSurface._preview.setAttribute('stroke', curCol);
          this.svgSurface._preview.setAttribute('stroke-width', String(curW));
          this.svgSurface._preview.style.filter = 'none';
        }

        // Live Arrowhead on the curve start point during drag (INCLUDING NEON GLOW)
        if (this.component.stageState.hasArrow && !isLoopClosing && pointsForSpline.length >= 2) {
          const p0 = pointsForSpline[0];
          const p1 = pointsForSpline[1];
          const dHead = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
          const arrow = this.component.strokeManager.renderConcaveArrowhead(
            p0,
            [(p1[0] - p0[0]) / dHead, (p1[1] - p0[1]) / dHead],
            curCol,
            2.0,
            baseW,
            this.component.stageState.lineStyle
          );

          if (this.svgSurface._previewArrow) {
            this.svgSurface._previewArrow.remove();
            this.svgSurface._previewArrow = null;
          }
          if (this.svgSurface._previewArrowGlow) {
            this.svgSurface._previewArrowGlow.remove();
            this.svgSurface._previewArrowGlow = null;
          }

          if (arrow.glow) {
            this.svgSurface._previewArrowGlow = arrow.glow;
            this.component.glowLayer.appendChild(this.svgSurface._previewArrowGlow);
          }

          this.svgSurface._previewArrow = arrow.foreground;
          this.component.strokeLayer.appendChild(this.svgSurface._previewArrow);
        } else {
          if (this.svgSurface._previewArrow) {
            this.svgSurface._previewArrow.remove();
            this.svgSurface._previewArrow = null;
          }
          if (this.svgSurface._previewArrowGlow) {
            this.svgSurface._previewArrowGlow.remove();
            this.svgSurface._previewArrowGlow = null;
          }
        }

        logger.log('spline', 8, `Live preview updated: ${pointsForSpline.length} points`);
      } catch (err) {
        QuoraLogger.getInstance().log('error', 1, 'Error in onMouseMove: ' + err.message);
      }
    }

  onMouseUp(e) {
      const logger = QuoraLogger.getInstance();

      if (this._pendingBend) {
        if (this._pendingBend.inserted) {
          this.component.exposeBezierHandles(this._pendingBend.curve);
          this.component.renderStage();
          logger.log('knots', 3, 'Committed wire bend to curve');
        }
        this._pendingBend = null;
        return;
      }

      // Complete Marquee Selection
      if (this.isMarquee && this.marqueeStart) {
        this.isMarquee = false;
        const pt = this.getStagePt(e);
        const minX = Math.min(this.marqueeStart[0], pt[0]);
        const maxX = Math.max(this.marqueeStart[0], pt[0]);
        const minY = Math.min(this.marqueeStart[1], pt[1]);
        const maxY = Math.max(this.marqueeStart[1], pt[1]);

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
            logger.log('knots', 3, `Marquee selected ${selectedCount} knots`);
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
        logger.log('gestures', 3, 'Entered hand-rest clutch state');
        return;
      }

      this.isDrawing = false;
      this.component._isDrawingActive = false;
      this.cleanupGestureIndicators();

      if (this.component.stageState.activeTool === 'paint') {
        const pt = this.getStagePt(e);
        if (this.component.stageState.brushMode === 'erase') {
          this.strokePoints = [];
          return;
        }
        if (this.component.stageState.brushMode === 'rect') {
          this.component.commitBlockoutRect(this.strokePoints[0], pt);
        } else if (this.component.stageState.brushMode === 'oval') {
          this.component.commitBlockoutOval(this.strokePoints[0], pt);
        } else if (this.svgSurface._paintPreview) {
          this.component.stageState.annotations.push({
            type: 'paint',
            points: [...this.strokePoints],
            color: this.component.stageState.brushColor,
            width: this.component.stageState.brushSize,
            softness: this.component.stageState.brushSoftness,
            element: this.svgSurface._paintPreview
          });
          this.svgSurface._paintPreview = null;
          this.component.renderStage();
        }
        this.strokePoints = [];
        return;
      }

      // Single click without drag: cleanly released with zero orphan dots
      if (!this.hasExceededDeadzone) {
        this.strokePoints = [];
        this.extendingCurve = null;
        logger.log('gestures', 5, 'Single tap without drag; cleanly released');
        return;
      }

      if (this.strokePoints.length >= 2) {
        const strokeLength = this.strokePoints.reduce((acc, p, idx) => idx ? acc + Math.hypot(p[0] - this.strokePoints[idx - 1][0], p[1] - this.strokePoints[idx - 1][1]) : 0, 0);
        const dynamicError = Math.max(3.5, Math.min(8.0, strokeLength * 0.025));

        // Auto-Closing Loop Detection
        const lastPt = this.strokePoints[this.strokePoints.length - 1];
        const dOrigin = Math.hypot(lastPt[0] - this.startPt[0], lastPt[1] - this.startPt[1]);
        const shouldCloseLoop = (this.strokePoints.length > 8 && dOrigin < 24);

        if (shouldCloseLoop) {
          this.strokePoints[this.strokePoints.length - 1] = [this.startPt[0], this.startPt[1]];
        }

        // Extending an existing curve
        if (this.extendingCurve && this.extendingCurve.vertices) {
          const extensionBeziers = (typeof CurveFitter !== 'undefined') ? CurveFitter.fit(this.strokePoints, dynamicError) : [];
          const extensionVertices = this.component.beziersToVertices(extensionBeziers);

          if (extensionVertices.length > 0) {
            if (this.extendAtTail) {
              this.extendingCurve.vertices.push(...extensionVertices.slice(1));
            } else {
              this.extendingCurve.vertices.unshift(...extensionVertices.slice(0, -1));
            }
            this.component.commitCurveGeometryUpdate();
            this.component.exposeBezierHandles(this.extendingCurve);
            this.component.showKnotToast('↔ Curve extended successfully');
            logger.log('knots', 2, 'Extended curve vertices count: ' + this.extendingCurve.vertices.length);
          }
          this.extendingCurve = null;
          this.strokePoints = [];
          return;
        }

        const beziers = (typeof CurveFitter !== 'undefined') ? CurveFitter.fit(this.strokePoints, dynamicError) : [];
        logger.log('gestures', 3, `Fitted ${beziers.length} cubic Bézier segment(s) from ${this.strokePoints.length} stroke points`);

        if (beziers && beziers.length > 0) {
          const hasArrow = shouldCloseLoop ? false : this.component.stageState.hasArrow;
          this.component.commitSpline(beziers, this.component.stageState.currentColor, hasArrow);
          const lastCurve = this.component.getActiveCurve();
          if (lastCurve) {
            if (shouldCloseLoop) {
              lastCurve.isClosed = true;
              lastCurve.arrowEnd = 'none';
              this.component.commitCurveGeometryUpdate();
              this.component.showKnotToast('🔄 Snapped Closed: Loop Ring Active');
            }
            // Intrusive automatic pop-up dial removed cleanly
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
      if (!pts || pts.length === 0) return '';
      if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[0][0]} ${pts[0][1]}`;
      if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;

      let d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i][0] + pts[i + 1][0]) / 2;
        const yc = (pts[i][1] + pts[i + 1][1]) / 2;
        d += ` Q ${pts[i][0]} ${pts[i][1]} ${xc} ${yc}`;
      }
      d += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
      return d;
    }
}

globalThis.QuoraGestureMachine = QuoraGestureMachine;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraGestureMachine;