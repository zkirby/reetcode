import { CSSProperties } from "./types";

/**
 * Simple wrapper around DOM APIs for improve ergonomics
 */
export class QueryWrapper {
  constructor(private readonly element: Element = document.body) {
    if (document == null || document.body == null) {
      throw new Error("Document or body not found");
    }
  }

  get content() {
    return this.element.innerHTML;
  }

  DANGEROUSLY_set_content(content: Node) {
    this.element.innerHTML = "";
    this.element.appendChild(content);
  }

  byQuery<T extends HTMLElement = HTMLElement>(
    query: string,
    remove: boolean = false
  ): T {
    const el = this.element.querySelector(query);
    if (remove) el?.parentNode?.removeChild(el);
    return el as T;
  }

  queryAll<T extends HTMLElement = HTMLElement>(query: string): T[] {
    const els = this.element.querySelectorAll(query);
    return Array.from(els) as T[];
  }

  static byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    return el as T;
  }

  private static ELEMENT<T extends HTMLElement>(
    tag: string,
    {
      id,
      content,
      style,
      classList,
      css,
    }: {
      id?: string;
      content?: string;
      style?: CSSProperties;
      classList?: string[];
      css?: string;
    } = {}
  ) {
    const d = document.createElement(tag) as T;
    if (id) d.id = id;
    if (content) d.innerHTML = content;
    if (style) {
      for (const [key, value] of Object.entries(style)) {
        d.style[key as any] = value as string;
      }
    }
    if (classList) {
      for (const className of classList) {
        d.classList.add(className);
      }
    }
    if (css) d.style.cssText = css;
    return d;
  }

  static DIV(args: Parameters<typeof QueryWrapper.ELEMENT>[1]) {
    return QueryWrapper.ELEMENT<HTMLDivElement>("div", args);
  }
  static A({
    href,
    ...args
  }: { href: string } & Parameters<typeof QueryWrapper.ELEMENT>[1]) {
    const a = QueryWrapper.ELEMENT<HTMLAnchorElement>("a", args);
    if (href) a.href = href;
    return a;
  }
  static BUTTON(args: Parameters<typeof QueryWrapper.ELEMENT>[1]) {
    return QueryWrapper.ELEMENT<HTMLButtonElement>("button", args);
  }
}

export const $ = (el?: Element) => new QueryWrapper(el);
export const $$ = QueryWrapper;
