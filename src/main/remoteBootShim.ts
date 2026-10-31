import type { RemoteBootstrapPayload } from './remoteFrontendProxy'

export const REMOTE_FAVICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<rect width="32" height="32" rx="7" fill="#0b0e14"/>` +
  `<path d="M16 5L27 11.5L16 18L5 11.5Z" fill="#38bdf8"/>` +
  `<path d="M5 16.5L16 23L27 16.5" fill="none" stroke="#2563eb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M5 21.5L16 28L27 21.5" fill="none" stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`

/**
 * Bản shim ESM gọn nhẹ (~1.5 KB) thay thế `/@vite/client` (179 KB) cho các thiết bị Remote qua Wi-Fi LAN:
 * - Cung cấp đầy đủ 100% API `updateStyle`, `removeStyle`, `createHotContext`, `injectQuery`, `ErrorOverlay` cho Vite 7 & React Refresh.
 * - Triệt tiêu hoàn toàn lỗi WebSocket `wss://` chứng chỉ tự ký trên iOS Safari / Android WebView và chặn vòng lặp `location.reload()` gây màn hình đen.
 */
export function buildRemoteViteClientShim(): string {
  return `const sheetsMap = new Map();
let lastInsertedStyle;

export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}

class RemoteHMRContext {
  constructor(ownerPath) {
    this.ownerPath = ownerPath;
    this.data = {};
  }
  accept() {}
  acceptExports() {}
  dispose() {}
  prune() {}
  decline() {}
  invalidate() {}
  on() {}
  off() {}
  send() {}
}

export function createHotContext(ownerPath) {
  return new RemoteHMRContext(ownerPath);
}

export function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const u = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (u.search ? '&' + u.search.slice(1) : '') + u.hash;
}

export class ErrorOverlay extends HTMLElement {}
`
}

/**
 * Cắt bỏ inline base64 sourcemap khổng lồ ở cuối mỗi module Vite Dev (giảm ~80% dung lượng truyền qua Wi-Fi cho Điện thoại / iPad).
 */
export function stripInlineSourceMap(code: string): string {
  let out = code
  const jsIdx = out.lastIndexOf('//# sourceMappingURL=data:')
  if (jsIdx !== -1) {
    out = out.slice(0, jsIdx)
  }
  const cssIdx = out.lastIndexOf('/*# sourceMappingURL=data:')
  if (cssIdx !== -1) {
    out = out.slice(0, cssIdx)
  }
  return out
}

/**
 * Tạo script khởi động sớm trong `<head>` cho thiết bị Remote:
 * - Gắn `window.__PXS_REMOTE_BOOTSTRAP__`
 * - Bổ sung polyfill `crypto.randomUUID` (chuẩn RFC 4122 v4) cho ngữ cảnh HTTP LAN (`http://192.168.x.x`).
 */
export function buildRemoteBootHeadScript(bootstrap: RemoteBootstrapPayload): string {
  const safeJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c')
  return (
    `    <script>` +
    `window.__PXS_REMOTE_BOOTSTRAP__ = ${safeJson};` +
    `(function(){` +
    `if(typeof crypto!=='undefined'&&typeof crypto.randomUUID!=='function'){` +
    `crypto.randomUUID=function(){` +
    `var b=new Uint8Array(16);` +
    `if(crypto.getRandomValues)crypto.getRandomValues(b);else for(var i=0;i<16;i++)b[i]=(Math.random()*256)|0;` +
    `b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;` +
    `var h='';for(var j=0;j<16;j++)h+=(b[j]<16?'0':'')+b[j].toString(16);` +
    `return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);` +
    `};` +
    `}` +
    `})();` +
    `</script>\n`
  )
}

/**
 * Màn hình chờ Pre-React hiển thị tức thì (< 20ms) trên Điện thoại / iPad thay cho nền đen `#141414`,
 * tự động biến mất ngay khi `#root` dựng giao diện `.app`, kèm nút cứu hộ 1 chạm nếu trình quét QR chặn ES Module trên HTTPS tự ký.
 */
export function buildRemoteBootSplashHtml(): string {
  return (
    `<div id="pxs-remote-boot" style="position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#0b0e14;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;padding:20px;box-sizing:border-box">` +
    `<div style="max-width:320px;width:100%;background:#131822;border:1px solid #263042;border-radius:8px;padding:18px 16px;text-align:center;box-shadow:0 12px 32px rgba(0,0,0,0.45)">` +
    `<div style="font-size:13px;font-weight:700;color:#38bdf8;letter-spacing:0.02em">PARALLAX STUDIO</div>` +
    `<div id="pxs-boot-msg" style="font-size:12px;color:#94a3b8;margin-top:6px;line-height:1.45">Đang kết nối &amp; nạp giao diện Studio…</div>` +
    `<div style="height:4px;background:#1e2636;border-radius:3px;overflow:hidden;margin-top:12px">` +
    `<div style="width:55%;height:100%;background:linear-gradient(90deg,#2563eb,#38bdf8);border-radius:3px;animation:pxsBootBar 1.1s ease-in-out infinite alternate"></div>` +
    `</div>` +
    `<div id="pxs-boot-actions" style="display:none;margin-top:12px;gap:6px;flex-direction:column"></div>` +
    `</div>` +
    `<style>@keyframes pxsBootBar{0%{transform:translateX(-15%)}100%{transform:translateX(95%)}}</style>` +
    `<script>(function(){` +
    `var el=document.getElementById('pxs-remote-boot');` +
    `var root=document.getElementById('root');` +
    `if(!el||!root)return;` +
    `var done=false;` +
    `function hide(){if(done)return;if(root.children.length>0){done=true;el.remove();}}` +
    `var mo=new MutationObserver(hide);mo.observe(root,{childList:true});` +
    `var iv=setInterval(function(){hide();if(done)clearInterval(iv);},150);` +
    `function showFallback(reason){` +
    `if(done)return;` +
    `var msg=document.getElementById('pxs-boot-msg');` +
    `var act=document.getElementById('pxs-boot-actions');` +
    `if(msg)msg.textContent=reason||'Trình duyệt đang tải chậm hoặc chặn chứng chỉ tự ký. Hãy thử mở bằng HTTP Nhanh hoặc Safari/Chrome.';` +
    `if(act&&act.children.length===0){` +
    `act.style.display='flex';` +
    `if(location.protocol==='https:'){` +
    `var bHttp=document.createElement('a');` +
    `bHttp.href='http://'+location.host+location.pathname+location.search;` +
    `bHttp.textContent='🌐 Mở bằng HTTP Nhanh';` +
    `bHttp.style.cssText='display:block;padding:8px 10px;border-radius:5px;background:#2563eb;color:#fff;text-decoration:none;font-size:12px;font-weight:600';` +
    `act.appendChild(bHttp);` +
    `}` +
    `var bReload=document.createElement('button');` +
    `bReload.type='button';bReload.textContent='↻ Tải lại trang';` +
    `bReload.style.cssText='padding:7px 10px;border-radius:5px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:12px;font-weight:600;cursor:pointer';` +
    `bReload.onclick=function(){location.reload();};` +
    `act.appendChild(bReload);` +
    `}` +
    `}` +
    `window.addEventListener('error',function(e){` +
    `if(e&&e.target&&e.target.tagName==='SCRIPT'){showFallback('Trình quét QR chặn nạp ES Module trên chứng chỉ tự ký.');}` +
    `},true);` +
    `setTimeout(function(){if(!done)showFallback();},12000);` +
    `})();</script>` +
    `</div>`
  )
}
