import copy from "rollup-plugin-copy";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import * as path from "path";
import * as fs from "fs";

const filesToCopy = [
  path.resolve("src", "index.html"),
  path.resolve("src", "favicon.ico"),
  path.resolve("src", "style.css"),
  path.resolve("src", "assets"),
];

const EMPTY_MODULE_ID = "$empty$";
const EMPTY_MODULE = `export default {}`;

const BROWSERIFY_ALIASES = {
  assert: "assert",
  events: "events",
  fs: "memfs",
  module: EMPTY_MODULE_ID,
  path: "path-browserify",
  process: "process",
  util: "util",
};

const nodeResolve = resolve({
  preferBuiltins: false,
  mainFields: ["module", "jsnext:main", "browser"],
});

const plugins = [
  commonjs(),
  {
    name: "browserify",
    resolveId(source, importer) {
      if (source in BROWSERIFY_ALIASES) {
        if (BROWSERIFY_ALIASES[source] === EMPTY_MODULE_ID)
          return EMPTY_MODULE_ID;
        return nodeResolve.resolveId(BROWSERIFY_ALIASES[source], undefined);
      }
      if (source === EMPTY_MODULE_ID) return EMPTY_MODULE_ID;
    },
    load(id) {
      if (id === EMPTY_MODULE_ID) return EMPTY_MODULE;
    },
  },
  inject({
    process: "process",
  }),
  nodeResolve,
  json(),
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
  {
    name: "remove-glob-weirdness",
    renderChunk(code) {
      // No clue why `glob_1.Glob;` ends up in bundle... useless line of code that actually creates fatal error >:(
      return code.replace(/glob_1\.Glob;/g, "");
    },
  },
];

export default [
  {
    input: "src/node/index.js",
    output: {
      format: "es",
      inlineDynamicImports: true,
      file: "dist/index.js",
      globals: {
        lodash: "_",
      },
    },
    plugins,
  },
];
