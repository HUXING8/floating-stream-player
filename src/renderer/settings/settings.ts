import type { MouseHideMode, Settings, ThemeMode } from '@shared/settings'

const api = window.settingsApi
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const themeSeg = el<HTMLDivElement>('theme-seg')
const themeButtons = Array.from(themeSeg.querySelectorAll<HTMLButtonElement>('.seg'))

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

function render(s: Settings): void {
  for (const btn of themeButtons) {
    btn.classList.toggle('active', btn.dataset.themeVal === s.theme)
  }
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
}

function wire(): void {
  for (const btn of themeButtons) {
    btn.addEventListener('click', () => {
      void api.patchSettings({ theme: btn.dataset.themeVal as ThemeMode })
    })
  }
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
