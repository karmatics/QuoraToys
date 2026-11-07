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
}

globalThis.QuoraImageManager = QuoraImageManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraImageManager;