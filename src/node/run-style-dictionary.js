import fs from "fs";
import util from "util";
import glob from "glob";
import path from "path";
import * as rollup from "rollup";
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
function getCSSText(filePath) {
  if (!fs.existsSync(filePath)) {
    document.querySelector(".card-container").style.display = "none";
    return "";
  }
  const cssProps = fs.readFileSync(filePath, "utf-8");
  if (cssProps.match(/--sd-card-/g)) {
    document.querySelector(".card-container").style.display = "block";
  } else {
    document.querySelector(".card-container").style.display = "none";
  }
  return cssProps;
}

function exportCSSPropsToCardFrame() {
  const cssProps = getCSSText("build/css/_variables.css");
  if (!cssProps) {
    return;
  }

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

async function getInputFiles() {
  const allFiles = await asyncGlob("**/*", { nodir: true, fs });
  // without a correct SD instance, we can't really know for sure what the output files are
  // therefore, we can't know what the input files are (tokens + other used files via relative imports)
  if (!styleDictionaryInstance) {
    return [];
  }
  const { platforms } = styleDictionaryInstance.options;
  let outputFiles = [];
  await Promise.all(
    Object.entries(platforms).map(([key, platform]) => {
      return new Promise(async (resolve) => {
        const outFiles = await asyncGlob(`${platform.buildPath}**`, {
          nodir: true,
          fs,
        });
        outputFiles = [...outputFiles, ...outFiles];
        resolve();
      });
    })
  );
  return allFiles.filter((file) => !outputFiles.includes(file));
}

export async function rerunStyleDictionaryIfSourceChanged(file) {
  const previousRunError = !styleDictionaryInstance;

  // If previous run was okay, check whether we need a new run
  if (!previousRunError) {
    const inputFiles = await getInputFiles();
    const isInputFile = inputFiles.includes(file.replace(/^\//, ""));
    // Only run style dictionary if the config or input files were changed
    if (!isInputFile) {
      return;
    }
  }

  await runStyleDictionary();

  const inputFiles = await getInputFiles();
  // If no inputFiles, run was error so can't send something useful to analytics atm or encode contents in url
  if (inputFiles.length > 0) {
    // Send to analytics that user ran style dictionary, with how many source files (default 3)
    // to get a feeling of how much they are testing out
    mixpanel.track("Run Dictionary", {
      sourceFiles: inputFiles.size,
      platforms: styleDictionaryInstance.platforms,
    });
    const encoded = await encodeContents(inputFiles);
    window.location.href = `${window.location.origin}/#project=${encoded}`;
  }
}

export function findUsedConfigPath() {
  return configPaths.find((cfgPath) => fs.existsSync(cfgPath));
}

/**
 * Somewhat naive bundle step with rollup
 * This will allow relative import specifiers inside the playground
 * Might be nice for JS tokens importing/exporting rather than using
 * the SD {} reference syntax that you can only use inside "value"s
 *
 * EXAMPLE:
 *
 *  import foo from '../foo/bar.js';
 *
 *  export default {
 *    "color": {
 *      ...foo,
 *    }
 *  }
 */
async function bundle(inputPath) {
  const rollupCfg = await rollup.rollup({
    input: inputPath,
    plugins: [
      {
        name: "fake-import",
        resolveId(source, importer) {
          let resolved;
          if (source === inputPath) {
            resolved = inputPath;
          } else if (importer) {
            // try to resolve it from our virtual FS
            resolved = path.resolve(path.dirname(importer), source);
          }
          return resolved;
        },
        load(id) {
          if (id) {
            // try to load it from our virtual FS
            return fs.readFileSync(id, "utf-8");
          }
        },
      },
    ],
  });
  const bundle = await rollupCfg.generate({ format: "es" });
  return bundle.output[0].code;
}

export default async function runStyleDictionary() {
  console.log("Running style-dictionary...");
  document.querySelector("file-tree").animateCue();
  await cleanPlatformOutputDirs();
  let cfgObj;
  const configPath = findUsedConfigPath();
  let newStyleDictionary = {};
  try {
    // If .js, we need to parse it as actual JS without resorting to eval/Function
    // Instead, we put it in a blob and create a URL from it that we can import
    // That way, malicious code would be scoped only to the blob, which is safer.
    if (configPath.endsWith(".js")) {
      const stringJS = fs.readFileSync(configPath, "utf-8");
      const url = URL.createObjectURL(
        new Blob([stringJS], { type: "text/javascript" })
      );
      const configMod = await import(url);
      cfgObj = configMod.default;
    } else {
      cfgObj = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }

    // Custom parser for JS files
    cfgObj.parsers = [
      ...(cfgObj.parsers || []),
      {
        // matches ts, js, mjs
        pattern: /\.(j|mj)s$/,
        parse: async ({ filePath }) => {
          const bundled = await bundle(filePath);
          const url = URL.createObjectURL(
            new Blob([bundled], { type: "text/javascript" })
          );
          const { default: token } = await import(url);
          return token;
        },
      },
    ];

    newStyleDictionary = await StyleDictionary.extend(cfgObj);
    styleDictionaryInstance = newStyleDictionary;
    await newStyleDictionary.buildAllPlatforms();
    exportCSSPropsToCardFrame();
  } catch (e) {
    console.error(`Style Dictionary error: ${e}`);
  } finally {
    await repopulateFileTree();
    return newStyleDictionary;
  }
}
