class QuoraStudioComponent {
  static render(container) {
    container.innerHTML = '';

    const wrap = makeElement('div', {
      style: {
        background: '#090d16',
        border: '1.5px solid #21262d',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace'
      }
    });

    const header = makeElement('div', {
      style: {
        padding: '10px 16px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }
    }, [
      makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        makeElement('span', { style: { fontSize: '15px' } }, '🧩'),
        makeElement('strong', { style: { fontSize: '13px', color: '#00e676' } }, 'Spot-The-Difference Studio'),
        makeElement('span', { style: { fontSize: '10px', background: 'rgba(0, 230, 118, 0.15)', color: '#00e676', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' } }, 'Toy #1')
      ]),
      makeElement('div', { style: { display: 'flex', gap: '6px' } }, [
        makeElement('button', {
          className: 'dr-nav-btn primary',
          style: { padding: '4px 10px', fontSize: '11px', background: '#0284c7', color: '#fff', fontWeight: 'bold' },
          onclick: () => QuoraStudioComponent.launchStandalone()
        }, '🖼️ Launch Full Workspace'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '4px 8px', fontSize: '11px', color: '#00e676', borderColor: '#00e67644' },
          onclick: () => QuoraStudioComponent.loadSample()
        }, '🧩 Load Sample (5 Diffs)')
      ])
    ]);
    wrap.appendChild(header);

    const body = makeElement('div', {
      style: { padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: 'radial-gradient(circle at 50% 25%, #151e33 0%, #0b0f19 100%)' }
    });

    const dropCard = makeElement('div', {
      style: {
        width: '100%', maxWidth: '620px', border: '2px dashed rgba(255, 255, 255, 0.22)',
        borderRadius: '16px', padding: '28px 20px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(10px)', cursor: 'pointer', transition: 'all 0.2s ease'
      }
    }, [
      makeElement('div', { style: { fontSize: '38px', marginBottom: '8px' } }, '🧩'),
      makeElement('div', { style: { fontSize: '17px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' } }, 'Drop Quora Puzzle Image Here'),
      makeElement('div', { style: { fontSize: '12px', color: '#94a3b8', lineHeight: '1.45', marginBottom: '14px' } },
        'Press Ctrl+V anywhere to paste an image directly from Quora, or click to load a sample challenge.'
      ),
      makeElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } }, [
        makeElement('button', {
          className: 'dr-nav-btn primary',
          style: { padding: '6px 14px', fontSize: '11.5px', fontWeight: 'bold' },
          onclick: (e) => {
            e.stopPropagation();
            QuoraStudioComponent.loadSample();
          }
        }, 'Load Sample Puzzle'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '6px 14px', fontSize: '11.5px' },
          onclick: (e) => {
            e.stopPropagation();
            fileInput.click();
          }
        }, '📁 Choose Local Image')
      ])
    ]);

    const fileInput = makeElement('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        QuoraStudioComponent.loadFile(e.target.files[0]);
      }
    };
    dropCard.appendChild(fileInput);

    dropCard.ondragover = (e) => { e.preventDefault(); dropCard.style.borderColor = '#00e676'; };
    dropCard.ondragleave = () => { dropCard.style.borderColor = 'rgba(255,255,255,0.22)'; };
    dropCard.ondrop = (e) => {
      e.preventDefault();
      dropCard.style.borderColor = 'rgba(255,255,255,0.22)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        QuoraStudioComponent.loadFile(e.dataTransfer.files[0]);
      }
    };

    body.appendChild(dropCard);
    wrap.appendChild(body);
    container.appendChild(wrap);
  }

  static launchStandalone() {
      const existing = document.getElementById('quoratoys-standalone-mount');
      if (existing) existing.remove();

      const leftSafe = (typeof SidePanel !== 'undefined' && SidePanel.getInstances()?.left?.isOpen)
        ? (SidePanel.getInstances().left.width || 300)
        : 0;

      const host = document.createElement('div');
      host.id = 'quoratoys-standalone-mount';
      host.style.cssText = [
        'position: fixed;',
        'top: 0;',
        `left: ${leftSafe}px;`,
        `width: calc(100vw - ${leftSafe}px);`,
        'height: 100vh;',
        'z-index: 200000;',
        'background: #0b0f19;',
        'overflow: hidden;',
        'display: flex;',
        'flex-direction: column;',
        'transition: left 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1);'
      ].join('\n');
      document.body.appendChild(host);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ Return to Living Dossier';
      closeBtn.className = 'dr-nav-btn';
      closeBtn.style.cssText = [
        'position: fixed;',
        'top: 12px;',
        'right: 18px;',
        'z-index: 2147483647;',
        'background: #1e293b;',
        'color: #f8fafc;',
        'border: 1.5px solid #00e676;',
        'padding: 6px 14px;',
        'font-family: monospace;',
        'font-size: 11px;',
        'font-weight: bold;',
        'border-radius: 6px;',
        'cursor: pointer;',
        'box-shadow: 0 4px 14px rgba(0,0,0,0.6);'
      ].join('\n');

      closeBtn.onclick = () => {
        if (host._safeAreaListener) {
          window.removeEventListener('layout-safe-area-change', host._safeAreaListener);
        }
        host.remove();
        closeBtn.remove();
      };
      document.body.appendChild(closeBtn);

      // Keep standalone window from sliding behind the sidepanel when toggled
      host._safeAreaListener = (e) => {
        const l = e.detail?.left || 0;
        host.style.left = `${l}px`;
        host.style.width = `calc(100vw - ${l}px)`;
      };
      window.addEventListener('layout-safe-area-change', host._safeAreaListener);

      const app = new QuoraToys();
      window.quoraToysInstance = app;
      globalThis.quoraToysInstance = app;
      app.run({ container: host });
      return app;
    }
  static loadSample() {
      const app = QuoraStudioComponent.launchStandalone();
      setTimeout(() => {
        if (app && typeof app.loadSamplePuzzle === 'function') {
          app.loadSamplePuzzle();
        } else if (window.quoraToysInstance && typeof window.quoraToysInstance.loadSamplePuzzle === 'function') {
          window.quoraToysInstance.loadSamplePuzzle();
        }
      }, 120);
    }

  static loadFile(file) {
      if (!file) return;
      const app = QuoraStudioComponent.launchStandalone();
      setTimeout(() => {
        if (app && typeof app.loadFile === 'function') {
          app.loadFile(file);
        } else if (window.quoraToysInstance && typeof window.quoraToysInstance.loadFile === 'function') {
          window.quoraToysInstance.loadFile(file);
        }
      }, 120);
    }
}

globalThis.QuoraStudioComponent = QuoraStudioComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraStudioComponent;