import { app, BrowserWindow, ipcMain, nativeTheme, type Rectangle } from 'electron'
import type { DeepPartial, Settings } from '@shared/settings'
import { IPC, type SourceStatusPayload } from '@shared/ipc'
import { SettingsStore } from './settings-store'
import { WindowManager } from './window-manager'
import { CursorWatcher } from './cursor-watcher'
import { ShortcutManager } from './shortcut-manager'

const store = new SettingsStore()
const windows = new WindowManager()
const cursor = new CursorWatcher()
const shortcuts = new ShortcutManager()

let prev: Settings | null = null

function shortcutsChanged(a: Settings, b: Settings): boolean {
  return (
    a.shortcuts.toggleVisible !== b.shortcuts.toggleVisible ||
    a.shortcuts.toggleInteractive !== b.shortcuts.toggleInteractive ||
    a.shortcuts.toggleMute !== b.shortcuts.toggleMute
  )
}

function applySettings(settings: Settings): void {
  // 主题：驱动 Chromium 的 prefers-color-scheme（含“跟随系统”）
  nativeTheme.themeSource = settings.theme
  windows.setOpacity(settings.opacity)
  cursor.configure(settings)

  if (!prev || shortcutsChanged(prev, settings)) {
    const failed = shortcuts.apply(settings)
    if (failed.length) console.warn('[shortcuts] 注册失败:', failed.join(', '))
  }
  prev = settings
}

// 防抖持久化窗口范围，避免拖拽过程中频繁写盘与重绑
let boundsTimer: NodeJS.Timeout | null = null
function persistBounds(b: Rectangle): void {
  if (windows.isCollapsed()) return // 折叠态的小尺寸不写回
  if (boundsTimer) clearTimeout(boundsTimer)
  boundsTimer = setTimeout(() => {
    store.patch({ window: { x: b.x, y: b.y, width: b.width, height: b.height } })
  }, 400)
}

function registerIpc(): void {
  ipcMain.handle(IPC.settingsGet, () => store.get())
  ipcMain.handle(IPC.settingsPatch, (_e, patch: DeepPartial<Settings>) => store.patch(patch))
  ipcMain.on(IPC.windowSetInteractive, (_e, interactive: boolean) =>
    windows.setInteractive(interactive)
  )
  ipcMain.on(IPC.winCollapse, () => windows.collapse())
  ipcMain.on(IPC.winExpand, () => windows.expand())
  ipcMain.on(IPC.openSettings, () => windows.openSettings())
  ipcMain.on(IPC.quitApp, () => app.quit())
  ipcMain.on(IPC.playerSourceStatus, (_e, payload: SourceStatusPayload) => {
    if (payload.status === 'error') console.warn('[player] 来源错误:', payload.message)
  })
  ipcMain.on(IPC.openLogin, (_e, url: string) => {
    windows.openLoginWindow(url, () => windows.sendToPlayer(IPC.loginDone))
  })
  ipcMain.on(IPC.winMinimize, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on(IPC.winClose, (e) => BrowserWindow.fromWebContents(e.sender)?.close())
}

function bootstrap(): void {
  registerIpc()

  shortcuts.setHandlers({
    toggleVisible: () => windows.toggleVisible(),
    // 快捷键切换“视频区域穿透”（与工具栏勾选框等效）
    toggleInteractive: () => store.patch({ passthrough: !store.get().passthrough }),
    toggleMute: () => windows.sendToPlayer(IPC.shortcutToggleMute)
  })

  windows.onBoundsChanged = persistBounds
  cursor.setBoundsProvider(() => windows.getPlayerBounds())
  cursor.on('visibility', (payload) => windows.sendToPlayer(IPC.visibilitySet, payload))

  // 配置变更：应用副作用并广播给所有窗口
  store.on('changed', (settings: Settings) => {
    applySettings(settings)
    windows.broadcastSettings(IPC.settingsChanged, settings)
  })

  const initial = store.get()
  windows.createPlayer(initial)
  applySettings(initial)
  cursor.start()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const player = windows.getPlayer()
    if (player) {
      if (!player.isVisible()) player.showInactive()
      player.focus()
    }
  })

  app.whenReady().then(bootstrap)

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('will-quit', () => {
    shortcuts.dispose()
    cursor.stop()
  })
}
