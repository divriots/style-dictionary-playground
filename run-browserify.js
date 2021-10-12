const browserify = require("browserify");
const watchify = require("watchify");
const fs = require("fs");
const path = require("path");
const through = require("through2");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv)).argv;

const outputDir = path.resolve("dist");

if (!(fs.existsSync(outputDir) && fs.lstatSync(outputDir).isDirectory())) {
  fs.mkdirSync(outputDir);
}

// Perhaps there's a better way to replace imports, but `-r fs:browserify-fs` didn't work
function fsTransform(file) {
  return through(function (buf, enc, next) {
    // browserify-fs works, memfs works as well with a small patch (see /patches), your pick :)!
    // this.push(
    //   buf
    //     .toString("utf8")
    //     .replace(/require\(("|')fs("|')\)/g, "require('browserify-fs')")
    // );
    this.push(
      buf
        .toString("utf8")
        .replace(/require\(("|')fs("|')\)/g, "require('memfs')")
    );
    next();
  });
}

const b = browserify({
  entries: ["./src/node/index.js"],
  cache: {},
  packageCache: {},
  plugin: argv.watch ? [watchify] : [],
});
b.on("update", bundle);
bundle();

function bundle() {
  console.log("(re)bundling");
  b.transform(fsTransform, { global: true });
  b.bundle((err, src) => {
    if (err) {
      console.error(err);
      return;
    }
    fs.writeFileSync(path.join(outputDir, "browserified.js"), src);
  }).on("error", console.error);
}
