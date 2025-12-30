import { Problem } from "../problem";

/**
 * Controls buttons control some state of the problem, e.g.
 * starting it, running it, etc.
 */
export abstract class ControlBtn {
  /** The underlying button element */
  public element: HTMLButtonElement;

  public constructor(problem: Problem);

  public enable: () => void;

  public loading: () => void;

  public disable: () => void;
}
