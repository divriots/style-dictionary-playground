const fs = require("fs");
const path = require("path");

module.exports = async function mkdirRecursive(pathToCreate) {
  await pathToCreate.split(path.sep).reduce(async (prevPath, folder) => {
    const resolvedPrevPath = await prevPath;
    const currentPath = path.join(resolvedPrevPath, folder, path.sep);
    const exists = await new Promise((resolve) => {
      fs.stat(currentPath, (err, stats) => {
        resolve(!Boolean(err));
      });
    });
    if (!exists) {
      await new Promise((resolve) => {
        fs.mkdir(currentPath, () => {
          resolve();
        });
      });
    }
    return currentPath;
  }, "");
};
