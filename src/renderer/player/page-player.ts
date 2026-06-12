import type { SourceStatus } from '@shared/ipc'

type StatusFn = (status: SourceStatus, message?: string) => void

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

interface DetectResult {
  found: boolean
  vids?: number
  w?: number
  h?: number
  error?: string
}

// 注入到 webview 主世界执行：找主视频→自动起播→把视频提升铺满视口（中和祖先层叠陷阱）→返回状态。
// 幂等，可反复调用。executeJavaScript 一定在 guest 主世界运行，不依赖 preload。
const DETECT_FILL_JS = `(function(){
  try {
    var vids = Array.prototype.slice.call(document.querySelectorAll('video'));
    var best=null, score=-1;
    for (var i=0;i<vids.length;i++){
      var v=vids[i], r=v.getBoundingClientRect();
      var s = v.videoWidth>0 ? v.videoWidth*v.videoHeight : r.width*r.height;
      if (s>score){ score=s; best=v; }
    }
    if(!best) return {found:false, vids:vids.length};
    if(best.paused){ var p=best.play(); if(p&&p.catch) p.catch(function(){ best.muted=true; var q=best.play(); if(q&&q.catch) q.catch(function(){}); }); }
    // 自动点击“跳过广告”（YouTube）；可跳广告出现 5 秒后即自动跳过
    var sk=document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-container button');
    if(sk){ try{ sk.click(); }catch(e){} }
    // 开启浏览器原生控件：进度条 / 暂停 / 音量（每次注入都重设，防止站点清掉）
    try{ best.controls=true; }catch(e){}
    var SID='__fsp_style', BID='__fsp_bg';
    var st=document.getElementById(SID);
    if(!st){ st=document.createElement('style'); st.id=SID; document.documentElement.appendChild(st); }
    st.textContent='html.__fsp_on,html.__fsp_on body{overflow:hidden!important;margin:0!important;padding:0!important;background:#000!important;}'
      +'#'+BID+'{position:fixed!important;inset:0!important;background:#000!important;z-index:2147483646!important;}'
      +'.__fsp_anc{transform:none!important;filter:none!important;perspective:none!important;overflow:visible!important;clip-path:none!important;opacity:1!important;z-index:auto!important;}'
      +'video.__fsp_v{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;object-fit:contain!important;background:#000!important;z-index:2147483647!important;}';
    if(!document.getElementById(BID)){ var bg=document.createElement('div'); bg.id=BID; document.documentElement.appendChild(bg); }
    document.documentElement.classList.add('__fsp_on');
    var prevAnc=document.querySelectorAll('.__fsp_anc');
    for (var j=0;j<prevAnc.length;j++) prevAnc[j].classList.remove('__fsp_anc');
    var el=best.parentElement;
    while(el && el!==document.body && el!==document.documentElement){ el.classList.add('__fsp_anc'); el=el.parentElement; }
    var prevV=document.querySelector('video.__fsp_v');
    if(prevV && prevV!==best) prevV.classList.remove('__fsp_v');
    best.classList.add('__fsp_v');
    return {found: best.videoWidth>0, vids:vids.length, w:best.videoWidth, h:best.videoHeight};
  } catch(e){ return {found:false, error:String(e)}; }
})()`

// 还原：移除铺满样式、关掉原生控件，显示完整网页（用于站点自带清晰度/广告等功能）
const REMOVE_FILL_JS = `(function(){
  try{
    document.documentElement.classList.remove('__fsp_on');
    var bg=document.getElementById('__fsp_bg'); if(bg) bg.remove();
    var anc=document.querySelectorAll('.__fsp_anc'); for(var i=0;i<anc.length;i++) anc[i].classList.remove('__fsp_anc');
    var fv=document.querySelector('video.__fsp_v'); if(fv){ fv.classList.remove('__fsp_v'); fv.controls=false; }
    var any=document.querySelector('video');
    return {found: !!(any && any.videoWidth>0)};
  }catch(e){ return {found:false, error:String(e)}; }
})()`

/**
 * 平台页面播放：webview 加载页面，宿主用 executeJavaScript 轮询注入“检测+起播+铺满”代码，
 * 使 webview 里只显示视频本身（纯视频 + 黑边）。不依赖 webview preload。
 */
export class PagePlayer {
  private webview: any = null
  private domReady = false
  private gotVideo = false
  private pureVideo = true
  private poll: number | null = null
  private watchdog: number | null = null
  private lastAudio: { muted: boolean; volume: number } = { muted: false, volume: 0.8 }

  constructor(
    private readonly container: HTMLElement,
    private readonly preloadUrl: string,
    private readonly onStatus: StatusFn
  ) {
    void this.preloadUrl // 兼容旧签名，当前实现不依赖 preload
  }

  load(url: string): void {
    this.stop()
    const wv: any = document.createElement('webview')
    wv.setAttribute('partition', 'persist:player') // 与登录窗口共享会话
    wv.setAttribute('allowpopups', 'false')
    wv.setAttribute('useragent', CHROME_UA)
    wv.setAttribute('webpreferences', 'backgroundThrottling=false')
    wv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;'
    wv.src = url

    wv.addEventListener('dom-ready', () => {
      this.domReady = true
      this.onStatus('detecting', '页面加载中…')
      if (this.poll == null) this.poll = window.setInterval(() => this.tick(), 700)
      this.tick()
    })
    wv.addEventListener('did-fail-load', () => this.onStatus('error', '页面加载失败'))

    this.container.appendChild(wv)
    this.webview = wv

    this.watchdog = window.setTimeout(() => {
      if (!this.gotVideo) {
        this.onStatus(
          'error',
          '未检测到视频（可能尚未起播或需登录）。需登录的站点请点「登录」登录后重试。'
        )
      }
    }, 14000)
  }

  setPureVideo(on: boolean): void {
    this.pureVideo = on
    if (!this.webview || !this.domReady) return
    if (on) this.tick()
    else void this.webview.executeJavaScript(REMOVE_FILL_JS).catch(() => {})
  }

  private tick(): void {
    if (!this.webview || !this.domReady) return
    this.webview
      .executeJavaScript(this.pureVideo ? DETECT_FILL_JS : REMOVE_FILL_JS)
      .then((res: DetectResult) => {
        if (res && res.found) {
          const first = !this.gotVideo
          this.gotVideo = true
          if (this.watchdog) {
            clearTimeout(this.watchdog)
            this.watchdog = null
          }
          this.onStatus('playing')
          if (first) this.applyAudio(this.lastAudio.muted, this.lastAudio.volume)
        } else if (!this.gotVideo) {
          const detail = res?.error
            ? `注入出错：${res.error}`
            : `已注入，页面 video 数=${res?.vids ?? 0}，等待起播…`
          this.onStatus('detecting', `诊断：${detail}`)
        }
      })
      .catch((e: Error) => {
        if (!this.gotVideo) this.onStatus('detecting', `诊断：执行注入失败 ${e.message}`)
      })
  }

  applyAudio(muted: boolean, volume: number): void {
    this.lastAudio = { muted, volume }
    if (!this.webview || !this.domReady) return
    const code = `(()=>{const v=document.querySelector('video'); if(v){v.muted=${muted};v.volume=${volume};}})()`
    try {
      void this.webview.executeJavaScript(code)
    } catch {
      /* ignore */
    }
  }

  setPaused(paused: boolean): void {
    if (!this.webview || !this.domReady) return
    const action = paused ? 'pause' : 'play'
    const code = `(()=>{const v=document.querySelector('video'); if(v) v.${action}();})()`
    try {
      void this.webview.executeJavaScript(code)
    } catch {
      /* ignore */
    }
  }

  reload(): void {
    if (this.webview) {
      this.domReady = false
      this.gotVideo = false
      this.webview.reload()
    }
  }

  stop(): void {
    if (this.poll) {
      clearInterval(this.poll)
      this.poll = null
    }
    if (this.watchdog) {
      clearTimeout(this.watchdog)
      this.watchdog = null
    }
    this.domReady = false
    this.gotVideo = false
    if (this.webview) {
      this.webview.remove()
      this.webview = null
    }
  }
}
