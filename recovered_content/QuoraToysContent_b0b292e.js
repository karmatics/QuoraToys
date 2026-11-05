// ============================================================================
// Chapter 6: Architecture Audit, Mathematical Formulations & Refactor Blueprint
// ============================================================================

class QuoraArchitectureContent {
  static getMeta() {
    return {
      kicker: 'Engineering Dossier & Technical Audit',
      title: '6. Architecture Audit, Math Specifications & Refactor Blueprint',
      subtitle: 'Complete forensic assessment of technical debt, mathematical algorithms, layer hierarchy, and the future development roadmap.'
    };
  }

  static manifest() {
    return [
      {
        section: 'arch_forensic_audit',
        partLabel: 'Chapter 6 • Section A',
        title: 'Forensic Self-Assessment & Defect Resolution',
        blocks: [
          { id: 'p_audit_intro', type: 'p' },
          { id: 'sidebar_audit_items', type: 'sidebar', kicker: 'Technical Debt', title: 'Defects Addressed' },
          { id: 'p_audit_resolutions', type: 'p' }
        ]
      },
      {
        section: 'arch_math_engine',
        partLabel: 'Chapter 6 • Section B',
        title: 'Mathematical Formulations & Algorithmic Foundations',
        blocks: [
          { id: 'p_math_tether_and_knots', type: 'p' },
          { id: 'sidebar_math_formulas', type: 'sidebar', kicker: 'Formulation Matrix', title: 'Core Vector Equations' }
        ]
      },
      {
        section: 'arch_roadmap',
        partLabel: 'Chapter 6 • Section C',
        title: 'The Implementation Roadmap',
        blocks: [
          { id: 'p_roadmap_overview', type: 'p' },
          { id: 'sidebar_roadmap_steps', type: 'sidebar', kicker: 'Action Plan', title: 'Prioritized Implementation Checklist' }
        ]
      }
    ];
  }

  static p_audit_intro() {
    return [
      "Building high-performance creative software requires transparency regarding where shortcuts were taken and how technical debt is systematically retired.",
      "During early development iterations, several components were implemented as rough prototypes: rotation calculations mixed degrees with radians, tool palettes were trapped within container viewports, and generic color picker routines were substituted for the original code. This document records the resolution of those issues and establishes the long-term engineering plan."
    ];
  }

  static sidebar_audit_items() {
    return [
      "Key Audit Findings:\n" +
      "• Radian vs Degree Bug: GeometryUtils.rotateVector expects radians. Passing degrees spun tangents by 7+ full revolutions ($2578^\circ$).\n" +
      "• Viewport Clipping: Floating HUD palettes were children of an overflow:hidden container. Now fixed with global body positioning.\n" +
      "• ColorPicker Alignment: Canonical DrawingApp implementations (HueRingCP, TriangleCP, AppColorUtils) have been restored.\n" +
      "• Clean Concave Arrowheads: Looping quadratic curves replaced by dual concave Bézier wings meeting at target tip P_0.\n" +
      "• Tight Glyph Metrics: Character widths measured accurately with 2-sided architectural bracket framing."
    ];
  }

  static p_audit_resolutions() {
    return [
      "With these issues resolved, the annotation pipeline functions as a unified system: drawing gestures convert into responsive on-curve knots, drop shadows remain strictly below foreground strokes, and floating palettes move across the entire screen without boundary clipping."
    ];
  }

  static p_math_tether_and_knots() {
    return [
      "The drawing experience is governed by two complementary mathematical systems:",
      "1. **The Kinetic String-Tether:** An analog low-pass filter simulation. The pen tip trails the cursor by an elastic lead radius ($R = 32\\text{px}$), filtering physiological micro-tremors before points reach the curve fitter.",
      "2. **Reverse Bézier Extraction:** Schneider's least-squares algorithm fits cubic segments to the gesture. Segment endpoints become on-curve Knots. Baseline tangents are calculated from neighbor vectors, and angular deviations are preserved as signed radian offsets."
    ];
  }

  static sidebar_math_formulas() {
    return [
      "Core Mathematical Relationships:\n" +
      "• Kinetic Pull: P_pen = Cursor - normalize(Cursor - P_last) * R\n" +
      "• Angular Deviation: theta = atan2(T_base x T_actual, T_base . T_actual)\n" +
      "• Scale Factor: S_out = 3 * ||P_1 - V_i|| / D_next\n" +
      "• Curvature: C = (S_out + S_in) / 2\n" +
      "• Balance: B = (2 * S_in) / (S_out + S_in)\n" +
      "• Arrowhead Barbs: P_barb = P_0 + U * 18 +/- N * 11, with concave control points pulled inward toward stem U."
    ];
  }

  static p_roadmap_overview() {
    return [
      "The engineering plan focuses on expanding geometric primitives while factoring large methods into modular, testable units."
    ];
  }

  static sidebar_roadmap_steps() {
    return [
      "Implementation Roadmap:\n" +
      "• Step 1: Circular and elliptical arc drafting primitives.\n" +
      "• Step 2: Straight line segments with fillet rounded corners.\n" +
      "• Step 3: Closed curve loop support with continuous C^1 tangency closure.\n" +
      "• Step 4: Refactor QuoraAnnotationComponent.js into modular delegates (< 200 lines each): QuoraKnotManager, QuoraStageRenderer, QuoraDevDeck, QuoraLabelManager.\n" +
      "• Step 5: Deprecate legacy fdr- prefixes in stylesheets in favor of qt- and qa- conventions."
    ];
  }
}

globalThis.QuoraArchitectureContent = QuoraArchitectureContent;