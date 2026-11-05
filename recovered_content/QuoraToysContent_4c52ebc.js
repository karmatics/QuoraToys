// ============================================================================
// QuoraToys: Living Content Manifest & Chapter Modules
// ============================================================================

class QuoraStudioContent {
  static getMeta() {
    return {
      kicker: 'Interactive Optical Comparator',
      title: '0. Spot-The-Difference Studio',
      subtitle: 'Superimpose puzzle halves with sub-pixel alignment using 50% Alpha, Optical Flashing, or Scrolling Zebra Stripes.'
    };
  }

  static manifest() {
    return [
      {
        section: 'studio_main',
        partLabel: 'Optical Comparator',
        title: 'Spot-The-Difference Workspace',
        blocks: [
          { id: 'studio_comp', type: 'component', component: 'QuoraStudioComponent' },
          { id: 'studio_desc', type: 'p' }
        ]
      }
    ];
  }

  static studio_desc() {
    return [
      "Load puzzle images from Quora or your local files. Crop either half of the puzzle to create a floating overlay with sub-pixel nudge controls.",
      "Toggle between 50% Alpha Opacity, Optical Flashing (600ms cycles that stimulate the human visual motion reflex), or Scrolling Zebra Stripes to make hidden modifications flutter. Once spotted, click **Studio** to send all callout pairs into the Unified Annotation Studio."
    ];
  }
}

class QuoraAnnotationContent {
  static getMeta() {
    return {
      kicker: 'Universal Graphic Studio',
      title: '1. Pro Annotation & Kinetic Splines',
      subtitle: 'Draw smooth cubic Bézier splines, target-first directional arrowheads, text callout brackets, and difference magnification lenses.'
    };
  }

  static manifest() {
    return [
      {
        section: 'annotation_main',
        partLabel: 'Unified Studio',
        title: 'Universal Graphic & Annotation Studio',
        blocks: [
          { id: 'annotation_comp', type: 'component', component: 'QuoraAnnotationComponent' },
          { id: 'annotation_desc', type: 'p' }
        ]
      }
    ];
  }

  static annotation_desc() {
    return [
      "Draw natural curves with the Kinetic String-Tether to eliminate hand tremors. Reverse parameter derivation fits smooth cubic Bézier segments with adjustable curvature, balance, and tangency.",
      "Differences spotted in the comparator are rendered directly onto this canvas with dual-magnifier callout lenses and connecting leader lines. You can edit both the curve knots and the difference lenses together in real time."
    ];
  }
}

class QuoraBookmarkletContent {
  static getMeta() {
    return {
      kicker: 'Browser Extension Alternative',
      title: '2. In-Situ Bookmarklet Hub',
      subtitle: 'One-click draggable bookmarklets for launching QuoraToys directly over any active Quora page.'
    };
  }

  static manifest() {
    return [
      {
        section: 'bookmarklet_main',
        partLabel: 'Drag Target Generator',
        title: 'Bookmarklet Installation & Testing',
        blocks: [
          { id: 'bookmarklet_comp', type: 'component', component: 'QuoraBookmarkletComponent' },
          { id: 'bookmarklet_desc', type: 'p' }
        ]
      }
    ];
  }

  static bookmarklet_desc() {
    return [
      "Drag the button above directly into your browser's Bookmarks bar. Whenever you are browsing Quora and encounter a Spot-the-Difference puzzle, click the bookmarklet.",
      "It will activate an in-situ hover HUD, allowing you to click any puzzle image on Quora to instantly superimpose, flash, or annotate it."
    ];
  }
}

class QuoraExtensionContent {
  static getMeta() {
    return {
      kicker: 'Chrome Web Extension',
      title: '3. Chrome Extension & Ambient Tools',
      subtitle: 'Load the dedicated QuoraToys & Power Tools manifest into Chrome, Brave, or Edge.'
    };
  }

  static manifest() {
    return [
      {
        section: 'extension_main',
        partLabel: 'Unpacked Extension',
        title: 'Extension Installation & Tool Matrix',
        blocks: [
          { id: 'extension_comp', type: 'component', component: 'QuoraExtensionComponent' },
          { id: 'extension_desc', type: 'p' }
        ]
      }
    ];
  }

  static extension_desc() {
    return [
      "The dedicated extension includes the Spot-The-Difference comparator, the Aardvark DOM inspector, screen curve drawing, and voice dictation.",
      "Enable Developer Mode in chrome://extensions and click Load Unpacked to install."
    ];
  }
}

class QuoraArchiverContent {
  static getMeta() {
    return {
      kicker: 'Content Curation',
      title: '4. Quora Answer Archiver & Scraper',
      subtitle: 'Extract viral Quora posts into clean, portable HTML cards with verified view metrics.'
    };
  }

  static manifest() {
    return [
      {
        section: 'archiver_main',
        partLabel: 'Forensic Formatter',
        title: 'Clean Card Extractor',
        blocks: [
          { id: 'archiver_comp', type: 'component', component: 'QuoraArchiverComponent' },
          { id: 'archiver_desc', type: 'p' }
        ]
      }
    ];
  }

  static archiver_desc() {
    return [
      "Archive high-signal Quora answers without surrounding ads, tracking scripts, or platform clutter. Generates standalone responsive cards suitable for embedding in living documentation dossiers."
    ];
  }
}

class QuoraVisionContent {
  static getMeta() {
    return {
      kicker: 'Strategic Manifesto',
      title: '5. The Sovereign Feed: Anti-Slop & Community Leverage',
      subtitle: 'Countering automated generative slop on Quora with human insight, verifiable diagrams, and interactive tools.'
    };
  }

  static manifest() {
    return [
      {
        section: 'vision_main',
        partLabel: 'Platform Dynamics',
        title: 'High-Signal Publishing & Visual Evidence',
        blocks: [
          { id: 'p_vision_intro', type: 'p' },
          { id: 'sidebar_vision_pillars', type: 'sidebar', kicker: 'Core Principles', title: 'The Anti-Slop Defense' },
          { id: 'p_vision_conclusion', type: 'p' }
        ]
      }
    ];
  }

  static p_vision_intro() {
    return [
      "Social platforms are currently flooded by automated LLM content farms producing shallow, unverified text answers to capture ad revenue.",
      "The antidote to generative text spam is high-density visual proof: mathematical diagrams, sub-pixel image comparisons, and verifiable software demonstrations that cannot be hallucinated."
    ];
  }

  static sidebar_vision_pillars() {
    return [
      "The Three Pillars of High-Signal Publishing:\n" +
      "• 1. Verifiable Visual Evidence: Annotated diagrams and sub-pixel alignment defeat generic prose.\n" +
      "• 2. Authoritative First-Person Insight: Direct testimony from inventors and builders.\n" +
      "• 3. Interactive Companions: Providing tools readers can use directly in their browser."
    ];
  }

  static p_vision_conclusion() {
    return [
      "QuoraToys demonstrates that browser tools can operate directly inside social platforms, enabling creators to produce informative, verified responses in seconds."
    ];
  }
}

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

globalThis.QuoraStudioContent = QuoraStudioContent;
globalThis.QuoraAnnotationContent = QuoraAnnotationContent;
globalThis.QuoraBookmarkletContent = QuoraBookmarkletContent;
globalThis.QuoraExtensionContent = QuoraExtensionContent;
globalThis.QuoraArchiverContent = QuoraArchiverContent;
globalThis.QuoraVisionContent = QuoraVisionContent;
globalThis.QuoraArchitectureContent = QuoraArchitectureContent;