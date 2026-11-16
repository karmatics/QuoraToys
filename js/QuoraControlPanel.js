/**
 * QuoraControlPanel
 * A dockable controls panel (buttons, segmented selectors, sliders, color swatches)
 * that drives an existing QuoraAnnotationComponent canvas. It owns NO canvas.
 * State is read from component.stageState and mirrored back via a light poll.
 */
class QuoraControlPanel {
  static current = null;
  static SWATCHES = ['#00f2fe', '#00e676', '#ffd700', '#ff2d55', '#c084fc', '#ffffff'];

  static attach(component) {
    if (!component) return null;
    if (component._controlPanel) return component._controlPanel;
    if (QuoraControlPanel.current) QuoraControlPanel.current.destroy();

    const panel = new QuoraControlPanel(component);
    component._controlPanel = panel;
    QuoraControlPanel.current = panel;
    panel._installHeaderButton();
    panel._bindHotkeys();

    let wantOpen = true;
    try { wantOpen = localStorage.getItem('quoratoys_panel_open') !== '0'; } catch (e) {}
    if (wantOpen) panel.open();
    return panel;
  }

  constructor(component) {
    this.component = component;
    this.dialog = null;
    this._updaters = [];
    this._timer = null;
    this._destroyed = false;
    this._headerBtn = null;
    this._keyHandler = null;
    this._winHandler = null;
    this._fileInput = null;
  }

  get st() { return this.component.stageState; }

  _curve() {
    const s = this.st.selectedItem;
    return (s && s.type === 'curve') ? s : null;
  }

  _textTarget() {
    const s = this.st.selectedItem;
    return (s && (s.type === 'curve' || s.type === 'text_badge')) ? s : null;
  }

  _knotInfo() {
    const curve = this._curve();
    const idx = this.component._activeKnotIdx;
    if (!curve || !curve.vertices || idx === null || idx === undefined) return null;
    const knot = curve.vertices[idx];
    return knot ? { curve, knot, idx } : null;
  }

  _prefs() {
    if (!this.st.prefs) this.st.prefs = {};
    return this.st.prefs;
  }

  _savePrefs() {
    if (typeof this.component.savePreferences === 'function') this.component.savePreferences();
  }

  // ───────────────────────── lifecycle ─────────────────────────
  _installHeaderButton() {
    const wrap = this.component.viewport?.parentElement;
    const first = wrap ? wrap.querySelector('button') : null;
    if (!first || !first.parentElement) return;
    this._headerBtn = makeElement('button', {
      className: 'dr-nav-btn',
      style: { padding: '3px 9px', fontSize: '10.5px', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.45)' },
      title: 'Toggle Studio Controls panel [P]',
      onclick: () => this.toggle()
    }, '🎛️ Panel');
    first.parentElement.insertBefore(this._headerBtn, first);
  }

  _bindHotkeys() {
    this._keyHandler = (e) => {
      if (this._destroyed) return;
      if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'm') { e.preventDefault(); this._toggleMove(); }
      else if (k === 'p') { e.preventDefault(); this.toggle(); }
    };
    window.addEventListener('keydown', this._keyHandler);

    this._winHandler = () => requestAnimationFrame(() => this.refresh());
    window.addEventListener('mouseup', this._winHandler);
    window.addEventListener('keyup', this._winHandler);
  }

  _startPoll() {
    this._stopPoll();
    this._timer = setInterval(() => this.refresh(), 250);
  }

  _stopPoll() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  toggle() {
    if (this.dialog) this.dialog.close();
    else this.open();
  }

  open() {
    if (this.dialog) { this.dialog.bringToFront?.(); return; }
    this._injectStyles();
    const root = this._build();
    const maker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
      ? UITools.makeDialog
      : (opts => new DialogBox(opts));
    const h = Math.max(380, Math.min(700, window.innerHeight - 90));

    this.dialog = maker({
      title: '🎛️ Studio Controls',
      size: [304, h],
      position: [Math.max(16, window.innerWidth - 328), 64],
      noPadding: true,
      allowMaximize: false,
      stateId: 'quora_control_panel_v1',
      content: root,
      onClose: () => {
        this.dialog = null;
        this._stopPoll();
        if (!this._destroyed) {
          try { localStorage.setItem('quoratoys_panel_open', '0'); } catch (e) {}
        }
      }
    });

    try { localStorage.setItem('quoratoys_panel_open', '1'); } catch (e) {}
    this._startPoll();
    this.refresh();
  }

  destroy() {
    this._destroyed = true;
    this._stopPoll();
    if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
    if (this._winHandler) {
      window.removeEventListener('mouseup', this._winHandler);
      window.removeEventListener('keyup', this._winHandler);
    }
    if (this.dialog) { try { this.dialog.close(); } catch (e) {} }
    if (this._headerBtn) this._headerBtn.remove();
    if (this.component && this.component._controlPanel === this) this.component._controlPanel = null;
    if (QuoraControlPanel.current === this) QuoraControlPanel.current = null;
  }

  refresh() {
    if (!this.dialog || this._destroyed) return;
    const vp = this.component.viewport;
    if (!vp || !vp.isConnected) { this.destroy(); return; }
    this._updaters.forEach(fn => { try { fn(); } catch (e) {} });
  }

  // ───────────────────────── widget helpers ─────────────────────────
  _btn(label, title, onClick, extraClass = '') {
    const b = makeElement('button', {
      className: `qcp-btn ${extraClass}`.trim(),
      title: title || '',
      onclick: (e) => { e.stopPropagation(); onClick(b, e); this.refresh(); }
    }, label);
    return b;
  }

  _seg(options, getCur, onPick) {
    const wrap = makeElement('div', { className: 'qcp-seg' });
    const btns = {};
    options.forEach(([id, label, title]) => {
      btns[id] = makeElement('button', {
        title: title || '',
        onclick: (e) => { e.stopPropagation(); onPick(id); this.refresh(); }
      }, label);
      wrap.appendChild(btns[id]);
    });
    this._updaters.push(() => {
      const cur = getCur();
      Object.entries(btns).forEach(([id, b]) => b.classList.toggle('active', id === cur));
    });
    return wrap;
  }

  _slider(label, min, max, step, getVal, setVal, fmt = (v) => String(v), isEnabled = null) {
    const valEl = makeElement('span', { className: 'qcp-val' }, '');
    let dragging = false;
    const input = makeElement('input', {
      type: 'range', min: String(min), max: String(max), step: String(step), value: String(min)
    });
    input.addEventListener('pointerdown', () => { dragging = true; });
    input.addEventListener('pointerup', () => { dragging = false; });
    input.addEventListener('pointercancel', () => { dragging = false; });
    input.addEventListener('change', () => { dragging = false; });
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      setVal(v);
      valEl.textContent = fmt(v);
    });

    const rowEl = makeElement('div', { className: 'qcp-slider' }, [
      makeElement('span', { style: { color: '#94a3b8' } }, label),
      input,
      valEl
    ]);

    this._updaters.push(() => {
      const enabled = isEnabled ? isEnabled() : true;
      input.disabled = !enabled;
      rowEl.style.opacity = enabled ? '1' : '0.4';
      if (dragging) return;
      const v = getVal();
      if (v === undefined || v === null || Number.isNaN(v)) return;
      if (parseFloat(input.value) !== v) input.value = String(v);
      valEl.textContent = fmt(v);
    });
    return rowEl;
  }

  _select(options, getCur, onPick, isEnabled = null) {
    const sel = makeElement('select', {
      className: 'qcp-select',
      onchange: (e) => { onPick(e.target.value); this.refresh(); }
    }, options.map(([value, text]) => makeElement('option', { value }, text)));
    this._updaters.push(() => {
      sel.disabled = isEnabled ? !isEnabled() : false;
      const cur = getCur();
      if (sel.value !== cur) sel.value = cur;
    });
    return sel;
  }

  // ───────────────────────── actions ─────────────────────────
  _setTool(mode) {
    const c = this.component;
    const st = this.st;
    st.activeTool = mode;
    c.toolBtns?.curve?.classList.toggle('primary', mode === 'curve');
    c.toolBtns?.paint?.classList.toggle('primary', mode === 'paint');
    if (c.brushControlsRibbon) c.brushControlsRibbon.style.display = (mode === 'paint') ? 'flex' : 'none';
    c.showKnotToast(mode === 'curve' ? '🪢 Curve Tool Active' : '🖌️ Paint / Eraser Active');
  }

  _toggleMove() {
    const st = this.st;
    st.moveWholeMode = !st.moveWholeMode;
    this.component.showKnotToast(st.moveWholeMode
      ? '✥ Move mode ON — drag any curve, arrow or text to move the whole entity'
      : '🪢 Move mode OFF — drag a curve to bend it');
    this.refresh();
  }

  _setArrow(mode) {
    const c = this.component;
    const st = this.st;
    if (this._curve()) { c.setArrowMode(mode); return; }
    st.arrowMode = mode;
    st.hasArrow = (mode !== 'none');
    const p = this._prefs();
    p.arrowMode = mode;
    p.hasArrow = st.hasArrow;
    this._savePrefs();
    if (c.arrowModeBtns) Object.entries(c.arrowModeBtns).forEach(([k, b]) => b.classList.toggle('primary', k === mode));
    c.showKnotToast(`Arrow: ${mode.toUpperCase()}`);
  }

  _setWidth(v) {
    const c = this.component;
    const st = this.st;
    st.curveStrokeWidth = v;
    const p = this._prefs();
    p.curveStrokeWidth = v;
    this._savePrefs();
    if (c.widthValueLbl) c.widthValueLbl.textContent = `${v}px`;
    const curve = this._curve();
    if (curve) {
      curve.strokeWidth = v;
      c.commitCurveGeometryUpdate();
    }
  }

  _setFontSize(v) {
    const c = this.component;
    const st = this.st;
    st.fontSize = v;
    const p = this._prefs();
    p.fontSize = v;
    this._savePrefs();
    const t = this._textTarget();
    if (t) t.fontSize = v;
    if (c.fontSizeBadge) c.fontSizeBadge.textContent = `${v}px`;
    c.renderStage();
  }

  _applyColor(hex) {
    const c = this.component;
    const st = this.st;
    st.currentColor = hex;
    const p = this._prefs();
    p.currentColor = hex;
    this._savePrefs();
    if (c.colorIndicatorDot) {
      c.colorIndicatorDot.style.background = hex;
      c.colorIndicatorDot.style.boxShadow = `0 0 8px ${hex}`;
    }

    const sel = st.selectedItem;
    if (!sel) { c.renderStage(); return; }
    sel.color = hex;
    if (sel.type === 'curve') {
      c.commitCurveGeometryUpdate();
    } else if (sel.type === 'circle_callout' || sel.type === 'box_callout') {
      if (sel.elements?.[1]) sel.elements[1].setAttribute('stroke', hex);
      if (sel.elements?.[2]) {
        sel.elements[2].setAttribute('stroke', hex);
        sel.elements[2].style.filter = `drop-shadow(0 0 8px ${hex})`;
      }
      c.renderStage();
    } else {
      c.renderStage();
    }
  }

  _describe() {
    const st = this.st;
    const trunc = (s) => (s.length > 22 ? s.slice(0, 22) + '…' : s);
    if (st.activeImage) return `🖼️ Image plate ${st.activeImage.width}×${st.activeImage.height}`;
    const sel = st.selectedItem;
    if (!sel) return 'Nothing selected — click a curve, text, or shape';
    if (sel.type === 'curve') {
      const n = sel.vertices ? sel.vertices.length : 0;
      const arrow = sel.isClosed ? 'loop' : `arrow ${sel.arrowEnd || 'none'}`;
      const txt = (sel.text && sel.text.trim()) ? ` · "${trunc(sel.text.trim())}"` : '';
      return `🪢 Entity: curve (${n} knots) · ${arrow}${txt}`;
    }
    if (sel.type === 'text_badge') return `💬 Text "${trunc(sel.text || '')}"`;
    if (sel.type === 'circle_callout') return '⭕ Highlight ring';
    if (sel.type === 'box_callout') return '◻ Frame box';
    return `Selected: ${sel.type}`;
  }

  _build() {
      this._updaters = [];
      const c = this.component;
      const st = this.st;
      const el = (tag, attrs, ...kids) => makeElement(tag, attrs || {}, ...kids);
      const card = (title, ...children) => el('div', { className: 'qcp-card' },
        [title ? el('h4', {}, title) : null, ...children].filter(Boolean));
      const rowOf = (...kids) => el('div', { className: 'qcp-row' }, kids.filter(Boolean));

      this._fileInput = el('input', {
        type: 'file', accept: 'image/*', style: { display: 'none' },
        onchange: (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => c.addNewImagePlate(img, 60, 60);
            img.src = ev.target.result;
          };
          reader.readAsDataURL(f);
          e.target.value = '';
        }
      });

      const status = el('div', { className: 'qcp-status' }, '');
      this._updaters.push(() => {
        const d = this._describe();
        if (status.textContent !== d) status.textContent = d;
      });

      const toolSeg = this._seg(
        [['curve', '🪢 Curve', 'Draw curves, arrows & callouts'], ['paint', '🖌️ Paint', 'Blockout masks & alpha eraser']],
        () => st.activeTool, (id) => this._setTool(id)
      );
      const moveBtn = this._btn('✥ Move whole: OFF', 'Drag any curve/arrow/text to move the whole entity [M]', () => this._toggleMove());
      this._updaters.push(() => {
        moveBtn.classList.toggle('active', !!st.moveWholeMode);
        moveBtn.textContent = `✥ Move whole: ${st.moveWholeMode ? 'ON' : 'OFF'}`;
      });
      const undoBtn = this._btn('↺ Undo', 'Remove the last annotation', () => c.undoLastAnnotation());
      const toolsCard = card('Tool & Move', rowOf(toolSeg, undoBtn), rowOf(moveBtn));

      const needCurve = (b) => this._updaters.push(() => { b.disabled = !this._curve(); });
      const flipBtn = this._btn('⇄ Flip ends', 'Swap arrowhead & text ends [X]', () => c.swapActiveCurveTerminals());
      needCurve(flipBtn);
      const loopBtn = this._btn('○ Loop', 'Close/open the curve as a ring [L]', () => c.toggleLoopMode());
      needCurve(loopBtn);
      this._updaters.push(() => loopBtn.classList.toggle('active', !!this._curve()?.isClosed));
      const straightBtn = this._btn('📏 Straighten', 'Remove intermediate knots [S]', () => c.executeKeyInCommand('straighten'));
      needCurve(straightBtn);
      const addKnotBtn = this._btn('＋ Knot', 'Insert a knot on the active segment [+]', () => c.addKnotToActiveCurve());
      needCurve(addKnotBtn);
      const textBtn = this._btn('💬 Add / edit note', 'Type text on the selected curve or canvas [T]', () => c.triggerTextOnActiveOrCanvas());
      const delAllBtn = this._btn('🗑 Delete entity', 'Delete the whole selected entity (curve + arrow + text)', () => c.deleteSelectedEntity({ wholeEntity: true }), 'danger');
      this._updaters.push(() => { delAllBtn.disabled = !(st.selectedItem || st.activeImage); });
      const entityCard = card('Selected Entity', status, rowOf(flipBtn, loopBtn, straightBtn), rowOf(addKnotBtn, textBtn), rowOf(delAllBtn));

      const knotLabel = el('span', { className: 'qcp-val', style: { textAlign: 'center', flex: '1' } }, 'No knot');
      this._updaters.push(() => {
        const k = this._knotInfo();
        knotLabel.textContent = k ? `Knot #${k.idx + 1}/${k.curve.vertices.length}${k.knot.isCusp ? ' ◆ cusp' : ''}` : 'No knot';
      });
      const prevKnot = this._btn('◀', 'Previous knot [Shift+Tab]', () => c.executeKeyInCommand('next_knot', { shiftKey: true }));
      const nextKnot = this._btn('▶', 'Next knot [Tab]', () => c.executeKeyInCommand('next_knot', { shiftKey: false }));
      needCurve(prevKnot); needCurve(nextKnot);
      const cuspBtn = this._btn('◆ Cusp', 'Toggle sharp corner on the active interior knot [C]', () => c.executeKeyInCommand('toggle_cusp'));
      this._updaters.push(() => {
        const k = this._knotInfo();
        cuspBtn.disabled = !k;
        cuspBtn.classList.toggle('active', !!k?.knot.isCusp);
      });
      const resetKnotBtn = this._btn('↺ Reset', 'Reset this knot to smooth defaults [R]', () => c.executeKeyInCommand('reset_knot'));
      this._updaters.push(() => { resetKnotBtn.disabled = !this._knotInfo(); });
      const delKnotBtn = this._btn('🗑 Delete knot', 'Delete the active knot', () => {
        const cv = this._curve();
        if (!cv) return;
        if (cv.vertices.length > 2) c.deleteSelectedEntity({ knotIdx: c._activeKnotIdx });
        else c.deleteSelectedEntity({ wholeEntity: true });
      }, 'danger');
      this._updaters.push(() => {
        const k = this._knotInfo();
        delKnotBtn.disabled = !k;
        if (k) delKnotBtn.textContent = k.curve.vertices.length > 2 ? `🗑 Delete knot #${k.idx + 1}` : '🗑 Delete curve';
      });

      const applyKnot = () => {
        const k = this._knotInfo();
        if (!k) return;
        c.commitCurveGeometryUpdate();
        c.exposeBezierHandles(k.curve);
      };
      const curvSlider = this._slider('Curvature', 0.2, 3, 0.05,
        () => this._knotInfo()?.knot.curvature ?? 1,
        (v) => { const k = this._knotInfo(); if (k) { k.knot.curvature = v; applyKnot(); } },
        (v) => v.toFixed(2), () => !!this._knotInfo());
      const balSlider = this._slider('Balance', 0.1, 1.9, 0.05,
        () => this._knotInfo()?.knot.balance ?? 1,
        (v) => { const k = this._knotInfo(); if (k) { k.knot.balance = v; applyKnot(); } },
        (v) => v.toFixed(2), () => !!this._knotInfo());
      const tanSlider = this._slider('Tangent', -90, 90, 1,
        () => Math.round((this._knotInfo()?.knot.tangentAngleOffset || 0) * 180 / Math.PI),
        (deg) => {
          const k = this._knotInfo();
          if (!k) return;
          const rad = deg * Math.PI / 180;
          k.knot.isExplicitTangent = Math.abs(rad) >= 0.0436;
          k.knot.tangentAngleOffset = k.knot.isExplicitTangent ? rad : 0;
          applyKnot();
        },
        (v) => `${v}°`, () => { const k = this._knotInfo(); return !!k && !k.knot.isCusp; });

      const knotCard = card('Knot (active point)',
        rowOf(prevKnot, knotLabel, nextKnot),
        rowOf(cuspBtn, resetKnotBtn, delKnotBtn),
        curvSlider, balSlider, tanSlider);

      const styleSeg = this._seg([['classic', '🖋️ Ink'], ['neon', '💡 Neon']],
        () => st.selectedItem?.lineStyle || st.lineStyle || 'classic',
        (id) => c.setLineStyle(id));
      const arrowSeg = this._seg([['none', 'Off'], ['tip', '➔ Tip'], ['tail', '⬅ Tail'], ['both', '↔']],
        () => (this._curve() ? (this._curve().arrowEnd || 'none') : (st.arrowMode || (st.hasArrow ? 'tip' : 'none'))),
        (id) => this._setArrow(id));
      const tipStyleSeg = this._seg([['concave', 'Swept'], ['architectural', 'Arch'], ['dot', '● Dot']],
        () => (this._curve() ? (this._curve().arrowStyle || 'concave') : (st.arrowStyle || 'concave')),
        (id) => this._setArrowStyle(id));

      const swatchBtns = [];
      QuoraControlPanel.SWATCHES.forEach(hex => {
        const b = el('button', {
          className: 'qcp-swatch', title: hex,
          style: { background: hex },
          onclick: (e) => { e.stopPropagation(); this._applyColor(hex); this.refresh(); }
        });
        swatchBtns.push([hex, b]);
      });
      const wheelBtn = this._btn('🎨', 'Custom color wheel', (b) => c.launchColorPicker('curve', b));
      this._updaters.push(() => {
        const cur = (st.selectedItem?.color || st.currentColor || '').toLowerCase();
        swatchBtns.forEach(([hex, b]) => b.classList.toggle('active', hex === cur));
      });

      const widthSlider = this._slider('Line width', 1, 20, 0.1,
        () => this._curve()?.strokeWidth ?? st.curveStrokeWidth ?? 3.2,
        (v) => this._setWidth(Math.round(v * 10) / 10),
        (v) => `${(Math.round(v * 10) / 10)}px`);
      const fontSlider = this._slider('Text size', 11, 48, 1,
        () => this._textTarget()?.fontSize ?? st.fontSize ?? 20,
        (v) => this._setFontSize(Math.round(v)),
        (v) => `${Math.round(v)}px`);
      const tetherSlider = this._slider('Tether lead', 12, 64, 2,
        () => st.tetherLength || 32,
        (v) => { st.tetherLength = v; this._prefs().tetherLength = v; this._savePrefs(); },
        (v) => `${v}px`);

      const styleCard = card('Style (selection + defaults)',
        rowOf(styleSeg), rowOf(arrowSeg), rowOf(tipStyleSeg),
        el('div', { className: 'qcp-row' }, [...swatchBtns.map(([, b]) => b), wheelBtn]),
        widthSlider, fontSlider, tetherSlider);

      const ta = el('textarea', {
        className: 'qcp-text', placeholder: 'Select a curve or text, then type here…', spellcheck: 'false'
      });
      ta.addEventListener('input', () => {
        const t = this._textTarget();
        if (!t) return;
        t.text = ta.value;
        c.renderStage();
      });
      this._updaters.push(() => {
        const t = this._textTarget();
        ta.disabled = !t;
        if (document.activeElement === ta) return;
        const v = t ? (t.text || '') : '';
        if (ta.value !== v) ta.value = v;
      });
      const frameSel = this._select(
        [['bracket', '◺ Bracket'], ['box', '◻ Box'], ['pill', '💊 Pill'], ['none', 'Plain']],
        () => this._textTarget()?.boxStyle || st.boxStyle || 'bracket',
        (v) => {
          st.boxStyle = v;
          this._prefs().boxStyle = v;
          this._savePrefs();
          const t = this._textTarget();
          if (t) t.boxStyle = v;
          c.renderStage();
        });
      const dockSel = this._select(
        [['auto', 'Dock: auto'], ['left', 'Dock: left'], ['right', 'Dock: right'], ['top', 'Dock: top'], ['bottom', 'Dock: bottom']],
        () => { const cv = this._curve(); return (cv && cv.manualEdge && cv.connectEdge) ? cv.connectEdge : 'auto'; },
        (v) => {
          const cv = this._curve();
          if (!cv) return;
          cv.manualEdge = (v !== 'auto');
          cv.connectEdge = (v === 'auto') ? null : v;
          c.renderStage();
        },
        () => !!this._curve());
      const textCard = card('Callout Text', ta, rowOf(frameSel, dockSel));

      const brushSel = this._select(
        [['freehand', '🖌️ Freehand mask'], ['erase', '🧹 Erase image alpha'], ['rect', '◻ Rect mask'], ['oval', '⭕ Oval mask']],
        () => st.brushMode || 'freehand', (v) => { st.brushMode = v; });
      const sizeSlider = this._slider('Brush size', 8, 140, 1, () => st.brushSize, (v) => { st.brushSize = Math.round(v); }, (v) => `${Math.round(v)}px`);
      const featherSlider = this._slider('Feather', 0, 25, 1, () => st.brushSoftness, (v) => { st.brushSoftness = Math.round(v); c.updateSvgBlurFilter(); }, (v) => `${Math.round(v)}px`);
      const brushColor = el('input', {
        type: 'color', value: st.brushColor || '#000000',
        style: { width: '30px', height: '22px', padding: '0', border: '1px solid #475569', borderRadius: '4px', background: 'none', cursor: 'pointer' },
        oninput: (e) => { st.brushColor = e.target.value; }
      });
      const paintCard = card('Paint / Mask', rowOf(brushSel, brushColor), sizeSlider, featherSlider);
      this._updaters.push(() => { paintCard.style.display = (st.activeTool === 'paint') ? 'flex' : 'none'; });

      const copyBtn = this._btn('📋 Copy PNG', 'Copy composite PNG [Ctrl+C]', (b) => c.copyCompositeToClipboard(b, 'native', false), 'primary');
      const saveBtn = this._btn('💾 Save', 'Save PNG file', (b) => c.copyCompositeToClipboard(b, 'native', true));
      const areaBtn = this._btn('📐 Export area', 'Drag a custom export crop on the canvas', () => c.toggleExportAreaMode());
      const imageBtn = this._btn('📁 Image', 'Add an image plate', () => this._fileInput.click());
      const layersBtn = this._btn('📑 Layers', 'Layer hierarchy', () => c.openLayerHierarchyDialog());
      const tunerBtn = this._btn('✨ Glow/Text', 'Typography, glow & export settings', () => c.openAestheticTunerDialog());
      const keysBtn = this._btn('⌨️ Keys', 'Key-in matrix HUD', () => {
        const h = document.getElementById('qa-keyin-matrix-hud');
        if (h) h.style.display = (h.style.display === 'none') ? 'flex' : 'none';
        else c.setupKeyInMatrixHud();
      });
      const diffBtn = this._btn('🧩 Spot Diff', 'Open the Spot-the-Difference comparator', () => c.openSpotDiffWorkflow());
      const canvasCard = card('Canvas & Export',
        rowOf(copyBtn, saveBtn, areaBtn), rowOf(imageBtn, layersBtn, tunerBtn), rowOf(keysBtn, diffBtn), this._fileInput);

      const hint = el('div', { className: 'qcp-hint' },
        'M = move whole entity • Alt+drag text = reshape that end • Delete = knot under cursor • P = this panel');

      return el('div', { className: 'qcp-root' },
        [toolsCard, entityCard, knotCard, styleCard, textCard, paintCard, canvasCard, hint]);
    }
  _injectStyles() {
    if (typeof applyCss !== 'function') return;
    applyCss(`
      .qcp-root { display:flex; flex-direction:column; gap:8px; padding:10px; background:#070a13; color:#e2e8f0;
        font-family:system-ui,-apple-system,sans-serif; font-size:11.5px; box-sizing:border-box; min-height:100%; }
      .qcp-card { background:rgba(15,23,42,0.7); border:1px solid #1e293b; border-radius:10px; padding:8px 10px;
        display:flex; flex-direction:column; gap:7px; }
      .qcp-card h4 { margin:0; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#00f2fe; font-weight:800; }
      .qcp-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .qcp-btn { background:rgba(255,255,255,0.05); color:#cbd5e1; border:1px solid rgba(255,255,255,0.12);
        border-radius:8px; padding:4px 9px; font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;
        transition:all 0.12s ease; }
      .qcp-btn:hover:not(:disabled) { background:rgba(0,242,254,0.14); color:#fff; border-color:rgba(0,242,254,0.5); }
      .qcp-btn:disabled { opacity:0.35; cursor:default; }
      .qcp-btn.active { background:rgba(0,242,254,0.22); color:#00f2fe; border-color:#00f2fe; }
      .qcp-btn.primary { background:#238636; color:#fff; border-color:#2ea043; font-weight:700; }
      .qcp-btn.danger { color:#ff7b72; }
      .qcp-seg { display:inline-flex; background:#04060d; border:1px solid #1e293b; border-radius:14px; padding:2px; gap:2px; }
      .qcp-seg button { background:transparent; border:none; color:#94a3b8; padding:3px 8px; border-radius:12px;
        font-size:10.5px; font-weight:700; cursor:pointer; white-space:nowrap; }
      .qcp-seg button:hover { color:#fff; }
      .qcp-seg button.active { background:#0284c7; color:#fff; }
      .qcp-slider { display:grid; grid-template-columns:74px 1fr 46px; align-items:center; gap:6px; }
      .qcp-slider input { width:100%; accent-color:#00f2fe; cursor:pointer; }
      .qcp-val { text-align:right; color:#ffd700; font-weight:700; font-family:monospace; font-size:10.5px; }
      .qcp-swatch { width:20px; height:20px; border-radius:50%; border:2px solid rgba(255,255,255,0.3); cursor:pointer;
        padding:0; transition:transform 0.12s ease; }
      .qcp-swatch:hover { transform:scale(1.15); }
      .qcp-swatch.active { border-color:#fff; transform:scale(1.2); box-shadow:0 0 8px rgba(255,255,255,0.5); }
      .qcp-status { background:rgba(0,242,254,0.07); border:1px solid rgba(0,242,254,0.25); border-radius:6px;
        padding:5px 8px; color:#cbd5e1; font-size:11px; line-height:1.35; }
      .qcp-text { width:100%; box-sizing:border-box; min-height:52px; resize:vertical; background:#04060d; color:#f8fafc;
        border:1px solid #334155; border-radius:6px; padding:6px 8px; font:inherit; outline:none; }
      .qcp-text:disabled { opacity:0.45; }
      .qcp-text:focus { border-color:#00f2fe; }
      .qcp-select { background:#04060d; color:#00f2fe; border:1px solid #334155; border-radius:6px; padding:3px 6px;
        font-size:10.5px; outline:none; max-width:140px; }
      .qcp-select:disabled { opacity:0.4; }
      .qcp-hint { color:#64748b; font-size:10px; line-height:1.4; padding:0 2px 6px; }
    `, 'QuoraControlPanelStyles');
  }

  _setArrowStyle(style) {
      this.component.setArrowStyle(style);
    }
}

globalThis.QuoraControlPanel = QuoraControlPanel;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraControlPanel;