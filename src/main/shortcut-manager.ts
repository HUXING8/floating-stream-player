import { globalShortcut } from 'electron'
import type { Settings } from '@shared/settings'

export interface ShortcutHandlers {
  toggleVisible: () => void
  toggleInteractive: () => void
  toggleMute: () => void
}

/**
 * 全局快捷键注册。设置变更时整体重绑；注册失败的键位收集后回报给调用方。
 */
export class ShortcutManager {
  private handlers: ShortcutHandlers | null = null

  setHandlers(handlers: ShortcutHandlers): void {
    this.handlers = handlers
  }

  /** 返回注册失败的 accelerator 列表 */
  apply(s: Settings): string[] {
    globalShortcut.unregisterAll()
    if (!this.handlers) return []
    const failed: string[] = []
    const bind = (accel: string, fn: () => void): void => {
      if (!accel) return
      try {
        const ok = globalShortcut.register(accel, fn)
        if (!ok) failed.push(accel)
      } catch {
        failed.push(accel)
      }
    }
    bind(s.shortcuts.toggleVisible, this.handlers.toggleVisible)
    bind(s.shortcuts.toggleInteractive, this.handlers.toggleInteractive)
    bind(s.shortcuts.toggleMute, this.handlers.toggleMute)
    return failed
  }

  dispose(): void {
    globalShortcut.unregisterAll()
  }
}
