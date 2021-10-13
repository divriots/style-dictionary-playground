import copy from "rollup-plugin-copy";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import * as path from "path";
import * as fs from "fs";

const filesToCopy = [
  path.resolve("src", "index.html"),
  path.resolve("src", "style.css"),
  path.resolve("src", "assets"),
];

const plugins = [
  {
    name: "inline-fs",
    transform(code, id) {
      return code.replace(
        /fs.readFileSync\(\s*__dirname\s*\+\s*'\/templates\/(.*)'\)/g,
        (match, $1) => {
          const tpl = path.join(
            "./node_modules/browser-style-dictionary/lib/common/templates",
            $1
          );
          return JSON.stringify(fs.readFileSync(tpl, "utf8"));
        }
      );
    },
  },
  {
    name: "watch-external",
    buildStart() {
      filesToCopy.forEach((file) => this.addWatchFile(file));
    },
  },
  copy({
    targets: [...filesToCopy.map((file) => ({ src: file, dest: "dist" }))],
  }),
];

export default [
  {
    input: "dist/browserified.js",
    output: {
      format: "es",
      file: "dist/index-node.js",
    },
    plugins,
  },
  {
    input: "src/browser/index.mjs",
    output: {
      format: "es",
      file: "dist/index.js",
      inlineDynamicImports: true,
    },
    plugins: [nodeResolve(), json()],
  },
];
