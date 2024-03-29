import fs from "fs";
import util from "util";
import path from "path";
import glob from "glob";
import { configPaths, changeLang, getContents } from "./index.js";
import {
  styleDictionaryInstance,
  styleDictionaryInstanceSet,
  rerunStyleDictionaryIfSourceChanged,
} from "./run-style-dictionary.js";
import createDictionary from "browser-style-dictionary/lib/utils/createDictionary.js";
import mkdirRecursive from "./mkdirRecursive.js";
import { ensureMonacoIsLoaded, editor } from "../browser/monaco.js";

const asyncGlob = util.promisify(glob);
const extensionMap = {
  js: "javascript",
};
const tokensPath = path.resolve("tokens");
const fileTreeEl = document.querySelector("file-tree");

async function currentFileContentChanged() {
  const selectedFileBtn = getSelectedFileBtn();
  if (selectedFileBtn) {
    selectedFileBtn.setAttribute("unsaved", "");
  }
}

function getSelectedFileBtn() {
  return fileTreeEl.checkedFileBtn;
}

export async function createInputFiles() {
  const urlSplit = window.location.href.split("#project=");
  if (urlSplit.length > 1) {
    const encoded = urlSplit[1];
    await new Promise((resolve) => setTimeout(resolve, 200));
    const parsedContents = JSON.parse(flate.deflate_decode(encoded));
    await Promise.all(
      Object.entries(parsedContents).map(async ([file, content]) => {
        return new Promise(async (resolve) => {
          const dir = path.dirname(file);
          if (dir !== "/") {
            await mkdirRecursive(dir);
          }
          fs.writeFile(file, content, (err) => {
            resolve();
          });
        });
      })
    );
  } else {
    fs.mkdirSync(`color`);
    fs.mkdirSync(`card`);
    fs.mkdirSync(`radii`);

    fs.writeFileSync(
      // take the .json by default
      configPaths.find((pa) => pa.endsWith(".json")),
      JSON.stringify(
        {
          source: ["**/*.tokens.json"],
          platforms: {
            css: {
              transformGroup: "css",
              prefix: "sd",
              buildPath: "build/css/",
              files: [
                {
                  destination: "_variables.css",
                  format: "css/variables",
                },
              ],
            },
            js: {
              transformGroup: "js",
              buildPath: "build/js/",
              files: [
                {
                  destination: "variables.js",
                  format: "javascript/es6",
                },
              ],
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      path.join(`color`, "base.tokens.json"),
      JSON.stringify(
        {
          color: {
            base: {
              gray: {
                light: { value: "#CCCCCC" },
                medium: { value: "#999999" },
                dark: { value: "#111111" },
              },
              red: { value: "#FF0000" },
              green: { value: "#00FF00" },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      path.join(`color`, "font.tokens.json"),
      JSON.stringify(
        {
          color: {
            font: {
              base: { value: "{color.base.red}" },
              secondary: { value: "{color.base.green}" },
              tertiary: { value: "{color.base.gray.dark}" },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      path.join(`card`, "card.tokens.json"),
      JSON.stringify(
        {
          card: {
            border: {
              radius: {
                mobile: {
                  value: "{radii.none}",
                },
                desktop: {
                  value: "{radii.sm}",
                },
              },
            },
            heading: {
              color: {
                value: "{color.font.base}",
              },
            },
            text: {
              color: {
                value: "{color.font.tertiary}",
              },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      path.join(`radii`, "base.tokens.json"),
      JSON.stringify(
        {
          radii: {
            none: {
              value: "0",
            },
            sm: {
              value: "8px",
            },
          },
        },
        null,
        2
      )
    );
  }
}

export async function createFile(filename) {
  await new Promise((resolve) => {
    fs.writeFile(filename, "", () => {
      resolve();
    });
  });
}

export async function createFolder(foldername) {
  await new Promise((resolve) => {
    fs.mkdir(foldername, (err) => {
      resolve();
    });
  });
}

export async function editFileName(filePath, newName, isFolder = false) {
  const newPath = path.join(path.dirname(filePath), newName);
  fs.renameSync(filePath, newPath);
  await rerunStyleDictionaryIfSourceChanged(newPath, isFolder);
}

export async function removeFile(file) {
  if (file.endsWith("/")) {
    await new Promise((resolve) => {
      fs.rmdir(file, { recursive: true }, () => {
        resolve();
      });
    });
  } else {
    await new Promise((resolve) => {
      fs.unlink(file, () => {
        resolve();
      });
    });
  }
  await repopulateFileTree();
}

export async function openAllFolders() {
  await fileTreeEl.updateComplete;
  Array.from(fileTreeEl.shadowRoot.querySelectorAll("details")).forEach(
    (el) => {
      el.setAttribute("open", "");
    }
  );
}

export async function clearAll() {
  const files = await asyncGlob("**/*", { fs, mark: true });
  const filtered = files.filter((file) => file !== "sd.config.json");
  await Promise.all(
    filtered.map((file) => {
      return new Promise(async (resolve) => {
        if (file.endsWith("/")) {
          await new Promise((resolve) => {
            fs.rmdir(file, { recursive: true }, () => {
              resolve();
            });
          });
        } else if (!file.match("/")) {
          await new Promise((resolve) => {
            fs.unlink(file, () => {
              resolve();
            });
          });
        }
        resolve();
      });
    })
  );
  await repopulateFileTree();
}

export async function saveCurrentFile() {
  const selectedFileBtn = getSelectedFileBtn();
  if (!selectedFileBtn) {
    return;
  }
  const selectedFile = selectedFileBtn.getAttribute("full-path");
  if (!selectedFile) {
    return;
  }
  await new Promise(async (resolve) => {
    await ensureMonacoIsLoaded();
    fs.writeFile(selectedFile, editor.getValue(), () => {
      resolve();
    });
  });
  selectedFileBtn.removeAttribute("unsaved");
  await rerunStyleDictionaryIfSourceChanged(`/${selectedFile}`);
}

function openOrCloseJSSwitch(file) {
  const container = document.getElementById("jsSwitchContainer");
  if (container.hasAttribute("closed-by-user")) {
    return;
  }
  if (configPaths.includes(`/${file}`) && file.endsWith(".json")) {
    container.style.display = "flex";
  } else {
    container.style.display = "none";
  }
}

export async function switchToFile(file) {
  openOrCloseJSSwitch(file);
  const ext = path.extname(file).slice(1);
  const lang = extensionMap[ext] || ext;
  const fileData = await new Promise((resolve) => {
    fs.readFile(file, "utf-8", (err, data) => {
      resolve(data);
    });
  });
  await ensureMonacoIsLoaded();
  editor.setValue(fileData);
  await changeLang(lang);
  editor.setScrollTop(0);
}

export async function setupFileChangeHandlers() {
  await ensureMonacoIsLoaded();
  editor.onDidChangeModelContent((ev) => {
    if (!ev.isFlush) {
      currentFileContentChanged();
    }
  });
  editor._domElement.addEventListener("keydown", (ev) => {
    if (ev.key === "s" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      saveCurrentFile();
    }
  });
}

export async function getAllFiles() {
  const filePaths = await asyncGlob("**/*", { fs, nodir: true });

  const allFiles = {};
  await Promise.all(
    filePaths.map((filePath) => {
      return new Promise(async (resolve) => {
        const content = await new Promise((resolve) => {
          fs.readFile(filePath, "utf-8", (err, data) => {
            resolve(data);
          });
        });
        allFiles[filePath] = content;
        resolve();
      });
    })
  );
  return allFiles;
}

export async function getInputFiles() {
  await styleDictionaryInstanceSet;
  const allFiles = await asyncGlob("**/*", { nodir: true, fs });
  const outputFiles = await getOutputFiles();
  return allFiles.filter((file) => !outputFiles.includes(file));
}

export async function getOutputFiles() {
  // without a correct SD instance, we can't really know for sure what the output files are
  // therefore, we can't know what the input files are (tokens + other used files via relative imports)
  await styleDictionaryInstanceSet;
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
  return outputFiles;
}

export async function repopulateFileTree() {
  if (!styleDictionaryInstance) {
    console.error(
      "Trying to repopulate file tree without a valid style-dictionary object to check which files are input vs output."
    );
  }
  const inputFiles = await getInputFiles();
  const outputFiles = await getOutputFiles();
  fileTreeEl.outputFiles = outputFiles;
  fileTreeEl.inputFiles = inputFiles;
}

export async function dispatchTokens(ev) {
  const { source } = ev;
  await styleDictionaryInstanceSet;
  source.postMessage(
    {
      type: "sd-tokens",
      tokens: styleDictionaryInstance.tokens,
    },
    "*"
  );
}

export async function dispatchDictionary(ev) {
  const { source } = ev;
  await styleDictionaryInstanceSet;
  // Dictionary can contain methods, for postMessage cloning as a workaround
  // we therefore have to JSON.stringify it and JSON.parse it to clone which removes functions.
  const dictionary = JSON.parse(JSON.stringify(styleDictionaryInstance));
  source.postMessage(
    {
      type: "sd-dictionary",
      dictionary,
    },
    "*"
  );
}

export async function dispatchEnrichedTokens(ev) {
  const { source, data } = ev;
  const { platform } = data;
  await styleDictionaryInstanceSet;
  const enrichedTokens = styleDictionaryInstance.exportPlatform(platform);
  const { allTokens, tokens } = createDictionary({
    properties: enrichedTokens,
  });
  source.postMessage({ type: "sd-enriched-tokens", tokens, allTokens }, "*");
}

export async function dispatchInputFiles(ev) {
  const { source } = ev;
  const inputFiles = await getInputFiles();
  const contents = await getContents(inputFiles);
  source.postMessage({ type: "sd-input-files", files: contents }, "*");
}
