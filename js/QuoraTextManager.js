class QuoraTextManager {
  constructor(component) {
    this.component = component;
  }

  renderCurveAttachedTextSvg(ann, textBadgesLayer, stageState) {
        const beziers = ann.beziers;
        if (!beziers || beziers.length === 0) return;

        if (ann._textElements) {
          Object.values(ann._textElements).forEach(el => { if (el && el.remove) el.remove(); });
          ann._textElements = null;
        }

        const isSelectedCurve = (ann === stageState.selectedItem);
        const hasText = Boolean(ann.text && ann.text.trim() !== '');
        const isEditing = Boolean(ann._isEditingText);

        if (!hasText && !isSelectedCurve && !isEditing) return;

        const isAtTail = (ann.textEnd !== 'tip');
        const termSeg = isAtTail ? beziers[beziers.length - 1] : beziers[0];
        const anchorPt = isAtTail ? termSeg[3] : termSeg[0];
        const exitVec = isAtTail
          ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
          : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];

        const p = stageState.prefs || {};
        const fontS = ann.fontSize || stageState.fontSize || p.fontSize || 20;
        const fontF = ann.fontFamily || stageState.fontFamily || p.fontFamily || "'Architects Daughter', cursive, sans-serif";
        const boxStyle = ann.boxStyle || stageState.boxStyle || p.boxStyle || 'bracket';
        const col = ann.color || '#00e676';
        const isNeon = (ann.lineStyle === 'neon');
        const coreTint = isNeon ? this.component.strokeManager.getLuminousCoreColor(col) : col;
        const manualCardinal = (ann.manualEdge && ['left', 'right', 'top', 'bottom'].includes(ann.connectEdge)) ? ann.connectEdge : null;

        if (!hasText && !isEditing) {
          const ghostSize = Math.min(14, Math.max(11, Math.round(fontS * 0.65)));
          const ghostBounds = this.measureTextBounds('Note…', ghostSize, fontF);
          const ghostW = Math.max(64, ghostBounds.maxW + 16);
          const ghostH = Math.max(24, ghostBounds.lineHeight + 8);
          const ghostPlacement = this.computeTextPlacement(anchorPt, exitVec, ghostW, ghostH, manualCardinal);

          const ghostG = makeElement('svg:g', {
            className: 'qa-curve-attached-label qa-ghost-text-placeholder',
            style: { cursor: 'text', userSelect: 'none', opacity: '0.68', transition: 'opacity 0.15s ease' },
            title: 'Click to type note • Drag to move curve end'
          });

          ghostG.addEventListener('mouseenter', () => { ghostG.style.opacity = '1'; });
          ghostG.addEventListener('mouseleave', () => { ghostG.style.opacity = '0.68'; });

          ghostG.appendChild(makeElement('svg:rect', {
            x: ghostPlacement.posX, y: ghostPlacement.posY, width: ghostW, height: ghostH, rx: '5',
            fill: 'rgba(248, 250, 252, 0.07)', stroke: 'rgba(255, 255, 255, 0.22)',
            'stroke-width': '1', 'stroke-dasharray': '3,2'
          }));

          if (ghostPlacement.dBracket) {
            ghostG.appendChild(makeElement('svg:path', {
              d: ghostPlacement.dBracket, fill: 'none', stroke: col, 'stroke-width': '1.6',
              'stroke-opacity': '0.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            }));
          }

          const gx = ghostPlacement.textAnchorType === 'end'
            ? (ghostPlacement.posX + ghostW - 8)
            : (ghostPlacement.textAnchorType === 'middle' ? (ghostPlacement.posX + ghostW / 2) : (ghostPlacement.posX + 8));

          ghostG.appendChild(makeElement('svg:text', {
            x: gx, y: ghostPlacement.posY + 4 + ghostSize * 0.88, fill: 'rgba(248, 250, 252, 0.58)',
            'font-family': fontF, 'font-size': `${ghostSize}px`, 'font-style': 'italic', 'font-weight': '600',
            'text-anchor': ghostPlacement.textAnchorType
          }, 'Note…'));

          let draggingGhost = false;
          let didDragGhost = false;
          let gStartX = 0, gStartY = 0;

          ghostG.addEventListener('mousedown', (e) => {
            if (e.button === 2) return;
            e.preventDefault();
            e.stopPropagation();
            draggingGhost = true;
            didDragGhost = false;
            gStartX = e.clientX;
            gStartY = e.clientY;
            const targetKnot = isAtTail ? ann.vertices[ann.vertices.length - 1] : ann.vertices[0];
            const origX = targetKnot.point[0];
            const origY = targetKnot.point[1];

            const onMove = (ev) => {
              if (!draggingGhost) return;
              if (Math.hypot(ev.clientX - gStartX, ev.clientY - gStartY) > 4) {
                didDragGhost = true;
                window.getSelection()?.removeAllRanges();
                const z = stageState.zoom || 1.0;
                targetKnot.point[0] = Math.round(origX + (ev.clientX - gStartX) / z);
                targetKnot.point[1] = Math.round(origY + (ev.clientY - gStartY) / z);
                targetKnot.isExplicitTangent = false;
                targetKnot.tangentAngleOffset = 0;
                this.component.commitCurveGeometryUpdate();
              }
            };

            const onUp = () => {
              draggingGhost = false;
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              if (!didDragGhost) this.promptInlineTailText(ann, anchorPt, manualCardinal);
              else {
                this.component.commitCurveGeometryUpdate();
                this.component.exposeBezierHandles(ann);
              }
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          });

          textBadgesLayer.appendChild(ghostG);
          ann._textElements = { ghost: ghostG };
          return;
        }

        const bounds = this.measureTextBounds(ann.text || '', fontS, fontF);
        const padX = boxStyle !== 'none' ? 8 : 4;
        const padY = boxStyle !== 'none' ? 4 : 2;
        const boxW = (isEditing && ann._liveEditSize) ? ann._liveEditSize.width : (bounds.maxW + padX * 2);
        const boxH = (isEditing && ann._liveEditSize) ? ann._liveEditSize.height : (bounds.totalH + padY * 2);

        const placement = this.computeTextPlacement(anchorPt, exitVec, boxW, boxH, manualCardinal);
        ann.connectEdge = placement.connectEdge;

        const { posX, posY, textAnchorType, dBracket } = placement;
        let textAnchorX = posX + padX;
        if (textAnchorType === 'end') textAnchorX = posX + boxW - padX;
        else if (textAnchorType === 'middle') textAnchorX = posX + boxW / 2;

        const showBackdrop = Boolean(p.textBoxBgEnabled && (p.textBoxBgOpacity === undefined || p.textBoxBgOpacity > 0.02));
        const bgColor = p.textBoxBgColor || '#090d16';
        const bgOpacity = p.textBoxBgOpacity !== undefined ? p.textBoxBgOpacity : 0.55;
        const bgBlur = p.textBoxBgBlur !== undefined ? p.textBoxBgBlur : 4.0;
        const borderW = p.borderStrokeWidth || 2.4;

        const glowMode = p.textGlowMode || 'match';
        const useNeonText = (glowMode === 'neon') || (glowMode === 'match' && isNeon);
        const useShadowText = (glowMode === 'shadow') || (glowMode === 'match' && !isNeon);
        const useHalo = Boolean((p.textReadabilityHalo === true) || glowMode === 'halo');
        const glowSpread = p.textGlowSpread !== undefined ? p.textGlowSpread : 3.5;
        const glowOpacity = p.textGlowOpacity !== undefined ? p.textGlowOpacity : 0.92;
        const textFill = useNeonText ? coreTint : col;
        const curveGlowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10.0;

        const textElementsMap = {};

        if (useShadowText) {
          const shadowG = makeElement('svg:g', { transform: 'translate(2, 2)', style: { pointerEvents: 'none' } });
          if (boxStyle === 'bracket' && dBracket) {
            shadowG.appendChild(makeElement('svg:path', {
              d: dBracket, fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)',
              'stroke-width': String(borderW + 2.0), 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            }));
          } else if (boxStyle === 'box' || boxStyle === 'pill') {
            shadowG.appendChild(makeElement('svg:rect', {
              x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
              fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(borderW + 2.0)
            }));
          }
          if (!isEditing) {
            const txtShadow = makeElement('svg:text', {
              x: textAnchorX, y: posY + padY + fontS * 0.88, fill: 'rgba(10, 15, 25, 0.92)',
              'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold', 'text-anchor': textAnchorType
            });
            bounds.lines.forEach((l, i) => {
              txtShadow.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
            });
            shadowG.appendChild(txtShadow);
          }
          this.component.shadowLayer.appendChild(shadowG);
          textElementsMap.shadow = shadowG;
        }

        if (useNeonText) {
          const glowG = makeElement('svg:g', { style: { pointerEvents: 'none', opacity: String(glowOpacity) } });
          if (boxStyle === 'bracket' && dBracket) {
            glowG.appendChild(makeElement('svg:path', {
              d: dBracket, fill: 'none', stroke: col, 'stroke-width': String(borderW + curveGlowPad),
              'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: { filter: 'url(#qa-neon-glow)' }
            }));
          } else if (boxStyle === 'box' || boxStyle === 'pill') {
            glowG.appendChild(makeElement('svg:rect', {
              x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
              fill: 'none', stroke: col, 'stroke-width': String(borderW + curveGlowPad), style: { filter: 'url(#qa-neon-glow)' }
            }));
          }
          if (!isEditing) {
            const txtGlow = makeElement('svg:text', {
              x: textAnchorX, y: posY + padY + fontS * 0.88, fill: col,
              stroke: glowSpread > 0 ? col : 'none', 'stroke-width': String(glowSpread), 'stroke-linejoin': 'round',
              'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold', 'text-anchor': textAnchorType,
              style: { filter: 'url(#qa-text-glow)' }
            });
            bounds.lines.forEach((l, i) => {
              txtGlow.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
            });
            glowG.appendChild(txtGlow);
          }
          this.component.glowLayer.appendChild(glowG);
          textElementsMap.glow = glowG;
        }

        const g = makeElement('svg:g', {
          className: 'qa-curve-attached-label',
          style: { cursor: 'move', userSelect: 'none' },
          title: 'Click to edit text • Drag to reposition'
        });

        if (showBackdrop) {
          g.appendChild(makeElement('svg:rect', {
            x: posX - 3, y: posY - 2, width: boxW + 6, height: boxH + 4, rx: boxStyle === 'pill' ? '20' : '8',
            fill: bgColor, 'fill-opacity': String(bgOpacity), stroke: 'none',
            ...(bgBlur > 0 ? { style: { filter: 'url(#qa-text-bg-blur)', pointerEvents: 'none' } } : { style: { pointerEvents: 'none' } })
          }));
        }

        g.appendChild(makeElement('svg:rect', {
          x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
          fill: 'rgba(255, 255, 255, 0.001)', stroke: 'none'
        }));

        if (boxStyle === 'bracket' && dBracket) {
          g.appendChild(makeElement('svg:path', {
            d: dBracket, fill: 'none', stroke: textFill, 'stroke-width': String(borderW),
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            ...(useNeonText ? { style: { filter: 'url(#qa-neon-core)' } } : {})
          }));
        } else if (boxStyle === 'box' || boxStyle === 'pill') {
          g.appendChild(makeElement('svg:rect', {
            x: posX, y: posY, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
            fill: 'none', stroke: textFill, 'stroke-width': String(borderW),
            ...(useNeonText ? { style: { filter: 'url(#qa-neon-core)' } } : {})
          }));
        }

        if (!isEditing) {
          if (useHalo) {
            const txtHalo = makeElement('svg:text', {
              x: textAnchorX, y: posY + padY + fontS * 0.88,
              fill: 'rgba(7, 10, 19, 0.90)', stroke: 'rgba(7, 10, 19, 0.90)', 'stroke-width': '2.8',
              'stroke-linejoin': 'round', 'font-family': fontF, 'font-size': `${fontS}px`,
              'font-weight': 'bold', 'text-anchor': textAnchorType, style: { pointerEvents: 'none' }
            });
            bounds.lines.forEach((l, i) => {
              txtHalo.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
            });
            g.appendChild(txtHalo);
          }

          const txt = makeElement('svg:text', {
            x: textAnchorX, y: posY + padY + fontS * 0.88, fill: textFill,
            'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold', 'text-anchor': textAnchorType,
            ...(useNeonText ? { style: { filter: 'url(#qa-neon-core)' } } : {})
          });
          bounds.lines.forEach((l, i) => {
            txt.appendChild(makeElement('svg:tspan', { x: textAnchorX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
          });
          g.appendChild(txt);
        }

        let isDraggingBadge = false;
        let didDragBadge = false;
        let startMouseX = 0, startMouseY = 0;

        g.addEventListener('mousedown', (e) => {
          if (e.button === 2) return;
          e.preventDefault();
          e.stopPropagation();
          isDraggingBadge = true;
          didDragBadge = false;
          this.component.selectItem(ann);
          this.component._activeKnotIdx = isAtTail ? (ann.vertices.length - 1) : 0;

          const staleRay = document.getElementById('qa-outbound-tangent-ray');
          if (staleRay) staleRay.remove();

          startMouseX = e.clientX;
          startMouseY = e.clientY;
          const targetKnot = isAtTail ? ann.vertices[ann.vertices.length - 1] : ann.vertices[0];
          const origX = targetKnot.point[0];
          const origY = targetKnot.point[1];

          const onBadgeDragMove = (ev) => {
            if (!isDraggingBadge) return;
            if (Math.hypot(ev.clientX - startMouseX, ev.clientY - startMouseY) > 4) {
              didDragBadge = true;
              window.getSelection()?.removeAllRanges();
              const z = stageState.zoom || 1.0;
              targetKnot.point[0] = Math.round(origX + (ev.clientX - startMouseX) / z);
              targetKnot.point[1] = Math.round(origY + (ev.clientY - startMouseY) / z);
              targetKnot.isExplicitTangent = false;
              targetKnot.tangentAngleOffset = 0;
              this.component.commitCurveGeometryUpdate();
            }
          };

          const onBadgeDragUp = () => {
            isDraggingBadge = false;
            window.removeEventListener('mousemove', onBadgeDragMove);
            window.removeEventListener('mouseup', onBadgeDragUp);
            if (!didDragBadge) this.promptInlineTailText(ann, anchorPt, manualCardinal);
            else {
              this.component.commitCurveGeometryUpdate();
              this.component.exposeBezierHandles(ann);
              this.component.renderStage();
            }
          };

          window.addEventListener('mousemove', onBadgeDragMove);
          window.addEventListener('mouseup', onBadgeDragUp);
        });

        textBadgesLayer.appendChild(g);
        textElementsMap.fg = g;
        ann._textElements = textElementsMap;
      }
  promptInlineTailText(curveRecord, anchorPt, forcedEdge = null, initialText = '') {
      if (this.component._commitActiveInlineEditor) {
        this.component._commitActiveInlineEditor();
      }

      const isValidCardinal = (edge) => ['left', 'right', 'top', 'bottom'].includes(edge);

      let exitVec = [1, 0];
      if (curveRecord && curveRecord.beziers?.length > 0) {
        const isAtTail = (curveRecord.textEnd !== 'tip');
        const termSeg = isAtTail ? curveRecord.beziers[curveRecord.beziers.length - 1] : curveRecord.beziers[0];
        exitVec = isAtTail
          ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
          : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];
      }

      const p = this.component.stageState.prefs || {};
      let fontF = curveRecord?.fontFamily || this.component.stageState.fontFamily || p.fontFamily || "'Architects Daughter', cursive, sans-serif";
      let fontS = curveRecord?.fontSize || this.component.stageState.fontSize || p.fontSize || 20;
      let boxStyle = curveRecord?.boxStyle || this.component.stageState.boxStyle || p.boxStyle || 'bracket';
      const color = curveRecord?.color || this.component.stageState.currentColor || '#00e676';
      const initialVal = (initialText !== undefined && initialText !== null && initialText !== '')
        ? initialText
        : (curveRecord?.text || '');

      const padX = boxStyle !== 'none' ? 8 : 4;
      const padY = boxStyle !== 'none' ? 4 : 2;
      const lineH = Math.round(fontS * 1.25);

      const bounds = this.measureTextBounds(initialVal || 'Note…', fontS, fontF);
      const initW = Math.max(initialVal ? 24 : 64, bounds.maxW + padX * 2);
      const initH = Math.max(lineH + padY * 2, bounds.totalH + padY * 2);

      const manualEdge = (curveRecord?.manualEdge && isValidCardinal(curveRecord.connectEdge))
        ? curveRecord.connectEdge
        : (isValidCardinal(forcedEdge) ? forcedEdge : null);

      let placement = this.computeTextPlacement(anchorPt, exitVec, initW, initH, manualEdge);
      let connectEdge = manualEdge || placement.connectEdge;

      if (curveRecord) {
        curveRecord._isEditingText = true;
        curveRecord._liveEditSize = { width: initW, height: initH };
        this.component.renderStage();
      }

      const editorWrap = makeElement('div', {
        id: 'qa-inline-tail-editor',
        style: {
          position: 'absolute',
          top: `${curveRecord?.type === 'text_badge' ? anchorPt[1] : placement.posY}px`,
          left: `${curveRecord?.type === 'text_badge' ? anchorPt[0] : placement.posX}px`,
          zIndex: '75',
          overflow: 'visible'
        }
      });

      const isNeon = (curveRecord?.lineStyle === 'neon' || (!curveRecord && this.component.stageState.lineStyle === 'neon'));
      const glowMode = p.textGlowMode || 'match';
      const useNeonText = (glowMode === 'neon') || (glowMode === 'match' && isNeon);
      const displayColor = useNeonText ? this.component.strokeManager.getLuminousCoreColor(color) : color;

      const editorEl = makeElement('div', {
        className: 'qa-inline-ce',
        contentEditable: 'true',
        'data-placeholder': 'Note…',
        style: {
          display: 'inline-block',
          minWidth: initialVal ? '20px' : '64px',
          maxWidth: `${260 + padX * 2}px`,
          minHeight: `${lineH + padY * 2}px`,
          padding: `${padY}px ${padX}px`,
          fontSize: `${fontS}px`,
          fontFamily: fontF,
          fontWeight: 'bold',
          lineHeight: `${lineH}px`,
          color: displayColor,
          background: initialVal ? 'transparent' : 'rgba(248, 250, 252, 0.06)',
          border: curveRecord ? 'none' : `1px dashed ${color}`,
          borderRadius: boxStyle === 'pill' ? '18px' : '4px',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxSizing: 'border-box',
          textAlign: placement.textAlign,
          textShadow: useNeonText
            ? `0 0 6px ${color}, 0 1px 2px rgba(7, 10, 19, 0.95)`
            : '2px 2px 0 rgba(10, 15, 25, 0.95)',
          cursor: 'text'
        }
      });
      editorEl.textContent = initialVal;

      const controlsDock = makeElement('div', {
        id: 'qa-callout-editor-dock',
        style: {
          position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: '5px',
          background: 'rgba(11, 17, 32, 0.94)', border: '1px solid rgba(0, 242, 254, 0.4)',
          borderRadius: '18px', padding: '3px 10px', fontSize: '10px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.85)',
          zIndex: '85', backdropFilter: 'blur(10px)', userSelect: 'none', whiteSpace: 'nowrap'
        }
      });

      const getCleanText = () => (editorEl.innerText || '').replace(/\r\n/g, '\n').replace(/\n$/, '').trim();

      const syncLiveLayout = () => {
        const curLH = Math.round(fontS * 1.25);
        const curPadX = boxStyle !== 'none' ? 8 : 4;
        const curPadY = boxStyle !== 'none' ? 4 : 2;
        const curText = getCleanText();

        editorEl.style.fontSize = `${fontS}px`;
        editorEl.style.fontFamily = fontF;
        editorEl.style.lineHeight = `${curLH}px`;
        editorEl.style.padding = `${curPadY}px ${curPadX}px`;
        editorEl.style.minWidth = curText ? '20px' : '64px';
        editorEl.style.maxWidth = `${260 + curPadX * 2}px`;
        editorEl.style.background = curText ? 'transparent' : 'rgba(248, 250, 252, 0.06)';

        const curW = Math.max(curText ? 20 : 64, editorEl.offsetWidth || initW);
        const curH = Math.max(curLH + curPadY * 2, editorEl.offsetHeight || initH);

        if (curveRecord && curveRecord.type === 'text_badge') {
          curveRecord._liveEditSize = { width: curW, height: curH };
          curveRecord.text = curText;
          curveRecord.fontSize = fontS;
          curveRecord.boxStyle = boxStyle;
          editorWrap.style.left = `${anchorPt[0]}px`;
          editorWrap.style.top = `${anchorPt[1]}px`;
          controlsDock.style.left = `${anchorPt[0]}px`;
          controlsDock.style.top = `${anchorPt[1] > 48 ? (anchorPt[1] - 32) : (anchorPt[1] + curH + 10)}px`;
          this.component.renderStage();
        } else {
          const curEdge = (curveRecord?.manualEdge && isValidCardinal(connectEdge)) ? connectEdge : null;
          placement = this.computeTextPlacement(anchorPt, exitVec, curW, curH, curEdge);
          editorWrap.style.left = `${placement.posX}px`;
          editorWrap.style.top = `${placement.posY}px`;
          editorEl.style.textAlign = placement.textAlign;

          if (curveRecord) {
            curveRecord._liveEditSize = { width: curW, height: curH };
            curveRecord.text = curText;
            curveRecord.fontSize = fontS;
            curveRecord.boxStyle = boxStyle;
            this.component.renderStage();
          }

          const dockAbove = placement.posY > 56 && !(placement.showTop && !placement.showBottom);
          controlsDock.style.top = `${dockAbove ? (placement.posY - 32) : (placement.posY + curH + 10)}px`;
          controlsDock.style.left = `${placement.posX}px`;
        }
      };

      const cycleDockEdge = () => {
        const cycle = ['left', 'right', 'bottom', 'top', 'auto'];
        const baseEdge = (connectEdge || 'left').split('-')[0];
        const nextEdge = cycle[(cycle.indexOf(baseEdge) + 1) % cycle.length];
        connectEdge = nextEdge;
        const isManual = (nextEdge !== 'auto');
        if (curveRecord) {
          curveRecord.connectEdge = nextEdge;
          curveRecord.manualEdge = isManual;
        }
        syncLiveLayout();
        edgeCycleBtn.textContent = `Dock: ${placement.connectEdge.toUpperCase()}${isManual ? ' 🔒' : ''}`;
      };

      const cycleFrameStyle = () => {
        const styles = ['bracket', 'box', 'pill', 'none'];
        boxStyle = styles[(styles.indexOf(boxStyle) + 1) % styles.length];
        if (curveRecord) curveRecord.boxStyle = boxStyle;
        styleBtn.textContent = boxStyle === 'bracket' ? '◺ Bracket' : (boxStyle === 'box' ? '◻ Box' : (boxStyle === 'pill' ? '💊 Pill' : 'Plain'));
        syncLiveLayout();
      };

      const stepEditorFont = (delta) => {
        fontS = Math.max(11, Math.min(48, fontS + delta));
        if (curveRecord) curveRecord.fontSize = fontS;
        sizeLbl.textContent = `${fontS}px`;
        syncLiveLayout();
      };

      const edgeCycleBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '1px 6px', fontSize: '9.5px', color: '#00f2fe', borderColor: 'rgba(0, 242, 254, 0.4)' },
        onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); cycleDockEdge(); }
      }, `Dock: ${placement.connectEdge.toUpperCase()}${curveRecord?.manualEdge ? ' 🔒' : ''}`);

      const styleBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '1px 6px', fontSize: '9.5px' },
        onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); cycleFrameStyle(); }
      }, boxStyle === 'bracket' ? '◺ Bracket' : (boxStyle === 'box' ? '◻ Box' : (boxStyle === 'pill' ? '💊 Pill' : 'Plain')));

      const sizeLbl = makeElement('span', { style: { color: '#ffd700', fontWeight: 'bold', minWidth: '28px', textAlign: 'center' } }, `${fontS}px`);
      const decBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '1px 5px', fontSize: '9.5px' },
        onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); stepEditorFont(-2); }
      }, 'A-');
      const incBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '1px 5px', fontSize: '9.5px' },
        onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); stepEditorFont(2); }
      }, 'A+');

      let committed = false;
      let onOutClick = null;

      const commit = (mode = 'blur') => {
        if (committed) return;
        committed = true;
        this.component._commitActiveInlineEditor = null;
        if (onOutClick) window.removeEventListener('mousedown', onOutClick);

        const textVal = getCleanText();
        if (curveRecord) {
          curveRecord._isEditingText = false;
          curveRecord._liveEditSize = null;
          curveRecord.text = textVal;
          if (curveRecord.manualEdge && isValidCardinal(connectEdge)) {
            curveRecord.connectEdge = connectEdge;
          }
          curveRecord.fontSize = fontS;
          curveRecord.fontFamily = fontF;
          curveRecord.boxStyle = boxStyle;
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
            lineStyle: this.component.stageState.lineStyle || 'classic',
            connectEdge: connectEdge,
            color: color
          });
        }

        editorWrap.remove();
        controlsDock.remove();
        this.component.renderStage();
        if (mode === 'escape') {
          this.component.showKnotToast('Command Mode • Keys: A=Arrow, X=Flip, L=Loop, Del=Remove');
        }
      };

      this.component._commitActiveInlineEditor = () => commit('external');

      const okBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '1px 8px', fontSize: '9.5px' },
        onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); commit('done'); }
      }, '✓');

      controlsDock.append(
        edgeCycleBtn, styleBtn, decBtn, sizeLbl, incBtn,
        makeElement('span', { style: { color: '#64748b', fontSize: '9px' } }, 'Esc=Keys'),
        okBtn
      );

      editorWrap.appendChild(editorEl);
      this.component.stageBox.appendChild(editorWrap);
      this.component.stageBox.appendChild(controlsDock);

      editorEl.addEventListener('input', syncLiveLayout);
      editorEl.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) cycleFrameStyle();
          else cycleDockEdge();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          stepEditorFont(e.key === 'ArrowUp' ? 2 : -2);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          commit('enter');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          commit('escape');
        }
      });

      onOutClick = (ev) => {
        if (!editorWrap.contains(ev.target) && !controlsDock.contains(ev.target)) commit('outside');
      };

      setTimeout(() => {
        editorEl.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        syncLiveLayout();
        window.addEventListener('mousedown', onOutClick);
      }, 15);
    }

  wrapTextLines(text, maxCharsPerLine) {
      return StudioGeometry.wrapTextLines(text, maxCharsPerLine);
    }
  renderDirectTextBadgeSvg(ann, textBadgesLayer, stageState) {
      if (ann._badgeElements) {
        Object.values(ann._badgeElements).forEach(el => { if (el && el.remove) el.remove(); });
        ann._badgeElements = null;
      }

      const p = stageState.prefs || {};
      const fontS = ann.fontSize || stageState.fontSize || p.fontSize || 20;
      const fontF = ann.fontFamily || stageState.fontFamily || p.fontFamily || "'Architects Daughter', cursive, sans-serif";
      const boxStyle = ann.boxStyle || stageState.boxStyle || p.boxStyle || 'bracket';
      const isEditing = Boolean(ann._isEditingText);

      const bounds = this.measureTextBounds(ann.text || '', fontS, fontF);
      const padX = boxStyle !== 'none' ? 8 : 4;
      const padY = boxStyle !== 'none' ? 4 : 2;
      const boxW = (isEditing && ann._liveEditSize) ? ann._liveEditSize.width : (bounds.maxW + padX * 2);
      const boxH = (isEditing && ann._liveEditSize) ? ann._liveEditSize.height : (bounds.totalH + padY * 2);

      const col = ann.color || '#00e676';
      const isSelected = (stageState.selectedItem === ann);
      const isNeon = (ann.lineStyle === 'neon');
      const coreTint = isNeon ? this.component.strokeManager.getLuminousCoreColor(col) : col;

      const showBackdrop = Boolean(p.textBoxBgEnabled && (p.textBoxBgOpacity === undefined || p.textBoxBgOpacity > 0.02));
      const bgColor = p.textBoxBgColor || '#090d16';
      const bgOpacity = p.textBoxBgOpacity !== undefined ? p.textBoxBgOpacity : 0.55;
      const bgBlur = p.textBoxBgBlur !== undefined ? p.textBoxBgBlur : 4.0;
      const borderW = p.borderStrokeWidth || 2.4;

      const glowMode = p.textGlowMode || 'match';
      const useNeonText = (glowMode === 'neon') || (glowMode === 'match' && isNeon);
      const useShadowText = (glowMode === 'shadow') || (glowMode === 'match' && !isNeon);
      const useHalo = Boolean((p.textReadabilityHalo === true) || glowMode === 'halo');
      const glowSpread = p.textGlowSpread !== undefined ? p.textGlowSpread : 3.5;
      const glowOpacity = p.textGlowOpacity !== undefined ? p.textGlowOpacity : 0.92;
      const textFill = useNeonText ? coreTint : col;
      const curveGlowPad = p.curveGlowWidth !== undefined ? p.curveGlowWidth : 10.0;

      const bD = `M ${ann.x} ${ann.y} L ${ann.x} ${ann.y + boxH} L ${ann.x + boxW} ${ann.y + boxH}`;
      const badgeElementsMap = {};

      if (useShadowText) {
        const shadowG = makeElement('svg:g', { transform: 'translate(2, 2)', style: { pointerEvents: 'none' } });
        if (boxStyle === 'bracket') {
          shadowG.appendChild(makeElement('svg:path', {
            d: bD, fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(borderW + 2.0), 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
          }));
        } else if (boxStyle === 'box' || boxStyle === 'pill') {
          shadowG.appendChild(makeElement('svg:rect', {
            x: ann.x, y: ann.y, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
            fill: 'none', stroke: 'rgba(10, 15, 25, 0.95)', 'stroke-width': String(borderW + 2.0)
          }));
        }
        if (!isEditing) {
          const txtShadow = makeElement('svg:text', {
            x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: 'rgba(10, 15, 25, 0.92)',
            'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold'
          });
          bounds.lines.forEach((l, i) => {
            txtShadow.appendChild(makeElement('svg:tspan', { x: ann.x + padX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
          });
          shadowG.appendChild(txtShadow);
        }
        this.component.shadowLayer.appendChild(shadowG);
        badgeElementsMap.shadow = shadowG;
      }

      if (useNeonText) {
        const glowG = makeElement('svg:g', { style: { pointerEvents: 'none', opacity: String(glowOpacity) } });
        if (boxStyle === 'bracket') {
          glowG.appendChild(makeElement('svg:path', {
            d: bD, fill: 'none', stroke: col, 'stroke-width': String(borderW + curveGlowPad), 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            style: { filter: 'url(#qa-neon-glow)' }
          }));
        } else if (boxStyle === 'box' || boxStyle === 'pill') {
          glowG.appendChild(makeElement('svg:rect', {
            x: ann.x, y: ann.y, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
            fill: 'none', stroke: col, 'stroke-width': String(borderW + curveGlowPad), style: { filter: 'url(#qa-neon-glow)' }
          }));
        }
        if (!isEditing) {
          const txtGlow = makeElement('svg:text', {
            x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: col,
            stroke: glowSpread > 0 ? col : 'none', 'stroke-width': String(glowSpread), 'stroke-linejoin': 'round',
            'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
            style: { filter: 'url(#qa-text-glow)' }
          });
          bounds.lines.forEach((l, i) => {
            txtGlow.appendChild(makeElement('svg:tspan', { x: ann.x + padX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
          });
          glowG.appendChild(txtGlow);
        }
        this.component.glowLayer.appendChild(glowG);
        badgeElementsMap.glow = glowG;
      }

      const g = makeElement('svg:g', {
        id: `badge-${ann.id}`,
        className: 'qa-movable-text-badge',
        style: { cursor: 'move', userSelect: 'none' },
        title: 'Click to edit text • Drag to move'
      });

      if (showBackdrop) {
        g.appendChild(makeElement('svg:rect', {
          x: ann.x - 3, y: ann.y - 2, width: boxW + 6, height: boxH + 4, rx: boxStyle === 'pill' ? '20' : '8',
          fill: bgColor, 'fill-opacity': String(bgOpacity), stroke: 'none',
          ...(bgBlur > 0 ? { style: { filter: 'url(#qa-text-bg-blur)', pointerEvents: 'none' } } : { style: { pointerEvents: 'none' } })
        }));
      }

      g.appendChild(makeElement('svg:rect', {
        x: ann.x, y: ann.y, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
        fill: 'rgba(255, 255, 255, 0.001)', stroke: 'none'
      }));

      if (isSelected && !isEditing) {
        g.appendChild(makeElement('svg:rect', {
          x: ann.x - 3, y: ann.y - 3, width: boxW + 6, height: boxH + 6, rx: '6',
          fill: 'none', stroke: '#00f2fe', 'stroke-width': '1.5', 'stroke-dasharray': '3,3',
          style: { filter: 'drop-shadow(0 0 6px #00f2fe)', pointerEvents: 'none' }
        }));
      }

      if (boxStyle === 'bracket') {
        g.appendChild(makeElement('svg:path', {
          d: bD, fill: 'none', stroke: textFill, 'stroke-width': String(borderW),
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          ...(useNeonText ? { style: { filter: 'url(#qa-neon-core)' } } : {})
        }));
      } else if (boxStyle === 'box' || boxStyle === 'pill') {
        g.appendChild(makeElement('svg:rect', {
          x: ann.x, y: ann.y, width: boxW, height: boxH, rx: boxStyle === 'pill' ? '18' : '5',
          fill: 'none', stroke: textFill, 'stroke-width': String(borderW),
          ...(useNeonText ? { style: { filter: 'url(#qa-neon-core)' } } : {})
        }));
      }

      if (!isEditing) {
        if (useHalo) {
          const txtHalo = makeElement('svg:text', {
            x: ann.x + padX, y: ann.y + padY + fontS * 0.88,
            fill: 'rgba(7, 10, 19, 0.90)', stroke: 'rgba(7, 10, 19, 0.90)', 'stroke-width': '2.8',
            'stroke-linejoin': 'round', 'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
            style: { pointerEvents: 'none' }
          });
          bounds.lines.forEach((l, i) => {
            txtHalo.appendChild(makeElement('svg:tspan', { x: ann.x + padX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
          });
          g.appendChild(txtHalo);
        }

        const txt = makeElement('svg:text', {
          x: ann.x + padX, y: ann.y + padY + fontS * 0.88, fill: textFill,
          'font-family': fontF, 'font-size': `${fontS}px`, 'font-weight': 'bold',
          ...(useNeonText ? { style: { filter: 'url(#qa-neon-core)' } } : {})
        });
        bounds.lines.forEach((l, i) => {
          txt.appendChild(makeElement('svg:tspan', { x: ann.x + padX, dy: i === 0 ? '0' : `${bounds.lineHeight}px` }, l));
        });
        g.appendChild(txt);
      }

      let isDrag = false;
      let didDrag = false;
      let sX = 0, sY = 0;
      let initialX = ann.x, initialY = ann.y;

      g.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.preventDefault();
        e.stopPropagation();
        this.component.selectItem(ann);
        isDrag = true;
        didDrag = false;
        sX = e.clientX; sY = e.clientY;
        initialX = ann.x; initialY = ann.y;

        const onM = (ev) => {
          if (!isDrag) return;
          if (Math.hypot(ev.clientX - sX, ev.clientY - sY) > 4) {
            didDrag = true;
            window.getSelection()?.removeAllRanges();
            const z = stageState.zoom || 1.0;
            ann.x = Math.round(initialX + (ev.clientX - sX) / z);
            ann.y = Math.round(initialY + (ev.clientY - sY) / z);
            this.component.renderStage();
          }
        };
        const onU = () => {
          isDrag = false;
          window.removeEventListener('mousemove', onM);
          window.removeEventListener('mouseup', onU);
          if (!didDrag) this.promptInlineTailText(ann, [ann.x, ann.y], 'left');
          else this.component.renderStage();
        };
        window.addEventListener('mousemove', onM);
        window.addEventListener('mouseup', onU);
      });

      textBadgesLayer.appendChild(g);
      badgeElementsMap.fg = g;
      ann._badgeElements = badgeElementsMap;
    }

  computeTextPlacement(anchorPt, exitVec, boxW, boxH, forcedEdge = null) {
      const threshold = this.component?.stageState?.prefs?.axisThreshold ?? 15;
      return StudioGeometry.computeTextBoxPlacement(anchorPt, exitVec, boxW, boxH, forcedEdge, threshold);
    }
  measureTextBounds(text, fontSize = 20, fontFamily = "'Architects Daughter', cursive, sans-serif") {
      if (!this._measureCanvas) {
        this._measureCanvas = document.createElement('canvas');
        this._measureCtx = this._measureCanvas.getContext('2d');
      }
      const ctx = this._measureCtx;
      ctx.font = `bold ${fontSize}px ${fontFamily}`;

      const rawStr = String(text || '').trim();
      const lineHeight = Math.round(fontSize * 1.25);
      if (!rawStr) {
        return { lines: [''], maxW: 60, totalH: lineHeight, lineHeight };
      }

      const targetColW = 260;
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

      const totalH = Math.max(lineHeight, lines.length * lineHeight);
      return { lines, maxW, totalH, lineHeight };
    }
}

globalThis.QuoraTextManager = QuoraTextManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraTextManager;