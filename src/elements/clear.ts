import { $$ } from "../$";
import { ControlBtn } from "./controlbtn";

export class ClearBtn implements ControlBtn {
  public element;

  constructor() {
    this.element = $$.byId<HTMLButtonElement>("rosalind-clear-btn");
  }

  enable() {
    this.element.disabled = false;
  }
  loading() {}
  disable() {}
}

// Single ton
export const clearBtn = new ClearBtn();
