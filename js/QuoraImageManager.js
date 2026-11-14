class QuoraImageManager {
  constructor(component) {
    this.component = component;
  }

  addPlate(stageState, img, x = 60, y = 60) {
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;

    const maxInit = 560;
    if (w > maxInit || h > maxInit) {
      const ratio = Math.min(maxInit / w, maxInit / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    const plate = {
      id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      img: img,
      x: x,
      y: y,
      width: w,
      height: h,
      aspect: w / h
    };

    stageState.placedImages.push(plate);
    stageState.activeImage = plate;

    if (!stageState.baseImage) {
      stageState.baseImage = img;
      stageState.cropRect = { x: 0, y: 0, width: w, height: h };
    }

    this.component.renderStage();
    this.component.showKnotToast(`Added image plate (${w}×${h}px)`);
    return plate;
  }

  hitTest(stageState, pt) {
    if (!stageState.placedImages || stageState.placedImages.length === 0) return null;
    for (let i = stageState.placedImages.length - 1; i >= 0; i--) {
      const p = stageState.placedImages[i];
      if (pt[0] >= p.x && pt[0] <= p.x + p.width && pt[1] >= p.y && pt[1] <= p.y + p.height) {
        return p;
      }
    }
    return null;
  }

  computeBounds(stageState) {
        const pad = stageState.padding || 45;
        const vpW = this.component?.viewport?.clientWidth || 0;
        const vpH = this.component?.viewport?.clientHeight || 0;
        const z = Math.max(0.1, stageState.zoom || 1.0);
        const minStageW = Math.max(800, Math.ceil(vpW / Math.min(1, z)));
        const minStageH = Math.max(500, Math.ceil(vpH / Math.min(1, z)));

        const bounds = StudioGeometry.computeStageBounds(stageState, minStageW, minStageH);
        const totalW = stageState.manualSizing ? Math.max(bounds.totalW, stageState.canvasWidth || minStageW) : bounds.totalW;
        const totalH = stageState.manualSizing ? Math.max(bounds.totalH, stageState.canvasHeight || minStageH) : bounds.totalH;

        stageState.canvasWidth = totalW;
        stageState.canvasHeight = totalH;

        return {
          totalW,
          totalH,
          offsetX: bounds.offsetX || pad,
          offsetY: bounds.offsetY || pad
        };
    }
  renderControls(controlsLayer, stageState) {
      controlsLayer.querySelectorAll('.qa-image-plate-control').forEach(el => el.remove());
      const plate = stageState.activeImage;
      if (!plate) return;

      const z = stageState.zoom || 1.0;
      const invScale = (1 / z).toFixed(3);
      const g = makeElement('svg:g', { className: 'qa-image-plate-control' });

      // 1. Transparent Drag Surface
      const dragSurface = makeElement('svg:rect', {
        x: plate.x, y: plate.y, width: plate.width, height: plate.height,
        fill: 'rgba(0, 242, 254, 0.02)', stroke: '#00f2fe', 'stroke-width': String(1.8 / z),
        'stroke-dasharray': `${6/z},${4/z}`,
        style: { cursor: 'move', pointerEvents: 'all' },
        title: 'Drag to move image plate • Press Delete to remove'
      });

      let isMoving = false;
      let startMouseX = 0, startMouseY = 0;
      let initialPlateX = plate.x, initialPlateY = plate.y;

      dragSurface.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        if (e.target.closest('.qa-plate-mini-toolbar')) return;
        e.stopPropagation();
        isMoving = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        initialPlateX = plate.x;
        initialPlateY = plate.y;

        const onPlateMove = (ev) => {
          if (!isMoving) return;
          const curZ = stageState.zoom || 1.0;
          plate.x = Math.round(initialPlateX + (ev.clientX - startMouseX) / curZ);
          plate.y = Math.round(initialPlateY + (ev.clientY - startMouseY) / curZ);
          this.component.renderStage();
        };

        const onPlateUp = () => {
          isMoving = false;
          window.removeEventListener('mousemove', onPlateMove);
          window.removeEventListener('mouseup', onPlateUp);
        };

        window.addEventListener('mousemove', onPlateMove);
        window.addEventListener('mouseup', onPlateUp);
      });

      g.appendChild(dragSurface);

      // 2. Zoom-Invariant Mini Action Deck Docked Above Image Top Edge
      const deckY = plate.y - (30 / z);
      const deckX = plate.x;

      const deckForeign = makeElement('svg:foreignObject', {
        className: 'qa-plate-mini-toolbar',
        x: deckX, y: deckY, width: '340', height: '30',
        style: {
          overflow: 'visible', pointerEvents: 'auto',
          transformOrigin: '0 100%', transform: `scale(${invScale})`
        }
      });

      const isFaded = (plate.opacity === 0.5);

      const deckWrap = makeElement('div', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: 'rgba(9, 13, 22, 0.96)', border: '1px solid rgba(0, 242, 254, 0.45)',
          borderRadius: '14px', padding: '2px 8px', boxShadow: '0 4px 14px rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)'
        }
      }, [
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 7px', fontSize: '10px', color: '#00f2fe' },
          title: 'Clone image plate (D)',
          onclick: (e) => { e.stopPropagation(); this.duplicateActivePlate(stageState); }
        }, '⧉ Clone'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 7px', fontSize: '10px', color: '#38bdf8' },
          title: 'Crop image plate to sub-rectangle',
          onclick: (e) => { e.stopPropagation(); this.startPlateCrop(plate); }
        }, '✂️ Crop'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 7px', fontSize: '10px', color: isFaded ? '#ffd700' : '#cbd5e1' },
          title: 'Toggle Opacity (100% / 50%)',
          onclick: (e) => { e.stopPropagation(); this.togglePlateOpacity(stageState, plate); }
        }, isFaded ? '◐ 50%' : '● 100%'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 5px', fontSize: '10px' },
          title: 'Bring forward in layer stack',
          onclick: (e) => { e.stopPropagation(); this.bringForward(stageState, plate); }
        }, '▲'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 5px', fontSize: '10px' },
          title: 'Send backward in layer stack',
          onclick: (e) => { e.stopPropagation(); this.sendBackward(stageState, plate); }
        }, '▼'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '2px 7px', fontSize: '10px', color: '#ff7b72' },
          title: 'Delete image plate (Del)',
          onclick: (e) => { e.stopPropagation(); this.deleteActivePlate(stageState); }
        }, '🗑️ Del')
      ]);

      deckForeign.appendChild(deckWrap);
      g.appendChild(deckForeign);

      // 3. True Opposite-Corner Anchored Resize Grips
      const gripSize = 10 / z;
      const halfGrip = gripSize / 2;
      const corners = [
        { id: 'nw', x: plate.x, y: plate.y, cursor: 'nwse-resize' },
        { id: 'ne', x: plate.x + plate.width, y: plate.y, cursor: 'nesw-resize' },
        { id: 'se', x: plate.x + plate.width, y: plate.y + plate.height, cursor: 'nwse-resize' },
        { id: 'sw', x: plate.x, y: plate.y + plate.height, cursor: 'nesw-resize' }
      ];

      corners.forEach(corner => {
        const grip = makeElement('svg:rect', {
          className: 'qa-image-resize-grip',
          'data-orig-x': corner.x,
          'data-orig-y': corner.y,
          x: corner.x - halfGrip, y: corner.y - halfGrip,
          width: gripSize, height: gripSize,
          fill: '#00f2fe', stroke: '#ffffff', 'stroke-width': String(1.5 / z), rx: String(2 / z),
          style: { cursor: corner.cursor, pointerEvents: 'all', filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' },
          title: 'Drag to scale image with opposite corner fixed'
        });

        let isResizing = false;
        let startX = 0, startW = plate.width, startH = plate.height;
        let startPlateX = plate.x, startPlateY = plate.y;

        grip.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          isResizing = true;
          startX = e.clientX;
          startW = plate.width;
          startH = plate.height;
          startPlateX = plate.x;
          startPlateY = plate.y;

          const onResizeMove = (ev) => {
            if (!isResizing) return;
            const curZ = stageState.zoom || 1.0;
            const deltaX = (ev.clientX - startX) / curZ;

            // MATHEMATICALLY EXACT OPPOSITE-CORNER ANCHORING
            if (corner.id === 'se') {
              // Opposite corner is NW (startPlateX, startPlateY) - stays completely still!
              const newW = Math.max(40, startW + deltaX);
              plate.x = startPlateX;
              plate.y = startPlateY;
              plate.width = newW;
              plate.height = Math.round(newW / plate.aspect);
            } else if (corner.id === 'nw') {
              // Opposite corner is SE (startPlateX + startW, startPlateY + startH) - stays completely still!
              const fixedX = startPlateX + startW;
              const fixedY = startPlateY + startH;
              const newW = Math.max(40, startW - deltaX);
              const newH = Math.round(newW / plate.aspect);
              plate.x = fixedX - newW;
              plate.y = fixedY - newH;
              plate.width = newW;
              plate.height = newH;
            } else if (corner.id === 'ne') {
              // Opposite corner is SW (startPlateX, startPlateY + startH) - stays completely still!
              const fixedX = startPlateX;
              const fixedY = startPlateY + startH;
              const newW = Math.max(40, startW + deltaX);
              const newH = Math.round(newW / plate.aspect);
              plate.x = fixedX;
              plate.y = fixedY - newH;
              plate.width = newW;
              plate.height = newH;
            } else if (corner.id === 'sw') {
              // Opposite corner is NE (startPlateX + startW, startPlateY) - stays completely still!
              const fixedX = startPlateX + startW;
              const fixedY = startPlateY;
              const newW = Math.max(40, startW - deltaX);
              const newH = Math.round(newW / plate.aspect);
              plate.x = fixedX - newW;
              plate.y = fixedY;
              plate.width = newW;
              plate.height = newH;
            }

            this.component.renderStage();
          };

          const onResizeUp = () => {
            isResizing = false;
            window.removeEventListener('mousemove', onResizeMove);
            window.removeEventListener('mouseup', onResizeUp);
          };

          window.addEventListener('mousemove', onResizeMove);
          window.addEventListener('mouseup', onResizeUp);
        });

        g.appendChild(grip);
      });

      controlsLayer.appendChild(g);
    }
  deleteActivePlate(stageState) {
    if (!stageState.activeImage) return false;
    const idx = stageState.placedImages.indexOf(stageState.activeImage);
    if (idx !== -1) {
      stageState.placedImages.splice(idx, 1);
      stageState.activeImage = null;
      this.component.renderStage();
      this.component.showKnotToast('🗑️ Deleted image plate');
      return true;
    }
    return false;
  }

  duplicateActivePlate(stageState) {
      if (!stageState.activeImage) return null;
      const orig = stageState.activeImage;
      const cloned = {
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        img: orig.img,
        x: orig.x + 30,
        y: orig.y + 30,
        width: orig.width,
        height: orig.height,
        aspect: orig.aspect
      };

      stageState.placedImages.push(cloned);
      stageState.activeImage = cloned;
      this.component.renderStage();
      this.component.showKnotToast('📋 Cloned image plate');
      return cloned;
  }

  bringForward(stageState, plate) {
      if (!plate || !stageState.placedImages) return;
      const idx = stageState.placedImages.indexOf(plate);
      if (idx !== -1 && idx < stageState.placedImages.length - 1) {
        stageState.placedImages.splice(idx, 1);
        stageState.placedImages.splice(idx + 1, 0, plate);
        this.component.renderStage();
        this.component.showKnotToast('▲ Brought image forward');
      }
  }

  sendBackward(stageState, plate) {
      if (!plate || !stageState.placedImages) return;
      const idx = stageState.placedImages.indexOf(plate);
      if (idx > 0) {
        stageState.placedImages.splice(idx, 1);
        stageState.placedImages.splice(idx - 1, 0, plate);
        this.component.renderStage();
        this.component.showKnotToast('▼ Sent image backward');
      }
  }

  togglePlateOpacity(stageState, plate) {
      if (!plate) return;
      plate.opacity = (plate.opacity === 0.5) ? 1.0 : 0.5;
      this.component.renderStage();
      this.component.showKnotToast(`Image Opacity: ${Math.round(plate.opacity * 100)}%`);
  }

  burnCurvesToTransparency(stageState, targetCurves = null) {
    const plate = stageState.activeImage || stageState.placedImages[0];
    if (!plate || !plate.img) return false;

    const curvesToBurn = targetCurves || stageState.annotations.filter(a => a.type === 'curve' || a.type === 'paint');
    if (curvesToBurn.length === 0) {
      this.component.showKnotToast('No curves or masks selected to burn');
      return false;
    }

    // Create an offscreen canvas at the native image resolution
    const canvas = document.createElement('canvas');
    canvas.width = plate.img.naturalWidth || plate.img.width;
    canvas.height = plate.img.naturalHeight || plate.img.height;
    const ctx = canvas.getContext('2d');

    // Draw base image
    ctx.drawImage(plate.img, 0, 0);

    // Set composite mode to erase pixels directly from the image plate
    ctx.globalCompositeOperation = 'destination-out';

    const scaleX = canvas.width / plate.width;
    const scaleY = canvas.height / plate.height;

    curvesToBurn.forEach(ann => {
      if (ann.type === 'curve' && ann.beziers) {
        ctx.lineWidth = (ann.strokeWidth || 3.2) * scaleX;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ann.beziers.forEach((seg, idx) => {
          const p0x = (seg[0][0] - plate.x) * scaleX;
          const p0y = (seg[0][1] - plate.y) * scaleY;
          const cp1x = (seg[1][0] - plate.x) * scaleX;
          const cp1y = (seg[1][1] - plate.y) * scaleY;
          const cp2x = (seg[2][0] - plate.x) * scaleX;
          const cp2y = (seg[2][1] - plate.y) * scaleY;
          const p1x = (seg[3][0] - plate.x) * scaleX;
          const p1y = (seg[3][1] - plate.y) * scaleY;

          if (idx === 0) ctx.moveTo(p0x, p0y);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1x, p1y);
        });
        ctx.stroke();
      } else if (ann.type === 'paint' && ann.bounds) {
        const b = ann.bounds;
        const bx = (b.x - plate.x) * scaleX;
        const by = (b.y - plate.y) * scaleY;
        const bw = b.w * scaleX;
        const bh = b.h * scaleY;
        ctx.fillRect(bx, by, bw, bh);
      }
    });

    // Re-encode modified image with burned transparency
    const updatedImg = new Image();
    updatedImg.onload = () => {
      plate.img = updatedImg;
      this.component.renderStage();
      this.component.showKnotToast('🔥 Burned transparency mask into image plate');
    };
    updatedImg.src = canvas.toDataURL('image/png');
    return true;
  }

  async promptAddImageWorkflow(stageState, localFileInput) {
      let clipboardBlob = null;
      let clipboardImg = null;

      try {
        if (navigator.clipboard && navigator.clipboard.read) {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                clipboardBlob = await item.getType(type);
                break;
              }
            }
            if (clipboardBlob) break;
          }
        }
      } catch (err) {
        // Clipboard permission denied or empty
      }

      // If no clipboard image is found, directly open file browser with zero modal clutter
      if (!clipboardBlob) {
        if (localFileInput) localFileInput.click();
        return;
      }

      // If clipboard image is detected, present clean thumbnail choice
      const reader = new FileReader();
      reader.onload = (ev) => {
        clipboardImg = new Image();
        clipboardImg.onload = () => {
          this._showAddImageAmbiguityDialog(stageState, clipboardImg, localFileInput);
        };
        clipboardImg.src = ev.target.result;
      };
      reader.readAsDataURL(clipboardBlob);
    }

  _showAddImageAmbiguityDialog(stageState, clipboardImg, localFileInput) {
      const content = makeElement('div', {
        style: {
          display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 4px',
          color: '#f8fafc', fontFamily: 'monospace'
        }
      });

      const imgWidth = clipboardImg.naturalWidth || clipboardImg.width;
      const imgHeight = clipboardImg.naturalHeight || clipboardImg.height;

      content.innerHTML = `
        <div style="font-size:11.5px; color:#94a3b8; line-height:1.5;">
          A valid image is ready on your clipboard. Place it directly, or choose another file from disk:
        </div>
      `;

      const thumbCard = makeElement('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: '14px',
          background: 'rgba(0, 242, 254, 0.05)', border: '1.5px solid rgba(0, 242, 254, 0.3)',
          borderRadius: '8px', padding: '10px'
        }
      }, [
        makeElement('img', {
          src: clipboardImg.src,
          style: {
            maxWidth: '100px', maxHeight: '75px', borderRadius: '4px',
            objectFit: 'contain', background: '#090d16', border: '1px solid #1e293b'
          }
        }),
        makeElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
          makeElement('strong', { style: { color: '#00f2fe', fontSize: '12px' } }, 'Clipboard Image Ready'),
          makeElement('span', { style: { fontSize: '10.5px', color: '#cbd5e1' } }, `${imgWidth} × ${imgHeight} px`),
          makeElement('span', { style: { fontSize: '9.5px', color: '#10b981' } }, '● Click below to place')
        ])
      ]);
      content.appendChild(thumbCard);

      const actionsRow = makeElement('div', {
        style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }
      });

      const useClipboardBtn = makeElement('button', {
        className: 'dr-nav-btn primary',
        style: { padding: '6px 14px', fontSize: '11px', fontWeight: 'bold' },
        onclick: () => {
          dialog.close();
          this.addPlate(stageState, clipboardImg, 60, 60);
        }
      }, '📋 Place Clipboard Image');

      const browseFilesBtn = makeElement('button', {
        className: 'dr-nav-btn',
        style: { padding: '6px 12px', fontSize: '11px', color: '#00f2fe', borderColor: '#00f2fe66' },
        onclick: () => {
          dialog.close();
          if (localFileInput) localFileInput.click();
        }
      }, '📁 Browse Disk...');

      actionsRow.append(browseFilesBtn, useClipboardBtn);
      content.appendChild(actionsRow);

      const dialogMaker = (typeof UITools !== 'undefined' && typeof UITools.makeDialog === 'function')
        ? UITools.makeDialog
        : (opts => new DialogBox(opts));

      const dialog = dialogMaker({
        title: '🖼️ Add Image',
        size: [460, 260],
        contentElement: content,
        appendTo: document.body
      });
    }

  eraseImagePlatePixels(plate, worldX, worldY, brushRadius = 16, softness = 0, prevWorldX = null, prevWorldY = null) {
      if (!plate || !plate.img) return;

      let canvas = plate._eraseCanvas;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = plate.img.naturalWidth || plate.img.width;
        canvas.height = plate.img.naturalHeight || plate.img.height;
        const initCtx = canvas.getContext('2d');
        initCtx.drawImage(plate.img, 0, 0);
        plate._eraseCanvas = canvas;
      }

      plate._hasAlphaEdits = true;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';

      const scaleX = canvas.width / plate.width;
      const scaleY = canvas.height / plate.height;
      const r = Math.max(2, brushRadius * scaleX);

      const x1 = (worldX - plate.x) * scaleX;
      const y1 = (worldY - plate.y) * scaleY;
      const x0 = (prevWorldX !== null) ? (prevWorldX - plate.x) * scaleX : x1;
      const y0 = (prevWorldY !== null) ? (prevWorldY - plate.y) * scaleY : y1;

      const dist = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(dist / Math.max(2, r * 0.3)));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const lx = x0 + (x1 - x0) * t;
        const ly = y0 + (y1 - y0) * t;

        if (softness > 0) {
          const innerR = Math.max(0, r * Math.max(0.05, 1 - softness / 28));
          const grad = ctx.createRadialGradient(lx, ly, innerR, lx, ly, r);
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(0,0,0,1)';
        }

        ctx.beginPath();
        ctx.arc(lx, ly, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      plate.img = canvas;
      this.component.renderStage();
    }
  applyZoomScale(zoomLevel) {
      const z = Math.max(0.1, zoomLevel || 1.0);
      const invScale = (1 / z).toFixed(3);

      // Keep the plate top action deck at constant legible screen size
      const toolbars = document.querySelectorAll('.qa-plate-mini-toolbar');
      toolbars.forEach(tb => {
        tb.style.transformOrigin = '0 100%';
        tb.style.transform = `scale(${invScale})`;
      });

      // Keep the corner resize grips at constant comfortable screen size
      const grips = document.querySelectorAll('.qa-image-resize-grip');
      grips.forEach(g => {
        const origX = parseFloat(g.dataset.origX || g.getAttribute('x'));
        const origY = parseFloat(g.dataset.origY || g.getAttribute('y'));
        const halfSize = (10 / z) / 2;
        g.setAttribute('x', origX - halfSize);
        g.setAttribute('y', origY - halfSize);
        g.setAttribute('width', (10 / z).toFixed(2));
        g.setAttribute('height', (10 / z).toFixed(2));
      });
    }

  startPlateCrop(plate) {
      if (!plate || !plate.img) return;
      const stageState = this.component.stageState;

      const overlay = makeElement('div', {
        id: 'qa-plate-crop-overlay',
        style: {
          position: 'absolute', top: `${plate.y}px`, left: `${plate.x}px`,
          width: `${plate.width}px`, height: `${plate.height}px`,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)', border: '2px dashed #00f2fe',
          zIndex: '150', cursor: 'crosshair', boxSizing: 'border-box'
        }
      });

      const banner = makeElement('div', {
        style: {
          position: 'absolute', top: '-34px', left: '0',
          background: '#090d16', border: '1px solid #00f2fe', borderRadius: '4px',
          padding: '3px 8px', color: '#00f2fe', fontSize: '10.5px', fontWeight: 'bold'
        }
      }, '✂️ Drag rectangle inside image to crop • Esc to cancel');
      overlay.appendChild(banner);

      let startX = 0, startY = 0;
      let isSelecting = false;
      let cropBox = null;

      const onDown = (e) => {
        e.stopPropagation();
        const rect = overlay.getBoundingClientRect();
        const z = stageState.zoom || 1.0;
        startX = (e.clientX - rect.left) / z;
        startY = (e.clientY - rect.top) / z;
        isSelecting = true;

        cropBox = makeElement('div', {
          style: {
            position: 'absolute', left: `${startX}px`, top: `${startY}px`, width: '0', height: '0',
            border: '2px solid #00e676', background: 'rgba(0, 230, 118, 0.2)', pointerEvents: 'none'
          }
        });
        overlay.appendChild(cropBox);
      };

      const onMove = (e) => {
        if (!isSelecting || !cropBox) return;
        const rect = overlay.getBoundingClientRect();
        const z = stageState.zoom || 1.0;
        const curX = Math.max(0, Math.min(plate.width, (e.clientX - rect.left) / z));
        const curY = Math.max(0, Math.min(plate.height, (e.clientY - rect.top) / z));

        const x = Math.min(startX, curX);
        const y = Math.min(startY, curY);
        const w = Math.abs(curX - startX);
        const h = Math.abs(curY - startY);

        cropBox.style.left = `${x}px`;
        cropBox.style.top = `${y}px`;
        cropBox.style.width = `${w}px`;
        cropBox.style.height = `${h}px`;
      };

      const onUp = (e) => {
        if (!isSelecting || !cropBox) return;
        isSelecting = false;

        const rect = overlay.getBoundingClientRect();
        const z = stageState.zoom || 1.0;
        const endX = Math.max(0, Math.min(plate.width, (e.clientX - rect.left) / z));
        const endY = Math.max(0, Math.min(plate.height, (e.clientY - rect.top) / z));

        const cropW = Math.abs(endX - startX);
        const cropH = Math.abs(endY - startY);
        const cropX = Math.min(startX, endX);
        const cropY = Math.min(startY, endY);

        overlay.remove();
        window.removeEventListener('keydown', onKey);

        if (cropW > 15 && cropH > 15) {
          // Execute crop on an offscreen canvas
          const naturalW = plate.img.naturalWidth || plate.img.width;
          const naturalH = plate.img.naturalHeight || plate.img.height;
          const scaleX = naturalW / plate.width;
          const scaleY = naturalH / plate.height;

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(cropW * scaleX);
          canvas.height = Math.round(cropH * scaleY);
          const ctx = canvas.getContext('2d');

          ctx.drawImage(
            plate.img,
            Math.round(cropX * scaleX), Math.round(cropY * scaleY), canvas.width, canvas.height,
            0, 0, canvas.width, canvas.height
          );

          plate.x += cropX;
          plate.y += cropY;
          plate.width = Math.round(cropW);
          plate.height = Math.round(cropH);
          plate.aspect = cropW / cropH;
          plate.img = canvas;

          this.component.renderStage();
          this.component.showKnotToast('✂️ Cropped image plate');
        }
      };

      const onKey = (ev) => {
        if (ev.key === 'Escape') {
          overlay.remove();
          window.removeEventListener('keydown', onKey);
        }
      };

      overlay.addEventListener('mousedown', onDown);
      overlay.addEventListener('mousemove', onMove);
      overlay.addEventListener('mouseup', onUp);
      window.addEventListener('keydown', onKey);

      this.component.stageBox.appendChild(overlay);
    }

  computeExportBounds(stageState) {
      if (stageState.exportRect && stageState.exportRect.width > 10 && stageState.exportRect.height > 10) {
        return {
          x: Math.round(stageState.exportRect.x),
          y: Math.round(stageState.exportRect.y),
          width: Math.round(stageState.exportRect.width),
          height: Math.round(stageState.exportRect.height),
          isCustom: true
        };
      }

      let hasContent = false;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      const expand = (x1, y1, x2, y2) => {
        hasContent = true;
        minX = Math.min(minX, x1, x2);
        minY = Math.min(minY, y1, y2);
        maxX = Math.max(maxX, x1, x2);
        maxY = Math.max(maxY, y1, y2);
      };

      (stageState.placedImages || []).forEach(plate => {
        expand(plate.x, plate.y, plate.x + plate.width, plate.y + plate.height);
      });

      (stageState.diffCallouts || []).forEach(diff => {
        const r = (diff.radius || 16) + 16;
        expand(diff.cropX - r, diff.cropY - r, diff.cropX + r, diff.cropY + r);
      });

      (stageState.annotations || []).forEach(ann => {
        if (ann.type === 'curve' && ann.beziers) {
          const pad = (ann.strokeWidth || 4) + 18;
          ann.beziers.forEach(seg => {
            for (let t = 0; t <= 1.0; t += 0.1) {
              const pt = CurveFitter.bezier_q(seg, t);
              expand(pt[0] - pad, pt[1] - pad, pt[0] + pad, pt[1] + pad);
            }
          });
          if (ann.text && ann.text.trim() && ann.beziers.length > 0 && this.component.textManager) {
            const isAtTail = (ann.textEnd !== 'tip');
            const termSeg = isAtTail ? ann.beziers[ann.beziers.length - 1] : ann.beziers[0];
            const anchor = isAtTail ? termSeg[3] : termSeg[0];
            const exitVec = isAtTail
              ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
              : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];
            const fontS = ann.fontSize || stageState.fontSize || 20;
            const fontF = ann.fontFamily || stageState.fontFamily;
            const bounds = this.component.textManager.measureTextBounds(ann.text, fontS, fontF);
            const placement = this.component.textManager.computeTextPlacement(
              anchor, exitVec, bounds.maxW + 16, bounds.totalH + 8, ann.manualEdge ? ann.connectEdge : null
            );
            expand(placement.posX - 12, placement.posY - 12, placement.posX + bounds.maxW + 28, placement.posY + bounds.totalH + 20);
          }
        } else if (ann.type === 'text_badge') {
          const fontS = ann.fontSize || stageState.fontSize || 20;
          const fontF = ann.fontFamily || stageState.fontFamily;
          const bounds = this.component.textManager
            ? this.component.textManager.measureTextBounds(ann.text || '', fontS, fontF)
            : { maxW: 120, totalH: 30 };
          expand(ann.x - 10, ann.y - 10, ann.x + bounds.maxW + 26, ann.y + bounds.totalH + 18);
        } else if (ann.type === 'circle_callout') {
          expand(ann.cx - ann.rx - 14, ann.cy - ann.ry - 14, ann.cx + ann.rx + 14, ann.cy + ann.ry + 14);
        } else if (ann.type === 'box_callout') {
          expand(ann.x - 14, ann.y - 14, ann.x + ann.w + 14, ann.y + ann.h + 14);
        }
      });

      if (!hasContent) return { x: 0, y: 0, width: 800, height: 500, isCustom: false };

      const margin = 14;
      const x = Math.max(0, Math.floor(minX - margin));
      const y = Math.max(0, Math.floor(minY - margin));
      const width = Math.max(120, Math.ceil(maxX + margin) - x);
      const height = Math.max(80, Math.ceil(maxY + margin) - y);
      return { x, y, width, height, isCustom: false };
    }

  renderExportBoundsOverlay(targetLayer, stageState) {
      const existing = document.getElementById('qa-export-bounds-overlay');
      if (existing) existing.remove();

      const rect = stageState.exportRect;
      if (!rect || rect.width < 10 || rect.height < 10) return;

      const z = stageState.zoom || 1.0;
      const invScale = 1 / z;
      const g = makeElement('svg:g', { id: 'qa-export-bounds-overlay' });

      const big = 10000;
      const maskPath = `M -${big} -${big} H ${big} V ${big} H -${big} Z M ${rect.x} ${rect.y} V ${rect.y + rect.height} H ${rect.x + rect.width} V ${rect.y} Z`;
      g.appendChild(makeElement('svg:path', {
        d: maskPath,
        fill: 'rgba(0, 0, 0, 0.42)',
        'fill-rule': 'evenodd',
        style: { pointerEvents: 'none' }
      }));

      const borderRect = makeElement('svg:rect', {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        fill: 'none', stroke: '#ffd700', 'stroke-width': String(2 * invScale),
        'stroke-dasharray': `${7 * invScale},${4 * invScale}`,
        style: { cursor: 'move', pointerEvents: 'stroke' }
      });

      let isDraggingRect = false;
      let sX = 0, sY = 0, origX = rect.x, origY = rect.y;

      borderRect.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        isDraggingRect = true;
        sX = e.clientX; sY = e.clientY;
        origX = rect.x; origY = rect.y;

        const onM = (ev) => {
          if (!isDraggingRect) return;
          const curZ = stageState.zoom || 1.0;
          rect.x = Math.max(0, Math.round(origX + (ev.clientX - sX) / curZ));
          rect.y = Math.max(0, Math.round(origY + (ev.clientY - sY) / curZ));
          this.renderExportBoundsOverlay(targetLayer, stageState);
        };
        const onU = () => {
          isDraggingRect = false;
          window.removeEventListener('mousemove', onM);
          window.removeEventListener('mouseup', onU);
        };
        window.addEventListener('mousemove', onM);
        window.addEventListener('mouseup', onU);
      });

      g.appendChild(borderRect);

      const gripSize = 10 * invScale;
      const half = gripSize / 2;
      const corners = [
        { id: 'nw', x: rect.x, y: rect.y, cursor: 'nwse-resize' },
        { id: 'ne', x: rect.x + rect.width, y: rect.y, cursor: 'nesw-resize' },
        { id: 'se', x: rect.x + rect.width, y: rect.y + rect.height, cursor: 'nwse-resize' },
        { id: 'sw', x: rect.x, y: rect.y + rect.height, cursor: 'nesw-resize' }
      ];

      corners.forEach(c => {
        const handle = makeElement('svg:rect', {
          x: c.x - half, y: c.y - half, width: gripSize, height: gripSize,
          fill: '#ffd700', stroke: '#070a13', 'stroke-width': String(1.5 * invScale), rx: String(2 * invScale),
          style: { cursor: c.cursor, pointerEvents: 'all' }
        });

        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const startX = e.clientX, startY = e.clientY;
          const stRect = { ...rect };

          const onMove = (ev) => {
            const curZ = stageState.zoom || 1.0;
            const dx = (ev.clientX - startX) / curZ;
            const dy = (ev.clientY - startY) / curZ;

            if (c.id.includes('e')) rect.width = Math.max(40, Math.round(stRect.width + dx));
            if (c.id.includes('s')) rect.height = Math.max(40, Math.round(stRect.height + dy));
            if (c.id.includes('w')) {
              const newW = Math.max(40, Math.round(stRect.width - dx));
              rect.x = Math.round(stRect.x + (stRect.width - newW));
              rect.width = newW;
            }
            if (c.id.includes('n')) {
              const newH = Math.max(40, Math.round(stRect.height - dy));
              rect.y = Math.round(stRect.y + (stRect.height - newH));
              rect.height = newH;
            }
            this.renderExportBoundsOverlay(targetLayer, stageState);
          };

          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        });

        g.appendChild(handle);
      });

      const pillFo = makeElement('svg:foreignObject', {
        x: rect.x, y: Math.max(0, rect.y - 28 * invScale), width: '240', height: '26',
        style: { overflow: 'visible', transformOrigin: '0 100%', transform: `scale(${invScale})` }
      });

      const pill = makeElement('div', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'rgba(9, 13, 22, 0.96)', border: '1px solid #ffd700',
          borderRadius: '14px', padding: '2px 8px', fontSize: '10px', fontFamily: 'monospace',
          color: '#ffd700', boxShadow: '0 4px 12px rgba(0,0,0,0.8)', whiteSpace: 'nowrap'
        }
      }, [
        makeElement('span', { style: { fontWeight: 'bold' } }, `📐 Export: ${Math.round(rect.width)}×${Math.round(rect.height)}`),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 6px', fontSize: '9.5px', color: '#ff7b72', borderColor: 'rgba(255,123,114,0.4)' },
          title: 'Reset to automatic export bounds',
          onclick: (e) => {
            e.stopPropagation();
            stageState.exportRect = null;
            this.component.renderStage();
            this.component.showKnotToast('📐 Export bounds reset to Auto');
          }
        }, '✕ Auto')
      ]);

      pillFo.appendChild(pill);
      g.appendChild(pillFo);
      targetLayer.appendChild(g);
    }
}

globalThis.QuoraImageManager = QuoraImageManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraImageManager;