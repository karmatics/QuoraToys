class QuoraStudioContent {
  static getMeta() {
    return {
      kicker: 'Toy #1 • Optical Image Analysis',
      title: '0. Spot-The-Difference Studio & Solution Canvas',
      subtitle: 'Superimpose dual puzzle images with pixel-perfect alignment, spot differences via optical flashing or scrolling stripes, and generate broadcast-ready side-by-side solution callouts.'
    };
  }

  static manifest() {
    return [
      {
        section: 'studio_mount',
        partLabel: 'Chapter 0 • Interactive Lab',
        title: 'Spot-The-Difference Interactive Studio',
        blocks: [
          { id: 'comp_quora_studio', type: 'component', component: 'QuoraStudioComponent' }
        ]
      },
      {
        section: 'studio_methodology',
        partLabel: 'Chapter 0 • How It Works',
        title: 'Cognitive Blindness & Optical Alignment',
        blocks: [
          { id: 'p_studio_intro_1', type: 'p' },
          { id: 'sidebar_comparator_features', type: 'sidebar', kicker: 'Optical Ergonomics', title: 'The 3 Superimposition Modes' },
          { id: 'p_studio_intro_2', type: 'p' }
        ]
      }
    ];
  }

  static p_studio_intro_1() {
    return [
      "Quora and social media puzzle feeds frequently feature 'Can you spot the 5 differences?' challenges. Human vision suffers from cognitive saccadic masking: shifting your eyes back and forth between two side-by-side pictures strains visual memory and creates false certainty.",
      "QuoraToys completely bypasses visual fatigue by superimposing one half of the puzzle directly over the other with sub-pixel alignment."
    ];
  }

  static sidebar_comparator_features() {
    return [
      "Three Modes of Instant Detection:\n" +
      "• 1. 50% Alpha Opacity: Overlapping identical pixels cancel each other out, while differences appear ghosted or doubled.\n" +
      "• 2. ⚡ Optical Flashing: Toggles the overlay on and off rapidly at 600ms cycles. Any modified detail immediately creates an unmissable motion reflex.\n" +
      "• 3. ▤ Scrolling Zebra Stripes: Animated wave lines sweep horizontally across the alignment, exposing edge misalignments and subtle color variances."
    ];
  }

  static p_studio_intro_2() {
    return [
      "Once an anomaly is spotted, clicking '⭕ Circle Diff' lets you drag a single circle around the affected feature. The Solution Studio automatically generates twin callouts comparing Image A and Image B perpendicular to your drag vector, with optional 50/50 anchor blending and zero-effort '📋 Copy Image' export for Quora replies."
    ];
  }
}

class QuoraAnnotationContent {
  static getMeta() {
    return {
      kicker: 'Toy #2 • The 5-Second Professional Edit',
      title: '1. Pro Annotation Engine & Kinetic Splines',
      subtitle: 'Vector drawing with cubic Bézier curve fitting, dual-layer shadows, auto arrowheads, speech balloons, and the blockout paint brush for Gemini.'
    };
  }

  static manifest() {
    return [
      {
        section: 'annotation_studio_mount',
        partLabel: 'Chapter 1 • Interactive Studio',
        title: 'Universal Annotation & Composite Studio',
        blocks: [
          { id: 'comp_quora_annotation', type: 'component', component: 'QuoraAnnotationComponent' }
        ]
      },
      {
        section: 'annotation_features',
        partLabel: 'Chapter 1 • Core Architecture',
        title: 'Vector Smoothing, Dual-Layer Shadows & AI Blockout',
        blocks: [
          { id: 'p_annotation_problem', type: 'p' },
          { id: 'sidebar_shadow_layering', type: 'sidebar', kicker: 'Graphics Pipeline', title: 'Layer Hierarchy & Dual-Layer Keylines' },
          { id: 'p_kinetic_tether', type: 'p' },
          { id: 'sidebar_kinetic_mechanics', type: 'sidebar', kicker: 'Patented Ergonomics', title: 'How the Kinetic String-Tether Works' }
        ]
      }
    ];
  }

  static p_annotation_problem() {
    return [
      "Most image annotations on Quora, Twitter, and Reddit look like they were scribbled by a toddler using MS Paint. Users try to circle a detail or point an arrow with a mouse or trackpad, resulting in jagged, shaky lines that distract from the argument and undermine the authority of the post.",
      "Professional tools like Photoshop or Illustrator solve the visual fidelity problem, but at the cost of immense friction: launching a heavy application, managing complex layers, adjusting pen-tool control handles, and exporting files. Nobody wants to spend four minutes in Photoshop just to add a quick explanatory arrow to a Quora discussion.",
      "QuoraToys delivers **the 5-second professional edit**: you grab or drop an image, drag a gesture across it, and it instantly renders as a mathematically smoothed cubic Bézier spline curve, complete with tangent-aligned directional arrowheads, solid crisp-ink drop shadows, and instant $2\\times$ retina clipboard export ready for Quora, Substack, or Twitter."
    ];
  }

  static sidebar_shadow_layering() {
    return [
      "Layering Architecture & Gemini Inpainting Prep:\n" +
      "• Layer 0 (Matte Backdrop): Establishes canvas bounds with manual or auto edge pulling.\n" +
      "• Layer 1 (Image Plates): Base and overlay puzzle halves.\n" +
      "• Layer 2 (Native Difference Lenses): First-class dual inspection viewports.\n" +
      "• Layer 3 (Blockout Paint Layer): Soft-edge or solid strokes using SVG <feGaussianBlur> masks to block out objects for AI inpainting.\n" +
      "• Layer 4 (Vector Keyline Shadows): Dark solid-ink underlays (offset 1.5px) for non-blurry contrast.\n" +
      "• Layer 5 (Foreground Splines & Badges): Crisp cubic Béziers, auto arrowheads, and attached text badges anchored to the curve tail or midpoint."
    ];
  }

  static p_kinetic_tether() {
    return [
      "Beyond post-hoc curve smoothing (via Philip J. Schneider's classic least-squares cubic Bézier fitting algorithm), QuoraToys incorporates an original drafting invention: **the Kinetic String-Tether (Virtual Drag-Lead)**.",
      "When drawing freehand curves with a mouse, involuntary micro-tremors in the human hand cause unsightly wobbles. By pressing `Ctrl` while drawing (or toggling the Tether button), the user attaches an elastic virtual string between their cursor and the actual drawing point.",
      "The pen tip trails behind the cursor like a weighted calligraphy brush pulled by a thread. This physical simulation filters out high-frequency jitters at the source, allowing anyone to draw sweeping, elegant arcs and callouts that look hand-crafted by an industrial designer."
    ];
  }

  static sidebar_kinetic_mechanics() {
    return [
      "Kinetic String-Tether Features:\n" +
      "• Instant Activation: Hold `Ctrl` or `Meta` to extend the kinetic tether.\n" +
      "• Elastic Pull Physics: The pen tip moves only along the vector tangent when the tether radius is exceeded.\n" +
      "• Contiguous Erase Rewind: Drag back into the erase circle or hold `Shift` to rewind vertices contiguously without deleting earlier loops.\n" +
      "• Automatic Tangent Arrowheads: When the stroke completes, the arrowhead dynamically aligns to the exact exit vector of the final Bézier segment."
    ];
  }
}

class QuoraBookmarkletContent {
  static getMeta() {
    return {
      kicker: 'In-Situ Browser Injection',
      title: '2. In-Situ Bookmarklet Hub & Image Sniffer',
      subtitle: 'Run QuoraToys directly on quora.com with a single click. Inspect images directly in your live browser tab without leaving the feed.'
    };
  }

  static manifest() {
    return [
      {
        section: 'bookmarklet_generator',
        partLabel: 'Chapter 2 • Generator',
        title: 'Draggable Bookmarklet & Clean-Naming Hub',
        blocks: [
          { id: 'comp_quora_bookmarklet', type: 'component', component: 'QuoraBookmarkletComponent' }
        ]
      }
    ];
  }
}

class QuoraExtensionContent {
  static getMeta() {
    return {
      kicker: 'Dedicated Chrome Companion',
      title: '3. Chrome Extension & Ambient Tools',
      subtitle: 'The brand-new QuoraToys & Power Tools extension: streamlined Manifest V3 packaging without YouTube or bookmark manager bloat.'
    };
  }

  static manifest() {
    return [
      {
        section: 'extension_deck',
        partLabel: 'Chapter 3 • Extension',
        title: 'Unpacked Extension Cockpit & Tool Matrix',
        blocks: [
          { id: 'comp_quora_extension', type: 'component', component: 'QuoraExtensionComponent' }
        ]
      }
    ];
  }
}

class QuoraArchiverContent {
  static getMeta() {
    return {
      kicker: 'Content Forensic Tools',
      title: '4. Quora Answer Archiver & Scraper',
      subtitle: 'Extract viral Quora posts into clean, standalone HTML cards with embedded topics, view statistics, and ad-free formatting.'
    };
  }

  static manifest() {
    return [
      {
        section: 'archiver_deck',
        partLabel: 'Chapter 4 • Archiver',
        title: 'Clean Answer Card Extractor',
        blocks: [
          { id: 'comp_quora_archiver', type: 'component', component: 'QuoraArchiverComponent' }
        ]
      }
    ];
  }
}

class QuoraVisionContent {
  static getMeta() {
    return {
      kicker: 'The Sovereign Feed & Community Leverage',
      title: '5. The Sovereign Feed: Anti-Slop & Parallel Reputation',
      subtitle: 'Countering algorithmic outrage, identifying bot farms and rage-bait trolls, and building a community-governed parallel curation layer with federated cross-posting.'
    };
  }

  static manifest() {
    return [
      {
        section: 'vision_critique',
        partLabel: 'Chapter 5 • Algorithmic Pathology',
        title: 'The Algorithmic Decay of Quora’s Feed',
        blocks: [
          { id: 'p_feed_decay', type: 'p' },
          { id: 'sidebar_outrage_reflex', type: 'sidebar', kicker: 'Cognitive Traps', title: 'The Shock-Value Feedback Loop' }
        ]
      },
      {
        section: 'vision_immune_response',
        partLabel: 'Chapter 5 • Community Resistance',
        title: 'Digital Chemotherapy & The Anti-Slop Movement',
        blocks: [
          { id: 'p_digital_chemo', type: 'p' },
          { id: 'sidebar_parallel_reputation', type: 'sidebar', kicker: 'Decentralized Curation', title: 'The Parallel Community Database' }
        ]
      },
      {
        section: 'vision_cross_posting',
        partLabel: 'Chapter 5 • Creator Sovereignty',
        title: 'Cross-Posting to Substack, Twitter & Beyond',
        blocks: [
          { id: 'p_cross_platform_leverage', type: 'p' }
        ]
      }
    ];
  }

  static p_feed_decay() {
    return [
      "Quora’s feed recommendation engine has fallen victim to the classic social media rot economy: optimizing purely for unreflective engagement rather than intellectual curiosity, nuance, or artistic quality.",
      "A casual scroll through the modern Quora feed bombards users with gruesome historical execution photographs, inflammatory bad-faith political debates, and automated AI spam rings churning out hallucinated answers to farm ad impressions.",
      "Users are trapped by their own biological visual reflexes: when a horrific or bizarre image flashes on screen, human eyes involuntarily lock onto it. The platform’s algorithm registers this dwell time as 'high engagement' and promptly floods the user’s feed with even more repulsive content."
    ];
  }

  static sidebar_outrage_reflex() {
    return [
      "The Engagement Machine Pathology:\n" +
      "• Biological Reflex Exploitation: Shocking imagery triggers primitive saccadic locking that native algorithms treat as deliberate interest.\n" +
      "• Bot Slop Farming: Automated bot accounts generate hundreds of thousands of answers, crowding out thoughtful human contributors.\n" +
      "• Lack of User Agency: Native block and mute buttons are black boxes that fail to stem the tide of coordinated bot networks."
    ];
  }

  static p_digital_chemo() {
    return [
      "In response to this platform degradation, organic user resistance has emerged. Communities like **'Digital Chemotherapy'** on Quora were formed specifically to identify, call out, and coordinate the reporting of fake AI user rings, plagiarists, and troll farms.",
      "While their purpose is noble, their tools are primitive: manual comments, screenshots, and Quora moderation reports that take days or weeks to process—by which point the bot farm has already spawned ten new accounts.",
      "QuoraToys equips this community with real software leverage. By embedding a **Parallel Community Reputation Database** inside the bookmarklet and Chrome extension, users can share verified classifications of bot networks, rage-bait accounts, and quality creators.",
      "When running QuoraToys, your feed is filtered through this human-curated lens: bot accounts are silenced, sensationalist horror posts are filtered, and authentic visual creators and thinkers are elevated."
    ];
  }

  static sidebar_parallel_reputation() {
    return [
      "How the Parallel Reputation Database Works:\n" +
      "• Client-Side Overlay: Does not depend on Quora’s broken native moderation tools.\n" +
      "• Distributed Trust Web: Community-verified tags (`#bot_farm`, `#ragebait`, `#authentic_artist`, `#expert_contributor`).\n" +
      "• Sovereign Lens: Users choose their own filtering threshold—blurring unwanted content categories while boosting curated human galleries."
    ];
  }

  static p_cross_platform_leverage() {
    return [
      "The ultimate defense against platform decay is **creator mobility**. When contributors produce high-effort answers, beautiful visual comparisons, or annotated analyses, they should never be locked into Quora’s walled garden.",
      "QuoraToys is designed as a **Universal Cross-Posting Bridge**. With a single click, any annotated image, card extraction, or solution callout can be packaged and piped directly to **Substack** (for long-form newsletter publishing), **Twitter** (for rapid discussion threads), and personal dossiers.",
      "By giving creators frictionless leverage to publish across platforms, QuoraToys ensures that high-quality human discourse thrives wherever creators choose to gather."
    ];
  }
}

globalThis.QuoraStudioContent = QuoraStudioContent;
globalThis.QuoraAnnotationContent = QuoraAnnotationContent;
globalThis.QuoraBookmarkletContent = QuoraBookmarkletContent;
globalThis.QuoraExtensionContent = QuoraExtensionContent;
globalThis.QuoraArchiverContent = QuoraArchiverContent;
globalThis.QuoraVisionContent = QuoraVisionContent;