import { Language, PyodideInterface, WindowWithExtensions } from "../types";
import { Runner } from "./runner";

/**
 * Uses pyodine to run python in the browser
 */
export class PythonRunner implements Runner {
  static language = "python";
  public initialized: boolean = false;

  /** Internal pyodide interface */
  private pyodide: PyodideInterface | null = null;

  async init(dataset: string) {
    if (this.initialized) {
      this.pyodide!.globals.set("dataset", dataset);
      // Update codon table if already initialized
      this.pyodide!.runPython(`
codon_table = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "Stop", "TAG": "Stop",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "Stop", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G"
}
      `);
      return;
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
      script.onload = () => resolve(null);
      script.onerror = reject;
      document.head.appendChild(script);
    });

    const win = window as WindowWithExtensions;

    if (!win.loadPyodide) {
      throw new Error("Pyodide loader not found");
    }

    this.pyodide = await win.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
    });

    if (this.pyodide == null) {
      throw new Error("Failed to initialize Pyodide");
    }

    this.pyodide.runPython(`
  import sys
  import io
  sys.stdout = io.StringIO()
  sys.stderr = io.StringIO()
      `);

    this.pyodide.globals.set("dataset", dataset);

    // DNA codon table
    this.pyodide.runPython(`
codon_table = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "Stop", "TAG": "Stop",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "Stop", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G"
}
      `);

    this.initialized = true;
  }

  public getSkeleton(): string {
    const dataset = this.pyodide?.globals.get("dataset");
    const lines = dataset.trim().split("\n");
    const firstLine = lines[0];
    const hasCommas = firstLine.includes(",");
    const hasTabs = firstLine.includes("\t");

    if (hasCommas || hasTabs) {
      const separator = hasTabs ? "\\t" : ",";
      return `import pandas as pd
import io
      
# Dataset is pre-loaded in 'dataset' variable. 
# print(dataset[:200])
      
# Load into pandas DataFrame
df = pd.read_csv(io.StringIO(dataset), sep='${separator}')
      
print("Dataset shape:", df.shape)
print(df.head())
      
# Your analysis code here`;
    }

    return `# Dataset is pre-loaded in 'dataset' variable. 
# print(dataset[:200])
      
# Your analysis code here`;
  }

  async *run(code: string) {
    if (!this.pyodide) {
      yield {
        text: "Python not loaded yet. Please wait...",
        type: "error" as const,
      };
      return;
    }

    try {
      this.pyodide.runPython(`
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
    `);

      const result = await this.pyodide.runPythonAsync(code);
      const stdout = this.pyodide.runPython("sys.stdout.getvalue()");
      const stderr = this.pyodide.runPython("sys.stderr.getvalue()");

      yield {
        text: ">>> Running code...",
        type: null,
      };

      if (stderr) {
        yield {
          text: stderr,
          type: "error" as const,
        };
      }

      if (result !== undefined && result !== null) {
        yield {
          text: `Result: ${result}`,
          type: null,
        };
      }

      if (stdout) {
        yield {
          text: `${stdout}`,
          type: null,
        };
      }

      yield {
        text: ">>> Done.",
        type: null,
      };
      return;
    } catch (error) {
      yield {
        text: `Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        type: "error" as const,
      };
      return;
    }
  }
}
