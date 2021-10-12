import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

const editor = monaco.editor.create(
  document.getElementById("monaco-container"),
  {
    theme: "vs-dark",
  }
);

window.__MONACO__ = monaco;
window.__MONACO_EDITOR__ = editor;
