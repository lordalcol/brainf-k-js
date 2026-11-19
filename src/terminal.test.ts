import { describe, expect, it } from 'vitest';
import { Terminal } from './terminal';

const screen = (...chunks: string[]) => {
  const t = new Terminal();
  for (const c of chunks) t.write(c);
  return t;
};

describe('Terminal', () => {
  it('prints plain text and newlines', () => {
    expect(screen('ab\ncd').text()).toBe('ab\ncd');
  });

  it('backspace moves left so the next character overwrites', () => {
    expect(screen('abc\b\bX').text()).toBe('aXc');
    expect(screen('ab\b \b').text()).toBe('a ');
    expect(screen('\b\bx').text()).toBe('x');
  });

  it('carriage return goes back to column 0', () => {
    expect(screen('10%\r55%').text()).toBe('55%');
  });

  it('form feed clears the screen', () => {
    expect(screen('frame 1\nmore\fframe 2').text()).toBe('frame 2');
  });

  it('tab moves to the next multiple of 8', () => {
    expect(screen('a\tb').text()).toBe('a       b');
  });

  it('handles ANSI clear, home and cursor position', () => {
    expect(screen('junk\x1b[2J\x1b[Hok').text()).toBe('ok');
    expect(screen('\x1b[3;5H*').text()).toBe('\n\n    *');
    expect(screen('hello\x1b[1;2HE').text()).toBe('hEllo');
  });

  it('handles relative cursor moves and erase in line', () => {
    expect(screen('abcdef\x1b[3DX').text()).toBe('abcXef');
    expect(screen('abcdef\x1b[3D\x1b[K').text()).toBe('abc');
    expect(screen('a\nb\x1b[AZ').text()).toBe('aZ\nb');
  });

  it('works when an escape sequence is split across writes', () => {
    expect(screen('old\x1b', '[2', 'J\x1b[', 'Hnew').text()).toBe('new');
  });

  it('tracks colours and bold as runs', () => {
    const t = screen('\x1b[31mred\x1b[0m plain \x1b[1;94mbold blue');
    expect(t.styled).toBe(true);
    expect(t.lines()[0]).toEqual([
      { text: 'red', fg: 1, bold: false },
      { text: ' plain ', fg: -1, bold: false },
      { text: 'bold blue', fg: 12, bold: true },
    ]);
  });

  it('ignores private modes, unknown escapes and other control characters', () => {
    expect(screen('\x1b[?25la\x00b\x07\x1b(Bc').text()).toBe('abc');
  });

  it('keeps a bounded number of lines', () => {
    const t = screen('x\n'.repeat(5000));
    expect(t.text().split('\n').length).toBeLessThanOrEqual(2001);
  });

  it('reports changes once', () => {
    const t = new Terminal();
    t.takeDirty();
    expect(t.takeDirty()).toBe(false);
    t.write('a');
    expect(t.takeDirty()).toBe(true);
    expect(t.takeDirty()).toBe(false);
  });
});
