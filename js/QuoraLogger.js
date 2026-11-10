/**
 * QuoraLogger
 * Diagnostic logging and telemetry system for curve drawing, knot operations,
 * and gesture machine state tracking.
 */
class QuoraLogger {
  static instance = null;

  static getInstance() {
    if (!QuoraLogger.instance) {
      QuoraLogger.instance = new QuoraLogger();
    }
    return QuoraLogger.instance;
  }

  constructor() {
      this.level = 7; // Raised default level so all gesture, spline, and knot events log immediately
      this.isPaused = false;
      this.filters = {
        gestures: true,
        knots: true,
        spline: true,
        hover: false,
        pointer: false,
        error: true
      };
      this.entries = [];
      this.maxEntries = 500;
      this.dialog = null;
      this.textarea = null;
      this.levelSlider = null;
      this.levelDisplay = null;
      this.statusHud = null;
    }
  log(category, minLevel, message, data = null) {
    if (this.isPaused || this.level < minLevel) return;
    if (this.filters[category] === false) return;

    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    let text = `[${time}] [L${minLevel}:${category.toUpperCase()}] ${message}`;
    if (data !== null && data !== undefined) {
      try {
        text += ' → ' + (typeof data === 'object' ? JSON.stringify(data) : String(data));
      } catch (e) {
        text += ' → [Unserializable Object]';
      }
    }

    this.entries.push(text);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    if (this.textarea) {
      this.textarea.value += (this.textarea.value ? '\n' : '') + text;
      this.textarea.scrollTop = this.textarea.scrollHeight;
    }
  }

  clear() {
    this.entries = [];
    if (this.textarea) this.textarea.value = '';
  }

  copy() {
    const text = this.entries.join('\n');
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
  }

  openDialog(component = null) {
      if (this.dialog) {
        this.dialog.bringToFront?.();
        return;
      }

      const content = makeElement('div', {
        style: {
          display: 'flex', flexDirection: 'column', gap: '8px',
          padding: '8px', height: '100%', boxSizing: 'border-box',
          background: '#070a13', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '11px'
        }
      });

      // 1. Live Runtime Status Banner
      this.statusHud = makeElement('div', {
        id: 'qa-logger-live-hud',
        style: {
          padding: '6px 10px', background: 'rgba(0, 242, 254, 0.08)',
          border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '6px',
          color: '#00f2fe', fontSize: '10.5px', fontWeight: 'bold', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }
      }, [
        makeElement('span', { id: 'qa-logger-hud-state' }, 'STATE: IDLE • TOOL: CURVE • STYLE: CLASSIC'),
        makeElement('span', { style: { color: '#10b981' } }, '● Stream Active')
      ]);
      content.appendChild(this.statusHud);

      // 2. Controls Toolbar
      const topBar = makeElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #1e293b'
        }
      });

      const levelGroup = makeElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '6px' }
      });

      this.levelDisplay = makeElement('span', {
        style: { color: '#00f2fe', fontWeight: 'bold', minWidth: '70px' }
      }, `Level: ${this.level}/10`);

      this.levelSlider = makeElement('input', {
        type: 'range', min: '0', max: '10', value: String(this.level),
        style: { width: '85px', accentColor: '#00f2fe', cursor: 'pointer' },
        oninput: (e) => {
          this.level = parseInt(e.target.value, 10);
          this.levelDisplay.textContent = `Level: ${this.level}/10`;
        }
      });

      levelGroup.append(makeElement('span', { style: { color: '#94a3b8' } }, 'Detail:'), this.levelSlider, this.levelDisplay);

      const filterBox = makeElement('div', {
        style: { display: 'flex', gap: '8px', alignItems: 'center' }
      });

      const makeCheckbox = (key, label) => {
        const cb = makeElement('input', {
          type: 'checkbox',
          checked: !!this.filters[key],
          style: { accentColor: '#00e676', cursor: 'pointer' },
          onchange: (e) => { this.filters[key] = e.target.checked; }
        });
        return makeElement('label', {
          style: { display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', color: '#cbd5e1', fontSize: '10px' }
        }, [cb, label]);
      };

      filterBox.append(
        makeCheckbox('gestures', 'Gestures'),
        makeCheckbox('knots', 'Knots'),
        makeCheckbox('spline', 'Spline Fitting'),
        makeCheckbox('pointer', 'Pointer Moves')
      );

      topBar.append(levelGroup, filterBox);
      content.appendChild(topBar);

      // 3. Live Terminal Output Box
      this.textarea = makeElement('textarea', {
        readOnly: true,
        spellcheck: 'false',
        placeholder: 'QuoraToys Telemetry & Diagnostic Stream...',
        style: {
          flex: 1, minHeight: '220px', width: '100%',
          background: '#04060a', color: '#7ee787',
          border: '1px solid #1e293b', borderRadius: '6px',
          padding: '8px 10px', fontSize: '10.5px', fontFamily: 'monospace',
          lineHeight: '1.45', boxSizing: 'border-box', resize: 'none', outline: 'none'
        }
      });
      this.textarea.value = this.entries.join('\n');
      this.textarea.scrollTop = this.textarea.scrollHeight;
      content.appendChild(this.textarea);

      // 4. Action Buttons
      const footer = makeElement('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }
      });

      const pauseBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 10px', fontSize: '10.5px', color: this.isPaused ? '#f59e0b' : '#38bdf8' },
        onclick: () => {
          this.isPaused = !this.isPaused;
          pauseBtn.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
          pauseBtn.style.color = this.isPaused ? '#f59e0b' : '#38bdf8';
        }
      }, this.isPaused ? '▶ Resume' : '⏸ Pause');

      const copyBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '4px 12px', fontSize: '10.5px', fontWeight: 'bold' },
        onclick: () => {
          this.copy();
          const orig = copyBtn.textContent;
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        }
      }, '📋 Copy Log');

      const clearBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 10px', fontSize: '10.5px', color: '#ff7b72' },
        onclick: () => this.clear()
      }, '🗑️ Clear');

      const btnGroup = makeElement('div', { style: { display: 'flex', gap: '6px' } }, [copyBtn, clearBtn]);
      footer.append(pauseBtn, btnGroup);
      content.appendChild(footer);

      const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
        ? UITools.makeDialog
        : (opts => new DialogBox(opts));

      this.dialog = dialogMaker({
        title: '🐞 QuoraToys Diagnostic Telemetry',
        size: [580, 420],
        position: [Math.max(20, window.innerWidth - 610), 80],
        contentElement: content,
        onClose: () => {
          this.dialog = null;
          this.textarea = null;
          this.statusHud = null;
        }
      });
    }
}

globalThis.QuoraLogger = QuoraLogger;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraLogger;