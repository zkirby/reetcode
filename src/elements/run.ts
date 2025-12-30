import { $$ } from "../$";
import { ControlBtn } from "./controlbtn";

export class RunBtn implements ControlBtn {
  public element;

  constructor() {
    this.element = $$.byId<HTMLButtonElement>("rosalind-run-btn");
  }

  enable() {
    this.element.disabled = false;
    this.element.textContent = "Run Code";
  }
  loading() {
    this.element.disabled = true;
    this.element.textContent = "Running...";
  }
  disable() {
    this.element.disabled = true;
  }
}

// Single ton
export const runBtn = new RunBtn();
