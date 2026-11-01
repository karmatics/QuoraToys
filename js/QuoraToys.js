class QuoraToys {

  async run(env) {
    if (!env || !env.container) {
      throw new Error("[QuoraToys] run() requires an environment object with a valid container.");
    }
    this.env = env;
    this.targetElement = env.container;
    this.targetElement.classList.add('fdr-app-container');

    this.sourceImage = null;
    this.imageSourceUrl = null;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.zoom = 1.0;

    this.mainDialog = null;
    this.mainImgElement = null;
    this.mainViewport = null;
    this.cropSurface = null;
    this.selectionBox = null;
    this.selectionTooltip = null;
    this.zoomLabel = null;
    this.metaLabel = null;
    this.cropBtn = null;

    this.isCropMode = false;
    this.activeCrop = null;
    this.overlayDialog = null;
    this.overlayViewport = null;
    this.overlayClippedImg = null;
    this.flashInterval = null;
    this.isFlashing = false;
    this.currentOpacity = 0.5;

    // Scrolling Stripes Mode properties
    this.isStripesMode = false;
    this.stripeWidth = 50;
    this.stripeSpeed = 45;
    this.stripeOffset = 0;
    this.stripeRunning = false;
    this.stripeDirection = 1;
    this.stripeRafId = null;

    // Difference Circles State (Z-Order is array order)
    this.diffCircles = [];
    this.selectedDiffId = null;
    this.isCircleDiffMode = false;
    this.circleDrawSurface = null;
    this.overlaySvgLayer = null;
    this.solutionDialog = null;
    this.helpDialog = null;

    // Solution Canvas Appearance & Customization Settings
    this.solutionDarken = 0.35;
    this.solutionBlur = 4;
    this.solutionOutlineColor = '#00e676';
    this.solutionOutlineWidth = 3;
    this.solutionShowLabels = false;
    this.solutionConnectorStyle = 'tangents';
    this.solutionBlendAnchor = true;

    // Background Canvas Option: 'transparent' | 'gradient' | 'color'
    this.solutionBgMode = 'transparent';
    this.solutionBgColor = '#090d16';

    this._buildWelcomeScreen();
    this._initGlobalListeners();
  }

  _buildWelcomeScreen() {
    this.targetElement.innerHTML = '';

    const welcome = document.createElement('div');
    welcome.className = 'fdr-welcome-screen';

    const brand = document.createElement('div');
    brand.className = 'fdr-brand-banner';
    brand.innerHTML = `
      <div class="fdr-brand-icon">✨</div>
      <div class="fdr-brand-title">QuoraToys <span class="fdr-brand-badge">Tool #1: Spot-The-Difference</span></div>
    `;

    const dropzone = document.createElement('div');
    dropzone.className = 'fdr-dropzone';
    dropzone.innerHTML = `
      <div class="fdr-dropzone-icon">🧩</div>
      <div class="fdr-dropzone-title">Spot-the-Difference Comparator & Solution Studio</div>
      <div class="fdr-dropzone-subtitle">
        Paste any puzzle image from Quora with <b>Ctrl+V</b> (or Command+V),<br>
        drag & drop an image from your browser or desktop, or select a file.
      </div>
      <div class="fdr-dropzone-actions">
        <button class="fdr-btn fdr-btn-primary" id="fdr-choose-file-btn">📁 Choose Image File</button>
        <button class="fdr-btn fdr-btn-accent" id="fdr-sample-puzzle-btn">🧩 Load Sample Puzzle</button>
        <button class="fdr-btn" id="fdr-welcome-help-btn">📖 How It Works</button>
      </div>
    `;

    const docs = document.createElement('div');
    docs.className = 'fdr-docs-card';
    docs.innerHTML = `
      <div class="fdr-docs-header">
        <span>💡 What is this and why use it?</span>
      </div>
      <div class="fdr-docs-why">
        <b>Why use this tool?</b> Quora puzzle questions rely on human saccadic memory limits when comparing side-by-side images.
        QuoraToys allows you to superimpose one half directly on the other with pixel-perfect alignment. 
        Using <b>50% Alpha</b>, <b>Optical Flashing</b>, or <b>Scrolling Stripes</b>, any alteration instantly reveals itself.
      </div>
    `;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('#fdr-sample-puzzle-btn')) {
        this.loadSamplePuzzle();
        return;
      }
      if (e.target.closest('#fdr-welcome-help-btn')) {
        this.openDocumentationDialog();
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.loadFile(e.target.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.handleDrop(e);
    });

    welcome.append(brand, dropzone, docs, fileInput);
    this.targetElement.appendChild(welcome);
    this.welcomeElement = welcome;
  }

  _initGlobalListeners() {
    this._onPaste = (e) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              this.loadFile(file);
              return;
            }
          }
        }
      }
    };
    window.addEventListener('paste', this._onPaste);

    this._onKeyDown = (e) => {
      if (!this.overlayDialog || !this.overlayDialog.element) return;
      const isOverlayActive = document.activeElement && this.overlayDialog.element.contains(document.activeElement);
      if (isOverlayActive || this.overlayDialog.element.classList.contains('uw-active')) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') { this.nudgeOverlay(-step, 0); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { this.nudgeOverlay(step, 0); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { this.nudgeOverlay(0, -step); e.preventDefault(); }
        else if (e.key === 'ArrowDown') { this.nudgeOverlay(0, step); e.preventDefault(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (this.diffCircles.length > 0) {
          this.undoLastDiff();
          e.preventDefault();
        }
      }
      if (this.solutionDialog && this.selectedDiffId) {
        if (e.key === ']' && !e.shiftKey) { this.moveSelectedDiffLayer(1); e.preventDefault(); }
        else if (e.key === '[' && !e.shiftKey) { this.moveSelectedDiffLayer(-1); e.preventDefault(); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteSelectedDiff(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  handleDrop(e) {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      this.loadFile(e.dataTransfer.files[0]);
      return;
    }
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL');
    if (uri && (uri.startsWith('http') || uri.startsWith('data:image/'))) {
      this.loadImageFromUrl(uri);
    }
  }

  loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.loadImageFromUrl(ev.target.result, file.name);
    };
    reader.readAsDataURL(file);
  }

  loadImageFromUrl(url, title = 'Puzzle Source Image') {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return;

      this.sourceImage = img;
      this.imageSourceUrl = url;
      this.naturalWidth = w;
      this.naturalHeight = h;
      this.currentTitle = title;
      this.diffCircles = [];
      this.selectedDiffId = null;

      if (this.welcomeElement) {
        this.welcomeElement.style.display = 'none';
      }

      this.openMainWindow();
    };
    img.src = url;
  }

  loadSamplePuzzle() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const drawScene = (offsetX, hasDifferences) => {
      const skyGrad = ctx.createLinearGradient(offsetX, 0, offsetX, 260);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(offsetX, 0, 400, 260);

      // Sun
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(offsetX + 330, 60, hasDifferences ? 36 : 28, 0, Math.PI * 2);
      ctx.fill();

      // House
      ctx.fillStyle = hasDifferences ? '#f97316' : '#ef4444';
      ctx.fillRect(offsetX + 140, 210, 110, 90);

      // Roof
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(offsetX + 130, 210);
      ctx.lineTo(offsetX + 195, 140);
      ctx.lineTo(offsetX + 260, 210);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(hasDifferences ? 'PUZZLE B (Differences)' : 'PUZZLE A (Original)', offsetX + 20, 30);
    };

    drawScene(0, false);
    drawScene(400, true);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(400, 0);
    ctx.lineTo(400, 400);
    ctx.stroke();

    this.loadImageFromUrl(canvas.toDataURL('image/png'), 'Sample Spot-the-Difference');
  }

  openDocumentationDialog() {
    if (this.helpDialog) {
      this.helpDialog.bringToFront();
      return;
    }

    const content = document.createElement('div');
    content.className = 'fdr-doc-modal-body';
    content.innerHTML = `
      <h4>✨ Spot-The-Difference Comparator</h4>
      <p>Superimpose two halves of a visual puzzle to instantly expose modifications with zero eye strain.</p>
      <ul>
        <li><b>50% Alpha Opacity:</b> Mismatched pixels look doubled or ghosted.</li>
        <li><b>⚡ Flashing Mode:</b> Toggles overlay at 600ms cycles, triggering the visual motion reflex.</li>
        <li><b>▤ Scrolling Stripes:</b> Sweeping zebra waves make hidden alterations flutter.</li>
      </ul>
    `;

    const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
      ? UITools.makeDialog
      : (opts => new DialogBox(opts));

    this.helpDialog = dialogMaker({
      title: 'QuoraToys Guide',
      contentElement: content,
      size: [520, 420],
      position: [80, 80],
      onClose: () => { this.helpDialog = null; }
    });
  }

  openMainWindow() {
    if (this.mainDialog) {
      this.mainDialog.close();
      this.mainDialog = null;
    }
    if (this.overlayDialog) {
      this.overlayDialog.close();
      this.overlayDialog = null;
    }

    const availW = Math.max(300, (window.innerWidth || 1024) - 60);
    const availH = Math.max(200, (window.innerHeight || 768) - 120);
    const overheadH = 75;

    const scaleX = availW / this.naturalWidth;
    const scaleY = (availH - overheadH) / this.naturalHeight;
    this.zoom = Math.max(0.2, Math.min(1.0, Math.min(scaleX, scaleY)));

    const initialW = Math.round(this.naturalWidth * this.zoom);
    const initialH = Math.round(this.naturalHeight * this.zoom) + overheadH;

    const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
      ? UITools.makeDialog
      : (opts => new DialogBox(opts));

    this.mainDialog = dialogMaker({
      title: `${this.currentTitle || 'Source Image'} (${this.naturalWidth}×${this.naturalHeight})`,
      size: [initialW, initialH],
      position: [30, 40],
      noPadding: true,
      allowTransparency: false,
      allowMaximize: true,
      onClose: () => {
        if (this.overlayDialog) this.overlayDialog.close();
        if (this.solutionDialog) this.solutionDialog.close();
        if (this.welcomeElement) this.welcomeElement.style.display = 'flex';
      }
    });

    const content = this.mainDialog.contentElement;
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.width = '100%';
    content.style.height = '100%';

    const toolbar = document.createElement('div');
    toolbar.className = 'fdr-window-toolbar';

    const actionGroup = document.createElement('div');
    actionGroup.className = 'fdr-toolbar-group';

    this.cropBtn = document.createElement('button');
    this.cropBtn.className = 'fdr-btn fdr-btn-sm fdr-btn-accent';
    this.cropBtn.innerHTML = '✂ Crop Region';
    this.cropBtn.onclick = () => this.toggleCropMode();

    const solBtn = document.createElement('button');
    solBtn.className = 'fdr-btn fdr-btn-sm';
    solBtn.innerHTML = '🎨 Solution Studio';
    solBtn.onclick = () => this.openSolutionStudio();

    actionGroup.append(this.cropBtn, solBtn);
    toolbar.append(actionGroup);
    content.appendChild(toolbar);

    this.mainViewport = document.createElement('div');
    this.mainViewport.className = 'fdr-image-viewport';

    this.mainImgElement = document.createElement('img');
    this.mainImgElement.className = 'fdr-main-image';
    this.mainImgElement.src = this.imageSourceUrl;
    this.mainImgElement.style.width = `${Math.round(this.naturalWidth * this.zoom)}px`;
    this.mainImgElement.style.height = `${Math.round(this.naturalHeight * this.zoom)}px`;

    this.cropSurface = document.createElement('div');
    this.cropSurface.className = 'fdr-crop-surface';
    this.cropSurface.style.display = 'none';

    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'fdr-selection-box';

    this.selectionTooltip = document.createElement('div');
    this.selectionTooltip.className = 'fdr-selection-tooltip';
    this.selectionBox.appendChild(this.selectionTooltip);

    this._bindCropEvents();

    this.mainViewport.append(this.mainImgElement, this.cropSurface, this.selectionBox);
    content.appendChild(this.mainViewport);

    this.setCropMode(true);
  }

  setCropMode(enable) {
    this.isCropMode = enable;
    if (this.cropBtn) {
      this.cropBtn.classList.toggle('active', enable);
      this.cropBtn.textContent = enable ? '✕ Cancel Crop' : '✂ Crop Region';
    }
    if (this.cropSurface) this.cropSurface.style.display = enable ? 'block' : 'none';
  }

  toggleCropMode() {
    this.setCropMode(!this.isCropMode);
  }

  _bindCropEvents() {
    let startX = 0, startY = 0;
    let isDrawing = false;
    const getImgBounds = () => this.mainImgElement.getBoundingClientRect();

    const onDown = (e) => {
      if (!this.isCropMode) return;
      const imgRect = getImgBounds();
      startX = Math.max(0, Math.min(imgRect.width, e.clientX - imgRect.left));
      startY = Math.max(0, Math.min(imgRect.height, e.clientY - imgRect.top));
      isDrawing = true;
      this.selectionBox.style.display = 'block';
      this.selectionBox.style.position = 'fixed';
    };

    const onMove = (e) => {
      if (!isDrawing) return;
      const imgRect = getImgBounds();
      const curX = Math.max(0, Math.min(imgRect.width, e.clientX - imgRect.left));
      const curY = Math.max(0, Math.min(imgRect.height, e.clientY - imgRect.top));
      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);

      this.selectionBox.style.left = `${imgRect.left + x}px`;
      this.selectionBox.style.top = `${imgRect.top + y}px`;
      this.selectionBox.style.width = `${w}px`;
      this.selectionBox.style.height = `${h}px`;
      this.selectionTooltip.textContent = `${Math.round(w / this.zoom)} × ${Math.round(h / this.zoom)} px`;
    };

    const onUp = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      this.selectionBox.style.display = 'none';

      const imgRect = getImgBounds();
      const endX = Math.max(0, Math.min(imgRect.width, e.clientX - imgRect.left));
      const endY = Math.max(0, Math.min(imgRect.height, e.clientY - imgRect.top));
      const dispW = Math.abs(endX - startX);
      const dispH = Math.abs(endY - startY);

      if (dispW > 15 && dispH > 15) {
        this.openCropOverlayWindow({
          x: Math.round(Math.min(startX, endX) / this.zoom),
          y: Math.round(Math.min(startY, endY) / this.zoom),
          width: Math.round(dispW / this.zoom),
          height: Math.round(dispH / this.zoom)
        });
        this.setCropMode(false);
      }
    };

    this.cropSurface.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  openCropOverlayWindow(cropRect) {
    this.activeCrop = cropRect;
    if (this.overlayDialog) this.overlayDialog.close();

    const dispCropW = Math.round(cropRect.width * this.zoom);
    const dispCropH = Math.round(cropRect.height * this.zoom);

    const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
      ? UITools.makeDialog
      : (opts => new DialogBox(opts));

    this.overlayDialog = dialogMaker({
      title: `Overlay [${cropRect.width}×${cropRect.height}]`,
      size: [Math.max(340, dispCropW + 4), dispCropH + 32 + 46],
      position: [80, 80],
      contentTransparent: true,
      noPadding: true,
      onClose: () => {
        this.stopFlashing();
        this.stopStripes();
        this.overlayDialog = null;
      }
    });

    const content = this.overlayDialog.contentElement;
    this.overlayViewport = document.createElement('div');
    this.overlayViewport.className = 'fdr-overlay-viewport';
    this.overlayViewport.style.width = `${dispCropW}px`;
    this.overlayViewport.style.height = `${dispCropH}px`;

    this.overlayClippedImg = document.createElement('img');
    this.overlayClippedImg.className = 'fdr-overlay-clipped-img';
    this.overlayClippedImg.src = this.imageSourceUrl;
    this.overlayClippedImg.style.opacity = `${this.currentOpacity}`;

    this.overlaySvgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.overlaySvgLayer.setAttribute('class', 'fdr-diff-svg-layer');

    this.circleDrawSurface = document.createElement('div');
    this.circleDrawSurface.className = 'fdr-circle-draw-surface';

    this.overlayViewport.append(this.overlayClippedImg, this.overlaySvgLayer, this.circleDrawSurface);
    content.appendChild(this.overlayViewport);

    // Overlay Bottom Toolbar with Flash, Stripes, Opacity & Nudge
    const toolbar = document.createElement('div');
    toolbar.className = 'fdr-overlay-toolbar';

    const stripeToolbar = document.createElement('div');
    stripeToolbar.className = 'fdr-stripe-toolbar';

    const stripesBtn = document.createElement('button');
    stripesBtn.className = 'fdr-btn fdr-btn-sm';
    stripesBtn.innerHTML = '▤ Stripes';

    const flashBtn = document.createElement('button');
    flashBtn.className = 'fdr-btn fdr-btn-sm';
    flashBtn.innerHTML = '⚡ Flash';

    const opacityGroup = document.createElement('div');
    opacityGroup.className = 'fdr-opacity-group fdr-opacity-active';

    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.value = String(Math.round(this.currentOpacity * 100));

    const opacityLabel = document.createElement('span');
    opacityLabel.className = 'fdr-opacity-lbl';
    opacityLabel.textContent = `${Math.round(this.currentOpacity * 100)}%`;

    opacitySlider.oninput = (e) => {
      this.activateOpacityMode(opacityGroup, stripesBtn, flashBtn, stripeToolbar);
      const val = parseInt(e.target.value, 10);
      opacityLabel.textContent = `${val}%`;
      this.setOverlayOpacity(val / 100);
    };

    opacityGroup.append(opacitySlider, opacityLabel);

    stripesBtn.onclick = () => {
      this.stopFlashing();
      flashBtn.classList.remove('active');
      stripesBtn.classList.add('active');
      opacityGroup.classList.remove('fdr-opacity-active');
      opacityGroup.classList.add('fdr-opacity-inactive');
      stripeToolbar.style.display = 'flex';
      this.startStripes();
    };

    flashBtn.onclick = () => {
      this.stopStripes();
      stripesBtn.classList.remove('active');
      stripeToolbar.style.display = 'none';
      if (this.isFlashing) {
        this.stopFlashing();
        flashBtn.classList.remove('active');
        this.activateOpacityMode(opacityGroup, stripesBtn, flashBtn, stripeToolbar);
      } else {
        opacityGroup.classList.remove('fdr-opacity-active');
        opacityGroup.classList.add('fdr-opacity-inactive');
        this.startFlashing(flashBtn);
      }
    };

    const diffCircleBtn = document.createElement('button');
    diffCircleBtn.className = 'fdr-btn fdr-btn-sm fdr-btn-accent';
    diffCircleBtn.innerHTML = '⭕ Circle Diff';
    diffCircleBtn.onclick = () => this.toggleCircleDiffMode();
    this.diffCircleBtn = diffCircleBtn;

    const solBtn = document.createElement('button');
    solBtn.className = 'fdr-btn fdr-btn-sm';
    solBtn.innerHTML = `🎨 Studio (${this.diffCircles.length})`;
    solBtn.onclick = () => this.openSolutionStudio();
    this.solutionBtn = solBtn;

    toolbar.append(stripesBtn, flashBtn, opacityGroup, diffCircleBtn, solBtn);
    content.append(toolbar, stripeToolbar);

    this.updateOverlayGeometry();
    this._bindCircleDrawEvents();
  }

  activateOpacityMode(opacityGroup, stripesBtn, flashBtn, stripeToolbar) {
    this.stopFlashing();
    this.stopStripes();
    stripesBtn?.classList.remove('active');
    flashBtn?.classList.remove('active');
    if (stripeToolbar) stripeToolbar.style.display = 'none';
    opacityGroup.classList.remove('fdr-opacity-inactive');
    opacityGroup.classList.add('fdr-opacity-active');
  }

  updateOverlayGeometry() {
    if (!this.overlayViewport || !this.activeCrop || !this.overlayClippedImg) return;
    const { x, y, width, height } = this.activeCrop;
    this.overlayViewport.style.width = `${Math.round(width * this.zoom)}px`;
    this.overlayViewport.style.height = `${Math.round(height * this.zoom)}px`;
    this.overlayClippedImg.style.width = `${Math.round(this.naturalWidth * this.zoom)}px`;
    this.overlayClippedImg.style.height = `${Math.round(this.naturalHeight * this.zoom)}px`;
    this.overlayClippedImg.style.left = `${Math.round(-x * this.zoom)}px`;
    this.overlayClippedImg.style.top = `${Math.round(-y * this.zoom)}px`;
  }

  setOverlayOpacity(val) {
    this.currentOpacity = Math.max(0, Math.min(1, val));
    if (this.overlayClippedImg) {
      this.overlayClippedImg.style.opacity = `${this.currentOpacity}`;
    }
  }

  startFlashing(btn) {
    this.stopFlashing();
    this.stopStripes();
    this.isFlashing = true;
    if (btn) btn.classList.add('active');

    let state = false;
    this.flashInterval = setInterval(() => {
      state = !state;
      if (this.overlayClippedImg) {
        this.overlayClippedImg.style.opacity = state ? '1.0' : '0.05';
      }
    }, 600);
  }

  stopFlashing() {
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
    this.isFlashing = false;
    if (this.overlayClippedImg) {
      this.overlayClippedImg.style.opacity = `${this.currentOpacity}`;
    }
  }

  startStripes() {
    this.stopFlashing();
    this.stopStripes();
    this.isStripesMode = true;
    this.stripeRunning = true;
    if (this.overlayClippedImg) this.overlayClippedImg.style.opacity = '1.0';

    this._applyStripeMask();

    let lastTime = performance.now();
    const loop = (currentTime) => {
      if (!this.isStripesMode || !this.stripeRunning) return;
      const dt = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const cycle = (this.stripeWidth || 50) * 2;
      this.stripeOffset = (this.stripeOffset + dt * this.stripeSpeed * this.stripeDirection) % cycle;
      this._updateStripePosition();
      this.stripeRafId = requestAnimationFrame(loop);
    };
    this.stripeRafId = requestAnimationFrame(loop);
  }

  stopStripes() {
    if (this.stripeRafId) {
      cancelAnimationFrame(this.stripeRafId);
      this.stripeRafId = null;
    }
    this.isStripesMode = false;
    this.stripeRunning = false;
    this._clearStripeMask();
    if (this.overlayClippedImg) this.overlayClippedImg.style.opacity = `${this.currentOpacity}`;
  }

  _applyStripeMask() {
    if (!this.overlayViewport) return;
    const w = this.stripeWidth || 50;
    const cycle = w * 2;
    const grad = `linear-gradient(90deg, #000 0px, #000 ${w}px, transparent ${w}px, transparent ${cycle}px)`;
    this.overlayViewport.style.webkitMaskImage = grad;
    this.overlayViewport.style.maskImage = grad;
    this.overlayViewport.style.webkitMaskSize = `${cycle}px 100%`;
    this.overlayViewport.style.maskSize = `${cycle}px 100%`;
    this.overlayViewport.style.webkitMaskRepeat = 'repeat-x';
    this.overlayViewport.style.maskRepeat = 'repeat-x';
    this._updateStripePosition();
  }

  _updateStripePosition() {
    if (!this.overlayViewport) return;
    this.overlayViewport.style.webkitMaskPosition = `${this.stripeOffset}px 0`;
    this.overlayViewport.style.maskPosition = `${this.stripeOffset}px 0`;
  }

  _clearStripeMask() {
    if (!this.overlayViewport) return;
    this.overlayViewport.style.webkitMaskImage = '';
    this.overlayViewport.style.maskImage = '';
  }

  nudgeOverlay(dx, dy) {
    if (!this.overlayDialog || !this.overlayDialog.element) return;
    const curLeft = parseFloat(this.overlayDialog.element.style.left) || 0;
    const curTop = parseFloat(this.overlayDialog.element.style.top) || 0;
    this.overlayDialog.element.style.left = `${curLeft + dx}px`;
    this.overlayDialog.element.style.top = `${curTop + dy}px`;
    if (this.solutionDialog) this.renderSolutionCanvas();
  }

  setCircleDiffMode(enable) {
    this.isCircleDiffMode = enable;
    if (this.diffCircleBtn) {
      this.diffCircleBtn.classList.toggle('active', enable);
      this.diffCircleBtn.innerHTML = enable ? '✕ Exit Diff' : '⭕ Circle Diff';
    }
    if (this.circleDrawSurface) this.circleDrawSurface.style.display = enable ? 'block' : 'none';
  }

  toggleCircleDiffMode() {
    this.setCircleDiffMode(!this.isCircleDiffMode);
  }

  _bindCircleDrawEvents() {
    let p1 = null;
    let isDrawing = false;
    let previewGroup = null;

    const onDown = (e) => {
      if (!this.isCircleDiffMode) return;
      const rect = this.overlayViewport.getBoundingClientRect();
      p1 = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      isDrawing = true;
      previewGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.overlaySvgLayer.appendChild(previewGroup);
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!isDrawing || !p1) return;
      const rect = this.overlayViewport.getBoundingClientRect();
      const p2 = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const diam = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const radius = diam / 2;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      previewGroup.innerHTML = `
        <circle cx="${midX}" cy="${midY}" r="${radius}" fill="rgba(0, 230, 118, 0.2)" stroke="${this.solutionOutlineColor}" stroke-width="${this.solutionOutlineWidth}" stroke-dasharray="4,3" />
      `;
    };

    const onUp = (e) => {
      if (!isDrawing || !p1) return;
      isDrawing = false;
      const rect = this.overlayViewport.getBoundingClientRect();
      const p2 = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (previewGroup) previewGroup.remove();

      const diam = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (diam >= 8) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const diffRecord = {
          id: 'diff_' + Date.now(),
          cropX: midX / this.zoom,
          cropY: midY / this.zoom,
          radius: (diam / 2) / this.zoom,
          dragX: midX / this.zoom,
          dragY: midY / this.zoom,
          color: this.solutionOutlineColor
        };
        this.diffCircles.push(diffRecord);
        this.selectedDiffId = diffRecord.id;
        this.renderDiffMarkers();
        if (this.solutionDialog) this.renderSolutionCanvas();
      }
    };

    this.circleDrawSurface.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  undoLastDiff() {
    if (this.diffCircles.length > 0) {
      this.diffCircles.pop();
      this.selectedDiffId = this.diffCircles.length ? this.diffCircles[this.diffCircles.length - 1].id : null;
      this.renderDiffMarkers();
      if (this.solutionDialog) this.renderSolutionCanvas();
    }
  }

  deleteSelectedDiff() {
    if (!this.selectedDiffId) return;
    this.diffCircles = this.diffCircles.filter(d => d.id !== this.selectedDiffId);
    this.selectedDiffId = this.diffCircles.length ? this.diffCircles[this.diffCircles.length - 1].id : null;
    this.renderDiffMarkers();
    if (this.solutionDialog) this.renderSolutionCanvas();
  }

  moveSelectedDiffLayer(delta) {
    if (!this.selectedDiffId) return;
    const idx = this.diffCircles.findIndex(d => d.id === this.selectedDiffId);
    if (idx === -1) return;
    let target = Math.max(0, Math.min(this.diffCircles.length - 1, idx + delta));
    const item = this.diffCircles.splice(idx, 1)[0];
    this.diffCircles.splice(target, 0, item);
    this.renderDiffMarkers();
    if (this.solutionDialog) this.renderSolutionCanvas();
  }

  renderDiffMarkers() {
    if (!this.overlaySvgLayer) return;
    this.overlaySvgLayer.innerHTML = '';
    this.diffCircles.forEach((diff, idx) => {
      const cx = diff.cropX * this.zoom;
      const cy = diff.cropY * this.zoom;
      const r = diff.radius * this.zoom;
      const col = diff.color || this.solutionOutlineColor;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0, 230, 118, 0.15)" stroke="${col}" stroke-width="${this.solutionOutlineWidth}" />
        <circle cx="${cx}" cy="${cy}" r="2" fill="${col}" />
        <text x="${cx + r + 4}" y="${cy + 4}" font-family="monospace" font-size="11" font-weight="bold" fill="${col}">#${idx + 1}</text>
      `;
      this.overlaySvgLayer.appendChild(g);
    });
  }

  _getCanvasTransform() {
    const crop = this.activeCrop || { x: 0, y: 0, width: this.naturalWidth, height: this.naturalHeight };
    const w = crop.width;
    const h = crop.height;

    let minX = 0, minY = 0, maxX = w, maxY = h;
    const strokePad = (this.solutionOutlineWidth / 2) + 2;

    this.diffCircles.forEach(diff => {
      const r = diff.radius;
      const ang = (Math.hypot(diff.dragX - diff.cropX, diff.dragY - diff.cropY) >= 0.5)
        ? Math.atan2(diff.dragY - diff.cropY, diff.dragX - diff.cropX) + Math.PI / 2
        : 0;

      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const c1x = diff.dragX - r * cosA;
      const c1y = diff.dragY - r * sinA;
      const c2x = diff.dragX + r * cosA;
      const c2y = diff.dragY + r * sinA;

      minX = Math.min(minX, c1x - r - strokePad, c2x - r - strokePad);
      maxX = Math.max(maxX, c1x + r + strokePad, c2x + r + strokePad);
      minY = Math.min(minY, c1y - r - strokePad, c2y - r - strokePad);
      maxY = Math.max(maxY, c1y + r + strokePad, c2y + r + strokePad);
    });

    const margin = 4;
    minX = Math.floor(minX - margin);
    minY = Math.floor(minY - margin);
    maxX = Math.ceil(maxX + margin);
    maxY = Math.ceil(maxY + margin);

    return {
      canvasWidth: Math.round(maxX - minX),
      canvasHeight: Math.round(maxY - minY),
      offsetX: -minX,
      offsetY: -minY,
      cropW: w,
      cropH: h,
      cropX: crop.x,
      cropY: crop.y
    };
  }

  renderSolutionCanvas() {
    if (!this.solutionCanvas || !this.sourceImage) return;

    const tf = this._getCanvasTransform();
    this.solutionCanvas.width = tf.canvasWidth;
    this.solutionCanvas.height = tf.canvasHeight;
    const ctx = this.solutionCanvas.getContext('2d');

    const w = tf.cropW;
    const h = tf.cropH;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(this.sourceImage, tf.cropX, tf.cropY, w, h, 0, 0, w, h);

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = w;
    baseCanvas.height = h;
    const baseCtx = baseCanvas.getContext('2d');
    let baseOriginX = tf.cropX;
    let baseOriginY = tf.cropY;
    if (this.overlayDialog && this.overlayViewport && this.mainImgElement) {
      const mainRect = this.mainImgElement.getBoundingClientRect();
      const ovRect = this.overlayViewport.getBoundingClientRect();
      baseOriginX = (ovRect.left - mainRect.left) / this.zoom;
      baseOriginY = (ovRect.top - mainRect.top) / this.zoom;
    }
    baseCtx.drawImage(this.sourceImage, baseOriginX, baseOriginY, w, h, 0, 0, w, h);

    ctx.clearRect(0, 0, tf.canvasWidth, tf.canvasHeight);

    if (this.solutionBgMode === 'gradient') {
      const bgGrad = ctx.createLinearGradient(0, 0, tf.canvasWidth, tf.canvasHeight);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, tf.canvasWidth, tf.canvasHeight);
    } else if (this.solutionBgMode === 'color') {
      ctx.fillStyle = this.solutionBgColor;
      ctx.fillRect(0, 0, tf.canvasWidth, tf.canvasHeight);
    }
    // 'transparent' leaves the alpha channel completely clear outside the scene

    // Scene Container
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#000000';
    ctx.fillRect(tf.offsetX, tf.offsetY, w, h);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(tf.offsetX, tf.offsetY, w, h);
    ctx.clip();
    if (this.solutionBlur > 0) ctx.filter = `blur(${this.solutionBlur}px)`;
    ctx.drawImage(cropCanvas, tf.offsetX, tf.offsetY);
    if (this.solutionDarken > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.solutionDarken})`;
      ctx.fillRect(tf.offsetX, tf.offsetY, w, h);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tf.offsetX, tf.offsetY, w, h);

    // Anchors & Tangents
    this.diffCircles.forEach(diff => {
      const origX = diff.cropX + tf.offsetX;
      const origY = diff.cropY + tf.offsetY;
      const dragX = diff.dragX + tf.offsetX;
      const dragY = diff.dragY + tf.offsetY;
      const r = diff.radius;
      const col = diff.color || this.solutionOutlineColor;

      const isDragged = Math.hypot(dragX - origX, dragY - origY) > (r * 1.05);

      if (this.solutionBlendAnchor) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(origX, origY, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(cropCanvas, origX - diff.cropX, origY - diff.cropY);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(baseCanvas, origX - diff.cropX, origY - diff.cropY);
        ctx.restore();
      }

      if (isDragged) {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(origX, origY, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // Callout Magnifier Pairs
    this.diffCircles.forEach((diff, idx) => {
      const origX = diff.cropX;
      const origY = diff.cropY;
      const dragX = diff.dragX + tf.offsetX;
      const dragY = diff.dragY + tf.offsetY;
      const r = diff.radius;
      const col = diff.color || this.solutionOutlineColor;

      const ang = (Math.hypot(diff.dragX - diff.cropX, diff.dragY - diff.cropY) >= 0.5)
        ? Math.atan2(diff.dragY - diff.cropY, diff.dragX - diff.cropX) + Math.PI / 2
        : 0;

      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const c1x = dragX - r * cosA;
      const c1y = dragY - r * sinA;
      const c2x = dragX + r * cosA;
      const c2y = dragY + r * sinA;

      // Circle 1 (Image A)
      ctx.save();
      ctx.beginPath();
      ctx.arc(c1x, c1y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(cropCanvas, c1x - origX, c1y - origY);
      ctx.restore();

      // Circle 2 (Image B)
      ctx.save();
      ctx.beginPath();
      ctx.arc(c2x, c2y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(baseCanvas, c2x - origX, c2y - origY);
      ctx.restore();

      // Outlines
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = this.solutionOutlineWidth;
      ctx.beginPath();
      ctx.arc(c1x, c1y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c2x, c2y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  openSolutionStudio() {
    if (this.solutionDialog) {
      this.solutionDialog.bringToFront();
      this.renderSolutionCanvas();
      return;
    }

    const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
      ? UITools.makeDialog
      : (opts => new DialogBox(opts));

    this.solutionDialog = dialogMaker({
      title: `Difference Solution Studio (${this.diffCircles.length} Spotted)`,
      size: [880, 620],
      position: [60, 60],
      noPadding: true,
      allowMaximize: true,
      onClose: () => {
        this.solutionDialog = null;
      }
    });

    const root = document.createElement('div');
    root.className = 'fdr-solution-studio';

    const toolbar = document.createElement('div');
    toolbar.className = 'fdr-solution-toolbar';

    const bgToggleBtn = document.createElement('button');
    bgToggleBtn.className = 'fdr-btn fdr-btn-sm';
    bgToggleBtn.innerHTML = `🔲 Bg: ${this.solutionBgMode.toUpperCase()}`;
    bgToggleBtn.title = 'Toggle background: Transparent (default), Dark Gradient, or Solid Color';
    bgToggleBtn.onclick = () => {
      const cycle = { transparent: 'gradient', gradient: 'color', color: 'transparent' };
      this.solutionBgMode = cycle[this.solutionBgMode] || 'transparent';
      bgToggleBtn.innerHTML = `🔲 Bg: ${this.solutionBgMode.toUpperCase()}`;
      this.renderSolutionCanvas();
    };

    const copyBtn = document.createElement('button');
    copyBtn.className = 'fdr-btn fdr-btn-sm fdr-btn-primary';
    copyBtn.innerHTML = '📋 Copy Image';
    copyBtn.onclick = () => {
      this.solutionCanvas.toBlob(blob => {
        if (!blob) return;
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
          copyBtn.textContent = '✓ Copied PNG!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy Image'; }, 1500);
        });
      });
    };

    toolbar.append(bgToggleBtn, copyBtn);
    root.appendChild(toolbar);

    const vp = document.createElement('div');
    vp.className = 'fdr-solution-viewport';
    this.solutionCanvas = document.createElement('canvas');
    this.solutionCanvas.className = 'fdr-solution-canvas';
    vp.appendChild(this.solutionCanvas);
    root.appendChild(vp);

    this.solutionDialog.contentElement.appendChild(root);
    this.renderSolutionCanvas();
  }

  static launchInSitu() {
    const existingHud = document.getElementById('quoratoys-insitu-hud');
    if (existingHud) {
      existingHud.remove();
      return;
    }

    const hud = document.createElement('div');
    hud.id = 'quoratoys-insitu-hud';
    hud.style.cssText = `
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; background: rgba(15, 23, 42, 0.94);
      color: #00e676; border: 1.5px solid #00e676; border-radius: 30px;
      padding: 6px 18px; font-family: monospace; font-size: 12px; font-weight: bold;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 18px rgba(0, 230, 118, 0.35);
      display: flex; align-items: center; gap: 12px; backdrop-filter: blur(10px);
      user-select: none;
    `;
    hud.innerHTML = `
      <span>🧩 QuoraToys Active: Click any puzzle image on this page to compare</span>
      <button id="qt-hud-close" style="background:#334155; color:#fff; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:10px;">✕</button>
    `;
    document.body.appendChild(hud);

    let activeHoverImg = null;

    const onHover = (e) => {
      const target = e.target;
      if (target && target.tagName === 'IMG' && target.offsetWidth > 60 && target.offsetHeight > 60) {
        if (activeHoverImg && activeHoverImg !== target) {
          activeHoverImg.style.outline = activeHoverImg._origOutline || '';
        }
        activeHoverImg = target;
        activeHoverImg._origOutline = activeHoverImg.style.outline;
        activeHoverImg.style.outline = '3px solid #00e676';
        activeHoverImg.style.cursor = 'crosshair';
      } else if (activeHoverImg && (!target || target.tagName !== 'IMG')) {
        activeHoverImg.style.outline = activeHoverImg._origOutline || '';
        activeHoverImg = null;
      }
    };

    const onClick = (e) => {
      const target = e.target;
      if (target && target.tagName === 'IMG' && target.offsetWidth > 60 && target.offsetHeight > 60) {
        e.preventDefault();
        e.stopPropagation();
        cleanup();

        const host = document.createElement('div');
        host.id = 'quoratoys-insitu-host';
        host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483640;';
        document.body.appendChild(host);

        const app = new QuoraToys();
        window.quoraToysInstance = app;
        app.run({ container: host }).then(() => {
          app.loadImageFromUrl(target.src, target.alt || 'Quora Puzzle');
        });
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onHover, true);
      document.removeEventListener('click', onClick, true);
      if (activeHoverImg) activeHoverImg.style.outline = activeHoverImg._origOutline || '';
      hud.remove();
    };

    document.addEventListener('mousemove', onHover, true);
    document.addEventListener('click', onClick, true);
    document.getElementById('qt-hud-close').onclick = cleanup;
  }
}

globalThis.QuoraToys = QuoraToys;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraToys;