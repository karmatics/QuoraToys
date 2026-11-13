/**
 * QuoraExportManager
 * Handles high-resolution retina rendering, layout aspect ratio presets,
 * and artifact-free PNG clipboard extraction.
 */
class QuoraExportManager {
  constructor(component) {
    this.component = component;
  }

  copyCompositeToClipboard(btn, preset = 'native', downloadOnly = false) {
      if (this.component._commitActiveInlineEditor) {
        this.component._commitActiveInlineEditor();
      }

      const p = this.component.stageState.prefs || {};
      const scale = p.exportMultiplier || 2;
      const bgMode = p.exportBgMode || 'matte';

      const bounds = this.component.imageManager
        ? this.component.imageManager.computeExportBounds(this.component.stageState)
        : { x: 0, y: 0, width: 800, height: 500 };

      const originX = bounds.x;
      const originY = bounds.y;
      const contentW = bounds.width;
      const contentH = bounds.height;

      let exportW = contentW;
      let exportH = contentH;
      let drawOffsetX = 0;
      let drawOffsetY = 0;

      if (preset === 'quora') {
        exportW = 1200; exportH = 675;
        drawOffsetX = Math.round((exportW - contentW) / 2);
        drawOffsetY = Math.round((exportH - contentH) / 2);
      } else if (preset === 'substack') {
        exportW = 1200; exportH = 514;
        drawOffsetX = Math.round((exportW - contentW) / 2);
        drawOffsetY = Math.round((exportH - contentH) / 2);
      } else if (preset === 'square') {
        const dim = Math.max(1080, contentW, contentH);
        exportW = dim; exportH = dim;
        drawOffsetX = Math.round((exportW - contentW) / 2);
        drawOffsetY = Math.round((exportH - contentH) / 2);
      }

      const c = document.createElement('canvas');
      c.width = Math.round(exportW * scale);
      c.height = Math.round(exportH * scale);
      const ctx = c.getContext('2d');
      ctx.scale(scale, scale);

      if (bgMode !== 'transparent') {
        ctx.fillStyle = this.component.stageState.canvasBgColor || p.canvasBgColor || '#090d16';
        ctx.fillRect(0, 0, exportW, exportH);
      }

      const srcW = Math.min(contentW, Math.max(0, this.component.sceneCanvas.width - originX));
      const srcH = Math.min(contentH, Math.max(0, this.component.sceneCanvas.height - originY));
      if (srcW > 0 && srcH > 0) {
        if (bgMode === 'transparent') {
          (this.component.stageState.placedImages || []).forEach(plate => {
            ctx.save();
            ctx.globalAlpha = (plate.opacity !== undefined) ? plate.opacity : 1.0;
            ctx.drawImage(plate.img, plate.x - originX + drawOffsetX, plate.y - originY + drawOffsetY, plate.width, plate.height);
            ctx.restore();
          });
        } else {
          ctx.drawImage(this.component.sceneCanvas, originX, originY, srcW, srcH, drawOffsetX, drawOffsetY, srcW, srcH);
        }
      }

      const svgClone = this.component.svgSurface.cloneNode(true);
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.setAttribute('width', String(contentW));
      svgClone.setAttribute('height', String(contentH));
      svgClone.setAttribute('viewBox', `${originX} ${originY} ${contentW} ${contentH}`);
      svgClone.removeAttribute('style');

      svgClone.querySelectorAll(
        '.qa-interactive-controls, .qa-heads-up-dial-layer, .qa-ghost-text-placeholder, #qa-active-hover-glow, #qa-drag-ghost-curve, #qa-export-bounds-overlay'
      ).forEach(el => el.remove());

      const svgXml = new XMLSerializer().serializeToString(svgClone);
      const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, drawOffsetX, drawOffsetY, contentW, contentH);
        URL.revokeObjectURL(url);
        c.toBlob(png => {
          if (!png) return;
          if (downloadOnly) {
            const dlUrl = URL.createObjectURL(png);
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = `QuoraToys_Annotated_${exportW}x${exportH}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(dlUrl);
            this.component.showKnotToast(`💾 Saved ${exportW}×${exportH}px (${scale}x PNG)`);
            return;
          }
          if (navigator.clipboard && navigator.clipboard.write) {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).then(() => {
              if (btn) {
                const orig = btn.textContent;
                btn.textContent = `✓ Copied ${scale}x PNG!`;
                setTimeout(() => { btn.textContent = orig; }, 1800);
              }
              this.component.showKnotToast(`📋 Copied ${exportW}×${exportH}px (${scale}x PNG)`);
            });
          }
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        this.component.showKnotToast('⚠ SVG export failed');
      };
      img.src = url;
    }
}

globalThis.QuoraExportManager = QuoraExportManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraExportManager;