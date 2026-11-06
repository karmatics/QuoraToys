class DrawingTool {
  constructor(targetElement = document.body, options = {}) {
    this.targetElement = targetElement;
    this.options = options || {};

    this.colors = ['#00e676', '#00f2fe', '#ffd700', '#ff2d55', '#ff8000', '#c084fc', '#ffffff'];
    this.currentColor = this.colors[0];
    this.strokeWidth = 3.2;
    this.hasArrow = true;

    this.svg = null;
    this.curvesGroup = null;
    this.tetherLength = 32;

    this.createSvgOverlay();
    this.setupInteractions();
    this.setupInSituImagePicker();
  }

  createSvgOverlay() {
    const existing = document.querySelector('.quoratoys-draw-overlay');
    if (existing) existing.remove();

    this.svg = makeElement('svg:svg', {
      className: 'quoratoys-draw-overlay',
      style: {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        zIndex: '2147483640', pointerEvents: 'auto', cursor: 'crosshair', overflow: 'visible'
      }
    });

    this.curvesGroup = makeElement('svg:g', { className: 'draw-curves-layer' });
    this.svg.appendChild(this.curvesGroup);
    this.targetElement.appendChild(this.svg);
  }

  renderConcaveArrowhead(p0, exitTangent, color) {
    const ux = exitTangent[0];
    const uy = exitTangent[1];
    const nx = -uy;
    const ny = ux;

    const barbLen = 18;
    const barbSpread = 11;
    const b1 = [p0[0] + ux * barbLen + nx * barbSpread, p0[1] + uy * barbLen + ny * barbSpread];
    const b2 = [p0[0] + ux * barbLen - nx * barbSpread, p0[1] + uy * barbLen - ny * barbSpread];
    const c1 = [p0[0] + ux * 8 + nx * 2.5, p0[1] + uy * 8 + ny * 2.5];
    const c2 = [p0[0] + ux * 8 - nx * 2.5, p0[1] + uy * 8 - ny * 2.5];

    const arrowD = `M ${b1[0]} ${b1[1]} Q ${c1[0]} ${c1[1]} ${p0[0]} ${p0[1]} M ${p0[0]} ${p0[1]} Q ${c2[0]} ${c2[1]} ${b2[0]} ${b2[1]}`;

    const shadow = makeElement('svg:path', {
      d: arrowD, transform: 'translate(2, 2)',
      stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5.5', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    const foreground = makeElement('svg:path', {
      d: arrowD, stroke: color, 'stroke-width': '3.2', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    return { shadow, foreground };
  }

  setupInteractions() {
    let isDrawing = false;
    let strokePoints = [];
    let startPt = null;
    let hasExceededDeadzone = false;

    let deadzoneCircle = null;
    let tipPointIndicator = null;
    let activeTetherLine = null;

    const cleanup = () => {
      if (deadzoneCircle) { deadzoneCircle.remove(); deadzoneCircle = null; }
      if (tipPointIndicator) { tipPointIndicator.remove(); tipPointIndicator = null; }
      if (activeTetherLine) { activeTetherLine.remove(); activeTetherLine = null; }
      if (this.svg._preview) { this.svg._preview.remove(); this.svg._preview = null; }
    };

    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      isDrawing = true;
      startPt = [e.clientX, e.clientY];
      hasExceededDeadzone = false;
      strokePoints = [startPt];

      deadzoneCircle = makeElement('svg:circle', {
        cx: startPt[0], cy: startPt[1], r: String(this.tetherLength),
        fill: 'rgba(255, 255, 255, 0.12)', stroke: 'rgba(255, 255, 255, 0.75)',
        'stroke-width': '1.2', 'stroke-dasharray': '3,3', style: { pointerEvents: 'none' }
      });
      this.svg.appendChild(deadzoneCircle);

      tipPointIndicator = makeElement('svg:circle', {
        cx: startPt[0], cy: startPt[1], r: '4', fill: 'none',
        stroke: '#ffd700', 'stroke-width': '1.5', style: { pointerEvents: 'none' }
      });
      this.svg.appendChild(tipPointIndicator);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const pt = [e.clientX, e.clientY];

      const d = Math.hypot(pt[0] - startPt[0], pt[1] - startPt[1]);
      if (!hasExceededDeadzone && d > this.tetherLength) hasExceededDeadzone = true;
      if (!hasExceededDeadzone) return;

      if (!activeTetherLine) {
        activeTetherLine = makeElement('svg:line', {
          stroke: '#ffffff', 'stroke-width': '2.0', filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.8))'
        });
        this.svg.appendChild(activeTetherLine);
      }

      const last = strokePoints[strokePoints.length - 1];
      const dist = Math.hypot(pt[0] - last[0], pt[1] - last[1]);

      if (dist > this.tetherLength) {
        const ux = (pt[0] - last[0]) / dist;
        const uy = (pt[1] - last[1]) / dist;
        strokePoints.push([pt[0] - ux * this.tetherLength, pt[1] - uy * this.tetherLength]);
      }

      const curTip = strokePoints[strokePoints.length - 1];
      activeTetherLine.setAttribute('x1', curTip[0]);
      activeTetherLine.setAttribute('y1', curTip[1]);
      activeTetherLine.setAttribute('x2', pt[0]);
      activeTetherLine.setAttribute('y2', pt[1]);

      const dPath = strokePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
      if (!this.svg._preview) {
        this.svg._preview = makeElement('svg:path', {
          stroke: this.currentColor, 'stroke-width': '3.2', 'stroke-dasharray': '4,3', fill: 'none'
        });
        this.svg.appendChild(this.svg._preview);
      }
      this.svg._preview.setAttribute('d', dPath);
    });

    window.addEventListener('mouseup', () => {
      if (!isDrawing) return;
      isDrawing = false;
      cleanup();

      if (strokePoints.length >= 2) {
        const beziers = (typeof CurveFitter !== 'undefined') ? CurveFitter.fit(strokePoints, 4) : [];
        if (beziers && beziers.length > 0) {
          this.commitSpline(beziers);
        }
      }
      strokePoints = [];
    });

    this.svg.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (isDrawing) {
        isDrawing = false;
        cleanup();
        strokePoints = [];
      }
    });
  }

  commitSpline(beziers) {
    let d = 'M ' + beziers[0][0].join(' ');
    for (let i = 0; i < beziers.length; i++) {
      const [start, cp1, cp2, end] = beziers[i];
      d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
    }

    const shadow = makeElement('svg:path', {
      d, transform: 'translate(2, 2)', stroke: 'rgba(10, 15, 25, 0.95)',
      'stroke-width': '5.5', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    const foreground = makeElement('svg:path', {
      d, stroke: this.currentColor, 'stroke-width': '3.2', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    this.curvesGroup.appendChild(shadow);
    this.curvesGroup.appendChild(foreground);

    if (this.hasArrow) {
      const p0 = beziers[0][0];
      const p1 = beziers[0][1];
      const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const arrow = this.renderConcaveArrowhead(p0, [(p1[0] - p0[0]) / dist, (p1[1] - p0[1]) / dist], this.currentColor);
      this.curvesGroup.appendChild(arrow.shadow);
      this.curvesGroup.appendChild(arrow.foreground);
    }
  }

  setupInSituImagePicker() {
    let hoverImg = null;

    const onHover = (e) => {
      const target = e.target;
      if (target && target.tagName === 'IMG' && target.offsetWidth > 100 && target.offsetHeight > 80) {
        if (hoverImg && hoverImg !== target) hoverImg.style.outline = hoverImg._origOutline || '';
        hoverImg = target;
        hoverImg._origOutline = hoverImg.style.outline;
        hoverImg.style.outline = '3px dashed #00f2fe';
        hoverImg.style.cursor = 'zoom-in';
      } else if (hoverImg && (!target || target.tagName !== 'IMG')) {
        hoverImg.style.outline = hoverImg._origOutline || '';
        hoverImg = null;
      }
    };

    const onClick = (e) => {
      const target = e.target;
      if (target && target.tagName === 'IMG' && target.offsetWidth > 100 && target.offsetHeight > 80) {
        e.preventDefault(); e.stopPropagation();
        if (hoverImg) hoverImg.style.outline = hoverImg._origOutline || '';
        document.removeEventListener('mousemove', onHover, true);
        document.removeEventListener('click', onClick, true);
        if (typeof QuoraAnnotationComponent !== 'undefined' && QuoraAnnotationComponent.launchStandalone) {
          QuoraAnnotationComponent.launchStandalone(target);
        }
      }
    };

    document.addEventListener('mousemove', onHover, true);
    document.addEventListener('click', onClick, true);
  }

  quit() {
    if (this.svg) this.svg.remove();
  }
}

globalThis.DrawingTool = DrawingTool;
if (typeof module !== 'undefined' && module.exports) module.exports = DrawingTool;