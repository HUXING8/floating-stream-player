# Floating Stream Player

**English** · [中文](./README.md)

[![CI](https://github.com/HUXING8/floating-stream-player/actions/workflows/ci.yml/badge.svg)](https://github.com/HUXING8/floating-stream-player/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/HUXING8/floating-stream-player?include_prereleases&sort=semver)](https://github.com/HUXING8/floating-stream-player/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6)

A **floating, always-on-top desktop video / live player for Windows**. It plays a video in a
transparent mini window that stays on top of any application — extracting the pure video out of a
web page (no page chrome, black letterbox when stretched), so you can keep an eye on a match or a
livestream while you work. Highly configurable.

---

## ✨ Features

- **Pure video** — for platform pages (YouTube / Bilibili, etc.) only the video itself is shown; stretch the window and everything outside the video is black.
- **Direct streams & pages** — direct media (`.m3u8` / `.flv` / `.mp4`) plays natively; platform pages are loaded in an embedded browser and the video is extracted.
- **Transparent & always-on-top** — frameless, floats above any desktop app, opacity adjustable 20%–100%.
- **Click-through** — when enabled, clicks on the video area pass through to the app below; the toolbar stays clickable.
- **Auto-hide on mouse move** — fades out while the mouse is active and reappears when it stops; three modes.
- **Minimize to corner** — collapse to a small icon in the top-left corner (video keeps playing in the background); click the icon to expand.
- **Login support** — a standalone login window shares the player's session, so you log in once to watch content that requires it.
- **Global shortcuts** — hide/show, toggle click-through, mute; all customizable.
- **Themes** — light / dark / follow system.
- **Native controls** — seek bar, play/pause, volume; skippable ads are auto-skipped.

---

## 📦 Installation

### Option 1 — Download a Release (recommended, no build)

Grab the latest from [Releases](https://github.com/HUXING8/floating-stream-player/releases):

- `FloatingStreamPlayer-Setup-x.y.z.exe` — installer (NSIS)
- `FloatingStreamPlayer-x.y.z-portable.exe` — portable build

Windows 10 / 11 (x64) only.

### Option 2 — Install via npm

```bash
# from the npm registry (once published)
npm install -g floating-stream-player
floating-stream-player

# or directly from GitHub (no npm publish required)
npm install -g github:HUXING8/floating-stream-player
floating-stream-player
```

> The npm install pulls the Electron runtime (~200 MB) and builds on install.

### Option 3 — Build from source

```bash
git clone https://github.com/HUXING8/floating-stream-player.git
cd floating-stream-player
npm install
npm run dev          # run in dev mode
# or
npm run build && npm start   # run the built app
npm run dist         # produce Windows installers in release/
```

> Behind a slow network, mirrors help:
> ```bash
> git config --global url."https://github.com/".insteadOf "git@github.com:"
> set ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
> ```

---

## 🚀 Usage

1. A toolbar stays pinned at the top. Paste a live/video URL and press Enter or click **Play**.
   - Direct links (`.m3u8` / `.flv` / `.mp4`) play immediately.
   - Platform pages (YouTube / Bilibili, etc.) auto-extract the video and show only the picture.
2. **Login** — for content that requires it, click **Login** to open a normal-sized browser window, sign in, and close it; the player reloads in the logged-in state.
3. **Quality / site features** — uncheck **Pure video** to show the full page and use the site's own quality menu, ad-skip, etc.; check it again to return to pure video.
4. **Click-through** — check **Passthrough** so clicks fall to the app below; hovering the toolbar keeps it clickable.
5. **Minimize** — click **—** to collapse to a corner icon; click the icon to expand.
6. **Settings** (⚙) — theme, opacity, volume, mouse auto-hide, shortcuts.

---

## ⌨️ Default shortcuts

| Action | Shortcut |
|--------|----------|
| Hide / show the window | `Ctrl+Alt+H` |
| Toggle video-area click-through | `Ctrl+Alt+M` |
| Toggle mute | `Ctrl+Alt+S` |

All customizable in Settings.

---

## 🛠️ Development

```bash
npm run dev          # start (electron-vite dev mode)
npm run typecheck    # TypeScript type check
npm run build        # build to out/
npm run dist         # package Windows installers with electron-builder
```

Stack: Electron · TypeScript · electron-vite · hls.js · mpegts.js · electron-store.

```
src/
  shared/      Settings schema & IPC contracts (single source of truth, shared by main/renderer)
  main/        Main process: windows, settings store, global shortcuts, cursor watcher, login window
  preload/     contextBridge-exposed APIs
  renderer/
    player/    Floating window: direct/page playback, video extraction, visibility control, toolbar
    settings/  Settings window
```

---

## 📄 License

[MIT](./LICENSE) © 2026 HuXing
