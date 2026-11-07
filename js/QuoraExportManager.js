/**
 * QuoraExportManager
 * Handles high-resolution retina rendering, layout aspect ratio presets,
 * and artifact-free PNG clipboard extraction.
 */
class QuoraExportManager {
  constructor(component) {
    this.component = component;
  }

  copyCompositeToClipboard(btn, preset = 'native') {
    const tf = this.component.computeAutoBounds();
    const c = document.createElement('canvas');

    let exportW = tf.totalW;
    let exportH = tf.totalH;
    let drawOffsetX = 0;
    let drawOffsetY = 0;

    if (preset === 'quora') {
      // 16:9 Standard Header (1200 x 675)
      exportW = 1200;
      exportH = 675;
      drawOffsetX = (exportW - tf.totalW) / 2;
      drawOffsetY = (exportH - tf.totalH) / 2;
    } else if (preset === 'substack') {
      // 21:9 Wide Header Banner (1200 x 514)
      exportW = 1200;
      exportH = 514;
      drawOffsetX = (exportW - tf.totalW) / 2;
      drawOffsetY = (exportH - tf.totalH) / 2;
    } else if (preset === 'square') {
      // 1:1 Square Detail Card (1080 x 1080)
      const dim = Math.max(1080, Math.max(tf.totalW, tf.totalH));
      exportW = dim;
      exportH = dim;
      drawOffsetX = (exportW - tf.totalW) / 2;
      drawOffsetY = (exportH - tf.totalH) / 2;
    }

    c.width = exportW * 2;
    c.height = exportH * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = this.component.stageState.canvasBgColor || '#090d16';
    ctx.fillRect(0, 0, exportW, exportH);
    ctx.drawImage(this.component.sceneCanvas, drawOffsetX, drawOffsetY);

    // Isolate interactive handles so they never appear on exported artwork
    const controlsPrev = this.component.controlsLayer.style.display;
    const glowPrev = this.component.glowLayer.style.display;
    this.component.controlsLayer.style.display = 'none';
    this.component.glowLayer.style.display = 'none';

    const svgXml = new XMLSerializer().serializeToString(this.component.svgSurface);

    this.component.controlsLayer.style.display = controlsPrev;
    this.component.glowLayer.style.display = glowPrev;

    const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, drawOffsetX, drawOffsetY);
      URL.revokeObjectURL(url);
      c.toBlob(png => {
        if (png) navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
        if (btn) {
          const orig = btn.textContent;
          const label = preset === 'native' ? '✓ Copied 2x PNG!' : `✓ Copied ${preset.toUpperCase()} PNG!`;
          btn.textContent = label;
          setTimeout(() => { btn.textContent = orig; }, 2000);
        }
        this.component.showKnotToast(`📋 Copied ${exportW}×${exportH}px Retina PNG`);
      });
    };
    img.src = url;
  }
}

globalThis.QuoraExportManager = QuoraExportManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraExportManager;