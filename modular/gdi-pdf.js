// ═══════════════════════════════════════════════════════════════
// gdi-pdf.js — M17: Visualizador de PDF (pdf.js)
// 
// Renderiza PDFs no navegador usando pdf.js (canvas). Suporte
// mobile aprimorado: escala automática à largura da tela, scroll
// touch, controles responsivos. Substitui o file_pdf default do
// app.min.js por uma versão otimizada.
//
// Depende de: gdi-core.js (escHtml, Os, renderDownloadButtons)
// ═══════════════════════════════════════════════════════════════

// ═══ M17: VISUALIZADOR DE PDF (pdf.js) — com suporte mobile aprimorado ═══
// ★FIX Android: quando o usuário clica num PDF na lista de arquivos (não na
// aba de materiais), o file_pdf é chamado. Em desktop, renderiza canvas.
// Em mobile, mantém o mesmo canvas (já é melhor que iframe que baixa o PDF),
// mas com viewport scrollable e zoom otimizado para touch.
(function(){
  window.file_pdf = function(i,e,t,n,a,c){
    const isMobile=Os.isMobile;
    const controlsStyle=isMobile
      ? 'flex-wrap:wrap;gap:8px;padding:8px;justify-content:center;'
      : '';
    const l=`<div class="gdi-wrap">
  <div class="gdi-viewer">
    <div class="gdi-breadcrumb-wrap"><ol class="gdi-bc">${_viewerBreadcrumb()}</ol></div>
    <div class="gdi-viewer-card">
      <div class="gdi-file-header">
        <span class="gdi-file-header-icon"><i class="bi bi-file-earmark-pdf-fill gdi-icon-pdf"></i></span>
        <div class="gdi-file-header-info">
          <div class="gdi-file-header-name">${escHtml(i)}</div>
          <div class="gdi-file-header-meta">${escHtml(t)}</div>
        </div>
      </div>
      <div class="gdi-viewer-body no-pad">
        <div class="gdi-pdf-controls" style="${controlsStyle}">
          <button id="pdf-prev" class="gdi-btn gdi-btn-ghost gdi-btn-icon"><i class="bi bi-chevron-left"></i></button>
          <span style="font-size:13px;color:var(--gdi-text-muted);">Pág <span id="pdf-page-num">1</span> / <span id="pdf-page-count">?</span></span>
          <button id="pdf-next" class="gdi-btn gdi-btn-ghost gdi-btn-icon"><i class="bi bi-chevron-right"></i></button>
          <input id="pdf-zoom" type="range" min="50" max="200" value="${isMobile?100:100}" style="width:${isMobile?80:100}px;" title="Zoom">
          <span id="pdf-zoom-val">100%</span>
        </div>
        <div style="padding:16px;${isMobile?'overflow-y:auto;-webkit-overflow-scrolling:touch;':''}">
          <div id="pdf-spinner" class="gdi-spinner-wrap"><div class="gdi-spinner"></div></div>
          <canvas id="pdf-canvas" style="max-width:100%;display:block;margin:auto;background:#525659;border-radius:4px;"></canvas>
        </div>
      </div>
      <div class="gdi-viewer-footer">${renderDownloadButtons(n,e)}</div>
    </div>
  </div>
</div>`;
    // ★ Vanilla DOM (sem jQuery) — drops 30KB do bundle inicial
    const contentEl=document.getElementById('content');
    if(contentEl)contentEl.innerHTML=l;
    let d=null,o=1,s=1;
    function r(){
      const p=document.getElementById("pdf-canvas"),g=p.getContext("2d");
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      function showSpinner(){
        const s=document.getElementById("pdf-spinner");
        if(s)s.style.display='';
      }
      function hideSpinner(){
        const s=document.getElementById("pdf-spinner");
        if(s)s.style.display='none';
      }
      function setSpinnerHTML(html){
        const s=document.getElementById("pdf-spinner");
        if(s)s.innerHTML=html;
      }
      function f(u){
        // ★ mobile: ajusta escala automaticamente à largura do container
        const containerW=p.parentElement.clientWidth-32;
        let scale=s;
        return d.getPage(u).then(function(h){
          const testVp=h.getViewport({scale:1});
          if(isMobile&&testVp.width>containerW){
            scale=containerW/testVp.width*s;
          }
          const m=h.getViewport({scale});
          p.height=m.height,p.width=m.width,
          h.render({canvasContext:g,viewport:m}).promise.then(function(){
            hideSpinner();
          }),
          document.getElementById("pdf-page-num").textContent=u;
        });
      }
      pdfjsLib.getDocument(n).promise.then(function(u){
        d=u,document.getElementById("pdf-page-count").textContent=u.numPages,f(o);
      }).catch(function(u){
        setSpinnerHTML(`<div class="gdi-alert gdi-alert-error">Could not load PDF: ${u.message}</div>`);
      }),
      document.getElementById("pdf-prev").addEventListener("click",function(){if(o>1){o--;showSpinner();f(o);}}),
      document.getElementById("pdf-next").addEventListener("click",function(){if(d&&o<d.numPages){o++;showSpinner();f(o);}});
      // ★ debounce no zoom (evita re-render a cada pixel do slider)
      let _zoomTimer=null;
      document.getElementById("pdf-zoom").addEventListener("input",function(){
        s=parseInt(this.value)/100;
        document.getElementById("pdf-zoom-val").textContent=this.value+"%";
        if(_zoomTimer)clearTimeout(_zoomTimer);
        _zoomTimer=setTimeout(()=>{f(o);_zoomTimer=null;},150);
      });
    }
    // ★ Fix: typeof pdfjsLib === 'undefined' (antes era <"u", ilegível)
    if(typeof pdfjsLib==='undefined'){
      const p=document.createElement("script");
      p.src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
      p.onload=r;
      p.onerror=function(){setSpinnerHTML_safe();};
      function setSpinnerHTML_safe(){
        const s=document.getElementById("pdf-spinner");
        if(s)s.innerHTML='<div class="gdi-alert gdi-alert-error">Failed to load PDF viewer.</div>';
      }
      document.head.appendChild(p);
    }else{
      r();
    }
  };
})();
