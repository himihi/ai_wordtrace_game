# 逐字追踪 · 技术设计方案（V1.1）

> 本文档基于 V1.0 设计原稿修订，记录当前实际落地的方案。
> 相对 V1.0 的主要增量：**背景音乐与音效、对局自动存档/继续游戏、
> 节点图形放大、Emoji 双字形适配**。文末附原稿修正记录。

## 1. 目标与范围

### 1.1 目标

在 2 周内交付一款可上线的微信小程序益智游戏，验证「字级视觉线索 + 顺序路径」的核心玩法闭环。要求：

- 冷启动到可玩 < 2 秒
- 30 个手工配置关卡
- 单关平均耗时 20–60 秒
- 全本地运行，无后端依赖

### 1.2 范围外

拖拽连线、路径几何约束、排行榜、AI 实时生成、UGC、多端适配。

---

## 2. 技术选型

| 层 | 方案 | 理由 |
|---|---|---|
| 前端框架 | 微信小程序原生（WXML/WXSS） | 节点绝对定位、动画、本地存储实现简单，无跨端需求 |
| 语言 | TypeScript（`project.config.json` 开启 `useCompilerPlugins: ["typescript"]`，开发者工具原生编译） | 30 关数据有接口约束，字段错误编译期暴露；无需额外构建链 |
| 关卡数据 | 本地 `data/levels.ts` 打包 | 30 关数据量小，免后端，最快上线 |
| 状态管理 | 页面 data + `utils/storage.ts` | 单页游戏无需引入状态库 |
| 进度存储 | `wx.setStorageSync` | 记录通关、提示剩余、音乐开关、对局存档 |
| 连线绘制 | 绝对定位 `view` + `transform: rotate` + 虚线渐变 | 每关最多 3 条线，避免 canvas 层级与性能问题 |
| 音频 | `wx.createInnerAudioContext`（BGM 循环 + 短音效） | 无需用户授权；音频资源由脚本离线合成为 WAV |
| 校验 | `scripts/validate-levels.ts` + `tsc --noEmit` | 数据结构/顺序/间距/边界的 CI 式校验 |
| AI | 运行时不使用 | 仅在生产环节辅助生成 Emoji 候选与释义文案，人工筛选后入库 |

---

## 3. 架构设计

### 3.1 分层

```
┌─────────────────────────────────────┐
│ View 层（WXML/WXSS）                 │
│ 首页 / 关卡选择 / 游戏页 / 结算弹层   │
├─────────────────────────────────────┤
│ Logic 层（Page TS）                  │
│ 点击判定 / 步骤推进 / 提示 / 结算 /   │
│ 对局存档恢复 / 音乐开关              │
├─────────────────────────────────────┤
│ Utils 层                             │
│ storage.ts（进度/设置/存档）          │
│ audio.ts（BGM 与音效）               │
│ geometry.ts（连线） layout.ts（布局）│
├─────────────────────────────────────┤
│ Data 层                              │
│ levels.ts（30 关配置，buildLevel +   │
│ 布局生成器产出，含 wide 字形标记）    │
├─────────────────────────────────────┤
│ Typings                              │
│ types.ts（Level / LevelNode / Line / │
│ Progress / LevelState）              │
└─────────────────────────────────────┘
```

### 3.2 页面关系

```
index（首页）
├── level-select（关卡选择）
│   └── game（游戏页）
└── game（开始游戏 → 最大解锁关；继续游戏 → 未完成对局 + resume=1）
```

结算以弹层形式出现在 `game` 页内，不单独建页；「下一关」通过
`resetLevel(id)` 复用当前页面，不新建页面。

---

## 4. 数据结构

### 4.1 关卡配置 `data/levels.ts`

配置层为 `LevelSpec` 数组（人维护），经 `buildLevel()` 展开为运行时 `Level`：

```ts
interface LevelSpec {
  id: number;
  idiom: string;
  explanation: string;
  /** 与 idiom 四字一一对应的视觉节点（Emoji，可多字形如 '🚫🐑'） */
  correct: [string, string, string, string];
  /** 干扰项 Emoji */
  distractors: string[];
}

interface Level {
  id: number;
  idiom: string;
  chars: [string, string, string, string];
  explanation: string;
  nodes: LevelNode[];   // 前 4 个为正确节点（顺序 === chars），其后为干扰项
  // 提示为全局共享池（wt_hint_pool），Level 不再携带每关提示数
}

interface LevelNode {
  id: string;
  emoji: string;
  glyphs: number;       // Emoji 占几个字形的数量（1=标准字号，2=较小，≥3=最小），由 glyphCount 统计
  char: string;         // 用于判定与填格，不渲染在节点上
  isCorrect: boolean;
  x: number;            // 百分比坐标 0–100，相对游戏区容器
  y: number;
}
```

`x / y` 由 `utils/layout.ts` 按关卡 id 派生种子生成（L1 环形均匀分布，
L2/L3 拒绝采样分散分布，最小间距 24%、边距 12%，适配放大后的节点），
坐标不手写，布局可复现，采样失败抛错尽早暴露。

**位置与节点随机配对，连线刻意可交叉**（不再按字序绕环）：

- L1：`CROSS_PATTERNS` 四种交叉模式逐关轮换（如 `[0,2,1,3]`），
  四字连线保证至少交叉一次；
- L2/L3：`shuffledPreferCross()` 确定性洗牌，多试几个种子并优先取
  「正确四节点按顺序连线交叉」的布局（找不到则退回首次结果）。

### 4.2 本地存储

| Key | 类型 | 说明 |
|---|---|---|
| `wt_progress` | `{ maxLevel: number, passed: number[] }` | 已通关关卡与最大解锁关 |
| `wt_hint_pool` | `{ left: number, lockedUntil: number }` | **全局**提示池：剩余次数与锁定截止戳（ms） |
| `wt_settings` | `{ music: boolean }` | 音乐开关（缺省视为开） |
| `wt_state` | `{ [levelId]: LevelState }` | 每关未完成的对局存档 |

```ts
interface HintPool {
  left: number;         // 剩余提示次数（0–3），整个游戏共享，不区分关卡
  lockedUntil: number;  // 锁定截止时间戳（ms）；<= now 表示未锁定
}

interface LevelState {
  levelId: number;
  step: number;              // 当前应选第几个字（1–3 才有恢复意义）
  slots: string[];           // 四格已填内容
  selectedNodes: string[];   // 已选节点 id 序列（顺序即连线顺序）
  savedAt: number;           // 保存时间戳，首页取最近一次
}
```

结构示例：

```json
{
  "wt_progress": { "maxLevel": 12, "passed": [1, 2, "...", 11] },
  "wt_hint_pool": { "left": 0, "lockedUntil": 1697777777777 },
  "wt_settings": { "music": true },
  "wt_state": { "12": { "levelId": 12, "step": 2, "slots": ["狼", "吞", "", ""],
                        "selectedNodes": ["n2", "n4"], "savedAt": 1697777777777 } }
}
```

---

## 5. 游戏页模块设计

### 5.1 页面 data

```ts
data: {
  level: null as Level | null,
  levelId: 1,
  step: 0,                       // 当前应选第几个字（0–4）
  slots: ['', '', '', ''],       // 四格已填内容
  selectedNodes: [] as string[], // 已选节点 id 序列
  selectedMap: {},               // 已选节点快速查找表（WXML 不支持 indexOf 调用）
  lines: [] as Line[],           // 连线渲染数据（像素值）
  hintLeft: 3,                   // 全局提示池剩余次数（0–3）
  hintLocked: false,             // 提示池是否处于锁定冷却中
  hintLockSec: 0,                // 锁定剩余秒数（倒计时展示）
  hintTargetId: '',              // 高亮提示节点
  showResult: false,
  shakeNodeId: '',               // 当前错误抖动的节点
  isLastLevel: false,
  musicOn: true
}
```

自定义字段（不进 data）：`areaW / areaH`（游戏区像素尺寸，SelectorQuery 测量）、
`shakeTimer`、`hintTimer`（提示锁定倒计时 interval）、`resumeRequested`
（本次进入是否消费一次对局恢复）。

### 5.2 核心流程

```
onLoad(id, resume) → resetLevel(id)
  ├── 基础 setData（关卡、空进度、剩余提示）
  ├── 存在未完成存档 → 二选一：
  │     ├── resume=1（首页「继续游戏」进入）→ restoreState 静默恢复
  │     │     （回填进度/填格；提示池为全局状态不在对局存档内，
  │     │       80ms 后测量游戏区并 rebuildLines 重建连线）
  │     └── 其他入口 → wx.showModal 让用户选择
  │           ├── 继续游戏 → restoreState
  │           └── 重新开始 → clearLevelState，从空进度开始
  └── 无存档 → clearLevelState（保证脏数据不残留）

onNodeTap(node)
  ├── 结算中 / 已选过 → 忽略
  ├── node.char === level.chars[step]
  │     ├── slots[step] = node.char；selectedNodes.push；追加连线
  │     ├── vibrateShort(light) + playSfx('correct')
  │     ├── step++ → saveState()（step 1–3 写入对局存档）
  │     └── step === 4 → onPass()
  └── 否则 vibrateShort(medium) + playSfx('wrong')，抖动 400ms，状态不变

onHint()：全局提示池 left > 0 → 高亮下一正确节点 1.5s；
  用掉最后一次（left 归 0）→ 锁定 10s（HINT_LOCK_MS），按钮显示 🔒 倒计时，
  到期自动恢复 3 次；锁定中点击提示「休息中 X 秒后恢复」

onPass()
  ├── markPassed + clearLevelState（过关即清对局存档）
  ├── vibrateShort(heavy) + playSfx('win')
  └── 450ms 后 showResult（撒花 + 成语释义弹层）

nextLevel()：resetLevel(id + 1) 复用页面；最后一关改为返回选关
```

### 5.3 判定逻辑（伪代码）

```ts
onNodeTap(e) {
  if (this.data.showResult) return;
  const nodeId = e.currentTarget.dataset.id;
  const node = level.nodes.find(n => n.id === nodeId);
  const { step, selectedNodes } = this.data;

  if (!node || selectedNodes.includes(nodeId)) return;

  if (node.char === level.chars[step]) {
    const slots = [...this.data.slots];
    slots[step] = node.char;
    const newSelected = [...selectedNodes, nodeId];
    const lines = [...this.data.lines, buildLineFrom(prevSelected, node)];

    playSfx('correct');
    this.setData({ slots, selectedNodes: newSelected, lines, step: step + 1 },
      () => {
        this.saveState();                     // 对局自动存档
        if (step + 1 === 4) this.onPass();
      });
  } else {
    playSfx('wrong');
    this.setData({ shakeNodeId: nodeId });
    setTimeout(() => this.setData({ shakeNodeId: '' }), 400);
  }
}
```

---

## 6. 关键实现细节

### 6.1 节点布局

节点使用绝对定位，`left / top` 取自关卡百分比：

```xml
<view
  wx:for="{{level.nodes}}"
  wx:key="id"
  class="node"
  style="left: {{item.x}}%; top: {{item.y}}%;"
  data-id="{{item.id}}"
  bindtap="onNodeTap"
>
  <view class="node-float" style="animation-delay: {{index * 0.35}}s;">
    <view class="node-core ...">
      <text class="node-emoji {{item.glyphs > 2 ? 'node-emoji-xwide' : item.glyphs > 1 ? 'node-emoji-wide' : ''}}">{{item.emoji}}</text>
    </view>
  </view>
</view>
```

适配注意：`x/y` 是相对游戏区的百分比，游戏区容器固定 1:1 宽高比
（基础库 2.20.0 不使用 `aspect-ratio`，用 `padding-top: 100%` 占位）：

```css
.game-area { position: relative; width: 100%; padding-top: 100%; }
.node { position: absolute; transform: translate(-50%, -50%); }
.node-core {
  width: 144rpx; height: 144rpx; border-radius: 50%; background: #fff;
  /* 白色圆底 + 阴影，提升辨识度与触控面积 */
}
.node-emoji { font-size: 88rpx; line-height: 1; }
.node-emoji-wide { font-size: 58rpx; letter-spacing: -4rpx; }  /* 双字形 Emoji 防溢出 */
.node-emoji-xwide { font-size: 44rpx; letter-spacing: -4rpx; } /* 三字形及以上（🐔🐔🐔） */
```

三层结构（定位层 / 漂浮层 / 样式层）避免 `transform` 冲突；
节点尺寸由 V1.0 的 56rpx 放大至 144rpx，因此 L2/L3 分散布局的
最小间距参数由 16% 提高到 24%、边距 11% → 12%。

### 6.2 连线计算

每次选中新节点后，用上一个节点与新节点坐标生成一条线段。线段两端按
**节点圆半径（inset）缩进**，接到圆的边缘而非圆心；节点半径随游戏区
实测宽度换算（144rpx 直径 → `72 * areaW / 686` px）：

```ts
// utils/geometry.ts
export function calcLine(from, to, areaWidth, areaHeight, inset = 0): Line {
  const cx1 = (from.x / 100) * areaWidth;
  const cy1 = (from.y / 100) * areaHeight;
  const cx2 = (to.x / 100) * areaWidth;
  const cy2 = (to.y / 100) * areaHeight;
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const dist = Math.hypot(dx, dy);
  if (dist <= inset * 2) return { left: cx1, top: cy1, length: 0, angle: 0 };
  const ux = dx / dist, uy = dy / dist;
  const x1 = cx1 + ux * inset, y1 = cy1 + uy * inset;
  const x2 = cx2 - ux * inset, y2 = cy2 - uy * inset;
  return {
    left: x1,
    top: y1,
    length: Math.hypot(x2 - x1, y2 - y1),
    angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  };
}
```

另外，**已选中的节点停止漂浮动画**（`animation-play-state: paused`），
保证已连线路的端点固定不漂移；未选中的节点保留漂浮动效。

渲染：

```xml
<view
  wx:for="{{lines}}"
  wx:key="index"
  class="line"
  style="left: {{item.left}}px; top: {{item.top}}px;
         width: {{item.length}}px;
         transform: rotate({{item.angle}}deg);"
/>
```

```css
.line {
  position: absolute;
  height: 8rpx;
  background: repeating-linear-gradient(90deg,
    var(--brand) 0, var(--brand) 16rpx, transparent 16rpx, transparent 28rpx);
  transform-origin: 0 50%;
  pointer-events: none;
}
```

注意：`areaWidth / areaHeight` 在 `onReady` 及每次 `resetLevel` /
`restoreState` 后延迟 80ms 通过 `wx.createSelectorQuery().boundingClientRect`
获取实际像素尺寸；恢复对局时按 `selectedNodes` 顺序逐对重算全部连线
（`rebuildLines`），保证换屏/杀进程后线段位置正确。

### 6.3 动画实现

| 场景 | 实现 |
|---|---|
| 节点默认浮动 | `@keyframes float-y`，`translateY` 上下 14rpx，错峰 animation-delay |
| 正确点击 | `@keyframes node-pop`，scale 弹跳 + 青绿边框 |
| 错误点击 | `@keyframes node-shake`，`translateX` 左右抖动 + 红框 |
| 提示高亮 | `@keyframes node-glow`，`box-shadow` 呼吸光圈 1.5s |
| 填格 | `@keyframes slot-flip`，翻转弹入 |
| 过关撒花 | 12 个 view 粒子从中心向外扩散淡出（confetti-fly） |
| 页面淡入 | `@keyframes page-fade` |

动画全部用 WXSS `@keyframes` 实现，只用 `transform / opacity`，
避免引入动画库，控制包体与性能。

### 6.4 提示（全局共享池 + 10 秒锁定冷却）

提示不再按关卡各给 3 次，而是**整个游戏共享一个 3 次池**（`wt_hint_pool`）：
3 次用完后按钮锁定进入 10 秒休息倒计时，到点自动恢复 3 次继续游戏。

```ts
const HINT_LOCK_MS = 10000;

onHint() {
  const { hintLocked, hintLeft, step, level } = this.data;
  if (this.data.showResult) return;
  if (hintLocked) {
    wx.showToast({ title: `提示休息中，${this.data.hintLockSec} 秒后恢复`, icon: 'none' });
    return;
  }
  if (hintLeft <= 0) return;
  const target = level.nodes.find(
    n => n.isCorrect && n.char === level.chars[step]
  );
  if (!target) return;
  const left = hintLeft - 1;
  // 最后一次提示用完后锁定冷却，到点自动恢复 3 次
  const pool = left <= 0
    ? { left: 0, lockedUntil: Date.now() + HINT_LOCK_MS }
    : { left, lockedUntil: 0 };
  storage.setHintPool(pool);
  this.setData({ hintLeft: left, hintTargetId: target.id });
  if (pool.lockedUntil > 0) {
    this.setData({ hintLocked: true, hintLockSec: Math.ceil(HINT_LOCK_MS / 1000) });
    this.ensureHintTimer();
  }
  this.saveState();                        // 对局进度存档
  setTimeout(() => this.setData({ hintTargetId: '' }), 1500);
}
```

`refreshHint()`（每次 `resetLevel` 调用）读取 `wt_hint_pool`：锁定时同步
`hintLocked / hintLockSec` 并启动 `ensureHintTimer()`（250ms interval，
到期写回 `{ left: 3, lockedUntil: 0 }` 并解锁）；未锁定则归位 3 次并清定时器。
`onUnload` 中统一清理 `hintTimer / shakeTimer`。

WXML 按钮双态：

```xml
<view class="hint-btn {{hintLocked || hintLeft <= 0 ? 'hint-btn-disabled' : ''}}" bindtap="onHint">
  <text wx:if="{{hintLocked}}">🔒 休息中</text>
  <text wx:else>💡 提示</text>
  <text class="hint-count">{{hintLocked ? hintLockSec : hintLeft}}</text>
</view>
```

### 6.5 进度与存档存储

```ts
// utils/storage.ts
const KEY_PROGRESS   = 'wt_progress';
const KEY_HINT_POOL  = 'wt_hint_pool';   // 全局提示池（整个游戏共享）
const KEY_SETTINGS   = 'wt_settings';
const KEY_STATE      = 'wt_state';

export function getProgress(): Progress { /* 兼容缺省 { maxLevel: 1, passed: [] } */ }

export function markPassed(levelId, totalLevels): Progress {
  const p = getProgress();
  if (!p.passed.includes(levelId)) p.passed.push(levelId);
  // 全部通关后 maxLevel 封顶在最后一关
  p.maxLevel = Math.max(p.maxLevel, Math.min(levelId + 1, totalLevels));
  wx.setStorageSync(KEY_PROGRESS, p);
  return p;
}

export function getHintPool(): HintPool { /* 缺省 { left: 3, lockedUntil: 0 } */ }
export function setHintPool(pool: HintPool): void {}

export function getMusicOn(): boolean    { /* 缺省 true */ }
export function setMusicOn(on: boolean) {}

export function getLevelState(levelId): LevelState | null {}
export function getLatestState(): LevelState | null {
  /* 全部存档中取 step ∈ 1..3 且 savedAt 最新的一条，供首页「继续游戏」 */
}
export function saveLevelState(state: LevelState) {}
export function clearLevelState(levelId: number) {}
```

存档生命周期：**点对 / 用提示 → saveState（默认实时自动存档）；
游戏页 💾 按钮 → onSave 手动显式存档（Toast 确认）；过关 → clearLevelState；
重开按钮 → clearLevelState 后重置；进入有存档的关卡（不带 `resume=1`）
→ 弹窗由用户选择继续或重新开始。** 首页主按钮依据 `getLatestState()`
在「继续游戏 / 开始游戏」间切换，并显示「第 X 关进行中 · 已选 Y/4」。

### 6.6 音频

- 资源：`assets/audio/` 下 bgm.mp3（44.1kHz / 96kbps，约 171KB）+ 3 个
  16-bit PCM WAV 音效（win 73KB / correct 13KB / wrong 14KB），由
  `scripts/generate-audio.ts` 离线合成（五声音阶旋律 + 低音 + 节拍点缀，
  8 小节无缝循环；BGM 经 lamejs 编码 MP3，体积约为 WAV 的 1/4），
  运行 `npx tsx scripts/generate-audio.ts` 可重新生成。
- 播放：`utils/audio.ts` 基于 `wx.createInnerAudioContext`。
  BGM 单例 `loop = true`、`volume = 0.45`；音效各自独立实例，
  `stop()` 后 `play()` 实现重触发。
- 时机：`App.onShow` 与首页 / 选关 / 游戏页 `onShow` 调 `playBgm()`
  （已在播放时重复调用无副作用）；`App.onHide` 立即暂停 BGM；
  `wx.onAudioInterruptionBegin / End` 处理来电、闹钟等系统打断的
  暂停与恢复。点对 / 点错 / 过关分别触发 correct / wrong / win 音效。
- 兼容：`wx.setInnerAudioOption({ obeyMuteSwitch: false })` 使 iOS
  静音开关下游戏声音仍正常播放。
- 开关：`wt_settings.music`，`toggleMusic()` 同时控制 BGM 与音效静音；
  首页右上角、游戏页顶栏均有 🎵 / 🔇 按钮。

### 6.7 Emoji 双字形适配

个别字的视觉表达需要多个 Emoji 组合（如「亡」= 🚫🐑 羊没了/丢失、
「群」= 🐔🐔🐔 一群鸡，与单只 🐔 形成「鹤立鸡群」的画面反差；
节点按 `glyphs` 数量分三档字号防溢出）。
`buildLevel()` 用 `glyphCount()`（剔除 VS16 / 键帽组合符后按码点 +
ZWJ 分段统计）计算每个节点的字形数，`wide: true` 的节点在 WXML 中
套用 `node-emoji-wide` 缩小字号，避免溢出圆底。

---

## 7. 性能与兼容性

| 关注点 | 措施 |
|---|---|
| 首屏加载 | 关卡数据本地打包，无网络请求；首页只渲染按钮 |
| 包体 | 无框架依赖；音频共 ~270KB（BGM 为 MP3），远低于主包 2MB 限制 |
| 页面切换 | 游戏页复用，切换关卡时调用 `resetLevel(levelId)` 而非新建页面 |
| 动画性能 | 仅使用 transform / opacity 动画，避免触发布局重排 |
| 连线数量 | 单关最多 3 条线，纯 view 渲染无压力 |
| 屏幕适配 | 节点用百分比坐标 + 游戏区固定宽高比；文字用 rpx |
| 音频兼容 | InnerAudioContext 基础库 ≥ 1.6.0，远低于项目最低版本 |
| 基础库兼容 | 最低基础库 2.20.0；`aspect-ratio` 用 `padding-top` 百分比兜底 |

---

## 8. 验证

- `npm run check`：TypeScript 全量类型检查（含 scripts）。
- `npm run validate`：30 关数据校验（数量/顺序/间距 ≥14%/边界 8–92）。
- 微信开发者工具模拟器走查：首页 → 选关 → 游戏 → 结算 → 下一关。
- 真机（iOS + Android）：冷启动、Emoji 字形差异、振动反馈、进度持久化。
- 边界用例：连点已选节点、点错后继续、提示耗尽锁定 10s、通关后杀进程重进、
  全通关 maxLevel 封顶、**对局中杀进程后从首页继续游戏**、
  **进入有存档的关卡时弹窗选择继续/重新开始**、**💾 手动存档后杀进程恢复**、
  **音乐开关跨页面与跨启动保持**、双字形 Emoji 渲染不溢出。
- 数据复核：30 关逐字核对 Emoji ↔ 字义对应（重点排查相邻位置颠倒、
  整体错位两类问题），由 `npm run validate` 保证结构合法。

---

## 9. 原稿修正记录（V1.0 → V1.1）

| 原稿（V1.0） | 实施（V1.1） |
|---|---|
| `levels.js` + 手写坐标 | `data/levels.ts` + `utils/layout.ts` 种子生成坐标 + `validate-levels.ts` 校验 |
| L1 正确节点按字序绕环，连线恒顺/逆时针 | 位置与节点随机配对：L1 交叉模式轮换、L2/L3 洗牌偏好交叉，连线普遍交叉 |
| `.game-area { aspect-ratio: 1/1 }` | `padding-top: 100%` 占位，兼容基础库 2.20.0 全版本 |
| `wx.getSystemInfoSync()` 估算尺寸 | `wx.createSelectorQuery().boundingClientRect` 直接测量游戏区 |
| 节点 56rpx / Emoji 48rpx | 144rpx / 88rpx（双字形 58rpx），提升辨识度与触控面积；分散布局间距 16% → 24% |
| 错误仅 `color: red` | 抖动 + 红框 + 触感振动 + 低音音效四重反馈 |
| 结算后新建页面进下一关 | `resetLevel` 复用页面 |
| 仅进度与提示两个存储 Key | 增加 `wt_settings`（音乐开关）、`wt_state`（对局存档） |
| 「不接音频」 | BGM 循环 + 3 种音效，`generate-audio.ts` 离线合成 WAV，`audio.ts` 统一管理 |
| 首页单一「开始游戏」 | 有未完成对局时主按钮变为「继续游戏」并按 `resume=1` 恢复进度与连线 |
| 未规定存档恢复交互 | 自动存档 + 💾 手动存档按钮；进入有存档的关卡弹窗选择「继续游戏 / 重新开始」 |
| Emoji 映射无核对标准 | 以「字义直译」为唯一标准全量复核 30 关，修正 6 处相邻错位/整体错位（对牛弹琴、盲人摸象、闻鸡起舞、刻舟求剑、龟兔赛跑、猴子捞月） |
