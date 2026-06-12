// 运行在 <webview> 内部（guest）：自动把页面主视频提升铺满视口（object-fit:contain 自带黑边），
// 并中和其祖先的层叠上下文陷阱，使悬浮窗里只显示视频本身——视觉等同原生全屏，但不占顶层、自动生效。
import { ipcRenderer } from 'electron'
import { WV, type VideoStatus } from '@shared/ipc'

const STYLE_ID = '__fsp_style'
const BG_ID = '__fsp_bg'
let styledVideo: HTMLVideoElement | null = null
let touchedAncestors: HTMLElement[] = []

// 选主视频：优先有画面(videoWidth>0)的，否则取页面里尺寸最大的 <video> 元素（即便尚未起播）
function pickVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll('video'))
  let best: HTMLVideoElement | null = null
  let bestScore = -1
  for (const v of videos) {
    const r = v.getBoundingClientRect()
    const score = v.videoWidth > 0 ? v.videoWidth * v.videoHeight : r.width * r.height
    if (score > bestScore) {
      bestScore = score
      best = v
    }
  }
  return best
}

function ensureStyle(): void {
  let s = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!s) {
    s = document.createElement('style')
    s.id = STYLE_ID
    ;(document.head ?? document.documentElement).appendChild(s)
  }
  s.textContent = `
    html.__fsp_on, html.__fsp_on body { overflow:hidden!important; margin:0!important; padding:0!important; background:#000!important; }
    #${BG_ID} { position:fixed!important; inset:0!important; background:#000!important; z-index:2147483646!important; border:0!important; margin:0!important; }
    .__fsp_anc { transform:none!important; -webkit-transform:none!important; filter:none!important; perspective:none!important; overflow:visible!important; clip:auto!important; clip-path:none!important; opacity:1!important; will-change:auto!important; z-index:auto!important; }
    video.__fsp_v { position:fixed!important; top:0!important; left:0!important; right:0!important; bottom:0!important; width:100vw!important; height:100vh!important; max-width:none!important; max-height:none!important; min-width:0!important; min-height:0!important; margin:0!important; padding:0!important; object-fit:contain!important; background:#000!important; z-index:2147483647!important; }
  `
}

function ensureBackdrop(): void {
  if (!document.getElementById(BG_ID)) {
    const d = document.createElement('div')
    d.id = BG_ID
    document.documentElement.appendChild(d)
  }
}

function clearAncestors(): void {
  for (const el of touchedAncestors) el.classList.remove('__fsp_anc')
  touchedAncestors = []
}

function applyFill(v: HTMLVideoElement): void {
  ensureStyle()
  ensureBackdrop()
  document.documentElement.classList.add('__fsp_on')
  clearAncestors()
  // 中和从 video 到 body 的祖先：去掉 transform/filter/overflow 等造成的层叠/裁剪陷阱
  let el = v.parentElement
  while (el && el !== document.body && el !== document.documentElement) {
    el.classList.add('__fsp_anc')
    touchedAncestors.push(el)
    el = el.parentElement
  }
  if (styledVideo && styledVideo !== v) styledVideo.classList.remove('__fsp_v')
  v.classList.add('__fsp_v')
  styledVideo = v
}

function removeFill(): void {
  document.documentElement.classList.remove('__fsp_on')
  document.getElementById(BG_ID)?.remove()
  clearAncestors()
  if (styledVideo) {
    styledVideo.classList.remove('__fsp_v')
    styledVideo = null
  }
}

let noVideoTicks = 0
let autoplayTried = false

function tick(): void {
  const v = pickVideo()
  if (!v) {
    ipcRenderer.sendToHost(WV.videoStatus, { found: false, width: 0, height: 0 })
    noVideoTicks++
    if (noVideoTicks === 4) {
      ipcRenderer.sendToHost(WV.diag, '页面里暂未发现 <video> 元素（可能需登录或尚未加载）')
    }
    removeFill()
    return
  }
  noVideoTicks = 0

  // 自动起播：先尝试直接播；被自动播放策略拦截则静音重试
  if (v.paused) {
    v.play().catch(() => {
      v.muted = true
      void v.play().catch(() => {})
    })
    if (!autoplayTried) {
      autoplayTried = true
      ipcRenderer.sendToHost(WV.diag, '已尝试自动起播…')
    }
  }

  const ready = v.videoWidth > 0
  const status: VideoStatus = { found: ready, width: v.videoWidth, height: v.videoHeight }
  ipcRenderer.sendToHost(WV.videoStatus, status)
  if (ready) applyFill(v)
}

ipcRenderer.sendToHost(WV.diag, '预加载已注入')
window.addEventListener('DOMContentLoaded', () => {
  tick()
  setInterval(tick, 700)
})
