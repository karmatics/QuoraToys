class QuoraBookmarkletComponent {
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

    const topHeader = makeElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }
    }, [
      makeElement('strong', { style: { color: '#00e676', fontSize: '13px' } }, '⭐ In-Situ Bookmarklet Hub (Drag Target Generator)'),
      makeElement('span', { style: { fontSize: '10px', color: '#94a3b8' } }, 'Direct Quora In-Page Injection')
    ]);
    wrap.appendChild(topHeader);

    const desc = makeElement('p', {
      style: { fontSize: '11.5px', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }
    }, 'Browsers automatically name a bookmark using the link text when you drag it to the bookmarks bar. Choose your preferred bookmark name below:');
    wrap.appendChild(desc);

    // Title selection row
    let currentTitle = '🧩 QuoraToys';

    const titleSelectorRow = makeElement('div', {
      style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }
    });

    const makeTitlePresetBtn = (label) => {
      const b = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '4px 8px', fontSize: '11px', color: currentTitle === label ? '#00e676' : '#94a3b8' },
        onclick: () => {
          currentTitle = label;
          customInput.value = label;
          updateLink();
          titleSelectorRow.querySelectorAll('button').forEach(btn => btn.style.color = '#94a3b8');
          b.style.color = '#00e676';
        }
      }, label);
      return b;
    };

    titleSelectorRow.appendChild(makeTitlePresetBtn('🧩 QuoraToys'));
    titleSelectorRow.appendChild(makeTitlePresetBtn('✨ SpotDiff'));
    titleSelectorRow.appendChild(makeTitlePresetBtn('🔍 Quora Comparator'));

    const customInput = makeElement('input', {
      type: 'text',
      value: currentTitle,
      style: { background: '#090d16', border: '1px solid #30363d', color: '#00e676', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', width: '130px' }
    });
    customInput.oninput = (e) => {
      currentTitle = e.target.value.trim() || '🧩 QuoraToys';
      updateLink();
    };

    titleSelectorRow.appendChild(makeElement('span', { style: { fontSize: '11px', color: '#64748b' } }, 'Custom:'));
    titleSelectorRow.appendChild(customInput);
    wrap.appendChild(titleSelectorRow);

    // The Drag-and-Drop Anchor Card
    const anchorCard = makeElement('div', {
      style: {
        background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.3)',
        borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
      }
    });

    const dragAnchor = makeElement('a', {
      id: 'quora-draggable-bookmarklet',
      href: '#',
      draggable: true,
      style: {
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '10px 20px', background: 'linear-gradient(135deg, #0d2818 0%, #161b22 100%)',
        color: '#00e676', border: '2px solid #00e676', borderRadius: '8px',
        fontWeight: 'bold', fontSize: '13px', cursor: 'grab', textDecoration: 'none',
        boxShadow: '0 4px 14px rgba(0, 230, 118, 0.25)', userSelect: 'none'
      }
    }, currentTitle);

    const hintText = makeElement('span', {
      style: { fontSize: '10.5px', color: '#94a3b8', textAlign: 'center' }
    }, '👆 Drag this button up to your browser Bookmarks / Favorites bar (it will be saved as exactly "' + currentTitle + '")');

    anchorCard.appendChild(dragAnchor);
    anchorCard.appendChild(hintText);
    wrap.appendChild(anchorCard);

    function updateLink() {
      dragAnchor.textContent = currentTitle;
      hintText.textContent = `👆 Drag this button up to your browser Bookmarks bar (will be named "${currentTitle}")`;

      const code = `javascript:(function(){if(window.__quoraToysActive){if(window.__quoraToysInstance)window.__quoraToysInstance.openMainWindow();return;}window.__quoraToysActive=true;var s=document.createElement('script');s.src='http://localhost:8080/QuoraToys/js/QuoraToys.js?v='+Date.now();s.onload=function(){var c=document.createElement('link');c.rel='stylesheet';c.href='http://localhost:8080/QuoraToys/css/basicsWithDialogBox.css?v='+Date.now();document.head.appendChild(c);QuoraToys.launchInSitu();};s.onerror=function(){var user=(location.hostname.endsWith('.github.io')?location.hostname.split('.')[0]:'karmatics');var s2=document.createElement('script');s2.src='https://'+user+'.github.io/QuoraToys/js/QuoraToys.js?v='+Date.now();s2.onload=function(){var c2=document.createElement('link');c2.rel='stylesheet';c2.href='https://'+user+'.github.io/QuoraToys/css/basicsWithDialogBox.css?v='+Date.now();document.head.appendChild(c2);QuoraToys.launchInSitu();};document.head.appendChild(s2);};document.head.appendChild(s);})();`;

      dragAnchor.href = code;
      codeBox.value = code;
    }

    const codeBox = makeElement('textarea', {
      readOnly: true,
      style: {
        width: '100%', height: '55px', background: '#050811', color: '#7ee787',
        border: '1px solid #1e293b', borderRadius: '6px', padding: '8px', fontSize: '10px',
        boxSizing: 'border-box', outline: 'none'
      }
    });
    wrap.appendChild(codeBox);

    const bottomRow = makeElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
    }, [
      makeElement('button', {
        className: 'dr-nav-btn',
        style: { fontSize: '11px' },
        onclick: () => {
          navigator.clipboard.writeText(codeBox.value).then(() => alert('✓ Copied bookmarklet code to clipboard!'));
        }
      }, '📋 Copy Raw Code'),
      makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { fontSize: '11px', fontWeight: 'bold' },
        onclick: () => {
          if (typeof QuoraToys !== 'undefined' && QuoraToys.launchInSitu) {
            QuoraToys.launchInSitu();
          } else {
            alert('QuoraToys.launchInSitu ready on host.');
          }
        }
      }, '⚡ Test In-Situ Mode Here')
    ]);
    wrap.appendChild(bottomRow);

    container.appendChild(wrap);
    updateLink();
  }
}

globalThis.QuoraBookmarkletComponent = QuoraBookmarkletComponent;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraBookmarkletComponent;