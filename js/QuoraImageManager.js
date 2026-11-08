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
      let minX = 0, minY = 0, maxX = 720, maxY = 420;

      // 1. Placed Image Plates
      (stageState.placedImages || []).forEach(plate => {
        minX = Math.min(minX, plate.x);
        minY = Math.min(minY, plate.y);
        maxX = Math.max(maxX, plate.x + plate.width);
        maxY = Math.max(maxY, plate.y + plate.height);
      });

      // 2. Optical Difference Callouts
      (stageState.diffCallouts || []).forEach(diff => {
        const r = diff.radius;
        minX = Math.min(minX, diff.cropX - r - 20);
        maxX = Math.max(maxX, diff.cropX + r + 20);
        minY = Math.min(minY, diff.cropY - r - 20);
        maxY = Math.max(maxY, diff.cropY + r + 20);
      });

      // 3. Vector Annotations, Splines & Attached Text Badges (Prevents Bracket Clipping)
      (stageState.annotations || []).forEach(ann => {
        if (ann.type === 'curve' && ann.vertices) {
          ann.vertices.forEach(v => {
            minX = Math.min(minX, v.point[0] - 20);
            maxX = Math.max(maxX, v.point[0] + 20);
            minY = Math.min(minY, v.point[1] - 20);
            maxY = Math.max(maxY, v.point[1] + 20);
          });

          // Include text callout box boundaries if text is attached
          if (ann.text && ann.beziers?.length > 0) {
            const isAtTail = (ann.textEnd !== 'tip');
            const termSeg = isAtTail ? ann.beziers[ann.beziers.length - 1] : ann.beziers[0];
            const anchor = isAtTail ? termSeg[3] : termSeg[0];
            const bW = ann.boxWidth || 280;
            const bH = 80;

            minX = Math.min(minX, anchor[0] - bW - 30);
            maxX = Math.max(maxX, anchor[0] + bW + 30);
            minY = Math.min(minY, anchor[1] - bH - 30);
            maxY = Math.max(maxY, anchor[1] + bH + 30);
          }
        } else if (ann.type === 'text_badge') {
          const bW = ann.boxWidth || 260;
          const bH = 60;
          minX = Math.min(minX, ann.x - 20);
          maxX = Math.max(maxX, ann.x + bW + 20);
          minY = Math.min(minY, ann.y - 20);
          maxY = Math.max(maxY, ann.y + bH + 20);
        }
      });

      const totalW = Math.max(1100, Math.round((maxX - minX) + (pad * 2)));
      const totalH = Math.max(640, Math.round((maxY - minY) + (pad * 2)));

      stageState.canvasWidth = totalW;
      stageState.canvasHeight = totalH;

      return {
        totalW, totalH,
        offsetX: Math.round(-minX + pad),
        offsetY: Math.round(-minY + pad)
      };
  }

  renderControls(controlsLayer, stageState) {
      controlsLayer.querySelectorAll('.qa-image-plate-control').forEach(el => el.remove());
      const plate = stageState.activeImage;
      if (!plate) return;

      const g = makeElement('svg:g', { className: 'qa-image-plate-control' });

      // 1. Transparent Drag Surface
      const dragSurface = makeElement('svg:rect', {
        x: plate.x, y: plate.y, width: plate.width, height: plate.height,
        fill: 'rgba(0, 242, 254, 0.02)', stroke: '#00f2fe', 'stroke-width': '1.8',
        'stroke-dasharray': '6,4',
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
          const z = stageState.zoom || 1.0;
          plate.x = Math.round(initialPlateX + (ev.clientX - startMouseX) / z);
          plate.y = Math.round(initialPlateY + (ev.clientY - startMouseY) / z);
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

      // 2. Mini Action Deck Docked Above Image Top Edge
      const deckY = plate.y - 28;
      const deckX = plate.x;

      const deckForeign = makeElement('svg:foreignObject', {
        className: 'qa-plate-mini-toolbar',
        x: deckX, y: deckY, width: '270', height: '26',
        style: { overflow: 'visible', pointerEvents: 'auto' }
      });

      const isFaded = (plate.opacity === 0.5);

      const deckWrap = makeElement('div', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          background: 'rgba(9, 13, 22, 0.94)', border: '1px solid rgba(0, 242, 254, 0.45)',
          borderRadius: '14px', padding: '2px 6px', boxShadow: '0 4px 12px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)'
        }
      }, [
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 6px', fontSize: '9.5px', color: '#00f2fe' },
          title: 'Clone image plate (D)',
          onclick: (e) => { e.stopPropagation(); this.duplicateActivePlate(stageState); }
        }, '⧉ Clone'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 6px', fontSize: '9.5px', color: isFaded ? '#ffd700' : '#cbd5e1' },
          title: 'Toggle Opacity (100% / 50%)',
          onclick: (e) => { e.stopPropagation(); this.togglePlateOpacity(stageState, plate); }
        }, isFaded ? '◐ 50%' : '● 100%'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 5px', fontSize: '9.5px' },
          title: 'Bring forward in layer stack',
          onclick: (e) => { e.stopPropagation(); this.bringForward(stageState, plate); }
        }, '▲'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 5px', fontSize: '9.5px' },
          title: 'Send backward in layer stack',
          onclick: (e) => { e.stopPropagation(); this.sendBackward(stageState, plate); }
        }, '▼'),
        makeElement('button', {
          className: 'dr-nav-btn',
          style: { padding: '1px 6px', fontSize: '9.5px', color: '#ff7b72' },
          title: 'Delete image plate (Del)',
          onclick: (e) => { e.stopPropagation(); this.deleteActivePlate(stageState); }
        }, '🗑️ Del')
      ]);

      deckForeign.appendChild(deckWrap);
      g.appendChild(deckForeign);

      // 3. 4-Corner Proportional Resize Grips
      const corners = [
        { id: 'nw', x: plate.x, y: plate.y, cursor: 'nwse-resize' },
        { id: 'ne', x: plate.x + plate.width, y: plate.y, cursor: 'nesw-resize' },
        { id: 'se', x: plate.x + plate.width, y: plate.y + plate.height, cursor: 'nwse-resize' },
        { id: 'sw', x: plate.x, y: plate.y + plate.height, cursor: 'nesw-resize' }
      ];

      corners.forEach(corner => {
        const grip = makeElement('svg:rect', {
          x: corner.x - 5, y: corner.y - 5, width: '10', height: '10',
          fill: '#00f2fe', stroke: '#ffffff', 'stroke-width': '1.5', rx: '2',
          style: { cursor: corner.cursor, pointerEvents: 'all', filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' },
          title: 'Drag to scale image proportionally'
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
            const z = stageState.zoom || 1.0;
            const deltaX = (ev.clientX - startX) / z;

            if (corner.id === 'se') {
              const newW = Math.max(60, startW + deltaX);
              plate.width = newW;
              plate.height = Math.round(newW / plate.aspect);
            } else if (corner.id === 'sw') {
              const newW = Math.max(60, startW - deltaX);
              plate.x = startPlateX + (startW - newW);
              plate.width = newW;
              plate.height = Math.round(newW / plate.aspect);
            } else if (corner.id === 'ne') {
              const newW = Math.max(60, startW + deltaX);
              const newH = Math.round(newW / plate.aspect);
              plate.y = startPlateY + (startH - newH);
              plate.width = newW;
              plate.height = newH;
            } else if (corner.id === 'nw') {
              const newW = Math.max(60, startW - deltaX);
              const newH = Math.round(newW / plate.aspect);
              plate.x = startPlateX + (startW - newW);
              plate.y = startPlateY + (startH - newH);
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

    // 1. Inspect clipboard for valid image content
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

    // 2. If no clipboard image is available, invoke file input directly
    if (!clipboardBlob) {
      if (localFileInput) localFileInput.click();
      return;
    }

    // 3. Load clipboard image to display preview in modal
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
        display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 4px',
        color: '#f8fafc', fontFamily: 'monospace'
      }
    });

    const imgWidth = clipboardImg.naturalWidth || clipboardImg.width;
    const imgHeight = clipboardImg.naturalHeight || clipboardImg.height;

    content.innerHTML = `
      <div style="font-size:11.5px; color:#94a3b8; line-height:1.5;">
        A valid image was found on your clipboard. Would you like to place it directly or browse your file system?
      </div>
    `;

    // Thumbnail Preview Card
    const thumbCard = makeElement('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: '12px',
        background: 'rgba(0, 242, 254, 0.05)', border: '1.5px solid rgba(0, 242, 254, 0.3)',
        borderRadius: '8px', padding: '10px'
      }
    }, [
      makeElement('img', {
        src: clipboardImg.src,
        style: {
          maxWidth: '90px', maxHeight: '70px', borderRadius: '4px',
          objectFit: 'contain', background: '#090d16', border: '1px solid #1e293b'
        }
      }),
      makeElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
        makeElement('strong', { style: { color: '#00f2fe', fontSize: '12px' } }, 'Clipboard Image Available'),
        makeElement('span', { style: { fontSize: '10.5px', color: '#cbd5e1' } }, `${imgWidth} × ${imgHeight} px`),
        makeElement('span', { style: { fontSize: '9.5px', color: '#10b981' } }, '● Ready to place')
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
    }, '📁 Browse File System...');

    actionsRow.append(browseFilesBtn, useClipboardBtn);
    content.appendChild(actionsRow);

    const dialog = UITools.makeDialog({
      title: '🖼️ Add Image Option',
      size: [450, 270],
      contentElement: content,
      appendTo: document.body
    });
  }

  eraseImagePlatePixels(plate, worldX, worldY, brushRadius = 24, softness = 0) {
    if (!plate || !plate.img) return;

    let canvas = plate._eraseCanvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = plate.img.naturalWidth || plate.img.width;
      canvas.height = plate.img.naturalHeight || plate.img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(plate.img, 0, 0);
      plate._eraseCanvas = canvas;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    const scaleX = canvas.width / plate.width;
    const scaleY = canvas.height / plate.height;
    const localX = (worldX - plate.x) * scaleX;
    const localY = (worldY - plate.y) * scaleY;
    const r = brushRadius * scaleX;

    if (softness > 0) {
      const grad = ctx.createRadialGradient(localX, localY, Math.max(0, r * 0.3), localX, localY, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(localX, localY, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(localX, localY, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Refresh plate texture directly from memory canvas
    plate.img = canvas;
    this.component.renderStage();
  }
}

globalThis.QuoraImageManager = QuoraImageManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraImageManager;