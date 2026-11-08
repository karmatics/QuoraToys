class QuoraInSituHUD {
  constructor(component) {
    this.component = component;
    this._hudElement = null;
    this._pos = { left: 24, top: 80 };
    this._collapsed = false;
    this._showDetails = false;
  }

  renderCursorReticle(controlsLayer, screenPt, dirAngle, tension = 1.0) {
    let reticle = document.getElementById('qa-cursor-reticle-overlay');
    if (!reticle) {
      reticle = makeElement('svg:g', {
        id: 'qa-cursor-reticle-overlay',
        style: { pointerEvents: 'none', transition: 'opacity 0.1s ease' }
      });
      controlsLayer.appendChild(reticle);
    }

    const radius = 20 * tension;
    const endX = screenPt[0] + Math.cos(dirAngle) * (radius + 12);
    const endY = screenPt[1] + Math.sin(dirAngle) * (radius + 12);

    reticle.innerHTML = `
      <circle cx="${screenPt[0]}" cy="${screenPt[1]}" r="${radius}" fill="none" stroke="rgba(0, 242, 254, 0.4)" stroke-width="1.2" stroke-dasharray="2,3" />
      <line x1="${screenPt[0]}" y1="${screenPt[1]}" x2="${endX}" y2="${endY}" stroke="#00f2fe" stroke-width="2" stroke-linecap="round" />
      <circle cx="${endX}" cy="${endY}" r="3" fill="#00f2fe" />
    `;
    reticle.style.display = 'block';
  }

  hideCursorReticle() {
    const reticle = document.getElementById('qa-cursor-reticle-overlay');
    if (reticle) reticle.style.display = 'none';
  }

  setupKeyInMatrixHud() {
    let hud = document.getElementById('qa-keyin-matrix-hud');

    try {
      const saved = JSON.parse(localStorage.getItem('quoratoys_hud_pos') || 'null');
      if (saved) this._pos = saved;
    } catch (e) {}

    this._pos.left = Math.max(8, Math.min(window.innerWidth - 280, this._pos.left));
    this._pos.top = Math.max(8, Math.min(window.innerHeight - 80, this._pos.top));

    if (hud) {
      hud.style.left = `${this._pos.left}px`;
      hud.style.top = `${this._pos.top}px`;
      hud.style.display = 'flex';
      return;
    }

    hud = makeElement('div', {
      id: 'qa-keyin-matrix-hud',
      style: {
        position: 'fixed', top: `${this._pos.top}px`, left: `${this._pos.left}px`,
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
        (this._detailsBtn = makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 5px', fontSize: '9px' },
          title: 'Expand detailed shortcut explanations',
          onclick: (e) => {
            e.stopPropagation();
            this._showDetails = !this._showDetails;
            this._detailsBtn.textContent = this._showDetails ? '▲ Compact' : '▼ Details';
            this.renderRows();
          }
        }, '▼ Details')),
        (this._toggleBtn = makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 5px', fontSize: '10px', lineHeight: '1' },
          title: 'Minimize / Expand palette',
          onclick: (e) => {
            e.stopPropagation();
            this._collapsed = !this._collapsed;
            this._bodyWrapper.style.display = this._collapsed ? 'none' : 'flex';
            this._toggleBtn.textContent = this._collapsed ? '+' : '−';
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

    let isDragging = false;
    let startX = 0, startY = 0;
    let initX = 0, initY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initX = parseFloat(hud.style.left) || this._pos.left;
      initY = parseFloat(hud.style.top) || this._pos.top;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(8, Math.min(window.innerWidth - 260, initX + dx));
      const newTop = Math.max(8, Math.min(window.innerHeight - 60, initY + dy));

      hud.style.left = `${newLeft}px`;
      hud.style.top = `${newTop}px`;
      this._pos = { left: newLeft, top: newTop };
      try {
        localStorage.setItem('quoratoys_hud_pos', JSON.stringify(this._pos));
      } catch (err) {}
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
      }
    });

    this._bodyWrapper = makeElement('div', {
      style: { display: 'flex', flexDirection: 'column' }
    });

    const explainer = makeElement('div', {
      style: {
        padding: '6px 10px', background: 'rgba(0, 242, 254, 0.08)',
        borderBottom: '1px solid rgba(0, 242, 254, 0.2)', fontSize: '10px', color: '#94a3b8', lineHeight: '1.4'
      }
    }, [
      makeElement('strong', { style: { color: '#00f2fe', display: 'block', marginBottom: '2px' } }, '💡 Quick Reference:'),
      '• Hold ', makeElement('strong', { style: { color: '#ffd700' } }, '[H]'), ' for in-situ vector annotations.', makeElement('br'),
      '• Hold ', makeElement('strong', { style: { color: '#f59e0b' } }, '[Ctrl]'), ' to rest hand or tune string tether.', makeElement('br'),
      '• Press ', makeElement('strong', { style: { color: '#00f2fe' } }, '[X]'), ' to flip arrow ↔ text terminals.'
    ]);
    this._bodyWrapper.appendChild(explainer);

    this._pillsContainer = makeElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 8px', maxHeight: '380px', overflowY: 'auto' }
    });
    this._bodyWrapper.appendChild(this._pillsContainer);

    hud.append(header, this._bodyWrapper);
    document.body.appendChild(hud);
    this._hudElement = hud;

    this.renderRows();
  }

  renderRows() {
      if (!this._pillsContainer) return;
      this._pillsContainer.innerHTML = '';

      const activeFilter = this._activeCategory || 'all';

      // Category Filter Tab Bar
      const filterBar = makeElement('div', {
        style: {
          display: 'flex', gap: '3px', marginBottom: '6px', paddingBottom: '5px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }
      });

      const categories = [
        { id: 'all', label: 'All' },
        { id: 'rapid', label: '⚡ Rapid Keys' },
        { id: 'knot', label: 'Knot & Tangent' },
        { id: 'curve', label: 'Splines & Arrows' },
        { id: 'text', label: 'Text & Frame' }
      ];

      categories.forEach(cat => {
        const isCur = (cat.id === activeFilter);
        const tabBtn = makeElement('button', {
          style: {
            background: isCur ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
            color: isCur ? '#ffffff' : '#94a3b8',
            border: isCur ? '1px solid #38bdf8' : '1px solid transparent',
            borderRadius: '12px', padding: '2px 8px', fontSize: '9.5px',
            fontFamily: 'monospace', fontWeight: isCur ? 'bold' : 'normal', cursor: 'pointer'
          },
          onclick: (e) => {
            e.stopPropagation();
            this._activeCategory = cat.id;
            this.renderRows();
          }
        }, cat.label);
        filterBar.appendChild(tabBtn);
      });

      this._pillsContainer.appendChild(filterBar);

      // Command Definitions with Direct Accelerator Hotkeys
      const commands = [
        { key: 'Type', label: 'Instant Callout Typing', category: 'rapid', desc: 'Type any letter or number immediately after drawing an arrow to attach and edit label text', action: 'edit_text' },
        { key: '1–6', label: 'Quick Color Palette', category: 'rapid', desc: '1=Cyan, 2=Green, 3=Gold, 4=Coral, 5=Purple, 6=White', action: 'palette_select' },
        { key: 'Click-Drag', label: 'Direct Curve Reshaping', category: 'rapid', desc: 'Grab any curve segment directly with the mouse to bend it through the cursor', action: 'direct_bend' },
        { key: 'H (Hold)', label: 'Meta Vector Help', category: 'curve', desc: 'Hold H anytime to see on-screen arrowheads and bracket callouts explaining all controls', action: 'meta_help' },
        { key: 'Ctrl (Hold)', label: 'Clutch / Rest Hand', category: 'curve', desc: 'Freeze curve growth to tune drawstring radius R, or release mouse to rest hand without breaking curve', action: 'clutch_rest' },
        { key: 'Space', label: 'Draw ↔ Tweak Mode', category: 'curve', desc: 'Toggle between drawing new curves and selecting/tweaking existing knots or difference lenses', action: 'toggle_tool' },
        { key: 'Tab', label: 'Next Knot on Curve', category: 'knot', desc: 'Advance active knot selection forward along the curve (Shift+Tab moves backward)', action: 'next_knot' },
        { key: 'Arrows', label: 'Nudge Knot (1px)', category: 'knot', desc: 'Use keyboard arrow keys to nudge the selected knot by 1px (or 10px with Shift)', action: 'nudge_knot' },
        { key: 'A', label: 'Cycle Arrowhead', category: 'curve', desc: 'Cycles tip arrow ➔ tail arrow ➔ both ends ➔ none', action: 'toggle_arrow' },
        { key: 'T', label: 'Attach / Edit Text', category: 'text', desc: 'Focus the text editor at the curve terminal or shape edge to type callout text immediately', action: 'edit_text' },
        { key: 'X', label: 'Swap Terminals', category: 'curve', desc: 'Instantly reverse endpoints: move arrowhead to opposite end and flip the text bracket', action: 'swap_ends' },
        { key: 'Click (Dot)', label: 'Midpoint Knot Split', category: 'knot', desc: 'Clicking the stationary midpoint dot on any segment bisects it at t=0.5 with a new knot', action: 'split_point' },
        { key: '➕ / +', label: 'Add Knot to Segment', category: 'knot', desc: 'Insert an on-curve knot on the active segment without altering overall curve shape', action: 'add_point' },
        { key: 'Right-Click', label: 'Delete Knot', category: 'knot', desc: 'Right-clicking any knot handle deletes that point and re-relaxes the curve smoothly', action: 'delete_knot' },
        { key: 'Del', label: 'Delete Knot / Entity', category: 'knot', desc: 'Deletes the active knot, selected image plate, or curve entity', action: 'delete_curve' },
        { key: 'C', label: 'Toggle Cusp (45°)', category: 'knot', desc: 'Breaks continuous tangency into a sharp 45° corner/cusp at the active knot', action: 'toggle_cusp' },
        { key: 'B', label: 'Cycle Balance (0.5/1.5)', category: 'knot', desc: 'Cycles handle length ratio balance between 0.5, 1.5, and 1.0', action: 'cycle_balance' },
        { key: '+ / -', label: 'Tune Curvature (C)', category: 'knot', desc: 'Increases or decreases curvature tension C in increments of 0.2', action: 'tune_curvature' },
        { key: 'S', label: 'Straighten to Line', category: 'curve', desc: 'Collapses curve by removing all intermediate knots, making a direct straight arrow', action: 'straighten' },
        { key: 'R', label: 'Reset Knot Constraints', category: 'knot', desc: 'Resets active knot constraints back to default relaxed state (0 offset, C=1, B=1)', action: 'reset_knot' },
        { key: 'W', label: 'Wipe All Constraints', category: 'curve', desc: 'Wipes all custom constraints across all knots on the selected curve', action: 'wipe_curve' }
      ];

      const curve = this.component.getActiveCurve();
      const hasKnot = Boolean(curve && curve.vertices && this.component._activeKnotIdx !== null);
      const hasImage = Boolean(this.component.stageState?.activeImage);

      this._commandPills = {};

      commands.forEach(cmd => {
        if (activeFilter !== 'all' && cmd.category !== activeFilter) return;

        const isKnotRelevant = cmd.category === 'knot' && hasKnot;

        const card = makeElement('div', {
          className: 'qa-keyin-row',
          'data-action': cmd.action,
          style: {
            display: 'flex', flexDirection: 'column', gap: '2px',
            padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
            background: isKnotRelevant ? 'rgba(0, 242, 254, 0.06)' : 'rgba(255, 255, 255, 0.02)',
            border: isKnotRelevant ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
            transition: 'all 0.12s ease'
          },
          title: `Click or press ${cmd.key} to execute`,
          onclick: (e) => {
            e.stopPropagation();
            if (cmd.action === 'toggle_arrow') this.component.toggleArrowhead();
            else if (cmd.action === 'edit_text') this.component.triggerTextOnActiveOrCanvas();
            else if (cmd.action === 'swap_ends') this.component.swapActiveCurveTerminals();
            else if (cmd.action === 'add_point') this.component.addKnotToActiveCurve();
            else if (cmd.action === 'delete_curve') this.component.deleteSelectedEntity();
            else this.component.executeKeyInCommand(cmd.action);
          }
        });

        const topRow = makeElement('div', {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
        }, [
          makeElement('span', { style: { color: isKnotRelevant ? '#00f2fe' : '#cbd5e1', fontSize: '10.5px' } }, cmd.label),
          makeElement('span', {
            style: {
              background: isKnotRelevant ? 'rgba(0, 242, 254, 0.25)' : 'rgba(0, 242, 254, 0.12)',
              color: '#00f2fe',
              border: `1px solid ${isKnotRelevant ? '#00f2fe' : 'rgba(0, 242, 254, 0.35)'}`,
              borderRadius: '4px', padding: '1px 5px', fontSize: '10px', fontWeight: 'bold', minWidth: '42px', textAlign: 'center'
            }
          }, cmd.key)
        ]);

        card.appendChild(topRow);

        if (this._showDetails) {
          card.appendChild(makeElement('div', {
            style: { fontSize: '9.5px', color: '#94a3b8', lineHeight: '1.3', marginTop: '2px', paddingLeft: '2px' }
          }, cmd.desc));
        }

        card.addEventListener('mouseenter', () => { card.style.background = 'rgba(0, 242, 254, 0.14)'; });
        card.addEventListener('mouseleave', () => { card.style.background = isKnotRelevant ? 'rgba(0, 242, 254, 0.06)' : 'rgba(255, 255, 255, 0.02)'; });

        this._commandPills[cmd.action] = card;
        this._pillsContainer.appendChild(card);
      });

      this.component.updateDynamicKeyInHUD();
    }
  renderTransientCursorDial(controlsLayer, centerPt, curveRecord, callbacks = {}) {
      let dial = document.getElementById('qa-transient-cursor-dial');
      if (!dial) {
        dial = makeElement('svg:g', {
          id: 'qa-transient-cursor-dial',
          style: { transition: 'opacity 0.15s ease', pointerEvents: 'auto' }
        });
        controlsLayer.appendChild(dial);
      }

      dial.innerHTML = '';
      const r = 54;

      // Glowing background dial ring
      const ringBackdrop = makeElement('svg:circle', {
        cx: centerPt[0], cy: centerPt[1], r: String(r),
        fill: 'rgba(9, 13, 22, 0.90)', stroke: '#00f2fe', 'stroke-width': '1.5',
        style: { filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.85))' }
      });
      dial.appendChild(ringBackdrop);

      // Center pause indicator
      dial.appendChild(makeElement('svg:circle', {
        cx: centerPt[0], cy: centerPt[1], r: '5', fill: '#ffd700', stroke: '#ffffff', 'stroke-width': '1.5'
      }));

      // 4 Cardinal Action Nodes
      const actions = [
        { id: 'arrow', label: '🏹', title: 'Toggle Arrowhead [A]', angle: -Math.PI / 2, fn: callbacks.onToggleArrow },
        { id: 'text', label: '💬', title: 'Attach Text Callout [T]', angle: 0, fn: callbacks.onAttachText },
        { id: 'swap', label: '⇄', title: 'Swap Terminals [X]', angle: Math.PI / 2, fn: callbacks.onSwapEnds },
        { id: 'snap', label: '⚡', title: 'Snap Natural Tangency [R]', angle: Math.PI, fn: callbacks.onResetSnap }
      ];

      actions.forEach(act => {
        const bX = centerPt[0] + Math.cos(act.angle) * (r - 16);
        const bY = centerPt[1] + Math.sin(act.angle) * (r - 16);

        const nodeG = makeElement('svg:g', {
          style: { cursor: 'pointer' },
          title: act.title,
          onmousedown: (e) => {
            e.stopPropagation();
            if (act.fn) act.fn();
          }
        });

        nodeG.appendChild(makeElement('svg:circle', {
          cx: bX, cy: bY, r: '10.5', fill: 'rgba(15, 23, 42, 0.95)',
          stroke: '#00f2fe', 'stroke-width': '1.2'
        }));

        nodeG.appendChild(makeElement('svg:text', {
          x: bX, y: bY + 3.5, fill: '#ffffff', 'font-size': '10.5px',
          'text-anchor': 'middle', style: { pointerEvents: 'none' }
        }, act.label));

        dial.appendChild(nodeG);
      });

      // Outer Color Jewel Dots Ring
      const palette = ['#00f2fe', '#00e676', '#ffd700', '#ff2d55', '#c084fc', '#ffffff'];
      const outerR = r + 14;

      palette.forEach((hex, i) => {
        const angle = (i * (Math.PI / 3)) - (Math.PI / 2);
        const pX = centerPt[0] + Math.cos(angle) * outerR;
        const pY = centerPt[1] + Math.sin(angle) * outerR;

        const swatch = makeElement('svg:circle', {
          cx: pX, cy: pY, r: '5.5', fill: hex, stroke: '#090d16', 'stroke-width': '1.5',
          style: { cursor: 'pointer', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))' },
          title: `Set Color: ${hex}`,
          onmousedown: (e) => {
            e.stopPropagation();
            this.component.stageState.currentColor = hex;
            if (this.component.colorIndicatorDot) this.component.colorIndicatorDot.style.background = hex;
            if (curveRecord) curveRecord.color = hex;
            this.component.renderStage();
            this.component.showKnotToast(`Color: ${hex}`);
          }
        });
        dial.appendChild(swatch);
      });

      dial.style.display = 'block';
  }
  hideTransientCursorDial() {
      const dial = document.getElementById('qa-transient-cursor-dial');
      if (dial) dial.style.display = 'none';
  }

  flashKeyCommand(action) {
      if (!this._commandPills || !this._commandPills[action]) return;
      const card = this._commandPills[action];
      card.style.background = '#00f2fe';
      card.style.color = '#070a13';
      setTimeout(() => {
        card.style.background = '';
        card.style.color = '';
      }, 180);
  }
}

globalThis.QuoraInSituHUD = QuoraInSituHUD;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraInSituHUD;