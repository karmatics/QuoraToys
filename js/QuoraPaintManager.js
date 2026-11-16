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
    this._upsertPreview(paintLayer, 'qa-rect-preview', 'rect', { x, y, width: Math.abs(p2[0] - p1[0]), height: Math.abs(p2[1] - p1[1]) }, color, softness);
  }

  commitRect(paintLayer, stageState, p1, p2, color, softness = 0) {
    const x = Math.min(p1[0], p2[0]), y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]), h = Math.abs(p2[1] - p1[1]);
    if (w >= 4 && h >= 4) this._commitShape(paintLayer, stageState, 'qa-rect-preview', 'rect', 'rect', { x, y, width: w, height: h }, { x, y, w, h }, color, softness);
    else paintLayer.querySelector('#qa-rect-preview')?.remove();
  }

  previewOval(paintLayer, p1, p2, color, softness = 0) {
    const cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2;
    this._upsertPreview(paintLayer, 'qa-oval-preview', 'ellipse', { cx, cy, rx: Math.abs(p2[0] - p1[0]) / 2, ry: Math.abs(p2[1] - p1[1]) / 2 }, color, softness);
  }

  commitOval(paintLayer, stageState, p1, p2, color, softness = 0) {
    const cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2;
    const rx = Math.abs(p2[0] - p1[0]) / 2, ry = Math.abs(p2[1] - p1[1]) / 2;
    if (rx >= 4 && ry >= 4) this._commitShape(paintLayer, stageState, 'qa-oval-preview', 'oval', 'ellipse', { cx, cy, rx, ry }, { cx, cy, rx, ry }, color, softness);
    else paintLayer.querySelector('#qa-oval-preview')?.remove();
  }
  _upsertPreview(paintLayer, id, tag, attrs, color, softness) {
    let el = paintLayer.querySelector(`#${id}`);
    if (!el) {
      el = makeElement(`svg:${tag}`, {
        id, fill: color, opacity: '0.9',
        ...(softness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
      });
      paintLayer.appendChild(el);
    }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  }

  _commitShape(paintLayer, stageState, previewId, shape, tag, attrs, bounds, color, softness) {
    paintLayer.querySelector(`#${previewId}`)?.remove();
    const el = makeElement(`svg:${tag}`, {
      ...attrs, fill: color, ...(softness > 0 ? { filter: 'url(#qa-brush-blur)' } : {})
    });
    paintLayer.appendChild(el);
    stageState.annotations.push({ type: 'paint', shape, element: el, bounds });
    this.component.renderStage();
  }
}

globalThis.QuoraPaintManager = QuoraPaintManager;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraPaintManager;