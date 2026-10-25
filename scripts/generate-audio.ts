/**
 * 音频资源生成脚本（开发期，一次性运行）
 * 运行：npx tsx scripts/generate-audio.ts
 *
 * 用轻量合成器生成全部音频资源到 assets/audio/：
 *   bgm.mp3     背景音乐：C 大调五声音阶明快旋律 + 低音 + 节拍点缀，8 小节无缝循环
 *               （44.1kHz 渲染，lamejs 编码 96kbps MP3，体积约为 WAV 的 1/10）
 *   win.wav     过关号角：上行动机 + 终止和弦
 *   correct.wav 点对反馈：两音弹跳
 *   wrong.wav   点错反馈：低音下滑
 * （音效文件很小，保持 WAV 免转码）
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const SR = 22050;
/** BGM 用 44.1kHz 渲染（lamejs 仅支持 MPEG1 采样率），音效保持 22050Hz 足够 */
const SR_BGM = 44100;
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets', 'audio');

/** lamejs Mp3Encoder 的最小类型（npm 包无类型声明，按需手写） */
interface Mp3Encoder {
  encodeBuffer(buf: Int16Array): Int8Array;
  flush(): Int8Array;
}
interface LameJs {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => Mp3Encoder;
}

// lame.all.js 是浏览器拼接 bundle，不做 CommonJS 导出（且 src/js 入口在 Node 下
// 有全局变量加载顺序问题）。加载 bundle 源码并取出内部的 lamejs 工厂函数，
// 它在执行时已把 Mp3Encoder 挂到自身静态属性上。
const lamejs = new Function(
  `${readFileSync(join(ROOT, 'node_modules', 'lamejs', 'lame.all.js'), 'utf8')}\nreturn lamejs;`
)() as LameJs;

/* ========== 音符频率（C 大调） ========== */
const FREQ: Record<string, number> = {
  G3: 196.0, A3: 220.0, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
  A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, E6: 1318.51, G6: 1567.98
};

type Wave = 'sine' | 'tri' | 'square';

interface Note {
  name?: string;
  /** 起始时间（秒） */
  t: number;
  /** 时长（秒） */
  d: number;
  /** 音量 0–1 */
  v?: number;
  wave?: Wave;
  /** 泛音占比，让音色更明亮 */
  harm?: number;
}

/** 指数衰减 + 短 attack 的包络，听感轻快不刺耳 */
function envelope(t: number, dur: number): number {
  const attack = Math.min(0.012, dur * 0.15);
  const a = t < attack ? t / attack : 1;
  return a * Math.exp(-3.2 * (t / dur));
}

function sampleOf(wave: Wave, f: number, t: number, harm: number): number {
  const p = 2 * Math.PI * f * t;
  let s: number;
  if (wave === 'sine') s = Math.sin(p);
  else if (wave === 'tri') s = (2 / Math.PI) * Math.asin(Math.sin(p));
  else s = Math.sign(Math.sin(p)) * 0.7;
  if (harm > 0) s = s * (1 - harm) + Math.sin(2 * p) * harm;
  return s;
}

function synth(notes: Note[], totalSec: number, master = 0.9, sr = SR): Float32Array {
  const n = Math.floor(sr * totalSec);
  const out = new Float32Array(n);
  for (const note of notes) {
    const start = Math.round(note.t * sr);
    const len = Math.round(note.d * sr);
    const v = note.v ?? 0.3;
    const harm = note.harm ?? 0.15;
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx >= n) break;
      const t = i / sr;
      out[idx] += sampleOf(note.wave ?? 'tri', FREQ[note.name ?? 'C5'], t, harm) * envelope(t, note.d) * v;
    }
  }
  // 归一化 + 软限幅
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  const g = peak > 0 ? (master / peak) : 1;
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * g);
  return out;
}

function writeWav(name: string, data: Float32Array): void {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + data.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);      // PCM
  buf.writeUInt16LE(1, 22);      // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  }
  writeFileSync(join(OUT_DIR, name), buf);
  console.log(`  ✓ ${name}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

/** Float32 单声道 PCM → lamejs MP3 编码 */
function writeMp3(name: string, data: Float32Array, sr: number, kbps = 96): void {
  const pcm = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    pcm[i] = Math.round(Math.max(-1, Math.min(1, data[i])) * 32767);
  }
  const encoder = new lamejs.Mp3Encoder(1, sr, kbps);
  const chunks: Buffer[] = [];
  const blockSize = 1152; // MP3 帧长
  for (let i = 0; i < pcm.length; i += blockSize) {
    const buf = encoder.encodeBuffer(pcm.subarray(i, i + blockSize));
    if (buf.length > 0) chunks.push(Buffer.from(buf));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Buffer.from(tail));
  const out = Buffer.concat(chunks);
  writeFileSync(join(OUT_DIR, name), out);
  console.log(`  ✓ ${name}  (${(out.length / 1024).toFixed(0)} KB)`);
}

/* ========== BGM：132 BPM，8 小节（32 拍 ≈ 14.55s），末音落在 tonic 保证无缝循环 ========== */
const BEAT = 60 / 132;
function bt(bars: number, beats = 0): number {
  return (bars * 4 + beats) * BEAT;
}

function buildBgm(sr = SR): { data: Float32Array; total: number } {
  const total = bt(8); // 32 拍整
  const notes: Note[] = [];

  // 主旋律（五声音阶，每拍一音，偶发半拍活跃节奏）
  const melody: [number, number, string][] = [
    // [bar, beat, note] —— beat 用小数表示半拍偏移
    [0, 0, 'C5'], [0, 1, 'E5'], [0, 2, 'G5'], [0, 3, 'E5'],
    [1, 0, 'A5'], [1, 1, 'G5'], [1, 2, 'E5'], [1, 3, 'C5'],
    [2, 0, 'D5'], [2, 1, 'E5'], [2, 2, 'G5'], [2, 3, 'A5'],
    [3, 0, 'G5'], [3, 2, 'E5'],
    [4, 0, 'A5'], [4, 1, 'A5'], [4, 2, 'G5'], [4, 3, 'E5'],
    [5, 0, 'G5'], [5, 1, 'E5'], [5, 2, 'D5'], [5, 3, 'C5'],
    [6, 0, 'D5'], [6, 1, 'E5'], [6, 2, 'D5'], [6, 3, 'G5'],
    [7, 0, 'C5']
  ];
  for (const [bar, beat, name] of melody) {
    const isLong = bar === 7;
    const t = bt(bar, beat);
    const d = isLong ? total - t : BEAT * (beat % 1 === 0 && bar === 3 && beat === 0 ? 2 : 0.92);
    notes.push({ name, t, d: isLong ? d : d, v: 0.32, wave: 'tri', harm: 0.22 });
  }

  // 低音：每小节根音，落在第 1、3 拍
  const bassRoots = ['C4', 'C4', 'F4', 'G4', 'C4', 'C4', 'G4', 'C4'];
  bassRoots.forEach((name, bar) => {
    notes.push({ name, t: bt(bar, 0), d: BEAT * 1.4, v: 0.22, wave: 'sine', harm: 0 });
    notes.push({ name, t: bt(bar, 2), d: BEAT * 1.4, v: 0.18, wave: 'sine', harm: 0 });
  });

  // 节拍点缀：每拍一下高频「木鱼」式短音
  for (let b = 0; b < 32; b++) {
    notes.push({ name: 'C6', t: b * BEAT, d: 0.045, v: b % 4 === 0 ? 0.05 : 0.03, wave: 'square', harm: 0 });
  }

  return { data: synth(notes, total, 0.9, sr), total };
}

/* ========== 音效 ========== */
function buildWin(): { data: Float32Array; total: number } {
  const total = 1.7;
  const seq: [string, number][] = [['C5', 0], ['E5', 0.13], ['G5', 0.26], ['C6', 0.39]];
  const notes: Note[] = seq.map(([name, t]) => ({
    name, t, d: 0.16, v: 0.35, wave: 'tri', harm: 0.25
  }));
  // 终止和弦
  for (const name of ['C6', 'E6', 'G6']) {
    notes.push({ name, t: 0.52, d: 1.05, v: 0.26, wave: 'tri', harm: 0.2 });
  }
  return { data: synth(notes, total), total };
}

function buildCorrect(): { data: Float32Array; total: number } {
  const notes: Note[] = [
    { name: 'G5', t: 0, d: 0.1, v: 0.4, wave: 'sine', harm: 0.3 },
    { name: 'C6', t: 0.08, d: 0.18, v: 0.4, wave: 'sine', harm: 0.3 }
  ];
  return { data: synth(notes, 0.3), total: 0.3 };
}

function buildWrong(): { data: Float32Array; total: number } {
  const n = Math.floor(SR * 0.32);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 170 - 70 * (t / 0.32); // 下滑
    out[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-8 * t) * 0.4;
  }
  return { data: out, total: 0.32 };
}

/* ========== 主流程 ========== */
mkdirSync(OUT_DIR, { recursive: true });
console.log(`生成音频资源到 ${OUT_DIR}`);

// BGM：44.1kHz 渲染并编码为 MP3（lamejs 仅支持 MPEG1 采样率）
writeMp3('bgm.mp3', buildBgm(SR_BGM).data, SR_BGM);

// 音效文件很小，保持 WAV 免转码
for (const [name, build] of [
  ['win.wav', buildWin],
  ['correct.wav', buildCorrect],
  ['wrong.wav', buildWrong]
] as const) {
  const { data } = build();
  writeWav(name, data);
}

// 清理旧版 WAV BGM（已被 bgm.mp3 取代，避免打进主包）
const oldBgm = join(OUT_DIR, 'bgm.wav');
if (existsSync(oldBgm)) {
  rmSync(oldBgm);
  console.log('  ✗ 已删除过时的 bgm.wav');
}
console.log('完成 ✔');
