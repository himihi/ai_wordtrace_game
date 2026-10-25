/** 共享类型定义 */

/** 游戏区中的一个视觉节点（只显示 Emoji，不显示汉字） */
export interface LevelNode {
  id: string;
  /** 视觉资源。MVP 用 Emoji，后续可替换为图标字体/图片路径 */
  emoji: string;
  /** Emoji 占几个字形的数量（1=标准字号，2=较小，≥3=最小），由 glyphCount 统计 */
  glyphs: number;
  /** 对应汉字，仅用于判定与填格，不渲染在节点上 */
  char: string;
  /** 是否属于目标成语 */
  isCorrect: boolean;
  /** 百分比坐标 0–100，相对游戏区容器 */
  x: number;
  y: number;
}

export interface Level {
  id: number;
  idiom: string;
  chars: [string, string, string, string];
  explanation: string;
  /** 前 4 个为正确节点（顺序与 chars 一致），其后为干扰项 */
  nodes: LevelNode[];
}

/** 连线渲染数据（像素值） */
export interface Line {
  left: number;
  top: number;
  length: number;
  angle: number;
}

/** 本地进度 */
export interface Progress {
  /** 已解锁到的最大关卡号 */
  maxLevel: number;
  /** 已通关关卡 id 列表 */
  passed: number[];
}

/** 关卡内未完成的对局存档（用于「继续游戏」） */
export interface LevelState {
  levelId: number;
  /** 当前应选第几个字（1–3 才有恢复意义） */
  step: number;
  /** 四格已填内容 */
  slots: string[];
  /** 已选节点 id 序列（顺序即连线顺序） */
  selectedNodes: string[];
  /** 保存时间戳，用于取最近一次 */
  savedAt: number;
}

/** 全局提示池：整个游戏共享 3 次提示，用完后锁定冷却 10 秒自动恢复 */
export interface HintPool {
  /** 剩余提示次数（0–3） */
  left: number;
  /** 锁定截止时间戳（ms）；<= now 表示未锁定 */
  lockedUntil: number;
}
