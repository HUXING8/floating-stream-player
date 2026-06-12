import Hls from 'hls.js'
import mpegts from 'mpegts.js'
import type { SourceStatus } from '@shared/ipc'

type StatusFn = (status: SourceStatus, message?: string) => void

const HLS_EXT = /\.m3u8(\?|#|$)/i
const FLV_EXT = /\.flv(\?|#|$)/i
const TS_EXT = /\.ts(\?|#|$)/i

/** 直链媒体播放：.m3u8→hls.js，.flv/.ts→mpegts.js，其余→原生 <video>。 */
export class DirectPlayer {
  private hls: Hls | null = null
  private mpegtsPlayer: mpegts.Player | null = null

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onStatus: StatusFn
  ) {
    this.video.addEventListener('playing', () => this.onStatus('playing'))
    this.video.addEventListener('error', () => this.onStatus('error', '视频加载失败'))
  }

  async play(url: string): Promise<void> {
    this.stop()
    try {
      if (HLS_EXT.test(url)) {
        if (Hls.isSupported()) {
          const hls = new Hls()
          this.hls = hls
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) this.onStatus('error', 'HLS 播放错误')
          })
          hls.loadSource(url)
          hls.attachMedia(this.video)
        } else {
          this.video.src = url
        }
      } else if (FLV_EXT.test(url) || TS_EXT.test(url)) {
        if (mpegts.getFeatureList().mseLivePlayback) {
          const player = mpegts.createPlayer({
            type: FLV_EXT.test(url) ? 'flv' : 'mpegts',
            isLive: true,
            url
          })
          this.mpegtsPlayer = player
          player.attachMediaElement(this.video)
          player.load()
        } else {
          this.video.src = url
        }
      } else {
        this.video.src = url
      }
      await this.video.play().catch(() => {
        /* 自动播放可能被拦截，用户可手动触发 */
      })
    } catch {
      this.onStatus('error', '无法播放该地址')
    }
  }

  applyAudio(muted: boolean, volume: number): void {
    this.video.muted = muted
    this.video.volume = volume
  }

  setPaused(paused: boolean): void {
    if (paused) this.video.pause()
    else void this.video.play().catch(() => {})
  }

  stop(): void {
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    if (this.mpegtsPlayer) {
      this.mpegtsPlayer.destroy()
      this.mpegtsPlayer = null
    }
    this.video.removeAttribute('src')
    this.video.load()
  }
}
