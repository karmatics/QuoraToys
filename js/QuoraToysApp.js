class QuoraToysApp {
  constructor() {
    this.reader = null;
    this.sidePanel = null;
    this.rootElement = null;
    this.activePageId = 'studio';
  }

  async run(env) {
    if (this.rootElement) this.destroy();

    if (!env || !env.container) {
      throw new Error('[QuoraToysApp] run() requires an environment object with a valid container.');
    }

    this.env = env;
    this.rootElement = env.container;

    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';

    this.rootElement.style.overflowX = 'hidden';
    this.rootElement.style.overflowY = 'visible';
    this.rootElement.style.height = 'auto';
    this.rootElement.style.minHeight = '100vh';
    this.rootElement.style.boxSizing = 'border-box';
    this.rootElement.style.width = '100%';

    const pages = [
      { id: 'studio', title: '0. Spot-The-Difference Studio', docClass: () => globalThis.QuoraStudioContent },
      { id: 'bookmarklet', title: '1. In-Situ Bookmarklet Hub', docClass: () => globalThis.QuoraBookmarkletContent },
      { id: 'extension', title: '2. Chrome Extension & Ambient Tools', docClass: () => globalThis.QuoraExtensionContent },
      { id: 'archiver', title: '3. Quora Answer Archiver & Scraper', docClass: () => globalThis.QuoraArchiverContent },
      { id: 'roadmap', title: '4. Future Toys & Visual Solvers', docClass: () => globalThis.QuoraRoadmapContent }
    ];

    this.reader = new DocumentReader({
      container: this.rootElement,
      brandTitle: 'QuoraToys Suite',
      brandIcon: '🧩',
      dossierId: 'QuoraToys',
      pages: pages
    });

    await this.reader.init();

    if (typeof SidePanel !== 'undefined') {
      this.sidePanel = new SidePanel('left', 300, null);
      this._buildSidePanel(pages);
      this.sidePanel.open();
    }

    globalThis._quoraToysAppInstance = this;
    return this;
  }

  _buildSidePanel(pages) {
    if (!this.sidePanel) return;

    this.sidePanel.header.innerHTML = '';
    const headerTitle = document.createElement('div');
    headerTitle.style.cssText = 'font-family: monospace; font-size: 11px; font-weight: 800; color: #00e676; display: flex; align-items: center; gap: 8px; flex: 1;';
    headerTitle.innerHTML = '<span>🧩</span><span>QuoraToys Navigator</span>';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dr-nav-btn';
    closeBtn.style.cssText = 'padding: 3px 8px; font-size: 10px; border-radius: 4px;';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => this.sidePanel.close();

    this.sidePanel.header.appendChild(headerTitle);
    this.sidePanel.header.appendChild(closeBtn);

    const container = this.sidePanel.contentContainer;
    container.innerHTML = '';
    container.style.cssText = 'flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px; display: flex; flex-direction: column; gap: 10px; font-family: system-ui, sans-serif;';

    const banner = document.createElement('div');
    banner.style.cssText = 'background: rgba(0, 230, 118, 0.08); border: 1px solid rgba(0, 230, 118, 0.25); border-radius: 8px; padding: 8px 10px; font-size: 11px; font-family: monospace; display: flex; justify-content: space-between; align-items: center;';
    banner.innerHTML = `
      <div>
        <strong style="color: #00e676; display: block;">✨ QuoraToys Engine</strong>
        <span style="color: #94a3b8; font-size: 10px;">3-in-1: Web • Bookmarklet • Ext</span>
      </div>
      <span style="background: rgba(0, 230, 118, 0.2); color: #00e676; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9.5px;">ACTIVE</span>
    `;
    container.appendChild(banner);

    const chaptersWrapper = document.createElement('div');
    chaptersWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    pages.forEach((page) => {
      const doc = page.docClass ? page.docClass() : null;
      const manifest = doc?.manifest ? doc.manifest() : [];
      const isCur = page.id === this.activePageId;

      const card = document.createElement('div');
      card.className = `cp-chapter-card ${isCur ? 'active' : ''}`;
      card.dataset.pageId = page.id;
      card.style.cssText = `background: ${isCur ? 'rgba(0, 230, 118, 0.08)' : 'rgba(15, 23, 42, 0.45)'}; border: 1px solid ${isCur ? 'rgba(0, 230, 118, 0.6)' : '#1e293b'}; border-radius: 8px; overflow: hidden; cursor: pointer;`;

      const headerRow = document.createElement('div');
      headerRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; gap: 6px;';

      const left = document.createElement('div');
      left.style.cssText = 'display: flex; align-items: center; gap: 6px; flex: 1;';

      const chevron = document.createElement('span');
      chevron.style.cssText = 'font-size: 9px; color: #64748b; width: 10px;';
      chevron.textContent = isCur ? '▼' : '▶';

      const title = document.createElement('span');
      title.style.cssText = `font-size: 11.5px; font-weight: 700; color: ${isCur ? '#00e676' : '#f8fafc'};`;
      title.textContent = page.title;

      left.appendChild(chevron);
      left.appendChild(title);
      headerRow.appendChild(left);
      card.appendChild(headerRow);

      const secList = document.createElement('div');
      secList.style.cssText = `display: ${isCur ? 'flex' : 'none'}; flex-direction: column; gap: 3px; padding: 4px 8px 8px 20px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(5,8,17,0.7);`;

      manifest.forEach((sec) => {
        const secItem = document.createElement('div');
        secItem.style.cssText = 'color: #94a3b8; font-size: 11px; padding: 4px 6px; border-radius: 4px; cursor: pointer;';
        secItem.textContent = `• ${sec.title}`;
        secItem.onclick = (e) => {
          e.stopPropagation();
          const firstBlock = sec.blocks?.[0]?.id || null;
          this.selectChapter(page.id, firstBlock);
        };
        secList.appendChild(secItem);
      });

      card.appendChild(secList);

      headerRow.onclick = () => this.selectChapter(page.id, null);
      chaptersWrapper.appendChild(card);
    });

    container.appendChild(chaptersWrapper);

    const toolsBox = document.createElement('div');
    toolsBox.style.cssText = 'margin-top: 10px; border: 1px solid #1e293b; background: #080c16; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;';
    toolsBox.innerHTML = `
      <span style="font-family: monospace; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Quick Launchers</span>
      <button class="dr-nav-btn primary" style="justify-content: center; font-size: 11px; padding: 6px; background: #0284c7; color: #fff;" onclick="QuoraStudioComponent.launchStandalone()">
        🖼️ Launch Standalone Comparator
      </button>
      <button class="dr-nav-btn" style="justify-content: center; font-size: 11px; padding: 6px; color: #00e676; border-color: #00e67644;" onclick="_quoraToysAppInstance.selectChapter('bookmarklet')">
        ⭐ Get Bookmarklet
      </button>
    `;
    container.appendChild(toolsBox);
  }

  selectChapter(pageId, targetBlockId = null) {
    const isPageChange = (this.activePageId !== pageId);
    this.activePageId = pageId;

    if (this.sidePanel) {
      this.sidePanel.contentContainer.querySelectorAll('.cp-chapter-card').forEach(card => {
        const isCur = card.dataset.pageId === pageId;
        card.style.background = isCur ? 'rgba(0, 230, 118, 0.08)' : 'rgba(15, 23, 42, 0.45)';
        card.style.borderColor = isCur ? 'rgba(0, 230, 118, 0.6)' : '#1e293b';
        const chevron = card.querySelector('span');
        if (chevron) chevron.textContent = isCur ? '▼' : '▶';
        const list = card.querySelector('div:last-child');
        if (list && list !== card.children[0]) list.style.display = isCur ? 'flex' : 'none';
      });
    }

    if (this.reader && typeof this.reader.switchPage === 'function') {
      if (isPageChange) this.reader.switchPage(pageId, true);
    }

    if (targetBlockId) {
      setTimeout(() => {
        if (this.reader && typeof this.reader.highlightTarget === 'function') {
          this.reader.highlightTarget(targetBlockId);
        }
      }, isPageChange ? 220 : 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  destroy() {
    if (this.sidePanel) {
      this.sidePanel.destroy();
      this.sidePanel = null;
    }
    if (this.reader && typeof this.reader.destroy === 'function') {
      this.reader.destroy();
      this.reader = null;
    }
    this.rootElement = null;
  }
}

globalThis.QuoraToysApp = QuoraToysApp;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraToysApp;