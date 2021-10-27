import { LitElement, html, css } from "@lion/core";
import "../sdp-drawer.js";
import "../sdp-external-links.js";
import "../sdp-logo.js";

export class SdpNav extends LitElement {
  static get styles() {
    return css`
      .nav-items {
        width: 100%;
        display: flex;
        justify-content: space-between;
      }
    `;
  }

  get hamburgerEl() {
    return this.shadowRoot.querySelector(".hamburger");
  }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "navigation");
    this.setAttribute("aria-label", "Main navigation");
  }

  render() {
    return html`
      <nav class="nav-items">
        <sdp-logo></sdp-logo>
        <div class="logo-link-container"></div>
        <sdp-drawer id="drawer">
          <sdp-external-links drawer slot="content"></sdp-external-links>
        </sdp-drawer>
        <sdp-external-links
          @hamburger-clicked=${this.hamburgerToggle}
        ></sdp-external-links>
      </nav>
    `;
  }

  hamburgerToggle() {
    this.shadowRoot.getElementById("drawer").toggle();
  }
}
