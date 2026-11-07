/**
 * QuoraPaintManager
 * Dedicated module for blockout mask shapes and Gemini AI inpainting preparation.
 */
class QuoraPaintManager {
  constructor(component) {
    this.component = component;
  }

  updateSvgBlurFilter(svgDefs, softness = 0) {
    if (!svgDefs) return;
    let filter = svgDefs.querySelector('#qa-brush-blur');
    if (!filter) {
      filter = makeElement('svg:filter', {
        id: 'qa-brush-blur', x: '-30%', y: '-30%', width: '160%', height: '160%'
      });
      svgDefs.appendChild(filter);
    }
    filter.innerHTML = `<feGaussianBlur stdDeviation="${softness || 0}" />`;
  }

  previewRect(paintLayer, p1, p2, color, softness = 0) {
    const x = Math.min(p1[0], p2[0]), y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]), h = Math.abs(p2[1] - p1[1]);
    let preview = paintLayer.querySelector('#qa-rect-preview');
    if (!preview) {
      preview = makeElement('svg:rect', {
        id: 'qa-rect-preview', fill: color, opacity: '0.9',
        ...(softness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
      });
      paintLayer.appendChild(preview);
    }
    preview.setAttribute('x', x);
    preview.setAttribute('y', y);
    preview.setAttribute('width', w);
    preview.setAttribute('height', h);
  }

  commitRect(paintLayer, stageState, p1, p2, color, softness = 0) {
    const preview = paintLayer.querySelector('#qa-rect-preview');
    if (preview) preview.remove();
    const x = Math.min(p1[0], p2[0]), y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]), h = Math.abs(p2[1] - p1[1]);
    if (w < 4 || h < 4) return;
    const rectEl = makeElement('svg:rect', {
      x, y, width: w, height: h, fill: color,
      ...(softness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
    });
    paintLayer.appendChild(rectEl);
    stageState.annotations.push({ type: 'paint', shape: 'rect', element: rectEl, bounds: { x, y, w, h } });
    this.component.renderStage();
  }

  previewOval(paintLayer, p1, p2, color, softness = 0) {
    const cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2;
    const rx = Math.abs(p2[0] - p1[0]) / 2, ry = Math.abs(p2[1] - p1[1]) / 2;
    let preview = paintLayer.querySelector('#qa-oval-preview');
    if (!preview) {
      preview = makeElement('svg:ellipse', {
        id: 'qa-oval-preview', fill: color, opacity: '0.9',
        ...(softness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
      });
      paintLayer.appendChild(preview);
    }
    preview.setAttribute('cx', cx);
    preview.setAttribute('cy', cy);
    preview.setAttribute('rx', rx);
    preview.setAttribute('ry', ry);
  }

  commitOval(paintLayer, stageState, p1, p2, color, softness = 0) {
    const preview = paintLayer.querySelector('#qa-oval-preview');
    if (preview) preview.remove();
    const cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2;
    const rx = Math.abs(p2[0] - p1[0]) / 2, ry = Math.abs(p2[1] - p1[1]) / 2;
    if (rx < 4 || ry < 4) return;
    const ovalEl = makeElement('svg:ellipse', {
      cx, cy, rx, ry, fill: color,
      ...(softness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
    });
    paintLayer.appendChild(ovalEl);
    stageState.annotations.push({ type: 'paint', shape: 'oval', element: ovalEl, bounds: { cx, cy, rx, ry } });
    this.component.renderStage();
  }
}

globalThis.QuoraPaintManager = QuoraPaintManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraPaintManager;