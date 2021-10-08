import copy from "rollup-plugin-copy";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import image from "@rollup/plugin-image";
import * as path from "path";
import * as fs from "fs";

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
      this.addWatchFile(path.resolve("src", "index.html"));
      this.addWatchFile(path.resolve("src", "style.css"));
    },
  },
  copy({
    targets: [
      {
        src: path.resolve("src", "index.html"),
        dest: "dist",
      },
      {
        src: path.resolve("src", "style.css"),
        dest: "dist",
      },
    ],
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
    input: "src/index.mjs",
    output: {
      format: "es",
      file: "dist/index.js",
    },
    plugins: [
      nodeResolve(),
      json(),
      copy({
        targets: [
          {
            src: path.resolve("src", "seti-icons"),
            dest: "dist",
          },
        ],
      }),
    ],
  },
];
