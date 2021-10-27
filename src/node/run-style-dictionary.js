import fs from "fs";
import util from "util";
import glob from "glob";
import StyleDictionary from "browser-style-dictionary/browser.js";
import mixpanel from "mixpanel-browser";
import { repopulateFileTree } from "./file-tree-utils.js";
import { configPath, encodeContents } from "./index.js";
const asyncGlob = util.promisify(glob);

export let styleDictionaryInstance;

async function cleanPlatformOutputDirs() {
  if (!styleDictionaryInstance || !styleDictionaryInstance.platforms) {
    return;
  }
  const foldersToClean = new Set();
  Object.entries(styleDictionaryInstance.platforms).map(([key, val]) => {
    foldersToClean.add(val.buildPath.split("/")[0]);
  });

  await Promise.all(
    Array.from(foldersToClean).map((folder) => {
      return new Promise((resolve) => {
        fs.rmdir(folder, { recursive: true }, () => {
          resolve();
        });
      });
    })
  );
}

export async function rerunStyleDictionaryIfSourceChanged(file) {
  const { source } = styleDictionaryInstance.options;
  const sourceFiles = new Set();
  await Promise.all(
    source.map(async (src) => {
      const matches = await asyncGlob(src, { nodir: true, fs });
      matches.forEach((m) => {
        sourceFiles.add(`/${m}`);
      });
    })
  );

  // Send to analytics that user ran style dictionary, with how many source files (default 3)
  // to get a feeling of how much they are testing out
  mixpanel.track("Run Dictionary", {
    sourceFiles: sourceFiles.size,
    platforms: styleDictionaryInstance.platforms,
  });

  const isSourceFile = Array.from(sourceFiles).includes(file);
  const isConfigFile = file === configPath;

  // Only run style dictionary if the config our source tokens were changed
  if (!isSourceFile && !isConfigFile) {
    return;
  }

  await runStyleDictionary(configPath);
  const encoded = await encodeContents([
    configPath,
    ...Array.from(sourceFiles),
  ]);
  window.location.href = `${window.location.origin}/#project=${encoded}`;
}

export default async function runStyleDictionary() {
  console.log("Running style-dictionary...");
  await cleanPlatformOutputDirs();
  const newStyleDictionary = await StyleDictionary.extend(configPath);
  await newStyleDictionary.buildAllPlatforms();
  styleDictionaryInstance = newStyleDictionary;
  await repopulateFileTree();
  return newStyleDictionary;
}
