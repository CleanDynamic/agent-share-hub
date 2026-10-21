// CA-13: a reader for Python LITERALS, shared by the Decision importer and the helpers reader. It never runs, imports or
// evaluates anything. A string, a number, True, False, None, a list, a tuple, a dict, or a call to a name the caller allows
// (with literal arguments) is read; anything else (a name, an f-string, an operator, a comprehension) throws NotLiteral.

export type Py = string | number | boolean | null | Py[] | { [key: string]: Py } | { call: string; args: Py[]; kwargs: Record<string, Py> };

export class NotLiteral extends Error {}

/** A reader for Python literals only. Anything else (a name, an f-string, an operator, a comprehension) is NotLiteral. */
export class PyReader {
  private i = 0;
  constructor(private readonly s: string, start = 0, private readonly allow: RegExp = /^(?:\w+\.)*(?:Choice|Score|Noul)$/) {
    this.i = start;
  }

  get at(): number {
    return this.i;
  }

  private skip(): void {
    for (;;) {
      while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i += 1;
      if (this.s[this.i] === "#") while (this.i < this.s.length && this.s[this.i] !== "\n") this.i += 1;
      else return;
    }
  }

  private peek(): string {
    this.skip();
    return this.s[this.i] ?? "";
  }

  private take(expect: string): void {
    if (this.peek() !== expect) throw new NotLiteral();
    this.i += 1;
  }

  value(): Py {
    const ch = this.peek();
    if (!ch) throw new NotLiteral();
    if (ch === "[" || ch === "(") return this.list(ch === "[" ? "]" : ")");
    if (ch === "{") return this.dict();
    if (/["']/.test(ch) || /^[rRuU]["']/.test(this.s.slice(this.i, this.i + 2))) return this.strings();
    if (/[0-9.+-]/.test(ch)) return this.number();
    const name = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(this.s.slice(this.i))?.[0];
    if (!name) throw new NotLiteral();
    if (/^[fF]["']/.test(this.s.slice(this.i, this.i + 2)) || /^(?:[bB]|[rR][bB]|[fF][rR])["']/.test(this.s.slice(this.i, this.i + 3))) throw new NotLiteral();
    this.i += name.length;
    if (name === "True") return true;
    if (name === "False") return false;
    if (name === "None") return null;
    if (this.peek() === "(") return this.call(name);
    throw new NotLiteral();
  }

  private after(value: Py): Py {
    const next = this.peek();
    if (next && !",)]}:=".includes(next)) throw new NotLiteral();
    return value;
  }

  private number(): Py {
    const match = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.s.slice(this.i));
    if (!match) throw new NotLiteral();
    this.i += match[0].length;
    return this.after(Number(match[0]));
  }

  private strings(): Py {
    let out = "";
    let any = false;
    for (;;) {
      const prefix = /^[rRuU]?/.exec(this.s.slice(this.i))?.[0] ?? "";
      const raw = /r/i.test(prefix);
      const q = this.s[this.i + prefix.length];
      if (q !== '"' && q !== "'") break;
      this.i += prefix.length;
      const triple = this.s.startsWith(q.repeat(3), this.i);
      const close = triple ? q.repeat(3) : q;
      this.i += close.length;
      for (;;) {
        if (this.i >= this.s.length) throw new NotLiteral();
        if (this.s.startsWith(close, this.i)) {
          this.i += close.length;
          break;
        }
        const ch = this.s[this.i];
        if (ch === "\\" && !raw) {
          const next = this.s[this.i + 1];
          out += next === "n" ? "\n" : next === "t" ? "\t" : next;
          this.i += 2;
        } else {
          if (ch === "\n" && !triple) throw new NotLiteral();
          out += ch;
          this.i += 1;
        }
      }
      any = true;
      this.skip();
    }
    if (!any) throw new NotLiteral();
    return this.after(out);
  }

  private list(close: string): Py {
    this.i += 1;
    const out: Py[] = [];
    while (this.peek() !== close) {
      out.push(this.value());
      if (this.peek() === ",") this.i += 1;
      else if (this.peek() !== close) throw new NotLiteral();
    }
    this.i += 1;
    return this.after(out);
  }

  private dict(): Py {
    this.i += 1;
    const out: { [key: string]: Py } = {};
    while (this.peek() !== "}") {
      const key = this.value();
      if (typeof key !== "string") throw new NotLiteral();
      this.take(":");
      out[key] = this.value();
      if (this.peek() === ",") this.i += 1;
      else if (this.peek() !== "}") throw new NotLiteral();
    }
    this.i += 1;
    return this.after(out);
  }

  private call(name: string): Py {
    if (!this.allow.test(name) && !this.allow.test(name.split(".").pop() as string)) throw new NotLiteral();
    this.i += 1;
    const args: Py[] = [];
    const kwargs: Record<string, Py> = {};
    while (this.peek() !== ")") {
      const kw = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(this.s.slice(this.i + (this.peek() ? 0 : 0)));
      if (kw) {
        this.i += kw[0].length;
        kwargs[kw[1]] = this.value();
      } else args.push(this.value());
      if (this.peek() === ",") this.i += 1;
      else if (this.peek() !== ")") throw new NotLiteral();
    }
    this.i += 1;
    return this.after({ call: name.split(".").pop() as string, args, kwargs });
  }
}

export const isCall = (value: Py): value is { call: string; args: Py[]; kwargs: Record<string, Py> } => typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as { call?: unknown }).call === "string";

/** The index of the bracket that closes the one at `open`, skipping strings and comments; -1 when it never closes. */
export function matchBracket(text: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  let quote: string | null = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (text.startsWith(quote, i)) {
        i += quote.length - 1;
        quote = null;
      }
      continue;
    }
    if (ch === "#") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = text.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
      i += quote.length - 1;
      continue;
    }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

/** `text` split at its top-level commas (not inside brackets or strings), each piece trimmed, empty pieces dropped. */
export function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (text.startsWith(quote, i)) {
        i += quote.length - 1;
        quote = null;
      }
      continue;
    }
    if (ch === "#") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = text.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
      i += quote.length - 1;
    } else if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) depth -= 1;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((piece) => piece.trim()).filter(Boolean);
}
