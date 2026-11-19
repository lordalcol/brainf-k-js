// @vitest-environment happy-dom
/**
 * Smoke tests for the page: load the real index.html, boot main.ts, and
 * drive it through the buttons like a user would. Runs headless in CI.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import html from '../index.html?raw';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const status = () => $('status').textContent;
const output = () => $('stdout').textContent ?? '';

async function until(check: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Timed out; status is "${status()}"`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

function loadSample(id: string): void {
  const button = document.querySelector<HTMLButtonElement>(`#sample-list button[data-id="${id}"]`);
  if (!button) throw new Error(`no sample button ${id}`);
  button.click();
}

beforeAll(async () => {
  localStorage.clear();
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)![1]!;
  await import('./main');
});

describe('page', () => {
  it('boots with the Hello World sample and every sample listed', () => {
    expect(status()).toBe('Ready');
    expect($<HTMLTextAreaElement>('source').value).toContain('++++++++++');
    expect(document.querySelectorAll('#sample-list button').length).toBeGreaterThanOrEqual(20);
  });

  it('runs a program to completion', async () => {
    loadSample('helloworld');
    $('run-btn').click();
    await until(() => status() === 'Finished');
    expect(output()).toBe('Hello World!\n');
  });

  it('pauses on a breakpoint and steps', async () => {
    loadSample('breaksample');
    $('run-btn').click();
    await until(() => status() === 'Paused');
    expect(output()).toBe('Hel');
    $('step-btn').click();
    expect(output()).toBe('Hell');
    expect($('st-op').textContent).toBe('+');
    $('run-btn').click();
    await until(() => status() === 'Finished');
    expect(output()).toBe('Hello World!\n');
  });

  it('asks for input when it runs out and continues', async () => {
    loadSample('uppercase');
    const stdin = $<HTMLTextAreaElement>('stdin');
    stdin.value = '';
    stdin.dispatchEvent(new Event('input'));
    $('run-btn').click();
    await until(() => status() === 'Waiting for input');
    expect($('prompt').hidden).toBe(false);
    $<HTMLInputElement>('prompt-input').value = 'brainfuck';
    $<HTMLFormElement>('prompt').requestSubmit();
    await until(() => status() === 'Finished');
    expect(output()).toBe('BRAINFUCK');
  });

  it('plays an animation in place with frame sync', async () => {
    loadSample('progress');
    const fps = $<HTMLSelectElement>('fps');
    fps.value = '60';
    fps.dispatchEvent(new Event('change'));
    $('run-btn').click();
    await until(() => output().includes('#'));
    // Mid-animation the screen holds one frame: a single bar, not 40 of them.
    expect(output().match(/\[/g)).toHaveLength(1);
    await until(() => status() === 'Finished', 10_000);
    expect(output()).toContain(`[${'#'.repeat(40)}]`);
    expect(output()).toContain('Done!');
  }, 15_000);

  it('renders ANSI colours as styled spans', async () => {
    loadSample('rainbow');
    $('run-btn').click();
    await until(() => document.querySelector('#stdout span') !== null);
    $('stop-btn').click();
    expect(status()).toBe('Stopped');
    const span = document.querySelector<HTMLSpanElement>('#stdout span')!;
    expect(span.style.color).toMatch(/var\(--ansi-\d\)/);
  });

  it('Game of Life plays by itself with Auto-Enter, one board at a time', async () => {
    loadSample('life');
    expect($<HTMLInputElement>('auto-advance').checked).toBe(true);
    $('run-btn').click();
    const boards = new Set<string>();
    await until(() => {
      if (output().includes('j----------')) boards.add(output());
      return boards.size >= 3;
    });
    expect(status()).toBe('Running');
    expect(output().match(/abcdefghij/g)).toHaveLength(1); // redrawn in place
    $('stop-btn').click();
  });

  it('shows what to type when a program waits for input', async () => {
    loadSample('tictactoe');
    expect($<HTMLTextAreaElement>('stdin').placeholder).toContain('empty square');
    $('run-btn').click();
    await until(() => status() === 'Waiting for input');
    expect($('prompt-hint').textContent).toContain('The number of an empty square, 1 to 9');
    $('stop-btn').click();

    // Your own program gets a generic tip.
    const source = $<HTMLTextAreaElement>('source');
    source.value = ',.';
    source.dispatchEvent(new Event('input'));
    $('run-btn').click();
    await until(() => status() === 'Waiting for input');
    expect($('prompt-hint').textContent).toContain('Press EOF');
    $('stop-btn').click();
  });

  it('reports unmatched brackets', () => {
    const source = $<HTMLTextAreaElement>('source');
    source.value = '+[';
    source.dispatchEvent(new Event('input'));
    $('run-btn').click();
    expect(status()).toBe('Error');
    expect($('error').textContent).toContain('Unmatched "["');
  });
});
