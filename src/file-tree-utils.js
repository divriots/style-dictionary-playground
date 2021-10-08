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
  await new Promise((resolve) => {
    fs.writeFile(selectedFile, __MONACO_EDITOR__.getValue(), () => {
      resolve();
    });
  });
  selectedFileBtn.removeAttribute("unsaved");
  file.onDidSave(`/${selectedFile}`);
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
  window.__MONACO_EDITOR__.setValue(fileData);
  changeLang(lang);
  window.__MONACO_EDITOR__.setScrollTop(0);
}

const file = {};
file.onDidSave = (file) => {};

function setupFileChangeHandlers() {
  __MONACO_EDITOR__.onDidChangeModelContent((ev) => {
    if (!ev.isFlush) {
      currentFileContentChanged();
    }
  });
  __MONACO_EDITOR__._domElement.addEventListener("keydown", (ev) => {
    if (ev.key === "s" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      saveCurrentFile();
    }
  });
}

/**
 * Makes sure only to keep the 5 most recent DB instances related to this playground.
 * This assumes people will not have more than 5 running playgrounds
 * simultaneously in the same browser.
 *
 * We used to run on a static db name, but that meant you could not have
 * multiple playgrounds open in the same browser. Now we prefix the db name
 * with a timestamp and a unique ID, but that could end up filling the user's
 * disk eventually with these playground dbs, which I don't want to do.
 */
async function deleteLeftoverDB() {
  const dbs = await indexedDB.databases();
  dbs
    .filter((db) => db.name.startsWith("IDBWrapper-level-filesystem-"))
    .sort((a, b) => {
      const timestampA = a.name.split("-")[3];
      const timestampB = b.name.split("-")[3];
      if (timestampA > timestampB) {
        return -1;
      }
      if (timestampA < timestampB) {
        return 1;
      }
      return 0;
    })
    .reverse();

  // If we exceed max amount of level-DBs
  // Take the oldest ones and delete

  if (dbs.length > maxDbs) {
    const amountToDelete = dbs.length - maxDbs;
    const dbsToDelete = dbs.slice(0, amountToDelete);
    await Promise.all(
      dbsToDelete.map((db) => {
        return new Promise(async (resolve) => {
          await indexedDB.deleteDatabase(db.name);
          resolve();
        });
      })
    );
  }
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
      fs.mkdir(`${tokensPath}/hello`, (err) => {
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
              scss: {
                transformGroup: "scss",
                prefix: "sd",
                buildPath: "build/scss/",
                files: [
                  {
                    destination: "_variables.scss",
                    format: "scss/variables",
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
        path.join(tokensPath, "color.json"),
        JSON.stringify(
          {
            color: {
              firebrick: { value: "#B22222" },
              orchid: { value: "#DA70D6" },
              turquoise: {
                pale: { value: "#AFEEEE" },
                medium: { value: "#48D1CC" },
                dark: { value: "#00CED1" },
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

async function populateFileTree() {
  const files = await asyncGlob("**/*", { fs, mark: true });
  const fileTreeContainer = document.querySelector("file-tree");

  fileTreeContainer.files = files;
  fileTreeContainer.addEventListener("switch-file", (ev) => {
    switchToFile(ev.detail);
  });
  fileTreeContainer.addEventListener("save-current-file", () => {
    saveCurrentFile();
  });
  fileTreeContainer.addEventListener("create-file", (ev) => {
    createFile(ev.detail);
  });
  fileTreeContainer.addEventListener("create-folder", (ev) => {
    createFolder(ev.detail);
  });
}

function changeLang(lang) {
  window.__MONACO__.editor.setModelLanguage(
    window.__MONACO_EDITOR__.getModel(),
    lang
  );
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
  file,
  setupFileChangeHandlers,
  deleteLeftoverDB,
  createInputFiles,
  populateFileTree,
  changeLang,
  encodeContents,
};
