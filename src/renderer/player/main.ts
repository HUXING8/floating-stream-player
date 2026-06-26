import type { Settings } from '@shared/settings'
import type { SourceStatus } from '@shared/ipc'
import { t } from '@shared/i18n'
import { DirectPlayer } from './direct-player'
import { PagePlayer } from './page-player'
import { VisibilityController, type Pausable } from './visibility-controller'
import { resolveKind } from './source-resolver'

const api = window.playerApi

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const video = $<HTMLVideoElement>('video')
const pageClip = $<HTMLDivElement>('page-clip')
const statusEl = $<HTMLDivElement>('status')
const urlInput = $<HTMLInputElement>('url')
const playBtn = $<HTMLButtonElement>('play')
const loginBtn = $<HTMLButtonElement>('login-btn')
const pureWrap = $<HTMLLabelElement>('pure-wrap')
const pureChk = $<HTMLInputElement>('pure-chk')
const passthroughChk = $<HTMLInputElement>('passthrough-chk')
const minBtn = $<HTMLButtonElement>('min-btn')
const settingsBtn = $<HTMLButtonElement>('settings-btn')
const closeBtn = $<HTMLButtonElement>('close-btn')
const toolbar = $<HTMLDivElement>('toolbar')
const root = $<HTMLDivElement>('root')

// 音量与透明度控制
const volumeBtn = $<HTMLButtonElement>('volume-btn')
const volumeSlider = $<HTMLInputElement>('volume-slider')
const opacitySlider = $<HTMLInputElement>('opacity-slider')

let settings: Settings
let active: 'direct' | 'page' | null = null
let currentUrl = ''
let passthrough = false
let hoveringToolbar = false

const setStatus = (status: SourceStatus, message?: string): void => {
  api.reportStatus(status, message)
  const lang = settings?.language ?? 'zh'
  const text =
    message ??
    (status === 'detecting'
      ? t('status.detecting', lang)
      : status === 'no-video'
        ? t('status.noVideo', lang)
        : status === 'error'
          ? t('status.error', lang)
          : '')
  statusEl.textContent = text
  statusEl.style.display = text ? 'flex' : 'none'
}

const direct = new DirectPlayer(video, setStatus)
const page = new PagePlayer(pageClip, api.webviewPreloadUrl, setStatus)
const visibility = new VisibilityController(root)

function activeMedia(): Pausable | null {
  if (active === 'direct') return direct
  if (active === 'page') return page
  return null
}

function applyAudio(): void {
  direct.applyAudio(settings.audio.muted, settings.audio.volume)
  page.applyAudio(settings.audio.muted, settings.audio.volume)
  updateVolumeUI()
}

function updateVolumeUI(): void {
  const percent = Math.round(settings.audio.volume * 100)
  volumeSlider.value = percent.toString()
  // 更新音量图标 + 标题（标题随语言切换）
  const icon = volumeBtn.querySelector('.icon')!
  const lang = settings.language
  if (settings.audio.muted) {
    icon.textContent = '🔇'
    volumeBtn.title = t('btn.volumeUnmute', lang)
  } else if (settings.audio.volume === 0) {
    icon.textContent = '🔇'
    volumeBtn.title = t('btn.volume', lang)
  } else if (settings.audio.volume < 0.5) {
    icon.textContent = '🔉'
    volumeBtn.title = t('btn.volume', lang)
  } else {
    icon.textContent = '🔊'
    volumeBtn.title = t('btn.volume', lang)
  }
}

function applyI18n(): void {
  const lang = settings.language
  urlInput.placeholder = t('placeholder.url', lang)
  playBtn.textContent = t('btn.play', lang)
  playBtn.title = t('btn.play', lang)
  loginBtn.textContent = t('btn.login', lang)
  loginBtn.title = t('btn.login.title', lang)
  minBtn.title = t('btn.minimize', lang)
  settingsBtn.title = t('btn.settings', lang)
  closeBtn.title = t('btn.close', lang)
  const dragEl = document.getElementById('drag')
  if (dragEl) dragEl.title = t('btn.drag', lang)
  const pureLabel = pureWrap.querySelector('span')
  if (pureLabel) pureLabel.textContent = t('chk.pureVideo', lang)
  const passthroughLabel = passthroughChk.parentElement?.querySelector('span')
  if (passthroughLabel) passthroughLabel.textContent = t('chk.passthrough', lang)
  const opacityBtn = document.getElementById('opacity-btn')
  if (opacityBtn) opacityBtn.title = t('btn.opacity', lang)
}

function updateOpacityUI(): void {
  const percent = Math.round(settings.opacity * 100)
  opacitySlider.value = percent.toString()
}

// 穿透：视频区域是否让点击落到下层应用；工具栏始终可点（悬停时恢复接收）
function applyInteractivity(): void {
  api.setInteractive(!passthrough || hoveringToolbar)
}

function showLayer(which: 'direct' | 'page'): void {
  video.style.display = which === 'direct' ? 'block' : 'none'
  pageClip.style.display = which === 'page' ? 'block' : 'none'
  loginBtn.style.display = which === 'page' ? 'inline-block' : 'none'
  pureWrap.style.display = which === 'page' ? 'inline-flex' : 'none'
}

async function loadUrl(raw: string): Promise<void> {
  const url = raw.trim()
  if (!url) return
  currentUrl = url
  urlInput.value = url
  setStatus('detecting')
  if (resolveKind(url) === 'direct') {
    page.stop()
    active = 'direct'
    showLayer('direct')
    await direct.play(url)
  } else {
    direct.stop()
    active = 'page'
    showLayer('page')
    page.setPureVideo(pureChk.checked)
    page.load(url)
  }
  applyAudio()
  void api.patchSettings({ lastUrl: url })
}

// 已知站点直达登录页；未知站点回退到该站点首页
function deriveLoginUrl(raw: string): string {
  try {
    const u = new URL(raw)
    const host = u.hostname
    if (host.includes('bilibili.com')) return 'https://passport.bilibili.com/login'
    if (host.includes('youtube.com') || host.includes('google.')) return 'https://accounts.google.com/'
    if (host.includes('twitch.tv')) return 'https://www.twitch.tv/login'
    if (host.includes('douyu.com')) return 'https://www.douyu.com/'
    if (host.includes('huya.com')) return 'https://www.huya.com/'
    return `${u.origin}/`
  } catch {
    return raw
  }
}

// 事件绑定
playBtn.addEventListener('click', () => void loadUrl(urlInput.value))
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void loadUrl(urlInput.value)
})
loginBtn.addEventListener('click', () => {
  if (currentUrl) api.openLogin(deriveLoginUrl(currentUrl))
})
pureChk.addEventListener('change', () => page.setPureVideo(pureChk.checked))
passthroughChk.addEventListener('change', () => {
  void api.patchSettings({ passthrough: passthroughChk.checked })
})

// 音量控制：点击按钮切换静音，拖动滑块调整音量
volumeBtn.addEventListener('click', () => {
  void api.patchSettings({ audio: { muted: !settings.audio.muted, volume: settings.audio.volume } })
})
volumeSlider.addEventListener('input', () => {
  const volume = parseInt(volumeSlider.value, 10) / 100
  void api.patchSettings({ audio: { muted: false, volume } })
})

// 透明度控制：拖动滑块调整
opacitySlider.addEventListener('input', () => {
  const opacity = parseInt(opacitySlider.value, 10) / 100
  void api.patchSettings({ opacity })
})

minBtn.addEventListener('click', () => {
  api.minimize()
})
settingsBtn.addEventListener('click', () => api.openSettings())
closeBtn.addEventListener('click', () => api.quit())

// 工具栏悬停时恢复可点（穿透模式下）
toolbar.addEventListener('mouseenter', () => {
  hoveringToolbar = true
  applyInteractivity()
})
toolbar.addEventListener('mouseleave', () => {
  hoveringToolbar = false
  applyInteractivity()
})

api.onLoginDone(() => {
  if (active === 'page' && currentUrl) void loadUrl(currentUrl)
})
api.onVisibility((p) => {
  visibility.apply(p.hidden, p.transition, settings.mouseHide.keepPlayingWhenHidden, activeMedia())
  // 同步设置整窗 OS 级不透明度，确保鼠标隐藏期间真正不可见（消除透明窗的细微残留）。
  // 这是临时调整，不会写入 settings；恢复时回到用户配置的 opacity。
  if (p.hidden) {
    api.setWindowOpacity(0)
  } else {
    api.setWindowOpacity(settings.opacity)
  }
})
api.onToggleMute(() => {
  void api.patchSettings({ audio: { muted: !settings.audio.muted, volume: settings.audio.volume } })
})
api.onSettingsChanged((s) => {
  settings = s
  passthrough = s.passthrough
  passthroughChk.checked = s.passthrough
  applyAudio()
  updateOpacityUI()
  applyInteractivity()
  applyI18n()
})

async function init(): Promise<void> {
  settings = await api.getSettings()
  passthrough = settings.passthrough
  passthroughChk.checked = settings.passthrough
  applyAudio()
  updateOpacityUI()
  applyInteractivity()
  applyI18n()
  // 默认不带 URL、不自动播放，输入框留空，等待用户输入
  setStatus('idle')
}

void init()
