# Brainfuck JS

A Brainfuck interpreter and step debugger that runs in the browser. Originally written in 2008, rebuilt in 2026 with Vite and TypeScript.

## Features

- **Fast interpreter**: the source is compiled to an op list with a precomputed bracket-jump table. It runs hundreds of millions of instructions per second in time slices, so the page stays responsive.
- **Debugger**: Run, Pause, Step (F10) and Stop. `#` sets a breakpoint. The current instruction is highlighted in the editor, and the memory tape shows each cell's value, character and pointer.
- **Speed control**: from max speed down to 4 instructions per second, so you can watch a program run.
- **Input**: pre-fill the input box, and/or get an inline prompt when the input runs out. EOF can be set to 0, "no change" or 255.
- **UTF-8**: input and output are UTF-8 byte streams.
- **Text → Brainfuck**: generates a compact program that prints any text.
- **Share links**: the program and its input are encoded in the URL hash.
- **Terminal output**: `\b` backspace, `\r` carriage return, `\f` (byte 12) clear screen, and ANSI codes for cursor movement, clearing and 16 colours (`ESC[31m`, …).
- **Animation**: with frame sync on (the Frames setting), the interpreter holds each frame for one tick before every clear screen, cursor home, backspace or carriage return. Programs animate at a steady frame rate however fast the interpreter is.
- **Samples**: animations (typewriter, progress bar, bouncing ball, rainbow), showcase programs (Mandelbrot, Sierpinski, digits of e, …), games (tic-tac-toe, Game of Life, Ghost) and the classics.
- Syntax highlighting, light/dark theme, responsive layout. Your work is saved in localStorage.

## Writing an animation

Print byte 12 (form feed) to clear the screen, then draw the frame. This spinner runs forever:

```
++++++++++[>++++++++++++>+++++>++++>+++++++++<<<<-]   cells 1 to 4 = 120 50 40 90
>++++>--->+++++>++<<<<                               fix them up to the spinner characters
++++++++++++                                         cell 0 = 12 = form feed
[.>.<.>>.<<.>>>.<<<.>>>>.<<<<]                       clear and draw each character in turn
```

See `src/animations.ts` for complete, commented examples.

Semantics: 8-bit wrapping cells, and a tape that starts at 30,000 cells and grows to the right on demand. Moving left of cell 0 is an error.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # all tests (Vitest), headless
npm run build      # type-check and build static files into dist/
```

Tests cover the interpreter, the terminal emulator, frame sync and every sample. There are also UI smoke tests that load the real page in [happy-dom](https://github.com/capricorn86/happy-dom) and click through it. GitHub Actions (`.github/workflows/ci.yml`) runs the type check, the tests and the build on every push and pull request.

The build uses relative paths, so you can host `dist/` from any static host or sub-path (GitHub Pages, Netlify, etc.).

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Ctrl/⌘ + Enter | Run / continue |
| F8 | Pause / continue |
| F10 | Step one instruction |
| Shift + F5 | Stop |

## Credits

Example programs from [Wikipedia](https://en.wikipedia.org/wiki/Brainfuck), [Daniel B. Cristofani](https://brainfuck.org/) (the files in `src/samples/` are under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as noted in their headers) and Erik Bosman (Mandelbrot).

## License

The code is under the [MIT License](LICENSE). The example programs in `src/samples/` keep their own licences, listed under Credits.
