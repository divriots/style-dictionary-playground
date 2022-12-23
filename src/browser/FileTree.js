import { LitElement, html } from "lit";
import * as zip from "@zip.js/zip.js";
import iconDefinitions from "./iconDefinitions.js";
import { ensureMonacoIsLoaded, editor } from "./monaco.js";
import runStyleDictionary from "../node/run-style-dictionary.js";
import {
  clearAll,
  switchToFile,
  saveCurrentFile,
  createFile,
  createFolder,
  removeFile,
  editFileName,
  getAllFiles,
} from "../node/file-tree-utils.js";
import styles from "./FileTreeStyles.css.js";

class FileTree extends LitElement {
  static get properties() {
    return {
      inputFiles: { attribute: false },
      outputFiles: { attribute: false },
    };
  }

  static get styles() {
    return [styles];
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
      const firstFilePath = this.inputFiles.filter(
        (file) => !file.endsWith("/")
      )[0];
      const firstFileRow = this.shadowRoot.querySelector(
        `[full-path='${firstFilePath}']`
      );
      firstFileRow.click();
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
            title="New File"
            @click=${() => this.editFileName()}
            class="codicon codicon-edit"
          ></button>
          <button
            title="Remove current file or folder"
            @click=${() => this.removeFileOrFolder()}
            class="codicon codicon-trash"
          ></button>
        </div>
        <div class="loading-cue">
          <div class="loading-cue-overlay"></div>
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
            title="Download all files as ZIP"
            @click=${this.downloadAsZIP}
            class="codicon codicon-cloud-download"
          ></button>
          <button
            title="Clear all files"
            @click=${clearAll}
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
      await ensureMonacoIsLoaded();
      editor.layout({});
      editor.layout();
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
      src="https://cdn.jsdelivr.net/npm/material-icon-theme@3.7.1/icons/${icon}.svg"
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
    runStyleDictionary();
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

    // ignore this one, as it's just the file edit "apply" action
    if (
      target.classList.contains("edit-file-input") ||
      (key !== undefined && key !== "F2" && key !== "Enter" && key !== " ")
    ) {
      return;
    }

    let row = target;
    if (!target.classList.contains(".row")) {
      row = target.closest(".row");
    }
    this.lastSelectedElement = row;
    if (this.lastSelectedElement.classList.contains("file")) {
      this.switchToFile(this.lastSelectedElement.getAttribute("full-path"));
    } else if (this.lastSelectedElement.classList.contains("folder-row")) {
      this.clickFolder(ev);
    }

    const toggleDetails = () => {
      const details = ev.target.closest("details");
      if (details && row.classList.contains("folder-row")) {
        details.hasAttribute("open")
          ? details.removeAttribute("open")
          : details.setAttribute("open", "");
      }
    };

    switch (key) {
      case "F2":
        this.editFileName();
        break;
      case " ":
        // prevent accidental scrolling
        ev.preventDefault();
        toggleDetails();
        break;
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
    input.classList.add("new-file-input");
    if (parentFolder.id === "file-list") {
      const outputFiles = parentFolder.querySelector(".output-files");
      outputFiles.insertAdjacentElement("beforebegin", input);
    } else {
      parentFolder.appendChild(input);
    }

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
      if (type === "file") {
        createFile(fullPathNormalized);
      } else if (type === "folder") {
        createFolder(fullPathNormalized);
      }
      await this.updateComplete;
      const curr = [...this.folderButtons, ...this.fileButtons].find((btn) => {
        return btn.getAttribute("full-path") === fullPath;
      });

      if (curr) {
        curr.click();
        curr.setAttribute("checked", true);
        this.focusInRoot = false;
      }
    } catch (e) {}
  }

  async editFileName() {
    const lastSelectedFilePath =
      this.lastSelectedElement.getAttribute("full-path");
    const lastSelectedFileName = this.lastSelectedElement.innerText;
    const spanChild = Array.from(this.lastSelectedElement.children).find(
      (child) => child.tagName === "SPAN"
    );
    const isFolder = spanChild.classList.contains("folder");

    if (spanChild) {
      const inputEl = document.createElement("input");
      inputEl.value = lastSelectedFileName;
      inputEl.classList.add("edit-file-input");
      inputEl.setAttribute("size", "10");
      inputEl.setAttribute("aria-label", "Change file name");

      const applyEdit = (ev) => {
        const { value } = ev.target;
        this._editFileName(lastSelectedFilePath, value, isFolder);
        const newSpanEl = document.createElement("span");
        newSpanEl.innerText = value;
        if (isFolder) {
          newSpanEl.classList.add("folder");
        }
        ev.target.insertAdjacentElement("beforebegin", newSpanEl);
        ev.target.isAboutToBeRemoved = true;
        ev.target.remove();
        this.lastSelectedElement.focus();
      };
      inputEl.addEventListener("blur", (ev) => {
        if (!ev.target.isAboutToBeRemoved) {
          applyEdit(ev);
        }
      });
      inputEl.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          applyEdit(ev);
        }
      });
      spanChild.replaceWith(inputEl);
      inputEl.focus();
    }
  }

  async _editFileName(filePath, newName, isFolder = false) {
    await editFileName(filePath, newName, isFolder);
  }

  async removeFileOrFolder() {
    const lastSelectedFile = this.lastSelectedElement.getAttribute("full-path");
    const openedDetails = Array.from(
      this.shadowRoot.querySelectorAll("details[open]")
    );
    await removeFile(
      `${lastSelectedFile}${
        this.lastSelectedElement.classList.contains("folder-row") ? "/" : ""
      }`
    );

    // Reopen the previously opened folders after render
    await this.updateComplete;
    openedDetails.forEach((el) => {
      el.setAttribute("open", "");
    });
  }

  async switchToFile(indexOrName) {
    await this.updateComplete;
    if (this.unsavedFileBtn) {
      saveCurrentFile();
    }
    const filename = this.switchToFileInTree(indexOrName);
    switchToFile(filename);
  }

  switchToFileInTree(indexOrName) {
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
        (btn) =>
          btn.getAttribute("full-path") === indexOrName.replace(/^\//, "")
      );
    }
    if (btn) {
      btn.setAttribute("checked", "");
      const parentFolder = btn.parentElement.firstElementChild;
      if (parentFolder && parentFolder.classList.contains("folder-row")) {
        parentFolder.setAttribute("checked", "");
      }
    }
    return filename;
  }

  animateCue() {
    const cueEl = this.shadowRoot?.querySelector(".loading-cue-overlay");
    if (cueEl) {
      cueEl.classList.remove("loading-cue-overlay--slide");
      // This triggers browser to stop batching changes because it has to evaluate something.
      // eslint-disable-next-line no-void
      void this.offsetWidth;
      // So that when we arrive here, the browser sees this adding as an actual 'change'
      // and this means the animation gets refired.
      cueEl.classList.add("loading-cue-overlay--slide");
    }
  }

  async downloadAsZIP() {
    const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));

    // Add all files to zip
    const allFiles = await getAllFiles();
    await Promise.all(
      Object.entries(allFiles).map(([key, value]) =>
        zipWriter.add(key, new zip.TextReader(value))
      )
    );

    // Close zip and make into URL
    const dataURI = await zipWriter.close();
    const url = URL.createObjectURL(dataURI);

    // Auto-download the ZIP through anchor
    const anchor = document.createElement("a");
    anchor.href = url;
    const today = new Date();
    anchor.download = `sd-export-${today.getFullYear()}-${today.getMonth()}-${(
      "0" + today.getDate()
    ).slice(-2)}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}
customElements.define("file-tree", FileTree);
