/**
 * Helpers that generate the boring parts of hand-written samples: putting
 * constants into cells. Each helper only uses cells that are still zero.
 */

/**
 * Code that adds `v` to the current cell, using the cell to its right
 * (which must be zero) as a loop counter. The pointer ends where it started.
 */
export function setCell(v: number): string {
  if (v === 0) return '';
  let best = '+'.repeat(v);
  for (let a = 2; a * 2 <= v; a++) {
    const b = Math.floor(v / a);
    const r = v - a * b;
    const s = `>${'+'.repeat(a)}[<${'+'.repeat(b)}>-]<${'+'.repeat(r)}`;
    if (s.length < best.length) best = s;
  }
  return best;
}

/**
 * Code that fills consecutive cells, starting at the current one, with
 * `values`. All those cells and the one after them must be zero. The pointer
 * ends on the cell after the last value. One value per line for readability.
 */
export function setCells(values: readonly number[]): string {
  return values.map((v) => `${setCell(v)}>`).join('\n');
}

/** `setCells` for the bytes of a string (ASCII only). */
export function setString(text: string): string {
  return setCells([...text].map((c) => c.charCodeAt(0)));
}
