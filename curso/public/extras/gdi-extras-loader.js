// ═══════════════════════════════════════════════════════════════
// gdi-extras-loader.js — Carregador dos módulos modularizados
// 
// Substitui o gdi-extras.js monolítico (358 KB) por 5 arquivos
// menores carregados em paralelo. Mantém 100% de compatibilidade:
// 
//   1. gdi-core.js   (47 KB)  — bootstrap + M1-M7 + M9 (materiais)
//   2. gdi-pdf.js    (5 KB)   — M17 (visualizador PDF)
//   3. gdi-ui.js     (65 KB)  — M10-M14, M16, M18-M20 (UI/UX)
//   4. gdi-meggy.js  (118 KB) — M9-ISA + M-AI (Meggy + OCR + flashcards)
//   5. gdi-study.js  (135 KB) — M22-M24, BlackTie, M-PLAYER-GUARD
// 
// Como usar no worker:
//   No lugar de servir gdi-extras.js, sirva ESTE loader (gdi-extras-loader.js).
//   Ele injeta os 5 <script> tags na página automaticamente.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  // ★★★ URL BASE DOS MÓDULOS ★★★
  // Repo: github.com/esaaraujo-lab/gdi_extras
  // Pasta: /modular/ (contém os 5 módulos + este loader)
  //
  // jsdelivr aceita 2 formatos de branch:
  //   @main                          (curto)
  //   @refs/heads/main               (longo, mais explícito)
  // Ambos funcionam. Usamos o formato curto para URL menor.
  const BASE_URL = 'https://raw.githubusercontent.com/esaaraujo-lab/gdi_extras/refs/heads/main/modular/';

  // ★ Cache-buster: muda quando você publicar nova versão dos módulos.
  // Isto é adicionado como ?v=N a cada URL para forçar jsdelivr+browser
  // a baixar a versão nova. Bump este número a cada publicação.
  const CACHE_VERSION = '1';

  // Ordem de carregamento (respeita dependências):
  //   1. gdi-core.js PRIMEIRO (define window.GDI_MODULES, Bus, showToast)
  //   2. os outros 4 em paralelo (cada IIFE é autônoma)
  const MODULES = [
    'gdi-core.js',     // obrigatoriamente primeiro
    'gdi-pdf.js',
    'gdi-ui.js',
    'gdi-meggy.js',
    'gdi-study.js'
  ];

  // Helper: monta URL com cache-buster
  function moduleUrl(name){
    return BASE_URL + name + '?v=' + CACHE_VERSION;
  }

  // Helper: carrega um script e retorna Promise
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

  // Estratégia: carrega gdi-core primeiro (sequencial), depois os 4 em paralelo
  async function bootstrap(){
    const t0 = performance.now();
    console.log('[GDI Loader] iniciando carga modular — BASE_URL:', BASE_URL);

    // 1. Carrega core (síncrono, precisa estar pronto antes dos outros)
    try{
      await loadScript(moduleUrl('gdi-core.js'), false);
      console.log('[GDI Loader] ✓ gdi-core.js carregado');
    }catch(e){
      console.error('[GDI Loader] FALHA CRÍTICA no core:', e.message);
      console.error('[GDI Loader] URL tentada:', moduleUrl('gdi-core.js'));
      console.error('[GDI Loader] Verifique se o repo gdi_extras existe e tem a pasta /modular/ com gdi-core.js');
      // Sem core, nada funciona — não tenta os outros
      return;
    }

    // 2. Carrega os 4 módulos restantes em paralelo
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
        console.warn('[GDI Loader] URL tentada:', moduleUrl(name));
      }
    });

    const t1 = performance.now();
    console.log(`[GDI Loader] carga completa em ${Math.round(t1-t0)}ms — ${ok} OK, ${fail} falhas`);

    // 3. Dispara evento "extras ready"
    try{
      window.dispatchEvent(new CustomEvent('gdi-extras-ready'));
    }catch(_){}
  }

  // Auto-inicia assim que o DOM estiver pronto
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootstrap, {once:true});
  }else{
    bootstrap();
  }

  // API pública para recarregar módulos (debug)
  window.gdiReloadExtras = bootstrap;
})();
