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
        annotations: [],
        zoom: 1.0,
        manualSizing: false,
        canvasWidth: 680,
        canvasHeight: 340,
        padding: 35,
        canvasBgMode: 'matte',
        canvasBgColor: '#090d16',
        activeTool: 'curve',
        hasArrow: true,
        curveStrokeWidth: 3.2,
        curveTextAnchor: 'tail',
        currentColor: '#00e676',
        hasBorder: true,
        fontFamily: "'Architects Daughter', cursive, sans-serif",
        fontSize: 24, // Sized prominently to match bold 3.2px Bézier ink
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
        cropMarquee: null
      };

      this.cropCanvas = null;
      this.baseCropCanvas = null;
      this._loadedFonts = new Set();
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
        title: 'Draw smooth cubic Bézier splines (toggle arrow on/off as desired). Hold Shift to erase rewind!',
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
        zoomGroup, autoBoundsBtn, bgBtn, undoBtn, clearBtn
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
    this.viewport.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        this.setZoom(this.stageState.zoom + delta);
      }
    }, { passive: false });
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

      // 1. Background Scene Canvas
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

      // 2. Native Difference Callout Lenses
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

      // 3. Clear and Repopulate Text & Shadows (Identical Offset & Weight)
      this.textBadgesLayer.innerHTML = '';
      const oldTextShadows = this.shadowLayer.querySelectorAll('.qa-attached-text-shadow');
      oldTextShadows.forEach(el => el.remove());

      const shadowOffset = 2.0; // Uniform 2px shadow offset across curve, arrowhead, box, and text
      const shadowColor = 'rgba(10, 15, 25, 0.95)';

      this.stageState.annotations.forEach(ann => {
        if (ann.type === 'curve' && ann.text && ann.beziers && ann.beziers.length > 0) {
          const lastSeg = ann.beziers[ann.beziers.length - 1];
          const tailPt = lastSeg[3];
          const tipPt = ann.beziers[0][0];

          const isLeft = (ann.justifySide === 'left') || (tipPt[0] <= tailPt[0]);
          const textAnchor = isLeft ? 'start' : 'end';

          const fontF = ann.fontFamily || this.stageState.fontFamily || "'Architects Daughter', cursive, sans-serif";
          const fontS = ann.fontSize || this.stageState.fontSize || 24;
          const strokeW = ann.strokeWidth || this.stageState.curveStrokeWidth || 3.2;

          this.ensureFontLoaded(fontF);

          // Multi-line support
          const lines = String(ann.text).split('\n');
          const lineHeight = fontS * 1.25;

          // Calculate box dimensions tightly anchored to tailPt
          const charW = fontS * (fontF.includes('mono') ? 0.62 : 0.58);
          let maxLineChars = 0;
          lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });

          const paddingX = ann.hasTextBox ? 10 : 2;
          const paddingY = ann.hasTextBox ? 6 : 2;
          const txtWidth = Math.round(maxLineChars * charW);
          const boxWidth = txtWidth + paddingX * 2;
          const boxHeight = Math.round(lines.length * lineHeight + paddingY * 2);

          // Right up against tailPt: 0px gap!
          const boxX = isLeft ? tailPt[0] : tailPt[0] - boxWidth;
          const boxY = Math.round(tailPt[1] - boxHeight / 2);
          const textX = isLeft ? boxX + paddingX : boxX + boxWidth - paddingX;
          const textStartY = Math.round(boxY + paddingY + fontS * 0.9);

          if (ann.hasTextBox) {
            // Boundary Box Shadow (Identical 2px offset and thickness to curve shadow)
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

            // Boundary Box Foreground (thickness matches curve Bézier stroke)
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
            this.textBadgesLayer.appendChild(boxRect);
          }

          // Text Shadow on shadowLayer (Bold stroke + fill offset by identical 2px)
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

          // Foreground Text on textBadgesLayer
          const fgText = makeElement('svg:text', {
            x: textX,
            y: textStartY,
            'text-anchor': textAnchor,
            fill: ann.color,
            'font-family': fontF,
            'font-size': `${fontS}px`,
            'font-weight': 'bold',
            style: { cursor: 'pointer', userSelect: 'none' },
            onclick: (e) => {
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
          this.textBadgesLayer.appendChild(fgText);
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

      // Keyboard Shortcuts: Ctrl+Z for undo; Delete/Backspace for selected curve
      if (!this._hasBoundGlobalKeys) {
        this._hasBoundGlobalKeys = true;
        window.addEventListener('keydown', (e) => {
          if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

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
        if (e.target.closest('.qa-on-curve-vertex-handle, #qa-tail-settings-hud, foreignObject')) return;

        const pt = getStagePt(e);

        // In Move/Tweak (Select) mode, click selects the nearest curve to tweak or delete
        if (this.stageState.activeTool === 'select') {
          let bestCurve = null;
          let bestDist = 28;

          this.stageState.annotations.forEach(ann => {
            if (ann.type === 'curve' && ann.beziers) {
              ann.beziers.forEach(seg => {
                for (let t = 0; t <= 1; t += 0.2) {
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
          } else {
            this.controlsLayer.innerHTML = '';
            this.stageState.selectedItem = null;
            document.querySelectorAll('.qa-crisp-strokes path').forEach(p => p.style.filter = '');
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

      // 1. Separate Shadow Layer for Curve
      const shadowPath = makeElement('svg:path', {
        d,
        transform: `translate(${shadowOffset}, ${shadowOffset})`,
        stroke: shadowColor,
        'stroke-width': '5.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none'
      });

      // 2. Foreground Stroke Path
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

      // 3. Clean Hand-Drawn Concave Arrowhead at P0 (Only if arrow is enabled)
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

      const curveRecord = {
        id: 'curve_' + Date.now(),
        type: 'curve',
        beziers,
        color,
        hasArrow: !!hasArrow,
        text: '',
        hasTextBox: this.stageState.hasBorder,
        fontFamily: this.stageState.fontFamily,
        fontSize: this.stageState.fontSize || 24,
        elements: [shadowPath, splinePath, ...(arrowShadow ? [arrowShadow, arrowForeground] : [])]
      };

      splinePath.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exposeBezierHandles(curveRecord);
      });

      this.stageState.annotations.push(curveRecord);

      // 4. If Arrow is ON: open inline text box at tail. If Arrow is OFF: clean commit without prompting!
      if (hasArrow) {
        const lastSeg = beziers[beziers.length - 1];
        const tailPt = lastSeg[3];
        const tipPt = beziers[0][0];
        const justifySide = (tipPt[0] <= tailPt[0]) ? 'left' : 'right';
        this._promptInlineTailText(curveRecord, tailPt, justifySide);
      }
    }

  exposeBezierHandles(curveRecord) {
      this.controlsLayer.innerHTML = '';
      if (!curveRecord || !curveRecord.beziers || curveRecord.beziers.length === 0) return;

      this.stageState.selectedItem = curveRecord;

      // Convert or retrieve active on-curve vertices
      if (!curveRecord.vertices || curveRecord.vertices.length === 0) {
        curveRecord.vertices = this.beziersToVertices(curveRecord.beziers);
      }
      const vertices = curveRecord.vertices;

      const [shadowEl, splineEl] = curveRecord.elements;
      let arrowShadowEl = null;
      let arrowForegroundEl = null;
      if (curveRecord.elements.length >= 4) {
        arrowShadowEl = curveRecord.elements[2];
        arrowForegroundEl = curveRecord.elements[3];
      }

      const getStagePt = (e) => {
        const rect = this.stageBox.getBoundingClientRect();
        const z = this.stageState.zoom || 1.0;
        return [(e.clientX - rect.left) / z, (e.clientY - rect.top) / z];
      };

      // Active Selection Glow on the selected curve
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

        // Update arrowhead barbs at p0
        if (curveRecord.hasArrow && arrowForegroundEl && arrowShadowEl) {
          const p0 = curveRecord.beziers[0][0];
          const p1 = curveRecord.beziers[0][1];
          const p2 = curveRecord.beziers[0][2];
          const p3 = curveRecord.beziers[0][3];

          let tSample = 0.25;
          let q = CurveFitter.bezier_q([p0, p1, p2, p3], tSample);
          let dist = Math.hypot(q[0] - p0[0], q[1] - p0[1]);
          if (dist < 10 && curveRecord.beziers.length > 1) {
            q = curveRecord.beziers[1][0];
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
      };

      // Render ON-CURVE vertex handles (User drags points directly on the curve)
      vertices.forEach((v, idx) => {
        const isTip = (idx === 0 && curveRecord.hasArrow);
        const isTail = (idx === vertices.length - 1);

        const circle = makeElement('svg:circle', {
          cx: v.point[0],
          cy: v.point[1],
          r: isTip ? '7' : (isTail ? '6.5' : '5.5'),
          fill: isTip ? '#ffd700' : (isTail ? '#00f2fe' : '#2ecc71'),
          stroke: '#ffffff',
          'stroke-width': '2',
          className: 'qa-on-curve-vertex-handle',
          style: { cursor: 'move', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.85))' }
        });

        let dragging = false;
        circle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          dragging = true;
        });

        const onDrag = (e) => {
          if (!dragging) return;
          const pt = getStagePt(e);
          v.point[0] = pt[0];
          v.point[1] = pt[1];
          circle.setAttribute('cx', pt[0]);
          circle.setAttribute('cy', pt[1]);
          updateCurveGeometry();
        };

        const onUp = () => { dragging = false; };
        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', onUp);

        this.controlsLayer.appendChild(circle);
      });

      // Curve Action Bar: Delete Curve, Curvature, Cusp, and Done
      const hudPt = vertices[Math.floor(vertices.length / 2)].point;
      const tweakerHud = makeElement('svg:foreignObject', {
        x: hudPt[0] - 130,
        y: hudPt[1] - 48,
        width: '260',
        height: '38',
        style: { overflow: 'visible' }
      });

      const deleteCurve = () => {
        const idx = this.stageState.annotations.indexOf(curveRecord);
        if (idx !== -1) {
          this.stageState.annotations.splice(idx, 1);
        }
        curveRecord.elements.forEach(el => el.remove());
        const inlineEditor = document.getElementById('qa-inline-tail-editor');
        if (inlineEditor) inlineEditor.remove();
        this.controlsLayer.innerHTML = '';
        this.stageState.selectedItem = null;
        this.renderStage();
      };

      const hudBody = makeElement('div', {
        style: {
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1.5px solid #00f2fe',
          borderRadius: '20px',
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#f8fafc',
          userSelect: 'none'
        }
      }, [
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 6px', fontSize: '10px' },
          title: 'Cycle curvature tension across vertices',
          onclick: (e) => {
            e.stopPropagation();
            vertices.forEach(v => {
              v.curvature = (v.curvature === 1) ? 1.4 : (v.curvature === 1.4 ? 0.7 : 1);
            });
            updateCurveGeometry();
          }
        }, 'Curv ↺'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 6px', fontSize: '10px' },
          title: 'Break tangency into sharp corner / cusp',
          onclick: (e) => {
            e.stopPropagation();
            vertices.forEach(v => {
              v.tangentAngleOffset = (v.tangentAngleOffset === 0) ? 45 : 0;
            });
            updateCurveGeometry();
          }
        }, 'Cusp ◿'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 6px', fontSize: '10px', color: '#ff7b72', borderColor: '#ff7b7266' },
          title: 'Delete this entire curve and label (Delete/Backspace)',
          onclick: (e) => {
            e.stopPropagation();
            deleteCurve();
          }
        }, '🗑️ Delete'),
        makeElement('button', {
          className: 'dr-nav-btn primary',
          style: { padding: '2px 8px', fontSize: '10px', background: '#238636', borderColor: '#2ea043' },
          onclick: (e) => {
            e.stopPropagation();
            splineEl.style.filter = '';
            this.controlsLayer.innerHTML = '';
            this.stageState.selectedItem = null;
          }
        }, 'Done ✓')
      ]);

      tweakerHud.appendChild(hudBody);
      this.controlsLayer.appendChild(tweakerHud);
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

      const availableFonts = [
        { id: "'Architects Daughter', cursive, sans-serif", label: "Architect's Daughter" },
        { id: "monospace", label: "Monospace" },
        { id: "'Plus Jakarta Sans', system-ui, sans-serif", label: "Sans-Serif" },
        { id: "'Newsreader', Georgia, serif", label: "Serif" },
        { id: "'JetBrains Mono', monospace", label: "JetBrains" }
      ];

      const pushRecentFont = (fId) => {
        this.stageState.fontFamily = fId;
        curveRecord.fontFamily = fId;
        this.ensureFontLoaded(fId);
        const list = this.stageState.recentFonts.filter(x => x !== fId);
        list.unshift(fId);
        this.stageState.recentFonts = list.slice(0, 3);
      };

      if (!curveRecord.fontFamily) {
        curveRecord.fontFamily = this.stageState.fontFamily;
      }
      pushRecentFont(curveRecord.fontFamily);

      if (!curveRecord.fontSize) {
        curveRecord.fontSize = this.stageState.fontSize || 24;
      }
      if (curveRecord.hasTextBox === undefined) {
        curveRecord.hasTextBox = this.stageState.hasBorder;
      }

      const isLeft = (justifySide === 'left');
      const width = 280;

      // Docks tight right against tailPt (no awkward gap)
      const posX = isLeft ? tailPt[0] + 2 : tailPt[0] - width - 2;
      const posY = tailPt[1] - 22;

      const editorWrap = makeElement('div', {
        id: 'qa-inline-tail-editor',
        style: {
          position: 'absolute',
          top: `${posY}px`,
          left: `${posX}px`,
          width: `${width}px`,
          zIndex: '70',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }
      });

      const strokeW = curveRecord.strokeWidth || this.stageState.curveStrokeWidth || 3.2;

      // Multi-line Textarea supporting wrapping with Shift+Enter / Ctrl+Enter
      const textarea = makeElement('textarea', {
        placeholder: 'Type label (Shift+Enter to wrap)...',
        value: curveRecord.text || '',
        rows: 1,
        style: {
          width: '100%',
          minHeight: '38px',
          maxHeight: '180px',
          padding: '6px 10px',
          fontSize: `${curveRecord.fontSize}px`,
          fontFamily: curveRecord.fontFamily,
          fontWeight: 'bold',
          lineHeight: '1.25',
          color: curveRecord.color,
          background: curveRecord.hasTextBox ? 'rgba(15, 23, 42, 0.96)' : 'rgba(0, 0, 0, 0.65)',
          border: curveRecord.hasTextBox ? `${strokeW}px solid ${curveRecord.color}` : '1.5px dashed rgba(255, 255, 255, 0.4)',
          borderRadius: '6px',
          outline: 'none',
          resize: 'none',
          boxSizing: 'border-box',
          textAlign: isLeft ? 'left' : 'right',
          boxShadow: `0 8px 24px rgba(0,0,0,0.85), 0 0 14px ${curveRecord.color}33`,
          transition: 'border 0.1s ease'
        }
      });

      // Auto-expand textarea height as you wrap text
      const autoGrow = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(38, textarea.scrollHeight)}px`;
      };

      // Separate Floating Settings Toolbar placed distinctly below the callout box
      const settingsHud = makeElement('div', {
        id: 'qa-tail-settings-hud',
        style: {
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(12px)',
          fontSize: '11px',
          color: '#cbd5e1'
        }
      });

      const topRow = makeElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }
      });

      const borderBtn = makeElement('button', {
        className: `dr-nav-btn ${curveRecord.hasTextBox ? 'primary' : ''}`,
        style: { padding: '3px 8px', fontSize: '11px', fontWeight: 'bold' },
        title: 'Toggle Call-Out Box Border',
        onclick: (e) => {
          e.stopPropagation();
          curveRecord.hasTextBox = !curveRecord.hasTextBox;
          this.stageState.hasBorder = curveRecord.hasTextBox;
          borderBtn.classList.toggle('primary', curveRecord.hasTextBox);
          borderBtn.textContent = curveRecord.hasTextBox ? '◻ Box' : 'Plain';
          textarea.style.border = curveRecord.hasTextBox ? `${strokeW}px solid ${curveRecord.color}` : '1.5px dashed rgba(255, 255, 255, 0.4)';
          textarea.style.background = curveRecord.hasTextBox ? 'rgba(15, 23, 42, 0.96)' : 'rgba(0, 0, 0, 0.65)';
          this.renderStage();
        }
      }, curveRecord.hasTextBox ? '◻ Box' : 'Plain');

      const sliderWrap = makeElement('div', {
        style: { display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }
      });

      const sizeValLabel = makeElement('span', {
        style: { fontFamily: 'monospace', fontSize: '11px', minWidth: '32px', color: '#00f2fe' }
      }, `${curveRecord.fontSize}px`);

      const sizeSlider = makeElement('input', {
        type: 'range',
        min: '14',
        max: '52',
        value: String(curveRecord.fontSize),
        style: { width: '80px', accentColor: '#00f2fe', cursor: 'pointer' },
        oninput: (e) => {
          const sz = parseInt(e.target.value, 10);
          curveRecord.fontSize = sz;
          this.stageState.fontSize = sz;
          sizeValLabel.textContent = `${sz}px`;
          textarea.style.fontSize = `${sz}px`;
          autoGrow();
          this.renderStage();
        }
      });
      sliderWrap.append(makeElement('span', { style: { fontSize: '10px', color: '#94a3b8' } }, 'Size:'), sizeSlider, sizeValLabel);

      let committed = false;
      let onOutClick = null;

      const commit = () => {
        if (committed) return;
        committed = true;
        if (onOutClick) {
          window.removeEventListener('mousedown', onOutClick);
          onOutClick = null;
        }
        curveRecord.text = textarea.value.trim();
        curveRecord.justifySide = isLeft ? 'left' : 'right';
        editorWrap.remove();
        this.renderStage();
      };

      const okBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', background: '#238636', borderColor: '#2ea043' },
        title: 'Commit label (or press Enter)',
        onclick: (e) => {
          e.stopPropagation();
          commit();
        }
      }, '✓ OK');

      topRow.append(borderBtn, sliderWrap, okBtn);

      // Font selection row
      const fontRow = makeElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }
      });

      const renderRecentFontChips = () => {
        fontRow.innerHTML = '';
        this.stageState.recentFonts.forEach(fId => {
          const found = availableFonts.find(x => x.id === fId);
          const label = found ? found.label.split(' ')[0] : 'Font';
          const isCur = (curveRecord.fontFamily === fId);

          const chip = makeElement('button', {
            className: `dr-nav-btn ${isCur ? 'primary' : ''}`,
            style: { padding: '2px 6px', fontSize: '10px', fontFamily: fId },
            onclick: (e) => {
              e.stopPropagation();
              pushRecentFont(fId);
              textarea.style.fontFamily = fId;
              renderRecentFontChips();
              autoGrow();
              this.renderStage();
            }
          }, label);
          fontRow.appendChild(chip);
        });

        const moreSelect = makeElement('select', {
          style: {
            background: '#090d16', color: '#00f2fe', border: '1px solid #334155',
            borderRadius: '4px', padding: '2px 4px', fontSize: '10px', outline: 'none'
          },
          onchange: (e) => {
            e.stopPropagation();
            const chosen = e.target.value;
            pushRecentFont(chosen);
            textarea.style.fontFamily = chosen;
            renderRecentFontChips();
            autoGrow();
            this.renderStage();
          }
        });
        moreSelect.appendChild(makeElement('option', { value: '', disabled: true, selected: true }, 'More...'));
        availableFonts.forEach(f => {
          moreSelect.appendChild(makeElement('option', { value: f.id }, f.label));
        });
        fontRow.appendChild(moreSelect);
      };

      renderRecentFontChips();
      settingsHud.append(topRow, fontRow);

      editorWrap.append(textarea, settingsHud);
      this.stageBox.appendChild(editorWrap);

      textarea.addEventListener('input', () => {
        autoGrow();
        curveRecord.text = textarea.value;
        curveRecord.justifySide = isLeft ? 'left' : 'right';
        this.renderStage();
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          textarea.value = '';
          commit();
        }
      });

      onOutClick = (ev) => {
        if (!editorWrap.contains(ev.target)) {
          commit();
        }
      };

      setTimeout(() => {
        textarea.focus();
        autoGrow();
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

      const vertices = [];
      const n = beziers.length;

      for (let i = 0; i <= n; i++) {
        let pt, v;
        if (i < n) {
          pt = beziers[i][0].slice();
        } else {
          pt = beziers[n - 1][3].slice();
        }

        v = new BezierVertex(pt);
        v.curvature = 1;
        v.balance = 1;
        v.tangentAngleOffset = 0;
        vertices.push(v);
      }

      // Solve curvature and balance from initial Schneider segments
      for (let i = 0; i < n; i++) {
        const [p0, p1, p2, p3] = beziers[i];
        const dist = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
        if (dist < 1e-4) continue;

        const lOut = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const lIn = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);

        const sumL = lOut + lIn;
        if (sumL > 1e-4) {
          // Balance = ratio of incoming to total handle weight (default 1)
          const b = (2 * lIn) / sumL;
          // Curvature = ratio of total handle length to canonical (2/3)*D
          const c = sumL / ((2 / 3) * dist);

          vertices[i].balance = Math.max(0.1, Math.min(1.9, b));
          vertices[i].curvature = Math.max(0.2, Math.min(2.5, c));

          if (i === n - 1) {
            vertices[i + 1].balance = vertices[i].balance;
            vertices[i + 1].curvature = vertices[i].curvature;
          }
        }

        // Explicit tangent unit vector leaving p0
        if (lOut > 1e-4) {
          vertices[i].tangents[1] = [(p1[0] - p0[0]) / lOut, (p1[1] - p0[1]) / lOut, 0];
        }
        // Explicit tangent unit vector arriving at p3
        if (lIn > 1e-4) {
          vertices[i + 1].tangents[0] = [(p3[0] - p2[0]) / lIn, (p3[1] - p2[1]) / lIn, 0];
        }
      }

      // Relax control points via your canonical UpdateControlPoints solver
      if (typeof UpdateControlPoints !== 'undefined') {
        UpdateControlPoints.run(vertices, 6);
      }

      return vertices;
    }

  verticesToBeziers(vertices) {
      if (!vertices || vertices.length < 2) return [];
      if (typeof UpdateControlPoints !== 'undefined') {
        UpdateControlPoints.run(vertices, 6);
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
}

globalThis.QuoraAnnotationComponent = QuoraAnnotationComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraAnnotationComponent;