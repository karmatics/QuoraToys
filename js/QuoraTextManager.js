class QuoraTextManager {
  constructor(component) {
    this.component = component;
  }

  renderCurveAttachedTextSvg(ann, textBadgesLayer, stageState) {
      const beziers = ann.beziers;
      if (!beziers || beziers.length === 0) return;

      const isActiveCurve = (ann === this.component.getActiveCurve());
      const hasText = Boolean(ann.text && ann.text.trim() !== '');

      // Skip rendering if no text and not actively selected
      if (!hasText && !isActiveCurve) return;

      // Clean up any existing decoupled elements across all layers
      if (ann._textElements) {
        Object.values(ann._textElements).forEach(el => { if (el && el.remove) el.remove(); });
        ann._textElements = null;
      }

      const isAtTail = (ann.textEnd !== 'tip');
      const termSeg = isAtTail ? beziers[beziers.length - 1] : beziers[0];
      const anchorPt = isAtTail ? termSeg[3] : termSeg[0];

      const exitVec = isAtTail
        ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
        : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];

      const fontS = ann.fontSize || 20;
      const fontF = ann.fontFamily || "'Architects Daughter', cursive, sans-serif";

      // Compact typography bounds measurement via canvas metrics
      const bounds = this.measureTextBounds(ann.text || '', fontS, fontF);
      const padX = ann.boxStyle !== 'none' ? 8 : 4;
      const padY = ann.boxStyle !== 'none' ? 4 : 2;

      const boxW = bounds.maxW + padX * 2;
      const boxH = bounds.totalH + padY * 2;

      const effectiveEdge = ann.manualEdge ? ann.connectEdge : null;
      const placement = this.computeTextPlacement(anchorPt, exitVec, boxW, boxH, effectiveEdge);
      ann.connectEdge = placement.connectEdge;

      const { posX, posY, connectEdge, textAnchorType, bracketPath } = placement;
      const col = ann.color || '#00e676';
      const isNeon = (ann.lineStyle === 'neon');
      const coreTint = isNeon ? this.component.strokeManager.getLuminousCoreColor(col) : col;

      // GHOST SHELF PLACEHOLDER IF ACTIVE CURVE HAS NO TEXT
      if (!hasText) {
        const ghostW = 120;
        const ghostH = 26;
        const ghostPlacement = this.computeTextPlacement(anchorPt, exitVec, ghostW, ghostH, effectiveEdge);

        const ghostG = makeElement('svg:g', {
          className: 'qa-curve-attached-label qa-ghost-text-placeholder',
          style: { cursor: 'text', userSelect: 'none', opacity: '0.45', transition: 'opacity 0.15s ease' },
          title: 'Click or start typing on keyboard to add callout text',
          onclick: (e) => {
            e.stopPropagation();
            this.promptInlineTailText(ann, anchorPt, connectEdge);
          }
        });

        ghostG.addEventListener('mouseenter', () => { ghostG.style.opacity = '0.95'; });
        ghostG.addEventListener('mouseleave', () => { ghostG.style.opacity = '0.45'; });

        // Shelf underline in ghost mode
        ghostG.appendChild(makeElement('svg:path', {
          d: `M ${ghostPlacement.posX} ${ghostPlacement.posY + ghostH} L ${ghostPlacement.posX + ghostW} ${ghostPlacement.posY + ghostH}`,
          fill: 'none', stroke: col, 'stroke-width': '1.6', 'stroke-dasharray': '3,3',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));

        const textX = ghostPlacement.connectEdge === 'right' ? (ghostPlacement.posX + ghostW - 6) : (ghostPlacement.posX + 6);
        const textAnchor = ghostPlacement.connectEdge === 'right' ? 'end' : 'start';

        ghostG.appendChild(makeElement('svg:text', {
          x: textX, y: ghostPlacement.posY + 18, fill: col,
          'font-family': fontF, 'font-size': '13px', 'font-style': 'italic', 'font-weight': 'bold',
          'text-anchor': textAnchor
        }, '✎ Type note...'));

        textBadgesLayer.appendChild(ghostG);
        ann._textElements = { ghost: ghostG };
        return;
      }

      // Absolute Bracket Path
      const dBracket = `M ${posX} ${posY} ` + bracketPath.replace(/([0-9.]+)\s+([0-9.]+)/g, (match, px, py) => {
        return `${posX + parseFloat(px)} ${posY + parseFloat(py)}`;
      });

      let textAnchorX = posX + padX;
      if (textAnchorType === 'end') {
        textAnchorX = posX + boxW - padX;
      } else if (textAnchorType === 'middle') {
        textAnchorX = posX + boxW / 2;
      }

      const textElementsMap = {};

      // 1. SHADOW LAYER: All keyline dark drop shadows (Classic mode only)
      if (!isNeon) {
        const shadowG = makeElement('svg:g', {
          transform: 'translate(2, 2)',
          style: { pointerEvents: 'none' }
        });

        if (ann.boxStyle === 'bracket' || !ann.boxStyle) {
          shadowG.appendChild(makeElement('svg:path', {
            d: dBracket, fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)',
            'stroke-width': '4.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
          }));
        }

        const txtShadow = makeElement('svg:text', {
          x: textAnchorX, y: posY + padY + fontS * 0.88, fill: 'rgba(10, 15, 25, 0.95)',
          'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
          'text-anchor': textAnchorType
        });
        bounds.lines.forEach((l, i) => {
          txtShadow.appendChild(makeElement('svg:tspan', {
            x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px`
          }, l));
        });
        shadowG.appendChild(txtShadow);

        this.component.shadowLayer.appendChild(shadowG);
        textElementsMap.shadow = shadowG;
      }

      // 2. GLOW LAYER: Luminous Gaussian bloom around bracket AND letters (Neon mode)
      if (isNeon) {
        const glowG = makeElement('svg:g', {
          style: { pointerEvents: 'none', opacity: '0.92' }
        });

        if (ann.boxStyle === 'bracket' || !ann.boxStyle) {
          glowG.appendChild(makeElement('svg:path', {
            d: dBracket, fill: 'none', stroke: col, 'stroke-width': '10',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            style: { filter: 'url(#qa-neon-glow)' }
          }));
        }

        const txtGlow = makeElement('svg:text', {
          x: textAnchorX, y: posY + padY + fontS * 0.88, fill: col,
          stroke: col, 'stroke-width': '3.5',
          'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
          'text-anchor': textAnchorType,
          style: { filter: 'url(#qa-neon-glow)' }
        });
        bounds.lines.forEach((l, i) => {
          txtGlow.appendChild(makeElement('svg:tspan', {
            x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px`
          }, l));
        });
        glowG.appendChild(txtGlow);

        this.component.glowLayer.appendChild(glowG);
        textElementsMap.glow = glowG;
      }

      // 3. FOREGROUND LAYER: Luminous plasma core or crisp classic strokes
      const g = makeElement('svg:g', {
        className: 'qa-curve-attached-label',
        style: { cursor: 'move', userSelect: 'none', transition: 'opacity 0.15s ease' },
        title: 'Double-click to edit text • Drag to reposition callout and curve tail',
        ondblclick: (e) => {
          e.stopPropagation();
          this.promptInlineTailText(ann, anchorPt, connectEdge);
        }
      });

      // Dark backdrop for readability
      g.appendChild(makeElement('svg:rect', {
        x: posX, y: posY, width: boxW, height: boxH, rx: '4',
        fill: isNeon ? 'rgba(9, 13, 22, 0.88)' : 'rgba(9, 13, 22, 0.72)', stroke: 'none',
        style: { pointerEvents: 'none' }
      }));

      // Foreground Bracket
      if (ann.boxStyle === 'bracket' || !ann.boxStyle) {
        g.appendChild(makeElement('svg:path', {
          d: dBracket, fill: 'none', stroke: isNeon ? coreTint : col,
          'stroke-width': '2.4',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: isNeon ? { filter: 'url(#qa-neon-core)' } : {}
        }));
      }

      // Foreground Text
      const txt = makeElement('svg:text', {
        x: textAnchorX, y: posY + padY + fontS * 0.88, fill: isNeon ? coreTint : col,
        'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
        'text-anchor': textAnchorType,
        style: isNeon ? { filter: 'url(#qa-neon-core)' } : { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.85))' }
      });
      bounds.lines.forEach((l, i) => {
        txt.appendChild(makeElement('svg:tspan', {
          x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px`
        }, l));
      });
      g.appendChild(txt);

      // Repositioning drag handler
      let isDraggingBadge = false;
      let startMouseX = 0, startMouseY = 0;

      g.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        isDraggingBadge = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;

        const targetKnot = isAtTail
          ? ann.vertices[ann.vertices.length - 1]
          : ann.vertices[0];
        const origX = targetKnot.point[0];
        const origY = targetKnot.point[1];

        const onBadgeDragMove = (ev) => {
          if (!isDraggingBadge) return;
          const z = stageState.zoom || 1.0;
          const dx = (ev.clientX - startMouseX) / z;
          const dy = (ev.clientY - startMouseY) / z;

          targetKnot.point[0] = Math.round(origX + dx);
          targetKnot.point[1] = Math.round(origY + dy);

          this.component.commitCurveGeometryUpdate();
        };

        const onBadgeDragUp = () => {
          isDraggingBadge = false;
          window.removeEventListener('mousemove', onBadgeDragMove);
          window.removeEventListener('mouseup', onBadgeDragUp);
          this.component.renderStage();
        };

        window.addEventListener('mousemove', onBadgeDragMove);
        window.addEventListener('mouseup', onBadgeDragUp);
      });

      textBadgesLayer.appendChild(g);
      textElementsMap.fg = g;
      ann._textElements = textElementsMap;
    }

  promptInlineTailText(curveRecord, anchorPt, forcedEdge = null, initialText = '') {
      const existing = document.getElementById('qa-inline-tail-editor');
      if (existing) existing.remove();
      const existingDock = document.getElementById('qa-callout-editor-dock');
      if (existingDock) existingDock.remove();

      let exitVec = [1, 0];
      if (curveRecord && curveRecord.beziers?.length > 0) {
        const isAtTail = (curveRecord.textEnd !== 'tip');
        const termSeg = isAtTail ? curveRecord.beziers[curveRecord.beziers.length - 1] : curveRecord.beziers[0];
        exitVec = isAtTail
          ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
          : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];
      }

      let fontF = curveRecord?.fontFamily || this.component.stageState.fontFamily;
      let fontS = curveRecord?.fontSize || this.component.stageState.fontSize || 20;
      let boxStyle = curveRecord?.boxStyle || 'bracket';
      let boxOpacity = curveRecord?.boxOpacity || 0.75;
      const color = curveRecord?.color || this.component.stageState.currentColor;

      const initialVal = (initialText !== undefined && initialText !== null && initialText !== '')
        ? initialText
        : (curveRecord?.text || '');

      const bounds = this.measureTextBounds(initialVal || 'Type callout...', fontS, fontF);
      const width = bounds.maxW + 20;
      const estHeight = bounds.totalH + 12;

      const effectiveEdge = curveRecord?.manualEdge ? curveRecord.connectEdge : (forcedEdge || null);
      let placement = this.computeTextPlacement(anchorPt, exitVec, width, estHeight, effectiveEdge);
      let connectEdge = placement.connectEdge;

      // Editor container placed directly at the callout location
      const editorWrap = makeElement('div', {
        id: 'qa-inline-tail-editor',
        style: {
          position: 'absolute',
          top: `${placement.posY}px`,
          left: `${placement.posX}px`,
          width: `${width}px`,
          zIndex: '70',
          overflow: 'visible'
        }
      });

      const textarea = makeElement('textarea', {
        placeholder: 'Type callout text...',
        value: initialVal,
        rows: 1,
        style: {
          width: '100%', minHeight: '30px', maxHeight: '180px', padding: '4px 8px',
          fontSize: `${fontS}px`, fontFamily: fontF, fontWeight: 'bold', lineHeight: '1.25',
          color: color, background: `rgba(9, 13, 22, ${boxOpacity})`,
          border: 'none', borderRadius: '4px', outline: 'none', resize: 'none',
          overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxSizing: 'border-box', textAlign: placement.textAlign,
          boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
          scrollbarWidth: 'none', msOverflowStyle: 'none'
        }
      });

      const applyFrameStyles = () => {
        textarea.style.border = 'none';
        textarea.style.borderRadius = '4px';
        textarea.style.background = `rgba(9, 13, 22, ${boxOpacity})`;

        if (boxStyle === 'box' || boxStyle === 'pill') {
          textarea.style.border = `2px solid ${color}`;
          textarea.style.borderRadius = boxStyle === 'pill' ? '24px' : '4px';
        } else if (boxStyle === 'bracket') {
          if (placement.isDirectHorizontal) {
            textarea.style.borderBottom = `2px solid ${color}`;
          } else if (connectEdge === 'left') {
            textarea.style.borderLeft = `2px solid ${color}`;
            textarea.style.borderBottom = `2px solid ${color}`;
          } else if (connectEdge === 'right') {
            textarea.style.borderRight = `2px solid ${color}`;
            textarea.style.borderBottom = `2px solid ${color}`;
          } else if (connectEdge === 'bottom') {
            textarea.style.borderBottom = `2px solid ${color}`;
            textarea.style.borderLeft = `2px solid ${color}`;
          } else if (connectEdge === 'top') {
            textarea.style.borderTop = `2px solid ${color}`;
            textarea.style.borderLeft = `2px solid ${color}`;
          }
        }
      };
      applyFrameStyles();

      // Floating Controls Deck positioned comfortably 28px away
      const controlsDock = makeElement('div', {
        id: 'qa-callout-editor-dock',
        style: {
          position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(11, 17, 32, 0.98)', border: '1.5px solid rgba(0, 242, 254, 0.5)',
          borderRadius: '24px', padding: '5px 14px', fontSize: '10.5px',
          boxShadow: '0 14px 36px rgba(0, 0, 0, 0.9), 0 0 16px rgba(0, 242, 254, 0.25)',
          zIndex: '85', backdropFilter: 'blur(14px)', userSelect: 'none'
        }
      });

      const updateDockPosition = () => {
        const curH = textarea.offsetHeight || estHeight;
        const bds = this.measureTextBounds(textarea.value || ' ', fontS, fontF);
        const dynamicW = Math.max(80, bds.maxW + 18);
        editorWrap.style.width = `${dynamicW}px`;

        placement = this.computeTextPlacement(anchorPt, exitVec, dynamicW, curH, connectEdge);
        editorWrap.style.left = `${placement.posX}px`;
        editorWrap.style.top = `${placement.posY}px`;

        const floatAbove = (placement.posY > 64);
        const dockTop = floatAbove ? (placement.posY - 44) : (placement.posY + curH + 28);
        controlsDock.style.top = `${dockTop}px`;
        controlsDock.style.left = `${placement.posX}px`;
      };

      const autoGrow = () => {
        textarea.style.height = 'auto';
        const curH = Math.max(30, textarea.scrollHeight);
        textarea.style.height = `${curH}px`;
        updateDockPosition();
      };

      const edgeCycleBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 8px', fontSize: '10px', color: '#00f2fe', borderColor: 'rgba(0, 242, 254, 0.4)' },
        title: 'Cycle Connection Edge: Left -> Right -> Bottom -> Top -> Auto',
        onclick: (e) => {
          e.stopPropagation();
          const cycle = ['left', 'right', 'bottom', 'top', 'auto'];
          const nextEdge = cycle[(cycle.indexOf(connectEdge) + 1) % cycle.length];
          connectEdge = nextEdge;
          const isManual = (nextEdge !== 'auto');
          if (curveRecord) {
            curveRecord.connectEdge = nextEdge;
            curveRecord.manualEdge = isManual;
          }
          placement = this.computeTextPlacement(anchorPt, exitVec, width, textarea.offsetHeight || estHeight, nextEdge === 'auto' ? null : nextEdge);
          connectEdge = placement.connectEdge;
          textarea.style.textAlign = placement.textAlign;
          applyFrameStyles();
          autoGrow();
          edgeCycleBtn.textContent = `Dock: ${connectEdge.toUpperCase()}${isManual ? ' 🔒' : ''}`;
          if (curveRecord) this.component.renderStage();
        }
      }, `Dock: ${connectEdge.toUpperCase()}${curveRecord?.manualEdge ? ' 🔒' : ''}`);

      const styleBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '2px 6px', fontSize: '10px' },
        title: 'Cycle Frame: 2-Side Bracket ➔ Rounded Box ➔ Pill ➔ Plain',
        onclick: (e) => {
          e.stopPropagation();
          const styles = ['bracket', 'box', 'pill', 'none'];
          boxStyle = styles[(styles.indexOf(boxStyle) + 1) % styles.length];
          if (curveRecord) curveRecord.boxStyle = boxStyle;
          styleBtn.textContent = boxStyle === 'bracket' ? '◺ Bracket' : (boxStyle === 'box' ? '◻ Box' : (boxStyle === 'pill' ? '💊 Pill' : 'Plain'));
          applyFrameStyles();
          if (curveRecord) this.component.renderStage();
        }
      }, boxStyle === 'bracket' ? '◺ Bracket' : (boxStyle === 'box' ? '◻ Box' : (boxStyle === 'pill' ? '💊 Pill' : 'Plain')));

      const lineStyleBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 6px', fontSize: '10px', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.45)' },
        title: 'Toggle Line Style: Classic Shadow ➔ Lightsaber Neon Glow',
        onclick: (e) => {
          e.stopPropagation();
          const styles = ['classic', 'neon'];
          const curStyle = curveRecord?.lineStyle || this.component.stageState.lineStyle || 'classic';
          const nextStyle = styles[(styles.indexOf(curStyle) + 1) % styles.length];
          if (curveRecord) curveRecord.lineStyle = nextStyle;
          this.component.stageState.lineStyle = nextStyle;
          lineStyleBtn.textContent = nextStyle === 'neon' ? '💡 Neon' : '🖋️ Classic';
          this.component.commitCurveGeometryUpdate();
        }
      }, (curveRecord?.lineStyle === 'neon') ? '💡 Neon' : '🖋️ Classic');

      const fontSelect = makeElement('select', {
        style: {
          background: '#0d1117', color: '#00f2fe', border: '1px solid #30363d',
          borderRadius: '4px', padding: '2px 4px', fontSize: '9.5px', fontFamily: 'monospace', outline: 'none'
        },
        onchange: (e) => {
          fontF = e.target.value;
          this.component.ensureFontLoaded(fontF);
          if (curveRecord) curveRecord.fontFamily = fontF;
          textarea.style.fontFamily = fontF;
          autoGrow();
          if (curveRecord) this.component.renderStage();
        }
      }, [
        makeElement('option', { value: "'Architects Daughter', cursive, sans-serif", selected: fontF.includes('Architects') }, "Architect"),
        makeElement('option', { value: "monospace", selected: fontF === 'monospace' }, "Mono"),
        makeElement('option', { value: "'Plus Jakarta Sans', system-ui, sans-serif", selected: fontF.includes('Jakarta') }, "Sans")
      ]);

      let committed = false;
      let onOutClick = null;

      const commit = () => {
        if (committed) return;
        committed = true;
        if (onOutClick) window.removeEventListener('mousedown', onOutClick);

        const textVal = textarea.value.trim();
        if (curveRecord) {
          curveRecord.text = textVal;
          curveRecord.connectEdge = connectEdge;
          curveRecord.fontSize = fontS;
          curveRecord.fontFamily = fontF;
          curveRecord.boxStyle = boxStyle;
          curveRecord.boxOpacity = boxOpacity;
        } else if (textVal) {
          this.component.stageState.annotations.push({
            id: 'text_' + Date.now(),
            type: 'text_badge',
            x: anchorPt[0],
            y: anchorPt[1],
            text: textVal,
            fontSize: fontS,
            fontFamily: fontF,
            boxStyle: boxStyle,
            boxOpacity: boxOpacity,
            connectEdge: connectEdge,
            color: color
          });
        }

        editorWrap.remove();
        controlsDock.remove();
        this.component.renderStage();
      };

      const okBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '2px 10px', fontSize: '10px', background: '#238636', borderColor: '#2ea043' },
        onclick: (e) => { e.stopPropagation(); commit(); }
      }, '✓ Done');

      controlsDock.append(
        makeElement('span', { style: { color: '#00f2fe', fontWeight: 'bold', fontSize: '11px', marginRight: '2px' } }, '✎ Callout:'),
        edgeCycleBtn, styleBtn, lineStyleBtn, fontSelect, okBtn
      );

      editorWrap.appendChild(textarea);
      this.component.stageBox.appendChild(editorWrap);
      this.component.stageBox.appendChild(controlsDock);

      textarea.addEventListener('input', autoGrow);
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault(); commit();
        } else if (e.key === 'Escape') {
          e.preventDefault(); textarea.value = ''; commit();
        }
      });

      onOutClick = (ev) => {
        if (!editorWrap.contains(ev.target) && !controlsDock.contains(ev.target)) commit();
      };

      setTimeout(() => {
        textarea.focus();
        if (textarea.value.length > 0) {
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        }
        autoGrow();
        window.addEventListener('mousedown', onOutClick);
      }, 40);
    }
  wrapTextLines(text, maxCharsPerLine) {
      if (!text) return [];
      const paragraphs = String(text).split('\n');
      const result = [];

      paragraphs.forEach(p => {
        if (!p.trim()) {
          result.push('');
          return;
        }
        const words = p.split(/\s+/);
        let curLine = '';

        words.forEach(w => {
          if (!curLine) {
            curLine = w;
          } else if ((curLine.length + 1 + w.length) <= maxCharsPerLine) {
            curLine += ' ' + w;
          } else {
            result.push(curLine);
            curLine = w;
          }
        });
        if (curLine) result.push(curLine);
      });

      return result;
  }

  renderDirectTextBadgeSvg(ann, textBadgesLayer, stageState) {
      const fontS = ann.fontSize || 20;
      const fontF = ann.fontFamily || "'Architects Daughter', cursive, sans-serif";

      // Compact typography bounds measurement via canvas metrics
      const bounds = this.measureTextBounds(ann.text || '', fontS, fontF);
      const padX = ann.boxStyle !== 'none' ? 8 : 4;
      const padY = ann.boxStyle !== 'none' ? 4 : 2;

      const boxW = bounds.maxW + padX * 2;
      const boxH = bounds.totalH + padY * 2;

      const col = ann.color || '#00e676';
      const isSelected = (stageState.selectedItem === ann);
      const isNeon = (ann.lineStyle === 'neon');
      const coreTint = isNeon ? this.component.strokeManager.getLuminousCoreColor(col) : col;

      // Clean up prior decoupled elements across layers
      if (ann._badgeElements) {
        Object.values(ann._badgeElements).forEach(el => { if (el && el.remove) el.remove(); });
        ann._badgeElements = null;
      }

      const bD = `M ${ann.x} ${ann.y} L ${ann.x} ${ann.y + boxH} L ${ann.x + boxW} ${ann.y + boxH}`;
      const badgeElementsMap = {};

      // 1. SHADOW LAYER: All keyline shadows down together (Classic mode only)
      if (!isNeon) {
        const shadowG = makeElement('svg:g', {
          transform: 'translate(2, 2)',
          style: { pointerEvents: 'none' }
        });
        shadowG.appendChild(makeElement('svg:path', {
          d: bD, fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '4.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
        const txtShadow = makeElement('svg:text', {
          x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: 'rgba(10, 15, 25, 0.95)',
          'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold'
        });
        bounds.lines.forEach((l, i) => {
          txtShadow.appendChild(makeElement('svg:tspan', {
            x: ann.x + padX, dy: i === 0 ? '0' : `${bounds.lineHeight}px`
          }, l));
        });
        shadowG.appendChild(txtShadow);

        this.component.shadowLayer.appendChild(shadowG);
        badgeElementsMap.shadow = shadowG;
      }

      // 2. GLOW LAYER: Luminous Gaussian bloom around bracket & letters (Neon mode)
      if (isNeon) {
        const glowG = makeElement('svg:g', {
          style: { pointerEvents: 'none', opacity: '0.92' }
        });
        glowG.appendChild(makeElement('svg:path', {
          d: bD, fill: 'none', stroke: col, 'stroke-width': '10', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: { filter: 'url(#qa-neon-glow)' }
        }));
        const txtGlow = makeElement('svg:text', {
          x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: col, stroke: col, 'stroke-width': '3.5',
          'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
          style: { filter: 'url(#qa-neon-glow)' }
        });
        bounds.lines.forEach((l, i) => {
          txtGlow.appendChild(makeElement('svg:tspan', {
            x: ann.x + padX, dy: i === 0 ? '0' : `${bounds.lineHeight}px`
          }, l));
        });
        glowG.appendChild(txtGlow);

        this.component.glowLayer.appendChild(glowG);
        badgeElementsMap.glow = glowG;
      }

      // 3. FOREGROUND LAYER
      const g = makeElement('svg:g', {
        id: `badge-${ann.id}`,
        className: 'qa-movable-text-badge',
        style: { cursor: 'move', userSelect: 'none' },
        ondblclick: (e) => {
          e.stopPropagation();
          this.promptInlineTailText(ann, [ann.x, ann.y], 'left');
        }
      });

      if (isSelected) {
        g.appendChild(makeElement('svg:rect', {
          x: ann.x - 3, y: ann.y - 3, width: boxW + 6, height: boxH + 6, rx: '6',
          fill: 'none', stroke: '#00f2fe', 'stroke-width': '1.5', 'stroke-dasharray': '3,3',
          style: { filter: 'drop-shadow(0 0 6px #00f2fe)', pointerEvents: 'none' }
        }));
      }

      // Backdrop
      g.appendChild(makeElement('svg:rect', {
        x: ann.x, y: ann.y, width: boxW, height: boxH, rx: '4',
        fill: isNeon ? 'rgba(9, 13, 22, 0.88)' : 'rgba(9, 13, 22, 0.72)', stroke: 'none',
        style: { pointerEvents: 'none' }
      }));

      // Foreground bracket
      g.appendChild(makeElement('svg:path', {
        d: bD, fill: 'none', stroke: isNeon ? coreTint : col, 'stroke-width': '2.4',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        style: isNeon ? { filter: 'url(#qa-neon-core)' } : {}
      }));

      // Foreground text
      const txt = makeElement('svg:text', {
        x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: isNeon ? coreTint : col,
        'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
        style: isNeon ? { filter: 'url(#qa-neon-core)' } : {}
      });

      bounds.lines.forEach((l, i) => {
        txt.appendChild(makeElement('svg:tspan', {
          x: ann.x + padX, dy: i === 0 ? '0' : `${bounds.lineHeight}px`
        }, l));
      });
      g.appendChild(txt);

      let isDrag = false;
      let sX = 0, sY = 0;
      let initialX = ann.x, initialY = ann.y;

      g.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        this.component.selectItem(ann);
        isDrag = true;
        sX = e.clientX; sY = e.clientY;
        initialX = ann.x; initialY = ann.y;

        const onM = (ev) => {
          if (!isDrag) return;
          const z = stageState.zoom || 1.0;
          const dx = (ev.clientX - sX) / z;
          const dy = (ev.clientY - sY) / z;
          ann.x = Math.round(initialX + dx);
          ann.y = Math.round(initialY + dy);
          this.component.renderStage();
        };

        const onU = () => {
          isDrag = false;
          window.removeEventListener('mousemove', onM);
          window.removeEventListener('mouseup', onU);
          this.component.renderStage();
        };

        window.addEventListener('mousemove', onM);
        window.addEventListener('mouseup', onU);
      });

      textBadgesLayer.appendChild(g);
      badgeElementsMap.fg = g;
      ann._badgeElements = badgeElementsMap;
    }
  computeTextPlacement(anchorPt, exitVec, boxW, boxH, forcedEdge = null) {
      const rawLen = Math.hypot(exitVec[0], exitVec[1]) || 1;
      const uX = exitVec[0] / rawLen;
      const uY = exitVec[1] / rawLen;

      // Angle of incoming curve vector in degrees (-180 to 180)
      const angleDeg = Math.atan2(uY, uX) * (180 / Math.PI);
      const absAngle = Math.abs(angleDeg);

      // Single-edge condition: within 18° of horizontal (0° or 180°)
      const isDirectHorizontal = (absAngle <= 18) || (Math.abs(absAngle - 180) <= 18);

      // Determine connection point (cx, cy) relative to box top-left (0, 0)
      // 360° smooth traversal from midpoint (at 90° to edge) to corner (at 45°)
      let cx = 0;
      let cy = boxH / 2;
      let connectEdge = 'left';
      let textAlign = 'left';
      let textAnchorType = 'start';
      let bracketPath = '';

      if (uX >= 0) {
        // Curve heading Right -> box sits to the right of anchorPt -> connects on Left/Top/Bottom
        if (uY >= 0) {
          // Heading Down-Right (0° to 90°)
          if (angleDeg < 45) {
            // Angle 0° (pure horizontal) -> 45°: on Left edge, moving from midpoint (boxH/2) to bottom corner (boxH)
            const t = angleDeg / 45; // 0 at horizontal, 1 at 45°
            cx = 0;
            cy = (boxH / 2) + t * (boxH / 2);
            connectEdge = 'left';
            textAlign = 'left';
            textAnchorType = 'start';

            if (isDirectHorizontal) {
              bracketPath = `M 0 ${boxH} L ${boxW} ${boxH}`; // Single shelf underline
            } else {
              bracketPath = `M 0 0 L 0 ${boxH} L ${boxW} ${boxH}`; // Left wall + bottom shelf
            }
          } else {
            // Angle 45° -> 90° (pure vertical down): on Top edge, moving from left corner (0) to midpoint (boxW/2)
            const t = (angleDeg - 45) / 45; // 0 at 45°, 1 at 90°
            cx = t * (boxW / 2);
            cy = 0;
            connectEdge = 'top';
            textAlign = (cx > boxW * 0.35) ? 'center' : 'left';
            textAnchorType = (cx > boxW * 0.35) ? 'middle' : 'start';
            bracketPath = `M 0 ${boxH} L 0 0 L ${boxW} 0`; // Top shelf + left wall
          }
        } else {
          // Heading Up-Right (-90° to 0°)
          const negAngle = -angleDeg;
          if (negAngle < 45) {
            // Angle 0° (pure horizontal) -> -45°: on Left edge, moving from midpoint (boxH/2) to top corner (0)
            const t = negAngle / 45;
            cx = 0;
            cy = (boxH / 2) - t * (boxH / 2);
            connectEdge = 'left';
            textAlign = 'left';
            textAnchorType = 'start';

            if (isDirectHorizontal) {
              bracketPath = `M 0 ${boxH} L ${boxW} ${boxH}`; // Single shelf underline
            } else {
              bracketPath = `M 0 ${boxH} L 0 0 L ${boxW} 0`; // Left wall + top shelf
            }
          } else {
            // Angle -45° -> -90° (pure vertical up): on Bottom edge, moving from left corner (0) to midpoint (boxW/2)
            const t = (negAngle - 45) / 45;
            cx = t * (boxW / 2);
            cy = boxH;
            connectEdge = 'bottom';
            textAlign = (cx > boxW * 0.35) ? 'center' : 'left';
            textAnchorType = (cx > boxW * 0.35) ? 'middle' : 'start';
            bracketPath = `M 0 0 L 0 ${boxH} L ${boxW} ${boxH}`; // Bottom shelf + left wall
          }
        }
      } else {
        // Curve heading Left -> box sits to the left of anchorPt -> connects on Right/Top/Bottom
        if (uY >= 0) {
          // Heading Down-Left (90° to 180°)
          const relAngle = 180 - angleDeg; // 90 at pure down, 0 at pure left
          if (relAngle < 45) {
            // Angle 180° (pure horizontal) -> 135°: on Right edge, moving from midpoint (boxH/2) to bottom corner (boxH)
            const t = relAngle / 45;
            cx = boxW;
            cy = (boxH / 2) + t * (boxH / 2);
            connectEdge = 'right';
            textAlign = 'right';
            textAnchorType = 'end';

            if (isDirectHorizontal) {
              bracketPath = `M 0 ${boxH} L ${boxW} ${boxH}`; // Single shelf underline
            } else {
              bracketPath = `M ${boxW} 0 L ${boxW} ${boxH} L 0 ${boxH}`; // Right wall + bottom shelf
            }
          } else {
            // Angle 135° -> 90° (pure vertical down): on Top edge, moving from right corner (boxW) to midpoint (boxW/2)
            const t = (relAngle - 45) / 45;
            cx = boxW - t * (boxW / 2);
            cy = 0;
            connectEdge = 'top';
            textAlign = (cx < boxW * 0.65) ? 'center' : 'right';
            textAnchorType = (cx < boxW * 0.65) ? 'middle' : 'end';
            bracketPath = `M ${boxW} ${boxH} L ${boxW} 0 L 0 0`; // Top shelf + right wall
          }
        } else {
          // Heading Up-Left (-180° to -90°)
          const relAngle = 180 - (-angleDeg);
          if (relAngle < 45) {
            // Angle -180° (pure horizontal) -> -135°: on Right edge, moving from midpoint (boxH/2) to top corner (0)
            const t = relAngle / 45;
            cx = boxW;
            cy = (boxH / 2) - t * (boxH / 2);
            connectEdge = 'right';
            textAlign = 'right';
            textAnchorType = 'end';

            if (isDirectHorizontal) {
              bracketPath = `M 0 ${boxH} L ${boxW} ${boxH}`; // Single shelf underline
            } else {
              bracketPath = `M ${boxW} ${boxH} L ${boxW} 0 L 0 0`; // Right wall + top shelf
            }
          } else {
            // Angle -135° -> -90° (pure vertical up): on Bottom edge, moving from right corner (boxW) to midpoint (boxW/2)
            const t = (relAngle - 45) / 45;
            cx = boxW - t * (boxW / 2);
            cy = boxH;
            connectEdge = 'bottom';
            textAlign = (cx < boxW * 0.65) ? 'center' : 'right';
            textAnchorType = (cx < boxW * 0.65) ? 'middle' : 'end';
            bracketPath = `M ${boxW} 0 L ${boxW} ${boxH} L 0 ${boxH}`; // Bottom shelf + right wall
          }
        }
      }

      // Top-left origin of the box
      const posX = Math.round(anchorPt[0] - cx);
      const posY = Math.round(anchorPt[1] - cy);

      return {
        connectEdge,
        posX,
        posY,
        boxW,
        boxH,
        cx,
        cy,
        textAnchorType,
        textAlign,
        isDirectHorizontal,
        bracketPath,
        uX,
        uY
      };
    }
  measureTextBounds(text, fontSize = 20, fontFamily = "'Architects Daughter', cursive, sans-serif") {
      if (!this._measureCanvas) {
        this._measureCanvas = document.createElement('canvas');
        this._measureCtx = this._measureCanvas.getContext('2d');
      }
      const ctx = this._measureCtx;
      ctx.font = `bold ${fontSize}px ${fontFamily}`;

      const rawStr = String(text || '').trim();
      if (!rawStr) {
        return { lines: [''], maxW: 60, totalH: Math.round(fontSize * 1.25) };
      }

      // Dynamic column wrap: long text wraps at 240px, short text fits naturally
      const targetColW = 240;
      const paragraphs = rawStr.split('\n');
      const lines = [];

      paragraphs.forEach(p => {
        const trimmed = p.trim();
        if (!trimmed) {
          lines.push('');
          return;
        }
        const words = trimmed.split(/\s+/);
        let curLine = '';

        words.forEach(w => {
          const testLine = curLine ? `${curLine} ${w}` : w;
          const testW = ctx.measureText(testLine).width;
          if (testW > targetColW && curLine) {
            lines.push(curLine);
            curLine = w;
          } else {
            curLine = testLine;
          }
        });
        if (curLine) lines.push(curLine);
      });

      let maxW = 0;
      lines.forEach(l => {
        const w = Math.ceil(ctx.measureText(l).width);
        if (w > maxW) maxW = w;
      });

      const lineHeight = Math.round(fontSize * 1.25);
      const totalH = Math.max(lineHeight, lines.length * lineHeight);

      return { lines, maxW, totalH, lineHeight };
    }
}

globalThis.QuoraTextManager = QuoraTextManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraTextManager;