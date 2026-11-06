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
        section: 'unified_recon',
        partLabel: 'Chapter 1 • System Evolution',
        title: 'The Unified Hybrid Pen & Ambient Canvas Architecture',
        blocks: [
          { id: 'p_hybrid_pen_intro', type: 'p' },
          { id: 'sidebar_hybrid_pen_mechanics', type: 'sidebar', kicker: 'Unified Input', title: 'Seamless Click-to-Point vs. Drag-to-Drawstring' },
          { id: 'p_pause_clutch_handrest', type: 'p' },
          { id: 'sidebar_pause_clutch', type: 'sidebar', kicker: 'Control Key Clutch', title: 'Resting Hand & String Radius Tuning' },
          { id: 'p_self_annotating_help', type: 'p' },
          { id: 'sidebar_meta_help', type: 'sidebar', kicker: 'Meta-UI', title: 'Interactive Help with Native Vector Annotations' },
          { id: 'sidebar_recon_decisions', type: 'sidebar', kicker: 'Forward Design', title: 'Ambient Canvas & Forward Roadmap' }
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

  static p_hybrid_pen_intro() {
    return [
      "In the unified ambient canvas, modal tool switching is completely eliminated. When the pen touches the canvas at $P_0$, a subtle circular deadzone radius ($R = 32\\text{px}$) appears with a fat white point indicator.",
      "If the mouse is released within this circle, it registers a discrete knot insertion, allowing point-by-point curve placement with full dynamic relaxation. If the mouse is dragged beyond $R$, the kinetic string-tether engages smoothly, drawing a solid white lead pulling the curve tip."
    ];
  }

  static sidebar_hybrid_pen_mechanics() {
    return [
      "Hybrid Gesture Specification:\n" +
      "• Touch Down at $P_0$: Displays a pale boundary circle ($R=32\\text{px}$) and fat white tip indicator.\n" +
      "• Click Release Inside $R$: Commits $P_0$ as a discrete vertex. Chain relaxes dynamically as the mouse moves; previous segments stay solid while the active lead is dashed.\n" +
      "• Right-Click / Enter Commit: Discards swinging cursor drift and commits strictly the clicked nodes $[P_0 \\dots P_k]$.\n" +
      "• Drag Exceeding $R$: The solid white drawstring pulls the curve tip at $P_{\\text{pen}} = \\text{Cursor} - \\mathbf{u} \\cdot R$."
    ];
  }

  static p_pause_clutch_handrest() {
    return [
      "Drawing complex technical annotations with a mouse or trackpad causes hand fatigue. Under the **Pause & Tether-Clutch** protocol, holding the `Ctrl` key acts as a mechanical clutch:",
      "1. **Tether Length Tuning:** Moving the cursor while holding `Ctrl` expands or contracts the virtual string radius $R$, giving variable dampening leverage on the fly.",
      "2. **Hand-Rest State:** Releasing the mouse button while holding `Ctrl` locks the engine in clutch pause. The author can take their hand completely off the mouse to rest. Clicking down and releasing `Ctrl` resumes the curve uninterrupted."
    ];
  }

  static sidebar_pause_clutch() {
    return [
      "The Pause-Clutch State Machine:\n" +
      "• `Ctrl Down` (During Drag): Freezes curve tip; cursor modulates string radius $R$ with amber readout.\n" +
      "• `Mouse Up` (While `Ctrl` Held): Enters clutch pause with amber 'Hand-Rest Active' badge.\n" +
      "• `Mouse Down` $\\to$ `Ctrl Up`: Resumes kinetic curve pulling seamlessly from the exact same tip coordinate."
    ];
  }

  static p_self_annotating_help() {
    return [
      "Why display generic HTML dialogs when explaining an annotation tool? QuoraToys annotates its own interface.",
      "Holding the `H` key activates live vector guidance. Signature Bézier curves with concave arrowheads and Architect's Daughter callout brackets point directly to the drawstring, deadzone circle, knots, and clutch controls. Releasing `H` dismisses the guidance instantly."
    ];
  }

  static sidebar_meta_help() {
    return [
      "Meta-Annotation Architecture:\n" +
      "• Native Vector Ingestion: Help overlays use the identical Bézier spline and drop-shadow pipelines as user graphics.\n" +
      "• Real-Time Guidance: Live arrows point to the active drawstring, deadzone boundary, and knots.\n" +
      "• Instant Dismissal: Guidance renders exclusively while `H` is held down."
    ];
  }

  static sidebar_recon_decisions() {
    return [
      "Forward Roadmap Milestones:\n" +
      "• Step 1: Dynamic multi-point chain relaxation, colinear tangency, and right-click commit (Active).\n" +
      "• Step 2: Direct Typography Engine: dropping standalone text badges anywhere on canvas with Architect's Daughter font and 2-sided architectural brackets.\n" +
      "• Step 3: Chrome Extension Modernization: purging legacy triangle markers in favor of concave arrowheads and in-situ Quora image frame expansion."
    ];
  }

  static p_annot_intro_1() {
    return [
      "Traditional digital annotation tools produce shaky, jagged lines that look crude. QuoraToys solves this by coupling two foundational algorithms:",
      "1. **The Kinetic String-Tether:** An elastic 32px lead mechanically dampens high-frequency physiological tremors at the source.",
      "2. **On-Curve Knot Relaxation:** Strokes are parsed into least-squares cubic Bézier segments with knots placed directly on the curve path."
    ];
  }

  static sidebar_annot_features() {
    return [
      "Annotation Capabilities:\n" +
      "• Directional Concave Arrowheads: Arrows curve smoothly along exit tangents with unobscured tip markers.\n" +
      "• Attached Text Labels: Double-click any curve tail to add text in Architect's Daughter font with 2-sided architectural bracket frames.\n" +
      "• Blockout Paint: Mask logos or watermarks using solid or feathered paint for Gemini AI inpainting."
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
        section: 'unified_spec',
        partLabel: 'Chapter 6 • Section B',
        title: 'Next-Gen Specification: Layer Stack, Outbound Tangents & Split Knots',
        blocks: [
          { id: 'p_layer_stack_spec', type: 'p' },
          { id: 'sidebar_layer_hierarchy', type: 'sidebar', kicker: 'Z-Order Hierarchy', title: 'The 8-Layer Composition Pipeline' },
          { id: 'p_outbound_tangent_snap', type: 'p' },
          { id: 'sidebar_counterfactual_math', type: 'sidebar', kicker: 'Vector Formulation', title: 'Counterfactual Baseline & Snap Equations' },
          { id: 'p_de_casteljau_split_delete', type: 'p' },
          { id: 'sidebar_de_casteljau', type: 'sidebar', kicker: 'Knot Dynamics', title: 'Knot Splitting & Removal Equations' }
        ]
      },
      {
        section: 'arch_math_engine',
        partLabel: 'Chapter 6 • Section C',
        title: 'Mathematical Formulations & Algorithmic Foundations',
        blocks: [
          { id: 'p_math_tether_and_knots', type: 'p' },
          { id: 'sidebar_math_formulas', type: 'sidebar', kicker: 'Formulation Matrix', title: 'Core Vector Equations' }
        ]
      },
      {
        section: 'arch_roadmap',
        partLabel: 'Chapter 6 • Section D',
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

  static p_layer_stack_spec() {
    return [
      "A primary flaw of simple SVG rendering is layer pollution: halos, glows, or selection highlights accidentally obscuring adjacent foreground strokes. QuoraToys implements a strict 8-layer decoupled Z-stack.",
      "Every visual element distributes its graphical primitives into dedicated global SVG `<g>` groups. For instance, a spline's dark ink shadow lives exclusively in `shadowLayer`, while its luminous stroke sits in `strokeLayer`, and its selection halo occupies `glowLayer`. Even if two curves overlap, no glow or shadow can ever sit in front of any foreground line."
    ];
  }

  static sidebar_layer_hierarchy() {
    return [
      "The 8-Layer Architectural Stack (Bottom to Top):\n" +
      "1. `backdropLayer`: Canvas matte (#090d16) and base puzzle image plates.\n" +
      "2. `diffSvgLayer`: Superimposition tangent lines, anchor circles, and twin magnifier lenses.\n" +
      "3. `paintLayer`: Hard and feathered blockout mask shapes for Gemini AI inpainting.\n" +
      "4. `glowLayer`: Selection auras and 28px transparent hover pick targets.\n" +
      "5. `shadowLayer`: Solid-ink dark keyline shadows (offset +2.0px, rgba(10, 15, 25, 0.95)).\n" +
      "6. `strokeLayer`: Foreground cubic Bézier splines and dual concave arrowhead barbs.\n" +
      "7. `textBadgesLayer`: Architect's Daughter callout text and 2-sided bracket frames.\n" +
      "8. `controlsLayer`: On-curve knots, outbound tangent rays, deadzone circles, and kinetic drag-leads."
    ];
  }

  static p_outbound_tangent_snap() {
    return [
      "Standard vector editors render tangent handles that point backwards into the curve stem, causing confusion about exit velocity. In the new specification, selected endpoints project an **Outbound Tangent Ray** pointing outward *beyond* the curve.",
      "The handle can be pulled far out to gain angular leverage without altering curve curvature. Furthermore, the engine computes the **Counterfactual Natural Baseline**: the theoretical $C^1$ relaxation angle ($T_{\\text{base}}$) the curve would adopt if no user constraints were applied. When the outbound ray rotates within $\\pm 6^\\circ$ of $T_{\\text{base}}$, it snaps into place with a subtle cyan glow, allowing effortless restoration of natural curvature."
    ];
  }

  static sidebar_counterfactual_math() {
    return [
      "Outbound Tangent & Snapping Mathematics:\n" +
      "• Outbound Ray: $\\mathbf{P}_{\\text{ray}} = \\mathbf{P}_{\\text{endpoint}} + \\mathbf{T} \\cdot L_{\\text{handle}}$ (where $L_{\\text{handle}} \\ge 50\\text{px}$ for leverage).\n" +
      "• Natural Baseline: $\\mathbf{T}_{\\text{base}} = \\text{normalize}(\\mathbf{P}_{\\text{endpoint}} - \\mathbf{P}_{\\text{neighbor}})$.\n" +
      "• Angular Distance: $\\Delta\\theta = \\text{atan2}(\\mathbf{T}_{\\text{base}} \\times \\mathbf{T}, \\mathbf{T}_{\\text{base}} \\cdot \\mathbf{T})$.\n" +
      "• Snap Gate: If $|\\Delta\\theta| < 0.10\\text{ rad}$ ($6^\\circ$), $\\mathbf{T} \\leftarrow \\mathbf{T}_{\\text{base}}$ (snapped to zero offset)."
    ];
  }

  static p_de_casteljau_split_delete() {
    return [
      "A complete spline tool must allow direct knot manipulation on the curve without restarting the drawing gesture.",
      "Hovering over any curve segment activates a candidate insertion marker at parameter $t$. Clicking executes de Casteljau split subdivision, bisecting the cubic segment into two valid cubic segments while placing a new editable knot on the path. Conversely, selecting any knot and pressing `Del` collapses the adjacent segments and re-relaxes the curve smoothly."
    ];
  }

  static sidebar_de_casteljau() {
    return [
      "Knot Insertion & Deletion Mechanics:\n" +
      "• Subsegment 1: $[P_0, P_{01}, P_{012}, P_{0123}]$\n" +
      "• Subsegment 2: $[P_{0123}, P_{123}, P_{23}, P_3]$\n" +
      "• Insertion Knot: Created at $P_{0123} = \\text{Curve}(t)$, initialized with relaxed constraints ($C=1, B=1, \\Delta\\theta=0$).\n" +
      "• Knot Deletion: Deletes vertex $V_i$ and re-runs `UpdateControlPoints` over $[V_{i-1}, V_{i+1}]$."
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
        "Prioritized Implementation & Architecture Roadmap:\n" +
        "• Step 1: Restored 16-Command Key-In Matrix HUD with dynamic action highlights and detail drawer (Active).\n" +
        "• Step 2: 4-Quadrant Adaptive Architectural Bracket Formulation (Active: shelf and entrance wall orient based on u_x * u_y arrival tangent without stem overlap).\n" +
        "• Step 3: Three-Tier Cognitive Visual Prioritization: Tier 1 active knot, Tier 2 selected curve, Tier 3 dormant background curves.\n" +
        "• Step 4: Multi-Plate In-Situ Frame Padding Expander: dynamic canvas boundary expansion as images or callouts approach edges.\n" +
        "• Step 5: JSON State Import/Export: serialize complete scene graph (plates, curves, difference lenses, callouts) into portable JSON dossiers."
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