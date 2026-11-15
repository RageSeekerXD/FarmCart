import type { ReactNode } from 'react';
import type { ArtKey, ProductArtKey } from './artFor';

/*
 * Пласкі векторні ілюстрації товарів (полотно 120×120): окремий малюнок для кожного виду товару.
 * Без градієнтів і id - на сторінці десятки малюнків, і їхні id не конфліктують.
 */

const SHADOW = '#3b2b12';
const STEM = '#6d4c2f';
const GREEN = '#4c9a3c';
const GREEN_DARK = '#2f7a2c';
const WOOD = '#c98f55';
const WOOD_LIGHT = '#e0ad74';

function Shadow({ rx = 32, cy = 100 }: { rx?: number; cy?: number }) {
  return <ellipse cx={60} cy={cy} rx={rx} ry={5} fill={SHADOW} opacity={0.13} />;
}

function Shine({ x, y, rx, ry, r = -30, o = 0.45 }: { x: number; y: number; rx: number; ry: number; r?: number; o?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${r} ${x} ${y})`} fill="#fff" opacity={o} />;
}

/** Листок від точки (x, y) уздовж кута r. */
function Leaf({ x, y, r, len = 18, w = 7, fill = GREEN, vein = GREEN_DARK }: { x: number; y: number; r: number; len?: number; w?: number; fill?: string; vein?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d={`M0 0 Q${len * 0.45} ${-w} ${len} 0 Q${len * 0.45} ${w} 0 0Z`} fill={fill} />
      <path d={`M2 0 L${len - 4} 0`} stroke={vein} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

/** Дерев'яна дошка, на якій лежать сир, м'ясо чи хліб. */
function Board({ y = 86 }: { y?: number }) {
  return (
    <g>
      <rect x={18} y={y + 2} width={84} height={12} rx={6} fill={WOOD} />
      <rect x={18} y={y} width={84} height={10} rx={5} fill={WOOD_LIGHT} />
      <circle cx={95} cy={y + 5} r={2} fill={WOOD} />
    </g>
  );
}

/** Скляна банка з вмістом. */
function Jar({ x = 60, w = 44, h = 52, bottom = 98, fill, lid, level = 0.86, label }: { x?: number; w?: number; h?: number; bottom?: number; fill: string; lid: string; level?: number; label?: string }) {
  const left = x - w / 2;
  const top = bottom - h;
  return (
    <g>
      <rect x={left} y={top} width={w} height={h} rx={9} fill="#eef6f7" stroke="#c9d6d9" strokeWidth={1.2} />
      <rect x={left + 2.5} y={top + h * (1 - level)} width={w - 5} height={h * level - 2.5} rx={7} fill={fill} />
      {label && <rect x={left + 5} y={top + h * 0.42} width={w - 10} height={h * 0.32} rx={3} fill={label} />}
      <rect x={left + 4} y={top + 5} width={4} height={h - 14} rx={2} fill="#fff" opacity={0.5} />
      <rect x={left - 2} y={top - 9} width={w + 4} height={11} rx={3} fill={lid} />
      <rect x={left - 2} y={top - 9} width={w + 4} height={3} rx={1.5} fill="#fff" opacity={0.25} />
    </g>
  );
}

/** Пляшка: рідина заповнює тіло, шийка скляна. */
function Bottle({ x = 60, bottom = 98, w = 30, h = 70, liquid, cap, label, outline = '#c9d6d9' }: { x?: number; bottom?: number; w?: number; h?: number; liquid: string; cap: string; label?: ReactNode; outline?: string }) {
  const neck = w * 0.42;
  const top = bottom - h;
  const shoulder = bottom - h * 0.7;
  const body = bottom - h * 0.58;
  const path = `M${x - neck / 2} ${top} H${x + neck / 2} V${shoulder} Q${x + w / 2} ${shoulder + 4} ${x + w / 2} ${body} V${bottom - 7} Q${x + w / 2} ${bottom} ${x + w / 2 - 7} ${bottom} H${x - w / 2 + 7} Q${x - w / 2} ${bottom} ${x - w / 2} ${bottom - 7} V${body} Q${x - w / 2} ${shoulder + 4} ${x - neck / 2} ${shoulder} Z`;
  return (
    <g>
      <path d={path} fill={liquid} stroke={outline} strokeWidth={1.4} />
      <rect x={x - neck / 2 + 1} y={top + 1} width={neck - 2} height={h * 0.2} fill="#eef6f7" />
      <rect x={x - w / 2 + 4} y={body + 2} width={4} height={h * 0.42} rx={2} fill="#fff" opacity={0.55} />
      <rect x={x - neck / 2 - 2} y={top - 7} width={neck + 4} height={9} rx={2.5} fill={cap} />
      {label}
    </g>
  );
}

/** Склянка з напоєм. */
function Glass({ x, bottom = 98, w = 22, h = 30, fill }: { x: number; bottom?: number; w?: number; h?: number; fill: string }) {
  const top = bottom - h;
  return (
    <g>
      <path d={`M${x - w / 2} ${top} H${x + w / 2} L${x + w / 2 - 3} ${bottom} H${x - w / 2 + 3} Z`} fill="#eef6f7" stroke="#c9d6d9" strokeWidth={1.2} />
      <path d={`M${x - w / 2 + 1.5} ${top + 6} H${x + w / 2 - 1.5} L${x + w / 2 - 4} ${bottom - 1.5} H${x - w / 2 + 4} Z`} fill={fill} />
      <rect x={x - w / 2 + 3} y={top + 8} width={3} height={h - 14} rx={1.5} fill="#fff" opacity={0.5} />
    </g>
  );
}

function Apple({ x, y, s = 1, fill, shade, stripes }: { x: number; y: number; s?: number; fill: string; shade: string; stripes?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -20 C8 -28 27 -24 28 -6 C29 12 18 30 6 30 C3 30 2 28 0 28 C-2 28 -3 30 -6 30 C-18 30 -29 12 -28 -6 C-27 -24 -8 -28 0 -20Z" fill={fill} />
      <path d="M28 -6 C29 12 18 30 6 30 C3 30 2 28 0 28 C10 22 20 10 22 -8 C24 -14 27 -12 28 -6Z" fill={shade} opacity={0.55} />
      {stripes && <path d="M-14 -16 C-20 -2 -18 14 -10 24 M-4 -20 C-8 -4 -6 12 -2 26 M10 -20 C14 -6 14 10 8 24" stroke={stripes} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.55} />}
      <path d="M0 -20 C0 -26 2 -31 5 -34" stroke={STEM} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Leaf x={3} y={-28} r={-25} len={16} w={6} />
      <Shine x={-14} y={-8} rx={5} ry={9} r={20} />
    </g>
  );
}

function Strawberry({ x, y, r = 0, s = 1 }: { x: number; y: number; r?: number; s?: number }) {
  const seeds = [[-8, -6], [0, -9], [8, -6], [-11, 2], [-3, 0], [5, 1], [11, 3], [-6, 8], [2, 9], [0, 16]];
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 24 C-14 12 -20 0 -17 -10 C-13 -19 -5 -19 0 -15 C5 -19 13 -19 17 -10 C20 0 14 12 0 24Z" fill="#e53935" />
      <path d="M17 -10 C20 0 14 12 0 24 C6 10 10 0 10 -14 C13 -15 16 -13 17 -10Z" fill="#b71c1c" opacity={0.45} />
      {seeds.map(([sx, sy]) => (
        <ellipse key={`${sx},${sy}`} cx={sx} cy={sy} rx={1.1} ry={1.6} fill="#ffe082" />
      ))}
      <path d="M0 -15 L-10 -20 L-4 -14 L-12 -12 L-2 -11 L0 -6 L2 -11 L12 -12 L4 -14 L10 -20Z" fill="#2e7d32" />
      <path d="M0 -15 C0 -19 1 -22 3 -24" stroke={GREEN_DARK} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Raspberry({ x, y, s = 1, color = '#d81b60', light = '#ec407a' }: { x: number; y: number; s?: number; color?: string; light?: string }) {
  const cells: readonly (readonly [number, number])[] = [[-6, -9], [0, -10], [6, -9], [-9, -2], [-3, -3], [3, -3], [9, -2], [-8, 5], [-2, 4], [4, 4], [9, 5], [-5, 11], [1, 11], [6, 10], [0, 16]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {cells.map(([cx, cy], index) => (
        <g key={`${cx},${cy}`}>
          <circle cx={cx} cy={cy} r={4.4} fill={index % 3 === 0 ? light : color} />
          <circle cx={cx - 1.4} cy={cy - 1.4} r={1} fill="#fff" opacity={0.55} />
        </g>
      ))}
      <path d="M0 -13 L-7 -17 L-3 -12 L-8 -10 L0 -11 L8 -10 L3 -12 L7 -17Z" fill="#558b2f" />
    </g>
  );
}

/** Картоплина-«бульба»: s - розмір, кольори шкірки й вічок. */
function Tuber({ x, y, s = 1, r = 0, skin, shade, eye, blush }: { x: number; y: number; s?: number; r?: number; skin: string; shade: string; eye: string; blush?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M-20 0 C-21 -11 -9 -16 3 -14 C15 -12 22 -5 20 5 C18 15 6 17 -6 15 C-16 13 -19 8 -20 0Z" fill={skin} />
      {blush && <path d="M4 -13 C14 -11 20 -6 20 2 C14 0 8 -6 4 -13Z" fill={blush} opacity={0.75} />}
      <path d="M20 5 C18 15 6 17 -6 15 C-14 13 -18 9 -19 4 C-10 10 6 11 20 5Z" fill={shade} opacity={0.6} />
      {[[-9, -4], [6, -8], [11, 5], [-3, 8]].map(([ex, ey]) => (
        <circle key={`${ex},${ey}`} cx={ex} cy={ey} r={1.5} fill={eye} />
      ))}
      <Shine x={-7} y={-7} rx={6} ry={3} r={-10} o={0.35} />
    </g>
  );
}

/** Пучок зелені: стебла віялом, перев'язані. */
function Bunch({ tops, tie }: { tops: (x: number, y: number, r: number) => ReactNode; tie: string }) {
  const stems: [number, number][] = [[34, 34], [46, 24], [60, 20], [74, 24], [86, 34]];
  return (
    <g>
      <Shadow rx={20} />
      {stems.map(([x, y]) => (
        <path key={`${x}`} d={`M60 96 Q${(60 + x) / 2} ${(96 + y) / 2 + 8} ${x} ${y}`} stroke="#6a9a3a" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      ))}
      {stems.map(([x, y]) => (
        <g key={`top${x}`}>{tops(x, y, (Math.atan2(y - 96, x - 60) * 180) / Math.PI)}</g>
      ))}
      <rect x={53} y={78} width={14} height={7} rx={2} fill={tie} />
    </g>
  );
}

function HoneyDipper({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x={-2} y={-46} width={4} height={36} rx={2} fill="#a8723d" />
      <ellipse cx={0} cy={-4} rx={8} ry={10} fill="#c98a4b" />
      {[-10, -5, 0, 5].map((dy) => (
        <rect key={dy} x={-8} y={dy - 1} width={16} height={2} rx={1} fill="#8a5a2b" opacity={0.6} />
      ))}
      <path d="M-3 6 C-3 12 3 12 3 18 C3 22 -1 22 -1 18" fill="#f2b230" />
    </g>
  );
}

function Egg({ x, y, s = 1, fill, shade }: { x: number; y: number; s?: number; fill: string; shade: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -13 C7 -13 10 -3 10 3 C10 10 5 13 0 13 C-5 13 -10 10 -10 3 C-10 -3 -7 -13 0 -13Z" fill={fill} />
      <path d="M10 3 C10 10 5 13 0 13 C6 8 7 0 5 -9 C8 -6 10 -1 10 3Z" fill={shade} opacity={0.5} />
      <Shine x={-4} y={-5} rx={2.5} ry={4} r={15} o={0.5} />
    </g>
  );
}

function Hexagon({ x, y, r, fill, stroke }: { x: number; y: number; r: number; fill: string; stroke: string }) {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    return `${(x + r * Math.cos(angle)).toFixed(1)},${(y + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1.6} />;
}

const ART: Record<ProductArtKey, () => ReactNode> = {
  carrot: () => {
    const carrot = (x: number, y: number, r: number) => (
      <g transform={`translate(${x} ${y}) rotate(${r})`}>
        <ellipse cx={-5} cy={-12} rx={3.6} ry={12} transform="rotate(-22 -5 -12)" fill={GREEN} />
        <ellipse cx={0} cy={-15} rx={3.6} ry={14} fill="#66bb6a" />
        <ellipse cx={5} cy={-12} rx={3.6} ry={12} transform="rotate(22 5 -12)" fill={GREEN_DARK} />
        <path d="M-10 0 Q-11 6 -7 26 Q-3 46 0 60 Q3 46 7 26 Q11 6 10 0 Q0 -4 -10 0Z" fill="#f57c1f" />
        <path d="M3 -1 Q10 0 10 4 Q9 14 6 28 Q3 46 0 60 Q2 40 3 -1Z" fill="#d9600c" opacity={0.5} />
        <path d="M-8 12h6M2 22h6M-6 33h5M1 43h4" stroke="#c4560a" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    );
    return (
      <>
        <Shadow rx={26} cy={96} />
        {carrot(70, 30, 20)}
        {carrot(46, 32, -26)}
      </>
    );
  },
  potato: () => (
    <>
      <Shadow rx={36} />
      <Tuber x={60} y={62} s={1.05} r={-8} skin="#c8964f" shade="#9c6a32" eye="#8a5d2b" />
      <Tuber x={40} y={82} s={0.95} r={10} skin="#c99a55" shade="#9c6a32" eye="#8a5d2b" />
      <Tuber x={80} y={84} s={0.9} r={-14} skin="#bf8c48" shade="#9c6a32" eye="#8a5d2b" />
    </>
  ),
  'new-potato': () => (
    <>
      <Shadow rx={36} />
      {[[60, 56, 0.55, 10], [44, 70, 0.6, -10], [76, 70, 0.6, 20], [34, 86, 0.58, 4], [58, 86, 0.62, -6], [82, 87, 0.56, 12]].map(([x, y, s, r]) => (
        <Tuber key={`${x},${y}`} x={x!} y={y!} s={s} r={r} skin="#f1d9b0" shade="#d9b98a" eye="#c9a274" blush="#e8a58f" />
      ))}
      <g transform="translate(78 44) rotate(-30)">
        <path d="M0 0 L22 0" stroke="#6a9a3a" strokeWidth={1.6} />
        {[4, 9, 14, 19].map((t) => (
          <path key={t} d={`M${t} 0 l4 -6 M${t} 0 l4 6 M${t + 2} 0 l3 -4 M${t + 2} 0 l3 4`} stroke="#7cb342" strokeWidth={1.1} strokeLinecap="round" />
        ))}
      </g>
    </>
  ),
  beet: () => (
    <>
      <Shadow rx={30} />
      <path d="M58 42 L42 16 M60 40 L70 6 M62 42 L90 22" stroke="#a3214f" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M57 40 C46 30 34 22 30 10 C42 10 52 20 56 32Z" fill="#5f9a3b" />
      <path d="M60 38 C58 24 62 12 70 2 C78 14 72 28 62 40Z" fill="#6aa843" />
      <path d="M63 41 C72 30 82 22 96 20 C92 32 78 40 64 44Z" fill="#558f34" />
      <path d="M60 40 C80 40 88 56 86 70 C84 84 72 92 64 96 C61 101 59 106 56 110 C56 104 56 100 54 96 C42 90 34 80 34 68 C34 52 44 40 60 40Z" fill="#8e1b4a" />
      <path d="M72 44 C84 50 88 62 86 72 C84 84 74 92 64 96 C72 86 78 74 76 60 C76 52 74 48 72 44Z" fill="#5e0f30" opacity={0.5} />
      <Shine x={48} y={56} rx={5} ry={9} r={25} o={0.35} />
      <circle cx={34} cy={88} r={14} fill="#b0245c" />
      <circle cx={34} cy={88} r={10} fill="none" stroke="#d3487f" strokeWidth={1.6} />
      <circle cx={34} cy={88} r={5.5} fill="none" stroke="#d3487f" strokeWidth={1.4} />
    </>
  ),
  cabbage: () => (
    <>
      <Shadow rx={36} />
      <path d="M22 70 C20 46 40 30 60 30 C80 30 100 46 98 70 C96 90 80 100 60 100 C40 100 24 90 22 70Z" fill="#6ead4b" />
      <circle cx={60} cy={63} r={28} fill="#b9dc94" />
      <path d="M38 58 C42 44 52 38 62 38 C72 38 80 44 82 54" stroke="#95c76d" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M46 64 C48 54 56 50 62 50 C70 50 74 56 75 62" stroke="#a6d17e" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M22 70 C28 84 40 96 58 100 C40 100 24 90 22 70Z M98 70 C92 84 80 96 62 100 C80 100 96 90 98 70Z" fill="#5c9a3d" />
      <path d="M60 99 L34 76 M60 99 L86 76 M60 99 L48 88 M60 99 L72 88" stroke="#4e8a33" strokeWidth={1.8} strokeLinecap="round" />
      <Shine x={50} y={48} rx={8} ry={4} r={-20} o={0.4} />
    </>
  ),
  onion: () => {
    const onion = (x: number, y: number, s: number) => (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M0 -30 C2 -22 6 -18 14 -12 C24 -4 24 14 14 20 C8 24 -8 24 -14 20 C-24 14 -24 -4 -14 -12 C-6 -18 -2 -22 0 -30Z" fill="#d9953a" />
        <path d="M14 -12 C24 -4 24 14 14 20 C8 24 2 24 0 24 C10 16 14 2 8 -16Z" fill="#b8741f" opacity={0.5} />
        <path d="M0 -26 C-10 -12 -12 8 -6 22 M0 -26 C10 -12 12 8 6 22" stroke="#b87425" strokeWidth={1.3} fill="none" />
        <path d="M0 -30 L-3 -39 M0 -30 L3 -38" stroke="#a8742e" strokeWidth={2} strokeLinecap="round" />
        <path d="M-4 22 l-2 5 M0 23 l0 6 M4 22 l2 5" stroke="#d9c49a" strokeWidth={1.4} strokeLinecap="round" />
        <Shine x={-9} y={-4} rx={3} ry={8} r={15} o={0.35} />
      </g>
    );
    return (
      <>
        <Shadow rx={32} />
        {onion(40, 72, 0.8)}
        {onion(70, 66, 1.1)}
      </>
    );
  },
  garlic: () => (
    <>
      <Shadow rx={30} />
      <g transform="translate(56 66) scale(1.3)">
        <path d="M-2 -24 C-2 -30 0 -36 2 -40" stroke="#d9cfb5" strokeWidth={4} strokeLinecap="round" fill="none" />
        <path d="M0 -26 C3 -18 8 -14 16 -8 C26 0 24 16 12 20 C6 22 -6 22 -12 20 C-24 16 -26 0 -16 -8 C-8 -14 -3 -18 0 -26Z" fill="#f6f1e6" stroke="#ddd3c2" strokeWidth={1} />
        <path d="M0 -20 C-9 -8 -11 8 -6 20 M0 -20 C9 -8 11 8 6 20 M0 -20 L0 21 M-2 -18 C-18 -6 -20 10 -12 19 M2 -18 C18 -6 20 10 12 19" stroke="#d7cdbb" strokeWidth={1} fill="none" />
        <path d="M-12 18 C-8 12 -6 6 -6 0 M12 18 C8 12 6 6 6 0" stroke="#c7a1c4" strokeWidth={1.4} fill="none" opacity={0.8} />
        <path d="M-4 21 l-2 4 M0 22 l0 4 M4 21 l2 4" stroke="#cbbf9f" strokeWidth={1.2} strokeLinecap="round" />
      </g>
      <g transform="translate(90 90) rotate(20)">
        <path d="M-6 4 C-8 -4 -2 -10 2 -12 C4 -6 8 0 6 6 C2 8 -4 8 -6 4Z" fill="#f2ecdf" stroke="#ddd3c2" strokeWidth={1} />
      </g>
    </>
  ),
  cucumber: () => {
    const cucumber = (x: number, y: number, r: number) => (
      <g transform={`translate(${x} ${y}) rotate(${r})`}>
        <rect x={-40} y={-9.5} width={80} height={19} rx={9.5} fill="#3f8a36" />
        <rect x={-36} y={-6} width={70} height={4} rx={2} fill="#79bb67" opacity={0.7} />
        <rect x={-34} y={3} width={64} height={4} rx={2} fill="#2c6626" opacity={0.6} />
        {[-28, -16, -4, 8, 20, 30].map((bx, i) => (
          <circle key={bx} cx={bx} cy={i % 2 ? 1 : -2} r={1.3} fill="#25561f" />
        ))}
        <circle cx={38} cy={0} r={3.2} fill="#a5c779" />
        <path d="M-40 0 l-6 -2" stroke={STEM} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
    return (
      <>
        <Shadow rx={38} />
        {cucumber(60, 58, -18)}
        {cucumber(60, 82, -6)}
      </>
    );
  },
  tomato: () => {
    const tomato = (x: number, y: number, r: number) => (
      <g>
        <ellipse cx={x} cy={y} rx={r} ry={r * 0.88} fill="#e53935" />
        <path d={`M${x + r * 0.3} ${y - r * 0.82} C${x + r * 1.2} ${y - r * 0.5} ${x + r * 1.1} ${y + r * 0.7} ${x + r * 0.2} ${y + r * 0.86} C${x + r * 0.7} ${y + r * 0.4} ${x + r * 0.8} ${y - r * 0.3} ${x + r * 0.3} ${y - r * 0.82}Z`} fill="#b71c1c" opacity={0.45} />
        <Shine x={x - r * 0.45} y={y - r * 0.35} rx={r * 0.18} ry={r * 0.32} r={30} />
        <path
          d={`M${x} ${y - r * 0.82} l${-r * 0.5} ${-r * 0.12} l${r * 0.35} ${r * 0.18} l${-r * 0.3} ${r * 0.32} l${r * 0.45} ${-r * 0.2} l${r * 0.45} ${r * 0.2} l${-r * 0.3} ${-r * 0.32} l${r * 0.35} ${-r * 0.18}Z`}
          fill="#2e7d32"
        />
        <path d={`M${x} ${y - r * 0.82} l1 ${-r * 0.25}`} stroke={GREEN_DARK} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
    return (
      <>
        <Shadow rx={34} />
        {tomato(48, 66, 25)}
        {tomato(82, 82, 15)}
      </>
    );
  },
  dill: () => (
    <Bunch
      tie="#c99556"
      tops={(x, y, angle) => (
        <g>
          {[0.45, 0.65, 0.85].map((t) => {
            const px = 60 + (x - 60) * t;
            const py = 96 + (y - 96) * t;
            return (
              <g key={t} transform={`translate(${px} ${py}) rotate(${angle + 90})`}>
                {[-1, 1].map((side) => (
                  <path key={side} d={`M0 0 l${side * 9} -5 M0 0 l${side * 7} -9 M${side * 4} -3 l${side * 5} -1 M${side * 3} -6 l${side * 3} -5`} stroke="#7cb342" strokeWidth={1.1} strokeLinecap="round" />
                ))}
              </g>
            );
          })}
          {[-6, -3, 0, 3, 6].map((dx) => (
            <path key={dx} d={`M${x} ${y} l${dx} -6`} stroke="#9ccc65" strokeWidth={1} />
          ))}
          {[-6, -3, 0, 3, 6].map((dx) => (
            <circle key={`f${dx}`} cx={x + dx} cy={y - 6} r={1.6} fill="#d4e157" />
          ))}
        </g>
      )}
    />
  ),
  parsley: () => (
    <Bunch
      tie="#c62828"
      tops={(x, y, angle) => (
        <g>
          <Leaf x={x} y={y} r={angle - 35} len={13} w={7} fill="#3f8f3a" vein="#2a6a27" />
          <Leaf x={x} y={y} r={angle} len={15} w={8} fill="#58a84a" vein="#2a6a27" />
          <Leaf x={x} y={y} r={angle + 35} len={13} w={7} fill="#3f8f3a" vein="#2a6a27" />
          <Leaf x={60 + (x - 60) * 0.7} y={96 + (y - 96) * 0.7} r={angle + 40} len={9} w={5} fill="#4f9c43" vein="#2a6a27" />
        </g>
      )}
    />
  ),
  lettuce: () => {
    const leaf = 'M0 0 C-14 -6 -22 -22 -14 -36 C-10 -31 -6 -38 0 -35 C6 -38 10 -31 14 -36 C22 -22 14 -6 0 0Z';
    return (
      <>
        <Shadow rx={36} />
        {[-75, -40, 40, 75, 0].map((r) => (
          <path key={r} d={leaf} transform={`translate(60 92) rotate(${r}) scale(1.25)`} fill="#7cb342" />
        ))}
        {[-45, 0, 45].map((r) => (
          <path key={`m${r}`} d={leaf} transform={`translate(60 92) rotate(${r}) scale(0.95)`} fill="#9ccc65" />
        ))}
        {[-20, 20].map((r) => (
          <path key={`i${r}`} d={leaf} transform={`translate(60 92) rotate(${r}) scale(0.6)`} fill="#c5e1a5" />
        ))}
        <path d="M60 92 L60 52 M60 92 L36 62 M60 92 L84 62" stroke="#e6f2d6" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      </>
    );
  },
  spinach: () => {
    const leaf = 'M0 0 C-10 -10 -15 -30 0 -46 C15 -30 10 -10 0 0Z';
    return (
      <>
        <Shadow rx={32} />
        {[-56, 56, -28, 28, 0].map((r, i) => (
          <g key={r} transform={`translate(60 94) rotate(${r})`}>
            <path d="M0 0 L0 -12" stroke="#6b9b45" strokeWidth={2.4} />
            <path d={leaf} transform="translate(0 -8)" fill={i % 2 ? '#2f6e33' : '#3b7f3c'} />
            <path d="M0 -10 L0 -48" stroke="#5f9f52" strokeWidth={1.4} />
            <path d="M0 -24 l-6 -6 M0 -24 l6 -6 M0 -36 l-4 -5 M0 -36 l4 -5" stroke="#5f9f52" strokeWidth={1} />
          </g>
        ))}
      </>
    );
  },
  pepper: () => {
    const pepper = (x: number, y: number, s: number, fill: string, shade: string) => (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M0 -22 C12 -24 24 -16 24 0 C24 14 18 26 8 26 C4 26 2 22 0 22 C-2 22 -4 26 -8 26 C-18 26 -24 14 -24 0 C-24 -16 -12 -24 0 -22Z" fill={fill} />
        <path d="M12 -20 C22 -14 24 -4 24 2 C24 14 18 26 8 26 C14 14 16 0 12 -20Z" fill={shade} opacity={0.5} />
        <path d="M0 -18 C-2 -4 -2 10 0 20" stroke={shade} strokeWidth={1.4} fill="none" opacity={0.6} />
        <ellipse cx={0} cy={-22} rx={8} ry={3.5} fill="#388e3c" />
        <path d="M0 -24 C0 -30 4 -34 9 -35" stroke="#2e7d32" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Shine x={-12} y={-6} rx={3.5} ry={9} r={10} o={0.4} />
      </g>
    );
    return (
      <>
        <Shadow rx={36} />
        {pepper(42, 70, 0.9, '#f9a825', '#e08a00')}
        {pepper(74, 66, 1.08, '#d32f2f', '#9a1b1b')}
      </>
    );
  },
  beans: () => {
    const bean = (x: number, y: number, r: number, red: boolean) => (
      <g key={`${x},${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
        <path d="M-5 -1 C-5 -4 -2 -4 0 -3 C2 -4 5 -4 5 -1 C5 3 2 4 0 4 C-2 4 -5 3 -5 -1Z" fill={red ? '#8e2f25' : '#f4ecdc'} stroke={red ? '#6d2119' : '#d6c9ad'} strokeWidth={0.8} />
      </g>
    );
    const pile: [number, number, number, boolean][] = [
      [46, 46, 10, false], [54, 44, -20, true], [62, 45, 30, false], [70, 44, 0, false], [76, 47, -30, true],
      [50, 50, 40, false], [58, 50, -10, false], [66, 50, 20, true], [74, 51, 50, false],
    ];
    return (
      <>
        <Shadow rx={38} />
        <path d="M30 98 C26 80 28 62 36 52 L84 52 C92 62 94 80 90 98Z" fill="#cba56b" />
        <path d="M36 66 C50 70 70 70 86 64 M33 82 C50 86 72 86 90 80" stroke="#b08a50" strokeWidth={1.4} fill="none" opacity={0.7} />
        <ellipse cx={60} cy={52} rx={27} ry={8} fill="#b58b52" />
        <ellipse cx={60} cy={51} rx={23} ry={5.5} fill="#f1e7d2" />
        {pile.map(([x, y, r, red]) => bean(x, y, r, red))}
        {bean(24, 96, 20, false)}
        {bean(98, 95, -30, true)}
        {bean(92, 100, 10, false)}
      </>
    );
  },
  sauerkraut: () => (
    <>
      <Shadow rx={30} />
      <Jar fill="#ece3a2" lid="#2e7d32" level={0.9} />
      <path d="M44 60 q4 -3 8 0 t8 0 t8 0 t8 0 M42 70 q4 -3 8 0 t8 0 t8 0 t8 0 M42 80 q4 -3 8 0 t8 0 t8 0 t8 0 M44 90 q4 -3 8 0 t8 0 t8 0 t8 0" stroke="#cdbb5c" strokeWidth={1.6} fill="none" />
      {[[48, 66], [70, 74], [56, 86], [74, 62]].map(([x, y]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={5} height={2.4} rx={1.2} fill="#f08a2b" />
      ))}
      <Leaf x={86} y={94} r={-40} len={20} w={9} fill="#9ccc65" vein="#6e9f45" />
    </>
  ),
  'apple-golden': () => (
    <>
      <Shadow rx={34} />
      <Apple x={42} y={70} s={0.75} fill="#d6cc3f" shade="#a99e22" />
      <Apple x={68} y={66} s={1.02} fill="#e8de58" shade="#b9ac2e" />
      {[[56, 60], [62, 76], [76, 70], [70, 56]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={0.9} fill="#a0941f" />
      ))}
    </>
  ),
  'apple-red': () => (
    <>
      <Shadow rx={36} />
      <Apple x={56} y={64} s={1.02} fill="#e0402f" shade="#a8251a" stripes="#f6b73c" />
      <g transform="translate(88 86)">
        <path d="M-15 0 C-15 -12 -6 -16 0 -12 C6 -16 15 -12 15 0 C15 10 7 14 0 13 C-7 14 -15 10 -15 0Z" fill="#e0402f" />
        <path d="M-12.5 0 C-12.5 -9 -5 -12.5 0 -9.5 C5 -12.5 12.5 -9 12.5 0 C12.5 8 6 11 0 10.5 C-6 11 -12.5 8 -12.5 0Z" fill="#fbecc0" />
        <path d="M-3 -2 C-3 -5 -1 -6 0 -6 C1 -6 3 -5 3 -2 M-2 2 l-1 3 M2 2 l1 3" stroke="#d9c88f" strokeWidth={1} fill="none" />
        <ellipse cx={-2.4} cy={1} rx={1.2} ry={2} fill="#4e342e" />
        <ellipse cx={2.4} cy={1} rx={1.2} ry={2} fill="#4e342e" />
      </g>
    </>
  ),
  pear: () => {
    const pear = (x: number, y: number, s: number, r: number) => (
      <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
        <path d="M0 -30 C6 -30 8 -20 10 -10 C12 0 24 6 24 20 C24 32 12 38 0 38 C-12 38 -24 32 -24 20 C-24 6 -12 0 -10 -10 C-8 -20 -6 -30 0 -30Z" fill="#c9d45c" />
        <path d="M10 -10 C12 0 24 6 24 20 C24 32 12 38 0 38 C12 28 16 12 8 -4Z" fill="#9aa632" opacity={0.5} />
        <path d="M-20 26 C-18 14 -12 10 -8 10 C-10 18 -12 26 -20 26Z" fill="#e3a14b" opacity={0.6} />
        {[[-6, 4], [4, 14], [10, 26], [-12, 22], [0, 30]].map(([px, py]) => (
          <circle key={`${px},${py}`} cx={px} cy={py} r={0.9} fill="#8a7a2a" />
        ))}
        <path d="M0 -30 C0 -36 3 -40 6 -42" stroke={STEM} strokeWidth={3} strokeLinecap="round" fill="none" />
        <Leaf x={3} y={-37} r={-20} len={14} w={5} />
        <Shine x={-10} y={10} rx={3.5} ry={8} r={15} o={0.4} />
      </g>
    );
    return (
      <>
        <Shadow rx={34} />
        {pear(44, 62, 0.8, -12)}
        {pear(70, 58, 1, 8)}
      </>
    );
  },
  'apple-juice': () => (
    <>
      <Shadow rx={34} />
      <Bottle
        x={50}
        w={32}
        h={74}
        liquid="#f4a524"
        cap="#43a047"
        label={
          <g>
            <rect x={36} y={66} width={28} height={20} rx={3} fill="#fff8e1" />
            <circle cx={50} cy={77} r={6} fill="#e0402f" />
            <path d="M50 71 l1 -3" stroke={STEM} strokeWidth={1.4} />
          </g>
        }
      />
      <Glass x={84} w={22} h={32} fill="#f6b13a" />
    </>
  ),
  strawberry: () => (
    <>
      <Shadow rx={36} />
      <Strawberry x={42} y={66} r={-16} s={1} />
      <Strawberry x={76} y={64} r={14} s={1.05} />
      <Strawberry x={60} y={82} r={0} s={0.9} />
    </>
  ),
  raspberry: () => (
    <>
      <Shadow rx={34} />
      <Leaf x={60} y={44} r={-150} len={26} w={11} fill="#6b9f3e" vein="#4a7a28" />
      <Leaf x={60} y={44} r={-30} len={24} w={10} fill="#5e9337" vein="#4a7a28" />
      <Raspberry x={42} y={72} s={1} />
      <Raspberry x={78} y={70} s={1.05} color="#c2185b" />
      <Raspberry x={60} y={84} s={0.95} />
    </>
  ),
  blueberry: () => {
    const berry = (x: number, y: number, r = 7) => (
      <g key={`${x},${y}`}>
        <circle cx={x} cy={y} r={r} fill="#3f4f9e" />
        <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill="#9fa8da" opacity={0.5} />
        <path d={`M${x - 2} ${y - r + 2} l2 1.5 l2 -1.5`} stroke="#232c63" strokeWidth={1.2} fill="none" />
      </g>
    );
    return (
      <>
        <Shadow rx={38} />
        {[[42, 52], [54, 48], [66, 48], [78, 52], [48, 58], [60, 56], [72, 58]].map(([x, y]) => berry(x!, y!))}
        <path d="M30 58 H90 L84 96 H36Z" fill="#dcbc8b" />
        <path d="M42 58 L44 96 M54 58 L55 96 M66 58 L65 96 M78 58 L76 96" stroke="#c49f68" strokeWidth={1.6} />
        <rect x={28} y={56} width={64} height={6} rx={2} fill="#c9a571" />
        {berry(22, 96, 6)}
        {berry(98, 94, 6)}
      </>
    );
  },
  blackcurrant: () => {
    const berry = (x: number, y: number) => (
      <g key={`${x},${y}`}>
        <circle cx={x} cy={y} r={6.4} fill="#2b1631" />
        <circle cx={x - 2} cy={y - 2} r={2} fill="#8d6e9a" opacity={0.6} />
      </g>
    );
    return (
      <>
        <Shadow rx={30} />
        <path d="M28 30 C46 34 62 40 72 54 C80 64 82 76 80 88" stroke="#5d4037" strokeWidth={2.4} fill="none" />
        <path d="M50 38 C48 50 46 62 46 76" stroke="#5d4037" strokeWidth={1.6} fill="none" />
        <path d="M24 26 C20 16 28 8 36 12 C40 4 52 8 48 18 C58 18 56 30 46 30 C42 36 30 34 30 28Z" fill="#4c8c3a" />
        <path d="M30 26 L44 16 M36 22 L36 12 M40 22 L50 22" stroke="#376b29" strokeWidth={1.2} />
        {[[46, 52], [44, 64], [48, 76], [40, 86]].map(([x, y]) => berry(x!, y!))}
        {[[74, 60], [80, 72], [76, 84], [84, 92], [68, 92]].map(([x, y]) => berry(x!, y!))}
      </>
    );
  },
  'frozen-raspberry': () => (
    <>
      <Shadow rx={34} />
      <rect x={26} y={30} width={68} height={68} rx={8} fill="#d7ecf6" stroke="#9fc9e0" strokeWidth={1.4} />
      <rect x={26} y={36} width={68} height={4} fill="#5b9fd0" />
      <Raspberry x={44} y={66} s={0.75} color="#c2185b" light="#e4789f" />
      <Raspberry x={68} y={62} s={0.75} color="#c2185b" light="#e4789f" />
      <Raspberry x={56} y={82} s={0.75} color="#c2185b" light="#e4789f" />
      <Raspberry x={78} y={84} s={0.7} color="#c2185b" light="#e4789f" />
      {[[36, 50], [82, 52], [40, 92], [64, 70], [50, 58]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={1.6} fill="#fff" opacity={0.9} />
      ))}
      <rect x={30} y={44} width={60} height={50} rx={6} fill="#fff" opacity={0.18} />
      <g transform="translate(82 22)" stroke="#4a90c2" strokeWidth={2} strokeLinecap="round">
        <path d="M0 -9 V9 M-8 -4.5 L8 4.5 M-8 4.5 L8 -4.5" />
        <path d="M-2 -7 L0 -5 L2 -7 M-2 7 L0 5 L2 7" fill="none" />
      </g>
    </>
  ),
  jam: () => (
    <>
      <Shadow rx={30} />
      <Jar fill="#a3123a" lid="#a3123a" level={0.88} label="#fff3e0" />
      <path d="M32 44 C34 34 46 36 60 36 C74 36 86 34 88 44 L86 50 L82 46 L78 51 L74 46 L70 51 L66 46 L62 51 L58 46 L54 51 L50 46 L46 51 L42 46 L38 51 L34 46Z" fill="#e53935" />
      {[38, 48, 58, 68, 78].map((x) => (
        <rect key={x} x={x} y={38} width={5} height={5} fill="#fff" opacity={0.75} />
      ))}
      {[43, 53, 63, 73].map((x) => (
        <rect key={`b${x}`} x={x} y={43} width={5} height={4} fill="#fff" opacity={0.75} />
      ))}
      <path d="M36 50 C50 54 70 54 84 50" stroke="#8d6e63" strokeWidth={2} fill="none" />
      <Raspberry x={60} y={76} s={0.42} color="#c2185b" />
    </>
  ),
  bryndza: () => (
    <>
      <Shadow rx={42} cy={102} />
      <Board />
      <path d="M32 60 L48 48 H90 L76 60Z" fill="#ffffff" />
      <path d="M76 60 L90 48 V78 L76 90Z" fill="#e4dfcf" />
      <rect x={32} y={60} width={44} height={30} fill="#f7f4ea" />
      {[[40, 68], [52, 76], [64, 66], [46, 84], [68, 82], [58, 54], [74, 52], [82, 66]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={1.6} fill="#dcd5c1" />
      ))}
      <path d="M38 90 l2 -3 l3 3 M60 90 l2 -2 l2 2" fill="#f7f4ea" />
      {[[26, 88], [86, 92], [92, 88]].map(([x, y]) => (
        <circle key={`c${x}`} cx={x} cy={y} r={2.2} fill="#f7f4ea" stroke="#e0dac8" strokeWidth={0.8} />
      ))}
      <Leaf x={22} y={84} r={-60} len={14} w={4} fill="#7a9e4f" vein="#5c7d38" />
    </>
  ),
  milk: () => (
    <>
      <Shadow rx={30} />
      <Bottle
        x={56}
        w={36}
        h={78}
        liquid="#fdfdfb"
        cap="#1e88e5"
        label={
          <g>
            <rect x={39} y={64} width={34} height={22} rx={3} fill="#1e88e5" />
            <path d="M45 70 c3 -2 6 0 5 3 c-1 3 -5 2 -5 -3Z M60 72 c4 -2 8 1 6 4 c-2 2 -6 1 -6 -4Z M53 80 c2 -1 4 1 3 2 c-1 1 -3 1 -3 -2Z" fill="#fff" />
          </g>
        }
      />
      <Glass x={88} w={20} h={28} fill="#fdfdfb" />
    </>
  ),
  'hard-cheese': () => (
    <>
      <Shadow rx={40} />
      <path d="M26 64 L60 38 L98 52 L98 58 L26 70Z" fill="#ffd966" />
      <path d="M26 64 L98 52 V88 L26 94Z" fill="#f6c443" />
      <path d="M60 38 L98 52 V56 L60 42Z" fill="#e0a925" />
      <path d="M26 94 L98 88 V91 L26 97Z" fill="#d99a1e" />
      {[[40, 78, 4.5, 3.5], [62, 72, 3.5, 3], [82, 80, 5, 4], [52, 88, 3, 2.4], [74, 64, 2.6, 2], [86, 66, 2.2, 1.8]].map(([x, y, rx, ry]) => (
        <ellipse key={`${x},${y}`} cx={x} cy={y} rx={rx} ry={ry} fill="#dfa52b" />
      ))}
      {[[56, 52, 3, 1.6], [72, 54, 2.4, 1.3], [44, 60, 2.2, 1.2]].map(([x, y, rx, ry]) => (
        <ellipse key={`t${x}`} cx={x} cy={y} rx={rx} ry={ry} fill="#efbe3f" />
      ))}
    </>
  ),
  'sour-cream': () => (
    <>
      <Shadow rx={34} />
      <g transform="translate(78 30) rotate(25)">
        <rect x={-3} y={0} width={6} height={36} rx={3} fill="#d39b5c" />
        <ellipse cx={0} cy={40} rx={7} ry={10} fill="#d39b5c" />
      </g>
      <path d="M28 64 H92 C92 84 80 98 60 98 C40 98 28 84 28 64Z" fill="#c8693a" />
      <path d="M30 74 H90" stroke="#e8a172" strokeWidth={3} />
      <path d="M78 64 H92 C92 84 80 98 60 98 C74 92 80 80 78 64Z" fill="#9c4a22" opacity={0.45} />
      <path d="M28 64 C32 52 46 48 54 51 C58 42 70 43 72 50 C82 48 92 56 92 64Z" fill="#fffdf6" />
      <path d="M48 56 C54 52 60 54 62 58" stroke="#ece6d6" strokeWidth={2} fill="none" strokeLinecap="round" />
      <rect x={26} y={62} width={68} height={5} rx={2.5} fill="#b45d31" />
    </>
  ),
  butter: () => (
    <>
      <Shadow rx={40} />
      <path d="M18 80 L36 66 H102 L84 80Z" fill="#efe6d2" />
      <path d="M18 80 H84 V86 H18Z" fill="#e0d5bd" />
      <path d="M34 66 L46 56 H86 L74 66Z" fill="#fbe8a0" />
      <path d="M74 66 L86 56 V72 L74 82Z" fill="#e9c75a" />
      <rect x={34} y={66} width={40} height={16} fill="#f7dc7a" />
      <path d="M50 52 C46 46 54 40 60 44 C66 40 72 48 66 52 C62 56 54 56 50 52Z" fill="#fbe8a0" stroke="#e9c75a" strokeWidth={1} />
      <path d="M54 50 C56 46 62 46 63 49" stroke="#e9c75a" strokeWidth={1.2} fill="none" />
      <rect x={86} y={70} width={8} height={12} rx={1} fill="#f7dc7a" transform="rotate(12 90 76)" />
    </>
  ),
  'goat-milk': () => (
    <>
      <Shadow rx={32} />
      <path d="M80 50 C96 50 98 72 82 78" stroke="#dfe7ee" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M40 34 L36 28 H80 V40 C88 52 90 70 86 84 C84 94 76 98 60 98 C44 98 36 94 34 84 C30 70 32 52 40 40Z" fill="#fbfaf6" stroke="#cfd8dc" strokeWidth={1.4} />
      <path d="M36 28 L30 24 L42 30Z" fill="#fbfaf6" stroke="#cfd8dc" strokeWidth={1} />
      <ellipse cx={58} cy={30} rx={21} ry={3.5} fill="#ffffff" stroke="#cfd8dc" strokeWidth={1} />
      <path d="M34 62 C50 66 70 66 88 62 M34 70 C50 74 70 74 88 70" stroke="#5b8fd0" strokeWidth={3} fill="none" />
      <Leaf x={92} y={96} r={-120} len={16} w={4} fill="#8bb04f" vein="#6b8d38" />
      <Leaf x={96} y={98} r={-95} len={14} w={3.5} fill="#7aa344" vein="#6b8d38" />
    </>
  ),
  'goat-cheese': () => (
    <>
      <Shadow rx={42} cy={102} />
      <Board />
      <rect x={30} y={56} width={52} height={30} rx={15} fill="#fbf8ec" stroke="#e3dcc6" strokeWidth={1.2} />
      <ellipse cx={82} cy={71} rx={9} ry={15} fill="#fffdf4" stroke="#e3dcc6" strokeWidth={1.2} />
      {[[38, 62], [46, 72], [56, 60], [62, 76], [70, 64], [42, 80], [74, 80], [52, 68], [66, 70]].map(([x, y], i) => (
        <rect key={`${x},${y}`} x={x} y={y} width={3} height={1.4} rx={0.7} fill={i % 2 ? '#6a9b3c' : '#4f7d2a'} transform={`rotate(${i * 37} ${x} ${y})`} />
      ))}
      <ellipse cx={98} cy={88} rx={6} ry={3} fill="#fffdf4" stroke="#e3dcc6" strokeWidth={1} />
      <Leaf x={24} y={86} r={-70} len={16} w={4} fill="#5d8f3a" vein="#43702a" />
    </>
  ),
  kefir: () => (
    <>
      <Shadow rx={32} />
      <Bottle
        x={48}
        w={28}
        h={84}
        liquid="#fbfbf7"
        cap="#43a047"
        label={
          <g>
            <rect x={36} y={62} width={24} height={26} rx={3} fill="#a5d6a7" />
            <path d="M40 70 H56 M40 76 H52" stroke="#2e7d32" strokeWidth={2} strokeLinecap="round" />
          </g>
        }
      />
      <Glass x={82} w={24} h={30} fill="#fbfbf7" />
      <path d="M72 74 C76 70 80 74 84 70 C88 74 90 72 92 72" stroke="#e6e3d8" strokeWidth={2} fill="none" />
    </>
  ),
  'honey-linden': () => (
    <>
      <Shadow rx={36} />
      <Jar x={54} w={50} h={50} fill="#f2b230" lid="#b07a45" label="#fff3d6" />
      <path d="M44 72 l4 6 l4 -6 M56 72 l4 6 l4 -6" stroke="#d48f12" strokeWidth={1.6} fill="none" />
      <HoneyDipper x={88} y={70} r={22} />
      <g transform="translate(26 92) rotate(-30)">
        <path d="M0 0 C-10 -6 -12 -18 -4 -22 C0 -24 2 -20 2 -18 C4 -22 10 -22 12 -16 C14 -8 8 -2 0 0Z" fill="#6aa843" />
        <path d="M0 -1 L1 -17" stroke="#4a7d2a" strokeWidth={1} />
      </g>
      {[[34, 78], [30, 74], [37, 72]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={2.2} fill="#fff59d" stroke="#e6d36b" strokeWidth={0.6} />
      ))}
    </>
  ),
  'honey-buckwheat': () => (
    <>
      <Shadow rx={34} />
      <Jar x={52} w={40} h={58} fill="#8a3f10" lid="#4e2c12" label="#e8d2a8" />
      <path d="M40 72 H64 M40 78 H58" stroke="#8a5a2b" strokeWidth={2} strokeLinecap="round" />
      <Shine x={44} y={58} rx={2} ry={6} r={0} o={0.3} />
      <path d="M84 98 C84 80 82 64 86 46" stroke="#b5524a" strokeWidth={2} fill="none" />
      <path d="M85 70 C90 64 94 62 98 60 M84 82 C78 76 76 72 74 66" stroke="#b5524a" strokeWidth={1.6} fill="none" />
      {[[86, 44], [84, 40], [89, 41], [98, 58], [101, 56], [96, 55], [74, 64], [71, 62], [76, 61], [87, 47]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={2.2} fill="#fde4ea" stroke="#e8a6b6" strokeWidth={0.6} />
      ))}
      <Leaf x={84} y={88} r={-150} len={12} w={6} fill="#6aa843" />
    </>
  ),
  'honey-acacia': () => (
    <>
      <Shadow rx={32} />
      <Jar x={50} w={34} h={66} fill="#f7e48c" lid="#d4a017" level={0.9} />
      <path d="M42 62 H58 M42 70 H54" stroke="#e0c35a" strokeWidth={2} strokeLinecap="round" />
      <path d="M76 26 C80 40 82 54 80 70" stroke="#7a9e4f" strokeWidth={1.6} fill="none" />
      {[[78, 34], [80, 42], [81, 50], [81, 58], [80, 66]].map(([x, y], i) => (
        <g key={`${x},${y}`}>
          <ellipse cx={x! - 5} cy={y} rx={4} ry={2.6} fill="#ffffff" stroke="#d9d4c4" strokeWidth={0.7} transform={`rotate(${-20 + i * 4} ${x! - 5} ${y})`} />
          <ellipse cx={x! + 5} cy={y! + 2} rx={4} ry={2.6} fill="#ffffff" stroke="#d9d4c4" strokeWidth={0.7} transform={`rotate(${20 - i * 4} ${x! + 5} ${y! + 2})`} />
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse cx={92} cy={70 + i * 7} rx={4} ry={2} fill="#7cb342" />
          <ellipse cx={102} cy={70 + i * 7} rx={4} ry={2} fill="#7cb342" />
        </g>
      ))}
      <path d="M97 66 V96" stroke="#5c8a35" strokeWidth={1.2} />
    </>
  ),
  honeycomb: () => {
    const cells: [number, number, boolean][] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        cells.push([31 + col * 11.5 + (row % 2) * 5.75, 42 + row * 10, (row * 7 + col * 3) % 4 === 0]);
      }
    }
    return (
      <>
        <Shadow rx={42} />
        <rect x={22} y={34} width={78} height={58} rx={8} fill="#d48f12" />
        {cells.map(([x, y, dark]) => (
          <Hexagon key={`${x},${y}`} x={x} y={y} r={6.2} fill={dark ? '#e39a17' : '#f6c341'} stroke="#c47f0c" />
        ))}
        <path d="M44 92 C44 98 48 98 48 102 C48 106 44 106 44 102Z M76 92 C76 96 79 96 79 99 C79 102 76 102 76 99Z" fill="#e39a17" />
        <Shine x={40} y={46} rx={8} ry={2.4} r={0} o={0.35} />
      </>
    );
  },
  eggs: () => (
    <>
      <Shadow rx={42} />
      <path d="M20 66 H100 L96 74 H24Z" fill="#b3ab9c" />
      <Egg x={36} y={56} s={0.95} fill="#d9a066" shade="#b37a40" />
      <Egg x={60} y={54} s={0.95} fill="#f3e9d8" shade="#cfc1a6" />
      <Egg x={84} y={56} s={0.95} fill="#d9a066" shade="#b37a40" />
      <Egg x={30} y={70} s={1} fill="#e2ad73" shade="#b37a40" />
      <Egg x={54} y={68} s={1} fill="#d9a066" shade="#b37a40" />
      <Egg x={78} y={70} s={1} fill="#e2ad73" shade="#b37a40" />
      <path d="M18 74 H102 L96 96 H24Z" fill="#cbc3b3" />
      {[30, 54, 78].map((x) => (
        <path key={x} d={`M${x - 10} 74 C${x - 8} 84 ${x + 8} 84 ${x + 10} 74`} fill="#b9b1a1" />
      ))}
      <path d="M24 96 H96" stroke="#a9a090" strokeWidth={2} />
    </>
  ),
  'quail-eggs': () => {
    const egg = (x: number, y: number, r: number) => (
      <g key={`${x},${y}`} transform={`translate(${x} ${y}) rotate(${r})`}>
        <path d="M0 -9 C5 -9 7 -2 7 2 C7 7 4 9 0 9 C-4 9 -7 7 -7 2 C-7 -2 -5 -9 0 -9Z" fill="#efe6cf" />
        {[[-3, -4, 1.8], [2, -2, 1.3], [-1, 3, 2], [4, 4, 1.1], [-4, 3, 1], [1, -7, 1.1]].map(([sx, sy, sr]) => (
          <circle key={`${sx},${sy}`} cx={sx} cy={sy} r={sr} fill="#5b3a22" />
        ))}
      </g>
    );
    return (
      <>
        <Shadow rx={40} />
        <ellipse cx={60} cy={82} rx={40} ry={16} fill="#b98d4a" />
        {egg(42, 68, -15)}
        {egg(58, 64, 5)}
        {egg(74, 68, 20)}
        {egg(50, 76, -5)}
        {egg(68, 78, 10)}
        <path d="M22 80 C40 96 80 96 98 80 C96 96 80 100 60 100 C40 100 24 96 22 80Z" fill="#a67a3a" />
        <path d="M24 82 C40 90 52 86 66 92 C76 96 88 88 96 84 M28 90 C44 96 60 92 74 98 M30 78 L46 84 M74 84 L92 78" stroke="#d6b46d" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </>
    );
  },
  chicken: () => (
    <>
      <Shadow rx={42} cy={102} />
      <Board />
      <path d="M38 68 C30 62 24 56 19 50 C15 45 20 39 25 43 C31 48 40 55 46 62Z" fill="#e9b47c" />
      <path d="M82 68 C90 62 96 56 101 50 C105 45 100 39 95 43 C89 48 80 55 74 62Z" fill="#e9b47c" />
      <circle cx={17} cy={45} r={3.6} fill="#f8eee2" />
      <circle cx={21} cy={41} r={3.6} fill="#f8eee2" />
      <circle cx={103} cy={45} r={3.6} fill="#f8eee2" />
      <circle cx={99} cy={41} r={3.6} fill="#f8eee2" />
      <path d="M22 76 C22 60 40 50 60 50 C80 50 98 60 98 76 C98 90 82 96 60 96 C38 96 22 90 22 76Z" fill="#f0c08a" />
      <path d="M98 76 C98 90 82 96 60 96 C78 90 88 80 86 62 C94 66 98 70 98 76Z" fill="#d6955a" opacity={0.6} />
      <path d="M34 80 C36 70 46 66 54 70 C50 78 42 84 34 80Z M86 80 C84 70 74 66 66 70 C70 78 78 84 86 80Z" fill="#e3a868" />
      <path d="M52 52 C56 56 64 56 68 52" stroke="#d6955a" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Shine x={50} y={62} rx={11} ry={4} r={-10} o={0.4} />
      <Leaf x={92} y={92} r={-150} len={18} w={3.5} fill="#5d8f3a" vein="#43702a" />
    </>
  ),
  'chicken-fillet': () => {
    const fillet = (x: number, y: number, r: number) => (
      <g transform={`translate(${x} ${y}) rotate(${r})`}>
        <path d="M-26 2 C-26 -10 -12 -14 2 -12 C16 -10 28 -6 28 2 C28 10 14 14 0 12 C-14 12 -26 12 -26 2Z" fill="#f5b5a3" />
        <path d="M-20 -2 C-10 -8 8 -8 20 -2" stroke="#fbd3c7" strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M-16 4 C-6 2 8 2 18 6 M-12 8 C0 6 8 7 14 9" stroke="#e8998a" strokeWidth={1.2} fill="none" />
      </g>
    );
    return (
      <>
        <Shadow rx={42} cy={102} />
        <Board />
        {fillet(52, 74, -6)}
        {fillet(66, 60, 8)}
        <Leaf x={26} y={86} r={-40} len={18} w={3.5} fill="#5d8f3a" vein="#43702a" />
        <Leaf x={92} y={86} r={-140} len={16} w={3.5} fill="#5d8f3a" vein="#43702a" />
      </>
    );
  },
  sausage: () => (
    <>
      <Shadow rx={36} />
      <path d="M34 82 C24 58 40 36 60 36 C80 36 96 58 86 82" stroke="#8f2f24" strokeWidth={18} strokeLinecap="round" fill="none" />
      <path d="M34 80 C26 58 41 40 60 40 C79 40 94 58 86 80" stroke="#b5463a" strokeWidth={9} strokeLinecap="round" fill="none" />
      {[[34, 66], [42, 48], [56, 38], [72, 40], [84, 54], [87, 70]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={1.6} fill="#f3c9b8" />
      ))}
      <path d="M86 82 C88 88 90 92 94 94 M34 82 C32 88 30 92 26 94 M90 90 C86 92 94 96 96 92" stroke="#c9a36b" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {[[52, 90], [68, 92]].map(([x, y]) => (
        <g key={`s${x}`}>
          <ellipse cx={x} cy={y} rx={8} ry={5} fill="#8f2f24" />
          <ellipse cx={x} cy={y! - 1} rx={7} ry={4} fill="#c0564a" />
          <circle cx={x! - 2} cy={y! - 2} r={1} fill="#f3c9b8" />
          <circle cx={x! + 3} cy={y} r={1} fill="#f3c9b8" />
        </g>
      ))}
    </>
  ),
  salo: () => (
    <>
      <Shadow rx={42} cy={102} />
      <Board />
      <path d="M26 58 L40 46 H92 L78 58Z" fill="#f8f0e6" />
      <path d="M78 58 L92 46 V74 L78 86Z" fill="#ecdccd" />
      <rect x={26} y={58} width={52} height={28} fill="#f6ece2" />
      <rect x={26} y={56} width={52} height={5} fill="#8a5a2b" />
      <path d="M40 46 H92 L78 58 H26Z" fill="none" />
      <path d="M40 46 H92 L90 48 H38Z" fill="#8a5a2b" />
      <rect x={26} y={70} width={52} height={5} fill="#e39a95" />
      {[[34, 52], [52, 50], [70, 52], [60, 54]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={1.1} fill="#c0392b" />
      ))}
      <g transform="translate(90 84) rotate(-10)">
        <rect x={-6} y={-12} width={12} height={22} rx={1} fill="#f6ece2" />
        <rect x={-6} y={-12} width={12} height={3} fill="#8a5a2b" />
        <rect x={-6} y={0} width={12} height={3} fill="#e39a95" />
      </g>
    </>
  ),
  pork: () => (
    <>
      <Shadow rx={42} cy={102} />
      <Board />
      <path d="M28 70 C26 54 40 44 58 44 C78 44 94 52 94 68 C94 84 78 92 58 92 C40 92 30 84 28 70Z" fill="#c84a4a" />
      <path d="M28 70 C26 54 40 44 58 44 C46 50 38 60 40 76 C42 84 46 88 52 92 C40 90 30 82 28 70Z" fill="#f2e2d6" />
      <path d="M52 56 C60 60 70 56 78 62 M58 70 C66 66 74 72 84 68 M54 82 C64 78 72 84 82 80" stroke="#f1c6c0" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d="M94 68 C94 84 78 92 58 92 C76 84 86 74 88 56 C92 60 94 64 94 68Z" fill="#9c3434" opacity={0.45} />
      <Shine x={66} y={52} rx={8} ry={3} r={-5} o={0.3} />
      <Leaf x={92} y={92} r={-160} len={20} w={3.5} fill="#5d8f3a" vein="#43702a" />
    </>
  ),
  'rye-bread': () => (
    <>
      <Shadow rx={42} />
      <path d="M22 60 C22 46 40 40 60 40 C80 40 98 46 98 60 V88 C98 94 94 96 88 96 H32 C26 96 22 94 22 88Z" fill="#6b3d22" />
      <path d="M22 60 C22 46 40 40 60 40 C80 40 98 46 98 60 C98 66 80 68 60 68 C40 68 22 66 22 60Z" fill="#7d4a2a" />
      <path d="M36 48 L44 60 M50 46 L58 60 M64 46 L72 60 M78 48 L86 60" stroke="#9c6640" strokeWidth={3} strokeLinecap="round" />
      {[[30, 56], [46, 54], [62, 56], [80, 54], [90, 58], [40, 50], [70, 50]].map(([x, y]) => (
        <ellipse key={`${x},${y}`} cx={x} cy={y} rx={1.4} ry={0.8} fill="#d8b47a" />
      ))}
      <path d="M22 74 H98 M22 86 H98" stroke="#5a321b" strokeWidth={1.4} opacity={0.5} />
    </>
  ),
  sourdough: () => (
    <>
      <Shadow rx={40} />
      <path d="M20 76 C20 52 38 38 60 38 C82 38 100 52 100 76 C100 92 84 98 60 98 C36 98 20 92 20 76Z" fill="#d79b5a" />
      <path d="M20 76 C20 92 36 98 60 98 C84 98 100 92 100 76 C96 86 80 90 60 90 C40 90 24 86 20 76Z" fill="#b9773f" />
      <path d="M36 58 C46 48 62 46 80 54" stroke="#f0cd96" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M36 58 C46 48 62 46 80 54" stroke="#a96a35" strokeWidth={1.4} fill="none" transform="translate(0 4)" />
      <path d="M40 74 C50 70 64 70 76 74" stroke="#c48548" strokeWidth={2} fill="none" strokeLinecap="round" />
      {[[34, 50], [48, 44], [70, 44], [86, 52], [56, 62], [76, 64], [42, 66], [90, 66]].map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={1.4} fill="#fff" opacity={0.7} />
      ))}
    </>
  ),
  palianytsia: () => (
    <>
      <Shadow rx={38} />
      <path d="M24 72 C24 64 40 60 60 60 C80 60 96 64 96 72 V86 C96 94 80 98 60 98 C40 98 24 94 24 86Z" fill="#c98536" />
      <path d="M22 66 L30 72 L36 64 L44 72 L52 64 L60 72 L68 64 L76 72 L84 64 L90 72 L98 66 C98 72 80 76 60 76 C40 76 22 72 22 66Z" fill="#f2cf8f" />
      <path d="M22 64 C22 42 40 30 60 30 C80 30 98 42 98 64 C98 70 80 72 60 72 C40 72 22 70 22 64Z" fill="#dc9a48" />
      <path d="M32 50 C42 40 54 36 66 36" stroke="#eab26a" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.9} />
      <Shine x={44} y={44} rx={10} ry={4} r={-20} o={0.3} />
    </>
  ),
  'poppy-bun': () => {
    const bun = (x: number, y: number, s: number) => (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <circle cx={0} cy={0} r={24} fill="#e3a554" />
        <path d="M0 0 C6 -2 6 -10 0 -10 C-10 -10 -12 2 -6 8 C2 16 16 12 18 0 C20 -14 6 -22 -6 -20" stroke="#c9853a" strokeWidth={3} fill="none" strokeLinecap="round" />
        {[[2, -6], [-6, -4], [-8, 4], [0, 10], [10, 8], [14, -2], [8, -14], [-4, -16], [-14, -10], [-16, 6], [-6, 18], [16, 14]].map(([px, py]) => (
          <circle key={`${px},${py}`} cx={px} cy={py} r={1.1} fill="#2d2a35" />
        ))}
        <Shine x={-10} y={-12} rx={6} ry={3} r={-30} o={0.4} />
      </g>
    );
    return (
      <>
        <Shadow rx={40} />
        {bun(42, 72, 0.85)}
        {bun(76, 68, 1)}
      </>
    );
  },
  'apple-pie': () => (
    <>
      <Shadow rx={44} />
      <ellipse cx={60} cy={80} rx={44} ry={16} fill="#aab2b8" />
      <ellipse cx={60} cy={74} rx={42} ry={16} fill="#e1a95f" />
      <ellipse cx={60} cy={73} rx={35} ry={12} fill="#c47a2c" />
      {[-24, -12, 0, 12, 24].map((dx) => (
        <path key={dx} d={`M${60 + dx - 6} ${62} L${60 + dx + 6} ${85}`} stroke="#eab36a" strokeWidth={5} strokeLinecap="round" />
      ))}
      {[-8, 0, 8].map((dy) => (
        <path key={`h${dy}`} d={`M${30 + Math.abs(dy)} ${73 + dy} H${90 - Math.abs(dy)}`} stroke="#f0c07a" strokeWidth={4.5} strokeLinecap="round" />
      ))}
      <path d="M18 74 C18 82 36 90 60 90 C84 90 102 82 102 74" stroke="#d39446" strokeWidth={4} fill="none" strokeDasharray="5 3" />
    </>
  ),
};

const BASKET_COLORS: Record<string, readonly [string, string, string]> = {
  vegetables: ['#f57c1f', '#e53935', '#7cb85a'],
  fruits: ['#e0402f', '#e8de58', '#f4a524'],
  berries: ['#d81b60', '#3f4f9e', '#e53935'],
  dairy: ['#fdfcf7', '#f6c443', '#e9e4d6'],
  honey: ['#f2b230', '#d48f12', '#f6e27f'],
  'meat-eggs': ['#d9a066', '#c84a4a', '#f3e9d8'],
  bakery: ['#d79b5a', '#6e4024', '#e3a554'],
};

const DEFAULT_BASKET = ['#8bc34a', '#f57c1f', '#e53935'] as const;

function Basket({ category }: { category: string }) {
  const [a, b, c] = BASKET_COLORS[category] ?? DEFAULT_BASKET;
  return (
    <>
      <Shadow rx={40} />
      <path d="M30 60 C30 30 90 30 90 60" stroke="#a8723d" strokeWidth={5} fill="none" />
      <circle cx={46} cy={56} r={13} fill={a} stroke="#00000014" />
      <circle cx={74} cy={56} r={13} fill={b} stroke="#00000014" />
      <circle cx={60} cy={50} r={13} fill={c} stroke="#00000014" />
      <Leaf x={60} y={40} r={-60} len={14} w={5} />
      <path d="M20 60 H100 L90 96 H30Z" fill="#c48a4a" />
      <path d="M22 70 H98 M25 80 H95 M28 90 H92" stroke="#a8723d" strokeWidth={2} />
      <path d="M40 60 L44 96 M60 60 V96 M80 60 L76 96" stroke="#a8723d" strokeWidth={2} />
      <rect x={18} y={57} width={84} height={6} rx={3} fill="#b37a40" />
    </>
  );
}

interface Props {
  art: ArtKey;
  /** Розмір полотна (CSS); типово - на всю ширину й висоту контейнера. */
  size?: number | string;
}

/** Ілюстрація товару. Декоративна: назву товару вже показує картка, тож малюнок прихований від читачів екрана. */
export function ProductArt({ art, size = '100%' }: Props) {
  const content = art.startsWith('basket:') ? <Basket category={art.slice('basket:'.length)} /> : ART[art as ProductArtKey]();
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      {content}
    </svg>
  );
}
