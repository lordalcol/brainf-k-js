/**
 * Generate a Brainfuck program that prints `text`.
 *
 * Uses two cells: cell 0 is a loop counter, cell 1 holds the current
 * character. For each byte it picks the shorter of a plain run of `+`/`-`
 * or a multiplication loop (`<aaa[>bbb<-]>rrr`), and also considers going
 * the other way round the 8-bit wraparound.
 */
export function textToBrainfuck(text: string, lineWidth = 64): string {
  const bytes = new TextEncoder().encode(text);
  const tokens: string[] = ['>'];
  let cur = 0;
  for (const b of bytes) {
    tokens.push(shortestDelta(b - cur) + '.');
    cur = b;
  }
  return wrap(tokens, lineWidth);
}

export function shortestDelta(d: number): string {
  const candidates = [d, d > 0 ? d - 256 : d + 256];
  let best: string | null = null;
  for (const c of candidates) {
    const s = delta(c);
    if (best === null || s.length < best.length) best = s;
  }
  return best ?? '';
}

function delta(d: number): string {
  if (d === 0) return '';
  const op = d > 0 ? '+' : '-';
  const n = Math.abs(d);
  let best = op.repeat(n);
  for (let a = 2; a * a <= n * 4; a++) {
    const b = Math.floor(n / a);
    if (b < 2) break;
    const r = n - a * b;
    const s = `<${'+'.repeat(a)}[>${op.repeat(b)}<-]>${op.repeat(r)}`;
    if (s.length < best.length) best = s;
  }
  return best;
}

function wrap(tokens: string[], width: number): string {
  const lines: string[] = [];
  let line = '';
  for (const t of tokens) {
    if (line && line.length + 1 + t.length > width) {
      lines.push(line);
      line = t;
    } else {
      line = line ? `${line} ${t}` : t;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}
