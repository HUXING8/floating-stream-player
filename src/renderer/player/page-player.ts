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
// 安装 MutationObserver 在 webview 内部自我修复（应对 Bilibili 等站点动态移除我们的类/样式）。
// 幂等，可反复调用。executeJavaScript 一定在 guest 主世界运行，不依赖 preload。
const DETECT_FILL_JS = `(function(){
  try {
    // 增强检测：查找所有 video（含 shadow DOM 和 iframe）
    var vids = Array.prototype.slice.call(document.querySelectorAll('video'));
    // 尝试检测常见 iframe（如 Bilibili 的播放器可能在 iframe 中）
    var iframes = document.querySelectorAll('iframe');
    for (var k=0; k<iframes.length; k++) {
      try {
        var ifDoc = iframes[k].contentDocument || iframes[k].contentWindow.document;
        if (ifDoc) {
          var ifVids = ifDoc.querySelectorAll('video');
          vids = vids.concat(Array.prototype.slice.call(ifVids));
        }
      } catch(e) { /* 跨域 iframe 忽略 */ }
    }

    // 选择"最佳视频"：优先 videoWidth>0 且未 paused 的，其次 videoWidth>0，最后 DOM 面积最大
    var best=null, score=-1;
    for (var i=0;i<vids.length;i++){
      var v=vids[i], r=v.getBoundingClientRect();
      var areaPx = v.videoWidth>0 ? v.videoWidth*v.videoHeight : r.width*r.height;
      // 加分：有真实分辨率 +1e10，正在播放 +1e9
      var s = areaPx + (v.videoWidth>0 ? 1e10 : 0) + (!v.paused ? 1e9 : 0);
      if (s>score){ score=s; best=v; }
    }

    if(!best) {
      console.log('[FSP] No video elements found, vids.length=' + vids.length);
      return {found:false, vids:vids.length};
    }

    // 详细调试日志（使用 JSON.stringify，避免 webview console-message 把对象序列化成 [object Object]）
    var bestComputed = window.getComputedStyle(best);
    console.log('[FSP] Best video: ' + JSON.stringify({
      readyState: best.readyState,
      videoWidth: best.videoWidth,
      videoHeight: best.videoHeight,
      paused: best.paused,
      src: (best.src || best.currentSrc || '').slice(0,80),
      tagName: best.tagName
    }));
    console.log('[FSP] Video computed style: ' + JSON.stringify({
      display: bestComputed.display,
      visibility: bestComputed.visibility,
      opacity: bestComputed.opacity,
      transform: bestComputed.transform,
      zIndex: bestComputed.zIndex,
      position: bestComputed.position,
      width: bestComputed.width,
      height: bestComputed.height,
      filter: bestComputed.filter,
      clipPath: bestComputed.clipPath
    }));
    var bestRect = best.getBoundingClientRect();
    console.log('[FSP] Video rect: ' + JSON.stringify({x:bestRect.left, y:bestRect.top, w:bestRect.width, h:bestRect.height}));
    console.log('[FSP] All videos: ' + JSON.stringify(vids.map(function(v,i){return i+': '+v.videoWidth+'x'+v.videoHeight+' paused='+v.paused+' src='+((v.src||v.currentSrc||'').slice(0,60));})));

    // 诊断：log 祖先链上的 compositor-affecting 属性，确认是哪个祖先把视频的 z-index/position 困在了它自己的 compositor layer 内
    if (!window.__fsp_ancestorsLogged) {
      window.__fsp_ancestorsLogged = true;
      try {
        console.log('[FSP] Logging ancestor compositor properties:');
        var ael = best.parentElement;
        var adepth = 0;
        while (ael && ael !== document.documentElement && adepth < 15) {
          var acs = window.getComputedStyle(ael);
          console.log('[FSP] Ancestor ' + adepth + ' ' + ael.tagName + '.' + (typeof ael.className === 'string' ? ael.className.slice(0,40) : '') + ': ' + JSON.stringify({
            transform: acs.transform,
            opacity: acs.opacity,
            filter: acs.filter,
            contain: acs.contain,
            isolation: acs.isolation,
            willChange: acs.willChange,
            clip: acs.clip,
            clipPath: acs.clipPath,
            overflow: acs.overflow,
            perspective: acs.perspective
          }));
          ael = ael.parentElement;
          adepth++;
        }
      } catch(e) { console.error('[FSP] Ancestor logging error: ' + String(e && e.message || e)); }
    }

    // 关键修复：把视频元素物理 reparent 到 <html>（documentElement）作为直接子节点，
    // 以摆脱所有祖先 compositor layer 的 clip region。z-index 不能跨 compositor layer。
    function reparentVideo(v) {
      // 已经 reparent 过：跳过
      if (v.dataset.fspReparented === '1') return;
      // 已经是 <html> 或 <body> 的直接子节点：仅标记
      if (v.parentElement === document.documentElement || v.parentElement === document.body) {
        v.dataset.fspReparented = '1';
        return;
      }
      try {
        var orig = {
          parent: v.parentElement,
          next: v.nextSibling
        };
        // 用 WeakMap 存原位置（DOM 引用不能放在 dataset）
        if (!window.__fsp_origLocation) window.__fsp_origLocation = new WeakMap();
        window.__fsp_origLocation.set(v, orig);
        // 移到 documentElement（脱离所有父级 compositor layer）
        document.documentElement.appendChild(v);
        v.dataset.fspReparented = '1';
        console.log('[FSP] Video reparented to documentElement to escape compositor layers');
      } catch(e) {
        console.error('[FSP] Reparent failed: ' + String(e && e.message || e));
      }
    }

    // 在应用样式之前 reparent 视频
    reparentVideo(best);

    // 定义"隐藏覆盖在视频上的元素"函数（用 elementsFromPoint 找）
    function hideOverlays() {
      try {
        var v = document.querySelector('video.__fsp_v');
        if (!v) return;
        // 视口中心点（视频已被铺满到整个视口）
        var cx = window.innerWidth/2, cy = window.innerHeight/2;
        var stack = document.elementsFromPoint(cx, cy) || [];
        var diag = [];
        for (var i=0; i<stack.length; i++) {
          var el = stack[i];
          if (el === v) break; // 到视频本身停止
          // 跳过根/body/我们自己的背景层/我们标记的祖先链/style 节点
          if (el === document.documentElement || el === document.body) continue;
          if (el.id === '__fsp_bg' || el.id === '__fsp_style') continue;
          if (el.classList && (el.classList.contains('__fsp_anc') || el.classList.contains('__fsp_hidden'))) continue;
          // 隐藏它
          diag.push((el.tagName||'?')+'#'+(el.id||'')+'.'+(String(el.className||'').slice(0,40)));
          if (!el.dataset.fspPrevDisplay) {
            el.dataset.fspPrevDisplay = el.style.display || '';
          }
          el.style.setProperty('display','none','important');
          el.classList.add('__fsp_hidden');
        }
        if (diag.length) console.log('[FSP] hideOverlays hid: ' + JSON.stringify(diag));
      } catch(e) { console.error('[FSP] hideOverlays error: ' + String(e && e.message || e)); }
    }

    // 激进策略：隐藏视频祖先链上的所有兄弟元素（保留 video 本身、被标记为 __fsp_anc 的祖先、以及我们注入的背景/样式节点）。
    // 这是"核选项"——保证没有任何元素能盖在视频上面。
    function hideSiblings() {
      try {
        var v = document.querySelector('video.__fsp_v');
        if (!v) return;
        var hiddenCount = 0;
        var el = v;
        while (el && el.parentElement && el !== document.documentElement) {
          var parent = el.parentElement;
          var children = parent.children;
          for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child === el) continue;
            if (child.id === '__fsp_bg' || child.id === '__fsp_style') continue;
            if (child.classList && child.classList.contains('__fsp_anc')) continue;
            if (child.classList && child.classList.contains('__fsp_v')) continue;
            if (child.dataset && child.dataset.fspSiblingHidden) continue;
            try {
              child.dataset.fspSiblingHidden = '1';
              child.dataset.fspPrevDisplay = child.style.display || '';
              child.style.setProperty('display', 'none', 'important');
              child.classList.add('__fsp_hidden');
              hiddenCount++;
            } catch(e){}
          }
          el = parent;
        }
        if (hiddenCount > 0) console.log('[FSP] hideSiblings hid count=' + hiddenCount);
      } catch(e) { console.error('[FSP] hideSiblings error: ' + String(e && e.message || e)); }
    }

    // 定义样式应用函数（供初次和 MutationObserver 自愈复用）
    function applyFSPStyles() {
      try {
        var SID='__fsp_style', BID='__fsp_bg';
        var st=document.getElementById(SID);
        if(!st){ st=document.createElement('style'); st.id=SID; document.documentElement.appendChild(st); }
        st.textContent='html.__fsp_on,html.__fsp_on body{overflow:hidden!important;margin:0!important;padding:0!important;background:#000!important;}'
          +'#'+BID+'{position:fixed!important;inset:0!important;background:#000!important;z-index:2147483646!important;pointer-events:none!important;}'
          +'.__fsp_anc{transform:none!important;filter:none!important;perspective:none!important;overflow:visible!important;clip-path:none!important;opacity:1!important;z-index:auto!important;}'
          +'video.__fsp_v{'
          +'position:fixed!important;'
          +'inset:0!important;'
          +'left:0!important;top:0!important;right:0!important;bottom:0!important;'
          +'width:100vw!important;'
          +'height:100vh!important;'
          +'max-width:none!important;'
          +'max-height:none!important;'
          +'min-width:0!important;'
          +'min-height:0!important;'
          +'margin:0!important;'
          +'padding:0!important;'
          +'object-fit:contain!important;'
          +'background:#000!important;'
          +'z-index:2147483647!important;'
          +'pointer-events:auto!important;'
          +'display:block!important;'
          +'visibility:visible!important;'
          +'opacity:1!important;'
          +'transform:none!important;'
          +'filter:none!important;'
          +'clip-path:none!important;'
          +'clip:auto!important;'
          +'-webkit-transform:none!important;'
          +'-webkit-filter:none!important;'
          +'-webkit-clip-path:none!important;'
          +'mix-blend-mode:normal!important;'
          +'isolation:auto!important;'
          +'mask:none!important;'
          +'-webkit-mask:none!important;'
          +'}'
          +'video:not(.__fsp_v){display:none!important;visibility:hidden!important;pointer-events:none!important;}'
          +'.bilibili-player-video-control-wrap,.bpx-player-control-wrap,.bpx-player-video-area .bpx-player-mask-wrap,.bpx-player-top-wrap,.bpx-player-sending-area,.bpx-player-dialog-wrap{display:none!important;pointer-events:none!important;}'
          // Bilibili 加载/海报/弹幕/遮罩等覆盖层（这些会盖在视频上造成"黑屏有声"）
          +'.bpx-player-loading-panel,'
          +'.bpx-player-loading-mask,'
          +'.bpx-state-loading,'
          +'.bpx-player-poster,'
          +'.bpx-player-poster-wrap,'
          +'.bpx-player-no-video,'
          +'.bpx-player-pbp-wrap,'
          +'.bpx-player-cmd-dm-wrap,'
          +'.bpx-player-row-dm-wrap,'
          +'.bpx-player-top-mask,'
          +'.bpx-player-bottom-mask,'
          +'.bpx-player-ending-related-wrap,'
          +'.bilibili-player-video-wrap-no-video,'
          +'.bilibili-player-video-poster,'
          +'.bilibili-player-video-popup,'
          +'.bilibili-player-loading-panel{'
          +'display:none!important;'
          +'visibility:hidden!important;'
          +'opacity:0!important;'
          +'pointer-events:none!important;'
          +'}';
        if(!document.getElementById(BID)){ var bg=document.createElement('div'); bg.id=BID; document.documentElement.appendChild(bg); }
        document.documentElement.classList.add('__fsp_on');

        // 找到当前最佳视频（首选已有 __fsp_v 标记的，否则用 best）
        var current = document.querySelector('video.__fsp_v') || best;
        if (current && !current.classList.contains('__fsp_v')) {
          current.classList.add('__fsp_v');
        }
        // 内联样式硬覆写：CSS class 在某些 SPA 下可能被站点 inline style 反超
        if (current) {
          var inlineProps = {
            'position':'fixed','left':'0','top':'0','right':'0','bottom':'0',
            'width':'100vw','height':'100vh',
            'max-width':'none','max-height':'none','min-width':'0','min-height':'0',
            'margin':'0','padding':'0','object-fit':'contain','background':'#000',
            'z-index':'2147483647','pointer-events':'auto',
            'display':'block','visibility':'visible','opacity':'1',
            'transform':'none','filter':'none','clip-path':'none','clip':'auto',
            '-webkit-transform':'none','-webkit-filter':'none','-webkit-clip-path':'none',
            'mix-blend-mode':'normal','isolation':'auto','mask':'none','-webkit-mask':'none'
          };
          for (var k in inlineProps) {
            try { current.style.setProperty(k, inlineProps[k], 'important'); } catch(e){}
          }
          // 移除可能让视频不可见的属性
          try { current.removeAttribute('hidden'); } catch(e){}
        }
        // 重新标记祖先链
        if (current) {
          var anc = document.querySelectorAll('.__fsp_anc');
          for (var i=0; i<anc.length; i++) anc[i].classList.remove('__fsp_anc');
          var el = current.parentElement;
          while(el && el!==document.body && el!==document.documentElement){
            el.classList.add('__fsp_anc');
            el = el.parentElement;
          }
        }

        // 隐藏覆盖在视频上的元素（解决黑屏有声）
        hideOverlays();
        // 激进兜底：隐藏视频祖先链上的所有兄弟元素，保证没有任何元素能盖住视频
        hideSiblings();
      } catch(e) { console.error('[FSP] applyFSPStyles error: ' + String(e && e.message || e)); }
    }

    // 应用一次
    applyFSPStyles();

    // 应用后再 log 一次中心点叠加情况（用于诊断"黑屏有声"）
    try {
      var afterCenter = document.elementsFromPoint(window.innerWidth/2, window.innerHeight/2) || [];
      console.log('[FSP] After-fix elements at center: ' + JSON.stringify(afterCenter.slice(0,8).map(function(e){
        return (e.tagName||'?')+'#'+(e.id||'')+'.'+(String(e.className||'').slice(0,40));
      })));
    } catch(e){}

    // 自动起播（仅真正第一次：用 dataset 标记，避免和 class 自愈耦合）
    var isFirstTime = !best.dataset.fspInit;
    if (isFirstTime) {
      best.dataset.fspInit = '1';
      if (best.paused) {
        console.log('[FSP] Auto-starting paused video (first time)');
        var p = best.play();
        if (p && p.catch) p.catch(function(){
          console.log('[FSP] Play failed, retrying muted');
          best.muted = true;
          var q = best.play();
          if (q && q.catch) q.catch(function(e){ console.log('[FSP] Muted play also failed: ' + String(e && e.message || e)); });
        });
      }
    }

    // 广告检测与跳过（YouTube + Bilibili）
    function skipAds() {
      try {
        // YouTube: 尝试所有已知的"跳过广告"按钮选择器
        var skipSelectors = [
          '.ytp-ad-skip-button-modern',
          '.ytp-ad-skip-button',
          '.ytp-skip-ad-button',
          '.ytp-ad-skip-button-container button',
          'button.ytp-ad-skip-button-modern',
          '.videoAdUiSkipButton'
        ];
        for (var i = 0; i < skipSelectors.length; i++) {
          var btn = document.querySelector(skipSelectors[i]);
          if (btn && btn.offsetParent !== null) {
            try {
              btn.click();
              console.log('[FSP] Clicked skip ad button: ' + skipSelectors[i]);
              return true;
            } catch(e) {}
          }
        }

        // 检测当前是否在播广告
        var adIndicators = [
          '.video-ads:not(:empty)',
          '.ytp-ad-player-overlay',
          '.ad-showing',
          '.ytp-ad-text',
          '.ytp-ad-preview-text'
        ];
        var adPlaying = false;
        for (var j = 0; j < adIndicators.length; j++) {
          var el = document.querySelector(adIndicators[j]);
          if (el && el.offsetParent !== null) {
            adPlaying = true;
            break;
          }
        }

        // 广告在播但跳过按钮还不可用 → 尝试快进到接近结尾
        if (adPlaying) {
          var v = document.querySelector('video.__fsp_v');
          if (v && v.duration && isFinite(v.duration) && v.duration < 60) {
            // duration<60s 大概率是广告，安全快进
            if (v.currentTime < v.duration - 1) {
              try {
                v.currentTime = v.duration - 0.1;
                console.log('[FSP] Fast-forwarded ad to: ' + v.currentTime);
                return true;
              } catch(e) {
                console.log('[FSP] Could not fast-forward ad: ' + String(e));
              }
            }
          }
        }

        // Bilibili 兜底
        var biliSkip = document.querySelector('.bilibili-player-video-btn-skip, .bpx-player-ad-skip');
        if (biliSkip && biliSkip.offsetParent !== null) {
          try { biliSkip.click(); return true; } catch(e) {}
        }

        return false;
      } catch(e) {
        console.error('[FSP] skipAds error: ' + String(e && e.message || e));
        return false;
      }
    }

    // 立刻执行一次广告跳过
    skipAds();

    // 修复点击进度条会短暂暂停的问题：seek 时若原本在播，seeked 后强制恢复播放
    if (!best.dataset.fspSeekHandler) {
      best.dataset.fspSeekHandler = '1';
      best.addEventListener('seeking', function() {
        best._fspWasPlaying = !best.paused;
      });
      best.addEventListener('seeked', function() {
        if (best._fspWasPlaying && best.paused) {
          var p = best.play();
          if (p && p.catch) p.catch(function(){});
        }
      });
    }

    // 开启浏览器原生控件
    try{ best.controls=true; }catch(e){}

    // 安装 MutationObserver 进行 in-page 自愈（仅安装一次）
    if (!window.__fsp_observer) {
      var refixTimer = null;
      function scheduleRefix(reason) {
        if (refixTimer) return;
        refixTimer = setTimeout(function(){
          refixTimer = null;
          console.log('[FSP] Re-applying styles, reason:', reason);
          applyFSPStyles();
        }, 500);
      }
      // 仅在我们的注入真正被破坏时才重新应用（不再对每次节点新增做触发，避免性能问题与暂停闪烁）
      // 周期性检查（1.2s）会兜底处理新增覆盖层
      var observer = new MutationObserver(function(mutations) {
        var needsRefix = false;
        var reason = '';

        // 快速预检：我们的视频是否还在并保持关键内联样式？
        var v = document.querySelector('video.__fsp_v');
        if (!v) {
          needsRefix = true;
          reason = 'video.__fsp_v missing';
        } else {
          var hasOurStyles = v.style.position === 'fixed' && v.style.zIndex === '2147483647';
          if (!hasOurStyles) {
            needsRefix = true;
            reason = 'video inline styles stripped';
          }
        }

        if (!needsRefix) {
          for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];

            // 我们的关键注入节点（style / bg）被从 documentElement 上移除
            if (m.type === 'childList' && m.target === document.documentElement) {
              for (var j = 0; j < m.removedNodes.length; j++) {
                var n = m.removedNodes[j];
                if (n && (n.id === '__fsp_style' || n.id === '__fsp_bg')) {
                  needsRefix = true;
                  reason = 'critical injected node removed';
                  break;
                }
              }
              if (needsRefix) break;
            }

            // 我们的视频的 class 被移除
            if (m.type === 'attributes' && m.attributeName === 'class' &&
                m.target.tagName === 'VIDEO' && !m.target.classList.contains('__fsp_v')) {
              if (m.target === v || v === null) {
                needsRefix = true;
                reason = 'video class stripped';
                break;
              }
            }

            // controls 属性被站点（如 YouTube）取消 → 立即恢复（无需触发完整 refix）
            if (m.type === 'attributes' && m.attributeName === 'controls' &&
                m.target.tagName === 'VIDEO' && m.target.classList.contains('__fsp_v')) {
              if (!m.target.controls) {
                try { m.target.controls = true; } catch(e) {}
              }
            }
          }
        }

        if (needsRefix) {
          scheduleRefix(reason);
        }
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class','style','hidden','controls'],
        subtree: true,
        childList: true
      });

      window.__fsp_observer = observer;

      // 周期性强制重应用（兜底，应对未触发 MutationObserver 的 SPA 重渲染）
      if (!window.__fsp_periodic) {
        window.__fsp_periodic = setInterval(function(){
          try {
            // 周期性尝试跳过广告（覆盖未触发 MutationObserver 的场景）
            skipAds();

            var v = document.querySelector('video.__fsp_v');
            if (!v) {
              console.log('[FSP-CHECK] video.__fsp_v MISSING - all videos count=' +
                document.querySelectorAll('video').length);
              applyFSPStyles();
              return;
            }
            // 恢复 controls（YouTube 等会周期性把它置回 false）
            if (!v.controls) {
              try { v.controls = true; } catch(e) {}
            }
            var rect = v.getBoundingClientRect();
            var cs = window.getComputedStyle(v);
            var topEl = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
            var topDesc = topEl
              ? ((topEl.tagName||'?') + '#' + (topEl.id||'') + '.' + (typeof topEl.className === 'string' ? topEl.className.slice(0,40) : ''))
              : 'null';
            console.log('[FSP-CHECK] ' + JSON.stringify({
              rect: {x: rect.x|0, y: rect.y|0, w: rect.width|0, h: rect.height|0},
              display: cs.display,
              visibility: cs.visibility,
              opacity: cs.opacity,
              zIndex: cs.zIndex,
              topElement: topDesc,
              isOurVideo: topEl === v,
              videoState: { paused: v.paused, readyState: v.readyState, w: v.videoWidth, h: v.videoHeight, currentTime: v.currentTime }
            }));

            // 校验视频是否仍被铺满
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
              console.log('[FSP-CHECK] Video hidden by computed style, re-applying');
              applyFSPStyles();
              return;
            }
            // 如果顶层元素不是我们的 video 且不是允许的背景层 → 强制隐藏遮挡元素
            if (topEl && topEl !== v && topEl.id !== '__fsp_bg') {
              try {
                topEl.style.setProperty('display','none','important');
                topEl.dataset.fspHiddenByCheck = '1';
                topEl.classList.add('__fsp_hidden');
                console.log('[FSP-CHECK] Force-hid blocking element: ' + topDesc);
              } catch(e){}
              applyFSPStyles();
            }
          } catch(e) { console.error('[FSP-CHECK] Error: ' + String(e && e.message || e)); }
        }, 1200);
      }
      console.log('[FSP] MutationObserver installed');
    }

    return {found: true, vids:vids.length, w:best.videoWidth, h:best.videoHeight};
  } catch(e){
    console.error('[FSP] Error: ' + String(e && e.message || e));
    return {found:false, error:String(e)};
  }
})()`

// 还原：断开 observer、移除铺满样式、关掉原生控件，显示完整网页。
const REMOVE_FILL_JS = `(function(){
  try{
    if (window.__fsp_observer) {
      window.__fsp_observer.disconnect();
      window.__fsp_observer = null;
    }
    if (window.__fsp_periodic) {
      clearInterval(window.__fsp_periodic);
      window.__fsp_periodic = null;
    }
    document.documentElement.classList.remove('__fsp_on');
    var bg=document.getElementById('__fsp_bg'); if(bg) bg.remove();
    var st=document.getElementById('__fsp_style'); if(st) st.remove();
    var anc=document.querySelectorAll('.__fsp_anc'); for(var i=0;i<anc.length;i++) anc[i].classList.remove('__fsp_anc');
    // 还原被 hideOverlays/hideSiblings 隐藏的元素（含 data-fsp-sibling-hidden）
    var hidden=document.querySelectorAll('.__fsp_hidden, [data-fsp-sibling-hidden]');
    for(var i=0;i<hidden.length;i++){
      var el=hidden[i];
      try {
        if (el.dataset && 'fspPrevDisplay' in el.dataset) {
          if (el.dataset.fspPrevDisplay) {
            el.style.display = el.dataset.fspPrevDisplay;
          } else {
            el.style.removeProperty('display');
          }
          delete el.dataset.fspPrevDisplay;
        } else {
          el.style.removeProperty('display');
        }
        if (el.dataset && el.dataset.fspSiblingHidden) {
          delete el.dataset.fspSiblingHidden;
        }
        if (el.dataset && el.dataset.fspHiddenByCheck) {
          delete el.dataset.fspHiddenByCheck;
        }
      } catch(e){}
      el.classList.remove('__fsp_hidden');
    }
    var fv=document.querySelector('video.__fsp_v');
    if(fv){
      fv.classList.remove('__fsp_v');
      fv.controls=false;
      delete fv.dataset.fspInit;
      // 清理我们注入的 inline style 属性
      var props=['position','left','top','right','bottom','width','height','max-width','max-height',
        'min-width','min-height','margin','padding','object-fit','background','z-index','pointer-events',
        'display','visibility','opacity','transform','filter','clip-path','clip',
        '-webkit-transform','-webkit-filter','-webkit-clip-path','mix-blend-mode','isolation','mask','-webkit-mask'];
      for (var j=0;j<props.length;j++){ try { fv.style.removeProperty(props[j]); } catch(e){} }
    }
    // 还原 reparent 的视频元素到原位置
    var reparentedVids = document.querySelectorAll('video[data-fsp-reparented]');
    for (var ri=0; ri<reparentedVids.length; ri++) {
      var rv = reparentedVids[ri];
      var origLoc = window.__fsp_origLocation && window.__fsp_origLocation.get(rv);
      if (origLoc && origLoc.parent && document.contains(origLoc.parent)) {
        try {
          if (origLoc.next && origLoc.next.parentNode === origLoc.parent) {
            origLoc.parent.insertBefore(rv, origLoc.next);
          } else {
            origLoc.parent.appendChild(rv);
          }
        } catch(e){}
      }
      try { delete rv.dataset.fspReparented; } catch(e){}
    }
    if (window.__fsp_origLocation) window.__fsp_origLocation = null;
    if (window.__fsp_ancestorsLogged) window.__fsp_ancestorsLogged = false;
    var any=document.querySelector('video');
    return {found: !!(any && any.videoWidth>0)};
  }catch(e){ return {found:false, error:String(e)}; }
})()`

/**
 * 平台页面播放：webview 加载页面，宿主仅在初次检测时注入一次"检测+起播+铺满"代码。
 * 注入后由 webview 内的 MutationObserver 自愈，宿主不再轮询。
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

    // 把 webview 内部 console 输出转发到宿主 console + 主进程终端，方便在 `npm run dev` 里直接看到 [FSP] 日志
    wv.addEventListener('console-message', (e: { level: number; message: string }) => {
      const line = `[webview:${e.level}] ${e.message}`
      console.log(line)
      try {
        window.playerApi?.log?.(line)
      } catch {
        /* ignore */
      }
    })

    wv.addEventListener('dom-ready', () => {
      this.domReady = true
      this.onStatus('detecting', '页面加载中…')
      // 开发模式自动打开 webview 的 DevTools，方便看 [FSP] 日志 / DOM
      if (import.meta.env.DEV) {
        try {
          wv.openDevTools()
        } catch {
          /* ignore */
        }
      }
      // 初始轮询：仅用于"检测到视频之前"。一旦检测到，停止轮询，由 in-page observer 自愈。
      if (this.poll == null) this.poll = window.setInterval(() => this.tick(), 500)
      this.tick()
    })
    wv.addEventListener('did-fail-load', (event: { errorCode: number; isMainFrame?: boolean }) => {
      // 仅当主帧加载失败时上报错误。
      // 子帧（iframe、第三方挂件，如爱奇艺加载的微信小游戏 SDK）失败不影响主视频播放。
      if (event.isMainFrame === false) {
        return
      }
      // 忽略某些非关键错误码：-3 (ABORTED) 在正常导航过程中也会触发
      if (event.errorCode === -3) {
        return
      }
      this.onStatus('error', '页面加载失败')
    })

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
    if (on) {
      // 切回 pure：重置 gotVideo 让 tick 再次注入；observer 安装后自愈
      this.gotVideo = false
      if (this.poll == null) this.poll = window.setInterval(() => this.tick(), 500)
      this.tick()
    } else {
      // 切到导航模式：移除铺满样式并断开 observer
      void this.webview.executeJavaScript(REMOVE_FILL_JS).catch(() => {})
      // 停止轮询，避免和导航模式冲突
      if (this.poll) {
        clearInterval(this.poll)
        this.poll = null
      }
    }
  }

  private tick(): void {
    if (!this.webview || !this.domReady) return
    this.doInject()
  }

  private doInject(): void {
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

          if (res.w && res.w > 0 && this.pureVideo) {
            this.onStatus('playing')
            // 视频已就位且 observer 已安装：停止宿主轮询，由 in-page observer 自愈
            if (this.poll) {
              console.log('[FSP] Video confirmed, stopping host polling (in-page observer handles self-healing)')
              clearInterval(this.poll)
              this.poll = null
            }
          } else {
            this.onStatus('detecting', `视频元素已就位，等待内容加载…`)
          }

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
