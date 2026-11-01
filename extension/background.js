// QuoraToys & Power Tools Background Service Worker
const classBundles = {
  QuoraToys: [
    'utils/applyCss.js',
    'utils/makeElement.js',
    'utils/DialogBox.js',
    'features/QuoraToysInSitu.js'
  ],
  Aardvark: [
    'utils/applyCss.js',
    'utils/makeElement.js',
    'utils/DialogBox.js',
    'utils/KeystrokeHandler.js',
    'features/AardvarkOverlay.js',
    'features/AardvarkActions.js',
    'features/AardvarkStyleEditor.js',
    'features/AardvarkRadialMenu.js',
    'features/Aardvark.js'
  ],
  DrawingTool: [
    'utils/applyCss.js',
    'utils/makeElement.js',
    'utils/KeystrokeHandler.js',
    'features/CurveFitter.js',
    'features/DrawingTool.js'
  ],
  Dictation: [
    'utils/applyCss.js',
    'utils/makeElement.js',
    'utils/DialogBox.js',
    'features/AardvarkDictation.js'
  ]
};

function performInjection(tabId, className) {
  const files = classBundles[className];
  if (!files) return Promise.reject(new Error('Unknown class: ' + className));

  return chrome.scripting.executeScript({
    target: { tabId },
    files: files,
    world: 'MAIN'
  }).then(() => {
    return chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (cls, dictationUrl) => {
        if (cls === 'QuoraToys') {
          if (typeof QuoraToys !== 'undefined') {
            QuoraToys.launchBookmarklet();
          }
          return;
        }
        if (cls === 'Aardvark') {
          if (!window.aardvarkInstance && typeof Aardvark !== 'undefined') {
            window.aardvarkInstance = new Aardvark();
            window.aardvarkInstance.init();
          } else if (window.aardvarkInstance) {
            window.aardvarkInstance.wakeUp();
          }
          return;
        }
        if (cls === 'DrawingTool') {
          if (window.drawingToolInstance) {
            window.drawingToolInstance.quit();
            window.drawingToolInstance = null;
          } else if (typeof DrawingTool !== 'undefined') {
            window.drawingToolInstance = new DrawingTool();
          }
          return;
        }
        if (cls === 'Dictation') {
          if (typeof AardvarkDictation !== 'undefined') {
            AardvarkDictation.launchAt(dictationUrl);
          }
          return;
        }
      },
      args: [className, chrome.runtime.getURL('dictation.html')]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "quoratoys-parent",
      title: "QuoraToys & Tools",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "qt-spot-diff",
      parentId: "quoratoys-parent",
      title: "🧩 Spot-the-Difference Comparator",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "qt-aardvark",
      parentId: "quoratoys-parent",
      title: "🔍 Aardvark (DOM Tool)",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "qt-draw",
      parentId: "quoratoys-parent",
      title: "✏️ Draw / Annotate",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "qt-dictate",
      parentId: "quoratoys-parent",
      title: "🎙️ Dictation",
      contexts: ["all"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === "qt-spot-diff") performInjection(tab.id, "QuoraToys");
  if (info.menuItemId === "qt-aardvark") performInjection(tab.id, "Aardvark");
  if (info.menuItemId === "qt-draw") performInjection(tab.id, "DrawingTool");
  if (info.menuItemId === "qt-dictate") performInjection(tab.id, "Dictation");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'injectScript') {
    performInjection(request.tabId, request.className)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
