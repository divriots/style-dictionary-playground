import fs from "fs";
import util from "util";
import glob from "glob";
import StyleDictionary from "browser-style-dictionary/browser.js";
import mixpanel from "mixpanel-browser";
import { repopulateFileTree } from "./file-tree-utils.js";
import { configPaths, encodeContents } from "./index.js";
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

// If we don't have the CSS props or card tokens
// there's no use in showing the card component demo
function displayOrHideCard() {
  if (
    !fs.existsSync("build/css/_variables.css") ||
    !fs.existsSync("tokens/card/card.json")
  ) {
    document.querySelector(".card-container").style.display = "none";
    return;
  }
  document.querySelector(".card-container").style.display = "block";
}

function exportCSSPropsToCardFrame() {
  displayOrHideCard();

  const cssProps = fs.readFileSync("build/css/_variables.css", "utf-8");

  const cardFrame = document.getElementById("card-frame");
  // if iframe is not fully loaded we can't inject the CSS sheet yet
  if (cardFrame.contentWindow.document.readyState !== "complete") {
    cardFrame.contentWindow.addEventListener("load", () => {
      cardFrame?.contentWindow.insertCSS(cssProps);
    });
    return;
  }
  cardFrame?.contentWindow.insertCSS(cssProps);
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
  const isConfigFile = configPaths.includes(file);

  // Only run style dictionary if the config our source tokens were changed
  if (!isSourceFile && !isConfigFile) {
    return;
  }

  await runStyleDictionary();
  const encoded = await encodeContents([...Array.from(sourceFiles)]);
  window.location.href = `${window.location.origin}/#project=${encoded}`;
}

export function findUsedConfigPath() {
  return configPaths.find((cfgPath) => fs.existsSync(cfgPath));
}

export default async function runStyleDictionary() {
  console.log("Running style-dictionary...");
  document.querySelector("file-tree").animateCue();
  await cleanPlatformOutputDirs();
  let newStyleDictionary;
  const configPath = findUsedConfigPath();

  // If .js, we need to parse it as actual JS without resorting to eval/Function
  // Instead, we put it in a blob and create a URL from it that we can import
  // That way, malicious code would be scoped only to the blob, which is safer.
  if (configPath.endsWith(".js")) {
    const stringJS = fs.readFileSync(configPath, "utf-8");
    const url = URL.createObjectURL(
      new Blob([stringJS], { type: "text/javascript" })
    );
    const configMod = await import(url);
    const configObj = configMod.default;
    newStyleDictionary = await StyleDictionary.extend(configObj);
  } else {
    newStyleDictionary = await StyleDictionary.extend(configPath);
  }
  await newStyleDictionary.buildAllPlatforms();
  styleDictionaryInstance = newStyleDictionary;
  await repopulateFileTree();
  exportCSSPropsToCardFrame();
  return newStyleDictionary;
}
