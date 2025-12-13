import type {
  EditorElements,
  Language,
  OutputType,
  PyodideInterface,
  StatusState,
  WindowWithExtensions,
} from "./types";
import CSS_STYLES from "./styles.css";
import { $ } from "./$";
import DESC_SVG from "./desc-icon.svg";
import SOLUTIONS_SVG from "./lab-icon.svg";
import { DB } from "./db";
import { Editor } from "./editor";

// GLOBALS
let pyodide: PyodideInterface | null = null;
let editorView: any = null;
let currentLanguage: Language = "python";
let editorContainer: HTMLElement | null = null;
let onRunCodeCallback: (() => void) | null = null;
const Body = $();

/**
 * Excluded page sub-paths that shouldn't show the REPL view.
 */
const EXCLUDED_PAGE_PREFIXES = [
  "list-view",
  "topics",
  "tree-view",
  "locations",
];

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = CSS_STYLES;
  document.head.appendChild(style);
}

// ============================================================================
// Pyodide/Python REPL
// ============================================================================

async function initializePyodide(elements: EditorElements): Promise<void> {
  try {
    updateStatus(elements.status, "loading", "Initializing...");
    const win = window as WindowWithExtensions;

    if (!win.loadPyodide) {
      throw new Error("Pyodide loader not found");
    }

    pyodide = await win.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
    });

    if (!pyodide) {
      throw new Error("Failed to initialize Pyodide");
    }

    pyodide.runPython(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
    `);

    updateStatus(elements.status, "ready", "Ready");
    elements.runBtn.disabled = false;
    addOutput(elements.output, "✓ Python REPL ready.", "success");
  } catch (error) {
    updateStatus(elements.status, "error", "Error");
    addOutput(
      elements.output,
      `Failed to load Python: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      "error"
    );
  }
}

async function runPythonCode(
  code: string,
  elements: EditorElements
): Promise<void> {
  if (!pyodide) {
    addOutput(
      elements.output,
      "Python not loaded yet. Please wait...",
      "error"
    );
    return;
  }

  try {
    elements.runBtn.disabled = true;
    elements.runBtn.textContent = "Running...";

    pyodide.runPython(`
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
    `);

    const result = await pyodide.runPythonAsync(code);
    const stdout = pyodide.runPython("sys.stdout.getvalue()");
    const stderr = pyodide.runPython("sys.stderr.getvalue()");

    addOutput(elements.output, ">>> Running code...", "success");

    if (stdout) {
      addOutput(elements.output, stdout);
    }

    if (stderr) {
      addOutput(elements.output, stderr, "error");
    }

    if (result !== undefined && result !== null) {
      addOutput(elements.output, `Result: ${result}`);
    }

    addOutput(elements.output, ">>> Done.", "success");
  } catch (error) {
    addOutput(
      elements.output,
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "error"
    );
  } finally {
    elements.runBtn.disabled = false;
    elements.runBtn.textContent = "Run Code";
  }
}

async function runJavaScriptCode(
  code: string,
  elements: EditorElements
): Promise<void> {
  try {
    elements.runBtn.disabled = true;
    elements.runBtn.textContent = "Running...";

    // Capture console output
    const logs: string[] = [];
    const errors: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      logs.push(
        args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
          )
          .join(" ")
      );
    };

    console.error = (...args: any[]) => {
      errors.push(args.map((arg) => String(arg)).join(" "));
    };

    console.warn = (...args: any[]) => {
      logs.push("[Warning] " + args.map((arg) => String(arg)).join(" "));
    };

    addOutput(elements.output, ">>> Running code...", "success");

    try {
      // Use AsyncFunction to support await
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      // Make dataset available in function scope
      const dataset = (window as any).dataset;
      const fn = new AsyncFunction("dataset", code);
      const result = await fn(dataset);

      // Display console output
      if (logs.length > 0) {
        addOutput(elements.output, logs.join("\n"));
      }

      if (errors.length > 0) {
        addOutput(elements.output, errors.join("\n"), "error");
      }

      // Display return value if not undefined
      if (result !== undefined) {
        addOutput(
          elements.output,
          `Result: ${
            typeof result === "object"
              ? JSON.stringify(result, null, 2)
              : result
          }`
        );
      }

      addOutput(elements.output, ">>> Done.", "success");
    } catch (error) {
      addOutput(
        elements.output,
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    } finally {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  } finally {
    elements.runBtn.disabled = false;
    elements.runBtn.textContent = "Run Code";
  }
}

// ============================================================================
// Layout & UI
// ============================================================================

function createSplitLayout(): EditorElements {
  const rosalindFooter = Body.byQuery(".footer", true);

  const splitContainer = $.DIV({ id: "rosalind-split-container" });
  const problemSide = $.DIV({ id: "rosalind-problem-side" });
  const problemHeader = $.DIV({ id: "rosalind-problem-header" });

  buildSplitPaneHeader(problemHeader);

  const mainContent = $.DIV({
    id: "rosalind-main-content",
    content: Body.content,
  });

  const problemFooter = $.DIV({ id: "rosalind-problem-footer" });
  problemFooter.appendChild(rosalindFooter);

  problemSide.appendChild(problemHeader);
  problemSide.appendChild(mainContent);
  problemSide.appendChild(problemFooter);

  const replPanel = $.DIV({
    id: "rosalind-repl-panel",
    content: `
    <div id="rosalind-repl-header">
      <div id="rosalind-repl-header-left">
        <h3>REPL</h3>
        <select id="rosalind-language-selector">
          <option value="python">Python ▼</option>
          <option value="javascript">JavaScript ▼</option>
        </select>
      </div>
      <span id="rosalind-repl-status" class="loading">
        <span id="rosalind-repl-status-dot"></span>
        <span id="rosalind-repl-status-text">Loading...</span>
      </span>
    </div>
    <div id="rosalind-repl-editor">
      <div id="rosalind-code-input"></div>
    </div>
    <div id="rosalind-repl-controls">
      <button id="rosalind-run-btn" disabled>Run Code</button>
      <button id="rosalind-clear-btn">Clear Output</button>
      <button id="rosalind-submit-btn">Submit Output</button>
    </div>
    <div id="rosalind-repl-output"></div>
  `,
  });

  splitContainer.appendChild(problemSide);
  splitContainer.appendChild(replPanel);

  Body.DANGEROUSLY_set_content(splitContainer);

  const resizer = $.DIV({ id: "rosalind-resizer" });
  document.body.appendChild(resizer);

  const updateResizerPosition = () => {
    const panelWidth = replPanel.offsetWidth;
    const paddingWidth = 10 + 5;
    resizer.style.left = `${window.innerWidth - panelWidth - paddingWidth}px`;
  };

  updateResizerPosition();

  return {
    runBtn: $.byId<HTMLButtonElement>("rosalind-run-btn"),
    clearBtn: $.byId<HTMLButtonElement>("rosalind-clear-btn"),
    submitBtn: $.byId<HTMLButtonElement>("rosalind-submit-btn"),
    languageSelector: $.byId<HTMLSelectElement>("rosalind-language-selector"),
    codeInput: $.byId<HTMLElement>("rosalind-code-input"),
    output: $.byId<HTMLElement>("rosalind-repl-output"),
    status: $.byId<HTMLElement>("rosalind-repl-status"),
    resizer,
    replPanel,
    updateResizerPosition,
  };
}

function setupResizer(
  resizer: HTMLElement,
  replPanel: HTMLElement,
  updateResizerPosition: () => void
): void {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const startResize = (e: MouseEvent) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = replPanel.offsetWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const doResize = (e: MouseEvent) => {
    if (!isResizing) return;

    const diff = startX - e.clientX;
    const newWidth = startWidth + diff;
    const minWidth = 300;
    const maxWidth = window.innerWidth * 0.8;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      replPanel.style.width = `${newWidth}px`;
      updateResizerPosition();
    }

    e.preventDefault();
  };

  const stopResize = () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  };

  resizer.addEventListener("mousedown", startResize);
  document.addEventListener("mousemove", doResize);
  document.addEventListener("mouseup", stopResize);
  document.addEventListener("mouseleave", stopResize);
  window.addEventListener("resize", updateResizerPosition);
}

function buildSplitPaneHeader(el: HTMLDivElement) {
  const desc = $.DIV({
    content: `${DESC_SVG} <div>Description</div>`,
    style: {
      fontWeight: "500",
      width: "90px",
      display: "flex",
      height: "fit-content",
      gap: "3px",
    },
  });
  const solutions = $.A({
    href: "/problems/subs/recent/",
    content: `${SOLUTIONS_SVG} <div>Solutions</div>`,
    style: {
      width: "75px",
      display: "flex",
      height: "fit-content",
      gap: "3px",
    },
  });

  const next = $.byQuery("li.next > a");
  const prev = $.byQuery("li.previous > a");

  const left = $.DIV({
    classList: ["problem-header-div"],
  });
  const right = $.DIV({
    classList: ["problem-header-div"],
  });

  left.appendChild(desc);
  left.appendChild(solutions);

  right.appendChild(prev);
  right.appendChild(next);

  el.appendChild(left);
  el.appendChild(right);
}

// ============================================================================
// Dataset Loading
// ============================================================================

function setupStartButton(elements: EditorElements): void {
  setTimeout(() => {
    const downloadLink = $.byQuery<HTMLAnchorElement>(
      "a#id_problem_dataset_link"
    );
    if (!downloadLink) return;

    // Hide download link once found
    downloadLink.style.display = "none";

    const datasetUrl = downloadLink.href;

    const secondTitleLine = $.byQuery(".problem-properties");
    const startButton = $.BUTTON({
      content: "start ▶︎",
      css: `
        background-color: #46a546 !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 5px 10px !important;
        font-weight: 600 !important;
        font-size: 14px;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2) !important;
        margin-left: auto !important;
      `,
      classList: ["rosalind-start-btn"],
    });
    secondTitleLine.appendChild(startButton);

    startButton.addEventListener("mouseenter", () => {
      startButton.style.backgroundColor = "#059669 !important";
      startButton.style.transform = "translateY(-1px)";
      startButton.style.boxShadow = "0 4px 8px rgba(16, 185, 129, 0.3)";
    });

    startButton.addEventListener("mouseleave", () => {
      startButton.style.backgroundColor = "#46a546 !important";
      startButton.style.transform = "translateY(0)";
      startButton.style.boxShadow = "0 2px 4px rgba(16, 185, 129, 0.2)";
    });

    startButton.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        startButton.disabled = true;
        startButton.textContent = "Loading...";
        startButton.style.backgroundColor = "#6b7280";

        const response = await fetch(datasetUrl);
        const datasetText = await response.text();

        // Inject dataset into execution environment
        if (currentLanguage === "python") {
          // Inject into Python globals
          if (pyodide) {
            pyodide.globals.set("dataset", datasetText);
          }
        } else {
          // Inject into JavaScript global scope
          (window as any).dataset = datasetText;
        }

        const code = Editor.getSkeleton(datasetText);

        setEditorContent(code);
        addOutput(
          elements.output,
          "✓ Dataset loaded! Ready to analyze.",
          "success"
        );

        startButton.textContent = "Reload Dataset";
        startButton.style.backgroundColor = "#10b981";
        startButton.disabled = false;
      } catch (error) {
        addOutput(
          elements.output,
          `Error loading dataset: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "error"
        );
        startButton.textContent = "Start in REPL";
        startButton.style.backgroundColor = "#10b981";
        startButton.disabled = false;
      }
    });
  }, 1000);
}

// ============================================================================
// __main__
// ============================================================================

(async function main() {
  "use strict";

  const isExcludedPage = EXCLUDED_PAGE_PREFIXES.some((prefix) =>
    window.location.pathname.includes(`problems/${prefix}`)
  );
  if (isExcludedPage) {
    console.log("Rosalind LeetCode Style loaded (excluded page - no REPL)");
    return;
  }

  injectStyles();

  // Step 1: Create the split layout right away
  const elements = createSplitLayout();
  setupResizer(
    elements.resizer,
    elements.replPanel,
    elements.updateResizerPosition
  );

  try {
    // Load language preference before initializing editor
    currentLanguage = DB.get(DB.KEYS.LANGUAGE_PREFERENCE, "python");
    elements.languageSelector.value = currentLanguage;

    await Editor.init();

    const runCode = () => {
      const code = getEditorContent();
      if (currentLanguage === "python") {
        runPythonCode(code, elements);
      } else {
        runJavaScriptCode(code, elements);
      }
    };

    initializeCodeMirror(elements.codeInput, runCode);

    // Language selector handler
    elements.languageSelector.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      const language = target.value as Language;
      switchLanguage(language);
    });

    elements.runBtn.addEventListener("click", runCode);
    elements.clearBtn.addEventListener("click", () => {
      elements.output.innerHTML = "";
    });

    elements.submitBtn.addEventListener("click", () => {
      try {
        const output = getLastOutput(elements.output);
        if (!output) {
          addOutput(
            elements.output,
            "No output to submit. Run your code first.",
            "error"
          );
          return;
        }
        submitOutputToForm(output);
        addOutput(
          elements.output,
          "✓ Output submitted successfully!",
          "success"
        );
      } catch (error) {
        addOutput(
          elements.output,
          `Failed to submit: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "error"
        );
      }
    });

    await initializePyodide(elements);
    setupStartButton(elements);

    if ((window as any).MathJax) {
      console.log("MathJax found");
      setTimeout(() => {
        (window as any).MathJax.Hub.Rerender();
      }, 1000);
    } else {
      console.log("MathJax not found");
    }
  } catch (error) {
    console.error("Failed to initialize editor:", error);
    addOutput(
      elements.output,
      `Failed to initialize editor: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      "error"
    );
  }

  console.log("Rosalind LeetCode Style with Python REPL loaded!");
})();
