import { bouncingBall, progressBar, rainbow, typewriterDemo } from './animations';
import e from './samples/e.b?raw';
import ghost from './samples/ghost.b?raw';
import golden from './samples/golden.b?raw';
import life from './samples/life.b?raw';
import mandelbrot from './samples/mandelbrot.b?raw';
import sierpinski from './samples/sierpinski.b?raw';
import tictactoe from './samples/tictactoe.b?raw';
import xmastree from './samples/xmastree.b?raw';

export interface Sample {
  id: string;
  title: string;
  group: 'Animations' | 'Showcase' | 'Games' | 'Basics' | 'Debugging' | 'Tools';
  description: string;
  source: string;
  input?: string;
  /** Shown when the program waits for input: what to type. */
  inputHint?: string;
  credit?: { name: string; url: string };
  /** Settings applied when the sample is loaded. */
  settings?: {
    /** Frame rate for frame sync; 0 turns it off. */
    fps?: number;
    /** Ask for more input when it runs out (otherwise EOF). */
    interactive?: boolean;
    /** Wrap long output lines. Default: false. */
    wrap?: boolean;
    /** When the program waits for input, press Enter for it once per frame. Default: false. */
    autoAdvance?: boolean;
  };
}

const WIKIPEDIA = { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Brainfuck' };
const CRISTOFANI = { name: 'Daniel B. Cristofani (CC BY-SA 4.0)', url: 'https://brainfuck.org/' };
const BOSMAN = { name: 'Erik Bosman', url: 'https://github.com/erikdubbelboer/brainfuck-jit' };

export const SAMPLES: Sample[] = [
  {
    id: 'typewriter',
    title: 'Typewriter',
    group: 'Animations',
    description: 'Types a message and fixes its own typos. Every backspace is a frame boundary, so each keystroke becomes a frame.',
    source: typewriterDemo,
    settings: { fps: 20 },
  },
  {
    id: 'progress',
    title: 'Progress bar',
    group: 'Animations',
    description: 'A progress bar with a spinner, redrawn in place: each frame starts with a form feed (byte 12) that clears the screen.',
    source: progressBar,
    settings: { fps: 15 },
  },
  {
    id: 'bounce',
    title: 'Bouncing ball',
    group: 'Animations',
    description: 'A ball bouncing between two walls, forever. Press Stop when you have had enough.',
    source: bouncingBall,
    settings: { fps: 30 },
  },
  {
    id: 'rainbow',
    title: 'Rainbow',
    group: 'Animations',
    description: 'ANSI colour codes (ESC [ 3x m) on six lines; the colours shift every frame.',
    source: rainbow,
    settings: { fps: 8 },
  },
  {
    id: 'mandelbrot',
    title: 'Mandelbrot set',
    group: 'Showcase',
    description: 'Draws the Mandelbrot set in ASCII. About 10 billion instructions, so it takes around 30 seconds and draws row by row. Try it at max speed.',
    credit: BOSMAN,
    source: mandelbrot,
  },
  {
    id: 'sierpinski',
    title: 'Sierpinski triangle',
    group: 'Showcase',
    description: 'A fractal from about 140 instructions.',
    credit: CRISTOFANI,
    source: sierpinski,
  },
  {
    id: 'xmastree',
    inputHint: 'The height of the tree as digits, like 12. It reads until EOF, so press EOF after the number.',
    title: 'Christmas tree',
    group: 'Showcase',
    description: 'Prints a tree as tall as the number in the input box.',
    credit: CRISTOFANI,
    source: xmastree,
    input: '12',
    settings: { interactive: false },
  },
  {
    id: 'e',
    title: 'Digits of e',
    group: 'Showcase',
    description: 'Computes the decimal digits of e, forever. Press Stop when you have enough.',
    credit: CRISTOFANI,
    source: e,
    settings: { wrap: true },
  },
  {
    id: 'golden',
    title: 'Golden ratio',
    group: 'Showcase',
    description: 'Computes the digits of the golden ratio, forever.',
    credit: CRISTOFANI,
    source: golden,
    settings: { wrap: true },
  },
  {
    id: 'tictactoe',
    inputHint: 'The number of an empty square, 1 to 9 (top left to bottom right), then Enter.',
    title: 'Tic-tac-toe',
    group: 'Games',
    description: 'Play against the program, which moves first. At the > prompt, type the number of an empty square.',
    credit: CRISTOFANI,
    source: tictactoe,
    settings: { interactive: true },
  },
  {
    id: 'life',
    inputHint: 'Enter (empty) for the next generation; row then column letters like "ce" to toggle a cell; "q" to quit.',
    title: 'Game of Life',
    group: 'Games',
    description: 'Conway’s Game of Life with a glider set up in the input box. Auto-Enter is on, so it plays by itself; turn it off to step one generation at a time, toggle cells like "ce", or quit with "q".',
    credit: CRISTOFANI,
    source: life,
    input: 'ab\nbc\nca\ncb\ncc\n',
    settings: { interactive: true, autoAdvance: true, fps: 8 },
  },
  {
    id: 'ghost',
    inputHint: 'w, a, s or d to move up, left, down or right, then Enter.',
    title: 'Ghost',
    group: 'Games',
    description: 'Move your @ with w, a, s or d (then Enter) and keep away from the ghost.',
    credit: CRISTOFANI,
    source: ghost,
    settings: { interactive: true },
  },
  {
    id: 'helloworld',
    title: 'Hello World!',
    group: 'Basics',
    description: 'The classic. A loop sets up four cells, then each character is nudged into place.',
    credit: WIKIPEDIA,
    source: `++++++++++
[
   >+++++++>++++++++++>+++>+<<<<-
]
>++. Initial loop done; print H
>+. e
+++++++. l
. l
+++. o
>++.
<<+++++++++++++++.
>.
+++.
------.
--------.
>+.
>.
`,
  },
  {
    id: 'addition',
    inputHint: 'Two single digits with a plus sign, like 3+2.',
    title: 'Addition',
    group: 'Basics',
    description: 'Adds two single digits read as "a+b".',
    credit: WIKIPEDIA,
    source: `,>++++++[<-------->-],,[<+>-]<.
`,
    input: '3+2',
  },
  {
    id: 'multiplication',
    inputHint: 'Two single digits with a star, like 2*4. The answer must be one digit.',
    title: 'Multiplication',
    group: 'Basics',
    description: 'Multiplies two single digits read as "a*b" (result must be a single digit).',
    credit: WIKIPEDIA,
    source: `,>,,>++++++++[<------<------>>-]
<<[>[>+>+<<-]>>[<<+>>-]<<<-]
>>>++++++[<++++++++>-]<.
`,
    input: '2*4',
  },
  {
    id: 'division',
    inputHint: 'Two single digits with a slash, like 6/2.',
    title: 'Division',
    group: 'Basics',
    description: 'Divides two single digits read as "a/b".',
    credit: WIKIPEDIA,
    source: `,>,,>++++++[-<--------<-------->>] Store 2 numbers from keyboard in (0) and (1); and subtract 48 from each
<<[                               This is the main loop which continues until the dividend in (0) is zero
>[->+>+<<]                        Destructively copy the divisor from (1) to (2) and (3); setting (1) to zero
>[-<<-                            Subtract the divisor in (2) from the dividend in (0); the difference is stored in (0) and (2) is cleared
[>]>>>[<[>>>-<<<[-]]>>]<<]        If the dividend in (0) is zero; exit the loop
>>>+                              Add one to the quotient in (5)
<<[-<<+>>]                        Destructively copy the divisor in (3) to (1)
<<<]                              Move the stack pointer to (0) and go back to the start of the main loop
>[-]>>>>[-<<<<<+>>>>>]            Destructively copy the quotient in (5) to (0) (not necessary; but cleaner)
<<<<++++++[-<++++++++>]<.         Add 48 and print result
`,
    input: '6/2',
  },
  {
    id: 'uppercase',
    inputHint: 'A line of text in lower case, then Enter. It stops at the end of the line.',
    title: 'Uppercase a string',
    group: 'Basics',
    description: 'Reads a line and prints it in upper case. Stops at the newline.',
    credit: WIKIPEDIA,
    source: `,----------[----------------------.,----------]
`,
    input: 'lordalcol\n',
  },
  {
    id: 'breaksample',
    title: 'Breakpoint sample',
    group: 'Debugging',
    description: 'Pauses on the hash breakpoint. Then press Step (F10) to walk through it one instruction at a time and watch the memory tape.',
    source: `++++++++++
[>+++++++>++++++++++>+++>+<<<<-]
>++.>+.+++++++.#.+++.>++.
<<+++++++++++++++.>.+++.------.--------.>+.>.

This program pauses on the breakpoint;
then you can debug it step by step!

Set your own breakpoints with the hash sign
`,
  },
  {
    id: 'ctranslator',
    inputHint: 'A Brainfuck program to translate, like ,[.,]. Press EOF when you are done.',
    title: 'Brainfuck → C translator',
    group: 'Tools',
    description: 'Reads a Brainfuck program from input and prints the equivalent C code.',
    credit: CRISTOFANI,
    source: `+++[>+++++<-]>>+<[>>++++>++>+++++>+++++>+>>+<++[++<]>---]

>++++.>>>.+++++.>------.<--.+++++++++.>+.+.<<<<---.[>]<<.<<<.-------.>++++.
<+++++.+.>-----.>+.<++++.>>++.>-----.

<<<-----.+++++.-------.<--.<<<.>>>.<<+.>------.-..--.+++.-----<++.<--[>+<-]
>>>>>--.--.<++++.>>-.<<<.>>>--.>.

<<<<-----.>----.++++++++.----<+.+++++++++>>--.+.++<<<<.[>]<.>>

,[>>+++[<+++++++>-]<[<[-[-<]]>>[>]<-]<[<+++++>-[<+++>-[<-->-[<+++>-
[<++++[>[->>]<[>>]<<-]>[<+++>-[<--->-[<++++>-[<+++[>[-[-[-[->>]]]]<[>>]<<-]
>[<+>-[<->-[<++>-[<[-]>-]]]]]]]]]]]]]

<[
    -[-[>+<-]>]
    <[<<<<.>+++.+.+++.-------.>---.++.<.>-.++<<<<.[>]>>>>>>>>>]
    <[[<]>++.--[>]>>>>>>>>]
    <[<<++..-->>>>>>]
    <[<<..>>>>>]
    <[<<..-.+>>>>]
    <[<<++..---.+>>>]
    <[<<<.>>.>>>>>]
    <[<<<<-----.+++++>.----.+++.+>---.<<<-.[>]>]
    <[<<<<.-----.>++++.<++.+++>----.>---.<<<.-[>]]
    <[<<<<<----.>>.<<.+++++.>>>+.++>.>>]
    <.>
]>
,]

<<<<<.<+.>++++.<----.>>---.<<<-.>>>+.>.>.[<]>++.[>]<.
>
`,
    input: ',++.>,--.',
  },
  {
    id: 'bfinterpreter',
    inputHint: 'A Brainfuck program, then !, then the input for that program, like ,.+.!A',
    title: 'Brainfuck interpreter',
    group: 'Tools',
    description: 'A Brainfuck interpreter written in Brainfuck. Input is a program and its input, separated by an exclamation point.',
    credit: CRISTOFANI,
    source: `>>>+[[-]>>[-]++>+>+++++++[<++++>>++<-]++>>+>+>+++++[>++>++++++<<-]+>>>,<++[[>[
->>]<[>>]<<-]<[<]<+>>[>]>[<+>-[[<+>-]>]<[[[-]<]++<-[<+++++++++>[<->-]>>]>>]]<<
]<]<[[<]>[[>]>>[>>]+[<<]<[<]<+>>-]>[>]+[->>]<<<<[[<<]<[<]+<<[+>+<<-[>-->+<<-[>
+<[>>+<<-]]]>[<+>-]<]++>>-->[>]>>[>>]]<<[>>+<[[<]<]>[[<<]<[<]+[-<+>>-[<<+>++>-
[<->[<<+>>-]]]<[>+<-]>]>[>]>]>[>>]>>]<<[>>+>>+>>]<<[->>>>>>>>]<<[>.>>>>>>>]<<[
>->>>>>]<<[>,>>>]<<[>+>]<<[+<<]<]

input a brainfuck program and its input separated by an exclamation point
`,
    input: ',.+.>,++.>,+++.<<+++.+.\n\n!000\n',
  },
  {
    id: 'factorial',
    title: 'Factorials',
    group: 'Showcase',
    description: 'Prints factorials forever. It never halts: press Stop when you have seen enough.',
    credit: CRISTOFANI,
    source: `>++++++++++>>>+>+[>>>+[-[<<<<<[+<<<<<]>>[[-]>[<<+>+>-]<[>+<-]<[>+<-[>+<-[>
+<-[>+<-[>+<-[>+<-[>+<-[>+<-[>+<-[>[-]>>>>+>+<<<<<<-[>+<-]]]]]]]]]]]>[<+>-
]+>>>>>]<<<<<[<<<<<]>>>>>>>[>>>>>]++[-<<<<<]>>>>>>-]+>>>>>]<[>++<-]<<<<[<[
>+<-]<<<<]>>[->[-]++++++[<++++++++>-]>>>>]<<<<<[<[>+>+<<-]>.<<<<<]>.>>>>]

This program does not terminate; you will have to stop it
`,
  },
  {
    id: 'numwarp',
    inputHint: 'A number using 0-9, a-f, ( ) - . / and spaces, then Enter.',
    title: 'Number display',
    group: 'Showcase',
    description: 'Draws a number in a warped seven-segment style. Accepts ()-./0123456789abcdef and space, ending with a newline.',
    credit: CRISTOFANI,
    source: `>>>>+>+++>+++>>>>>+++[
  >,+>++++[>++++<-]>[<<[-[->]]>[<]>-]<<[
    >+>+>>+>+[<<<<]<+>>[+<]<[>]>+[[>>>]>>+[<<<<]>-]+<+>>>-[
      <<+[>]>>+<<<+<+<--------[
        <<-<<+[>]>+<<-<<-[
          <<<+<-[>>]<-<-<<<-<----[
            <<<->>>>+<-[
              <<<+[>]>+<<+<-<-[
                <<+<-<+[>>]<+<<<<+<-[
                  <<-[>]>>-<<<-<-<-[
                    <<<+<-[>>]<+<<<+<+<-[
                      <<<<+[>]<-<<-[
                        <<+[>]>>-<<<<-<-[
                          >>>>>+<-<<<+<-[
                            >>+<<-[
                              <<-<-[>]>+<<-<-<-[
                                <<+<+[>]<+<+<-[
                                  >>-<-<-[
                                    <<-[>]<+<++++[<-------->-]++<[
                                      <<+[>]>>-<-<<<<-[
                                        <<-<<->>>>-[
                                          <<<<+[>]>+<<<<-[
                                            <<+<<-[>>]<+<<<<<-[
                                              >>>>-<<<-<-
  ]]]]]]]]]]]]]]]]]]]]]]>[>[[[<<<<]>+>>[>>>>>]<-]<]>>>+>>>>>>>+>]<
]<[-]<<<<<<<++<+++<+++[
  [>]>>>>>>++++++++[<<++++>++++++>-]<-<<[-[<+>>.<-]]<<<<[
    -[-[>+<-]>]>>>>>[.[>]]<<[<+>-]>>>[<<++[<+>--]>>-]
    <<[->+<[<++>-]]<<<[<+>-]<<<<
  ]>>+>>>--[<+>---]<.>>[[-]<<]<
]
`,
    input: '123 - abc\n',
  },
  {
    id: 'squares',
    title: 'Square numbers',
    group: 'Showcase',
    description: 'Prints the square numbers from 0 to 10000.',
    credit: CRISTOFANI,
    source: `++++[>+++++<-]>[<+++++>-]+<+[
    >[>+>+<<-]++>>[<<+>>-]>>>[-]++>[-]+
    >>>+[[-]++++++>>>]<<<[[<++++++++<++>>-]+<.<[>----<-]<]
    <<[>>>>>[>>>[-]+++++++++<[>-<-]+++++++++>[-[<->-]+[<<<]]<[>+<-]>]<<-]<<-
]

Outputs square numbers from 0 to 10000
`,
  },
];
