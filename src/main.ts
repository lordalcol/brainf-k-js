import '@fontsource-variable/inter';
import './style.css';
import { BfError, Machine, type EofMode, type StopReason } from './interpreter';
import { SAMPLES, type Sample } from './samples';
import { Terminal } from './terminal';
import { textToBrainfuck } from './text-to-bf';

type RunState = 'idle' | 'running' | 'paused' | 'input' | 'halted' | 'stopped' | 'error';

const STATE_LABEL: Record<RunState, string> = {
  idle: 'Ready',
  running: 'Running',
  paused: 'Paused',
  input: 'Waiting for input',
  halted: 'Finished',
  stopped: 'Stopped',
  error: 'Error',
};

const TAPE_VIEW_MAX = 240;
const TAPE_VIEW_MIN = 32;

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const ui = {
  source: $<HTMLTextAreaElement>('source'),
  highlight: $<HTMLPreElement>('highlight'),
  cursorPos: $('cursor-pos'),
  stdin: $<HTMLTextAreaElement>('stdin'),
  interactive: $<HTMLInputElement>('interactive'),
  stdout: $<HTMLPreElement>('stdout'),
  clearOut: $<HTMLButtonElement>('clear-out'),
  prompt: $<HTMLFormElement>('prompt'),
  promptInput: $<HTMLInputElement>('prompt-input'),
  promptHint: $('prompt-hint'),
  eofBtn: $<HTMLButtonElement>('eof-btn'),
  runBtn: $<HTMLButtonElement>('run-btn'),
  runLabel: $('run-label'),
  pauseBtn: $<HTMLButtonElement>('pause-btn'),
  stepBtn: $<HTMLButtonElement>('step-btn'),
  stopBtn: $<HTMLButtonElement>('stop-btn'),
  fps: $<HTMLSelectElement>('fps'),
  wrap: $<HTMLInputElement>('wrap'),
  autoAdvance: $<HTMLInputElement>('auto-advance'),
  speed: $<HTMLSelectElement>('speed'),
  eof: $<HTMLSelectElement>('eof'),
  breakpoints: $<HTMLInputElement>('breakpoints'),
  status: $('status'),
  error: $('error'),
  stSteps: $('st-steps'),
  stPos: $('st-pos'),
  stOp: $('st-op'),
  stPtr: $('st-ptr'),
  stCell: $('st-cell'),
  tape: $('tape'),
  sampleList: $('sample-list'),
  sampleInfo: $('sample-info'),
  t2bOpen: $<HTMLButtonElement>('t2b-open'),
  t2bDialog: $<HTMLDialogElement>('t2b-dialog'),
  t2bText: $<HTMLTextAreaElement>('t2b-text'),
  t2bOut: $<HTMLPreElement>('t2b-out'),
  t2bLen: $('t2b-len'),
  shareBtn: $<HTMLButtonElement>('share-btn'),
  themeBtn: $<HTMLButtonElement>('theme-btn'),
  toast: $('toast'),
};

// ---------------------------------------------------------------------------
// Storage (best effort: private windows may block it)

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`bfjs:${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(`bfjs:${key}`, value);
    } catch {
      /* ignore */
    }
  },
};

// ---------------------------------------------------------------------------
// Execution state

let machine: Machine | null = null;
let state: RunState = 'idle';
let timer: number | undefined;
let lastTick = 0;
let stepCredit = 0;
/** Whether to resume running (vs. stay paused) after the input prompt is answered. */
let resumeAfterInput = false;
let errorIndex = -1;
/** With frame sync, don't run again before this time (performance.now() ms). */
let nextFrameAt = 0;
const term = new Terminal();
/** Auto-advance pressed Enter: clear the screen when the program next prints. */
let clearBeforeOutput = false;

const speed = () => Number(ui.speed.value);
const fps = () => Number(ui.fps.value);

function createMachine(): boolean {
  stopTimer();
  clearOutput();
  setError(null);
  try {
    machine = new Machine(ui.source.value, {
      eof: ui.eof.value as EofMode,
      breakpoints: ui.breakpoints.checked,
      interactive: ui.interactive.checked,
      frameSync: fps() > 0,
    });
  } catch (e) {
    machine = null;
    fail(e);
    return false;
  }
  machine.feed(ui.stdin.value);
  return true;
}

function needsFreshMachine(): boolean {
  return !machine || state === 'idle' || state === 'halted' || state === 'stopped' || state === 'error';
}

function run(): void {
  if (state === 'running') return;
  if (state === 'input') {
    resumeAfterInput = true;
    ui.promptInput.focus();
    return;
  }
  if (needsFreshMachine() && !createMachine()) return;
  setState('running');
  lastTick = performance.now();
  stepCredit = 0;
  nextFrameAt = 0;
  schedule(0);
}

function pause(): void {
  if (state !== 'running') return;
  stopTimer();
  setState('paused');
}

function step(): void {
  if (state === 'running') {
    pause();
    return;
  }
  if (state === 'input') {
    resumeAfterInput = false;
    ui.promptInput.focus();
    return;
  }
  if (needsFreshMachine()) {
    if (!createMachine()) return;
    setState('paused');
  }
  execute(1, false); // a single step always executes, even across a frame boundary
  render(true);
}

function stop(): void {
  if (state === 'idle' || state === 'halted' || state === 'stopped' || state === 'error') return;
  stopTimer();
  setState('stopped');
}

function reset(): void {
  stopTimer();
  machine = null;
  setError(null);
  setState('idle');
}

function schedule(delay: number): void {
  timer = window.setTimeout(tick, delay);
}

function stopTimer(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function tick(): void {
  timer = undefined;
  if (state !== 'running' || !machine) return;
  const now = performance.now();
  if (now < nextFrameAt - 1) {
    schedule(nextFrameAt - now); // frame sync: hold the current frame on screen
    return;
  }
  const s = speed();
  let reason: StopReason = 'budget';
  if (s === Infinity) {
    const deadline = now + 14;
    do reason = execute(250_000);
    while (reason === 'budget' && state === 'running' && performance.now() < deadline);
  } else {
    stepCredit = Math.min(stepCredit + ((now - lastTick) * s) / 1000, Math.max(1, s / 4));
    const n = Math.floor(stepCredit);
    stepCredit -= n;
    if (n > 0) reason = execute(n);
  }
  if (reason === 'frame') nextFrameAt = now + 1000 / (fps() > 0 ? fps() : 10);
  lastTick = now;
  render(s !== Infinity);
  if (state === 'running') schedule(Math.max(s === Infinity ? 0 : 16, nextFrameAt - now));
}

/** Run up to `budget` instructions and translate the stop reason into UI state. */
function execute(budget: number, frameSync?: boolean): StopReason {
  if (!machine) return 'halted';
  let reason: StopReason;
  try {
    reason = machine.run(budget, frameSync);
  } catch (e) {
    fail(e);
    return 'halted';
  }
  const out = machine.takeOutput();
  if (out && clearBeforeOutput) {
    term.reset(); // auto-advance: the new screen replaces the old one
    clearBeforeOutput = false;
  }
  term.write(out);
  if (reason === 'input' && ui.autoAdvance.checked) {
    // Press Enter for the program, one frame from now.
    machine.feed('\n');
    clearBeforeOutput = true;
    return 'frame';
  }
  switch (reason) {
    case 'halted':
      stopTimer();
      setState('halted');
      break;
    case 'breakpoint':
      stopTimer();
      setState('paused');
      toast('Breakpoint hit. Step (F10) or Run (Ctrl+Enter) to continue');
      break;
    case 'input':
      resumeAfterInput = state === 'running';
      stopTimer();
      setState('input');
      break;
  }
  return reason;
}

function fail(e: unknown): void {
  stopTimer();
  setError(e instanceof Error ? e.message : String(e), e instanceof BfError ? e.index : -1);
  setState('error');
}

function submitInput(text: string | null): void {
  if (!machine || state !== 'input') return;
  if (text === null) machine.closeInput();
  else machine.feed(text + '\n');
  ui.promptInput.value = '';
  if (resumeAfterInput) {
    setState('running');
    lastTick = performance.now();
    schedule(0);
  } else {
    setState('paused');
    execute(1);
    render(true);
  }
}

// ---------------------------------------------------------------------------
// Rendering

function setState(next: RunState): void {
  state = next;
  const active = next === 'running' || next === 'paused' || next === 'input';
  ui.status.dataset.state = next;
  ui.status.textContent = STATE_LABEL[next];
  ui.runLabel.textContent = next === 'paused' || next === 'input' ? 'Continue' : 'Run';
  ui.runBtn.disabled = next === 'running';
  ui.pauseBtn.disabled = next !== 'running';
  ui.stopBtn.disabled = !active;
  ui.source.readOnly = next === 'running';
  ui.prompt.hidden = next !== 'input';
  if (next === 'input') ui.promptHint.textContent = inputHint();
  if (next === 'input') queueMicrotask(() => ui.promptInput.focus());
  render(next !== 'running');
}

function setError(message: string | null, index = -1): void {
  errorIndex = message ? index : -1;
  ui.error.hidden = !message;
  ui.error.textContent = message ?? '';
}

function clearOutput(): void {
  term.reset();
  renderOutput();
}

/** Draw the terminal screen into the output panel (only when it changed). */
function renderOutput(): void {
  if (!term.takeDirty()) return;
  const el = ui.stdout;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  if (!term.styled) {
    el.textContent = term.text();
  } else {
    const frag = document.createDocumentFragment();
    term.lines().forEach((runs, i) => {
      if (i > 0) frag.append('\n');
      for (const run of runs) {
        if (run.fg < 0 && !run.bold) {
          frag.append(run.text);
          continue;
        }
        const span = document.createElement('span');
        if (run.fg >= 0) span.style.color = `var(--ansi-${run.fg})`;
        if (run.bold) span.style.fontWeight = '700';
        span.textContent = run.text;
        frag.append(span);
      }
    });
    el.replaceChildren(frag);
  }
  if (nearBottom) el.scrollTop = el.scrollHeight;
}

let lineStarts: number[] = [0];

function computeLineStarts(src: string): void {
  lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) lineStarts.push(i + 1);
}

function lineCol(index: number): { line: number; col: number; visualCol: number } {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= index) lo = mid;
    else hi = mid - 1;
  }
  const start = lineStarts[lo]!;
  const src = ui.source.value;
  let visualCol = 0;
  for (let i = start; i < index; i++) visualCol = src[i] === '\t' ? (Math.floor(visualCol / 4) + 1) * 4 : visualCol + 1;
  return { line: lo, col: index - start, visualCol };
}

const TOKEN_CLASS: Record<string, string> = {
  '>': 't-move',
  '<': 't-move',
  '+': 't-math',
  '-': 't-math',
  '.': 't-io',
  ',': 't-io',
  '[': 't-loop',
  ']': 't-loop',
  '#': 't-break',
};

const cursorBox = document.createElement('div');
cursorBox.className = 'cursor-box';

/** Syntax-highlight the source into the backdrop layer. */
function paintSource(): void {
  const src = ui.source.value;
  computeLineStarts(src);
  const frag = document.createDocumentFragment();
  let plain = '';
  let runClass = '';
  let run = '';
  const flushRun = () => {
    if (!run) return;
    const span = document.createElement('span');
    span.className = runClass;
    span.textContent = run;
    frag.append(span);
    run = '';
  };
  for (const ch of src) {
    const cls = TOKEN_CLASS[ch];
    if (cls) {
      if (plain) {
        frag.append(plain);
        plain = '';
      }
      if (cls !== runClass) flushRun();
      runClass = cls;
      run += ch;
    } else {
      flushRun();
      plain += ch;
    }
  }
  flushRun();
  // Trailing space so a final newline still gets a line (matches the textarea).
  frag.append(plain + ' ');
  ui.highlight.replaceChildren(frag, cursorBox);
  syncScroll();
}

function syncScroll(): void {
  ui.highlight.scrollTop = ui.source.scrollTop;
  ui.highlight.scrollLeft = ui.source.scrollLeft;
}

function placeCursorBox(follow: boolean): void {
  let index = -1;
  let isError = false;
  if (state === 'error' && errorIndex >= 0) {
    index = errorIndex;
    isError = true;
  } else if (machine && (state === 'paused' || state === 'input' || (state === 'running' && speed() !== Infinity))) {
    index = machine.sourceIndex;
  }
  if (index < 0 || index >= ui.source.value.length) {
    cursorBox.hidden = true;
    return;
  }
  const { line, visualCol } = lineCol(index);
  cursorBox.hidden = false;
  cursorBox.classList.toggle('error', isError);
  cursorBox.style.top = `calc(12px + ${line} * 1.6em)`;
  cursorBox.style.left = `calc(14px + ${visualCol}ch)`;
  if (follow) {
    // Keep the current instruction in view.
    const ta = ui.source;
    const top = cursorBox.offsetTop;
    const left = cursorBox.offsetLeft;
    const margin = 40;
    if (top < ta.scrollTop + margin) ta.scrollTop = Math.max(0, top - margin);
    else if (top + cursorBox.offsetHeight > ta.scrollTop + ta.clientHeight - margin)
      ta.scrollTop = top - ta.clientHeight + margin * 2;
    if (left < ta.scrollLeft + margin) ta.scrollLeft = Math.max(0, left - margin);
    else if (left > ta.scrollLeft + ta.clientWidth - margin) ta.scrollLeft = left - ta.clientWidth + margin * 2;
    syncScroll();
  }
}

const tapeCells: HTMLDivElement[] = [];

function cellChar(v: number): string {
  if (v === 10) return '↵';
  if (v === 9) return '⇥';
  if (v === 32) return '␠';
  if (v > 32 && v < 127) return String.fromCharCode(v);
  return '';
}

function renderTape(): void {
  const tape = machine?.tape;
  const ptr = machine?.ptr ?? 0;
  const highest = Math.max(machine?.maxPtr ?? 0, ptr);
  let start = 0;
  let count = Math.max(TAPE_VIEW_MIN, highest + 1);
  if (count > TAPE_VIEW_MAX) {
    start = Math.max(0, Math.min(ptr - TAPE_VIEW_MAX / 2, highest + 1 - TAPE_VIEW_MAX));
    count = TAPE_VIEW_MAX;
  }
  while (tapeCells.length < count) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'listitem');
    cell.innerHTML = '<span class="v"></span><span class="c"></span><span class="i"></span>';
    tapeCells.push(cell);
  }
  if (ui.tape.childElementCount !== count) ui.tape.replaceChildren(...tapeCells.slice(0, count));
  for (let k = 0; k < count; k++) {
    const i = start + k;
    const v = tape?.[i] ?? 0;
    const cell = tapeCells[k]!;
    const [vEl, cEl, iEl] = cell.children as unknown as [HTMLElement, HTMLElement, HTMLElement];
    const vs = String(v);
    if (vEl.textContent !== vs) vEl.textContent = vs;
    const cs = cellChar(v);
    if (cEl.textContent !== cs) cEl.textContent = cs;
    const is = String(i);
    if (iEl.textContent !== is) iEl.textContent = is;
    cell.classList.toggle('zero', v === 0);
    const isPtr = i === ptr;
    if (cell.classList.toggle('ptr', isPtr) && isPtr && state !== 'running') {
      // Scroll only the tape box (scrollIntoView would also scroll the page).
      const box = ui.tape;
      if (cell.offsetTop < box.scrollTop) box.scrollTop = cell.offsetTop;
      else if (cell.offsetTop + cell.offsetHeight > box.scrollTop + box.clientHeight)
        box.scrollTop = cell.offsetTop + cell.offsetHeight - box.clientHeight;
    }
  }
}

function render(follow = false): void {
  const m = machine;
  ui.stSteps.textContent = (m?.steps ?? 0).toLocaleString('en-US');
  ui.stPtr.textContent = String(m?.ptr ?? 0);
  const v = m?.tape[m.ptr] ?? 0;
  const c = cellChar(v);
  ui.stCell.textContent = c ? `${v} '${c}'` : String(v);
  if (m && !m.halted) {
    const { line, col } = lineCol(m.sourceIndex);
    ui.stPos.textContent = `${line + 1}:${col + 1}`;
    ui.stOp.textContent = m.source[m.sourceIndex] ?? '–';
  } else {
    ui.stPos.textContent = m ? 'end' : '–';
    ui.stOp.textContent = '–';
  }
  renderOutput();
  renderTape();
  placeCursorBox(follow);
}

function updateCursorPos(): void {
  const { line, col } = lineCol(ui.source.selectionStart);
  ui.cursorPos.textContent = `Ln ${line + 1}, Col ${col + 1}`;
}

// ---------------------------------------------------------------------------
// Samples

let currentSample: string | null = null;

const DEFAULT_STDIN_PLACEHOLDER = 'Bytes read by , (optional)';
const GENERIC_INPUT_HINT =
  'Type text and press Enter or Send (a newline is added). Press EOF to tell the program the input has ended.';

/** What to type at the prompt: the sample's own tip, or a generic one for your own programs. */
function inputHint(): string {
  return SAMPLES.find((x) => x.id === currentSample)?.inputHint ?? GENERIC_INPUT_HINT;
}

function renderSamples(): void {
  const groups = new Map<string, Sample[]>();
  for (const s of SAMPLES) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  const frag = document.createDocumentFragment();
  for (const [group, items] of groups) {
    const h = document.createElement('h3');
    h.textContent = group;
    frag.append(h);
    for (const s of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.title;
      b.dataset.id = s.id;
      b.addEventListener('click', () => loadSample(s));
      frag.append(b);
    }
  }
  ui.sampleList.replaceChildren(frag);
}

function markSample(id: string | null): void {
  currentSample = id;
  ui.stdin.placeholder = SAMPLES.find((x) => x.id === id)?.inputHint ?? DEFAULT_STDIN_PLACEHOLDER;
  for (const b of ui.sampleList.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-current', String(b.dataset.id === id));
  }
  const s = SAMPLES.find((x) => x.id === id);
  ui.sampleInfo.replaceChildren();
  if (!s) return;
  ui.sampleInfo.append(s.description);
  if (s.credit) {
    const a = document.createElement('a');
    a.href = s.credit.url;
    a.textContent = s.credit.name;
    ui.sampleInfo.append(' Source: ', a, '.');
  }
}

function setWrap(on: boolean): void {
  ui.wrap.checked = on;
  ui.stdout.classList.toggle('wrap', on);
  store.set('wrap', String(on));
}

function applySampleSettings(s: Sample): void {
  ui.interactive.checked = s.settings?.interactive ?? true;
  store.set('interactive', String(ui.interactive.checked));
  setWrap(s.settings?.wrap ?? false);
  ui.autoAdvance.checked = s.settings?.autoAdvance ?? false;
  const f = s.settings?.fps;
  if (f !== undefined && [...ui.fps.options].some((o) => o.value === String(f))) {
    ui.fps.value = String(f);
    store.set('fps', ui.fps.value);
  }
}

function loadSample(s: Sample): void {
  applySampleSettings(s);
  setSource(s.source, s.input ?? '');
  markSample(s.id);
  store.set('sample', s.id);
  ui.source.focus({ preventScroll: true });
  ui.source.setSelectionRange(0, 0);
  ui.source.scrollTop = 0;
  syncScroll();
}

function setSource(source: string, input: string): void {
  ui.source.value = source;
  ui.stdin.value = input;
  store.set('source', source);
  store.set('input', input);
  reset();
  clearOutput();
  paintSource();
  updateCursorPos();
  render();
}

// ---------------------------------------------------------------------------
// Sharing

function toBase64Url(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replaceAll('-', '+').replaceAll('_', '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function readHash(): { source: string; input: string } | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const code = params.get('code');
  if (code === null) return null;
  try {
    return { source: fromBase64Url(code), input: fromBase64Url(params.get('in') ?? '') };
  } catch {
    return null;
  }
}

async function share(): Promise<void> {
  const params = new URLSearchParams({ code: toBase64Url(ui.source.value) });
  if (ui.stdin.value) params.set('in', toBase64Url(ui.stdin.value));
  const url = `${location.origin}${location.pathname}#${params}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied to clipboard');
  } catch {
    toast('Link is in the address bar');
  }
}

let toastTimer: number | undefined;
function toast(message: string): void {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 2600);
}

// ---------------------------------------------------------------------------
// Theme

const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  ui.themeBtn.title = `Theme: ${theme} (click to change)`;
  ui.themeBtn.setAttribute('aria-label', ui.themeBtn.title);
}

// ---------------------------------------------------------------------------
// Text → Brainfuck dialog

function updateT2b(): void {
  const code = textToBrainfuck(ui.t2bText.value);
  ui.t2bOut.textContent = code;
  ui.t2bLen.textContent = `${code.replace(/\s/g, '').length} instructions`;
}

// ---------------------------------------------------------------------------
// Wiring

ui.runBtn.addEventListener('click', run);
ui.pauseBtn.addEventListener('click', pause);
ui.stepBtn.addEventListener('click', step);
ui.stopBtn.addEventListener('click', stop);
ui.clearOut.addEventListener('click', clearOutput);

ui.source.addEventListener('input', () => {
  if (state !== 'idle') reset();
  if (currentSample) markSample(null);
  store.set('source', ui.source.value);
  paintSource();
  updateCursorPos();
});
ui.source.addEventListener('scroll', syncScroll);
for (const ev of ['keyup', 'click', 'select'] as const) ui.source.addEventListener(ev, updateCursorPos);
ui.stdin.addEventListener('input', () => store.set('input', ui.stdin.value));

ui.breakpoints.addEventListener('change', () => {
  if (machine) machine.breakpoints = ui.breakpoints.checked;
  store.set('breakpoints', String(ui.breakpoints.checked));
});
ui.interactive.addEventListener('change', () => {
  if (machine) machine.interactive = ui.interactive.checked;
  store.set('interactive', String(ui.interactive.checked));
});
ui.eof.addEventListener('change', () => {
  if (machine) machine.eof = ui.eof.value as EofMode;
  store.set('eof', ui.eof.value);
});
ui.wrap.addEventListener('change', () => setWrap(ui.wrap.checked));
ui.autoAdvance.addEventListener('change', () => {
  // Turned on while the program is waiting: answer it now and keep going.
  if (ui.autoAdvance.checked && state === 'input') {
    resumeAfterInput = true;
    clearBeforeOutput = true;
    submitInput('');
  }
});
ui.fps.addEventListener('change', () => {
  if (machine) machine.frameSync = fps() > 0;
  nextFrameAt = 0;
  store.set('fps', ui.fps.value);
});
ui.speed.addEventListener('change', () => {
  store.set('speed', ui.speed.value);
  stepCredit = 0;
  render(true);
});

ui.prompt.addEventListener('submit', (e) => {
  e.preventDefault();
  submitInput(ui.promptInput.value);
});
ui.eofBtn.addEventListener('click', () => submitInput(null));

ui.shareBtn.addEventListener('click', () => void share());

ui.themeBtn.addEventListener('click', () => {
  const current = (store.get('theme') as Theme | null) ?? 'system';
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]!;
  store.set('theme', next);
  applyTheme(next);
});

ui.t2bOpen.addEventListener('click', () => {
  updateT2b();
  ui.t2bDialog.showModal();
  ui.t2bText.select();
});
ui.t2bText.addEventListener('input', updateT2b);
ui.t2bDialog.addEventListener('close', () => {
  if (ui.t2bDialog.returnValue !== 'insert') return;
  setSource(textToBrainfuck(ui.t2bText.value), '');
  markSample(null);
});

document.addEventListener('keydown', (e) => {
  if (ui.t2bDialog.open) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    run();
  } else if (e.key === 'F10') {
    e.preventDefault();
    step();
  } else if (e.key === 'F8') {
    e.preventDefault();
    if (state === 'running') pause();
    else run();
  } else if (e.key === 'F5' && e.shiftKey) {
    e.preventDefault();
    stop();
  }
});

window.addEventListener('hashchange', () => {
  const shared = readHash();
  if (shared) {
    setSource(shared.source, shared.input);
    markSample(null);
  }
});

// ---------------------------------------------------------------------------
// Boot

applyTheme((store.get('theme') as Theme | null) ?? 'system');
renderSamples();

setWrap(store.get('wrap') === 'true');
const savedFps = store.get('fps');
if (savedFps && [...ui.fps.options].some((o) => o.value === savedFps)) ui.fps.value = savedFps;
const savedSpeed = store.get('speed');
if (savedSpeed && [...ui.speed.options].some((o) => o.value === savedSpeed)) ui.speed.value = savedSpeed;
const savedEof = store.get('eof');
if (savedEof && [...ui.eof.options].some((o) => o.value === savedEof)) ui.eof.value = savedEof;
ui.breakpoints.checked = store.get('breakpoints') !== 'false';
ui.interactive.checked = store.get('interactive') !== 'false';

const shared = readHash();
const savedSource = store.get('source');
if (shared) {
  setSource(shared.source, shared.input);
} else if (savedSource !== null) {
  setSource(savedSource, store.get('input') ?? '');
  const id = store.get('sample');
  const s = SAMPLES.find((x) => x.id === id);
  if (s && s.source === savedSource) markSample(s.id);
} else {
  loadSample(SAMPLES.find((s) => s.id === 'helloworld')!);
}
setState('idle');
