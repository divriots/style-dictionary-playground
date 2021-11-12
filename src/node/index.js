import path from "path";
import fs from "fs";
import {
  createInputFiles,
  setupFileChangeHandlers,
  repopulateFileTree,
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

(async function () {
  await createInputFiles();
  await runStyleDictionary();
  await repopulateFileTree();
  await setupFileChangeHandlers();
  window.addEventListener("resize", async () => {
    await ensureMonacoIsLoaded();
    editor.layout({});
    editor.layout();
  });
  await ensureMonacoIsLoaded();
  editor.layout({});
  editor.layout();
})();
