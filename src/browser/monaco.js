let loaderPending = false;
const loaderCallbacks = [];

export let monaco;
export let editor;

function onAmdLoaderLoad() {
  let currentCallback = loaderCallbacks.shift();
  while (currentCallback) {
    window.clearTimeout(currentCallback.timeout);
    currentCallback.resolve();
    currentCallback = loaderCallbacks.shift();
  }
}

function onAmdLoaderError(err) {
  let currentCallback = loaderCallbacks.shift();
  while (currentCallback) {
    window.clearTimeout(currentCallback.timeout);
    currentCallback.reject(err);
    currentCallback = loaderCallbacks.shift();
  }
}

export function ensureMonacoIsLoaded(
  // srcPath = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.29.1/dev' // <-- for debugging
  srcPath = "https://cdn.jsdelivr.net/npm/monaco-editor@0.29.1/min"
) {
  return new Promise((resolve, reject) => {
    if (monaco) {
      resolve();
      return;
    }
    const config = {
      paths: {
        vs: srcPath + "/vs",
        vs_dev: srcPath.replace(/\/min$/, "/dev") + "/vs",
      },
    };
    const loaderUrl = `${config.paths.vs}/loader.js`;

    const timeout = setTimeout(() => {
      reject(new Error("Couldn't load monaco editor after 60s"));
    }, 60000);

    loaderCallbacks.push({
      resolve: () => {
        if (loaderPending) {
          window.require.config(config);
          loaderPending = false;
        }

        // Cross domain workaround - https://github.com/Microsoft/monaco-editor/blob/master/docs/integrate-amd-cross.md
        window.MonacoEnvironment = {
          getWorkerUrl() {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                self.MonacoEnvironment = {
                  baseUrl: '${srcPath}'
                };
                importScripts('${srcPath}/vs/base/worker/workerMain.js');`)}`;
          },
        };

        window.require(["vs/editor/editor.main"], resolve);
      },
      timeout,
      reject,
    });

    if (!loaderPending) {
      if (window.require) {
        onAmdLoaderLoad();
      } else {
        const loaderScript = window.document.createElement("script");
        loaderScript.type = "text/javascript";
        loaderScript.src = loaderUrl;
        loaderScript.addEventListener("load", onAmdLoaderLoad);
        loaderScript.addEventListener("error", onAmdLoaderError);
        window.document.body.appendChild(loaderScript);
        loaderPending = true;
      }
    }
  });
}

ensureMonacoIsLoaded().then(() => {
  monaco = window.monaco;
  editor = monaco.editor.create(document.getElementById("monaco-container"), {
    theme: "vs-dark",
  });
  editor.getModel().updateOptions({ tabSize: 2 });
});
