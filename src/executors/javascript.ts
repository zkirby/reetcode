import { Language } from "../types";
import { Runner } from "./runner";

/**
 * Runs JavaScript code natively in the browser
 */
export class JavaScriptRunner implements Runner {
  static language = "javascript";
  public initialized: boolean = false;

  async init(dataset: string) {
    (window as any).dataset = dataset;
    // DNA codon table
    (window as any).codonTable = {
      TTT: "F",
      TTC: "F",
      TTA: "L",
      TTG: "L",
      CTT: "L",
      CTC: "L",
      CTA: "L",
      CTG: "L",
      ATT: "I",
      ATC: "I",
      ATA: "I",
      ATG: "M",
      GTT: "V",
      GTC: "V",
      GTA: "V",
      GTG: "V",
      TCT: "S",
      TCC: "S",
      TCA: "S",
      TCG: "S",
      CCT: "P",
      CCC: "P",
      CCA: "P",
      CCG: "P",
      ACT: "T",
      ACC: "T",
      ACA: "T",
      ACG: "T",
      GCT: "A",
      GCC: "A",
      GCA: "A",
      GCG: "A",
      TAT: "Y",
      TAC: "Y",
      TAA: "Stop",
      TAG: "Stop",
      CAT: "H",
      CAC: "H",
      CAA: "Q",
      CAG: "Q",
      AAT: "N",
      AAC: "N",
      AAA: "K",
      AAG: "K",
      GAT: "D",
      GAC: "D",
      GAA: "E",
      GAG: "E",
      TGT: "C",
      TGC: "C",
      TGA: "Stop",
      TGG: "W",
      CGT: "R",
      CGC: "R",
      CGA: "R",
      CGG: "R",
      AGT: "S",
      AGC: "S",
      AGA: "R",
      AGG: "R",
      GGT: "G",
      GGC: "G",
      GGA: "G",
      GGG: "G",
    };
    // JavaScript runs natively in the browser, no external dependencies needed
    this.initialized = true;
  }

  public getSkeleton(): string {
    const lines = (window as any).dataset.trim().split("\n");
    const firstLine = lines[0];
    const hasCommas = firstLine.includes(",");
    const hasTabs = firstLine.includes("\t");

    if (hasCommas || hasTabs) {
      const separator = hasTabs ? "\\t" : ",";
      return `// Dataset is pre-loaded in 'dataset' variable
// console.log(dataset.substring(0, 200))

// Parse CSV/TSV
const lines = dataset.trim().split('\\n');
const data = lines.map(line => line.split('${separator}'));

console.log('Dataset shape:', data.length, 'rows');
console.log('First few rows:', data.slice(0, 5));

// Your analysis code here`;
    }

    return `// Dataset is pre-loaded in 'dataset' variable
// console.log(dataset.substring(0, 200))

// Your analysis code here`;
  }

  async *run(code: string) {
    if (!this.initialized) {
      yield {
        text: "JavaScript runner not initialized. Please wait...",
        type: "error" as const,
      };
      return;
    }

    try {
      // Capture console output
      const logs: string[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      console.log = (...args: any[]) => {
        logs.push(
          args
            .map((arg) =>
              typeof arg === "object"
                ? JSON.stringify(arg, null, 2)
                : String(arg)
            )
            .join(" ")
        );
      };

      console.error = (...args: any[]) => {
        errors.push(args.map((arg) => String(arg)).join(" "));
      };

      console.warn = (...args: any[]) => {
        warnings.push(args.map((arg) => String(arg)).join(" "));
      };

      yield {
        text: ">>> Running code...",
        type: null,
      };

      try {
        const AsyncFunction = Object.getPrototypeOf(
          async function () {}
        ).constructor;
        // Make dataset and codonTable available in function scope
        const datasetValue = (window as any).dataset;
        const codonTableValue = (window as any).codonTable;
        // Prepend code to declare dataset and codonTable as const variables
        // This ensures they are available as top-level variables in the code
        const wrappedCode = `const dataset = datasetParam;\nconst codonTable = codonTableParam;\n${code}`;
        const fn = new AsyncFunction(
          "datasetParam",
          "codonTableParam",
          wrappedCode
        );
        const result = await fn(datasetValue, codonTableValue);

        // Display console output
        if (logs.length > 0) {
          yield {
            text: logs.join("\n"),
            type: null,
          };
        }

        if (warnings.length > 0) {
          yield {
            text: warnings.join("\n"),
            type: null,
          };
        }

        if (errors.length > 0) {
          yield {
            text: errors.join("\n"),
            type: "error" as const,
          };
        }

        // Display return value if not undefined
        if (result !== undefined && result !== null) {
          yield {
            text: `Result: ${
              typeof result === "object"
                ? JSON.stringify(result, null, 2)
                : String(result)
            }`,
            type: null,
          };
        }

        yield {
          text: ">>> Done.",
          type: null,
        };
      } catch (error) {
        yield {
          text: `Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          type: "error" as const,
        };
      } finally {
        // Restore console
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
      }
    } catch (error) {
      yield {
        text: `Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        type: "error" as const,
      };
    }
  }
}
