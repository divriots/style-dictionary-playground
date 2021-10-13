const fs = require("fs");
const util = require("util");
const path = require("path");
const glob = require("glob");
const mkdirRecursive = require("./mkdirRecursive.js");
const asyncGlob = util.promisify(glob);
const extensionMap = {
  js: "javascript",
};
const maxDbs = 5;
const tokensPath = path.resolve("tokens");

async function saveCurrentFile() {
  const selectedFileBtn = getSelectedFileBtn();
  if (!selectedFileBtn) {
    return;
  }
  const selectedFile = selectedFileBtn.getAttribute("full-path");
  if (!selectedFile) {
    return;
  }
  await new Promise(async (resolve) => {
    await window.ensureMonacoIsLoaded();
    fs.writeFile(selectedFile, window.monaco_editor.getValue(), () => {
      resolve();
    });
  });
  selectedFileBtn.removeAttribute("unsaved");
  hooks.onDidSave(`/${selectedFile}`);
}

async function createFile(filename) {
  await new Promise((resolve) => {
    fs.writeFile(filename, "", () => {
      resolve();
    });
  });
}

async function createFolder(foldername) {
  await new Promise((resolve) => {
    fs.mkdir(foldername, (err) => {
      resolve();
    });
  });
}

async function removeFile(ev) {
  if (ev.detail.endsWith("/")) {
    await new Promise((resolve) => {
      fs.rmdir(ev.detail, { recursive: true }, () => {
        resolve();
      });
    });
  } else {
    await new Promise((resolve) => {
      fs.unlink(ev.detail, () => {
        resolve();
      });
    });
  }
  await repopulateFileTree();
}

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

async function switchToFile(file) {
  const ext = path.extname(file).slice(1);
  const lang = extensionMap[ext] || ext;
  const fileData = await new Promise((resolve) => {
    fs.readFile(file, "utf-8", (err, data) => {
      resolve(data);
    });
  });
  await window.ensureMonacoIsLoaded();
  window.monaco_editor.setValue(fileData);
  await changeLang(lang);
  window.monaco_editor.setScrollTop(0);
}

const hooks = {};
hooks.onDidSave = (file) => {};
hooks.runStyleDictionary = () => {};

async function setupFileChangeHandlers() {
  await window.ensureMonacoIsLoaded();
  window.monaco_editor.onDidChangeModelContent((ev) => {
    if (!ev.isFlush) {
      currentFileContentChanged();
    }
  });
  window.monaco_editor._domElement.addEventListener("keydown", (ev) => {
    if (ev.key === "s" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      saveCurrentFile();
    }
  });
}

async function createInputFiles(configPath) {
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
          fs.writeFile(
            file,
            JSON.stringify(JSON.parse(content), null, 2),
            (err) => {
              resolve();
            }
          );
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
        configPath,
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

let currentSdConfig = {};
async function repopulateFileTree(sdConfig) {
  if (sdConfig) {
    currentSdConfig = sdConfig;
  }
  const files = await asyncGlob("**/*", { fs, mark: true });
  const fileTreeEl = document.querySelector("file-tree");

  const outputFolders = new Set();
  Object.entries(currentSdConfig.platforms).forEach(([key, value]) => {
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

async function clearAll() {
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

async function initFileTree() {
  const fileTreeEl = document.querySelector("file-tree");
  fileTreeEl.addEventListener("run-style-dictionary", () =>
    hooks.runStyleDictionary()
  );
  fileTreeEl.addEventListener("switch-file", (ev) => switchToFile(ev.detail));
  fileTreeEl.addEventListener("save-current-file", saveCurrentFile);
  fileTreeEl.addEventListener("create-file", (ev) => createFile(ev.detail));
  fileTreeEl.addEventListener("create-folder", (ev) => createFolder(ev.detail));
  fileTreeEl.addEventListener("remove-file", (ev) => removeFile(ev));
  fileTreeEl.addEventListener("clear-all", clearAll);
  await repopulateFileTree();
}

async function changeLang(lang) {
  await window.ensureMonacoIsLoaded();
  window.monaco.editor.setModelLanguage(window.monaco_editor.getModel(), lang);
}

async function encodeContents(files) {
  const contents = {};
  await Promise.all(
    files.map(async (file) => {
      await new Promise((resolve) => {
        fs.readFile(file, "utf-8", (err, data) => {
          contents[file] = JSON.stringify(JSON.parse(data));
          resolve();
        });
      });
    })
  );
  const content = JSON.stringify(contents);
  return flate.deflate_encode(content);
}

module.exports = {
  hooks,
  setupFileChangeHandlers,
  createInputFiles,
  initFileTree,
  repopulateFileTree,
  changeLang,
  encodeContents,
};
