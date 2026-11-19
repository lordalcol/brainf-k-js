/**
 * Animation samples. They draw a frame, then start the next one with a
 * form feed (clear screen) or a backspace. With frame sync on, the
 * interpreter pauses for one frame at each of those.
 *
 * Constants are put into cells with `setCells`; the logic is hand-written.
 * Comments avoid the eight command characters, so they are plain words.
 */
import { setCells, setString } from './bf-builder';
import { shortestDelta, textToBrainfuck } from './text-to-bf';

const COMMENT_SAFE = /^[^<>+\-.,[\]#]*$/;

/** Join code lines; lines starting with `;` are comments (the `;` is dropped). */
function program(...parts: string[]): string {
  return parts
    .map((p) => {
      if (!p.startsWith(';')) return p;
      const text = p.slice(1).trimStart();
      if (!COMMENT_SAFE.test(text)) throw new Error(`Comment contains a command character: ${text}`);
      return text;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------

const BAR = 40;

export const progressBar = program(
  ';Progress bar with a spinner',
  ';Each frame starts with a form feed so the screen is redrawn in place',
  ';',
  ';Cells: 0 frames left  1 form feed  2 open bracket  3 hash  4 dot',
  ';       5 close bracket  6 done  7 to do  8 temp  9 space',
  ';       10 to 13 spinner characters  14 temp',
  setCells([BAR + 1, 12, 91, 35, 46, 93, 0, BAR, 0, 32, 124, 47, 45, 92, 0]),
  '<'.repeat(15),
  '[',
  '  >.>.               ;form feed and open bracket',
  '  >>>>[->>+<<<<<.>>>]  ;print one hash per done step',
  '  >>[-<<+>>]<<',
  '  >[->+<<<<.>>>]     ;print one dot per step to do',
  '  >[-<+>]<',
  '  <<.>>>>.>.         ;close bracket and space and spinner',
  '  [->>>>+<<<<]>[-<+>]>[-<+>]>[-<+>]>[-<+>]  ;rotate the spinner',
  '  <<<<<<<<+>-        ;one more done and one less to do',
  '  <<<<<<<-',
  ']',
  '>'.repeat(15),
  textToBrainfuck('\n\n  Done!\n'),
).replace(/ {2};([^\n]*)/g, (_, c: string) => `  ${checkComment(c)}`);

function checkComment(c: string): string {
  if (!COMMENT_SAFE.test(c)) throw new Error(`Comment contains a command character: ${c}`);
  return c;
}

// ---------------------------------------------------------------------------

const WIDTH = 30;
const FRAME =
  '<<<<.>.>>>' + // form feed and left wall
  '[->>+<<<<.>>]>>[-<<+>>]<<' + // spaces before the ball
  '<.>>' + // the ball
  '[->+<<<<.>>>]>[-<+>]<' + // spaces after the ball
  '<<<<.>>>'; // right wall

export const bouncingBall = program(
  ';Bouncing ball',
  ';Cells: 0 run forever  1 form feed  2 wall  3 space  4 ball',
  ';       5 spaces before the ball  6 spaces after it  7 temp  8 step counter',
  setCells([1, 12, 124, 32, 79, 0, WIDTH - 1, 0, 0]),
  '<'.repeat(9),
  '[',
  '  >>>>>>>> ' + '+'.repeat(WIDTH - 1),
  '  [<<< ' + FRAME + ' +>->>-]',
  '  ' + '+'.repeat(WIDTH - 1),
  '  [<<< ' + FRAME + ' ->+>>-]',
  '  <<<<<<<<',
  ']',
);

// ---------------------------------------------------------------------------

const ROTATE = '[->>>>>>+<<<<<<]' + '>[-<+>]'.repeat(6);

export const rainbow = program(
  ';Rainbow',
  ';Six lines of text in six ANSI colours that shift every frame',
  ';Each line starts with ESC and the colour code for foreground colour',
  ';Cells: 0 run forever  1 form feed  2 escape  3 bracket  4 digit three',
  ';       5 letter m  6 newline  7 line counter  8 to 13 colour digits',
  ';       14 temp  15 zero  then the text',
  setCells([1, 12, 27, 91, 51, 109, 10, 0, 49, 50, 51, 52, 53, 54, 0, 0]),
  setString('   ~~~~  Brainfuck in colour  ~~~~   '),
  '<[<]' + '<'.repeat(15),
  '[',
  '  >.>>>>>> ++++++',
  '  [',
  '    <<<<<.>.>.>>>>.<<<.   ;colour escape code',
  '    >>>>>>>>>>>[.>]<[<]   ;the text',
  '    <<<<<<<<<.>>          ;newline',
  '    ' + ROTATE + '   ;next colour for the next line',
  '    <<<<<<<-',
  '  ]',
  '  >' + ROTATE + '   ;shift the colours for the next frame',
  '  ' + '<'.repeat(14),
  ']',
).replace(/ {3};([^\n]*)/g, (_, c: string) => `   ${checkComment(c)}`);

// ---------------------------------------------------------------------------

/**
 * Build a typewriter program. In `script`, `~` deletes the previous
 * character and `|` waits one frame. A `_` cursor follows the text; every
 * backspace is a frame boundary, so each keystroke shows up as a frame.
 *
 * Cells: 0 temp for multiplication loops, 1 current character, 2 cursor,
 * 3 backspace, 4 space. The pointer rests on cell 1.
 */
export function typewriter(script: string): string {
  const code: string[] = [
    'Typewriter',
    'Types a message with a cursor and fixes its own typos with backspace',
    '',
    '>>',
    setCells([95, 8, 32]),
    '<<<<',
  ];
  let cur = 0;
  const type = (c: number) => {
    code.push(shortestDelta(c - cur) + '.>.>.<<');
    cur = c;
  };
  for (const ch of script) {
    if (ch === '~') code.push('>>>.<..<.>.<<');
    else if (ch === '|') code.push('>.>.<<');
    else if (ch === '\n') {
      code.push('>>>.<.<<'); // rub out the cursor first
      type(10);
    } else type(ch.charCodeAt(0));
  }
  return code.join('\n');
}

export const typewriterDemo = typewriter(
  '||||Hello! I am a Brainfuck progarm~~~ram.|||||\n' +
    'I can make tpyos~~~~ypos|| and fix them,|| thanks to backspace.|||||\n' +
    'Clear the screen with a form feed and you get animation!||||||||',
);
