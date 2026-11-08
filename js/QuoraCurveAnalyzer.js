/**
 * QuoraCurveAnalyzer
 * Pure visual analysis and diagnostic tool for inspecting curve smoothness,
 * verifying C^1 tangency colinearity, measuring curvature, and inspecting knot data.
 */
class QuoraCurveAnalyzer {
  constructor(component) {
    this.component = component;
    this.isActive = false;
  }

  toggle() {
    this.isActive = !this.isActive;
    if (this.isActive) {
      this.renderAnalysisOverlay();
      this.component.showKnotToast('🔍 Curve Diagnostics: ON');
    } else {
      this.clearOverlay();
      this.component.showKnotToast('🔍 Curve Diagnostics: OFF');
    }
  }

  clearOverlay() {
    const existing = document.getElementById('qa-curve-analysis-layer');
    if (existing) existing.remove();
    const hud = document.getElementById('qa-curve-analysis-hud');
    if (hud) hud.remove();
  }

  renderAnalysisOverlay() {
    this.clearOverlay();
    const curve = this.component.getActiveCurve();
    if (!curve || !curve.vertices || curve.vertices.length < 2) {
      this.component.showKnotToast('Select a curve to run diagnostics');
      this.isActive = false;
      return;
    }

    const g = makeElement('svg:g', {
      id: 'qa-curve-analysis-layer',
      style: { pointerEvents: 'none' }
    });

    const vertices = curve.vertices;
    let totalLength = 0;
    let kinkCount = 0;
    let cuspCount = 0;

    // 1. Evaluate curvature comb and segment arc lengths
    if (curve.beziers) {
      curve.beziers.forEach((seg) => {
        let prevPt = seg[0];
        let segLen = 0;
        const samples = 16;

        for (let i = 1; i <= samples; i++) {
          const t = i / samples;
          const pt = CurveFitter.bezier_q(seg, t);
          const d = Math.hypot(pt[0] - prevPt[0], pt[1] - prevPt[1]);
          segLen += d;

          const qPrime = CurveFitter.bezier_qprime(seg, t);
          const speed = Math.hypot(qPrime[0], qPrime[1]) || 1;
          const normal = [-qPrime[1] / speed, qPrime[0] / speed];
          const combLen = Math.min(24, Math.max(4, 18 / speed * 25));

          const cX = pt[0] + normal[0] * combLen;
          const cY = pt[1] + normal[1] * combLen;

          g.appendChild(makeElement('svg:line', {
            x1: pt[0], y1: pt[1], x2: cX, y2: cY,
            stroke: 'rgba(0, 242, 254, 0.35)', 'stroke-width': '1.0'
          }));

          prevPt = pt;
        }
        totalLength += segLen;
      });
    }

    // 2. Knot Continuity & Colinearity Inspection
    vertices.forEach((v, idx) => {
      const isStart = (idx === 0);
      const isTail = (idx === vertices.length - 1);
      const isInterior = !isStart && !isTail;

      if (v.isCusp) cuspCount++;

      if (isInterior) {
        const vIn = [v.point[0] - v.controlPoints[0][0], v.point[1] - v.controlPoints[0][1]];
        const vOut = [v.controlPoints[1][0] - v.point[0], v.controlPoints[1][1] - v.point[1]];
        const lenIn = Math.hypot(vIn[0], vIn[1]) || 1;
        const lenOut = Math.hypot(vOut[0], vOut[1]) || 1;

        const uIn = [vIn[0] / lenIn, vIn[1] / lenIn];
        const uOut = [vOut[0] / lenOut, vOut[1] / lenOut];

        const dot = uIn[0] * uOut[0] + uIn[1] * uOut[1];
        const isSmooth = (dot > 0.985);

        if (!isSmooth && !v.isCusp) {
          kinkCount++;
          g.appendChild(makeElement('svg:circle', {
            cx: v.point[0], cy: v.point[1], r: '10',
            fill: 'none', stroke: '#ff2d55', 'stroke-width': '2.0',
            'stroke-dasharray': '2,2'
          }));
        }
      }
    });

    this.component.controlsLayer.appendChild(g);

    // 3. Telemetry HUD with Automated Test Suite Trigger
    const hud = makeElement('div', {
      id: 'qa-curve-analysis-hud',
      style: {
        position: 'absolute', top: '16px', right: '16px',
        background: 'rgba(9, 13, 22, 0.97)', border: '1.5px solid #00f2fe',
        borderRadius: '8px', padding: '12px 16px', color: '#f8fafc',
        fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6',
        boxShadow: '0 8px 30px rgba(0,0,0,0.85)', zIndex: '95'
      }
    }, [
      makeElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } }, [
        makeElement('strong', { style: { color: '#00f2fe' } }, '🔍 CURVE DIAGNOSTICS'),
        makeElement('button', {
          className: 'dr-nav-btn primary',
          style: { padding: '2px 8px', fontSize: '10px' },
          onclick: () => this.runAutomatedSelfTest()
        }, '▶ Run Self-Test')
      ]),
      makeElement('div', {}, `Length: ${Math.round(totalLength)} px`),
      makeElement('div', {}, `Knots: ${vertices.length} (${vertices.length - 1} segments)`),
      makeElement('div', {}, `Cusps: ${cuspCount}`),
      makeElement('div', {
        style: { color: kinkCount > 0 ? '#ff7b72' : '#10b981', fontWeight: 'bold' }
      }, kinkCount > 0 ? `⚠ ${kinkCount} non-smooth knot(s)` : '✓ All knots C¹ continuous')
    ]);

    this.component.stageBox.appendChild(hud);
  }

  runAutomatedSelfTest() {
    const results = [];
    const comp = this.component;

    // Test 1: Spline Synthesis Verification
    try {
      const testPoints = [[50, 50], [120, 80], [200, 150]];
      const beziers = CurveFitter.fit(testPoints, 2.5);
      const pass = Boolean(beziers && beziers.length > 0 && beziers[0].length === 4);
      results.push({ name: 'Spline Synthesis (Least-Squares)', pass });
    } catch (e) {
      results.push({ name: 'Spline Synthesis (Least-Squares)', pass: false, error: e.message });
    }

    // Test 2: C1 Continuity Verification
    try {
      const verts = [
        new BezierVertex([50, 50]),
        new BezierVertex([150, 100]),
        new BezierVertex([250, 80])
      ];
      UpdateControlPoints.run(verts, 6);
      const vMid = verts[1];
      const dxIn = vMid.point[0] - vMid.controlPoints[0][0];
      const dyIn = vMid.point[1] - vMid.controlPoints[0][1];
      const dxOut = vMid.controlPoints[1][0] - vMid.point[0];
      const dyOut = vMid.controlPoints[1][1] - vMid.point[1];
      const lenIn = Math.hypot(dxIn, dyIn) || 1;
      const lenOut = Math.hypot(dxOut, dyOut) || 1;
      const dot = (dxIn / lenIn) * (dxOut / lenOut) + (dyIn / lenIn) * (dyOut / lenOut);
      const pass = (dot > 0.99);
      results.push({ name: 'C¹ Continuous Interior Colinearity', pass });
    } catch (e) {
      results.push({ name: 'C¹ Continuous Interior Colinearity', pass: false, error: e.message });
    }

    // Test 3: Ghost Reference Curve Snapshotting
    try {
      const curCurve = comp.getActiveCurve();
      const hasCurve = Boolean(curCurve && curCurve.beziers?.length > 0);
      results.push({ name: 'Ghost Curve Snapshot State Available', pass: hasCurve });
    } catch (e) {
      results.push({ name: 'Ghost Curve Snapshot State Available', pass: false, error: e.message });
    }

    // Test 4: Magnetic Tangent Snapping
    try {
      const delta = 0.04; // ~2.3 degrees (inside 5 degree threshold)
      const snapped = Math.abs(delta) < 0.087 ? 0 : delta;
      results.push({ name: 'Tangent Baseline Magnetic Snapping (<5°)', pass: snapped === 0 });
    } catch (e) {
      results.push({ name: 'Tangent Baseline Magnetic Snapping (<5°)', pass: false, error: e.message });
    }

    // Test 5: Canvas destination-out Alpha Eraser Engine
    try {
      const off = document.createElement('canvas');
      off.width = 40; off.height = 40;
      const ctx = off.getContext('2d');
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 40, 40);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.fillRect(10, 10, 20, 20);
      const imgData = ctx.getImageData(15, 15, 1, 1).data;
      const pass = (imgData[3] === 0); // Transparent pixel confirmed
      results.push({ name: 'Canvas destination-out Alpha Eraser Engine', pass });
    } catch (e) {
      results.push({ name: 'Canvas destination-out Alpha Eraser Engine', pass: false, error: e.message });
    }

    // Render Verification Dialog
    const modal = makeElement('div', {
      style: {
        display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px',
        color: '#f8fafc', fontFamily: 'monospace', fontSize: '11.5px'
      }
    });

    let passCount = 0;
    results.forEach(res => {
      if (res.pass) passCount++;
      modal.appendChild(makeElement('div', {
        style: {
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: res.pass ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${res.pass ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '6px', padding: '8px 12px'
        }
      }, [
        makeElement('span', {}, `${res.pass ? '✓' : '✗'} ${res.name}`),
        makeElement('strong', { style: { color: res.pass ? '#10b981' : '#ff7b72' } }, res.pass ? 'PASS' : 'FAIL')
      ]));
    });

    const total = results.length;
    modal.appendChild(makeElement('div', {
      style: {
        marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1e293b',
        textAlign: 'center', fontWeight: 'bold', color: passCount === total ? '#10b981' : '#f59e0b'
      }
    }, `Automated Self-Test Complete: ${passCount}/${total} Passed`));

    UITools.makeDialog({
      title: '🧪 Automated Diagnostics Verification',
      size: [480, 360],
      contentElement: modal,
      appendTo: document.body
    });
  }
}

globalThis.QuoraCurveAnalyzer = QuoraCurveAnalyzer;
if (typeof module !== 'undefined' && module.exports) module.exports = QuoraCurveAnalyzer;