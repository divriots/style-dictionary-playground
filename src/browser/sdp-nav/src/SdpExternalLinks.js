import { LitElement, html, css } from "@lion/core";

export class SdpExternalLinks extends LitElement {
  static get properties() {
    return {
      drawer: {
        type: Boolean,
        reflect: true,
      },
    };
  }

  static get styles() {
    return css`
      :host {
        display: flex;
        align-items: center;
        gap: 2rem;
      }

      .link {
        display: none;
      }

      .how {
        color: #11aea7;
      }

      .hamburger {
        display: block;
      }

      .github img,
      .discord img {
        display: block;
      }

      .github img {
        height: 30px;
      }

      .discord img {
        height: 25px;
      }

      @media (min-width: 601px) {
        :host {
          display: flex;
        }

        .hamburger {
          display: none;
        }

        .link {
          display: block;
        }
      }

      :host([drawer]) {
        display: flex;
        padding: 20px;
        flex-direction: column;
        background-color: rgb(217, 248, 245);
      }

      :host([drawer]) .link {
        display: block;
      }

      :host([drawer]) .hamburger {
        display: none;
      }

      .codicon[class*="codicon-"] {
        font: normal normal normal 26px/1 codicon;
        background-color: transparent;
        border: none;
        cursor: pointer;
      }

      .codicon-menu:before {
        content: "\\eb94";
      }
    `;
  }

  render() {
    return html`
      ${this.drawer ? html` <sdp-logo></sdp-logo> ` : ""}
      <a
        class="link how"
        href="https://backlight.dev/blog/nodejs-in-browser"
        target="_blank"
        rel="noopener"
        >How it works</a
      >
      <a
        class="link discord"
        aria-label="discord"
        href="https://discord.gg/XkQxSU9"
        rel="noopener"
        target="_blank"
        ><img alt="discord" src="./assets/discord-dark.svg"
      /></a>
      <a
        class="link github"
        aria-label="github"
        href="https://github.com/divriots/style-dictionary-playground"
        rel="noopener"
        target="_blank"
        ><img alt="github" src="./assets/github.svg"
      /></a>
      <button
        class="hamburger codicon codicon-menu"
        @click=${() => this.dispatchEvent(new Event("hamburger-clicked"))}
      ></button>
    `;
  }
}
