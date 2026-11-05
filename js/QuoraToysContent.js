// ============================================================================
// QuoraToys: Master Living Architecture & Specification
// ============================================================================

// --- Chapter 0: Spot-The-Difference Studio ---
class QuoraStudioContent {
  static getMeta() {
    return {
      kicker: 'Visual Difference Solvers',
      title: '0. Spot-The-Difference Optical Studio',
      subtitle: 'Superimpose puzzle halves with sub-pixel alignment using 50% Alpha Opacity, Optical Flashing, or Scrolling Zebra Stripes.'
    };
  }

  static manifest() {
    return [
      {
        section: 'studio_interactive',
        partLabel: 'Chapter 0 • Interactive Tool',
        title: 'Spot-The-Difference Comparator',
        blocks: [
          { id: 'comp_studio', type: 'component', component: 'QuoraStudioComponent' }
        ]
      },
      {
        section: 'studio_overview',
        partLabel: 'Chapter 0 • Optical Methodology',
        title: 'Sub-Pixel Superimposition & Visual Motion Reflex',
        blocks: [
          { id: 'p_studio_intro_1', type: 'p' },
          { id: 'p_studio_intro_2', type: 'p' },
          { id: 'sidebar_comparator_features', type: 'sidebar', kicker: 'Optical Modes', title: 'Three Modes of Optical Comparison' }
        ]
      }
    ];
  }

  static p_studio_intro_1() {
    return [
      "Spot-the-difference puzzles on social platforms like Quora are notoriously tricky for the human eye when scanned side-by-side. The human brain normalizes small variances across saccades, making subtle alterations invisible.",
      "By cropping one half of the puzzle and superimposing it directly on top of the other, pixel alignment transforms an exhausting search into an instantaneous optical recognition task."
    ];
  }

  static p_studio_intro_2() {
    return [
      "QuoraToys provides three distinct optical comparison techniques to reveal hidden differences:",
      "1. **50% Alpha Blend:** Overlays both halves with transparency. Identical regions align smoothly; mismatched regions appear doubled or ghosted.",
      "2. **Optical Flashing (600ms):** Toggles the overlay on and off rapidly. Because human vision is hyper-sensitive to motion, mismatched pixels appear to flicker or dance, immediately drawing your gaze.",
      "3. **Scrolling Zebra Stripes:** Sweeps a moving horizontal or vertical grid across the image. Differences flutter as the stripe boundaries pass over them."
    ];
  }

  static sidebar_comparator_features() {
    return [
      "Optical Comparator Superpowers:\n" +
      "• Sub-Pixel Nudge: Fine-tune overlay alignment using Arrow keys (or Shift + Arrow for 10px jumps).\n" +
      "• Circle Diff Mode: Click and drag to circle any spotted difference; both images are saved into the difference stack.\n" +
      "• Direct Export to Studio: Tap '🎨 Studio' to transfer the cropped comparison and all marked differences into the Universal Graphic Studio."
    ];
  }
}

// --- Chapter 1: Pro Annotation & Kinetic Splines ---
class QuoraAnnotationContent {
  static getMeta() {
    return {
      kicker: 'Universal Graphic Studio',
      title: '1. Pro Annotation, Kinetic Splines & Blockout Paint',
      subtitle: 'Draw smooth cubic Bézier splines with kinetic string-tether, directional concave arrowheads, text balloons, and AI blockout masking.'
    };
  }

  static manifest() {
    return [
      {
        section: 'annotation_studio',
        partLabel: 'Chapter 1 • Live Studio',
        title: 'Interactive Annotation & Vector Canvas',
        blocks: [
          { id: 'comp_annotation', type: 'component', component: 'QuoraAnnotationComponent' }
        ]
      },
      {
        section: 'annotation_techniques',
        partLabel: 'Chapter 1 • Mathematical Engine',
        title: 'Kinetic Drag-Lead & On-Curve Knot Relaxation',
        blocks: [
          { id: 'p_annot_intro_1', type: 'p' },
          { id: 'sidebar_annot_features', type: 'sidebar', kicker: 'Ergonomics', title: 'Why Drawing in QuoraToys Feels Natural' }
        ]
      }
    ];
  }

  static p_annot_intro_1() {
    return [
      "Traditional digital annotation tools produce shaky, jagged lines that look crude and unprofessional. QuoraToys solves this by coupling two foundational algorithms:",
      "1. **The Kinetic String-Tether:** The pen point trails the mouse cursor at the end of an elastic 32px lead. High-frequency hand tremors are filtered out mechanically before strokes are recorded.",
      "2. **Schneider Curve Fitting & On-Curve Knot Relaxation:** Strokes are parsed into least-squares cubic Bézier segments. Knots sit directly on the curve path, with tangent angles and curvatures that can be adjusted interactively with the mouse wheel or key commands."
    ];
  }

  static sidebar_annot_features() {
    return [
      "Annotation Capabilities:\n" +
      "• Directional Concave Arrowheads: Arrows point where you first touch down and curve smoothly along the spline exit tangent.\n" +
      "• Attached Text Labels: Double-click any curve tail to add text in Architect's Daughter, with 4-side boxes or 2-side architectural brackets.\n" +
      "• Blockout Paint: Mask logos, names, or watermarks using solid or feathered paint before feeding images to AI models.\n" +
      "• Contiguous Erase: Hold Shift and drag back through your stroke to cleanly rewind vertices in real-time."
    ];
  }
}

// --- Chapter 2: In-Situ Bookmarklet Hub ---
class QuoraBookmarkletContent {
  static getMeta() {
    return {
      kicker: 'Browser Automation',
      title: '2. In-Situ Bookmarklet Hub',
      subtitle: 'Drag a zero-install bookmarklet to your browser bookmarks bar to launch QuoraToys directly inside any Quora page.'
    };
  }

  static manifest() {
    return [
      {
        section: 'bookmarklet_interactive',
        partLabel: 'Chapter 2 • Generator',
        title: 'Draggable In-Situ Bookmarklet',
        blocks: [
          { id: 'comp_bookmarklet', type: 'component', component: 'QuoraBookmarkletComponent' }
        ]
      }
    ];
  }
}

// --- Chapter 3: Chrome Extension & Ambient Tools ---
class QuoraExtensionContent {
  static getMeta() {
    return {
      kicker: 'Browser Extension',
      title: '3. Chrome Extension & Ambient Tools',
      subtitle: 'Load the unpacked extension to get context menu shortcuts for Spot-the-Difference, Aardvark DOM Inspection, Screen Drawing, and Voice Dictation.'
    };
  }

  static manifest() {
    return [
      {
        section: 'extension_setup',
        partLabel: 'Chapter 3 • Unpacked Extension',
        title: 'Extension Installation & Context Menus',
        blocks: [
          { id: 'comp_extension', type: 'component', component: 'QuoraExtensionComponent' }
        ]
      }
    ];
  }
}

// --- Chapter 4: Quora Answer Archiver & Scraper ---
class QuoraArchiverContent {
  static getMeta() {
    return {
      kicker: 'Content Preservation',
      title: '4. Quora Answer Archiver & Scraper',
      subtitle: 'Extract clean, self-contained HTML cards from viral Quora answers with high-res images and view metrics.'
    };
  }

  static manifest() {
    return [
      {
        section: 'archiver_tool',
        partLabel: 'Chapter 4 • Extractor',
        title: 'Quora Clean Card Formatter',
        blocks: [
          { id: 'comp_archiver', type: 'component', component: 'QuoraArchiverComponent' }
        ]
      }
    ];
  }
}

// --- Chapter 5: The Sovereign Feed ---
class QuoraVisionContent {
  static getMeta() {
    return {
      kicker: 'Strategic Vision',
      title: '5. The Sovereign Feed: Anti-Slop & Community Leverage',
      subtitle: 'How high-signal visual tools and algorithmic curation break platform capture and build sovereign knowledge.'
    };
  }

  static manifest() {
    return [
      {
        section: 'sovereign_manifesto',
        partLabel: 'Chapter 5 • Manifesto',
        title: 'High-Signal Curation vs. Algorithmic Degradation',
        blocks: [
          { id: 'p_sovereign_1', type: 'p' },
          { id: 'p_sovereign_2', type: 'p' }
        ]
      }
    ];
  }

  static p_sovereign_1() {
    return [
      "Modern content platforms like Quora are increasingly saturated with low-effort automated content ('slop') and engagement farming. As algorithms prioritize volume over depth, valuable institutional knowledge and technical expertise get buried.",
      "QuoraToys was created as a countermeasure: high-signal visual commentary that stands out immediately in a crowded feed. A clear, beautifully annotated image cut with mathematical precision stops the scroll and communicates complex spatial ideas in seconds."
    ];
  }

  static p_sovereign_2() {
    return [
      "By decoupling visual annotation and archiving from the platform itself, authors retain sovereignty over their work. When you solve a puzzle, explain an invention, or document CAD history in Quora, QuoraToys preserves the clean visual assets locally in high resolution for reuse across all four quadrants of your portfolio."
    ];
  }
}

// --- Chapter 6: Architecture Audit & Math Specifications ---
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
      "• Radian vs Degree Bug: GeometryUtils.rotateVector expects radians. Passing degrees spun tangents by 7+ full revolutions ($2578^\\circ$).\n" +
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

// Global Exports
globalThis.QuoraStudioContent = QuoraStudioContent;
globalThis.QuoraAnnotationContent = QuoraAnnotationContent;
globalThis.QuoraBookmarkletContent = QuoraBookmarkletContent;
globalThis.QuoraExtensionContent = QuoraExtensionContent;
globalThis.QuoraArchiverContent = QuoraArchiverContent;
globalThis.QuoraVisionContent = QuoraVisionContent;
globalThis.QuoraArchitectureContent = QuoraArchitectureContent;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    QuoraStudioContent,
    QuoraAnnotationContent,
    QuoraBookmarkletContent,
    QuoraExtensionContent,
    QuoraArchiverContent,
    QuoraVisionContent,
    QuoraArchitectureContent
  };
}