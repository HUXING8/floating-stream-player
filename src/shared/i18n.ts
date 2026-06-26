// 极简 i18n：主/渲染共享。所有界面文案集中在此处，按 key 取值。
// 未命中的 key 直接返回原字符串，便于调试。

import type { Language } from './settings'

interface Entry {
  zh: string
  en: string
}

const translations: Record<string, Entry> = {
  // 工具栏（player）
  'placeholder.url': {
    zh: '粘贴直播/视频地址，回车播放',
    en: 'Paste a live/video URL, press Enter to play'
  },
  'btn.play': { zh: '播放', en: 'Play' },
  'btn.login': { zh: '登录', en: 'Login' },
  'btn.login.title': { zh: '打开登录窗口', en: 'Open login window' },
  'btn.minimize': { zh: '最小化', en: 'Minimize' },
  'btn.settings': { zh: '设置', en: 'Settings' },
  'btn.close': { zh: '关闭', en: 'Close' },
  'btn.drag': { zh: '拖动', en: 'Drag' },
  'chk.pureVideo': { zh: '纯视频', en: 'Pure Video' },
  'chk.passthrough': { zh: '穿透', en: 'Click-through' },
  'btn.volume': { zh: '音量', en: 'Volume' },
  'btn.volumeUnmute': { zh: '取消静音', en: 'Unmute' },
  'btn.opacity': { zh: '透明度', en: 'Opacity' },

  // 状态消息（player）
  'status.detecting': { zh: '检测中…', en: 'Detecting...' },
  'status.noVideo': { zh: '未检测到画面', en: 'No video detected' },
  'status.error': { zh: '无法播放', en: 'Cannot play' },
  'status.pageLoadFailed': { zh: '页面加载失败', en: 'Page load failed' },
  'status.pageLoading': { zh: '页面加载中…', en: 'Loading page...' },
  'status.videoReady': {
    zh: '视频元素已就位，等待内容加载…',
    en: 'Video element ready, waiting for content...'
  },
  'status.injectError': { zh: '注入出错', en: 'Injection error' },
  'status.injected': { zh: '已注入，等待起播', en: 'Injected, waiting for playback' },
  'status.injectFailed': { zh: '执行注入失败', en: 'Injection failed' },
  'status.noVideoLogin': {
    zh: '未检测到视频（可能尚未起播或需登录）。需登录的站点请点「登录」登录后重试。',
    en: 'No video detected (may need login). For sites requiring login, click "Login" and try again.'
  },

  // 设置窗口
  'settings.windowTitle': { zh: '设置 - 悬浮播放器', en: 'Settings - Floating Player' },
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.subtitle': {
    zh: '调整悬浮窗的外观与行为，改动即时生效',
    en: 'Adjust the appearance and behavior of the floating window; changes take effect instantly'
  },
  'settings.section.theme': { zh: '主题', en: 'Theme' },
  'settings.theme.label': { zh: '界面外观', en: 'Appearance' },
  'settings.theme.desc': {
    zh: '夜间更护眼，跟随系统会自动切换',
    en: 'Dark is easier on the eyes; system mode switches automatically'
  },
  'settings.theme.light': { zh: '明亮', en: 'Light' },
  'settings.theme.dark': { zh: '夜间', en: 'Dark' },
  'settings.theme.system': { zh: '跟随系统', en: 'System' },

  'settings.section.language': { zh: '语言', en: 'Language' },
  'settings.language.label': { zh: '界面语言', en: 'Interface language' },
  'settings.language.desc': {
    zh: '选择应用界面的显示语言',
    en: 'Choose the display language of the app'
  },
  'settings.language.zh': { zh: '中文', en: 'Chinese' },
  'settings.language.en': { zh: '英文', en: 'English' },

  'settings.section.display': { zh: '显示', en: 'Display' },
  'settings.opacity': { zh: '不透明度', en: 'Opacity' },
  'settings.opacity.desc': {
    zh: '越低越透明，方便叠在工作内容上',
    en: 'Lower is more transparent, useful for overlay on work content'
  },

  'settings.section.audio': { zh: '音频', en: 'Audio' },
  'settings.muted': { zh: '静音', en: 'Muted' },
  'settings.volume': { zh: '音量', en: 'Volume' },

  'settings.section.mouseHide': { zh: '鼠标移动时隐藏', en: 'Hide on mouse move' },
  'settings.mouseHide.hint': {
    zh: '鼠标活动时让画面让位，停下来时再显示。',
    en: 'Hide the video while the mouse moves, show again when it stops.'
  },
  'settings.mouseHide.enabled': { zh: '开启此功能', en: 'Enable' },
  'settings.mouseHide.mode': { zh: '隐藏方式', en: 'Hide mode' },
  'settings.mouseHide.mode.fadeGlobal': {
    zh: '移动时淡出 · 停下淡入（推荐）',
    en: 'Fade out on move · fade in when idle (recommended)'
  },
  'settings.mouseHide.mode.instant': {
    zh: '移动即隐 · 停下即显',
    en: 'Hide instantly on move · show on stop'
  },
  'settings.mouseHide.mode.proximity': {
    zh: '仅鼠标靠近窗口时隐藏',
    en: 'Hide only when cursor is near the window'
  },
  'settings.mouseHide.idleShowDelay': { zh: '停多久后显示', en: 'Idle show delay' },
  'settings.mouseHide.idleShowDelay.desc': {
    zh: '单位毫秒，越大越"迟钝"',
    en: 'Milliseconds, larger values are less responsive'
  },
  'settings.mouseHide.moveThreshold': { zh: '移动灵敏度', en: 'Move sensitivity' },
  'settings.mouseHide.moveThreshold.desc': {
    zh: '触发隐藏的最小移动像素',
    en: 'Minimum movement (px) to trigger hiding'
  },
  'settings.mouseHide.keepPlaying': { zh: '隐藏时继续播放', en: 'Keep playing while hidden' },

  'settings.section.login': { zh: '登录', en: 'Login' },
  'settings.login.hint': {
    zh: '需要登录的网站：先在悬浮窗输入该网址播放，再点工具栏的「登录」按钮，会弹出一个正常大小的浏览器窗口，像平时一样登录后关闭它即可——登录态会被记住，播放器自动以登录状态重新加载。',
    en: 'For sites that require login: first paste the URL in the player, then click the "Login" button in the toolbar. A regular-sized browser window will open; sign in as usual and close it. Your session is remembered and the player reloads with you signed in.'
  },

  'settings.section.shortcuts': { zh: '全局快捷键', en: 'Global Shortcuts' },
  'settings.shortcuts.hint.prefix': { zh: '格式如 ', en: 'Format like ' },
  'settings.shortcuts.hint.suffix': {
    zh: '，在任何程序中按下都生效。',
    en: ', works in any app.'
  },
  'settings.shortcuts.toggleVisible': { zh: '隐藏 / 显示', en: 'Hide / Show' },
  'settings.shortcuts.toggleInteractive': {
    zh: '切换可操作 / 穿透',
    en: 'Toggle interactive / click-through'
  },
  'settings.shortcuts.toggleMute': { zh: '静音切换', en: 'Toggle mute' }
}

export function t(key: string, lang: Language): string {
  const entry = translations[key]
  if (!entry) return key
  return entry[lang] || entry.zh
}
