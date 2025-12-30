import { $ } from "./$";
import { DB } from "./db";

// null => started => waiting => solved
type State = "SOLVED" | "STARTED" | "WAITING";

// Timelimit after starting a problem
const fiveMinutesInMs = 5 * 60 * 1000;

/**
 * Responsible for interfacing with Rosalind elements that
 * dictate the current state and conditions of the problem
 */
export class Problem {
  private state: State | null = null;

  constructor() {
    const success = $().byQuery("span.label.label-success");
    if (success && success.textContent.includes("Congratulations")) {
      this.state = "SOLVED";
      return;
    }

    const wait = $().byQuery(".problem-timewait");
    if (wait && wait.style.display !== "none") {
      this.state = "WAITING";
      return;
    }

    const startTimestamp = DB.get<number>(["START_TIMESTAMP"]);
    const now = Date.now();
    if (startTimestamp) {
      if (now - startTimestamp < fiveMinutesInMs) {
        this.state = "STARTED";
        return;
      }
    }
  }

  get isSolved() {
    return this.state === "SOLVED";
  }

  get isStarted() {
    return this.state === "STARTED";
  }

  get isWaiting() {
    return this.state === "WAITING";
  }
}
