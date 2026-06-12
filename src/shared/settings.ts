// 配置唯一真源：主进程持有并持久化，渲染进程通过 IPC 读取/更新。
// 任何窗口都不应各自维护配置副本（避免跨层配置漂移）。

export type MouseHideMode = 'fadeGlobal' | 'instant' | 'proximity'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface WindowBounds {
  x: number | null
  y: number | null
  width: number
  height: number
}

export interface Settings {
  /** 界面主题：明亮 / 夜间 / 跟随系统 */
  theme: ThemeMode
  /** 上次播放的 URL */
  lastUrl: string
  /** 悬浮窗位置与大小（x/y 为 null 时居中） */
  window: WindowBounds
  /** 整窗不透明度 0.2–1.0 */
  opacity: number
  audio: {
    muted: boolean
    /** 0–1 */
    volume: number
  }
  mouseHide: {
    enabled: boolean
    mode: MouseHideMode
    /** 鼠标静止多久后重新显示（毫秒） */
    idleShowDelayMs: number
    /** 判定为“移动”的像素阈值 */
    moveThresholdPx: number
    /** 隐藏期间是否继续播放（含声音） */
    keepPlayingWhenHidden: boolean
  }
  /** 视频区域点击穿透（工具栏始终可点） */
  passthrough: boolean
  /** Electron accelerator 字符串 */
  shortcuts: {
    toggleVisible: string
    toggleInteractive: string
    toggleMute: string
  }
}

export const OPACITY_MIN = 0.2
export const OPACITY_MAX = 1.0

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  lastUrl: '',
  window: { x: null, y: null, width: 480, height: 270 },
  opacity: 0.9,
  audio: { muted: false, volume: 0.8 },
  mouseHide: {
    enabled: false,
    mode: 'fadeGlobal',
    idleShowDelayMs: 2000,
    moveThresholdPx: 3,
    keepPlayingWhenHidden: true
  },
  passthrough: false,
  shortcuts: {
    toggleVisible: 'Control+Alt+H',
    toggleInteractive: 'Control+Alt+M',
    toggleMute: 'Control+Alt+S'
  }
}

export function clampOpacity(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_SETTINGS.opacity
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, value))
}

/** 深合并补丁到既有设置，返回新对象。仅处理已知字段，未知字段忽略。 */
export function mergeSettings(base: Settings, patch: DeepPartial<Settings>): Settings {
  return {
    theme: patch.theme ?? base.theme,
    lastUrl: patch.lastUrl ?? base.lastUrl,
    window: { ...base.window, ...patch.window },
    opacity: patch.opacity != null ? clampOpacity(patch.opacity) : base.opacity,
    audio: { ...base.audio, ...patch.audio },
    mouseHide: { ...base.mouseHide, ...patch.mouseHide },
    passthrough: patch.passthrough ?? base.passthrough,
    shortcuts: { ...base.shortcuts, ...patch.shortcuts }
  }
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
