/**
 * 30 关关卡数据
 *
 * 难度递进：
 *   L1（1–10）4 节点、无干扰、环形均匀分布 —— 建立规则
 *   L2（11–20）5 节点、1 个干扰项、分散打乱 —— 加入辨认
 *   L3（21–30）6 节点、2 个干扰项、充分分散 —— 加入干扰
 *
 * 坐标不手写，由 utils/layout 生成器按关卡 id 作为种子生成，保证可复现。
 * 节点数组约定：前 4 个为正确节点（顺序 === chars 顺序），其后为干扰项。
 */
import { Level } from '../typings/types';
import { generateRing, generateScattered, shuffledPreferCross } from '../utils/layout';

interface LevelSpec {
  id: number;
  idiom: string;
  explanation: string;
  /** 与 idiom 四字一一对应的视觉节点 */
  correct: [string, string, string, string];
  /** 干扰项 Emoji */
  distractors: string[];
}

const SPECS: LevelSpec[] = [
  // ========== L1：建立规则（4 节点，无干扰） ==========
  {
    id: 1,
    idiom: '鹤立鸡群',
    explanation: '像鹤站在鸡群中一样，比喻一个人的仪表或才能在周围一群人里显得很突出。',
    correct: ['🦩', '🧍', '🐔', '🐔🐔🐔'],
    distractors: []
  },
  {
    id: 2,
    idiom: '亡羊补牢',
    explanation: '羊丢了再去修补羊圈，比喻出了问题以后及时补救，还不算太晚。',
    // 亡=羊没了（🚫🐑 禁止/消失）/ 羊 / 补=敲打修补 / 牢=围栏
    correct: ['🚫🐑', '🐑', '🔨', '🚧'],
    distractors: []
  },
  {
    id: 3,
    idiom: '画蛇添足',
    explanation: '画蛇时给蛇添上脚，比喻做多余的事，反而坏了事。',
    correct: ['✏️', '🐍', '➕', '🦶'],
    distractors: []
  },
  {
    id: 4,
    idiom: '对牛弹琴',
    explanation: '对着牛弹奏琴曲，比喻对不懂道理的人讲道理，白费口舌。',
    // 对=面对 / 牛 / 弹=弹奏出声 / 琴=琴键乐器
    correct: ['👤', '🐮', '🎵', '🎹'],
    distractors: []
  },
  {
    id: 5,
    idiom: '狐假虎威',
    explanation: '狐狸借着老虎的威风吓唬百兽，比喻依仗别人的势力欺压人。',
    correct: ['🦊', '🎭', '🐯', '😱'],
    distractors: []
  },
  {
    id: 6,
    idiom: '盲人摸象',
    explanation: '盲人只摸到象的一部分就以为知道全貌，比喻对事物只凭片面了解就妄下结论。',
    // 盲=蒙眼 / 人=站立的人 / 摸=伸手触摸 / 象
    correct: ['🙈', '🧍', '🖐️', '🐘'],
    distractors: []
  },
  {
    id: 7,
    idiom: '拔苗助长',
    explanation: '把禾苗拔高想帮它快长，比喻违反事物规律急于求成，反而坏事。',
    correct: ['👐', '🌱', '🤝', '📈'],
    distractors: []
  },
  {
    id: 8,
    idiom: '刻舟求剑',
    explanation: '剑掉进水里在船舷刻记号再找，比喻拘泥固执，不知道情况已经变化。',
    // 刻=拿刀刻记号 / 舟=船 / 求=寻找 / 剑
    correct: ['🔪', '⛵', '🔍', '⚔️'],
    distractors: []
  },
  {
    id: 9,
    idiom: '闻鸡起舞',
    explanation: '听到鸡叫就起来舞剑，比喻有志之士抓紧时间勤奋努力。',
    // 闻=听 / 鸡 / 起=起身（拂晓）/ 舞
    correct: ['👂', '🐔', '🌄', '💃'],
    distractors: []
  },
  {
    id: 10,
    idiom: '守株待兔',
    explanation: '守着树桩等兔子再撞上来，比喻不主动努力，心存侥幸想不劳而获。',
    correct: ['🧍', '🪵', '⏳', '🐰'],
    distractors: []
  },

  // ========== L2：加入辨认（5 节点，1 个干扰项） ==========
  {
    id: 11,
    idiom: '鸡飞蛋打',
    explanation: '鸡飞走了，蛋也打破了，比喻两头落空，一无所得。',
    correct: ['🐔', '💨', '🥚', '💥'],
    distractors: ['🦆']
  },
  {
    id: 12,
    idiom: '狗急跳墙',
    explanation: '狗急了也会跳墙，比喻坏人在走投无路时不择手段地蛮干。',
    correct: ['🐕', '😡', '🦘', '🧱'],
    distractors: ['🐈']
  },
  {
    id: 13,
    idiom: '龙飞凤舞',
    explanation: '像龙在飞、凤在舞，形容书法笔势活泼有力，也形容场面热闹。',
    correct: ['🐉', '💨', '🦚', '💃'],
    distractors: ['🦅']
  },
  {
    id: 14,
    idiom: '狼吞虎咽',
    explanation: '像虎狼吞咽一样，形容吃东西又急又猛的样子。',
    // 狼吞=狼大快朵颐 / 虎咽=虎对着食物下咽
    correct: ['🐺', '😋', '🐯', '🍔'],
    distractors: ['🐶']
  },
  {
    id: 15,
    idiom: '羊入虎口',
    explanation: '羊落进了老虎的嘴里，比喻弱者陷入险境，有去无回。',
    correct: ['🐑', '➡️', '🐯', '👄'],
    distractors: ['🐐']
  },
  {
    id: 16,
    idiom: '龟兔赛跑',
    explanation: '乌龟和兔子赛跑，兔子因骄傲睡觉输了，比喻稳扎稳打者胜。',
    // 龟 / 兔 / 赛=竞赛终点 / 跑=奔跑
    correct: ['🐢', '🐰', '🏁', '🏃'],
    distractors: ['🐌']
  },
  {
    id: 17,
    idiom: '鼠目寸光',
    explanation: '老鼠的眼睛只能看到一寸远，比喻目光短浅，没有远见。',
    correct: ['🐭', '👀', '📏', '💡'],
    distractors: ['🐹']
  },
  {
    id: 18,
    idiom: '马到成功',
    explanation: '战马一到就取得胜利，形容事情顺利，一开始就取得成功。',
    correct: ['🐴', '➡️', '🏆', '✅'],
    distractors: ['🐎']
  },
  {
    id: 19,
    idiom: '猴子捞月',
    explanation: '猴子们倒挂着从水中捞月亮，比喻去做根本做不到的事，白费力气。',
    // 猴 / 子=小猴 / 捞=拿盆捞 / 月
    correct: ['🐒', '🐵', '🥣', '🌕'],
    distractors: ['🍌']
  },
  {
    id: 20,
    idiom: '叶公好龙',
    explanation: '叶公表面喜欢龙，真龙来了却吓得逃跑，比喻口头上爱好，实际上并不真喜欢。',
    correct: ['🍃', '🧍', '❤️', '🐉'],
    distractors: ['🌿']
  },

  // ========== L3：加入干扰（6 节点，2 个干扰项） ==========
  {
    id: 21,
    idiom: '杯弓蛇影',
    explanation: '把映在酒杯里的弓影当成蛇，比喻因疑神疑鬼而引起恐惧。',
    correct: ['🍷', '🏹', '🐍', '👤'],
    distractors: ['🥂', '🦎']
  },
  {
    id: 22,
    idiom: '画饼充饥',
    explanation: '画个饼来解饿，比喻用空想来安慰自己，无济于事。',
    correct: ['✏️', '🥞', '🔋', '🥺'],
    distractors: ['🍕', '🎂']
  },
  {
    id: 23,
    idiom: '破釜沉舟',
    explanation: '砸破饭锅、凿沉渡船，比喻下定决心，不留退路地干到底。',
    correct: ['🔨', '🍲', '🌊', '⛵'],
    distractors: ['🥘', '🚤']
  },
  {
    id: 24,
    idiom: '悬梁刺股',
    explanation: '头发系梁防瞌睡、锥刺大腿保持清醒，形容刻苦学习的精神。',
    correct: ['🪢', '🪵', '📌', '🦵'],
    distractors: ['🧷', '🦶']
  },
  {
    id: 25,
    idiom: '囊萤映雪',
    explanation: '夏夜囊萤照书、冬夜借雪反光读书，形容家境贫寒仍勤学苦读。',
    correct: ['🎒', '✨', '🪞', '❄️'],
    distractors: ['💼', '⭐']
  },
  {
    id: 26,
    idiom: '程门立雪',
    explanation: '站在程颐门前雪中等待求学，比喻尊敬师长、诚心求教。',
    correct: ['🍊', '🚪', '🧍', '❄️'],
    distractors: ['🍋', '🚶']
  },
  {
    id: 27,
    idiom: '凿壁偷光',
    explanation: '凿穿墙壁借邻家的烛光读书，形容刻苦好学的精神。',
    correct: ['⛏️', '🧱', '🥷', '💡'],
    distractors: ['🔦', '🧍']
  },
  {
    id: 28,
    idiom: '韦编三绝',
    explanation: '编联竹简的皮绳磨断了多次，形容读书勤奋刻苦。',
    correct: ['📚', '🔗', '3️⃣', '💔'],
    distractors: ['📖', '✂️']
  },
  {
    id: 29,
    idiom: '入木三分',
    explanation: '笔力深入木板三分，形容书法刚劲有力，也比喻见解深刻。',
    correct: ['✍️', '🪵', '3️⃣', '📏'],
    distractors: ['🖊️', '🌲']
  },
  {
    id: 30,
    idiom: '鱼目混珠',
    explanation: '拿鱼眼睛冒充珍珠，比喻用假的冒充真的、以次充好。',
    correct: ['🐟', '👁️', '🌪️', '📿'],
    distractors: ['🐠', '💎']
  }
];

/**
 * L1 环形位置的交叉分配模式：4 个环位按成语顺序取这些下标，
 * 保证连线至少交叉一次（任意非环序排列在圆上必有交叉）。
 * 逐关轮换，布局仍可复现。
 */
const CROSS_PATTERNS: [number, number, number, number][] = [
  [0, 2, 1, 3],
  [0, 2, 3, 1],
  [2, 0, 1, 3],
  [2, 0, 3, 1]
];

/** 估算 Emoji 字符串占几个字形：剔除 VS16/键帽组合符后按码点 + ZWJ 分段统计 */
function glyphCount(s: string): number {
  const cleaned = s.replace(/[️⃣]/g, '');
  let n = 0;
  for (const part of cleaned.split('‍')) {
    for (const _ of part) n++;
  }
  return n;
}

function buildLevel(spec: LevelSpec): Level {
  const chars = spec.idiom.split('') as Level['chars'];
  const count = 4 + spec.distractors.length;
  const stage = spec.id <= 10 ? 1 : spec.id <= 20 ? 2 : 3;
  const rawPositions =
    stage === 1
      ? generateRing(4, spec.id)
      : // 节点放大后直径约占游戏区 20%，最小间距相应放大避免视觉重叠
        generateScattered(count, spec.id * 97 + 13, 24, 12);
  // 位置与节点配对：L1 用交叉模式（连线必然交叉，不再顺/逆时针绕环）；
  // L2/L3 确定性洗牌并优先取连线交叉的布局
  const positions =
    stage === 1
      ? CROSS_PATTERNS[(spec.id - 1) % CROSS_PATTERNS.length].map((i) => rawPositions[i])
      : shuffledPreferCross(rawPositions, spec.id * 31 + 7);

  const nodes: Level['nodes'] = spec.correct.map((emoji, i) => ({
    id: `n${i + 1}`,
    emoji,
    glyphs: glyphCount(emoji),
    char: chars[i],
    isCorrect: true,
    x: positions[i].x,
    y: positions[i].y
  }));

  spec.distractors.forEach((emoji, i) => {
    const p = positions[4 + i];
    nodes.push({
      id: `n${5 + i}`,
      emoji,
      glyphs: glyphCount(emoji),
      char: '',
      isCorrect: false,
      x: p.x,
      y: p.y
    });
  });

  return {
    id: spec.id,
    idiom: spec.idiom,
    chars,
    explanation: spec.explanation,
    nodes
  };
}

const levels: Level[] = SPECS.map(buildLevel);

export const TOTAL_LEVELS = levels.length;

export function getLevel(id: number): Level | undefined {
  return levels.find((l) => l.id === id);
}

export default levels;
