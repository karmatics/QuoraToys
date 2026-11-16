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

        if (typeof DomBasics !== 'undefined' && typeof DomBasics.run === 'function') {
          DomBasics.run();
        }

        this.env = env;
        this.rootElement = env.container;
        this.viewMode = 'app';
        this.activePageId = 'studio';
        globalThis._quoraToysAppInstance = this;

        const hash = (window.location.hash || '').replace(/^#\/?/, '').split('/')[0];
        const docHashes = ['studio', 'bookmarklet', 'extension', 'archiver', 'vision', 'architecture', 'annotation', 'docs'];
        if (hash && docHashes.includes(hash)) {
          await this.openDocsView(hash === 'docs' ? 'studio' : hash);
        } else {
          this.openAppView();
        }

        return this;
      }
  _buildSidePanel(pages) {
      if (!this.sidePanel) return;

      this.sidePanel.header.innerHTML = '';
      const headerTitle = document.createElement('div');
      headerTitle.style.cssText = 'font-family: monospace; font-size: 11px; font-weight: 800; color: #00e676; display: flex; align-items: center; gap: 8px; flex: 1;';
      headerTitle.innerHTML = '<span>📖</span><span>Docs &amp; Living Spec</span>';

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

      const toolsBox = document.createElement('div');
      toolsBox.style.cssText = 'border: 1.5px solid #00f2fe; background: rgba(0, 242, 254, 0.05); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.4);';
      toolsBox.innerHTML = `
        <span style="font-family: monospace; font-size: 10.5px; font-weight: 800; color: #00f2fe; text-transform: uppercase;">App Launchers &amp; LLM Loop</span>
        <button class="dr-nav-btn primary" style="justify-content: center; font-size: 11.5px; padding: 8px; font-weight: 800; background: linear-gradient(135deg, #0284c7 0%, #00f2fe 100%); color: #070a13;" onclick="_quoraToysAppInstance.openAppView()">
          ← Return to Annotation App
        </button>
        <button class="dr-nav-btn" style="justify-content: center; font-size: 11px; padding: 6px; color: #ffd700; border-color: rgba(255, 215, 0, 0.45);" onclick="if(typeof QuoraCleanStudioDialog!=='undefined'){QuoraCleanStudioDialog.open();}">
          ✨ Open Clean UI (Dialog)
        </button>
        <button class="dr-nav-btn" style="justify-content: center; font-size: 11px; padding: 6px; color: #00e676; border-color: rgba(0, 230, 118, 0.4);" onclick="_quoraToysAppInstance.selectChapter('studio')">
          🧩 Spot-The-Difference Studio
        </button>
      `;

      const specRow = makeElement('div', {
        style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginTop: '2px' }
      }, [
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { justifyContent: 'center', fontSize: '10.5px', padding: '5px', color: '#d2a8ff', borderColor: 'rgba(130, 87, 229, 0.5)' },
          onclick: () => {
            if (typeof CadPlanItemNotes !== 'undefined') CadPlanItemNotes.openPromptBuilderDialog(this.reader);
          }
        }, '⚡ Directives'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { justifyContent: 'center', fontSize: '10.5px', padding: '5px', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.45)' },
          onclick: () => {
            if (typeof CadPlanDocumentEditor !== 'undefined') {
              CadPlanDocumentEditor.openRevisionManager(() => this.reader?.renderCurrentDocument(), 'QuoraToys');
            }
          }
        }, '✏️ Revisions'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { gridColumn: '1 / -1', justifyContent: 'center', fontSize: '10.5px', padding: '5px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.45)' },
          onclick: () => {
            if (this.aardvark) this.aardvark.toggle();
          }
        }, '🔍 Aardvark Element Picker [Ctrl+Shift+A]')
      ]);
      toolsBox.appendChild(specRow);
      container.appendChild(toolsBox);

      const chaptersWrapper = document.createElement('div');
      chaptersWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 6px;';

      const localMap = (typeof CadPlanItemNotes !== 'undefined' && typeof CadPlanItemNotes.getLocalMap === 'function')
        ? CadPlanItemNotes.getLocalMap()
        : {};

      pages.forEach((page) => {
        const doc = page.docClass ? page.docClass() : null;
        const manifest = doc?.manifest ? doc.manifest() : [];
        const isCur = page.id === this.activePageId;

        let chapterNotesCount = 0;
        Object.keys(localMap).forEach(k => {
          if (k.startsWith(`QuoraToys:${page.id}:`)) {
            chapterNotesCount += (localMap[k] || []).filter(n => n.status !== 'resolved').length;
          }
        });

        const card = document.createElement('div');
        card.className = `cp-chapter-card ${isCur ? 'active' : ''}`;
        card.dataset.pageId = page.id;
        card.style.cssText = `background: ${isCur ? 'rgba(0, 230, 118, 0.08)' : 'rgba(15, 23, 42, 0.45)'}; border: 1px solid ${isCur ? 'rgba(0, 230, 118, 0.6)' : '#1e293b'}; border-radius: 8px; overflow: hidden; cursor: pointer;`;

        const headerRow = document.createElement('div');
        headerRow.className = 'cp-chapter-header-row';
        headerRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; gap: 6px;';

        const left = document.createElement('div');
        left.className = 'cp-chapter-left-wrap';
        left.style.cssText = 'display: flex; align-items: center; gap: 6px; flex: 1;';

        const chevron = document.createElement('span');
        chevron.className = 'cp-chapter-chevron';
        chevron.style.cssText = 'font-size: 9px; color: #64748b; width: 10px;';
        chevron.textContent = isCur ? '▼' : '▶';

        const title = document.createElement('span');
        title.className = 'cp-chapter-title-text';
        title.style.cssText = `font-size: 11.5px; font-weight: 700; color: ${isCur ? '#00e676' : '#f8fafc'};`;
        title.textContent = page.title;

        left.appendChild(chevron);
        left.appendChild(title);
        headerRow.appendChild(left);

        if (chapterNotesCount > 0) {
          const badge = document.createElement('span');
          badge.style.cssText = 'background: rgba(0, 242, 254, 0.2); color: #00f2fe; border: 1px solid #00f2fe88; font-size: 9px; padding: 1px 6px; border-radius: 10px; font-weight: 800; font-family: monospace;';
          badge.textContent = `${chapterNotesCount} 📝`;
          headerRow.appendChild(badge);
        }

        card.appendChild(headerRow);

        const secList = document.createElement('div');
        secList.className = 'cp-sec-list';
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
    }
  selectChapter(pageId, targetBlockId = null) {
      if (pageId === 'annotation' && !targetBlockId) {
        this.openAppView();
        return;
      }

      if (this.viewMode !== 'docs' || !this.reader) {
        this.openDocsView(pageId).then(() => {
          if (targetBlockId && this.reader?.highlightTarget) {
            setTimeout(() => this.reader.highlightTarget(targetBlockId), 220);
          }
        });
        return;
      }

      const isPageChange = (this.activePageId !== pageId);
      this.activePageId = pageId;

      if (pageId === 'annotation') {
        document.body.classList.add('dr-studio-mode');
      } else {
        document.body.classList.remove('dr-studio-mode');
      }

      if (this.sidePanel) {
        this.sidePanel.contentContainer.querySelectorAll('.cp-chapter-card').forEach(card => {
          const isCur = card.dataset.pageId === pageId;
          card.style.background = isCur ? 'rgba(0, 230, 118, 0.08)' : 'rgba(15, 23, 42, 0.45)';
          card.style.borderColor = isCur ? 'rgba(0, 230, 118, 0.6)' : '#1e293b';

          const titleText = card.querySelector('.cp-chapter-title-text');
          if (titleText) titleText.style.color = isCur ? '#00e676' : '#f8fafc';

          const chevron = card.querySelector('.cp-chapter-chevron');
          if (chevron) chevron.textContent = isCur ? '▼' : '▶';

          const secList = card.querySelector('.cp-sec-list');
          if (secList) secList.style.display = isCur ? 'flex' : 'none';
        });
      }

      if (this.reader && typeof this.reader.switchPage === 'function' && isPageChange) {
        this.reader.switchPage(pageId, true);
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
      this._teardownDocs();
      this.rootElement = null;
    }
  openAppView() {
      this._teardownDocs();
      this.viewMode = 'app';

      document.body.classList.remove('dr-studio-mode');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';

      this.rootElement.innerHTML = '';
      this.rootElement.style.cssText = 'width:100%;height:100vh;margin:0;padding:0;overflow:hidden;box-sizing:border-box;';

      if (typeof QuoraAnnotationComponent !== 'undefined') {
        QuoraAnnotationComponent.render(this.rootElement);
      }
    }

  async openDocsView(initialPageId = 'studio') {
        this._teardownDocs();
        this.viewMode = 'docs';

        document.documentElement.style.overflow = '';
        document.documentElement.style.overflowY = 'auto';
        document.body.style.overflow = '';
        document.body.style.overflowY = 'auto';

        this.rootElement.innerHTML = '';
        this.rootElement.style.cssText = 'width:100%;min-height:100vh;height:auto;overflow-x:hidden;overflow-y:visible;box-sizing:border-box;';

        const pages = [
          { id: 'studio', title: '1. Spot-The-Difference Comparator', docClass: () => globalThis.QuoraStudioContent },
          { id: 'bookmarklet', title: '2. In-Situ Bookmarklet Hub', docClass: () => globalThis.QuoraBookmarkletContent },
          { id: 'extension', title: '3. Chrome Extension & Ambient Tools', docClass: () => globalThis.QuoraExtensionContent },
          { id: 'archiver', title: '4. Quora Answer Archiver & Scraper', docClass: () => globalThis.QuoraArchiverContent },
          { id: 'vision', title: '5. The Sovereign Feed: Anti-Slop & Community Leverage', docClass: () => globalThis.QuoraVisionContent },
          { id: 'architecture', title: '6. Architecture Audit, Math Specifications & Refactor Blueprint', docClass: () => globalThis.QuoraArchitectureContent },
          { id: 'annotation', title: '7. Annotation Guide & Interactive Embed', docClass: () => globalThis.QuoraAnnotationContent }
        ];

        this.activePageId = pages.some(p => p.id === initialPageId) ? initialPageId : 'studio';

        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', `#${this.activePageId}`);
        }

        if (typeof SidePanel !== 'undefined') {
          this.sidePanel = new SidePanel('left', 300, null);
        }

        this.reader = new DocumentReader({
          container: this.rootElement,
          brandTitle: 'QuoraToys Docs',
          brandIcon: '📖',
          dossierId: 'QuoraToys',
          sidePanel: this.sidePanel,
          pages,
          itemNotes: globalThis.CadPlanItemNotes || null,
          itemNotesClass: globalThis.CadPlanItemNotes || null,
          editorClass: globalThis.CadPlanDocumentEditor || null
        });

        const origSwitchPage = this.reader.switchPage.bind(this.reader);
        this.reader.switchPage = (pageId, updateUrl = true) => {
          origSwitchPage(pageId, updateUrl);
          this.activePageId = pageId;
          if (this.sidePanel) this._buildSidePanel(pages);
        };

        await this.reader.init();
        if (this.reader.currentPageId !== this.activePageId) {
          this.reader.switchPage(this.activePageId, false);
        }

        if (this.reader.navBar) {
          const backBtn = makeElement('button', {
            className: 'dr-nav-btn primary',
            style: { padding: '5px 12px', fontSize: '0.78rem', fontWeight: '800', marginRight: '6px' },
            onclick: () => {
              if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
              this.openAppView();
            }
          }, '← Back to App');
          const leftGrp = this.reader.navBar.firstElementChild;
          if (leftGrp) leftGrp.prepend(backBtn);
        }

        if (typeof CadPlanAardvark !== 'undefined') {
          this.aardvark = new CadPlanAardvark({
            container: this.rootElement,
            dossierId: 'QuoraToys',
            itemNotes: globalThis.CadPlanItemNotes || null,
            documentReader: this.reader
          });
          this.aardvark.init();
          this.reader.aardvark = this.aardvark;
        }

        this._aardvarkHotkeyHandler = (e) => {
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            if (this.aardvark) this.aardvark.toggle();
          }
        };
        window.addEventListener('keydown', this._aardvarkHotkeyHandler);

        if (typeof CadPlanItemNotes !== 'undefined' && typeof CadPlanItemNotes.subscribe === 'function') {
          this._unsubSideNotes = CadPlanItemNotes.subscribe(() => {
            if (this.sidePanel && this.viewMode === 'docs') this._buildSidePanel(pages);
          });
        }

        if (this.sidePanel) {
          this._buildSidePanel(pages);
          if (window.innerWidth >= 860) {
            this.sidePanel.open();
          }
        }
      }
  _teardownDocs() {
      if (this._aardvarkHotkeyHandler) {
        window.removeEventListener('keydown', this._aardvarkHotkeyHandler);
        this._aardvarkHotkeyHandler = null;
      }
      if (this._unsubSideNotes) {
        try { this._unsubSideNotes(); } catch (e) {}
        this._unsubSideNotes = null;
      }
      if (this.aardvark) {
        this.aardvark.destroy();
        this.aardvark = null;
      }
      if (this.sidePanel) {
        this.sidePanel.destroy();
        this.sidePanel = null;
        if (typeof SidePanel !== 'undefined' && typeof SidePanel.updateGlobalSafeArea === 'function') {
          SidePanel.updateGlobalSafeArea();
        }
      }
      if (this.reader && typeof this.reader.destroy === 'function') {
        this.reader.destroy();
        this.reader = null;
      }
      document.body.classList.remove('dr-studio-mode');
    }
}

globalThis.QuoraToysApp = QuoraToysApp;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraToysApp;