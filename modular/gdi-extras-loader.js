// ═══════════════════════════════════════════════════════════════
// gdi-extras-loader.js — Carregador dos módulos modularizados
//
// Substitui o gdi-extras.js monolítico por 5 arquivos menores
// carregados em paralelo. Mantém 100% de compatibilidade.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  // ★★★ URL BASE DOS MÓDULOS ★★★
  // Repo: github.com/esaaraujo-lab/gdi_extras
  // Pasta: /modular/ (contém os 5 módulos + este loader)
  const BASE_URL = 'https://raw.githubusercontent.com/esaaraujo-lab/gdi_extras/refs/heads/main/modular/';

  // ★ Cache-buster: bump este número a cada publicação para forçar refresh
  const CACHE_VERSION = '3';

  const MODULES = [
    'gdi-core.js',     // obrigatoriamente primeiro
    'gdi-pdf.js',
    'gdi-ui.js',
    'gdi-meggy.js',
    'gdi-study.js'
  ];

  function moduleUrl(name){
    return BASE_URL + name + '?v=' + CACHE_VERSION;
  }

  function loadScript(url, isAsync){
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = url;
      s.type = 'text/javascript';
      s.crossOrigin = 'anonymous';
      if(isAsync){
        s.async = true;
        s.defer = true;
      }
      s.onload = ()=>resolve(url);
      s.onerror = ()=>{
        console.error('[GDI Loader] Falha ao carregar:', url);
        reject(new Error('Failed: ' + url));
      };
      document.head.appendChild(s);
    });
  }

  async function bootstrap(){
    const t0 = performance.now();
    console.log('[GDI Loader] iniciando carga modular — BASE_URL:', BASE_URL);

    try{
      await loadScript(moduleUrl('gdi-core.js'), false);
      console.log('[GDI Loader] ✓ gdi-core.js carregado');
    }catch(e){
      console.error('[GDI Loader] FALHA CRÍTICA no core:', e.message);
      console.error('[GDI Loader] URL tentada:', moduleUrl('gdi-core.js'));
      return;
    }

    const others = MODULES.slice(1);
    const results = await Promise.allSettled(
      others.map(m => loadScript(moduleUrl(m), true))
    );

    let ok = 0, fail = 0;
    results.forEach((r, i) => {
      const name = others[i];
      if(r.status === 'fulfilled'){
        ok++;
        console.log('[GDI Loader] ✓', name);
      }else{
        fail++;
        console.warn('[GDI Loader] ✗', name, '—', r.reason.message);
      }
    });

    const t1 = performance.now();
    console.log(`[GDI Loader] carga completa em ${Math.round(t1-t0)}ms — ${ok} OK, ${fail} falhas`);

    try{
      window.dispatchEvent(new CustomEvent('gdi-extras-ready'));
    }catch(_){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootstrap, {once:true});
  }else{
    bootstrap();
  }

  window.gdiReloadExtras = bootstrap;
})();
