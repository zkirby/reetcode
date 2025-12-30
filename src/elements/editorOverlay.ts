import { $$ } from "../$";

export class EditorOverlay {
  private element;

  constructor(private readonly container: HTMLElement) {
    this.element = $$.DIV({
      id: "rosalind-editor-loading-overlay",
      css: `
          position: absolute;
          inset: 0;
          z-index: 1000;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(2px);
          display: none;
          align-items: center;
          justify-content: center;
          color: #1a1a1a;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        `,
    });

    const card = $$.DIV({
      css: `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 18px 20px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        `,
    });

    const spinner = $$.DIV({
      css: `
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 3px solid rgba(0, 0, 0, 0.1);
          border-top-color: #0e639c;
          animation: rosalindEditorSpin 0.8s linear infinite;
        `,
    });

    const title = $$.DIV({
      content: "Loading language runtime...",
      css: `
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
        `,
    });

    card.append(spinner);
    card.append(title);
    this.element.append(card);

    // Add animation if not already present
    if (!$$.byId("rosalind-editor-spinner-style")) {
      const style = document.createElement("style");
      style.id = "rosalind-editor-spinner-style";
      style.textContent = `
          @keyframes rosalindEditorSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
      document.head.appendChild(style);
    }

    if (this.container) {
      this.container.style.position = "relative";
      this.container.appendChild(this.element.el);
    }
  }

  show() {
    this.element.el.style.display = "flex";
  }

  hide() {
    this.element.el.style.display = "none";
  }
}
