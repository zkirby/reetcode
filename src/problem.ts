import { $ } from "./$";
import { DB } from "./db";

// ready => started => waiting => solved
type State = "SOLVED" | "STARTED" | "WAITING" | "READY";

// Timelimit after starting a problem
const fiveMinutesInMs = 5 * 60 * 1000;

/**
 * Responsible for interfacing with Rosalind elements that
 * dictate the current state and conditions of the problem
 */
export class Problem {
  private state: State = "READY";

  constructor() {
    this.tick();
  }

  public tick() {
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

    if (this.remainingSeconds > 0) {
      this.state = "STARTED";
      return;
    }

    this.state = "READY";
  }

  /** Start the problem */
  start() {
    if (this.remainingSeconds <= 0) {
      DB.save(["START_TIMESTAMP"], Date.now());
    }
    this.state = "STARTED";
  }

  reset() {
    DB.save(["START_TIMESTAMP"], null);
  }

  /** Check how much time is left */
  get remainingSeconds() {
    const startTimestamp = DB.get<number>(["START_TIMESTAMP"]);
    if (!startTimestamp) return 0;

    const now = Date.now();
    const elapsedMs = now - startTimestamp;
    const remainingMs = fiveMinutesInMs - elapsedMs;
    return Math.max(0, Math.floor(remainingMs / 1000));
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

  get isReady() {
    return this.state === "READY";
  }
}
