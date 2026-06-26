# Floating Stream Player · 悬浮播放器

[English](./README.en.md) · **中文**

[![CI](https://github.com/HUXING8/floating-stream-player/actions/workflows/ci.yml/badge.svg)](https://github.com/HUXING8/floating-stream-player/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/HUXING8/floating-stream-player?include_prereleases&sort=semver)](https://github.com/HUXING8/floating-stream-player/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6)

一个 **Windows 桌面悬浮视频 / 直播播放器**：把视频画面以透明、置顶、可跨应用悬浮的小窗播放。
一边工作一边"瞄一眼"画面（看比赛、盯直播间），画面只显示视频本身、拉伸自带黑边，行为高度可配置。

> A floating, always-on-top desktop player for Windows. It extracts the pure video out of a
> web page (no page chrome), stays on top of any app, and gets out of your way when you move the mouse.

---

## ✨ 功能特性

- **纯视频画面**：平台页面（YouTube / Bilibili 等）只显示视频本身，拉伸窗口时视频之外为黑边。
- **直链 & 页面双支持**：直链媒体（`.m3u8` / `.flv` / `.mp4`）走原生播放；平台页面在内嵌浏览器中加载并提取视频。
- **透明置顶悬浮**：无边框、置顶于任意桌面应用之上，不透明度 20%–100% 可调。
- **点击穿透**：勾选后视频区域的点击落到下层应用（摸鱼不挡活），工具栏始终可点。
- **鼠标移动隐藏**：鼠标活动时自动淡出、静止时显示，整窗（含工具栏）完全隐身，三种模式可选。
- **登录支持**：独立登录窗口与播放器共享会话，登录一次后看需登录的内容。
- **全局快捷键**：隐藏 / 显示、切换穿透、静音，均可自定义。
- **主题与语言**：明亮 / 夜间 / 跟随系统；中文 / English 实时切换。
- **原生控件**：进度条、播放暂停、音量；广告无法自动跳过，但可拖动进度条手动跳过。

---

## 📦 安装

### 方式一：下载 Release（推荐，免编译）

前往 [Releases](https://github.com/HUXING8/floating-stream-player/releases) 下载最新版：

- `FloatingStreamPlayer-Setup-x.y.z.exe` —— 安装版（NSIS）
- `FloatingStreamPlayer-x.y.z-portable.exe` —— 免安装绿色版

仅支持 Windows 10 / 11（x64）。

### 方式二：通过 npm 安装

```bash
# 从 npm 安装（需已发布到 npm registry）
npm install -g floating-stream-player
floating-stream-player

# 或直接从 GitHub 安装（无需发布到 npm）
npm install -g github:HUXING8/floating-stream-player
floating-stream-player
```

> npm 安装会拉取 Electron 运行时（约 200 MB）并在安装时构建。

### 方式三：源码编译

```bash
git clone https://github.com/HUXING8/floating-stream-player.git
cd floating-stream-player
npm install
npm run dev          # 开发模式运行
# 或
npm run build && npm start   # 构建后运行
npm run dist         # 生成 Windows 安装包到 release/
```

> 国内网络若卡在拉取依赖 / 下载 Electron，可使用镜像：
> ```bash
> git config --global url."https://github.com/".insteadOf "git@github.com:"
> set ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
> ```

---

## 🚀 使用

1. 启动后顶部有常驻工具栏，在输入框粘贴直播 / 视频地址，回车或点「播放」。
   - 直链（`.m3u8` / `.flv` / `.mp4`）直接播放。
   - 平台页面（YouTube / Bilibili 等）会自动提取视频，只显示纯画面。
2. **登录**：看需要登录的内容时，点「登录」打开正常大小的浏览器窗口登录，关闭后播放器自动以登录态重载。
3. **清晰度 / 站点功能**：取消勾选「纯视频」即可显示完整网页，使用站点自带的清晰度、跳过广告等功能；选好后勾回「纯视频」。
4. **穿透**：勾选「穿透」后点击落到下层应用；鼠标移到工具栏上仍可操作。
5. **最小化**：点「—」最小化到 Windows 任务栏，点任务栏图标恢复。
6. **设置**（⚙）：主题、语言、不透明度、音量、鼠标移动隐藏、快捷键。

---

## ⌨️ 默认快捷键

| 功能 | 快捷键 |
|------|--------|
| 隐藏 / 显示悬浮窗 | `Ctrl+Alt+H` |
| 切换视频区域穿透 | `Ctrl+Alt+M` |
| 静音切换 | `Ctrl+Alt+S` |

均可在设置中自定义。

---

## 📄 许可证

[MIT](./LICENSE) © 2026 HuXing
