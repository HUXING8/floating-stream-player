import type { Settings } from '@shared/settings'
import type { SourceStatus } from '@shared/ipc'
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
const collapsedIcon = $<HTMLDivElement>('collapsed-icon')
const toolbar = $<HTMLDivElement>('toolbar')
const content = $<HTMLDivElement>('content')

let settings: Settings
let active: 'direct' | 'page' | null = null
let currentUrl = ''
let passthrough = false
let hoveringToolbar = false
let collapsed = false

const setStatus = (status: SourceStatus, message?: string): void => {
  api.reportStatus(status, message)
  const text =
    message ??
    (status === 'detecting'
      ? '检测中…'
      : status === 'no-video'
        ? '未检测到画面'
        : status === 'error'
          ? '无法播放'
          : '')
  statusEl.textContent = text
  statusEl.style.display = text ? 'flex' : 'none'
}

const direct = new DirectPlayer(video, setStatus)
const page = new PagePlayer(pageClip, api.webviewPreloadUrl, setStatus)
const visibility = new VisibilityController(content)

function activeMedia(): Pausable | null {
  if (active === 'direct') return direct
  if (active === 'page') return page
  return null
}

function applyAudio(): void {
  direct.applyAudio(settings.audio.muted, settings.audio.volume)
  page.applyAudio(settings.audio.muted, settings.audio.volume)
}

// 穿透：视频区域是否让点击落到下层应用；工具栏始终可点（悬停时恢复接收）
function applyInteractivity(): void {
  if (collapsed) {
    api.setInteractive(true)
    return
  }
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

function setCollapsed(value: boolean): void {
  collapsed = value
  document.body.classList.toggle('collapsed', value)
  applyInteractivity()
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
minBtn.addEventListener('click', () => {
  setCollapsed(true)
  api.collapse()
})
collapsedIcon.addEventListener('click', () => {
  api.expand()
  setCollapsed(false)
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
})
api.onToggleMute(() => {
  void api.patchSettings({ audio: { muted: !settings.audio.muted, volume: settings.audio.volume } })
})
api.onSettingsChanged((s) => {
  settings = s
  passthrough = s.passthrough
  passthroughChk.checked = s.passthrough
  applyAudio()
  applyInteractivity()
})

async function init(): Promise<void> {
  settings = await api.getSettings()
  passthrough = settings.passthrough
  passthroughChk.checked = settings.passthrough
  applyAudio()
  applyInteractivity()
  // 默认不带 URL、不自动播放，输入框留空，等待用户输入
  setStatus('idle')
}

void init()
