import { join } from 'node:path'
import { BrowserWindow, nativeTheme, type Rectangle } from 'electron'
import type { Language, Settings } from '@shared/settings'
import { t } from '@shared/i18n'

// 与播放器 webview 共享的会话分区：登录窗口登录后，播放器即处于登录态
export const PLAYER_PARTITION = 'persist:player'

const PRELOAD_DIR = join(__dirname, '../preload')
const RENDERER_DIR = join(__dirname, '../renderer/src/renderer')

function loadRenderer(win: BrowserWindow, name: 'player' | 'settings'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/src/renderer/${name}/index.html`)
  } else {
    void win.loadFile(join(RENDERER_DIR, `${name}/index.html`))
  }
}

export class WindowManager {
  private player: BrowserWindow | null = null
  private settingsWin: BrowserWindow | null = null
  /** 拖拽/缩放变更窗口范围时回调（用于持久化），已在外部做防抖 */
  onBoundsChanged: ((b: Rectangle) => void) | null = null

  createPlayer(settings: Settings): BrowserWindow {
    const { window: w, opacity } = settings
    const win = new BrowserWindow({
      width: w.width,
      height: w.height,
      x: w.x ?? undefined,
      y: w.y ?? undefined,
      frame: false,
      transparent: true,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      minWidth: 160,
      minHeight: 90,
      // 关键：网页/视频请求 HTML 全屏时，不要把这个悬浮窗变成 OS 全屏；
      // 全屏元素仍会填满当前窗口视口（正是我们要的“只剩视频”）。
      fullscreenable: false,
      webPreferences: {
        preload: join(PRELOAD_DIR, 'player-preload.js'),
        contextIsolation: true,
        sandbox: false,
        webviewTag: true
      }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setOpacity(opacity)

    // 可靠地为 <webview> 注入 guest 预加载脚本（attribute 方式常被忽略，这里在主进程强制设定）
    win.webContents.on('will-attach-webview', (_e, webPreferences) => {
      webPreferences.preload = join(PRELOAD_DIR, 'webview-preload.js')
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
    })

    loadRenderer(win, 'player')

    const persist = (): void => {
      if (this.onBoundsChanged && !win.isDestroyed()) this.onBoundsChanged(win.getBounds())
    }
    win.on('move', persist)
    win.on('resize', persist)
    win.on('closed', () => {
      this.player = null
    })

    this.player = win
    // 启动默认可交互（工具栏可点）；穿透由渲染层按勾选 + 悬停工具栏动态控制
    this.setInteractive(true)
    return win
  }

  openSettings(language: Language = 'zh'): void {
    if (this.settingsWin && !this.settingsWin.isDestroyed()) {
      this.settingsWin.focus()
      return
    }
    const win = new BrowserWindow({
      width: 470,
      height: 730,
      minWidth: 420,
      minHeight: 480,
      title: t('settings.windowTitle', language),
      resizable: true,
      frame: false,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#15181f' : '#f4f5f8',
      webPreferences: {
        preload: join(PRELOAD_DIR, 'settings-preload.js'),
        contextIsolation: true,
        sandbox: false
      }
    })
    win.on('closed', () => {
      this.settingsWin = null
    })
    loadRenderer(win, 'settings')
    this.settingsWin = win
  }

  /** 打开一个正常的大窗口用于登录目标站点；与播放器 webview 共享会话，关闭后回调通知刷新 */
  openLoginWindow(url: string, onClosed: () => void): void {
    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      title: '登录 - 在此登录后关闭本窗口',
      autoHideMenuBar: true,
      webPreferences: {
        partition: PLAYER_PARTITION,
        contextIsolation: true,
        // 用正常 Chrome UA，避免被站点反爬拦截
        sandbox: true
      }
    })
    win.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    )
    win.on('closed', onClosed)
    void win.loadURL(url)
  }

  getPlayer(): BrowserWindow | null {
    return this.player
  }

  getPlayerBounds(): Rectangle | null {
    if (!this.player || this.player.isDestroyed()) return null
    return this.player.getBounds()
  }

  setOpacity(opacity: number): void {
    if (this.player && !this.player.isDestroyed()) this.player.setOpacity(opacity)
  }

  /** 整窗显示/隐藏（绑定 toggleVisible 快捷键），与鼠标隐藏无关 */
  toggleVisible(): void {
    if (!this.player || this.player.isDestroyed()) return
    if (this.player.isVisible()) this.player.hide()
    else this.player.showInactive()
  }

  /** interactive=true：正常接收鼠标；false：忽略鼠标并向下转发（穿透） */
  setInteractive(interactive: boolean): void {
    if (this.player && !this.player.isDestroyed()) {
      this.player.setIgnoreMouseEvents(!interactive, { forward: true })
    }
  }

  /** 标准最小化到任务栏 */
  minimize(): void {
    if (!this.player || this.player.isDestroyed()) return
    this.player.minimize()
  }

  sendToPlayer(channel: string, payload?: unknown): void {
    if (this.player && !this.player.isDestroyed()) {
      this.player.webContents.send(channel, payload)
    }
  }

  broadcastSettings(channel: string, settings: Settings): void {
    for (const win of [this.player, this.settingsWin]) {
      if (win && !win.isDestroyed()) win.webContents.send(channel, settings)
    }
  }
}
