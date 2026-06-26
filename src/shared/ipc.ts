// IPC 通道契约：主进程与渲染进程共用，集中定义避免拼写漂移。
import type { DeepPartial, Settings } from './settings'

export const IPC = {
  // 配置
  settingsGet: 'settings:get',
  settingsPatch: 'settings:patch',
  settingsChanged: 'settings:changed',
  // 可见性（鼠标隐藏的决策在主进程，结果下发给 player 渲染层动画）
  visibilitySet: 'visibility:set',
  // 窗口控制
  windowSetInteractive: 'window:set-interactive',
  playerMinimize: 'window:minimize',
  openSettings: 'window:open-settings',
  quitApp: 'app:quit',
  // 播放状态（player -> main/settings）
  playerSourceStatus: 'player:source-status',
  // 快捷键触发（main -> player）
  shortcutToggleMute: 'shortcut:toggle-mute',
  // 独立登录窗口（player -> main 打开；main -> player 登录窗口关闭后通知刷新）
  openLogin: 'login:open',
  loginDone: 'login:done',
  // 无边框窗口控制（settings -> main）
  winMinimize: 'win:minimize',
  winClose: 'win:close',
  // 渲染进程日志转发（renderer -> main）：让 webview/player 的 console 也能出现在 `npm run dev` 终端
  logFromRenderer: 'log-from-renderer',
  // 临时窗口不透明度（鼠标隐藏期间用，不持久化，不写 settings）
  setWindowOpacity: 'window:set-opacity-ephemeral'
} as const

// webview 宿主 <-> guest(preload) 之间的消息通道（非主进程 IPC）
export const WV = {
  videoStatus: 'wv:video-status',
  // 诊断信息（guest -> host），用于排查“只有黑屏/提取不到”问题
  diag: 'wv:diag'
} as const

export interface VideoStatus {
  found: boolean
  width: number
  height: number
}

export type SourceStatus = 'idle' | 'detecting' | 'playing' | 'no-video' | 'error'

export interface VisibilitySetPayload {
  hidden: boolean
  transition: 'fade' | 'none'
}

export interface SourceStatusPayload {
  status: SourceStatus
  message?: string
}

// preload 通过 contextBridge 暴露给 player 渲染进程的 API 形状
export interface PlayerApi {
  /** <webview> 的 preload 文件 URL（用于在页面内注入定位视频的脚本） */
  webviewPreloadUrl: string
  getSettings(): Promise<Settings>
  patchSettings(patch: DeepPartial<Settings>): Promise<Settings>
  onSettingsChanged(cb: (s: Settings) => void): () => void
  onVisibility(cb: (p: VisibilitySetPayload) => void): () => void
  onToggleMute(cb: () => void): () => void
  setInteractive(interactive: boolean): void
  reportStatus(status: SourceStatus, message?: string): void
  openSettings(): void
  openLogin(url: string): void
  onLoginDone(cb: () => void): () => void
  minimize(): void
  quit(): void
  /** 把渲染进程/webview 的日志转发到主进程终端（仅诊断用） */
  log(...args: unknown[]): void
  /** 临时调整窗口不透明度（鼠标隐藏期间使用，不持久化） */
  setWindowOpacity(opacity: number): void
}

// preload 暴露给 settings 渲染进程的 API 形状
export interface SettingsApi {
  getSettings(): Promise<Settings>
  patchSettings(patch: DeepPartial<Settings>): Promise<Settings>
  onSettingsChanged(cb: (s: Settings) => void): () => void
  minimizeWindow(): void
  closeWindow(): void
}
