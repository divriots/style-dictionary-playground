import { LitElement, css, html, render } from "lit";
import { ObjectTree } from "monaco-editor/esm/vs/base/browser/ui/tree/objectTree";

class FileTree extends LitElement {
  static get properties() {
    return {
      files: { attribute: false },
    };
  }

  static get styles() {
    return css`
      :host {
        flex-direction: column;
        align-items: stretch;
        background-color: #171717;
        min-width: 200px;
        min-height: 600px;
        display: block;
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      button {
        width: 100%;
        position: relative;
        text-align: start;
        padding: 0.75rem;
        color: white;
        background-color: #171717;
        border: none;
        padding-right: 1.25rem;
      }

      button::after {
        content: "●";
        position: absolute;
        color: transparent;
        right: 0.375rem;
      }

      button:hover {
        background-color: #292929;
      }

      button[checked] {
        background-color: #f8c307;
        color: #171717;
      }

      button[unsaved]::after {
        color: white;
      }

      button[checked][unsaved]::after {
        color: #171717;
      }

      /** monaco file tree */

      .entry {
        color: white;
      }
    `;
  }

  get fileButtons() {
    return Array.from(this.shadowRoot.querySelectorAll("button") || []);
  }

  get checkedFileBtn() {
    return this.fileButtons.find((btn) => btn.hasAttribute("checked"));
  }

  get unsavedFileBtn() {
    return this.fileButtons.find((btn) => btn.hasAttribute("unsaved"));
  }

  getTemplateId() {
    return this.templateId;
  }

  getHeight() {
    return 28; // rowHeight
  }

  constructor() {
    super();
    this.files = [];
    this.templateId = "default";
  }

  connectedCallback() {
    super.connectedCallback();
    this.treeView = new ObjectTree(
      "",
      this.shadowRoot,
      this,
      [this],
      this.options
    );
    this.resizeObserver = new ResizeObserver(() => {
      this.treeView.layout();
    });
    this.resizeObserver.observe(this.shadowRoot.firstElementChild); // Watch dimension changes on body
    this.treeView.selection.onDidChange(this.onSelectionChange);
    this.treeView.setChildren(null, [
      { element: "foobar.js", selected: false, dirty: false },
      { element: "barfoo.js", selected: true, dirty: true },
    ]);
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has("files") && !this.checkedFileBtn) {
      this.switchToFile(0);
    }
  }

  render() {
    return html`
      <!-- <ul id="file-list">
        ${this.files.map(
        (file, index) => html`
          <li>
            <button @click=${() => this.switchToFile(index)}>${file}</button>
          </li>
        `
      )}
      </ul> -->
    `;
  }

  async switchToFile(indexOrName) {
    await this.updateComplete;
    if (this.unsavedFileBtn) {
      this.dispatchEvent(new Event("save-current-file"));
    }
    if (this.checkedFileBtn) {
      this.checkedFileBtn.removeAttribute("checked");
    }

    if (typeof indexOrName === "number" && this.fileButtons[indexOrName]) {
      this.fileButtons[indexOrName].setAttribute("checked", "");
      this.dispatchEvent(
        new CustomEvent("switch-file", {
          detail: this.fileButtons[indexOrName].innerText,
        })
      );
    }
  }

  renderTemplate(container) {
    container.classList.add("row");
    return container;
  }

  renderElement(node, _, templateData) {
    console.log(node, _, templateData);
    // node.selected
    //   ? templateData.parentElement?.classList.add('selected')
    //   : templateData.parentElement?.classList.remove('selected');

    // if (!this.readonly) {
    //   node.dirty
    //     ? templateData.parentElement?.classList.add('dirty')
    //     : templateData.parentElement?.classList.remove('dirty');
    // }

    render(
      !node.element.endsWith("/") ? this.fileRow(node) : this.folderRow(node),
      templateData
    );
    const elt = templateData.querySelector("#new-file-form input");
    if (elt) elt.focus();
  }

  fileRow(node) {
    const { element: file } = node;
    if (!this.readonly && !file) return this.editableFileRow(node);

    const basename = file.split("/");
    return html`<span style="flex-grow:1" class="row entry file nav"
      >${basename[basename.length - 1]}</span
    >`;
  }

  onSelectionChange(event) {
    // only support single selection - not multiple for now

    if (!event.elements || event.elements.length == 0) return;

    const selectedFile = event.elements[0];

    if (!selectedFile) return;

    if (selectedFile.endsWith("/")) {
      const node = this.treeView.model.getNode(selectedFile);
      // Don't navigate if there are children
      if (node.children?.length) return;
      // Navigate on empty folders to have the placeholder
    }

    // this.dispatchEvent(new CustomEvent("change", { detail: selectedFile }));
  }
}
customElements.define("file-tree", FileTree);
