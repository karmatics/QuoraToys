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

  constructor() {
      this.stageState = {
        baseImage: null,
        cropRect: null,
        baseOrigin: { x: 0, y: 0 },
        diffCallouts: [],
        lensAlignment: 'perpendicular',
        annotations: [],       // All curves, arrows, and blockouts
        placedImages: [],      // Multiple draggable/resizable image plates
        activeImage: null,
        // Cursor-centered viewport camera state
        panX: 0,
        panY: 0,
        zoom: 1.0,
        minZoom: 0.15,
        maxZoom: 6.0,
        manualSizing: false,
        canvasWidth: 800,
        canvasHeight: 500,
        padding: 35,
        canvasBgMode: 'matte',
        canvasBgColor: '#090d16',
        activeTool: 'curve',
        hasArrow: true,
        curveStrokeWidth: 3.2,
        currentColor: '#00e676',
        hasBorder: true,
        fontFamily: "'Architects Daughter', cursive, sans-serif",
        fontSize: 22,
        recentFonts: [
          "'Architects Daughter', cursive, sans-serif",
          "monospace",
          "'Plus Jakarta Sans', system-ui, sans-serif"
        ],
        brushMode: 'freehand',
        brushColor: '#000000',
        brushSize: 32,
        brushSoftness: 0,
        tetherActive: true,
        tetherLength: 32,
        eraseRadius: 24,
        selectedItem: null,
        freePointOnDrag: true, // Frees knot constraints when moving; Esc restores
        cropMarquee: null
      };

      this.cropCanvas = null;
      this.baseCropCanvas = null;
      this._loadedFonts = new Set();
      this._devDeckDialog = null;
      this._activeKnotIdx = 0;
    }
  build(container) {
      this.ensureFontLoaded(this.stageState.fontFamily);

      const wrap = makeElement('div', {
        style: {
          background: '#070a13',
          border: '1.5px solid #21262d',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace'
        }
      });

      const localFileInput = makeElement('input', {
        type: 'file',
        accept: 'image/*',
        style: { display: 'none' },
        onchange: (e) => {
          if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                this.stageState.baseImage = img;
                this.stageState.cropRect = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
                this.stageState.baseOrigin = { x: 0, y: 0 };
                this.cropCanvas = null;
                this.baseCropCanvas = null;
                this.stageState.diffCallouts = [];
                this.stageState.manualSizing = false;
                this.renderStage();
              };
              img.src = ev.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
          }
        }
      });
      wrap.appendChild(localFileInput);

      // 1. Studio Header Toolbar
      const header = makeElement('div', {
        style: {
          padding: '10px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }
      }, [
        makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          makeElement('span', { style: { fontSize: '16px' } }, '🎨'),
          makeElement('strong', { style: { fontSize: '13px', color: '#00f2fe' } }, 'Universal Graphic Studio'),
          makeElement('span', { id: 'qa-status-pill', style: { fontSize: '10px', background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' } }, 'Ready')
        ]),
        makeElement('div', { style: { display: 'flex', gap: '6px' } }, [
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '4px 9px', fontSize: '11px', color: '#00f2fe', borderColor: '#00f2fe66' },
            title: 'Open any image from your computer to start annotating immediately',
            onclick: () => localFileInput.click()
          }, '📁 Open Image'),
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '4px 9px', fontSize: '11px', color: '#38bdf8', borderColor: '#38bdf866' },
            onclick: () => this.captureScreen()
          }, '📸 Screenshot'),
          makeElement('button', {
            className: 'dr-nav-btn primary',
            style: { padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', background: '#238636', borderColor: '#2ea043' },
            title: 'Copy high-resolution PNG directly to clipboard',
            onclick: (e) => this.copyCompositeToClipboard(e.currentTarget)
          }, '📋 Copy Hi-Res PNG')
        ])
      ]);
      wrap.appendChild(header);

      // 2. Main Tool Ribbon
      const ribbon = makeElement('div', {
        style: {
          padding: '8px 14px',
          background: 'rgba(11, 17, 32, 0.98)',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          fontSize: '11px',
          color: '#cbd5e1'
        }
      });

      this.toolBtns = {};
      const setTool = (mode) => {
        this.stageState.activeTool = mode;
        this.stageState.selectedItem = null;
        this.controlsLayer.innerHTML = '';
        if (mode !== 'crop') this.removeCropMarquee();
        Object.keys(this.toolBtns).forEach(k => this.toolBtns[k].classList.toggle('primary', k === mode));
        this.svgSurface.style.cursor = (mode === 'paint') ? 'crosshair' : (mode === 'balloon' ? 'text' : (mode === 'select' ? 'default' : 'crosshair'));
        this.brushControlsRibbon.style.display = (mode === 'paint') ? 'flex' : 'none';
        this.curveControlsRibbon.style.display = (mode === 'curve') ? 'flex' : 'none';
      };

      this.toolBtns.curve = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '4px 8px', fontSize: '11px' },
        title: 'Draw smooth cubic Bézier splines (point-first, releases at tail). Hold Shift to erase rewind!',
        onclick: () => setTool('curve')
      }, '〰️ Spline');

      this.toolBtns.balloon = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px' },
        onclick: () => setTool('balloon')
      }, '💬 Balloon');

      this.toolBtns.paint = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: '#f59e0b', borderColor: '#f59e0b66' },
        title: 'Blockout Paintbrush: Mask unwanted areas with solid paint before pasting into Gemini',
        onclick: () => setTool('paint')
      }, '🖌️ Blockout Paint');

      this.toolBtns.crop = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px' },
        title: 'Crop the canvas / image stage to a selected rectangle',
        onclick: () => setTool('crop')
      }, '✂️ Crop');

      this.toolBtns.select = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px' },
        title: 'Select and tweak existing curves, arrows, and differences',
        onclick: () => setTool('select')
      }, '👆 Move/Tweak');

      // Curve Debug Deck Launcher Button
      const debugDeckBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 9px', fontSize: '11px', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.45)', fontWeight: 'bold' },
        title: 'Open Curve Architecture Debug & Keyboard Deck [Hotkey: D]',
        onclick: () => this.openCurveDebugDialog()
      }, '🛠️ Curve Debug');

      // Zoom Controls Group
      const zoomGroup = makeElement('div', {
        style: { display: 'inline-flex', alignItems: 'center', gap: '3px', border: '1px solid #334155', borderRadius: '6px', padding: '1px 4px', background: '#0b1120' }
      });

      const zoomOutBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 6px', fontSize: '11px', border: 'none' },
        title: 'Zoom Out (Ctrl + Scroll Down)',
        onclick: () => this.setZoom(this.stageState.zoom - 0.15)
      }, '🔍 -');

      this.zoomLabelBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 6px', fontSize: '10.5px', border: 'none', minWidth: '44px', textAlign: 'center', color: '#00f2fe' },
        title: 'Click to reset zoom to 100%',
        onclick: () => this.setZoom(1.0)
      }, '100%');

      const zoomInBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 6px', fontSize: '11px', border: 'none' },
        title: 'Zoom In (Ctrl + Scroll Up)',
        onclick: () => this.setZoom(this.stageState.zoom + 0.15)
      }, '🔍 +');

      const fitBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 6px', fontSize: '10.5px', border: 'none', color: '#94a3b8' },
        title: 'Fit Canvas to Viewport',
        onclick: () => this.fitToViewport()
      }, 'Fit');

      zoomGroup.append(zoomOutBtn, this.zoomLabelBtn, zoomInBtn, fitBtn);

      const autoBoundsBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px' },
        title: 'Reset canvas bounds to automatically fit scene plates and difference lenses',
        onclick: () => {
          this.stageState.manualSizing = false;
          this.renderStage();
        }
      }, '📐 Auto Bounds');

      const bgBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px' },
        title: 'Toggle canvas backdrop: Dark Matte (#090d16) or 100% Transparent Alpha',
        onclick: () => {
          this.stageState.canvasBgMode = this.stageState.canvasBgMode === 'matte' ? 'transparent' : 'matte';
          bgBtn.textContent = `🔲 Bg: ${this.stageState.canvasBgMode.toUpperCase()}`;
          this.renderStage();
        }
      }, '🔲 Bg: MATTE');

      const undoBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: '#f59e0b', marginLeft: 'auto' },
        title: 'Undo last stroke or annotation (Ctrl+Z)',
        onclick: () => this.undoLastAnnotation()
      }, '↺ Undo');

      const clearBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: '#ff7b72' },
        onclick: () => {
          this.stageState.annotations.length = 0;
          this.paintLayer.innerHTML = '';
          this.shadowLayer.innerHTML = '';
          this.strokeLayer.innerHTML = '';
          this.textBadgesLayer.innerHTML = '';
          this.controlsLayer.innerHTML = '';
          this.balloonsLayer.innerHTML = '';
        }
      }, '🗑️ Clear');

      ribbon.append(
        this.toolBtns.curve, this.toolBtns.balloon,
        this.toolBtns.paint, this.toolBtns.crop, this.toolBtns.select,
        debugDeckBtn, zoomGroup, autoBoundsBtn, bgBtn, undoBtn, clearBtn
      );
      wrap.appendChild(ribbon);

      // 3. Curve & Spline Sub-Ribbon
      this.curveControlsRibbon = makeElement('div', {
        style: {
          padding: '6px 14px',
          background: 'rgba(15, 23, 42, 0.92)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          fontSize: '11px',
          color: '#94a3b8'
        }
      });

      const tetherBtn = makeElement('button', {
        className: `dr-nav-btn ${this.stageState.tetherActive ? 'primary' : ''}`,
        style: { padding: '3px 8px', fontSize: '11px', color: this.stageState.tetherActive ? '#070a13' : '#f59e0b', fontWeight: 'bold' },
        title: 'Kinetic String-Tether (Virtual Drag-Lead). Stabilizes mouse motion. Default: ON',
        onclick: () => {
          this.stageState.tetherActive = !this.stageState.tetherActive;
          tetherBtn.classList.toggle('primary', this.stageState.tetherActive);
          tetherBtn.style.color = this.stageState.tetherActive ? '#070a13' : '#f59e0b';
          tetherBtn.textContent = this.stageState.tetherActive ? '🪢 Tether: ON' : '🪢 Tether: OFF';
        }
      }, this.stageState.tetherActive ? '🪢 Tether: ON' : '🪢 Tether: OFF');

      const arrowBtn = makeElement('button', {
        className: `dr-nav-btn ${this.stageState.hasArrow ? 'primary' : ''}`,
        style: { padding: '3px 8px', fontSize: '11px', color: this.stageState.hasArrow ? '#070a13' : '#94a3b8' },
        title: 'Toggle arrowhead: Turn OFF for pure plain curves without arrow or text',
        onclick: () => {
          this.stageState.hasArrow = !this.stageState.hasArrow;
          arrowBtn.classList.toggle('primary', this.stageState.hasArrow);
          arrowBtn.style.color = this.stageState.hasArrow ? '#070a13' : '#94a3b8';
          arrowBtn.textContent = this.stageState.hasArrow ? '🏹 Arrow: ON' : '🏹 Arrow: OFF (Plain Curve)';
        }
      }, this.stageState.hasArrow ? '🏹 Arrow: ON' : '🏹 Arrow: OFF (Plain Curve)');

      const borderBtn = makeElement('button', {
        className: `dr-nav-btn ${this.stageState.hasBorder ? 'primary' : ''}`,
        style: { padding: '3px 8px', fontSize: '11px', color: this.stageState.hasBorder ? '#070a13' : '#94a3b8' },
        title: 'Toggle text boundary box (thickness matches the curve Bézier stroke)',
        onclick: () => {
          this.stageState.hasBorder = !this.stageState.hasBorder;
          borderBtn.classList.toggle('primary', this.stageState.hasBorder);
          borderBtn.style.color = this.stageState.hasBorder ? '#070a13' : '#94a3b8';
          borderBtn.textContent = this.stageState.hasBorder ? '◻ Box: ON' : '◻ Box: OFF';
          this.renderStage();
        }
      }, this.stageState.hasBorder ? '◻ Box: ON' : '◻ Box: OFF');

      const colors = ['#00e676', '#00f2fe', '#ffd700', '#ff2d55', '#ff8000', '#c084fc', '#ffffff'];
      const swatches = makeElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } });
      colors.forEach(col => {
        const b = makeElement('button', {
          style: {
            width: '14px', height: '14px', borderRadius: '50%', background: col,
            border: this.stageState.currentColor === col ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer', padding: 0
          },
          onclick: () => {
            this.stageState.currentColor = col;
            swatches.querySelectorAll('button').forEach(btn => btn.style.border = '1px solid rgba(255,255,255,0.3)');
            b.style.border = '2px solid #fff';
          }
        });
        swatches.appendChild(b);
      });

      const openColorPickerBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '3px 7px', fontSize: '10.5px', color: '#00f2fe' },
        title: 'Open Advanced Color Picker',
        onclick: (e) => this.launchColorPicker('curve', e.currentTarget)
      }, '🎨 Pick...');

      this.curveControlsRibbon.append(
        tetherBtn, arrowBtn, borderBtn, swatches, openColorPickerBtn
      );
      wrap.appendChild(this.curveControlsRibbon);

      // 4. Brush Controls Ribbon
      this.brushControlsRibbon = makeElement('div', {
        style: {
          padding: '6px 14px',
          background: 'rgba(24, 15, 30, 0.94)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'none',
          alignItems: 'center',
          gap: '10px',
          fontSize: '11px',
          color: '#f8fafc',
          flexWrap: 'wrap'
        }
      });

      const brushModeBtns = {};
      const setBrushMode = (m) => {
        this.stageState.brushMode = m;
        Object.keys(brushModeBtns).forEach(k => brushModeBtns[k].classList.toggle('primary', k === m));
      };

      brushModeBtns.freehand = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '2px 7px', fontSize: '10.5px' },
        title: 'Freehand Paint: Solid opaque brush strokes',
        onclick: () => setBrushMode('freehand')
      }, '🖌️ Paint');

      brushModeBtns.rect = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 7px', fontSize: '10.5px' },
        title: 'Drag to mask a clean solid or soft rectangle over watermarks/logos',
        onclick: () => setBrushMode('rect')
      }, '⬛ Box Rect');

      brushModeBtns.oval = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 7px', fontSize: '10.5px' },
        title: 'Drag to mask an oval over unwanted areas',
        onclick: () => setBrushMode('oval')
      }, '🔘 Oval');

      const brushSizeLabel = makeElement('span', {}, `Size: ${this.stageState.brushSize}px`);
      const brushSizeSlider = makeElement('input', {
        type: 'range', min: '8', max: '140', value: String(this.stageState.brushSize),
        style: { width: '75px', accentColor: '#f59e0b', cursor: 'pointer' },
        oninput: (e) => {
          this.stageState.brushSize = parseInt(e.target.value, 10);
          brushSizeLabel.textContent = `Size: ${this.stageState.brushSize}px`;
        }
      });

      const softnessLabel = makeElement('span', {}, `Feather: ${this.stageState.brushSoftness}px`);
      const softnessSlider = makeElement('input', {
        type: 'range', min: '0', max: '25', value: String(this.stageState.brushSoftness),
        style: { width: '75px', accentColor: '#00f2fe', cursor: 'pointer' },
        oninput: (e) => {
          this.stageState.brushSoftness = parseInt(e.target.value, 10);
          softnessLabel.textContent = `Feather: ${this.stageState.brushSoftness}px`;
          this.updateSvgBlurFilter();
        }
      });

      const blockoutColors = ['#000000', '#ffffff', '#808080', '#e2e8f0', '#0f172a'];
      const brushSwatches = makeElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } });
      blockoutColors.forEach(col => {
        const b = makeElement('button', {
          title: `Paint Blockout: ${col}`,
          style: {
            width: '14px', height: '14px', borderRadius: '3px', background: col,
            border: this.stageState.brushColor === col ? '2px solid #00f2fe' : '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer', padding: 0
          },
          onclick: () => {
            this.stageState.brushColor = col;
            brushSwatches.querySelectorAll('button').forEach(btn => btn.style.border = '1px solid rgba(255,255,255,0.3)');
            b.style.border = '2px solid #00f2fe';
          }
        });
        brushSwatches.appendChild(b);
      });

      const openPaintColorPickerBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 7px', fontSize: '10.5px', color: '#f59e0b' },
        title: 'Open Advanced Color Picker for Paint Brush',
        onclick: (e) => this.launchColorPicker('paint', e.currentTarget)
      }, '🎨 Pick...');

      this.brushControlsRibbon.append(
        makeElement('strong', { style: { color: '#f59e0b' } }, 'Brush:'),
        brushModeBtns.freehand, brushModeBtns.rect, brushModeBtns.oval,
        brushSizeSlider, brushSizeLabel,
        softnessSlider, softnessLabel,
        makeElement('span', { style: { color: '#94a3b8', marginLeft: '4px' } }, 'Color:'),
        brushSwatches, openPaintColorPickerBtn
      );
      wrap.appendChild(this.brushControlsRibbon);

      // 5. Stage Viewport
      this.viewport = makeElement('div', {
        style: {
          position: 'relative',
          minHeight: '480px',
          maxHeight: '660px',
          overflow: 'auto',
          background: 'radial-gradient(circle at 50% 25%, #151e33 0%, #0b0f19 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '36px',
          boxSizing: 'border-box'
        }
      });

      this.zoomScaffold = makeElement('div', {
        style: {
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.08s ease-out'
        }
      });

      this.stageBox = makeElement('div', {
        id: 'quora-composite-stage',
        style: {
          position: 'relative',
          boxShadow: '0 16px 45px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          background: 'transparent',
          overflow: 'visible',
          display: 'inline-block',
          outline: '1.5px dashed rgba(0, 242, 254, 0.35)',
          outlineOffset: '0px'
        }
      });

      this.sceneCanvas = document.createElement('canvas');
      this.sceneCanvas.style.cssText = 'position: absolute; top: 0; left: 0; display: block; border-radius: 6px;';
      this.stageBox.appendChild(this.sceneCanvas);

      this.diffCanvas = document.createElement('canvas');
      this.diffCanvas.style.cssText = 'position: absolute; top: 0; left: 0; display: block; pointer-events: none;';
      this.stageBox.appendChild(this.diffCanvas);

      this.svgSurface = makeElement('svg:svg', {
        id: 'quora-vector-svg',
        style: {
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          overflow: 'visible', pointerEvents: 'auto', shapeRendering: 'geometricPrecision'
        }
      });

      this.svgDefs = makeElement('svg:defs');
      this.svgSurface.appendChild(this.svgDefs);
      this.updateSvgBlurFilter();

      this.diffSvgLayer = makeElement('svg:g', { className: 'qa-diff-tangents' });
      this.paintLayer = makeElement('svg:g', { className: 'qa-blockout-paint-layer' });
      this.shadowLayer = makeElement('svg:g', { className: 'qa-crisp-shadows' });
      this.strokeLayer = makeElement('svg:g', { className: 'qa-crisp-strokes' });
      this.textBadgesLayer = makeElement('svg:g', { className: 'qa-curve-attached-text' });
      this.controlsLayer = makeElement('svg:g', { className: 'qa-interactive-controls' });

      this.svgSurface.append(
        this.diffSvgLayer, this.paintLayer, this.shadowLayer,
        this.strokeLayer, this.textBadgesLayer, this.controlsLayer
      );
      this.stageBox.appendChild(this.svgSurface);

      this.balloonsLayer = makeElement('div', {
        className: 'qa-balloons-container',
        style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }
      });
      this.stageBox.appendChild(this.balloonsLayer);

      this.setupEdgePullHandles();

      this.zoomScaffold.appendChild(this.stageBox);
      this.viewport.appendChild(this.zoomScaffold);
      wrap.appendChild(this.viewport);

      this.setupInteractions();
      this.setupZoomWheel();
      this.loadDefaultDemo();

      container.appendChild(wrap);
    }
  setZoom(val) {
    this.stageState.zoom = Math.max(0.25, Math.min(3.0, Math.round(val * 100) / 100));
    this.zoomScaffold.style.transform = `scale(${this.stageState.zoom})`;
    if (this.zoomLabelBtn) {
      this.zoomLabelBtn.textContent = `${Math.round(this.stageState.zoom * 100)}%`;
    }
  }

  fitToViewport() {
    const vpW = this.viewport.clientWidth - 80;
    const vpH = this.viewport.clientHeight - 80;
    const stageW = this.stageState.canvasWidth || 680;
    const stageH = this.stageState.canvasHeight || 340;

    const scale = Math.min(vpW / stageW, vpH / stageH);
    this.setZoom(Math.min(1.5, Math.max(0.35, scale)));
  }

  setupZoomWheel() {
      // Smooth cursor-anchored zoom (anchors world point directly under mouse)
      this.viewport.addEventListener('wheel', (e) => {
        // If hovering over a knot or input, let the specific element handle it
        if (e.target.closest('.qa-on-curve-knot-handle, input, textarea, select')) return;

        e.preventDefault();
        const rect = this.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Mouse position in current canvas coordinate space
        const curZoom = this.stageState.zoom;
        const curPanX = this.stageState.panX;
        const curPanY = this.stageState.panY;

        const worldX = (mouseX - curPanX) / curZoom;
        const worldY = (mouseY - curPanY) / curZoom;

        const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
        const nextZoom = Math.max(
          this.stageState.minZoom,
          Math.min(this.stageState.maxZoom, curZoom * zoomFactor)
        );

        // Re-anchor pan so world point under cursor remains exactly under cursor
        this.stageState.panX = mouseX - worldX * nextZoom;
        this.stageState.panY = mouseY - worldY * nextZoom;
        this.stageState.zoom = nextZoom;

        this.applyViewportTransform();
        if (this.zoomLabelBtn) {
          this.zoomLabelBtn.textContent = `${Math.round(nextZoom * 100)}%`;
        }
        if (this._devDeckDialog) this.updateDevDeckUI();
      }, { passive: false });

      // Middle-click or Alt+Drag pan support
      let isPanning = false;
      let panStart = [0, 0];
      let startPanCoords = [0, 0];

      this.viewport.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && (e.altKey || this.stageState.activeTool === 'pan'))) {
          isPanning = true;
          panStart = [e.clientX, e.clientY];
          startPanCoords = [this.stageState.panX, this.stageState.panY];
          this.viewport.style.cursor = 'grab';
          e.preventDefault();
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        const dx = e.clientX - panStart[0];
        const dy = e.clientY - panStart[1];
        this.stageState.panX = startPanCoords[0] + dx;
        this.stageState.panY = startPanCoords[1] + dy;
        this.applyViewportTransform();
      });

      window.addEventListener('mouseup', (e) => {
        if (isPanning) {
          isPanning = false;
          this.viewport.style.cursor = '';
        }
      });
    }
  setupEdgePullHandles() {
    // 1. Right Edge Bar
    const rightBar = makeElement('div', {
      className: 'qa-edge-handle qa-edge-right',
      title: 'Drag to expand canvas width',
      style: {
        position: 'absolute', top: '10%', right: '-8px', width: '12px', height: '80%',
        cursor: 'ew-resize', zIndex: '40', background: 'transparent'
      }
    });

    // 2. Bottom Edge Bar
    const bottomBar = makeElement('div', {
      className: 'qa-edge-handle qa-edge-bottom',
      title: 'Drag to expand canvas height',
      style: {
        position: 'absolute', bottom: '-8px', left: '10%', width: '80%', height: '12px',
        cursor: 'ns-resize', zIndex: '40', background: 'transparent'
      }
    });

    // 3. Bottom-Right Corner Grip
    const cornerGrip = makeElement('div', {
      className: 'qa-edge-handle qa-edge-corner',
      title: 'Drag to expand canvas both width and height',
      style: {
        position: 'absolute', bottom: '-6px', right: '-6px', width: '14px', height: '14px',
        cursor: 'nwse-resize', zIndex: '45', background: '#00f2fe', borderRadius: '3px',
        boxShadow: '0 0 8px rgba(0, 242, 254, 0.6)'
      }
    });

    const initDrag = (e, axis) => {
      e.stopPropagation();
      e.preventDefault();
      this.stageState.manualSizing = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = this.stageState.canvasWidth;
      const startH = this.stageState.canvasHeight;
      const z = this.stageState.zoom || 1.0;

      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / z;
        const dy = (ev.clientY - startY) / z;
        if (axis === 'x' || axis === 'both') {
          this.stageState.canvasWidth = Math.max(300, Math.round(startW + dx));
        }
        if (axis === 'y' || axis === 'both') {
          this.stageState.canvasHeight = Math.max(200, Math.round(startH + dy));
        }
        this.renderStage();
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    rightBar.onmousedown = (e) => initDrag(e, 'x');
    bottomBar.onmousedown = (e) => initDrag(e, 'y');
    cornerGrip.onmousedown = (e) => initDrag(e, 'both');

    this.stageBox.append(rightBar, bottomBar, cornerGrip);
  }

  launchColorPicker(targetMode = 'curve', triggerBtn = null) {
      const curColor = (targetMode === 'paint') ? this.stageState.brushColor : this.stageState.currentColor;

      if (typeof ColorPicker === 'undefined') {
        console.error('[QuoraToys] Library/ColorPicker.js is required but not loaded in global scope.');
        return;
      }

      if (!this._colorPickerInstance) {
        this._colorPickerInstance = new ColorPicker();
      }
      const picker = this._colorPickerInstance;

      const onColorChosen = (newCol) => {
        if (targetMode === 'paint') {
          this.stageState.brushColor = newCol;
        } else {
          this.stageState.currentColor = newCol;
          if (this.stageState.selectedCurve) {
            this.stageState.selectedCurve.color = newCol;
          }
        }
        this.renderStage();
      };

      if (triggerBtn) {
        picker.openSmartPicker(triggerBtn, curColor, onColorChosen);
      }
    }
  updateSvgBlurFilter() {
    let filter = this.svgDefs.querySelector('#qa-brush-blur');
    if (!filter) {
      filter = makeElement('svg:filter', { id: 'qa-brush-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' });
      this.svgDefs.appendChild(filter);
    }
    filter.innerHTML = `<feGaussianBlur stdDeviation="${this.stageState.brushSoftness}" />`;
  }

  loadDefaultDemo() {
    const c = document.createElement('canvas');
    c.width = 680;
    c.height = 340;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 680, 340);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 680, 340);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Universal Graphic Studio & Solution Compositor', 30, 50);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText('• 🖌️ Mask Brush: Freehand, Box Rect, or Oval blockout for Gemini AI inpainting', 30, 85);
    ctx.fillText('• 〰️ Cubic Spline: Draw curves with auto arrowheads & attached text labels', 30, 110);
    ctx.fillText('• ⭕ Contiguous Erase Circle: Backtrack mouse into circle to cleanly rewind vertices', 30, 135);
    ctx.fillText('• 📐 Edge Pulling: Grab right/bottom edge to expand canvas frame without clipping', 30, 160);

    const img = new Image();
    img.onload = () => {
      this.stageState.baseImage = img;
      this.stageState.cropRect = { x: 0, y: 0, width: 680, height: 340 };
      this.stageState.baseOrigin = { x: 0, y: 0 };
      this.renderStage();
    };
    img.src = c.toDataURL('image/png');
  }

  importDataset(data) {
    if (!data || !data.sourceImage) return;

    this.stageState.baseImage = data.sourceImage;
    this.stageState.cropRect = data.activeCrop || { x: 0, y: 0, width: data.sourceImage.naturalWidth, height: data.sourceImage.naturalHeight };
    this.stageState.baseOrigin = data.baseOrigin || { x: 0, y: 0 };

    const w = this.stageState.cropRect.width;
    const h = this.stageState.cropRect.height;

    // Layer B (New Image / Crop Overlay)
    this.cropCanvas = document.createElement('canvas');
    this.cropCanvas.width = w;
    this.cropCanvas.height = h;
    this.cropCanvas.getContext('2d').drawImage(
      this.stageState.baseImage,
      this.stageState.cropRect.x, this.stageState.cropRect.y, w, h, 0, 0, w, h
    );

    // Layer A (Old Image / Base)
    this.baseCropCanvas = document.createElement('canvas');
    this.baseCropCanvas.width = w;
    this.baseCropCanvas.height = h;
    this.baseCropCanvas.getContext('2d').drawImage(
      this.stageState.baseImage,
      this.stageState.baseOrigin.x, this.stageState.baseOrigin.y, w, h, 0, 0, w, h
    );

    this.stageState.diffCallouts = (data.diffCircles || []).map((diff, i) => {
      return {
        id: diff.id || 'diff_' + Date.now() + '_' + i,
        index: i + 1,
        cropX: diff.cropX,
        cropY: diff.cropY,
        radius: diff.radius || 24,
        dragX: (typeof diff.dragX === 'number' && Math.hypot(diff.dragX - diff.cropX, diff.dragY - diff.cropY) > 5)
          ? diff.dragX
          : diff.cropX + (diff.radius * 2.2),
        dragY: (typeof diff.dragY === 'number' && Math.hypot(diff.dragX - diff.cropX, diff.dragY - diff.cropY) > 5)
          ? diff.dragY
          : diff.cropY,
        color: diff.color || '#00e676'
      };
    });

    const pill = document.getElementById('qa-status-pill');
    if (pill) {
      pill.textContent = `Comparison Loaded (${this.stageState.diffCallouts.length} Lenses)`;
      pill.style.background = 'rgba(0, 230, 118, 0.2)';
      pill.style.color = '#00e676';
    }

    this.stageState.manualSizing = false;
    this.renderStage();
  }

  // Pure Framing & Auto-Bounds Engine: Brush strokes do NOT expand bounds!
  computeAutoBounds() {
    const crop = this.stageState.cropRect || { width: 680, height: 340 };
    const pad = this.stageState.padding;

    // If user has manually resized canvas, preserve manual dimensions
    if (this.stageState.manualSizing) {
      return {
        totalW: this.stageState.canvasWidth,
        totalH: this.stageState.canvasHeight,
        offsetX: pad,
        offsetY: pad,
        cropW: crop.width,
        cropH: crop.height
      };
    }

    let minX = 0, minY = 0, maxX = crop.width, maxY = crop.height;

    // Only First-Class Difference Callouts expand auto bounds
    this.stageState.diffCallouts.forEach(diff => {
      const r = diff.radius;
      let cosA = 0, sinA = 1;

      if (this.stageState.lensAlignment === 'horizontal') {
        cosA = 1; sinA = 0;
      } else if (this.stageState.lensAlignment === 'vertical') {
        cosA = 0; sinA = 1;
      } else {
        const ang = (Math.hypot(diff.dragX - diff.cropX, diff.dragY - diff.cropY) >= 0.5)
          ? Math.atan2(diff.dragY - diff.cropY, diff.dragX - diff.cropX) + Math.PI / 2
          : 0;
        cosA = Math.cos(ang);
        sinA = Math.sin(ang);
      }

      const c1x = diff.dragX - r * cosA;
      const c1y = diff.dragY - r * sinA;
      const c2x = diff.dragX + r * cosA;
      const c2y = diff.dragY + r * sinA;

      minX = Math.min(minX, c1x - r - 10, c2x - r - 10, diff.cropX - r - 10);
      maxX = Math.max(maxX, c1x + r + 10, c2x + r + 10, diff.cropX + r + 10);
      minY = Math.min(minY, c1y - r - 10, c2y - r - 10, diff.cropY - r - 10);
      maxY = Math.max(maxY, c1y + r + 10, c2y + r + 10, diff.cropY + r + 10);
    });

    const totalW = Math.max(480, Math.round((maxX - minX) + (pad * 2)));
    const totalH = Math.max(260, Math.round((maxY - minY) + (pad * 2)));

    this.stageState.canvasWidth = totalW;
    this.stageState.canvasHeight = totalH;

    return {
      totalW,
      totalH,
      offsetX: Math.round(-minX + pad),
      offsetY: Math.round(-minY + pad),
      cropW: crop.width,
      cropH: crop.height
    };
  }

  renderStage() {
      const tf = this.computeAutoBounds();

      this.stageBox.style.width = `${tf.totalW}px`;
      this.stageBox.style.height = `${tf.totalH}px`;

      // 1. Background Scene Canvas + Placed Images
      this.sceneCanvas.width = tf.totalW;
      this.sceneCanvas.height = tf.totalH;
      const sCtx = this.sceneCanvas.getContext('2d');
      sCtx.clearRect(0, 0, tf.totalW, tf.totalH);

      if (this.stageState.canvasBgMode === 'matte') {
        sCtx.fillStyle = this.stageState.canvasBgColor || '#090d16';
        sCtx.fillRect(0, 0, tf.totalW, tf.totalH);
      }

      if (this.cropCanvas) {
        sCtx.save();
        sCtx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        sCtx.shadowBlur = 18;
        sCtx.fillRect(tf.offsetX, tf.offsetY, tf.cropW, tf.cropH);
        sCtx.restore();

        sCtx.save();
        sCtx.beginPath();
        sCtx.rect(tf.offsetX, tf.offsetY, tf.cropW, tf.cropH);
        sCtx.clip();
        sCtx.filter = 'blur(3px)';
        sCtx.drawImage(this.cropCanvas, tf.offsetX, tf.offsetY);
        sCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        sCtx.fillRect(tf.offsetX, tf.offsetY, tf.cropW, tf.cropH);
        sCtx.restore();

        sCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        sCtx.lineWidth = 1.5;
        sCtx.strokeRect(tf.offsetX, tf.offsetY, tf.cropW, tf.cropH);
      } else if (this.stageState.baseImage) {
        sCtx.drawImage(this.stageState.baseImage, tf.offsetX, tf.offsetY, tf.cropW, tf.cropH);
      }

      // Render any additional dragged/dropped images
      this.renderPlacedImages(sCtx);

      // 2. Difference Lenses
      this.diffCanvas.width = tf.totalW;
      this.diffCanvas.height = tf.totalH;
      const dCtx = this.diffCanvas.getContext('2d');
      dCtx.clearRect(0, 0, tf.totalW, tf.totalH);
      this.diffSvgLayer.innerHTML = '';

      if (this.cropCanvas && this.baseCropCanvas) {
        this.stageState.diffCallouts.forEach(diff => {
          const origX = diff.cropX + tf.offsetX;
          const origY = diff.cropY + tf.offsetY;
          const dragX = diff.dragX + tf.offsetX;
          const dragY = diff.dragY + tf.offsetY;
          const r = diff.radius;
          const col = diff.color || '#00e676';

          let cosA = 0, sinA = 1;
          if (this.stageState.lensAlignment === 'horizontal') {
            cosA = 1; sinA = 0;
          } else if (this.stageState.lensAlignment === 'vertical') {
            cosA = 0; sinA = 1;
          } else {
            const ang = (Math.hypot(diff.dragX - diff.cropX, diff.dragY - diff.cropY) >= 0.5)
              ? Math.atan2(diff.dragY - diff.cropY, diff.dragX - diff.cropX) + Math.PI / 2
              : 0;
            cosA = Math.cos(ang);
            sinA = Math.sin(ang);
          }

          const c1x = dragX - r * cosA;
          const c1y = dragY - r * sinA;
          const c2x = dragX + r * cosA;
          const c2y = dragY + r * sinA;

          dCtx.save();
          dCtx.beginPath();
          dCtx.arc(origX, origY, r, 0, Math.PI * 2);
          dCtx.clip();
          dCtx.drawImage(this.cropCanvas, origX - diff.cropX, origY - diff.cropY);
          dCtx.globalAlpha = 0.5;
          dCtx.drawImage(this.baseCropCanvas, origX - diff.cropX, origY - diff.cropY);
          dCtx.restore();

          const tangentLine = makeElement('svg:line', {
            x1: origX, y1: origY, x2: dragX, y2: dragY,
            stroke: col, 'stroke-width': '2', 'stroke-dasharray': '4,4'
          });
          const anchorCirc = makeElement('svg:circle', {
            cx: origX, cy: origY, r: r,
            fill: 'none', stroke: col, 'stroke-width': '2', 'stroke-dasharray': '3,3'
          });
          this.diffSvgLayer.append(tangentLine, anchorCirc);

          dCtx.save();
          dCtx.beginPath();
          dCtx.arc(c1x, c1y, r, 0, Math.PI * 2);
          dCtx.clip();
          dCtx.drawImage(this.cropCanvas, c1x - diff.cropX, c1y - diff.cropY);
          dCtx.restore();

          dCtx.save();
          dCtx.beginPath();
          dCtx.arc(c2x, c2y, r, 0, Math.PI * 2);
          dCtx.clip();
          dCtx.drawImage(this.baseCropCanvas, c2x - diff.cropX, c2y - diff.cropY);
          dCtx.restore();

          const sL1 = makeElement('svg:circle', { cx: c1x + 2, cy: c1y + 2, r, fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5.5' });
          const cL1 = makeElement('svg:circle', { cx: c1x, cy: c1y, r, fill: 'none', stroke: col, 'stroke-width': '3.2' });
          const sL2 = makeElement('svg:circle', { cx: c2x + 2, cy: c2y + 2, r, fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5.5' });
          const cL2 = makeElement('svg:circle', { cx: c2x, cy: c2y, r, fill: 'none', stroke: col, 'stroke-width': '3.2' });

          const badge = makeElement('svg:text', {
            x: c1x - r + 4, y: c1y - r - 4,
            fill: col, 'font-family': 'monospace', 'font-size': '11', 'font-weight': 'bold'
          }, `#${diff.index}`);

          this.diffSvgLayer.append(sL1, cL1, sL2, cL2, badge);
        });
      }

      // 3. Text & Box Rendering
      this.textBadgesLayer.innerHTML = '';
      const oldTextShadows = this.shadowLayer.querySelectorAll('.qa-attached-text-shadow');
      oldTextShadows.forEach(el => el.remove());

      const shadowOffset = 2.0;
      const shadowColor = 'rgba(10, 15, 25, 0.95)';

      this.stageState.annotations.forEach(ann => {
        if (ann.type === 'curve' && ann.text && ann.beziers && ann.beziers.length > 0) {
          const lastSeg = ann.beziers[ann.beziers.length - 1];
          const tailPt = lastSeg[3];
          const tipPt = ann.beziers[0][0];

          const exitDx = tailPt[0] - lastSeg[2][0];
          const isLeft = (ann.justifySide === 'left') || (exitDx >= 0);
          const textAnchor = isLeft ? 'start' : 'end';

          const fontF = ann.fontFamily || this.stageState.fontFamily || "'Architects Daughter', cursive, sans-serif";
          const fontS = ann.fontSize || this.stageState.fontSize || 22;
          const strokeW = ann.strokeWidth || this.stageState.curveStrokeWidth || 3.2;

          this.ensureFontLoaded(fontF);

          const lines = String(ann.text).split('\n');
          const lineHeight = fontS * 1.25;

          const charW = fontS * (fontF.includes('mono') ? 0.62 : 0.58);
          let maxLineChars = 0;
          lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });

          const paddingX = ann.hasTextBox ? 10 : 2;
          const paddingY = ann.hasTextBox ? 6 : 2;
          const txtWidth = Math.round(maxLineChars * charW);
          const boxWidth = txtWidth + paddingX * 2;
          const boxHeight = Math.round(lines.length * lineHeight + paddingY * 2);

          const boxX = isLeft ? tailPt[0] : tailPt[0] - boxWidth;
          const boxY = Math.round(tailPt[1] - boxHeight / 2);
          const textX = isLeft ? boxX + paddingX : boxX + boxWidth - paddingX;
          const textStartY = Math.round(boxY + paddingY + fontS * 0.9);

          const labelGroup = makeElement('svg:g', {
            className: 'qa-movable-label-group',
            style: { cursor: 'move', userSelect: 'none' }
          });

          let draggingLabel = false;
          let startM = [0, 0];
          let initialTail = [tailPt[0], tailPt[1]];

          labelGroup.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            draggingLabel = true;
            startM = [e.clientX, e.clientY];
            if (ann.vertices && ann.vertices.length > 0) {
              const vTail = ann.vertices[ann.vertices.length - 1];
              initialTail = [vTail.point[0], vTail.point[1]];
            } else {
              initialTail = [tailPt[0], tailPt[1]];
            }
          });

          const onLabelMove = (e) => {
            if (!draggingLabel) return;
            const z = this.stageState.zoom;
            const dx = (e.clientX - startM[0]) / z;
            const dy = (e.clientY - startM[1]) / z;

            if (ann.vertices && ann.vertices.length > 0) {
              const vTail = ann.vertices[ann.vertices.length - 1];
              vTail.point[0] = initialTail[0] + dx;
              vTail.point[1] = initialTail[1] + dy;
              ann.beziers = this.verticesToBeziers(ann.vertices);

              let d = 'M ' + ann.beziers[0][0].join(' ');
              for (let i = 0; i < ann.beziers.length; i++) {
                const [start, cp1, cp2, end] = ann.beziers[i];
                d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
              }
              if (ann.elements[0]) ann.elements[0].setAttribute('d', d);
              if (ann.elements[1]) ann.elements[1].setAttribute('d', d);
            }

            this.renderStage();
          };

          const onLabelUp = () => { draggingLabel = false; };
          window.addEventListener('mousemove', onLabelMove);
          window.addEventListener('mouseup', onLabelUp);

          if (ann.hasTextBox) {
            const boxShadow = makeElement('svg:rect', {
              className: 'qa-attached-text-shadow',
              x: boxX + shadowOffset,
              y: boxY + shadowOffset,
              width: boxWidth,
              height: boxHeight,
              rx: '6',
              fill: shadowColor,
              stroke: shadowColor,
              'stroke-width': String(strokeW + 2.3),
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round'
            });
            this.shadowLayer.appendChild(boxShadow);

            const boxRect = makeElement('svg:rect', {
              x: boxX,
              y: boxY,
              width: boxWidth,
              height: boxHeight,
              rx: '6',
              fill: 'rgba(15, 23, 42, 0.96)',
              stroke: ann.color,
              'stroke-width': String(strokeW),
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round'
            });
            labelGroup.appendChild(boxRect);
          }

          const textShadow = makeElement('svg:text', {
            className: 'qa-attached-text-shadow',
            x: textX + shadowOffset,
            y: textStartY + shadowOffset,
            'text-anchor': textAnchor,
            fill: shadowColor,
            stroke: shadowColor,
            'stroke-width': '2.5',
            'stroke-linejoin': 'round',
            'font-family': fontF,
            'font-size': `${fontS}px`,
            'font-weight': 'bold',
            style: { userSelect: 'none' }
          });

          lines.forEach((line, i) => {
            const tspan = makeElement('svg:tspan', {
              x: textX + shadowOffset,
              dy: i === 0 ? '0' : `${lineHeight}px`
            }, line);
            textShadow.appendChild(tspan);
          });
          this.shadowLayer.appendChild(textShadow);

          const fgText = makeElement('svg:text', {
            x: textX,
            y: textStartY,
            'text-anchor': textAnchor,
            fill: ann.color,
            'font-family': fontF,
            'font-size': `${fontS}px`,
            'font-weight': 'bold',
            style: { userSelect: 'none' },
            ondblclick: (e) => {
              e.stopPropagation();
              this._promptInlineTailText(ann, tailPt, isLeft ? 'left' : 'right');
            }
          });

          lines.forEach((line, i) => {
            const tspan = makeElement('svg:tspan', {
              x: textX,
              dy: i === 0 ? '0' : `${lineHeight}px`
            }, line);
            fgText.appendChild(tspan);
          });

          labelGroup.appendChild(fgText);
          this.textBadgesLayer.appendChild(labelGroup);
        }
      });

      if (this.stageState.activeTool === 'select') {
        this.exposeDiffLensDragHandles(tf);
      }
    }
  exposeDiffLensDragHandles(tf) {
    this.controlsLayer.innerHTML = '';

    this.stageState.diffCallouts.forEach(diff => {
      const dragX = diff.dragX + tf.offsetX;
      const dragY = diff.dragY + tf.offsetY;

      const handle = makeElement('svg:circle', {
        cx: dragX, cy: dragY, r: '12',
        fill: 'rgba(0, 242, 254, 0.8)',
        stroke: '#ffffff', 'stroke-width': '2',
        title: `Drag Lens Pair #${diff.index}`,
        style: { cursor: 'move' }
      });

      let dragging = false;
      let startM = [0, 0];
      let startD = [diff.dragX, diff.dragY];

      handle.onmousedown = (e) => {
        dragging = true;
        startM = [e.clientX, e.clientY];
        startD = [diff.dragX, diff.dragY];
        e.stopPropagation();
      };

      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const z = this.stageState.zoom || 1.0;
        diff.dragX = startD[0] + (e.clientX - startM[0]) / z;
        diff.dragY = startD[1] + (e.clientY - startM[1]) / z;
        this.renderStage();
      });

      window.addEventListener('mouseup', () => { dragging = false; });
      this.controlsLayer.appendChild(handle);
    });
  }

  getArrowMarker(color) {
      const cleanId = 'arr_' + color.replace(/[^a-zA-Z0-9]/g, '_');
      if (!this.svgDefs.querySelector(`#${cleanId}`)) {
        // orient="auto-start-reverse" allows marker-start to point in the inward tangent direction
        const marker = makeElement('svg:marker', {
          id: cleanId, viewBox: '0 0 10 10', refX: '2', refY: '5',
          markerWidth: '6.5', markerHeight: '6.5', orient: 'auto-start-reverse'
        }, [
          makeElement('svg:path', {
            d: 'M 9 1.5 L 0 5 L 9 8.5 z', fill: color,
            stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '0.8'
          })
        ]);
        this.svgDefs.appendChild(marker);
      }
      return cleanId;
    }

  setupInteractions() {
      let isDrawing = false;
      let strokePoints = [];
      let activeTetherLine = null;
      let activeEraseCircle = null;

      const getStagePt = (e) => {
        const rect = this.stageBox.getBoundingClientRect();
        const z = this.stageState.zoom || 1.0;
        return [(e.clientX - rect.left) / z, (e.clientY - rect.top) / z];
      };

      const rewindContiguousVertices = (cursorPt, radius = 24) => {
        let poppedAny = false;
        while (strokePoints.length > 1) {
          const tip = strokePoints[strokePoints.length - 1];
          const dist = Math.hypot(tip[0] - cursorPt[0], tip[1] - cursorPt[1]);
          if (dist <= radius) {
            strokePoints.pop();
            poppedAny = true;
          } else {
            break;
          }
        }
        return poppedAny;
      };

      // Global Key Listener: Spacebar for mode toggle, 'd' for debug deck, Delete for active curve
      if (!this._hasBoundGlobalKeys) {
        this._hasBoundGlobalKeys = true;
        window.addEventListener('keydown', (e) => {
          if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

          if (e.code === 'Space') {
            e.preventDefault();
            const next = (this.stageState.activeTool === 'curve') ? 'select' : 'curve';
            this.toolBtns[next]?.click();
            this.showKnotToast(next === 'select' ? '👆 Tweak Mode Active' : '〰️ Spline Draw Active');
            return;
          }

          // 'D' hotkey launches the Curve Architecture Debug & Command Deck
          if (e.key === 'd' || e.key === 'D') {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              this.openCurveDebugDialog();
              return;
            }
          }

          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            this.undoLastAnnotation();
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.stageState.selectedItem) {
              e.preventDefault();
              const item = this.stageState.selectedItem;
              const idx = this.stageState.annotations.indexOf(item);
              if (idx !== -1) this.stageState.annotations.splice(idx, 1);
              if (item.elements) item.elements.forEach(el => el.remove());
              this.controlsLayer.innerHTML = '';
              this.stageState.selectedItem = null;
              this.renderStage();
              if (this._curveDebugDialog) this.updateCurveDebugUI();
            }
          }
        });
      }

      let brushStampCircle = null;
      const updateBrushCursor = (pt) => {
        if (this.stageState.activeTool !== 'paint') {
          if (brushStampCircle) { brushStampCircle.remove(); brushStampCircle = null; }
          return;
        }
        if (!brushStampCircle) {
          brushStampCircle = makeElement('svg:circle', {
            fill: 'none', stroke: '#00f2fe', 'stroke-width': '1.2', 'stroke-dasharray': '3,3',
            style: { pointerEvents: 'none' }
          });
          this.controlsLayer.appendChild(brushStampCircle);
        }
        brushStampCircle.setAttribute('cx', pt[0]);
        brushStampCircle.setAttribute('cy', pt[1]);
        brushStampCircle.setAttribute('r', String(this.stageState.brushSize / 2));
      };

      this.svgSurface.addEventListener('mouseenter', (e) => {
        if (this.stageState.activeTool === 'paint') updateBrushCursor(getStagePt(e));
      });

      this.svgSurface.addEventListener('mouseleave', () => {
        if (brushStampCircle) { brushStampCircle.remove(); brushStampCircle = null; }
      });

      this.svgSurface.addEventListener('mousedown', (e) => {
        if (e.target.closest('.qa-on-curve-knot-handle, #qa-tail-settings-hud, foreignObject, .qa-movable-label-group')) return;

        const pt = getStagePt(e);

        // In Move/Tweak mode, clicking near any curve immediately selects its Knots
        if (this.stageState.activeTool === 'select') {
          let bestCurve = null;
          let bestDist = 32;

          this.stageState.annotations.forEach(ann => {
            if (ann.type === 'curve' && ann.beziers) {
              ann.beziers.forEach(seg => {
                for (let t = 0; t <= 1; t += 0.15) {
                  const q = CurveFitter.bezier_q(seg, t);
                  const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]);
                  if (d < bestDist) {
                    bestDist = d;
                    bestCurve = ann;
                  }
                }
              });
            }
          });

          if (bestCurve) {
            this.exposeBezierHandles(bestCurve);
            if (this._curveDebugDialog) this.updateCurveDebugUI();
          } else {
            this.controlsLayer.innerHTML = '';
            this.stageState.selectedItem = null;
            document.querySelectorAll('.qa-crisp-strokes path').forEach(p => p.style.filter = '');
            if (this._curveDebugDialog) this.updateCurveDebugUI();
          }
          return;
        }

        this.controlsLayer.innerHTML = '';
        this.stageState.selectedItem = null;

        if (this.stageState.activeTool === 'crop') {
          this.startCropMarquee(pt);
          return;
        }

        if (this.stageState.activeTool === 'balloon') {
          this.createSpeechCallout(pt[0], pt[1]);
          return;
        }

        isDrawing = true;
        strokePoints = [pt];
      });

      window.addEventListener('mousemove', (e) => {
        const pt = getStagePt(e);
        if (this.stageState.activeTool === 'paint') updateBrushCursor(pt);

        if (!isDrawing) return;

        if (this.stageState.activeTool === 'crop') {
          this.updateCropMarquee(pt);
          return;
        }

        if (this.stageState.activeTool === 'paint') {
          if (this.stageState.brushMode === 'rect') {
            this.previewBlockoutRect(strokePoints[0], pt);
            return;
          } else if (this.stageState.brushMode === 'oval') {
            this.previewBlockoutOval(strokePoints[0], pt);
            return;
          }

          strokePoints.push(pt);
          const pathD = strokePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
          if (!this.svgSurface._paintPreview) {
            this.svgSurface._paintPreview = makeElement('svg:path', {
              stroke: this.stageState.brushColor,
              'stroke-width': String(this.stageState.brushSize),
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              fill: 'none',
              ...(this.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
            });
            this.paintLayer.appendChild(this.svgSurface._paintPreview);
          }
          this.svgSurface._paintPreview.setAttribute('d', pathD);
          return;
        }

        // Spline curve creation
        const isShiftRewinding = e.shiftKey;
        const isTethering = (this.stageState.tetherActive || e.ctrlKey || e.metaKey) && !isShiftRewinding;

        const showEraseTarget = isShiftRewinding || (strokePoints.length > 2 && Math.hypot(pt[0] - strokePoints[strokePoints.length - 1][0], pt[1] - strokePoints[strokePoints.length - 1][1]) < this.stageState.eraseRadius);

        if (showEraseTarget) {
          if (!activeEraseCircle) {
            activeEraseCircle = makeElement('svg:circle', {
              r: String(this.stageState.eraseRadius),
              fill: 'rgba(255, 45, 85, 0.16)',
              stroke: '#ff2d55',
              'stroke-width': '1.5',
              'stroke-dasharray': '3,3',
              style: { pointerEvents: 'none' }
            });
            this.controlsLayer.appendChild(activeEraseCircle);
          }
          activeEraseCircle.setAttribute('cx', pt[0]);
          activeEraseCircle.setAttribute('cy', pt[1]);

          const didRewind = rewindContiguousVertices(pt, this.stageState.eraseRadius);
          if (didRewind) {
            const updatedD = strokePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
            if (this.svgSurface._preview) this.svgSurface._preview.setAttribute('d', updatedD);
            return;
          }
        } else if (activeEraseCircle) {
          activeEraseCircle.remove();
          activeEraseCircle = null;
        }

        if (isTethering) {
          if (!activeTetherLine) {
            activeTetherLine = makeElement('svg:line', {
              stroke: '#ffffff', 'stroke-width': '1.8', 'stroke-dasharray': '3,3',
              filter: 'drop-shadow(0 0 4px #00e676)'
            });
            this.strokeLayer.appendChild(activeTetherLine);
          }
          const last = strokePoints[strokePoints.length - 1];
          activeTetherLine.setAttribute('x1', last[0]);
          activeTetherLine.setAttribute('y1', last[1]);
          activeTetherLine.setAttribute('x2', pt[0]);
          activeTetherLine.setAttribute('y2', pt[1]);

          const dist = Math.hypot(pt[0] - last[0], pt[1] - last[1]);
          if (dist > this.stageState.tetherLength) {
            const ux = (pt[0] - last[0]) / dist;
            const uy = (pt[1] - last[1]) / dist;
            const leadPt = [pt[0] - ux * this.stageState.tetherLength, pt[1] - uy * this.stageState.tetherLength];
            strokePoints.push(leadPt);
          }
        } else {
          if (activeTetherLine) {
            activeTetherLine.remove();
            activeTetherLine = null;
          }
          strokePoints.push(pt);
        }

        const pathData = strokePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
        if (!this.svgSurface._preview) {
          this.svgSurface._preview = makeElement('svg:path', {
            stroke: this.stageState.currentColor, 'stroke-width': '3.2', 'stroke-dasharray': '4,3', fill: 'none'
          });
          this.strokeLayer.appendChild(this.svgSurface._preview);
        }
        this.svgSurface._preview.setAttribute('d', pathData);
      });

      window.addEventListener('mouseup', (e) => {
        if (!isDrawing) return;
        isDrawing = false;

        if (activeTetherLine) {
          activeTetherLine.remove();
          activeTetherLine = null;
        }
        if (activeEraseCircle) {
          activeEraseCircle.remove();
          activeEraseCircle = null;
        }
        if (this.svgSurface._preview) {
          this.svgSurface._preview.remove();
          this.svgSurface._preview = null;
        }

        if (this.stageState.activeTool === 'crop') {
          this.finishCropMarquee();
          return;
        }

        if (this.stageState.activeTool === 'paint') {
          const pt = getStagePt(e);
          if (this.stageState.brushMode === 'rect') {
            this.commitBlockoutRect(strokePoints[0], pt);
          } else if (this.stageState.brushMode === 'oval') {
            this.commitBlockoutOval(strokePoints[0], pt);
          } else if (this.svgSurface._paintPreview) {
            this.stageState.annotations.push({
              type: 'paint',
              points: [...strokePoints],
              color: this.stageState.brushColor,
              width: this.stageState.brushSize,
              softness: this.stageState.brushSoftness,
              element: this.svgSurface._paintPreview
            });
            this.svgSurface._paintPreview = null;
            this.renderStage();
          }
          strokePoints = [];
          return;
        }

        if (strokePoints.length < 2) return;

        const beziers = (typeof CurveFitter !== 'undefined') ? CurveFitter.fit(strokePoints, 4) : [];
        if (beziers && beziers.length > 0) {
          this.commitSpline(beziers, this.stageState.currentColor, this.stageState.hasArrow);
          if (this._curveDebugDialog) this.updateCurveDebugUI();
        }
        strokePoints = [];
      });
    }
  // Blockout Presets
  previewBlockoutRect(p1, p2) {
    const x = Math.min(p1[0], p2[0]);
    const y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]);
    const h = Math.abs(p2[1] - p1[1]);

    if (!this.svgSurface._rectPreview) {
      this.svgSurface._rectPreview = makeElement('svg:rect', {
        fill: this.stageState.brushColor,
        opacity: '0.9',
        ...(this.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
      });
      this.paintLayer.appendChild(this.svgSurface._rectPreview);
    }
    this.svgSurface._rectPreview.setAttribute('x', x);
    this.svgSurface._rectPreview.setAttribute('y', y);
    this.svgSurface._rectPreview.setAttribute('width', w);
    this.svgSurface._rectPreview.setAttribute('height', h);
  }

  commitBlockoutRect(p1, p2) {
    if (this.svgSurface._rectPreview) {
      this.svgSurface._rectPreview.remove();
      this.svgSurface._rectPreview = null;
    }
    const x = Math.min(p1[0], p2[0]);
    const y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]);
    const h = Math.abs(p2[1] - p1[1]);
    if (w < 4 || h < 4) return;

    const rectEl = makeElement('svg:rect', {
      x, y, width: w, height: h,
      fill: this.stageState.brushColor,
      ...(this.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
    });
    this.paintLayer.appendChild(rectEl);
    this.stageState.annotations.push({ type: 'paint', shape: 'rect', element: rectEl, bounds: { x, y, w, h } });
    this.renderStage();
  }

  previewBlockoutOval(p1, p2) {
    const cx = (p1[0] + p2[0]) / 2;
    const cy = (p1[1] + p2[1]) / 2;
    const rx = Math.abs(p2[0] - p1[0]) / 2;
    const ry = Math.abs(p2[1] - p1[1]) / 2;

    if (!this.svgSurface._ovalPreview) {
      this.svgSurface._ovalPreview = makeElement('svg:ellipse', {
        fill: this.stageState.brushColor,
        opacity: '0.9',
        ...(this.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
      });
      this.paintLayer.appendChild(this.svgSurface._ovalPreview);
    }
    this.svgSurface._ovalPreview.setAttribute('cx', cx);
    this.svgSurface._ovalPreview.setAttribute('cy', cy);
    this.svgSurface._ovalPreview.setAttribute('rx', rx);
    this.svgSurface._ovalPreview.setAttribute('ry', ry);
  }

  commitBlockoutOval(p1, p2) {
    if (this.svgSurface._ovalPreview) {
      this.svgSurface._ovalPreview.remove();
      this.svgSurface._ovalPreview = null;
    }
    const cx = (p1[0] + p2[0]) / 2;
    const cy = (p1[1] + p2[1]) / 2;
    const rx = Math.abs(p2[0] - p1[0]) / 2;
    const ry = Math.abs(p2[1] - p1[1]) / 2;
    if (rx < 4 || ry < 4) return;

    const ovalEl = makeElement('svg:ellipse', {
      cx, cy, rx, ry,
      fill: this.stageState.brushColor,
      ...(this.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
    });
    this.paintLayer.appendChild(ovalEl);
    this.stageState.annotations.push({ type: 'paint', shape: 'oval', element: ovalEl, bounds: { cx, cy, rx, ry } });
    this.renderStage();
  }

  commitSpline(beziers, color, hasArrow) {
      if (!beziers || beziers.length === 0) return;

      let d = 'M ' + beziers[0][0].join(' ');
      for (let i = 0; i < beziers.length; i++) {
        const [start, cp1, cp2, end] = beziers[i];
        d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
      }

      const shadowOffset = 2.0;
      const shadowColor = 'rgba(10, 15, 25, 0.95)';

      const shadowPath = makeElement('svg:path', {
        d,
        transform: `translate(${shadowOffset}, ${shadowOffset})`,
        stroke: shadowColor,
        'stroke-width': '5.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none'
      });

      const splinePath = makeElement('svg:path', {
        d,
        stroke: color,
        'stroke-width': '3.2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
        style: { cursor: 'pointer' }
      });

      let arrowShadow = null;
      let arrowForeground = null;

      if (hasArrow) {
        const p0 = beziers[0][0];
        const p1 = beziers[0][1];
        const p2 = beziers[0][2];
        const p3 = beziers[0][3];

        let tSample = 0.25;
        let q = CurveFitter.bezier_q([p0, p1, p2, p3], tSample);
        let dist = Math.hypot(q[0] - p0[0], q[1] - p0[1]);
        if (dist < 10 && beziers.length > 1) {
          q = beziers[1][0];
          dist = Math.hypot(q[0] - p0[0], q[1] - p0[1]);
        }

        const ux = dist > 0.001 ? (q[0] - p0[0]) / dist : 1;
        const uy = dist > 0.001 ? (q[1] - p0[1]) / dist : 0;
        const nx = -uy;
        const ny = ux;

        const barbLen = 18;
        const barbSpread = 11;
        const b1 = [p0[0] + ux * barbLen + nx * barbSpread, p0[1] + uy * barbLen + ny * barbSpread];
        const b2 = [p0[0] + ux * barbLen - nx * barbSpread, p0[1] + uy * barbLen - ny * barbSpread];

        const ctrl1 = [p0[0] + ux * (barbLen * 0.45) + nx * (barbSpread * 0.15), p0[1] + uy * (barbLen * 0.45) + ny * (barbSpread * 0.15)];
        const ctrl2 = [p0[0] + ux * (barbLen * 0.45) - nx * (barbSpread * 0.15), p0[1] + uy * (barbLen * 0.45) - ny * (barbSpread * 0.15)];

        const arrowD = `M ${b1[0]} ${b1[1]} Q ${ctrl1[0]} ${ctrl1[1]} ${p0[0]} ${p0[1]} M ${p0[0]} ${p0[1]} Q ${ctrl2[0]} ${ctrl2[1]} ${b2[0]} ${b2[1]}`;

        arrowShadow = makeElement('svg:path', {
          d: arrowD,
          transform: `translate(${shadowOffset}, ${shadowOffset})`,
          stroke: shadowColor,
          'stroke-width': '5.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          fill: 'none'
        });

        arrowForeground = makeElement('svg:path', {
          d: arrowD,
          stroke: color,
          'stroke-width': '3.2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          fill: 'none'
        });
      }

      this.shadowLayer.appendChild(shadowPath);
      if (arrowShadow) this.shadowLayer.appendChild(arrowShadow);

      this.strokeLayer.appendChild(splinePath);
      if (arrowForeground) this.strokeLayer.appendChild(arrowForeground);

      const vertices = this.beziersToVertices(beziers);

      const curveRecord = {
        id: 'curve_' + Date.now(),
        type: 'curve',
        beziers,
        vertices,
        color,
        hasArrow: !!hasArrow,
        text: '', // Start clean with no forced dialog
        hasTextBox: this.stageState.hasBorder,
        fontFamily: this.stageState.fontFamily,
        fontSize: this.stageState.fontSize || 22,
        elements: [shadowPath, splinePath, ...(arrowShadow ? [arrowShadow, arrowForeground] : [])]
      };

      splinePath.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exposeBezierHandles(curveRecord);
      });

      this.stageState.annotations.push(curveRecord);

      // Mount points immediately so you can tweak them without extra clicks
      this.exposeBezierHandles(curveRecord);
    }

  exposeBezierHandles(curveRecord) {
      this.controlsLayer.innerHTML = '';
      if (!curveRecord || !curveRecord.beziers || curveRecord.beziers.length === 0) return;

      this.stageState.selectedItem = curveRecord;

      if (!curveRecord.vertices || curveRecord.vertices.length === 0) {
        curveRecord.vertices = this.beziersToVertices(curveRecord.beziers);
      }
      const vertices = curveRecord.vertices;

      const [shadowEl, splineEl] = curveRecord.elements;
      let arrowShadowEl = curveRecord.elements[2] || null;
      let arrowForegroundEl = curveRecord.elements[3] || null;

      const getStagePt = (e) => {
        const rect = this.stageBox.getBoundingClientRect();
        const z = this.stageState.zoom;
        return [(e.clientX - rect.left) / z, (e.clientY - rect.top) / z];
      };

      splineEl.style.filter = 'drop-shadow(0 0 6px #00f2fe)';

      const updateCurveGeometry = () => {
        curveRecord.beziers = this.verticesToBeziers(vertices);

        let d = 'M ' + curveRecord.beziers[0][0].join(' ');
        for (let i = 0; i < curveRecord.beziers.length; i++) {
          const [start, cp1, cp2, end] = curveRecord.beziers[i];
          d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
        }
        splineEl.setAttribute('d', d);
        shadowEl.setAttribute('d', d);

        if (curveRecord.hasArrow && arrowForegroundEl && arrowShadowEl) {
          const p0 = curveRecord.beziers[0][0];
          let q = curveRecord.beziers[0][1];
          let dist = Math.hypot(q[0] - p0[0], q[1] - p0[1]);
          if (dist < 8) {
            q = curveRecord.beziers[0][3];
            dist = Math.hypot(q[0] - p0[0], q[1] - p0[1]);
          }

          const ux = dist > 0.001 ? (q[0] - p0[0]) / dist : 1;
          const uy = dist > 0.001 ? (q[1] - p0[1]) / dist : 0;
          const nx = -uy;
          const ny = ux;

          const barbLen = 18;
          const barbSpread = 11;
          const b1 = [p0[0] + ux * barbLen + nx * barbSpread, p0[1] + uy * barbLen + ny * barbSpread];
          const b2 = [p0[0] + ux * barbLen - nx * barbSpread, p0[1] + uy * barbLen - ny * barbSpread];
          const ctrl1 = [p0[0] + ux * (barbLen * 0.45) + nx * (barbSpread * 0.15), p0[1] + uy * (barbLen * 0.45) + ny * (barbSpread * 0.15)];
          const ctrl2 = [p0[0] + ux * (barbLen * 0.45) - nx * (barbSpread * 0.15), p0[1] + uy * (barbLen * 0.45) - ny * (barbSpread * 0.15)];

          const arrowD = `M ${b1[0]} ${b1[1]} Q ${ctrl1[0]} ${ctrl1[1]} ${p0[0]} ${p0[1]} M ${p0[0]} ${p0[1]} Q ${ctrl2[0]} ${ctrl2[1]} ${b2[0]} ${b2[1]}`;
          arrowForegroundEl.setAttribute('d', arrowD);
          arrowShadowEl.setAttribute('d', arrowD);
        }

        this.renderStage();
        if (this._devDeckDialog) this.updateDevDeckUI();
      };

      // Render Knots directly on curve
      vertices.forEach((v, idx) => {
        const isTip = (idx === 0 && curveRecord.hasArrow);
        const isTail = (idx === vertices.length - 1);
        const isIntermediate = !isTip && !isTail;

        const knotCircle = makeElement('svg:circle', {
          cx: v.point[0],
          cy: v.point[1],
          r: isTip ? '7' : (isTail ? '6.5' : '5'),
          fill: isTip ? '#ffd700' : (isTail ? '#00f2fe' : '#00e676'),
          stroke: '#ffffff',
          'stroke-width': '2',
          className: 'qa-on-curve-knot-handle',
          style: {
            cursor: 'move',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))'
          }
        });

        // Mouse Wheel Real-Time Parameter Tuning
        knotCircle.addEventListener('wheel', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._activeKnotIdx = idx;

          const delta = e.deltaY > 0 ? -1 : 1;
          if (e.shiftKey) {
            v.tangentAngleOffset = (v.tangentAngleOffset || 0) + delta * 0.087;
            this.showKnotToast(`Tangent: ${Math.round(v.tangentAngleOffset * (180 / Math.PI))}°`);
          } else if (e.altKey || e.ctrlKey) {
            v.balance = Math.max(0.1, Math.min(1.9, (v.balance || 1) + delta * 0.08));
            this.showKnotToast(`Balance: ${v.balance.toFixed(2)}`);
          } else {
            v.curvature = Math.max(0.2, Math.min(3.0, (v.curvature || 1) + delta * 0.1));
            this.showKnotToast(`Curvature: ${v.curvature.toFixed(2)}`);
          }
          updateCurveGeometry();
        }, { passive: false });

        // State backup for Escape cancellation
        let dragging = false;
        let originalPt = [...v.point];
        let originalTangentOffset = v.tangentAngleOffset;
        let originalCurvature = v.curvature;
        let originalBalance = v.balance;

        knotCircle.addEventListener('mousedown', (e) => {
          if (e.button === 2) return;
          e.stopPropagation();
          this._activeKnotIdx = idx;
          dragging = true;

          originalPt = [...v.point];
          originalTangentOffset = v.tangentAngleOffset;
          originalCurvature = v.curvature;
          originalBalance = v.balance;

          // If "Free Knot on Drag" is checked, release constraints while moving
          if (this.stageState.freePointOnDrag) {
            v.tangentAngleOffset = 0;
            v.curvature = 1.0;
            v.balance = 1.0;
          }

          const onEsc = (kev) => {
            if (kev.key === 'Escape' && dragging) {
              dragging = false;
              v.point = [...originalPt];
              v.tangentAngleOffset = originalTangentOffset;
              v.curvature = originalCurvature;
              v.balance = originalBalance;
              knotCircle.setAttribute('cx', v.point[0]);
              knotCircle.setAttribute('cy', v.point[1]);
              updateCurveGeometry();
              window.removeEventListener('keydown', onEsc);
            }
          };
          window.addEventListener('keydown', onEsc);
        });

        const onDrag = (e) => {
          if (!dragging) return;
          const pt = getStagePt(e);
          v.point[0] = pt[0];
          v.point[1] = pt[1];
          knotCircle.setAttribute('cx', pt[0]);
          knotCircle.setAttribute('cy', pt[1]);
          updateCurveGeometry();
        };

        const onUp = () => { dragging = false; };
        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', onUp);

        this.controlsLayer.appendChild(knotCircle);
      });
    }
  createSpeechCallout(targetX, targetY) {
    const bubbleX = targetX + 50;
    const bubbleY = targetY - 40;
    const markerId = this.getArrowMarker(this.stageState.currentColor);

    const tailShadow = makeElement('svg:line', {
      x1: bubbleX + 1.5, y1: bubbleY + 1.5, x2: targetX + 1.5, y2: targetY + 1.5,
      stroke: 'rgba(10, 15, 25, 0.9)', 'stroke-width': '4.5', 'stroke-linecap': 'round'
    });
    const tail = makeElement('svg:line', {
      x1: bubbleX, y1: bubbleY, x2: targetX, y2: targetY,
      stroke: this.stageState.currentColor, 'stroke-width': '2.5', 'stroke-linecap': 'round',
      'marker-end': `url(#${markerId})`
    });

    this.shadowLayer.appendChild(tailShadow);
    this.strokeLayer.appendChild(tail);

    const card = makeElement('div', {
      style: {
        position: 'absolute',
        left: `${bubbleX}px`,
        top: `${bubbleY - 20}px`,
        minWidth: '80px',
        maxWidth: '220px',
        background: 'rgba(15, 23, 42, 0.96)',
        border: `2px solid ${this.stageState.currentColor}`,
        borderRadius: '8px',
        padding: '6px 10px',
        color: '#f8fafc',
        boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
        pointerEvents: 'auto',
        cursor: 'move',
        zIndex: '20'
      }
    });

    const text = makeElement('div', {
      contentEditable: 'true',
      style: { outline: 'none', color: '#fff', fontSize: '12px', lineHeight: '1.4' }
    }, 'Type callout...');
    card.appendChild(text);
    this.balloonsLayer.appendChild(card);

    let isDragging = false;
    let startMouse = [0, 0];
    let startPos = [0, 0];

    card.addEventListener('mousedown', (e) => {
      if (e.target === text) return;
      isDragging = true;
      startMouse = [e.clientX, e.clientY];
      startPos = [parseFloat(card.style.left), parseFloat(card.style.top)];
      e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const z = this.stageState.zoom || 1.0;
      const nx = startPos[0] + (e.clientX - startMouse[0]) / z;
      const ny = startPos[1] + (e.clientY - startMouse[1]) / z;
      card.style.left = `${nx}px`;
      card.style.top = `${ny}px`;

      tail.setAttribute('x1', nx);
      tail.setAttribute('y1', ny + 15);
      tailShadow.setAttribute('x1', nx + 1.5);
      tailShadow.setAttribute('y1', ny + 16.5);
    });

    window.addEventListener('mouseup', () => { isDragging = false; });
    this.stageState.annotations.push({ type: 'balloon', elements: [tailShadow, tail, card] });

    setTimeout(() => text.focus(), 50);
  }

  startCropMarquee(pt) {
    this.removeCropMarquee();
    this.cropStartPt = pt;
    this.cropMarquee = makeElement('div', {
      id: 'qa-crop-marquee',
      style: {
        position: 'absolute',
        left: `${pt[0]}px`,
        top: `${pt[1]}px`,
        width: '0px',
        height: '0px',
        border: '2px dashed #00f2fe',
        background: 'rgba(0, 242, 254, 0.15)',
        pointerEvents: 'none',
        zIndex: '30'
      }
    });
    this.stageBox.appendChild(this.cropMarquee);
  }

  updateCropMarquee(pt) {
    if (!this.cropMarquee || !this.cropStartPt) return;
    const x = Math.min(this.cropStartPt[0], pt[0]);
    const y = Math.min(this.cropStartPt[1], pt[1]);
    const w = Math.abs(pt[0] - this.cropStartPt[0]);
    const h = Math.abs(pt[1] - this.cropStartPt[1]);

    this.cropMarquee.style.left = `${x}px`;
    this.cropMarquee.style.top = `${y}px`;
    this.cropMarquee.style.width = `${w}px`;
    this.cropMarquee.style.height = `${h}px`;
    this.currentMarqueeRect = { x, y, width: w, height: h };
  }

  finishCropMarquee() {
    if (!this.currentMarqueeRect || this.currentMarqueeRect.width < 15 || this.currentMarqueeRect.height < 15) {
      this.removeCropMarquee();
      return;
    }

    const r = this.currentMarqueeRect;
    const confirmBtn = makeElement('button', {
      id: 'qa-crop-confirm-btn',
      className: 'dr-nav-btn primary',
      style: {
        position: 'absolute',
        left: `${r.x + r.width / 2 - 45}px`,
        top: `${r.y + r.height / 2 - 12}px`,
        zIndex: '35',
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: 'bold',
        pointerEvents: 'auto'
      },
      onclick: () => {
        this.applyStageCrop(r);
        this.removeCropMarquee();
      }
    }, '✂️ Crop Here');
    this.stageBox.appendChild(confirmBtn);
  }

  removeCropMarquee() {
    const el = document.getElementById('qa-crop-marquee');
    if (el) el.remove();
    const btn = document.getElementById('qa-crop-confirm-btn');
    if (btn) btn.remove();
    this.cropMarquee = null;
    this.currentMarqueeRect = null;
  }

  applyStageCrop(rect) {
    if (this.stageState.baseImage) {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = rect.width;
      croppedCanvas.height = rect.height;
      const ctx = croppedCanvas.getContext('2d');
      ctx.drawImage(this.sceneCanvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

      const newImg = new Image();
      newImg.onload = () => {
        this.stageState.baseImage = newImg;
        this.stageState.cropRect = { x: 0, y: 0, width: rect.width, height: rect.height };
        this.stageState.baseOrigin = { x: 0, y: 0 };
        this.cropCanvas = null;
        this.baseCropCanvas = null;
        this.stageState.diffCallouts = [];
        this.stageState.canvasWidth = rect.width;
        this.stageState.canvasHeight = rect.height;
        this.stageState.manualSizing = true;
        this.renderStage();
      };
      newImg.src = croppedCanvas.toDataURL('image/png');
    }
  }

  async captureScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      stream.getTracks().forEach(t => t.stop());

      const img = new Image();
      img.onload = () => {
        this.stageState.baseImage = img;
        this.stageState.cropRect = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
        this.stageState.baseOrigin = { x: 0, y: 0 };
        this.cropCanvas = null;
        this.baseCropCanvas = null;
        this.stageState.diffCallouts = [];
        this.renderStage();
      };
      img.src = canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('[ScreenCapture] Cancelled:', e);
    }
  }

  copyCompositeToClipboard(btn) {
    const tf = this.computeAutoBounds();
    const w = tf.totalW;
    const h = tf.totalH;
    const dpr = Math.max(2, window.devicePixelRatio || 2);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 1. Draw Scene Canvas
    ctx.drawImage(this.sceneCanvas, 0, 0, w, h);

    // 2. Draw Native Difference Lenses
    ctx.drawImage(this.diffCanvas, 0, 0, w, h);

    // 3. Draw Vector SVG (Paint Blockouts, Crisp Keylines, Splines, Attached Text Badges)
    const svgXml = new XMLSerializer().serializeToString(this.svgSurface);
    const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      // 4. Draw Speech Balloons
      document.querySelectorAll('.qa-balloons-container > div').forEach(card => {
        const r = card.getBoundingClientRect();
        const stageR = this.stageBox.getBoundingClientRect();
        const z = this.stageState.zoom || 1.0;
        const relX = (r.left - stageR.left) / z;
        const relY = (r.top - stageR.top) / z;

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
        ctx.strokeStyle = card.style.borderColor || '#00e676';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(relX, relY, r.width / z, r.height / z, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px system-ui, sans-serif';
        const txt = card.innerText || '';
        ctx.fillText(txt, relX + 8, relY + 18);
        ctx.restore();
      });

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]).then(() => {
          if (btn) {
            const orig = btn.textContent;
            btn.textContent = '✓ Copied Hi-Res PNG!';
            setTimeout(() => { btn.textContent = orig; }, 1800);
          }
        });
      });
    };
    img.src = url;
  }

  static launchStandalone(initialImage = null) {
      const existing = document.getElementById('quora-annotation-standalone-mount');
      if (existing) existing.remove();

      const host = document.createElement('div');
      host.id = 'quora-annotation-standalone-mount';
      host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 100000; background: #0b0f19; overflow: hidden; display: flex; flex-direction: column;';
      document.body.appendChild(host);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ Close Studio';
      closeBtn.className = 'dr-nav-btn';
      closeBtn.style.cssText = 'position: fixed; top: 10px; right: 16px; z-index: 2147483647; background: #1e293b; color: #f8fafc; border: 1.5px solid #00f2fe; padding: 5px 12px; font-family: monospace; font-size: 11px; font-weight: bold; border-radius: 6px; cursor: pointer;';
      closeBtn.onclick = () => {
        host.remove();
        closeBtn.remove();
      };
      document.body.appendChild(closeBtn);

      QuoraAnnotationComponent.render(host);

      if (initialImage && QuoraAnnotationComponent.activeInstance) {
        setTimeout(() => {
          const inst = QuoraAnnotationComponent.activeInstance;
          inst.stageState.baseImage = initialImage;
          inst.stageState.cropRect = { x: 0, y: 0, width: initialImage.naturalWidth, height: initialImage.naturalHeight };
          inst.stageState.baseOrigin = { x: 0, y: 0 };
          inst.cropCanvas = null;
          inst.baseCropCanvas = null;
          inst.stageState.diffCallouts = [];
          inst.stageState.manualSizing = false;
          inst.renderStage();
        }, 50);
      }
    }

  _promptInlineTailText(curveRecord, tailPt, justifySide) {
      const existing = document.getElementById('qa-inline-tail-editor');
      if (existing) existing.remove();

      const isLeft = (justifySide === 'left');
      const width = 200;
      const posX = isLeft ? tailPt[0] + 6 : tailPt[0] - width - 6;
      const posY = tailPt[1] - 18;

      const editorWrap = makeElement('div', {
        id: 'qa-inline-tail-editor',
        style: {
          position: 'absolute',
          top: `${posY}px`,
          left: `${posX}px`,
          width: `${width}px`,
          zIndex: '70',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }
      });

      const strokeW = curveRecord.strokeWidth || this.stageState.curveStrokeWidth || 3.2;

      const input = makeElement('input', {
        type: 'text',
        placeholder: 'Label',
        value: curveRecord.text || '',
        style: {
          flex: '1',
          padding: '5px 8px',
          fontSize: `${curveRecord.fontSize || 22}px`,
          fontFamily: curveRecord.fontFamily || this.stageState.fontFamily,
          fontWeight: 'bold',
          color: curveRecord.color,
          background: 'rgba(15, 23, 42, 0.96)',
          border: `${strokeW}px solid ${curveRecord.color}`,
          borderRadius: '6px',
          outline: 'none',
          boxSizing: 'border-box',
          textAlign: isLeft ? 'left' : 'right'
        }
      });

      const okBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', background: '#238636', borderColor: '#2ea043' },
        onclick: (e) => {
          e.stopPropagation();
          commit();
        }
      }, '✓');

      editorWrap.append(input, okBtn);
      this.stageBox.appendChild(editorWrap);

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        window.removeEventListener('mousedown', onOutClick);
        curveRecord.text = input.value.trim();
        curveRecord.justifySide = isLeft ? 'left' : 'right';
        editorWrap.remove();
        this.renderStage();
      };

      const onOutClick = (ev) => {
        if (!editorWrap.contains(ev.target)) {
          commit();
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          editorWrap.remove();
        }
      });

      setTimeout(() => {
        input.focus();
        window.addEventListener('mousedown', onOutClick);
      }, 40);
    }
  ensureFontLoaded(fontFamily) {
      if (!fontFamily) return;
      if (fontFamily.includes('Architects Daughter') && !this._loadedFonts.has('Architects Daughter')) {
        this._loadedFonts.add('Architects Daughter');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap';
        document.head.appendChild(link);
        if (document.fonts) {
          document.fonts.load('14px "Architects Daughter"').then(() => {
            this.renderStage();
          }).catch(() => {});
        }
      }
    }

  undoLastAnnotation() {
      if (this.stageState.annotations.length === 0) return;
      const item = this.stageState.annotations.pop();
      if (item.elements) {
        item.elements.forEach(el => el.remove());
      } else if (item.element) {
        item.element.remove();
      }
      const inlineEditor = document.getElementById('qa-inline-tail-editor');
      if (inlineEditor) inlineEditor.remove();
      this.controlsLayer.innerHTML = '';
      this.renderStage();
    }

  beziersToVertices(beziers) {
      if (!beziers || beziers.length === 0) return [];

      const n = beziers.length;
      const vertices = [];

      // 1. Create on-curve Knots directly at the segment endpoints
      for (let i = 0; i <= n; i++) {
        const pt = (i < n) ? beziers[i][0].slice(0, 2) : beziers[n - 1][3].slice(0, 2);
        const v = new BezierVertex(pt);
        v.tangents = [null, null];
        v.tangentAngleOffset = 0;
        v.curvature = 1.0;
        v.balance = 1.0;
        vertices.push(v);
      }

      const norm2D = (v) => {
        const m = Math.hypot(v[0], v[1]);
        return m > 1e-6 ? [v[0] / m, v[1] / m] : [1, 0];
      };

      const angleBetweenRad = (baseV, targetV) => {
        const dot = baseV[0] * targetV[0] + baseV[1] * targetV[1];
        const cross = baseV[0] * targetV[1] - baseV[1] * targetV[0];
        return Math.atan2(cross, dot);
      };

      // 2. Solve the exact angular shift (tangentAngleOffset) so curves maintain their profile
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        const prevV = vertices[i - 1];
        const nextV = vertices[i + 1];

        if (prevV && nextV) {
          // Intermediate Knot: shift relative to the neighbor-averaged baseline
          const inHandle = beziers[i - 1][2];
          const outHandle = beziers[i][1];
          const pt = v.point;

          const actualTan = norm2D([outHandle[0] - inHandle[0], outHandle[1] - inHandle[1]]);
          const toNext = norm2D([nextV.point[0] - pt[0], nextV.point[1] - pt[1]]);
          const fromPrev = norm2D([pt[0] - prevV.point[0], pt[1] - prevV.point[1]]);
          const baseTan = norm2D([toNext[0] + fromPrev[0], toNext[1] + fromPrev[1]]);

          v.tangentAngleOffset = angleBetweenRad(baseTan, actualTan);

          const dNext = Math.hypot(nextV.point[0] - pt[0], nextV.point[1] - pt[1]);
          const dPrev = Math.hypot(pt[0] - prevV.point[0], pt[1] - prevV.point[1]);
          const lOut = Math.hypot(outHandle[0] - pt[0], outHandle[1] - pt[1]);
          const lIn = Math.hypot(pt[0] - inHandle[0], pt[1] - inHandle[1]);

          const sOut = dNext > 1e-4 ? (3 * lOut) / dNext : 1;
          const sIn = dPrev > 1e-4 ? (3 * lIn) / dPrev : 1;
          const sumS = sOut + sIn;
          if (sumS > 1e-4) {
            v.curvature = Math.max(0.2, Math.min(3.0, sumS / 2));
            v.balance = Math.max(0.1, Math.min(1.9, (2 * sIn) / sumS));
          }
        } else if (nextV) {
          // Start Knot (Arrowhead tip, i = 0)
          // Baseline is the chord to next knot: (next - curr)
          const chord = norm2D([nextV.point[0] - v.point[0], nextV.point[1] - v.point[1]]);
          const outHandle = beziers[0][1];
          const actualTan = norm2D([outHandle[0] - v.point[0], outHandle[1] - v.point[1]]);

          // Shift relative to the straight chord (preserves S-curve and C-curve departure angle!)
          v.tangentAngleOffset = angleBetweenRad(chord, actualTan);

          const dist = Math.hypot(nextV.point[0] - v.point[0], nextV.point[1] - v.point[1]);
          const lOut = Math.hypot(outHandle[0] - v.point[0], outHandle[1] - v.point[1]);
          if (dist > 1e-4) {
            v.curvature = Math.max(0.2, Math.min(3.0, (3 * lOut) / dist));
          }
        } else if (prevV) {
          // End Knot (Tail, i = n)
          // Baseline is the forward departure from prev: (curr - prev)
          const chord = norm2D([v.point[0] - prevV.point[0], v.point[1] - prevV.point[1]]);
          const inHandle = beziers[n - 1][2];
          const actualTan = norm2D([v.point[0] - inHandle[0], v.point[1] - inHandle[1]]);

          // Shift relative to the chord (preserves S-curve and C-curve entry angle!)
          v.tangentAngleOffset = angleBetweenRad(chord, actualTan);

          const dist = Math.hypot(v.point[0] - prevV.point[0], v.point[1] - prevV.point[1]);
          const lIn = Math.hypot(v.point[0] - inHandle[0], v.point[1] - inHandle[1]);
          if (dist > 1e-4) {
            v.curvature = Math.max(0.2, Math.min(3.0, (3 * lIn) / dist));
          }
        }
      }

      // 3. Relax through UpdateControlPoints: the initial curve now matches the drawn gesture
      if (typeof UpdateControlPoints !== 'undefined') {
        UpdateControlPoints.run(vertices, 6);
      }

      return vertices;
    }
  verticesToBeziers(vertices) {
      if (!vertices || vertices.length < 2) return [];

      // Run the relaxation solver so control handles respond to neighbor movements
      if (typeof UpdateControlPoints !== 'undefined') {
        UpdateControlPoints.run(vertices, 8);
      }

      const beziers = [];
      for (let i = 0; i < vertices.length - 1; i++) {
        const vStart = vertices[i];
        const vEnd = vertices[i + 1];

        const p0 = [vStart.point[0], vStart.point[1]];
        const p1 = [vStart.controlPoints[1][0], vStart.controlPoints[1][1]];
        const p2 = [vEnd.controlPoints[0][0], vEnd.controlPoints[0][1]];
        const p3 = [vEnd.point[0], vEnd.point[1]];

        beziers.push([p0, p1, p2, p3]);
      }
      return beziers;
    }
  setupClipboardAndDrop(wrapEl) {
      this._onPaste = (e) => {
        if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
        if (e.clipboardData && e.clipboardData.items) {
          for (const item of e.clipboardData.items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                this.loadBlobOrFile(file);
                e.preventDefault();
                return;
              }
            }
          }
        }
      };
      window.addEventListener('paste', this._onPaste);

      const vp = this.viewport || wrapEl;
      vp.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.stageBox.style.outlineColor = '#00e676';
      });
      vp.addEventListener('dragleave', () => {
        this.stageBox.style.outlineColor = 'rgba(0, 242, 254, 0.35)';
      });
      vp.addEventListener('drop', (e) => {
        e.preventDefault();
        this.stageBox.style.outlineColor = 'rgba(0, 242, 254, 0.35)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.loadBlobOrFile(e.dataTransfer.files[0]);
        } else {
          const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL');
          if (url && (url.startsWith('http') || url.startsWith('data:image/'))) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              this.stageState.baseImage = img;
              this.stageState.cropRect = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
              this.stageState.baseOrigin = { x: 0, y: 0 };
              this.cropCanvas = null;
              this.baseCropCanvas = null;
              this.stageState.diffCallouts = [];
              this.stageState.manualSizing = false;
              this.renderStage();
            };
            img.src = url;
          }
        }
      });
    }

  loadBlobOrFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          this.stageState.baseImage = img;
          this.stageState.cropRect = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
          this.stageState.baseOrigin = { x: 0, y: 0 };
          this.cropCanvas = null;
          this.baseCropCanvas = null;
          this.stageState.diffCallouts = [];
          this.stageState.manualSizing = false;
          this.renderStage();

          const pill = document.getElementById('qa-status-pill');
          if (pill) {
            pill.textContent = `Image Loaded (${img.naturalWidth}×${img.naturalHeight})`;
            pill.style.background = 'rgba(0, 230, 118, 0.2)';
            pill.style.color = '#00e676';
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

  addPenVertex(pt) {
      if (!this._activePenVertices) this._activePenVertices = [];

      const vertex = new BezierVertex([pt[0], pt[1]]);
      vertex.curvature = 1.0;
      vertex.balance = 1.0;
      vertex.tangentAngleOffset = 0;
      this._activePenVertices.push(vertex);

      // Visual anchor marker for this point on the curve
      const marker = makeElement('svg:circle', {
        cx: pt[0], cy: pt[1], r: '5',
        fill: '#00e676', stroke: '#ffffff', 'stroke-width': '1.8',
        className: 'qa-pen-active-anchor',
        style: { pointerEvents: 'none' }
      });
      this.controlsLayer.appendChild(marker);

      const pill = document.getElementById('qa-status-pill');
      if (pill) {
        pill.textContent = `Point #${this._activePenVertices.length} placed (Enter/Dbl-click to commit)`;
        pill.style.background = 'rgba(0, 242, 254, 0.2)';
        pill.style.color = '#00f2fe';
      }
    }

  updatePenTentativePreview(mousePt) {
      if (!this._activePenVertices || this._activePenVertices.length === 0) return;

      const verticesCopy = this._activePenVertices.map(v => {
        const cp = new BezierVertex(v.point.slice());
        cp.curvature = v.curvature;
        cp.balance = v.balance;
        cp.tangentAngleOffset = v.tangentAngleOffset;
        return cp;
      });

      const tentativeVertex = new BezierVertex([mousePt[0], mousePt[1]]);
      tentativeVertex.isTentative = true;
      verticesCopy.push(tentativeVertex);

      if (typeof UpdateControlPoints !== 'undefined') {
        UpdateControlPoints.run(verticesCopy, 5);
      }

      const beziers = this.verticesToBeziers(verticesCopy);
      if (!beziers || beziers.length === 0) return;

      let d = 'M ' + beziers[0][0].join(' ');
      for (let i = 0; i < beziers.length; i++) {
        const [start, cp1, cp2, end] = beziers[i];
        d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
      }

      if (!this.svgSurface._penPreview) {
        this.svgSurface._penPreview = makeElement('svg:path', {
          stroke: this.stageState.currentColor,
          'stroke-width': String(this.stageState.curveStrokeWidth || 3.2),
          'stroke-dasharray': '5,3',
          fill: 'none',
          style: { pointerEvents: 'none' }
        });
        this.strokeLayer.appendChild(this.svgSurface._penPreview);
      }
      this.svgSurface._penPreview.setAttribute('d', d);
    }

  commitPenCurve() {
      if (!this._activePenVertices || this._activePenVertices.length < 2) {
        this.cancelPenCurve();
        return;
      }

      if (typeof UpdateControlPoints !== 'undefined') {
        UpdateControlPoints.run(this._activePenVertices, 8);
      }

      const beziers = this.verticesToBeziers(this._activePenVertices);
      const verts = this._activePenVertices;

      this.cancelPenCurve();

      if (beziers && beziers.length > 0) {
        this.commitSpline(beziers, this.stageState.currentColor, this.stageState.hasArrow);
        // Attach the solved on-curve vertices directly to the newly created record
        const lastAnn = this.stageState.annotations[this.stageState.annotations.length - 1];
        if (lastAnn && lastAnn.type === 'curve') {
          lastAnn.vertices = verts;
        }
      }
    }

  cancelPenCurve() {
      this._activePenVertices = [];
      if (this.svgSurface._penPreview) {
        this.svgSurface._penPreview.remove();
        this.svgSurface._penPreview = null;
      }
      this.controlsLayer.querySelectorAll('.qa-pen-active-anchor').forEach(el => el.remove());
      const pill = document.getElementById('qa-status-pill');
      if (pill) {
        pill.textContent = 'Ready';
        pill.style.background = 'rgba(0, 242, 254, 0.15)';
        pill.style.color = '#00f2fe';
      }
    }

  renderEphemeralKnotHandles(curveRecord) {
      if (this.stageState.selectedItem === curveRecord) return;
      if (!curveRecord.vertices || curveRecord.vertices.length === 0) {
        curveRecord.vertices = this.beziersToVertices(curveRecord.beziers);
      }

      const ephemeralGroup = makeElement('svg:g', { className: 'qa-ephemeral-knots' });
      curveRecord.vertices.forEach((v) => {
        ephemeralGroup.appendChild(makeElement('svg:circle', {
          cx: v.point[0],
          cy: v.point[1],
          r: '4',
          fill: '#00e676',
          stroke: '#ffffff',
          'stroke-width': '1.5',
          opacity: '0.8',
          style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 4px #00e676)' }
        }));
      });

      this.controlsLayer.appendChild(ephemeralGroup);
      setTimeout(() => { ephemeralGroup.remove(); }, 1800);
    }

  showKnotToast(msg) {
      let toast = document.getElementById('qa-knot-mod-toast');
      if (!toast) {
        toast = makeElement('div', {
          id: 'qa-knot-mod-toast',
          style: {
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.5px solid #00f2fe',
            color: '#00f2fe',
            padding: '4px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8), 0 0 12px rgba(0, 242, 254, 0.35)',
            pointerEvents: 'none',
            zIndex: '100',
            transition: 'opacity 0.2s ease'
          }
        });
        this.stageBox.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1600);
    }

  openCurveDebugDialog() {
      if (this._curveDebugDialog && this._curveDebugDialog.element?.isConnected) {
        this._curveDebugDialog.bringToFront();
        this.updateCurveDebugUI();
        return;
      }

      const container = makeElement('div', {
        id: 'qa-curve-debug-root',
        style: {
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: '#090d16',
          color: '#f8fafc',
          fontFamily: 'monospace',
          fontSize: '11.5px',
          boxSizing: 'border-box',
          height: '100%',
          overflowY: 'auto'
        }
      });

      const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
        ? UITools.makeDialog
        : (opts => new DialogBox(opts));

      this._curveDebugDialog = dialogMaker({
        title: '🛠️ Curve Architecture & Command Deck',
        size: [540, 620],
        position: [Math.max(20, window.innerWidth - 580), 75],
        contentElement: container,
        onClose: () => {
          this._curveDebugDialog = null;
          if (this._keyFilterListener) {
            window.removeEventListener('keydown', this._keyFilterListener, true);
            this._keyFilterListener = null;
          }
        }
      });

      this._debugKeyBuffer = '';
      this._activeKnotIndex = 0;
      this.buildCurveDebugContent(container);

      // Global Key Listener for incremental unique typing filter
      this._keyFilterListener = (e) => {
        if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
        if (!this._curveDebugDialog || !this._curveDebugDialog.element?.isConnected) return;

        const key = e.key;

        if (key === 'Escape') {
          if (this._debugKeyBuffer.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            this._debugKeyBuffer = '';
            this.updateCommandMatrixUI();
            return;
          }
        } else if (key === 'Backspace') {
          if (this._debugKeyBuffer.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            this._debugKeyBuffer = this._debugKeyBuffer.slice(0, -1);
            this.updateCommandMatrixUI();
            return;
          }
        } else if (key === 'Enter') {
          const topCmd = this._filteredCommands?.[0];
          if (topCmd) {
            e.preventDefault();
            e.stopPropagation();
            this.executeDebugCommand(topCmd);
            this._debugKeyBuffer = '';
            this.updateCommandMatrixUI();
            return;
          }
        } else if (/^[a-zA-Z0-9_\-]$/.test(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          this._debugKeyBuffer += key.toLowerCase();
          this.updateCommandMatrixUI(true);
        }
      };

      window.addEventListener('keydown', this._keyFilterListener, true);
    }

  buildCurveDebugContent(container) {
      container.innerHTML = '';

      // 1. Telemetry Status Card
      const statusCard = makeElement('div', {
        id: 'qa-debug-telemetry-card',
        style: {
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid rgba(0, 242, 254, 0.35)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
        }
      });

      const statusTitleRow = makeElement('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }
      }, [
        makeElement('strong', { style: { color: '#00f2fe', fontSize: '12px' } }, '📊 CURVE TELEMETRY & KNOT INSPECTOR'),
        makeElement('span', { id: 'qa-telemetry-badge', style: { color: '#10b981', fontSize: '10px', fontWeight: 'bold' } }, 'Active')
      ]);

      this._telemetryBody = makeElement('div', {
        id: 'qa-telemetry-body',
        style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px', color: '#cbd5e1' }
      });

      statusCard.append(statusTitleRow, this._telemetryBody);
      container.appendChild(statusCard);

      // 2. Interactive Knot Parameter Sliders
      const slidersCard = makeElement('div', {
        id: 'qa-debug-sliders-card',
        style: {
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }
      });

      const makeSliderRow = (label, min, max, step, getter, setter) => {
        const row = makeElement('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }
        });
        const lbl = makeElement('span', { style: { color: '#94a3b8', minWidth: '85px' } }, label);
        const valText = makeElement('span', { style: { color: '#00f2fe', fontFamily: 'monospace', minWidth: '45px', textAlign: 'right' } }, '');

        const slider = makeElement('input', {
          type: 'range', min: String(min), max: String(max), step: String(step),
          style: { flex: 1, accentColor: '#00f2fe', cursor: 'pointer' },
          oninput: (e) => {
            setter(parseFloat(e.target.value));
            valText.textContent = parseFloat(e.target.value).toFixed(2);
            this.commitCurveGeometryUpdate();
            this.updateCurveDebugUI();
          }
        });

        row._updateVal = () => {
          const v = getter();
          slider.value = String(v);
          valText.textContent = Number(v).toFixed(2);
        };

        row.append(lbl, slider, valText);
        return row;
      };

      const curKnot = () => this.getActiveKnot();

      this._curvSlider = makeSliderRow('Curvature (C):', 0.2, 3.0, 0.05,
        () => curKnot()?.curvature || 1.0,
        (val) => { const k = curKnot(); if (k) k.curvature = val; }
      );

      this._balSlider = makeSliderRow('Balance (B):', 0.1, 1.9, 0.05,
        () => curKnot()?.balance || 1.0,
        (val) => { const k = curKnot(); if (k) k.balance = val; }
      );

      this._tanSlider = makeSliderRow('Tangent (Deg):', -180, 180, 5,
        () => ((curKnot()?.tangentAngleOffset || 0) * (180 / Math.PI)),
        (val) => { const k = curKnot(); if (k) k.tangentAngleOffset = val * (Math.PI / 180); }
      );

      slidersCard.append(
        makeElement('strong', { style: { color: '#ffd700', fontSize: '11px' } }, '🎛️ ACTIVE KNOT LIVE TUNER'),
        this._curvSlider, this._balSlider, this._tanSlider
      );
      container.appendChild(slidersCard);

      // 3. Mnemonic Command Matrix with Prefix/Fuzzy Filter
      const matrixCard = makeElement('div', {
        id: 'qa-command-matrix-card',
        style: {
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid #c084fc',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(192, 132, 252, 0.25)',
          flex: 1
        }
      });

      const filterHud = makeElement('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }
      }, [
        makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
          makeElement('span', { style: { fontSize: '14px' } }, '⌨️'),
          makeElement('strong', { style: { color: '#c084fc', fontSize: '11.5px' } }, 'MNEMONIC KEYSTROKE DECK:'),
          this._bufferDisplay = makeElement('span', {
            style: { background: 'rgba(0, 242, 254, 0.2)', color: '#00f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }
          }, '[Type to filter...]')
        ]),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 6px', fontSize: '10px' },
          onclick: () => {
            this._debugKeyBuffer = '';
            this.updateCommandMatrixUI();
          }
        }, 'Clear ⌫')
      ]);

      this._commandListEl = makeElement('div', {
        id: 'qa-debug-command-list',
        style: { display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 }
      });

      matrixCard.append(filterHud, this._commandListEl);
      container.appendChild(matrixCard);

      this.initCommandRegistry();
      this.updateCurveDebugUI();
    }

  initCommandRegistry() {
      this._commandRegistry = [
        {
          id: 'reset_point',
          key: 'rp',
          mnemonic: 'Reset Point Constraints',
          desc: 'Clears tangent offset, curvature=1, balance=1 on selected Knot',
          action: () => {
            const k = this.getActiveKnot();
            if (k) {
              k.tangentAngleOffset = 0;
              k.curvature = 1.0;
              k.balance = 1.0;
              k.tangents = [null, null];
              this.commitCurveGeometryUpdate();
              this.showKnotToast('✓ Reset constraints on active Knot');
            }
          }
        },
        {
          id: 'drop_all',
          key: 'dc',
          mnemonic: 'Drop All Constraints (Whole Curve)',
          desc: 'Drops all custom offsets/curvature across entire curve to default relaxation',
          action: () => {
            const curve = this.getActiveCurve();
            if (curve && curve.vertices) {
              curve.vertices.forEach(v => {
                v.tangentAngleOffset = 0;
                v.curvature = 1.0;
                v.balance = 1.0;
                v.tangents = [null, null];
              });
              this.commitCurveGeometryUpdate();
              this.showKnotToast('✓ Dropped all constraints on curve');
            }
          }
        },
        {
          id: 'toggle_cusp',
          key: 'tc',
          mnemonic: 'Toggle Cusp (Break Tangent)',
          desc: 'Breaks tangency into sharp 45° corner/cusp at active Knot',
          action: () => {
            const k = this.getActiveKnot();
            if (k) {
              k.tangentAngleOffset = (Math.abs(k.tangentAngleOffset || 0) < 0.01) ? (Math.PI / 4) : 0;
              this.commitCurveGeometryUpdate();
              this.showKnotToast(`Cusp toggled: ${Math.round(k.tangentAngleOffset * (180 / Math.PI))}°`);
            }
          }
        },
        {
          id: 'straighten',
          key: 'sc',
          mnemonic: 'Straighten Curve (Drop Intermediates)',
          desc: 'Deletes all intermediate knots, creating direct arrow',
          action: () => {
            const curve = this.getActiveCurve();
            if (curve && curve.vertices && curve.vertices.length > 2) {
              curve.vertices = [curve.vertices[0], curve.vertices[curve.vertices.length - 1]];
              this.commitCurveGeometryUpdate();
              this.exposeBezierHandles(curve);
              this.showKnotToast('✓ Straightened curve to direct line');
            }
          }
        },
        {
          id: 'cycle_balance',
          key: 'cb',
          mnemonic: 'Cycle Balance Ratio',
          desc: 'Toggles handle ratio balance (0.5 ➔ 1.5 ➔ 1.0)',
          action: () => {
            const k = this.getActiveKnot();
            if (k) {
              k.balance = (k.balance === 1.0) ? 1.5 : (k.balance === 1.5 ? 0.5 : 1.0);
              this.commitCurveGeometryUpdate();
              this.showKnotToast(`Balance set to: ${k.balance.toFixed(2)}`);
            }
          }
        },
        {
          id: 'next_knot',
          key: 'nk',
          mnemonic: 'Next Knot Select',
          desc: 'Advance selection to next knot on curve',
          action: () => {
            const curve = this.getActiveCurve();
            if (curve && curve.vertices) {
              this._activeKnotIndex = (this._activeKnotIndex + 1) % curve.vertices.length;
              this.updateCurveDebugUI();
              this.highlightActiveKnot();
            }
          }
        },
        {
          id: 'prev_knot',
          key: 'pk',
          mnemonic: 'Previous Knot Select',
          desc: 'Move selection to previous knot on curve',
          action: () => {
            const curve = this.getActiveCurve();
            if (curve && curve.vertices) {
              this._activeKnotIndex = (this._activeKnotIndex - 1 + curve.vertices.length) % curve.vertices.length;
              this.updateCurveDebugUI();
              this.highlightActiveKnot();
            }
          }
        },
        {
          id: 'delete_knot',
          key: 'dk',
          mnemonic: 'Delete Active Knot',
          desc: 'Removes the selected intermediate knot',
          action: () => {
            const curve = this.getActiveCurve();
            if (curve && curve.vertices && curve.vertices.length > 2) {
              if (this._activeKnotIndex > 0 && this._activeKnotIndex < curve.vertices.length - 1) {
                curve.vertices.splice(this._activeKnotIndex, 1);
                this._activeKnotIndex = Math.min(this._activeKnotIndex, curve.vertices.length - 1);
                this.commitCurveGeometryUpdate();
                this.exposeBezierHandles(curve);
                this.showKnotToast('✓ Removed knot');
              }
            }
          }
        },
        {
          id: 'delete_curve',
          key: 'dx',
          mnemonic: 'Delete Entire Curve',
          desc: 'Deletes the active curve and all its annotations',
          action: () => {
            const curve = this.getActiveCurve();
            if (curve) {
              const idx = this.stageState.annotations.indexOf(curve);
              if (idx !== -1) this.stageState.annotations.splice(idx, 1);
              if (curve.elements) curve.elements.forEach(el => el.remove());
              this.controlsLayer.innerHTML = '';
              this.stageState.selectedItem = null;
              this.renderStage();
              this.showKnotToast('🗑️ Curve deleted');
            }
          }
        }
      ];
    }

  updateCommandMatrixUI(autoCommitIfUnique = false) {
      if (!this._commandListEl) return;
      this._commandListEl.innerHTML = '';

      const buf = (this._debugKeyBuffer || '').toLowerCase();
      this._bufferDisplay.textContent = buf ? `"${buf}"` : '[Type to filter...]';

      // Filter registry based on keys or mnemonic match
      const matches = (this._commandRegistry || []).filter(cmd => {
        if (!buf) return true;
        const keyMatch = cmd.key.toLowerCase().startsWith(buf) || cmd.key.toLowerCase().includes(buf);
        const textMatch = cmd.mnemonic.toLowerCase().includes(buf) || cmd.id.toLowerCase().includes(buf);
        return keyMatch || textMatch;
      });

      this._filteredCommands = matches;

      // Unique match auto-execution
      if (autoCommitIfUnique && buf.length >= 2 && matches.length === 1) {
        const single = matches[0];
        this.executeDebugCommand(single);
        this._debugKeyBuffer = '';
        this.updateCommandMatrixUI();
        return;
      }

      if (matches.length === 0) {
        this._commandListEl.appendChild(makeElement('div', {
          style: { color: '#ff7b72', fontStyle: 'italic', padding: '12px', textAlign: 'center' }
        }, `No commands match "${buf}". Press Escape or Backspace to clear.`));
        return;
      }

      matches.forEach((cmd, idx) => {
        const isTop = (idx === 0);

        const card = makeElement('div', {
          style: {
            background: isTop ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.02)',
            border: isTop ? '1.5px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '6px',
            padding: '6px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.1s ease'
          },
          onclick: () => {
            this.executeDebugCommand(cmd);
            this._debugKeyBuffer = '';
            this.updateCommandMatrixUI();
          }
        });

        // Highlight matched letters in mnemonic and key
        const keySpan = makeElement('span', {
          style: {
            background: '#070a13', border: '1px solid #334155', color: '#ffd700',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px',
            padding: '2px 6px', borderRadius: '4px', minWidth: '24px', textAlign: 'center'
          }
        }, cmd.key.toUpperCase());

        const labelWrap = makeElement('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, marginLeft: '10px' } });
        const mnemonicEl = makeElement('div', { style: { fontWeight: 'bold', color: isTop ? '#00f2fe' : '#f8fafc', fontSize: '11.5px' } });
        mnemonicEl.appendChild(this._highlightLetters(cmd.mnemonic, buf));

        const descEl = makeElement('div', { style: { color: '#94a3b8', fontSize: '10px', marginTop: '2px' } }, cmd.desc);
        labelWrap.append(mnemonicEl, descEl);

        card.append(keySpan, labelWrap);
        this._commandListEl.appendChild(card);
      });
    }

  _highlightLetters(text, search) {
      if (!search) return document.createTextNode(text);
      const frag = document.createDocumentFragment();
      const str = String(text);
      const idx = str.toLowerCase().indexOf(search.toLowerCase());

      if (idx !== -1) {
        if (idx > 0) frag.appendChild(document.createTextNode(str.slice(0, idx)));
        const matchSpan = makeElement('span', {
          style: { color: '#00f2fe', background: 'rgba(0, 242, 254, 0.25)', borderRadius: '2px', padding: '0 2px' }
        }, str.slice(idx, idx + search.length));
        frag.appendChild(matchSpan);
        if (idx + search.length < str.length) {
          frag.appendChild(document.createTextNode(str.slice(idx + search.length)));
        }
      } else {
        frag.appendChild(document.createTextNode(str));
      }
      return frag;
    }

  executeDebugCommand(cmd) {
      if (!cmd || typeof cmd.action !== 'function') return;
      try {
        cmd.action();
        this.updateCurveDebugUI();
      } catch (e) {
        console.warn('[CurveDebug] Execution error:', e);
      }
    }

  getActiveCurve() {
      if (this.stageState.selectedItem && this.stageState.selectedItem.type === 'curve') {
        return this.stageState.selectedItem;
      }
      const curves = this.stageState.annotations.filter(a => a.type === 'curve');
      return curves.length > 0 ? curves[curves.length - 1] : null;
    }

  getActiveKnot() {
      const curve = this.getActiveCurve();
      if (!curve || !curve.vertices || curve.vertices.length === 0) return null;
      const idx = Math.max(0, Math.min(this._activeKnotIndex || 0, curve.vertices.length - 1));
      return curve.vertices[idx] || null;
    }

  highlightActiveKnot() {
      const handles = this.controlsLayer.querySelectorAll('.qa-on-curve-knot-handle');
      handles.forEach((h, i) => {
        const isCur = (i === this._activeKnotIndex);
        h.setAttribute('stroke', isCur ? '#00f2fe' : '#ffffff');
        h.setAttribute('stroke-width', isCur ? '3.5' : '2');
        if (isCur) h.style.filter = 'drop-shadow(0 0 8px #00f2fe)';
        else h.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))';
      });
    }

  updateCurveDebugUI() {
      if (!this._telemetryBody) return;
      this._telemetryBody.innerHTML = '';

      const curve = this.getActiveCurve();
      const badge = document.getElementById('qa-telemetry-badge');

      if (!curve) {
        if (badge) { badge.textContent = 'No Curve Selected'; badge.style.color = '#94a3b8'; }
        this._telemetryBody.innerHTML = '<span style="grid-column: span 2; color:#64748b; font-style:italic;">Draw a curve or click a curve to inspect telemetry.</span>';
        return;
      }

      if (badge) { badge.textContent = `Curve: ${curve.id.split('_')[1] || 'Active'}`; badge.style.color = '#10b981'; }

      const knot = this.getActiveKnot();
      const knotsCount = curve.vertices?.length || curve.beziers?.length + 1 || 0;
      const knotIdx = this._activeKnotIndex || 0;

      const makeItem = (label, val, col = '#00f2fe') => {
        return makeElement('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
          makeElement('span', { style: { color: '#94a3b8' } }, label),
          makeElement('strong', { style: { color: col, fontFamily: 'monospace' } }, String(val))
        ]);
      };

      const tanDeg = knot ? ((knot.tangentAngleOffset || 0) * (180 / Math.PI)).toFixed(1) + '°' : '0.0°';
      const curvVal = knot ? (knot.curvature || 1.0).toFixed(2) : '1.00';
      const balVal = knot ? (knot.balance || 1.0).toFixed(2) : '1.00';
      const ptCoord = knot ? `[${Math.round(knot.point[0])}, ${Math.round(knot.point[1])}]` : '[--,--]';

      this._telemetryBody.append(
        makeItem('Total Knots:', knotsCount),
        makeItem('Selected Knot:', `${knotIdx + 1} of ${knotsCount}`),
        makeItem('Coordinates:', ptCoord),
        makeItem('Tangent Offset:', tanDeg, '#ffd700'),
        makeItem('Curvature (C):', curvVal),
        makeItem('Balance (B):', balVal)
      );

      // Refresh live sliders to reflect selected knot values
      if (this._curvSlider?._updateVal) this._curvSlider._updateVal();
      if (this._balSlider?._updateVal) this._balSlider._updateVal();
      if (this._tanSlider?._updateVal) this._tanSlider._updateVal();

      this.updateCommandMatrixUI();
      this.highlightActiveKnot();
    }

  commitCurveGeometryUpdate() {
      const curve = this.getActiveCurve();
      if (!curve || !curve.vertices || curve.vertices.length < 2) return;

      curve.beziers = this.verticesToBeziers(curve.vertices);

      const [shadowEl, splineEl] = curve.elements;
      let arrowShadowEl = curve.elements[2] || null;
      let arrowForegroundEl = curve.elements[3] || null;

      let d = 'M ' + curve.beziers[0][0].join(' ');
      for (let i = 0; i < curve.beziers.length; i++) {
        const [start, cp1, cp2, end] = curve.beziers[i];
        d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
      }
      if (splineEl) splineEl.setAttribute('d', d);
      if (shadowEl) shadowEl.setAttribute('d', d);

      if (curve.hasArrow && arrowForegroundEl && arrowShadowEl) {
        const p0 = curve.beziers[0][0];
        const p1 = curve.beziers[0][1];
        const p2 = curve.beziers[0][2];
        const p3 = curve.beziers[0][3];

        let tSample = 0.25;
        let q = CurveFitter.bezier_q([p0, p1, p2, p3], tSample);
        let dist = Math.hypot(q[0] - p0[0], q[1] - p0[1]);
        if (dist < 10 && curve.beziers.length > 1) {
          q = curve.beziers[1][0];
          dist = Math.hypot(q[0] - p0[0], q[1] - p0[1]);
        }

        const ux = dist > 0.001 ? (q[0] - p0[0]) / dist : 1;
        const uy = dist > 0.001 ? (q[1] - p0[1]) / dist : 0;
        const nx = -uy;
        const ny = ux;

        const barbLen = 18;
        const barbSpread = 11;
        const b1 = [p0[0] + ux * barbLen + nx * barbSpread, p0[1] + uy * barbLen + ny * barbSpread];
        const b2 = [p0[0] + ux * barbLen - nx * barbSpread, p0[1] + uy * barbLen - ny * barbSpread];
        const ctrl1 = [p0[0] + ux * (barbLen * 0.45) + nx * (barbSpread * 0.15), p0[1] + uy * (barbLen * 0.45) + ny * (barbSpread * 0.15)];
        const ctrl2 = [p0[0] + ux * (barbLen * 0.45) - nx * (barbSpread * 0.15), p0[1] + uy * (barbLen * 0.45) - ny * (barbSpread * 0.15)];

        const arrowD = `M ${b1[0]} ${b1[1]} Q ${ctrl1[0]} ${ctrl1[1]} ${p0[0]} ${p0[1]} M ${p0[0]} ${p0[1]} Q ${ctrl2[0]} ${ctrl2[1]} ${b2[0]} ${b2[1]}`;
        arrowForegroundEl.setAttribute('d', arrowD);
        arrowShadowEl.setAttribute('d', arrowD);
      }

      this.renderStage();
    }

  applyViewportTransform() {
      if (!this.zoomScaffold) return;
      const z = this.stageState.zoom;
      const px = Math.round(this.stageState.panX);
      const py = Math.round(this.stageState.panY);
      this.zoomScaffold.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
      this.zoomScaffold.style.transformOrigin = '0 0';
    }

  setupImageDragDrop() {
      const vp = this.viewport;
      if (!vp) return;

      ['dragenter', 'dragover'].forEach(evt => {
        vp.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          vp.style.boxShadow = 'inset 0 0 20px rgba(0, 242, 254, 0.4)';
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        vp.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          vp.style.boxShadow = 'none';
        });
      });

      vp.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const rect = this.stageBox.getBoundingClientRect();
        const z = this.stageState.zoom;
        const dropWorldX = Math.round(((e.clientX - rect.left) / z));
        const dropWorldY = Math.round(((e.clientY - rect.top) / z));

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            this.loadDroppedImageFile(file, dropWorldX + i * 20, dropWorldY + i * 20);
          }
        }
      });
    }

  loadDroppedImageFile(file, posX = 40, posY = 40) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          // Natural dimension clamping for viewport
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          const maxInitial = 480;
          if (w > maxInitial || h > maxInitial) {
            const ratio = Math.min(maxInitial / w, maxInitial / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          const imagePlate = {
            id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: file.name || 'Image Plate',
            img: img,
            x: posX,
            y: posY,
            width: w,
            height: h,
            aspect: w / h
          };

          this.stageState.placedImages.push(imagePlate);
          this.stageState.activeImage = imagePlate;

          // If this is the primary first image, establish as base canvas
          if (!this.stageState.baseImage) {
            this.stageState.baseImage = img;
            this.stageState.cropRect = { x: 0, y: 0, width: w, height: h };
            this.stageState.canvasWidth = Math.max(this.stageState.canvasWidth, w + 80);
            this.stageState.canvasHeight = Math.max(this.stageState.canvasHeight, h + 80);
          }

          this.renderStage();
          if (this._devDeckDialog) this.updateDevDeckUI();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

  renderPlacedImages(ctx) {
      if (!this.stageState.placedImages || this.stageState.placedImages.length === 0) return;

      this.stageState.placedImages.forEach((plate) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 12;
        ctx.drawImage(plate.img, plate.x, plate.y, plate.width, plate.height);

        // Active outline if selected in Move/Tweak tool
        if (this.stageState.activeImage === plate && this.stageState.activeTool === 'select') {
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
        }
        ctx.restore();
      });
    }

  openDevDeckDialog() {
      if (this._devDeckDialog && this._devDeckDialog.element?.isConnected) {
        this._devDeckDialog.bringToFront();
        this.updateDevDeckUI();
        return;
      }

      const container = makeElement('div', {
        id: 'qa-dev-deck-root',
        style: {
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: '#090d16',
          color: '#f8fafc',
          fontFamily: 'monospace',
          fontSize: '11px',
          boxSizing: 'border-box',
          height: '100%',
          overflowY: 'auto'
        }
      });

      const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
        ? UITools.makeDialog
        : (opts => new DialogBox(opts));

      this._devDeckDialog = dialogMaker({
        title: '🛠️ Curve & Object Architecture Dev Deck',
        size: [560, 640],
        position: [Math.max(20, window.innerWidth - 600), 65],
        contentElement: container,
        onClose: () => {
          this._devDeckDialog = null;
        }
      });

      this.buildDevDeckContent(container);
    }

  buildDevDeckContent(container) {
      container.innerHTML = '';

      // 1. Top Action Ribbon: State Serializer & Constraint Wipes
      const topBar = makeElement('div', {
        style: {
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: '6px'
        }
      }, [
        makeElement('div', { style: { display: 'flex', gap: '6px' } }, [
          makeElement('button', {
            className: 'dr-nav-btn primary',
            style: { padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', background: '#238636', borderColor: '#2ea043' },
            title: 'Serialize and copy entire drawing & knot state to clipboard for AI prompt pasting',
            onclick: () => this.copyTelemetryStateToClipboard()
          }, '📋 Copy State for AI'),
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '4px 8px', fontSize: '10.5px', color: '#ff7b72', borderColor: '#ff7b7266' },
            title: 'Wipe all constraints (curvature, balance, tangency offsets) from entire selected curve',
            onclick: () => this.wipeAllConstraintsFromActiveCurve()
          }, 'Wipe Curve Constraints')
        ]),
        makeElement('label', {
          style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#cbd5e1', cursor: 'pointer' }
        }, [
          (this._freeDragCheck = makeElement('input', {
            type: 'checkbox',
            checked: this.stageState.freePointOnDrag,
            onchange: (e) => { this.stageState.freePointOnDrag = e.target.checked; }
          })),
          makeElement('span', {}, 'Free Knot on Drag')
        ])
      ]);
      container.appendChild(topBar);

      // 2. Active Entity Telemetry Inspector
      const telemetryCard = makeElement('div', {
        style: {
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(0, 242, 254, 0.35)',
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }
      });

      const telHeader = makeElement('div', {
        style: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }
      }, [
        makeElement('strong', { style: { color: '#00f2fe', fontSize: '11.5px' } }, '🔍 ACTIVE KNOT TELEMETRY'),
        this._knotSelectorLabel = makeElement('span', { style: { color: '#ffd700', fontSize: '10.5px' } }, 'Knot 1/1')
      ]);

      this._telemetryGrid = makeElement('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '10.5px' }
      });

      telemetryCard.append(telHeader, this._telemetryGrid);
      container.appendChild(telemetryCard);

      // 3. Object & Layer Hierarchy Stack (All Curves, Images, Masks as discrete entities)
      const stackCard = makeElement('div', {
        style: {
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(192, 132, 252, 0.35)',
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flex: 1
        }
      });

      const stackHeader = makeElement('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }
      }, [
        makeElement('strong', { style: { color: '#c084fc', fontSize: '11.5px' } }, '📑 ENTITY & LAYER STACK (Z-ORDER)'),
        makeElement('span', { id: 'qa-entity-count', style: { color: '#94a3b8', fontSize: '10px' } }, '0 Items')
      ]);

      this._entityListEl = makeElement('div', {
        id: 'qa-entity-list-items',
        style: { display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1, maxHeight: '220px' }
      });

      stackCard.append(stackHeader, this._entityListEl);
      container.appendChild(stackCard);

      this.updateDevDeckUI();
    }

  updateDevDeckUI() {
      if (!this._entityListEl || !this._telemetryGrid) return;

      // 1. Populate Telemetry Grid
      this._telemetryGrid.innerHTML = '';
      const curve = (this.stageState.selectedItem?.type === 'curve')
        ? this.stageState.selectedItem
        : this.stageState.annotations.find(a => a.type === 'curve');

      if (curve && curve.vertices && curve.vertices.length > 0) {
        const idx = Math.max(0, Math.min(this._activeKnotIdx || 0, curve.vertices.length - 1));
        const k = curve.vertices[idx];
        this._knotSelectorLabel.textContent = `Knot ${idx + 1} of ${curve.vertices.length}`;

        const makeRow = (lbl, val, col = '#00f2fe') => {
          return makeElement('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
            makeElement('span', { style: { color: '#94a3b8' } }, lbl),
            makeElement('strong', { style: { color: col, fontFamily: 'monospace' } }, String(val))
          ]);
        };

        const tanDeg = ((k.tangentAngleOffset || 0) * (180 / Math.PI)).toFixed(1) + '°';
        this._telemetryGrid.append(
          makeRow('Position:', `[${Math.round(k.point[0])}, ${Math.round(k.point[1])}]`),
          makeRow('Tangent Offset:', tanDeg, '#ffd700'),
          makeRow('Curvature (C):', (k.curvature || 1.0).toFixed(2)),
          makeRow('Balance (B):', (k.balance || 1.0).toFixed(2)),
          makeRow('Zoom Scale:', `${Math.round(this.stageState.zoom * 100)}%`),
          makeRow('Pan Anchor:', `[${Math.round(this.stageState.panX)}, ${Math.round(this.stageState.panY)}]`)
        );
      } else {
        this._knotSelectorLabel.textContent = 'None Selected';
        this._telemetryGrid.innerHTML = '<span style="grid-column: span 2; color:#64748b; font-style:italic;">Select a curve on canvas to inspect knots.</span>';
      }

      // 2. Populate Entity Stack (Z-Order List)
      this._entityListEl.innerHTML = '';
      const allEntities = [
        ...this.stageState.placedImages.map(img => ({ type: 'image', ref: img, label: img.name || 'Image Plate' })),
        ...this.stageState.annotations.map(ann => ({
          type: ann.type,
          ref: ann,
          label: ann.type === 'curve' ? (ann.text ? `Curve: "${ann.text}"` : 'Curve Spline') : `${ann.type.toUpperCase()} Mask`
        }))
      ];

      const countEl = document.getElementById('qa-entity-count');
      if (countEl) countEl.textContent = `${allEntities.length} Entities`;

      allEntities.forEach((item, index) => {
        const isSelected = (this.stageState.selectedItem === item.ref || this.stageState.activeImage === item.ref);

        const row = makeElement('div', {
          style: {
            background: isSelected ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.03)',
            border: isSelected ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '5px',
            padding: '4px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          },
          onclick: () => {
            if (item.type === 'image') {
              this.stageState.activeImage = item.ref;
              this.stageState.selectedItem = null;
            } else {
              this.stageState.selectedItem = item.ref;
              if (item.type === 'curve') this.exposeBezierHandles(item.ref);
            }
            this.renderStage();
            this.updateDevDeckUI();
          }
        });

        const labelSpan = makeElement('span', {
          style: { color: isSelected ? '#00f2fe' : '#f8fafc', fontWeight: isSelected ? 'bold' : 'normal' }
        }, `${index + 1}. ${item.label}`);

        const actions = makeElement('div', { style: { display: 'flex', gap: '3px' } }, [
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '1px 5px', fontSize: '9px' },
            title: 'Move Layer Up (Higher Z)',
            onclick: (e) => {
              e.stopPropagation();
              this.moveEntityLayer(item, 1);
            }
          }, '▲'),
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '1px 5px', fontSize: '9px' },
            title: 'Move Layer Down (Lower Z)',
            onclick: (e) => {
              e.stopPropagation();
              this.moveEntityLayer(item, -1);
            }
          }, '▼'),
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '1px 5px', fontSize: '9px', color: '#ff7b72', borderColor: '#ff7b7266' },
            title: 'Delete this entity',
            onclick: (e) => {
              e.stopPropagation();
              this.deleteEntity(item);
            }
          }, '✕')
        ]);

        row.append(labelSpan, actions);
        this._entityListEl.appendChild(row);
      });
    }

  moveEntityLayer(item, delta) {
      if (item.type === 'image') {
        const idx = this.stageState.placedImages.indexOf(item.ref);
        if (idx !== -1) {
          const target = Math.max(0, Math.min(this.stageState.placedImages.length - 1, idx + delta));
          const [moved] = this.stageState.placedImages.splice(idx, 1);
          this.stageState.placedImages.splice(target, 0, moved);
        }
      } else {
        const idx = this.stageState.annotations.indexOf(item.ref);
        if (idx !== -1) {
          const target = Math.max(0, Math.min(this.stageState.annotations.length - 1, idx + delta));
          const [moved] = this.stageState.annotations.splice(idx, 1);
          this.stageState.annotations.splice(target, 0, moved);
        }
      }
      this.renderStage();
      this.updateDevDeckUI();
    }

  deleteEntity(item) {
      if (item.type === 'image') {
        const idx = this.stageState.placedImages.indexOf(item.ref);
        if (idx !== -1) this.stageState.placedImages.splice(idx, 1);
        if (this.stageState.activeImage === item.ref) this.stageState.activeImage = null;
      } else {
        const idx = this.stageState.annotations.indexOf(item.ref);
        if (idx !== -1) this.stageState.annotations.splice(idx, 1);
        if (item.ref.elements) item.ref.elements.forEach(el => el.remove());
        if (this.stageState.selectedItem === item.ref) {
          this.controlsLayer.innerHTML = '';
          this.stageState.selectedItem = null;
        }
      }
      this.renderStage();
      this.updateDevDeckUI();
    }

  copyTelemetryStateToClipboard() {
      const payload = {
        timestamp: new Date().toISOString(),
        viewport: {
          zoom: this.stageState.zoom,
          panX: this.stageState.panX,
          panY: this.stageState.panY,
          canvasWidth: this.stageState.canvasWidth,
          canvasHeight: this.stageState.canvasHeight
        },
        placedImages: this.stageState.placedImages.map(img => ({
          id: img.id,
          name: img.name,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height
        })),
        annotations: this.stageState.annotations.map(a => ({
          id: a.id,
          type: a.type,
          color: a.color,
          hasArrow: a.hasArrow,
          text: a.text,
          fontSize: a.fontSize,
          fontFamily: a.fontFamily,
          knots: (a.vertices || []).map(v => ({
            pt: [Math.round(v.point[0]), Math.round(v.point[1])],
            tangentOffsetDeg: Math.round((v.tangentAngleOffset || 0) * (180 / Math.PI)),
            curvature: Number(v.curvature || 1.0).toFixed(2),
            balance: Number(v.balance || 1.0).toFixed(2)
          }))
        }))
      };

      const json = JSON.stringify(payload, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        alert('✓ Complete telemetry & curve state copied to clipboard!\nYou can paste it directly into your prompt.');
      }).catch(() => {
        prompt('Copy state JSON:', json);
      });
    }

  wipeAllConstraintsFromActiveCurve() {
      const curve = (this.stageState.selectedItem?.type === 'curve')
        ? this.stageState.selectedItem
        : this.stageState.annotations.find(a => a.type === 'curve');

      if (!curve || !curve.vertices) return;

      curve.vertices.forEach(v => {
        v.tangentAngleOffset = 0;
        v.curvature = 1.0;
        v.balance = 1.0;
        v.tangents = [null, null];
      });

      curve.beziers = this.verticesToBeziers(curve.vertices);

      // Re-render paths
      let d = 'M ' + curve.beziers[0][0].join(' ');
      for (let i = 0; i < curve.beziers.length; i++) {
        const [start, cp1, cp2, end] = curve.beziers[i];
        d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
      }
      if (curve.elements[0]) curve.elements[0].setAttribute('d', d);
      if (curve.elements[1]) curve.elements[1].setAttribute('d', d);

      this.renderStage();
      this.updateDevDeckUI();
      this.showKnotToast('✓ Wiped all constraints across active curve');
    }
}

globalThis.QuoraAnnotationComponent = QuoraAnnotationComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraAnnotationComponent;