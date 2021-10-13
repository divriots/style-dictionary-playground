const fs = require("fs");
const { repopulateFileTree } = require("./file-tree-utils.js");
const StyleDictionary = require("browser-style-dictionary/browser.js");

let oldStyleDictionary;

async function cleanPlatformOutputDirs() {
  if (!oldStyleDictionary || !oldStyleDictionary.platforms) {
    return;
  }
  const foldersToClean = new Set();
  Object.entries(oldStyleDictionary.platforms).map(([key, val]) => {
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

module.exports = async function (configPath) {
  console.log("Running style-dictionary...");
  await cleanPlatformOutputDirs();
  const newStyleDictionary = await StyleDictionary.extend(configPath);
  await newStyleDictionary.buildAllPlatforms();
  await repopulateFileTree(newStyleDictionary);
  oldStyleDictionary = newStyleDictionary;
  return newStyleDictionary;
};
