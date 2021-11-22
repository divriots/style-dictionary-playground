// Helper so we can pass CSS from style-dictionary output into this iframe
// since adopted style sheets may not be shared across documents..
globalThis.insertCSS = (cssText) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  document.adoptedStyleSheets = [sheet];
};

function setViewportText() {
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
