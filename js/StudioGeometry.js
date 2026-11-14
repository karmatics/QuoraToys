/**
 * StudioGeometry
 * Pure mathematical and geometric primitives for QuoraToys.
 * Zero DOM, zero SVG element creation, zero UI coupling.
 */
class StudioGeometry {
  static dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  static clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  static normalize(v) {
    const len = Math.hypot(v[0], v[1]);
    if (len < 1e-8) return [1, 0];
    return [v[0] / len, v[1] / len];
  }

  static distToSegment(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  static stepDrawstringTether(points, cursorPt, tetherLen = 32, eraseR = 20, prevCursorPt = null, tetherState = null) {
      const pts = (points || []).map(p => [p[0], p[1]]);
      const st = tetherState || {};
      let cuspIndices = Array.isArray(st.cuspIndices) ? [...st.cuspIndices] : [];
      let inSlackRedirect = Boolean(st.inSlackRedirect);
      let slackIncomingDir = st.slackIncomingDir ? [st.slackIncomingDir[0], st.slackIncomingDir[1]] : null;
      const cuspAngleDeg = st.cuspAngleDeg !== undefined ? st.cuspAngleDeg : 45;

      if (pts.length === 0) {
        return {
          points: [[cursorPt[0], cursorPt[1]]],
          didRewind: false, didAdvance: false, isSlack: false,
          curTip: [cursorPt[0], cursorPt[1]], dist: 0,
          cuspIndices: [], inSlackRedirect: false, slackIncomingDir: null, pendingCusp: false, turnDeg: 0
        };
      }

      const sweepFrom = prevCursorPt || cursorPt;
      let didRewind = false;

      while (pts.length > 1) {
        const tip = pts[pts.length - 1];
        const dTip = Math.hypot(cursorPt[0] - tip[0], cursorPt[1] - tip[1]);
        const dSweep = StudioGeometry.distToSegment(tip, sweepFrom, cursorPt);
        if (dTip <= eraseR || dSweep <= eraseR) {
          pts.pop();
          didRewind = true;
        } else {
          break;
        }
      }

      cuspIndices = cuspIndices.filter(idx => idx > 0 && idx < pts.length - 1);

      if (didRewind) {
        if (pts.length >= 2) {
          inSlackRedirect = true;
          slackIncomingDir = StudioGeometry.computeIncomingDir(pts, pts.length - 1);
        } else {
          inSlackRedirect = false;
          slackIncomingDir = null;
        }
      }

      const last = pts[pts.length - 1];
      const dist = Math.hypot(cursorPt[0] - last[0], cursorPt[1] - last[1]);

      if (!didRewind && !inSlackRedirect && pts.length >= 2 && dist <= tetherLen * 0.88) {
        inSlackRedirect = true;
        slackIncomingDir = StudioGeometry.computeIncomingDir(pts, pts.length - 1);
      }

      let turnDeg = 0;
      let pendingCusp = false;
      if (inSlackRedirect && slackIncomingDir && dist > 6) {
        const outDir = StudioGeometry.normalize([cursorPt[0] - last[0], cursorPt[1] - last[1]]);
        const dot = StudioGeometry.clamp(slackIncomingDir[0] * outDir[0] + slackIncomingDir[1] * outDir[1], -1, 1);
        turnDeg = Math.acos(dot) * (180 / Math.PI);
        pendingCusp = (turnDeg >= cuspAngleDeg);
      }

      let didAdvance = false;
      if (!didRewind && dist > tetherLen) {
        const ux = (cursorPt[0] - last[0]) / dist;
        const uy = (cursorPt[1] - last[1]) / dist;
        pts.push([cursorPt[0] - ux * tetherLen, cursorPt[1] - uy * tetherLen]);
        didAdvance = true;

        if (inSlackRedirect && pendingCusp) {
          const cuspIdx = pts.length - 2;
          if (cuspIdx > 0 && !cuspIndices.includes(cuspIdx)) {
            cuspIndices.push(cuspIdx);
          }
        }
        inSlackRedirect = false;
        slackIncomingDir = null;
        pendingCusp = false;
      }

      const curTip = pts[pts.length - 1];
      const curDist = Math.hypot(cursorPt[0] - curTip[0], cursorPt[1] - curTip[1]);

      return {
        points: pts,
        didRewind,
        didAdvance,
        isSlack: curDist < (tetherLen * 0.96),
        curTip,
        dist: curDist,
        cuspIndices,
        inSlackRedirect,
        slackIncomingDir,
        pendingCusp,
        turnDeg
      };
    }
  static smoothPolylineToSvgD(pts) {
    if (!pts || pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[0][0]} ${pts[0][1]}`;
    if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;

    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i][0] + pts[i + 1][0]) / 2;
      const yc = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q ${pts[i][0]} ${pts[i][1]} ${xc} ${yc}`;
    }
    d += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
    return d;
  }

  static beziersToSvgD(beziers, isClosed = false) {
    if (!beziers || beziers.length === 0) return '';
    let d = `M ${beziers[0][0][0]} ${beziers[0][0][1]}`;
    for (let i = 0; i < beziers.length; i++) {
      const [, cp1, cp2, end] = beziers[i];
      d += ` C ${cp1[0]} ${cp1[1]}, ${cp2[0]} ${cp2[1]}, ${end[0]} ${end[1]}`;
    }
    if (isClosed) d += ' Z';
    return d;
  }

  static splitBezierAtT(seg, t = 0.5) {
    const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    const p0 = seg[0], p1 = seg[1], p2 = seg[2], p3 = seg[3];
    const p01 = lerp(p0, p1, t);
    const p12 = lerp(p1, p2, t);
    const p23 = lerp(p2, p3, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const midPt = lerp(p012, p123, t);

    return {
      leftSeg: [p0.slice(), p01, p012, midPt.slice()],
      rightSeg: [midPt.slice(), p123, p23, p3.slice()],
      point: midPt
    };
  }

  static beziersToVertices(beziers, cuspVertexIndices = []) {
      if (!beziers || beziers.length === 0) return [];
      const n = beziers.length;
      const cuspSet = new Set(cuspVertexIndices || []);
      const vertices = [];

      const makeVert = (pt) => {
        if (typeof BezierVertex !== 'undefined') return new BezierVertex(pt);
        return {
          point: pt.slice(),
          controlPoints: [pt.slice(), pt.slice()],
          tangents: [null, null],
          curvature: 1,
          balance: 1,
          pointType: 'click',
          isTentative: false,
          isCusp: false,
          isExplicitTangent: false,
          cuspInAngleOffset: 0,
          cuspOutAngleOffset: 0
        };
      };

      for (let i = 0; i <= n; i++) {
        const pt = (i < n) ? beziers[i][0].slice(0, 2) : beziers[n - 1][3].slice(0, 2);
        const v = makeVert(pt);
        v.controlPoints[0] = (i > 0) ? beziers[i - 1][2].slice(0, 2) : pt.slice(0, 2);
        v.controlPoints[1] = (i < n) ? beziers[i][1].slice(0, 2) : pt.slice(0, 2);
        v.isExplicitTangent = false;
        v.isCusp = cuspSet.has(i);
        v.cuspInAngleOffset = 0;
        v.cuspOutAngleOffset = 0;
        vertices.push(v);
      }

      const savedHandles = [];
      for (let i = 0; i <= n; i++) {
        const v = vertices[i];
        const prevV = vertices[i - 1];
        const nextV = vertices[i + 1];

        const dPrev = prevV ? Math.hypot(v.point[0] - prevV.point[0], v.point[1] - prevV.point[1]) : 0;
        const dNext = nextV ? Math.hypot(nextV.point[0] - v.point[0], nextV.point[1] - v.point[1]) : 0;
        const lIn = prevV ? Math.hypot(v.controlPoints[0][0] - v.point[0], v.controlPoints[0][1] - v.point[1]) : 0;
        const lOut = nextV ? Math.hypot(v.controlPoints[1][0] - v.point[0], v.controlPoints[1][1] - v.point[1]) : 0;

        const sIn = (dPrev > 1e-4) ? (3 * lIn / dPrev) : 1.0;
        const sOut = (dNext > 1e-4) ? (3 * lOut / dNext) : 1.0;

        if (prevV && nextV) {
          const sumS = sIn + sOut;
          v.curvature = Math.max(0.25, Math.min(2.5, sumS / 2));
          v.balance = sumS > 1e-4 ? Math.max(0.15, Math.min(1.85, (2 * sIn) / sumS)) : 1.0;
        } else if (nextV) {
          v.curvature = Math.max(0.25, Math.min(2.5, sOut));
          v.balance = 1.0;
        } else if (prevV) {
          v.curvature = Math.max(0.25, Math.min(2.5, sIn));
          v.balance = 1.0;
        }

        let actualTangent = null;
        if (nextV && lOut > 1e-4) {
          actualTangent = [(v.controlPoints[1][0] - v.point[0]) / lOut, (v.controlPoints[1][1] - v.point[1]) / lOut];
        } else if (prevV && lIn > 1e-4) {
          actualTangent = [(v.point[0] - v.controlPoints[0][0]) / lIn, (v.point[1] - v.controlPoints[0][1]) / lIn];
        }

        const actualInDir = (prevV && lIn > 1e-4)
          ? [(v.controlPoints[0][0] - v.point[0]) / lIn, (v.controlPoints[0][1] - v.point[1]) / lIn]
          : null;
        const actualOutDir = (nextV && lOut > 1e-4)
          ? [(v.controlPoints[1][0] - v.point[0]) / lOut, (v.controlPoints[1][1] - v.point[1]) / lOut]
          : null;

        savedHandles.push({
          cp0: v.controlPoints[0].slice(),
          cp1: v.controlPoints[1].slice(),
          actualTangent,
          actualInDir,
          actualOutDir
        });
      }

      if (typeof UpdateControlPoints !== 'undefined' && typeof UpdateControlPoints.computeNaturalBaselines === 'function') {
        UpdateControlPoints.computeNaturalBaselines(vertices, 8);
      }

      const signedAngle = (a, b) => {
        const cross = a[0] * b[1] - a[1] * b[0];
        const dot = a[0] * b[0] + a[1] * b[1];
        const ang = Math.atan2(cross, dot);
        return Math.abs(ang) < 0.01 ? 0 : ang;
      };

      for (let i = 0; i <= n; i++) {
        const v = vertices[i];
        const saved = savedHandles[i];

        if (v.isCusp) {
          const natIn = v._naturalInTangent || [-1, 0];
          const natOut = v._naturalOutTangent || [1, 0];
          v.cuspInAngleOffset = saved.actualInDir ? signedAngle(natIn, saved.actualInDir) : 0;
          v.cuspOutAngleOffset = saved.actualOutDir ? signedAngle(natOut, saved.actualOutDir) : 0;
          v.tangentAngleOffset = 0;
        } else {
          const naturalTangent = v._naturalTangent || [1, 0];
          v.tangentAngleOffset = (saved.actualTangent && naturalTangent)
            ? signedAngle(naturalTangent, saved.actualTangent)
            : 0;
        }

        v.controlPoints = [saved.cp0, saved.cp1];
        v.isExplicitTangent = false;
      }

      return vertices;
    }
  static verticesToBeziers(vertices) {
    if (!vertices || vertices.length < 2) return [];
    if (typeof UpdateControlPoints !== 'undefined') {
      UpdateControlPoints.run(vertices, 6);
    }

    const beziers = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      beziers.push([
        [vertices[i].point[0], vertices[i].point[1]],
        [vertices[i].controlPoints[1][0], vertices[i].controlPoints[1][1]],
        [vertices[i + 1].controlPoints[0][0], vertices[i + 1].controlPoints[0][1]],
        [vertices[i + 1].point[0], vertices[i + 1].point[1]]
      ]);
    }
    return beziers;
  }

  static computeCurveExitVector(beziers, knotIdx) {
    if (!beziers || beziers.length === 0) return [1, 0];
    const n = beziers.length;

    if (knotIdx === 0) {
      return StudioGeometry.normalize([
        beziers[0][0][0] - beziers[0][1][0],
        beziers[0][0][1] - beziers[0][1][1]
      ]);
    }
    if (knotIdx >= n) {
      const lastSeg = beziers[n - 1];
      return StudioGeometry.normalize([
        lastSeg[3][0] - lastSeg[2][0],
        lastSeg[3][1] - lastSeg[2][1]
      ]);
    }
    const segBefore = beziers[knotIdx - 1];
    const segAfter = beziers[knotIdx];
    return StudioGeometry.normalize([
      segAfter[1][0] - segBefore[2][0],
      segAfter[1][1] - segBefore[2][1]
    ]);
  }

  static computeConcaveArrowPath(p0, exitTangent, strokeWidth = 3.2, zoomScale = 1.0) {
    const z = Math.max(0.1, zoomScale || 1.0);
    const ux = exitTangent[0];
    const uy = exitTangent[1];
    const nx = -uy;
    const ny = ux;

    const sw = Math.max(1.5, Math.min(12, strokeWidth || 3.2));
    const barbLen = Math.round((14 + sw * 1.25) / Math.sqrt(z));
    const barbSpread = Math.round((8 + sw * 0.95) / Math.sqrt(z));
    const waistBack = Math.round((6 + sw * 0.6) / Math.sqrt(z));
    const waistSpread = Math.max(2, (sw * 0.75) / Math.sqrt(z));

    const b1 = [p0[0] + ux * barbLen + nx * barbSpread, p0[1] + uy * barbLen + ny * barbSpread];
    const b2 = [p0[0] + ux * barbLen - nx * barbSpread, p0[1] + uy * barbLen - ny * barbSpread];
    const c1 = [p0[0] + ux * waistBack + nx * waistSpread, p0[1] + uy * waistBack + ny * waistSpread];
    const c2 = [p0[0] + ux * waistBack - nx * waistSpread, p0[1] + uy * waistBack - ny * waistSpread];

    const d = `M ${b1[0]} ${b1[1]} Q ${c1[0]} ${c1[1]} ${p0[0]} ${p0[1]} M ${p0[0]} ${p0[1]} Q ${c2[0]} ${c2[1]} ${b2[0]} ${b2[1]}`;

    return {
      d,
      effectiveWidth: sw / z,
      shadowWidth: (sw + 2.4) / z,
      glowWidth: (sw + 10) / z,
      coreWidth: 2.5 / z
    };
  }

  static evalCubicBezier(seg, t) {
    if (typeof CurveFitter !== 'undefined' && typeof CurveFitter.bezier_q === 'function') {
      return CurveFitter.bezier_q(seg, t);
    }
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return [
      mt2 * mt * seg[0][0] + 3 * mt2 * t * seg[1][0] + 3 * mt * t2 * seg[2][0] + t2 * t * seg[3][0],
      mt2 * mt * seg[0][1] + 3 * mt2 * t * seg[1][1] + 3 * mt * t2 * seg[2][1] + t2 * t * seg[3][1]
    ];
  }

  static findNearestCurveHit(annotations, mousePt, maxDist = 28) {
    let nearest = null;
    let minDist = maxDist;

    (annotations || []).forEach(ann => {
      if (ann.type === 'curve' && ann.beziers) {
        ann.beziers.forEach((seg, segIdx) => {
          for (let t = 0; t <= 1.0001; t += 0.05) {
            const q = StudioGeometry.evalCubicBezier(seg, Math.min(1, t));
            const d = Math.hypot(q[0] - mousePt[0], q[1] - mousePt[1]);
            if (d < minDist) {
              minDist = d;
              nearest = { ann, segIdx, t: Math.min(1, t), pt: q, dist: d };
            }
          }
        });
      }
    });
    return nearest;
  }

  static hitTestImagePlate(placedImages, pt) {
    if (!placedImages || placedImages.length === 0) return null;
    for (let i = placedImages.length - 1; i >= 0; i--) {
      const p = placedImages[i];
      if (pt[0] >= p.x && pt[0] <= p.x + p.width && pt[1] >= p.y && pt[1] <= p.y + p.height) {
        return p;
      }
    }
    return null;
  }

  static findNearestAnnotation(annotations, pt, maxDist = 20, measureBoundsFn = null) {
    if (!annotations || annotations.length === 0) return null;

    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (ann.type === 'text_badge') {
        const b = measureBoundsFn
          ? measureBoundsFn(ann.text || '', ann.fontSize || 20, ann.fontFamily)
          : { maxW: Math.max(80, (ann.text || '').length * 11), totalH: (ann.fontSize || 20) * 1.4 };
        if (pt[0] >= ann.x - 6 && pt[0] <= ann.x + b.maxW + 22 && pt[1] >= ann.y - 6 && pt[1] <= ann.y + b.totalH + 14) {
          return { item: ann, part: 'body' };
        }
      } else if (ann.type === 'circle_callout') {
        const rx = Math.max(1, ann.rx || 1);
        const ry = Math.max(1, ann.ry || 1);
        const normR = Math.hypot((pt[0] - ann.cx) / rx, (pt[1] - ann.cy) / ry);
        const edgeDist = Math.abs(normR - 1) * Math.min(rx, ry);
        if (edgeDist <= maxDist || normR <= 1.05) return { item: ann, part: 'body' };
      } else if (ann.type === 'box_callout') {
        if (pt[0] >= ann.x - maxDist && pt[0] <= ann.x + ann.w + maxDist &&
            pt[1] >= ann.y - maxDist && pt[1] <= ann.y + ann.h + maxDist) {
          return { item: ann, part: 'body' };
        }
      }
    }

    const curveHit = StudioGeometry.findNearestCurveHit(annotations, pt, maxDist);
    if (curveHit) return { item: curveHit.ann, part: 'curve', segIdx: curveHit.segIdx, t: curveHit.t };
    return null;
  }

  static wrapTextLines(text, maxCharsPerLine = 32) {
    if (!text) return [];
    const paragraphs = String(text).split('\n');
    const result = [];

    paragraphs.forEach(p => {
      if (!p.trim()) { result.push(''); return; }
      const words = p.split(/\s+/);
      let curLine = '';
      words.forEach(w => {
        if (!curLine) curLine = w;
        else if ((curLine.length + 1 + w.length) <= maxCharsPerLine) curLine += ' ' + w;
        else { result.push(curLine); curLine = w; }
      });
      if (curLine) result.push(curLine);
    });
    return result;
  }

  static computeTextBoxPlacement(anchorPt, exitVec, boxW, boxH, forcedEdge = null, axisThreshold = 15) {
    const ax = anchorPt[0];
    const ay = anchorPt[1];
    const [vx, vy] = StudioGeometry.normalize(exitVec || [1, 0]);
    const angleDeg = Math.atan2(vy, vx) * (180 / Math.PI);

    let showLeft = false, showRight = false, showTop = false, showBottom = false;
    let cx = 0, cy = 0;

    const cornerLow = axisThreshold;
    const cornerHigh = 90 - axisThreshold;

    if (forcedEdge && forcedEdge !== 'auto') {
      if (forcedEdge === 'left') { showLeft = true; cx = 0; cy = Math.round(boxH / 2); }
      else if (forcedEdge === 'right') { showRight = true; cx = boxW; cy = Math.round(boxH / 2); }
      else if (forcedEdge === 'top') { showTop = true; cx = Math.round(boxW / 2); cy = 0; }
      else if (forcedEdge === 'bottom') { showBottom = true; cx = Math.round(boxW / 2); cy = boxH; }
    } else {
      if (angleDeg >= 0 && angleDeg < 90) {
        if (angleDeg <= cornerLow) {
          showLeft = true; cx = 0; cy = Math.round((boxH / 2) * (1 - angleDeg / 45));
        } else if (angleDeg < cornerHigh) {
          showLeft = true; showTop = true;
          if (angleDeg <= 45) { cx = 0; cy = Math.round((boxH / 2) * (1 - angleDeg / 45)); }
          else { cx = Math.round(((angleDeg - 45) / 45) * (boxW / 2)); cy = 0; }
        } else {
          showTop = true; cx = Math.round(((angleDeg - 45) / 45) * (boxW / 2)); cy = 0;
        }
      } else if (angleDeg >= 90 && angleDeg <= 180) {
        const gamma = 180 - angleDeg;
        if (gamma <= cornerLow) {
          showRight = true; cx = boxW; cy = Math.round((boxH / 2) * (1 - gamma / 45));
        } else if (gamma < cornerHigh) {
          showRight = true; showTop = true;
          if (gamma <= 45) { cx = boxW; cy = Math.round((boxH / 2) * (1 - gamma / 45)); }
          else { cx = Math.round(boxW - ((gamma - 45) / 45) * (boxW / 2)); cy = 0; }
        } else {
          showTop = true; cx = Math.round(boxW - ((gamma - 45) / 45) * (boxW / 2)); cy = 0;
        }
      } else if (angleDeg < 0 && angleDeg >= -90) {
        const beta = -angleDeg;
        if (beta <= cornerLow) {
          showLeft = true; cx = 0; cy = Math.round((boxH / 2) * (1 + beta / 45));
        } else if (beta < cornerHigh) {
          showLeft = true; showBottom = true;
          if (beta <= 45) { cx = 0; cy = Math.round((boxH / 2) * (1 + beta / 45)); }
          else { cx = Math.round(((beta - 45) / 45) * (boxW / 2)); cy = boxH; }
        } else {
          showBottom = true; cx = Math.round(((beta - 45) / 45) * (boxW / 2)); cy = boxH;
        }
      } else {
        const delta = 180 + angleDeg;
        if (delta <= cornerLow) {
          showRight = true; cx = boxW; cy = Math.round((boxH / 2) * (1 + delta / 45));
        } else if (delta < cornerHigh) {
          showRight = true; showBottom = true;
          if (delta <= 45) { cx = boxW; cy = Math.round((boxH / 2) * (1 + delta / 45)); }
          else { cx = Math.round(boxW - ((delta - 45) / 45) * (boxW / 2)); cy = boxH; }
        } else {
          showBottom = true; cx = Math.round(boxW - ((delta - 45) / 45) * (boxW / 2)); cy = boxH;
        }
      }
    }

    const posX = Math.round(ax - cx);
    const posY = Math.round(ay - cy);

    let textAnchorType = 'start', textAlign = 'left';
    if (showRight && !showLeft) { textAnchorType = 'end'; textAlign = 'right'; }
    else if (!showLeft && !showRight) { textAnchorType = 'middle'; textAlign = 'center'; }

    let connectEdge = 'left';
    if (showLeft && showTop) connectEdge = 'left-top';
    else if (showLeft && showBottom) connectEdge = 'left-bottom';
    else if (showRight && showTop) connectEdge = 'right-top';
    else if (showRight && showBottom) connectEdge = 'right-bottom';
    else if (showLeft) connectEdge = 'left';
    else if (showRight) connectEdge = 'right';
    else if (showTop) connectEdge = 'top';
    else if (showBottom) connectEdge = 'bottom';

    let dBracket = '';
    if (showLeft && showTop) dBracket = `M ${posX} ${posY + boxH} L ${posX} ${posY} L ${posX + boxW} ${posY}`;
    else if (showLeft && showBottom) dBracket = `M ${posX} ${posY} L ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH}`;
    else if (showRight && showTop) dBracket = `M ${posX} ${posY} L ${posX + boxW} ${posY} L ${posX + boxW} ${posY + boxH}`;
    else if (showRight && showBottom) dBracket = `M ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH} L ${posX + boxW} ${posY}`;
    else if (showLeft) dBracket = `M ${posX} ${posY} L ${posX} ${posY + boxH}`;
    else if (showRight) dBracket = `M ${posX + boxW} ${posY} L ${posX + boxW} ${posY + boxH}`;
    else if (showTop) dBracket = `M ${posX} ${posY} L ${posX + boxW} ${posY}`;
    else if (showBottom) dBracket = `M ${posX} ${posY + boxH} L ${posX + boxW} ${posY + boxH}`;

    return {
      connectEdge, posX, posY, boxW, boxH, cx, cy,
      textAnchorType, textAlign, dBracket,
      showLeft, showRight, showTop, showBottom, angleDeg
    };
  }

  static getLuminousCoreColor(colorStr, saturation = 0.4) {
    if (!colorStr) return 'rgb(255, 255, 255)';
    let r = 255, g = 255, b = 255;
    const str = String(colorStr).trim();

    if (str.startsWith('#')) {
      let hex = str.slice(1);
      if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
      r = parseInt(hex.slice(0, 2), 16) || 255;
      g = parseInt(hex.slice(2, 4), 16) || 255;
      b = parseInt(hex.slice(4, 6), 16) || 255;
    } else if (str.startsWith('rgb')) {
      const match = str.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (match) {
        r = parseInt(match[1], 10);
        g = parseInt(match[2], 10);
        b = parseInt(match[3], 10);
      }
    }

    const whiteWeight = 1.0 - saturation;
    return `rgb(${Math.round(255 * whiteWeight + r * saturation)}, ${Math.round(255 * whiteWeight + g * saturation)}, ${Math.round(255 * whiteWeight + b * saturation)})`;
  }

  static computeStageBounds(stageState, minW = 1100, minH = 640) {
    const pad = stageState.padding || 45;
    let minX = 0, minY = 0, maxX = 720, maxY = 420;

    (stageState.placedImages || []).forEach(plate => {
      minX = Math.min(minX, plate.x);
      minY = Math.min(minY, plate.y);
      maxX = Math.max(maxX, plate.x + plate.width);
      maxY = Math.max(maxY, plate.y + plate.height);
    });

    (stageState.diffCallouts || []).forEach(diff => {
      const r = diff.radius || 16;
      minX = Math.min(minX, diff.cropX - r - 20);
      maxX = Math.max(maxX, diff.cropX + r + 20);
      minY = Math.min(minY, diff.cropY - r - 20);
      maxY = Math.max(maxY, diff.cropY + r + 20);
    });

    (stageState.annotations || []).forEach(ann => {
      if (ann.type === 'curve' && ann.vertices) {
        ann.vertices.forEach(v => {
          minX = Math.min(minX, v.point[0] - 20);
          maxX = Math.max(maxX, v.point[0] + 20);
          minY = Math.min(minY, v.point[1] - 20);
          maxY = Math.max(maxY, v.point[1] + 20);
        });
        if (ann.text && ann.beziers?.length > 0) {
          const isAtTail = (ann.textEnd !== 'tip');
          const termSeg = isAtTail ? ann.beziers[ann.beziers.length - 1] : ann.beziers[0];
          const anchor = isAtTail ? termSeg[3] : termSeg[0];
          minX = Math.min(minX, anchor[0] - (ann.boxWidth || 280) - 30);
          maxX = Math.max(maxX, anchor[0] + (ann.boxWidth || 280) + 30);
          minY = Math.min(minY, anchor[1] - 110);
          maxY = Math.max(maxY, anchor[1] + 110);
        }
      } else if (ann.type === 'text_badge') {
        minX = Math.min(minX, ann.x - 20);
        maxX = Math.max(maxX, ann.x + (ann.boxWidth || 260) + 20);
        minY = Math.min(minY, ann.y - 20);
        maxY = Math.max(maxY, ann.y + 80);
      } else if (ann.type === 'circle_callout') {
        minX = Math.min(minX, ann.cx - ann.rx - 20);
        maxX = Math.max(maxX, ann.cx + ann.rx + 20);
        minY = Math.min(minY, ann.cy - ann.ry - 20);
        maxY = Math.max(maxY, ann.cy + ann.ry + 20);
      } else if (ann.type === 'box_callout') {
        minX = Math.min(minX, ann.x - 20);
        maxX = Math.max(maxX, ann.x + ann.w + 20);
        minY = Math.min(minY, ann.y - 20);
        maxY = Math.max(maxY, ann.y + ann.h + 20);
      }
    });

    const totalW = Math.max(minW, Math.round((maxX - minX) + pad * 2));
    const totalH = Math.max(minH, Math.round((maxY - minY) + pad * 2));
    return {
      totalW,
      totalH,
      offsetX: Math.round(-minX + pad),
      offsetY: Math.round(-minY + pad)
    };
  }

  static computeExportBounds(stageState, measureTextFn = null) {
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
          for (let t = 0; t <= 1.0001; t += 0.1) {
            const pt = StudioGeometry.evalCubicBezier(seg, Math.min(1, t));
            expand(pt[0] - pad, pt[1] - pad, pt[0] + pad, pt[1] + pad);
          }
        });
        if (ann.text && ann.text.trim() && ann.beziers.length > 0) {
          const isAtTail = (ann.textEnd !== 'tip');
          const termSeg = isAtTail ? ann.beziers[ann.beziers.length - 1] : ann.beziers[0];
          const anchor = isAtTail ? termSeg[3] : termSeg[0];
          const exitVec = isAtTail
            ? [termSeg[3][0] - termSeg[2][0], termSeg[3][1] - termSeg[2][1]]
            : [termSeg[0][0] - termSeg[1][0], termSeg[0][1] - termSeg[1][1]];
          const fontS = ann.fontSize || stageState.fontSize || 20;
          const fontF = ann.fontFamily || stageState.fontFamily;
          const bounds = measureTextFn ? measureTextFn(ann.text, fontS, fontF) : { maxW: 160, totalH: 36 };
          const placement = StudioGeometry.computeTextBoxPlacement(
            anchor, exitVec, bounds.maxW + 16, bounds.totalH + 8,
            ann.manualEdge ? ann.connectEdge : null
          );
          expand(placement.posX - 12, placement.posY - 12, placement.posX + bounds.maxW + 28, placement.posY + bounds.totalH + 20);
        }
      } else if (ann.type === 'text_badge') {
        const fontS = ann.fontSize || stageState.fontSize || 20;
        const fontF = ann.fontFamily || stageState.fontFamily;
        const bounds = measureTextFn ? measureTextFn(ann.text || '', fontS, fontF) : { maxW: 140, totalH: 32 };
        expand(ann.x - 10, ann.y - 10, ann.x + bounds.maxW + 26, ann.y + bounds.totalH + 18);
      } else if (ann.type === 'circle_callout') {
        expand(ann.cx - ann.rx - 14, ann.cy - ann.ry - 14, ann.cx + ann.rx + 14, ann.cy + ann.ry + 14);
      } else if (ann.type === 'box_callout') {
        expand(ann.x - 14, ann.y - 14, ann.x + ann.w + 14, ann.y + ann.h + 14);
      } else if (ann.type === 'paint') {
        if (ann.points) {
          const r = (ann.width || 32) / 2 + 6;
          ann.points.forEach(p => expand(p[0] - r, p[1] - r, p[0] + r, p[1] + r));
        } else if (ann.bounds) {
          const b = ann.bounds;
          if (b.w !== undefined) expand(b.x, b.y, b.x + b.w, b.y + b.h);
          else if (b.rx !== undefined) expand(b.cx - b.rx, b.cy - b.ry, b.cx + b.rx, b.cy + b.ry);
        }
      }
    });

    if (!hasContent) return { x: 0, y: 0, width: 800, height: 500, isCustom: false };

    const margin = 16;
    const x = Math.max(0, Math.floor(minX - margin));
    const y = Math.max(0, Math.floor(minY - margin));
    const width = Math.max(120, Math.ceil(maxX + margin) - x);
    const height = Math.max(80, Math.ceil(maxY + margin) - y);
    return { x, y, width, height, isCustom: false };
  }

  static computeIncomingDir(points, tipIdx, lookbackPx = 18) {
      if (!points || tipIdx <= 0) return null;
      const tip = points[tipIdx];
      let j = tipIdx - 1;
      while (j > 0 && Math.hypot(tip[0] - points[j][0], tip[1] - points[j][1]) < lookbackPx) {
        j--;
      }
      const dx = tip[0] - points[j][0];
      const dy = tip[1] - points[j][1];
      if (Math.hypot(dx, dy) < 1e-4) return null;
      return StudioGeometry.normalize([dx, dy]);
    }

  static fitPolylineWithCusps(points, cuspIndices = []) {
      if (!points || points.length < 2) return { beziers: [], vertexCuspIndices: [] };

      const cleanCusps = Array.from(new Set(
        (cuspIndices || []).filter(idx => Number.isInteger(idx) && idx > 0 && idx < points.length - 1)
      )).sort((a, b) => a - b);

      const splitPoints = [0, ...cleanCusps, points.length - 1];
      const allBeziers = [];
      const vertexCuspIndices = [];
      let prevHadBeziers = false;

      for (let s = 0; s < splitPoints.length - 1; s++) {
        const subChain = points.slice(splitPoints[s], splitPoints[s + 1] + 1);
        if (subChain.length < 2) continue;

        let subLen = 0;
        for (let i = 1; i < subChain.length; i++) {
          subLen += Math.hypot(subChain[i][0] - subChain[i - 1][0], subChain[i][1] - subChain[i - 1][1]);
        }
        const segErr = Math.max(3.5, Math.min(8.0, subLen * 0.025));
        const fitted = typeof CurveFitter !== 'undefined' ? CurveFitter.fit(subChain, segErr) : [];
        if (fitted && fitted.length > 0) {
          if (s > 0 && prevHadBeziers) {
            vertexCuspIndices.push(allBeziers.length);
          }
          allBeziers.push(...fitted);
          prevHadBeziers = true;
        }
      }

      return { beziers: allBeziers, vertexCuspIndices };
    }

  static signedAngle(a, b) {
      const cross = a[0] * b[1] - a[1] * b[0];
      const dot = a[0] * b[0] + a[1] * b[1];
      return Math.atan2(cross, dot);
    }

  static normalizeAngle(rad) {
      let a = rad;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    }

  static setVertexCuspState(vertices, knotIdx, makeCusp, smoothOutDir = null) {
      if (!vertices || knotIdx <= 0 || knotIdx >= vertices.length - 1) return false;
      const v = vertices[knotIdx];
      if (!v) return false;

      const pt = v.point;
      const prevDir = v.controlPoints?.[0] ? StudioGeometry.normalize([v.controlPoints[0][0] - pt[0], v.controlPoints[0][1] - pt[1]]) : [-1, 0];
      const nextDir = v.controlPoints?.[1] ? StudioGeometry.normalize([v.controlPoints[1][0] - pt[0], v.controlPoints[1][1] - pt[1]]) : [1, 0];

      if (makeCusp) {
        v.isCusp = true;
        v.tangentAngleOffset = 0;
        v.isExplicitTangent = false;
        if (typeof UpdateControlPoints !== 'undefined' && typeof UpdateControlPoints.computeNaturalBaselines === 'function') {
          UpdateControlPoints.computeNaturalBaselines(vertices, 8);
        }
        v.cuspInAngleOffset = StudioGeometry.signedAngle(v._naturalInTangent || [-1, 0], prevDir);
        v.cuspOutAngleOffset = StudioGeometry.signedAngle(v._naturalOutTangent || [1, 0], nextDir);
        return true;
      }

      v.isCusp = false;
      v.cuspInAngleOffset = 0;
      v.cuspOutAngleOffset = 0;
      if (typeof UpdateControlPoints !== 'undefined' && typeof UpdateControlPoints.computeNaturalBaselines === 'function') {
        UpdateControlPoints.computeNaturalBaselines(vertices, 8);
      }

      if (smoothOutDir) {
        const offset = StudioGeometry.signedAngle(v._naturalTangent || [1, 0], smoothOutDir);
        if (Math.abs(offset) < 0.087) {
          v.tangentAngleOffset = 0;
          v.isExplicitTangent = false;
        } else {
          v.tangentAngleOffset = offset;
          v.isExplicitTangent = true;
        }
      } else {
        v.tangentAngleOffset = 0;
        v.isExplicitTangent = false;
      }
      return true;
    }
}

globalThis.StudioGeometry = StudioGeometry;
if (typeof module !== 'undefined' && module.exports) module.exports = StudioGeometry;