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

class QuoraBookmarkletContent {
  static getMeta() {
    return {
      kicker: 'In-Situ Browser Injection',
      title: '1. In-Situ Bookmarklet Hub & Image Sniffer',
      subtitle: 'Run QuoraToys directly on quora.com with a single click. Inspect images directly in your live browser tab without leaving the feed.'
    };
  }

  static manifest() {
    return [
      {
        section: 'bookmarklet_generator',
        partLabel: 'Chapter 1 • Generator',
        title: 'Draggable Bookmarklet & Clean-Naming Hub',
        blocks: [
          { id: 'comp_quora_bookmarklet', type: 'component', component: 'QuoraBookmarkletComponent' }
        ]
      },
      {
        section: 'bookmarklet_ergonomics',
        partLabel: 'Chapter 1 • Ergonomics',
        title: 'The Link Anchor Naming Protocol',
        blocks: [
          { id: 'p_bm_naming_1', type: 'p' },
          { id: 'sidebar_bm_ergonomics', type: 'sidebar', kicker: 'Browser Ergonomics', title: 'Why Link Text Matters' }
        ]
      }
    ];
  }

  static p_bm_naming_1() {
    return [
      "When dragging an anchor element to your browser's Bookmarks bar, browsers automatically name the newly created bookmark using the anchor tag's visible text content.",
      "Traditional bookmarklet generators label their buttons 'Drag to Bookmarks Bar', resulting in an ugly, uselessly named bookmark on your toolbar. In QuoraToys, the anchor text is explicitly set to clean, descriptive titles such as `🧩 QuoraToys` or `✨ SpotDiff` so your bookmarks bar remains pristine."
    ];
  }

  static sidebar_bm_ergonomics() {
    return [
      "Bookmarklet Features:\n" +
      "• 1-Click Injection: Works on Quora, Reddit, Instagram, or any website.\n" +
      "• Image Sniffer: Hover over images on the live web page to highlight them in electric cyan, then click to open in the floating comparator.\n" +
      "• Clean Tooling: Spawns draggable UITools DialogBox windows directly on top of the host page without navigating away."
    ];
  }
}

class QuoraExtensionContent {
  static getMeta() {
    return {
      kicker: 'Dedicated Chrome Companion',
      title: '2. Chrome Extension & Ambient Tools',
      subtitle: 'The brand-new QuoraToys & Power Tools extension: streamlined Manifest V3 packaging without YouTube or bookmark manager bloat.'
    };
  }

  static manifest() {
    return [
      {
        section: 'extension_deck',
        partLabel: 'Chapter 2 • Extension',
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
      title: '3. Quora Answer Archiver & Scraper',
      subtitle: 'Extract viral Quora posts into clean, standalone HTML cards with embedded topics, view statistics, and ad-free formatting.'
    };
  }

  static manifest() {
    return [
      {
        section: 'archiver_deck',
        partLabel: 'Chapter 3 • Archiver',
        title: 'Clean Answer Card Extractor',
        blocks: [
          { id: 'comp_quora_archiver', type: 'component', component: 'QuoraArchiverComponent' }
        ]
      }
    ];
  }
}

class QuoraRoadmapContent {
  static getMeta() {
    return {
      kicker: 'Suite Expansion',
      title: '4. Future Toys & Visual Solvers',
      subtitle: 'The roadmap of future Quora visual tools: logic grid assistants, chess position analyzers, and mathematical visualization toys.'
    };
  }

  static manifest() {
    return [
      {
        section: 'roadmap_deck',
        partLabel: 'Chapter 4 • Roadmap',
        title: 'Upcoming Quora Puzzle Solvers',
        blocks: [
          { id: 'p_roadmap_1', type: 'p' }
        ]
      }
    ];
  }

  static p_roadmap_1() {
    return [
      "Quora is a treasure trove of mathematical and geometric brain teasers. As QuoraToys evolves, we will add dedicated analytical toys for:",
      "• **Toy #2: Quora Answer Archiver (Active)**: Forensic capture of high-value answers and images.",
      "• **Toy #3: Perspective & Line Anomaly Solver**: Vanishing point geometry detection for 3D alignment puzzles.",
      "• **Toy #4: Spatial Grid & Chessboard Reader**: Instant matrix coordinate solver for spatial logic questions."
    ];
  }
}

globalThis.QuoraStudioContent = QuoraStudioContent;
globalThis.QuoraBookmarkletContent = QuoraBookmarkletContent;
globalThis.QuoraExtensionContent = QuoraExtensionContent;
globalThis.QuoraArchiverContent = QuoraArchiverContent;
globalThis.QuoraRoadmapContent = QuoraRoadmapContent;