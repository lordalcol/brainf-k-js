import { describe, expect, it } from 'vitest';
import { BfError, Machine, compile, runToEnd } from './interpreter';
import { SAMPLES } from './samples';
import { textToBrainfuck } from './text-to-bf';

const sample = (id: string) => {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) throw new Error(`no sample ${id}`);
  return s;
};

describe('compile', () => {
  it('reports unmatched brackets with their source index', () => {
    expect(() => compile('+[[-]')).toThrow(BfError);
    try {
      compile('ab]');
    } catch (e) {
      expect((e as BfError).index).toBe(2);
    }
  });
});

describe('Machine', () => {
  it('wraps cells at 8 bits', () => {
    const m = new Machine('-');
    m.run(10);
    expect(m.tape[0]).toBe(255);
  });

  it('errors when moving left of cell 0', () => {
    expect(() => runToEnd('<')).toThrow(/left of cell 0/);
  });

  it('grows the tape on demand', () => {
    const m = new Machine('+[>+]', { tapeSize: 4 });
    m.run(100);
    expect(m.tape.length).toBeGreaterThan(4);
  });

  it('applies EOF modes', () => {
    expect(runToEnd('+,.', '', { eof: 'zero' }).charCodeAt(0)).toBe(0);
    expect(runToEnd('+,.', '', { eof: 'unchanged' }).charCodeAt(0)).toBe(1);
    expect(runToEnd(',.', '', { eof: 'max' })).toBe('�'); // byte 255 is invalid UTF-8
  });

  it('stops for input in interactive mode and resumes after feed', () => {
    const m = new Machine(',.', { interactive: true });
    expect(m.run(100)).toBe('input');
    m.feed('A');
    expect(m.run(100)).toBe('halted');
    expect(m.takeOutput()).toBe('A');
  });

  it('pauses on # only when breakpoints are enabled', () => {
    const on = new Machine('+#+', { breakpoints: true });
    expect(on.run(100)).toBe('breakpoint');
    expect(on.tape[0]).toBe(1);
    expect(on.run(100)).toBe('halted');
    expect(on.tape[0]).toBe(2);

    const off = new Machine('+#+', { breakpoints: false });
    expect(off.run(100)).toBe('halted');
  });

  it('single-steps over comments', () => {
    const m = new Machine('+ comment +');
    m.run(1);
    expect(m.sourceIndex).toBe(10);
  });

  it('round-trips UTF-8 input and output', () => {
    expect(runToEnd(',[.,]', 'héllo ✓')).toBe('héllo ✓');
  });
});

describe('samples', () => {
  it('hello world', () => {
    expect(runToEnd(sample('helloworld').source)).toBe('Hello World!\n');
  });
  it('arithmetic', () => {
    expect(runToEnd(sample('addition').source, sample('addition').input)).toBe('5');
    expect(runToEnd(sample('multiplication').source, sample('multiplication').input)).toBe('8');
    expect(runToEnd(sample('division').source, sample('division').input)).toBe('3');
  });
  it('uppercase', () => {
    expect(runToEnd(sample('uppercase').source, sample('uppercase').input)).toBe('LORDALCOL');
  });
  it('breakpoint sample prints hello world when breakpoints are off', () => {
    expect(runToEnd(sample('breaksample').source, '', { breakpoints: false })).toBe('Hello World!\n');
  });
  it('brainfuck interpreter in brainfuck', () => {
    expect(runToEnd(sample('bfinterpreter').source, sample('bfinterpreter').input)).toBe('012345');
  });
  it('brainfuck to C translator', () => {
    const out = runToEnd(sample('ctranslator').source, sample('ctranslator').input);
    expect(out).toContain('#include');
    expect(out).toContain('read(0,');
  });
  it('squares', () => {
    const lines = runToEnd(sample('squares').source).trim().split('\n');
    expect(lines.length).toBe(101);
    expect(lines.at(-1)).toBe('10000');
  });
  it('numwarp halts with output', () => {
    expect(runToEnd(sample('numwarp').source, sample('numwarp').input).trim().length).toBeGreaterThan(0);
  });
  it('factorial keeps producing output', () => {
    const m = new Machine(sample('factorial').source);
    m.run(2_000_000);
    expect(m.takeOutput()).toMatch(/^1\n1\n2\n6\n24\n120\n/);
  });
});

describe('textToBrainfuck', () => {
  it.each(['Hello, World!', 'a', 'zzz AAA ~~~', 'line1\nline2\ttab', 'Ciao è ü — 🚀', ''])(
    'round-trips %j',
    (text) => {
      expect(runToEnd(textToBrainfuck(text))).toBe(text);
    },
  );
  it('only emits Brainfuck commands and whitespace', () => {
    expect(textToBrainfuck('Hello, World!')).toMatch(/^[<>+\-.[\]\s]*$/);
  });
});
