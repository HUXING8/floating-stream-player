import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type SettingsApi } from '@shared/ipc'
import type { DeepPartial, Settings } from '@shared/settings'

const api: SettingsApi = {
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
  patchSettings: (patch: DeepPartial<Settings>) =>
    ipcRenderer.invoke(IPC.settingsPatch, patch) as Promise<Settings>,
  onSettingsChanged: (cb) => {
    const listener = (_e: IpcRendererEvent, s: Settings): void => cb(s)
    ipcRenderer.on(IPC.settingsChanged, listener)
    return () => ipcRenderer.removeListener(IPC.settingsChanged, listener)
  },
  minimizeWindow: () => ipcRenderer.send(IPC.winMinimize),
  closeWindow: () => ipcRenderer.send(IPC.winClose)
}

contextBridge.exposeInMainWorld('settingsApi', api)
