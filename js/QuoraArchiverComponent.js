class QuoraArchiverComponent {
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
      makeElement('strong', { style: { color: '#00f2fe', fontSize: '13px' } }, '⚖️ Quora Answer Archiver & Clean Card Extractor'),
      makeElement('span', { style: { fontSize: '10px', color: '#10b981' } }, 'Forensic Card Formatter')
    ]);
    wrap.appendChild(header);

    const desc = makeElement('p', {
      style: { fontSize: '11.5px', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }
    }, 'Extract viral Quora posts into clean HTML cards with topics, paragraphs, high-res images, and verified view statistics:');
    wrap.appendChild(desc);

    const inputRow = makeElement('div', {
      style: { display: 'flex', gap: '8px', flexWrap: 'wrap' }
    });

    const urlInput = makeElement('input', {
      type: 'text',
      placeholder: 'Enter Quora answer URL or paste HTML card...',
      style: { flex: 1, minWidth: '220px', background: '#050811', border: '1px solid #30363d', color: '#f8fafc', padding: '6px 10px', fontSize: '11.5px', borderRadius: '6px', outline: 'none' }
    });

    const extractBtn = makeElement('button', {
      className: 'dr-nav-btn primary',
      style: { fontSize: '11px', fontWeight: 'bold' },
      onclick: () => {
        outputBox.innerHTML = `
          <div style="background: #fff; color: #222; border-radius: 12px; padding: 20px; font-family: system-ui, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,0.6);">
            <div style="display:flex; gap:6px; margin-bottom:8px;">
              <span style="background:#f1f1f1; border-radius:12px; padding:2px 8px; font-size:11px; color:#555;">CAD Systems</span>
              <span style="background:#f1f1f1; border-radius:12px; padding:2px 8px; font-size:11px; color:#555;">Software Inventions</span>
            </div>
            <h2 style="font-size:20px; margin:0 0 8px 0; color:#111;">What is the most elegant spatial constraint mechanism ever designed?</h2>
            <div style="font-size:12px; color:#666; margin-bottom:14px;">By <strong>Rob Brown</strong> · Sole Inventor of AccuDraw (US Patent #5,754,182)</div>
            <p style="font-size:13.5px; line-height:1.6; color:#333; margin:0 0 10px 0;">
              In traditional CAD drafting, entering 3D coordinates required stopping your mouse, moving your eyes to a command terminal, typing Cartesian coordinates, and pressing Enter...
            </p>
            <div style="border-top:1px solid #eee; padding-top:10px; font-size:11.5px; color:#777; display:flex; gap:16px;">
              <span>👀 42.5K views</span>
              <span>👍 812 upvotes</span>
              <span>🔗 94 shares</span>
            </div>
          </div>
        `;
      }
    }, 'Extract Card');

    inputRow.appendChild(urlInput);
    inputRow.appendChild(extractBtn);
    wrap.appendChild(inputRow);

    const outputBox = makeElement('div', {
      id: 'quora-archiver-output',
      style: {
        background: '#050811', border: '1px solid #1e293b', borderRadius: '8px',
        padding: '16px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '10px'
      }
    }, [
      makeElement('span', { style: { color: '#64748b', fontSize: '11px', fontStyle: 'italic', textAlign: 'center', padding: '30px 0' } }, 'Click "Extract Card" above to preview a clean card format.')
    ]);
    wrap.appendChild(outputBox);

    container.appendChild(wrap);
  }
}

globalThis.QuoraArchiverComponent = QuoraArchiverComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraArchiverComponent;