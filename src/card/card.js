let res;
const loadComplete = new Promise((resolve) => {
  res = resolve;
});

window.addEventListener("load", () => {
  res();
});

// Helper so we can pass CSS from style-dictionary output into this iframe
// since adopted style sheets may not be shared across documents..
globalThis.insertCSS = async (cssText) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  await loadComplete;
  document.adoptedStyleSheets = [sheet];
};

async function setViewportText() {
  await loadComplete;
  if (window.innerWidth < 600) {
    document.getElementById("viewport-text").innerText = "Viewport: Mobile";
  } else {
    document.getElementById("viewport-text").innerText = "Viewport: Desktop";
  }
}

window.addEventListener("resize", () => {
  setViewportText();
});
setViewportText();
