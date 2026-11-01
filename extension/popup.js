function runTool(className) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    chrome.runtime.sendMessage({ action: 'injectScript', tabId: tabs[0].id, className }, () => {
      window.close();
    });
  });
}
document.getElementById('btn-spot-diff').onclick = () => runTool('QuoraToys');
document.getElementById('btn-aardvark').onclick = () => runTool('Aardvark');
document.getElementById('btn-draw').onclick = () => runTool('DrawingTool');
document.getElementById('btn-dictate').onclick = () => runTool('Dictation');
