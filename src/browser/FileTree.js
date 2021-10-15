import { LitElement, css, html } from "lit";
import codicon from "./codicon.css.js";
import iconDefinitions from "./iconDefinitions.js";
class FileTree extends LitElement {
  static get properties() {
    return {
      inputFiles: { attribute: false },
      outputFiles: { attribute: false },
    };
  }

  static get styles() {
    return [
      codicon,
      css`
        :host {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          background-color: #171717;
          max-width: 400px;
          position: relative;
        }

        #file-list {
          color: white;
          overflow-y: auto;
        }

        .file,
        .folder {
          display: inline-block;
        }

        .folder {
          padding: 0.25em 0em;
        }

        .file {
          display: flex;
          position: relative;
          align-items: center;
          margin-left: 1em;
        }

        #file-list > details {
          margin-bottom: 0.5em;
        }

        details {
          padding-left: 1em;
        }

        summary {
          padding-left: 0.25em;
        }

        .row {
          cursor: pointer;

          padding-right: 1rem;
        }

        img {
          width: 18px;
          padding: 5px;
          display: block;
        }

        .file::after {
          content: "●";
          position: absolute;
          color: transparent;
          right: 0.375rem;
        }

        .row:hover {
          background-color: #292929;
        }

        .file[checked] {
          background-color: #f8c307;
          background-color: #524310;
        }

        .file[unsaved]::after {
          color: white;
        }

        .folder-row[checked] {
          background-color: #292929;
        }

        input {
          margin-left: 1.5em;
          width: calc(100% - 3em);
          margin-right: 2em;
        }

        .new {
          display: flex;
          justify-content: flex-end;
          position: sticky;
          top: 0;
          margin-bottom: 8px;
          background-color: #171717;
          border-top-left-radius: var(--border-radius-editor);
        }

        .new > .codicon,
        .clear > .codicon {
          padding: 0.5em;
          background-color: transparent;
          color: white;
          border: none;
          cursor: pointer;
        }

        .new > .codicon:hover,
        .clear > .codicon:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        .codicon-play {
          flex-grow: 1;
        }

        #file-list {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .output-files {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .output-files > p {
          padding-top: 0.5rem;
          margin: 1.5rem 0 0.5rem 0;
          text-align: center;
          border-top: 1px solid white;
        }

        .clear {
          width: 100%;
          position: sticky;
          bottom: 0;
          display: flex;
          justify-content: center;
        }

        .clear > .codicon {
          width: 100%;
          background-color: #171717;
          border-bottom-left-radius: var(--border-radius-editor);
        }

        .clear > .codicon:hover {
          background-color: rgb(23, 23, 23);
          filter: brightness(1.7);
        }
      `,
    ];
  }

  get folderButtons() {
    return Array.from(this.shadowRoot.querySelectorAll(".folder-row") || []);
  }

  /** Get all DOM nodes associated with files */
  get fileButtons() {
    return Array.from(this.shadowRoot.querySelectorAll(".file") || []);
  }

  /** Get DOM node of the file that is checked */
  get checkedFileBtn() {
    return this.fileButtons.find((btn) => btn.hasAttribute("checked"));
  }

  /* Get the full file path of the checked file */
  get checkedFile() {
    return this.checkedFileBtn?.getAttribute("full-path");
  }

  get checkedFolderEl() {
    return Array.from(this.shadowRoot.querySelectorAll(".folder-row")).find(
      (folder) => folder.hasAttribute("checked")
    );
  }

  get checkedFolder() {
    return this.checkedFolderEl?.getAttribute("full-path");
  }

  /* Get DOM node of the file that is unsaved, can only be one for now because we auto-save onFocusChange */
  get unsavedFileBtn() {
    return this.fileButtons.find((btn) => btn.hasAttribute("unsaved"));
  }

  /* Get the full file path of the unsaved file */
  get unsavedFile() {
    return this.unsavedFileBtn.getAttribute("full-path");
  }

  sortFiles(files) {
    return files.sort((a, b) => {
      const slashesA = a.split("/").length;
      const slashesB = b.split("/").length;
      if (slashesA < slashesB) {
        return 1;
      } else if (slashesB < slashesA) {
        return -1;
      }
      return a.localeCompare(b);
    });
  }

  /**
   * [
   *  'foo.js',
   *  'foo/bar/qux.json',
   *  'foo/qux/',
   * ]
   *      vvvvvv
   * {
   *   'foo.js': {},
   *   foo: {
   *     bar: {
   *       qux.json: 'file'
   *     },
   *     qux: {}
   *   }
   * }
   */
  filesAsTree(files) {
    const tree = {};
    for (const file of this.sortFiles(files)) {
      const parts = file.split("/");
      let depthTree = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (i === parts.length - 1) {
          if (parts[i] === "") {
            continue;
          } else {
            if (!depthTree[part]) {
              depthTree[part] = "";
            }
            depthTree = depthTree[part];
            continue;
          }
        }

        if (!depthTree[part]) {
          depthTree[part] = {};
        }
        depthTree = depthTree[part];
      }
    }
    return tree;
  }

  /** document.activeElement but incorporating shadow boundaries */
  getDeepActiveElement() {
    let host = document.activeElement || document.body;
    while (host && host.shadowRoot && host.shadowRoot.activeElement) {
      host = host.shadowRoot.activeElement;
    }
    return host;
  }

  constructor() {
    super();
    this.inputFiles = [];
    this.outputFiles = [];
    this.focusInRoot = true;
    this.lastSelectedElement;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", () => {
      if (!this.shadowRoot.contains(this.getDeepActiveElement())) {
        this.focusInRoot = true;
        this.uncheckFolders();
      } else {
        this.focusInRoot = false;
      }
    });
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (
      changedProperties.has("outputFiles") &&
      !this.checkedFileBtn &&
      this.outputFiles.length > 0
    ) {
      this.switchToFile(0).then(() => {
        this.openParentFolders();
      });
    }
  }

  render() {
    return html`
      <div id="file-list" @click=${this.editorLayout}>
        <div class="new">
          <button
            title="Run Style Dictionary"
            @click=${this.play}
            class="codicon codicon-play"
          ></button>
          <button
            title="New File"
            @click=${() => this.newFileOrFolder("file")}
            class="codicon codicon-new-file"
          ></button>
          <button
            title="New Folder"
            @click=${() => this.newFileOrFolder("folder")}
            class="codicon codicon-new-folder"
          ></button>
          <button
            title="Remove current file or folder"
            @click=${() => this.removeFileOrFolder()}
            class="codicon codicon-trash"
          ></button>
        </div>
        <div class="input-files">
          ${this.asDetails(this.filesAsTree(this.inputFiles))}
        </div>
        <div class="output-files">
          <p>Output files:</p>
          ${this.asDetails(this.filesAsTree(this.outputFiles))}
        </div>
        <div class="clear">
          <button
            title="Clear all files"
            @click=${this.clearAll}
            class="codicon codicon-clear-all"
          ></button>
        </div>
      </div>
    `;
  }

  editorLayout() {
    // Need to wait for monaco to catch up to the fact that container size changed (potentially)
    // TODO: check if there's a lifecycle hook that we can use instead..
    setTimeout(async () => {
      await window.ensureMonacoIsLoaded();
      window.monaco_editor.layout({});
      window.monaco_editor.layout();
    }, 10);
  }

  getLogoFromFileName(filename) {
    const spl = filename.split(".");
    const ext = spl[spl.length - 1];
    const icon =
      iconDefinitions.icons.find((def) => def.fileExtensions?.includes(ext))
        ?.name || iconDefinitions.defaultIcon.name;
    return html`<img
      alt="file icon"
      src="https://unpkg.com/material-icon-theme@3.7.1/icons/${icon}.svg"
    />`;
  }

  asDetails(tree, memo = "") {
    return html`
      ${Object.entries(tree).map(([k, v]) => {
        return v === ""
          ? html`
              <div
                tabindex="0"
                class="row file"
                full-path="${memo}${k}"
                @keydown=${this.rowClick}
                @click=${this.rowClick}
              >
                ${this.getLogoFromFileName(k)}
                <span> ${k} </span>
              </div>
            `
          : html`
              <details>
                <summary
                  @keydown=${this.rowClick}
                  @click=${this.rowClick}
                  class="row folder-row"
                  full-path="${memo}${k}"
                >
                  <span class="folder">${k}</span>
                </summary>
                ${this.asDetails(v, `${memo}${k}/`)}
              </details>
            `;
      })}
    `;
  }

  play() {
    this.dispatchEvent(new Event("run-style-dictionary"));
  }

  clearAll() {
    this.dispatchEvent(new Event("clear-all"));
  }

  uncheckFolders() {
    const allFolders = Array.from(
      this.shadowRoot.querySelectorAll(".folder-row")
    );
    allFolders.forEach((folder) => {
      folder.removeAttribute("checked");
    });
  }

  openParentFolders() {
    // open parent folders
    if (this.checkedFile) {
      const parts = this.checkedFile.split("/");
      let path = "";
      parts.forEach((part) => {
        path += part;
        const el = this.shadowRoot.querySelector(`[full-path="${path}"]`);
        if (el) {
          el.click();
        }
        path += "/";
      }, "");
    }
  }

  rowClick(ev) {
    let { target, key } = ev;

    if (key && key !== "Space" && key !== "Enter") {
      return;
    }

    // get the "actual" target if the event originally came from the inner span
    if (!target.classList.contains(".row")) {
      target = target.closest(".row");
    }
    this.lastSelectedElement = target;
    if (target.classList.contains("file")) {
      this.switchToFile(target.getAttribute("full-path"));
    } else if (target.classList.contains("folder-row")) {
      this.clickFolder(ev);
    }
  }

  clickFolder(ev) {
    let { target } = ev;
    target = target.classList.contains("folder")
      ? target.parentElement
      : target;

    this.uncheckFolders();
    target.setAttribute("checked", "");
  }

  newFileOrFolder(type) {
    const parentFolder = this.focusInRoot
      ? this.shadowRoot.getElementById("file-list")
      : this.checkedFolderEl?.parentElement;

    const currentFolderText = this.focusInRoot
      ? ""
      : this.checkedFolderEl.getAttribute("full-path") || "";

    const input = document.createElement("input");
    parentFolder.appendChild(input);
    input.closest("details")?.setAttribute("open", "");
    input.addEventListener("blur", (ev) => {
      if (ev.target.isConnected) {
        this.addFileOrFolder(
          ev.target.value,
          currentFolderText,
          ev.target,
          type
        );
      }
    });
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        this.addFileOrFolder(
          ev.target.value,
          currentFolderText,
          ev.target,
          type
        );
      }
    });
    input.focus();
  }

  async addFileOrFolder(filename, folder, input, type) {
    try {
      input.remove();
      if (filename === "") {
        return;
      }
      const fullPath = `${folder ? `${folder}/` : ""}${filename}`;
      const fullPathNormalized = `${fullPath}${type === "folder" ? "/" : ""}`;
      this.inputFiles = [...this.inputFiles, fullPathNormalized];
      this.dispatchEvent(
        new CustomEvent(`create-${type}`, { detail: fullPathNormalized })
      );
      await this.updateComplete;
      const curr = [...this.folderButtons, ...this.fileButtons].find((btn) => {
        return btn.getAttribute("full-path") === fullPath;
      });
      if (curr) {
        curr.click();
      }
    } catch (e) {}
  }

  async removeFileOrFolder() {
    const lastSelectedFile = this.lastSelectedElement.getAttribute("full-path");
    this.dispatchEvent(
      new CustomEvent("remove-file", {
        detail: `${lastSelectedFile}${
          this.lastSelectedElement.classList.contains("folder-row") ? "/" : ""
        }`,
      })
    );
  }

  // TODO: clean this up, bit messy..
  async switchToFile(indexOrName) {
    await this.updateComplete;
    if (this.unsavedFileBtn) {
      this.dispatchEvent(
        new CustomEvent("save-current-file", { detail: this.unsavedFile })
      );
    }
    if (this.checkedFileBtn) {
      this.checkedFileBtn.removeAttribute("checked");
      this.uncheckFolders();
    }

    let filename;
    let btn;
    if (typeof indexOrName === "number" && this.fileButtons[indexOrName]) {
      filename = this.fileButtons[indexOrName].getAttribute("full-path");
      btn = this.fileButtons[indexOrName];
    } else if (typeof indexOrName === "string") {
      filename = indexOrName;
      btn = this.fileButtons.find(
        (btn) => btn.getAttribute("full-path") === indexOrName
      );
    }
    if (btn) {
      btn.setAttribute("checked", "");
      const parentFolder = btn.parentElement.firstElementChild;
      if (parentFolder && parentFolder.classList.contains("folder-row")) {
        parentFolder.setAttribute("checked", "");
      }
    }
    this.dispatchEvent(
      new CustomEvent("switch-file", {
        detail: filename,
      })
    );
  }
}
customElements.define("file-tree", FileTree);
