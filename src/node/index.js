import path from "path";
import fs from "fs";
import {
  createInputFiles,
  setupFileChangeHandlers,
  repopulateFileTree,
  dispatchTokens,
} from "./file-tree-utils.js";
import runStyleDictionary, {
  findUsedConfigPath,
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

export async function encodeContents(files) {
  const configPath = findUsedConfigPath();
  files = [configPath, ...files];
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
  const content = JSON.stringify(contents);
  return flate.deflate_encode(content);
}

async function switchToJS() {
  const configPath = findUsedConfigPath();
  if (configPath.endsWith(".json")) {
    const contents = fs.readFileSync(configPath, "utf-8");
    const newPath = `${configPath.split(".json")[0]}.js`;
    const newContents = `export default ${contents};`;
    fs.unlinkSync(configPath);
    fs.writeFileSync(newPath, newContents, "utf-8");
    await runStyleDictionary();
    await repopulateFileTree();
    await document.querySelector("file-tree").switchToFile(newPath);
  }
}

(async function () {
  window.addEventListener("sd-tokens-request", dispatchTokens);
  await createInputFiles();
  await runStyleDictionary();
  await repopulateFileTree();
  await setupFileChangeHandlers();
  window.addEventListener("resize", async () => {
    await ensureMonacoIsLoaded();
    editor.layout({});
    editor.layout();
  });
  document.getElementById("jsSwitchBtn").addEventListener("click", switchToJS);
  await ensureMonacoIsLoaded();
  editor.layout({});
  editor.layout();
})();
