import { LitElement, html, css } from "@lion/core";

export class SdpLogo extends LitElement {
  static get styles() {
    return css`
      :host a,
      :host a:link,
      :host a:visited,
      :host a:focus,
      :host a:hover,
      :host a:active {
        color: #2e2e46;
      }
      .logo-link {
        display: block;
        text-decoration: none;
        margin-bottom: 0;
      }

      .logo-link > div {
        display: flex;
        align-items: center;
      }

      .logo-link__img {
        width: 2rem;
        margin-right: 0.5rem;
        margin-top: 0.5rem;
      }

      .font-logo .big {
        font-size: 130%;
      }

      .font-logo .small {
        font-size: 70%;
      }

      .divriots-logo {
        display: inline-flex;
        align-items: flex-end;
        gap: 0.25rem;
        position: relative;
        left: 40px;
        top: -8px;
        fill: #2e2e46;
        text-decoration: none;
      }

      .divriots-logo img {
        height: 0.875rem;
        display: inline;
        margin-bottom: 1px;
      }
    `;
  }

  render() {
    return html`
      <a class="logo-link" href="/" aria-label="Back to homepage">
        <div>
          <img
            class="logo-link__img"
            src="./assets/play-logo.png"
            alt="style-dictionary logo"
          />
          <div class="font-logo">
            <span class="big">Style-Dictionary-Play</span
            ><span class="small">.dev</span>
          </div>
        </div>
      </a>
      <a
        class="divriots-logo"
        href="https://divriots.com"
        target="_blank"
        rel="noopener"
      >
        by
        <img alt="divriots logo" src="./assets/divriots-dark.svg" />
      </a>
    `;
  }
}
