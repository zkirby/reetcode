import { $, $$ } from "./$";
import { DB } from "./db";
import { Runner } from "./executors/runner";
import {
  EditorElements,
  Language,
  OutputType,
  PyodideInterface,
  StatusState,
  WindowWithExtensions,
} from "./types";

const TextToState: Record<StatusState, string> = {
  loading: "Loading",
  ready: "Ready",
  error: "Error",
};

/**
 * Generic editor class abstraction over CodeMirror and Pyodide
 *
 * TODO: clean this up to split out the javascript and python runners
 * into standalone abstractions so others can be added in the future.
 */
export class Editor {
  private view: any;
  private runner: Runner | null = null;

  constructor(private elements: EditorElements) {}

  async init(): Promise<void> {
    // Setup CodeMirror
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.textContent = `
          import { EditorView, basicSetup } from 'https://esm.sh/codemirror@6.0.1';
          import { python } from 'https://esm.sh/@codemirror/lang-python@6.1.3';
          import { javascript } from 'https://esm.sh/@codemirror/lang-javascript@6.2.1';
          import { indentUnit } from 'https://esm.sh/@codemirror/language@6.9.0';
          import { keymap } from 'https://esm.sh/@codemirror/view@6.21.0';
          import { indentWithTab } from 'https://esm.sh/@codemirror/commands@6.3.0';
    
          window.CodeMirrorSetup = { EditorView, basicSetup, python, javascript,  indentUnit, keymap, indentWithTab };
          window.dispatchEvent(new Event('codemirror-loaded'));
        `;

      window.addEventListener("codemirror-loaded", () => resolve(null), {
        once: true,
      });
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  get content(): string {
    if (!this.view) throw new Error("Editor not initialized");
    return this.view.state.doc.toString();
  }

  set content(text: string) {
    if (!this.view) throw new Error("Editor not initialized");
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: text,
      },
    });
  }

  get language(): Language {
    return DB.get(DB.KEYS.LANGUAGE_PREFERENCE, "python");
  }

  set language(language: Language) {
    // Save current content
    const currentContent = this.content;

    // Destroy old editor
    this.view.destroy();

    // Update language
    DB.save(DB.KEYS.LANGUAGE_PREFERENCE, language);

    // Transfer dataset to new language environment if it exists
    if (language === "python") {
      const jsDataset = (window as any).dataset;
      if (jsDataset && this.pyodide) {
        this.pyodide.globals.set("dataset", jsDataset);
      }
    } else {
      // JavaScript - dataset should already be in window scope
      // No action needed
    }

    const shouldPreserveContent =
      !currentContent.includes("Click 'Start in REPL'") &&
      currentContent.trim() !== "";
    const newDoc = shouldPreserveContent ? currentContent : undefined;

    this.createEditor(newDoc);
  }

  createEditor(initialDoc?: string) {
    const win = window as WindowWithExtensions;
    if (!win.CodeMirrorSetup) {
      throw new Error("CodeMirror not loaded");
    }

    const {
      EditorView,
      basicSetup,
      python,
      javascript,
      indentUnit,
      keymap,
      indentWithTab,
    } = win.CodeMirrorSetup;

    const languageExtension =
      this.language === "python" ? python() : javascript();
    const defaultDocs = {
      python: "# Click 'Start in REPL' to start the challenge...\n",
      javascript: "// Click 'Start in REPL' to start the challenge...\n",
    };

    const runCodeKeymap = keymap.of([
      indentWithTab,
      {
        key: "Ctrl-Enter",
        mac: "Cmd-Enter",
        run: () => {
          return true;
        },
      },
    ]);

    // Load saved code if available, otherwise use provided initialDoc or default
    const savedCode = DB.get(DB.KEYS.CODE, "");
    const docToUse = initialDoc || savedCode || defaultDocs[this.language];

    // Create update listener to save code on changes
    const saveOnUpdate = EditorView.updateListener.of((update: any) => {
      if (update.docChanged) {
        const code = update.state.doc.toString();
        DB.save(DB.KEYS.CODE, code);
      }
    });

    this.view = new EditorView({
      doc: docToUse,
      extensions: [
        basicSetup,
        languageExtension,
        indentUnit.of("    "),
        runCodeKeymap,
        saveOnUpdate,
        EditorView.theme({
          "&": {
            height: "100%",
            backgroundColor: "#1e1e1e",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
        }),
      ],
      parent: this.elements.codeInput,
    });
  }

  /** Return the skeleton starter code */
  getSkeleton(dataset: string): string {
    const language = DB.get(DB.KEYS.LANGUAGE_PREFERENCE, "python");
    const lines = dataset.trim().split("\n");
    const firstLine = lines[0];
    const hasCommas = firstLine.includes(",");
    const hasTabs = firstLine.includes("\t");

    if (language === "python") {
      if (hasCommas || hasTabs) {
        const separator = hasTabs ? "\\t" : ",";
        return `import pandas as pd
      import io
      
      # Dataset is pre-loaded in 'dataset' variable
      # Uncomment to view: print(dataset[:200])
      
      # Load into pandas DataFrame
      df = pd.read_csv(io.StringIO(dataset), sep='${separator}')
      
      print("Dataset shape:", df.shape)
      print(df.head())
      
      # Your analysis code here
      `;
      }

      return `# Dataset is pre-loaded in 'dataset' variable
      # Uncomment to view: print(dataset[:200])
      
      # Your analysis code here
      `;
    } else {
      if (hasCommas || hasTabs) {
        const separator = hasTabs ? "\\t" : ",";
        return `// Dataset is pre-loaded in 'dataset' variable
// Uncomment to view: console.log(dataset.substring(0, 200))

// Parse CSV/TSV
const lines = dataset.trim().split('\\n');
const data = lines.map(line => line.split('${separator}'));

console.log('Dataset shape:', data.length, 'rows');
console.log('First few rows:', data.slice(0, 5));

// Your analysis code here
`;
      }

      return `// Dataset is pre-loaded in 'dataset' variable
// Uncomment to view: console.log(dataset.substring(0, 200))

// Your analysis code here
`;
    }
  }

  /** Update the editors status */
  set status(state: StatusState) {
    const { status } = this.elements;
    status.className = state;
    const text = $(status).byQuery("#rosalind-repl-status-text");
    if (text) text.textContent = TextToState[state];
  }

  addOutput(text: string, type: OutputType | null = null) {
    const { output } = this.elements;
    const line = $$.DIV({
      content: text,
      classList: [
        "rosalind-output-line",
        type === "error"
          ? "rosalind-output-error"
          : type === "success"
          ? "rosalind-output-success"
          : "",
      ],
    });
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  getLastOutput() {
    const { output } = this.elements;
    const lines = $(output).queryAll(".rosalind-output-line");

    // Find the last ">>> Running code..." marker
    let startIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].textContent?.includes(">>> Running code...")) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      return "";
    }

    // Collect lines between ">>> Running code..." and ">>> Done."
    const outputLines: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      const text = lines[i].textContent || "";

      // Stop at ">>> Done." marker
      if (text.includes(">>> Done.")) {
        break;
      }

      // Skip error lines and result lines
      if (
        !lines[i].classList.contains("rosalind-output-error") &&
        !text.startsWith("Result:")
      ) {
        outputLines.push(text);
      }
    }

    return outputLines.join("\n").trim();
  }

  submit() {
    const form = $$.byId<HTMLFormElement>("id_form_submission");
    const input = $$.byId<HTMLInputElement>("id_output_file");

    if (!form || !input) {
      throw new Error("Submission form or file input not found");
    }

    const output = this.getLastOutput();

    // Create a File object from the output string
    const blob = new Blob([output], { type: "text/plain" });
    const file = new File([blob], "output.txt", { type: "text/plain" });

    // Create a DataTransfer to set the file
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;

    // Submit the form
    form.submit();
  }
}
