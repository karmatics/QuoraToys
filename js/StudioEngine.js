/**
 * StudioEngine
 * Pure application state, undo/redo history, event bus, and extensible
 * Tool / Command / Inspector registries. Zero DOM dependencies.
 */
class StudioEngine {
  constructor(initialPrefs = null) {
    this._listeners = new Map();
    this._tools = new Map();
    this._commands = new Map();
    this._inspectorSections = new Map();
    this._undoStack = [];
    this._redoStack = [];
    this._maxHistory = 60;

    const prefs = this._loadPrefs(initialPrefs);

    this.state = {
      activeTool: 'curve',
      lineStyle: prefs.lineStyle,
      arrowMode: prefs.arrowMode,
      hasArrow: prefs.arrowMode !== 'none',
      currentColor: prefs.currentColor,
      strokeWidth: prefs.curveStrokeWidth,
      fontFamily: prefs.fontFamily,
      fontSize: prefs.fontSize,
      boxStyle: prefs.boxStyle,
      tetherLength: prefs.tetherLength,
      eraseRadius: prefs.eraseRadius,
      brushMode: 'freehand',
      brushColor: '#000000',
      brushSize: 32,
      brushSoftness: 0,
      paintTetherLength: prefs.paintTetherLength,
      canvasBgMode: 'matte',
      canvasBgColor: prefs.canvasBgColor,
      cadStrokeMode: prefs.cadStrokeMode,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      minZoom: 0.15,
      maxZoom: 6.0,
      padding: 45,
      prefs,
      placedImages: [],
      annotations: [],
      diffCallouts: [],
      exportRect: null,
      selectedItemId: null,
      selectedImageId: null,
      activeKnotIdx: 0,
      selectedKnotIndices: []
    };

    this._registerCoreCommands();
  }

  _loadPrefs(override = null) {
    const defaults = {
      prefsVersion: 2,
      fontSize: 20,
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      boxStyle: 'bracket',
      textGlowMode: 'match',
      textGlowBlur: 5.5,
      textGlowSpread: 3.5,
      textGlowIntensity: 1.8,
      textGlowOpacity: 0.92,
      textReadabilityHalo: false,
      textCoreSaturation: 0.30,
      textBoxBgEnabled: false,
      textBoxBgColor: '#090d16',
      textBoxBgOpacity: 0.55,
      textBoxBgBlur: 4.0,
      lineStyle: 'classic',
      curveStrokeWidth: 3.2,
      arrowMode: 'tip',
      currentColor: '#00e676',
      curveGlowBlur: 6.0,
      curveGlowWidth: 10.0,
      curveGlowOpacity: 0.90,
      borderStrokeWidth: 2.4,
      axisThreshold: 15,
      cadStrokeMode: true,
      tetherLength: 32,
      eraseRadius: 20,
      paintTetherLength: 12,
      exportMultiplier: 2,
      exportBgMode: 'matte',
      canvasBgColor: '#090d16'
    };

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem('quoratoys_prefs_v1') || '{}');
    } catch (e) {}
    return { ...defaults, ...saved, ...(override || {}) };
  }

  savePrefs() {
    try {
      localStorage.setItem('quoratoys_prefs_v1', JSON.stringify(this.state.prefs));
    } catch (e) {}
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }

  emit(event, payload = null) {
    const set = this._listeners.get(event);
    if (!set) return;
    set.forEach(fn => {
      try { fn(payload, this); } catch (err) { console.error('[StudioEngine]', event, err); }
    });
  }

  registerTool(toolDef) {
    if (!toolDef || !toolDef.id) return;
    this._tools.set(toolDef.id, { order: 100, cursor: 'crosshair', ...toolDef });
    this.emit('tools:change', this.getTools());
  }

  getTool(id) {
    return this._tools.get(id) || null;
  }

  getTools() {
    return Array.from(this._tools.values()).sort((a, b) => (a.order || 100) - (b.order || 100));
  }

  registerCommand(id, cmdDef) {
    if (!id || !cmdDef) return;
    this._commands.set(id, { id, ...cmdDef });
    this.emit('commands:change', id);
  }

  runCommand(id, payload = null) {
    const cmd = this._commands.get(id);
    if (!cmd || typeof cmd.execute !== 'function') return false;
    return cmd.execute(this, payload);
  }

  getCommands(category = null) {
    const all = Array.from(this._commands.values());
    return category ? all.filter(c => c.category === category) : all;
  }

  registerInspectorSection(id, def) {
    if (!id || !def) return;
    this._inspectorSections.set(id, { id, order: 100, ...def });
    this.emit('inspector:change', id);
  }

  getInspectorSections() {
    return Array.from(this._inspectorSections.values()).sort((a, b) => (a.order || 100) - (b.order || 100));
  }

  getSelectedItem() {
    if (!this.state.selectedItemId) return null;
    return this.state.annotations.find(a => a.id === this.state.selectedItemId) || null;
  }

  getSelectedImage() {
    if (!this.state.selectedImageId) return null;
    return this.state.placedImages.find(p => p.id === this.state.selectedImageId) || null;
  }

  selectItem(item) {
    this.state.selectedItemId = item ? item.id : null;
    if (item) {
      this.state.selectedImageId = null;
      if (item.type === 'curve') {
        if (item.color) this.state.currentColor = item.color;
        if (item.strokeWidth) this.state.strokeWidth = item.strokeWidth;
        if (item.lineStyle) this.state.lineStyle = item.lineStyle;
        if (item.arrowEnd) {
          this.state.arrowMode = item.arrowEnd;
          this.state.hasArrow = item.arrowEnd !== 'none';
        }
        if (item.fontSize) this.state.fontSize = item.fontSize;
        if (item.boxStyle) this.state.boxStyle = item.boxStyle;
        const maxIdx = Math.max(0, (item.vertices?.length || 1) - 1);
        this.state.activeKnotIdx = Math.min(this.state.activeKnotIdx || 0, maxIdx);
      } else if (item.fontSize) {
        this.state.fontSize = item.fontSize;
      }
    }
    this.emit('selection:change', item);
    this.emit('state:change');
  }

  selectImage(plate) {
    this.state.selectedImageId = plate ? plate.id : null;
    if (plate) this.state.selectedItemId = null;
    this.emit('selection:change', plate);
    this.emit('state:change');
  }

  deselectAll() {
    if (!this.state.selectedItemId && !this.state.selectedImageId) return;
    this.state.selectedItemId = null;
    this.state.selectedImageId = null;
    this.state.selectedKnotIndices = [];
    this.emit('selection:change', null);
    this.emit('state:change');
  }

  _cloneAnnotation(ann) {
      const copy = { ...ann };
      delete copy._textElements;
      delete copy._badgeElements;
      delete copy.elements;
      if (ann.vertices) {
        copy.vertices = ann.vertices.map(v => ({
          point: v.point.slice(),
          controlPoints: [v.controlPoints[0].slice(), v.controlPoints[1].slice()],
          tangents: v.tangents ? [v.tangents[0] ? v.tangents[0].slice() : null, v.tangents[1] ? v.tangents[1].slice() : null] : [null, null],
          curvature: v.curvature,
          balance: v.balance,
          pointType: v.pointType,
          isCusp: !!v.isCusp,
          isExplicitTangent: !!v.isExplicitTangent,
          tangentAngleOffset: v.tangentAngleOffset || 0,
          cuspInAngleOffset: v.cuspInAngleOffset || 0,
          cuspOutAngleOffset: v.cuspOutAngleOffset || 0
        }));
      }
      if (ann.beziers) copy.beziers = ann.beziers.map(s => s.map(pt => pt.slice()));
      if (ann.points) copy.points = ann.points.map(pt => pt.slice());
      if (ann.bounds) copy.bounds = { ...ann.bounds };
      return copy;
    }
  _captureSnapshot(label = 'Edit') {
    return {
      label,
      annotations: this.state.annotations.map(a => this._cloneAnnotation(a)),
      placedImages: this.state.placedImages.map(p => ({ ...p })),
      exportRect: this.state.exportRect ? { ...this.state.exportRect } : null,
      selectedItemId: this.state.selectedItemId,
      selectedImageId: this.state.selectedImageId,
      activeKnotIdx: this.state.activeKnotIdx
    };
  }

  _restoreSnapshot(snap) {
    if (!snap) return;
    this.state.annotations = snap.annotations.map(a => this._cloneAnnotation(a));
    this.state.placedImages = snap.placedImages.map(p => ({ ...p }));
    this.state.exportRect = snap.exportRect ? { ...snap.exportRect } : null;
    this.state.selectedItemId = snap.selectedItemId;
    this.state.selectedImageId = snap.selectedImageId;
    this.state.activeKnotIdx = snap.activeKnotIdx || 0;
    this.emit('selection:change', this.getSelectedItem() || this.getSelectedImage());
    this.emit('state:change');
  }

  pushHistory(label = 'Edit') {
    this._undoStack.push(this._captureSnapshot(label));
    if (this._undoStack.length > this._maxHistory) this._undoStack.shift();
    this._redoStack = [];
    this.emit('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  canUndo() { return this._undoStack.length > 0; }
  canRedo() { return this._redoStack.length > 0; }

  undo() {
    if (!this.canUndo()) return false;
    this._redoStack.push(this._captureSnapshot('Redo'));
    const prev = this._undoStack.pop();
    this._restoreSnapshot(prev);
    this.emit('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    this.emit('toast', `↺ Undid: ${prev.label}`);
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this._undoStack.push(this._captureSnapshot('Undo'));
    const next = this._redoStack.pop();
    this._restoreSnapshot(next);
    this.emit('history:change', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    this.emit('toast', '↻ Redid action');
    return true;
  }

  addImagePlate(img, x = 60, y = 60) {
    this.pushHistory('Add Image');
    let w = img.naturalWidth || img.width || 400;
    let h = img.naturalHeight || img.height || 300;
    const maxInit = 560;
    if (w > maxInit || h > maxInit) {
      const ratio = Math.min(maxInit / w, maxInit / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const plate = {
      id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      img, x, y, width: w, height: h, aspect: w / h, opacity: 1.0
    };
    this.state.placedImages.push(plate);
    this.selectImage(plate);
    this.emit('toast', `Added image (${w}×${h}px)`);
    return plate;
  }

  addCurveFromBeziers(beziers, overrides = {}) {
      if (!beziers || beziers.length === 0) return null;
      this.pushHistory('Draw Curve');
      const vertices = StudioGeometry.beziersToVertices(beziers, overrides.cuspVertexIndices || []);
      const arrowMode = overrides.arrowEnd !== undefined ? overrides.arrowEnd : this.state.arrowMode;
      const record = {
        id: 'curve_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        type: 'curve',
        beziers,
        vertices,
        color: overrides.color || this.state.currentColor,
        strokeWidth: overrides.strokeWidth || this.state.strokeWidth,
        lineStyle: overrides.lineStyle || this.state.lineStyle,
        arrowEnd: arrowMode,
        textEnd: arrowMode === 'tail' ? 'tip' : 'tail',
        isClosed: !!overrides.isClosed,
        text: overrides.text || '',
        boxStyle: overrides.boxStyle || this.state.boxStyle,
        fontFamily: overrides.fontFamily || this.state.fontFamily,
        fontSize: overrides.fontSize || this.state.fontSize,
        connectEdge: null,
        manualEdge: false
      };
      this.state.annotations.push(record);
      this.state.activeKnotIdx = 0;
      this.selectItem(record);
      return record;
    }
  recomputeCurve(curve) {
    if (!curve || !curve.vertices || curve.vertices.length < 2) return;
    curve.beziers = StudioGeometry.verticesToBeziers(curve.vertices);
  }

  _registerCoreCommands() {
      this.registerCommand('tool.set', {
        label: 'Set Active Tool', category: 'tools',
        execute: (eng, toolId) => {
          if (!eng._tools.has(toolId)) return false;
          eng.state.activeTool = toolId;
          eng.emit('tool:change', toolId);
          eng.emit('state:change');
          return true;
        }
      });

      this.registerCommand('edit.undo', {
        label: 'Undo', icon: '↺', shortcut: 'Ctrl+Z', category: 'edit',
        execute: (eng) => eng.undo()
      });

      this.registerCommand('edit.redo', {
        label: 'Redo', icon: '↻', shortcut: 'Ctrl+Shift+Z', category: 'edit',
        execute: (eng) => eng.redo()
      });

      this.registerCommand('style.setColor', {
        label: 'Set Color', category: 'style',
        execute: (eng, color) => {
          eng.state.currentColor = color;
          eng.state.prefs.currentColor = color;
          eng.savePrefs();
          const sel = eng.getSelectedItem();
          if (sel) { eng.pushHistory('Change Color'); sel.color = color; }
          eng.emit('state:change');
          return true;
        }
      });

      this.registerCommand('style.setLineStyle', {
        label: 'Set Line Style', category: 'style',
        execute: (eng, style) => {
          eng.state.lineStyle = style;
          eng.state.prefs.lineStyle = style;
          eng.savePrefs();
          const sel = eng.getSelectedItem();
          if (sel && ['curve', 'text_badge', 'circle_callout', 'box_callout'].includes(sel.type)) {
            eng.pushHistory('Change Style');
            sel.lineStyle = style;
          }
          eng.emit('state:change');
          eng.emit('toast', style === 'neon' ? '💡 Neon Style' : '🖋️ Ink Style');
          return true;
        }
      });

      this.registerCommand('style.setArrowMode', {
        label: 'Set Arrowhead Mode', category: 'style',
        execute: (eng, mode) => {
          eng.state.arrowMode = mode;
          eng.state.hasArrow = mode !== 'none';
          eng.state.prefs.arrowMode = mode;
          eng.savePrefs();
          const sel = eng.getSelectedItem();
          if (sel && sel.type === 'curve' && !sel.isClosed) {
            eng.pushHistory('Change Arrow');
            sel.arrowEnd = mode;
            if (mode === 'tip') sel.textEnd = 'tail';
            else if (mode === 'tail') sel.textEnd = 'tip';
          }
          eng.emit('state:change');
          return true;
        }
      });

      this.registerCommand('style.stepWidth', {
        label: 'Step Stroke Width', category: 'style',
        execute: (eng, delta) => {
          const nextW = StudioGeometry.clamp(Math.round(((eng.state.strokeWidth || 3.2) + delta) * 10) / 10, 1.0, 20.0);
          eng.state.strokeWidth = nextW;
          eng.state.prefs.curveStrokeWidth = nextW;
          eng.savePrefs();
          const sel = eng.getSelectedItem();
          if (sel && ['curve', 'circle_callout', 'box_callout'].includes(sel.type)) {
            eng.pushHistory('Stroke Width');
            sel.strokeWidth = nextW;
          }
          eng.emit('state:change');
          eng.emit('toast', `Width: ${nextW}px`);
          return true;
        }
      });

      this.registerCommand('style.stepFontSize', {
        label: 'Step Font Size', category: 'style',
        execute: (eng, delta) => {
          const nextS = StudioGeometry.clamp((eng.state.fontSize || 20) + delta, 11, 48);
          eng.state.fontSize = nextS;
          eng.state.prefs.fontSize = nextS;
          eng.savePrefs();
          const sel = eng.getSelectedItem();
          if (sel && (sel.type === 'curve' || sel.type === 'text_badge')) {
            eng.pushHistory('Font Size');
            sel.fontSize = nextS;
          }
          eng.emit('state:change');
          eng.emit('toast', `Text: ${nextS}px`);
          return true;
        }
      });

      this.registerCommand('curve.toggleLoop', {
        label: 'Toggle Loop', icon: '○', shortcut: 'L', category: 'curve',
        execute: (eng) => {
          const sel = eng.getSelectedItem();
          if (!sel || sel.type !== 'curve') return false;
          eng.pushHistory('Toggle Loop');
          sel.isClosed = !sel.isClosed;
          sel.arrowEnd = sel.isClosed ? 'none' : eng.state.arrowMode;
          eng.recomputeCurve(sel);
          eng.emit('state:change');
          eng.emit('toast', sel.isClosed ? '● Closed Loop' : '○ Open Curve');
          return true;
        }
      });

      this.registerCommand('curve.flipTerminals', {
        label: 'Flip Arrow & Text Ends', icon: '⇄', shortcut: 'X', category: 'curve',
        execute: (eng) => {
          const sel = eng.getSelectedItem();
          if (!sel || sel.type !== 'curve') return false;
          eng.pushHistory('Flip Ends');
          if (sel.arrowEnd === 'tip' || sel.arrowEnd === 'tail') {
            sel.arrowEnd = sel.arrowEnd === 'tail' ? 'tip' : 'tail';
            sel.textEnd = sel.arrowEnd === 'tail' ? 'tip' : 'tail';
          } else {
            sel.textEnd = sel.textEnd === 'tip' ? 'tail' : 'tip';
          }
          eng.state.arrowMode = sel.arrowEnd;
          eng.emit('state:change');
          eng.emit('toast', `⇄ Flipped: Text at ${sel.textEnd.toUpperCase()}`);
          return true;
        }
      });

      this.registerCommand('curve.straighten', {
        label: 'Straighten to Line', icon: '📏', shortcut: 'S', category: 'curve',
        execute: (eng) => {
          const sel = eng.getSelectedItem();
          if (!sel || sel.type !== 'curve' || !sel.vertices || sel.vertices.length <= 2) return false;
          eng.pushHistory('Straighten');
          sel.vertices = [sel.vertices[0], sel.vertices[sel.vertices.length - 1]];
          eng.state.activeKnotIdx = 0;
          eng.recomputeCurve(sel);
          eng.emit('state:change');
          eng.emit('toast', '📏 Straightened into 2-point line');
          return true;
        }
      });

      this.registerCommand('curve.toggleCusp', {
        label: 'Toggle Knot Cusp', icon: '◆', shortcut: 'C', category: 'curve',
        execute: (eng, idxOverride = null) => eng.toggleVertexCusp(idxOverride)
      });

      this.registerCommand('curve.resetKnot', {
        label: 'Reset Knot Constraints', shortcut: 'R', category: 'curve',
        execute: (eng, idxOverride = null) => eng.resetVertex(idxOverride)
      });

      this.registerCommand('curve.splitAt', {
        label: 'Insert Knot on Segment', category: 'curve',
        execute: (eng, { curve, segIdx, t = 0.5 }) => {
          const c = curve || eng.getSelectedItem();
          if (!c || c.type !== 'curve' || !c.beziers || !c.beziers[segIdx]) return false;
          eng.pushHistory('Split Curve');
          const { leftSeg, rightSeg } = StudioGeometry.splitBezierAtT(c.beziers[segIdx], t);
          const prevFlags = c.vertices.map(v => ({
            isExplicit: !!v.isExplicitTangent, offset: v.tangentAngleOffset || 0,
            isCusp: !!v.isCusp, cuspIn: v.cuspInAngleOffset || 0, cuspOut: v.cuspOutAngleOffset || 0
          }));
          prevFlags.splice(segIdx + 1, 0, { isExplicit: false, offset: 0, isCusp: false, cuspIn: 0, cuspOut: 0 });
          c.beziers.splice(segIdx, 1, leftSeg, rightSeg);
          c.vertices = StudioGeometry.beziersToVertices(c.beziers);
          c.vertices.forEach((nv, k) => {
            const f = prevFlags[k];
            if (f) {
              nv.isCusp = f.isCusp;
              nv.cuspInAngleOffset = f.cuspIn;
              nv.cuspOutAngleOffset = f.cuspOut;
              if (f.isExplicit) { nv.isExplicitTangent = true; nv.tangentAngleOffset = f.offset; }
            }
          });
          eng.state.activeKnotIdx = segIdx + 1;
          eng.emit('state:change');
          return true;
        }
      });

      this.registerCommand('curve.deleteKnot', {
        label: 'Delete Knot', category: 'curve',
        execute: (eng, idxOverride = null) => {
          const sel = eng.getSelectedItem();
          if (!sel || sel.type !== 'curve' || !sel.vertices) return false;
          if (sel.vertices.length <= 2) return eng.runCommand('selection.delete');
          const idx = idxOverride !== null ? idxOverride : eng.state.activeKnotIdx;
          if (idx < 0 || idx >= sel.vertices.length) return false;
          eng.pushHistory('Delete Knot');
          sel.vertices.splice(idx, 1);
          [idx - 1, idx].forEach(nIdx => {
            const nv = sel.vertices[nIdx];
            if (nv && !nv.isExplicitTangent && !nv.isCusp) {
              nv.tangentAngleOffset = 0; nv.curvature = 1.0; nv.balance = 1.0;
            }
          });
          eng.state.activeKnotIdx = Math.max(0, Math.min(idx, sel.vertices.length - 1));
          eng.recomputeCurve(sel);
          eng.emit('state:change');
          eng.emit('toast', `🗑️ Removed knot #${idx + 1}`);
          return true;
        }
      });

      this.registerCommand('selection.delete', {
        label: 'Delete Selection', icon: '🗑️', shortcut: 'Del', category: 'edit',
        execute: (eng) => {
          const img = eng.getSelectedImage();
          if (img) {
            eng.pushHistory('Delete Image');
            eng.state.placedImages = eng.state.placedImages.filter(p => p.id !== img.id);
            eng.state.selectedImageId = null;
            eng.emit('selection:change', null);
            eng.emit('state:change');
            eng.emit('toast', '🗑️ Removed image');
            return true;
          }
          const item = eng.getSelectedItem();
          if (item) {
            eng.pushHistory('Delete Annotation');
            eng.state.annotations = eng.state.annotations.filter(a => a.id !== item.id);
            eng.state.selectedItemId = null;
            eng.emit('selection:change', null);
            eng.emit('state:change');
            eng.emit('toast', '🗑️ Removed item');
            return true;
          }
          return false;
        }
      });

      this.registerCommand('selection.nudge', {
        label: 'Nudge Selection', category: 'edit',
        execute: (eng, { dx = 0, dy = 0 }) => {
          const sel = eng.getSelectedItem();
          const img = eng.getSelectedImage();
          if (sel) {
            if (sel.type === 'curve' && sel.vertices?.[eng.state.activeKnotIdx]) {
              const k = sel.vertices[eng.state.activeKnotIdx];
              k.point[0] += dx; k.point[1] += dy;
              eng.recomputeCurve(sel);
            } else if (sel.type === 'text_badge' || sel.type === 'box_callout') {
              sel.x += dx; sel.y += dy;
            } else if (sel.type === 'circle_callout') {
              sel.cx += dx; sel.cy += dy;
            }
            eng.emit('state:change');
            return true;
          }
          if (img) { img.x += dx; img.y += dy; eng.emit('state:change'); return true; }
          return false;
        }
      });

      this.registerCommand('image.clone', {
        label: 'Clone Image', icon: '⧉', category: 'image',
        execute: (eng) => {
          const img = eng.getSelectedImage();
          if (!img) return false;
          eng.pushHistory('Clone Image');
          const copy = { ...img, id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), x: img.x + 28, y: img.y + 28 };
          eng.state.placedImages.push(copy);
          eng.selectImage(copy);
          return true;
        }
      });

      this.registerCommand('image.toggleOpacity', {
        label: 'Toggle Image Opacity', category: 'image',
        execute: (eng) => {
          const img = eng.getSelectedImage();
          if (!img) return false;
          eng.pushHistory('Image Opacity');
          img.opacity = (img.opacity === 0.5) ? 1.0 : 0.5;
          eng.emit('state:change');
          return true;
        }
      });

      this.registerCommand('image.reorder', {
        label: 'Reorder Image Layer', category: 'image',
        execute: (eng, delta) => {
          const img = eng.getSelectedImage();
          if (!img) return false;
          const arr = eng.state.placedImages;
          const idx = arr.indexOf(img);
          const nextIdx = StudioGeometry.clamp(idx + delta, 0, arr.length - 1);
          if (idx === -1 || idx === nextIdx) return false;
          eng.pushHistory('Reorder Image');
          arr.splice(idx, 1);
          arr.splice(nextIdx, 0, img);
          eng.emit('state:change');
          return true;
        }
      });

      this.registerCommand('canvas.resetView', {
        label: 'Reset Zoom & Pan', category: 'canvas',
        execute: (eng) => {
          eng.state.zoom = 1.0; eng.state.panX = 0; eng.state.panY = 0;
          eng.emit('viewport:change');
          return true;
        }
      });

      this.registerCommand('export.resetBounds', {
        label: 'Reset Export Bounds', category: 'export',
        execute: (eng) => {
          eng.pushHistory('Reset Export Bounds');
          eng.state.exportRect = null;
          eng.emit('state:change');
          eng.emit('toast', '📐 Export crop reset to Auto');
          return true;
        }
      });
    }
  toggleVertexCusp(idxOverride = null, forceState = null) {
      const sel = this.getSelectedItem();
      if (!sel || sel.type !== 'curve' || !sel.vertices) return false;
      let idx = idxOverride !== null ? idxOverride : this.state.activeKnotIdx;
      if ((idx <= 0 || idx >= sel.vertices.length - 1) && sel.vertices.length === 3) {
        idx = 1;
        this.state.activeKnotIdx = 1;
      }
      const knot = sel.vertices[idx];
      if (!knot || idx <= 0 || idx >= sel.vertices.length - 1) {
        this.emit('toast', 'Select an interior knot to toggle cusp');
        return false;
      }
      const targetCusp = forceState !== null ? !!forceState : !knot.isCusp;
      this.pushHistory(targetCusp ? 'Make Cusp' : 'Make Smooth');
      StudioGeometry.setVertexCuspState(sel.vertices, idx, targetCusp);
      this.recomputeCurve(sel);
      this.emit('state:change');
      this.emit('toast', targetCusp ? '◆ Sharp Cusp Corner' : '● Smooth Tangent Knot');
      return true;
    }

  resetVertex(idxOverride = null) {
      const sel = this.getSelectedItem();
      if (!sel || sel.type !== 'curve' || !sel.vertices) return false;
      const idx = idxOverride !== null ? idxOverride : this.state.activeKnotIdx;
      const knot = sel.vertices[idx];
      if (!knot) return false;
      this.pushHistory('Reset Knot');
      knot.tangentAngleOffset = 0;
      knot.cuspInAngleOffset = 0;
      knot.cuspOutAngleOffset = 0;
      knot.curvature = 1.0;
      knot.balance = 1.0;
      knot.isCusp = false;
      knot.isExplicitTangent = false;
      this.recomputeCurve(sel);
      this.emit('state:change');
      this.emit('toast', '↺ Knot reset to smooth baseline');
      return true;
    }
}

globalThis.StudioEngine = StudioEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = StudioEngine;