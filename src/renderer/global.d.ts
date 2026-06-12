import type { PlayerApi, SettingsApi } from '@shared/ipc'

declare global {
  interface Window {
    playerApi: PlayerApi
    settingsApi: SettingsApi
  }
}

export {}
