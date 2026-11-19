/**
 * Brainfuck virtual machine.
 *
 * The source is compiled once into a compact op list (comments are dropped)
 * with a precomputed bracket-jump table, so loops cost O(1) instead of the
 * character-by-character scanning the 2008 version did.
 *
 * Semantics:
 *  - 8-bit cells that wrap around (255 + 1 = 0).
 *  - The tape starts at 30 000 cells and grows on demand to the right.
 *    Moving left of cell 0 is an error.
 *  - Input and output are UTF-8 byte streams.
 *  - `#` is a breakpoint (ignored unless breakpoints are enabled).
 */

export type EofMode = 'zero' | 'unchanged' | 'max';

/** Why a call to `run` returned. */
export type StopReason = 'budget' | 'halted' | 'breakpoint' | 'input' | 'frame';

export class BfError extends Error {
  /** Index in the original source the error refers to. */
  readonly index: number;
  constructor(message: string, index: number) {
    super(message);
    this.name = 'BfError';
    this.index = index;
  }
}

export interface MachineOptions {
  /** What `,` stores when input is exhausted (and the machine won't wait). Default: `zero`. */
  eof?: EofMode;
  /** Pause on `#`. Default: true. */
  breakpoints?: boolean;
  /** When input runs out, stop with reason `input` instead of applying EOF. Default: false. */
  interactive?: boolean;
  /** Initial tape length. Default: 30 000. */
  tapeSize?: number;
  /**
   * Stop with reason `frame` just before outputting a byte that starts a new
   * animation frame (see `isFrameBoundary`), so the finished frame can be shown.
   * Default: false.
   */
  frameSync?: boolean;
}

const ESC = 0x1b;
const BRACKET = 0x5b; // [

/**
 * Bytes that mark a frame boundary: form feed (clear screen), backspace,
 * carriage return, and the final byte of ESC[H (cursor home) or ESC[2J (clear).
 * `tail` holds the previously output bytes, most recent in the low byte.
 */
export function isFrameBoundary(byte: number, tail: number): boolean {
  if (byte === 12 || byte === 8 || byte === 13) return true;
  if (byte === 0x48) return (tail & 0xffff) === ((ESC << 8) | BRACKET); // ESC [ H
  if (byte === 0x4a) return (tail & 0xffffff) === ((ESC << 16) | (BRACKET << 8) | 0x32); // ESC [ 2 J
  return false;
}

const OP_RIGHT = 0;
const OP_LEFT = 1;
const OP_INC = 2;
const OP_DEC = 3;
const OP_OUT = 4;
const OP_IN = 5;
const OP_OPEN = 6;
const OP_CLOSE = 7;
const OP_BREAK = 8;

const OP_OF: Record<string, number> = {
  '>': OP_RIGHT,
  '<': OP_LEFT,
  '+': OP_INC,
  '-': OP_DEC,
  '.': OP_OUT,
  ',': OP_IN,
  '[': OP_OPEN,
  ']': OP_CLOSE,
  '#': OP_BREAK,
};

/** Hard cap on tape growth, so a runaway `+[>+]` can't eat all the memory. */
export const MAX_TAPE = 1 << 24;

export interface Program {
  ops: Uint8Array;
  /** Source index of each op. */
  srcPos: Int32Array;
  /** For `[` / `]`: op index of the matching bracket. */
  jump: Int32Array;
}

export function compile(source: string): Program {
  const ops: number[] = [];
  const pos: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const op = OP_OF[source[i]!];
    if (op !== undefined) {
      ops.push(op);
      pos.push(i);
    }
  }
  const jump = new Int32Array(ops.length).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === OP_OPEN) {
      stack.push(i);
    } else if (ops[i] === OP_CLOSE) {
      const open = stack.pop();
      if (open === undefined) throw new BfError('Unmatched "]"', pos[i]!);
      jump[open] = i;
      jump[i] = open;
    }
  }
  if (stack.length > 0) throw new BfError('Unmatched "["', pos[stack.at(-1)!]!);
  return { ops: Uint8Array.from(ops), srcPos: Int32Array.from(pos), jump };
}

export class Machine {
  readonly source: string;
  readonly program: Program;
  tape: Uint8Array;
  ptr = 0;
  /** Index of the next op to execute. */
  pc = 0;
  steps = 0;
  /** Highest cell index visited. */
  maxPtr = 0;
  eof: EofMode;
  breakpoints: boolean;
  interactive: boolean;

  private input: number[] = [];
  private inputPos = 0;
  private inputClosed = false;
  frameSync: boolean;

  private out: number[] = [];
  /** Last output bytes, most recent in the low byte. */
  private tail = 0;
  /** The `.` at pc already yielded a frame; output it this time. */
  private frameYielded = false;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder('utf-8');

  constructor(source: string, options: MachineOptions = {}) {
    this.source = source;
    this.program = compile(source);
    this.tape = new Uint8Array(options.tapeSize ?? 30_000);
    this.eof = options.eof ?? 'zero';
    this.breakpoints = options.breakpoints ?? true;
    this.interactive = options.interactive ?? false;
    this.frameSync = options.frameSync ?? false;
  }

  get halted(): boolean {
    return this.pc >= this.program.ops.length;
  }

  /** Source index of the next instruction, or `source.length` once halted. */
  get sourceIndex(): number {
    return this.halted ? this.source.length : this.program.srcPos[this.pc]!;
  }

  /** Append text to the input stream. */
  feed(text: string): void {
    for (const b of this.encoder.encode(text)) this.input.push(b);
  }

  /** Signal end of input: further reads apply the EOF rule. */
  closeInput(): void {
    this.inputClosed = true;
  }

  get pendingInput(): number {
    return this.input.length - this.inputPos;
  }

  /** Decoded output produced since the last call. */
  takeOutput(): string {
    if (this.out.length === 0) return '';
    const bytes = Uint8Array.from(this.out);
    this.out.length = 0;
    return this.decoder.decode(bytes, { stream: true });
  }

  /** Execute at most `budget` instructions. */
  run(budget: number, frameSync = this.frameSync): StopReason {
    const { ops, jump, srcPos } = this.program;
    const n = ops.length;
    let tape = this.tape;
    let ptr = this.ptr;
    let pc = this.pc;
    let maxPtr = this.maxPtr;
    let executed = 0;
    let reason: StopReason = 'budget';

    try {
      while (executed < budget) {
        if (pc >= n) {
          reason = 'halted';
          break;
        }
        switch (ops[pc]) {
          case OP_RIGHT:
            ptr++;
            if (ptr >= tape.length) tape = this.grow(srcPos[pc]!);
            if (ptr > maxPtr) maxPtr = ptr;
            break;
          case OP_LEFT:
            if (ptr === 0) throw new BfError('Pointer moved left of cell 0', srcPos[pc]!);
            ptr--;
            break;
          case OP_INC:
            tape[ptr]!++;
            break;
          case OP_DEC:
            tape[ptr]!--;
            break;
          case OP_OUT: {
            const byte = tape[ptr]!;
            if (frameSync && !this.frameYielded && isFrameBoundary(byte, this.tail)) {
              this.frameYielded = true;
              reason = 'frame';
              return reason; // pc stays on `.`; the byte goes out on the next run
            }
            this.frameYielded = false;
            this.out.push(byte);
            this.tail = ((this.tail << 8) | byte) & 0xffffff;
            break;
          }
          case OP_IN:
            if (this.inputPos < this.input.length) {
              tape[ptr] = this.input[this.inputPos++]!;
            } else if (this.interactive && !this.inputClosed) {
              reason = 'input';
              return reason; // pc stays on `,` so it re-executes once input arrives
            } else if (this.eof === 'zero') {
              tape[ptr] = 0;
            } else if (this.eof === 'max') {
              tape[ptr] = 255;
            }
            break;
          case OP_OPEN:
            if (tape[ptr] === 0) pc = jump[pc]!;
            break;
          case OP_CLOSE:
            if (tape[ptr] !== 0) pc = jump[pc]!;
            break;
          case OP_BREAK:
            if (this.breakpoints) {
              pc++;
              executed++;
              reason = 'breakpoint';
              return reason;
            }
            break;
        }
        pc++;
        executed++;
      }
      if (pc >= n) reason = 'halted';
      return reason;
    } finally {
      this.ptr = ptr;
      this.pc = pc;
      this.maxPtr = maxPtr;
      this.steps += executed;
    }
  }

  private grow(at: number): Uint8Array {
    if (this.tape.length >= MAX_TAPE) {
      throw new BfError(`Tape limit of ${MAX_TAPE.toLocaleString('en-US')} cells exceeded`, at);
    }
    const bigger = new Uint8Array(Math.min(this.tape.length * 2, MAX_TAPE));
    bigger.set(this.tape);
    this.tape = bigger;
    return bigger;
  }
}

/** Run a program to completion with the given input and return its output. Handy for tests and tools. */
export function runToEnd(source: string, input = '', options: MachineOptions = {}, maxSteps = 1e9): string {
  const m = new Machine(source, { ...options, interactive: false });
  m.feed(input);
  let out = '';
  while (m.steps < maxSteps) {
    const reason = m.run(1_000_000);
    out += m.takeOutput();
    if (reason === 'halted') return out;
  }
  throw new Error(`Program did not halt within ${maxSteps} steps`);
}
