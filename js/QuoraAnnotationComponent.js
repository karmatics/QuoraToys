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
    this._clutchActive = false;
    this._handRestActive = false;
    this._metaHelpActive = false;
    this._hoveredCurve = null;
    this._isDrawingActive = false;
    this._penNodes = null;
    this._loadedFonts = new Set();
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
        makeElement('strong', { style: { fontSize: '13px', color: '#00f2fe' } }, 'Universal Smart Callout Studio'),
        makeElement('span', { id: 'qa-status-pill', style: { fontSize: '10px', background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' } }, 'Draw curve & type • Drag image in • Hold H')
      ]),
      makeElement('div', { style: { display: 'flex', gap: '6px' } }, [
        makeElement('button', {
          className: 'dr-nav-btn primary',
          style: { padding: '4px 10px', fontSize: '11px', background: '#0284c7', borderColor: '#38bdf8' },
          onclick: () => this.openSpotDiffWorkflow()
        }, '🧩 Spot Difference'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '4px 9px', fontSize: '11px', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.45)' },
          title: 'Paste image from clipboard directly onto canvas',
          onclick: () => this.pasteFromClipboardAction()
        }, '📋 Paste Image'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '4px 9px', fontSize: '11px', color: '#00f2fe', borderColor: '#00f2fe66' },
          onclick: () => localFileInput.click()
        }, '📁 Add Image File'),
        makeElement('button', {
          className: 'dr-nav-btn primary',
          style: { padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', background: '#238636', borderColor: '#2ea043' },
          onclick: (e) => this.copyCompositeToClipboard(e.currentTarget)
        }, '📋 Copy Hi-Res PNG')
      ])
    ]);
    wrap.appendChild(header);

    // Primary Ribbon
    const ribbon = makeElement('div', {
      style: {
        padding: '8px 14px', background: 'rgba(11, 17, 32, 0.98)', borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: '#cbd5e1'
      }
    });

    this.toolBtns = {};
    const setTool = (mode) => {
      this.stageState.activeTool = mode;
      Object.keys(this.toolBtns).forEach(k => this.toolBtns[k].classList.toggle('primary', k === mode));
      this.svgSurface.style.cursor = (mode === 'paint' ? 'crosshair' : 'crosshair');
      this.brushControlsRibbon.style.display = (mode === 'paint') ? 'flex' : 'none';
      this.updateDynamicKeyInHUD();
    };

    this.toolBtns.curve = makeElement('button', {
      className: 'dr-nav-btn primary',
      style: { padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' },
      title: 'Unified Smart Pen: Draw curves, drop text notes, or pull arrows seamlessly!',
      onclick: () => setTool('curve')
    }, '🪢 Smart Pen');

    this.toolBtns.paint = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '4px 8px', fontSize: '11px', color: '#f59e0b', borderColor: '#f59e0b66' },
      title: 'Blockout Paint: Mask logos, watermarks, or text for Gemini AI inpainting',
      onclick: () => setTool('paint')
    }, '🖌️ Paint');

    // Color Picker Button
    this.colorPickerBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#00e676' },
      title: 'Open Real-Time Color Picker (Applies immediately to selected curve/text or next stroke)',
      onclick: (e) => this.launchColorPicker('curve', e.currentTarget)
    }, [
      (this.colorIndicatorDot = makeElement('span', {
        style: { width: '12px', height: '12px', borderRadius: '50%', background: this.stageState.currentColor, display: 'inline-block', border: '1px solid #fff' }
      })),
      makeElement('span', {}, 'Color Picker')
    ]);

    // Arrow Toggle Button
    this.arrowBtn = makeElement('button', {
      className: `dr-nav-btn ${this.stageState.hasArrow ? 'primary' : ''}`,
      style: { padding: '4px 8px', fontSize: '11px', color: this.stageState.hasArrow ? '#ffffff' : '#94a3b8' },
      title: 'Toggle Arrowhead [Hotkey: A]',
      onclick: () => this.toggleArrowhead()
    }, this.stageState.hasArrow ? '🏹 Arrow: ON' : '🏹 Arrow: OFF');

    // Add Text Button
    const addTextBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '4px 8px', fontSize: '11px' },
      title: 'Attach or Edit Text Callout [Hotkey: T]',
      onclick: () => this.triggerTextOnActiveOrCanvas()
    }, '💬 Text');

    // Swap Ends Button
    const swapEndsBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '4px 9px', fontSize: '10.5px', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.4)' },
      title: 'Swap Terminals: Flips arrowhead to opposite end and relocates text box [Hotkey: X]',
      onclick: () => this.swapActiveCurveTerminals()
    }, '⇄ Swap Ends');

    const addPointBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '4px 8px', fontSize: '11px', color: '#00f2fe' },
      title: 'Add Point: Inserts knot at segment midpoint [Hotkey: +]',
      onclick: () => this.addKnotToActiveCurve()
    }, '➕ Add Point');

    const delPointBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '4px 8px', fontSize: '11px', color: '#ff7b72' },
      title: 'Delete Selected Knot or Entire Curve [Hotkey: Del]',
      onclick: () => this.deleteSelectedEntity()
    }, '➖ Del');

    this.dragLockBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '4px 8px', fontSize: '10.5px' },
      title: 'Lock Distant Points on Drag vs Global Ripple',
      onclick: () => {
        this.stageState.dragLockMode = this.stageState.dragLockMode === 'single' ? 'ripple' : 'single';
        this.dragLockBtn.textContent = this.stageState.dragLockMode === 'single' ? '🔒 Single Knot' : '🌊 Ripple';
        this.showKnotToast(`Move Mode: ${this.stageState.dragLockMode === 'single' ? 'Locked Distant Points' : 'Global Ripple'}`);
      }
    }, '🔒 Single Knot');

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

    ribbon.append(
      this.toolBtns.curve, this.toolBtns.paint, this.colorPickerBtn, this.arrowBtn,
      addTextBtn, swapEndsBtn, addPointBtn, delPointBtn, this.dragLockBtn, hudToggleBtn, undoBtn
    );
    wrap.appendChild(ribbon);

    // Brush Controls Ribbon
    this.brushControlsRibbon = makeElement('div', {
      style: {
        padding: '6px 14px', background: 'rgba(24, 15, 30, 0.94)', borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
        display: 'none', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#f8fafc', flexWrap: 'wrap'
      }
    });

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
      makeElement('strong', { style: { color: '#f59e0b' } }, 'Blockout Paint:'),
      brushSizeSlider, brushSizeLabel,
      softnessSlider, softnessLabel
    );
    wrap.appendChild(this.brushControlsRibbon);

    // Viewport
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

    // 8-Layer Z-Order Stack
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
    if (!this.svgDefs) return;
    let filter = this.svgDefs.querySelector('#qa-brush-blur');
    if (!filter) {
      filter = makeElement('svg:filter', {
        id: 'qa-brush-blur', x: '-30%', y: '-30%', width: '160%', height: '160%'
      });
      this.svgDefs.appendChild(filter);
    }
    filter.innerHTML = `<feGaussianBlur stdDeviation="${this.stageState.brushSoftness || 0}" />`;
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

  // ── Multi-Image Plates & Dynamic Canvas Auto-Bounds ──
  addNewImagePlate(img, x = 60, y = 60) {
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;

    const maxInit = 560;
    if (w > maxInit || h > maxInit) {
      const ratio = Math.min(maxInit / w, maxInit / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    const plate = {
      id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      img: img,
      x: x,
      y: y,
      width: w,
      height: h,
      aspect: w / h
    };

    this.stageState.placedImages.push(plate);
    this.stageState.activeImage = plate;

    if (!this.stageState.baseImage) {
      this.stageState.baseImage = img;
      this.stageState.cropRect = { x: 0, y: 0, width: w, height: h };
    }

    this.renderStage();
    this.showKnotToast(`Added image plate (${w}×${h}px)`);
  }

  computeAutoBounds() {
    const pad = this.stageState.padding || 45;
    let minX = 0, minY = 0, maxX = 680, maxY = 380;

    (this.stageState.placedImages || []).forEach(plate => {
      minX = Math.min(minX, plate.x);
      minY = Math.min(minY, plate.y);
      maxX = Math.max(maxX, plate.x + plate.width);
      maxY = Math.max(maxY, plate.y + plate.height);
    });

    (this.stageState.diffCallouts || []).forEach(diff => {
      const r = diff.radius;
      minX = Math.min(minX, diff.cropX - r - 10);
      maxX = Math.max(maxX, diff.cropX + r + 10);
      minY = Math.min(minY, diff.cropY - r - 10);
      maxY = Math.max(maxY, diff.cropY + r + 10);
    });

    const totalW = Math.max(1100, Math.round((maxX - minX) + (pad * 2)));
    const totalH = Math.max(640, Math.round((maxY - minY) + (pad * 2)));

    this.stageState.canvasWidth = totalW;
    this.stageState.canvasHeight = totalH;

    return {
      totalW, totalH,
      offsetX: Math.round(-minX + pad),
      offsetY: Math.round(-minY + pad)
    };
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

  // ── Smart Knot & Curve Actions ──
  addKnotToActiveCurve() {
    const curve = this.getActiveCurve();
    if (!curve || !curve.vertices || curve.vertices.length < 2) {
      this.showKnotToast('Select a curve to insert an on-curve point');
      return;
    }

    const idx = Math.max(0, Math.min(this._activeKnotIdx || 0, curve.vertices.length - 2));
    const v1 = curve.vertices[idx];
    const v2 = curve.vertices[idx + 1];

    const midPt = [(v1.point[0] + v2.point[0]) / 2, (v1.point[1] + v2.point[1]) / 2];
    const newKnot = new BezierVertex(midPt);
    newKnot.curvature = 1.0;
    newKnot.balance = 1.0;
    newKnot.tangentAngleOffset = 0;

    curve.vertices.splice(idx + 1, 0, newKnot);
    this._activeKnotIdx = idx + 1;

    this.commitCurveGeometryUpdate();
    this.exposeBezierHandles(curve);
    this.showKnotToast(`✓ Point inserted at position ${idx + 2}`);
  }

  toggleArrowhead() {
    this.stageState.hasArrow = !this.stageState.hasArrow;
    if (this.arrowBtn) {
      this.arrowBtn.classList.toggle('primary', this.stageState.hasArrow);
      this.arrowBtn.textContent = this.stageState.hasArrow ? '🏹 Arrow: ON' : '🏹 Arrow: OFF';
    }

    const curve = this.getActiveCurve();
    if (curve) {
      curve.arrowEnd = this.stageState.hasArrow ? 'tip' : 'none';
      this.commitCurveGeometryUpdate();
    }
  }

  triggerTextOnActiveOrCanvas() {
    const curve = this.getActiveCurve();
    if (curve && curve.beziers?.length > 0) {
      const termSeg = (curve.textEnd !== 'tip') ? curve.beziers[curve.beziers.length - 1] : curve.beziers[0];
      const anchorPt = (curve.textEnd !== 'tip') ? termSeg[3] : termSeg[0];
      this._promptInlineTailText(curve, anchorPt, 'left');
    } else {
      const tf = this.computeAutoBounds();
      this.promptDirectTextBadge(tf.totalW / 2 - 40, tf.totalH / 2 - 20);
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
    const existing = document.getElementById('qa-outbound-tangent-ray');
    if (existing) existing.remove();

    const vertices = curveRecord.vertices;
    if (!vertices || vertices.length < 2) return;
    const v = vertices[knotIdx] || vertices[0];
    const prevV = vertices[knotIdx - 1];
    const nextV = vertices[knotIdx + 1];

    const pt = v.point;
    const rayLength = 54;
    const actualDir = this.computeCurveExitVector(curveRecord, knotIdx);
    const actualAngle = Math.atan2(actualDir[1], actualDir[0]);

    let naturalDir = [1, 0];
    if (!prevV && nextV) {
      const dx = v.point[0] - nextV.point[0];
      const dy = v.point[1] - nextV.point[1];
      const l = Math.hypot(dx, dy) || 1;
      naturalDir = [dx / l, dy / l];
    } else if (prevV && !nextV) {
      const dx = v.point[0] - prevV.point[0];
      const dy = v.point[1] - prevV.point[1];
      const l = Math.hypot(dx, dy) || 1;
      naturalDir = [dx / l, dy / l];
    } else if (prevV && nextV) {
      const dx = nextV.point[0] - prevV.point[0];
      const dy = nextV.point[1] - prevV.point[1];
      const l = Math.hypot(dx, dy) || 1;
      naturalDir = [dx / l, dy / l];
    }
    const naturalAngle = Math.atan2(naturalDir[1], naturalDir[0]);

    const isNonDefault = Math.abs(v.tangentAngleOffset || 0) > 0.001;
    const g = makeElement('svg:g', { id: 'qa-outbound-tangent-ray' });

    if (isNonDefault) {
      const naturalEnd = [pt[0] + Math.cos(naturalAngle) * rayLength, pt[1] + Math.sin(naturalAngle) * rayLength];
      g.appendChild(makeElement('svg:line', {
        x1: pt[0], y1: pt[1], x2: naturalEnd[0], y2: naturalEnd[1],
        stroke: 'rgba(0, 242, 254, 0.45)', 'stroke-width': '1.5', 'stroke-dasharray': '2,4',
        style: { pointerEvents: 'none' }
      }));
    }

    const rayEnd = [pt[0] + Math.cos(actualAngle) * rayLength, pt[1] + Math.sin(actualAngle) * rayLength];

    const line = makeElement('svg:line', {
      x1: pt[0], y1: pt[1], x2: rayEnd[0], y2: rayEnd[1],
      stroke: isNonDefault ? '#ffd700' : '#00f2fe',
      'stroke-width': '2.2', 'stroke-linecap': 'round',
      style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }
    });

    const handle = makeElement('svg:circle', {
      className: 'qa-tangent-handle',
      cx: rayEnd[0], cy: rayEnd[1], r: '6.5',
      fill: isNonDefault ? '#ffd700' : '#00f2fe',
      stroke: '#ffffff', 'stroke-width': '2',
      style: { cursor: 'crosshair', filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.8))' },
      title: 'Drag to adjust outbound angle • Snaps to natural baseline'
    });

    let draggingRay = false;
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      draggingRay = true;

      const onRayMove = (ev) => {
        if (!draggingRay) return;
        const rect = this.stageBox.getBoundingClientRect();
        const z = this.stageState.zoom;
        const mX = (ev.clientX - rect.left) / z;
        const mY = (ev.clientY - rect.top) / z;

        const cursorAngle = Math.atan2(mY - pt[1], mX - pt[0]);
        let offsetRad = cursorAngle - naturalAngle;

        while (offsetRad > Math.PI) offsetRad -= Math.PI * 2;
        while (offsetRad < -Math.PI) offsetRad += Math.PI * 2;

        if (Math.abs(offsetRad) < 0.10) {
          offsetRad = 0;
          this.showKnotToast('⚡ Snapped to Natural Zero-Strain Tangent');
        } else if (v._savedConstraint && Math.abs(offsetRad - v._savedConstraint.offset) < 0.10) {
          offsetRad = v._savedConstraint.offset;
          this.showKnotToast('⚡ Locked to Original Tangency');
        }

        v.tangentAngleOffset = offsetRad;
        updateGeometryFn();

        const curAng = naturalAngle + offsetRad;
        const newEnd = [pt[0] + Math.cos(curAng) * rayLength, pt[1] + Math.sin(curAng) * rayLength];
        line.setAttribute('x2', newEnd[0]);
        line.setAttribute('y2', newEnd[1]);
        line.setAttribute('stroke', offsetRad === 0 ? '#00f2fe' : '#ffd700');
        handle.setAttribute('cx', newEnd[0]);
        handle.setAttribute('cy', newEnd[1]);
        handle.setAttribute('fill', offsetRad === 0 ? '#00f2fe' : '#ffd700');
        this.updateDynamicKeyInHUD();
      };

      const onRayUp = () => {
        draggingRay = false;
        window.removeEventListener('mousemove', onRayMove);
        window.removeEventListener('mouseup', onRayUp);
      };

      window.addEventListener('mousemove', onRayMove);
      window.addEventListener('mouseup', onRayUp);
    });

    g.append(line, handle);
    this.controlsLayer.appendChild(g);
  }

  // ── Stationary Segment Midpoint Split Points (t = 0.5) ──
  renderSegmentMidpointIndicators(curveRecord) {
    this.controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());
    if (!curveRecord || !curveRecord.beziers) return;

    curveRecord.beziers.forEach((seg, segIdx) => {
      const midPt = CurveFitter.bezier_q(seg, 0.5);

      const g = makeElement('svg:g', {
        className: 'qa-segment-midpoint-group',
        style: { cursor: 'pointer' },
        title: `Click or drag midpoint to split segment ${segIdx + 1}`
      });

      const hitArea = makeElement('svg:circle', {
        cx: midPt[0], cy: midPt[1], r: '14', fill: 'transparent'
      });

      const dot = makeElement('svg:circle', {
        cx: midPt[0], cy: midPt[1], r: '3.5',
        fill: 'rgba(0, 242, 254, 0.8)', stroke: '#ffffff', 'stroke-width': '1.2',
        style: { transition: 'r 0.15s ease, fill 0.15s ease', pointerEvents: 'none' }
      });

      g.addEventListener('mouseenter', () => {
        dot.setAttribute('r', '5.5');
        dot.setAttribute('fill', '#00f2fe');
        dot.style.filter = 'drop-shadow(0 0 6px #00f2fe)';
      });

      g.addEventListener('mouseleave', () => {
        dot.setAttribute('r', '3.5');
        dot.setAttribute('fill', 'rgba(0, 242, 254, 0.8)');
        dot.style.filter = '';
      });

      let isDraggingMid = false;
      let newKnot = null;

      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDraggingMid = true;

        if (!curveRecord.vertices || curveRecord.vertices.length === 0) {
          curveRecord.vertices = this.beziersToVertices(curveRecord.beziers);
        }

        newKnot = new BezierVertex([midPt[0], midPt[1]]);
        newKnot.curvature = 1.0;
        newKnot.balance = 1.0;
        newKnot.tangentAngleOffset = 0;

        curveRecord.vertices.splice(segIdx + 1, 0, newKnot);
        this._activeKnotIdx = segIdx + 1;

        this.commitCurveGeometryUpdate();
        this.exposeBezierHandles(curveRecord);

        const onMidDrag = (ev) => {
          if (!isDraggingMid) return;
          const rect = this.stageBox.getBoundingClientRect();
          const z = this.stageState.zoom;
          newKnot.point[0] = (ev.clientX - rect.left) / z;
          newKnot.point[1] = (ev.clientY - rect.top) / z;
          this.commitCurveGeometryUpdate();
          this.exposeBezierHandles(curveRecord);
        };

        const onMidUp = () => {
          isDraggingMid = false;
          window.removeEventListener('mousemove', onMidDrag);
          window.removeEventListener('mouseup', onMidUp);
          this.showKnotToast(`✓ Inserted knot #${segIdx + 2}`);
        };

        window.addEventListener('mousemove', onMidDrag);
        window.addEventListener('mouseup', onMidUp);
      });

      g.append(hitArea, dot);
      this.controlsLayer.appendChild(g);
    });
  }

  // ── Unified Smart Curve Terminals ──
  swapActiveCurveTerminals() {
    const curve = this.getActiveCurve();
    if (!curve || !curve.beziers || curve.beziers.length === 0) {
      this.showKnotToast('No active curve to swap');
      return;
    }

    curve.arrowEnd = (curve.arrowEnd === 'tail') ? 'tip' : 'tail';
    curve.textEnd = (curve.arrowEnd === 'tail') ? 'tip' : 'tail';

    this.commitCurveGeometryUpdate();
    this.renderStage();
    this.showKnotToast(`⇄ Swapped: Arrow is now at ${curve.arrowEnd.toUpperCase()}`);
  }

  // ── Direct Typography Tool ──
  promptDirectTextBadge(x, y) {
    this._promptInlineTailText(null, [x, y], 'left');
  }

  _promptInlineTailText(curveRecord, anchorPt, justifySide = 'left') {
      const existing = document.getElementById('qa-inline-tail-editor');
      if (existing) existing.remove();

      const isLeft = (justifySide === 'left');
      const width = 270;
      const posX = isLeft ? anchorPt[0] + 6 : anchorPt[0] - width - 6;
      const posY = anchorPt[1] - 22;

      let fontF = curveRecord?.fontFamily || this.stageState.fontFamily;
      let fontS = curveRecord?.fontSize || this.stageState.fontSize;
      let boxStyle = curveRecord?.boxStyle || 'bracket';
      const color = curveRecord?.color || this.stageState.currentColor;

      const editorWrap = makeElement('div', {
        id: 'qa-inline-tail-editor',
        style: {
          position: 'absolute', top: `${posY}px`, left: `${posX}px`, width: `${width}px`,
          zIndex: '70', display: 'flex', flexDirection: 'column', gap: '8px'
        }
      });

      const textarea = makeElement('textarea', {
        placeholder: 'Type callout text...',
        value: curveRecord?.text || '',
        rows: 1,
        style: {
          width: '100%', minHeight: '38px', maxHeight: '160px', padding: '6px 10px',
          fontSize: `${fontS}px`, fontFamily: fontF, fontWeight: 'bold', lineHeight: '1.25',
          color: color, background: boxStyle === 'box' ? 'rgba(15, 23, 42, 0.96)' : 'rgba(0, 0, 0, 0.82)',
          border: boxStyle === 'box' ? `2px solid ${color}` : (boxStyle === 'bracket' ? `none` : '1.5px dashed rgba(255, 255, 255, 0.4)'),
          borderBottom: (boxStyle === 'bracket') ? `2.5px solid ${color}` : undefined,
          borderLeft: (boxStyle === 'bracket' && isLeft) ? `2.5px solid ${color}` : undefined,
          borderRight: (boxStyle === 'bracket' && !isLeft) ? `2.5px solid ${color}` : undefined,
          borderRadius: boxStyle === 'box' ? '6px' : '0', outline: 'none', resize: 'none',
          boxSizing: 'border-box', textAlign: isLeft ? 'left' : 'right',
          boxShadow: '0 8px 24px rgba(0,0,0,0.85)'
        }
      });

      const autoGrow = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(38, textarea.scrollHeight)}px`;
      };

      // Position controls bar comfortably offset below textarea so it never blocks drawing
      const controlsRow = makeElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
          background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '8px', padding: '5px 8px', fontSize: '10px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.7)'
        }
      });

      const styleBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '2px 6px', fontSize: '10px' },
        title: 'Cycle Frame: 2-Side Bracket ➔ 4-Side Box ➔ Plain',
        onclick: (e) => {
          e.stopPropagation();
          const styles = ['bracket', 'box', 'none'];
          boxStyle = styles[(styles.indexOf(boxStyle) + 1) % styles.length];
          if (curveRecord) curveRecord.boxStyle = boxStyle;
          styleBtn.textContent = boxStyle === 'bracket' ? '◺ Bracket' : (boxStyle === 'box' ? '◻ Box' : 'Plain');
          textarea.style.border = boxStyle === 'box' ? `2px solid ${color}` : (boxStyle === 'bracket' ? `none` : '1.5px dashed rgba(255, 255, 255, 0.4)');
          textarea.style.borderBottom = (boxStyle === 'bracket') ? `2.5px solid ${color}` : '';
          textarea.style.borderLeft = (boxStyle === 'bracket' && isLeft) ? `2.5px solid ${color}` : '';
          textarea.style.borderRight = (boxStyle === 'bracket' && !isLeft) ? `2.5px solid ${color}` : '';
          textarea.style.borderRadius = boxStyle === 'box' ? '6px' : '0';
          if (curveRecord) this.renderStage();
        }
      }, boxStyle === 'bracket' ? '◺ Bracket' : (boxStyle === 'box' ? '◻ Box' : 'Plain'));

      const fontSelect = makeElement('select', {
        style: {
          background: '#0d1117', color: '#00f2fe', border: '1px solid #30363d',
          borderRadius: '4px', padding: '2px 4px', fontSize: '9.5px', fontFamily: 'monospace', outline: 'none'
        },
        onchange: (e) => {
          fontF = e.target.value;
          this.ensureFontLoaded(fontF);
          if (curveRecord) curveRecord.fontFamily = fontF;
          textarea.style.fontFamily = fontF;
          autoGrow();
          if (curveRecord) this.renderStage();
        }
      }, [
        makeElement('option', { value: "'Architects Daughter', cursive, sans-serif", selected: fontF.includes('Architects') }, "Architect"),
        makeElement('option', { value: "monospace", selected: fontF === 'monospace' }, "Mono"),
        makeElement('option', { value: "'Plus Jakarta Sans', system-ui, sans-serif", selected: fontF.includes('Jakarta') }, "Sans")
      ]);

      const sizeSlider = makeElement('input', {
        type: 'range', min: '14', max: '48', value: String(fontS),
        style: { width: '55px', accentColor: '#00f2fe', cursor: 'pointer' },
        oninput: (e) => {
          fontS = parseInt(e.target.value, 10);
          if (curveRecord) curveRecord.fontSize = fontS;
          textarea.style.fontSize = `${fontS}px`;
          autoGrow();
          if (curveRecord) this.renderStage();
        }
      });

      let committed = false;
      let onOutClick = null;

      const commit = () => {
        if (committed) return;
        committed = true;
        if (onOutClick) window.removeEventListener('mousedown', onOutClick);

        const textVal = textarea.value.trim();
        if (curveRecord) {
          curveRecord.text = textVal;
          curveRecord.justifySide = isLeft ? 'left' : 'right';
          curveRecord.fontSize = fontS;
          curveRecord.fontFamily = fontF;
          curveRecord.boxStyle = boxStyle;
        } else if (textVal) {
          this.stageState.annotations.push({
            id: 'text_' + Date.now(),
            type: 'text_badge',
            x: anchorPt[0],
            y: anchorPt[1],
            text: textVal,
            fontSize: fontS,
            fontFamily: fontF,
            boxStyle: boxStyle,
            color: color
          });
        }

        editorWrap.remove();
        this.renderStage();
      };

      const okBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '2px 8px', fontSize: '10px', background: '#238636', borderColor: '#2ea043' },
        onclick: (e) => { e.stopPropagation(); commit(); }
      }, '✓ OK');

      controlsRow.append(styleBtn, fontSelect, sizeSlider, okBtn);
      editorWrap.append(textarea, controlsRow);
      this.stageBox.appendChild(editorWrap);

      textarea.addEventListener('input', autoGrow);
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault(); commit();
        } else if (e.key === 'Escape') {
          e.preventDefault(); textarea.value = ''; commit();
        }
      });

      onOutClick = (ev) => {
        if (!editorWrap.contains(ev.target)) commit();
      };

      setTimeout(() => {
        textarea.focus();
        autoGrow();
        window.addEventListener('mousedown', onOutClick);
      }, 40);
    }
  // ── Blockout Painting Methods ──
  previewBlockoutRect(p1, p2) {
    const x = Math.min(p1[0], p2[0]), y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]), h = Math.abs(p2[1] - p1[1]);
    if (!this.svgSurface._rectPreview) {
      this.svgSurface._rectPreview = makeElement('svg:rect', {
        fill: this.stageState.brushColor, opacity: '0.9',
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
    const x = Math.min(p1[0], p2[0]), y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]), h = Math.abs(p2[1] - p1[1]);
    if (w < 4 || h < 4) return;
    const rectEl = makeElement('svg:rect', {
      x, y, width: w, height: h, fill: this.stageState.brushColor,
      ...(this.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
    });
    this.paintLayer.appendChild(rectEl);
    this.stageState.annotations.push({ type: 'paint', shape: 'rect', element: rectEl, bounds: { x, y, w, h } });
    this.renderStage();
  }

  previewBlockoutOval(p1, p2) {
    const cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2;
    const rx = Math.abs(p2[0] - p1[0]) / 2, ry = Math.abs(p2[1] - p1[1]) / 2;
    if (!this.svgSurface._ovalPreview) {
      this.svgSurface._ovalPreview = makeElement('svg:ellipse', {
        fill: this.stageState.brushColor, opacity: '0.9',
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
    const cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2;
    const rx = Math.abs(p2[0] - p1[0]) / 2, ry = Math.abs(p2[1] - p1[1]) / 2;
    if (rx < 4 || ry < 4) return;
    const ovalEl = makeElement('svg:ellipse', {
      cx, cy, rx, ry, fill: this.stageState.brushColor,
      ...(this.stageState.brushSoftness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
    });
    this.paintLayer.appendChild(ovalEl);
    this.stageState.annotations.push({ type: 'paint', shape: 'oval', element: ovalEl, bounds: { cx, cy, rx, ry } });
    this.renderStage();
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
    if (this._isDrawingActive) {
      this.clearHoverHighlight();
      return;
    }

    const hit = this.findNearestCurveAtPoint(mousePt, this._hoveredCurve ? 36 : 24);

    if (hit) {
      if (this._hoveredCurve !== hit.ann) {
        this.clearHoverHighlight();
        this._hoveredCurve = hit.ann;
        this.applyCurveGlow(hit.ann);
        this.renderEphemeralKnotHandles(hit.ann);
        this.renderSegmentMidpointIndicators(hit.ann);
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
        id: 'qa-active-hover-glow', fill: 'none', stroke: 'rgba(0, 242, 254, 0.3)',
        'stroke-width': '20', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        style: { pointerEvents: 'none', filter: 'drop-shadow(0 0 10px rgba(0, 242, 254, 0.6))' }
      });
      this.glowLayer.appendChild(glow);
    }
    glow.setAttribute('d', d);
  }

  clearHoverHighlight() {
    this._hoveredCurve = null;
    const glow = document.getElementById('qa-active-hover-glow');
    if (glow) glow.remove();
    this.controlsLayer.querySelectorAll('.qa-segment-midpoint-group').forEach(el => el.remove());
    this.controlsLayer.querySelectorAll('.qa-ephemeral-knots').forEach(el => el.remove());
  }

  deleteSelectedEntity() {
    const curve = this.getActiveCurve();
    if (!curve) {
      this.showKnotToast('No curve selected to delete');
      return;
    }

    const vertices = curve.vertices;

    if (vertices && vertices.length > 2 && this._activeKnotIdx !== null) {
      const knotNum = this._activeKnotIdx + 1;
      vertices.splice(this._activeKnotIdx, 1);
      this._activeKnotIdx = Math.max(0, Math.min(this._activeKnotIdx, vertices.length - 1));
      this.commitCurveGeometryUpdate();
      this.exposeBezierHandles(curve);
      this.showKnotToast(`🗑️ Deleted knot #${knotNum} (${vertices.length} remaining)`);
      this.updateDynamicKeyInHUD();
      return;
    }

    const idx = this.stageState.annotations.indexOf(curve);
    if (idx !== -1) {
      this.stageState.annotations.splice(idx, 1);
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

    const arrowShadow = makeElement('svg:path', {
      d: arrowD, transform: `translate(${shadowOffset}, ${shadowOffset})`,
      stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5.5', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    const arrowForeground = makeElement('svg:path', {
      d: arrowD, stroke: color, 'stroke-width': '3.2', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });

    return { shadow: arrowShadow, foreground: arrowForeground };
  }

  // ── Blended Interaction Loop (Draw & Tweak Coexisting) ──
  setupInteractions() {
    this.setupKeyInMatrixHud();

    let isDrawing = false;
    let strokePoints = [];
    let startPt = null;
    let hasExceededDeadzone = false;

    let deadzoneCircle = null;
    let tipPointIndicator = null;
    let activeTetherLine = null;

    const getStagePt = (e) => {
      const rect = this.stageBox.getBoundingClientRect();
      const z = this.stageState.zoom;
      return [(e.clientX - rect.left) / z, (e.clientY - rect.top) / z];
    };

    const cleanupGestureIndicators = () => {
      if (deadzoneCircle) { deadzoneCircle.remove(); deadzoneCircle = null; }
      if (tipPointIndicator) { tipPointIndicator.remove(); tipPointIndicator = null; }
      if (activeTetherLine) { activeTetherLine.remove(); activeTetherLine = null; }
      if (this.svgSurface._preview) { this.svgSurface._preview.remove(); this.svgSurface._preview = null; }
    };

    if (!this._hasBoundGlobalKeys) {
      this._hasBoundGlobalKeys = true;

      window.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

        if ((e.key === 'h' || e.key === 'H') && !this._metaHelpActive) {
          this._metaHelpActive = true;
          this.showMetaHelpOverlay();
          return;
        }

        if (e.code === 'Space') {
          e.preventDefault();
          this.executeKeyInCommand('toggle_tool', e);
          return;
        }
        if (e.key === 'a' || e.key === 'A') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.toggleArrowhead();
            return;
          }
        }
        if (e.key === 't' || e.key === 'T') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.triggerTextOnActiveOrCanvas();
            return;
          }
        }
        if (e.key === 'x' || e.key === 'X') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.swapActiveCurveTerminals();
            return;
          }
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          this.executeKeyInCommand('next_knot', e);
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.executeKeyInCommand('toggle_cusp', e);
            return;
          }
        }
        if (e.key === 's' || e.key === 'S') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.executeKeyInCommand('straighten', e);
            return;
          }
        }
        if (e.key === 'r' || e.key === 'R') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.executeKeyInCommand('reset_knot', e);
            return;
          }
        }
        if (e.key === '+' || e.key === '=') {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.addKnotToActiveCurve();
            return;
          }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          this.deleteSelectedEntity();
          return;
        }
        if (e.key === 'Enter') {
          if (this._penNodes && this._penNodes.length >= 2) {
            e.preventDefault();
            this.commitPenNodes();
            return;
          }
        }
        if (e.key === 'Escape') {
          if (this._penNodes && this._penNodes.length > 0) {
            e.preventDefault();
            this.cancelPenNodes();
            return;
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

    this.svgSurface.addEventListener('mousedown', (e) => {
      if (e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle, .qa-segment-midpoint-group, .qa-movable-label-group, .qa-image-plate-control, #qa-keyin-matrix-hud')) return;

      const pt = getStagePt(e);

      // Direct Text Tool Placement
      if (this.stageState.activeTool === 'text') {
        this.promptDirectTextBadge(pt[0], pt[1]);
        return;
      }

      const isForceDraw = e.shiftKey;

      if (!isForceDraw) {
        const hit = this.findNearestCurveAtPoint(pt, 24);
        if (hit) {
          this.exposeBezierHandles(hit.ann);
          this.renderSegmentMidpointIndicators(hit.ann);
          this.updateDynamicKeyInHUD();
          return;
        }
      }

      if (this._handRestActive) {
        this._handRestActive = false;
        isDrawing = true;
        this._isDrawingActive = true;
        this.hideClutchHandRestBadge();
        return;
      }

      if (this._penNodes && this._penNodes.length > 0) {
        this._penNodes.push(pt);
        this.renderPenNodesMarkers();
        this.showKnotToast(`Point ${this._penNodes.length} placed • Right-click or Enter to finish`);
        return;
      }

      this.controlsLayer.innerHTML = '';
      this.stageState.selectedItem = null;

      isDrawing = true;
      this._isDrawingActive = true;
      startPt = pt;
      hasExceededDeadzone = false;
      strokePoints = [pt];

      deadzoneCircle = makeElement('svg:circle', {
        id: 'qa-deadzone-circle', cx: pt[0], cy: pt[1], r: String(this.stageState.tetherLength),
        fill: 'rgba(255, 255, 255, 0.12)', stroke: 'rgba(255, 255, 255, 0.75)',
        'stroke-width': '1.2', 'stroke-dasharray': '3,3', style: { pointerEvents: 'none' }
      });
      this.controlsLayer.appendChild(deadzoneCircle);

      tipPointIndicator = makeElement('svg:circle', {
        id: 'qa-tip-point', cx: pt[0], cy: pt[1], r: '5', fill: '#ffffff',
        stroke: '#00e676', 'stroke-width': '2', style: { pointerEvents: 'none' }
      });
      this.controlsLayer.appendChild(tipPointIndicator);
    });

    this.svgSurface.addEventListener('dblclick', (e) => {
      if (e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle, .qa-segment-midpoint-group, .qa-movable-label-group, .qa-image-plate-control')) return;
      const pt = getStagePt(e);
      this.promptDirectTextBadge(pt[0], pt[1]);
    });

    window.addEventListener('mousemove', (e) => {
      const pt = getStagePt(e);

      if (!isDrawing && !this._penNodes) {
        this.updateSpatialHover(pt);
      }

      if (this._penNodes && this._penNodes.length > 0) {
        this.updatePenTentativeSpline(pt);
        return;
      }

      if (!isDrawing) return;

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

      const dFromStart = Math.hypot(pt[0] - startPt[0], pt[1] - startPt[1]);
      if (!hasExceededDeadzone && dFromStart > this.stageState.tetherLength) {
        hasExceededDeadzone = true;
      }

      if (!hasExceededDeadzone) {
        if (tipPointIndicator) {
          tipPointIndicator.setAttribute('cx', startPt[0]);
          tipPointIndicator.setAttribute('cy', startPt[1]);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        this._clutchActive = true;
        const last = strokePoints[strokePoints.length - 1];
        const newR = Math.max(12, Math.min(180, Math.hypot(pt[0] - last[0], pt[1] - last[1])));
        this.stageState.tetherLength = Math.round(newR);

        if (!activeTetherLine) {
          activeTetherLine = makeElement('svg:line', {
            id: 'qa-drawstring-line', stroke: '#ffd700', 'stroke-width': '2.2', 'stroke-dasharray': '4,3'
          });
          this.controlsLayer.appendChild(activeTetherLine);
        }
        activeTetherLine.setAttribute('x1', last[0]);
        activeTetherLine.setAttribute('y1', last[1]);
        activeTetherLine.setAttribute('x2', pt[0]);
        activeTetherLine.setAttribute('y2', pt[1]);
        this.showKnotToast(`⏸️ Tether: ${Math.round(newR)}px (Hold Ctrl)`);
        return;
      } else {
        this._clutchActive = false;
      }

      if (!activeTetherLine) {
        activeTetherLine = makeElement('svg:line', {
          id: 'qa-drawstring-line', stroke: '#ffffff', 'stroke-width': '2.0'
        });
        this.controlsLayer.appendChild(activeTetherLine);
      }

      const last = strokePoints[strokePoints.length - 1];
      const dist = Math.hypot(pt[0] - last[0], pt[1] - last[1]);

      if (dist > this.stageState.tetherLength) {
        const ux = (pt[0] - last[0]) / dist;
        const uy = (pt[1] - last[1]) / dist;
        const leadPt = [pt[0] - ux * this.stageState.tetherLength, pt[1] - uy * this.stageState.tetherLength];
        strokePoints.push(leadPt);

        if (tipPointIndicator) {
          tipPointIndicator.setAttribute('cx', leadPt[0]);
          tipPointIndicator.setAttribute('cy', leadPt[1]);
        }
      }

      const curTip = strokePoints[strokePoints.length - 1];
      activeTetherLine.setAttribute('x1', curTip[0]);
      activeTetherLine.setAttribute('y1', curTip[1]);
      activeTetherLine.setAttribute('x2', pt[0]);
      activeTetherLine.setAttribute('y2', pt[1]);

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

      if (e.ctrlKey || e.metaKey || this._clutchActive) {
        this._handRestActive = true;
        isDrawing = false;
        this._isDrawingActive = false;
        this.showClutchHandRestBadge(strokePoints[strokePoints.length - 1]);
        return;
      }

      isDrawing = false;
      this._isDrawingActive = false;
      cleanupGestureIndicators();

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

      if (!hasExceededDeadzone) {
        this._penNodes = [startPt];
        this.renderPenNodesMarkers();
        this.showKnotToast('Point 1 placed. Click for next • Right-click or Enter to finish');
        strokePoints = [];
        return;
      }

      if (strokePoints.length >= 2) {
        const beziers = (typeof CurveFitter !== 'undefined') ? CurveFitter.fit(strokePoints, 4) : [];
        if (beziers && beziers.length > 0) {
          this.commitSpline(beziers, this.stageState.currentColor, this.stageState.hasArrow);
        }
      }
      strokePoints = [];
    });

    this.stageBox.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle')) return;

      if (this._penNodes && this._penNodes.length >= 2) {
        this.commitPenNodes();
        return;
      } else if (this._penNodes) {
        this.cancelPenNodes();
        return;
      }

      if (isDrawing) {
        isDrawing = false;
        this._isDrawingActive = false;
        cleanupGestureIndicators();
        strokePoints = [];
        this.showKnotToast('Stroke canceled');
      }
    });
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
                img.onload = () => {
                  this.addNewImagePlate(img, 80, 80);
                };
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

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const rect = this.stageBox.getBoundingClientRect();
      const z = this.stageState.zoom;
      const dropX = Math.round((e.clientX - rect.left) / z);
      const dropY = Math.round((e.clientY - rect.top) / z);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              this.addNewImagePlate(img, dropX + i * 25, dropY + i * 25);
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
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
    let badge = document.getElementById('qa-clutch-rest-badge');
    if (!badge) {
      badge = makeElement('div', {
        id: 'qa-clutch-rest-badge',
        style: {
          position: 'absolute', background: 'rgba(245, 158, 11, 0.95)', color: '#070a13',
          padding: '6px 14px', borderRadius: '20px', fontFamily: 'monospace', fontSize: '11px',
          fontWeight: 'bold', zIndex: '90', pointerEvents: 'none'
        }
      }, '⏸️ Hand-Rest Active — Click down & release Ctrl to resume');
      this.stageBox.appendChild(badge);
    }
    if (tipPt) {
      badge.style.left = `${tipPt[0] + 16}px`;
      badge.style.top = `${tipPt[1] - 28}px`;
    }
    badge.style.display = 'block';
  }

  hideClutchHandRestBadge() {
    const b = document.getElementById('qa-clutch-rest-badge');
    if (b) b.remove();
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
      d, transform: `translate(${shadowOffset}, ${shadowOffset})`,
      stroke: shadowColor, 'stroke-width': '5.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
    });

    const splinePath = makeElement('svg:path', {
      d, stroke: color, 'stroke-width': '3.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
    });

    const vertices = this.beziersToVertices(beziers);

    const curveRecord = {
      id: 'curve_' + Date.now(),
      type: 'curve',
      beziers,
      vertices,
      color,
      arrowEnd: hasArrow ? 'tip' : 'none',
      textEnd: 'tail',
      text: '',
      hasTextBox: this.stageState.hasBorder,
      fontFamily: this.stageState.fontFamily,
      fontSize: this.stageState.fontSize || 22,
      elements: [shadowPath, splinePath]
    };

    this.shadowLayer.appendChild(shadowPath);
    this.strokeLayer.appendChild(splinePath);

    this.stageState.annotations.push(curveRecord);
    this.commitCurveGeometryUpdate();
    this.exposeBezierHandles(curveRecord);
    this.renderSegmentMidpointIndicators(curveRecord);
    this.renderStage();
    this.updateDynamicKeyInHUD();

    // Auto-prompt inline text immediately at the tail so you can just type right away!
    const termSeg = beziers[beziers.length - 1];
    setTimeout(() => {
      this._promptInlineTailText(curveRecord, termSeg[3], 'left');
    }, 40);
  }

  // ── Stable Knot Dragging (Single-Knot Lock vs Ripple) ──
  exposeBezierHandles(curveRecord) {
    this.controlsLayer.innerHTML = '';
    if (!curveRecord || !curveRecord.vertices) return;

    this.stageState.selectedItem = curveRecord;
    const vertices = curveRecord.vertices;

    vertices.forEach((v, idx) => {
      const isTip = (idx === 0 && curveRecord.arrowEnd === 'tip');
      const isTail = (idx === vertices.length - 1 && curveRecord.arrowEnd === 'tail');
      const isSelected = (idx === this._activeKnotIdx);

      const fatTarget = makeElement('svg:circle', {
        cx: v.point[0], cy: v.point[1], r: '14', fill: 'transparent',
        style: { cursor: 'move', pointerEvents: 'all' }
      });

      let nodeCircle;
      if (isTip || isTail) {
        nodeCircle = makeElement('svg:circle', {
          cx: v.point[0], cy: v.point[1], r: '3.5',
          fill: 'none', stroke: isSelected ? '#00f2fe' : '#ffd700',
          'stroke-width': isSelected ? '2.5' : '1.5',
          className: 'qa-on-curve-knot-handle',
          style: { pointerEvents: 'none', filter: isSelected ? 'drop-shadow(0 0 6px #00f2fe)' : 'none' }
        });
      } else {
        nodeCircle = makeElement('svg:circle', {
          cx: v.point[0], cy: v.point[1],
          r: isSelected ? '6.5' : '3.5',
          fill: isSelected ? '#00f2fe' : '#00e676',
          stroke: '#ffffff',
          'stroke-width': isSelected ? '2' : '1.2',
          className: 'qa-on-curve-knot-handle',
          style: { pointerEvents: 'none', filter: isSelected ? 'drop-shadow(0 0 8px #00f2fe)' : 'none' }
        });
      }

      fatTarget.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (vertices.length <= 2) {
          this.showKnotToast('⚠️ Curve must have at least 2 points');
          return;
        }
        vertices.splice(idx, 1);
        this._activeKnotIdx = Math.max(0, idx - 1);
        this.commitCurveGeometryUpdate();
        this.exposeBezierHandles(curveRecord);
        this.renderSegmentMidpointIndicators(curveRecord);
        this.showKnotToast(`🗑️ Deleted knot #${idx + 1}`);
      });

      let dragging = false;
      fatTarget.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        this._activeKnotIdx = idx;
        dragging = true;

        if (!v._savedConstraint) {
          v._savedConstraint = {
            offset: v.tangentAngleOffset || 0,
            curvature: v.curvature || 1.0,
            balance: v.balance || 1.0
          };
        }

        v.tangentAngleOffset = 0;

        const onDrag = (ev) => {
          if (!dragging) return;
          const rect = this.stageBox.getBoundingClientRect();
          const z = this.stageState.zoom;

          // ONLY update dragged point coordinate; other knots remain strictly fixed
          v.point[0] = (ev.clientX - rect.left) / z;
          v.point[1] = (ev.clientY - rect.top) / z;

          nodeCircle.setAttribute('cx', v.point[0]);
          nodeCircle.setAttribute('cy', v.point[1]);
          fatTarget.setAttribute('cx', v.point[0]);
          fatTarget.setAttribute('cy', v.point[1]);

          const localScope = (this.stageState.dragLockMode === 'single')
            ? { start: Math.max(0, idx - 1), end: Math.min(vertices.length - 1, idx + 1) }
            : null;

          this.commitCurveGeometryUpdate(localScope);
          this.renderOutboundTangentRay(curveRecord, idx, () => this.commitCurveGeometryUpdate());
        };

        const onUp = () => {
          dragging = false;
          window.removeEventListener('mousemove', onDrag);
          window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', onUp);
      });

      this.controlsLayer.appendChild(fatTarget);
      this.controlsLayer.appendChild(nodeCircle);
    });

    this.renderOutboundTangentRay(curveRecord, this._activeKnotIdx, () => this.commitCurveGeometryUpdate());
    this.renderSegmentMidpointIndicators(curveRecord);
    this.updateDynamicKeyInHUD();
  }

  commitCurveGeometryUpdate(affectedRange = null) {
      const curve = this.getActiveCurve();
      if (!curve || !curve.vertices || curve.vertices.length < 2) return;

      // Respect affectedRange: only adjacent control points recalculate in Single Knot mode
      curve.beziers = this.verticesToBeziers(curve.vertices, affectedRange);
      const [shadowEl, splineEl] = curve.elements;

      let d = 'M ' + curve.beziers[0][0].join(' ');
      for (let i = 0; i < curve.beziers.length; i++) {
        const [start, cp1, cp2, end] = curve.beziers[i];
        d += ` C ${cp1.join(' ')}, ${cp2.join(' ')}, ${end.join(' ')}`;
      }
      if (splineEl) splineEl.setAttribute('d', d);
      if (shadowEl) shadowEl.setAttribute('d', d);

      if (curve._arrowFg) { curve._arrowFg.remove(); curve._arrowFg = null; }
      if (curve._arrowSh) { curve._arrowSh.remove(); curve._arrowSh = null; }

      if (curve.arrowEnd === 'tip') {
        const p0 = curve.beziers[0][0];
        const p1 = curve.beziers[0][1];
        const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
        const arrow = this.renderConcaveArrowhead(p0, [(p1[0] - p0[0]) / dist, (p1[1] - p0[1]) / dist], curve.color, 2.0);
        curve._arrowSh = arrow.shadow;
        curve._arrowFg = arrow.foreground;
        this.shadowLayer.appendChild(arrow.shadow);
        this.strokeLayer.appendChild(arrow.foreground);
      } else if (curve.arrowEnd === 'tail') {
        const lastSeg = curve.beziers[curve.beziers.length - 1];
        const p2 = lastSeg[2];
        const p3 = lastSeg[3];
        const dist = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) || 1;
        const arrow = this.renderConcaveArrowhead(p3, [(p2[0] - p3[0]) / dist, (p2[1] - p3[1]) / dist], curve.color, 2.0);
        curve._arrowSh = arrow.shadow;
        curve._arrowFg = arrow.foreground;
        this.shadowLayer.appendChild(arrow.shadow);
        this.strokeLayer.appendChild(arrow.foreground);
      }

      this.renderStage();
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
    if (!beziers || beziers.length === 0) return [];
    const n = beziers.length;
    const vertices = [];

    for (let i = 0; i <= n; i++) {
      const pt = (i < n) ? beziers[i][0].slice(0, 2) : beziers[n - 1][3].slice(0, 2);
      const v = new BezierVertex(pt);
      v.tangentAngleOffset = 0;
      v.curvature = 1.0;
      v.balance = 1.0;
      vertices.push(v);
    }

    if (typeof UpdateControlPoints !== 'undefined') {
      UpdateControlPoints.run(vertices, 6);
    }
    return vertices;
  }

  verticesToBeziers(vertices, affectedRange = null) {
    if (!vertices || vertices.length < 2) return [];
    if (typeof UpdateControlPoints !== 'undefined') {
      UpdateControlPoints.run(vertices, 6, affectedRange);
    }

    const beziers = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      beziers.push([
        [vertices[i].point[0], vertices[i].point[1]],
        [vertices[i].controlPoints[1][0], vertices[i].controlPoints[1][1]],
        [vertices[i + 1].controlPoints[0][0], vertices[i + 1].controlPoints[0][1]],
        [vertices[i + 1].point[0], vertices[i + 1].point[1]]
      ]);
    }
    return beziers;
  }

  renderEphemeralKnotHandles(curveRecord) {
    const g = makeElement('svg:g', { className: 'qa-ephemeral-knots' });
    (curveRecord.vertices || []).forEach(v => {
      g.appendChild(makeElement('svg:circle', {
        cx: v.point[0], cy: v.point[1], r: '3.5', fill: '#00e676', stroke: '#ffffff', 'stroke-width': '1.2',
        style: { pointerEvents: 'none' }
      }));
    });
    this.controlsLayer.appendChild(g);
  }

  setupKeyInMatrixHud() {
      let hud = document.getElementById('qa-keyin-matrix-hud');

      if (!this._hudPos) {
        try {
          const saved = JSON.parse(localStorage.getItem('quoratoys_hud_pos') || 'null');
          this._hudPos = saved || { left: 24, top: 80 };
        } catch (e) {
          this._hudPos = { left: 24, top: 80 };
        }
      }

      this._hudPos.left = Math.max(8, Math.min(window.innerWidth - 280, this._hudPos.left));
      this._hudPos.top = Math.max(8, Math.min(window.innerHeight - 80, this._hudPos.top));

      if (hud) {
        hud.style.left = `${this._hudPos.left}px`;
        hud.style.top = `${this._hudPos.top}px`;
        hud.style.display = 'flex';
        return;
      }

      this._hudCollapsed = false;
      this._hudShowDetails = false;

      hud = makeElement('div', {
        id: 'qa-keyin-matrix-hud',
        style: {
          position: 'fixed', top: `${this._hudPos.top}px`, left: `${this._hudPos.left}px`,
          zIndex: '2147483640', background: 'rgba(9, 13, 22, 0.96)',
          border: '1.5px solid rgba(0, 242, 254, 0.45)', borderRadius: '10px', padding: '0',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.9), 0 0 16px rgba(0, 242, 254, 0.25)',
          fontFamily: 'monospace', fontSize: '11px', color: '#f8fafc',
          backdropFilter: 'blur(14px)', userSelect: 'none', pointerEvents: 'auto',
          minWidth: '250px', maxWidth: '320px', overflow: 'hidden'
        }
      });

      const header = makeElement('div', {
        id: 'qa-keyin-hud-header',
        style: {
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 10px', background: 'rgba(15, 23, 42, 0.98)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)', cursor: 'grab', touchAction: 'none'
        }
      }, [
        makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
          makeElement('span', { style: { color: '#64748b', fontSize: '11px' } }, '⋮⋮'),
          makeElement('strong', { style: { color: '#00f2fe', fontSize: '11px' } }, 'KEY-IN MATRIX'),
          makeElement('span', { style: { fontSize: '9px', color: '#10b981', fontWeight: 'bold' } }, '● Active')
        ]),
        makeElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } }, [
          (this._hudDetailsBtn = makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '1px 5px', fontSize: '9px' },
            title: 'Expand detailed shortcut explanations',
            onclick: (e) => {
              e.stopPropagation();
              this._hudShowDetails = !this._hudShowDetails;
              this._hudDetailsBtn.textContent = this._hudShowDetails ? '▲ Compact' : '▼ Details';
              this.renderKeyInMatrixRows();
            }
          }, '▼ Details')),
          (this._hudToggleBtn = makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '1px 5px', fontSize: '10px', lineHeight: '1' },
            title: 'Minimize / Expand palette',
            onclick: (e) => {
              e.stopPropagation();
              this._hudCollapsed = !this._hudCollapsed;
              this._hudBodyWrapper.style.display = this._hudCollapsed ? 'none' : 'flex';
              this._hudToggleBtn.textContent = this._hudCollapsed ? '+' : '−';
            }
          }, '−')),
          makeElement('button', {
            className: 'dr-nav-btn',
            style: { padding: '1px 5px', fontSize: '10px', color: '#ff7b72', lineHeight: '1' },
            title: 'Close HUD',
            onclick: (e) => {
              e.stopPropagation();
              hud.style.display = 'none';
            }
          }, '✕')
        ])
      ]);

      let isDraggingHud = false;
      let startX = 0, startY = 0;
      let initialX = 0, initialY = 0;

      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDraggingHud = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = parseFloat(hud.style.left) || this._hudPos.left;
        initialY = parseFloat(hud.style.top) || this._hudPos.top;
        header.style.cursor = 'grabbing';
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDraggingHud) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const newLeft = Math.max(8, Math.min(window.innerWidth - 260, initialX + dx));
        const newTop = Math.max(8, Math.min(window.innerHeight - 60, initialY + dy));

        hud.style.left = `${newLeft}px`;
        hud.style.top = `${newTop}px`;
        this._hudPos = { left: newLeft, top: newTop };
        try {
          localStorage.setItem('quoratoys_hud_pos', JSON.stringify(this._hudPos));
        } catch (err) {}
      });

      window.addEventListener('mouseup', () => {
        if (isDraggingHud) {
          isDraggingHud = false;
          header.style.cursor = 'grab';
        }
      });

      this._hudBodyWrapper = makeElement('div', {
        style: { display: 'flex', flexDirection: 'column' }
      });

      const topExplainer = makeElement('div', {
        style: {
          padding: '6px 10px', background: 'rgba(0, 242, 254, 0.08)',
          borderBottom: '1px solid rgba(0, 242, 254, 0.2)', fontSize: '10px', color: '#94a3b8', lineHeight: '1.4'
        }
      }, [
        makeElement('strong', { style: { color: '#00f2fe', display: 'block', marginBottom: '2px' } }, '💡 Interactive Shortcuts:'),
        '• Hold ', makeElement('strong', { style: { color: '#ffd700' } }, '[H]'), ' for live vector arrows.', makeElement('br'),
        '• Hold ', makeElement('strong', { style: { color: '#f59e0b' } }, '[Ctrl]'), ' to tune string length or rest hand.', makeElement('br'),
        '• Press ', makeElement('strong', { style: { color: '#00f2fe' } }, '[X]'), ' to swap arrow ↔ text ends.'
      ]);
      this._hudBodyWrapper.appendChild(topExplainer);

      this._keyInPillsContainer = makeElement('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 8px', maxHeight: '380px', overflowY: 'auto' }
      });
      this._hudBodyWrapper.appendChild(this._keyInPillsContainer);

      hud.append(header, this._hudBodyWrapper);
      document.body.appendChild(hud);

      this.renderKeyInMatrixRows();
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

    (this.stageState.placedImages || []).forEach(plate => {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 12;
      ctx.drawImage(plate.img, plate.x, plate.y, plate.width, plate.height);

      if (this.stageState.activeImage === plate) {
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
      }
      ctx.restore();
    });

    // Render Text Badges (Direct or Tail-Attached)
    this.textBadgesLayer.innerHTML = '';
    (this.stageState.annotations || []).forEach(ann => {
      if (ann.type === 'text_badge') {
        this.renderDirectTextBadgeSvg(ann);
      } else if (ann.type === 'curve' && ann.text && ann.beziers?.length > 0) {
        this.renderCurveAttachedTextSvg(ann);
      }
    });

    this.renderImagePlateControls();
  }

  renderCurveAttachedTextSvg(ann) {
      const beziers = ann.beziers;
      if (!beziers || beziers.length === 0) return;

      const isAtTail = (ann.textEnd !== 'tip');
      const termSeg = isAtTail ? beziers[beziers.length - 1] : beziers[0];
      const anchorPt = isAtTail ? termSeg[3] : termSeg[0];

      // Compute curve departure vector entering the text area
      const exitVec = isAtTail
        ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
        : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];

      const exitLen = Math.hypot(exitVec[0], exitVec[1]) || 1;
      const uX = exitVec[0] / exitLen;
      const uY = exitVec[1] / exitLen;

      // 4-Quadrant Positioning Logic
      const isLeft = (ann.justifySide === 'left') || (uX >= 0);
      const isApproachingDown = (uY >= 0);

      const fontS = ann.fontSize || 22;
      const fontF = ann.fontFamily || "'Architects Daughter', cursive, sans-serif";
      const lines = String(ann.text).split('\n');
      const lineHeight = fontS * 1.25;

      const charW = fontS * (fontF.includes('mono') ? 0.60 : 0.52);
      let maxChars = 0;
      lines.forEach(l => { if (l.length > maxChars) maxChars = l.length; });

      const padX = ann.boxStyle !== 'none' ? 10 : 4;
      const padY = ann.boxStyle !== 'none' ? 6 : 4;
      const boxW = Math.round(maxChars * charW) + padX * 2;
      const boxH = Math.round(lines.length * lineHeight) + padY * 2;

      const gap = 8;
      const posX = isLeft ? anchorPt[0] + gap : anchorPt[0] - boxW - gap;
      const posY = Math.round(anchorPt[1] - boxH / 2);

      const g = makeElement('svg:g', {
        className: 'qa-curve-attached-label',
        style: { cursor: 'pointer', userSelect: 'none' },
        ondblclick: (e) => {
          e.stopPropagation();
          this._promptInlineTailText(ann, anchorPt, isLeft ? 'left' : 'right');
        }
      });

      if (ann.boxStyle === 'box') {
        g.appendChild(makeElement('svg:rect', {
          x: posX + 2, y: posY + 2, width: boxW, height: boxH, rx: '6',
          fill: 'rgba(10, 15, 25, 0.95)', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '4.5'
        }));
        g.appendChild(makeElement('svg:rect', {
          x: posX, y: posY, width: boxW, height: boxH, rx: '6',
          fill: 'rgba(15, 23, 42, 0.96)', stroke: ann.color || '#00e676', 'stroke-width': '2.5'
        }));
      } else if (ann.boxStyle === 'bracket') {
        // 4-Quadrant Dynamic Architectural Bracket:
        // Shelf runs on top or bottom based on vertical entry; wall runs on entrance side
        const wallX = isLeft ? posX : posX + boxW;
        const oppX = isLeft ? posX + boxW : posX;
        const shelfY = isApproachingDown ? posY : (posY + boxH);
        const wallEndY = isApproachingDown ? (posY + boxH) : posY;

        const bD = `M ${oppX} ${shelfY} L ${wallX} ${shelfY} L ${wallX} ${wallEndY}`;

        g.appendChild(makeElement('svg:path', {
          d: bD, transform: 'translate(2, 2)', fill: 'none',
          stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5'
        }));
        g.appendChild(makeElement('svg:path', {
          d: bD, fill: 'none', stroke: ann.color || '#00e676', 'stroke-width': '2.8'
        }));
      }

      const txt = makeElement('svg:text', {
        x: posX + padX, y: posY + padY + fontS * 0.88, fill: ann.color || '#00e676',
        'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold'
      });

      lines.forEach((l, i) => {
        txt.appendChild(makeElement('svg:tspan', {
          x: posX + padX, dy: i === 0 ? '0' : `${lineHeight}px`
        }, l));
      });

      g.appendChild(txt);
      this.textBadgesLayer.appendChild(g);
    }
  renderDirectTextBadgeSvg(ann) {
    const fontS = ann.fontSize || 22;
    const fontF = ann.fontFamily || "'Architects Daughter', cursive, sans-serif";
    const lines = String(ann.text).split('\n');
    const lineHeight = fontS * 1.25;

    const charW = fontS * 0.52;
    let maxChars = 0;
    lines.forEach(l => { if (l.length > maxChars) maxChars = l.length; });

    const padX = ann.boxStyle !== 'none' ? 10 : 4;
    const padY = ann.boxStyle !== 'none' ? 6 : 4;
    const boxW = Math.round(maxChars * charW) + padX * 2;
    const boxH = Math.round(lines.length * lineHeight) + padY * 2;

    const g = makeElement('svg:g', {
      id: `badge-${ann.id}`,
      className: 'qa-movable-text-badge',
      style: { cursor: 'move', userSelect: 'none' },
      ondblclick: (e) => {
        e.stopPropagation();
        this._promptInlineTailText(ann, [ann.x, ann.y], 'left');
      }
    });

    if (ann.boxStyle === 'box') {
      g.appendChild(makeElement('svg:rect', {
        x: ann.x + 2, y: ann.y + 2, width: boxW, height: boxH, rx: '6',
        fill: 'rgba(10, 15, 25, 0.95)', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '4.5'
      }));
      g.appendChild(makeElement('svg:rect', {
        x: ann.x, y: ann.y, width: boxW, height: boxH, rx: '6',
        fill: 'rgba(15, 23, 42, 0.96)', stroke: ann.color || '#00e676', 'stroke-width': '2.5'
      }));
    } else if (ann.boxStyle === 'bracket') {
      const bD = `M ${ann.x} ${ann.y} L ${ann.x} ${ann.y + boxH} L ${ann.x + boxW} ${ann.y + boxH}`;
      g.appendChild(makeElement('svg:path', {
        d: bD, transform: 'translate(2, 2)', fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5'
      }));
      g.appendChild(makeElement('svg:path', {
        d: bD, fill: 'none', stroke: ann.color || '#00e676', 'stroke-width': '2.8'
      }));
    }

    const txt = makeElement('svg:text', {
      x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: ann.color || '#00e676',
      'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold'
    });

    lines.forEach((l, i) => {
      txt.appendChild(makeElement('svg:tspan', {
        x: ann.x + padX, dy: i === 0 ? '0' : `${lineHeight}px`
      }, l));
    });

    g.appendChild(txt);

    let isDrag = false;
    let sX = 0, sY = 0;
    g.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isDrag = true;
      sX = e.clientX; sY = e.clientY;

      const onM = (ev) => {
        if (!isDrag) return;
        const z = this.stageState.zoom;
        ann.x += (ev.clientX - sX) / z;
        ann.y += (ev.clientY - sY) / z;
        sX = ev.clientX; sY = ev.clientY;
        this.renderStage();
      };
      const onU = () => { isDrag = false; window.removeEventListener('mousemove', onM); window.removeEventListener('mouseup', onU); };
      window.addEventListener('mousemove', onM);
      window.addEventListener('mouseup', onU);
    });

    this.textBadgesLayer.appendChild(g);
  }

  renderImagePlateControls() {
    this.controlsLayer.querySelectorAll('.qa-image-plate-control').forEach(el => el.remove());
    const plate = this.stageState.activeImage;
    if (!plate) return;

    const g = makeElement('svg:g', { className: 'qa-image-plate-control' });

    const border = makeElement('svg:rect', {
      x: plate.x, y: plate.y, width: plate.width, height: plate.height,
      fill: 'transparent', stroke: '#00f2fe', 'stroke-width': '1.8',
      'stroke-dasharray': '5,4', style: { cursor: 'move' }
    });

    let isMove = false;
    let sMx = 0, sMy = 0;
    border.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isMove = true;
      sMx = e.clientX; sMy = e.clientY;

      const onM = (ev) => {
        if (!isMove) return;
        const z = this.stageState.zoom;
        plate.x += (ev.clientX - sMx) / z;
        plate.y += (ev.clientY - sMy) / z;
        sMx = ev.clientX; sMy = ev.clientY;
        this.renderStage();
      };
      const onU = () => { isMove = false; window.removeEventListener('mousemove', onM); window.removeEventListener('mouseup', onU); };
      window.addEventListener('mousemove', onM);
      window.addEventListener('mouseup', onU);
    });
    g.appendChild(border);

    const grip = makeElement('svg:rect', {
      x: plate.x + plate.width - 8, y: plate.y + plate.height - 8, width: '16', height: '16',
      fill: '#00f2fe', stroke: '#ffffff', 'stroke-width': '2', rx: '3',
      style: { cursor: 'nwse-resize' }
    });

    let isResize = false;
    grip.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResize = true;
      const startW = plate.width;
      const startX = e.clientX;

      const onR = (ev) => {
        if (!isResize) return;
        const z = this.stageState.zoom;
        const dw = (ev.clientX - startX) / z;
        const newW = Math.max(80, startW + dw);
        plate.width = newW;
        plate.height = Math.round(newW / plate.aspect);
        this.renderStage();
      };
      const onUp = () => { isResize = false; window.removeEventListener('mousemove', onR); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onR);
      window.addEventListener('mouseup', onUp);
    });

    g.appendChild(grip);
    this.controlsLayer.appendChild(g);
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
    this.viewport.addEventListener('wheel', (e) => {
      const k = this.getActiveKnot();
      if (k && e.target.closest('.qa-on-curve-knot-handle, .qa-tangent-handle, #qa-composite-stage')) {
        const delta = e.deltaY > 0 ? -1 : 1;
        if (e.shiftKey) {
          k.tangentAngleOffset = (k.tangentAngleOffset || 0) + delta * 0.087;
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
      const factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      this.stageState.zoom = Math.max(this.stageState.minZoom, Math.min(this.stageState.maxZoom, this.stageState.zoom * factor));
      this.zoomScaffold.style.transform = `scale(${this.stageState.zoom})`;
    }, { passive: false });
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

  copyCompositeToClipboard(btn) {
    const tf = this.computeAutoBounds();
    const c = document.createElement('canvas');
    c.width = tf.totalW * 2; c.height = tf.totalH * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(this.sceneCanvas, 0, 0);

    const svgXml = new XMLSerializer().serializeToString(this.svgSurface);
    const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob(png => {
        if (png) navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
        if (btn) btn.textContent = '✓ Copied PNG!';
      });
    };
    img.src = url;
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
}

globalThis.QuoraAnnotationComponent = QuoraAnnotationComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraAnnotationComponent;