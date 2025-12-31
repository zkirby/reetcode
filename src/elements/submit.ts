import { $$ } from "../$";
import { ControlBtn } from "./controlbtn";

export class SubmitBtn implements ControlBtn {
  public element;

  constructor() {
    this.element = $$.byId<HTMLButtonElement>("rosalind-submit-btn");
  }

  enable() {
    this.element.disabled = false;
  }
  loading() {}
  disable() {}
}
