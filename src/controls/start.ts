import { $$ } from "../$";
import { Problem } from "../problem";
import { ControlBtn } from "./controlbtn";

const Styles = {
  background: {
    enabled: "#46a546",
    disabled: "6b7280",
  },
  opacity: {
    enabled: "1",
    disabled: "0.7",
  },
  text: {
    default: "start ▶︎",
  },
};

export class StartBtn implements ControlBtn {
  public element;

  constructor(problem: Problem) {
    const background = problem.isSolved
      ? Styles.background.disabled
      : Styles.background.enabled;
    const opacity = problem.isSolved
      ? Styles.opacity.disabled
      : Styles.opacity.enabled;
    this.element = $$.BUTTON({
      content: problem.isSolved ? "✓ Solved" : Styles.text.default,
      css: `
            background-color: ${background} !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            padding: 5px 10px !important;
            font-weight: 600 !important;
            font-size: 14px;
            cursor: ${problem.isSolved ? "not-allowed" : "pointer"} !important;
            transition: all 0.2s ease !important;
            box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2) !important;
            margin-left: auto !important;
            opacity: ${opacity} !important;
          `,
      classList: ["rosalind-start-btn"],
    }).el;

    if (!problem.isSolved) {
      this.element.addEventListener("mouseenter", () => {
        this.element.style.backgroundColor = "#059669 !important";
        this.element.style.transform = "translateY(-1px)";
        this.element.style.boxShadow = "0 4px 8px rgba(16, 185, 129, 0.3)";
      });

      this.element.addEventListener("mouseleave", () => {
        this.element.style.backgroundColor = "#46a546 !important";
        this.element.style.transform = "translateY(0)";
        this.element.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.2)";
      });
    }

    this.element.disabled = problem.isSolved ?? false;
  }

  enable() {
    this.element.disabled = false;
    this.element.textContent = Styles.text.default;
    this.element.style.backgroundColor = Styles.background.enabled;
    this.element.style.opacity = Styles.opacity.enabled;
  }

  loading() {
    this.element.disabled = true;
    this.element.textContent = "Loading...";
    this.element.style.backgroundColor = Styles.background.disabled;
    this.element.style.opacity = Styles.opacity.disabled;
  }

  disable() {
    this.element.disabled = true;
    this.element.textContent = Styles.text.default;
    this.element.style.backgroundColor = Styles.background.disabled;
    this.element.style.opacity = Styles.opacity.disabled;
  }
}
