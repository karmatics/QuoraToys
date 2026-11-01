class DrawingTool {
  constructor(targetElement = document.body, options = {}) {
    this.targetElement = targetElement;
    this.options = options || {};

    this.colors = [
      '#00e676', // Emerald
      '#00f2fe', // Cyan
      '#ffd700', // Yellow
      '#ff2d55', // Red / Rose
      '#ff8000', // Orange
      '#c084fc', // Amethyst / Purple
      '#ffffff'  // Pure White
    ];
    this.colorIndex = 0;
    this.currentColor = this.colors[0];

    this.modes = ['curve', 'line', 'balloon'];
    this.toolMode = this.options.mode || 'curve'; // 'curve' | 'line' | 'balloon'
    this.hasArrow = true;
    this.strokeWidth = 4;
    this.roundCorners = true;
    this.filletRadius = 18;

    this.svg = null;
    this.hudElement = null;
    this.isDrawing = false;
    this.lastPoint = [0, 0];
    this.currentPoints = [];
    this.drawnObjects = []; // Array of { type: 'path'|'balloon', element, data }
    this.pencilSprite = null;

    // Kinetic tether & string drag
    this.controlPressed = false;
    this.inControlMode = false;
    this.offsetVector = [0, 0];
    this.controlLine = null;
    this.anchorPoint = null;
    this.lastControlPos = null;
    this.shiftPressed = false;
    this.lastMousePos = null;
    this.usedControl = false;

    this.createSvgOverlay();
    this.createHudToolbar();
    this.addEventListeners();
    this.setupKeystrokes();
  }

  distance(pt1, pt2) {
    const dx = pt1[0] - pt2[0];
    const dy = pt1[1] - pt2[1];
    return Math.hypot(dx, dy);
  }

  createSvgOverlay() {
    this.svg = makeElement('svg:svg', {
      className: 'quoratoys-draw-overlay',
      style: {
        position: 'fixed',
        zIndex: '2147483640',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'auto',
        cursor: 'crosshair',
        overflow: 'visible'
      }
    });

    // Marker Arrowheads Definition
    this.markerDefs = makeElement('svg:defs');
    this._rebuildArrowheadMarkers();
    this.svg.appendChild(this.markerDefs);

    this.curvesGroup = makeElement('svg:g', { className: 'draw-curves-layer' });
    this.svg.appendChild(this.curvesGroup);

    this.targetElement.appendChild(this.svg);
  }

  _rebuildArrowheadMarkers() {
    if (!this.markerDefs) return;
    this.markerDefs.innerHTML = '';

    this.colors.forEach((col, idx) => {
      const cleanCol = col.replace('#', 'c_');
      const marker = makeElement('svg:marker', {
        id: `qt-arrow-${cleanCol}`,
        viewBox: '0 0 10 10',
        refX: '7',
        refY: '5',
        markerWidth: '6',
        markerHeight: '6',
        orient: 'auto-start-reverse'
      }, [
        makeElement('svg:path', {
          d: 'M 0 1.5 L 9 5 L 0 8.5 z',
          fill: col,
          stroke: 'rgba(0,0,0,0.4)',
          'stroke-width': '0.6'
        })
      ]);
      this.markerDefs.appendChild(marker);
    });
  }

  createHudToolbar() {
    if (this.hudElement) return;

    const hud = makeElement('div', {
      className: 'quoratoys-draw-hud',
      style: {
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483646',
        background: 'rgba(15, 23, 42, 0.94)',
        border: '1.5px solid #00e676',
        borderRadius: '30px',
        padding: '5px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 18px rgba(0, 230, 118, 0.35)',
        fontFamily: 'monospace',
        fontSize: '11.5px',
        color: '#f8fafc',
        backdropFilter: 'blur(10px)',
        userSelect: 'none'
      }
    });

    // 1. Tool Mode Buttons
    const btnCurve = makeElement('button', {
      className: `dr-nav-btn ${this.toolMode === 'curve' ? 'primary' : ''}`,
      style: { padding: '3px 8px', fontSize: '10.5px' },
      onclick: () => this.setToolMode('curve')
    }, '〰️ Spline');

    const btnLine = makeElement('button', {
      className: `dr-nav-btn ${this.toolMode === 'line' ? 'primary' : ''}`,
      style: { padding: '3px 8px', fontSize: '10.5px' },
      onclick: () => this.setToolMode('line')
    }, '📏 Line');

    const btnBalloon = makeElement('button', {
      className: `dr-nav-btn ${this.toolMode === 'balloon' ? 'primary' : ''}`,
      style: { padding: '3px 8px', fontSize: '10.5px' },
      onclick: () => this.setToolMode('balloon')
    }, '💬 Balloon');

    this.modeButtons = { curve: btnCurve, line: btnLine, balloon: btnBalloon };

    // 2. Arrowhead Toggle
    const btnArrow = makeElement('button', {
      className: `dr-nav-btn ${this.hasArrow ? 'primary' : ''}`,
      style: { padding: '3px 8px', fontSize: '10.5px', color: this.hasArrow ? '#00f2fe' : '#64748b' },
      onclick: () => {
        this.hasArrow = !this.hasArrow;
        btnArrow.classList.toggle('primary', this.hasArrow);
        btnArrow.style.color = this.hasArrow ? '#00f2fe' : '#64748b';
        btnArrow.textContent = this.hasArrow ? '🏹 Arrow ON' : '🏹 Arrow OFF';
      }
    }, '🏹 Arrow ON');
    this.arrowButton = btnArrow;

    // 3. Fillet / Rounded Corner Toggle (for straight lines)
    const btnFillet = makeElement('button', {
      className: `dr-nav-btn ${this.roundCorners ? 'primary' : ''}`,
      style: { padding: '3px 8px', fontSize: '10.5px' },
      title: 'Round sharp corners between connected line segments',
      onclick: () => {
        this.roundCorners = !this.roundCorners;
        btnFillet.classList.toggle('primary', this.roundCorners);
        btnFillet.textContent = this.roundCorners ? '📐 Round: ON' : '📐 Round: OFF';
      }
    }, '📐 Round: ON');

    // 4. Color Swatches
    const swatches = makeElement('div', {
      style: { display: 'flex', gap: '4px', alignItems: 'center', margin: '0 4px' }
    });

    this.colors.forEach((col, idx) => {
      const b = makeElement('button', {
        style: {
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: col,
          border: this.currentColor === col ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
          cursor: 'pointer',
          padding: '0',
          boxShadow: this.currentColor === col ? `0 0 8px ${col}` : 'none',
          transform: this.currentColor === col ? 'scale(1.25)' : 'none',
          transition: 'all 0.12s ease'
        },
        onclick: () => this.setColor(idx)
      });
      swatches.appendChild(b);
    });
    this.swatchesContainer = swatches;

    // 5. Actions: Snapshot Copy, Undo, Clear, Exit
    const copyBtn = makeElement('button', {
      className: 'dr-nav-btn primary',
      style: { padding: '3px 9px', fontSize: '10.5px', fontWeight: 'bold', background: '#238636', borderColor: '#2ea043' },
      title: 'Copy visible drawing or image directly to clipboard for Quora',
      onclick: () => this.copySnapshot(copyBtn)
    }, '📋 Copy for Quora');

    const undoBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '3px 7px', fontSize: '10.5px' },
      title: 'Undo last drawing (Ctrl+Z or U)',
      onclick: () => this.undoLast()
    }, '↺ Undo');

    const clearBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '3px 7px', fontSize: '10.5px', color: '#ff7b72' },
      title: 'Clear all annotations',
      onclick: () => this.clear()
    }, '🗑️');

    const closeBtn = makeElement('button', {
      style: {
        background: '#334155', color: '#fff', border: 'none',
        borderRadius: '50%', width: '20px', height: '20px',
        cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
      },
      title: 'Exit Drawing Mode (Esc)',
      onclick: () => this.quit()
    }, '✕');

    hud.append(
      btnCurve,
      btnLine,
      btnBalloon,
      btnArrow,
      btnFillet,
      swatches,
      copyBtn,
      undoBtn,
      clearBtn,
      closeBtn
    );

    document.body.appendChild(hud);
    this.hudElement = hud;
  }

  setToolMode(mode) {
    this.toolMode = mode;
    Object.keys(this.modeButtons).forEach(k => {
      this.modeButtons[k].classList.toggle('primary', k === mode);
    });
    if (this.svg) {
      this.svg.style.cursor = mode === 'balloon' ? 'text' : 'crosshair';
    }
  }

  setColor(index) {
    this.colorIndex = index;
    this.currentColor = this.colors[index];

    if (this.swatchesContainer) {
      const btns = this.swatchesContainer.children;
      for (let i = 0; i < btns.length; i++) {
        const isSel = (i === index);
        btns[i].style.border = isSel ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)';
        btns[i].style.boxShadow = isSel ? `0 0 8px ${this.currentColor}` : 'none';
        btns[i].style.transform = isSel ? 'scale(1.25)' : 'none';
      }
    }

    if (this.pencilSprite) {
      this.pencilSprite.setColor(this.currentColor);
    }
  }

  addEventListeners() {
    this.boundStart = this.startDrawing.bind(this);
    this.boundDraw = this.draw.bind(this);
    this.boundStop = this.stopDrawing.bind(this);

    ['mousedown', 'touchstart'].forEach((e) =>
      this.svg.addEventListener(e, this.boundStart, { passive: false })
    );
    ['mousemove', 'touchmove'].forEach((e) =>
      this.svg.addEventListener(e, this.boundDraw, { passive: false })
    );
    ['mouseup', 'touchend'].forEach((e) =>
      this.svg.addEventListener(e, this.boundStop, { passive: false })
    );

    this.boundKeyDown = (e) => {
      if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Control' || e.key === 'Meta') this.controlPressed = true;
      if (e.key === 'Shift') this.shiftPressed = true;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        this.undoLast();
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        this.quit();
        e.preventDefault();
      }
    };

    this.boundKeyUp = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') this.controlPressed = false;
      if (e.key === 'Shift') this.shiftPressed = false;
    };

    window.addEventListener('keydown', this.boundKeyDown, true);
    window.addEventListener('keyup', this.boundKeyUp, true);
  }

  setupKeystrokes() {
    if (typeof KeystrokeHandler !== 'undefined') {
      KeystrokeHandler.addHandler('c', () => this.setToolMode('curve'));
      KeystrokeHandler.addHandler('l', () => this.setToolMode('line'));
      KeystrokeHandler.addHandler('b', () => this.setToolMode('balloon'));
      KeystrokeHandler.addHandler('a', () => this.arrowButton?.click());
      KeystrokeHandler.addHandler('u', () => this.undoLast());
    }
  }

  startDrawing(e) {
    if (e.target.closest('.quoratoys-draw-hud, .qt-balloon-card')) return;

    const pt = this._getEventPoint(e);
    this.isDrawing = true;
    this.lastPoint = pt;
    this.currentPoints = [pt];
    this.lastMousePos = pt;
    this.offsetVector = [0, 0];
    this.anchorPoint = null;
    this.inControlMode = false;
    this.lastControlPos = pt;
    this.usedControl = false;

    if (this.toolMode === 'balloon') {
      this.createSpeechBalloon(pt[0], pt[1]);
      this.isDrawing = false;
      e.preventDefault();
      return;
    }

    if (this.toolMode === 'line') {
      this.createSvgLinePreview(pt, pt);
    } else {
      this.createSvgPath(this.currentPoints);
    }

    if (this.controlPressed) {
      this.inControlMode = true;
      this.anchorPoint = [...this.lastPoint];
      this.createControlLine(pt[0], pt[1]);
      this.usedControl = true;
    }

    e.preventDefault();
  }

  draw(e) {
    const pt = this._getEventPoint(e);
    this.lastMousePos = pt;

    if (!this.isDrawing) return;

    if (this.toolMode === 'line') {
      this.updateSvgLinePreview(this.lastPoint, pt);
      e.preventDefault();
      return;
    }

    if (this.controlPressed) {
      if (!this.inControlMode) {
        this.inControlMode = true;
        this.anchorPoint = [...this.currentPoints[this.currentPoints.length - 1]];
        this.createControlLine(pt[0], pt[1]);
        this.usedControl = true;
      }
      this.lastControlPos = pt;
      this.updateControlLine(pt[0], pt[1]);
      return;
    } else if (this.inControlMode) {
      const dx = this.lastControlPos[0] - this.anchorPoint[0];
      const dy = this.lastControlPos[1] - this.anchorPoint[1];
      const d = Math.hypot(dx, dy);
      this.offsetVector = d < 4 ? [0, 0] : [dx, dy];
      this.removeControlLine();
      this.inControlMode = false;
    }

    if (this.shiftPressed && (this.offsetVector[0] !== 0 || this.offsetVector[1] !== 0)) {
      this.backtrackIfCloser(pt);
      this.updateControlLine(pt[0], pt[1], true);
      this._updatePreviewPaths();
      return;
    }

    const effectivePoint = this.computeEffectivePoint(pt);
    if (this.distance(this.currentPoints[this.currentPoints.length - 1], effectivePoint) >= 3) {
      this.currentPoints.push(effectivePoint);
    }

    if (this.offsetVector[0] !== 0 || this.offsetVector[1] !== 0) {
      this.updateControlLine(pt[0], pt[1]);
    }

    this._updatePreviewPaths();
    e.preventDefault();
  }

  stopDrawing(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.inControlMode && this.lastControlPos) {
      const dx = this.lastControlPos[0] - this.anchorPoint[0];
      const dy = this.lastControlPos[1] - this.anchorPoint[1];
      this.offsetVector = Math.hypot(dx, dy) < 4 ? [0, 0] : [dx, dy];
      this.inControlMode = false;
    }
    this.removeControlLine();

    if (this.toolMode === 'line') {
      const pt = this.lastMousePos || this.lastPoint;
      if (this.distance(this.lastPoint, pt) > 5) {
        this.commitStraightLine(this.lastPoint, pt);
      }
      if (this.currentPreviewLine) {
        this.currentPreviewLine.remove();
        this.currentPreviewLine = null;
      }
      return;
    }

    // Curve completion
    if (this.currentSegmentPath) {
      this.currentSegmentPath.main.remove();
      this.currentSegmentPath.shadow.remove();
    }

    if (this.currentPoints.length < 2) {
      this.currentPoints = [];
      return;
    }

    const error = this.usedControl ? 1 : 8;
    const bezierCurves = (typeof CurveFitter !== 'undefined')
      ? CurveFitter.fit(this.currentPoints, error)
      : [];

    if (!bezierCurves || bezierCurves.length === 0) {
      this.currentPoints = [];
      return;
    }

    const finalPaths = this.appendBezierPathsToSvg(bezierCurves);
    this.curvesGroup.appendChild(finalPaths.shadow);
    this.curvesGroup.appendChild(finalPaths.main);

    this.drawnObjects.push({
      type: 'spline',
      elements: [finalPaths.shadow, finalPaths.main]
    });

    this.currentPoints = [];
    this.currentSegmentPath = null;
  }

  _getEventPoint(e) {
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    return [clientX, clientY];
  }

  _updatePreviewPaths() {
    if (!this.currentSegmentPath) return;
    const d = this.pointsToPath(this.currentPoints);
    this.currentSegmentPath.main.setAttribute('d', d);
    this.currentSegmentPath.shadow.setAttribute('d', this.pointsToPath(this.currentPoints, 2, 2));
  }

  createSvgPath(points) {
    const shadowPath = makeElement('svg:path', {
      fill: 'none',
      stroke: 'rgba(0, 0, 0, 0.65)',
      'stroke-width': String(this.strokeWidth + 3),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: this.pointsToPath(points, 2, 2),
    });

    const cleanCol = this.currentColor.replace('#', 'c_');
    const path = makeElement('svg:path', {
      fill: 'none',
      stroke: this.currentColor,
      'stroke-width': String(this.strokeWidth),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: this.pointsToPath(points),
      ...(this.hasArrow ? { 'marker-end': `url(#qt-arrow-${cleanCol})` } : {})
    });

    this.currentSegmentPath = { main: path, shadow: shadowPath };
    this.curvesGroup.appendChild(shadowPath);
    this.curvesGroup.appendChild(path);
  }

  createSvgLinePreview(p1, p2) {
    if (this.currentPreviewLine) this.currentPreviewLine.remove();
    this.currentPreviewLine = makeElement('svg:line', {
      x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
      stroke: this.currentColor,
      'stroke-width': String(this.strokeWidth),
      'stroke-dasharray': '5,3'
    });
    this.curvesGroup.appendChild(this.currentPreviewLine);
  }

  updateSvgLinePreview(p1, p2) {
    if (!this.currentPreviewLine) return;
    this.currentPreviewLine.setAttribute('x1', p1[0]);
    this.currentPreviewLine.setAttribute('y1', p1[1]);
    this.currentPreviewLine.setAttribute('x2', p2[0]);
    this.currentPreviewLine.setAttribute('y2', p2[1]);
  }

  commitStraightLine(p1, p2) {
    const cleanCol = this.currentColor.replace('#', 'c_');

    const shadow = makeElement('svg:line', {
      x1: p1[0] + 2, y1: p1[1] + 2, x2: p2[0] + 2, y2: p2[1] + 2,
      stroke: 'rgba(0, 0, 0, 0.65)',
      'stroke-width': String(this.strokeWidth + 3),
      'stroke-linecap': 'round'
    });

    const line = makeElement('svg:line', {
      x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
      stroke: this.currentColor,
      'stroke-width': String(this.strokeWidth),
      'stroke-linecap': 'round',
      ...(this.hasArrow ? { 'marker-end': `url(#qt-arrow-${cleanCol})` } : {})
    });

    this.curvesGroup.appendChild(shadow);
    this.curvesGroup.appendChild(line);

    this.drawnObjects.push({
      type: 'line',
      elements: [shadow, line]
    });
  }

  // --- Speech Balloon & Text Callout Implementation ---
  createSpeechBalloon(targetX, targetY) {
    const balloonId = 'qt_balloon_' + Date.now();
    const balloonOffset = [80, -60];
    const bubbleX = targetX + balloonOffset[0];
    const bubbleY = targetY + balloonOffset[1];

    const cleanCol = this.currentColor.replace('#', 'c_');

    // 1. Directional Arrow Tail in SVG Layer
    const tailShadow = makeElement('svg:line', {
      x1: bubbleX + 2, y1: bubbleY + 2, x2: targetX + 2, y2: targetY + 2,
      stroke: 'rgba(0, 0, 0, 0.65)',
      'stroke-width': '4',
      'stroke-linecap': 'round'
    });

    const tailLine = makeElement('svg:line', {
      x1: bubbleX, y1: bubbleY, x2: targetX, y2: targetY,
      stroke: this.currentColor,
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      'marker-end': `url(#qt-arrow-${cleanCol})`
    });

    this.curvesGroup.appendChild(tailShadow);
    this.curvesGroup.appendChild(tailLine);

    // 2. Interactive Floating Card Body
    const bubble = makeElement('div', {
      className: 'qt-balloon-card',
      id: balloonId,
      style: {
        position: 'fixed',
        left: `${bubbleX}px`,
        top: `${bubbleY - 20}px`,
        minWidth: '100px',
        maxWidth: '260px',
        background: 'rgba(15, 23, 42, 0.96)',
        border: `2px solid ${this.currentColor}`,
        borderRadius: '12px',
        padding: '8px 12px',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '12.5px',
        boxShadow: `0 8px 24px rgba(0,0,0,0.7), 0 0 14px ${this.currentColor}44`,
        zIndex: '2147483645',
        cursor: 'move',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }
    });

    const textEditable = makeElement('div', {
      contentEditable: 'true',
      style: {
        outline: 'none',
        minHeight: '18px',
        color: '#ffffff',
        cursor: 'text',
        userSelect: 'text',
        lineHeight: '1.4'
      }
    }, 'Type note...');

    bubble.appendChild(textEditable);
    document.body.appendChild(bubble);

    // Auto focus and select
    setTimeout(() => {
      textEditable.focus();
      const range = document.createRange();
      range.selectNodeContents(textEditable);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }, 50);

    // Make Balloon Draggable with kinetic pointer update
    let isDraggingBalloon = false;
    let dragStart = [0, 0];
    let bubbleStart = [0, 0];

    const onBubbleDown = (e) => {
      if (e.target === textEditable) return;
      isDraggingBalloon = true;
      dragStart = [e.clientX, e.clientY];
      bubbleStart = [parseFloat(bubble.style.left), parseFloat(bubble.style.top)];
      e.stopPropagation();
      e.preventDefault();
    };

    const onBubbleMove = (e) => {
      if (!isDraggingBalloon) return;
      const dx = e.clientX - dragStart[0];
      const dy = e.clientY - dragStart[1];
      const newX = bubbleStart[0] + dx;
      const newY = bubbleStart[1] + dy;

      bubble.style.left = `${newX}px`;
      bubble.style.top = `${newY}px`;

      const curTailX = newX;
      const curTailY = newY + 20;

      tailLine.setAttribute('x1', curTailX);
      tailLine.setAttribute('y1', curTailY);
      tailShadow.setAttribute('x1', curTailX + 2);
      tailShadow.setAttribute('y1', curTailY + 2);
    };

    const onBubbleUp = () => {
      isDraggingBalloon = false;
    };

    bubble.addEventListener('mousedown', onBubbleDown);
    window.addEventListener('mousemove', onBubbleMove);
    window.addEventListener('mouseup', onBubbleUp);

    this.drawnObjects.push({
      type: 'balloon',
      elements: [tailShadow, tailLine, bubble],
      cleanup: () => {
        window.removeEventListener('mousemove', onBubbleMove);
        window.removeEventListener('mouseup', onBubbleUp);
        bubble.remove();
        tailShadow.remove();
        tailLine.remove();
      }
    });
  }

  // --- Kinetic Control Line & String-Drag ---
  createControlLine(x, y) {
    if (this.controlLine) return;
    this.controlLine = makeElement('svg:line', {
      stroke: '#ffffff',
      'stroke-width': '3',
      'stroke-dasharray': '5,4',
      filter: 'drop-shadow(0 0 4px #00e676)'
    });
    this.svg.appendChild(this.controlLine);
    this.updateControlLine(x, y);
  }

  updateControlLine(x, y, isShift = false) {
    if (!this.controlLine) {
      this.createControlLine(x, y);
      return;
    }
    const lastPoint = this.currentPoints[this.currentPoints.length - 1];
    this.controlLine.setAttribute('x1', lastPoint[0]);
    this.controlLine.setAttribute('y1', lastPoint[1]);
    this.controlLine.setAttribute('x2', x);
    this.controlLine.setAttribute('y2', y);
    this.controlLine.setAttribute('stroke', isShift ? '#ff2d55' : '#ffffff');
  }

  removeControlLine() {
    if (this.controlLine) {
      this.controlLine.remove();
      this.controlLine = null;
    }
  }

  computeEffectivePoint(pt) {
    if (this.offsetVector[0] === 0 && this.offsetVector[1] === 0) return pt;
    const last = this.currentPoints[this.currentPoints.length - 1];
    const R = Math.hypot(this.offsetVector[0], this.offsetVector[1]);
    const d = this.distance(last, pt);
    if (d < R) return [...last];
    const dx = last[0] - pt[0];
    const dy = last[1] - pt[1];
    const mag = Math.hypot(dx, dy);
    if (mag === 0) return [...last];
    const ux = dx / mag;
    const uy = dy / mag;
    return [pt[0] + ux * R, pt[1] + uy * R];
  }

  backtrackIfCloser(mousePt) {
    if (this.currentPoints.length < 2) return;
    const R = Math.hypot(this.offsetVector[0], this.offsetVector[1]);
    const last = this.currentPoints[this.currentPoints.length - 1];
    let currentError = Math.abs(this.distance(last, mousePt) - R);
    if (this.distance(last, mousePt) >= R) return;

    while (this.currentPoints.length > 1) {
      const prev = this.currentPoints[this.currentPoints.length - 2];
      const errorPrev = Math.abs(this.distance(prev, mousePt) - R);
      if (errorPrev < currentError) {
        this.currentPoints.pop();
        currentError = errorPrev;
      } else break;
    }
  }

  pointsToPath(points, offsetX = 0, offsetY = 0) {
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0] + offsetX} ${p[1] + offsetY}`)
      .join(' ');
  }

  createPathString(cubicBezierData) {
    let d = 'M ' + cubicBezierData[0][0].join(' ');
    for (let i = 0; i < cubicBezierData.length; i++) {
      const [start, cp1, cp2, end] = cubicBezierData[i];
      d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
    }
    return d;
  }

  appendBezierPathsToSvg(bezierData) {
    const d = this.createPathString(bezierData);
    const cleanCol = this.currentColor.replace('#', 'c_');

    const shadowPath = makeElement('svg:path', {
      stroke: 'rgba(0, 0, 0, 0.65)',
      'stroke-width': String(this.strokeWidth + 3),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
      d: d,
      transform: 'translate(2, 2)'
    });

    const coloredPath = makeElement('svg:path', {
      stroke: this.currentColor,
      'stroke-width': String(this.strokeWidth),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
      d: d,
      ...(this.hasArrow ? { 'marker-end': `url(#qt-arrow-${cleanCol})` } : {})
    });

    return { shadow: shadowPath, main: coloredPath };
  }

  copySnapshot(btn) {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const svgXml = new XMLSerializer().serializeToString(this.svg);
    const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Also render text balloons onto canvas
      document.querySelectorAll('.qt-balloon-card').forEach(card => {
        const r = card.getBoundingClientRect();
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = card.style.borderColor || '#00e676';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(r.left, r.top, r.width, r.height, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px system-ui, sans-serif';
        const txt = card.innerText || '';
        ctx.fillText(txt, r.left + 10, r.top + 20);
        ctx.restore();
      });

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]).then(() => {
          if (btn) {
            const orig = btn.textContent;
            btn.textContent = '✓ Copied PNG!';
            setTimeout(() => { btn.textContent = orig; }, 1800);
          }
        });
      });
    };
    img.src = url;
  }

  undoLast() {
    if (this.drawnObjects.length === 0) return false;
    const last = this.drawnObjects.pop();
    if (last.cleanup) {
      last.cleanup();
    } else if (last.elements) {
      last.elements.forEach(el => el.remove());
    }
    return true;
  }

  clear() {
    while (this.undoLast()) {}
  }

  quit() {
    window.removeEventListener('keydown', this.boundKeyDown, true);
    window.removeEventListener('keyup', this.boundKeyUp, true);
    if (this.svg) this.svg.remove();
    if (this.hudElement) this.hudElement.remove();
    this.clear();
    if (window.drawingToolInstance === this) {
      window.drawingToolInstance = null;
    }
  }
}

globalThis.DrawingTool = DrawingTool;
if (typeof module !== 'undefined' && module.exports) module.exports = DrawingTool;