class QuoraTextManager {
  constructor(component) {
    this.component = component;
  }

  renderCurveAttachedTextSvg(ann, textBadgesLayer, stageState) {
      const beziers = ann.beziers;
      if (!beziers || beziers.length === 0) return;

      const isActiveCurve = (ann === this.component.getActiveCurve());
      const hasText = Boolean(ann.text && ann.text.trim() !== '');

      // Skip rendering if no text and not the actively selected curve
      if (!hasText && !isActiveCurve) return;

      const isAtTail = (ann.textEnd !== 'tip');
      const termSeg = isAtTail ? beziers[beziers.length - 1] : beziers[0];
      const anchorPt = isAtTail ? termSeg[3] : termSeg[0];

      const exitVec = isAtTail
        ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
        : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];

      const fontS = ann.fontSize || 22;
      const fontF = ann.fontFamily || "'Architects Daughter', cursive, sans-serif";
      const lineHeight = fontS * 1.25;

      const charW = fontS * (fontF.includes('mono') ? 0.60 : 0.54);
      const padX = ann.boxStyle !== 'none' ? 14 : 4;
      const padY = ann.boxStyle !== 'none' ? 8 : 4;

      const targetW = ann.boxWidth || 270;
      const maxChars = Math.max(12, Math.floor((targetW - padX * 2) / charW));
      const wrappedLines = this.wrapTextLines(ann.text || '', maxChars);

      let longestLineLen = 0;
      wrappedLines.forEach(l => { if (l.length > longestLineLen) longestLineLen = l.length; });

      const boxW = ann.boxWidth || (Math.round(longestLineLen * charW) + padX * 2 + 8);
      const boxH = Math.max(fontS + padY * 2, Math.round(wrappedLines.length * lineHeight) + padY * 2 + 4);

      const effectiveEdge = ann.manualEdge ? ann.connectEdge : null;
      const placement = this.computeTextPlacement(anchorPt, exitVec, boxW, boxH, effectiveEdge);
      ann.connectEdge = placement.connectEdge;

      const { posX, posY, connectEdge, textAnchorType, uX } = placement;
      const col = ann.color || '#00e676';

      // RENDER ARCHITECTURAL GHOST SHELF PLACEHOLDER IF ACTIVE CURVE HAS NO TEXT
      if (!hasText) {
        const ghostW = 165;
        const ghostH = 34;

        let gX = posX;
        let gY = posY;
        if (connectEdge === 'right') gX = anchorPt[0] - ghostW;
        else if (connectEdge === 'left') gX = anchorPt[0];
        else if (connectEdge === 'top') { gX = anchorPt[0] - ghostW / 2; gY = anchorPt[1]; }
        else if (connectEdge === 'bottom') { gX = anchorPt[0] - ghostW / 2; gY = anchorPt[1] - ghostH; }

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

        // Architectural dashed 2-sided bracket shelf
        let bD = '';
        if (connectEdge === 'left') {
          bD = `M ${gX + ghostW} ${gY + ghostH} L ${gX} ${gY + ghostH} L ${gX} ${gY + 8}`;
        } else if (connectEdge === 'right') {
          bD = `M ${gX} ${gY + ghostH} L ${gX + ghostW} ${gY + ghostH} L ${gX + ghostW} ${gY + 8}`;
        } else {
          bD = `M ${gX} ${gY + ghostH} L ${gX + ghostW} ${gY + ghostH} M ${gX} ${gY + 12} L ${gX} ${gY + ghostH}`;
        }

        ghostG.appendChild(makeElement('svg:path', {
          d: bD, fill: 'none', stroke: col, 'stroke-width': '1.8', 'stroke-dasharray': '4,3',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));

        const textX = connectEdge === 'right' ? (gX + ghostW - 12) : (gX + 12);
        const textAnchor = connectEdge === 'right' ? 'end' : 'start';

        ghostG.appendChild(makeElement('svg:text', {
          x: textX, y: gY + 23, fill: col,
          'font-family': fontF, 'font-size': '15px', 'font-style': 'italic', 'font-weight': 'bold',
          'text-anchor': textAnchor
        }, '✎ Type note...'));

        textBadgesLayer.appendChild(ghostG);
        return;
      }

      // RENDER SOLID ATTACHED TEXT BADGE
      const g = makeElement('svg:g', {
        className: 'qa-curve-attached-label',
        style: { cursor: 'move', userSelect: 'none', transition: 'opacity 0.15s ease' },
        title: 'Double-click to edit text • Drag to reposition callout and curve tail',
        ondblclick: (e) => {
          e.stopPropagation();
          this.promptInlineTailText(ann, anchorPt, connectEdge);
        }
      });

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
          g.style.transform = `translate(${dx}px, ${dy}px)`;
        };

        const onBadgeDragUp = () => {
          isDraggingBadge = false;
          g.style.transform = '';
          window.removeEventListener('mousemove', onBadgeDragMove);
          window.removeEventListener('mouseup', onBadgeDragUp);
          this.component.renderStage();
        };

        window.addEventListener('mousemove', onBadgeDragMove);
        window.addEventListener('mouseup', onBadgeDragUp);
      });

      // Framing Shapes
      if (ann.boxStyle === 'box') {
        g.appendChild(makeElement('svg:rect', {
          x: posX + 2, y: posY + 2, width: boxW, height: boxH, rx: '6',
          fill: 'rgba(10, 15, 25, 0.95)', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '4.5'
        }));
        g.appendChild(makeElement('svg:rect', {
          x: posX, y: posY, width: boxW, height: boxH, rx: '6',
          fill: 'rgba(15, 23, 42, 0.96)', stroke: col, 'stroke-width': '2.5'
        }));
      } else if (ann.boxStyle === 'bracket' || !ann.boxStyle) {
        g.appendChild(makeElement('svg:rect', {
          x: posX, y: posY, width: boxW, height: boxH, rx: '4',
          fill: 'rgba(9, 13, 22, 0.72)', stroke: 'none',
          style: { pointerEvents: 'none' }
        }));

        // 2-Sided Architectural Bracket
        let bD = '';
        if (connectEdge === 'left') {
          bD = `M ${posX + boxW} ${posY + boxH} L ${posX} ${posY + boxH} L ${posX} ${posY}`;
        } else if (connectEdge === 'right') {
          bD = `M ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH} L ${posX + boxW} ${posY}`;
        } else if (connectEdge === 'bottom') {
          bD = (uX >= 0)
            ? `M ${posX + boxW} ${posY + boxH} L ${posX} ${posY + boxH} L ${posX} ${posY}`
            : `M ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH} L ${posX + boxW} ${posY}`;
        } else if (connectEdge === 'top') {
          bD = (uX >= 0)
            ? `M ${posX + boxW} ${posY} L ${posX} ${posY} L ${posX} ${posY + boxH}`
            : `M ${posX} ${posY} L ${posX + boxW} ${posY} L ${posX + boxW} ${posY + boxH}`;
        }

        g.appendChild(makeElement('svg:path', {
          d: bD, transform: 'translate(2, 2)', fill: 'none',
          stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '4.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
        g.appendChild(makeElement('svg:path', {
          d: bD, fill: 'none', stroke: col, 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
      }

      let textAnchorX = posX + padX;
      if (connectEdge === 'right') {
        textAnchorX = posX + boxW - padX;
      } else if (connectEdge === 'top' || connectEdge === 'bottom') {
        textAnchorX = posX + boxW / 2;
      }

      const txt = makeElement('svg:text', {
        x: textAnchorX, y: posY + padY + fontS * 0.88, fill: col,
        'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
        'text-anchor': textAnchorType,
        style: { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.85))' }
      });

      wrappedLines.forEach((l, i) => {
        txt.appendChild(makeElement('svg:tspan', {
          x: textAnchorX, dy: i === 0 ? '0' : `${lineHeight}px`
        }, l));
      });
      g.appendChild(txt);

      textBadgesLayer.appendChild(g);
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

      const width = curveRecord?.boxWidth || 270;
      const estHeight = 44;

      const effectiveEdge = curveRecord?.manualEdge ? curveRecord.connectEdge : (forcedEdge || null);
      let placement = this.computeTextPlacement(anchorPt, exitVec, width, estHeight, effectiveEdge);
      let connectEdge = placement.connectEdge;

      let fontF = curveRecord?.fontFamily || this.component.stageState.fontFamily;
      let fontS = curveRecord?.fontSize || this.component.stageState.fontSize;
      let boxStyle = curveRecord?.boxStyle || 'bracket';
      let boxOpacity = curveRecord?.boxOpacity || 0.75;
      const color = curveRecord?.color || this.component.stageState.currentColor;

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

      const initialVal = (initialText !== undefined && initialText !== null && initialText !== '')
        ? initialText
        : (curveRecord?.text || '');

      const textarea = makeElement('textarea', {
        placeholder: 'Type callout text...',
        value: initialVal,
        rows: 1,
        style: {
          width: '100%', minHeight: '36px', maxHeight: '180px', padding: '8px 12px',
          fontSize: `${fontS}px`, fontFamily: fontF, fontWeight: 'bold', lineHeight: '1.25',
          color: color, background: `rgba(9, 13, 22, ${boxOpacity})`,
          border: boxStyle === 'box' ? `2px solid ${color}` : (boxStyle === 'pill' ? `2px solid ${color}` : 'none'),
          borderRadius: boxStyle === 'pill' ? '24px' : (boxStyle === 'box' ? '8px' : '0'),
          outline: 'none', resize: 'none',
          overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxSizing: 'border-box', textAlign: placement.textAlign,
          boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
          scrollbarWidth: 'none', msOverflowStyle: 'none'
        }
      });

      const applyFrameStyles = () => {
        textarea.style.border = 'none';
        textarea.style.borderRadius = boxStyle === 'pill' ? '24px' : (boxStyle === 'box' ? '8px' : '0');
        textarea.style.background = `rgba(9, 13, 22, ${boxOpacity})`;

        if (boxStyle === 'box' || boxStyle === 'pill') {
          textarea.style.border = `2px solid ${color}`;
        } else if (boxStyle === 'bracket') {
          if (connectEdge === 'left') {
            textarea.style.borderLeft = `2.5px solid ${color}`;
            textarea.style.borderBottom = `2.5px solid ${color}`;
          } else if (connectEdge === 'right') {
            textarea.style.borderRight = `2.5px solid ${color}`;
            textarea.style.borderBottom = `2.5px solid ${color}`;
          } else if (connectEdge === 'bottom') {
            textarea.style.borderBottom = `2.5px solid ${color}`;
            textarea.style.borderLeft = `2.5px solid ${color}`;
          } else if (connectEdge === 'top') {
            textarea.style.borderTop = `2.5px solid ${color}`;
            textarea.style.borderLeft = `2.5px solid ${color}`;
          }
        }
      };
      applyFrameStyles();

      // Floating Controls Deck positioned comfortably 28px away
      const controlsDock = makeElement('div', {
        id: 'qa-callout-editor-dock',
        style: {
          position: 'absolute',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(11, 17, 32, 0.98)',
          border: '1.5px solid rgba(0, 242, 254, 0.5)',
          borderRadius: '24px',
          padding: '5px 14px',
          fontSize: '10.5px',
          boxShadow: '0 14px 36px rgba(0, 0, 0, 0.9), 0 0 16px rgba(0, 242, 254, 0.25)',
          zIndex: '85',
          backdropFilter: 'blur(14px)',
          userSelect: 'none'
        }
      });

      const updateDockPosition = () => {
        const curH = textarea.offsetHeight || estHeight;
        placement = this.computeTextPlacement(anchorPt, exitVec, width, curH, connectEdge);
        editorWrap.style.left = `${placement.posX}px`;
        editorWrap.style.top = `${placement.posY}px`;

        const floatAbove = (placement.posY > 64);
        const dockTop = floatAbove ? (placement.posY - 44) : (placement.posY + curH + 28);
        controlsDock.style.top = `${dockTop}px`;
        controlsDock.style.left = `${placement.posX}px`;
      };

      const autoGrow = () => {
        textarea.style.height = 'auto';
        const curH = Math.max(36, textarea.scrollHeight);
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
          styleBtn.textContent = boxStyle === 'bracket' ? '◺ 2-Side' : (boxStyle === 'box' ? '◻ Box' : (boxStyle === 'pill' ? '💊 Pill' : 'Plain'));
          applyFrameStyles();
          if (curveRecord) this.component.renderStage();
        }
      }, boxStyle === 'bracket' ? '◺ 2-Side' : (boxStyle === 'box' ? '◻ Box' : (boxStyle === 'pill' ? '💊 Pill' : 'Plain')));

      const lineStyleBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '2px 6px', fontSize: '10px', color: '#ffd700', borderColor: 'rgba(255, 215, 0, 0.45)' },
        title: 'Toggle Line Style: Classic Shadow ➔ Lightsaber Glow ➔ Neon Halo',
        onclick: (e) => {
          e.stopPropagation();
          const styles = ['classic', 'lightsaber', 'neon'];
          const curStyle = curveRecord?.lineStyle || this.component.stageState.lineStyle || 'classic';
          const nextStyle = styles[(styles.indexOf(curStyle) + 1) % styles.length];
          if (curveRecord) curveRecord.lineStyle = nextStyle;
          this.component.stageState.lineStyle = nextStyle;
          lineStyleBtn.textContent = nextStyle === 'lightsaber' ? '⚔️ Lightsaber' : (nextStyle === 'neon' ? '💡 Neon' : '🖋️ Classic');
          this.component.commitCurveGeometryUpdate();
        }
      }, (curveRecord?.lineStyle === 'lightsaber') ? '⚔️ Lightsaber' : ((curveRecord?.lineStyle === 'neon') ? '💡 Neon' : '🖋️ Classic'));

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
        makeElement('span', { style: { color: '#00f2fe', fontWeight: 'bold', fontSize: '11px', marginRight: '2px' } }, '✎ Callout Edit:'),
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
      const fontS = ann.fontSize || 22;
      const fontF = ann.fontFamily || "'Architects Daughter', cursive, sans-serif";
      const lineHeight = fontS * 1.25;
      const charW = fontS * (fontF.includes('mono') ? 0.60 : 0.54);

      const padX = ann.boxStyle !== 'none' ? 12 : 4;
      const padY = ann.boxStyle !== 'none' ? 8 : 4;

      const targetW = ann.boxWidth || 260;
      const maxChars = Math.max(12, Math.floor((targetW - padX * 2) / charW));
      const wrappedLines = this.wrapTextLines(ann.text || '', maxChars);

      let longestLineLen = 0;
      wrappedLines.forEach(l => { if (l.length > longestLineLen) longestLineLen = l.length; });

      const boxW = ann.boxWidth || (Math.round(longestLineLen * charW) + padX * 2);
      const boxH = Math.max(fontS + padY * 2, Math.round(wrappedLines.length * lineHeight) + padY * 2);

      const col = ann.color || '#00e676';

      const g = makeElement('svg:g', {
        id: `badge-${ann.id}`,
        className: 'qa-movable-text-badge',
        style: { cursor: 'move', userSelect: 'none' },
        ondblclick: (e) => {
          e.stopPropagation();
          this.promptInlineTailText(ann, [ann.x, ann.y], 'left');
        }
      });

      if (ann.boxStyle === 'box') {
        g.appendChild(makeElement('svg:rect', {
          x: ann.x + 2, y: ann.y + 2, width: boxW, height: boxH, rx: '6',
          fill: 'rgba(10, 15, 25, 0.95)', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '4.5'
        }));
        g.appendChild(makeElement('svg:rect', {
          x: ann.x, y: ann.y, width: boxW, height: boxH, rx: '6',
          fill: 'rgba(15, 23, 42, 0.96)', stroke: col, 'stroke-width': '2.5'
        }));
      } else if (ann.boxStyle === 'bracket' || !ann.boxStyle) {
        const bD = `M ${ann.x} ${ann.y} L ${ann.x} ${ann.y + boxH} L ${ann.x + boxW} ${ann.y + boxH}`;
        g.appendChild(makeElement('svg:path', {
          d: bD, transform: 'translate(2, 2)', fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': '5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
        g.appendChild(makeElement('svg:path', {
          d: bD, fill: 'none', stroke: col, 'stroke-width': '2.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
      }

      const txt = makeElement('svg:text', {
        x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: col,
        'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold'
      });

      wrappedLines.forEach((l, i) => {
        txt.appendChild(makeElement('svg:tspan', {
          x: ann.x + padX, dy: i === 0 ? '0' : `${lineHeight}px`
        }, l));
      });
      g.appendChild(txt);

      // Smooth transform-based dragging without innerHTML teardown during movement
      let isDrag = false;
      let sX = 0, sY = 0;
      let initialX = ann.x, initialY = ann.y;

      g.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
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
          g.style.transform = `translate(${dx}px, ${dy}px)`;
        };

        const onU = () => {
          isDrag = false;
          g.style.transform = '';
          window.removeEventListener('mousemove', onM);
          window.removeEventListener('mouseup', onU);
          this.component.renderStage();
        };

        window.addEventListener('mousemove', onM);
        window.addEventListener('mouseup', onU);
      });

      textBadgesLayer.appendChild(g);
    }
  computeTextPlacement(anchorPt, exitVec, boxW, boxH, forcedEdge = null) {
      const rawLen = Math.hypot(exitVec[0], exitVec[1]) || 1;
      const uX = exitVec[0] / rawLen;
      const uY = exitVec[1] / rawLen;

      const absX = Math.abs(uX);
      const absY = Math.abs(uY);

      // Determine which edge of the text box receives the curve:
      // • If line goes right -> text is placed to the right -> connects to LEFT edge of box
      // • If line goes left  -> text is placed to the left  -> connects to RIGHT edge of box
      // • If line goes up    -> text is placed above        -> connects to BOTTOM edge of box
      // • If line goes down  -> text is placed below        -> connects to TOP edge of box
      let connectEdge = forcedEdge;
      if (!connectEdge || connectEdge === 'auto') {
        if (absX >= absY) {
          connectEdge = (uX >= 0) ? 'left' : 'right';
        } else {
          connectEdge = (uY <= 0) ? 'bottom' : 'top';
        }
      }

      let posX = anchorPt[0];
      let posY = anchorPt[1];
      let textAnchorType = 'start';
      let textAlign = 'left';

      switch (connectEdge) {
        case 'left':
          // Curve heads RIGHT into the left side of text box
          posX = Math.round(anchorPt[0]);
          posY = Math.round(anchorPt[1] - boxH / 2);
          textAnchorType = 'start';
          textAlign = 'left';
          break;

        case 'right':
          // Curve heads LEFT into the right side of text box
          posX = Math.round(anchorPt[0] - boxW);
          posY = Math.round(anchorPt[1] - boxH / 2);
          textAnchorType = 'end';
          textAlign = 'right';
          break;

        case 'bottom':
          // Curve heads UP into the bottom edge of text box
          posX = Math.round(anchorPt[0] - boxW / 2);
          posY = Math.round(anchorPt[1] - boxH);
          textAnchorType = 'middle';
          textAlign = 'center';
          break;

        case 'top':
          // Curve heads DOWN into the top edge of text box
          posX = Math.round(anchorPt[0] - boxW / 2);
          posY = Math.round(anchorPt[1]);
          textAnchorType = 'middle';
          textAlign = 'center';
          break;
      }

      return {
        connectEdge,
        posX,
        posY,
        boxW,
        boxH,
        textAnchorType,
        textAlign,
        uX,
        uY
      };
  }
}

globalThis.QuoraTextManager = QuoraTextManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraTextManager;