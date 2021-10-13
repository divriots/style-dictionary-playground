const path = require("path");
const fs = require("fs");
const util = require("util");
const glob = require("glob");
const {
  createInputFiles,
  setupFileChangeHandlers,
  hooks,
  initFileTree,
  encodeContents,
} = require("./file-tree-utils.js");
const runStyleDictionary = require("./run-style-dictionary.js");
const asyncGlob = util.promisify(glob);
const configPath = path.resolve("sd.config.json");

let sd;

(async function () {
  await createInputFiles(configPath);
  sd = await runStyleDictionary(configPath);
  await initFileTree();
  await setupFileChangeHandlers();
  hooks.runStyleDictionary = () => runStyleDictionary(configPath);
  hooks.onDidSave = async (file) => {
    const { source } = sd.options;
    const sourceFiles = new Set();
    await Promise.all(
      source.map(async (src) => {
        const matches = await asyncGlob(src, { nodir: true, fs });
        matches.forEach((m) => {
          sourceFiles.add(`/${m}`);
        });
      })
    );

    const isSourceFile = Array.from(sourceFiles).includes(file);
    const isConfigFile = file === configPath;

    // Only run style dictionary if the config our source tokens were changed
    if (!isSourceFile && !isConfigFile) {
      return;
    }

    sd = await runStyleDictionary(configPath);
    const encoded = await encodeContents([
      configPath,
      ...Array.from(sourceFiles),
    ]);
    window.location.href = `${window.location.origin}/#project=${encoded}`;
  };
  window.addEventListener("resize", async () => {
    await window.ensureMonacoIsLoaded();
    window.monaco_editor.layout({});
    window.monaco_editor.layout();
  });
  await window.ensureMonacoIsLoaded();
  window.monaco_editor.layout({});
  window.monaco_editor.layout();
})();
