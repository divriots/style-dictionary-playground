import { LitElement, css, html } from "lit";

class FileTree extends LitElement {
  static get properties() {
    return {
      files: { attribute: false },
    };
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        background-color: #171717;
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
    `;
  }

  constructor() {
    super();
    this.files = [];
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

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has("files") && !this.checkedFileBtn) {
      this.switchToFile(0);
    }
  }

  render() {
    return html`
      <ul id="file-list">
        ${this.files.map(
          (file, index) => html`
            <li>
              <button @click=${() => this.switchToFile(index)}>${file}</button>
            </li>
          `
        )}
      </ul>
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
}
customElements.define("file-tree", FileTree);
