/**
 * QuoraGestureMachine
 * Encapsulates the hybrid gesture machine:
 * • Deadzone touchdown radius detection (32px)
 * • Kinetic drawstring tether engagement
 * • Tether-Clutch Hand-Rest pause (Ctrl key)
 * • Shift+Drag Marquee multi-knot selection
 * • Hover-knot activation & 1-click grab
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
    this.deadzoneCircle = null;
    this.tipPointIndicator = null;
    this.activeTetherLine = null;
    this.pauseTimer = null;
  }

  cleanupGestureIndicators() {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    if (this.deadzoneCircle) { this.deadzoneCircle.remove(); this.deadzoneCircle = null; }
    if (this.tipPointIndicator) { this.tipPointIndicator.remove(); this.tipPointIndicator = null; }
    if (this.activeTetherLine) { this.activeTetherLine.remove(); this.activeTetherLine = null; }
    if (this.component.svgSurface._preview) {
      this.component.svgSurface._preview.remove();
      this.component.svgSurface._preview = null;
    }
    if (this.component.inSituHud) {
      this.component.inSituHud.hideCursorReticle();
      this.component.inSituHud.hideTransientCursorDial();
    }
  }

  updateSpatialHover(mousePt) {
    if (this.isDrawing || (this.component._penNodes && this.component._penNodes.length > 0)) {
      this.clearHoverHighlight();
      return;
    }

    const hit = this.component.findNearestCurveAtPoint(mousePt, this.component._hoveredCurve ? 36 : 24);
    if (hit) {
      if (this.component._hoveredCurve !== hit.ann) {
        this.clearHoverHighlight();
        this.component._hoveredCurve = hit.ann;
        this.component.applyCurveGlow(hit.ann);
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

        const targetHandle = this.component.controlsLayer.querySelectorAll('circle[r="14"]')[idx];
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
}

globalThis.QuoraGestureMachine = QuoraGestureMachine;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraGestureMachine;