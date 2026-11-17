/**
 * QuoraCleanStudioDialog
 * Clean, minimal, extensible alternative Studio UI rendered inside a DialogBox.
 * Built cleanly on StudioEngine + StudioGeometry + StudioSvgRenderer.
 */
class QuoraCleanStudioDialog {
  static activeInstance = null;

  static open(options = {}) {
    if (QuoraCleanStudioDialog.activeInstance && QuoraCleanStudioDialog.activeInstance.dialog?.element?.isConnected) {
      QuoraCleanStudioDialog.activeInstance.dialog.bringToFront?.();
      return QuoraCleanStudioDialog.activeInstance;
    }
    const inst = new QuoraCleanStudioDialog(options);
    QuoraCleanStudioDialog.activeInstance = inst;
    inst.launch();
    return inst;
  }

  constructor(options = {}) {
    this.options = options;
    this.engine = options.engine || new StudioEngine();
    this._registerBuiltInTools();

    if (options.sourceComponent?.stageState) {
      this._seedFromComponent(options.sourceComponent.stageState);
    }

    this.dialog = null;
    this.renderer = null;
    this._activeEditorCommit = null;
    this._isSpaceDown = false;
    this._isPanning = false;
    this._dragSession = null;
  }

  _seedFromComponent(src) {
    const s = this.engine.state;
    if (src.placedImages?.length) s.placedImages = src.placedImages.map(p => ({ ...p }));
    if (src.annotations?.length) s.annotations = src.annotations.map(a => this.engine._cloneAnnotation(a));
    if (src.exportRect) s.exportRect = { ...src.exportRect };
  }

  _injectStyles() {
    if (typeof applyCss !== 'function') return;
    applyCss(`
      .qcs-root {
        display: flex; flex-direction: column; width: 100%; height: 100%;
        background: #070a13; color: #f8fafc;
        font-family: system-ui, -apple-system, sans-serif;
        user-select: none; overflow: hidden;
      }
      .qcs-topbar {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 7px 12px; background: rgba(15, 23, 42, 0.96);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0; flex-wrap: wrap;
      }
      .qcs-group { display: inline-flex; align-items: center; gap: 4px; }
      .qcs-btn {
        background: rgba(255, 255, 255, 0.05); color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;
        padding: 4px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; gap: 5px; transition: all 0.14s ease;
        white-space: nowrap;
      }
      .qcs-btn:hover:not(:disabled) {
        background: rgba(0, 242, 254, 0.12); color: #ffffff; border-color: rgba(0, 242, 254, 0.45);
      }
      .qcs-btn:disabled { opacity: 0.35; cursor: default; }
      .qcs-btn.active { background: rgba(0, 242, 254, 0.2); color: #00f2fe; border-color: #00f2fe; }
      .qcs-btn.primary { background: #238636; color: #ffffff; border-color: #2ea043; font-weight: 700; }
      .qcs-btn.primary:hover { background: #2ea043; box-shadow: 0 0 12px rgba(46, 160, 67, 0.45); }
      .qcs-workspace { display: flex; flex: 1; min-height: 0; position: relative; overflow: hidden; }
      .qcs-rail {
        width: 62px; background: rgba(11, 17, 32, 0.96);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        padding: 10px 6px; display: flex; flex-direction: column; gap: 6px;
        align-items: center; flex-shrink: 0; overflow-y: auto;
      }
      .qcs-tool-btn {
        width: 50px; padding: 7px 2px; border-radius: 10px;
        background: transparent; border: 1px solid transparent;
        color: #94a3b8; cursor: pointer; display: flex; flex-direction: column;
        align-items: center; gap: 2px; transition: all 0.14s ease;
      }
      .qcs-tool-btn:hover { background: rgba(255, 255, 255, 0.06); color: #f8fafc; }
      .qcs-tool-btn.active {
        background: rgba(0, 242, 254, 0.15); border-color: rgba(0, 242, 254, 0.6);
        color: #00f2fe; box-shadow: 0 0 14px rgba(0, 242, 254, 0.18);
      }
      .qcs-tool-icon { font-size: 16px; line-height: 1; }
      .qcs-tool-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; }
      .qcs-viewport {
        flex: 1; position: relative; overflow: hidden;
        background-color: #0b0f19;
        background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
        background-size: 22px 22px;
      }
      .qcs-inspector-bar {
        position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 24px;
        padding: 5px 12px; display: flex; align-items: center; gap: 8px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75); z-index: 60;
        max-width: calc(100% - 32px); overflow-x: auto;
      }
      .qcs-seg {
        display: inline-flex; align-items: center; background: rgba(7, 10, 19, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 2px; gap: 2px;
      }
      .qcs-seg-btn {
        background: transparent; border: none; color: #94a3b8;
        padding: 3px 8px; border-radius: 12px; font-size: 10.5px; font-weight: 700;
        cursor: pointer; transition: all 0.12s ease; white-space: nowrap;
      }
      .qcs-seg-btn:hover { color: #ffffff; }
      .qcs-seg-btn.active { background: #0284c7; color: #ffffff; }
      .qcs-swatch {
        width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid rgba(255, 255, 255, 0.35);
        cursor: pointer; transition: transform 0.12s ease; padding: 0; flex-shrink: 0;
      }
      .qcs-swatch:hover { transform: scale(1.2); }
      .qcs-swatch.active { border-color: #ffffff; box-shadow: 0 0 8px currentColor; transform: scale(1.18); }
      .qcs-toast {
        position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.95); border: 1px solid #00f2fe; color: #00f2fe;
        padding: 4px 14px; border-radius: 18px; font-size: 11px; font-weight: 700;
        font-family: monospace; pointer-events: none; z-index: 80; opacity: 0;
        transition: opacity 0.18s ease;
      }
      .qcs-settings-popover {
        position: absolute; top: 10px; right: 12px; width: 290px;
        background: rgba(15, 23, 42, 0.98); border: 1px solid rgba(0, 242, 254, 0.4);
        border-radius: 12px; padding: 12px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
        z-index: 90; display: none; flex-direction: column; gap: 10px; font-size: 11.5px;
      }
      .qcs-inline-editor {
        position: absolute; z-index: 75; outline: none; min-width: 64px; max-width: 280px;
        padding: 4px 8px; border-radius: 6px; font-weight: bold; white-space: pre-wrap;
        word-break: break-word; background: rgba(15, 23, 42, 0.72);
        border: 1px dashed rgba(0, 242, 254, 0.65);
      }
    `, 'QuoraCleanStudioStyles');
  }

  launch() {
        this._injectStyles();
        const w = Math.min(1180, Math.max(680, window.innerWidth - 70));
        const h = Math.min(760, Math.max(480, window.innerHeight - 60));

        const root = makeElement('div', { className: 'qcs-root' });
        this._buildTopBar(root);

        const workspace = makeElement('div', { className: 'qcs-workspace' });
        this.railEl = makeElement('div', { className: 'qcs-rail' });
        this._renderToolRail();

        this.viewport = makeElement('div', { className: 'qcs-viewport' });
        this.zoomScaffold = makeElement('div', {
          style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transformOrigin: '0 0' }
        });
        this.stageWrap = makeElement('div', {
          style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }
        });

        this.zoomScaffold.appendChild(this.stageWrap);
        this.viewport.appendChild(this.zoomScaffold);

        this.toastEl = makeElement('div', { className: 'qcs-toast' });
        this.inspectorBar = makeElement('div', { className: 'qcs-inspector-bar' });
        this.settingsPopover = this._buildSettingsPopover();
        this.welcomePromptEl = this._buildWelcomePrompt();

        this.viewport.append(this.toastEl, this.welcomePromptEl, this.inspectorBar, this.settingsPopover);
        this.viewport.addEventListener('mousedown', (e) => {
          if (!e.target.closest('.qcs-welcome-action, .qcs-inspector-bar, .qcs-settings-popover')) {
            this._welcomeHidden = true;
            this._syncWelcomePrompt();
          }
        }, true);

        workspace.append(this.railEl, this.viewport);
        root.appendChild(workspace);

        const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
          ? UITools.makeDialog
          : (opts => new DialogBox(opts));

        this.dialog = dialogMaker({
          title: '✨ QuoraToys Clean Studio (Extensible UI)',
          size: [w, h],
          position: [Math.max(16, Math.round((window.innerWidth - w) / 2)), Math.max(16, Math.round((window.innerHeight - h) / 2))],
          noPadding: true,
          allowMaximize: true,
          stateId: 'quora_clean_studio_v1',
          contentElement: root,
          onClose: () => this._cleanup()
        });

        this.renderer = new StudioSvgRenderer(this.engine, this.stageWrap, {
          onEditText: (ann, anchorPt, forcedEdge) => this._openInlineText(ann, anchorPt, forcedEdge),
          onTextMouseDown: (ann, e) => this._handleTextBadgeDrag(ann, e),
          onKnotMouseDown: (curve, idx, e) => this._handleKnotDrag(curve, idx, e),
          onTangentMouseDown: (curve, idx, side, e) => this._handleTangentDrag(curve, idx, side, e),
          onKnotContextMenu: (curve, idx, e) => this._openKnotMenu(curve, idx, e),
          onMidpointMouseDown: (curve, segIdx, e) => this._handleMidpointSplitDrag(curve, segIdx, e),
          onImageMouseDown: (plate, e) => this._handleImageDrag(plate, e),
          onImageGripMouseDown: (plate, cornerId, e) => this._handleImageResize(plate, cornerId, e),
          onCalloutGripMouseDown: (ann, cornerId, e) => this._handleCalloutResize(ann, cornerId, e)
        });

        this._bindEvents();
        this._subscribeEngine();
        this.renderer.render();
        this._renderInspector();
        this._applyViewportTransform();
        this._syncWelcomePrompt();
      }
  _buildTopBar(root) {
    const fileInput = makeElement('input', {
      type: 'file', accept: 'image/*', style: { display: 'none' },
      onchange: (e) => {
        const f = e.target.files?.[0];
        if (f) this._loadImageFile(f);
        e.target.value = '';
      }
    });
    root.appendChild(fileInput);

    this.undoBtn = makeElement('button', {
      className: 'qcs-btn', disabled: true, title: 'Undo [Ctrl+Z]',
      onclick: () => this.engine.runCommand('edit.undo')
    }, '↺ Undo');

    this.redoBtn = makeElement('button', {
      className: 'qcs-btn', disabled: true, title: 'Redo [Ctrl+Shift+Z]',
      onclick: () => this.engine.runCommand('edit.redo')
    }, '↻ Redo');

    this.exportBoundsChip = makeElement('button', {
      className: 'qcs-btn', style: { display: 'none', color: '#ffd700', borderColor: 'rgba(255,215,0,0.45)' },
      title: 'Reset custom export crop rectangle back to tight auto-bounds',
      onclick: () => this.engine.runCommand('export.resetBounds')
    }, '✕ Auto Crop');

    this.zoomPill = makeElement('button', {
      className: 'qcs-btn', title: 'Click to reset zoom to 100%',
      onclick: () => this.engine.runCommand('canvas.resetView')
    }, '100%');

    const topBar = makeElement('div', { className: 'qcs-topbar' }, [
      makeElement('div', { className: 'qcs-group' }, [
        this.undoBtn,
        this.redoBtn,
        makeElement('button', { className: 'qcs-btn', onclick: () => fileInput.click() }, '📁 Open'),
        makeElement('button', { className: 'qcs-btn', onclick: () => this._pasteClipboardImage() }, '📥 Paste'),
        this.exportBoundsChip
      ]),
      makeElement('div', { className: 'qcs-group' }, [
        this.zoomPill,
        makeElement('button', {
          className: 'qcs-btn',
          onclick: () => {
            const visible = this.settingsPopover.style.display === 'flex';
            this.settingsPopover.style.display = visible ? 'none' : 'flex';
          }
        }, '⚙ Style'),
        makeElement('button', {
          className: 'qcs-btn',
          onclick: (e) => this._exportComposite(e.currentTarget, true)
        }, '💾 Save'),
        makeElement('button', {
          className: 'qcs-btn primary',
          title: 'Copy clean PNG to clipboard [Ctrl+C]',
          onclick: (e) => this._exportComposite(e.currentTarget, false)
        }, '📋 Copy PNG')
      ])
    ]);
    root.appendChild(topBar);
  }

  _buildSettingsPopover() {
    const p = this.engine.state.prefs;
    const pop = makeElement('div', { className: 'qcs-settings-popover' });

    const makeRow = (label, ctrl) => makeElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }
    }, [makeElement('span', { style: { color: '#94a3b8' } }, label), ctrl]);

    const selectStyle = 'background:#070a13;color:#00f2fe;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-size:11px;outline:none;';

    const fontSel = makeElement('select', {
      style: selectStyle,
      onchange: (e) => {
        p.fontFamily = e.target.value;
        this.engine.state.fontFamily = e.target.value;
        this.engine.savePrefs();
        this.engine.emit('state:change');
      }
    }, [
      makeElement('option', { value: "'Architects Daughter', cursive, sans-serif", selected: p.fontFamily.includes('Architects') }, "Architects Daughter"),
      makeElement('option', { value: 'system-ui, -apple-system, sans-serif', selected: p.fontFamily.includes('system-ui') }, 'Clean Sans'),
      makeElement('option', { value: 'monospace', selected: p.fontFamily === 'monospace' }, 'Monospace')
    ]);

    const glowSel = makeElement('select', {
      style: selectStyle,
      onchange: (e) => { p.textGlowMode = e.target.value; this.engine.savePrefs(); this.engine.emit('state:change'); }
    }, [
      makeElement('option', { value: 'match', selected: p.textGlowMode === 'match' }, 'Follow Ink/Neon'),
      makeElement('option', { value: 'neon', selected: p.textGlowMode === 'neon' }, 'Always Neon'),
      makeElement('option', { value: 'halo', selected: p.textGlowMode === 'halo' }, 'Dark Halo Only'),
      makeElement('option', { value: 'shadow', selected: p.textGlowMode === 'shadow' }, 'Drop Shadow'),
      makeElement('option', { value: 'none', selected: p.textGlowMode === 'none' }, 'Flat')
    ]);

    const bgSel = makeElement('select', {
      style: selectStyle,
      onchange: (e) => { p.exportBgMode = e.target.value; this.engine.savePrefs(); }
    }, [
      makeElement('option', { value: 'matte', selected: p.exportBgMode !== 'transparent' }, 'Matte Dark'),
      makeElement('option', { value: 'transparent', selected: p.exportBgMode === 'transparent' }, 'Transparent PNG')
    ]);

    const tetherLbl = makeElement('span', { style: { color: '#00f2fe', fontWeight: 'bold', minWidth: '34px', textAlign: 'right' } }, `${this.engine.state.tetherLength}px`);
    const tetherSlider = makeElement('input', {
      type: 'range', min: '12', max: '64', step: '2', value: String(this.engine.state.tetherLength),
      style: { width: '96px', accentColor: '#00f2fe' },
      oninput: (e) => {
        const v = parseInt(e.target.value, 10);
        this.engine.state.tetherLength = v;
        p.tetherLength = v;
        tetherLbl.textContent = `${v}px`;
        this.engine.savePrefs();
      }
    });

    const backdropCb = makeElement('input', {
      type: 'checkbox', checked: !!p.textBoxBgEnabled, style: { accentColor: '#00e676' },
      onchange: (e) => { p.textBoxBgEnabled = e.target.checked; this.engine.savePrefs(); this.engine.emit('state:change'); }
    });

    pop.append(
      makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' } }, [
        makeElement('strong', { style: { color: '#00f2fe' } }, 'Style & Tether Defaults'),
        makeElement('button', { className: 'qcs-btn', style: { padding: '2px 6px' }, onclick: () => { pop.style.display = 'none'; } }, '✕')
      ]),
      makeRow('Font', fontSel),
      makeRow('Text Glow', glowSel),
      makeRow('Text Backdrop', backdropCb),
      makeRow('Tether Lead', makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [tetherSlider, tetherLbl])),
      makeRow('Export Bg', bgSel)
    );
    return pop;
  }

  _renderToolRail() {
    this.railEl.innerHTML = '';
    const active = this.engine.state.activeTool;
    this.engine.getTools().forEach(tool => {
      const btn = makeElement('button', {
        className: `qcs-tool-btn ${tool.id === active ? 'active' : ''}`,
        title: `${tool.label}${tool.shortcut ? ` [${tool.shortcut}]` : ''}${tool.description ? ' — ' + tool.description : ''}`,
        onclick: () => this.engine.runCommand('tool.set', tool.id)
      }, [
        makeElement('span', { className: 'qcs-tool-icon' }, tool.icon || '◆'),
        makeElement('span', { className: 'qcs-tool-label' }, tool.label)
      ]);
      this.railEl.appendChild(btn);
    });
  }

  _renderInspector() {
      this.inspectorBar.innerHTML = '';
      const state = this.engine.state;
      const selItem = this.engine.getSelectedItem();
      const selImg = this.engine.getSelectedImage();
      const activeTool = state.activeTool;

      const addSeg = (options, current, onPick) => {
        const seg = makeElement('div', { className: 'qcs-seg' });
        options.forEach(o => {
          seg.appendChild(makeElement('button', {
            className: `qcs-seg-btn ${current === o.id ? 'active' : ''}`,
            onclick: () => onPick(o.id)
          }, o.label));
        });
        return seg;
      };

      if (selImg) {
        this.inspectorBar.append(
          makeElement('span', { style: { fontSize: '11px', color: '#00f2fe', fontWeight: 'bold' } }, `🖼️ Image (${selImg.width}×${selImg.height})`),
          makeElement('button', { className: 'qcs-btn', onclick: () => this.engine.runCommand('image.clone') }, '⧉ Clone'),
          makeElement('button', { className: 'qcs-btn', onclick: () => this.engine.runCommand('image.toggleOpacity') }, selImg.opacity === 0.5 ? '◐ 50%' : '● 100%'),
          makeElement('button', { className: 'qcs-btn', onclick: () => this.engine.runCommand('image.reorder', 1) }, '▲'),
          makeElement('button', { className: 'qcs-btn', onclick: () => this.engine.runCommand('image.reorder', -1) }, '▼'),
          makeElement('button', { className: 'qcs-btn', style: { color: '#ff7b72' }, onclick: () => this.engine.runCommand('selection.delete') }, '🗑️')
        );
        return;
      }

      if (activeTool === 'paint' && !selItem) {
        const sizeLbl = makeElement('span', { style: { fontSize: '10.5px', color: '#f59e0b', minWidth: '34px' } }, `${state.brushSize}px`);
        const sizeSlider = makeElement('input', {
          type: 'range', min: '8', max: '120', value: String(state.brushSize),
          style: { width: '76px', accentColor: '#f59e0b' },
          oninput: (e) => { state.brushSize = parseInt(e.target.value, 10); sizeLbl.textContent = `${state.brushSize}px`; }
        });
        const colorInput = makeElement('input', {
          type: 'color', value: state.brushColor,
          style: { width: '22px', height: '20px', border: 'none', background: 'none', cursor: 'pointer' },
          oninput: (e) => { state.brushColor = e.target.value; }
        });

        this.inspectorBar.append(
          addSeg([
            { id: 'freehand', label: '🖌️ Mask' },
            { id: 'erase', label: '🧹 Erase Alpha' },
            { id: 'rect', label: '◻ Rect' },
            { id: 'oval', label: '⭕ Oval' }
          ], state.brushMode, (id) => { state.brushMode = id; this._renderInspector(); }),
          sizeSlider, sizeLbl, colorInput
        );
        return;
      }

      const showControls = selItem || ['curve', 'arrow', 'circle', 'rect', 'text'].includes(activeTool);
      if (!showControls) {
        this.inspectorBar.append(
          makeElement('span', { style: { fontSize: '11px', color: '#94a3b8' } },
            'Drop or Ctrl+V an image • Pick a tool on the left • Space+Drag pan • Scroll zoom'
          )
        );
        return;
      }

      const swatches = ['#00e676', '#00f2fe', '#ffd700', '#ff2d55', '#c084fc', '#ffffff'];
      const curCol = (selItem?.color || state.currentColor || '#00e676').toLowerCase();
      const swatchRow = makeElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } });
      swatches.forEach(hex => {
        swatchRow.appendChild(makeElement('button', {
          className: `qcs-swatch ${curCol === hex ? 'active' : ''}`,
          style: { background: hex, color: hex },
          onclick: () => this.engine.runCommand('style.setColor', hex)
        }));
      });
      swatchRow.appendChild(makeElement('button', {
        className: 'qcs-btn', style: { padding: '2px 7px' }, title: 'Custom Color Wheel',
        onclick: (e) => this._openColorWheel(e.currentTarget)
      }, '🎨'));
      this.inspectorBar.appendChild(swatchRow);

      const isTextOnly = (selItem?.type === 'text_badge') || (!selItem && activeTool === 'text');
      this.inspectorBar.appendChild(addSeg(
        [{ id: 'classic', label: 'Ink' }, { id: 'neon', label: 'Neon' }],
        selItem?.lineStyle || state.lineStyle,
        (v) => this.engine.runCommand('style.setLineStyle', v)
      ));

      if (!isTextOnly) {
        if (selItem?.type === 'curve' || (!selItem && (activeTool === 'curve' || activeTool === 'arrow'))) {
          this.inspectorBar.appendChild(addSeg(
            [{ id: 'none', label: 'Off' }, { id: 'tip', label: '➔ Tip' }, { id: 'tail', label: '⬅ Tail' }, { id: 'both', label: '↔' }],
            selItem?.arrowEnd || state.arrowMode,
            (v) => this.engine.runCommand('style.setArrowMode', v)
          ));
          this.inspectorBar.appendChild(addSeg(
            [{ id: 'concave', label: 'Swept' }, { id: 'architectural', label: 'Arch' }, { id: 'dot', label: '● Dot' }],
            selItem?.arrowStyle || state.arrowStyle || 'concave',
            (v) => this.engine.runCommand('style.setArrowStyle', v)
          ));
        }

        this.inspectorBar.appendChild(makeElement('div', { className: 'qcs-seg' }, [
          makeElement('button', { className: 'qcs-seg-btn', onclick: () => this.engine.runCommand('style.stepWidth', -0.5) }, '−'),
          makeElement('span', { style: { fontSize: '10.5px', color: '#00f2fe', padding: '0 4px', fontWeight: 'bold' } }, `${selItem?.strokeWidth || state.strokeWidth}px`),
          makeElement('button', { className: 'qcs-seg-btn', onclick: () => this.engine.runCommand('style.stepWidth', 0.5) }, '+')
        ]));
      }

      if (selItem?.type === 'curve' || selItem?.type === 'text_badge' || activeTool === 'text') {
        this.inspectorBar.appendChild(makeElement('div', { className: 'qcs-seg' }, [
          makeElement('button', { className: 'qcs-seg-btn', onclick: () => this.engine.runCommand('style.stepFontSize', -2) }, 'A-'),
          makeElement('span', { style: { fontSize: '10.5px', color: '#ffd700', padding: '0 4px', fontWeight: 'bold' } }, `${selItem?.fontSize || state.fontSize}px`),
          makeElement('button', { className: 'qcs-seg-btn', onclick: () => this.engine.runCommand('style.stepFontSize', 2) }, 'A+')
        ]));
      }

      if (selItem?.type === 'curve') {
        const activeK = selItem.vertices?.[state.activeKnotIdx];
        const hasInterior = selItem.vertices && selItem.vertices.length >= 3;
        this.inspectorBar.append(
          makeElement('button', { className: `qcs-btn ${selItem.isClosed ? 'active' : ''}`, onclick: () => this.engine.runCommand('curve.toggleLoop') }, '○ Loop'),
          makeElement('button', { className: 'qcs-btn', onclick: () => this.engine.runCommand('curve.flipTerminals') }, '⇄ Flip')
        );
        if (hasInterior) {
          this.inspectorBar.appendChild(makeElement('button', {
            className: `qcs-btn ${activeK?.isCusp ? 'active' : ''}`,
            style: activeK?.isCusp ? { color: '#f59e0b', borderColor: '#f59e0b' } : {},
            title: 'Toggle sharp cusp / smooth point on active interior knot [C] (or Alt+Drag handle)',
            onclick: () => this.engine.runCommand('curve.toggleCusp')
          }, activeK?.isCusp ? '◆ Cusp' : '● Smooth'));
        }
        this.inspectorBar.appendChild(makeElement('button', {
          className: 'qcs-btn',
          onclick: () => {
            const isTail = selItem.textEnd !== 'tip';
            const seg = isTail ? selItem.beziers[selItem.beziers.length - 1] : selItem.beziers[0];
            this._openInlineText(selItem, isTail ? seg[3] : seg[0], null);
          }
        }, '💬 Note'));
      }

      if (selItem) {
        this.inspectorBar.appendChild(makeElement('button', {
          className: 'qcs-btn', style: { color: '#ff7b72' },
          onclick: () => this.engine.runCommand('selection.delete')
        }, '🗑️'));
      }

      this.engine.getInspectorSections().forEach(sec => {
        if (!sec.match || sec.match(this.engine)) {
          const node = sec.render(this.engine);
          if (node) this.inspectorBar.appendChild(node);
        }
      });
    }
  _openColorWheel(anchorBtn) {
    if (typeof ColorPicker === 'undefined') return;
    if (!this._colorPicker) this._colorPicker = new ColorPicker();
    const cur = this.engine.getSelectedItem()?.color || this.engine.state.currentColor || '#00e676';
    this._colorPicker.openSmartPicker(anchorBtn, cur, (newCol) => {
      this.engine.runCommand('style.setColor', newCol);
    });
  }

  _registerBuiltInTools() {
    const eng = this.engine;
    const st = eng.state;
    const rectFromPts = (a, b) => ({
      x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]),
      w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1])
    });
    const ellipseFromPts = (a, b) => ({
      cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2,
      rx: Math.abs(b[0] - a[0]) / 2, ry: Math.abs(b[1] - a[1]) / 2
    });

    eng.registerTool({
      id: 'select', label: 'Select', icon: '↖', shortcut: 'V', order: 10, cursor: 'default',
      description: 'Select, move, reshape, or double-click to edit',
      onPointerDown: (pt, ev, ctx) => {
        const hit = StudioGeometry.findNearestAnnotation(
          st.annotations, pt, 18 / (st.zoom || 1),
          (t, s, f) => this.renderer.measureTextBounds(t, s, f)
        );
        if (hit) {
          if (hit.part === 'curve' && hit.segIdx !== undefined && hit.item.vertices?.length) {
            st.activeKnotIdx = hit.t < 0.5 ? hit.segIdx : Math.min(hit.item.vertices.length - 1, hit.segIdx + 1);
          }
          eng.selectItem(hit.item);
          Object.assign(ctx, { mode: 'drag_item', item: hit.item, startPt: pt, snap: eng._captureSnapshot('Move Item'), orig: eng._cloneAnnotation(hit.item), didMove: false });
          return;
        }
        const plate = StudioGeometry.hitTestImagePlate(st.placedImages, pt);
        if (plate) {
          eng.selectImage(plate);
          Object.assign(ctx, { mode: 'drag_image', plate, startPt: pt, ox: plate.x, oy: plate.y, snap: eng._captureSnapshot('Move Image'), didMove: false });
          return;
        }
        eng.deselectAll();
        Object.assign(ctx, { mode: 'pan_bg', sx: ev.clientX, sy: ev.clientY, px: st.panX, py: st.panY });
      },
      onPointerMove: (pt, ev, ctx) => {
        if (ctx.mode === 'drag_item' && ctx.item) {
          const dx = Math.round(pt[0] - ctx.startPt[0]), dy = Math.round(pt[1] - ctx.startPt[1]);
          if (Math.hypot(dx, dy) > 2) ctx.didMove = true;
          if (ctx.item.type === 'curve') {
            ctx.item.vertices.forEach((v, i) => {
              const ov = ctx.orig.vertices[i];
              if (ov) { v.point[0] = ov.point[0] + dx; v.point[1] = ov.point[1] + dy; }
            });
            eng.recomputeCurve(ctx.item);
          } else if (ctx.item.type === 'circle_callout') {
            ctx.item.cx = ctx.orig.cx + dx; ctx.item.cy = ctx.orig.cy + dy;
          } else {
            ctx.item.x = ctx.orig.x + dx; ctx.item.y = ctx.orig.y + dy;
          }
          this.renderer.render();
        } else if (ctx.mode === 'drag_image' && ctx.plate) {
          const dx = Math.round(pt[0] - ctx.startPt[0]), dy = Math.round(pt[1] - ctx.startPt[1]);
          if (Math.hypot(dx, dy) > 2) ctx.didMove = true;
          ctx.plate.x = ctx.ox + dx; ctx.plate.y = ctx.oy + dy;
          this.renderer.render();
        } else if (ctx.mode === 'pan_bg') {
          st.panX = Math.round(ctx.px + (ev.clientX - ctx.sx));
          st.panY = Math.round(ctx.py + (ev.clientY - ctx.sy));
          this._applyViewportTransform();
        }
      },
      onPointerUp: (pt, ev, ctx) => {
        if ((ctx.mode === 'drag_item' || ctx.mode === 'drag_image') && ctx.didMove) eng.commitSnapshot(ctx.snap);
      }
    });

    const registerSplineTool = (id, label, icon, shortcut, order, forceArrow = false) => {
      eng.registerTool({
        id, label, icon, shortcut, order, cursor: 'crosshair',
        description: forceArrow ? 'Draw crisp pointer arrow' : 'Drawstring spline (back up to erase or redirect for sharp cusp)',
        onPointerDown: (pt, ev, ctx) => {
          eng.deselectAll();
          Object.assign(ctx, {
            startPt: pt, prevCursorPt: pt, points: [pt], hasExceededDeadzone: false,
            tetherState: { cuspIndices: [], inSlackRedirect: false, slackIncomingDir: null, cuspAngleDeg: 45 }
          });
          if (forceArrow) eng.runCommand('style.setArrowMode', st.arrowMode === 'none' ? 'tip' : st.arrowMode);
        },
        onPointerMove: (pt, ev, ctx) => {
          const rend = this.renderer;
          if (ev.shiftKey) {
            ctx.hasExceededDeadzone = true;
            ctx.points = [ctx.startPt, pt];
            ctx.tetherState = { cuspIndices: [], inSlackRedirect: false, slackIncomingDir: null, cuspAngleDeg: 45 };
            rend.renderTransient({
              previewPathD: `M ${ctx.startPt[0]} ${ctx.startPt[1]} L ${pt[0]} ${pt[1]}`,
              color: st.currentColor, strokeWidth: st.strokeWidth, lineStyle: st.lineStyle,
              previewArrow: st.hasArrow ? {
                p0: ctx.startPt, exitVec: StudioGeometry.normalize([pt[0] - ctx.startPt[0], pt[1] - ctx.startPt[1]]),
                color: st.currentColor, strokeWidth: st.strokeWidth
              } : null
            });
            return;
          }

          if (!ctx.hasExceededDeadzone && StudioGeometry.dist(pt, ctx.startPt) > 4) ctx.hasExceededDeadzone = true;
          if (!ctx.hasExceededDeadzone) {
            ctx.prevCursorPt = pt;
            return rend.renderTransient({ tipIndicator: { pt: ctx.startPt, didRewind: false } });
          }

          const tetherLen = st.tetherLength || 32;
          const eraseR = Math.max(8, Math.min(st.eraseRadius || 20, Math.round(tetherLen * 0.62)));
          const step = StudioGeometry.stepDrawstringTether(ctx.points, pt, tetherLen, eraseR, ctx.prevCursorPt, ctx.tetherState);
          ctx.points = step.points;
          ctx.prevCursorPt = pt;
          Object.assign(ctx.tetherState, { cuspIndices: step.cuspIndices, inSlackRedirect: step.inSlackRedirect, slackIncomingDir: step.slackIncomingDir });

          const isLoopClosing = ctx.points.length > 8 && StudioGeometry.dist(step.curTip, ctx.startPt) < 24;
          const ptsForPreview = isLoopClosing ? [...ctx.points, ctx.startPt] : (ctx.points.length === 1 ? [step.curTip, step.curTip] : ctx.points);

          rend.renderTransient({
            previewPathD: StudioGeometry.smoothPolylineToSvgD(ptsForPreview),
            color: isLoopClosing ? '#00f2fe' : st.currentColor,
            strokeWidth: st.strokeWidth, lineStyle: st.lineStyle, isLoopClosing,
            tetherLine: { from: step.curTip, to: pt, isSlack: step.isSlack, didRewind: step.didRewind },
            tipIndicator: { pt: step.curTip, didRewind: step.didRewind },
            eraseCircle: { pt, r: eraseR, didRewind: step.didRewind },
            cuspPoints: step.cuspIndices.map(idx => ctx.points[idx]).filter(Boolean),
            pendingCuspPt: step.pendingCusp ? step.curTip : null,
            previewArrow: (st.hasArrow && !isLoopClosing && ctx.points.length >= 2) ? {
              p0: ptsForPreview[0],
              exitVec: StudioGeometry.normalize([ptsForPreview[1][0] - ptsForPreview[0][0], ptsForPreview[1][1] - ptsForPreview[0][1]]),
              color: st.currentColor, strokeWidth: st.strokeWidth
            } : null
          });
        },
        onPointerUp: (pt, ev, ctx) => {
          this.renderer.clearTransient();
          if (!ctx.hasExceededDeadzone || ctx.points.length < 2) return;
          const pts = [...ctx.points];
          const isLoopClosing = pts.length > 8 && StudioGeometry.dist(pts[pts.length - 1], ctx.startPt) < 24;
          if (isLoopClosing) pts[pts.length - 1] = [ctx.startPt[0], ctx.startPt[1]];

          const fitted = StudioGeometry.fitPolylineWithCusps(pts, ctx.tetherState?.cuspIndices || []);
          if (fitted.beziers?.length) {
            eng.addCurveFromBeziers(fitted.beziers, {
              isClosed: isLoopClosing, arrowEnd: isLoopClosing ? 'none' : st.arrowMode, cuspVertexIndices: fitted.vertexCuspIndices
            });
            if (fitted.vertexCuspIndices.length) eng.emit('toast', `◆ Locked ${fitted.vertexCuspIndices.length} cusp corner(s)`);
          }
        }
      });
    };

    registerSplineTool('curve', 'Curve', '🪢', 'D', 20, false);
    registerSplineTool('arrow', 'Arrow', '➔', 'A', 30, true);

    eng.registerTool({
      id: 'circle', label: 'Ring', icon: '⭕', shortcut: 'O', order: 40, cursor: 'crosshair',
      onPointerDown: (pt, ev, ctx) => { ctx.startPt = pt; },
      onPointerMove: (pt, ev, ctx) => ctx.startPt && this.renderer.renderTransient({ shapeEllipse: { ...ellipseFromPts(ctx.startPt, pt), stroke: st.currentColor } }),
      onPointerUp: (pt, ev, ctx) => {
        this.renderer.clearTransient();
        const b = ellipseFromPts(ctx.startPt, pt);
        if (b.rx < 5 || b.ry < 5) return;
        eng.pushHistory('Add Ring');
        const rec = { id: 'circle_' + Date.now(), type: 'circle_callout', cx: Math.round(b.cx), cy: Math.round(b.cy), rx: Math.round(b.rx), ry: Math.round(b.ry), color: st.currentColor, strokeWidth: st.strokeWidth, lineStyle: st.lineStyle };
        st.annotations.push(rec);
        eng.selectItem(rec);
      }
    });

    eng.registerTool({
      id: 'rect', label: 'Box', icon: '◻', shortcut: 'R', order: 50, cursor: 'crosshair',
      onPointerDown: (pt, ev, ctx) => { ctx.startPt = pt; },
      onPointerMove: (pt, ev, ctx) => ctx.startPt && this.renderer.renderTransient({ shapeRect: { ...rectFromPts(ctx.startPt, pt), stroke: st.currentColor } }),
      onPointerUp: (pt, ev, ctx) => {
        this.renderer.clearTransient();
        const b = rectFromPts(ctx.startPt, pt);
        if (b.w < 6 || b.h < 6) return;
        eng.pushHistory('Add Box');
        const rec = { id: 'box_' + Date.now(), type: 'box_callout', x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), color: st.currentColor, strokeWidth: st.strokeWidth, lineStyle: st.lineStyle };
        st.annotations.push(rec);
        eng.selectItem(rec);
      }
    });

    eng.registerTool({
      id: 'text', label: 'Text', icon: '💬', shortcut: 'T', order: 60, cursor: 'text',
      onPointerDown: (pt) => this._openInlineText(null, pt, 'left')
    });

    eng.registerTool({
      id: 'paint', label: 'Mask', icon: '🖌️', shortcut: 'B', order: 70, cursor: 'crosshair',
      onPointerDown: (pt, ev, ctx) => {
        Object.assign(ctx, { startPt: pt, points: [pt], mode: st.brushMode });
        if (ctx.mode !== 'erase') return;
        const plate = StudioGeometry.hitTestImagePlate(st.placedImages, pt) || eng.getSelectedImage() || st.placedImages[0];
        ctx.plate = plate; ctx.prevErasePt = pt;
        if (plate) { eng.pushHistory('Erase Image Alpha'); this._eraseImagePixels(plate, pt[0], pt[1], st.brushSize / 2); }
        else eng.emit('toast', 'Add an image first to erase alpha');
      },
      onPointerMove: (pt, ev, ctx) => {
        if (!ctx.startPt) return;
        const rend = this.renderer;
        if (ctx.mode === 'erase' && ctx.plate) {
          this._eraseImagePixels(ctx.plate, pt[0], pt[1], st.brushSize / 2, ctx.prevErasePt[0], ctx.prevErasePt[1]);
          ctx.prevErasePt = pt;
          return rend.renderTransient({ paintRing: { pt, r: st.brushSize / 2, isErase: true } });
        }
        if (ctx.mode === 'rect') return rend.renderTransient({ shapeRect: { ...rectFromPts(ctx.startPt, pt), fill: st.brushColor, stroke: '#f59e0b' } });
        if (ctx.mode === 'oval') return rend.renderTransient({ shapeEllipse: { ...ellipseFromPts(ctx.startPt, pt), fill: st.brushColor, stroke: '#f59e0b' } });
        ctx.points.push(pt);
        rend.renderTransient({ previewPathD: StudioGeometry.smoothPolylineToSvgD(ctx.points), color: st.brushColor, strokeWidth: st.brushSize, lineStyle: 'classic' });
      },
      onPointerUp: (pt, ev, ctx) => {
        this.renderer.clearTransient();
        if (!ctx.startPt || ctx.mode === 'erase') return;
        const id = 'paint_' + Date.now();
        const base = { id, type: 'paint', color: st.brushColor, softness: st.brushSoftness };
        if (ctx.mode === 'rect') {
          const b = rectFromPts(ctx.startPt, pt);
          if (b.w > 4 && b.h > 4) { eng.pushHistory('Paint Mask'); st.annotations.push({ ...base, shape: 'rect', bounds: b }); }
        } else if (ctx.mode === 'oval') {
          const b = ellipseFromPts(ctx.startPt, pt);
          if (b.rx > 4 && b.ry > 4) { eng.pushHistory('Paint Mask'); st.annotations.push({ ...base, shape: 'oval', bounds: b }); }
        } else if (ctx.points.length >= 2) {
          eng.pushHistory('Paint Mask');
          st.annotations.push({ ...base, shape: 'freehand', points: ctx.points, width: st.brushSize });
        }
        eng.emit('state:change');
      }
    });

    eng.registerTool({
      id: 'exportArea', label: 'Crop', icon: '📐', shortcut: 'E', order: 80, cursor: 'crosshair',
      onPointerDown: (pt, ev, ctx) => { ctx.startPt = pt; },
      onPointerMove: (pt, ev, ctx) => ctx.startPt && this.renderer.renderTransient({
        shapeRect: { ...rectFromPts(ctx.startPt, pt), stroke: '#ffd700', fill: 'rgba(255,215,0,0.1)', dashed: true }
      }),
      onPointerUp: (pt, ev, ctx) => {
        this.renderer.clearTransient();
        const b = rectFromPts(ctx.startPt, pt);
        if (b.w <= 20 || b.h <= 20) return;
        eng.pushHistory('Set Export Area');
        st.exportRect = { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.w), height: Math.round(b.h) };
        eng.runCommand('tool.set', 'select');
        eng.emit('toast', `📐 Export Area: ${Math.round(b.w)}×${Math.round(b.h)}px`);
      }
    });
  }

  _subscribeEngine() {
      this._unsubs = [
        this.engine.on('state:change', () => {
          this.renderer.render();
          this._renderInspector();
          this._syncWelcomePrompt();
          this.exportBoundsChip.style.display = this.engine.state.exportRect ? 'inline-flex' : 'none';
        }),
        this.engine.on('tool:change', () => {
          this._renderToolRail();
          this._renderInspector();
          const tool = this.engine.getTool(this.engine.state.activeTool);
          this.viewport.style.cursor = tool?.cursor || 'crosshair';
        }),
        this.engine.on('history:change', ({ canUndo, canRedo }) => {
          this.undoBtn.disabled = !canUndo;
          this.redoBtn.disabled = !canRedo;
        }),
        this.engine.on('viewport:change', () => this._applyViewportTransform()),
        this.engine.on('toast', (msg) => this._showToast(msg))
      ];
    }
  _getStagePt(e) {
    const rect = this.stageWrap.getBoundingClientRect();
    const z = this.engine.state.zoom || 1.0;
    return [(e.clientX - rect.left) / z, (e.clientY - rect.top) / z];
  }

  _applyViewportTransform() {
    const { zoom, panX, panY } = this.engine.state;
    this.zoomScaffold.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
    this.zoomPill.textContent = `${Math.round(zoom * 100)}%`;
    this.renderer.render();
  }

  _showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { if (this.toastEl) this.toastEl.style.opacity = '0'; }, 1600);
  }

  _bindEvents() {
      this.viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.qcs-inspector-bar, .qcs-settings-popover, .qcs-inline-editor, .qcs-toast')) return;
        if (e.button === 1 || (e.button === 0 && this._isSpaceDown)) {
          e.preventDefault();
          this._isPanning = true;
          this._panStart = { x: e.clientX, y: e.clientY, px: this.engine.state.panX, py: this.engine.state.panY };
          this.viewport.style.cursor = 'grabbing';
          return;
        }
        if (e.button !== 0) return;
        if (this._activeEditorCommit) this._activeEditorCommit();

        const tool = this.engine.getTool(this.engine.state.activeTool);
        if (!tool) return;
        this._dragSession = { tool, ctx: {} };
        tool.onPointerDown?.(this._getStagePt(e), e, this._dragSession.ctx);
      });

      this.viewport.addEventListener('dblclick', (e) => {
        if (e.target.closest('.qcs-inspector-bar, .qcs-settings-popover, .qcs-inline-editor')) return;
        const pt = this._getStagePt(e);
        const hit = StudioGeometry.findNearestAnnotation(
          this.engine.state.annotations, pt, 20 / (this.engine.state.zoom || 1),
          (t, s, f) => this.renderer.measureTextBounds(t, s, f)
        );
        if (hit && (hit.item.type === 'curve' || hit.item.type === 'text_badge')) {
          if (hit.item.type === 'text_badge') {
            this._openInlineText(hit.item, [hit.item.x, hit.item.y], 'left');
          } else {
            const isTail = hit.item.textEnd !== 'tip';
            const seg = isTail ? hit.item.beziers[hit.item.beziers.length - 1] : hit.item.beziers[0];
            this._openInlineText(hit.item, isTail ? seg[3] : seg[0], null);
          }
        }
      });

      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          if (this.renderer && this.viewport?.clientWidth > 0) {
            this.renderer.render(this.viewport.clientWidth, this.viewport.clientHeight);
          }
        });
        this._resizeObserver.observe(this.viewport);
      }

      this._onWinMove = (e) => {
        if (this._isPanning && this._panStart) {
          this.engine.state.panX = Math.round(this._panStart.px + (e.clientX - this._panStart.x));
          this.engine.state.panY = Math.round(this._panStart.py + (e.clientY - this._panStart.y));
          this._applyViewportTransform();
          return;
        }
        if (this._dragSession?.tool?.onPointerMove) {
          this._dragSession.tool.onPointerMove(this._getStagePt(e), e, this._dragSession.ctx);
        } else if (this.engine.state.activeTool === 'paint' && e.target.closest?.('.qcs-viewport')) {
          const pt = this._getStagePt(e);
          this.renderer.renderTransient({
            paintRing: { pt, r: this.engine.state.brushSize / 2, isErase: this.engine.state.brushMode === 'erase' }
          });
        }
      };

      this._onWinUp = (e) => {
        if (this._isPanning) {
          this._isPanning = false;
          this._panStart = null;
          this.viewport.style.cursor = this._isSpaceDown ? 'grab' : (this.engine.getTool(this.engine.state.activeTool)?.cursor || 'crosshair');
          return;
        }
        if (this._dragSession) {
          this._dragSession.tool.onPointerUp?.(this._getStagePt(e), e, this._dragSession.ctx);
          this._dragSession = null;
        }
      };

      this.viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.viewport.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const oldZ = this.engine.state.zoom;
        const newZ = StudioGeometry.clamp(oldZ * (e.deltaY < 0 ? 1.15 : 1 / 1.15), this.engine.state.minZoom, this.engine.state.maxZoom);
        if (Math.abs(newZ - oldZ) < 0.001) return;
        const sx = (cx - this.engine.state.panX) / oldZ;
        const sy = (cy - this.engine.state.panY) / oldZ;
        this.engine.state.zoom = newZ;
        this.engine.state.panX = cx - sx * newZ;
        this.engine.state.panY = cy - sy * newZ;
        this._applyViewportTransform();
      }, { passive: false });

      this.viewport.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
      this.viewport.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = this.stageWrap.getBoundingClientRect();
        const z = this.engine.state.zoom || 1.0;
        const dx = Math.round((e.clientX - rect.left) / z);
        const dy = Math.round((e.clientY - rect.top) / z);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          Array.from(files).forEach((f, i) => { if (f.type.startsWith('image/')) this._loadImageFile(f, dx + i * 24, dy + i * 24); });
        }
      });

      this._onPaste = (e) => {
        if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
        if (!this.dialog?.element?.isConnected) return;
        for (const item of (e.clipboardData?.items || [])) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) { this._loadImageFile(file); e.preventDefault(); return; }
          }
        }
      };

      this._onKeyDown = (e) => {
        if (!this.dialog?.element?.isConnected) return;
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;

        if (e.code === 'Space') { this._isSpaceDown = true; this.viewport.style.cursor = 'grab'; return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          this.engine.runCommand(e.shiftKey ? 'edit.redo' : 'edit.undo');
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          this._exportComposite(null, false);
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          this.engine.runCommand('selection.delete');
          return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
          const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
          if (this.engine.runCommand('selection.nudge', { dx, dy })) e.preventDefault();
          return;
        }
        if (e.key === 'Escape') {
          this.engine.deselectAll();
          this.settingsPopover.style.display = 'none';
          return;
        }
        const k = e.key.toUpperCase();
        const matchedTool = this.engine.getTools().find(t => t.shortcut && t.shortcut.toUpperCase() === k);
        if (matchedTool && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.engine.runCommand('tool.set', matchedTool.id);
          return;
        }
        if (k === 'L') this.engine.runCommand('curve.toggleLoop');
        else if (k === 'X') this.engine.runCommand('curve.flipTerminals');
        else if (k === 'S') this.engine.runCommand('curve.straighten');
        else if (k === 'C') this.engine.runCommand('curve.toggleCusp');
      };

      this._onKeyUp = (e) => {
        if (e.code === 'Space') {
          this._isSpaceDown = false;
          if (!this._isPanning) this.viewport.style.cursor = this.engine.getTool(this.engine.state.activeTool)?.cursor || 'crosshair';
        }
      };

      window.addEventListener('mousemove', this._onWinMove);
      window.addEventListener('mouseup', this._onWinUp);
      window.addEventListener('paste', this._onPaste);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
    }

  _handleKnotDrag(curve, idx, e) {
    const eng = this.engine, rend = this.renderer;
    eng.state.activeKnotIdx = idx;
    eng.selectItem(curve);
    const knot = curve.vertices[idx];
    if (!knot) return;

    const snap = eng._captureSnapshot('Move Knot');
    const sx = e.clientX, sy = e.clientY, ox = knot.point[0], oy = knot.point[1];
    let moved = false;

    this._trackDrag(
      (ev) => {
        const z = eng.state.zoom || 1.0;
        const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
        if (Math.hypot(dx, dy) > 2) moved = true;
        knot.point[0] = Math.round(ox + dx);
        knot.point[1] = Math.round(oy + dy);
        eng.recomputeCurve(curve);
        rend.render();
      },
      () => {
        if (!moved) return;
        eng._undoStack.push(snap);
        eng._redoStack = [];
        eng.emit('history:change', { canUndo: eng.canUndo(), canRedo: eng.canRedo() });
      }
    );
  }
  _handleMidpointSplitDrag(curve, segIdx, e) {
    this.engine.runCommand('curve.splitAt', { curve, segIdx, t: 0.5 });
    this._handleKnotDrag(curve, segIdx + 1, e);
  }

  _openKnotMenu(curve, idx, e) {
    const existing = document.getElementById('qcs-knot-menu');
    if (existing) existing.remove();
    const menu = makeElement('div', {
      id: 'qcs-knot-menu',
      style: {
        position: 'fixed', top: `${e.clientY + 4}px`, left: `${e.clientX + 4}px`,
        background: 'rgba(15, 23, 42, 0.98)', border: '1px solid #00f2fe',
        borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px',
        zIndex: '2147483647', minWidth: '150px', boxShadow: '0 10px 28px rgba(0,0,0,0.85)'
      }
    });
    const addOpt = (label, fn) => {
      menu.appendChild(makeElement('button', {
        className: 'qcs-btn', style: { border: 'none', justifyContent: 'flex-start', width: '100%' },
        onclick: () => { menu.remove(); fn(); }
      }, label));
    };
    addOpt('◆ Toggle Cusp [C]', () => this.engine.runCommand('curve.toggleCusp', idx));
    addOpt('↺ Reset Knot [R]', () => this.engine.runCommand('curve.resetKnot', idx));
    addOpt('📏 Straighten [S]', () => this.engine.runCommand('curve.straighten'));
    addOpt('🗑️ Delete Knot', () => this.engine.runCommand('curve.deleteKnot', idx));
    document.body.appendChild(menu);
    const close = (ev) => {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 40);
  }

  _handleTextBadgeDrag(ann, e) {
    const eng = this.engine, rend = this.renderer;
    eng.selectItem(ann);
    const snap = eng._captureSnapshot('Move Text');
    const sx = e.clientX, sy = e.clientY;
    const isCurve = ann.type === 'curve';
    const isTail = isCurve && ann.textEnd !== 'tip';
    const knot = isCurve ? (isTail ? ann.vertices[ann.vertices.length - 1] : ann.vertices[0]) : null;
    const ox = isCurve ? knot.point[0] : ann.x;
    const oy = isCurve ? knot.point[1] : ann.y;
    let moved = false;

    this._trackDrag(
      (ev) => {
        const z = eng.state.zoom || 1.0;
        const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
        if (Math.hypot(dx, dy) <= 4 && !moved) return;
        moved = true;
        if (isCurve) {
          knot.point[0] = Math.round(ox + dx); knot.point[1] = Math.round(oy + dy);
          eng.recomputeCurve(ann);
        } else {
          ann.x = Math.round(ox + dx); ann.y = Math.round(oy + dy);
        }
        rend.render();
      },
      () => {
        if (moved) {
          eng._undoStack.push(snap);
          eng._redoStack = [];
          eng.emit('history:change', { canUndo: eng.canUndo(), canRedo: eng.canRedo() });
        } else {
          const anchor = isCurve ? (isTail ? ann.beziers[ann.beziers.length - 1][3] : ann.beziers[0][0]) : [ann.x, ann.y];
          this._openInlineText(ann, anchor, null);
        }
      }
    );
  }

  _handleImageDrag(plate, e) {
    const eng = this.engine, rend = this.renderer;
    eng.selectImage(plate);
    const snap = eng._captureSnapshot('Move Image');
    const sx = e.clientX, sy = e.clientY, ox = plate.x, oy = plate.y;
    let moved = false;

    this._trackDrag(
      (ev) => {
        const z = eng.state.zoom || 1.0;
        const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
        if (Math.hypot(dx, dy) > 2) moved = true;
        plate.x = Math.round(ox + dx);
        plate.y = Math.round(oy + dy);
        rend.render();
      },
      () => {
        if (!moved) return;
        eng._undoStack.push(snap);
        eng._redoStack = [];
        eng.emit('history:change', { canUndo: eng.canUndo(), canRedo: eng.canRedo() });
      }
    );
  }

  _handleImageResize(plate, cornerId, e) {
    const eng = this.engine, rend = this.renderer;
    const snap = eng._captureSnapshot('Resize Image');
    const startX = e.clientX, sw = plate.width, sh = plate.height, px = plate.x, py = plate.y;

    this._trackDrag(
      (ev) => {
        const dx = (ev.clientX - startX) / (eng.state.zoom || 1.0);
        const nw = Math.max(40, Math.round(cornerId.includes('e') ? sw + dx : sw - dx));
        const nh = Math.round(nw / plate.aspect);
        plate.x = cornerId.includes('w') ? px + sw - nw : px;
        plate.y = cornerId.includes('n') ? py + sh - nh : py;
        plate.width = nw;
        plate.height = nh;
        rend.render();
      },
      () => {
        eng._undoStack.push(snap);
        eng._redoStack = [];
        eng.emit('history:change', { canUndo: eng.canUndo(), canRedo: eng.canRedo() });
      }
    );
  }

  _handleCalloutResize(ann, cornerId, e) {
    const eng = this.engine, rend = this.renderer;
    const snap = eng._captureSnapshot('Resize Callout');
    const sx = e.clientX, sy = e.clientY;
    const isCircle = ann.type === 'circle_callout';
    const bx = isCircle ? ann.cx - ann.rx : ann.x;
    const by = isCircle ? ann.cy - ann.ry : ann.y;
    const bw = isCircle ? ann.rx * 2 : ann.w;
    const bh = isCircle ? ann.ry * 2 : ann.h;

    this._trackDrag(
      (ev) => {
        const z = eng.state.zoom || 1.0;
        const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
        let nx = bx, ny = by, nw = bw, nh = bh;
        if (cornerId.includes('e')) nw = Math.max(16, Math.round(bw + dx));
        if (cornerId.includes('s')) nh = Math.max(16, Math.round(bh + dy));
        if (cornerId.includes('w')) { nw = Math.max(16, Math.round(bw - dx)); nx = bx + (bw - nw); }
        if (cornerId.includes('n')) { nh = Math.max(16, Math.round(bh - dy)); ny = by + (bh - nh); }

        if (isCircle) {
          ann.cx = Math.round(nx + nw / 2); ann.cy = Math.round(ny + nh / 2);
          ann.rx = Math.round(nw / 2); ann.ry = Math.round(nh / 2);
        } else {
          ann.x = Math.round(nx); ann.y = Math.round(ny); ann.w = nw; ann.h = nh;
        }
        rend.render();
      },
      () => {
        eng._undoStack.push(snap);
        eng._redoStack = [];
        eng.emit('history:change', { canUndo: eng.canUndo(), canRedo: eng.canRedo() });
      }
    );
  }
  _openInlineText(item, anchorPt, forcedEdge = null) {
    if (this._activeEditorCommit) this._activeEditorCommit();
    const state = this.engine.state;
    const fontS = item?.fontSize || state.fontSize || 20;
    const fontF = item?.fontFamily || state.fontFamily;
    const col = item?.color || state.currentColor || '#00e676';

    let left = anchorPt[0], top = anchorPt[1];
    if (item && item.type === 'curve' && item.beziers?.length) {
      const isTail = item.textEnd !== 'tip';
      const seg = isTail ? item.beziers[item.beziers.length - 1] : item.beziers[0];
      const exitVec = isTail ? [seg[3][0] - seg[2][0], seg[3][1] - seg[2][1]] : [seg[0][0] - seg[1][0], seg[0][1] - seg[1][1]];
      const b = this.renderer.measureTextBounds(item.text || 'Note…', fontS, fontF);
      const pl = StudioGeometry.computeTextBoxPlacement(anchorPt, exitVec, b.maxW + 16, b.totalH + 8, forcedEdge);
      left = pl.posX; top = pl.posY;
    }

    if (item) { item._isEditingText = true; this.renderer.render(); }

    const editor = makeElement('div', {
      className: 'qcs-inline-editor',
      contentEditable: 'true',
      style: {
        left: `${left}px`, top: `${top}px`,
        fontSize: `${fontS}px`, fontFamily: fontF, color: col,
        lineHeight: `${Math.round(fontS * 1.25)}px`
      }
    });
    editor.textContent = item?.text || '';
    this.stageWrap.appendChild(editor);

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      this._activeEditorCommit = null;
      window.removeEventListener('mousedown', onOut);
      const val = (editor.innerText || '').trim();
      editor.remove();

      if (item) {
        if (val !== (item.text || '')) this.engine.pushHistory('Edit Text');
        item._isEditingText = false;
        item.text = val;
        this.engine.emit('state:change');
      } else if (val) {
        this.engine.pushHistory('Add Text');
        const badge = {
          id: 'text_' + Date.now(), type: 'text_badge',
          x: Math.round(anchorPt[0]), y: Math.round(anchorPt[1]),
          text: val, fontSize: fontS, fontFamily: fontF,
          boxStyle: state.boxStyle, lineStyle: state.lineStyle, color: col
        };
        this.engine.state.annotations.push(badge);
        this.engine.selectItem(badge);
      } else {
        this.renderer.render();
      }
    };

    this._activeEditorCommit = commit;
    const onOut = (ev) => { if (ev.target !== editor && !editor.contains(ev.target)) commit(); };

    editor.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' && !ev.shiftKey) || ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        commit();
      }
    });

    setTimeout(() => {
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      window.addEventListener('mousedown', onOut);
    }, 10);
  }

  _eraseImagePixels(plate, worldX, worldY, radius = 16, prevX = null, prevY = null) {
    let canvas = plate._eraseCanvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = plate.img.naturalWidth || plate.img.width;
      canvas.height = plate.img.naturalHeight || plate.img.height;
      canvas.getContext('2d').drawImage(plate.img, 0, 0);
      plate._eraseCanvas = canvas;
    }
    plate._hasAlphaEdits = true;
    const ctx = canvas.getContext('2d');
    const sx = canvas.width / plate.width, sy = canvas.height / plate.height;
    const r = Math.max(2, radius * sx);
    const x1 = (worldX - plate.x) * sx, y1 = (worldY - plate.y) * sy;
    const x0 = prevX !== null ? (prevX - plate.x) * sx : x1;
    const y0 = prevY !== null ? (prevY - plate.y) * sy : y1;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(2, r * 0.3)));

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lx = x0 + (x1 - x0) * t, ly = y0 + (y1 - y0) * t;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    plate.img = canvas;
    this.renderer.render();
  }

  _loadImageFile(file, x = 60, y = 60) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => this.engine.addImagePlate(img, x, y);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async _pasteClipboardImage() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          this._loadImageFile(blob, 70, 70);
          return;
        }
      }
      this._showToast('Clipboard has no image');
    } catch (e) {
      this._showToast('Press Ctrl+V to paste image');
    }
  }

  async _exportComposite(btn, downloadOnly = false) {
    if (this._activeEditorCommit) this._activeEditorCommit();
    const p = this.engine.state.prefs || {};
    const scale = p.exportMultiplier || 2;
    const bgMode = p.exportBgMode || 'matte';
    try {
      const { canvas, bounds } = await this.renderer.exportToCanvas(scale, bgMode);
      canvas.toBlob(png => {
        if (!png) return;
        if (downloadOnly) {
          const url = URL.createObjectURL(png);
          const a = document.createElement('a');
          a.href = url;
          a.download = `QuoraToys_Clean_${bounds.width}x${bounds.height}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this._showToast(`💾 Saved ${bounds.width}×${bounds.height}px (${scale}x PNG)`);
          return;
        }
        if (navigator.clipboard && navigator.clipboard.write) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).then(() => {
            if (btn) {
              const orig = btn.textContent;
              btn.textContent = '✓ Copied!';
              setTimeout(() => { btn.textContent = orig; }, 1600);
            }
            this._showToast(`📋 Copied ${bounds.width}×${bounds.height}px (${scale}x PNG)`);
          });
        }
      }, 'image/png');
    } catch (err) {
      this._showToast('⚠ Export failed');
    }
  }

  _cleanup() {
      if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
      if (this._unsubs) this._unsubs.forEach(fn => fn());
      window.removeEventListener('mousemove', this._onWinMove);
      window.removeEventListener('mouseup', this._onWinUp);
      window.removeEventListener('paste', this._onPaste);
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      if (QuoraCleanStudioDialog.activeInstance === this) {
        QuoraCleanStudioDialog.activeInstance = null;
      }
    }

  _handleTangentDrag(curve, knotIdx, side, e) {
    const eng = this.engine, rend = this.renderer;
    const vertices = curve.vertices;
    const v = vertices[knotIdx];
    if (!v) return;

    const snap = eng._captureSnapshot('Adjust Tangency');
    const isStart = knotIdx === 0;
    const isInterior = !isStart && knotIdx !== vertices.length - 1;
    const pt = v.point;

    if (isInterior && !v.isCusp && e.altKey) {
      StudioGeometry.setVertexCuspState(vertices, knotIdx, true);
      eng.recomputeCurve(curve);
      rend.render();
      this._showToast('◆ Broke smooth knot into cusp');
    }

    let snappedToSmooth = false;
    let collinearSmoothDir = null;
    let moved = false;

    this._trackDrag(
      (ev) => {
        moved = true;
        const mPt = this._getStagePt(ev);
        const cursorAngle = Math.atan2(mPt[1] - pt[1], mPt[0] - pt[0]);
        const r = 64 / (eng.state.zoom || 1);

        if (isInterior && v.isCusp) {
          const otherCp = side === 'in' ? v.controlPoints[1] : v.controlPoints[0];
          const otherDir = StudioGeometry.normalize([otherCp[0] - pt[0], otherCp[1] - pt[1]]);
          const collinearAngle = Math.atan2(-otherDir[1], -otherDir[0]);
          const kinkDelta = StudioGeometry.normalizeAngle(cursorAngle - collinearAngle);
          snappedToSmooth = Math.abs(kinkDelta) < 0.095;
          const finalAngle = snappedToSmooth ? collinearAngle : cursorAngle;
          collinearSmoothDir = side === 'out' ? [Math.cos(collinearAngle), Math.sin(collinearAngle)] : otherDir;

          if (side === 'in') {
            const natIn = v._naturalInTangent || [-1, 0];
            v.cuspInAngleOffset = StudioGeometry.normalizeAngle(finalAngle - Math.atan2(natIn[1], natIn[0]));
          } else {
            const natOut = v._naturalOutTangent || [1, 0];
            v.cuspOutAngleOffset = StudioGeometry.normalizeAngle(finalAngle - Math.atan2(natOut[1], natOut[0]));
          }
          eng.recomputeCurve(curve);
          rend.render();
          if (snappedToSmooth) {
            rend.renderTransient({
              collinearGuide: {
                p1: [pt[0] - collinearSmoothDir[0] * r, pt[1] - collinearSmoothDir[1] * r],
                p2: [pt[0] + collinearSmoothDir[0] * r, pt[1] + collinearSmoothDir[1] * r],
                label: '⚡ 0° SMOOTH', pt
              }
            });
          } else {
            rend.clearTransient();
          }
          return;
        }

        const natBase = (typeof UpdateControlPoints !== 'undefined' && UpdateControlPoints.computeCounterfactualTangent)
          ? UpdateControlPoints.computeCounterfactualTangent(vertices, knotIdx)
          : [1, 0];
        const natRay = isStart ? [-natBase[0], -natBase[1]] : natBase;
        let delta = StudioGeometry.normalizeAngle(cursorAngle - Math.atan2(natRay[1], natRay[0]));
        const isNaturalSnap = Math.abs(delta) < 0.087;
        v.isExplicitTangent = !isNaturalSnap;
        v.tangentAngleOffset = isNaturalSnap ? 0 : delta;
        eng.recomputeCurve(curve);
        rend.render();

        if (isNaturalSnap) {
          rend.renderTransient({
            collinearGuide: { p1: [pt[0], pt[1]], p2: [pt[0] + natRay[0] * r, pt[1] + natRay[1] * r], label: '⚡ 0° NATURAL', pt }
          });
        } else {
          rend.clearTransient();
        }
      },
      () => {
        rend.clearTransient();
        if (isInterior && v.isCusp && snappedToSmooth && collinearSmoothDir) {
          StudioGeometry.setVertexCuspState(vertices, knotIdx, false, collinearSmoothDir);
          eng.recomputeCurve(curve);
          this._showToast('● Snapped 0° Smooth Point');
        }
        if (moved) eng.commitSnapshot(snap);
        eng.emit('state:change');
      }
    );
  }
  _trackDrag(onMove, onUp) {
    const handleMove = (ev) => onMove(ev);
    const handleUp = (ev) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (onUp) onUp(ev);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }

  _buildWelcomePrompt() {
        const card = makeElement('div', {
          style: {
            maxWidth: '580px', width: '100%',
            background: 'rgba(11, 17, 32, 0.90)',
            border: '1.5px solid rgba(0, 242, 254, 0.4)',
            borderRadius: '14px', padding: '16px 18px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)', color: '#f8fafc',
            display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none'
          }
        }, [
          makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            makeElement('strong', { style: { fontSize: '13.5px', color: '#00f2fe' } }, '✨ Quick Start — Drag Anywhere on the Canvas to Begin'),
            makeElement('button', {
              className: 'qcs-btn qcs-welcome-action',
              style: { pointerEvents: 'auto', padding: '2px 8px' },
              onclick: (e) => { e.stopPropagation(); this._welcomeHidden = true; this._syncWelcomePrompt(); }
            }, '✕')
          ]),
          makeElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '11.5px', color: '#cbd5e1', lineHeight: '1.45' } }, [
            makeElement('div', {}, [makeElement('strong', { style: { color: '#00f2fe', display: 'block' } }, '〰️ Drag to Draw Curves & Arrows'), 'Pull smoothly with the 32px tether; back up to erase. Hold Shift for straight arrows.']),
            makeElement('div', {}, [makeElement('strong', { style: { color: '#00e676', display: 'block' } }, '🎯 Pull Points & Reshape'), 'Switch to Select [V] or drag knots, tangent rays, and midpoint dots directly.']),
            makeElement('div', {}, [makeElement('strong', { style: { color: '#ffd700', display: 'block' } }, '💬 Turn On Text & Styles'), 'Pick Text [T] or click any curve’s "Note…" box. Toggle Arrow, Ink/Neon, Loop & Colors below.']),
            makeElement('div', {}, [makeElement('strong', { style: { color: '#c084fc', display: 'block' } }, '🖼️ Drop or Paste Images'), 'Drop an image file onto the canvas or press Ctrl+V, then Copy PNG when done.'])
          ]),
          makeElement('div', {
            style: {
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '8px', padding: '7px 10px', fontSize: '11px', color: '#fde68a'
            }
          }, '🎬 Video Tutorial Coming Soon — A short interactive walkthrough showing curves, point pulling, text, and image markup is on the way.')
        ]);

        return makeElement('div', {
          style: {
            position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', paddingBottom: '68px', zIndex: '45', pointerEvents: 'none'
          }
        }, [card]);
      }

  _syncWelcomePrompt() {
        if (!this.welcomePromptEl) return;
        const st = this.engine.state;
        const hasContent = (st.placedImages?.length > 0) || (st.annotations?.length > 0);
        this.welcomePromptEl.style.display = (!hasContent && !this._welcomeHidden) ? 'flex' : 'none';
      }
}

globalThis.QuoraCleanStudioDialog = QuoraCleanStudioDialog;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraCleanStudioDialog;