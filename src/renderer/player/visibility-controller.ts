export interface Pausable {
  setPaused(paused: boolean): void
}

/**
 * 鼠标隐藏的“表现层”：主进程决定 hidden，这里只负责淡入淡出与（按需）暂停媒体。
 * 注意：整窗透明度由主进程 setOpacity 控制，这里操作的是内容层 opacity，二者分层互不冲突。
 * 为彻底消除“opacity:0 仍残留边框/背景”的视觉痕迹：淡出完成后同步设置 visibility:hidden。
 */
export class VisibilityController {
  private hideTimer: number | null = null

  constructor(private readonly layer: HTMLElement) {}

  apply(
    hidden: boolean,
    transition: 'fade' | 'none',
    keepPlaying: boolean,
    media: Pausable | null
  ): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }

    if (transition === 'fade') {
      this.layer.style.transition = 'opacity 0.35s ease'
      this.layer.style.opacity = hidden ? '0' : '1'
      if (hidden) {
        // 淡出动画结束后再切 visibility:hidden，避免突变
        this.hideTimer = window.setTimeout(() => {
          if (this.layer.style.opacity === '0') {
            this.layer.style.visibility = 'hidden'
          }
          this.hideTimer = null
        }, 350)
      } else {
        this.layer.style.visibility = 'visible'
      }
    } else {
      this.layer.style.transition = 'none'
      this.layer.style.opacity = hidden ? '0' : '1'
      this.layer.style.visibility = hidden ? 'hidden' : 'visible'
    }
    if (!keepPlaying && media) media.setPaused(hidden)
  }
}
