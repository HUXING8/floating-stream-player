import type { Language, MouseHideMode, Settings, ThemeMode } from '@shared/settings'
import { t } from '@shared/i18n'

const api = window.settingsApi
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const themeSeg = el<HTMLDivElement>('theme-seg')
const themeButtons = Array.from(themeSeg.querySelectorAll<HTMLButtonElement>('.seg'))

const language = el<HTMLSelectElement>('language')
const opacity = el<HTMLInputElement>('opacity')
const opacityVal = el<HTMLSpanElement>('opacity-val')
const muted = el<HTMLInputElement>('muted')
const volume = el<HTMLInputElement>('volume')
const mhEnabled = el<HTMLInputElement>('mh-enabled')
const mhMode = el<HTMLSelectElement>('mh-mode')
const mhDelay = el<HTMLInputElement>('mh-delay')
const mhThreshold = el<HTMLInputElement>('mh-threshold')
const mhKeep = el<HTMLInputElement>('mh-keep')
const scVisible = el<HTMLInputElement>('sc-visible')
const scInteractive = el<HTMLInputElement>('sc-interactive')
const scMute = el<HTMLInputElement>('sc-mute')

function applyI18n(lang: Language): void {
  // 文本内容
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
    const key = node.dataset['i18n']!
    node.textContent = t(key, lang)
  })
  // 属性：title
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((node) => {
    const key = node.dataset['i18nTitle']!
    node.title = t(key, lang)
  })
  // 属性：placeholder
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset['i18nPlaceholder']!
    ;(node as HTMLInputElement).placeholder = t(key, lang)
  })
  // 窗口标题（让任务栏/Alt+Tab 显示也跟随语言）
  document.title = t('settings.windowTitle', lang)
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}

function render(s: Settings): void {
  for (const btn of themeButtons) {
    btn.classList.toggle('active', btn.dataset.themeVal === s.theme)
  }
  language.value = s.language
  const pct = Math.round(s.opacity * 100)
  opacity.value = String(pct)
  opacityVal.textContent = `${pct}%`
  muted.checked = s.audio.muted
  volume.value = String(Math.round(s.audio.volume * 100))
  mhEnabled.checked = s.mouseHide.enabled
  mhMode.value = s.mouseHide.mode
  mhDelay.value = String(s.mouseHide.idleShowDelayMs)
  mhThreshold.value = String(s.mouseHide.moveThresholdPx)
  mhKeep.checked = s.mouseHide.keepPlayingWhenHidden
  scVisible.value = s.shortcuts.toggleVisible
  scInteractive.value = s.shortcuts.toggleInteractive
  scMute.value = s.shortcuts.toggleMute
  applyI18n(s.language)
}

function wire(): void {
  for (const btn of themeButtons) {
    btn.addEventListener('click', () => {
      void api.patchSettings({ theme: btn.dataset.themeVal as ThemeMode })
    })
  }
  language.addEventListener('change', () => {
    void api.patchSettings({ language: language.value as Language })
  })
  opacity.addEventListener('input', () => {
    opacityVal.textContent = `${opacity.value}%`
    void api.patchSettings({ opacity: Number(opacity.value) / 100 })
  })
  muted.addEventListener('change', () => void api.patchSettings({ audio: { muted: muted.checked } }))
  volume.addEventListener('input', () =>
    void api.patchSettings({ audio: { volume: Number(volume.value) / 100 } })
  )
  mhEnabled.addEventListener('change', () =>
    void api.patchSettings({ mouseHide: { enabled: mhEnabled.checked } })
  )
  mhMode.addEventListener('change', () =>
    void api.patchSettings({ mouseHide: { mode: mhMode.value as MouseHideMode } })
  )
  mhDelay.addEventListener('change', () =>
    void api.patchSettings({ mouseHide: { idleShowDelayMs: Number(mhDelay.value) } })
  )
  mhThreshold.addEventListener('change', () =>
    void api.patchSettings({ mouseHide: { moveThresholdPx: Number(mhThreshold.value) } })
  )
  mhKeep.addEventListener('change', () =>
    void api.patchSettings({ mouseHide: { keepPlayingWhenHidden: mhKeep.checked } })
  )
  scVisible.addEventListener('change', () =>
    void api.patchSettings({ shortcuts: { toggleVisible: scVisible.value.trim() } })
  )
  scInteractive.addEventListener('change', () =>
    void api.patchSettings({ shortcuts: { toggleInteractive: scInteractive.value.trim() } })
  )
  scMute.addEventListener('change', () =>
    void api.patchSettings({ shortcuts: { toggleMute: scMute.value.trim() } })
  )

  el<HTMLButtonElement>('win-min').addEventListener('click', () => api.minimizeWindow())
  el<HTMLButtonElement>('win-close').addEventListener('click', () => api.closeWindow())
}

async function init(): Promise<void> {
  render(await api.getSettings())
  wire()
  api.onSettingsChanged(render)
}

void init()
