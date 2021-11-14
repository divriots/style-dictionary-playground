import fs from "fs";
import util from "util";
import path from "path";
import glob from "glob";
import { configPaths, changeLang } from "./index.js";
import {
  styleDictionaryInstance,
  rerunStyleDictionaryIfSourceChanged,
} from "./run-style-dictionary.js";
import mkdirRecursive from "./mkdirRecursive.js";
import { ensureMonacoIsLoaded, editor } from "../browser/monaco.js";

const asyncGlob = util.promisify(glob);
const extensionMap = {
  js: "javascript",
};
const tokensPath = path.resolve("tokens");

async function currentFileContentChanged() {
  const selectedFileBtn = getSelectedFileBtn();
  if (selectedFileBtn) {
    selectedFileBtn.setAttribute("unsaved", "");
  }
}

function getSelectedFileBtn() {
  const fileTreeEl = document.querySelector("file-tree");
  return fileTreeEl.checkedFileBtn;
}

export async function createInputFiles() {
  const urlSplit = window.location.href.split("#project=");
  if (urlSplit.length > 1) {
    const encoded = urlSplit[1];
    await new Promise((resolve) => setTimeout(resolve, 100));
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
    await new Promise((resolve) => {
      fs.mkdir(tokensPath, (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      fs.mkdir(`${tokensPath}/color`, (err) => {
        resolve();
      });
    });
    // Create SD config
    await new Promise((resolve) => {
      fs.writeFile(
        // take the config.json by default
        configPaths[2],
        JSON.stringify(
          {
            source: ["tokens/**/*.json"],
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
        ),
        (err) => {
          resolve();
        }
      );
    });

    // Create some tokens (color)
    await new Promise((resolve) => {
      fs.writeFile(
        path.join(`${tokensPath}/color`, "base.json"),
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
        ),
        (err) => {
          resolve();
        }
      );
    });

    // Create some tokens (color)
    await new Promise((resolve) => {
      fs.writeFile(
        path.join(`${tokensPath}/color`, "font.json"),
        JSON.stringify(
          {
            color: {
              font: {
                base: { value: "{color.base.red.value}" },
                secondary: { value: "{color.base.green.value}" },
                tertiary: { value: "{color.base.gray.light.value}" },
              },
            },
          },
          null,
          2
        ),
        (err) => {
          resolve();
        }
      );
    });
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

export async function switchToFile(file) {
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

export async function repopulateFileTree() {
  const files = await asyncGlob("**/*", { fs, mark: true });
  const fileTreeEl = document.querySelector("file-tree");

  const outputFolders = new Set();
  Object.entries(styleDictionaryInstance.platforms).forEach(([key, value]) => {
    outputFolders.add(value.buildPath.split("/")[0]);
  });
  const inputFiles = files.filter((file) => {
    return !Array.from(outputFolders).some((outputFolder) =>
      file.startsWith(`${outputFolder}/`)
    );
  });

  const outputFiles = files.filter((file) => !inputFiles.includes(file));

  fileTreeEl.inputFiles = inputFiles;
  fileTreeEl.outputFiles = outputFiles;
}
