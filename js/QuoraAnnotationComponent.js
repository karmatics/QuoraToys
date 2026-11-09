class QuoraAnnotationComponent {
  static activeInstance = null;

  static render(container) {
    container.innerHTML = '';
    const comp = new QuoraAnnotationComponent();
    QuoraAnnotationComponent.activeInstance = comp;
    comp.build(container);
  }

  static loadExternalDataset(data) {
    if (QuoraAnnotationComponent.activeInstance) {
      QuoraAnnotationComponent.activeInstance.importDataset(data);
    }
  }

  static launchStandalone(initialImage = null) {
    const existing = document.getElementById('quora-annotation-standalone-mount');
    if (existing) existing.remove();

    const leftSafe = (typeof SidePanel !== 'undefined' && SidePanel.getInstances()?.left?.isOpen)
      ? (SidePanel.getInstances().left.width || 300)
      : 0;

    const host = document.createElement('div');
    host.id = 'quora-annotation-standalone-mount';
    host.style.cssText = [
      'position: fixed;', 'top: 0;', `left: ${leftSafe}px;`,
      `width: calc(100vw - ${leftSafe}px);`, 'height: 100vh;', 'z-index: 200000;',
      'background: #0b0f19;', 'overflow: hidden;', 'display: flex;', 'flex-direction: column;',
      'transition: left 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1);'
    ].join('\n');
    document.body.appendChild(host);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Return to Living Dossier';
    closeBtn.className = 'dr-nav-btn';
    closeBtn.style.cssText = [
      'position: fixed;', 'top: 10px;', 'right: 16px;', 'z-index: 2147483647;',
      'background: #1e293b;', 'color: #f8fafc;', 'border: 1.5px solid #00f2fe;',
      'padding: 6px 14px;', 'font-family: monospace;', 'font-size: 11px;',
      'font-weight: bold;', 'border-radius: 6px;', 'cursor: pointer;',
      'box-shadow: 0 4px 14px rgba(0,0,0,0.6);'
    ].join('\n');

    closeBtn.onclick = () => {
      if (host._safeAreaListener) {
        window.removeEventListener('layout-safe-area-change', host._safeAreaListener);
      }
      host.remove();
      closeBtn.remove();
    };
    document.body.appendChild(closeBtn);

    host._safeAreaListener = (e) => {
      const l = e.detail?.left || 0;
      host.style.left = `${l}px`;
      host.style.width = `calc(100vw - ${l}px)`;
    };
    window.addEventListener('layout-safe-area-change', host._safeAreaListener);

    QuoraAnnotationComponent.render(host);

    if (initialImage && QuoraAnnotationComponent.activeInstance) {
      setTimeout(() => {
        const inst = QuoraAnnotationComponent.activeInstance;
        inst.addNewImagePlate(initialImage, 50, 50);
      }, 50);
    }
  }

  constructor() {
    this.stageState = {
      baseImage: null,
      cropRect: null,
      baseOrigin: { x: 0, y: 0 },
      diffCallouts: [],
      annotations: [],
      placedImages: [],
      activeImage: null,
      panX: 0,
      panY: 0,
      zoom: 1.0,
      minZoom: 0.15,
      maxZoom: 6.0,
      manualSizing: false,
      canvasWidth: Math.max(1100, window.innerWidth - 380),
      canvasHeight: Math.max(640, window.innerHeight - 180),
      padding: 45,
      canvasBgMode: 'matte',
      canvasBgColor: '#090d16',
      activeTool: 'curve',
      hasArrow: true,
      curveStrokeWidth: 3.2,
      currentColor: '#00e676',
      hasBorder: true,
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      fontSize: 22,
      brushMode: 'freehand',
      brushColor: '#000000',
      brushSize: 32,
      brushSoftness: 0,
      tetherActive: true,
      tetherLength: 32,
      eraseRadius: 26,
      selectedItem: null,
      dragLockMode: 'single'
    };

    this._activeKnotIdx = 0;
    this._selectedKnotIndices = new Set();
    this._clutchActive = false;
    this._handRestActive = false;
    this._metaHelpActive = false;
    this._hoveredCurve = null;
    this._isDrawingActive = false;
    this._penNodes = null;
    this._loadedFonts = new Set();

    // Initialize specialized modular delegates
    this.imageManager = new QuoraImageManager(this);
    this.textManager = new QuoraTextManager(this);
    this.knotManager = new QuoraKnotManager(this);
    this.inSituHud = new QuoraInSituHUD(this);
    this.strokeManager = new QuoraStrokeManager(this);
    this.paintManager = new QuoraPaintManager(this);
    this.exportManager = new QuoraExportManager(this);
    this.gestureMachine = new QuoraGestureMachine(this);
  }

  build(container) {
      this.ensureFontLoaded(this.stageState.fontFamily);

      const wrap = makeElement('div', {
        style: {
          background: '#070a13', border: '1.5px solid #21262d', borderRadius: '12px',
          overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.65)', display: 'flex',
          flexDirection: 'column', fontFamily: 'monospace'
        }
      });

      const localFileInput = makeElement('input', {
        type: 'file', accept: 'image/*', style: { display: 'none' },
        onchange: (e) => {
          if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => this.addNewImagePlate(img, 60, 60);
              img.src = ev.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
          }
        }
      });
      wrap.appendChild(localFileInput);

      // Primary Header
      const header = makeElement('div', {
        style: {
          padding: '10px 16px', background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid #21262d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
        }
      }, [
        makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          makeElement('span', { style: { fontSize: '16px' } }, '🎨'),
          makeElement('strong', { style: { fontSize: '13px', color: '#00f2fe' } }, 'Universal Graphic Studio'),
          makeElement('span', { id: 'qa-status-pill', style: { fontSize: '10px', background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' } }, 'Draw curve & type • Pull wire to bend • Shift for straight line')
        ]),
        makeElement('div', { style: { display: 'flex', gap: '6px' } }, [
          makeElement('button', {
            className: 'dr-nav-btn primary',
            style: { padding: '4px 10px', fontSize: '11px', background: '#0284c7', borderColor: '#38bdf8' },
            onclick: () => this.openSpotDiffWorkflow()
          }, '🧩 Spot Difference'),
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '4px 9px', fontSize: '11px', color: '#00f2fe', borderColor: '#00f2fe66' },
            title: 'Add image from clipboard or local files',
            onclick: () => this.imageManager.promptAddImageWorkflow(this.stageState, localFileInput)
          }, '📁 Add Image'),
          makeElement('button', {
            className: 'dr-nav-btn primary',
            style: { padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', background: '#238636', borderColor: '#2ea043' },
            onclick: (e) => this.copyCompositeToClipboard(e.currentTarget)
          }, '📋 Copy Hi-Res PNG')
        ])
      ]);
      wrap.appendChild(header);

      // Unified Ribbon: Clean visual groupings separated by subtle dividers
      const ribbon = makeElement('div', {
        style: {
          padding: '8px 14px', background: 'rgba(11, 17, 32, 0.98)', borderBottom: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', color: '#cbd5e1'
        }
      });

      this.toolBtns = {};
      const setTool = (mode) => {
        this.stageState.activeTool = mode;
        this.toolBtns.curve?.classList.toggle('primary', mode === 'curve');
        this.toolBtns.paint?.classList.toggle('primary', mode === 'paint');
        this.brushControlsRibbon.style.display = (mode === 'paint') ? 'flex' : 'none';
        this.updateDynamicKeyInHUD();
        this.showKnotToast(mode === 'curve' ? '🪢 Curve Tool Active' : '🖌️ Blockout Paint Active');
      };

      // --- Group 1: Tools ---
      this.toolBtns.curve = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '4px 11px', fontSize: '11.5px', fontWeight: 'bold' },
        title: 'Unified Curve Studio: Drag to pull arrows, splines, or loops; click to place precision knots',
        onclick: () => setTool('curve')
      }, '🪢 Curve');

      this.toolBtns.paint = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: '#f59e0b', borderColor: '#f59e0b66' },
        title: 'Blockout Paint & Image Alpha Eraser Brush',
        onclick: () => setTool('paint')
      }, '🖌️ Paint');

      // --- Group 2: Curve Modifiers ---
      this.arrowBtn = makeElement('button', {
        className: `dr-nav-btn ${this.stageState.hasArrow ? 'primary' : ''}`,
        style: { padding: '4px 8px', fontSize: '11px', color: this.stageState.hasArrow ? '#ffffff' : '#94a3b8' },
        title: 'Toggle Arrowhead [Hotkey: A] — Cycles: Tip ➔ Tail ➔ Both ➔ Off',
        onclick: () => this.toggleArrowhead()
      }, '🏹 Arrow: TIP');

      const addTextBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px' },
        title: 'Attach or Edit Text Callout [Hotkey: T or start typing]',
        onclick: () => this.triggerTextOnActiveOrCanvas()
      }, '💬 Text');

      this.loopBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: '#00f2fe' },
        title: 'Toggle Loop Mode [Hotkey: L] — Closes curve into a continuous highlight loop',
        onclick: () => this.toggleLoopMode()
      }, '🔄 Loop: OPEN');

      const straightenBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '10.5px', color: '#38bdf8' },
        title: 'Straighten Curve: Collapse intermediate knots to make a straight arrow/line [Hotkey: S]',
        onclick: () => this.executeKeyInCommand('straighten')
      }, '📏 Line (S)');

      const swapEndsBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '10.5px', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.4)' },
        title: 'Swap Terminals: Reverse arrowhead and text placement [Hotkey: X]',
        onclick: () => this.swapActiveCurveTerminals()
      }, '⇄ Flip (X)');

      // --- Group 3: Appearance & Stroke ---
      this.widthBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '10.5px', color: '#f8fafc', borderColor: '#334155' },
        title: 'Stroke Width [Hotkey: [ / ] when no knot selected] — Click to cycle presets',
        onclick: () => this.cycleStrokeWidth()
      }, `Width: ${this.stageState.curveStrokeWidth || 3.2}px`);

      this.lineStyleBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '10.5px', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.45)' },
        title: 'Toggle Line Style: Classic Keyline Shadow ➔ Lightsaber Beam ➔ Neon Glow',
        onclick: () => this.toggleLineStyle()
      }, '🖋️ Classic');

      // Palette Swatches (Keys 1-6)
      const swatchBar = makeElement('div', {
        id: 'qa-ribbon-swatch-bar',
        style: { display: 'flex', alignItems: 'center', gap: '5px', margin: '0 2px' }
      });

      const palette = [
        { hex: '#00f2fe', key: '1', title: 'Cyber Cyan (1)' },
        { hex: '#00e676', key: '2', title: 'Matrix Green (2)' },
        { hex: '#ffd700', key: '3', title: 'Electric Gold (3)' },
        { hex: '#ff2d55', key: '4', title: 'Coral Red (4)' },
        { hex: '#c084fc', key: '5', title: 'Neon Purple (5)' },
        { hex: '#ffffff', key: '6', title: 'Pure White (6)' }
      ];

      this._swatchElements = [];
      palette.forEach(item => {
        const isCur = (this.stageState.currentColor === item.hex);
        const dot = makeElement('span', {
          className: `qa-swatch-dot ${isCur ? 'active' : ''}`,
          'data-hex': item.hex,
          style: {
            background: item.hex,
            border: isCur ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.4)',
            color: item.hex
          },
          title: item.title,
          onclick: (e) => {
            e.stopPropagation();
            this.stageState.currentColor = item.hex;
            this.updatePaletteHighlight();
            const curve = this.getActiveCurve();
            if (curve) { curve.color = item.hex; this.commitCurveGeometryUpdate(); }
            this.renderStage();
            this.showKnotToast(`Color: ${item.hex}`);
          }
        });
        this._swatchElements.push(dot);
        swatchBar.appendChild(dot);
      });

      this.colorPickerBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', borderColor: '#00e676' },
        title: 'Custom Color Wheel',
        onclick: (e) => this.launchColorPicker('curve', e.currentTarget)
      }, [
        (this.colorIndicatorDot = makeElement('span', {
          style: { width: '11px', height: '11px', borderRadius: '50%', background: this.stageState.currentColor, display: 'inline-block', border: '1px solid #fff' }
        })),
        makeElement('span', {}, 'Color')
      ]);

      // --- Group 4: HUD & Undo ---
      const hudToggleBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: '#00f2fe', borderColor: 'rgba(0, 242, 254, 0.4)' },
        onclick: () => {
          const h = document.getElementById('qa-keyin-matrix-hud');
          if (h) h.style.display = (h.style.display === 'none') ? 'flex' : 'none';
          else this.setupKeyInMatrixHud();
        }
      }, '⌨️ HUD');

      const undoBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: '#f59e0b', marginLeft: 'auto' },
        onclick: () => this.undoLastAnnotation()
      }, '↺ Undo');

      const makeDiv = () => makeElement('div', { className: 'qa-ribbon-divider' });

      ribbon.append(
        this.toolBtns.curve, this.toolBtns.paint,
        makeDiv(),
        this.arrowBtn, addTextBtn, this.loopBtn, straightenBtn, swapEndsBtn,
        makeDiv(),
        this.widthBtn, this.lineStyleBtn, swatchBar, this.colorPickerBtn,
        makeDiv(),
        hudToggleBtn, undoBtn
      );
      wrap.appendChild(ribbon);

      // Brush Controls Ribbon
      this.brushControlsRibbon = makeElement('div', {
        style: {
          padding: '6px 14px', background: 'rgba(24, 15, 30, 0.94)', borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'none', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#f8fafc', flexWrap: 'wrap'
        }
      });

      const brushModeSelect = makeElement('select', {
        style: {
          background: '#0d1117', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '4px', padding: '2px 6px', fontSize: '10.5px', fontFamily: 'monospace', outline: 'none'
        },
        onchange: (e) => {
          this.stageState.brushMode = e.target.value;
        }
      }, [
        makeElement('option', { value: 'freehand' }, '🖌️ Freehand Mask'),
        makeElement('option', { value: 'erase' }, '🧹 Erase Image Alpha (Background)'),
        makeElement('option', { value: 'rect' }, '◻ Rect Mask'),
        makeElement('option', { value: 'oval' }, '⭕ Oval Mask')
      ]);

      const brushSizeLabel = makeElement('span', {}, `Size: ${this.stageState.brushSize}px`);
      const brushSizeSlider = makeElement('input', {
        type: 'range', min: '8', max: '140', value: String(this.stageState.brushSize),
        style: { width: '80px', accentColor: '#f59e0b', cursor: 'pointer' },
        oninput: (e) => {
          this.stageState.brushSize = parseInt(e.target.value, 10);
          brushSizeLabel.textContent = `Size: ${this.stageState.brushSize}px`;
        }
      });

      const softnessLabel = makeElement('span', {}, `Feather: ${this.stageState.brushSoftness}px`);
      const softnessSlider = makeElement('input', {
        type: 'range', min: '0', max: '25', value: String(this.stageState.brushSoftness),
        style: { width: '80px', accentColor: '#00f2fe', cursor: 'pointer' },
        oninput: (e) => {
          this.stageState.brushSoftness = parseInt(e.target.value, 10);
          softnessLabel.textContent = `Feather: ${this.stageState.brushSoftness}px`;
          this.updateSvgBlurFilter();
        }
      });

      this.brushControlsRibbon.append(
        makeElement('strong', { style: { color: '#f59e0b' } }, 'Tool:'),
        brushModeSelect,
        brushSizeSlider, brushSizeLabel,
        softnessSlider, softnessLabel
      );
      wrap.appendChild(this.brushControlsRibbon);

      // Viewport & Stage
      this.viewport = makeElement('div', {
        style: {
          position: 'relative', minHeight: '520px', maxHeight: '720px', overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 25%, #151e33 0%, #0b0f19 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', boxSizing: 'border-box'
        }
      });

      this.zoomScaffold = makeElement('div', {
        style: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }
      });

      this.stageBox = makeElement('div', {
        id: 'quora-composite-stage',
        style: {
          position: 'relative', boxShadow: '0 16px 45px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          borderRadius: '6px', background: 'transparent', overflow: 'visible', display: 'inline-block'
        }
      });

      this.sceneCanvas = document.createElement('canvas');
      this.sceneCanvas.style.cssText = 'position: absolute; top: 0; left: 0; display: block; border-radius: 6px;';
      this.stageBox.appendChild(this.sceneCanvas);

      this.svgSurface = makeElement('svg:svg', {
        id: 'quora-vector-svg',
        style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'auto' }
      });

      this.svgDefs = makeElement('svg:defs');
      this.svgSurface.appendChild(this.svgDefs);
      this.updateSvgBlurFilter();

      this.diffSvgLayer = makeElement('svg:g', { className: 'qa-diff-tangents', style: { pointerEvents: 'none' } });
      this.paintLayer = makeElement('svg:g', { className: 'qa-blockout-paint-layer', style: { pointerEvents: 'none' } });
      this.glowLayer = makeElement('svg:g', { className: 'qa-glow-hover-layer', style: { pointerEvents: 'none' } });
      this.shadowLayer = makeElement('svg:g', { className: 'qa-crisp-shadows', style: { pointerEvents: 'none' } });
      this.strokeLayer = makeElement('svg:g', { className: 'qa-crisp-strokes', style: { pointerEvents: 'none' } });
      this.textBadgesLayer = makeElement('svg:g', { className: 'qa-curve-attached-text' });
      this.controlsLayer = makeElement('svg:g', { className: 'qa-interactive-controls' });

      this.svgSurface.append(
        this.diffSvgLayer, this.paintLayer, this.glowLayer, this.shadowLayer,
        this.strokeLayer, this.textBadgesLayer, this.controlsLayer
      );
      this.stageBox.appendChild(this.svgSurface);

      this.setupEdgePullHandles();

      this.zoomScaffold.appendChild(this.stageBox);
      this.viewport.appendChild(this.zoomScaffold);
      wrap.appendChild(this.viewport);

      this.setupInteractions();
      this.setupZoomWheel();
      this.setupPasteAndDropListener();
      this.loadDefaultDemo();

      container.appendChild(wrap);
    }
  updateSvgBlurFilter() {
    this.paintManager.updateSvgBlurFilter(this.svgDefs, this.stageState.brushSoftness);
  }
  openSpotDiffWorkflow() {
    const overlayHost = document.createElement('div');
    overlayHost.id = 'qa-diff-workflow-modal';

    const leftSafe = (typeof SidePanel !== 'undefined' && SidePanel.getInstances()?.left?.isOpen)
      ? (SidePanel.getInstances().left.width || 300)
      : 0;

    overlayHost.style.cssText = [
      'position: fixed;', 'top: 0;', `left: ${leftSafe}px;`,
      `width: calc(100vw - ${leftSafe}px);`, 'height: 100vh;', 'z-index: 200000;',
      'background: rgba(11, 15, 25, 0.98);', 'overflow: hidden;', 'display: flex;',
      'flex-direction: column;', 'box-shadow: 0 0 35px rgba(0,0,0,0.8);',
      'backdrop-filter: blur(12px);', 'transition: left 0.25s ease, width 0.25s ease;'
    ].join('\n');
    document.body.appendChild(overlayHost);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Return to Studio';
    closeBtn.className = 'dr-nav-btn';
    closeBtn.style.cssText = [
      'position: fixed;', 'top: 12px;', 'right: 18px;', 'z-index: 2147483647;',
      'background: #1e293b;', 'color: #f8fafc;', 'border: 1.5px solid #00e676;',
      'padding: 6px 14px;', 'font-family: monospace;', 'font-size: 11px;',
      'font-weight: bold;', 'border-radius: 6px;', 'cursor: pointer;',
      'box-shadow: 0 4px 14px rgba(0,0,0,0.6);'
    ].join('\n');

    closeBtn.onclick = () => {
      overlayHost.remove();
      closeBtn.remove();
    };
    document.body.appendChild(closeBtn);

    const app = new QuoraToys();
    app.run({ container: overlayHost });

    if (this.stageState.baseImage) {
      setTimeout(() => {
        app.loadImageFromUrl(this.stageState.baseImage.src, 'Studio Active Image');
      }, 80);
    }
  }

  addNewImagePlate(img, x = 60, y = 60) {
      if (!this.imageManager) this.imageManager = new QuoraImageManager(this);
      return this.imageManager.addPlate(this.stageState, img, x, y);
  }

  computeAutoBounds() {
      if (!this.imageManager) this.imageManager = new QuoraImageManager(this);
      return this.imageManager.computeBounds(this.stageState);
  }
  // ── Multi-Point Curve: Dynamic Relaxation of Prior Chain & Dashed Lead ──
  updatePenTentativeSpline(mousePt) {
    if (!this._penNodes || this._penNodes.length === 0) return;

    const committedVerts = this._penNodes.map(pt => new BezierVertex(pt.slice()));
    const tentativeVert = new BezierVertex(mousePt.slice());
    tentativeVert.isTentative = true;
    const allVerts = [...committedVerts, tentativeVert];

    if (typeof UpdateControlPoints !== 'undefined') {
      UpdateControlPoints.run(allVerts, 6);
    }

    const beziers = this.verticesToBeziers(allVerts);
    if (!beziers || beziers.length === 0) return;

    const k = committedVerts.length - 1;
    let dSolid = '';
    if (k > 0) {
      dSolid = 'M ' + beziers[0][0].join(' ');
      for (let i = 0; i < k; i++) {
        const [start, cp1, cp2, end] = beziers[i];
        dSolid += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
      }
    }

    const lastSeg = beziers[k];
    const dDashed = `M ${lastSeg[0].join(' ')} C ${lastSeg[1].join(' ')}, ${lastSeg[2].join(' ')}, ${lastSeg[3].join(' ')}`;

    if (!this.svgSurface._penSolidPreview) {
      this.svgSurface._penSolidPreview = makeElement('svg:path', {
        stroke: this.stageState.currentColor,
        'stroke-width': String(this.stageState.curveStrokeWidth || 3.2),
        fill: 'none', style: { pointerEvents: 'none' }
      });
      this.strokeLayer.appendChild(this.svgSurface._penSolidPreview);
    }
    this.svgSurface._penSolidPreview.setAttribute('d', dSolid);

    if (!this.svgSurface._penDashedPreview) {
      this.svgSurface._penDashedPreview = makeElement('svg:path', {
        stroke: this.stageState.currentColor,
        'stroke-width': String(this.stageState.curveStrokeWidth || 3.2),
        'stroke-dasharray': '5,4',
        fill: 'none', style: { pointerEvents: 'none' }
      });
      this.strokeLayer.appendChild(this.svgSurface._penDashedPreview);
    }
    this.svgSurface._penDashedPreview.setAttribute('d', dDashed);
  }

  commitPenNodes() {
    if (!this._penNodes || this._penNodes.length < 2) {
      this.cancelPenNodes();
      return;
    }

    const committedPoints = [...this._penNodes];
    this.cancelPenNodes();

    const vertices = committedPoints.map(pt => new BezierVertex(pt.slice()));
    if (typeof UpdateControlPoints !== 'undefined') {
      UpdateControlPoints.run(vertices, 8);
    }
    const beziers = this.verticesToBeziers(vertices);

    if (beziers && beziers.length > 0) {
      this.commitSpline(beziers, this.stageState.currentColor, this.stageState.hasArrow);
      const lastAnn = this.stageState.annotations[this.stageState.annotations.length - 1];
      if (lastAnn && lastAnn.type === 'curve') {
        lastAnn.vertices = vertices;
      }
    }
  }

  cancelPenNodes() {
    this._penNodes = null;
    this.controlsLayer.querySelectorAll('.qa-pen-active-anchor').forEach(el => el.remove());
    if (this.svgSurface._penSolidPreview) {
      this.svgSurface._penSolidPreview.remove();
      this.svgSurface._penSolidPreview = null;
    }
    if (this.svgSurface._penDashedPreview) {
      this.svgSurface._penDashedPreview.remove();
      this.svgSurface._penDashedPreview = null;
    }
  }

  addKnotToActiveCurve() {
    const curve = this.getActiveCurve();
    if (curve) this.strokeManager.addKnotOnCurve(curve, this._activeKnotIdx);
  }

  toggleArrowhead() {
      const curve = this.getActiveCurve();
      const cycle = ['none', 'tip', 'tail', 'both'];

      let current = 'none';
      if (curve && !curve.isClosed) {
        current = curve.arrowEnd || 'none';
      } else {
        current = this.stageState.hasArrow ? 'tip' : 'none';
      }

      const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;
      const nextStyle = cycle[nextIdx];

      this.stageState.hasArrow = (nextStyle !== 'none');

      if (curve && !curve.isClosed) {
        curve.arrowEnd = nextStyle;
        this.commitCurveGeometryUpdate();
      }

      if (this.arrowBtn) {
        this.arrowBtn.classList.toggle('primary', this.stageState.hasArrow);
        const labels = {
          'none': '🏹 Arrow: OFF',
          'tip': '🏹 Arrow: TIP',
          'tail': '🏹 Arrow: TAIL',
          'both': '🏹 Arrow: BOTH'
        };
        this.arrowBtn.textContent = labels[nextStyle] || '🏹 Arrow: ON';
      }

      this.showKnotToast(`Arrowhead: ${nextStyle.toUpperCase()}`);
    }

  triggerTextOnActiveOrCanvas(initialChar = '') {
      const curve = this.getActiveCurve();
      if (curve && curve.beziers?.length > 0) {
        const isTail = (curve.textEnd !== 'tip');
        const termSeg = isTail ? curve.beziers[curve.beziers.length - 1] : curve.beziers[0];
        const anchorPt = isTail ? termSeg[3] : termSeg[0];
        this._promptInlineTailText(curve, anchorPt, null, initialChar);
      } else {
        const tf = this.computeAutoBounds();
        this._promptInlineTailText(null, [tf.totalW / 2 - 40, tf.totalH / 2 - 20], 'left', initialChar);
      }
    }
  // ── Synchronous Color Picker Launch ──
  launchColorPicker(targetMode = 'curve', triggerBtn = null) {
    const curColor = this.stageState.currentColor;
    if (typeof ColorPicker === 'undefined') return;

    if (!this._colorPickerInstance) {
      this._colorPickerInstance = new ColorPicker();
    }

    const onColorChosen = (newCol) => {
      this.stageState.currentColor = newCol;
      if (this.colorIndicatorDot) this.colorIndicatorDot.style.background = newCol;

      const curCurve = this.getActiveCurve();
      if (curCurve) {
        curCurve.color = newCol;
      }
      this.renderStage();
    };

    const targetEl = triggerBtn || this.colorPickerBtn;
    this._colorPickerInstance.openSmartPicker(targetEl, curColor, onColorChosen);

    // Initial color sync: safely parses and initializes HueRing and Triangle
    setTimeout(() => {
      if (ColorPicker.activeInstance) {
        if (ColorPicker.activeInstance.currentTriangle) {
          ColorPicker.activeInstance.currentTriangle.setColor(curColor);
        }
        if (ColorPicker.activeInstance.currentHueRing) {
          const parseColor = (c) => {
            if (typeof AppColorUtils !== 'undefined' && AppColorUtils.rgbStringToRgbArray) {
              const arr = AppColorUtils.rgbStringToRgbArray(c);
              if (arr) return arr;
            }
            if (c && c.startsWith('#')) {
              let hex = c.slice(1);
              if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
              return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
            }
            return [0, 230, 118];
          };

          const rgb = parseColor(curColor);
          const hsv = AppColorUtils.rgbToHsv(rgb[0], rgb[1], rgb[2]);
          const ryb = ColorPicker.activeInstance._rgbToRyb(hsv.h);
          ColorPicker.activeInstance.currentHueRing.setHue(ryb);
          ColorPicker.activeInstance.currentHueRing.setThumbColor(curColor);
          ColorPicker.activeInstance.currentHueRing.externalColorOverride = true;
        }
      }
    }, 40);
  }

  async pasteFromClipboardAction() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => this.addNewImagePlate(img, 70, 70);
              img.src = ev.target.result;
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      this.showKnotToast('Clipboard has no image. Try Ctrl+V or drop a file.');
    } catch (e) {
      this.showKnotToast('Press Ctrl+V to paste image directly');
    }
  }

  // ── Physically Colinear Outbound Tangent Vector ──
  computeCurveExitVector(curveRecord, knotIdx) {
    if (!curveRecord || !curveRecord.beziers || curveRecord.beziers.length === 0) return [1, 0];
    const beziers = curveRecord.beziers;
    const n = beziers.length;

    if (knotIdx === 0) {
      const p0 = beziers[0][0];
      const p1 = beziers[0][1];
      const dx = p0[0] - p1[0];
      const dy = p0[1] - p1[1];
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    }

    if (knotIdx >= n) {
      const lastSeg = beziers[n - 1];
      const p2 = lastSeg[2];
      const p3 = lastSeg[3];
      const dx = p3[0] - p2[0];
      const dy = p3[1] - p2[1];
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    }

    const segBefore = beziers[knotIdx - 1];
    const segAfter = beziers[knotIdx];
    const p2Before = segBefore[2];
    const p1After = segAfter[1];
    const dx = p1After[0] - p2Before[0];
    const dy = p1After[1] - p2Before[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  }

  renderOutboundTangentRay(curveRecord, knotIdx, updateGeometryFn) {
      if (!this.knotManager) this.knotManager = new QuoraKnotManager(this);
      this.knotManager.renderOutboundTangentRay(curveRecord, knotIdx, this.controlsLayer, this.stageState);
  }
  renderSegmentMidpointIndicators(curveRecord) {
      if (!this.knotManager) this.knotManager = new QuoraKnotManager(this);
      this.knotManager.renderSegmentMidpointIndicators(curveRecord, this.controlsLayer, this.stageState);
  }

  swapActiveCurveTerminals() {
    const curve = this.getActiveCurve();
    if (curve) this.strokeManager.swapCurveTerminals(curve);
  }
  // ── Direct Typography Tool ──
  promptDirectTextBadge(x, y) {
    this._promptInlineTailText(null, [x, y], 'left');
  }

  _promptInlineTailText(curveRecord, anchorPt, forcedEdge = null) {
      if (!this.textManager) this.textManager = new QuoraTextManager(this);
      return this.textManager.promptInlineTailText(curveRecord, anchorPt, forcedEdge);
  }

  previewBlockoutRect(p1, p2) {
    this.paintManager.previewRect(this.paintLayer, p1, p2, this.stageState.brushColor, this.stageState.brushSoftness);
  }

  commitBlockoutRect(p1, p2) {
    this.paintManager.commitRect(this.paintLayer, this.stageState, p1, p2, this.stageState.brushColor, this.stageState.brushSoftness);
  }

  previewBlockoutOval(p1, p2) {
    this.paintManager.previewOval(this.paintLayer, p1, p2, this.stageState.brushColor, this.stageState.brushSoftness);
  }

  commitBlockoutOval(p1, p2) {
    this.paintManager.commitOval(this.paintLayer, this.stageState, p1, p2, this.stageState.brushColor, this.stageState.brushSoftness);
  }
  // ── Spatial Proximity & Unobscured Knot Handles ──
  findNearestCurveAtPoint(mousePt, maxDist = 28) {
    let nearest = null;
    let minDist = maxDist;

    this.stageState.annotations.forEach(ann => {
      if (ann.type === 'curve' && ann.beziers) {
        ann.beziers.forEach((seg, segIdx) => {
          for (let t = 0; t <= 1.0; t += 0.05) {
            const q = CurveFitter.bezier_q(seg, t);
            const d = Math.hypot(q[0] - mousePt[0], q[1] - mousePt[1]);
            if (d < minDist) {
              minDist = d;
              nearest = { ann, segIdx, t, pt: q, dist: d };
            }
          }
        });
      }
    });
    return nearest;
  }

  updateSpatialHover(mousePt) {
    // Completely inhibit spatial hover and glow when any drag or drawing action is active
    if (this.isInteracting() || (this._penNodes && this._penNodes.length > 0)) {
      this.clearHoverHighlight();
      return;
    }

    const hit = this.findNearestCurveAtPoint(mousePt, this._hoveredCurve ? 36 : 24);

    if (hit) {
      if (this._hoveredCurve !== hit.ann) {
        this.clearHoverHighlight();
        this._hoveredCurve = hit.ann;
        this.applyCurveGlow(hit.ann);

        // Only display hover control points if this curve is not already in full active edit mode
        if (this.stageState.selectedItem !== hit.ann) {
          this.renderEphemeralKnotHandles(hit.ann);
        }
      }
    } else {
      this.clearHoverHighlight();
    }
  }
  applyCurveGlow(ann) {
      if (!ann || !ann.elements?.[1]) return;
      const d = ann.elements[1].getAttribute('d');
      if (!d) return;

      let glow = document.getElementById('qa-active-hover-glow');
      if (!glow) {
        glow = makeElement('svg:path', {
          id: 'qa-active-hover-glow', fill: 'none', stroke: 'rgba(0, 242, 254, 0.18)',
          'stroke-width': '14', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 8px rgba(0, 242, 254, 0.35))' }
        });
        this.glowLayer.appendChild(glow);
      }
      glow.setAttribute('d', d);
  }

  clearHoverHighlight() {
    this.gestureMachine.clearHoverHighlight();
  }
  deleteSelectedEntity() {
      // 1. Delete Selected Image Plate if active
      if (this.stageState.activeImage) {
        const idx = this.stageState.placedImages.indexOf(this.stageState.activeImage);
        if (idx !== -1) {
          this.stageState.placedImages.splice(idx, 1);
          this.stageState.activeImage = null;
          this.renderStage();
          this.showKnotToast('🗑️ Deleted image plate');
          return;
        }
      }

      // 2. Delegate to KnotManager to delete the knot closest to the cursor
      const curve = this.getActiveCurve();
      if (curve && this._lastStageMousePt && this.knotManager) {
        this.knotManager.deleteClosestKnot(curve, this._lastStageMousePt);
        return;
      }

      // 3. Fallback: Delete entire curve entity
      if (curve) {
        const cIdx = this.stageState.annotations.indexOf(curve);
        if (cIdx !== -1) {
          this.stageState.annotations.splice(cIdx, 1);
        }
        if (curve.elements) {
          curve.elements.forEach(el => el.remove());
        }
        if (curve._arrowFg) curve._arrowFg.remove();
        if (curve._arrowSh) curve._arrowSh.remove();
        this.controlsLayer.innerHTML = '';
        this.stageState.selectedItem = null;
        this._activeKnotIdx = null;
        this.renderStage();
        this.showKnotToast('🗑️ Deleted curve');
        this.updateDynamicKeyInHUD();
      }
  }
  updateDynamicKeyInHUD() {
    const delPill = document.querySelector('.qa-keyin-row[data-action="delete_curve"]');
    if (!delPill) return;

    const curve = this.getActiveCurve();
    const labelSpan = delPill.querySelector('span:first-child');

    if (!curve) {
      if (labelSpan) labelSpan.textContent = 'Delete (Select Curve)';
      delPill.style.opacity = '0.5';
    } else if (curve.vertices && curve.vertices.length > 2 && this._activeKnotIdx !== null) {
      if (labelSpan) labelSpan.textContent = `Delete Knot #${this._activeKnotIdx + 1}`;
      delPill.style.opacity = '1.0';
    } else {
      if (labelSpan) labelSpan.textContent = 'Delete Entire Curve';
      delPill.style.opacity = '1.0';
    }
  }

  renderConcaveArrowhead(p0, exitTangent, color, shadowOffset = 2.0) {
    return this.strokeManager.renderConcaveArrowhead(p0, exitTangent, color, shadowOffset);
  }

  setupInteractions() {
      this.setupKeyInMatrixHud();
      this.curveAnalyzer = new QuoraCurveAnalyzer(this);

      if (!this._hasBoundGlobalKeys) {
        this._hasBoundGlobalKeys = true;

        window.addEventListener('keydown', (e) => {
          if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

          // Number Keys 1–6: Instant Palette Switching
          if (['1', '2', '3', '4', '5', '6'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const paletteMap = {
              '1': '#00f2fe', '2': '#00e676', '3': '#ffd700',
              '4': '#ff2d55', '5': '#c084fc', '6': '#ffffff'
            };
            const chosen = paletteMap[e.key];
            if (chosen) {
              e.preventDefault();
              this.stageState.currentColor = chosen;
              if (this.colorIndicatorDot) this.colorIndicatorDot.style.background = chosen;
              const curve = this.getActiveCurve();
              if (curve) {
                curve.color = chosen;
                this.commitCurveGeometryUpdate();
              }
              this.renderStage();
              this.showKnotToast(`Color: ${chosen} (Key ${e.key})`);
              return;
            }
          }

          // Sub-Pixel Arrow Key Nudging for Active Knot
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            const step = e.shiftKey ? 10 : 1;
            let dx = 0, dy = 0;
            if (e.key === 'ArrowUp') dy = -step;
            if (e.key === 'ArrowDown') dy = step;
            if (e.key === 'ArrowLeft') dx = -step;
            if (e.key === 'ArrowRight') dx = step;

            if (this.nudgeActiveKnot(dx, dy)) {
              e.preventDefault();
              if (this.inSituHud) this.inSituHud.flashKeyCommand('nudge_knot');
              return;
            }
          }

          // Diagnostics Overlay with Shift+A
          if ((e.key === 'a' || e.key === 'A') && e.shiftKey) {
            e.preventDefault();
            this.curveAnalyzer.toggle();
            return;
          }

          // Cycle Arrowhead with 'A' (Tip -> Tail -> Both -> None)
          if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            this.toggleArrowhead();
            if (this.inSituHud) this.inSituHud.flashKeyCommand('toggle_arrow');
            return;
          }

          // Toggle Closed Curve Loop Mode with 'L'
          if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.toggleLoopMode();
            return;
          }

          // Duplicate Active Image Plate with 'D'
          if ((e.key === 'd' || e.key === 'D') && this.stageState.activeImage && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (this.imageManager) {
              this.imageManager.duplicateActivePlate(this.stageState);
            }
            return;
          }

          // Step Tangent Angle OR Stroke Width with '[' and ']'
          if (e.key === '[' || e.key === ']') {
            const knot = this.getActiveKnot();
            const curve = this.getActiveCurve();
            if (knot && curve && this._activeKnotIdx !== null) {
              e.preventDefault();
              const delta = (e.key === ']') ? 0.0872 : -0.0872;
              knot.tangentAngleOffset = (knot.tangentAngleOffset || 0) + delta;
              while (knot.tangentAngleOffset > Math.PI) knot.tangentAngleOffset -= Math.PI * 2;
              while (knot.tangentAngleOffset < -Math.PI) knot.tangentAngleOffset += Math.PI * 2;

              if (Math.abs(knot.tangentAngleOffset) < 0.0436) {
                knot.tangentAngleOffset = 0;
                knot.isExplicitTangent = false;
              } else {
                knot.isExplicitTangent = true;
              }

              this.commitCurveGeometryUpdate();
              this.renderOutboundTangentRay(curve, this._activeKnotIdx);
              const deg = Math.round(knot.tangentAngleOffset * (180 / Math.PI));
              this.showKnotToast(`Tangent Angle: ${deg > 0 ? '+' : ''}${deg}° [Knot #${this._activeKnotIdx + 1}${knot.isExplicitTangent ? ' 🔒' : ''}]`);
              return;
            } else {
              e.preventDefault();
              this.cycleStrokeWidth(e.key === ']' ? 0.5 : -0.5);
              return;
            }
          }

          // Meta Help Overlay with 'H'
          if ((e.key === 'h' || e.key === 'H') && !this._metaHelpActive && !e.ctrlKey && !e.metaKey) {
            this._metaHelpActive = true;
            this.showMetaHelpOverlay();
            if (this.inSituHud) this.inSituHud.flashKeyCommand('meta_help');
            return;
          }

          // Spacebar Tool Toggle (Curve <-> Paint)
          if (e.code === 'Space' && !this._isSpaceDown && !this._isDrawingActive) {
            e.preventDefault();
            this.executeKeyInCommand('toggle_tool', e);
            if (this.inSituHud) this.inSituHud.flashKeyCommand('toggle_tool');
            return;
          }

          // Text Callout with 'T'
          if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.triggerTextOnActiveOrCanvas();
            if (this.inSituHud) this.inSituHud.flashKeyCommand('edit_text');
            return;
          }

          // Swap Terminals with 'X'
          if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.swapActiveCurveTerminals();
            if (this.inSituHud) this.inSituHud.flashKeyCommand('swap_ends');
            return;
          }

          // Next Knot with Tab
          if (e.key === 'Tab') {
            e.preventDefault();
            this.executeKeyInCommand('next_knot', e);
            if (this.inSituHud) this.inSituHud.flashKeyCommand('next_knot');
            return;
          }

          // Toggle Cusp with 'C'
          if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.executeKeyInCommand('toggle_cusp', e);
            if (this.inSituHud) this.inSituHud.flashKeyCommand('toggle_cusp');
            return;
          }

          // Straighten with 'S'
          if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.executeKeyInCommand('straighten', e);
            if (this.inSituHud) this.inSituHud.flashKeyCommand('straighten');
            return;
          }

          // Reset with 'R'
          if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.executeKeyInCommand('reset_knot', e);
            if (this.inSituHud) this.inSituHud.flashKeyCommand('reset_knot');
            return;
          }

          // Add Point with '+'
          if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.addKnotToActiveCurve();
            if (this.inSituHud) this.inSituHud.flashKeyCommand('add_point');
            return;
          }

          // Delete with Del / Backspace
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelectedEntity();
            if (this.inSituHud) this.inSituHud.flashKeyCommand('delete_curve');
            return;
          }

          // Commit Pen Nodes with Enter
          if (e.key === 'Enter') {
            if (this._penNodes && this._penNodes.length >= 2) {
              e.preventDefault();
              this.commitPenNodes();
              return;
            }
          }

          // Cancel / Deselect with Escape
          if (e.key === 'Escape') {
            if (this._penNodes && this._penNodes.length > 0) {
              e.preventDefault();
              this.cancelPenNodes();
              return;
            }
            if (this.stageState.activeImage) {
              this.stageState.activeImage = null;
              this.renderStage();
              return;
            }
          }

          // Instant Alphanumeric Key-Capture for Callouts
          if (
            !e.ctrlKey && !e.metaKey && !e.altKey &&
            e.key.length === 1 &&
            /[a-zA-Z0-9.,!?'" -]/.test(e.key)
          ) {
            const curve = this.getActiveCurve();
            if (curve) {
              e.preventDefault();
              this.triggerTextOnActiveOrCanvas(e.key);
            }
          }
        });

        window.addEventListener('keyup', (e) => {
          if (e.key === 'h' || e.key === 'H') {
            this._metaHelpActive = false;
            this.hideMetaHelpOverlay();
          }
        });
      }

      // Double-click on canvas background drops standalone text badge
      this.svgSurface.addEventListener('dblclick', (e) => {
        if (e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle, .qa-segment-midpoint-group, .qa-movable-label-group, .qa-image-plate-control')) return;
        const pt = this.gestureMachine.getStagePt(e);
        this.promptDirectTextBadge(pt[0], pt[1]);
      });

      // Delegate all unified curve drawing & manipulation gestures to QuoraGestureMachine
      this.gestureMachine.init(this.svgSurface, this.stageBox);
    }
  setupPasteAndDropListener() {
    window.addEventListener('paste', (e) => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => this.addNewImagePlate(img, 80, 80);
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
              e.preventDefault();
              return;
            }
          }
        }
      }
    });

    this.viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.stageBox.style.outline = '2px dashed #00f2fe';
    });

    this.viewport.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.stageBox.style.outline = '1.5px dashed rgba(0, 242, 254, 0.35)';
    });

    this.viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.stageBox.style.outline = '1.5px dashed rgba(0, 242, 254, 0.35)';

      const rect = this.stageBox.getBoundingClientRect();
      const z = this.stageState.zoom || 1.0;
      const dropX = Math.round((e.clientX - rect.left) / z);
      const dropY = Math.round((e.clientY - rect.top) / z);

      // 1. Check for file system dropped images
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => this.addNewImagePlate(img, dropX + i * 25, dropY + i * 25);
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          }
        }
        return;
      }

      // 2. Check for browser tab / webpage image drags (URL or HTML img tag)
      let imageUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL');

      if (!imageUrl) {
        const htmlData = e.dataTransfer.getData('text/html');
        if (htmlData) {
          const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (match) imageUrl = match[1];
        }
      }

      if (imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.addNewImagePlate(img, dropX, dropY);
        };
        img.src = imageUrl;
      }
    });
  }
  renderPenNodesMarkers() {
    this.controlsLayer.querySelectorAll('.qa-pen-active-anchor').forEach(el => el.remove());
    if (!this._penNodes) return;
    this._penNodes.forEach((pt, i) => {
      this.controlsLayer.appendChild(makeElement('svg:circle', {
        className: 'qa-pen-active-anchor',
        cx: pt[0], cy: pt[1], r: '4.5',
        fill: i === 0 ? '#ffd700' : '#00e676', stroke: '#ffffff', 'stroke-width': '1.5',
        style: { pointerEvents: 'none' }
      }));
    });
  }

  showClutchHandRestBadge(tipPt) {
      if (!this.inSituHud) this.inSituHud = new QuoraInSituHUD(this);
      const curve = this.getActiveCurve();

      this.inSituHud.renderTransientCursorDial(this.controlsLayer, tipPt || [100, 100], curve, {
        onToggleArrow: () => this.toggleArrowhead(),
        onAttachText: () => this.triggerTextOnActiveOrCanvas(),
        onSwapEnds: () => this.swapActiveCurveTerminals(),
        onResetSnap: () => this.executeKeyInCommand('reset_knot')
      });

      let badge = document.getElementById('qa-clutch-rest-badge');
      if (!badge) {
        badge = makeElement('div', {
          id: 'qa-clutch-rest-badge',
          style: {
            position: 'absolute', background: 'rgba(245, 158, 11, 0.95)', color: '#070a13',
            padding: '4px 12px', borderRadius: '16px', fontFamily: 'monospace', fontSize: '10.5px',
            fontWeight: 'bold', zIndex: '90', pointerEvents: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.6)'
          }
        }, '⏸️ Hand-Rest Active • Click to resume');
        this.stageBox.appendChild(badge);
      }
      if (tipPt) {
        badge.style.left = `${tipPt[0] + 16}px`;
        badge.style.top = `${tipPt[1] - 46}px`;
      }
      badge.style.display = 'block';
  }

  hideClutchHandRestBadge() {
      if (this.inSituHud) this.inSituHud.hideTransientCursorDial();
      const b = document.getElementById('qa-clutch-rest-badge');
      if (b) b.remove();
  }

  commitSpline(beziers, color, hasArrow, existingVertices = null) {
    return this.strokeManager.commitSpline(beziers, color, hasArrow, existingVertices);
  }
  exposeBezierHandles(curveRecord) {
      if (!this.knotManager) this.knotManager = new QuoraKnotManager(this);
      this.knotManager.exposeHandles(curveRecord, this.controlsLayer, this.stageState);
  }

  commitCurveGeometryUpdate() {
    return this.strokeManager.updateCurveGeometry();
  }
  getActiveCurve() {
    if (this.stageState.selectedItem?.type === 'curve') return this.stageState.selectedItem;
    const curves = this.stageState.annotations.filter(a => a.type === 'curve');
    return curves.length > 0 ? curves[curves.length - 1] : null;
  }

  getActiveKnot() {
    const curve = this.getActiveCurve();
    if (!curve || !curve.vertices) return null;
    return curve.vertices[this._activeKnotIdx] || null;
  }

  showKnotToast(msg) {
    let toast = document.getElementById('qa-knot-mod-toast');
    if (!toast) {
      toast = makeElement('div', {
        id: 'qa-knot-mod-toast',
        style: {
          position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)', border: '1.5px solid #00f2fe', color: '#00f2fe',
          padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontFamily: 'monospace',
          fontWeight: 'bold', zIndex: '100', pointerEvents: 'none'
        }
      });
      this.stageBox.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1600);
  }

  showMetaHelpOverlay() {
    this.hideMetaHelpOverlay();
    const g = makeElement('svg:g', { id: 'qa-meta-help-layer', style: { pointerEvents: 'none' } });
    const tf = this.computeAutoBounds();
    const midX = tf.totalW / 2;
    const midY = tf.totalH / 2;

    this.drawCalloutLeader(midX - 100, midY, ['🪢 Drawstring Drag-Lead', 'Drag past circle to pull curve'], { direction: 'left' });
    this.drawCalloutLeader(midX + 70, midY - 60, ['⏸️ Hand-Rest Clutch', 'Hold Ctrl to pause & rest hand'], { direction: 'right' });
    this.controlsLayer.appendChild(g);
  }

  hideMetaHelpOverlay() {
    const el = document.getElementById('qa-meta-help-layer');
    if (el) el.remove();
  }

  undoLastAnnotation() {
    if (this.stageState.annotations.length === 0) return;
    const item = this.stageState.annotations.pop();
    if (item.elements) item.elements.forEach(el => el.remove());
    if (item._arrowFg) item._arrowFg.remove();
    if (item._arrowSh) item._arrowSh.remove();
    this.controlsLayer.innerHTML = '';
    this.renderStage();
    this.updateDynamicKeyInHUD();
  }

  beziersToVertices(beziers) {
    return this.strokeManager.beziersToVertices(beziers);
  }

  verticesToBeziers(vertices) {
    return this.strokeManager.verticesToBeziers(vertices);
  }

  renderEphemeralKnotHandles(curveRecord) {
    this.gestureMachine.renderEphemeralKnotHandles(curveRecord);
  }
  setupKeyInMatrixHud() {
      if (!this.inSituHud) this.inSituHud = new QuoraInSituHUD(this);
      this.inSituHud.setupKeyInMatrixHud();
  }
  ensureFontLoaded(fontFamily) {
    if (!fontFamily) return;
    if (fontFamily.includes('Architects Daughter') && !this._loadedFonts.has('Architects Daughter')) {
      this._loadedFonts.add('Architects Daughter');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap';
      document.head.appendChild(link);
    }
  }

  renderStage() {
      if (!this.imageManager) this.imageManager = new QuoraImageManager(this);
      if (!this.textManager) this.textManager = new QuoraTextManager(this);

      const tf = this.computeAutoBounds();
      this.stageBox.style.width = `${tf.totalW}px`;
      this.stageBox.style.height = `${tf.totalH}px`;

      this.sceneCanvas.width = tf.totalW;
      this.sceneCanvas.height = tf.totalH;
      const ctx = this.sceneCanvas.getContext('2d');
      ctx.clearRect(0, 0, tf.totalW, tf.totalH);

      if (this.stageState.canvasBgMode === 'matte') {
        ctx.fillStyle = this.stageState.canvasBgColor || '#090d16';
        ctx.fillRect(0, 0, tf.totalW, tf.totalH);
      }

      // Render placed image plates with opacity support and clean pixel fidelity
      (this.stageState.placedImages || []).forEach(plate => {
        ctx.save();
        ctx.globalAlpha = (plate.opacity !== undefined) ? plate.opacity : 1.0;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 12;
        ctx.drawImage(plate.img, plate.x, plate.y, plate.width, plate.height);
        ctx.restore();
      });

      // Render imported Spot-The-Difference lenses
      this.renderDiffCallouts();

      // Render text badges through QuoraTextManager delegate
      this.textBadgesLayer.innerHTML = '';
      (this.stageState.annotations || []).forEach(ann => {
        if (ann.type === 'text_badge') {
          this.renderDirectTextBadgeSvg(ann);
        } else if (ann.type === 'curve' && ann.text && ann.beziers?.length > 0) {
          this.textManager.renderCurveAttachedTextSvg(ann, this.textBadgesLayer, this.stageState);
        }
      });

      // Render image plate manipulation controls onto the SVG controls layer
      this.imageManager.renderControls(this.controlsLayer, this.stageState);
  }
  renderCurveAttachedTextSvg(ann) {
      if (!this.textManager) this.textManager = new QuoraTextManager(this);
      return this.textManager.renderCurveAttachedTextSvg(ann, this.textBadgesLayer, this.stageState);
  }
  renderDirectTextBadgeSvg(ann) {
      if (!this.textManager) this.textManager = new QuoraTextManager(this);
      this.textManager.renderDirectTextBadgeSvg(ann, this.textBadgesLayer, this.stageState);
  }

  renderImagePlateControls() {
      if (!this.imageManager) this.imageManager = new QuoraImageManager(this);
      this.imageManager.renderControls(this.controlsLayer, this.stageState);
    }
  loadDefaultDemo() {
    const c = document.createElement('canvas');
    c.width = 900; c.height = 480;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 900, 480);
    ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 20px monospace';
    ctx.fillText('Universal Graphic Studio: Multi-Plate Ambient Canvas', 30, 50);
    ctx.font = '13px monospace'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('• Draw curve & type callout • 🏹 Arrow (A) • 💬 Text (T) • ⇄ Swap Ends (X)', 30, 85);
    ctx.fillText('• Single Knot Lock: Dragging moves active point; other knots stay strictly fixed', 30, 115);
    ctx.fillText('• Paste image (Ctrl+V) or click "📋 Paste Image" button in toolbar', 30, 145);

    const img = new Image();
    img.onload = () => {
      this.addNewImagePlate(img, 45, 45);
    };
    img.src = c.toDataURL('image/png');
  }

  setupZoomWheel() {
    const getViewportCursor = (e) => {
      const rect = this.viewport.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    // Mouse Wheel Zoom centered around the cursor point
    this.viewport.addEventListener('wheel', (e) => {
      // If tweaking a selected knot with modifier keys, let the knot adjust
      const k = this.getActiveKnot();
      if (k && e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle')) {
        const delta = e.deltaY > 0 ? -1 : 1;
        if (e.shiftKey) {
          k.tangentAngleOffset = (k.tangentAngleOffset || 0) + delta * 0.087;
          k.isExplicitTangent = true;
          this.showKnotToast(`Tangent Angle: ${Math.round(k.tangentAngleOffset * (180 / Math.PI))}°`);
        } else if (e.altKey || e.ctrlKey) {
          k.balance = Math.max(0.1, Math.min(1.9, (k.balance || 1) + delta * 0.08));
          this.showKnotToast(`Balance: ${k.balance.toFixed(2)}`);
        } else {
          k.curvature = Math.max(0.2, Math.min(3.0, (k.curvature || 1) + delta * 0.1));
          this.showKnotToast(`Curvature: ${k.curvature.toFixed(2)}`);
        }
        this.commitCurveGeometryUpdate();
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const [cursorX, cursorY] = getViewportCursor(e);
      const oldZoom = this.stageState.zoom || 1.0;
      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      const newZoom = Math.max(this.stageState.minZoom, Math.min(this.stageState.maxZoom, oldZoom * factor));

      if (Math.abs(newZoom - oldZoom) < 0.001) return;

      // Calculate stage coordinate directly under mouse cursor
      const stageX = (cursorX - this.stageState.panX) / oldZoom;
      const stageY = (cursorY - this.stageState.panY) / oldZoom;

      // Reposition pan offsets so stage point stays anchored under the cursor
      this.stageState.zoom = newZoom;
      this.stageState.panX = cursorX - stageX * newZoom;
      this.stageState.panY = cursorY - stageY * newZoom;

      this.applyViewportTransform();
    }, { passive: false });

    // Pan Viewport via Spacebar + Drag or Middle Mouse Button
    let isPanning = false;
    let startX = 0, startY = 0;
    let initPanX = 0, initPanY = 0;

    const onPanStart = (e) => {
      const isMiddle = (e.button === 1);
      const isSpaceDrag = (e.button === 0 && this._isSpaceDown);
      if (!isMiddle && !isSpaceDrag) return;

      e.preventDefault();
      e.stopPropagation();
      isPanning = true;
      this._isPanningView = true;
      startX = e.clientX;
      startY = e.clientY;
      initPanX = this.stageState.panX || 0;
      initPanY = this.stageState.panY || 0;
      this.viewport.style.cursor = 'grabbing';

      const onPanMove = (ev) => {
        if (!isPanning) return;
        this.stageState.panX = Math.round(initPanX + (ev.clientX - startX));
        this.stageState.panY = Math.round(initPanY + (ev.clientY - startY));
        this.applyViewportTransform();
      };

      const onPanEnd = () => {
        isPanning = false;
        this._isPanningView = false;
        this.viewport.style.cursor = this._isSpaceDown ? 'grab' : '';
        window.removeEventListener('mousemove', onPanMove);
        window.removeEventListener('mouseup', onPanEnd);
      };

      window.addEventListener('mousemove', onPanMove);
      window.addEventListener('mouseup', onPanEnd);
    };

    this.viewport.addEventListener('mousedown', onPanStart);

    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.code === 'Space' && !this._isSpaceDown && !this._isDrawingActive) {
        this._isSpaceDown = true;
        this.viewport.style.cursor = 'grab';
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._isSpaceDown = false;
        if (!isPanning) this.viewport.style.cursor = '';
      }
    });
  }
  setupEdgePullHandles() {
    const rightBar = makeElement('div', {
      className: 'qa-edge-handle qa-edge-right', title: 'Drag to expand canvas width',
      style: { position: 'absolute', top: '10%', right: '-8px', width: '12px', height: '80%', cursor: 'ew-resize', zIndex: '40' }
    });
    const bottomBar = makeElement('div', {
      className: 'qa-edge-handle qa-edge-bottom', title: 'Drag to expand canvas height',
      style: { position: 'absolute', bottom: '-8px', left: '10%', width: '80%', height: '12px', cursor: 'ns-resize', zIndex: '40' }
    });

    const initDrag = (e, axis) => {
      e.stopPropagation(); e.preventDefault();
      this.stageState.manualSizing = true;
      const startX = e.clientX, startY = e.clientY;
      const startW = this.stageState.canvasWidth, startH = this.stageState.canvasHeight;
      const z = this.stageState.zoom || 1.0;

      const onMove = (ev) => {
        if (axis === 'x') this.stageState.canvasWidth = Math.max(300, Math.round(startW + (ev.clientX - startX) / z));
        if (axis === 'y') this.stageState.canvasHeight = Math.max(200, Math.round(startH + (ev.clientY - startY) / z));
        this.renderStage();
      };
      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    rightBar.onmousedown = (e) => initDrag(e, 'x');
    bottomBar.onmousedown = (e) => initDrag(e, 'y');
    this.stageBox.append(rightBar, bottomBar);
  }

  copyCompositeToClipboard(btn, preset = 'native') {
    this.exportManager.copyCompositeToClipboard(btn, preset);
  }
  renderKeyInMatrixRows() {
      if (!this._keyInPillsContainer) return;
      this._keyInPillsContainer.innerHTML = '';

      const commands = [
        { key: 'H (Hold)', label: 'Meta Vector Help', desc: 'Hold H anytime to see on-screen arrowheads and bracket callouts explaining all controls', action: 'meta_help' },
        { key: 'Ctrl (Hold)', label: 'Clutch / Rest Hand', desc: 'Freeze curve growth to tune drawstring radius R, or release mouse to rest hand without breaking curve', action: 'clutch_rest' },
        { key: 'Space', label: 'Draw ↔ Tweak Mode', desc: 'Toggle between drawing new curves and selecting/tweaking existing knots or difference lenses', action: 'toggle_tool' },
        { key: 'Tab', label: 'Next Knot on Curve', desc: 'Advance active knot selection forward along the curve (Shift+Tab moves backward)', action: 'next_knot' },
        { key: 'A', label: 'Toggle Arrowhead', desc: 'Add or remove the concave arrowhead on the active curve terminal or upcoming strokes', action: 'toggle_arrow' },
        { key: 'T', label: 'Attach / Edit Text', desc: 'Focus the text editor at the curve terminal to type or update callout text immediately', action: 'edit_text' },
        { key: 'X', label: 'Swap Terminals', desc: 'Instantly reverse endpoints: move arrowhead to opposite end and flip the text bracket', action: 'swap_ends' },
        { key: 'Click (Dot)', label: 'Midpoint Knot Split', desc: 'Clicking the stationary midpoint dot on any segment bisects it at t=0.5 with a new knot', action: 'split_point' },
        { key: '➕ / +', label: 'Add Knot to Segment', desc: 'Insert an on-curve knot on the active segment without altering overall curve shape', action: 'add_point' },
        { key: 'Right-Click', label: 'Delete Knot', desc: 'Right-clicking any knot handle deletes that point and re-relaxes the curve smoothly', action: 'delete_knot' },
        { key: 'Del', label: 'Delete Knot / Curve', desc: 'Deletes the active knot first; once 2 endpoints remain, deletes the entire curve assembly', action: 'delete_curve' },
        { key: 'C', label: 'Toggle Cusp (45°)', desc: 'Breaks continuous tangency into a sharp 45° corner/cusp at the active knot', action: 'toggle_cusp' },
        { key: 'B', label: 'Cycle Balance (0.5/1.5)', desc: 'Cycles handle length ratio balance between 0.5, 1.5, and 1.0', action: 'cycle_balance' },
        { key: '[ / ]', label: 'Step Tangent Angle', desc: 'Rotates outbound tangent angle by ±10° with magnetic snapping to natural baseline', action: 'tune_tangent' },
        { key: '+ / -', label: 'Tune Curvature (C)', desc: 'Increases or decreases curvature tension C in increments of 0.15', action: 'tune_curvature' },
        { key: 'S', label: 'Straighten to Line', desc: 'Collapses curve by removing all intermediate knots, making a direct straight arrow', action: 'straighten' },
        { key: 'R', label: 'Reset Knot Constraints', desc: 'Resets active knot constraints back to default relaxed state (0 offset, C=1, B=1)', action: 'reset_knot' },
        { key: 'W', label: 'Wipe All Constraints', desc: 'Wipes all custom constraints across all knots on the selected curve', action: 'wipe_curve' }
      ];

      this._keyInCommandElements = {};

      commands.forEach(cmd => {
        const card = makeElement('div', {
          className: 'qa-keyin-row',
          'data-action': cmd.action,
          style: {
            display: 'flex', flexDirection: 'column', gap: '2px',
            padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
            background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
            transition: 'all 0.12s ease'
          },
          title: `Click or press ${cmd.key} to execute`,
          onclick: (e) => {
            e.stopPropagation();
            if (cmd.action === 'toggle_arrow') this.toggleArrowhead();
            else if (cmd.action === 'edit_text') this.triggerTextOnActiveOrCanvas();
            else if (cmd.action === 'swap_ends') this.swapActiveCurveTerminals();
            else if (cmd.action === 'add_point') this.addKnotToActiveCurve();
            else this.executeKeyInCommand(cmd.action);
          }
        });

        const topRow = makeElement('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
        }, [
          makeElement('span', { style: { color: '#cbd5e1', fontSize: '10.5px' } }, cmd.label),
          makeElement('span', {
            style: {
              background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.35)',
              borderRadius: '4px', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold', minWidth: '42px', textAlign: 'center'
            }
          }, cmd.key)
        ]);

        card.appendChild(topRow);

        if (this._hudShowDetails) {
          const descRow = makeElement('div', {
            style: { fontSize: '9.5px', color: '#94a3b8', lineHeight: '1.3', marginTop: '2px', paddingLeft: '2px' }
          }, cmd.desc);
          card.appendChild(descRow);
        }

        card.addEventListener('mouseenter', () => { card.style.background = 'rgba(0, 242, 254, 0.12)'; });
        card.addEventListener('mouseleave', () => { card.style.background = 'rgba(255, 255, 255, 0.02)'; });

        this._keyInCommandElements[cmd.action] = card;
        this._keyInPillsContainer.appendChild(card);
      });

      this.updateDynamicKeyInHUD();
    }

  renderInSituCursorReticle(screenPt, dirAngle, tension = 1.0) {
      let reticle = document.getElementById('qa-cursor-reticle-overlay');
      if (!reticle) {
        reticle = makeElement('svg:g', {
          id: 'qa-cursor-reticle-overlay',
          style: { pointerEvents: 'none', transition: 'opacity 0.1s ease' }
        });
        this.controlsLayer.appendChild(reticle);
      }

      const radius = 20 * tension;
      const endX = screenPt[0] + Math.cos(dirAngle) * (radius + 12);
      const endY = screenPt[1] + Math.sin(dirAngle) * (radius + 12);

      reticle.innerHTML = `
        <circle cx="${screenPt[0]}" cy="${screenPt[1]}" r="${radius}" fill="none" stroke="rgba(0, 242, 254, 0.4)" stroke-width="1.2" stroke-dasharray="2,3" />
        <line x1="${screenPt[0]}" y1="${screenPt[1]}" x2="${endX}" y2="${endY}" stroke="#00f2fe" stroke-width="2" stroke-linecap="round" />
        <circle cx="${endX}" cy="${endY}" r="3" fill="#00f2fe" />
      `;
      reticle.style.display = 'block';
  }

  hideInSituCursorReticle() {
      const reticle = document.getElementById('qa-cursor-reticle-overlay');
      if (reticle) reticle.style.display = 'none';
  }

  hitTestImagePlate(pt) {
      if (!this.imageManager) this.imageManager = new QuoraImageManager(this);
      return this.imageManager.hitTest(this.stageState, pt);
    }
  executeKeyInCommand(action, ev = null) {
    const curve = this.getActiveCurve();
    const knot = this.getActiveKnot();

    switch (action) {
      case 'toggle_tool':
        this.stageState.activeTool = (this.stageState.activeTool === 'curve') ? 'paint' : 'curve';
        if (this.toolBtns.curve && this.toolBtns.paint) {
          this.toolBtns.curve.classList.toggle('primary', this.stageState.activeTool === 'curve');
          this.toolBtns.paint.classList.toggle('primary', this.stageState.activeTool === 'paint');
        }
        this.brushControlsRibbon.style.display = (this.stageState.activeTool === 'paint') ? 'flex' : 'none';
        this.showKnotToast(`Active Tool: ${this.stageState.activeTool.toUpperCase()}`);
        break;

      case 'next_knot':
        if (curve && curve.vertices && curve.vertices.length > 0) {
          const step = (ev && ev.shiftKey) ? -1 : 1;
          this._activeKnotIdx = (this._activeKnotIdx + step + curve.vertices.length) % curve.vertices.length;
          this.exposeBezierHandles(curve);
          this.showKnotToast(`Selected Knot #${this._activeKnotIdx + 1} / ${curve.vertices.length}`);
        }
        break;

      case 'toggle_cusp':
        if (knot) {
          knot.isCusp = !knot.isCusp;
          if (!knot.isCusp) {
            knot.tangentAngleOffset = 0;
            knot.isExplicitTangent = false;
          }
          this.commitCurveGeometryUpdate();
          this.exposeBezierHandles(curve);
          this.showKnotToast(knot.isCusp ? '⚡ Cusp: Sharp Corner Point' : '🔄 Rejoined as Smooth Curve');
        }
        break;

      case 'cycle_balance':
        if (knot) {
          const vals = [1.0, 0.5, 1.5];
          const cur = knot.balance || 1.0;
          const nxt = vals[(vals.findIndex(v => Math.abs(v - cur) < 0.1) + 1) % vals.length];
          knot.balance = nxt;
          this.commitCurveGeometryUpdate();
          this.showKnotToast(`Balance: ${nxt.toFixed(2)}`);
        }
        break;

      case 'tune_curvature':
        if (knot) {
          knot.curvature = Math.max(0.2, Math.min(3.0, (knot.curvature || 1.0) + 0.2));
          this.commitCurveGeometryUpdate();
          this.showKnotToast(`Curvature Tension: ${knot.curvature.toFixed(2)}`);
        }
        break;

      case 'straighten':
        if (curve && curve.vertices && curve.vertices.length > 2) {
          curve.vertices = [curve.vertices[0], curve.vertices[curve.vertices.length - 1]];
          this._activeKnotIdx = 0;
          this.commitCurveGeometryUpdate();
          this.exposeBezierHandles(curve);
          this.showKnotToast('Straightened: Intermediate knots removed');
        }
        break;

      case 'reset_knot':
        if (knot) {
          knot.tangentAngleOffset = 0;
          knot.curvature = 1.0;
          knot.balance = 1.0;
          knot.isCusp = false;
          knot.isExplicitTangent = false;
          this.commitCurveGeometryUpdate();
          this.exposeBezierHandles(curve);
          this.showKnotToast(`Knot #${this._activeKnotIdx + 1} constraints reset to natural baseline`);
        }
        break;

      case 'wipe_curve':
        if (curve && curve.vertices) {
          curve.vertices.forEach(v => {
            v.tangentAngleOffset = 0;
            v.curvature = 1.0;
            v.balance = 1.0;
            v.isCusp = false;
            v.isExplicitTangent = false;
          });
          this.commitCurveGeometryUpdate();
          this.exposeBezierHandles(curve);
          this.showKnotToast('Wiped all constraints: 100% smooth baseline curve');
        }
        break;
    }
  }
  nudgeActiveKnot(dx, dy) {
      const knot = this.getActiveKnot();
      const curve = this.getActiveCurve();
      if (!knot || !curve) return false;

      knot.point[0] += dx;
      knot.point[1] += dy;

      const localScope = (this.stageState.dragLockMode === 'single')
        ? { start: Math.max(0, this._activeKnotIdx - 1), end: Math.min(curve.vertices.length - 1, this._activeKnotIdx + 1) }
        : null;

      this.commitCurveGeometryUpdate(localScope);
      this.exposeBezierHandles(curve);
      return true;
  }

  importDataset(data) {
      if (!data) return;

      this.stageState.annotations = [];
      this.stageState.placedImages = [];
      this.stageState.activeImage = null;
      this.controlsLayer.innerHTML = '';

      if (data.sourceImage) {
        this.addNewImagePlate(data.sourceImage, 45, 45);
        this.stageState.baseImage = data.sourceImage;
      }

      if (data.activeCrop) {
        this.stageState.cropRect = data.activeCrop;
      }

      if (data.baseOrigin) {
        this.stageState.baseOrigin = data.baseOrigin;
      }

      if (data.diffCircles && Array.isArray(data.diffCircles)) {
        this.stageState.diffCallouts = data.diffCircles.map(d => ({
          ...d,
          dragX: d.dragX !== undefined ? d.dragX : d.cropX,
          dragY: d.dragY !== undefined ? d.dragY : d.cropY
        }));
      }

      this.renderStage();
      const count = this.stageState.diffCallouts.length;
      this.showKnotToast(`🧩 Imported Comparator: ${count} spotted difference${count === 1 ? '' : 's'}`);
  }

  renderDiffCallouts() {
      this.diffSvgLayer.innerHTML = '';
      if (!this.stageState.diffCallouts || this.stageState.diffCallouts.length === 0) return;

      const basePlate = this.stageState.placedImages[0];
      const originX = basePlate ? basePlate.x : 45;
      const originY = basePlate ? basePlate.y : 45;

      this.stageState.diffCallouts.forEach((diff, idx) => {
        const c1x = originX + diff.cropX;
        const c1y = originY + diff.cropY;
        const r = Math.max(10, diff.radius);
        const col = diff.color || '#00e676';

        const g = makeElement('svg:g', { className: 'qa-imported-diff-lens' });

        // Anchor circle on puzzle feature
        g.appendChild(makeElement('svg:circle', {
          cx: c1x, cy: c1y, r: r, fill: 'none', stroke: col,
          'stroke-width': '2.2', 'stroke-dasharray': '4,3',
          style: { filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.8))' }
        }));

        // Index label
        g.appendChild(makeElement('svg:circle', {
          cx: c1x, cy: c1y, r: '3.5', fill: col
        }));

        g.appendChild(makeElement('svg:text', {
          x: c1x + r + 5, y: c1y + 4, fill: col, 'font-size': '11px',
          'font-family': 'monospace', 'font-weight': 'bold',
          style: { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }
        }, `#${idx + 1}`));

        this.diffSvgLayer.appendChild(g);
      });
  }

  isInteracting() {
    return Boolean(
      this._isDrawingActive ||
      this._isPanningView ||
      this.gestureMachine?.isDrawing ||
      this.gestureMachine?.isMarquee ||
      this.knotManager?._isDraggingKnot ||
      this.knotManager?._isDraggingRay ||
      this.imageManager?._isDraggingPlate ||
      this.textManager?._isDraggingBadge
    );
  }

  applyViewportTransform() {
    const z = this.stageState.zoom || 1.0;
    const px = this.stageState.panX || 0;
    const py = this.stageState.panY || 0;

    this.zoomScaffold.style.transformOrigin = '0 0';
    this.zoomScaffold.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${z})`;

    const statusPill = document.getElementById('qa-status-pill');
    if (statusPill) {
      statusPill.textContent = `Zoom: ${Math.round(z * 100)}% • Hold Space to Pan`;
    }
  }

  commitCircleCallout(p1, p2) {
      const cx = Math.round((p1[0] + p2[0]) / 2);
      const cy = Math.round((p1[1] + p2[1]) / 2);
      const rx = Math.round(Math.abs(p2[0] - p1[0]) / 2);
      const ry = Math.round(Math.abs(p2[1] - p1[1]) / 2);

      if (rx < 4 || ry < 4) return;

      const col = this.stageState.currentColor || '#00e676';
      const strokeW = this.stageState.curveStrokeWidth || 3.2;

      const shadow = makeElement('svg:ellipse', {
        cx: cx + 2, cy: cy + 2, rx, ry, fill: 'none',
        stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(strokeW + 2)
      });

      const glow = makeElement('svg:ellipse', {
        cx, cy, rx, ry, fill: 'none',
        stroke: col, 'stroke-width': String(strokeW + 6), opacity: '0.3',
        style: { filter: 'drop-shadow(0 0 8px ' + col + ')' }
      });

      const foreground = makeElement('svg:ellipse', {
        cx, cy, rx, ry, fill: 'rgba(0, 242, 254, 0.05)',
        stroke: col, 'stroke-width': String(strokeW)
      });

      this.shadowLayer.appendChild(shadow);
      this.glowLayer.appendChild(glow);
      this.strokeLayer.appendChild(foreground);

      const record = {
        id: 'callout_' + Date.now(),
        type: 'circle_callout',
        cx, cy, rx, ry,
        color: col,
        strokeWidth: strokeW,
        elements: [shadow, foreground, glow],
        text: ''
      };

      this.stageState.annotations.push(record);
      this.stageState.selectedItem = record;
      this.renderStage();
      this.showKnotToast('⭕ Highlight Ring placed • Start typing to add label!');
    }

  commitBoxCallout(p1, p2) {
      const x = Math.round(Math.min(p1[0], p2[0]));
      const y = Math.round(Math.min(p1[1], p2[1]));
      const w = Math.round(Math.abs(p2[0] - p1[0]));
      const h = Math.round(Math.abs(p2[1] - p1[1]));

      if (w < 6 || h < 6) return;

      const col = this.stageState.currentColor || '#00e676';
      const strokeW = this.stageState.curveStrokeWidth || 3.2;

      const shadow = makeElement('svg:rect', {
        x: x + 2, y: y + 2, width: w, height: h, rx: '6', fill: 'none',
        stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(strokeW + 2)
      });

      const glow = makeElement('svg:rect', {
        x, y, width: w, height: h, rx: '6', fill: 'none',
        stroke: col, 'stroke-width': String(strokeW + 6), opacity: '0.3',
        style: { filter: 'drop-shadow(0 0 8px ' + col + ')' }
      });

      const foreground = makeElement('svg:rect', {
        x, y, width: w, height: h, rx: '6', fill: 'rgba(0, 242, 254, 0.05)',
        stroke: col, 'stroke-width': String(strokeW)
      });

      this.shadowLayer.appendChild(shadow);
      this.glowLayer.appendChild(glow);
      this.strokeLayer.appendChild(foreground);

      const record = {
        id: 'frame_' + Date.now(),
        type: 'box_callout',
        x, y, w, h,
        color: col,
        strokeWidth: strokeW,
        elements: [shadow, foreground, glow],
        text: ''
      };

      this.stageState.annotations.push(record);
      this.stageState.selectedItem = record;
      this.renderStage();
      this.showKnotToast('◻ Frame Box placed • Start typing to add label!');
    }

  toggleLoopMode() {
      const curve = this.getActiveCurve();
      if (!curve) {
        this.showKnotToast('Select or draw a curve to toggle loop');
        return;
      }

      curve.isClosed = !curve.isClosed;
      if (curve.isClosed) {
        curve.arrowEnd = 'none';
      } else {
        curve.arrowEnd = this.stageState.hasArrow ? 'tip' : 'none';
      }

      this.commitCurveGeometryUpdate();
      this.exposeBezierHandles(curve);

      if (this.loopBtn) {
        this.loopBtn.textContent = curve.isClosed ? '🔄 Loop: CLOSED' : '🔄 Loop: OPEN';
        this.loopBtn.classList.toggle('primary', curve.isClosed);
      }

      this.showKnotToast(curve.isClosed ? '🔄 Closed Loop Mode Active' : '↔ Open Spline Mode Active');
    }

  cycleStrokeWidth(delta = null) {
      const widths = [1.5, 2.4, 3.2, 4.8, 7.0, 10.0];
      const cur = this.stageState.curveStrokeWidth || 3.2;
      let nextW;
      if (delta === null) {
        const nextIdx = (widths.findIndex(w => Math.abs(w - cur) < 0.3) + 1) % widths.length;
        nextW = widths[nextIdx];
      } else {
        nextW = Math.max(1.0, Math.min(20.0, Math.round((cur + delta) * 10) / 10));
      }

      this.stageState.curveStrokeWidth = nextW;
      const curve = this.getActiveCurve();
      if (curve) {
        curve.strokeWidth = nextW;
        this.commitCurveGeometryUpdate();
      }
      if (this.widthBtn) {
        this.widthBtn.textContent = `Width: ${nextW}px`;
      }
      this.showKnotToast(`Stroke Width: ${nextW}px`);
    }

  toggleLineStyle() {
      const styles = ['classic', 'lightsaber', 'neon'];
      const cur = this.stageState.lineStyle || 'classic';
      const nextStyle = styles[(styles.indexOf(cur) + 1) % styles.length];

      this.stageState.lineStyle = nextStyle;
      const curve = this.getActiveCurve();
      if (curve) {
        curve.lineStyle = nextStyle;
        this.commitCurveGeometryUpdate();
      }

      if (this.lineStyleBtn) {
        const labels = {
          'classic': '🖋️ Classic',
          'lightsaber': '⚔️ Lightsaber',
          'neon': '💡 Neon'
        };
        this.lineStyleBtn.textContent = labels[nextStyle] || '🖋️ Classic';
      }

      this.showKnotToast(`Line Style: ${nextStyle.toUpperCase()}`);
    }

  updatePaletteHighlight() {
      const cur = (this.stageState.currentColor || '').toLowerCase();
      if (this.colorIndicatorDot) {
        this.colorIndicatorDot.style.background = this.stageState.currentColor;
      }
      if (this._swatchElements) {
        this._swatchElements.forEach(el => {
          const h = (el.getAttribute('data-hex') || '').toLowerCase();
          const isMatch = (h === cur);
          el.classList.toggle('active', isMatch);
          el.style.border = isMatch ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.4)';
        });
      }
    }
}

globalThis.QuoraAnnotationComponent = QuoraAnnotationComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraAnnotationComponent;