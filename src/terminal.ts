/**
 * A small terminal emulator for program output, so Brainfuck programs can
 * draw and animate instead of only appending text.
 *
 * Supported:
 *  - `\n` new line, `\r` back to column 0, `\b` one column left (the next
 *    character overwrites), `\t` next multiple of 8, `\f` clear screen.
 *  - ANSI/VT100 CSI sequences (ESC [ ...):
 *      `H`/`f` cursor position (row;col, 1-based), `A` `B` `C` `D` cursor moves,
 *      `J` (2 or 3 = clear screen, 0 = clear below), `K` erase in line,
 *      `m` colours: 0 reset, 1 bold, 22 normal, 30–37, 90–97, 39 default.
 *  - Other control characters and unknown sequences are ignored.
 *
 * Text is stored per cell with a style number, and `lines()` hands out
 * runs of equal style for rendering.
 */

/** Style: bit 0 = bold, bits 1.. = foreground + 1 (0 = default). */
export type Style = number;

export interface Run {
  text: string;
  /** ANSI colour index 0–15, or -1 for the default colour. */
  fg: number;
  bold: boolean;
}

const MAX_LINES = 2000;
const MAX_LINE_LENGTH = 20_000;

export class Terminal {
  private chars: string[][] = [[]];
  private styles: Style[][] = [[]];
  private row = 0;
  private col = 0;
  private style: Style = 0;
  private esc: '' | 'esc' | 'csi' | 'skip1' = '';
  private csi = '';
  /** Set when something changed since the last `takeDirty()`. */
  private dirty = true;
  /** Whether any non-default style has been used (lets the renderer take a fast path). */
  styled = false;

  reset(): void {
    this.chars = [[]];
    this.styles = [[]];
    this.row = 0;
    this.col = 0;
    this.style = 0;
    this.esc = '';
    this.csi = '';
    this.styled = false;
    this.dirty = true;
  }

  takeDirty(): boolean {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  get cursor(): { row: number; col: number } {
    return { row: this.row, col: this.col };
  }

  write(text: string): void {
    if (!text) return;
    this.dirty = true;
    for (const ch of text) {
      if (this.esc) {
        this.escape(ch);
        continue;
      }
      switch (ch) {
        case '\n':
          this.row++;
          this.col = 0;
          this.ensureRow();
          break;
        case '\r':
          this.col = 0;
          break;
        case '\b':
          if (this.col > 0) this.col--;
          break;
        case '\t':
          this.col = (Math.floor(this.col / 8) + 1) * 8;
          break;
        case '\f':
          this.clear();
          break;
        case '\x1b':
          this.esc = 'esc';
          break;
        default:
          if (ch.charCodeAt(0) >= 32 && ch !== '\x7f') this.put(ch);
      }
    }
  }

  /** The screen as lines of styled runs. */
  lines(): Run[][] {
    return this.chars.map((line, r) => {
      const styles = this.styles[r]!;
      const runs: Run[] = [];
      let text = '';
      let cur = -1;
      for (let i = 0; i < line.length; i++) {
        const s = styles[i] ?? 0;
        if (s !== cur && text) {
          runs.push(toRun(text, cur));
          text = '';
        }
        cur = s;
        text += line[i] ?? ' ';
      }
      if (text) runs.push(toRun(text, cur));
      return runs;
    });
  }

  /** Plain text of the whole screen. */
  text(): string {
    return this.chars.map((l) => Array.from(l, (c) => c ?? ' ').join('')).join('\n');
  }

  private put(ch: string): void {
    this.ensureRow();
    const line = this.chars[this.row]!;
    const styles = this.styles[this.row]!;
    while (line.length < this.col) {
      line.push(' ');
      styles.push(0);
    }
    line[this.col] = ch;
    styles[this.col] = this.style;
    this.col++;
    if (line.length > MAX_LINE_LENGTH) {
      const cut = line.length - MAX_LINE_LENGTH / 2;
      line.splice(0, cut);
      styles.splice(0, cut);
      this.col = Math.max(0, this.col - cut);
    }
  }

  private ensureRow(): void {
    while (this.chars.length <= this.row) {
      this.chars.push([]);
      this.styles.push([]);
    }
    if (this.chars.length > MAX_LINES) {
      const cut = this.chars.length - MAX_LINES;
      this.chars.splice(0, cut);
      this.styles.splice(0, cut);
      this.row = Math.max(0, this.row - cut);
    }
  }

  private clear(): void {
    this.chars = [[]];
    this.styles = [[]];
    this.row = 0;
    this.col = 0;
  }

  private escape(ch: string): void {
    if (this.esc === 'skip1') {
      this.esc = '';
      return;
    }
    if (this.esc === 'esc') {
      if (ch === '[') {
        this.esc = 'csi';
        this.csi = '';
      } else if ('()*+#%'.includes(ch)) {
        this.esc = 'skip1'; // charset selection and similar: one more byte follows
      } else {
        this.esc = ''; // unsupported escape: drop it
      }
      return;
    }
    const code = ch.charCodeAt(0);
    if (code >= 0x40 && code <= 0x7e) {
      this.esc = '';
      this.runCsi(this.csi, ch);
    } else {
      this.csi += ch;
      if (this.csi.length > 32) this.esc = '';
    }
  }

  private runCsi(params: string, final: string): void {
    if (params.startsWith('?')) return; // private modes, e.g. hide cursor
    const nums = params.split(';').map((p) => (p === '' ? NaN : Number(p)));
    const n = (i: number, def: number) => (Number.isFinite(nums[i]) ? nums[i]! : def);
    switch (final) {
      case 'H':
      case 'f':
        this.row = Math.max(0, n(0, 1) - 1);
        this.col = Math.max(0, n(1, 1) - 1);
        this.ensureRow();
        break;
      case 'A':
        this.row = Math.max(0, this.row - n(0, 1));
        break;
      case 'B':
        this.row += n(0, 1);
        this.ensureRow();
        break;
      case 'C':
        this.col += n(0, 1);
        break;
      case 'D':
        this.col = Math.max(0, this.col - n(0, 1));
        break;
      case 'J': {
        const mode = n(0, 0);
        if (mode === 2 || mode === 3) {
          const { row, col } = this;
          this.clear();
          this.row = row;
          this.col = col;
          this.ensureRow();
        } else if (mode === 0) {
          this.chars.length = this.styles.length = this.row + 1;
          this.eraseLine(0);
        }
        break;
      }
      case 'K':
        this.eraseLine(n(0, 0));
        break;
      case 'm':
        for (const p of params === '' ? [0] : nums) this.sgr(Number.isFinite(p) ? p : 0);
        break;
    }
  }

  private eraseLine(mode: number): void {
    this.ensureRow();
    const line = this.chars[this.row]!;
    const styles = this.styles[this.row]!;
    if (mode === 0) {
      line.length = styles.length = Math.min(line.length, this.col);
    } else if (mode === 1) {
      for (let i = 0; i <= this.col && i < line.length; i++) {
        line[i] = ' ';
        styles[i] = 0;
      }
    } else if (mode === 2) {
      line.length = styles.length = 0;
    }
  }

  private sgr(p: number): void {
    let fg = (this.style >> 1) - 1;
    let bold = (this.style & 1) === 1;
    if (p === 0) {
      fg = -1;
      bold = false;
    } else if (p === 1) bold = true;
    else if (p === 22) bold = false;
    else if (p >= 30 && p <= 37) fg = p - 30;
    else if (p >= 90 && p <= 97) fg = p - 90 + 8;
    else if (p === 39) fg = -1;
    else return;
    this.style = ((fg + 1) << 1) | (bold ? 1 : 0);
    if (this.style !== 0) this.styled = true;
  }
}

function toRun(text: string, style: Style): Run {
  return { text, fg: (style >> 1) - 1, bold: (style & 1) === 1 };
}
