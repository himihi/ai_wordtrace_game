/**
 * 节点布局生成器（开发期工具，关卡数据坐标由它生成）
 * 使用带种子的伪随机数，保证同一关每次生成的布局一致
 */

export interface Point {
  x: number;
  y: number;
}

/** mulberry32：小巧的确定性伪随机数发生器 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * 环形均匀分布（L1 阶段，n 通常为 4）
 * 随机起始角 + 椭圆轨道，避免每关长得一样
 */
export function generateRing(n: number, seed = 1): Point[] {
  const rnd = mulberry32(seed);
  const baseAngle = rnd() * Math.PI * 2;
  const cx = 50;
  const cy = 50;
  const rx = 33;
  const ry = 31;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = baseAngle + ((Math.PI * 2) / n) * i;
    pts.push({
      x: round1(cx + rx * Math.cos(a)),
      y: round1(cy + ry * Math.sin(a))
    });
  }
  return pts;
}

/**
 * 确定性洗牌（Fisher–Yates）：与布局同一套种子随机数，保证可复现。
 * 用于把「位置集合」随机分配给节点，避免正确节点按字序绕环排布
 * （否则 L1 连线永远顺/逆时针，缺少变化）。
 */
export function shuffled<T>(arr: T[], seed = 1): T[] {
  const rnd = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 四点按顺序连线（p0→p1→p2→p3）是否交叉（仅首段与末段可能相交） */
export function pathCrosses(p0: Point, p1: Point, p2: Point, p3: Point): boolean {
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(p2, p3, p0);
  const d2 = cross(p2, p3, p1);
  const d3 = cross(p0, p1, p2);
  const d4 = cross(p0, p1, p3);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * 洗牌并偏好「前四点按顺序连线交叉」的布局（确定性：同种子结果一致）。
 * L2/L3 的正确节点占据洗后位置的前 4 个，多试几个种子取第一个交叉的，
 * 找不到就退回首次洗牌结果。
 */
export function shuffledPreferCross(arr: Point[], seed = 1): Point[] {
  let fallback = shuffled(arr, seed);
  for (let k = 0; k < 8; k++) {
    const cand = shuffled(arr, seed + k * 101);
    if (pathCrosses(cand[0], cand[1], cand[2], cand[3])) return cand;
    if (k === 0) fallback = cand;
  }
  return fallback;
}

/**
 * 分散随机分布（L2/L3 阶段）
 * 拒绝采样保证最小间距与边界留白；采样失败会抛错（数据问题尽早暴露）
 */
export function generateScattered(
  n: number,
  seed = 1,
  minDist = 16,
  margin = 11
): Point[] {
  const rnd = mulberry32(seed);
  const pts: Point[] = [];
  let guard = 0;
  while (pts.length < n && guard < 5000) {
    guard++;
    const x = margin + rnd() * (100 - 2 * margin);
    const y = margin + rnd() * (100 - 2 * margin);
    if (pts.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist)) {
      pts.push({ x: round1(x), y: round1(y) });
    }
  }
  if (pts.length < n) {
    throw new Error(`layout: 无法在约束内放置 ${n} 个节点 (seed=${seed})`);
  }
  return pts;
}
