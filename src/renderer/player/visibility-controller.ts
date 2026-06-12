export interface Pausable {
  setPaused(paused: boolean): void
}

/**
 * 鼠标隐藏的“表现层”：主进程决定 hidden，这里只负责淡入淡出与（按需）暂停媒体。
 * 注意：整窗透明度由主进程 setOpacity 控制，这里操作的是内容层 opacity，二者分层互不冲突。
 */
export class VisibilityController {
  constructor(private readonly layer: HTMLElement) {}

  apply(
    hidden: boolean,
    transition: 'fade' | 'none',
    keepPlaying: boolean,
    media: Pausable | null
  ): void {
    this.layer.style.transition = transition === 'fade' ? 'opacity 0.35s ease' : 'none'
    this.layer.style.opacity = hidden ? '0' : '1'
    if (!keepPlaying && media) media.setPaused(hidden)
  }
}
