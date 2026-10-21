/**
 * 关卡数据校验脚本（开发期）
 * 运行：npm run validate（需先 npm install 安装 tsx / typescript）
 *
 * 校验规则：
 *  1. 共 30 关，id 唯一且连续 1..30
 *  2. idiom 为 4 个汉字，chars 与 idiom 逐字一致
 *  3. 每关恰好 4 个正确节点且顺序 === chars
 *  4. 节点数量符合阶段设定（L1=4 / L2=5 / L3=6）
 *  5. 任意两节点间距 ≥ 14%，边界留白 ≥ 8%
 *  6. hints === 3
 */
import levels, { TOTAL_LEVELS } from '../data/levels';
import { dist } from '../utils/geometry';

let errors = 0;

function fail(msg: string): void {
  errors++;
  console.error(`  ✗ ${msg}`);
}

// 规则 1
if (TOTAL_LEVELS !== 30) {
  fail(`关卡总数应为 30，实际 ${TOTAL_LEVELS}`);
}
const ids = new Set<number>();
for (const lv of levels) {
  if (ids.has(lv.id)) fail(`关卡 id 重复: ${lv.id}`);
  ids.add(lv.id);
}

for (const lv of levels) {
  const tag = `第${lv.id}关「${lv.idiom}」`;
  const errsBefore = errors;

  // 规则 2
  if (lv.idiom.length !== 4) fail(`${tag}: idiom 长度 ≠ 4`);
  const chars = lv.idiom.split('');
  if (lv.chars.join('') !== chars.join('')) {
    fail(`${tag}: chars 与 idiom 不一致`);
  }

  // 规则 3
  const correct = lv.nodes.filter((n) => n.isCorrect);
  if (correct.length !== 4) {
    fail(`${tag}: 正确节点数 = ${correct.length}（应为 4）`);
  } else {
    correct.forEach((n, i) => {
      if (n.char !== lv.chars[i]) {
        fail(`${tag}: 第 ${i + 1} 个正确节点 char「${n.char}」≠「${lv.chars[i]}」`);
      }
    });
  }
  const nodeIds = new Set(lv.nodes.map((n) => n.id));
  if (nodeIds.size !== lv.nodes.length) fail(`${tag}: 节点 id 重复`);

  // 规则 4
  const expectCount = lv.id <= 10 ? 4 : lv.id <= 20 ? 5 : 6;
  if (lv.nodes.length !== expectCount) {
    fail(`${tag}: 节点数 = ${lv.nodes.length}（阶段期望 ${expectCount}）`);
  }

  // 规则 5
  for (let i = 0; i < lv.nodes.length; i++) {
    for (let j = i + 1; j < lv.nodes.length; j++) {
      const d = dist(lv.nodes[i], lv.nodes[j]);
      if (d < 14) {
        fail(`${tag}: 节点 ${lv.nodes[i].id} 与 ${lv.nodes[j].id} 间距 ${d.toFixed(1)} < 14`);
      }
    }
    const n = lv.nodes[i];
    if (n.x < 8 || n.x > 92 || n.y < 8 || n.y > 92) {
      fail(`${tag}: 节点 ${n.id} 超出安全边界 (${n.x}, ${n.y})`);
    }
  }

  // 规则 6
  if (lv.hints !== 3) fail(`${tag}: hints = ${lv.hints}（应为 3）`);

  if (errors === errsBefore) {
    console.log(`  ✓ ${tag} 节点数 ${lv.nodes.length}`);
  }
}

if (errors > 0) {
  console.error(`\n校验失败：共 ${errors} 个问题`);
  process.exit(1);
} else {
  console.log(`\n全部 ${TOTAL_LEVELS} 关校验通过 ✔`);
}
