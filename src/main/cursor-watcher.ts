import { EventEmitter } from 'node:events'
import { screen, type Rectangle } from 'electron'
import type { Settings, MouseHideMode } from '@shared/settings'
import type { VisibilitySetPayload } from '@shared/ipc'

const POLL_INTERVAL_MS = 100

interface WatchConfig {
  enabled: boolean
  mode: MouseHideMode
  idleShowDelayMs: number
  moveThresholdPx: number
}

/**
 * 轮询全局光标，结合窗口范围与设置，集中决定悬浮窗应隐藏还是显示。
 * 不引入原生 hook 依赖。决策结果通过 'visibility' 事件下发。
 */
export class CursorWatcher extends EventEmitter {
  private timer: NodeJS.Timeout | null = null
  private lastPoint = { x: 0, y: 0 }
  private lastMoveAt = 0
  private currentHidden = false
  private cfg: WatchConfig = {
    enabled: false,
    mode: 'fadeGlobal',
    idleShowDelayMs: 2000,
    moveThresholdPx: 3
  }
  /** 由外部（WindowManager）提供窗口当前屏幕范围，用于 proximity 判定 */
  private getWindowBounds: () => Rectangle | null = () => null

  setBoundsProvider(fn: () => Rectangle | null): void {
    this.getWindowBounds = fn
  }

  configure(s: Settings): void {
    this.cfg = {
      enabled: s.mouseHide.enabled,
      mode: s.mouseHide.mode,
      idleShowDelayMs: s.mouseHide.idleShowDelayMs,
      moveThresholdPx: s.mouseHide.moveThresholdPx
    }
    if (!this.cfg.enabled) {
      // 关闭时强制恢复显示
      this.emitVisibility(false, 'fade')
    }
    this.ensureRunning()
  }

  start(): void {
    this.ensureRunning()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private ensureRunning(): void {
    if (this.timer) return
    const now = Date.now()
    this.lastMoveAt = now
    this.lastPoint = screen.getCursorScreenPoint()
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS)
  }

  private tick(): void {
    if (!this.cfg.enabled) return
    const p = screen.getCursorScreenPoint()
    const now = Date.now()
    const moved =
      Math.abs(p.x - this.lastPoint.x) >= this.cfg.moveThresholdPx ||
      Math.abs(p.y - this.lastPoint.y) >= this.cfg.moveThresholdPx
    if (moved) {
      this.lastPoint = p
      this.lastMoveAt = now
    }
    const idleFor = now - this.lastMoveAt

    switch (this.cfg.mode) {
      case 'fadeGlobal':
        if (moved) this.emitVisibility(true, 'fade')
        else if (idleFor >= this.cfg.idleShowDelayMs) this.emitVisibility(false, 'fade')
        break
      case 'instant':
        if (moved) this.emitVisibility(true, 'none')
        else this.emitVisibility(false, 'none')
        break
      case 'proximity': {
        const b = this.getWindowBounds()
        const inside =
          b != null && p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height
        this.emitVisibility(inside, 'fade')
        break
      }
    }
  }

  private emitVisibility(hidden: boolean, transition: 'fade' | 'none'): void {
    if (hidden === this.currentHidden) return
    this.currentHidden = hidden
    const payload: VisibilitySetPayload = { hidden, transition }
    this.emit('visibility', payload)
  }
}
