class QuoraTextManager {
  constructor(component) {
    this.component = component;
  }

  renderCurveAttachedTextSvg(ann, textBadgesLayer, stageState) {
      const beziers = ann.beziers;
      if (!beziers || beziers.length === 0) return;

      const isActiveCurve = (ann === this.component.getActiveCurve());
      const hasText = Boolean(ann.text && ann.text.trim() !== '');

      if (!hasText && !isActiveCurve) return;

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

      const bounds = this.measureTextBounds(ann.text || '', fontS, fontF);
      const padX = ann.boxStyle !== 'none' ? 8 : 4;
      const padY = ann.boxStyle !== 'none' ? 4 : 2;

      const boxW = bounds.maxW + padX * 2;
      const boxH = bounds.totalH + padY * 2;

      const effectiveEdge = ann.manualEdge ? ann.connectEdge : null;
      const placement = this.computeTextPlacement(anchorPt, exitVec, boxW, boxH, effectiveEdge);
      ann.connectEdge = placement.connectEdge;

      const { posX, posY, textAnchorType, dBracket } = placement;
      const col = ann.color || '#00e676';
      const isNeon = (ann.lineStyle === 'neon');
      const coreTint = isNeon ? this.component.strokeManager.getLuminousCoreColor(col) : col;

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
            this.promptInlineTailText(ann, anchorPt, ghostPlacement.connectEdge);
          }
        });

        ghostG.addEventListener('mouseenter', () => { ghostG.style.opacity = '0.95'; });
        ghostG.addEventListener('mouseleave', () => { ghostG.style.opacity = '0.45'; });

        if (ghostPlacement.dBracket) {
          ghostG.appendChild(makeElement('svg:path', {
            d: ghostPlacement.dBracket,
            fill: 'none', stroke: col, 'stroke-width': '1.6', 'stroke-dasharray': '3,3',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round'
          }));
        }

        const textX = ghostPlacement.textAnchorType === 'end'
          ? (ghostPlacement.posX + ghostW - 6)
          : (ghostPlacement.textAnchorType === 'middle' ? (ghostPlacement.posX + ghostW / 2) : (ghostPlacement.posX + 6));

        ghostG.appendChild(makeElement('svg:text', {
          x: textX, y: ghostPlacement.posY + 18, fill: col,
          'font-family': fontF, 'font-size': '13px', 'font-style': 'italic', 'font-weight': 'bold',
          'text-anchor': ghostPlacement.textAnchorType
        }, '✎ Type note...'));

        textBadgesLayer.appendChild(ghostG);
        ann._textElements = { ghost: ghostG };
        return;
      }

      let textAnchorX = posX + padX;
      if (textAnchorType === 'end') {
        textAnchorX = posX + boxW - padX;
      } else if (textAnchorType === 'middle') {
        textAnchorX = posX + boxW / 2;
      }

      const textElementsMap = {};

      // 1. Shadow Layer: Classic drop shadow
      if (!isNeon) {
        const shadowG = makeElement('svg:g', {
          transform: 'translate(2, 2)',
          style: { pointerEvents: 'none' }
        });

        if ((ann.boxStyle === 'bracket' || !ann.boxStyle) && dBracket) {
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

      // 2. Glow Layer: Neon Gaussian bloom
      if (isNeon) {
        const glowG = makeElement('svg:g', {
          style: { pointerEvents: 'none', opacity: '0.92' }
        });

        if ((ann.boxStyle === 'bracket' || !ann.boxStyle) && dBracket) {
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

      // 3. Foreground Layer: Callout frame and text
      const g = makeElement('svg:g', {
        className: 'qa-curve-attached-label',
        style: { cursor: 'move', userSelect: 'none', transition: 'opacity 0.15s ease' },
        title: 'Double-click to edit text • Drag to reposition callout and curve tail',
        ondblclick: (e) => {
          e.stopPropagation();
          this.promptInlineTailText(ann, anchorPt, placement.connectEdge);
        }
      });

      g.appendChild(makeElement('svg:rect', {
        x: posX, y: posY, width: boxW, height: boxH, rx: '4',
        fill: isNeon ? 'rgba(9, 13, 22, 0.88)' : 'rgba(9, 13, 22, 0.72)', stroke: 'none',
        style: { pointerEvents: 'none' }
      }));

      if ((ann.boxStyle === 'bracket' || !ann.boxStyle) && dBracket) {
        g.appendChild(makeElement('svg:path', {
          d: dBracket, fill: 'none', stroke: isNeon ? coreTint : col,
          'stroke-width': '2.4',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          style: isNeon ? { filter: 'url(#qa-neon-core)' } : {}
        }));
      }

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

      // Dynamic drag synchronizer
      let isDraggingBadge = false;
      let startMouseX = 0, startMouseY = 0;

      g.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        isDraggingBadge = true;

        this.component.selectItem(ann);
        this.component._activeKnotIdx = isAtTail ? (ann.vertices.length - 1) : 0;

        // Remove any static tangent ray at the old position immediately
        const staleRay = document.getElementById('qa-outbound-tangent-ray');
        if (staleRay) staleRay.remove();

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
          targetKnot.isExplicitTangent = false;
          targetKnot.tangentAngleOffset = 0;

          // Ensure no stray ray sits frozen in space
          const ray = document.getElementById('qa-outbound-tangent-ray');
          if (ray) ray.remove();

          this.component.commitCurveGeometryUpdate();
        };

        const onBadgeDragUp = () => {
          isDraggingBadge = false;
          window.removeEventListener('mousemove', onBadgeDragMove);
          window.removeEventListener('mouseup', onBadgeDragUp);

          this.component.commitCurveGeometryUpdate();
          this.component.exposeBezierHandles(ann);
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
          if (placement.showLeft) textarea.style.borderLeft = `2px solid ${color}`;
          if (placement.showRight) textarea.style.borderRight = `2px solid ${color}`;
          if (placement.showTop) textarea.style.borderTop = `2px solid ${color}`;
          if (placement.showBottom) textarea.style.borderBottom = `2px solid ${color}`;
        }
      };
      applyFrameStyles();

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
        title: 'Cycle Frame: Bracket -> Rounded Box -> Pill -> Plain',
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
        edgeCycleBtn, styleBtn, okBtn
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
      const ax = anchorPt[0];
      const ay = anchorPt[1];

      let rawLen = Math.hypot(exitVec[0], exitVec[1]) || 1;
      let vx = exitVec[0] / rawLen;
      let vy = exitVec[1] / rawLen;

      if (Math.abs(vx) < 1e-4 && Math.abs(vy) < 1e-4) {
        vx = 1;
        vy = 0;
      }

      // Arrival angle in degrees: 0° is pure right, +90° is pure down (+y), -90° is pure up (-y), ±180° is pure left (-x)
      const angleDeg = Math.atan2(vy, vx) * (180 / Math.PI);

      let showLeft = false;
      let showRight = false;
      let showTop = false;
      let showBottom = false;

      let cx = 0;
      let cy = 0;

      if (forcedEdge && forcedEdge !== 'auto') {
        if (forcedEdge === 'left') {
          showLeft = true;
          cx = 0;
          cy = Math.round(boxH / 2);
        } else if (forcedEdge === 'right') {
          showRight = true;
          cx = boxW;
          cy = Math.round(boxH / 2);
        } else if (forcedEdge === 'top') {
          showTop = true;
          cx = Math.round(boxW / 2);
          cy = 0;
        } else if (forcedEdge === 'bottom') {
          showBottom = true;
          cx = Math.round(boxW / 2);
          cy = boxH;
        }
      } else {
        // Continuous 360° mapping across the 4 quadrants
        if (angleDeg >= 0 && angleDeg < 90) {
          // Sector 1: Down-Right (0° to 90°)
          if (angleDeg <= 30) {
            // Within 30° of horizontal: ONLY Left vertical edge
            showLeft = true;
            const t = angleDeg / 45;
            cx = 0;
            cy = Math.round((boxH / 2) * (1 - t));
          } else if (angleDeg < 60) {
            // Corner zone (30° to 60°): Left + Top meeting at (0, 0)
            showLeft = true;
            showTop = true;
            if (angleDeg <= 45) {
              const t = angleDeg / 45;
              cx = 0;
              cy = Math.round((boxH / 2) * (1 - t));
            } else {
              const s = (angleDeg - 45) / 45;
              cx = Math.round(s * (boxW / 2));
              cy = 0;
            }
          } else {
            // Within 30° of vertical: ONLY Top horizontal edge
            showTop = true;
            const s = (angleDeg - 45) / 45;
            cx = Math.round(s * (boxW / 2));
            cy = 0;
          }
        } else if (angleDeg >= 90 && angleDeg <= 180) {
          // Sector 2: Down-Left (90° to 180°)
          const gamma = 180 - angleDeg;
          if (gamma <= 30) {
            // Within 30° of horizontal: ONLY Right vertical edge
            showRight = true;
            const t = gamma / 45;
            cx = boxW;
            cy = Math.round((boxH / 2) * (1 - t));
          } else if (gamma < 60) {
            // Corner zone (120° to 150°): Right + Top meeting at (boxW, 0)
            showRight = true;
            showTop = true;
            if (gamma <= 45) {
              const t = gamma / 45;
              cx = boxW;
              cy = Math.round((boxH / 2) * (1 - t));
            } else {
              const s = (gamma - 45) / 45;
              cx = Math.round(boxW - s * (boxW / 2));
              cy = 0;
            }
          } else {
            // Within 30° of vertical: ONLY Top horizontal edge
            showTop = true;
            const s = (gamma - 45) / 45;
            cx = Math.round(boxW - s * (boxW / 2));
            cy = 0;
          }
        } else if (angleDeg < 0 && angleDeg >= -90) {
          // Sector 3: Up-Right (-90° to 0°)
          const beta = -angleDeg;
          if (beta <= 30) {
            // Within 30° of horizontal: ONLY Left vertical edge
            showLeft = true;
            const t = beta / 45;
            cx = 0;
            cy = Math.round((boxH / 2) * (1 + t));
          } else if (beta < 60) {
            // Corner zone (-30° to -60°): Left + Bottom meeting at (0, boxH)
            showLeft = true;
            showBottom = true;
            if (beta <= 45) {
              const t = beta / 45;
              cx = 0;
              cy = Math.round((boxH / 2) * (1 + t));
            } else {
              const s = (beta - 45) / 45;
              cx = Math.round(s * (boxW / 2));
              cy = boxH;
            }
          } else {
            // Within 30° of vertical: ONLY Bottom horizontal edge
            showBottom = true;
            const s = (beta - 45) / 45;
            cx = Math.round(s * (boxW / 2));
            cy = boxH;
          }
        } else {
          // Sector 4: Up-Left (-180° to -90°)
          const delta = 180 + angleDeg;
          if (delta <= 30) {
            // Within 30° of horizontal: ONLY Right vertical edge
            showRight = true;
            const t = delta / 45;
            cx = boxW;
            cy = Math.round((boxH / 2) * (1 + t));
          } else if (delta < 60) {
            // Corner zone (-120° to -150°): Right + Bottom meeting at (boxW, boxH)
            showRight = true;
            showBottom = true;
            if (delta <= 45) {
              const t = delta / 45;
              cx = boxW;
              cy = Math.round((boxH / 2) * (1 + t));
            } else {
              const s = (delta - 45) / 45;
              cx = Math.round(boxW - s * (boxW / 2));
              cy = boxH;
            }
          } else {
            // Within 30° of vertical: ONLY Bottom horizontal edge
            showBottom = true;
            const s = (delta - 45) / 45;
            cx = Math.round(boxW - s * (boxW / 2));
            cy = boxH;
          }
        }
      }

      const posX = Math.round(ax - cx);
      const posY = Math.round(ay - cy);

      let textAnchorType = 'start';
      let textAlign = 'left';
      if (showRight && !showLeft) {
        textAnchorType = 'end';
        textAlign = 'right';
      } else if (!showLeft && !showRight) {
        textAnchorType = 'middle';
        textAlign = 'center';
      }

      let connectEdge = 'left';
      if (showLeft && showTop) connectEdge = 'left-top';
      else if (showLeft && showBottom) connectEdge = 'left-bottom';
      else if (showRight && showTop) connectEdge = 'right-top';
      else if (showRight && showBottom) connectEdge = 'right-bottom';
      else if (showLeft) connectEdge = 'left';
      else if (showRight) connectEdge = 'right';
      else if (showTop) connectEdge = 'top';
      else if (showBottom) connectEdge = 'bottom';

      // Construct contiguous SVG path: exactly 1 or 2 perpendicular edges, never 2 parallel edges
      let dBracket = '';
      if (showLeft && showTop) {
        dBracket = `M ${posX} ${posY + boxH} L ${posX} ${posY} L ${posX + boxW} ${posY}`;
      } else if (showLeft && showBottom) {
        dBracket = `M ${posX} ${posY} L ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH}`;
      } else if (showRight && showTop) {
        dBracket = `M ${posX} ${posY} L ${posX + boxW} ${posY} L ${posX + boxW} ${posY + boxH}`;
      } else if (showRight && showBottom) {
        dBracket = `M ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH} L ${posX + boxW} ${posY}`;
      } else if (showLeft) {
        dBracket = `M ${posX} ${posY} L ${posX} ${posY + boxH}`;
      } else if (showRight) {
        dBracket = `M ${posX + boxW} ${posY} L ${posX + boxW} ${posY + boxH}`;
      } else if (showTop) {
        dBracket = `M ${posX} ${posY} L ${posX + boxW} ${posY}`;
      } else if (showBottom) {
        dBracket = `M ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH}`;
      }

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
        dBracket,
        showLeft,
        showRight,
        showTop,
        showBottom,
        angleDeg
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