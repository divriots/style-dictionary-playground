const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const path = require("path");

module.exports = {
  entry: "./src/browser/monaco.js",
  mode: "development",
  output: {
    path: path.resolve("dist"),
    filename: "monaco.js",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.ttf$/,
        use: ["file-loader"],
      },
    ],
  },
  plugins: [new MonacoWebpackPlugin()],
};
