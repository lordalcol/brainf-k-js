import { describe, expect, it } from 'vitest';
import { setCells } from './bf-builder';
import { Machine, compile, isFrameBoundary, runToEnd } from './interpreter';
import { SAMPLES } from './samples';
import { Terminal } from './terminal';

const sample = (id: string) => {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(`no sample ${id}`);
  return s;
};

/** Run a program for at most `steps` instructions and return its raw output. */
function runFor(source: string, steps: number, input = ''): { out: string; halted: boolean } {
  const m = new Machine(source);
  m.feed(input);
  let out = '';
  let halted = false;
  while (m.steps < steps) {
    const r = m.run(Math.min(1_000_000, steps - m.steps));
    out += m.takeOutput();
    if (r === 'halted') {
      halted = true;
      break;
    }
  }
  return { out, halted };
}

/** Run with frame sync and collect what the screen shows at each frame. */
function frames(source: string, max: number): string[] {
  const m = new Machine(source, { frameSync: true });
  const term = new Terminal();
  const shots: string[] = [];
  while (shots.length < max) {
    const r = m.run(10_000_000);
    term.write(m.takeOutput());
    if (r === 'frame') shots.push(term.text());
    else if (r === 'halted') {
      shots.push(term.text());
      break;
    }
  }
  return shots;
}

describe('bf-builder', () => {
  it('sets cells to the given values', () => {
    const values = [0, 1, 7, 12, 27, 91, 124, 255];
    const m = new Machine(setCells(values));
    m.run(1e6);
    expect([...m.tape.slice(0, values.length + 1)]).toEqual([...values, 0]);
    expect(m.ptr).toBe(values.length);
  });
});

describe('frame sync', () => {
  it('treats clear, home, backspace and CR as frame boundaries', () => {
    expect(isFrameBoundary(12, 0)).toBe(true);
    expect(isFrameBoundary(8, 0)).toBe(true);
    expect(isFrameBoundary(13, 0)).toBe(true);
    expect(isFrameBoundary(0x48, 0x1b5b)).toBe(true); // ESC [ H
    expect(isFrameBoundary(0x4a, 0x1b5b32)).toBe(true); // ESC [ 2 J
    expect(isFrameBoundary(0x48, 0x41)).toBe(false); // a plain H
    expect(isFrameBoundary(10, 0)).toBe(false);
  });

  it('stops before the boundary byte, then outputs it on the next run', () => {
    const m = new Machine('++++++++++++.', { frameSync: true }); // form feed
    expect(m.run(100)).toBe('frame');
    expect(m.takeOutput()).toBe('');
    expect(m.run(100)).toBe('halted');
    expect(m.takeOutput()).toBe('\f');
  });

  it('a single step without sync always executes', () => {
    const m = new Machine('++++++++++++.', { frameSync: true });
    m.run(12);
    expect(m.run(1, false)).toBe('halted');
    expect(m.takeOutput()).toBe('\f');
  });
});

describe('animation samples', () => {
  it('progress bar fills up frame by frame, then says Done', () => {
    const shots = frames(sample('progress').source, 100);
    expect(shots.length).toBeGreaterThan(40);
    expect(shots[1]).toBe(`[${'.'.repeat(40)}] |`);
    expect(shots[2]).toBe(`[#${'.'.repeat(39)}] /`);
    const last = shots.at(-1)!;
    expect(last).toContain(`[${'#'.repeat(40)}]`);
    expect(last).toContain('Done!');
  });

  it('bouncing ball goes right, then back left', () => {
    const shots = frames(sample('bounce').source, 70).slice(1);
    expect(shots[0]).toBe(`|O${' '.repeat(29)}|`);
    expect(shots[1]).toBe(`| O${' '.repeat(28)}|`);
    expect(shots[29]).toBe(`|${' '.repeat(29)}O|`);
    expect(shots[30]).toBe(`|${' '.repeat(28)}O |`);
    expect(shots[58]).toBe(`|O${' '.repeat(29)}|`);
    for (const s of shots) expect(s).toHaveLength(32);
  });

  it('rainbow shifts the six colours by one each frame', () => {
    const m = new Machine(sample('rainbow').source, { frameSync: true });
    const colourOrder: number[][] = [];
    expect(m.run(1e7)).toBe('frame'); // stops before the first form feed
    for (let f = 0; f < 4; f++) {
      const term = new Terminal();
      expect(m.run(1e7)).toBe('frame'); // form feed, one frame, stop before the next
      term.write(m.takeOutput());
      const lines = term.lines();
      expect(lines.filter((l) => l.length).length).toBe(6);
      expect(term.text()).toContain('Brainfuck in colour');
      colourOrder.push(lines.slice(0, 6).map((l) => l[0]!.fg));
    }
    expect(colourOrder[0]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(colourOrder[1]).toEqual([2, 3, 4, 5, 6, 1]);
    expect(colourOrder[2]).toEqual([3, 4, 5, 6, 1, 2]);
  });

  it('typewriter ends with the corrected text and shows typing frames', () => {
    const shots = frames(sample('typewriter').source, 10_000);
    const final = shots.at(-1)!;
    expect(final).toContain('Hello! I am a Brainfuck program.');
    expect(final).toContain('I can make typos and fix them, thanks to backspace.');
    expect(final).not.toContain('progarm');
    expect(shots.some((s) => s.includes('progarm'))).toBe(true); // the typo was visible
    expect(shots.some((s) => s.endsWith('Hel_'))).toBe(true); // typed one key at a time
  });
});

describe('showcase and game samples', () => {
  it('sierpinski draws 32 rows', () => {
    const out = runToEnd(sample('sierpinski').source);
    const rows = out.trimEnd().split('\n');
    expect(rows).toHaveLength(32);
    expect(rows[0]!.trim()).toBe('*');
    expect(rows.at(-1)!.trim()).toBe('* '.repeat(32).trim());
  });

  it('christmas tree is as tall as the input', () => {
    const out = runToEnd(sample('xmastree').source, sample('xmastree').input);
    const rows = out.trimEnd().split('\n');
    expect(rows).toHaveLength(13); // 12 rows plus the trunk
    expect(rows[11]!.trim()).toBe('*'.repeat(23));
  });

  it('e and the golden ratio start with the right digits', () => {
    expect(runFor(sample('e').source, 5_000_000).out).toMatch(/^2\.71828182845904523536/);
    expect(runFor(sample('golden').source, 5_000_000).out).toMatch(/^1\.61803398874989484820/);
  });

  it('tic-tac-toe moves first and waits for a move', () => {
    const m = new Machine(sample('tictactoe').source, { interactive: true });
    expect(m.run(1e7)).toBe('input');
    expect(m.takeOutput()).toBe('X23\n456\n789\n>');
  });

  it('game of life sets up a glider and advances on Enter', () => {
    const s = sample('life');
    const m = new Machine(s.source, { interactive: true });
    m.feed(s.input!);
    expect(m.run(1e8)).toBe('input');
    const before = m.takeOutput().split('>').at(-2)!;
    expect(before).toContain('a-*--------');
    m.feed('\n');
    expect(m.run(1e8)).toBe('input');
    // One generation later the glider has moved down a row.
    const after = m.takeOutput();
    expect(after).toContain('b*-*-------');
    expect(after).toContain('d-*--------');
  });

  it('ghost draws its maze and waits for a move', () => {
    const m = new Machine(sample('ghost').source, { interactive: true });
    expect(m.run(1e7)).toBe('input');
    expect(m.takeOutput()).toContain('@');
  });

  it('mandelbrot starts drawing the set', () => {
    // The full picture takes ~10 billion steps; check the first rows only.
    const { out } = runFor(sample('mandelbrot').source, 600_000_000);
    expect(out.split('\n')[0]).toMatch(/^A{10,}B+C+/);
  }, 30_000);
});

describe('sample list', () => {
  it('has unique ids and only valid Brainfuck brackets', () => {
    const ids = SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SAMPLES) expect(() => new Machine(s.source)).not.toThrow();
  });

  it('every sample that reads input says what to type', () => {
    const READ = 5; // op code of `,`
    // These two never stop, so the commas in their closing comments never run.
    const neverReads = new Set(['e', 'golden']);
    const missing = SAMPLES.filter(
      (s) => compile(s.source).ops.includes(READ) && !s.inputHint && !neverReads.has(s.id),
    ).map((s) => s.id);
    expect(missing).toEqual([]);
  });
});
