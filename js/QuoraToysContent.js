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
        "Look, let's just admit it: nobody actually enjoys squinting back and forth between two nearly identical cartoon panels for ten minutes. Spot-the-difference puzzles on Quora and social media feeds are engineered to exploit human cognitive blindspots and waste your time.",
        "When you've stared at the screen until your eyes water and your brain refuses to see that fifth microscopic difference, you don't need a lecture on visual psychology—you need a fun, shameless optical cheat code.",
        "QuoraToys is your digital X-ray machine. It takes the side-by-side puzzle, lets you crop either half, and superimposes it right on top of the other with pixel-perfect alignment. You get to solve the puzzle in five seconds, drop your answer in the comments, and get on with your day."
      ];
    }

  static p_studio_intro_2() {
      return [
        "Here's how you can cheat—err, scientifically solve—any puzzle in seconds:",
        "1. **50% Ghost Alpha:** Overlap both halves with transparency. Everything identical turns sharp and solid; any modified pixel immediately doubles or looks fuzzy.",
        "2. **⚡ Optical Flashing (600ms):** Toggles the overlay on and off. The human visual system has an involuntary, hardwired motion reflex. Any difference starts dancing and flickering right in front of your eyes—it's impossible to miss.",
        "3. **▤ Scrolling Zebra Stripes:** Sweeps moving zebra lines across the seam. Subtle line shifts and color variances flutter like a venetian blind.",
        "Once you spot them, click '⭕ Circle Diff', drag a ring around each difference, and export a clean comparison card with twin magnifier lenses."
      ];
    }

  static sidebar_comparator_features() {
      return [
        "The Shameless Shortcut Engine:\n" +
        "• 1-Click Crop: Crop Puzzle B, drag it over Puzzle A, and tap Arrow keys for sub-pixel nudge.\n" +
        "• Optical Flashing: Triggers the biological motion reflex so differences jump right into your vision.\n" +
        "• Circle & Export: Automatically generates side-by-side magnifier lenses comparing before and after, ready to paste into Quora replies."
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
              { id: 'p_living_plan_update', type: 'p' },
              { id: 'sidebar_living_plan_roadmap', type: 'sidebar', kicker: 'Iteration Plan', title: 'Text, Glow, HUD & Export Architecture' },
              { id: 'p_hybrid_pen_intro', type: 'p' },
              { id: 'sidebar_hybrid_pen_mechanics', type: 'sidebar', kicker: 'Unified Input', title: 'Tether Backup-Erase, Slack Zone & Drawstring' },
              { id: 'p_cusp_plan', type: 'p' },
              { id: 'sidebar_cusp_plan', type: 'sidebar', kicker: 'Next Milestone', title: 'Slack-String Redirection & Persistent Cusp Plan' },
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
          "The Unified Curve & Backup-Erase Mechanics:\n" +
          "• Everything is a Curve: An arrow is a curve with an arrowhead. A highlight ring is a closed curve loop. A callout is a curve with attached text.\n" +
          "• Drag Exceeding Deadzone: A solid white drawstring pulls the curve tip at $P_{\\text{pen}} = \\text{Cursor} - \\mathbf{u} \\cdot R$ ($R = 32\\text{px}$), while a subtle dashed circle around the cursor marks the contiguous erase zone ($r_{\\text{erase}} \\le 0.62 R$).\n" +
          "• Contiguous Backup & Erase: Backing the cursor into the dashed erase circle pops trailing points sequentially from the tip (without disturbing earlier crossed loops), allowing seamless in-stroke correction.\n" +
          "• Slack Zone Redirection: Between $r_{\\text{erase}}$ and $R$, the string goes slack (shown as a dashed tether), giving room to pivot without erasing.\n" +
          "• Direct Rubber-Wire Bending: Grab any curve segment with the mouse and pull to bend the spline directly through your cursor.\n" +
          "• Endpoint Snapping & Extension: Starting a stroke at an endpoint continues the curve; ending near the origin snaps into a closed loop ring."
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

  static p_annotation_problem() {
      return [
        "Vector curve drawing has been trapped in the 1980s for forty years. When John Warnock and Adobe introduced PostScript Bézier curves in the mid-1980s, they gave users the pen tool: click an anchor point, drag out two rigid tangent handles, guess where the curve will bow, and tweak stalks. It felt like assembling scaffolding, not drawing.",
        "Four decades later, mainstream vector editors still impose that exact same tedious ritual. If you want to draw a simple curved arrow pointing to a detail on an image, you either have to fight complex control handles or settle for squiggly mouse scribbles that look like MS Paint.",
        "QuoraToys breaks this 40-year stagnation with three foundational principles: **kinetic physical smoothing, direct rubber-wire bending, and the complete elimination of the vector/pixel boundary**.",
        "To the creator, it shouldn't matter whether an edit is raster or vector. If you need to erase an unwanted element or watermark, use the alpha eraser brush directly on the image plate. If you need an arrow or callout, just draw a curve—the kinetic string-tether absorbs hand tremors like a weighted calligraphy brush, directional arrowheads scale automatically, and an architectural text bracket appears ready for you to type in five seconds."
      ];
    }

  static p_kinetic_tether() {
      return [
        "The drawing experience in QuoraToys combines kinetic physical dampening with direct tactile manipulation:",
        "1. **The Kinetic String-Tether (Virtual Drag-Lead):** Involuntary physiological tremors in the human hand cause jagged wobbles when using a mouse or trackpad. QuoraToys attaches a virtual 32px elastic lead between your cursor and the pen tip. Tremors are absorbed at the source, letting anyone pull sweeping, elegant calligraphy arcs with zero effort.",
        "2. **Direct 'Rubber-Wire' Reshaping:** In Illustrator, modifying a curve requires switching to the direct selection tool, clicking an anchor, and hunting for tiny handle dots. In QuoraToys, you simply grab the curve itself with your mouse and pull. The wire bends right through your cursor, dynamically placing an on-curve knot that keeps the curve smooth.",
        "3. **Instant Draw-and-Type Acceleration:** The instant a curve ends, an architectural dashed bracket shelf (`✎ Type note...`) appears at the tail. Typing any character immediately typesets your message in Architect's Daughter font with a 2-sided bracket. If you don't type anything, the ghost shelf vanishes completely."
      ];
    }

  static p_living_plan_update() {
      return [
        "The annotation workflow follows a low-friction interaction model: clicking a curve or its subtle pale `Note…` box immediately focuses inline text editing, while pressing `Escape` commits the text and drops into Curve Command Mode (`A` arrow, `X` flip, `L` loop, `S` line, `Del` delete, Arrow keys to nudge, `Alt+Arrow` to cycle focus).",
        "Typography and glow optics are decoupled for legibility: a crisp dark outline halo sits behind glowing strokes so colored text stays sharp over busy images, and all controls in the ribbon use explicit multi-option pills (`Ink | Neon`, `Off | Tip | Tail | Both`) rather than hidden single-button toggles."
      ];
    }

  static sidebar_living_plan_roadmap() {
      return [
        "Living Iteration Plan & Implemented Milestones:\n" +
        "• Explicit Ribbon UI: Segmented selectors for Style (`Ink | Neon`), Arrow (`Off | Tip | Tail | Both`), Text Size (`A- / A+`), and Stroke Width (`− / +`).\n" +
        "• Subtle Pale-Box Editing: Matched DOM-to-SVG font metrics and line wrapping with `Escape` returning to keyboard command mode.\n" +
        "• Readability-First Glow: Independent Text Glow Mode (`Neon | Halo | Shadow | None`), Dark Outline Halo, Blur, Spread, Opacity, and Core Saturation.\n" +
        "• Custom Export Area (`📐 Export Area`): Draw and resize a custom export crop rectangle (or reset to tight auto-bounds) with preserved neon glow layers and Matte/Transparent PNG export.\n" +
        "• Portable Settings Capture: `📋 Copy Settings` and `📥 Paste` export/import full JSON defaults."
      ];
    }

  static p_cusp_plan() {
        return [
          "When backing up into the slack/erase zone and pulling out in a substantially different direction, the user intends a sharp corner rather than a rounded turn. Currently, `CurveFitter.fit()` smooths the entire polyline into a single chain, and `UpdateControlPoints` only preserves sharp corners when a vertex has `isCusp = true`.",
          "The upcoming **Slack-String Cusp Detection** system bridges the gesture machine directly to `BezierVertex.isCusp` so intentional direction reversals lock in as persistent, non-collinear Bézier corners until explicitly straightened."
        ];
      }

  static sidebar_cusp_plan() {
        return [
          "4-Stage Plan for Smart Slack-String Cusps:\n" +
          "• 1. Slack & Direction Memory (`QuoraGestureMachine`): Record the incoming unit pull direction $\\mathbf{d}_{\\text{in}}$ whenever the cursor backs into the slack zone ($r_{\\text{erase}} < d < R$) or stops after a contiguous erase rewind.\n" +
          "• 2. Turn-Angle Detection & Telegraph: On pulling taut again ($d > R$) in direction $\\mathbf{d}_{\\text{out}}$, compute $\\theta = \\arccos(\\mathbf{d}_{\\text{in}} \\cdot \\mathbf{d}_{\\text{out}})$. If $\\theta \\ge \\theta_{\\text{cusp}}$ (e.g. $45^\\circ$–$55^\\circ$), tag the tip index in `cuspIndices`. While slack and aimed past threshold, preview an amber diamond cusp marker at `curTip`.\n" +
          "• 3. Piecewise Spline Splitting (`CurveFitter` + `QuoraStrokeManager`): Split `strokePoints` at each index in `cuspIndices` and fit each smooth sub-chain independently, guaranteeing the corner point is an exact shared knot with independent incoming and outgoing Bézier control handles.\n" +
          "• 4. Persistent Non-Collinear Knots (`UpdateControlPoints` + `QuoraKnotManager`): Mark the boundary `BezierVertex` with `isCusp = true` and preserve both wings' independent angle offsets during neighbor drags until the author explicitly straightens/rejoins the knot (`C` hotkey or context menu)."
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
        "Social platforms like Quora are being overwhelmed by automated AI content farms churning out hundreds of thousands of low-effort, generic text answers to capture ad revenue. As engagement algorithms optimize for dwell time and inflammatory outrage, authentic insight is drowned in algorithmic noise.",
        "The definitive antidote to generative text-slop is **high-density visual proof**: mathematical diagrams, sub-pixel image comparisons, and verifiable graphic commentary that an LLM cannot hallucinate.",
        "A clear, beautifully annotated image cut with mathematical precision stops the scroll. A viewer can evaluate real evidence in two seconds, bypassing endless paragraphs of automated filler."
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
        "During early prototyping, vector handles and palettes were tested under rough conditions. Over successive refactorings, we replaced fragile multi-modal tool buttons with a single unified curve drafting instrument, eradicated high-frequency DOM teardown during dragging, and resolved the historic 40-year PostScript handle friction.",
        "With these issues resolved, the annotation pipeline functions as a unified system: drawing gestures convert into responsive on-curve knots, drop shadows remain strictly below foreground strokes, and floating palettes move across the entire screen without boundary clipping."
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
        "Counterfactual Natural Baseline & Full Tangency Line Formulation:\n" +
        "• Natural Tangent: For knot i, T_natural is the direction curve would point if ONLY knot i had zero constraint, calculated via localized relaxation over its adjacent neighborhood: computeCounterfactualTangent(vertices, knotIdx).\n" +
        "• Collinear Line Representation: For interior knots, the tangent line represents the line along which adjacent control points lie, projecting symmetrically in both directions through P_i (P_i +/- lambda * T).\n" +
        "• Relative Offset: Stored deviation theta is relative to T_natural, so moving neighbor knots rotates the natural baseline without warping the author's custom deviation.\n" +
        "• 2-Sided Bracket Rule: Always exactly two perpendicular sides (one vertical wall + one horizontal shelf). When curve enters from left/right, wall is on arrival edge; when curve enters from top/bottom, shelf runs along entry edge and single wall orients along horizontal velocity lean u_x.\n" +
        "• Auto-Bounds Envelope: computeBounds accounts for all spline envelopes and text bounding boxes with 45px safety margin, guaranteeing that brackets and shelves are never clipped by the canvas perimeter.\n" +
        "• Drawing Pause In-Situ Dial: Pausing during drawing for >400ms blooms the transient cursor dial for immediate 1-tap tuning, resuming seamlessly on cursor movement."
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
        "QuoraToys replaces the 1980s PostScript handle dogma with two unified, human-centered systems:",
        "1. **Kinetic Physical Smoothing:** Simulates analog mechanical lead dampening ($P_{\\text{pen}} = \\text{Cursor} - \\mathbf{u} \\cdot R$). The author draws with natural speed, and physiological tremors are eliminated before points ever reach the solver.",
        "2. **On-Curve Knots & Direct Wire Bending:** Schneider's least-squares algorithm fits cubic Bézier segments with knots placed directly on the curve path. Clicking and dragging the curve body calculates the parameter $t$ under the mouse and solves adjacent control points so the spline passes through the cursor without requiring handle manipulation."
      ];
    }

  static sidebar_math_formulas() {
      return [
        "Core Mathematical Formulations:\n" +
        "• Kinetic Drag-Lead: P_pen = Cursor - normalize(Cursor - P_last) * R (R = 32px)\n" +
        "• True Opposite-Corner Bounds: Fixed = P_orig + Size_orig; P_new = Fixed - Size_new (SW/NE/NW/SE invariant)\n" +
        "• Text Decoupled Layers: Glow in glowLayer; Plasma Core in stroke/text layers; Drop Shadow in shadowLayer\n" +
        "• Smooth Angle Projection: P_deg = P_knot + T * 94px (projected 26px beyond grab handle at 60 FPS)\n" +
        "• CAD Zoom Invariance: W_svg = W_screen / z (constant pixel width across zoom for lines and handles)\n" +
        "• Plasma Neon: Core = 255 * 0.88 + C * 0.12 over pure 14px feGaussianBlur stdDeviation=5.0 bloom"
      ];
    }
  static p_roadmap_overview() {
    return [
      "The engineering plan focuses on expanding geometric primitives while factoring large methods into modular, testable units."
    ];
  }

  static sidebar_roadmap_steps() {
    return [
      "Core Ergonomic Mandate:\n" +
      "• Fast, intuitive visual studio: Zero Photoshop/Illustrator bloat.\n" +
      "• Wide Ghost Reference Curve: Dragging any knot renders a wide 12px dashed ghost showing the prior curve state; hitting Escape or Right-Click cancels and reverts cleanly.\n" +
      "• Endpoint Hover Tangency Ray: Hovering head or tail knots reveals the tangent ray immediately with a 650ms grace corridor so you can move your cursor onto the diamond handle.\n" +
      "• Strict Midpoint Suppression: Never shows virtual divider points while moving, dragging, or hovering non-split areas. Shows at most one candidate dot on the segment nearest the cursor.\n" +
      "• Web Image Drag Ingestion: Supports direct dragging of images from other browser tabs/windows (parsing text/uri-list, URL, and HTML img tags).\n" +
      "• Real-Time Image Alpha Eraser: Erases pixels on image plates directly to transparent alpha via HTML5 canvas destination-out.\n" +
      "• Automated Diagnostic Test Suite: 1-click self-test verifying C^1 continuity, ghost snapshot reversion, magnetic snap, and alpha eraser canvas compositing.\n" +
      "\n" +
      "Refinement Focus:\n" +
      "• 1. Variable width visual stroke previews.\n" +
      "• 2. Interactive SVG optical difference detection diagnostics."
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