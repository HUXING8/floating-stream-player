export type SourceKind = 'direct' | 'page'

// 直链媒体扩展名：命中即按直链处理，否则视为平台页面地址。
const DIRECT_EXT = /\.(m3u8|flv|mp4|webm|ogg|ogv|mov|m4v|ts)(\?|#|$)/i

export function resolveKind(url: string): SourceKind {
  try {
    const u = new URL(url)
    if (DIRECT_EXT.test(u.pathname)) return 'direct'
  } catch {
    // 非合法 URL，交给页面播放器尝试
  }
  return 'page'
}
