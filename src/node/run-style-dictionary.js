const fs = require("fs");
const glob = require("glob");
const util = require("util");
const { repopulateFileTree } = require("./file-tree-utils.js");
const StyleDictionary = require("browser-style-dictionary/browser.js");
const asyncGlob = util.promisify(glob);

let oldStyleDictionary;

async function cleanPlatformOutputDirs() {
  if (!oldStyleDictionary || !oldStyleDictionary.platforms) {
    return;
  }
  await Promise.all(
    Object.entries(oldStyleDictionary.platforms).map(([key, val]) => {
      return new Promise(async (resolve) => {
        const folderToClean = val.buildPath;
        const allFiles = await asyncGlob(`${folderToClean}/**/*`, { fs });
        await Promise.all(
          allFiles.map((file) => {
            return new Promise((resolve) => {
              fs.unlink(file, () => {
                resolve();
              });
            });
          })
        );
        resolve();
      });
    })
  );
}

module.exports = async function (configPath) {
  console.log("Running style-dictionary...");
  await cleanPlatformOutputDirs();
  const newStyleDictionary = await StyleDictionary.extend(configPath);
  await newStyleDictionary.buildAllPlatforms();
  await repopulateFileTree();
  oldStyleDictionary = newStyleDictionary;
  return newStyleDictionary;
};
