import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type PlayerApi, type SourceStatus, type VisibilitySetPayload } from '@shared/ipc'
import type { DeepPartial, Settings } from '@shared/settings'

function sub(channel: string, handler: (...args: unknown[]) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]): void => handler(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: PlayerApi = {
  webviewPreloadUrl: pathToFileURL(join(__dirname, 'webview-preload.js')).href,
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<Settings>,
  patchSettings: (patch: DeepPartial<Settings>) =>
    ipcRenderer.invoke(IPC.settingsPatch, patch) as Promise<Settings>,
  onSettingsChanged: (cb) => sub(IPC.settingsChanged, (s) => cb(s as Settings)),
  onVisibility: (cb) => sub(IPC.visibilitySet, (p) => cb(p as VisibilitySetPayload)),
  onToggleMute: (cb) => sub(IPC.shortcutToggleMute, () => cb()),
  setInteractive: (interactive) => ipcRenderer.send(IPC.windowSetInteractive, interactive),
  reportStatus: (status: SourceStatus, message?: string) =>
    ipcRenderer.send(IPC.playerSourceStatus, { status, message }),
  openSettings: () => ipcRenderer.send(IPC.openSettings),
  openLogin: (url: string) => ipcRenderer.send(IPC.openLogin, url),
  onLoginDone: (cb) => sub(IPC.loginDone, () => cb()),
  minimize: () => ipcRenderer.send(IPC.playerMinimize),
  quit: () => ipcRenderer.send(IPC.quitApp),
  log: (...args: unknown[]) => ipcRenderer.send(IPC.logFromRenderer, ...args),
  setWindowOpacity: (opacity: number) => ipcRenderer.send(IPC.setWindowOpacity, opacity)
}

contextBridge.exposeInMainWorld('playerApi', api)
