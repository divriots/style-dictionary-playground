import path from "path";
import fs from "fs";
import {
  createInputFiles,
  setupFileChangeHandlers,
  dispatchTokens,
  dispatchInputFiles,
  dispatchDictionary,
  dispatchEnrichedTokens,
  openAllFolders,
} from "./file-tree-utils.js";
import runStyleDictionary, {
  findUsedConfigPath,
  rerunStyleDictionaryIfSourceChanged,
} from "./run-style-dictionary.js";
import { ensureMonacoIsLoaded, editor, monaco } from "../browser/monaco.js";
import "../browser/index.js";

// supported config paths, prioritized in this order
export const configPaths = [
  "config.js",
  "sd.config.js",
  "config.json",
  "sd.config.json",
].map((p) => path.resolve(p));

export async function changeLang(lang) {
  await ensureMonacoIsLoaded();
  monaco.editor.setModelLanguage(editor.getModel(), lang);
}

export async function getContents(files) {
  const contents = {};
  await Promise.all(
    files.map(async (file) => {
      await new Promise((resolve) => {
        fs.readFile(file, "utf-8", (err, data) => {
          contents[file] = data;
          resolve();
        });
      });
    })
  );
  return contents;
}

export async function encodeContents(files) {
  const contents = await getContents(files);
  const content = JSON.stringify(contents);
  return flate.deflate_encode(content);
}

async function switchToJS(ev) {
  const configPath = findUsedConfigPath();
  if (configPath.endsWith(".json")) {
    ev.target.parentElement.style.display = "none";
    const contents = fs.readFileSync(configPath, "utf-8");
    const newPath = `${configPath.split(".json")[0]}.js`;
    const newContents = `export default ${contents};`;
    fs.unlinkSync(configPath);
    fs.writeFileSync(newPath, newContents, "utf-8");
    await rerunStyleDictionaryIfSourceChanged(newPath);
    await document.querySelector("file-tree").switchToFile(newPath);
  }
}

function switchClose(ev) {
  ev.target.parentElement.style.display = "none";
  ev.target.parentElement.setAttribute("closed-by-user", "");
}

(async function () {
  window.addEventListener("message", (ev) => {
    const { data } = ev;
    switch (data.type) {
      case "sd-tokens-request":
        dispatchTokens(ev);
        break;
      case "sd-input-files-request":
        dispatchInputFiles(ev);
        break;
      case "sd-dictionary-request":
        dispatchDictionary(ev);
        break;
      case "sd-enriched-tokens-request":
        dispatchEnrichedTokens(ev);
        break;
    }
  });
  await createInputFiles();
  await runStyleDictionary();
  await openAllFolders();
  await setupFileChangeHandlers();
  window.addEventListener("resize", async () => {
    await ensureMonacoIsLoaded();
    editor.layout({});
    editor.layout();
  });
  document.getElementById("jsSwitchBtn").addEventListener("click", switchToJS);
  document
    .getElementById("jsSwitchClose")
    .addEventListener("click", switchClose);
  await ensureMonacoIsLoaded();
  editor.layout({});
  editor.layout();
})();
