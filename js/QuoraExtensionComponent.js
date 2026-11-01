class QuoraExtensionComponent {
  static render(container) {
    container.innerHTML = '';

    const wrap = makeElement('div', {
      style: {
        background: '#070a13',
        border: '1.5px solid #21262d',
        borderRadius: '12px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontFamily: 'monospace'
      }
    });

    const header = makeElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }
    }, [
      makeElement('strong', { style: { color: '#00f2fe', fontSize: '13px' } }, '🚀 Dedicated Chrome Extension: QuoraToys & Power Tools'),
      makeElement('span', { style: { fontSize: '10px', color: '#10b981', background: '#10b98122', padding: '2px 8px', borderRadius: '12px' } }, 'Staged & Ready')
    ]);
    wrap.appendChild(header);

    const pathBox = makeElement('div', {
      style: {
        background: '#050811', border: '1px solid #1e293b', borderRadius: '8px',
        padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
      }
    }, [
      makeElement('div', {}, [
        makeElement('span', { style: { color: '#64748b', fontSize: '10px', display: 'block' } }, 'UNPACKED EXTENSION DIRECTORY:'),
        makeElement('strong', { style: { color: '#00f2fe', fontSize: '11.5px' } }, '/Users/rob/source/LunoProjects/QuoraToys/extension')
      ]),
      makeElement('button', {
        className: 'dr-nav-btn',
        style: { fontSize: '10.5px' },
        onclick: () => {
          navigator.clipboard.writeText('/Users/rob/source/LunoProjects/QuoraToys/extension');
          alert('✓ Copied extension path to clipboard!');
        }
      }, '📋 Copy Path')
    ]);
    wrap.appendChild(pathBox);

    const instructions = makeElement('div', {
      style: { background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', fontSize: '11.5px', color: '#cbd5e1', lineHeight: '1.5' }
    }, [
      makeElement('strong', { style: { color: '#f8fafc', display: 'block', marginBottom: '6px' } }, 'How to load into Chrome / Brave / Edge:'),
      '1. Open ', makeElement('code', { style: { color: '#00f2fe' } }, 'chrome://extensions'), ' in a new browser tab.', makeElement('br'),
      '2. Toggle ', makeElement('strong', { style: { color: '#f59e0b' } }, 'Developer mode'), ' ON in the top right corner.', makeElement('br'),
      '3. Click ', makeElement('strong', {}, 'Load unpacked'), ' in the top left.', makeElement('br'),
      '4. Paste the path above and click Select Folder!'
    ]);
    wrap.appendChild(instructions);

    const toolsGrid = makeElement('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginTop: '6px' }
    });

    const makeToolCard = (icon, title, desc, col) => {
      return makeElement('div', {
        style: { background: '#090d16', border: `1px solid ${col}44`, borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }
      }, [
        makeElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
          makeElement('span', { style: { fontSize: '14px' } }, icon),
          makeElement('strong', { style: { color: col, fontSize: '12px' } }, title)
        ]),
        makeElement('span', { style: { fontSize: '10.5px', color: '#94a3b8', lineHeight: '1.4' } }, desc)
      ]);
    };

    toolsGrid.appendChild(makeToolCard('🧩', 'Spot-The-Difference', 'In-situ optical comparator over any Quora post.', '#00e676'));
    toolsGrid.appendChild(makeToolCard('🔍', 'Aardvark DOM Tool', 'Element inspector, wider/narrower, and isolator.', '#00f2fe'));
    toolsGrid.appendChild(makeToolCard('✏️', 'Drawing & Annotation', 'Cubic Bézier spline curve annotations.', '#d2a8ff'));
    toolsGrid.appendChild(makeToolCard('🎙️', 'Voice Dictation', 'Speech-to-text floating widget.', '#f59e0b'));

    wrap.appendChild(toolsGrid);
    container.appendChild(wrap);
  }
}

globalThis.QuoraExtensionComponent = QuoraExtensionComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraExtensionComponent;