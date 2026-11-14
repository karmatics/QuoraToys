/**
 * StudioSvgRenderer
 * Pure SVG + Canvas 2D stage renderer driven by StudioEngine state and StudioGeometry.
 */
class StudioSvgRenderer {
  constructor(engine, stageWrap, handlers = {}) {
    this.engine = engine;
    this.stageWrap = stageWrap;
    this.handlers = handlers;

    this.sceneCanvas = document.createElement('canvas');
    this.sceneCanvas.style.cssText = 'position:absolute;top:0;left:0;display:block;border-radius:4px;';
    this.stageWrap.appendChild(this.sceneCanvas);

    this.svg = makeElement('svg:svg', {
      className: 'qcs-svg-surface',
      style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'auto' }
    });

    this.defs = makeElement('svg:defs');
    this.paintLayer = makeElement('svg:g', { className: 'qcs-paint-layer', style: { pointerEvents: 'none' } });
    this.glowLayer = makeElement('svg:g', { className: 'qcs-glow-layer', style: { pointerEvents: 'none' } });
    this.shadowLayer = makeElement('svg:g', { className: 'qcs-shadow-layer', style: { pointerEvents: 'none' } });
    this.strokeLayer = makeElement('svg:g', { className: 'qcs-stroke-layer', style: { pointerEvents: 'none' } });
    this.textLayer = makeElement('svg:g', { className: 'qcs-text-layer' });
    this.controlsLayer = makeElement('svg:g', { className: 'qcs-controls-layer' });
    this.transientLayer = makeElement('svg:g', { className: 'qcs-transient-layer', style: { pointerEvents: 'none' } });

    this.svg.append(
      this.defs,
      this.paintLayer,
      this.glowLayer,
      this.shadowLayer,
      this.strokeLayer,
      this.textLayer,
      this.controlsLayer,
      this.transientLayer
    );
    this.stageWrap.appendChild(this.svg);

    this._measureCanvas = document.createElement('canvas');
    this._measureCtx = this._measureCanvas.getContext('2d');
  }

  measureTextBounds(text, fontSize = 20, fontFamily = "'Architects Daughter', cursive, sans-serif") {
    const ctx = this._measureCtx;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    const raw = String(text || '').trim();
    const lineHeight = Math.round(fontSize * 1.25);
    if (!raw) return { lines: [''], maxW: 60, totalH: lineHeight, lineHeight };

    const targetColW = 260;
    const lines = [];
    raw.split('\n').forEach(para => {
      const t = para.trim();
      if (!t) { lines.push(''); return; }
      let cur = '';
      t.split(/\s+/).forEach(w => {
        const cand = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(cand).width > targetColW && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = cand;
        }
      });
      if (cur) lines.push(cur);
    });

    let maxW = 0;
    lines.forEach(l => {
      const w = Math.ceil(ctx.measureText(l).width);
      if (w > maxW) maxW = w;
    });
    return { lines, maxW, totalH: Math.max(lineHeight, lines.length * lineHeight), lineHeight };
  }

  _updateFilters(stageW, stageH) {
    const state = this.engine.state;
    const p = state.prefs || {};
    const w = Math.max(1600, stageW);
    const h = Math.max(1000, stageH);
    const region = `filterUnits="userSpaceOnUse" x="-250" y="-250" width="${w + 500}" height="${h + 500}"`;
    const curveBlur = p.curveGlowBlur !== undefined ? p.curveGlowBlur : 6.0;
    const boxBgBlur = p.textBoxBgBlur !== undefined ? p.textBoxBgBlur : 4.0;
    const brushBlur = state.brushSoftness || 0;
    const wideStd = p.textGlowBlur !== undefined ? p.textGlowBlur : 5.5;
    const tightStd = Math.max(1.2, wideStd * 0.32);
    const intensity = p.textGlowIntensity !== undefined ? p.textGlowIntensity : 1.8;

    this.defs.innerHTML = `
      <filter id="qcs-brush-blur" ${region}><feGaussianBlur in="SourceGraphic" stdDeviation="${brushBlur}" /></filter>
      <filter id="qcs-neon-glow" ${region}><feGaussianBlur in="SourceGraphic" stdDeviation="${curveBlur}" /></filter>
      <filter id="qcs-text-bg-blur" ${region}><feGaussianBlur in="SourceGraphic" stdDeviation="${boxBgBlur}" /></filter>
      <filter id="qcs-neon-core" ${region}><feGaussianBlur in="SourceGraphic" stdDeviation="0.5" /></filter>
      <filter id="qcs-text-glow" ${region}>
        <feGaussianBlur in="SourceGraphic" stdDeviation="${tightStd}" result="tight" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="${wideStd}" result="wide" />
        <feMerge result="merged"><feMergeNode in="wide" /><feMergeNode in="tight" /></feMerge>
        <feComponentTransfer in="merged"><feFuncA type="linear" slope="${intensity}" /></feComponentTransfer>
      </filter>
    `;
  }

  render(minViewportW = 0, minViewportH = 0) {
      const state = this.engine.state;
      const zScale = Math.max(0.1, state.zoom || 1.0);
      const vpW = minViewportW || this.stageWrap.parentElement?.parentElement?.clientWidth || 0;
      const vpH = minViewportH || this.stageWrap.parentElement?.parentElement?.clientHeight || 0;
      const minW = Math.max(800, Math.ceil(vpW / Math.min(1, zScale)));
      const minH = Math.max(500, Math.ceil(vpH / Math.min(1, zScale)));

      const bounds = StudioGeometry.computeStageBounds(state, minW, minH);
      this.stageWrap.style.width = `${bounds.totalW}px`;
      this.stageWrap.style.height = `${bounds.totalH}px`;

      const sizeChanged = (this.sceneCanvas.width !== bounds.totalW || this.sceneCanvas.height !== bounds.totalH);
      this.sceneCanvas.width = bounds.totalW;
      this.sceneCanvas.height = bounds.totalH;
      if (sizeChanged || !this.defs.firstChild) this._updateFilters(bounds.totalW, bounds.totalH);

      const ctx = this.sceneCanvas.getContext('2d');
      ctx.clearRect(0, 0, bounds.totalW, bounds.totalH);

      if (state.canvasBgMode === 'matte') {
        ctx.fillStyle = state.canvasBgColor || '#090d16';
        ctx.fillRect(0, 0, bounds.totalW, bounds.totalH);
      }

      (state.placedImages || []).forEach(plate => {
        if (plate._hasAlphaEdits) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(plate.x, plate.y, plate.width, plate.height);
          ctx.clip();
          const sq = 10;
          for (let cy = plate.y; cy < plate.y + plate.height; cy += sq) {
            for (let cx = plate.x; cx < plate.x + plate.width; cx += sq) {
              const odd = ((Math.floor((cx - plate.x) / sq) + Math.floor((cy - plate.y) / sq)) % 2) === 1;
              ctx.fillStyle = odd ? '#1e293b' : '#0f172a';
              ctx.fillRect(cx, cy, sq, sq);
            }
          }
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = plate.opacity !== undefined ? plate.opacity : 1.0;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 12;
        ctx.drawImage(plate.img, plate.x, plate.y, plate.width, plate.height);
        ctx.restore();
      });

      this.paintLayer.innerHTML = '';
      this.glowLayer.innerHTML = '';
      this.shadowLayer.innerHTML = '';
      this.strokeLayer.innerHTML = '';
      this.textLayer.innerHTML = '';
      this.controlsLayer.innerHTML = '';

      const z = state.cadStrokeMode ? (state.zoom || 1.0) : 1.0;
      const invScale = 1 / (state.zoom || 1.0);
      const p = state.prefs || {};
      const selItem = this.engine.getSelectedItem();

      (state.annotations || []).forEach(ann => {
        if (ann.type === 'paint') this._renderPaint(ann);
        else if (ann.type === 'curve') this._renderCurve(ann, z, p, selItem === ann);
        else if (ann.type === 'circle_callout') this._renderCircleCallout(ann, z, selItem === ann);
        else if (ann.type === 'box_callout') this._renderBoxCallout(ann, z, selItem === ann);
        else if (ann.type === 'text_badge') this._renderTextBadge(ann, p, selItem === ann);
      });

      if (selItem && selItem.type === 'curve') this._renderCurveControls(selItem, invScale);
      if (selItem && (selItem.type === 'circle_callout' || selItem.type === 'box_callout')) this._renderCalloutGrips(selItem, invScale);

      const selImg = this.engine.getSelectedImage();
      if (selImg) this._renderImageControls(selImg, invScale);

      if (state.exportRect && state.exportRect.width > 10 && state.exportRect.height > 10) {
        this._renderExportBounds(state.exportRect, invScale);
      }
    }
  _renderPaint(ann) {
    const filterAttr = (ann.softness > 0) ? { filter: 'url(#qcs-brush-blur)' } : {};
    if (ann.shape === 'rect' && ann.bounds) {
      this.paintLayer.appendChild(makeElement('svg:rect', {
        x: ann.bounds.x, y: ann.bounds.y, width: ann.bounds.w, height: ann.bounds.h,
        fill: ann.color || '#000', ...filterAttr
      }));
    } else if (ann.shape === 'oval' && ann.bounds) {
      this.paintLayer.appendChild(makeElement('svg:ellipse', {
        cx: ann.bounds.cx, cy: ann.bounds.cy, rx: ann.bounds.rx, ry: ann.bounds.ry,
        fill: ann.color || '#000', ...filterAttr
      }));
    } else if (ann.points && ann.points.length > 0) {
      this.paintLayer.appendChild(makeElement('svg:path', {
        d: StudioGeometry.smoothPolylineToSvgD(ann.points),
        stroke: ann.color || '#000',
        'stroke-width': String(ann.width || 32),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
        ...filterAttr
      }));
    }
  }

  _renderArrowhead(p0, exitVec, color, baseW, lineStyle, z, p) {
    const geo = StudioGeometry.computeConcaveArrowPath(p0, exitVec, baseW, z);
    const glowOp = p.curveGlowOpacity !== undefined ? p.curveGlowOpacity : 0.9;

    if (lineStyle === 'neon') {
      const coreTint = StudioGeometry.getLuminousCoreColor(color, p.textCoreSaturation ?? 0.3);
      this.glowLayer.appendChild(makeElement('svg:path', {
        d: geo.d, stroke: color, 'stroke-width': String(geo.glowWidth), fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        style: { filter: 'url(#qcs-neon-glow)', opacity: String(glowOp) }
      }));
      this.strokeLayer.appendChild(makeElement('svg:path', {
        d: geo.d, stroke: coreTint, 'stroke-width': String(geo.coreWidth), fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        style: { filter: 'url(#qcs-neon-core)' }
      }));
    } else {
      this.shadowLayer.appendChild(makeElement('svg:path', {
        d: geo.d, transform: 'translate(2, 2)',
        stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(geo.shadowWidth), fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      this.strokeLayer.appendChild(makeElement('svg:path', {
        d: geo.d, stroke: color, 'stroke-width': String(geo.effectiveWidth), fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    }
  }

  _renderCurve(ann, z, p, isSelected) {
    if (!ann.beziers || ann.beziers.length === 0) return;
    const d = StudioGeometry.beziersToSvgD(ann.beziers, ann.isClosed);
    const baseW = ann.strokeWidth || 3.2;
    const sw = baseW / z;
    const lineStyle = ann.lineStyle || 'classic';
    const col = ann.color || '#00e676';
    const glowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10;
    const glowOp = p.curveGlowOpacity !== undefined ? p.curveGlowOpacity : 0.9;

    if (lineStyle === 'neon') {
      const coreTint = StudioGeometry.getLuminousCoreColor(col, p.textCoreSaturation ?? 0.3);
      this.glowLayer.appendChild(makeElement('svg:path', {
        d, stroke: col, 'stroke-width': String((baseW + glowPad) / z),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
        style: { filter: 'url(#qcs-neon-glow)', opacity: String(glowOp) }
      }));
      this.strokeLayer.appendChild(makeElement('svg:path', {
        d, stroke: coreTint, 'stroke-width': String(Math.max(2.0, baseW * 0.78) / z),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
        style: { filter: 'url(#qcs-neon-core)' }
      }));
    } else {
      this.shadowLayer.appendChild(makeElement('svg:path', {
        d, transform: 'translate(2, 2)',
        stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String((baseW + 2.3) / z),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
      }));
      this.strokeLayer.appendChild(makeElement('svg:path', {
        d, stroke: col, 'stroke-width': String(sw),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none'
      }));
    }

    if (!ann.isClosed && ann.beziers.length > 0) {
      if (ann.arrowEnd === 'tip' || ann.arrowEnd === 'both') {
        const p0 = ann.beziers[0][0], p1 = ann.beziers[0][1];
        this._renderArrowhead(p0, StudioGeometry.normalize([p1[0] - p0[0], p1[1] - p0[1]]), col, baseW, lineStyle, z, p);
      }
      if (ann.arrowEnd === 'tail' || ann.arrowEnd === 'both') {
        const last = ann.beziers[ann.beziers.length - 1];
        const p2 = last[2], p3 = last[3];
        this._renderArrowhead(p3, StudioGeometry.normalize([p2[0] - p3[0], p2[1] - p3[1]]), col, baseW, lineStyle, z, p);
      }
    }

    const hasText = Boolean(ann.text && ann.text.trim() !== '');
    if (hasText || (isSelected && !ann._isEditingText)) {
      this._renderCurveText(ann, p, isSelected);
    }
  }

  _renderCurveText(ann, p, isSelected) {
    const state = this.engine.state;
    const isAtTail = (ann.textEnd !== 'tip');
    const seg = isAtTail ? ann.beziers[ann.beziers.length - 1] : ann.beziers[0];
    const anchorPt = isAtTail ? seg[3] : seg[0];
    const exitVec = isAtTail
      ? [seg[3][0] - seg[2][0], seg[3][1] - seg[2][1]]
      : [seg[0][0] - seg[1][0], seg[0][1] - seg[1][1]];
    const fontS = ann.fontSize || state.fontSize || 20;
    const fontF = ann.fontFamily || state.fontFamily;
    const boxStyle = ann.boxStyle || state.boxStyle || 'bracket';
    const col = ann.color || '#00e676';
    const manualEdge = (ann.manualEdge && ['left', 'right', 'top', 'bottom'].includes(ann.connectEdge)) ? ann.connectEdge : null;

    if (!ann.text || !ann.text.trim()) {
      if (!isSelected || ann._isEditingText) return;
      const ghostSize = Math.min(14, Math.max(11, Math.round(fontS * 0.65)));
      const gb = this.measureTextBounds('Note…', ghostSize, fontF);
      const gw = Math.max(64, gb.maxW + 16);
      const gh = Math.max(24, gb.lineHeight + 8);
      const gp = StudioGeometry.computeTextBoxPlacement(anchorPt, exitVec, gw, gh, manualEdge, p.axisThreshold ?? 15);
      const g = makeElement('svg:g', { className: 'qcs-ghost-note-pill', style: { cursor: 'text', opacity: '0.72' } });
      g.appendChild(makeElement('svg:rect', {
        x: gp.posX, y: gp.posY, width: gw, height: gh, rx: '5',
        fill: 'rgba(248, 250, 252, 0.08)', stroke: 'rgba(255, 255, 255, 0.25)',
        'stroke-width': '1', 'stroke-dasharray': '3,2'
      }));
      if (gp.dBracket) {
        g.appendChild(makeElement('svg:path', { d: gp.dBracket, fill: 'none', stroke: col, 'stroke-width': '1.6', 'stroke-opacity': '0.75' }));
      }
      const gx = gp.textAnchorType === 'end' ? (gp.posX + gw - 8) : (gp.textAnchorType === 'middle' ? (gp.posX + gw / 2) : (gp.posX + 8));
      g.appendChild(makeElement('svg:text', {
        x: gx, y: gp.posY + 4 + ghostSize * 0.88, fill: 'rgba(248, 250, 252, 0.65)',
        'font-family': fontF, 'font-size': `${ghostSize}px`, 'font-style': 'italic', 'font-weight': '600',
        'text-anchor': gp.textAnchorType
      }, 'Note…'));
      g.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        this.handlers.onEditText?.(ann, anchorPt, manualEdge);
      });
      this.textLayer.appendChild(g);
      return;
    }

    if (ann._isEditingText) return;
    const bounds = this.measureTextBounds(ann.text, fontS, fontF);
    const padX = boxStyle !== 'none' ? 8 : 4;
    const padY = boxStyle !== 'none' ? 4 : 2;
    const boxW = bounds.maxW + padX * 2;
    const boxH = bounds.totalH + padY * 2;
    const placement = StudioGeometry.computeTextBoxPlacement(anchorPt, exitVec, boxW, boxH, manualEdge, p.axisThreshold ?? 15);
    ann.connectEdge = placement.connectEdge;

    let textAnchorX = placement.posX + padX;
    if (placement.textAnchorType === 'end') textAnchorX = placement.posX + boxW - padX;
    else if (placement.textAnchorType === 'middle') textAnchorX = placement.posX + boxW / 2;

    this._emitTextElementGroup(
      ann, bounds, placement.posX, placement.posY, boxW, boxH,
      textAnchorX, placement.posY + padY + fontS * 0.88,
      placement.textAnchorType, placement.dBracket, boxStyle, fontS, fontF, p, false
    );
  }

  _renderTextBadge(ann, p, isSelected) {
    if (ann._isEditingText) return;
    const state = this.engine.state;
    const fontS = ann.fontSize || state.fontSize || 20;
    const fontF = ann.fontFamily || state.fontFamily;
    const boxStyle = ann.boxStyle || state.boxStyle || 'bracket';
    const bounds = this.measureTextBounds(ann.text || '', fontS, fontF);
    const padX = boxStyle !== 'none' ? 8 : 4;
    const padY = boxStyle !== 'none' ? 4 : 2;
    const boxW = bounds.maxW + padX * 2;
    const boxH = bounds.totalH + padY * 2;
    const bD = `M ${ann.x} ${ann.y} L ${ann.x} ${ann.y + boxH} L ${ann.x + boxW} ${ann.y + boxH}`;

    this._emitTextElementGroup(
      ann, bounds, ann.x, ann.y, boxW, boxH,
      ann.x + padX, ann.y + padY + fontS * 0.88,
      'start', bD, boxStyle, fontS, fontF, p, isSelected
    );
  }

  _emitTextElementGroup(ann, bounds, posX, posY, boxW, boxH, textAnchorX, textY, textAnchorType, dBracket, boxStyle, fontS, fontF, p, drawSelectionRect) {
    const col = ann.color || '#00e676';
    const isNeon = ann.lineStyle === 'neon';
    const glowMode = p.textGlowMode || 'match';
    const useNeonText = (glowMode === 'neon') || (glowMode === 'match' && isNeon);
    const useShadowText = (glowMode === 'shadow') || (glowMode === 'match' && !isNeon);
    const useHalo = Boolean(p.textReadabilityHalo || glowMode === 'halo');
    const textFill = useNeonText ? StudioGeometry.getLuminousCoreColor(col, p.textCoreSaturation ?? 0.3) : col;
    const borderW = p.borderStrokeWidth || 2.4;
    const glowSpread = p.textGlowSpread !== undefined ? p.textGlowSpread : 3.5;
    const glowOpacity = p.textGlowOpacity !== undefined ? p.textGlowOpacity : 0.92;
    const curveGlowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10.0;

    if (useShadowText) {
      const sg = makeElement('svg:g', { transform: 'translate(2, 2)', style: { pointerEvents: 'none' } });
      if (boxStyle === 'bracket' && dBracket) {
        sg.appendChild(makeElement('svg:path', { d: dBracket, fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(borderW + 2), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      } else if (boxStyle === 'box' || boxStyle === 'pill') {
        sg.appendChild(makeElement('svg:rect', { x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5', fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(borderW + 2) }));
      }
      const ts = makeElement('svg:text', { x: textAnchorX, y: textY, fill: 'rgba(10, 15, 25, 0.92)', 'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold', 'text-anchor': textAnchorType });
      bounds.lines.forEach((l, i) => ts.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l)));
      sg.appendChild(ts);
      this.shadowLayer.appendChild(sg);
    }

    if (useNeonText) {
      const gg = makeElement('svg:g', { style: { pointerEvents: 'none', opacity: String(glowOpacity) } });
      if (boxStyle === 'bracket' && dBracket) {
        gg.appendChild(makeElement('svg:path', { d: dBracket, fill: 'none', stroke: col, 'stroke-width': String(borderW + curveGlowPad), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: { filter: 'url(#qcs-neon-glow)' } }));
      } else if (boxStyle === 'box' || boxStyle === 'pill') {
        gg.appendChild(makeElement('svg:rect', { x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5', fill: 'none', stroke: col, 'stroke-width': String(borderW + curveGlowPad), style: { filter: 'url(#qcs-neon-glow)' } }));
      }
      const tg = makeElement('svg:text', { x: textAnchorX, y: textY, fill: col, stroke: glowSpread > 0 ? col : 'none', 'stroke-width': String(glowSpread), 'stroke-linejoin': 'round', 'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold', 'text-anchor': textAnchorType, style: { filter: 'url(#qcs-text-glow)' } });
      bounds.lines.forEach((l, i) => tg.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l)));
      gg.appendChild(tg);
      this.glowLayer.appendChild(gg);
    }

    const g = makeElement('svg:g', { style: { cursor: 'move', userSelect: 'none' } });
    if (p.textBoxBgEnabled && (p.textBoxBgOpacity === undefined || p.textBoxBgOpacity > 0.02)) {
      g.appendChild(makeElement('svg:rect', {
        x: posX - 3, y: posY - 2, width: boxW + 6, height: boxH + 4, rx: boxStyle === 'pill' ? '20' : '8',
        fill: p.textBoxBgColor || '#090d16', 'fill-opacity': String(p.textBoxBgOpacity ?? 0.55),
        style: { pointerEvents: 'none', ...(p.textBoxBgBlur > 0 ? { filter: 'url(#qcs-text-bg-blur)' } : {}) }
      }));
    }

    g.appendChild(makeElement('svg:rect', { x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5', fill: 'rgba(255,255,255,0.001)' }));

    if (drawSelectionRect) {
      g.appendChild(makeElement('svg:rect', {
        x: posX - 3, y: posY - 3, width: boxW + 6, height: boxH + 6, rx: '6',
        fill: 'none', stroke: '#00f2fe', 'stroke-width': '1.5', 'stroke-dasharray': '3,3',
        style: { pointerEvents: 'none' }
      }));
    }

    if (boxStyle === 'bracket' && dBracket) {
      g.appendChild(makeElement('svg:path', { d: dBracket, fill: 'none', stroke: textFill, 'stroke-width': String(borderW), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    } else if (boxStyle === 'box' || boxStyle === 'pill') {
      g.appendChild(makeElement('svg:rect', { x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5', fill: 'none', stroke: textFill, 'stroke-width': String(borderW) }));
    }

    if (useHalo) {
      const th = makeElement('svg:text', { x: textAnchorX, y: textY, fill: 'rgba(7,10,19,0.9)', stroke: 'rgba(7,10,19,0.9)', 'stroke-width': '2.8', 'stroke-linejoin': 'round', 'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold', 'text-anchor': textAnchorType, style: { pointerEvents: 'none' } });
      bounds.lines.forEach((l, i) => th.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l)));
      g.appendChild(th);
    }

    const txt = makeElement('svg:text', { x: textAnchorX, y: textY, fill: textFill, 'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold', 'text-anchor': textAnchorType });
    bounds.lines.forEach((l, i) => txt.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l)));
    g.appendChild(txt);

    g.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      e.stopPropagation();
      this.handlers.onTextMouseDown?.(ann, e);
    });

    this.textLayer.appendChild(g);
  }

  _renderCircleCallout(ann, z, isSelected) {
    const col = ann.color || '#00e676';
    const sw = (ann.strokeWidth || 3.2) / z;
    this.shadowLayer.appendChild(makeElement('svg:ellipse', {
      cx: ann.cx + 2, cy: ann.cy + 2, rx: ann.rx, ry: ann.ry, fill: 'none',
      stroke: 'rgba(10,15,25,0.95)', 'stroke-width': String(((ann.strokeWidth || 3.2) + 2) / z)
    }));
    if (ann.lineStyle === 'neon') {
      this.glowLayer.appendChild(makeElement('svg:ellipse', {
        cx: ann.cx, cy: ann.cy, rx: ann.rx, ry: ann.ry, fill: 'none', stroke: col,
        'stroke-width': String(((ann.strokeWidth || 3.2) + 8) / z),
        style: { filter: 'url(#qcs-neon-glow)', opacity: '0.85' }
      }));
    }
    this.strokeLayer.appendChild(makeElement('svg:ellipse', {
      cx: ann.cx, cy: ann.cy, rx: ann.rx, ry: ann.ry,
      fill: isSelected ? 'rgba(0, 242, 254, 0.08)' : 'rgba(0, 242, 254, 0.02)',
      stroke: col, 'stroke-width': String(sw)
    }));
  }

  _renderBoxCallout(ann, z, isSelected) {
    const col = ann.color || '#00e676';
    const sw = (ann.strokeWidth || 3.2) / z;
    this.shadowLayer.appendChild(makeElement('svg:rect', {
      x: ann.x + 2, y: ann.y + 2, width: ann.w, height: ann.h, rx: '6', fill: 'none',
      stroke: 'rgba(10,15,25,0.95)', 'stroke-width': String(((ann.strokeWidth || 3.2) + 2) / z)
    }));
    if (ann.lineStyle === 'neon') {
      this.glowLayer.appendChild(makeElement('svg:rect', {
        x: ann.x, y: ann.y, width: ann.w, height: ann.h, rx: '6', fill: 'none', stroke: col,
        'stroke-width': String(((ann.strokeWidth || 3.2) + 8) / z),
        style: { filter: 'url(#qcs-neon-glow)', opacity: '0.85' }
      }));
    }
    this.strokeLayer.appendChild(makeElement('svg:rect', {
      x: ann.x, y: ann.y, width: ann.w, height: ann.h, rx: '6',
      fill: isSelected ? 'rgba(0, 242, 254, 0.08)' : 'rgba(0, 242, 254, 0.02)',
      stroke: col, 'stroke-width': String(sw)
    }));
  }

  _renderCalloutGrips(ann, invScale) {
    const bx = ann.type === 'circle_callout' ? ann.cx - ann.rx : ann.x;
    const by = ann.type === 'circle_callout' ? ann.cy - ann.ry : ann.y;
    const bw = ann.type === 'circle_callout' ? ann.rx * 2 : ann.w;
    const bh = ann.type === 'circle_callout' ? ann.ry * 2 : ann.h;

    this.controlsLayer.appendChild(makeElement('svg:rect', {
      x: bx, y: by, width: bw, height: bh, fill: 'none', stroke: '#00f2fe',
      'stroke-width': String(1.2 * invScale), 'stroke-dasharray': `${4 * invScale},${3 * invScale}`,
      style: { pointerEvents: 'none' }
    }));

    const size = 9 * invScale;
    const half = size / 2;
    [
      { id: 'nw', x: bx, y: by, cursor: 'nwse-resize' },
      { id: 'ne', x: bx + bw, y: by, cursor: 'nesw-resize' },
      { id: 'se', x: bx + bw, y: by + bh, cursor: 'nwse-resize' },
      { id: 'sw', x: bx, y: by + bh, cursor: 'nesw-resize' }
    ].forEach(c => {
      const grip = makeElement('svg:rect', {
        x: c.x - half, y: c.y - half, width: size, height: size, rx: String(2 * invScale),
        fill: '#00f2fe', stroke: '#070a13', 'stroke-width': String(1.5 * invScale),
        style: { cursor: c.cursor, pointerEvents: 'all' }
      });
      grip.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.handlers.onCalloutGripMouseDown?.(ann, c.id, e);
      });
      this.controlsLayer.appendChild(grip);
    });
  }

  _renderCurveControls(curve, invScale) {
      if (!curve.vertices) return;
      const activeIdx = this.engine.state.activeKnotIdx || 0;
      const vActive = curve.vertices[activeIdx];

      if (vActive && curve.vertices.length >= 2) {
        const pt = vActive.point;
        const rayLen = 60 * invScale;
        const isStart = activeIdx === 0;
        const isTail = activeIdx === curve.vertices.length - 1;
        const isInterior = !isStart && !isTail;

        const drawHandle = (dir, side, color, title) => {
          const end = [pt[0] + dir[0] * rayLen, pt[1] + dir[1] * rayLen];
          this.controlsLayer.appendChild(makeElement('svg:line', {
            x1: pt[0], y1: pt[1], x2: end[0], y2: end[1],
            stroke: color, 'stroke-width': String(1.4 * invScale), 'stroke-linecap': 'round',
            style: { pointerEvents: 'none' }
          }));
          const hit = makeElement('svg:circle', {
            cx: end[0], cy: end[1], r: String(14 * invScale), fill: 'transparent',
            style: { cursor: 'crosshair', pointerEvents: 'all' }, title
          });
          const node = makeElement('svg:circle', {
            cx: end[0], cy: end[1], r: String(5.2 * invScale),
            fill: color, stroke: '#070a13', 'stroke-width': String(1.6 * invScale),
            style: { pointerEvents: 'none' }
          });
          hit.addEventListener('mousedown', (e) => {
            if (e.button === 2) return;
            e.stopPropagation();
            this.handlers.onTangentMouseDown?.(curve, activeIdx, side, e);
          });
          hit.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.engine.runCommand('curve.resetKnot', activeIdx);
          });
          this.controlsLayer.append(hit, node);
        };

        if (isStart && vActive.controlPoints?.[1]) {
          const dir = StudioGeometry.normalize([pt[0] - vActive.controlPoints[1][0], pt[1] - vActive.controlPoints[1][1]]);
          drawHandle(dir, 'endpoint', vActive.isExplicitTangent ? '#ffd700' : '#00f2fe', 'Drag to adjust start angle');
        } else if (isTail && vActive.controlPoints?.[0]) {
          const dir = StudioGeometry.normalize([pt[0] - vActive.controlPoints[0][0], pt[1] - vActive.controlPoints[0][1]]);
          drawHandle(dir, 'endpoint', vActive.isExplicitTangent ? '#ffd700' : '#00f2fe', 'Drag to adjust end angle');
        } else if (isInterior) {
          const outDir = StudioGeometry.normalize([vActive.controlPoints[1][0] - pt[0], vActive.controlPoints[1][1] - pt[1]]);
          if (vActive.isCusp) {
            const inDir = StudioGeometry.normalize([vActive.controlPoints[0][0] - pt[0], vActive.controlPoints[0][1] - pt[1]]);
            drawHandle(inDir, 'in', '#f59e0b', 'Drag incoming tangency (snap 0° to make smooth)');
            drawHandle(outDir, 'out', '#f59e0b', 'Drag outgoing tangency (snap 0° to make smooth)');
          } else {
            const oppEnd = [pt[0] - outDir[0] * (rayLen * 0.72), pt[1] - outDir[1] * (rayLen * 0.72)];
            this.controlsLayer.appendChild(makeElement('svg:line', {
              x1: pt[0], y1: pt[1], x2: oppEnd[0], y2: oppEnd[1],
              stroke: vActive.isExplicitTangent ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 242, 254, 0.35)',
              'stroke-width': String(1.2 * invScale), 'stroke-dasharray': `${3 * invScale},${3 * invScale}`,
              style: { pointerEvents: 'none' }
            }));
            drawHandle(outDir, 'out', vActive.isExplicitTangent ? '#ffd700' : '#00f2fe', 'Drag tangent (Alt+Drag to break into cusp)');
          }
        }
      }

      curve.vertices.forEach((v, idx) => {
        const isSelected = idx === activeIdx;
        const isCusp = !!v.isCusp;
        const hit = makeElement('svg:circle', {
          cx: v.point[0], cy: v.point[1], r: String(14 * invScale), fill: 'transparent',
          style: { cursor: 'move', pointerEvents: 'all' }
        });

        let marker;
        if (isCusp) {
          const s = (isSelected ? 10 : 8.5) * invScale;
          marker = makeElement('svg:rect', {
            x: v.point[0] - s / 2, y: v.point[1] - s / 2, width: s, height: s, rx: String(1.5 * invScale),
            transform: `rotate(45, ${v.point[0]}, ${v.point[1]})`,
            fill: isSelected ? '#00f2fe' : '#f59e0b', stroke: '#fff', 'stroke-width': String(1.6 * invScale),
            style: { pointerEvents: 'none' }
          });
        } else {
          marker = makeElement('svg:circle', {
            cx: v.point[0], cy: v.point[1], r: String((isSelected ? 5.5 : 4.0) * invScale),
            fill: isSelected ? '#00f2fe' : '#00e676', stroke: '#fff', 'stroke-width': String(1.6 * invScale),
            style: { pointerEvents: 'none' }
          });
        }

        hit.addEventListener('mousedown', (e) => {
          if (e.button === 2) return;
          e.stopPropagation();
          this.handlers.onKnotMouseDown?.(curve, idx, e);
        });
        hit.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handlers.onKnotContextMenu?.(curve, idx, e);
        });

        this.controlsLayer.append(hit, marker);
      });

      if (curve.beziers && curve.beziers.length > 0) {
        curve.beziers.forEach((seg, segIdx) => {
          const mid = StudioGeometry.evalCubicBezier(seg, 0.5);
          const midHit = makeElement('svg:circle', {
            cx: mid[0], cy: mid[1], r: String(11 * invScale), fill: 'transparent',
            style: { cursor: 'pointer', pointerEvents: 'all' },
            title: 'Click to insert knot here'
          });
          const midDot = makeElement('svg:circle', {
            cx: mid[0], cy: mid[1], r: String(3.2 * invScale),
            fill: '#f59e0b', stroke: '#fff', 'stroke-width': String(1 * invScale),
            opacity: '0.75', style: { pointerEvents: 'none' }
          });
          midHit.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.handlers.onMidpointMouseDown?.(curve, segIdx, e);
          });
          this.controlsLayer.append(midHit, midDot);
        });
      }
    }
  _renderImageControls(plate, invScale) {
    const border = makeElement('svg:rect', {
      x: plate.x, y: plate.y, width: plate.width, height: plate.height,
      fill: 'rgba(0, 242, 254, 0.02)', stroke: '#00f2fe', 'stroke-width': String(1.6 * invScale),
      'stroke-dasharray': `${5 * invScale},${3 * invScale}`,
      style: { cursor: 'move', pointerEvents: 'all' }
    });
    border.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      e.stopPropagation();
      this.handlers.onImageMouseDown?.(plate, e);
    });
    this.controlsLayer.appendChild(border);

    const gSize = 10 * invScale;
    const half = gSize / 2;
    [
      { id: 'nw', x: plate.x, y: plate.y, cursor: 'nwse-resize' },
      { id: 'ne', x: plate.x + plate.width, y: plate.y, cursor: 'nesw-resize' },
      { id: 'se', x: plate.x + plate.width, y: plate.y + plate.height, cursor: 'nwse-resize' },
      { id: 'sw', x: plate.x, y: plate.y + plate.height, cursor: 'nesw-resize' }
    ].forEach(c => {
      const grip = makeElement('svg:rect', {
        x: c.x - half, y: c.y - half, width: gSize, height: gSize, rx: String(2 * invScale),
        fill: '#00f2fe', stroke: '#fff', 'stroke-width': String(1.5 * invScale),
        style: { cursor: c.cursor, pointerEvents: 'all' }
      });
      grip.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.handlers.onImageGripMouseDown?.(plate, c.id, e);
      });
      this.controlsLayer.appendChild(grip);
    });
  }

  _renderExportBounds(rect, invScale) {
    const big = 10000;
    const maskPath = `M -${big} -${big} H ${big} V ${big} H -${big} Z M ${rect.x} ${rect.y} V ${rect.y + rect.height} H ${rect.x + rect.width} V ${rect.y} Z`;
    this.controlsLayer.appendChild(makeElement('svg:path', {
      d: maskPath, fill: 'rgba(0, 0, 0, 0.42)', 'fill-rule': 'evenodd', style: { pointerEvents: 'none' }
    }));
    this.controlsLayer.appendChild(makeElement('svg:rect', {
      x: rect.x, y: rect.y, width: rect.width, height: rect.height, fill: 'none',
      stroke: '#ffd700', 'stroke-width': String(2 * invScale), 'stroke-dasharray': `${7 * invScale},${4 * invScale}`,
      style: { pointerEvents: 'none' }
    }));
  }

  clearTransient() {
    this.transientLayer.innerHTML = '';
  }

  renderTransient(spec = {}) {
      this.transientLayer.innerHTML = '';
      const invScale = 1 / (this.engine.state.zoom || 1.0);
      const z = this.engine.state.cadStrokeMode ? (this.engine.state.zoom || 1.0) : 1.0;

      if (spec.previewPathD) {
        const col = spec.color || '#00e676';
        const baseW = spec.strokeWidth || 3.2;
        if (spec.lineStyle === 'neon') {
          this.transientLayer.appendChild(makeElement('svg:path', {
            d: spec.previewPathD, stroke: col, 'stroke-width': String((baseW + 10) / z),
            fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            style: { filter: 'url(#qcs-neon-glow)', opacity: '0.88' }
          }));
          this.transientLayer.appendChild(makeElement('svg:path', {
            d: spec.previewPathD, stroke: StudioGeometry.getLuminousCoreColor(col),
            'stroke-width': String(Math.max(2.0, baseW * 0.78) / z),
            fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
          }));
        } else {
          this.transientLayer.appendChild(makeElement('svg:path', {
            d: spec.previewPathD, stroke: col, 'stroke-width': String(baseW / z),
            fill: spec.isLoopClosing ? 'rgba(0, 242, 254, 0.08)' : 'none',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round'
          }));
        }
      }

      if (spec.previewArrow) {
        const { p0, exitVec, color, strokeWidth } = spec.previewArrow;
        const geo = StudioGeometry.computeConcaveArrowPath(p0, exitVec, strokeWidth, z);
        this.transientLayer.appendChild(makeElement('svg:path', {
          d: geo.d, stroke: color, 'stroke-width': String(geo.effectiveWidth),
          fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
      }

      if (spec.tetherLine) {
        const { from, to, isSlack, didRewind } = spec.tetherLine;
        this.transientLayer.appendChild(makeElement('svg:line', {
          x1: from[0], y1: from[1], x2: to[0], y2: to[1],
          stroke: didRewind ? '#f59e0b' : (isSlack ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)'),
          'stroke-width': String(1.6 * invScale),
          'stroke-dasharray': isSlack ? `${3 * invScale},${3 * invScale}` : 'none'
        }));
      }

      if (spec.collinearGuide) {
        const { p1, p2, label, pt } = spec.collinearGuide;
        this.transientLayer.appendChild(makeElement('svg:line', {
          x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
          stroke: '#00f2fe', 'stroke-width': String(1.5 * invScale),
          'stroke-dasharray': `${4 * invScale},${3 * invScale}`
        }));
        if (label && pt) {
          this.transientLayer.appendChild(makeElement('svg:text', {
            x: pt[0], y: pt[1] - 14 * invScale, fill: '#00f2fe',
            'font-size': `${11 * invScale}px`, 'font-family': 'monospace', 'font-weight': 'bold',
            'text-anchor': 'middle'
          }, label));
        }
      }

      (spec.cuspPoints || []).forEach(cp => {
        const s = 9 * invScale;
        this.transientLayer.appendChild(makeElement('svg:rect', {
          x: cp[0] - s / 2, y: cp[1] - s / 2, width: s, height: s, rx: String(1.5 * invScale),
          transform: `rotate(45, ${cp[0]}, ${cp[1]})`,
          fill: '#f59e0b', stroke: '#ffffff', 'stroke-width': String(1.5 * invScale)
        }));
      });

      if (spec.pendingCuspPt) {
        const cp = spec.pendingCuspPt;
        const s = 11 * invScale;
        this.transientLayer.appendChild(makeElement('svg:rect', {
          x: cp[0] - s / 2, y: cp[1] - s / 2, width: s, height: s, rx: String(1.5 * invScale),
          transform: `rotate(45, ${cp[0]}, ${cp[1]})`,
          fill: 'rgba(245, 158, 11, 0.35)', stroke: '#ffd700', 'stroke-width': String(1.8 * invScale)
        }));
      }

      if (spec.tipIndicator) {
        const { pt, didRewind } = spec.tipIndicator;
        this.transientLayer.appendChild(makeElement('svg:circle', {
          cx: pt[0], cy: pt[1], r: String(3.8 * invScale),
          fill: '#ffffff', stroke: didRewind ? '#f59e0b' : '#00e676', 'stroke-width': String(1.6 * invScale)
        }));
      }

      if (spec.eraseCircle) {
        const { pt, r, didRewind } = spec.eraseCircle;
        this.transientLayer.appendChild(makeElement('svg:circle', {
          cx: pt[0], cy: pt[1], r: String(r),
          fill: didRewind ? 'rgba(245, 158, 11, 0.14)' : 'rgba(255, 255, 255, 0.03)',
          stroke: didRewind ? '#f59e0b' : 'rgba(255, 255, 255, 0.5)',
          'stroke-width': String(1.2 * invScale),
          'stroke-dasharray': `${3 * invScale},${3 * invScale}`
        }));
      }

      if (spec.shapeRect) {
        const r = spec.shapeRect;
        this.transientLayer.appendChild(makeElement('svg:rect', {
          x: r.x, y: r.y, width: r.w, height: r.h, rx: r.rx || '4',
          fill: r.fill || 'rgba(0, 242, 254, 0.08)', stroke: r.stroke || '#00f2fe',
          'stroke-width': String(2 * invScale), 'stroke-dasharray': r.dashed ? `${5 * invScale},${3 * invScale}` : 'none'
        }));
      }

      if (spec.shapeEllipse) {
        const el = spec.shapeEllipse;
        this.transientLayer.appendChild(makeElement('svg:ellipse', {
          cx: el.cx, cy: el.cy, rx: el.rx, ry: el.ry,
          fill: el.fill || 'rgba(0, 242, 254, 0.08)', stroke: el.stroke || '#00f2fe',
          'stroke-width': String(2 * invScale)
        }));
      }

      if (spec.paintRing) {
        const { pt, r, isErase } = spec.paintRing;
        this.transientLayer.appendChild(makeElement('svg:circle', {
          cx: pt[0], cy: pt[1], r: String(r), fill: 'none',
          stroke: isErase ? '#00f2fe' : '#f59e0b',
          'stroke-width': String(1.4 * invScale),
          'stroke-dasharray': isErase ? `${4 * invScale},${3 * invScale}` : 'none'
        }));
      }
    }
  exportToCanvas(scale = 2, bgMode = 'matte') {
    const state = this.engine.state;
    const bounds = StudioGeometry.computeExportBounds(state, (t, s, f) => this.measureTextBounds(t, s, f));

    return new Promise((resolve, reject) => {
      const out = document.createElement('canvas');
      out.width = Math.round(bounds.width * scale);
      out.height = Math.round(bounds.height * scale);
      const ctx = out.getContext('2d');
      ctx.scale(scale, scale);

      if (bgMode !== 'transparent') {
        ctx.fillStyle = state.canvasBgColor || '#090d16';
        ctx.fillRect(0, 0, bounds.width, bounds.height);
      }

      (state.placedImages || []).forEach(plate => {
        ctx.save();
        ctx.globalAlpha = plate.opacity !== undefined ? plate.opacity : 1.0;
        ctx.drawImage(plate.img, plate.x - bounds.x, plate.y - bounds.y, plate.width, plate.height);
        ctx.restore();
      });

      const svgClone = this.svg.cloneNode(true);
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.setAttribute('width', String(bounds.width));
      svgClone.setAttribute('height', String(bounds.height));
      svgClone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
      svgClone.removeAttribute('style');
      svgClone.querySelectorAll('.qcs-controls-layer, .qcs-transient-layer, .qcs-ghost-note-pill').forEach(el => el.remove());

      const xml = new XMLSerializer().serializeToString(svgClone);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, bounds.width, bounds.height);
        URL.revokeObjectURL(url);
        resolve({ canvas: out, bounds });
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }
}

globalThis.StudioSvgRenderer = StudioSvgRenderer;
if (typeof module !== 'undefined' && module.exports) module.exports = StudioSvgRenderer;