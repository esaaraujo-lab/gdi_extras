/* ═══════════════════════════════════════════════════════════════
   gdi-extras.js v2.6-fix — COMPLETO
   ★FIX PRINCIPAL (o travamento de verdade): o M20 tinha um
     MutationObserver observando a própria lista que ele reescrevia.
     Quando o render demorava >150ms (playlists grandes), o observer
     se auto-disparava INFINITAMENTE: render → mutação → observer →
     render → … A main thread ficava presa para sempre — por isso o
     "Aguardar ou fechar" do Chrome nunca resolvia. O observer foi
     REMOVIDO; a playlist agora re-renderiza só via Bus.
   Outras correções: teto de 600 itens + 1 listener delegado (M20),
     listeners globais fora do init (M10/M6), observer do M14
     desconectado ao trocar de página, M9 não reconstrói na mesma
     aula, M7 só toca no DOM quando muda, M22 limita cursos.
   ═══════════════════════════════════════════════════════════════ */
console.log('[GDI Extras Modular] v2.6-fix carregado');
const GDI_ROOT=()=>document.documentElement; // UI flutuante vive aqui (fora do body)

window.GDI_MODULES = window.GDI_MODULES || [];

// ── CSS dos módulos (injetado 1×) ──
(function(){if(document.getElementById('gdi-extras-style'))return;const s=document.createElement('style');s.id='gdi-extras-style';s.textContent=`
.gdi-debug-wrap{width:100%;background:#0d1117;border-top:2px solid #f0883e;font-family:monospace;font-size:12px;}
.gdi-debug-head{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#161b22;cursor:pointer;user-select:none;color:var(--ferreto-text-muted,#8b949e);}
.gdi-debug-head:hover{background:#1c2128;}
.gdi-debug-head strong{color:#f0f6fc;display:flex;align-items:center;gap:6px;}
.gdi-dbg-count{background:#1f6feb;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px;}
.gdi-debug-actions{display:flex;gap:8px;}
.gdi-debug-actions button{background:none;border:1px solid #30363d;color:var(--ferreto-text-muted,#8b949e);border-radius:4px;padding:2px 9px;cursor:pointer;font-size:11px;}
.gdi-debug-actions button:hover{background:#1c2128;color:#f0f6fc;}
#gdi-debug-log{max-height:300px;overflow-y:auto;padding:10px 14px;background:#0d1117;color:var(--ferreto-text,#e6edf3);}
#gdi-debug-log.collapsed{display:none;}
.gdi-dbg-entry{padding:3px 0;border-bottom:1px solid #21262d;line-height:1.6;}
.gdi-dbg-ts{color:#484f58;margin-right:6px;}
.gdi-dbg-badge{font-weight:bold;margin-right:6px;}
.gdi-dbg-msg{color:var(--ferreto-text,#e6edf3);}
.gdi-dbg-pre{margin:2px 0 2px 20px;padding:4px 8px;background:#161b22;border-left:2px solid #30363d;white-space:pre-wrap;word-break:break-all;color:var(--ferreto-text-muted,#8b949e);font-size:11px;}
.gdi-dbg-empty{color:#484f58;}
.gdi-mat-head{display:flex;align-items:center;justify-content:space-between;font-size:14px;color:var(--ferreto-text,#e6edf3);}
.gdi-mat-head strong{display:flex;align-items:center;gap:6px;}
#gdi-mat-status{font-size:11px;color:var(--ferreto-text-muted,#8b949e);}
.gdi-mat-tabs{display:flex;flex-wrap:wrap;gap:6px;}
.gdi-mat-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  min-width:74px;padding:7px 8px;border-radius:10px;cursor:pointer;user-select:none;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#c9d1d9;transition:all .15s;}
.gdi-mat-tab i{font-size:20px;}
.gdi-mat-tab span{font-size:10px;font-weight:600;letter-spacing:.02em;}
.gdi-mat-tab:hover{background:rgba(255,255,255,.13);color:#fff;}
.gdi-mat-tab.active{background:var(--bs-primary,#1f6feb);border-color:var(--bs-primary,#1f6feb);color:#fff;}
.gdi-mat-body{height:calc(100dvh - 250px);min-height:420px;border:1px solid rgba(255,255,255,.12);
  border-radius:12px;overflow:hidden;background:#161b22;position:relative;}
body.gdi-fm .gdi-mat-body{height:calc(100dvh - 180px);min-height:480px;}
.gdi-notes{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;background:rgba(0,0,0,.18);}
.gdi-notes-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--ferreto-text,#e6edf3);margin-bottom:6px;flex-wrap:wrap;gap:6px;}
#gdi-note-input{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:8px;
  color:var(--ferreto-text,#e6edf3);padding:8px;font-size:13px;resize:vertical;min-height:44px;}
.gdi-notes-actions{display:flex;align-items:center;gap:8px;margin-top:6px;}
#gdi-note-time{font-size:11px;color:var(--ferreto-primary,#7aa2ff);font-variant-numeric:tabular-nums;cursor:pointer;}
#gdi-note-save{margin-left:auto;background:var(--bs-primary,#1f6feb);border:0;color:#fff;border-radius:7px;
  padding:5px 12px;font-size:12px;cursor:pointer;}
#gdi-notes-list{margin-top:8px;max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;}
.gdi-note{display:flex;gap:8px;align-items:flex-start;background:rgba(255,255,255,.05);border-radius:8px;padding:6px 8px;font-size:12px;}
.gdi-note-time{color:var(--ferreto-primary,#7aa2ff);cursor:pointer;white-space:nowrap;font-variant-numeric:tabular-nums;font-size:11px;margin-top:2px;}
.gdi-note-text{flex:1;color:var(--ferreto-text,#e6edf3);word-break:break-word;}
.gdi-note-del{background:none;border:0;color:var(--ferreto-text-muted,#8b949e);cursor:pointer;font-size:13px;padding:0 2px;}
.gdi-note-del:hover{color:#ff6b6b;}
.gdi-notes-empty{color:var(--ferreto-text-muted,#8b949e);font-size:12px;text-align:center;padding:6px;}
/* ★ Pomodoro agora é botão na navbar — fab flutuante removido */
#gdi-pom-root{display:none!important;}
#gdi-sleep-btn{opacity:.8;transition:opacity .25s ease;}
#gdi-sleep-btn:hover{opacity:1;}
#gdi-note-marks{position:relative;height:16px;margin-top:4px;cursor:pointer;display:none;}
.gdi-note-mark{position:absolute;top:3px;width:10px;height:10px;border-radius:50%;background:#7aa2ff;
  border:2px solid #0b0e14;transform:translateX(-50%);transition:transform .12s,background .12s;}
.gdi-note-mark:hover{background:#ffd43b;transform:translateX(-50%) scale(1.35);}
#gdi-progress-line{margin-top:6px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ferreto-text-muted,#8b949e);flex-wrap:wrap;}
#gdi-home-card{animation:gdi-card-in .3s ease;}
@keyframes gdi-card-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.gdi-player-wrap{position:relative;}
#gdi-skip-intro{position:absolute;right:14px;bottom:64px;z-index:20;background:rgba(13,15,20,.92);
  border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:8px;padding:8px 14px;font-size:13px;
  cursor:pointer;display:none;box-shadow:0 6px 20px rgba(0,0,0,.5);}
#gdi-skip-intro:hover{background:rgba(45,50,62,.95);}
.gdi-modprog{margin-left:8px;font-size:11px;color:var(--ferreto-text-muted,#8b949e);background:rgba(255,255,255,.06);
  border-radius:6px;padding:2px 8px;white-space:nowrap;}
.gdi-modprog b{color:#8ab4ff;font-weight:600;}
.gdi-pdf-controls{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.12);flex-wrap:wrap;}
/* ★FIX: playlist por classes (igual ao core) — sem estilo inline por item */
.gdi-playlist-item{padding:8px 12px;margin:3px 0;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:13px;background:rgba(255,255,255,0.05);color:var(--gdi-text,#e6edf3);transition:background .15s;}
.gdi-playlist-item:hover{background:rgba(255,255,255,0.12);}
.gdi-playlist-item>div:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;}
.gdi-playlist-item.cur{background:var(--bs-primary,#1f6feb);color:#fff;}
.gdi-playlist-item.watched{opacity:.75;}
.gdi-playlist-item.watched .bi-check-circle-fill{color:#3fb950;}
.gdi-pl-size{font-size:11px;opacity:.8;white-space:nowrap;}
/* ★ Pomodoro: painel dropdown a partir da navbar (não mais flutuante) */
#gdi-pom-nav{position:relative;}
#gdi-pom-nav-btn{display:flex;align-items:center;gap:7px;background:var(--ferreto-surface-2,rgba(255,255,255,.045));
  border:1px solid var(--ferreto-border,rgba(255,255,255,.09));color:var(--ferreto-text,#f3f5fa);
  border-radius:999px;padding:7px 13px;font-size:13.5px;font-weight:500;cursor:pointer;
  text-decoration:none;transition:.15s;font-family:var(--ferreto-font-body,'Rubik',sans-serif);}
#gdi-pom-nav-btn:hover{background:var(--ferreto-surface-3,rgba(255,255,255,.08));border-color:var(--ferreto-border-strong,rgba(255,255,255,.16));color:var(--ferreto-text,#f3f5fa);transform:translateY(-1px);}
#gdi-pom-nav-btn .gdi-pom-nav-ico{font-size:16px;}
#gdi-pom-nav-btn .gdi-pom-nav-time{font-size:12px;font-variant-numeric:tabular-nums;color:var(--ferreto-primary,#ff8b9f);font-weight:600;}
#gdi-pom-panel{position:absolute;top:calc(100% + 8px);right:0;width:260px;
  background:var(--ferreto-surface,rgba(22,27,38,.92));-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);
  border:1px solid var(--ferreto-border-strong,rgba(255,255,255,.16));border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.55);
  padding:16px 16px 12px;transform-origin:top right;transform:scale(.85) translateY(-10px);
  opacity:0;pointer-events:none;transition:transform .22s cubic-bezier(.34,1.45,.64,1),opacity .18s;z-index:10001;}
#gdi-pom-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}
.gdi-pom-phase-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  margin-bottom:6px;text-align:center;color:var(--ferreto-text-muted,#9aa4b8);}
#gdi-pom-display{font-size:46px;font-weight:800;text-align:center;color:var(--ferreto-text,#f0f6fc);
  letter-spacing:.04em;font-variant-numeric:tabular-nums;line-height:1;}
#gdi-pom-progress{height:4px;background:var(--ferreto-surface-3,rgba(255,255,255,.1));border-radius:2px;margin:12px 0 10px;overflow:hidden;}
#gdi-pom-progress-bar{height:4px;border-radius:2px;width:100%;transition:width .3s linear,background .4s;}
#gdi-pom-sessions-dots{display:flex;gap:5px;justify-content:center;margin-bottom:10px;}
.gdi-pom-dot{width:8px;height:8px;border-radius:50%;background:var(--ferreto-surface-3,rgba(255,255,255,.14));transition:background .3s,transform .3s;}
.gdi-pom-dot.done{background:var(--ferreto-primary,#ff8b9f);transform:scale(1.15);}
#gdi-pom-btns{display:flex;gap:6px;justify-content:center;margin-bottom:6px;}
.gdi-pom-btn{background:var(--ferreto-surface-2,rgba(255,255,255,.08));border:1px solid var(--ferreto-border,rgba(255,255,255,.13));color:var(--ferreto-text,#e6edf3);
  border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;transition:background .15s;white-space:nowrap;}
.gdi-pom-btn:hover{background:var(--ferreto-surface-3,rgba(255,255,255,.18));}
#gdi-pom-divider{height:1px;background:var(--ferreto-border,rgba(255,255,255,.08));margin:10px 0 8px;}
#gdi-pom-cfg{display:flex;flex-direction:column;gap:6px;}
.gdi-pom-cfg-row,.gdi-pom-switch{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--ferreto-text-muted,#9aa4b8);}
.gdi-pom-switch{cursor:pointer;}
.gdi-pom-switch input{accent-color:var(--ferreto-primary,#ff8b9f);cursor:pointer;}
.gdi-pom-cfg-row input{width:44px;background:var(--ferreto-surface-2,rgba(255,255,255,.07));border:1px solid var(--ferreto-border,rgba(255,255,255,.13));
  border-radius:6px;color:var(--ferreto-text,#f0f6fc);text-align:center;padding:2px 4px;font-size:11px;}
#gdi-pom-flash{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:0;transition:opacity .15s;}
`;document.head.appendChild(s);})();

// ── Loader dos módulos (anti-tempestade) ──
// ★FIX: debounce 80→150ms
(function(){
  let timer=null,lastRun=0;
  function runAll(){
    if(Date.now()-lastRun<100){schedule();return;}
    lastRun=Date.now();
    (window.GDI_MODULES||[]).forEach(m=>{
      try{ if(m&&typeof m.init==='function') m.init(); }
      catch(e){ console.error('[GDI módulo]',m&&m.name,e); }
    });
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(runAll,150);}
  function bindContent(){
    const c=document.getElementById('content');
    if(c&&!c.__gdiModObs){c.__gdiModObs=true;
      new MutationObserver(schedule).observe(c,{childList:true});}
  }
  Bus.onGlobal('page:change',schedule);
  document.addEventListener('DOMContentLoaded',()=>{bindContent();schedule();});
  window.addEventListener('load',()=>{bindContent();schedule();});
  bindContent();
})();

// ═══ M1: SENHAS PROTEGIDAS ═══
(function(){
  const _PWK='gdi-'+(window.location.host||'local');
  function _pwXor(s){let o='';for(let i=0;i<s.length;i++)o+=String.fromCharCode(s.charCodeAt(i)^_PWK.charCodeAt(i%_PWK.length));return o}
  window.gdiSetPw=function(p,v){try{localStorage.setItem('gdi_pw_'+btoa(encodeURIComponent(p)),btoa(encodeURIComponent(_pwXor(String(v)))))}catch(_){}};
  window.gdiGetPw=function(p){try{
    const v=localStorage.getItem('gdi_pw_'+btoa(encodeURIComponent(p)));
    if(v==null)return'';
    return _pwXor(decodeURIComponent(atob(v)));
  }catch(_){return''}};
  try{
    if(localStorage.getItem('gdi_pw_migrated'))return;
    const del=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
      if(k&&k.indexOf('password')===0){const v=localStorage.getItem(k);if(v)gdiSetPw(k.slice(8),v);del.push(k);}}
    del.forEach(k=>localStorage.removeItem(k));
    localStorage.setItem('gdi_pw_migrated','1');
    if(del.length)console.log('[módulo senhas]',del.length,'senhas migradas');
  }catch(_){}
})();

// ═══ M2: AUTENTICAÇÃO (Entrar/Sair) ═══
(function(){
  window.gdiRenderAuth=function(){
    const slot=document.getElementById('gdi-auth-slot');
    if(!slot)return;
    const st=GDIUser.auth();
    if(st==='in'){
      slot.innerHTML='<a class="gdi-nav-btn" href="/logout" title="Sua conta \u2014 clique para sair (o progresso fica salvo nela)" onclick="try{GDIUser.flush()}catch(_){}"><i class="bi bi-person-check"></i><span class="d-none d-md-inline">Sair</span></a>';
    }else if(st==='out'){
      slot.innerHTML='<a class="gdi-nav-btn" href="/login" title="Entrar na sua conta para salvar o progresso"><i class="bi bi-box-arrow-in-right"></i><span class="d-none d-md-inline">Entrar</span></a>';
    }
  };
  window.GDI_MODULES.push({name:'auth',init:function(){window.gdiRenderAuth();}});
  Bus.onGlobal('auth:change',()=>window.gdiRenderAuth());
})();

// ═══ M3: VELOCIDADE DO VÍDEO SALVA ═══
(function(){
  const RKEY='gdi-rate';let applying=false;
  const getR=()=>{const v=parseFloat(localStorage.getItem(RKEY));return(v>=0.25&&v<=4)?v:null};
  document.addEventListener('ratechange',e=>{
    const v=e.target;if(!v||v.tagName!=='VIDEO'||applying)return;
    const r=v.playbackRate;if(r&&r>=0.25&&r<=4)try{localStorage.setItem(RKEY,String(r))}catch(_){}
  },true);
  const apply=v=>{const r=getR();if(!r||Math.abs(v.playbackRate-r)<0.01)return;
    applying=true;try{v.playbackRate=r}catch(_){}applying=false;};
  document.addEventListener('play',e=>{const v=e.target;if(v&&v.tagName==='VIDEO')apply(v)},true);
  document.addEventListener('loadedmetadata',e=>{const v=e.target;if(v&&v.tagName==='VIDEO')apply(v)},true);
})();

// ═══ M4: ATALHOS (N/P, J, ]/[ trechos) ═══
(function(){
  let marksVideo=null;
  Bus.onGlobal('media:ready',({type,el})=>{if(type==='video')marksVideo=el;});
  function notesNow(){try{return GDIUser.getNotes(window.location.pathname)||[]}catch(_){return[]}}
  document.addEventListener('keydown',e=>{
    const t=e.target;
    if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const k=e.key.toLowerCase();
    if(k==='n'){const b=document.getElementById('gdi-btn-next');if(b&&!b.disabled){e.preventDefault();b.click();}}
    else if(k==='p'){const b=document.getElementById('gdi-btn-prev');if(b&&!b.disabled){e.preventDefault();b.click();}}
    else if(k==='j'){
      const pv=window.playlistVideos;if(!pv||!pv.length)return;
      const start=(typeof window.currentIndex==='number'&&window.currentIndex>=0)?window.currentIndex+1:0;
      for(let i2=start;i2<pv.length;i2++){
        let w=false;try{const raw=(pv[i2].pageUrl||'').split('?')[0];
          w=GDIUser.isWatched(raw)||(window.gdiNormKey&&GDIUser.isWatched(gdiNormKey(raw)));}catch(_){}
        if(!w){e.preventDefault();window.switchVideo(i2);return;}
      }
      showToast('Todas as aulas \u00e0 frente j\u00e1 foram assistidas \u2713');
    }
    else if(e.key===']'||e.key==='['){
      const v=marksVideo;if(!v)return;
      const notes=notesNow().slice().sort((a,b)=>a.t-b.t);if(!notes.length)return;
      const t2=v.currentTime;
      if(e.key===']'){const nx=notes.find(n=>n.t>t2+0.5);
        if(nx){try{v.currentTime=nx.t;v.play().catch(()=>{});}catch(_){}showToast('\u2192 trecho '+gdiFmtTime(nx.t));}}
      else{const pv=[...notes].reverse().find(n=>n.t<t2-1.5);
        if(pv){try{v.currentTime=pv.t;v.play().catch(()=>{});}catch(_){}showToast('\u2190 trecho '+gdiFmtTime(pv.t));}}
    }
  });
})();

// ═══ M5 v3: CRONÔMETRO + AUTO-ASSISTIDO 90% ═══
(function(){
  Bus.onGlobal('media:ready',({type,el})=>{
    if(type!=='video'||!el||el.__m5v3)return;
    el.__m5v3=true;
    const LAST_KEY=()=>window.location.pathname+(window.location.search||'');
    el.addEventListener('timeupdate',()=>{
      const el2=document.getElementById('gdi-note-time');
      if(el2)el2.textContent=gdiFmtTime(el.currentTime);
      if(!el.__autoW&&isFinite(el.duration)&&el.duration>60&&el.currentTime/el.duration>=0.9){
        el.__autoW=true;
        try{
          if(window.gdiMarkVideo)gdiMarkVideo();
          else GDIUser.markWatched(window.location.pathname);
          GDIUser.setLast(LAST_KEY());
        }catch(_){}
        Bus.emit('watched:changed');
      }
    });
    el.addEventListener('loadedmetadata',()=>{
      const el3=document.getElementById('gdi-note-time');
      if(el3)el3.textContent='00:00';
    });
    const nt=document.getElementById('gdi-note-time');
    if(nt&&!nt.__seekB){nt.__seekB=true;
      nt.addEventListener('click',()=>{
        const v=document.querySelector('video');
        if(v&&nt.textContent.includes(':')){
          const pp=nt.textContent.split(':');
          const sec=(parseInt(pp[0],10)||0)*60+(parseInt(pp[1],10)||0);
          try{v.currentTime=sec;v.play().catch(()=>{});}catch(_){}
        }
      });
    }
  });
})();

// ═══ M6: MARCAS + NOTAS + REVISÃO + EXPORT + DUPLO-TOQUE ═══
(function(){
  let mv=null,reviewOn=false;
  const SPAN=20;
  Bus.onGlobal('media:ready',({type,el})=>{
    if(type!=='video'||!el||el.__m6)return;
    el.__m6=true;mv=el;
    el.addEventListener('loadedmetadata',draw);
    el.addEventListener('timeupdate',tick);
  });
  function notesNow(){try{return GDIUser.getNotes(window.location.pathname)||[]}catch(_){return[]}}
  function draw(){
    const bar=document.getElementById('gdi-note-marks');if(!bar)return;
    const dur=(mv&&isFinite(mv.duration))?mv.duration:0;
    const notes=notesNow();
    bar.innerHTML='';
    if(!dur||!notes.length){bar.style.display='none';return;}
    bar.style.display='block';
    notes.forEach(nt=>{
      const d=document.createElement('div');d.className='gdi-note-mark';
      d.style.left=Math.min(100,Math.max(0,nt.t/dur*100))+'%';
      d.title=gdiFmtTime(nt.t)+' \u2014 '+nt.text;
      d.addEventListener('click',()=>{if(mv){try{mv.currentTime=nt.t;mv.play().catch(()=>{});}catch(_){}}});
      bar.appendChild(d);
    });
  }
  function tick(){
    if(!reviewOn)return;
    const v=mv;if(!v)return;
    const notes=notesNow().slice().sort((a,b)=>a.t-b.t);
    if(!notes.length){reviewOn=false;document.getElementById('gdi-review-btn')?.classList.remove('active');return;}
    const t=v.currentTime;
    let idx=-1;for(let i=0;i<notes.length;i++)if(notes[i].t<=t)idx=i;
    if(idx<0)return;
    const nxt=notes[idx+1];
    if(nxt&&t>=notes[idx].t+SPAN&&t<nxt.t){try{v.currentTime=nxt.t;}catch(_){}}
    else if(!nxt&&t>=notes[idx].t+SPAN){
      reviewOn=false;
      document.getElementById('gdi-review-btn')?.classList.remove('active');
      showToast('Revis\u00e3o conclu\u00edda \u2713');
    }
  }
  function exportMenu(){
    const old=document.getElementById('gdi-exp-menu');
    if(old){old.remove();return;}
    const btn=document.getElementById('gdi-notes-export');
    const m=document.createElement('div');m.id='gdi-exp-menu';
    const r=btn.getBoundingClientRect();
    m.style.cssText='position:fixed;z-index:10001;background:rgba(15,16,24,.97);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px;box-shadow:0 10px 30px rgba(0,0,0,.5);left:'+Math.max(8,r.left-60)+'px;top:'+(r.bottom+6)+'px;';
    m.innerHTML=`<button class="gdi-mode-btn" id="gdi-exp-md" style="justify-content:flex-start;font-size:12px;"><i class="bi bi-markdown"></i> Markdown (.md)</button>
    <button class="gdi-mode-btn" id="gdi-exp-anki" style="justify-content:flex-start;font-size:12px;"><i class="bi bi-collection"></i> Anki / texto (.txt)</button>`;
    GDI_ROOT().appendChild(m);
    document.getElementById('gdi-exp-md').onclick=()=>{m.remove();doExport('md');};
    document.getElementById('gdi-exp-anki').onclick=()=>{m.remove();doExport('anki');};
    setTimeout(()=>document.addEventListener('click',function h(e2){
      if(!m.contains(e2.target)){m.remove();document.removeEventListener('click',h);}
    }),0);
  }
  function doExport(fmt){
    const notes=notesNow().slice().sort((a,b)=>a.t-b.t);
    if(!notes.length){showToast('Nenhuma anota\u00e7\u00e3o para exportar');return;}
    let name='aula';try{name=decodeURIComponent(window.location.pathname.split('/').pop()||'aula')}catch(_){}
    const base=(name.replace(/\.[a-z0-9]+$/i,'')||'aula')+' \u2014 anota\u00e7\u00f5es';
    let content,type,ext;
    if(fmt==='anki'){
      content=notes.map(nt=>nt.text.replace(/\t/g,' ')+'\t'+name+' \u2014 '+gdiFmtTime(nt.t)).join('\n');
      type='text/plain;charset=utf-8';ext='anki.txt';
    }else{
      content='# Anota\u00e7\u00f5es \u2014 '+name+'\n\n'+notes.map(nt=>'- **['+gdiFmtTime(nt.t)+']** '+nt.text).join('\n')+'\n';
      type='text/markdown;charset=utf-8';ext='md';
    }
    const blob=new Blob([content],{type});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=base+'.'+ext;
    GDI_ROOT().appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    showToast(notes.length+' anota\u00e7\u00e3o'+(notes.length>1?'\u00f5es':'')+' exportada'+(notes.length>1?'s':''));
  }
  window.GDI_REVIEW_SPAN=SPAN;
  // ★FIX: user:ready registrado UMA vez (dispatcher), não 1× por página de vídeo
  if(!window.__gdiM6UR){window.__gdiM6UR=true;
    Bus.onGlobal('user:ready',()=>{try{window.__gdiM6Render&&window.__gdiM6Render()}catch(_){}});}
  window.GDI_MODULES.push({name:'marks-ui',init:function(){
    const wrap=document.querySelector('.gdi-player-wrap');
    if(wrap&&!document.getElementById('gdi-note-marks')){
      const bar=document.createElement('div');bar.id='gdi-note-marks';
      wrap.insertAdjacentElement('afterend',bar);
    }
    if(wrap&&Os.isMobile&&!wrap.__gdiDblTap){
      wrap.__gdiDblTap=true;
      let lt=0,lx=0;
      wrap.addEventListener('touchend',e=>{
        const now=Date.now();
        const x=(e.changedTouches&&e.changedTouches[0]&&e.changedTouches[0].clientX)||0;
        if(now-lt<320&&Math.abs(x-lx)<90){
          const rect=wrap.getBoundingClientRect();
          const v=wrap.querySelector('video');
          if(v&&isFinite(v.duration)&&v.duration>0){
            const fwd=(x-rect.left)>rect.width/2;
            v.currentTime=Math.min(Math.max(0,v.currentTime+(fwd?10:-10)),Math.max(0,v.duration-0.5));
            showToast((fwd?'\u2192 +10s \u2192 ':'\u2190 -10s \u2190 ')+gdiFmtTime(v.currentTime));
          }
          lt=0;
        }else{lt=now;lx=x;}
      },{passive:true});
    }
    const head=document.querySelector('.gdi-notes-head');
    if(head&&!head.dataset.gdiNotes){
      head.dataset.gdiNotes='1';
      const w=document.createElement('div');w.style.cssText='display:flex;gap:6px;';
      w.innerHTML=`<button id="gdi-notes-export" class="gdi-mode-btn" style="padding:3px 10px;font-size:11px;" title="Baixar anota\u00e7\u00f5es"><i class="bi bi-download"></i> Exportar</button>
      <button id="gdi-review-btn" class="gdi-mode-btn" style="padding:3px 10px;font-size:11px;" title="Tocar s\u00f3 os trechos anotados (${SPAN}s cada)"><i class="bi bi-fast-forward-fill"></i> Revis\u00e3o</button>`;
      head.appendChild(w);
      document.getElementById('gdi-notes-export').addEventListener('click',exportMenu);
      document.getElementById('gdi-review-btn').addEventListener('click',()=>{
        reviewOn=!reviewOn;
        document.getElementById('gdi-review-btn').classList.toggle('active',reviewOn);
        if(reviewOn){
          const notes=notesNow().slice().sort((a,b)=>a.t-b.t);
          if(mv&&notes.length){
            const nx=notes.find(n=>n.t>mv.currentTime-0.5)||notes[0];
            try{mv.currentTime=nx.t;mv.play().catch(()=>{});}catch(_){}
          }
          showToast('Modo revis\u00e3o LIGADO \u2014 '+SPAN+'s por trecho ( ] e [ pulam entre eles)');
        }else showToast('Modo revis\u00e3o desligado');
      });
    }
    const slot=document.getElementById('gdi-slot-left');
    if(slot&&!document.getElementById('gdi-notes')){
      slot.insertAdjacentHTML('beforeend',`
      <div class="gdi-notes" id="gdi-notes">
        <div class="gdi-notes-head"><strong>\ud83d\udcdd Minhas anota\u00e7\u00f5es</strong><span id="gdi-notes-count" style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);"></span></div>
        <textarea id="gdi-note-input" rows="2" placeholder="Digite sua anota\u00e7\u00e3o para esta aula\u2026"></textarea>
        <div class="gdi-notes-actions">
          <span id="gdi-note-time" title="Clique para ir a este momento do v\u00eddeo">00:00</span>
          <button id="gdi-note-save"><i class="bi bi-save me-1"></i>Salvar</button>
        </div>
        <div id="gdi-notes-list"><div class="gdi-notes-empty">Carregando suas anota\u00e7\u00f5es\u2026</div></div>
      </div>`);
      document.getElementById('gdi-note-save').addEventListener('click',()=>{
        const ta=document.getElementById('gdi-note-input');
        const txt=(ta.value||'').trim();
        if(!txt){showToast('Digite a anota\u00e7\u00e3o antes de salvar');return;}
        const v=document.querySelector('video');
        const tNow=v&&isFinite(v.currentTime)?v.currentTime:0;
        GDIUser.addNote(window.location.pathname,tNow,txt);
        ta.value='';
        render();
        showToast('Anota\u00e7\u00e3o salva na sua conta');
      });
      const nt=document.getElementById('gdi-note-time');
      if(nt&&!nt.__seekB){nt.__seekB=true;
        nt.addEventListener('click',()=>{
          const v=document.querySelector('video');
          if(v&&nt.textContent.includes(':')){
            const pp=nt.textContent.split(':');
            const sec=(parseInt(pp[0],10)||0)*60+(parseInt(pp[1],10)||0);
            try{v.currentTime=sec;v.play().catch(()=>{});}catch(_){}
          }
        });
      }
      Bus.on('video:switched',()=>{
        const ta=document.getElementById('gdi-note-input');
        if(ta&&ta.value.trim()){ta.value='';showToast('Rascunho descartado ao trocar de aula');}
        render();
      });
      GDIUser.ready().then(render).catch(()=>{});
      window.__gdiM6Render=render; // ★FIX: dispatcher global único
    }
    function render(){
      const listEl=document.getElementById('gdi-notes-list');
      const cntEl=document.getElementById('gdi-notes-count');
      if(!listEl)return;
      const notes=GDIUser.getNotes(window.location.pathname);
      if(cntEl)cntEl.textContent=notes.length?notes.length+' nota'+(notes.length>1?'s':''):'';
      if(!notes.length){listEl.innerHTML='<div class="gdi-notes-empty">Nenhuma anota\u00e7\u00e3o ainda. Digite acima e salve.</div>';draw();return;}
      const sorted=[...notes].map((nt,idx)=>({...nt,idx})).sort((x,y)=>x.t-y.t);
      listEl.innerHTML=sorted.map(nt=>`
        <div class="gdi-note">
          <span class="gdi-note-time" data-seek="${nt.idx}" title="Ir para este momento">${gdiFmtTime(nt.t)}</span>
          <span class="gdi-note-text">${escHtml(nt.text)}</span>
          <button class="gdi-note-del" data-del="${nt.idx}" title="Excluir"><i class="bi bi-x-lg"></i></button>
        </div>`).join('');
      listEl.querySelectorAll('[data-seek]').forEach(el=>{
        el.addEventListener('click',()=>{
          const nt=GDIUser.getNotes(window.location.pathname)[+el.dataset.seek];
          const v=document.querySelector('video');
          if(nt&&v){try{v.currentTime=nt.t;v.play().catch(()=>{});}catch(_){}}
        });
      });
      listEl.querySelectorAll('[data-del]').forEach(el=>{
        el.addEventListener('click',()=>{GDIUser.delNote(window.location.pathname,+el.dataset.del);render();});
      });
      draw();
    }
    draw();
  }});
  Bus.onGlobal('user:ready',()=>{try{draw()}catch(_){}});
})();

// ═══ M7: PULAR INTRO POR CURSO ═══
(function(){
  let skipBtn=null;
  function courseKey(){
    try{const fl=window.playlistVideos[window.currentIndex]?.folder;if(fl)return fl;}catch(_){}
    return window.location.pathname.split('/').slice(0,-1).join('/')+'/';
  }
  Bus.onGlobal('media:ready',({type,el})=>{
    if(type!=='video'||!el||el.__m7)return;
    el.__m7=true;
    const upd=()=>{
      if(!skipBtn||!document.body.contains(skipBtn))return;
      const S=GDIUser.getIntro(courseKey());
      const tm=el.currentTime;
      let show=false;
      if(S&&S>0)show=tm>0.4&&tm<S-0.3&&tm<180;
      else show=tm>1&&tm<120;
      // ★FIX: só toca no DOM quando muda (era reescrito a cada timeupdate)
      const html=S
        ?'<i class="bi bi-skip-forward-fill"></i> Pular introdu\u00e7\u00e3o ('+gdiFmtTime(S)+')'
        :'<i class="bi bi-skip-forward-fill"></i> Pular introdu\u00e7\u00e3o';
      if(skipBtn.innerHTML!==html)skipBtn.innerHTML=html;
      const disp=show?'block':'none';
      if(skipBtn.style.display!==disp)skipBtn.style.display=disp;
    };
    el.addEventListener('timeupdate',upd);
    el.addEventListener('seeked',()=>setTimeout(upd,80));
    el.addEventListener('play',upd);
  });
  window.GDI_MODULES.push({name:'skip-intro',init:function(){
    const wrap=document.querySelector('.gdi-player-wrap');
    if(!wrap)return;
    if(!skipBtn||!document.body.contains(skipBtn)){
      skipBtn=document.createElement('button');
      skipBtn.id='gdi-skip-intro';
      skipBtn.innerHTML='<i class="bi bi-skip-forward-fill"></i> Pular introdu\u00e7\u00e3o';
      wrap.appendChild(skipBtn);
      skipBtn.addEventListener('click',()=>{
        const v=document.querySelector('.gdi-player-wrap video');if(!v)return;
        const ck=courseKey();
        if(!GDIUser.getIntro(ck)){
          GDIUser.setIntro(ck,Math.max(1,Math.round(v.currentTime)));
          showToast('Intro de '+gdiFmtTime(v.currentTime|0)+' memorizada para este curso \u2713');
        }
        try{v.currentTime=GDIUser.getIntro(ck)||v.currentTime;v.play().catch(()=>{});}catch(_){}
        skipBtn.style.display='none';
      });
    }
  }});
})();

// ═══ M9: MATERIAIS (PDFs por aula) ═══
(function(){
  const frames=new Map();let gen=0,lastKey='';
  function classify(name){
    const n2=name.toLowerCase();
    if(/mapa/.test(n2))                       return{l:'Mapa Mental', i:'bi-diagram-3',              ord:4};
    if(/simulado/.test(n2))                   return{l:'Minissimulado',i:'bi-stopwatch',             ord:2};
    if(/quest|exerc|prova/.test(n2))          return{l:'Exerc\u00edcios',  i:'bi-ui-checks',              ord:1};
    if(/resumo|iara|\bia\b|intelig/.test(n2)) return{l:'Resumo IA',   i:'bi-stars',                  ord:3};
    return                                    {l:'Material',    i:'bi-file-earmark-text-fill',ord:0};
  }
  function courseBase(){
    let nm='';
    try{nm=window.playlistVideos[window.currentIndex]?.origName||''}catch(_){}
    if(!nm){try{nm=decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop()||'')}catch(_){nm=''}}
    return nm.replace(/\.[a-z0-9]+$/i,'').toLowerCase().trim();
  }
  function ensurePanel(){
    const right=document.getElementById('gdi-slot-right');
    if(!right)return null;
    if(!right.dataset.m9){
      right.dataset.m9='1';
      right.innerHTML=`<div class="gdi-mat-head"><strong><i class="bi bi-journal-bookmark-fill" style="color:var(--ferreto-primary,#7aa2ff);"></i> Materiais da aula</strong><span id="gdi-mat-status"></span></div>
      <div class="gdi-mat-tabs" id="gdi-mat-tabs"><span class="gdi-mat-loading">Buscando PDFs da aula\u2026</span></div>
      <div class="gdi-mat-body" id="gdi-mat-body"></div>`;
    }
    return{
      tabsEl:document.getElementById('gdi-mat-tabs'),
      bodyEl:document.getElementById('gdi-mat-body'),
      statusEl:document.getElementById('gdi-mat-status')
    };
  }
  async function build(){
    const myGen=++gen;
    const p=window.location.pathname;
    if(p.endsWith('/')||p.includes('/fallback'))return;
    // ★FIX: loader re-roda os módulos várias vezes na MESMA aula — não reconstruir
    if(p===lastKey){
      const tabs=document.getElementById('gdi-mat-tabs');
      const body=document.getElementById('gdi-mat-body');
      if(tabs&&body&&(tabs.querySelector('.gdi-mat-tab')||body.querySelector('.gdi-mat-empty')))return;
    }
    let panel=null;
    for(let i=0;i<40;i++){
      panel=ensurePanel();
      if(panel&&panel.tabsEl&&panel.bodyEl)break;
      if(myGen!==gen)return;
      await sleep(200);
    }
    if(!panel||!panel.tabsEl||!panel.bodyEl)return;
    const{tabsEl,bodyEl,statusEl}=panel;
    const UI=window.UI||{};
    const curPath=window.location.pathname;
    const fPath=curPath.split("/").slice(0,-1).join("/")+"/";
    const pPath=curPath.split("/").slice(0,-2).join("/")+"/";
    tabsEl.innerHTML='<span class="gdi-mat-loading">Buscando PDFs da aula\u2026</span>';
    if(statusEl)statusEl.textContent='';
    bodyEl.innerHTML='';
    const isPdf=x=>(x.fileExtension||'').toLowerCase()==='pdf'||/pdf/i.test(x.mimeType||'');
    try{
      let found=[];
      const here=await gdiListAllFiles(fPath,gdiGetPw(fPath));
      found=here.filter(isPdf);
      if(!found.length){
        const subs=here.filter(x=>x.mimeType==='application/vnd.google-apps.folder').slice(0,20);
        for(const sf of subs){
          const fp=fPath+encodeURIComponent(sf.name)+'/';
          found=found.concat((await gdiListAllFiles(fp,gdiGetPw(fp))).filter(isPdf));
          if(found.length)break;
        }
      }
      if(!found.length)found=(await gdiListAllFiles(pPath,gdiGetPw(pPath))).filter(isPdf);
      const seen=new Set();const uniq=[];
      found.forEach(x=>{if(!seen.has(x.name)){seen.add(x.name);uniq.push(x)}});
      const pdfs=uniq.slice(0,12);
      if(myGen!==gen)return;
      if(!pdfs.length){
        if(tabsEl.isConnected){
          tabsEl.innerHTML='';
          if(statusEl)statusEl.textContent='sem PDF';
          if(bodyEl)bodyEl.innerHTML=`<div class="gdi-mat-empty"><i class="bi bi-file-earmark-x" style="font-size:34px;"></i><div>Nenhum material PDF encontrado para esta aula.</div></div>`;
          lastKey=p;
        }
        return;
      }
      const base=courseBase();
      const items=pdfs.map(x=>{
        const cls=classify(x.name);
        const b2=UI.second_domain_for_dl?UI.downloaddomain+x.link:window.location.origin+x.link;
        const url=b2+(x.link.includes('?')?'&':'?')+'inline=true';
        const match=base&&x.name.toLowerCase().includes(base)?0:1;
        return{name:x.name,label:cls.l,icon:cls.i,ord:cls.ord,match,url};
      });
      items.sort((x,y)=>x.match-y.match||x.ord-y.ord||x.name.localeCompare(y.name,undefined,{numeric:true}));
      // ★ salva items para o botão "Regerar" encontrar
      tabsEl.__items=items;
      const used={};
      items.forEach((it,idx)=>{
        used[it.label]=(used[it.label]||0)+1;
        it.tabLabel=used[it.label]>1?it.label+' '+used[it.label]:it.label;
        it.idx=idx;
      });
      if(!tabsEl.isConnected)return;
      tabsEl.innerHTML=items.map(it=>`
        <div class="gdi-mat-tab" data-mat="${it.idx}" title="${escHtml(it.name)}">
          <i class="bi ${it.icon}"></i><span>${escHtml(it.tabLabel)}</span>
        </div>`).join('')+
        `<div class="gdi-mat-tab gdi-mat-isa" data-mat="isa-summary" title="Gerar resumo com a Meggy (IA)">
          <i class="bi bi-stars"></i><span>Resumo Meggy</span>
        </div>
        <div class="gdi-mat-tab gdi-mat-isa" data-mat="isa-questions" title="Gerar questões com a Meggy (IA)">
          <i class="bi bi-patch-question"></i><span>Questões Meggy</span>
        </div>
        <div class="gdi-mat-tab gdi-mat-isa" data-mat="isa-mindmap" title="Gerar pílulas com a Meggy (IA)">
          <i class="bi bi-capsule"></i><span>Pílulas</span>
        </div>
        <div class="gdi-mat-tab gdi-mat-isa" data-mat="isa-flashcards" title="Flashcards desta aula">
          <i class="bi bi-card-text"></i><span>Flashcards</span>
        </div>`;
      if(statusEl)statusEl.textContent=items.length+' PDF'+(items.length>1?'s':'');
      const isMobile=Os.isMobile;
      function show(idx){
        if(!tabsEl.isConnected||!bodyEl.isConnected)return;
        tabsEl.querySelectorAll('.gdi-mat-tab').forEach(t=>t.classList.toggle('active',+t.dataset.mat===idx));
        if(isMobile){
          // ★ Android/iOS: muitos navegadores móveis NÃO renderizam PDF em <iframe>
          // e abrem popup de download. Usamos pdf.js (viewer) embutido para
          // garantir que o PDF apareça DENTRO da página.
          bodyEl.innerHTML=`<div class="gdi-mat-mobile-pdf" style="height:100%;display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:var(--ferreto-surface-2,rgba(255,255,255,.04));border:1px solid var(--ferreto-border,#21262d);border-radius:8px;flex-shrink:0;">
              <div style="min-width:0;flex:1;">
                <div style="font-weight:600;color:var(--ferreto-text,#f0f6fc);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><i class="bi bi-file-earmark-pdf"></i> ${escHtml(items[idx].name)}</div>
              </div>
              <a href="${items[idx].url}" target="_blank" rel="noopener" class="gdi-mode-btn" style="text-decoration:none;font-size:11px;padding:5px 10px;flex:none;" title="Abrir em aba nova (baixar)">
                <i class="bi bi-box-arrow-up-right"></i> Abrir
              </a>
            </div>
            <div id="gdi-mat-mobile-viewer" style="flex:1;min-height:300px;border:1px solid var(--ferreto-border,#21262d);border-radius:8px;overflow:hidden;background:#525659;display:flex;align-items:center;justify-content:center;">
              <div style="color:#fff;font-size:12px;text-align:center;padding:20px;"><div class="gdi-mat-isa-spin" style="margin:0 auto 10px;"></div>Carregando PDF…</div>
            </div>
          </div>`;
          // tenta renderizar com pdf.js (viewer embutido)
          (async()=>{
            try{
              if(!window.pdfjsLib){
                // carrega pdf.js dinamicamente
                await new Promise((res,rej)=>{
                  const s=document.createElement('script');
                  s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
                  s.crossOrigin='anonymous';
                  s.onload=res;s.onerror=()=>rej(new Error('pdf.js falhou'));
                  document.head.appendChild(s);
                });
                if(window.pdfjsLib){
                  try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';}catch(_){}
                }
              }
              if(!window.pdfjsLib)throw new Error('pdf.js indisponível');
              const viewer=bodyEl.querySelector('#gdi-mat-mobile-viewer');
              if(!viewer)return;
              viewer.innerHTML='<canvas id="gdi-mat-mobile-canvas" style="width:100%;height:100%;display:block;background:#525659;"></canvas>';
              const canvas=viewer.querySelector('#gdi-mat-mobile-canvas');
              const ctx=canvas.getContext('2d');
              const resp=await fetch(items[idx].url,{credentials:'same-origin'});
              if(!resp.ok)throw new Error('HTTP '+resp.status);
              const buf=await resp.arrayBuffer();
              const doc=await window.pdfjsLib.getDocument({data:buf}).promise;
              let pageNum=1;
              let scale=1.5;
              async function renderPage(){
                const page=await doc.getPage(pageNum);
                const viewport=page.getViewport({scale});
                const containerWidth=viewer.clientWidth-20;
                if(viewport.width>containerWidth){
                  scale=containerWidth/viewport.width*scale;
                }
                const vp2=page.getViewport({scale});
                canvas.height=vp2.height;
                canvas.width=vp2.width;
                canvas.style.height=vp2.height+'px';
                canvas.style.width='100%';
                await page.render({canvasContext:ctx,viewport:vp2}).promise;
                // controles de página
                if(!viewer.querySelector('.gdi-mat-mobile-nav')){
                  const nav=document.createElement('div');
                  nav.className='gdi-mat-mobile-nav';
                  nav.style.cssText='position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:6px;background:rgba(0,0,0,.75);padding:6px 10px;border-radius:20px;backdrop-filter:blur(6px);';
                  nav.innerHTML=`
                    <button class="gdi-mat-mobile-prev" style="background:transparent;border:0;color:#fff;cursor:pointer;font-size:16px;padding:2px 8px;"><i class="bi bi-chevron-left"></i></button>
                    <span class="gdi-mat-mobile-info" style="color:#fff;font-size:12px;padding:2px 6px;">${pageNum}/${doc.numPages}</span>
                    <button class="gdi-mat-mobile-next" style="background:transparent;border:0;color:#fff;cursor:pointer;font-size:16px;padding:2px 8px;"><i class="bi bi-chevron-right"></i></button>`;
                  viewer.style.position='relative';
                  viewer.appendChild(nav);
                  nav.querySelector('.gdi-mat-mobile-prev').onclick=async()=>{
                    if(pageNum>1){pageNum--;await renderPage();}
                  };
                  nav.querySelector('.gdi-mat-mobile-next').onclick=async()=>{
                    if(pageNum<doc.numPages){pageNum++;await renderPage();}
                  };
                }else{
                  viewer.querySelector('.gdi-mat-mobile-info').textContent=pageNum+'/'+doc.numPages;
                }
                // scroll topo
                viewer.scrollTop=0;
              }
              await renderPage();
            }catch(err){
              console.warn('[M9 mobile] pdf.js falhou, caindo p/ link:',err);
              const viewer=bodyEl.querySelector('#gdi-mat-mobile-viewer');
              if(viewer){
                viewer.innerHTML=`<div style="text-align:center;padding:24px;color:var(--ferreto-text,#e6edf3);">
                  <i class="bi bi-file-earmark-pdf" style="font-size:38px;color:var(--ferreto-primary,#ff8b9f);"></i>
                  <div style="margin-top:8px;font-size:13px;">Não foi possível exibir o PDF dentro da página neste dispositivo.</div>
                  <a href="${items[idx].url}" target="_blank" rel="noopener" class="gdi-btn gdi-btn-primary" style="margin-top:14px;text-decoration:none;">
                    <i class="bi bi-box-arrow-up-right"></i> Abrir em nova aba
                  </a>
                </div>`;
              }
            }
          })();
          return;
        }
        let ifr=frames.get(items[idx].url);
        if(!ifr){
          ifr=document.createElement('iframe');
          ifr.src=items[idx].url;ifr.loading='lazy';
          ifr.title=items[idx].name;
          frames.set(items[idx].url,ifr);
        }
        bodyEl.innerHTML='';bodyEl.appendChild(ifr);
      }
      function activateOnly(t){
        tabsEl.querySelectorAll('.gdi-mat-tab').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        bodyEl.innerHTML='';
      }
      tabsEl.querySelectorAll('.gdi-mat-tab').forEach(t=>{
        t.addEventListener('click',()=>{
          const m=t.dataset.mat;
          if(m==='isa-summary'){
            activateOnly(t);
            if(window.gdiIsaPdf)window.gdiIsaPdf.summary(items,bodyEl,base);
            else showToast('Módulo Meggy indisponível');
          }else if(m==='isa-questions'){
            activateOnly(t);
            if(window.gdiIsaPdf)window.gdiIsaPdf.questions(items,bodyEl,base);
            else showToast('Módulo Meggy indisponível');
          }else if(m==='isa-mindmap'){
            activateOnly(t);
            if(window.gdiIsaPdf&&window.gdiIsaPdf.mindmap)window.gdiIsaPdf.mindmap(items,bodyEl,base);
            else showToast('Módulo Meggy indisponível');
          }else if(m==='isa-flashcards'){
            activateOnly(t);
            if(window.gdiIsaPdf&&window.gdiIsaPdf.flashcards)window.gdiIsaPdf.flashcards(items,bodyEl,base);
            else showToast('Módulo Flashcards indisponível');
          }else{
            show(+m);
          }
        });
      });
      show(0);
      lastKey=p;
      console.log('[GDI Materiais] aula:',base||'(sem nome)','\u2192',items.length,'PDFs:',items.map(x=>x.tabLabel).join(' | '));
    }catch(err){
      if(myGen!==gen)return;
      if(statusEl)statusEl.textContent='sem PDF';
      if(bodyEl)bodyEl.innerHTML=`<div class="gdi-mat-empty"><i class="bi bi-wifi-off" style="font-size:34px;"></i><div>N\u00e3o foi poss\u00edvel carregar os materiais.</div></div>`;
    }
  }
  Bus.onGlobal('video:switched',()=>{setTimeout(build,80);});
  window.GDI_MODULES.push({name:'materials',init:build});
})();

// ═══ M9-ISA: EXTRAÇÃO DE PDF + RESUMOS/QUESTÕES COM A ISA ═══
// Fornece window.gdiIsaPdf (summary/questions) consumido pelo M9
// (materiais) e window.renderResumos consumido pelo M22 (Central
// de Estudos, aba "Resumos"). Usa pdf.js para extrair texto do PDF
// e /api/ai (ISA) para gerar resumo/questões. Sumários são salvos
// em localStorage 'gdi-isa-summaries-v1'. Questões vão para o banco
// do M23 ('gdi-questions-v1').
// ═══════════════════════════════════════════════════════════════
(function(){
  if(window.__gdiM9Isa)return;window.__gdiM9Isa=true;
  const LS_SUM='gdi-isa-summaries-v1';
  const LQ='gdi-questions-v1';
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}};
  const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  // ── Robust JSON array parser ──
  // LLMs frequentemente retornam texto antes/depois do JSON, cercam o
  // array em ```json ... ```, ou incluem erros de sintaxe (vírgulas
  // finais, aspas não escapadas). Esta função tenta todas as estratégias
  // e só lança erro se TODAS falharem (inclui os primeiros 500 chars
  // da resposta bruta na mensagem para diagnóstico).
  function parseJsonArray(raw){
    if(raw==null)throw new Error('Resposta vazia');
    let txt=String(raw);
    // 1) strip markdown fences ```json ... ``` (e ``` ... ```)
    txt=txt.replace(/```(?:json|JSON)?\s*/g,'').replace(/```\s*/g,'');
    // 2) extrair do PRIMEIRO [ ao ÚLTIMO ]
    const first=txt.indexOf('[');
    const last=txt.lastIndexOf(']');
    if(first>=0&&last>first){
      txt=txt.slice(first,last+1);
    }
    // 3) tenta JSON.parse direto
    try{
      const arr=JSON.parse(txt);
      if(Array.isArray(arr))return arr;
    }catch(_){}
    // 4) tenta consertar problemas comuns: vírgulas finais e aspas
    //    não-escapadas dentro de strings (heurística simples)
    try{
      const fixed=txt
        .replace(/,(\s*[}\]])/g,'$1')          // vírgula final antes de } ou ]
        .replace(/[\u201C\u201D]/g,'"')          // aspas curvas → retas
        .replace(/[\u2018\u2019]/g,"'")          // apóstrofos curvos → retos
        .replace(/\t/g,' ');
      const arr=JSON.parse(fixed);
      if(Array.isArray(arr))return arr;
    }catch(_){}
    // 5) tenta parsing item-a-item: encontra cada {...} no texto e
    //    monta o array (LLM às vezes retorna uma lista de objetos sem
    //    os colchetes externos, ou com comentários no meio)
    try{
      const items=[];
      const re=/\{[\s\S]*?\}(?=\s*[,}\]\n]|\s*$)/g;
      let m;
      while((m=re.exec(txt))!==null){
        let frag=m[0];
        // remove vírgula final dentro do objeto
        frag=frag.replace(/,(\s*})/g,'$1');
        try{
          const obj=JSON.parse(frag);
          if(obj&&typeof obj==='object'&&!Array.isArray(obj))items.push(obj);
        }catch(_){}
      }
      if(items.length)return items;
    }catch(_){}
    // 6) falhou tudo — inclui os primeiros 500 chars da resposta
    const preview=String(raw).slice(0,500).replace(/\s+/g,' ');
    const err=new Error('Resposta não é JSON array válido. Primeiros 500 chars: '+preview);
    err.raw=String(raw);
    throw err;
  }
  // Exposto no window para ser reutilizado por outros módulos (M23, etc.)
  window.__gdiParseJsonArray=parseJsonArray;

  // ── CSS ──
  if(!document.getElementById('gdi-m9isa-style')){
    const s=document.createElement('style');s.id='gdi-m9isa-style';s.textContent=`
.gdi-mat-tab.gdi-mat-isa{background:linear-gradient(135deg,rgba(255,139,159,.12),rgba(93,222,218,.08));border-color:rgba(255,139,159,.3);color:var(--ferreto-primary,#ff8b9f);}
.gdi-mat-tab.gdi-mat-isa:hover{background:linear-gradient(135deg,rgba(255,139,159,.22),rgba(93,222,218,.14));color:var(--ferreto-primary,#ff8b9f);}
.gdi-mat-tab.gdi-mat-isa.active{background:linear-gradient(135deg,#ff8b9f,#c026d3);border-color:transparent;color:#fff;}
.gdi-mat-isa-loading{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:30px;text-align:center;color:var(--ferreto-text-muted,#8b949e);font-size:14px;}
.gdi-mat-isa-spin{width:30px;height:30px;border:3px solid var(--ferreto-surface-3,rgba(255,255,255,.12));border-top-color:var(--ferreto-primary,#ff8b9f);border-radius:50%;animation:gdi-mat-isa-spin 1s linear infinite;}
@keyframes gdi-mat-isa-spin{to{transform:rotate(360deg);}}
/* ★FIX barra de rolagem dupla: antes havia overflow-y:auto aqui E dentro
   do .gdi-isa-summary-body, gerando duas scrollbars aninhadas. Agora só
   este contêiner rola — os filhos apenas preenchem naturalmente. */
.gdi-mat-isa-result{height:100%;overflow-y:auto;overflow-x:hidden;padding:14px 18px;background:var(--ferreto-surface,#161b22);color:var(--ferreto-text,#e6edf3);font-size:14px;line-height:1.6;}
.gdi-mat-isa-result h1,.gdi-mat-isa-result h2,.gdi-mat-isa-result h3,.gdi-mat-isa-result h4{color:var(--ferreto-text,#f0f6fc);font-family:var(--ferreto-font-display,'Poppins',sans-serif);margin:14px 0 6px;}
.gdi-mat-isa-result h1{font-size:20px;} .gdi-mat-isa-result h2{font-size:17px;} .gdi-mat-isa-result h3{font-size:15px;} .gdi-mat-isa-result h4{font-size:13px;}
.gdi-mat-isa-result p{margin:0 0 8px;}
.gdi-mat-isa-result ul,.gdi-mat-isa-result ol{margin:0 0 10px;padding-left:22px;}
.gdi-mat-isa-result li{margin:3px 0;}
.gdi-mat-isa-result code{background:rgba(0,0,0,.3);padding:1px 5px;border-radius:4px;font-size:12px;}
.gdi-mat-isa-result pre{background:rgba(0,0,0,.3);padding:8px;border-radius:8px;overflow-x:auto;margin:6px 0;}
.gdi-mat-isa-result strong{color:var(--ferreto-secondary,#5ddeda);}
.gdi-mat-isa-result blockquote{border-left:3px solid var(--ferreto-primary,#ff8b9f);margin:6px 0;padding:2px 10px;color:var(--ferreto-text-muted,#8b949e);}
.gdi-isa-summary-body h1,.gdi-isa-summary-body h2,.gdi-isa-summary-body h3,.gdi-isa-summary-body h4{color:var(--ferreto-text,#f0f6fc);font-family:var(--ferreto-font-display,'Poppins',sans-serif);margin:18px 0 8px;line-height:1.3;}
.gdi-isa-summary-body h1{font-size:20px;border-bottom:2px solid var(--ferreto-primary,#ff8b9f);padding-bottom:6px;}
.gdi-isa-summary-body h2{font-size:17px;color:var(--ferreto-primary,#ff8b9f);border-left:3px solid var(--ferreto-primary,#ff8b9f);padding-left:10px;}
.gdi-isa-summary-body h3{font-size:15px;color:var(--ferreto-secondary,#5ddeda);}
.gdi-isa-summary-body h4{font-size:13px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;letter-spacing:.05em;}
.gdi-isa-summary-body p{margin:0 0 10px;text-align:justify;}
.gdi-isa-summary-body ul,.gdi-isa-summary-body ol{margin:0 0 12px;padding-left:24px;}
.gdi-isa-summary-body li{margin:4px 0;}
.gdi-isa-summary-body code{background:rgba(0,0,0,.3);padding:2px 6px;border-radius:4px;font-size:12px;font-family:ui-monospace,monospace;}
.gdi-isa-summary-body pre{background:rgba(0,0,0,.3);padding:12px;border-radius:8px;overflow-x:auto;margin:8px 0;}
.gdi-isa-summary-body strong{color:var(--ferreto-secondary,#5ddeda);font-weight:600;}
.gdi-isa-summary-body blockquote{border-left:3px solid var(--ferreto-primary,#ff8b9f);margin:10px 0;padding:4px 14px;color:var(--ferreto-text-muted,#8b949e);font-style:italic;background:rgba(255,139,159,.06);border-radius:0 8px 8px 0;}
.gdi-isa-summary-body table{border-collapse:collapse;width:100%;margin:10px 0;}
.gdi-isa-summary-body th,.gdi-isa-summary-body td{border:1px solid var(--ferreto-border,#21262d);padding:8px 10px;text-align:left;font-size:13px;}
.gdi-isa-summary-body th{background:var(--ferreto-surface-3,rgba(255,255,255,.08));font-weight:600;}
.gdi-mat-isa-err{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:30px;text-align:center;}
.gdi-mat-isa-err i{font-size:36px;color:#ff8b8b;}
.gdi-mat-isa-err div{color:var(--ferreto-text,#e6edf3);font-size:14px;max-width:420px;}

/* ═══ BIBLIOTECA DE FLASHCARDS (M9) ═══ */
.gdi-fc-library{padding:14px 14px 24px;}
.gdi-fc-library-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 16px;background:linear-gradient(135deg,rgba(255,139,159,.12),rgba(93,222,218,.06));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;margin-bottom:14px;}
.gdi-fc-library-title{display:flex;align-items:center;gap:10px;min-width:0;}
.gdi-fc-library-title > i{font-size:24px;color:var(--ferreto-primary,#ff8b9f);flex:none;}
.gdi-fc-library-title b{color:var(--ferreto-text,#f0f6fc);font-family:var(--ferreto-font-display,'Poppins',sans-serif);font-size:15px;display:block;}
.gdi-fc-library-title span{color:var(--ferreto-text-muted,#8b949e);font-size:12px;}
.gdi-fc-library-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.gdi-fc-add-form{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px;background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:10px;}
.gdi-fc-add-form input{flex:1;min-width:140px;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px 10px;font-size:13px;font-family:inherit;}

/* Disciplina */
.gdi-fc-discipline{margin-bottom:10px;background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:12px;overflow:hidden;}
.gdi-fc-disc-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none;background:rgba(255,255,255,.025);transition:background .15s;}
.gdi-fc-disc-head:hover{background:rgba(255,255,255,.06);}
.gdi-fc-disc-head .gdi-fc-chevron{transition:transform .2s;color:var(--ferreto-text-muted,#8b949e);font-size:12px;flex:none;}
.gdi-fc-disc-head .gdi-fc-chevron.gdi-fc-rotated{transform:rotate(-90deg);}
.gdi-fc-disc-icon{color:var(--ferreto-primary,#ff8b9f);font-size:18px;flex:none;}
.gdi-fc-disc-name{color:var(--ferreto-text,#f0f6fc);font-family:var(--ferreto-font-display,'Poppins',sans-serif);font-size:14px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gdi-fc-disc-meta{color:var(--ferreto-text-muted,#8b949e);font-size:11px;white-space:nowrap;}
.gdi-fc-due{color:#ffd43b !important;}
.gdi-fc-disc-body{padding:4px 8px 10px 8px;}

/* Tema */
.gdi-fc-theme{margin:6px 0 6px 26px;background:rgba(255,255,255,.02);border:1px solid var(--ferreto-border,#21262d);border-radius:10px;overflow:hidden;}
.gdi-fc-theme-head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;user-select:none;transition:background .15s;}
.gdi-fc-theme-head:hover{background:rgba(255,255,255,.05);}
.gdi-fc-theme-head .gdi-fc-chevron{transition:transform .2s;color:var(--ferreto-text-muted,#8b949e);font-size:11px;flex:none;}
.gdi-fc-theme-head .gdi-fc-chevron.gdi-fc-rotated{transform:rotate(-90deg);}
.gdi-fc-theme-icon{color:var(--ferreto-secondary,#5ddeda);font-size:14px;flex:none;}
.gdi-fc-theme-name{color:var(--ferreto-text,#e6edf3);font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gdi-fc-theme-meta{color:var(--ferreto-text-muted,#8b949e);font-size:11px;white-space:nowrap;}
.gdi-fc-theme-study{padding:4px 10px !important;font-size:11px !important;}
.gdi-fc-theme-body{padding:8px 10px 10px 10px;}

/* Grid de cards */
.gdi-fc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;}

/* Flip card 3D — versão SIMPLES E ROBUSTA
   Estratégia: opacity controla qual face aparece. backface-visibility
   fica apenas para suavizar a animação (sem ele, há flicker em alguns
   Androids), mas a regra de "qual face aparece" é 100% por opacity.
   Isso elimina qualquer conflito entre os dois mecanismos. */
.gdi-fc-card{position:relative;perspective:1500px;height:170px;cursor:pointer;isolation:isolate;}
.gdi-fc-card-large{height:340px;max-width:560px;margin:0 auto;}
.gdi-fc-card-inner{position:absolute;inset:0;transform-style:preserve-3d;-webkit-transform-style:preserve-3d;transition:transform .55s cubic-bezier(.4,0,.2,1);will-change:transform;}
.gdi-fc-card.gdi-fc-flipped .gdi-fc-card-inner{transform:rotateY(180deg);-webkit-transform:rotateY(180deg);}
.gdi-fc-card-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:18px 16px;border-radius:12px;box-sizing:border-box;text-align:center;overflow:hidden;transition:opacity .3s;will-change:transform;}
.gdi-fc-card-front{background:linear-gradient(135deg,rgba(255,139,159,.14),rgba(192,38,211,.08));border:1.5px solid rgba(255,139,159,.4);color:var(--ferreto-text,#f0f6fc);transform:translateZ(0);-webkit-transform:translateZ(0);opacity:1;}
.gdi-fc-card-back{background:linear-gradient(135deg,rgba(93,222,218,.14),rgba(63,185,80,.08));border:1.5px solid rgba(93,222,218,.4);color:var(--ferreto-text,#e6edf3);-webkit-transform:rotateY(180deg) translateZ(0);transform:rotateY(180deg) translateZ(0);opacity:0;pointer-events:none;}
.gdi-fc-card.gdi-fc-flipped .gdi-fc-card-front{opacity:0;pointer-events:none;}
.gdi-fc-card.gdi-fc-flipped .gdi-fc-card-back{opacity:1;pointer-events:auto;}
.gdi-fc-card-label{font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--ferreto-primary,#ff8b9f);text-transform:uppercase;display:flex;align-items:center;gap:4px;}
.gdi-fc-card-back .gdi-fc-card-label{color:var(--ferreto-secondary,#5ddeda);}
.gdi-fc-card-text{font-size:13px;line-height:1.55;color:var(--ferreto-text,#e6edf3);overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;max-height:110px;}
.gdi-fc-card-large .gdi-fc-card-text{font-size:16px;line-height:1.6;-webkit-line-clamp:10;max-height:240px;}
.gdi-fc-card-hint{font-size:10px;color:var(--ferreto-text-muted,#8b949e);display:flex;align-items:center;gap:4px;font-style:italic;}
.gdi-fc-card-del{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(255,107,107,.2);border:1px solid rgba(255,107,107,.4);color:#ff8b8b;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background .15s;}
.gdi-fc-card-del:hover{background:rgba(255,107,107,.4);}
.gdi-fc-card:hover .gdi-fc-card-del{opacity:1;}

/* Empty state */
.gdi-fc-empty{padding:40px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px;}
.gdi-fc-empty-icon{font-size:64px;line-height:1;}
.gdi-fc-empty h3{color:var(--ferreto-primary,#ff8b9f);font-family:var(--ferreto-font-display,'Poppins',sans-serif);font-size:18px;margin:0;}
.gdi-fc-empty p{color:var(--ferreto-text-muted,#8b949e);font-size:13px;max-width:480px;margin:0;line-height:1.6;}
.gdi-fc-manual-wrap{margin-top:10px;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;max-width:420px;}
.gdi-fc-manual-wrap input, .gdi-fc-manual-form input{width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px 10px;font-size:13px;font-family:inherit;}

/* Sessão de estudo (modo amplified) */
.gdi-fc-session{max-width:760px;height:100%;display:flex;flex-direction:column;}
.gdi-fc-session-head{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--ferreto-text-muted,#8b949e);padding:0 4px 10px;flex-shrink:0;}
.gdi-fc-session-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px 0;}
.gdi-fc-session-grade{flex-shrink:0;padding:14px;border-top:1px solid var(--ferreto-border,#21262d);}
.gdi-fc-session-grade p{text-align:center;color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin:0 0 10px;}
.gdi-fc-grade-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.gdi-fc-btn-no{background:rgba(255,107,107,.15)!important;border-color:rgba(255,107,107,.3)!important;color:#ff8b8b!important;font-size:13px!important;padding:10px 20px!important;}
.gdi-fc-btn-yes{font-size:13px!important;padding:10px 20px!important;}
.gdi-fc-session-foot{flex-shrink:0;display:flex;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--ferreto-border,#21262d);}
.gdi-fc-skip-btn{width:48px;height:48px;border-radius:50%;border:0;cursor:pointer;background:linear-gradient(135deg,#ff8b9f,#c026d3);color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px -4px rgba(255,139,159,.5);transition:transform .15s;}
.gdi-fc-skip-btn:hover{transform:scale(1.08);}

/* Responsivo */
@media(max-width:680px){
  .gdi-fc-grid{grid-template-columns:1fr;}
  .gdi-fc-card{height:200px;}
  .gdi-fc-library-head{flex-direction:column;align-items:stretch;}
  .gdi-fc-library-actions{justify-content:space-between;}
  .gdi-fc-theme{margin-left:14px;}
}
`;
    document.head.appendChild(s);
  }

  // ── Dynamic load pdf.js (v3.11.174) ──
  let pdfjsPromise=null;
  function ensurePdfjs(){
    if(window.pdfjsLib){
      try{if(!window.pdfjsLib.GlobalWorkerOptions.workerSrc)window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';}catch(_){}
      return Promise.resolve(window.pdfjsLib);
    }
    if(pdfjsPromise)return pdfjsPromise;
    pdfjsPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      s.crossOrigin='anonymous';
      s.onload=()=>{
        if(window.pdfjsLib){
          try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';}catch(_){}
          resolve(window.pdfjsLib);
        }else{
          reject(new Error('pdfjsLib não exposto pelo CDN'));
        }
      };
      s.onerror=()=>reject(new Error('Falha ao carregar pdf.js do CDN'));
      document.head.appendChild(s);
    });
    return pdfjsPromise;
  }

  // ── Dynamic load Tesseract.js (OCR para PDFs escaneados) ──
  // ★ Carrega só quando necessário (PDFs sem texto selecionável).
  // Usa modelo em português (por) + inglês (eng) como fallback.
  let tesseractPromise=null;
  function ensureTesseract(){
    if(window.Tesseract)return Promise.resolve(window.Tesseract);
    if(tesseractPromise)return tesseractPromise;
    tesseractPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.crossOrigin='anonymous';
      s.onload=()=>{
        if(window.Tesseract)resolve(window.Tesseract);
        else reject(new Error('Tesseract não exposto pelo CDN'));
      };
      s.onerror=()=>reject(new Error('Falha ao carregar Tesseract.js do CDN'));
      document.head.appendChild(s);
    });
    return tesseractPromise;
  }

  // ── OCR de uma página: renderiza no canvas e roda Tesseract ──
  // Retorna o texto extraído. Mostra progresso via callback opcional.
  // ★ Configurações otimizadas para PDFs escaneados de apostilas:
  //   - scale 3x (melhor precisão que 2x, ainda razoável em memória)
  //   - PSM 3 (auto page segmentation — funciona para texto corrido e múltiplas colunas)
  //   - idiomas: português + inglês
  async function ocrPdfPage(pdfjs,doc,pageNum,progressCb){
    const page=await doc.getPage(pageNum);
    // escala 3x para melhorar precisão do OCR (testado: 2x = muita falha, 3x = bom)
    const viewport=page.getViewport({scale:3});
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');
    canvas.width=viewport.width;
    canvas.height=viewport.height;
    // fundo branco para páginas transparentes
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport}).promise;
    const Tesseract=await ensureTesseract();
    // idioma: português + inglês (modelos baixados do CDN do Tesseract)
    // ★ parâmetros otimizados:
    //   - tessedit_pageseg_mode=3 (auto — detecta orientação + colunas automaticamente)
    //   - preserve_interword_spaces=1 (mantém espaços entre palavras)
    const result=await Tesseract.recognize(
      canvas,
      'por+eng',
      {
        logger:m=>{
          if(m.status==='recognizing text'&&progressCb){
            progressCb(pageNum,doc.numPages,m.progress);
          }
        },
        // path dos modelos de idioma (CDN jsdelivr)
        corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
        workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        langPath:'https://tessdata.project-fast.com/4.0.0',
        // parâmetros do Tesseract engine
        tessedit_pageseg_mode:'3',
        preserve_interword_spaces:'1',
      }
    );
    return result.data.text||'';
  }

  // ── Extract text from PDF (up to 30 pages, ~8000 chars) ──
  // FIX: alguns PDFs têm texto selecionável mas getTextContent() básico
  // retorna vazio (fontes com encoding custom, text runs fragmentados).
  // Usa opções avançadas + fallback em annotations.
  // ★FIX v2: erros descritivos (não engole mais silenciosamente) + retry
  // com opções alternativas de fetch + fallback para PDFs escaneados.
  // ★FIX v3: OCR (Tesseract.js) como fallback quando pdf.js retorna vazio.
  //   - Suporta um callback de progresso (para mostrar "OCR: página 3/11…")
  //   - Limita a 8 páginas no OCR (tempo total ~2-4 min para PDF grande)
  //   - Idiomas: português + inglês
  async function extractPdfText(url, progressCb){
    const pdfjs=await ensurePdfjs();

    // ★ Tenta fetch com credenciais same-origin primeiro; se falhar,
    // tenta sem credenciais (alguns workers rejeitam cookies em fetch cross-origin)
    let resp;
    let fetchErr;
    const fetchOpts=[
      {credentials:'same-origin'},
      {credentials:'include'},
      {} // sem credenciais
    ];
    for(const opts of fetchOpts){
      try{
        resp=await fetch(url,opts);
        if(resp.ok)break;
      }catch(e){fetchErr=e;}
    }
    if(!resp||!resp.ok){
      const status=resp?resp.status:(fetchErr?fetchErr.message:'unknown');
      throw new Error('HTTP '+status+' ao baixar PDF');
    }
    const buf=await resp.arrayBuffer();
    if(!buf||buf.byteLength<100){
      throw new Error('PDF vazio ou muito pequeno ('+(buf?buf.byteLength:0)+' bytes)');
    }

    let doc;
    try{
      doc=await pdfjs.getDocument({data:buf,disableFontFace:true,isEvalSupported:false}).promise;
    }catch(e){
      throw new Error('pdf.js não conseguiu abrir o PDF: '+(e&&e.message||e));
    }
    const n=Math.min(doc.numPages,60);
    let txt='';

    for(let i=1;i<=n;i++){
      const pg=await doc.getPage(i);
      // ★ opções avançadas: normaliza whitespace, combina text items adjacentes,
      // inclui marked content (alguns PDFs usam isso para texto)
      let tc;
      try{
        tc=await pg.getTextContent({normalizeWhitespace:true,disableCombineTextItems:false,includeMarkedContent:true});
      }catch(_){
        tc=await pg.getTextContent(); // fallback sem opções
      }

      // extrai texto de items — x.str, x.str+hasEOL, também pega "transform" position
      let pageText='';
      for(const item of tc.items){
        if(item.str!==undefined){
          pageText+=item.str;
          if(item.hasEOL)pageText+='\n';
        }else if(item.type==='markedContent'||item.type==='beginMarkedContent'){
          // marked content — pode conter texto estruturado
          continue;
        }
      }

      // se página ficou vazia mas tem texto, tenta sem opções
      if(!pageText.trim()){
        try{
          const tc2=await pg.getTextContent();
          pageText=tc2.items.map(x=>(x.str||'')+(x.hasEOL?'\n':' ')).join('');
        }catch(_){}
      }

      txt+=pageText+'\n\n';
      if(txt.length>25000)break;
    }

    // ★ fallback: tenta extrair de annotations/form fields
    // (alguns PDFs têm texto em campos de formulário)
    if(!txt.trim()||txt.trim().length<50){
      try{
        for(let i=1;i<=n;i++){
          const pg=await doc.getPage(i);
          const annots=await pg.getAnnotations();
          for(const a of annots){
            if(a.fieldValue&&typeof a.fieldValue==='string')txt+=a.fieldValue+'\n';
            if(a.contents&&typeof a.contents==='string')txt+=a.contents+'\n';
          }
          if(txt.length>10000)break;
        }
      }catch(_){}
    }

    // ★★ FALLBACK OCR (Tesseract.js) — para PDFs escaneados (só imagens) ★★
    // Se pdf.js extraiu menos de 50 chars, é provável que o PDF seja escaneado.
    // Renderizamos cada página como imagem e rodamos OCR em português.
    // ★ Limita a 15 páginas no OCR (~3-6 min no total). Para PDFs maiores,
    // as primeiras 15 páginas já dão contexto suficiente para a Meggy gerar
    // resumo + questões + pílulas úteis.
    if(!txt.trim()||txt.trim().length<50){
      console.log('[Meggy] PDF sem texto selecionável — ativando OCR (Tesseract.js)');
      const ocrMaxPages=Math.min(doc.numPages,15);
      if(progressCb)progressCb({phase:'ocr-init',page:0,total:ocrMaxPages});
      try{
        let ocrTxt='';
        for(let i=1;i<=ocrMaxPages;i++){
          if(progressCb)progressCb({phase:'ocr-page',page:i,total:ocrMaxPages,progress:0});
          const pageTxt=await ocrPdfPage(pdfjs,doc,i,(pNum,pTotal,p)=>{
            if(progressCb)progressCb({phase:'ocr-page',page:pNum,total:pTotal,progress:p});
          });
          ocrTxt+=pageTxt+'\n\n';
          if(ocrTxt.length>20000)break;
        }
        if(ocrTxt.trim().length>50){
          // sucesso! OCR extraiu texto
          try{doc.destroy();}catch(_){}
          if(progressCb)progressCb({phase:'ocr-done',chars:ocrTxt.length});
          return ocrTxt.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,20000);
        }
      }catch(ocrErr){
        console.warn('[Meggy] OCR falhou:',ocrErr.message);
        // continua para o erro descritivo abaixo
      }
    }

    try{doc.destroy();}catch(_){}
    // limpa texto: remove espaços excessivos, decodifica entidades
    txt=txt.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
    const result=txt.slice(0,20000);
    if(!result||result.length<50){
      // ★ Erro descritivo: PDF provavelmente é escaneado (só imagens)
      // e o OCR também falhou ou não retornou texto útil
      throw new Error('PDF sem texto selecionável e OCR não conseguiu extrair. Possíveis causas:\n• PDF é composto só de imagens (escaneado) e o OCR falhou\n• PDF está criptografado ou corrompido\n• Falha ao baixar modelos de OCR do CDN (Tesseract.js)\n\nTente abrir o PDF num leitor comum para confirmar o conteúdo.');
    }
    return result;
  }

  // ── ISA call (POST /api/ai) ──
  async function callIsa(prompt){
    const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:prompt,messages:[]})});
    const data=await r.json();
    if(!data.ok)throw new Error(data.error||'Meggy indisponível');
    return data.response||'';
  }

  // ── Render Markdown (uses marked if available, fallback to <br>) ──
  function renderMd(txt){
    if(window.marked){try{return marked.parse(txt);}catch(_){}}
    return esc(txt).replace(/\n/g,'<br>');
  }

  // ── UI helpers ──
  function setLoading(bodyEl,msg){
    // ★ suporta \n e mensagens longas (OCR etc) — wrap e max-width
    const html=esc(msg).replace(/\n/g,'<br>');
    bodyEl.innerHTML=`<div class="gdi-mat-isa-loading" style="max-width:560px;margin:0 auto;padding:30px 20px;">
      <div class="gdi-mat-isa-spin"></div>
      <div style="text-align:center;font-size:13px;line-height:1.6;color:var(--ferreto-text,#e6edf3);">${html}</div>
      <div style="margin-top:14px;font-size:11px;color:var(--ferreto-text-muted,#8b949e);font-style:italic;">
        <i class="bi bi-info-circle"></i> Não feche esta aba — a geração continua em segundo plano.
      </div>
    </div>`;
  }
  function setError(bodyEl,msg){
    // ★ preserva quebras de linha para mensagens multi-linha (ex: erros de PDF)
    const html=esc(msg).replace(/\n/g,'<br>');
    bodyEl.innerHTML=`<div class="gdi-mat-isa-err" style="align-items:stretch;text-align:left;max-width:680px;margin:0 auto;padding:24px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--ferreto-border,#21262d);">
        <i class="bi bi-exclamation-triangle" style="font-size:28px;color:#ff8b8b;flex:none;"></i>
        <b style="color:#ff8b8b;font-size:15px;font-family:var(--ferreto-font-display,'Poppins',sans-serif);">Erro</b>
      </div>
      <div style="color:var(--ferreto-text,#e6edf3);font-size:13px;line-height:1.7;white-space:normal;">${html}</div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--ferreto-border,#21262d);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        <button id="gdi-err-retry" class="gdi-btn gdi-btn-primary" style="font-size:12px;"><i class="bi bi-arrow-clockwise"></i> Tentar novamente</button>
        <button id="gdi-err-close" class="gdi-mode-btn" style="font-size:12px;">Fechar</button>
      </div>
    </div>`;
    const retryBtn=bodyEl.querySelector('#gdi-err-retry');
    if(retryBtn)retryBtn.onclick=()=>{
      // volta para a aba de materiais (re-renderiza o M9)
      const matTabs=document.querySelector('#gdi-mat-tabs');
      const matBody=document.querySelector('#gdi-mat-body');
      if(matTabs&&matTabs.__items&&matBody){
        // re-dispara o click na aba Resumo Meggy
        const tab=matTabs.querySelector('[data-mat="isa-summary"]');
        if(tab)tab.click();
      }
    };
    const closeBtn=bodyEl.querySelector('#gdi-err-close');
    if(closeBtn)closeBtn.onclick=()=>{
      // volta para o primeiro PDF
      const matTabs=document.querySelector('#gdi-mat-tabs');
      if(matTabs){
        const firstTab=matTabs.querySelector('[data-mat="0"]');
        if(firstTab)firstTab.click();
      }
    };
  }

  // ── Question bank integration (replicates M23 addQ on LS) ──
  function addQ(obj){
    const q=lsGet(LQ,[]);
    q.push({id:uid(),createdAt:Date.now(),hits:0,misses:0,...obj});
    lsSet(LQ,q);
  }

  // ── Summaries storage ──
  function saveIsaSummary(lesson,summary){
    const arr=lsGet(LS_SUM,[]);
    arr.unshift({id:uid(),lesson:String(lesson||'Aula').slice(0,120),summary:String(summary||''),date:Date.now()});
    lsSet(LS_SUM,arr.slice(0,200));
  }
  function listIsaSummaries(){return lsGet(LS_SUM,[]);}
  function delIsaSummary(id){lsSet(LS_SUM,lsGet(LS_SUM,[]).filter(x=>x.id!==id));}

  // ── Download summary as PDF (via print dialog) ──
  function downloadAsPdf(lesson, markdownText){
    const html=renderMd(markdownText);
    const w=window.open('','_blank');
    if(!w){showToast('Permita pop-ups para baixar o PDF');return;}
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${esc(lesson)} — Resumo Meggy</title>
    <style>
      @page{margin:2cm;size:A4;}
      *{box-sizing:border-box;}
      body{font-family:'Georgia','Times New Roman',serif;color:#1a1a1a;line-height:1.7;max-width:210mm;margin:0 auto;padding:20px;}
      h1{font-family:'Helvetica',sans-serif;font-size:22px;color:#c026d3;border-bottom:2px solid #ff8b9f;padding-bottom:8px;margin-bottom:6px;}
      .meta{font-family:'Helvetica',sans-serif;font-size:11px;color:#666;margin-bottom:24px;}
      h2{font-family:'Helvetica',sans-serif;font-size:17px;color:#1a1a1a;margin-top:24px;border-left:3px solid #ff8b9f;padding-left:10px;}
      h3{font-family:'Helvetica',sans-serif;font-size:14px;color:#333;margin-top:18px;}
      p{margin:8px 0;text-align:justify;}
      ul,ol{margin:8px 0;padding-left:24px;}
      li{margin:4px 0;}
      code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:'Courier New',monospace;font-size:12px;}
      pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto;font-size:11px;}
      blockquote{border-left:3px solid #ff8b9f;margin:12px 0;padding:4px 16px;color:#555;font-style:italic;}
      strong{color:#1a1a1a;}
      @media print{body{padding:0;}}
    </style></head><body>
    <h1>${esc(lesson)}</h1>
    <div class="meta">Resumo gerado pela Meggy 🐩 · ${new Date().toLocaleDateString('pt-BR')}</div>
    ${html}
    <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
    </body></html>`);
    w.document.close();
  }

  // ── Copy summary to clipboard ──
  async function copySummary(text){
    try{
      await navigator.clipboard.writeText(text);
      showToast('Resumo copiado para a área de transferência');
    }catch(_){
      const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');showToast('Resumo copiado');}catch(_){showToast('Não foi possível copiar');}
      ta.remove();
    }
  }

  // ── Lesson key (cache key = URL pathname, estável entre visitas) ──
  function lessonKey(){return window.location.pathname.split('?')[0];}

  // ── Real lesson name from playlist (não "video.mp4") ──
  // A playlist tem .name que pode incluir o label da pasta (ex: "Aula 02 - ...").
  // Se não houver playlist, cai pro file header, depois pro base passado.
  function realLessonName(fallback){
    try{
      if(window.playlistVideos&&typeof window.currentIndex==='number'&&window.currentIndex>=0){
        const v=window.playlistVideos[window.currentIndex];
        if(v&&v.name&&v.name!=='video.mp4'&&v.name.length>3)return v.name;
        // tenta origName também
        if(v&&v.origName&&v.origName!=='video.mp4'&&v.origName.length>3)return v.origName;
      }
    }catch(_){}
    const h=document.querySelector('.gdi-file-header-name');
    if(h&&h.textContent&&h.textContent.trim().length>3)return h.textContent.trim();
    return fallback||'Aula';
  }

  // ── Drive cache (GET/POST /api/ai/cache) ──
  async function cacheGet(){
    try{
      const r=await fetch('/api/ai/cache?key='+encodeURIComponent(lessonKey()),{cache:'no-store'});
      const d=await r.json();
      return (d&&d.ok&&d.cached)?d.cached:null;
    }catch(_){return null;}
  }
  async function cacheSave(summary,questions,lessonName,mindmap){
    try{
      // ★FIX: se mindmap não foi passado, preserva o que já está no cache
      // (antes, ao adicionar mais questões, o cache era sobrescrito SEM mindmap)
      let mindmapToSave=mindmap;
      if(mindmapToSave===undefined){
        const existing=await cacheGet();
        mindmapToSave=(existing&&existing.mindmap)||null;
      }
      await fetch('/api/ai/cache',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key:lessonKey(),summary,questions,mindmap:mindmapToSave,lessonName})});
    }catch(_){/* não bloqueia o fluxo se o cache falhar */}
  }

  // ── Render summary card (structured layout + download/copy buttons) ──
  function renderSummaryCard(bodyEl, lesson, markdownText, fromCache){
    const cacheBadge=fromCache
      ?'<span style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);"><i class="bi bi-cloud-check" style="color:#3fb950;"></i> do cache do Drive</span>'
      :'<span style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);"><i class="bi bi-check2-circle" style="color:#3fb950;"></i> salvo no Drive + Central</span>';
    bodyEl.innerHTML=`<div class="gdi-mat-isa-result" style="max-width:760px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;padding:12px 16px;background:linear-gradient(135deg,rgba(255,139,159,.12),rgba(93,222,218,.06));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <i class="bi bi-stars" style="color:var(--ferreto-primary,#ff8b9f);font-size:20px;flex:none;"></i>
          <b style="color:var(--ferreto-text,#f0f6fc);font-family:var(--ferreto-font-display,'Poppins',sans-serif);font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Resumo Meggy 🐩 · ${esc(lesson)}</b>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${cacheBadge}
          <button id="gdi-isa-regen" title="Regerar (PDF pode estar incompleto)" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);color:var(--ferreto-text,#e6edf3);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px;transition:.15s;"><i class="bi bi-arrow-clockwise"></i> Regerar</button>
          <button id="gdi-isa-dl" title="Baixar em PDF" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);color:var(--ferreto-text,#e6edf3);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px;transition:.15s;"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
          <button id="gdi-isa-copy" title="Copiar resumo" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);color:var(--ferreto-text,#e6edf3);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px;transition:.15s;"><i class="bi bi-clipboard"></i> Copiar</button>
        </div>
      </div>
      <div class="gdi-isa-summary-body" style="background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;padding:20px 24px;color:var(--ferreto-text,#e6edf3);font-size:14px;line-height:1.8;">
        ${renderMd(markdownText)}
      </div>
    </div>`;
    bodyEl.querySelector('#gdi-isa-dl').onclick=()=>downloadAsPdf(lesson,markdownText);
    bodyEl.querySelector('#gdi-isa-copy').onclick=()=>copySummary(markdownText);
    // ★ botão Regerar: limpa cache e regenera resumo + questões
    const regenBtn=bodyEl.querySelector('#gdi-isa-regen');
    if(regenBtn)regenBtn.onclick=()=>{
      // busca os items do M9 para passar para regenerate
      const matTabs=document.querySelector('#gdi-mat-tabs');
      if(matTabs&&matTabs.__items){
        window.gdiIsaPdf.regenerate(matTabs.__items,bodyEl,lesson);
      }else{
        showToast('Navegue para a aba de materiais para regerar');
      }
    };
  }

  // ── Auto-criar flashcards das questões geradas ──
  // Cada questão vira um flashcard: frente = enunciado, verso = resposta certa + explicação
  // ★FIX: usa gdi-cards-v1 (mesma chave da Central de Estudos) em vez de gdi-fc-v1
  // ★FIX v2: agora salva urlPath (path real da aula) para permitir agrupar por
  // disciplina (pasta pai) e tema (nome da aula) na biblioteca de flashcards.
  function autoCreateFlashcards(questions,lesson,urlPath){
    const cards=lsGet('gdi-cards-v1',[]);
    let n=0;
    const path=urlPath||lessonKey()||lesson;
    questions.forEach(q=>{
      if(!q||!q.statement||!Array.isArray(q.options))return;
      const correctLetter=String.fromCharCode(65,q.correct||0);
      const correctText=q.options[q.correct||0]||'';
      const back=correctLetter+') '+correctText+(q.explanation?'\n\n💡 '+q.explanation:'');
      // evita duplicatas (mesma frente)
      const exists=cards.some(c=>c.f===q.statement);
      if(!exists){
        cards.push({id:uid(),f:q.statement,b:back,due:Date.now()+86400000,box:0,src:'ISA:'+lesson,path:path,lesson:lesson,createdAt:Date.now()});
        n++;
      }
    });
    if(n)lsSet('gdi-cards-v1',cards);
    return n;
  }

  // ── Extrai disciplina + tema de um path ou lesson name ──
  // path: URL pathname como "/0:/Direito Constitucional/Aula 02.mp4"
  // Retorna {discipline, theme} — usado pela biblioteca de flashcards (M9)
  function extractDisciplineTheme(card){
    let discipline='Geral',theme='Geral';
    const path=card.path||'';
    const lessonName=card.lesson||((card.src||'').replace(/^ISA:/,'').replace(/^manual:/,''))||'';
    // tenta extrair do path (URL)
    if(path&&path.charAt(0)==='/'){
      try{
        const segs=normPath(path).split('/').filter(Boolean);
        // segs[0]="0:" (drive id); segs[1..n-1]=pastas; segs[n]=arquivo
        if(segs.length>=3){
          discipline=segs[1];
          // tema = última pasta antes do arquivo (ou o próprio arquivo sem extensão)
          const themeSegs=segs.slice(2,-1);
          theme=themeSegs.length?themeSegs.join(' / '):stripExt(segs[segs.length-1]);
        }else if(segs.length===2){
          discipline=segs[1];
          theme='Geral';
        }
      }catch(_){}
    }
    // fallback: heurística no lessonName ("Disciplina - Tema" ou só "Tema")
    if(discipline==='Geral'&&lessonName&&lessonName.length>3){
      const parts=lessonName.split(/\s*[-–—|·]\s*/).filter(p=>p.trim());
      if(parts.length>=2){
        // disciplina = maior segmento (heurística); tema = resto
        const sorted=parts.map((p,i)=>({p:p.trim(),i,len:p.trim().length})).sort((a,b)=>b.len-a.len);
        discipline=sorted[0].p;
        theme=parts.filter((_,i)=>i!==sorted[0].i).join(' - ').trim()||'Geral';
      }else{
        theme=lessonName;
      }
    }else if(theme==='Geral'&&lessonName&&lessonName.length>3){
      theme=lessonName;
    }
    return{discipline,theme};
  }
  function normPath(p){try{return decodeURIComponent(String(p||''))}catch(_){return String(p||'')}}
  function stripExt(s){return String(s||'').replace(/\.[a-z0-9]{1,5}$/i,'').trim()};

  // ── GERAÇÃO EM CADEIA: resumo + pílulas + questões ──
  // Qualquer aba clicada (Resumo/Questões/Pílulas) dispara a geração
  // dos 3 em cadeia se ainda não existirem. Cada um é salvo no Drive.
  // As questões ciclam entre TODOS os PDFs, gerando até 20 por material.

  // Cache em memória para evitar regenerar na mesma sessão
  let _chainCache={};

  // Extrai questões que já existem dentro do PDF (lista de exercícios)
  function extractQuestionsFromText(text){
    const questions=[];
    // padrão: "1." ou "1)" seguido de texto até "?"
    const re=/(\d+[\).]\s+)([^?]+\?)/gi;
    let m;
    while((m=re.exec(text))!==null&&questions.length<20){
      const q=m[2].trim();
      if(q.length>20&&q.length<500)questions.push(q);
    }
    return questions;
  }

  // callIsa para tarefas paralelas — SEM header customizado (evita CORS)
  // O worker já faz round-robin entre as chaves NVIDIA automaticamente.
  // Requisições paralelas naturalmente usam chaves diferentes.
  async function callIsaKeyed(prompt,keyHint){
    return callIsa(prompt);
  }

  // Gera TODOS os materiais EM PARALELO TOTAL (não em cascata)
  // Cada tarefa usa uma chave NVIDIA diferente (se houver múltiplas)
  async function generateAll(items,lesson,trigger,progressCb){
    const key=lessonKey();
    // se já tem tudo no cache em memória, pula
    if(_chainCache[key]&&_chainCache[key].summary&&_chainCache[key].mindmap&&_chainCache[key].questionsGenerated){
      return _chainCache[key];
    }

    // verifica cache do Drive PRIMEIRO (antes de extrair PDF)
    const cached=await cacheGet();
    if(!_chainCache[key])_chainCache[key]={};
    if(cached){
      _chainCache[key].summary=cached.summary||null;
      _chainCache[key].mindmap=cached.mindmap||null;
      _chainCache[key].cachedQuestions=cached.questions||[];
    }

    // ★ Se já tem resumo + pílulas + questões no Drive, carrega e NÃO regenera
    if(_chainCache[key].summary&&_chainCache[key].mindmap&&cached&&cached.questions&&cached.questions.length){
      _chainCache[key].questionsGenerated=true;
      _chainCache[key].questions=cached.questions;
      // carrega questões no banco local se ainda não estão
      cached.questions.forEach(q=>{
        if(q&&q.statement){
          let cleanQ;
          if(q.type==='tf'||(!q.options&&q.correct!==undefined)){
            cleanQ={subject:lesson,type:'tf',statement:String(q.statement),options:['Certo','Errado'],correct:Math.max(0,Math.min(1,Number(q.correct)||0)),explanation:String(q.explanation||''),source:'ISA-PDF'};
          }else if(Array.isArray(q.options)){
            cleanQ={subject:lesson,type:'mc',statement:String(q.statement),options:q.options.map(String),correct:Math.max(0,Math.min(3,Number(q.correct)||0)),explanation:String(q.explanation||''),source:'ISA-PDF'};
          }
          if(cleanQ){
            const all=lsGet(LQ,[]);
            if(!all.some(x=>x.statement===cleanQ.statement))addQ(cleanQ);
          }
        }
      });
      // flashcards do cache
      if(cached.questions.length)autoCreateFlashcards(cached.questions,lesson,lessonKey());
      saveIsaSummary(lesson,_chainCache[key].summary);
      console.log('[Meggy] cache completo do Drive — sem retrabalho');
      return _chainCache[key];
    }

    // só extrai PDF se precisa gerar algo
    let allText='';
    const pdfTexts=[];
    const pdfErrors=[]; // ★ coleta erros por PDF para diagnóstico
    for(const item of items){
      try{
        if(progressCb)progressCb({phase:'extract',pdf:item.name});
        const txt=await extractPdfText(item.url,(p)=>{
          if(progressCb)progressCb(Object.assign({pdf:item.name},p));
        });
        if(txt&&txt.trim().length>50){
          allText+=(allText?'\n\n---\n\n':'')+txt;
          pdfTexts.push({name:item.name,text:txt});
        }
      }catch(e){
        // ★ guarda o erro com nome do PDF para mostrar depois
        pdfErrors.push({name:item.name,error:e.message||String(e),url:item.url});
        console.warn('[Meggy] PDF falhou:',item.name,e.message);
      }
    }
    if(!allText||allText.trim().length<50){
      // ★ Mensagem detalhada com os erros de cada PDF
      let detail='Não foi possível extrair texto dos PDFs.';
      if(pdfErrors.length){
        detail+=' Erros por arquivo:\n';
        pdfErrors.forEach(e=>{
          detail+='• '+e.name+': '+e.error+'\n';
        });
        // sugestões baseadas no tipo de erro
        const hasHttp=pdfErrors.some(e=>/HTTP/.test(e.error));
        const hasScanned=pdfErrors.some(e=>/escaneado|sem texto/i.test(e.error));
        const hasPdfjs=pdfErrors.some(e=>/pdf\.js/.test(e.error));
        detail+='\nSugestões:\n';
        if(hasHttp)detail+='• Verifique se o PDF está acessível (sem proteção de link) e se você está logado.\n';
        if(hasScanned)detail+='• Alguns PDFs são escaneados (só imagens) — a Meggy não faz OCR ainda.\n';
        if(hasPdfjs)detail+='• O PDF pode estar corrompido ou criptografado.\n';
        if(!hasHttp&&!hasScanned&&!hasPdfjs)detail+='• Tente abrir o PDF no navegador para confirmar que carrega normalmente.\n';
      }
      throw new Error(detail);
    }
    _chainCache[key].allText=allText;
    _chainCache[key].pdfTexts=pdfTexts;

    // ★ PARALELISMO TOTAL: resumo + pílulas + questões de cada PDF — TODOS ao mesmo tempo
    // Cada tarefa recebe um keyHint diferente para distribuir entre as APIs NVIDIA
    let keyHintCounter=0;
    const allTasks=[];

    // tarefa 1: resumo
    if(!_chainCache[key].summary){
      allTasks.push({
        hint:keyHintCounter++,
        fn:()=>callIsaKeyed('Leia este material de aula e faça um resumo COMPLETO e estruturado em Markdown. Cubra TODOS os tópicos. Organize em seções com ## títulos, use **negrito** para destaques e listas. Não omita nenhum tema:\n\n'+allText.slice(0,20000),keyHintCounter-1)
          .then(r=>{if(r&&r.trim()){_chainCache[key].summary=r;saveIsaSummary(lesson,r);}})
          .catch(e=>console.warn('[Meggy] resumo falhou',e.message))
      });
    }

    // tarefa 2: pílulas
    if(!_chainCache[key].mindmap){
      allTasks.push({
        hint:keyHintCounter++,
        fn:()=>callIsaKeyed('Crie "Pílulas" deste material — um resumo ultra-conciso em bullets. Apenas pontos-chave para revisão rápida. Máximo 15 bullets. Formato:\n# Pílulas\n- Ponto-chave 1\n- Ponto-chave 2\n...\n\nConteúdo:\n'+allText.slice(0,20000),keyHintCounter-1)
          .then(r=>{if(r&&r.trim())_chainCache[key].mindmap=r;})
          .catch(e=>console.warn('[Meggy] pílulas falhou',e.message))
      });
    }

    // tarefa 3+: questões de cada PDF (uma tarefa por PDF)
    if(!_chainCache[key].questionsGenerated){
      _chainCache[key].questionsGenerated=true;
      _chainCache[key]._allCleanQ=[];
      // extrai questões existentes primeiro (síncrono, rápido)
      for(const pdf of pdfTexts){
        const existing=extractQuestionsFromText(pdf.text);
        for(const q of existing){
          const all=lsGet(LQ,[]);
          if(!all.some(x=>x.statement===q)){
            addQ({subject:lesson,type:'open',statement:q,options:[],correct:0,explanation:'Questão extraída do material.',source:'PDF-extract'});
          }
        }
      }
      // uma tarefa por PDF
      pdfTexts.forEach((pdf)=>{
        allTasks.push({
          hint:keyHintCounter++,
          fn:()=>callIsaKeyed('Baseado neste material, gere 10 questões de concurso público em JSON array. Misture:\n- 6 múltipla escolha: {"type":"mc","statement":"...","options":["a","b","c","d"],"correct":0,"explanation":"..."}\n- 4 certo/errado (CEBRASPE): {"type":"tf","statement":"...","correct":1,"explanation":"..."}\nSem comentários, só JSON:\n\n'+pdf.text.slice(0,15000),keyHintCounter-1)
            .then(resp=>{
              if(!resp)return;
              try{
                const arr=parseJsonArray(resp);
                arr.forEach(q=>{
                  if(!q||!q.statement)return;
                  let cleanQ;
                  if(q.type==='tf'||(!q.options&&q.correct!==undefined)){
                    cleanQ={type:'tf',statement:String(q.statement),options:['Certo','Errado'],correct:Math.max(0,Math.min(1,Number(q.correct)||0)),explanation:String(q.explanation||'')};
                  }else if(Array.isArray(q.options)){
                    cleanQ={type:'mc',statement:String(q.statement),options:q.options.map(String),correct:Math.max(0,Math.min(3,Number(q.correct)||0)),explanation:String(q.explanation||'')};
                  }
                  if(cleanQ){
                    const all=lsGet(LQ,[]);
                    if(!all.some(x=>x.statement===cleanQ.statement)){
                      addQ({subject:lesson,...cleanQ,source:'ISA-PDF'});
                      _chainCache[key]._allCleanQ.push(cleanQ);
                    }
                  }
                });
              }catch(e){console.warn('[Meggy] parse questões falhou',e.message);}
            })
            .catch(e=>console.warn('[Meggy] questões falharam',e.message))
        });
      });
    }

    // ★ EXECUTA TODAS AS TAREFAS AO MESMO TEMPO
    if(allTasks.length>0){
      await Promise.allSettled(allTasks.map(t=>t.fn()));
    }

    // finaliza: flashcards + salva no Drive
    _chainCache[key].questions=_chainCache[key]._allCleanQ||[];
    if(_chainCache[key].questions.length){
      autoCreateFlashcards(_chainCache[key].questions,lesson,lessonKey());
    }

    // salva TUDO no Drive em um único POST (resumo + pílulas + questões)
    try{
      await fetch('/api/ai/cache',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          key:lessonKey(),
          summary:_chainCache[key].summary||null,
          questions:_chainCache[key].questions||null,
          mindmap:_chainCache[key].mindmap||null,
          lessonName:lesson
        })});
    }catch(_){}
    // compartilha no pool de resumos
    if(_chainCache[key].summary){
      saveSharedSummary(lesson,_chainCache[key].summary,_chainCache[key].questions||null);
    }

    return _chainCache[key];
  }

  // ── Summary flow (com cadeia) ──
  async function summary(items,bodyEl,lessonName){
    if(!items||!items.length){setError(bodyEl,'Nenhum PDF disponível.');return;}
    const lesson=realLessonName(lessonName||items[0].name);
    bodyEl.__items=items;bodyEl.__lesson=lesson;
    setLoading(bodyEl,'Meggy está lendo o material e criando resumo + questões + pílulas…');
    try{
      const result=await generateAll(items,lesson,'summary',(p)=>{
        // ★ feedback de progresso durante extração/OCR
        if(p.phase==='extract')setLoading(bodyEl,'Extraindo texto: '+p.pdf+'…');
        else if(p.phase==='ocr-init')setLoading(bodyEl,'PDF escaneado detectado — iniciando OCR (pode levar alguns minutos)…');
        else if(p.phase==='ocr-page')setLoading(bodyEl,'OCR em andamento — página '+p.page+' de '+p.total+(p.progress?(' ('+Math.round(p.progress*100)+'%)'):'')+'…');
        else if(p.phase==='ocr-done')setLoading(bodyEl,'OCR concluído ('+p.chars+' caracteres extraídos). Gerando resumo…');
      });
      if(!result.summary){setError(bodyEl,'Meggy não conseguiu gerar o resumo.');return;}
      renderSummaryCard(bodyEl,lesson,result.summary,false);
      // badge com tudo que foi gerado
      const qCount=result.questions?result.questions.length:0;
      const badge=document.createElement('div');
      badge.style.cssText='background:rgba(63,185,80,.1);border:1px solid rgba(63,185,80,.3);border-radius:10px;padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:12px;color:#3fb950;flex-wrap:wrap;';
      let badgeHtml='<i class="bi bi-check-circle-fill"></i> <b>Gerado em cadeia:</b> ';
      const parts=[];
      if(result.summary)parts.push('✓ Resumo');
      if(result.mindmap)parts.push('✓ Pílulas');
      if(qCount>0)parts.push('✓ '+qCount+' questões');
      badgeHtml+=parts.join(' · ')+' + flashcards';
      badge.innerHTML=badgeHtml;
      bodyEl.querySelector('.gdi-mat-isa-result')?.insertBefore(badge,bodyEl.querySelector('.gdi-mat-isa-result').firstChild);
      showToast('Resumo + pílulas + '+qCount+' questões gerados!');
    }catch(e){setError(bodyEl,e.message);return;}
  }

  // ── Track answered questions (evita repetir) ──
  const ANSWERED_KEY='gdi-answered-questions-v1';
  function getAnsweredIds(){try{return JSON.parse(localStorage.getItem(ANSWERED_KEY)||'[]')}catch(_){return []}}
  function markAnswered(id){const arr=getAnsweredIds();if(!arr.includes(id)){arr.push(id);if(arr.length>500)arr.shift();try{localStorage.setItem(ANSWERED_KEY,JSON.stringify(arr))}catch(_){}}}

  // ── Questions flow: gera tudo em cadeia + abre quiz ──
  async function questions(items,bodyEl,lessonName){
    if(!items||!items.length){setError(bodyEl,'Nenhum PDF disponível.');return;}
    const lesson=realLessonName(lessonName||items[0].name);
    bodyEl.__items=items;bodyEl.__lesson=lesson;
    setLoading(bodyEl,'Meggy está lendo todos os materiais e criando resumo + pílulas + questões…');
    try{
      await generateAll(items,lesson,'questions',(p)=>{
        if(p.phase==='extract')setLoading(bodyEl,'Extraindo texto: '+p.pdf+'…');
        else if(p.phase==='ocr-init')setLoading(bodyEl,'PDF escaneado detectado — iniciando OCR (pode levar alguns minutos)…');
        else if(p.phase==='ocr-page')setLoading(bodyEl,'OCR em andamento — página '+p.page+' de '+p.total+(p.progress?(' ('+Math.round(p.progress*100)+'%)'):'')+'…');
        else if(p.phase==='ocr-done')setLoading(bodyEl,'OCR concluído ('+p.chars+' caracteres). Gerando questões…');
      });
    }catch(e){setError(bodyEl,e.message);return;}
    // carrega questões do cache se existirem
    const cached=await cacheGet();
    if(cached&&cached.questions&&Array.isArray(cached.questions)&&cached.questions.length){
      cached.questions.forEach(q=>{
        if(q&&q.statement){
          let cleanQ;
          if(q.type==='tf'||(!q.options&&q.correct!==undefined)){
            cleanQ={subject:lesson,type:'tf',statement:String(q.statement),options:['Certo','Errado'],correct:Math.max(0,Math.min(1,Number(q.correct)||0)),explanation:String(q.explanation||''),source:'ISA-PDF'};
          }else if(Array.isArray(q.options)){
            cleanQ={subject:lesson,type:'mc',statement:String(q.statement),options:q.options.map(String),correct:Math.max(0,Math.min(3,Number(q.correct)||0)),explanation:String(q.explanation||''),source:'ISA-PDF'};
          }
          if(cleanQ){
            const all=lsGet(LQ,[]);
            if(!all.some(x=>x.statement===cleanQ.statement))addQ(cleanQ);
          }
        }
      });
    }
    startQuizFromBank(bodyEl,lesson);
  }

  // ── generateQuestions: gera mais questões de um PDF específico (para "Gerar mais 5") ──
  if(!window.__gdiPdfCursor)window.__gdiPdfCursor=0;
  async function generateQuestions(items,bodyEl,lesson){
    if(!items||!items.length)return false;
    const pdfIdx=window.__gdiPdfCursor%items.length;
    window.__gdiPdfCursor++;
    const pdfItem=items[pdfIdx];
    setLoading(bodyEl,'Extraindo texto do PDF: '+esc(pdfItem.name||'material')+'…');
    let text;
    try{
      text=await extractPdfText(pdfItem.url);
    }catch(e){
      for(let i=1;i<items.length;i++){
        const next=items[(pdfIdx+i)%items.length];
        try{
          text=await extractPdfText(next.url);
          if(text&&text.trim().length>=50)break;
        }catch(_){}
      }
      if(!text||text.trim().length<50){setError(bodyEl,'Falha ao extrair texto.');return false;}
    }
    if(!text||text.trim().length<50){setError(bodyEl,'PDF sem texto extraível.');return false;}
    setLoading(bodyEl,'Meggy está criando questões…');
    let resp;
    try{
      resp=await callIsa('Baseado neste material, gere 5 questões de concurso público em JSON array. Misture:\n- 3 múltipla escolha: {"type":"mc","statement":"...","options":["a","b","c","d"],"correct":0,"explanation":"..."}\n- 2 certo/errado (CEBRASPE): {"type":"tf","statement":"...","correct":1,"explanation":"..."}\nSem comentários, só JSON:\n\n'+text.slice(0,15000));
    }catch(e){setError(bodyEl,'Meggy indisponível: '+e.message);return false;}
    let arr;
    try{arr=parseJsonArray(resp);}catch(e){setError(bodyEl,'Meggy retornou formato inválido: '+e.message);return false;}
    const cleanArr=[];
    arr.forEach(q=>{
      if(!q||!q.statement)return;
      let cleanQ;
      if(q.type==='tf'||(!q.options&&q.correct!==undefined)){
        cleanQ={subject:lesson,type:'tf',statement:String(q.statement),options:['Certo','Errado'],correct:Math.max(0,Math.min(1,Number(q.correct)||0)),explanation:String(q.explanation||''),source:'ISA-PDF'};
      }else if(Array.isArray(q.options)){
        cleanQ={subject:lesson,type:'mc',statement:String(q.statement),options:q.options.map(String),correct:Math.max(0,Math.min(3,Number(q.correct)||0)),explanation:String(q.explanation||''),source:'ISA-PDF'};
      }
      if(cleanQ){
        const all=lsGet(LQ,[]);
        if(!all.some(x=>x.statement===cleanQ.statement)){
          addQ(cleanQ);
          cleanArr.push({type:cleanQ.type,statement:cleanQ.statement,options:cleanQ.options,correct:cleanQ.correct,explanation:cleanQ.explanation});
        }
      }
    });
    if(cleanArr.length){
      const existing=await cacheGet();
      const merged=[...((existing&&existing.questions)||[]),...cleanArr];
      cacheSave(existing?.summary||null,merged,lesson);
    }
    showToast(cleanArr.length+' questões geradas!');
    return cleanArr.length>0;
  }

  // ── Inicia quiz com questões do banco (não respondidas) ──
  function startQuizFromBank(bodyEl,lesson){
    const all=lsGet(LQ,[]);
    const answered=getAnsweredIds();
    // questões desta matéria que ainda não foram respondidas
    let pending=all.filter(q=>q.subject===lesson&&!answered.includes(q.id));
    // se não tem nenhuma não-respondida, pega todas desta matéria (reinicia ciclo)
    if(pending.length===0){
      pending=all.filter(q=>q.subject===lesson);
      // limpa answered para esta matéria (reinicia)
      const newAnswered=answered.filter(id=>!all.some(q=>q.id===id&&q.subject===lesson));
      try{localStorage.setItem(ANSWERED_KEY,JSON.stringify(newAnswered))}catch(_){}
    }
    if(pending.length===0){
      bodyEl.innerHTML=`<div class="gdi-mat-isa-result" style="text-align:center;padding:30px;">
        <div style="font-size:48px;">📝</div>
        <h3 style="color:var(--ferreto-primary,#ff8b9f);font-family:var(--ferreto-font-display,'Poppins',sans-serif);">Nenhuma questão disponível ainda</h3>
        <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin-top:8px;">Matéria: <b style="color:var(--ferreto-text,#e6edf3);">${esc(lesson)}</b></p>
        <button id="gdi-q-gen-more" class="gdi-btn gdi-btn-primary" style="margin-top:14px;"><i class="bi bi-stars"></i> Gerar 5 questões com Meggy</button>
      </div>`;
      bodyEl.querySelector('#gdi-q-gen-more').onclick=async()=>{
        const ok=await generateQuestions(bodyEl.__items||[],bodyEl,lesson);
        if(ok)startQuizFromBank(bodyEl,lesson);
      };
      return;
    }
    // pega até 5 questões
    const batch=pending.slice(0,5);
    runQuizSession(bodyEl,lesson,batch);
  }

  // ── Roda uma sessão de quiz interativo ──
  function runQuizSession(bodyEl,lesson,queue){
    let idx=0,hits=0,misses=0;
    function draw(){
      if(idx>=queue.length){
        // fim do batch
        const total=queue.length;
        const pct=Math.round(hits/total*100);
        bodyEl.innerHTML=`<div class="gdi-mat-isa-result" style="max-width:760px;text-align:center;">
          <div style="font-size:48px;">${pct>=60?'🎉':'📚'}</div>
          <h3 style="color:var(--ferreto-primary,#ff8b9f);font-family:var(--ferreto-font-display,'Poppins',sans-serif);">Batch concluído!</h3>
          <p style="color:var(--ferreto-text,#e6edf3);font-size:16px;margin-top:8px;"><b style="color:${pct>=60?'#3fb950':'#ff8b8b'};">${hits}/${total}</b> · ${pct}% acerto</p>
          <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">Matéria: ${esc(lesson)}</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:18px;flex-wrap:wrap;">
            <button id="gdi-q-more" class="gdi-btn gdi-btn-primary"><i class="bi bi-stars"></i> Gerar mais 5 questões</button>
            <button id="gdi-q-next-batch" class="gdi-mode-btn"><i class="bi bi-arrow-right"></i> Próximo batch</button>
          </div>
        </div>`;
        // Gerar mais 5 questões
        bodyEl.querySelector('#gdi-q-more').onclick=async()=>{
          const ok=await generateQuestions(bodyEl.__items||[],bodyEl,lesson);
          if(ok)startQuizFromBank(bodyEl,lesson);
          else startQuizFromBank(bodyEl,lesson); // tenta de novo com o que tem
        };
        // Próximo batch (questões que ainda não foram respondidas)
        bodyEl.querySelector('#gdi-q-next-batch').onclick=()=>startQuizFromBank(bodyEl,lesson);
        return;
      }
      const q=queue[idx];
      const isTF=q.type==='tf';
      const optCount=isTF?2:(q.options?.length||4);
      bodyEl.innerHTML=`<div class="gdi-mat-isa-result" style="max-width:760px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-shrink:0;">
          <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">${esc(lesson)} · ${idx+1}/${queue.length}</span>
          <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">✓ ${hits} ✗ ${misses}</span>
        </div>
        <div class="gdi-course" style="margin-bottom:14px;">
          <b style="color:var(--ferreto-secondary,#5ddeda);font-size:11px;display:block;margin-bottom:8px;">${isTF?'CEBRASPE — Certo ou Errado':'Múltipla Escolha'}</b>
          <div style="color:var(--ferreto-text,#f0f6fc);font-size:14px;line-height:1.7;">${esc(q.statement)}</div>
        </div>
        <div id="gdi-q-opts" style="display:flex;flex-direction:column;gap:8px;"></div>
        <div id="gdi-q-feedback" style="margin-top:14px;"></div>
        <div style="display:flex;justify-content:flex-end;padding-top:14px;margin-top:10px;border-top:1px solid var(--ferreto-border,#21262d);">
          <button id="gdi-q-skip" title="Pular para próxima questão" style="width:48px;height:48px;border-radius:50%;border:0;cursor:pointer;background:linear-gradient(135deg,#ff8b9f,#c026d3);color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px -4px rgba(255,139,159,.5);transition:transform .15s;"><i class="bi bi-arrow-right"></i></button>
        </div>
      </div>`;
      // ★ seta fixa para pular questão (mesmo sem responder)
      const skipBtn=bodyEl.querySelector('#gdi-q-skip');
      if(skipBtn){
        skipBtn.onmouseenter=()=>{skipBtn.style.transform='scale(1.1)';};
        skipBtn.onmouseleave=()=>{skipBtn.style.transform='scale(1)';};
        skipBtn.onclick=()=>{
          // se ainda não respondeu, marca como errada (pulo = não sabe)
          const feedbackEl=bodyEl.querySelector('#gdi-q-feedback');
          if(feedbackEl&&!feedbackEl.innerHTML){
            misses++;
            markAnswered(q.id);
            if(window.__gdiGradeQ)window.__gdiGradeQ(q.id,false);
          }
          if(idx+1<queue.length){idx++;draw();}
          else{idx++;draw();} // vai pro resultado
        };
      }
      const optsEl=bodyEl.querySelector('#gdi-q-opts');
      const options=q.options||(isTF?['Certo','Errado']:['a','b','c','d']);
      options.forEach((opt,i)=>{
        const b=document.createElement('button');
        b.className='gdi-note';b.style.cursor='pointer';b.style.textAlign='left';
        const letter=isTF?'':String.fromCharCode(65+i)+') ';
        b.innerHTML=`<span style="display:flex;align-items:center;gap:10px;"><b style="color:var(--ferreto-primary,#ff8b9f);">${letter}</b> <span style="color:var(--ferreto-text,#e6edf3);">${esc(opt)}</span></span>`;
        b.onclick=()=>{
          const acertou=i===q.correct;
          if(acertou)hits++;else misses++;
          markAnswered(q.id);
          // grade no SRS
          if(window.__gdiGradeQ)window.__gdiGradeQ(q.id,acertou);
          optsEl.querySelectorAll('button').forEach((bb,bi)=>{
            bb.disabled=true;bb.style.cursor='default';bb.style.opacity='.7';
            if(bi===q.correct)bb.style.background='rgba(63,185,80,.18)';
            if(bi===i&&!acertou)bb.style.background='rgba(255,107,107,.18)';
          });
          const fb=bodyEl.querySelector('#gdi-q-feedback');
          fb.innerHTML=`<div class="gdi-course" style="border-left:3px solid ${acertou?'#3fb950':'#ff6b6b'};">
            <b style="color:${acertou?'#3fb950':'#ff6b6b'};">${acertou?'✓ Correto':'✗ Errado'}</b>
            ${q.explanation?`<div style="color:var(--ferreto-text,#e6edf3);font-size:13px;margin-top:6px;line-height:1.5;">${esc(q.explanation)}</div>`:''}
          </div>
          <button class="gdi-btn gdi-btn-primary" id="gdi-q-next" style="margin-top:12px;">${idx+1<queue.length?'Próxima →':'Ver resultado'}</button>`;
          fb.querySelector('#gdi-q-next').onclick=()=>{idx++;draw();};
        };
        optsEl.appendChild(b);
      });
    }
    draw();
  }

  // ── Pílulas flow (antes "Mapa Mental") — gera em cadeia ──
  async function mindmap(items,bodyEl,lessonName){
    if(!items||!items.length){setError(bodyEl,'Nenhum PDF disponível.');return;}
    const lesson=realLessonName(lessonName||items[0].name);
    bodyEl.__items=items;bodyEl.__lesson=lesson;
    setLoading(bodyEl,'Meggy está lendo o material e criando pílulas + resumo + questões…');
    try{
      const result=await generateAll(items,lesson,'mindmap',(p)=>{
        if(p.phase==='extract')setLoading(bodyEl,'Extraindo texto: '+p.pdf+'…');
        else if(p.phase==='ocr-init')setLoading(bodyEl,'PDF escaneado detectado — iniciando OCR (pode levar alguns minutos)…');
        else if(p.phase==='ocr-page')setLoading(bodyEl,'OCR em andamento — página '+p.page+' de '+p.total+(p.progress?(' ('+Math.round(p.progress*100)+'%)'):'')+'…');
        else if(p.phase==='ocr-done')setLoading(bodyEl,'OCR concluído ('+p.chars+' caracteres). Gerando pílulas…');
      });
      if(!result.mindmap){setError(bodyEl,'Meggy não conseguiu gerar as pílulas.');return;}
      bodyEl.innerHTML=`<div class="gdi-mat-isa-result" style="max-width:760px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;padding:12px 16px;background:linear-gradient(135deg,rgba(255,139,159,.12),rgba(93,222,218,.06));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;flex-wrap:wrap;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <i class="bi bi-capsule" style="color:var(--ferreto-primary,#ff8b9f);font-size:20px;flex:none;"></i>
            <b style="color:var(--ferreto-text,#f0f6fc);font-family:var(--ferreto-font-display,'Poppins',sans-serif);font-size:15px;">Pílulas · ${esc(lesson)}</b>
          </div>
          <button id="gdi-mm-dl" title="Baixar em PDF" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);color:var(--ferreto-text,#e6edf3);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px;"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
        </div>
        <div class="gdi-isa-summary-body gdi-mental-map" style="background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;padding:20px 24px;color:var(--ferreto-text,#e6edf3);font-size:14px;line-height:1.8;">
          ${renderMd(result.mindmap)}
        </div>
      </div>`;
      bodyEl.querySelector('#gdi-mm-dl').onclick=()=>downloadAsPdf('Pílulas · '+lesson,result.mindmap);
      // badge com tudo que foi gerado em cadeia
      const qCount=result.questions?result.questions.length:0;
      if(result.summary||qCount>0){
        const badge=document.createElement('div');
        badge.style.cssText='background:rgba(63,185,80,.1);border:1px solid rgba(63,185,80,.3);border-radius:10px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:#3fb950;';
        const parts=[];
        if(result.summary)parts.push('✓ Resumo');
        if(qCount>0)parts.push('✓ '+qCount+' questões');
        badge.innerHTML='<i class="bi bi-check-circle-fill"></i> <b>Gerado em cadeia:</b> '+parts.join(' · ');
        bodyEl.querySelector('.gdi-mat-isa-result')?.insertBefore(badge,bodyEl.querySelector('.gdi-mat-isa-result').firstChild);
      }
      showToast('Pílulas geradas!');
    }catch(e){setError(bodyEl,e.message);return;}
  }

  // ── Flashcards flow (aba no M9 — BIBLIOTECA organizada por disciplina → tema) ──
  // ★FIX v3: agora mostra TODOS os flashcards (não só da aula atual),
  // agrupados por disciplina (pasta pai) → tema (aula). Cada card é um
  // flip card 3D de verdade (frente/verso). Botão "Gerar com Meggy"
  // dispara a cadeia de geração quando a biblioteca está vazia.
  async function flashcards(items, bodyEl, lessonName){
    const lesson = realLessonName(lessonName || (items[0] && items[0].name) || 'Aula');
    const urlPath = lessonKey();
    const allCards = lsGet('gdi-cards-v1', []);

    // ── Agrupa por disciplina → tema ──
    const grouped = {};
    allCards.forEach(c=>{
      const {discipline, theme} = extractDisciplineTheme(c);
      if(!grouped[discipline]) grouped[discipline] = {};
      if(!grouped[discipline][theme]) grouped[discipline][theme] = [];
      grouped[discipline][theme].push(c);
    });
    const disciplines = Object.keys(grouped).sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const totalDue = allCards.filter(c=>(c.due||0)<=Date.now()).length;

    // ── Empty state ──
    if(!allCards.length){
      bodyEl.innerHTML = `
        <div class="gdi-mat-isa-result gdi-fc-library">
          <div class="gdi-fc-empty">
            <div class="gdi-fc-empty-icon">🃏</div>
            <h3>Nenhum flashcard ainda</h3>
            <p>Os flashcards são criados automaticamente quando a Meggy gera resumos, questões ou pílulas das aulas. Você também pode adicionar manualmente abaixo.</p>
            <button id="gdi-fc-gen-btn" class="gdi-btn gdi-btn-primary">
              <i class="bi bi-stars"></i> Gerar com a Meggy
            </button>
            <div class="gdi-fc-manual-wrap">
              <button id="gdi-fc-manual-toggle" class="gdi-mode-btn">
                <i class="bi bi-plus-lg"></i> Adicionar manualmente
              </button>
              <div id="gdi-fc-manual-form" style="display:none;">
                <input id="gdi-fc-manual-f" placeholder="Frente (pergunta)" />
                <input id="gdi-fc-manual-b" placeholder="Verso (resposta)" />
                <button id="gdi-fc-manual-add" class="gdi-btn gdi-btn-primary">
                  <i class="bi bi-check-lg"></i> Salvar flashcard
                </button>
              </div>
            </div>
          </div>
        </div>`;
      const genBtn = bodyEl.querySelector('#gdi-fc-gen-btn');
      if(genBtn) genBtn.onclick = async ()=>{
        if(window.gdiIsaPdf && window.gdiIsaPdf.summary){
          showToast('Meggy está preparando resumo + questões + pílulas + flashcards…');
          // Mostra loading no próprio bodyEl
          setLoading(bodyEl, 'Meggy está lendo os PDFs e criando flashcards automaticamente…');
          try{
            // Chama generateAll indiretamente via summary — os flashcards
            // são criados como side-effect (autoCreateFlashcards).
            await window.gdiIsaPdf.summary(items, bodyEl, lessonName);
            // Após gerar, volta para a biblioteca de flashcards
            setTimeout(()=>flashcards(items, bodyEl, lessonName), 300);
          }catch(e){
            setError(bodyEl, e.message);
            // Após erro, também volta para a biblioteca
            setTimeout(()=>flashcards(items, bodyEl, lessonName), 1500);
          }
        } else {
          showToast('Módulo Meggy indisponível');
        }
      };
      const toggleBtn = bodyEl.querySelector('#gdi-fc-manual-toggle');
      const formEl = bodyEl.querySelector('#gdi-fc-manual-form');
      if(toggleBtn) toggleBtn.onclick = ()=>{
        const open = formEl.style.display !== 'none';
        formEl.style.display = open ? 'none' : 'block';
        toggleBtn.innerHTML = open
          ? '<i class="bi bi-plus-lg"></i> Adicionar manualmente'
          : '<i class="bi bi-dash-lg"></i> Fechar formulário';
      };
      const addBtn = bodyEl.querySelector('#gdi-fc-manual-add');
      if(addBtn) addBtn.onclick = ()=>{
        const f = bodyEl.querySelector('#gdi-fc-manual-f').value.trim();
        const b = bodyEl.querySelector('#gdi-fc-manual-b').value.trim();
        if(!f || !b){ showToast('Preencha frente e verso'); return; }
        const cards = lsGet('gdi-cards-v1', []);
        cards.push({id:uid(), f, b, due:Date.now()+86400000, box:0, src:'manual:'+lesson, path:urlPath, lesson:lesson, createdAt:Date.now()});
        lsSet('gdi-cards-v1', cards);
        showToast('Flashcard adicionado!');
        flashcards(items, bodyEl, lessonName);
      };
      return;
    }

    // ── Library header ──
    bodyEl.innerHTML = `
      <div class="gdi-mat-isa-result gdi-fc-library">
        <div class="gdi-fc-library-head">
          <div class="gdi-fc-library-title">
            <i class="bi bi-card-text"></i>
            <div>
              <b>Biblioteca de Flashcards</b>
              <span>${allCards.length} cards em ${disciplines.length} disciplina${disciplines.length>1?'s':''} · ${totalDue} p/ revisar</span>
            </div>
          </div>
          <div class="gdi-fc-library-actions">
            ${totalDue ? `<button id="gdi-fc-study-due" class="gdi-btn gdi-btn-primary"><i class="bi bi-play-fill"></i> Revisar (${totalDue})</button>` : ''}
            <button id="gdi-fc-study-all" class="gdi-mode-btn"><i class="bi bi-collection"></i> Estudar todos</button>
            <button id="gdi-fc-add-toggle" class="gdi-mode-btn" title="Adicionar flashcard"><i class="bi bi-plus-lg"></i></button>
          </div>
        </div>
        <div id="gdi-fc-add-form" class="gdi-fc-add-form" style="display:none;">
          <input id="gdi-fc-add-f" placeholder="Frente (pergunta)" />
          <input id="gdi-fc-add-b" placeholder="Verso (resposta)" />
          <button id="gdi-fc-add-save" class="gdi-btn gdi-btn-primary"><i class="bi bi-check-lg"></i> Salvar</button>
        </div>
        <div class="gdi-fc-disciplines"></div>
      </div>`;

    const discWrap = bodyEl.querySelector('.gdi-fc-disciplines');

    // ── Render disciplines → themes → cards ──
    disciplines.forEach((disc, di)=>{
      const themes = grouped[disc];
      const themeKeys = Object.keys(themes).sort((a,b)=>a.localeCompare(b,'pt-BR'));
      const discCount = themeKeys.reduce((s,t)=>s+themes[t].length, 0);
      const discDue = themeKeys.reduce((s,t)=>s+themes[t].filter(c=>(c.due||0)<=Date.now()).length, 0);

      const discEl = document.createElement('div');
      discEl.className = 'gdi-fc-discipline';
      discEl.innerHTML = `
        <div class="gdi-fc-disc-head" data-disc-idx="${di}">
          <i class="bi bi-chevron-down gdi-fc-chevron"></i>
          <i class="bi bi-folder-fill gdi-fc-disc-icon"></i>
          <b class="gdi-fc-disc-name">${esc(disc)}</b>
          <span class="gdi-fc-disc-meta">${discCount} cards · ${themeKeys.length} tema${themeKeys.length>1?'s':''}${discDue?` · <b class="gdi-fc-due">${discDue} p/ revisar</b>`:''}</span>
        </div>
        <div class="gdi-fc-disc-body">`;

      themeKeys.forEach((theme, ti)=>{
        const cardsT = themes[theme];
        const dueT = cardsT.filter(c=>(c.due||0)<=Date.now()).length;
        const themeEl = document.createElement('div');
        themeEl.className = 'gdi-fc-theme';
        themeEl.innerHTML = `
          <div class="gdi-fc-theme-head" data-disc-idx="${di}" data-theme-idx="${ti}">
            <i class="bi bi-chevron-down gdi-fc-chevron"></i>
            <i class="bi bi-bookmark-fill gdi-fc-theme-icon"></i>
            <b class="gdi-fc-theme-name">${esc(theme)}</b>
            <span class="gdi-fc-theme-meta">${cardsT.length} cards${dueT?` · <b class="gdi-fc-due">${dueT} p/ revisar</b>`:''}</span>
            <button class="gdi-mode-btn gdi-fc-theme-study" data-disc-idx="${di}" data-theme-idx="${ti}" title="Estudar este tema">
              <i class="bi bi-play-fill"></i>
            </button>
          </div>
          <div class="gdi-fc-theme-body">
            <div class="gdi-fc-grid">
              ${cardsT.map(c=>`
                <div class="gdi-fc-card" data-card-id="${esc(c.id)}">
                  <div class="gdi-fc-card-inner">
                    <div class="gdi-fc-card-face gdi-fc-card-front">
                      <div class="gdi-fc-card-label"><i class="bi bi-question-circle"></i> PERGUNTA</div>
                      <div class="gdi-fc-card-text">${esc(String(c.f).slice(0,300))}</div>
                      <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para virar</div>
                    </div>
                    <div class="gdi-fc-card-face gdi-fc-card-back">
                      <div class="gdi-fc-card-label"><i class="bi bi-check-circle"></i> RESPOSTA</div>
                      <div class="gdi-fc-card-text">${esc(String(c.b).slice(0,400))}</div>
                      <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para voltar</div>
                    </div>
                  </div>
                  <button class="gdi-fc-card-del" data-card-id="${esc(c.id)}" title="Excluir">
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>`;
        discEl.querySelector('.gdi-fc-disc-body').appendChild(themeEl);
      });

      discWrap.appendChild(discEl);
    });

    // ── Discipline collapse/expand ──
    discWrap.querySelectorAll('.gdi-fc-disc-head').forEach(h=>{
      h.onclick = (e)=>{
        e.stopPropagation();
        const body = h.nextElementSibling;
        const chevron = h.querySelector('.gdi-fc-chevron');
        const isOpen = body.style.display !== 'none';
        if(isOpen){
          body.style.display = 'none';
          chevron.classList.add('gdi-fc-rotated');
        }else{
          body.style.display = 'block';
          chevron.classList.remove('gdi-fc-rotated');
        }
      };
    });

    // ── Theme collapse/expand ──
    discWrap.querySelectorAll('.gdi-fc-theme-head').forEach(h=>{
      h.onclick = (e)=>{
        if(e.target.closest('.gdi-fc-theme-study')) return;
        e.stopPropagation();
        const body = h.nextElementSibling;
        const chevron = h.querySelector('.gdi-fc-chevron');
        const isOpen = body.style.display !== 'none';
        if(isOpen){
          body.style.display = 'none';
          chevron.classList.add('gdi-fc-rotated');
        }else{
          body.style.display = 'block';
          chevron.classList.remove('gdi-fc-rotated');
        }
      };
    });

    // ── Card flip ──
    discWrap.querySelectorAll('.gdi-fc-card').forEach(card=>{
      card.onclick = (e)=>{
        if(e.target.closest('.gdi-fc-card-del')) return;
        e.stopPropagation();
        card.classList.toggle('gdi-fc-flipped');
      };
    });

    // ── Card delete ──
    discWrap.querySelectorAll('.gdi-fc-card-del').forEach(btn=>{
      btn.onclick = (e)=>{
        e.stopPropagation();
        const id = btn.dataset.cardId;
        const cards = lsGet('gdi-cards-v1', []);
        lsSet('gdi-cards-v1', cards.filter(x=>x.id !== id));
        showToast('Flashcard excluído');
        flashcards(items, bodyEl, lessonName);
      };
    });

    // ── Theme study ──
    discWrap.querySelectorAll('.gdi-fc-theme-study').forEach(btn=>{
      btn.onclick = (e)=>{
        e.stopPropagation();
        const di = +btn.dataset.discIdx;
        const ti = +btn.dataset.themeIdx;
        const disc = disciplines[di];
        const theme = Object.keys(grouped[disc]).sort((a,b)=>a.localeCompare(b,'pt-BR'))[ti];
        const queue = grouped[disc][theme].filter(c=>(c.due||0)<=Date.now());
        const fullQueue = grouped[disc][theme];
        runFlashcardSession(bodyEl, `${disc} · ${theme}`, queue.length ? queue : fullQueue, items, lessonName);
      };
    });

    // ── Study all due / all cards ──
    const studyDue = bodyEl.querySelector('#gdi-fc-study-due');
    if(studyDue) studyDue.onclick = ()=>{
      const queue = allCards.filter(c=>(c.due||0)<=Date.now());
      if(queue.length) runFlashcardSession(bodyEl, 'Revisão geral', queue, items, lessonName);
      else showToast('Nenhum card vencido hoje');
    };
    const studyAll = bodyEl.querySelector('#gdi-fc-study-all');
    if(studyAll) studyAll.onclick = ()=>{
      runFlashcardSession(bodyEl, 'Todos os flashcards', allCards.slice(0, 30), items, lessonName);
    };

    // ── Add form toggle ──
    const addToggle = bodyEl.querySelector('#gdi-fc-add-toggle');
    const addForm = bodyEl.querySelector('#gdi-fc-add-form');
    if(addToggle) addToggle.onclick = ()=>{
      const open = addForm.style.display !== 'none';
      addForm.style.display = open ? 'none' : 'flex';
    };
    const addSave = bodyEl.querySelector('#gdi-fc-add-save');
    if(addSave) addSave.onclick = ()=>{
      const f = bodyEl.querySelector('#gdi-fc-add-f').value.trim();
      const b = bodyEl.querySelector('#gdi-fc-add-b').value.trim();
      if(!f || !b){ showToast('Preencha frente e verso'); return; }
      const cards = lsGet('gdi-cards-v1', []);
      cards.push({id:uid(), f, b, due:Date.now()+86400000, box:0, src:'manual:'+lesson, path:urlPath, lesson:lesson, createdAt:Date.now()});
      lsSet('gdi-cards-v1', cards);
      showToast('Flashcard adicionado!');
      flashcards(items, bodyEl, lessonName);
    };
  }

  // ── Sessão de estudo de flashcards (vira o card) ──
  // ★FIX v2: usa o mesmo design flip 3D da biblioteca — visual consistente.
  function runFlashcardSession(bodyEl,lesson,queue,items,lessonName){
    let idx=0,hits=0,misses=0;
    function draw(){
      if(idx>=queue.length){
        const pct=Math.round(hits/queue.length*100);
        bodyEl.innerHTML=`<div class="gdi-mat-isa-result" style="max-width:760px;text-align:center;">
          <div style="font-size:48px;">${pct>=60?'🎉':'📚'}</div>
          <h3 style="color:var(--ferreto-primary,#ff8b9f);font-family:var(--ferreto-font-display,'Poppins',sans-serif);">Sessão concluída!</h3>
          <p style="color:var(--ferreto-text,#e6edf3);font-size:16px;margin-top:8px;"><b style="color:${pct>=60?'#3fb950':'#ff8b8b'};">${hits}/${queue.length}</b> · ${pct}% acerto</p>
          <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin-top:4px;">${esc(lesson)}</p>
          <button id="gdi-fc-back-list" class="gdi-btn gdi-btn-primary" style="margin-top:14px;"><i class="bi bi-arrow-left"></i> Voltar aos flashcards</button>
        </div>`;
        bodyEl.querySelector('#gdi-fc-back-list').onclick=()=>flashcards(items,bodyEl,lessonName);
        return;
      }
      const c=queue[idx];
      bodyEl.innerHTML=`<div class="gdi-fc-session">
        <div class="gdi-fc-session-head">
          <span>${esc(lesson)} · ${idx+1}/${queue.length}</span>
          <span>✓ ${hits} ✗ ${misses}</span>
        </div>
        <div class="gdi-fc-session-stage">
          <div class="gdi-fc-card gdi-fc-card-large" id="gdi-fc-card">
            <div class="gdi-fc-card-inner">
              <div class="gdi-fc-card-face gdi-fc-card-front">
                <div class="gdi-fc-card-label"><i class="bi bi-question-circle"></i> PERGUNTA</div>
                <div class="gdi-fc-card-text">${esc(c.f)}</div>
                <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para virar</div>
              </div>
              <div class="gdi-fc-card-face gdi-fc-card-back">
                <div class="gdi-fc-card-label"><i class="bi bi-check-circle"></i> RESPOSTA</div>
                <div class="gdi-fc-card-text">${esc(c.b)}</div>
                <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para voltar</div>
              </div>
            </div>
          </div>
        </div>
        <div id="gdi-fc-grade" class="gdi-fc-session-grade" style="display:none;">
          <p>Você sabia a resposta?</p>
          <div class="gdi-fc-grade-btns">
            <button id="gdi-fc-no" class="gdi-mode-btn gdi-fc-btn-no"><i class="bi bi-x-circle"></i> Não sabia</button>
            <button id="gdi-fc-yes" class="gdi-btn gdi-btn-primary gdi-fc-btn-yes"><i class="bi bi-check-circle"></i> Sabia!</button>
          </div>
        </div>
        <div class="gdi-fc-session-foot">
          <button id="gdi-fc-skip" title="Pular" class="gdi-fc-skip-btn"><i class="bi bi-arrow-right"></i></button>
        </div>
      </div>`;
      // vira o card ao clicar
      const card=bodyEl.querySelector('#gdi-fc-card');
      const grade=bodyEl.querySelector('#gdi-fc-grade');
      let flipped=false;
      card.onclick=()=>{
        if(flipped)return;flipped=true;
        card.classList.add('gdi-fc-flipped');
        grade.style.display='block';
      };
      // sabia / não sabia
      bodyEl.querySelector('#gdi-fc-yes').onclick=()=>{
        hits++;
        // atualiza SRS do flashcard (box+1, due = +7 dias)
        const cards=lsGet('gdi-cards-v1',[]);
        const ci=cards.findIndex(x=>x.id===c.id);
        if(ci>=0){cards[ci].box=Math.min(4,(cards[ci].box||0)+1);cards[ci].due=Date.now()+[1,3,7,21,60][cards[ci].box]*86400000;lsSet('gdi-cards-v1',cards);}
        idx++;draw();
      };
      bodyEl.querySelector('#gdi-fc-no').onclick=()=>{
        misses++;
        const cards=lsGet('gdi-cards-v1',[]);
        const ci=cards.findIndex(x=>x.id===c.id);
        if(ci>=0){cards[ci].box=0;cards[ci].due=Date.now()+86400000;lsSet('gdi-cards-v1',cards);}
        idx++;draw();
      };
      // pular
      bodyEl.querySelector('#gdi-fc-skip').onclick=()=>{idx++;draw();};
    }
    draw();
  }

  // ── Regenerate: força regeração de tudo (limpa cache em memória + Drive) ──
  async function regenerate(items,bodyEl,lessonName){
    if(!items||!items.length){setError(bodyEl,'Nenhum PDF disponível.');return;}
    const lesson=realLessonName(lessonName||items[0].name);
    // limpa cache em memória
    _chainCache={};
    // limpa cache do Drive (★FIX: também limpa mindmap, antes ficava preso)
    try{
      await fetch('/api/ai/cache',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key:lessonKey(),summary:null,questions:null,mindmap:null,lessonName:lesson})});
    }catch(_){}
    // regenera tudo em cadeia
    await summary(items,bodyEl,lessonName);
  }

  // ── Public API ──
  window.gdiIsaPdf={summary,questions,mindmap,flashcards,regenerate,extractPdfText,saveIsaSummary,listIsaSummaries,delIsaSummary};

  // ── Render: Resumos (M22 new tab) ──
  // ── Salvar resumo no pool compartilhado (todos os usuários) ──
  async function saveSharedSummary(lessonName,summary,questions){
    try{
      await fetch('/api/ai/shared-summaries',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({lessonName,summary,questions:questions||null})});
    }catch(_){/* não bloqueia */}
  }
  // ── Buscar resumos compartilhados de outros usuários ──
  async function fetchSharedSummaries(lessonFilter){
    try{
      const url='/api/ai/shared-summaries'+(lessonFilter?'?lesson='+encodeURIComponent(lessonFilter):'');
      const r=await fetch(url,{cache:'no-store'});
      const d=await r.json();
      return (d&&d.ok&&Array.isArray(d.summaries))?d.summaries:[];
    }catch(_){return [];}
  }

  window.renderResumos=function(box){
    const all=listIsaSummaries();
    box.innerHTML=`
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
        <b style="color:var(--ferreto-text,#f0f6fc);">${all.length} resumo${all.length===1?'':'s'}</b>
        <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">gerados pela Meggy 🐩 a partir dos PDFs das aulas</span>
      </div>
      <div id="gdi-rs-list" style="display:flex;flex-direction:column;gap:8px;max-width:760px;"></div>
      <div id="gdi-rs-shared-section" style="margin-top:24px;">
        <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">📚 Resumos compartilhados por outros alunos</h4>
        <div id="gdi-rs-shared" style="display:flex;flex-direction:column;gap:8px;max-width:760px;">
          <div class="gdi-notes-empty" style="color:var(--ferreto-text-faint,#6b7488);">Carregando resumos compartilhados…</div>
        </div>
      </div>`;
    const list=box.querySelector('#gdi-rs-list');
    if(!all.length){
      list.innerHTML='<div class="gdi-notes-empty">Nenhum resumo ainda. Abra uma aula com PDF e clique em "Resumo Meggy" na barra de materiais.</div>';
    }else{
      all.forEach(r=>{
        const row=document.createElement('div');row.className='gdi-note';
        row.style.flexDirection='column';row.style.alignItems='stretch';
        const dt=new Date(r.date).toLocaleString('pt-BR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
        row.innerHTML=`<div class="gdi-rs-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;width:100%;cursor:pointer;">
          <span style="flex:1;min-width:0;">
            <b style="color:var(--ferreto-text,#f0f6fc);"><i class="bi bi-stars" style="color:var(--ferreto-primary,#ff8b9f);"></i> ${esc(r.lesson)}</b>
            <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-left:6px;">· ${dt}</span>
          </span>
          <button class="gdi-note-del" title="Excluir" style="flex:none;"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="gdi-rs-body" style="display:none;color:var(--ferreto-text,#e6edf3);font-size:13px;line-height:1.6;margin-top:8px;padding-top:8px;border-top:1px solid var(--ferreto-border,#21262d);overflow-x:auto;"></div>`;
        const body=row.querySelector('.gdi-rs-body');
        const head=row.querySelector('.gdi-rs-head');
        head.onclick=()=>{const open=body.style.display!=='none';body.style.display=open?'none':'block';if(!open&&body.dataset.rendered!=='1'){body.innerHTML=renderMd(r.summary);body.dataset.rendered='1';}};
        row.querySelector('button').onclick=(e)=>{e.stopPropagation();delIsaSummary(r.id);window.renderResumos(box);showToast('Resumo excluído');};
        list.appendChild(row);
      });
    }
    // carrega resumos compartilhados
    const sharedEl=box.querySelector('#gdi-rs-shared');
    fetchSharedSummaries().then(shared=>{
      if(!shared.length){sharedEl.innerHTML='<div class="gdi-notes-empty">Nenhum resumo compartilhado ainda.</div>';return;}
      sharedEl.innerHTML='';
      shared.slice().reverse().forEach(r=>{
        const row=document.createElement('div');row.className='gdi-note';
        row.style.flexDirection='column';row.style.alignItems='stretch';
        const dt=new Date(r.date||0).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
        row.innerHTML=`<div class="gdi-rs-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;width:100%;cursor:pointer;">
          <span style="flex:1;min-width:0;">
            <b style="color:var(--ferreto-secondary,#5ddeda);"><i class="bi bi-people" style="font-size:12px;"></i> ${esc(r.lessonName||'Aula')}</b>
            <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-left:6px;">· por ${esc(r.author||'aluno')} · ${dt}</span>
          </span>
        </div>
        <div class="gdi-rs-body" style="display:none;color:var(--ferreto-text,#e6edf3);font-size:13px;line-height:1.6;margin-top:8px;padding-top:8px;border-top:1px solid var(--ferreto-border,#21262d);overflow-x:auto;"></div>`;
        const body=row.querySelector('.gdi-rs-body');
        const head=row.querySelector('.gdi-rs-head');
        head.onclick=()=>{const open=body.style.display!=='none';body.style.display=open?'none':'block';if(!open&&body.dataset.rendered!=='1'){body.innerHTML=renderMd(r.summary);body.dataset.rendered='1';}};
        sharedEl.appendChild(row);
      });
    });
  };

  console.log('[GDI Extras] M9-ISA (PDF extraction + ISA summaries/questions) ativo');
})();

// ═══ M10 v5: MODOS DE FOCO + BOTÃO ASSISTIDO ═══
(function(){
  if(!document.getElementById('gdi-focus-style')){
    const s=document.createElement('style');s.id='gdi-focus-style';s.textContent=`
body.gdi-fv .gdi-study-grid,body.gdi-fm .gdi-study-grid{grid-template-columns:1fr!important;}
body.gdi-fv .gdi-study-right{display:none!important;}
body.gdi-fm .gdi-study-left{display:none!important;}
body.gdi-fv .gdi-study-left{width:100%!important;max-width:100%!important;}
body.gdi-fv .gdi-player-wrap{width:100%!important;max-width:100%!important;}
body.gdi-fv .gdi-player-wrap video,
body.gdi-fv .gdi-player-wrap .plyr,
body.gdi-fv .gdi-player-wrap .plyr__video-wrapper,
body.gdi-fv .gdi-player-wrap .video-js,
body.gdi-fv .gdi-player-wrap .dplayer,
body.gdi-fv .gdi-player-wrap .dplayer-video-wrap,
body.gdi-fv .gdi-player-wrap .dplayer-video,
body.gdi-fv .gdi-player-wrap .jwplayer,
body.gdi-fv .gdi-player-wrap #player,
body.gdi-fv .gdi-player-wrap #vplayer,
body.gdi-fv .gdi-player-wrap #player-container,
body.gdi-fv .gdi-player-wrap iframe{
  width:100%!important;max-width:100%!important;max-height:none!important;
  margin-left:auto!important;margin-right:auto!important;display:block!important;}`;
    document.head.appendChild(s);
  }
  function isDone(){
    const key=window.gdiVideoKey?window.gdiVideoKey():window.location.pathname;
    let done=false;
    try{
      done=GDIUser.isWatched(key);
      if(!done&&window.gdiNormKey)done=GDIUser.isWatched(gdiNormKey(key));
      if(!done)done=GDIUser.isWatched(window.location.pathname);
    }catch(_){}
    return done;
  }
  function updBtn(){
    const wb=document.getElementById('gdi-watched-btn');
    if(!wb)return;
    const done=isDone();
    wb.classList.toggle('done',done);
    wb.innerHTML=done?'<i class="bi bi-eye-fill"></i><span>Assistida \u2713</span>':'<i class="bi bi-eye"></i><span>Assistido</span>';
  }
  function findLayout(){
    const study=document.getElementById('gdi-study');
    const wrap=document.querySelector('.gdi-player-wrap');
    if(study){
      const grid=study.querySelector('.gdi-study-grid');
      const left=(grid||study).querySelector('.gdi-study-left');
      const right=(grid||study).querySelector('.gdi-study-right');
      if(grid&&(left||right))return{grid,left,right};
    }
    const rightEl=document.getElementById('gdi-slot-right')||document.getElementById('gdi-mat-body');
    if(wrap&&rightEl&&rightEl!==wrap){
      let p=wrap.parentElement;
      while(p&&p!==document.body&&!p.contains(rightEl))p=p.parentElement;
      if(p&&p!==document.body&&p.contains(wrap)){
        const col=el=>{let n=el;while(n&&n.parentElement&&n.parentElement!==p)n=n.parentElement;return n;};
        return{grid:p,left:col(wrap),right:col(rightEl)};
      }
    }
    return{grid:null,left:null,right:null};
  }
  // ★FIX: registrados UMA vez no escopo do IIFE (antes: +3 handlers
  //       globais por página de vídeo, acumulando para sempre)
  Bus.onGlobal('watched:changed',updBtn);
  Bus.onGlobal('user:ready',updBtn);
  Bus.onGlobal('video:switched',()=>setTimeout(updBtn,150));
  window.GDI_MODULES.push({name:'focus-modes',init:function(){
    const study=document.getElementById('gdi-study');
    const wrap=document.querySelector('.gdi-player-wrap');
    if(!study&&!wrap)return;
    let slot=document.getElementById('gdi-slot-modes');
    let created=false;
    if(!slot){
      const host=study?study.querySelector('.gdi-study-left'):null;
      slot=document.createElement('div');
      slot.id='gdi-slot-modes';
      slot.style.cssText='display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px 0;';
      if(host)host.insertBefore(slot,host.firstChild);
      else if(wrap&&wrap.parentElement)wrap.parentElement.insertBefore(slot,wrap);
      else if(study)study.insertBefore(slot,study.firstChild);
      else return;
      created=true;
    }
    if(slot.dataset.m10)return;
    slot.dataset.m10='1';
    console.log('[GDI M10] v5 ativo \u2014 slot '+(created?'CRIADO pelo extras (o core n\u00e3o fornece)':'do core'));
    slot.innerHTML=`
      <button class="gdi-mode-btn" data-mode="split" title="Tela dividida (v\u00eddeo + material)"><i class="bi bi-layout-split"></i><span class="d-none d-md-inline">Dividido</span></button>
      <button class="gdi-mode-btn" data-mode="fv" title="Foco na aula (v\u00eddeo em largura total)"><i class="bi bi-lightning-charge-fill"></i><span class="d-none d-md-inline">Foco na aula</span></button>
      <button class="gdi-mode-btn" data-mode="fm" title="Foco no material (s\u00f3 PDF, zoom autom\u00e1tico)"><i class="bi bi-file-earmark-pdf-fill"></i><span class="d-none d-md-inline">Foco no material</span></button>
      <button class="gdi-watched-btn" id="gdi-watched-btn" title="Marcar esta aula como assistida"><i class="bi bi-eye"></i><span>Assistido</span></button>`;
    function zoom(){
      const z=document.body.classList.contains('gdi-fm')?'150':'100';
      const ifr=document.querySelector('#gdi-mat-body iframe');
      if(ifr){const base=ifr.src.split('#')[0];if(!base.endsWith('.html'))ifr.src=base+'#zoom='+z;}
    }
    function applyLayout(m){
      const{grid,left,right}=findLayout();
      if(grid){
        if(m==='fv'||m==='fm')grid.style.setProperty('grid-template-columns','1fr','important');
        else grid.style.removeProperty('grid-template-columns');
      }
      if(right){
        if(m==='fv')right.style.setProperty('display','none','important');
        else right.style.removeProperty('display');
      }
      if(left){
        if(m==='fm')left.style.setProperty('display','none','important');
        else left.style.removeProperty('display');
      }
    }
    function setMode(m){
      document.body.classList.toggle('gdi-fv',m==='fv');
      document.body.classList.toggle('gdi-fm',m==='fm');
      try{localStorage.setItem('gdi-study-mode',m)}catch(_){}
      slot.querySelectorAll('.gdi-mode-btn[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
      applyLayout(m);
      if(m!=='fv')setTimeout(zoom,60);
    }
    slot.querySelectorAll('.gdi-mode-btn[data-mode]').forEach(b=>{
      b.addEventListener('click',()=>setMode(b.dataset.mode));
    });
    let saved='split';try{saved=localStorage.getItem('gdi-study-mode')||'split'}catch(_){}
    setMode(['fv','fm','split'].includes(saved)?saved:'split');
    const wb=document.getElementById('gdi-watched-btn');
    if(wb&&!wb.dataset.b){
      wb.dataset.b='1';
      wb.addEventListener('click',()=>{
        const done=isDone();
        if(done){window.gdiUnmarkVideo?gdiUnmarkVideo():GDIUser.unmarkWatched(window.location.pathname);}
        else{window.gdiMarkVideo?gdiMarkVideo():GDIUser.markWatched(window.location.pathname);}
        showToast(done?'Aula desmarcada':'Aula marcada como assistida \u2713');
      });
    }
    updBtn();
  }});
})();

// ═══ M11 v3.2: MODO DESCANSO — UI fora do body ═══
(function(){
  let btn=null,overlay=null,sleeping=false,bound=false,wakeGuard=0;
  const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
  const wrapEl=()=>document.querySelector('.gdi-player-wrap');
  const onAudioPage=()=>!!document.getElementById('aplayer-container');
  function ensureEls(){
    const needOv=!overlay||!overlay.isConnected;
    const needBt=!btn||!btn.isConnected;
    if(!needOv&&!needBt)return;
    if(needOv){
      overlay=document.createElement('div');
      overlay.id='gdi-sleep-overlay';
      overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#000;opacity:0;pointer-events:none;transition:opacity 2.5s ease;cursor:pointer;';
      overlay.title='Clique para sair do modo descanso';
      overlay.addEventListener('click',()=>exitSleep());
    }
    if(needBt){
      btn=document.createElement('button');
      btn.id='gdi-sleep-btn';
      btn.innerHTML='<i class="bi bi-moon-stars-fill"></i>';
      btn.title='Modo descanso (apenas \u00e1udio) \u2014 clique para ligar';
      btn.style.cssText='position:fixed;bottom:76px;left:16px;z-index:2147483001;background:rgba(18,18,28,0.92);border:1.5px solid rgba(255,255,255,0.25);border-radius:50%;width:40px;height:40px;color:#74c0fc;font-size:16px;cursor:pointer;display:none;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.5);';
      btn.addEventListener('click',e=>{e.stopPropagation();sleeping?exitSleep():enterSleep();});
    }
    if(!overlay.parentElement)GDI_ROOT().appendChild(overlay);
    if(!btn.parentElement)GDI_ROOT().appendChild(btn);
  }
  function enterSleep(){
    if(sleeping)return;
    sleeping=true;
    wakeGuard=Date.now()+2500;
    overlay.style.transition='opacity 2.5s ease';
    overlay.style.pointerEvents='all';
    overlay.style.opacity='0.97';
    btn.innerHTML='<i class="bi bi-sun-fill"></i>';
    btn.style.color='#ffd43b';
    btn.title='Sair do modo descanso';
  }
  function exitSleep(){
    if(!sleeping)return;
    sleeping=false;
    overlay.style.transition='opacity .5s ease';
    overlay.style.opacity='0';
    overlay.style.pointerEvents='none';
    btn.innerHTML='<i class="bi bi-moon-stars-fill"></i>';
    btn.style.color='#74c0fc';
    btn.title='Modo descanso (apenas \u00e1udio) \u2014 clique para ligar';
  }
  function syncFs(){
    ensureEls();
    const fs=fsEl();
    const wrap=wrapEl();
    const video=!!wrap,audio=onAudioPage();
    if(!video&&!audio){btn.style.display='none';if(sleeping)exitSleep();return;}
    let fsOk=false;
    if(fs&&fs.tagName!=='VIDEO'){
      if(!video)fsOk=true;
      else fsOk=fs===document.documentElement||fs===document.body||fs===wrap||fs.contains(wrap)||wrap.contains(fs);
    }
    const host=fsOk?fs:GDI_ROOT();
    if(btn.parentElement!==host)host.appendChild(btn);
    if(overlay.parentElement!==host)host.appendChild(overlay);
    btn.style.display=(video&&!fsOk)?'none':'flex';
    if(sleeping&&video&&!fsOk)exitSleep();
  }
  function bindOnce(){
    if(bound)return;bound=true;
    document.addEventListener('fullscreenchange',syncFs);
    document.addEventListener('webkitfullscreenchange',syncFs);
    ['mousemove','mousedown','keydown','touchstart'].forEach(ev=>{
      document.addEventListener(ev,e=>{
        if(!sleeping||Date.now()<wakeGuard)return;
        if(ev!=='mousemove'&&e.target&&btn&&(e.target===btn||btn.contains(e.target)))return;
        exitSleep();
      },{passive:true});
    });
    Bus.onGlobal('media:ready',({type,el})=>{
      if(type==='video'&&el&&!el.__gdiSleepEnd){
        el.__gdiSleepEnd=true;
        try{el.addEventListener('ended',()=>exitSleep());}catch(_){}
      }
    });
  }
  window.GDI_MODULES.push({name:'sleep-mode',init:function(){
    ensureEls();bindOnce();syncFs();
  }});
  console.log('[GDI M11] v3.2 descanso registrado');
})();

// ═══ M12: POMODORO v2.6 (botão na navbar + tema Ferreto) ═══
(function(){
  window.GDI_MODULES.push({name:'pomodoro',init:function(){
    if(window.__gdiPomodoroBooted)return;
    window.__gdiPomodoroBooted=true;
    const $id=x=>document.getElementById(x);
    const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
    const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
    const safeParse=s=>{try{return JSON.parse(s)}catch(e){return null}};
    const flashEl=document.createElement('div');flashEl.id='gdi-pom-flash';
    GDI_ROOT().appendChild(flashEl);

    // ★ Pomodoro agora é botão na navbar (como Central de Estudos)
    function injectPomNav(){
      const oldFab=document.getElementById('gdi-pom-root');
      if(oldFab)oldFab.remove();
      const actions=document.querySelector('.gdi-nav-actions');
      if(!actions)return false;
      if(actions.querySelector('#gdi-pom-nav'))return true;
      const wrap=document.createElement('div');
      wrap.id='gdi-pom-nav';
      wrap.innerHTML=`
        <button id="gdi-pom-nav-btn" title="Pomodoro (estudos focados)">
          <span class="gdi-pom-nav-ico">🍅</span>
          <span class="gdi-pom-nav-time" id="gdi-pom-nav-time">25:00</span>
        </button>
        <div id="gdi-pom-panel">
          <div class="gdi-pom-phase-label" id="gdi-pom-phase-label">🍅 Foco</div>
          <div id="gdi-pom-display">25:00</div>
          <div id="gdi-pom-progress"><div id="gdi-pom-progress-bar"></div></div>
          <div id="gdi-pom-sessions-dots"></div>
          <div id="gdi-pom-btns">
            <button class="gdi-pom-btn" id="gdi-pom-start">▶ Iniciar</button>
            <button class="gdi-pom-btn" id="gdi-pom-skip" title="Pular fase">⏭</button>
            <button class="gdi-pom-btn" id="gdi-pom-reset" title="Zerar">↺</button>
          </div>
          <div id="gdi-pom-divider"></div>
          <div id="gdi-pom-cfg">
            <div class="gdi-pom-cfg-row"><span>🍅 Foco (min)</span><input id="gdi-pom-c-work" type="number" min="1" max="90" value="25"></div>
            <div class="gdi-pom-cfg-row"><span>☕ Pausa curta</span><input id="gdi-pom-c-short" type="number" min="1" max="30" value="5"></div>
            <div class="gdi-pom-cfg-row"><span>🛋 Pausa longa</span><input id="gdi-pom-c-long" type="number" min="1" max="60" value="15"></div>
            <div class="gdi-pom-cfg-row"><span>🔁 Sessões p/ longa</span><input id="gdi-pom-c-sess" type="number" min="1" max="10" value="4"></div>
            <label class="gdi-pom-switch"><span>▶ Auto-iniciar próxima fase</span><input id="gdi-pom-c-auto" type="checkbox" checked></label>
          </div>
        </div>`;
      // insere antes do botão de tema
      const themeBtn=document.getElementById('theme-toggle');
      if(themeBtn)actions.insertBefore(wrap,themeBtn);
      else actions.appendChild(wrap);
      return true;
    }
    // tenta injetar com retries (igual Central de Estudos)
    injectPomNav();
    for(let i=1;i<=10;i++)setTimeout(injectPomNav,i*300);
    Bus.onGlobal('page:change',()=>setTimeout(injectPomNav,100));
    window.GDI_MODULES=window.GDI_MODULES||[];
    window.GDI_MODULES.push({name:'pom-nav',init:function(){injectPomNav();}});

    const CKEY='gdi-pom-cfg-v2',SKEY='gdi-pom-state-v2';
    let cfg=Object.assign({work:25,short:5,long:15,sessions:4,autoStart:true},safeParse(localStorage.getItem(CKEY))||{});
    let st={phase:'work',total:cfg.work*60,remain:cfg.work*60,dots:0,running:false,endAt:0};
    let timer=null,lastWarn=-1,panelOpen=false,baseTitle=document.title,dotsCache='';
    function check(){
      const has=!!(document.querySelector('video,audio')||window._gdiAPlayer);
      const nav=$id('gdi-pom-nav');
      if(nav)nav.style.display=has?'':'none';
      if(!has&&panelOpen){panelOpen=false;$id('gdi-pom-panel')?.classList.remove('open');}
    }
    function refreshBase(){baseTitle=document.title.replace(/^\d\d:\d\d \S+ \u00b7 /,'');if(st.running)updateUI();}
    Bus.onGlobal('media:ready',()=>setTimeout(check,50));
    Bus.onGlobal('page:change',()=>{setTimeout(check,30);setTimeout(refreshBase,60);});
    Bus.onGlobal('title:change',()=>setTimeout(refreshBase,30));
    function persist(){try{localStorage.setItem(SKEY,JSON.stringify({phase:st.phase,total:st.total,remain:st.remain,running:st.running,dots:st.dots,endAt:st.endAt}))}catch(e){}}
    (function(){const s=safeParse(localStorage.getItem(SKEY));if(!s)return;
      st.phase=s.phase||'work';st.dots=s.dots||0;st.total=s.total||st.total;
      st.remain=(s.remain!=null&&s.remain>0)?s.remain:st.total;st.running=false;st.endAt=0;})();
    let actx=null;
    function beep(f,dur,type,vol){dur=dur||.3;type=type||'sine';vol=vol==null?.35:vol;
      try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();
        if(actx.state==='suspended')actx.resume();
        const o=actx.createOscillator(),g=actx.createGain();
        o.connect(g);g.connect(actx.destination);
        o.type=type;o.frequency.value=f;
        g.gain.setValueAtTime(vol,actx.currentTime);
        g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+dur);
        o.start();o.stop(actx.currentTime+dur);}catch(e){}}
    function alarm(isBreak){const notes=isBreak?[660,880,1100]:[1100,880,660];
      notes.forEach((f,i)=>setTimeout(()=>beep(f,.4,'sine',.5),i*300));
      setTimeout(()=>notes.forEach((f,i)=>setTimeout(()=>beep(f,.3,'sine',.35),i*280)),1100);}
    function flash(c){flashEl.style.background=c;flashEl.style.opacity='.4';setTimeout(()=>{flashEl.style.opacity='0'},600);}
    function notify(t,b){if(!('Notification' in window))return;
      if(Notification.permission==='granted'){try{new Notification(t,{body:b})}catch(e){}}
      else if(Notification.permission==='default')Notification.requestPermission();}
    function info(){
      if(st.phase==='work')return{label:'🍅 Foco',c:'var(--ferreto-primary,#ff8b9f)',fl:'rgba(255,139,159,.2)'};
      if(st.phase==='short')return{label:'☕ Pausa',c:'#3fb950',fl:'rgba(63,185,80,.2)'};
      return{label:'🛋 Pausa longa',c:'#7048e8',fl:'rgba(112,72,232,.2)'};}
    function dots(){
      const key=st.dots+'/'+cfg.sessions;if(key===dotsCache)return;dotsCache=key;
      const inC=st.dots%cfg.sessions;
      const lit=st.dots>0&&inC===0?cfg.sessions:inC;
      let h='';for(let i=0;i<cfg.sessions;i++)h+='<div class="gdi-pom-dot'+(i<lit?' done':'')+'"></div>';
      const el=$id('gdi-pom-sessions-dots');if(el)el.innerHTML=h;}
    function updateUI(){
      const d=info(),time=fmt(st.remain),warn=st.running&&st.remain<=10&&st.remain>0;
      const pct=st.total?st.remain/st.total*100:0;
      const disp=$id('gdi-pom-display');
      if(disp){disp.textContent=time;disp.style.color=warn?'#ff6b6b':'var(--ferreto-text,#f0f6fc)';}
      // atualiza tempo no botão da navbar
      const navTime=$id('gdi-pom-nav-time');
      if(navTime){navTime.textContent=time;navTime.style.color=warn?'#ff6b6b':'var(--ferreto-primary,#ff8b9f)';}
      const lab=$id('gdi-pom-phase-label');
      if(lab){lab.textContent=d.label;lab.style.color=d.c;}
      const bar=$id('gdi-pom-progress-bar');
      if(bar){bar.style.width=pct+'%';bar.style.background=warn?'#ff6b6b':d.c;}
      const btn=$id('gdi-pom-start');
      if(btn)btn.textContent=st.running?'⏸ Pausar':'▶ '+(st.remain<st.total?'Continuar':'Iniciar');
      dots();
      if(st.running){
        if(!/^\d\d:\d\d \S+ \u00b7 /.test(document.title))baseTitle=document.title;
        const emoji=st.phase==='work'?'🍅':st.phase==='short'?'☕':'🛋';
        document.title=fmt(st.remain)+' '+emoji+' \u00b7 '+baseTitle;
      }}
    function startLoop(){clearInterval(timer);st.running=true;
      timer=setInterval(()=>{st.remain=Math.max(0,Math.round((st.endAt-Date.now())/1000));
        if(st.remain<=0){next();return;}
        if(st.remain<=10&&st.remain!==lastWarn){lastWarn=st.remain;beep(880+(10-st.remain)*20,.12,'square',.3);}
        updateUI();},250);
      lastWarn=-1;updateUI();}
    function start(){st.endAt=Date.now()+st.remain*1000;persist();startLoop();}
    function pause(){clearInterval(timer);timer=null;st.running=false;
      document.title=document.title.replace(/^\d\d:\d\d \S+ \u00b7 /,'');persist();updateUI();}
    function reset(){pause();st.phase='work';st.dots=0;st.total=cfg.work*60;st.remain=st.total;st.endAt=0;dotsCache='';persist();updateUI();}
    function next(){clearInterval(timer);timer=null;st.running=false;
      if(st.phase==='work'){st.dots++;const long=st.dots%cfg.sessions===0;
        st.phase=long?'long':'short';st.total=(long?cfg.long:cfg.short)*60;
        flash(info().fl);alarm(true);
        notify(long?'Pausa longa! 🛋':'Pausa! ☕',fmt(st.total)+' de descanso. Você merece!');
      }else{
        if(st.phase==='long'){st.dots=0;dotsCache='';}
        st.phase='work';st.total=cfg.work*60;
        flash(info().fl);alarm(false);
        notify('Hora de focar! 🍅',cfg.work+' minutos de concentração.');}
      st.remain=st.total;
      if(cfg.autoStart){st.endAt=Date.now()+st.total*1000;persist();startLoop();}
      else{persist();updateUI();}}
    // ★ click handler: botão da navbar abre/fecha painel
    function bindPomClicks(){
      const navBtn=$id('gdi-pom-nav-btn');
      if(navBtn&&!navBtn.__pomBound){
        navBtn.__pomBound=true;
        navBtn.addEventListener('click',e=>{e.stopPropagation();panelOpen=!panelOpen;$id('gdi-pom-panel')?.classList.toggle('open',panelOpen);if(panelOpen)updateUI();});
      }
      // fecha painel ao clicar fora
      const nav=$id('gdi-pom-nav');
      if(nav&&!nav.__pomDocBound){
        nav.__pomDocBound=true;
        document.addEventListener('click',e=>{if(panelOpen&&!nav.contains(e.target)){panelOpen=false;$id('gdi-pom-panel')?.classList.remove('open');}},{capture:true});
      }
      const startBtn=$id('gdi-pom-start'),skipBtn=$id('gdi-pom-skip'),resetBtn=$id('gdi-pom-reset');
      if(startBtn&&!startBtn.__pomBound){startBtn.__pomBound=true;startBtn.addEventListener('click',e=>{e.stopPropagation();st.running?pause():start();});}
      if(skipBtn&&!skipBtn.__pomBound){skipBtn.__pomBound=true;skipBtn.addEventListener('click',e=>{e.stopPropagation();next();});}
      if(resetBtn&&!resetBtn.__pomBound){resetBtn.__pomBound=true;resetBtn.addEventListener('click',e=>{e.stopPropagation();reset();});}
      // config inputs
      ['gdi-pom-c-work','gdi-pom-c-short','gdi-pom-c-long','gdi-pom-c-sess'].forEach(id=>{
        const el=$id(id);
        if(el&&!el.__pomBound){
          el.__pomBound=true;
          el.addEventListener('change',()=>{
            cfg.work=clamp(parseInt($id('gdi-pom-c-work').value)||25,1,90);
            cfg.short=clamp(parseInt($id('gdi-pom-c-short').value)||5,1,30);
            cfg.long=clamp(parseInt($id('gdi-pom-c-long').value)||15,1,60);
            cfg.sessions=clamp(parseInt($id('gdi-pom-c-sess').value)||4,1,10);
            localStorage.setItem(CKEY,JSON.stringify(cfg));
            if($id('gdi-pom-c-work'))$id('gdi-pom-c-work').value=cfg.work;
            if($id('gdi-pom-c-short'))$id('gdi-pom-c-short').value=cfg.short;
            if($id('gdi-pom-c-long'))$id('gdi-pom-c-long').value=cfg.long;
            if($id('gdi-pom-c-sess'))$id('gdi-pom-c-sess').value=cfg.sessions;
            if(!st.running){st.phase='work';st.dots=0;dotsCache='';st.total=cfg.work*60;st.remain=st.total;persist();updateUI();}
          });
        }
      });
      const autoChk=$id('gdi-pom-c-auto');
      if(autoChk&&!autoChk.__pomBound){autoChk.__pomBound=true;autoChk.addEventListener('change',e=>{cfg.autoStart=e.target.checked;localStorage.setItem(CKEY,JSON.stringify(cfg));});}
    }
    // binda imediatamente + após injetar
    setTimeout(bindPomClicks,50);
    setTimeout(bindPomClicks,500);
    setTimeout(bindPomClicks,1500);
    Bus.onGlobal('page:change',()=>setTimeout(bindPomClicks,200));
    updateUI();
    console.log('[GDI Pomodoro] v2.5 pronto');
  }});
})();

// ═══ M13 v19.6: CARD "CONTINUAR" EM CASCATA ═══
(function(){
  // ★FIX: guarda contra registro duplo caso o script seja reexecutado
  if(window.__GDI_M13__)return;
  window.__GDI_M13__=true;
  const DBG=true;
  const log=(...a)=>{if(DBG)try{console.log('[GDI M13]',...a)}catch(_){}};
  function stripExt(s){return String(s||'').replace(/\.[a-z0-9]{1,5}$/i,'').trim()}
  const GENERIC_WORDS=/^(aula|aulas|v\u00eddeo|videos?|li[cç][aã]o|li[cç][oõ]es|lesson|lessons|class|classes|modulo|m\u00f3dulo|module|modulos|m\u00f3dulos|modules|parte|partes|pt|cap|caps|capitulo|cap\u00edtulo|ext|ep|eps|episodio|epis\u00f3dio|live|revisao|revis\u00e3o|arquivo|file)$/i;
  function isGenericName(raw){
    const n=stripExt(raw).toLowerCase();
    if(!n)return true;
    const reduced=n.replace(/[\s\-_.:,;|()/\\]+/g,' ').split(' ')
      .filter(w=>w&&!/^\d+$/.test(w)&&!GENERIC_WORDS.test(w)&&!GENERIC_WORDS.test(w.replace(/\d+$/,'')))
      .join('');
    return reduced.length===0;
  }
  function realNameOf(path){
    const seg=normPath(path).split('/').filter(Boolean);
    let name=stripExt(seg[seg.length-1]||'');
    if(isGenericName(name)){
      for(let j=seg.length-2;j>=0;j--){
        if(/^\d+:$/.test(seg[j]))break;
        if(!isGenericName(seg[j])){name=stripExt(seg[j]);break;}
      }
    }
    return name||'Aula';
  }
  let rescue=null,rescueAt=0,rescueInFlight=false;
  function ensureRescue(force){
    // ★FIX: guard in-flight — se já há um fetch em andamento, não dispara outro.
    // Era a causa do loop: 5 chamadas rápidas → 5 fetchs paralelos a /userstate.
    if(rescueInFlight)return;
    if(!force&&rescue&&Date.now()-rescueAt<60000)return;
    rescueInFlight=true;
    fetch('/userstate',{credentials:'same-origin'})
      .then(r=>r.ok?r.json():null)
      .then(j=>{
        rescueInFlight=false;
        if(j&&typeof j==='object'){
          rescue=j;rescueAt=Date.now();
          log('estado obtido do /userstate \u2014 resume:',Object.keys(j.resume||{}).length,'| history:',(j.history||[]).length);
          setTimeout(continueCardInit,30);
        }
      })
      .catch(e=>{rescueInFlight=false;log('falha no /userstate:',e);});
  }
  function stateD(){
    try{
      if(window.GDIUser&&GDIUser.loaded()){const d=GDIUser.dump();if(d)return d;}
    }catch(_){}
    if(rescue)return rescue;
    try{
      if(window.GDIUser){const d=GDIUser.dump();if(d&&Object.keys(d).length)return d;}
    }catch(_){}
    return null;
  }
  function authIn(){
    try{if(window.GDIUser&&typeof GDIUser.auth==='function')return GDIUser.auth()!=='out';}catch(_){}
    return true;
  }
  function getResumeOf(d,key){
    try{
      if(window.GDIUser&&GDIUser.loaded()&&typeof GDIUser.getResume==='function'){
        const r=GDIUser.getResume(key);if(r)return r;
      }
    }catch(_){}
    return (d&&d.resume&&d.resume[key])||null;
  }
  function resumeKeyFor(path){
    const p=String(path||'');
    if(p.indexOf('/fallback?')===0){
      try{return '/fallback::'+(new URLSearchParams(p.split('?')[1]||'').get('id')||'')}catch(_){return ''}
    }
    return p.split('?')[0];
  }
  function normPath(p){
    try{return decodeURIComponent(String(p||'').split('?')[0].replace(/\/+$/,''))}catch(_){return String(p||'').split('?')[0].replace(/\/+$/,'')}
  }
  function low(p){return normPath(p).toLowerCase()}
  function okPath(x){
    try{
      if(typeof window.gdiOkPath!=='function')return true;
      return !!window.gdiOkPath(x);
    }catch(_){return true}
  }
  function subtreePrefix(){
    const cur=low(window.location.pathname);
    if(cur==='')return'';
    const m=/^\/(\d+):$/.exec(cur);
    if(m)return'/'+m[1]+':';
    return cur;
  }
  function inSubtree(path){
    const pre=subtreePrefix();
    if(pre==='')return true;
    const lp=low(path);
    return lp.indexOf(pre+'/')===0||lp===pre;
  }
  function playerHref(p){
    const s=String(p||'');
    if(!s||s.indexOf('/fallback')===0)return'';
    return s.includes('?')?s+'&a=view':s+'?a=view';
  }
  async function safeGo(ev){
    const a=ev.currentTarget;
    const href=a.getAttribute('href')||'';
    if(!href||!href.startsWith('/'))return;
    ev.preventDefault();
    try{
      const r=await fetch(href,{method:'HEAD',redirect:'manual',credentials:'same-origin'});
      if(r.status>=300&&r.status<400){
        const loc=(r.headers.get('location')||'')+' '+(r.url||'');
        if(/login/i.test(loc)){showToast('Sess\u00e3o expirada \u2014 entre para retomar');location.href='/login';return;}
      }
    }catch(_){}
    location.href=href;
  }
  function nameInfo(target){
    const cur=normPath(window.location.pathname);
    const isDriveRoot=/^\/\d+:$/.test(cur);
    const tNorm=normPath(target);
    let rest=tNorm;
    if(!isDriveRoot&&tNorm.indexOf(cur+'/')===0)rest=tNorm.slice(cur.length+1);
    const seg=rest.split('/').filter(Boolean);
    if(isDriveRoot&&/^\d+:$/.test(seg[0]||''))seg.shift();
    if(seg.length&&/^\d+:$/.test(seg[0])){
      const dn=(window.drive_names||[])[parseInt(seg[0],10)];
      if(dn)seg[0]=dn;
    }
    let src=seg.length-1;
    let name=stripExt(seg[src]||'');
    if(isGenericName(name)){
      for(let j=seg.length-2;j>=0;j--){
        if(/^\d+:$/.test(seg[j]))break;
        if(!isGenericName(seg[j])){src=j;name=stripExt(seg[j]);break;}
      }
    }
    const folder=src>0?seg[src-1]:'';
    let drivePart='';
    if(isDriveRoot&&window.drive_names&&window.drive_names[window.current_drive_order])drivePart=window.drive_names[window.current_drive_order];
    return{name:name||'Aula',folder,drive:drivePart};
  }
  function srsDueCount(){
    const d=stateD();if(!d)return 0;
    const now=Date.now();let n=0;
    for(const k in(d.notes||{})){
      (d.notes[k]||[]).forEach(x=>{
        const id=k+'|'+x.at;
        const e=d.srs&&d.srs[id];
        const due=e?e.due:(x.at+86400000);
        if(due<=now)n++;
      });
    }
    return n;
  }
  function srsOpen(){
    const old=document.getElementById('gdi-srs-panel');
    if(old){old.remove();return;}
    const d=stateD()||{};
    const now=Date.now();
    const due=[];
    for(const k in(d.notes||{})){
      (d.notes[k]||[]).forEach(x=>{
        const id=k+'|'+x.at;
        const e=d.srs&&d.srs[id];
        const t=e?e.due:(x.at+86400000);
        if(t<=now)due.push({id,key:k,at:x.at,text:x.text,t:x.t,due:t});
      });
    }
    due.sort((a,b)=>a.due-b.due);
    const ov=document.createElement('div');ov.id='gdi-srs-panel';
    ov.style.cssText='position:fixed;inset:0;z-index:10002;background:rgba(5,7,10,.82);display:flex;align-items:center;justify-content:center;padding:20px;';
    GDI_ROOT().appendChild(ov);
    let idx=0;
    function render(){
      if(idx>=due.length){
        ov.innerHTML='<div style="background:var(--ferreto-surface,#161b22);border:1px solid var(--ferreto-border,#30363d);border-radius:16px;padding:34px;max-width:480px;text-align:center;color:var(--ferreto-text,#e6edf3);font-family:system-ui;"><div style="font-size:40px;">\ud83c\udf89</div><h3 style="margin:8px 0">Revis\u00e3o conclu\u00edda!</h3><p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px">As anota\u00e7\u00f5es voltam em 1, 7 e 30 dias at\u00e9 ficarem graduadas.</p><br><button class="gdi-mode-btn" id="gdi-srs-close">Fechar</button></div>';
        document.getElementById('gdi-srs-close').addEventListener('click',()=>ov.remove());
        return;
      }
      const n=due[idx];
      let lbl='Aula';try{lbl=decodeURIComponent(String(n.key).split('?')[0].split('/').filter(Boolean).pop()||'Aula').replace(/\.[a-z0-9]+$/i,'')}catch(_){}
      ov.innerHTML=`<div style="background:var(--ferreto-surface,#161b22);border:1px solid var(--ferreto-border,#30363d);border-radius:16px;padding:22px;max-width:540px;width:100%;color:var(--ferreto-text,#e6edf3);font-family:system-ui;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;">\ud83e\uddd0 Revis\u00e3o ${idx+1} de ${due.length}</span>
          <button class="gdi-mode-btn" id="gdi-srs-close" style="padding:2px 8px;font-size:11px;">\u2715</button>
        </div>
        <div style="font-size:12px;color:var(--ferreto-secondary,#7aa2ff);margin-bottom:4px;">${escHtml(realNameOf(n.key))}${n.t!=null?' \u00b7 '+gdiFmtTime(n.t):''}</div>
        <div style="font-size:15px;line-height:1.5;margin-bottom:16px;">${escHtml(n.text)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="gdi-srs-good" class="gdi-btn gdi-btn-primary"><i class="bi bi-check2"></i> Lembrei</button>
          <button id="gdi-srs-again" class="gdi-mode-btn"><i class="bi bi-arrow-repeat"></i> N\u00e3o lembrei</button>
          <a class="gdi-mode-btn" data-gdi-go href="${escHtml(playerHref(n.key))}"><i class="bi bi-play-fill"></i> Abrir aula</a>
        </div></div>`;
      document.getElementById('gdi-srs-close').addEventListener('click',()=>ov.remove());
      document.getElementById('gdi-srs-good').addEventListener('click',()=>{try{GDIUser.srsGrade(n.id,true)}catch(_){}idx++;render();});
      document.getElementById('gdi-srs-again').addEventListener('click',()=>{try{GDIUser.srsGrade(n.id,false)}catch(_){}idx++;render();});
      ov.querySelectorAll('[data-gdi-go]').forEach(a=>a.addEventListener('click',safeGo));
    }
    render();
  }
  function ghostScore(path){
    const seg=normPath(path).split('/').filter(Boolean);
    if(seg.length<2)return 0;
    return seg[seg.length-1].indexOf(seg[seg.length-2]+' - ')===0?1:0;
  }
  function pickCandidates(){
    const d=stateD();if(!d)return[];
    const seen=new Set(),out=[];
    const add=(k,at)=>{
      if(!k)return;
      const key=normPath(k);
      if(seen.has(key)||!inSubtree(k)||!okPath(k))return;
      seen.add(key);
      out.push({path:String(k).split('?')[0],at:Number(at)||0});
    };
    if(d.watched)for(const k in d.watched)add(k,d.watched[k]&&d.watched[k].at);
    if(d.resume)for(const k in d.resume)add(k,d.resume[k]&&d.resume[k].at);
    if(d.last&&d.last.path)add(d.last.path,d.last.at);
    (Array.isArray(d.history)?d.history:[]).forEach(h=>{if(h&&h.path)add(h.path,h.at)});
    out.sort((a,b)=>(ghostScore(a.path)-ghostScore(b.path))||(b.at-a.at));
    return out;
  }
  const vCache=new Map();
  function verify(path){
    if(vCache.has(path))return Promise.resolve(vCache.get(path));
    const pr=fetch(path,{method:'POST',credentials:'same-origin'})
      .then(r=>{vCache.set(path,r.ok);return r.ok})
      .catch(()=>{vCache.set(path,true);return true});
    vCache.set(path,pr);
    return pr;
  }
  async function bestTarget(){
    const cands=pickCandidates();
    for(const c of cands.slice(0,4)){
      if(await verify(c.path))return c.path;
    }
    return null;
  }
  function dbg(){
    const d=stateD();
    return{
      url:window.location.pathname,
      subarvore:subtreePrefix()||'(tudo)',
      gdiUserCarregado:!!(window.GDIUser&&GDIUser.loaded&&GDIUser.loaded()),
      fonteDados:(window.GDIUser&&GDIUser.loaded())?'GDIUser':(rescue?'resgate /userstate':'nenhuma'),
      candidatos:pickCandidates().slice(0,3).map(c=>c.path),
      history:Array.isArray(d&&d.history)?d.history.length:0
    };
  }
  window.gdiM13Debug=function(){const x=dbg();console.log('[GDI M13] diagnóstico:',x);return x;};
  let rendering=false;
  async function continueCardInit(){
    if(rendering)return;
    const d0=stateD();
    if(!d0){
      ensureRescue();
      // ★FIX: retry reduzido (5× com backoff 1s/2s/3s/5s/8s) — era 12× 750ms.
      const n=(continueCardInit.__n=(continueCardInit.__n||0)+1);
      if(n<=5)setTimeout(continueCardInit,[1000,2000,3000,5000,8000][n-1]||8000);
      return;
    }
    continueCardInit.__n=0;
    rendering=true;
    try{await renderCard(d0);}
    catch(e){log('erro no render:',e)}
    finally{rendering=false;}
  }
  async function renderCard(d){
    if(document.querySelector('#content .gdi-study'))return;
    const target=await bestTarget();
    if(document.querySelector('#content .gdi-study'))return;
    const host=document.querySelector('#content .gdi-wrap')||document.getElementById('content');
    if(!host)return;
    const p=window.location.pathname;
    const isHome=p==='/'||/^\/\d+:\/?$/.test(p);
    const days=new Set();
    const addDay=ts=>{if(ts)days.add(new Date(ts).toDateString())};
    for(const k in d.watched)addDay(d.watched[k]&&d.watched[k].at);
    for(const k in d.resume)addDay(d.resume[k]&&d.resume[k].at);
    if(d.last)addDay(d.last.at);
    for(const k in d.notes)(d.notes[k]||[]).forEach(n=>addDay(n.at));
    let streak=0;const day=new Date();
    const has=dt=>days.has(dt.toDateString());
    if(!has(day))day.setDate(day.getDate()-1);
    while(has(day)){streak++;day.setDate(day.getDate()-1);}
    let hours=0;
    for(const k in d.resume){const r=d.resume[k]||{};hours+=Math.min(r.t||0,(r.d>0?r.d:r.t)||0)}
    hours/=3600;
    const due=srsDueCount();
    const hMap=new Map();
    (Array.isArray(d.history)?d.history:[]).forEach(h=>{
      if(!h||!h.path||h.path===p||!inSubtree(h.path)||!okPath(h.path))return;
      const k=normPath(h.path);
      const prev=hMap.get(k);
      if(!prev||(Number(h.at)||0)>=(Number(prev.at)||0))hMap.set(k,h);
    });
    const hist=[...hMap.values()].sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0)).slice(0,6);
    const chips=hist.map(h=>({h,label:realNameOf(h.path)}));
    const cc={};
    chips.forEach(c=>{cc[c.label]=(cc[c.label]||0)+1});
    chips.forEach(c=>{if(cc[c.label]>1)c.label=(c.label+' \u00b7 '+stripExt(c.h.name||'')).slice(0,30)});
    if(!target&&!streak&&!hours&&!hist.length&&!due){
      const old0=document.getElementById('gdi-home-card');
      if(old0)old0.remove();
      log('sem dados utiliz\u00e1veis nesta sub\u00e1rvore \u2014 card oculto',dbg());
      return;
    }
    const lbl=target?nameInfo(target):null;
    const rKey=target?resumeKeyFor(target):'';
    const r=target?getResumeOf(d,rKey):null;
    const canSrs=!!(window.GDIUser&&typeof GDIUser.srsGrade==='function');
    const sig=String(target)+'|'+hist.map(h=>normPath(h.path)).join(',')+'|'+due+'|'+streak;
    const old=document.getElementById('gdi-home-card');
    if(old&&continueCardInit.__sig===sig)return;
    continueCardInit.__sig=sig;
    if(old)old.remove();
    const btn=target?`<a class="gdi-btn gdi-btn-primary" data-gdi-go href="${escHtml(playerHref(target))}"><i class="bi bi-play-fill"></i> Retomar</a>`:'';
    let html='<div id="gdi-home-card" class="gdi-panel" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:12px 16px;margin-bottom:14px;">';
    if(target){
      let head;
      if(lbl.drive)head='Continuar em '+lbl.drive+(lbl.folder?' \u2192 '+lbl.folder:'');
      else if(lbl.folder)head='Continuar em '+lbl.folder;
      else head='Continuar';
      const sub=r?('parou em '+gdiFmtTime(r.t)):'sem posi\u00e7\u00e3o salva';
      html+=`<div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;">
        <i class="bi bi-play-circle-fill" style="font-size:30px;color:var(--ferreto-primary,#7aa2ff);"></i>
        <div style="min-width:0;">
          <div style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;letter-spacing:.06em;">${escHtml(head)}</div>
          <div style="font-weight:600;color:var(--ferreto-text,#f0f6fc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(lbl.name)}</div>
          <div style="font-size:12px;color:var(--ferreto-text-muted,#8b949e);">${escHtml(sub)}</div>
        </div></div>${btn}`;
    }
    if(isHome){
      html+=`<div style="display:flex;gap:16px;font-size:12px;color:var(--ferreto-text-muted,#8b949e);flex-wrap:wrap;">
        ${streak>0?`<span><i class="bi bi-fire" style="color:#ff922b;"></i> ${streak} dia${streak>1?'s':''} seguidos</span>`:''}
        ${hours>0?`<span><i class="bi bi-clock-history"></i> \u2248 ${String(hours.toFixed(1)).replace('.',',')}h assistidas</span>`:''}
      </div>`;
      if(due>0&&canSrs)html+=`<div style="flex-basis:100%;margin-top:2px;"><button id="gdi-srs-open" class="gdi-mode-btn" style="font-size:12px;"><i class="bi bi-mortarboard-fill" style="color:#ffd43b;"></i> Revisar ${due} anota\u00e7\u00e3${due>1?'\u00f5es':'o'} de hoje</button></div>`;
    }else if(streak>0){
      html+=`<span style="font-size:12px;color:var(--ferreto-text-muted,#8b949e);"><i class="bi bi-fire" style="color:#ff922b;"></i> ${streak} dia${streak>1?'s':''}</span>`;
    }
    if(chips.length){
      html+=`<div style="flex-basis:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:2px;">
        <span style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);">Recentes aqui:</span>
        ${chips.map(c=>`<a class="gdi-mode-btn" data-gdi-go style="padding:2px 8px;font-size:11px;" href="${escHtml(playerHref(c.h.path))}" title="${escHtml(normPath(c.h.path))}">${escHtml(c.label.slice(0,26))}</a>`).join('')}
      </div>`;
    }
    html+='</div>';
    host.insertAdjacentHTML('afterbegin',html);
    // ★FIX: listeners presos ao CARD (antes pegava todos [data-gdi-go] do wrapper)
    const card=document.getElementById('gdi-home-card');
    if(card){
      card.querySelectorAll('[data-gdi-go]').forEach(a=>a.addEventListener('click',safeGo));
      card.querySelector('#gdi-srs-open')?.addEventListener('click',srsOpen);
    }
    log('card renderizado \u2014 alvo verificado:',target||'(nenhum)','| nome:',lbl?lbl.name:'-');
  }
  window.GDI_MODULES.push({name:'continue-card',init:continueCardInit});
  Bus.onGlobal('user:ready',()=>setTimeout(continueCardInit,50));
  // ★FIX: debounce no video:switched — era disparado múltiplas vezes
  // seguidas (playlist polling), cada uma chamando ensureRescue + continueCardInit.
  let _vsTimer=null;
  Bus.onGlobal('video:switched',()=>{
    if(_vsTimer)clearTimeout(_vsTimer);
    _vsTimer=setTimeout(()=>{
      _vsTimer=null;
      if(!(window.GDIUser&&GDIUser.loaded())&&Date.now()-rescueAt>15000)ensureRescue(true);
      setTimeout(continueCardInit,250);
    },800);
  });
  log('v19.6-fix registrado');
})();

// ═══ M14: PROGRESSOS ═══
(function(){
  let busy=false;
  function modProgress(){
    if(!GDIUser.loaded())return;
    const rows=[...document.querySelectorAll('#list a.gdi-row')]
      .filter(a=>a.querySelector('.gdi-row-icon i.bi-folder-fill')&&!a.querySelector('.gdi-modprog'))
      .slice(0,30);
    (async()=>{
      for(const row of rows){
        if(!document.body.contains(row))return;
        const href=row.getAttribute('href')||'';
        if(!href||href.startsWith('/fallback'))continue;
        const files=await gdiListAllFiles(href,gdiGetPw(href));
        if(!document.body.contains(row))continue;
        let total=0,done=0;
        for(const f of files){
          if(f.mimeType==='application/vnd.google-apps.folder')continue;
          if(!FILE_TYPES.video.includes((f.fileExtension||'').toLowerCase()))continue;
          if(/\.part-/i.test(f.name))continue;
          const bytes=Number(f.size)||0;if(bytes>0&&bytes<1024*1024)continue;
          total++;
          try{if(GDIUser.isWatched(href+encodeURIComponent(f.name)))done++;}catch(_){}
        }
        if(total>0&&document.body.contains(row)){
          const pct=Math.round(done/total*100);
          const el=document.createElement('span');
          el.className='gdi-modprog';
          el.innerHTML=`<b>${done}/${total}</b> \u00b7 ${pct}%`;
          el.title='Progresso de v\u00eddeos nesta pasta';
          row.querySelector('.gdi-row-acts')?.appendChild(el);
        }
        await sleep(40);
      }
    })();
  }
  function line(){
    const countEl=document.getElementById('count');
    if(!countEl||!countEl.classList.contains('show')){document.getElementById('gdi-progress-line')?.remove();return;}
    const rows=document.querySelectorAll('#list div.gdi-row');
    let done=0,total=0,firstTodo='';
    rows.forEach(row=>{
      if(!row.querySelector('.gdi-row-icon i.bi-camera-video-fill'))return;
      const a=row.querySelector('a.gdi-row-name');if(!a)return;
      const href=a.getAttribute('href')||'';
      if(href.startsWith('/fallback'))return;
      total++;
      let w=false;try{w=GDIUser.isWatched(href.split('?')[0])}catch(_){}
      if(w)done++;else if(!firstTodo)firstTodo=href;
    });
    const hasFolders=!!document.querySelector('#list a.gdi-row .gdi-row-icon i.bi-folder-fill');
    const el0=document.getElementById('gdi-progress-line');
    if((!total&&!hasFolders)||!GDIUser.loaded()){if(el0)el0.remove();return;}
    let el=el0;
    if(!el){el=document.createElement('div');el.id='gdi-progress-line';countEl.insertAdjacentElement('afterend',el);}
    let html='';
    if(total){
      const pct=Math.round(done/total*100);
      html+=`<i class="bi bi-bar-chart-fill" style="color:var(--ferreto-primary,#7aa2ff);"></i>
        <span>${done}/${total} assistido${done===1?'':'s'} (${pct}%)</span>
        <div style="flex:1;max-width:160px;height:5px;background:var(--ferreto-surface-3,rgba(255,255,255,.1));border-radius:3px;overflow:hidden;">
          <div style="height:5px;width:${pct}%;background:${pct>=100?'#1a7f37':'#1f6feb'};transition:width .4s;"></div>
        </div>`;
      if(firstTodo)html+=`<button id="gdi-next-lesson" class="gdi-mode-btn" style="padding:2px 8px;font-size:11px;" data-href="${escHtml(firstTodo)}" title="Abrir a primeira aula ainda n\u00e3o assistida"><i class="bi bi-play-fill"></i> N\u00e3o assistida</button>`;
    }
    if(hasFolders)html+=`<button id="gdi-course-btn" class="gdi-mode-btn" style="padding:2px 8px;font-size:11px;" title="Somar o progresso de TODAS as subpastas"><i class="bi bi-diagram-3"></i> Progresso do curso</button>`;
    el.innerHTML=html;
    el.querySelector('#gdi-next-lesson')?.addEventListener('click',function(){location.href=this.dataset.href;});
    el.querySelector('#gdi-course-btn')?.addEventListener('click',course);
  }
  async function course(){
    if(busy)return;busy=true;
    const btn=document.getElementById('gdi-course-btn');
    if(btn){btn.disabled=true;btn.innerHTML='<i class="bi bi-hourglass-split"></i> calculando\u2026';}
    try{
      const folders=[...document.querySelectorAll('#list a.gdi-row')]
        .filter(a=>a.querySelector('.gdi-row-icon i.bi-folder-fill'))
        .map(a=>a.getAttribute('href')||'')
        .filter(h=>h&&!h.startsWith('/fallback'));
      let done=0,total=0;
      const root=trimChar(window.location.pathname,'/')+'/';
      const bases=[root,...folders.map(f=>f.endsWith('/')?f:f+'/')];
      for(const base of bases){
        const files=await gdiListAllFiles(base,gdiGetPw(base));
        for(const f of files){
          if(f.mimeType==='application/vnd.google-apps.folder')continue;
          if(!FILE_TYPES.video.includes((f.fileExtension||'').toLowerCase()))continue;
          if(/\.part-/i.test(f.name))continue;
          const bytes=Number(f.size)||0;if(bytes>0&&bytes<1024*1024)continue;
          total++;
          try{if(GDIUser.isWatched(base+encodeURIComponent(f.name)))done++;}catch(_){}
        }
      }
      const line=document.getElementById('gdi-progress-line');
      if(line){
        const pct=total?Math.round(done/total*100):0;
        line.insertAdjacentHTML('beforeend',`<span style="color:var(--ferreto-text,#e6edf3);"><i class="bi bi-mortarboard-fill" style="color:#3fb950;"></i> Curso: <b>${done}/${total}</b> aulas (${pct}%)</span>`);
        if(btn)btn.remove();
      }
    }catch(_){showToast('N\u00e3o foi poss\u00edvel calcular o progresso do curso');}
    finally{busy=false;}
  }
  window.GDI_MODULES.push({name:'progress',init:function(){
    const c=document.getElementById('count');
    if(c&&!c.__m14){c.__m14=true;
      // ★FIX: desconecta o observer da página anterior (vazamento por página)
      if(window.__gdiM14obs){try{window.__gdiM14obs.disconnect()}catch(_){}}
      const obs=new MutationObserver(()=>line());
      obs.observe(c,{childList:true,characterData:true,subtree:true});
      window.__gdiM14obs=obs;}
    line();modProgress();
  }});
  Bus.onGlobal('user:ready',()=>{try{line()}catch(_){}});
})();

// ═══ M16: PWA best-effort ═══
(function(){
  try{
    if(!document.querySelector('link[rel="manifest"]')){
      const origin=window.location.origin;
      const MAN={name:(document.siteName||'Drive')+' Estudos',short_name:'Estudos',start_url:origin+'/',scope:origin+'/',display:'standalone',background_color:'#0b0e14',theme_color:'#0b0e14',icons:[]};
      const l=document.createElement('link');l.rel='manifest';
      l.href=URL.createObjectURL(new Blob([JSON.stringify(MAN)],{type:'application/manifest+json'}));
      document.head.appendChild(l);
    }
  }catch(_){}
  if('serviceWorker' in navigator&&location.protocol==='https:'){
    navigator.serviceWorker.register('/gdi-sw.js',{scope:'/'})
      .then(()=>console.log('[GDI PWA] offline ativo'))
      .catch(()=>console.log('[GDI PWA] offline opcional desativado'));
  }
})();

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
    $("#content").html(l);
    let d=null,o=1,s=1;
    function r(){
      const p=document.getElementById("pdf-canvas"),g=p.getContext("2d");
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
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
            $("#pdf-spinner").hide();
          }),
          document.getElementById("pdf-page-num").textContent=u;
        });
      }
      pdfjsLib.getDocument(n).promise.then(function(u){
        d=u,document.getElementById("pdf-page-count").textContent=u.numPages,f(o);
      }).catch(function(u){
        $("#pdf-spinner").html(`<div class="gdi-alert gdi-alert-error">Could not load PDF: ${u.message}</div>`);
      }),
      document.getElementById("pdf-prev").addEventListener("click",function(){o>1&&(o--,$("#pdf-spinner").show(),f(o))}),
      document.getElementById("pdf-next").addEventListener("click",function(){d&&o<d.numPages&&(o++,$("#pdf-spinner").show(),f(o))}),
      document.getElementById("pdf-zoom").addEventListener("input",function(){s=parseInt(this.value)/100,document.getElementById("pdf-zoom-val").textContent=this.value+"%",f(o)});
    }
    if(typeof pdfjsLib<"u")r();
    else{
      const p=document.createElement("script");
      p.src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
      p.onload=r,
      p.onerror=function(){$("#pdf-spinner").html('<div class="gdi-alert gdi-alert-error">Failed to load PDF viewer.</div>')},
      document.head.appendChild(p);
    }
  };
})();

// ═══ M18: PAINEL DE DEBUG ═══
const GDIDebug=(()=>{const i=[];let e=null;function t(){return new Date().toISOString().slice(11,23)}function n(){if(e||(e=document.getElementById("gdi-debug-log")),!e)return;const d={req:"#da77f2",api:"#69db7c",error:"#ff6b6b",warn:"#ffa94d",info:"#74c0fc"},o=i.map(r=>{const p=d[r.type]||"#aaa",g=r.data!=null?typeof r.data=="string"?r.data:JSON.stringify(r.data,null,2):"";return`<div class="gdi-dbg-entry"><span class="gdi-dbg-ts">${r.ts}</span><span class="gdi-dbg-badge" style="color:${p}">[${r.type.toUpperCase()}]</span><span class="gdi-dbg-msg">${escHtml(r.label)}</span>`+(g?`<pre class="gdi-dbg-pre">${escHtml(g)}</pre>`:"")+"</div>"}).join("");e.innerHTML=o||'<span class="gdi-dbg-empty">No entries yet.</span>',e.scrollTop=e.scrollHeight;const s=document.getElementById("gdi-dbg-count");s&&(s.textContent=i.length)}function a(d,o,s){window.UI?.debug_mode&&(i.push({ts:t(),type:d,label:o,data:s!==void 0?s:null}),n())}function c(){e=document.getElementById("gdi-debug-log"),i.length>0&&n(),a("info","Debug attached",{path:window.location.pathname,search:window.location.search,drive:window.current_drive_order,version:window.UI?.version,model_type:window.MODEL?.root_type})}function l(){i.length=0,e&&(e.innerHTML='<span class="gdi-dbg-empty">Cleared.</span>');const d=document.getElementById("gdi-dbg-count");d&&(d.textContent="0")}return{log:a,attach:c,clear:l}})();
window.GDIDebug=GDIDebug;

if(window.UI?.debug_mode){const i=window.fetch.bind(window);window.fetch=async function(t,n){const a=typeof t=="string"?t:t.url||String(t),c=(n?.method||"GET").toUpperCase();let l;try{l=n?.body?JSON.parse(n.body):void 0}catch{l=n?.body}GDIDebug.log("req",`\u2192 ${c} ${a}`,l!==void 0?l:null);const d=Date.now();try{const o=await i(t,n),s=o.clone();let r;try{r=await s.json()}catch{r=null}return GDIDebug.log(o.ok?"api":"error",`\u2190 ${o.status} ${a} (${Date.now()-d}ms)`,r),o}catch(o){throw GDIDebug.log("error",`\u2717 FETCH FAILED: ${a}`,String(o)),o}};const e=console.error.bind(console);console.error=function(...t){GDIDebug.log("error",t.map(n=>n instanceof Error?n.stack||n.message:typeof n=="object"?JSON.stringify(n):String(n)).join(" ")),e(...t)},window.addEventListener("error",t=>{GDIDebug.log("error",`Uncaught: ${t.message}`,`${t.filename}:${t.lineno}:${t.colno}`)}),window.addEventListener("unhandledrejection",t=>{GDIDebug.log("error",`UnhandledPromise: ${String(t.reason)}`)})}

window.GDI_MODULES.push({name:'debug',init:function(){
  if(!(window.UI&&window.UI.debug_mode))return;
  if(document.getElementById('gdi-debug-wrap'))return;
  const wrap=document.createElement('div');
  wrap.className='gdi-debug-wrap';wrap.id='gdi-debug-wrap';
  wrap.innerHTML=`<div class="gdi-debug-head" onclick="document.getElementById('gdi-debug-log').classList.toggle('collapsed')">
    <strong><i class="bi bi-bug-fill" style="color:#f0883e;"></i> GDI Debug <span id="gdi-dbg-count" class="gdi-dbg-count">0</span></strong>
    <div class="gdi-debug-actions">
      <button onclick="event.stopPropagation();GDIDebug.clear()">Clear</button>
      <button onclick="event.stopPropagation();document.getElementById('gdi-debug-log').classList.toggle('collapsed')">Toggle</button>
    </div></div>
  <div id="gdi-debug-log" class="collapsed"></div>`;
  GDI_ROOT().appendChild(wrap);
  try{GDIDebug.attach()}catch(_){}
}});

// ═══ M19: TÍTULO LIMPO DA ABA ═══
(function(){
  const MAX=64;
  const POMO=/^\d\d:\d\d\s+[^\s\u00b7]+\s+\u00b7\s+/;
  const dec=s=>{try{return decodeURIComponent(String(s||''))}catch(_){return String(s||'')}};
  const clean=s=>dec(s).replace(/\s+/g,' ').trim();
  function segs(p){return clean(String(p||'').split('?')[0]).split('/').filter(Boolean)}
  function build(name,parent){
    name=(name||'').replace(/\.[a-z0-9]{1,5}$/i,'').trim();
    parent=(parent&&!/^\d+:$/.test(parent))?parent:'';
    let t=parent?parent+' \u00b7 '+name:name;
    if(t.length>MAX)t=(name||'').slice(0,MAX);
    return t;
  }
  function fromPlaylist(){
    try{
      const pv=window.playlistVideos,ci=window.currentIndex;
      if(pv&&typeof ci==='number'&&ci>=0&&pv[ci]){
        const m=pv[ci];
        const ps=segs(m.pageUrl||'');
        return build(clean(m.name||m.origName||''),ps.length>=2?ps[ps.length-2]:'');
      }
    }catch(_){}
    return null;
  }
  function fromUrl(){
    const seg=segs(window.location.pathname);
    if(!seg.length)return null;
    const first=seg[0]||'';
    if(first.indexOf(':')!==-1&&!/^\d+:$/.test(first))return null;
    if(/^\d+:$/.test(first)){
      if(seg.length===1){
        const dn=window.drive_names&&window.drive_names[parseInt(first,10)];
        return dn||null;
      }
      return build(seg[seg.length-1],seg.length>=3?seg[seg.length-2]:'');
    }
    return null;
  }
  function apply(){
    try{
      const cur=document.title||'';
      if(POMO.test(cur))return;
      const next=fromPlaylist()||fromUrl();
      if(!next||next===cur)return;
      document.title=next;
    }catch(_){}
  }
  function bindTitle(){
    const el=document.querySelector('title');
    if(!el){setTimeout(bindTitle,400);return;}
    new MutationObserver(apply).observe(el,{childList:true,characterData:true,subtree:true});
  }
  bindTitle();
  setInterval(apply,1500);
  Bus.onGlobal('page:change',apply);
  Bus.onGlobal('title:change',apply);
  Bus.onGlobal('video:switched',()=>setTimeout(apply,150));
  Bus.onGlobal('media:ready',apply);
  window.GDI_MODULES.push({name:'clean-title',init:apply});
  apply();
  console.log('[GDI M19] t\u00edtulo limpo ativo');
})();

// ═══ M20: PLAYLIST — SEM OBSERVER (★ o fix do congelamento) ═══
// O MutationObserver que vivia aqui se auto-disparava infinitamente
// quando o render demorava >150ms (playlists grandes) — era o loop
// que travava a aba para sempre. Removido. Re-render só via Bus.
// Também: teto de 600 itens no DOM e UM listener delegado.
(function(){
  const LS_OPEN='gdi-playlist-open',LS_HIDE='gdi-hide-watched',PL_CAP=600;
  const norm=p=>{try{return decodeURIComponent(String(p||'').split('?')[0])}catch(_){return String(p||'').split('?')[0]}};
  window.gdiNormKey=norm;
  window.gdiVideoKey=function(){
    try{const pv=window.playlistVideos,ci=window.currentIndex;
      if(pv&&typeof ci==='number'&&ci>=0&&pv[ci]&&pv[ci].pageUrl)return pv[ci].pageUrl.split('?')[0];
    }catch(_){}
    return window.location.pathname;
  };
  window.gdiMarkVideo=function(){
    try{GDIUser.markWatched(norm(window.gdiVideoKey()))}catch(_){}
    try{GDIUser.markWatched(window.location.pathname)}catch(_){}
    Bus.emit('watched:changed');
  };
  window.gdiUnmarkVideo=function(){
    [window.gdiVideoKey(),window.location.pathname].forEach(k=>{
      try{GDIUser.unmarkWatched(k);GDIUser.unmarkWatched(norm(k))}catch(_){}
    });
    Bus.emit('watched:changed');
  };
  function isW(m){
    const raw=(m.pageUrl||'').split('?')[0];
    try{return GDIUser.isWatched(raw)||GDIUser.isWatched(norm(raw))}catch(_){return false}
  }
  function items(){return window.playlistVideos||[]}
  function cur(){const i=window.currentIndex;return(typeof i==='number'&&i>=0)?i:-1}
  function parentPath(){return window.location.pathname.split('/').slice(0,-2).join('/')+'/'}
  function healKeys(){
    const i=cur();if(i<0)return;const m=items()[i];if(!m)return;
    const raw=(m.pageUrl||'').split('?')[0];
    let a=false,b=false,c=false;
    try{a=GDIUser.isWatched(raw);b=GDIUser.isWatched(norm(raw));c=GDIUser.isWatched(window.location.pathname)}catch(_){}
    try{if((a||b)&&!c)GDIUser.markWatched(window.location.pathname);
        if(c&&!(a||b))GDIUser.markWatched(norm(raw));}catch(_){}
  }
  function renderItems(){
    const list=document.getElementById('gdi-playlist-list');
    if(!list)return;
    const pv=items(),ci=cur();
    if(!pv.length){list.innerHTML='<div class="gdi-notes-empty">Nenhuma aula encontrada.</div>';return;}
    const hide=localStorage.getItem(LS_HIDE)==='1';
    const shown=pv.length>PL_CAP?pv.slice(0,PL_CAP):pv;
    let h='';
    shown.forEach((m,idx)=>{
      const w=isW(m),c=idx===ci;
      if(hide&&w&&!c)return;
      const nm=m.name||m.origName||'(sem nome)';
      h+=`<div class="gdi-playlist-item${c?' cur':''}${w&&!c?' watched':''}" data-idx="${idx}" title="${escHtml(nm)}">
        <div><i class="bi bi-${c?'play-fill':w?'check-circle-fill':'film'} me-2"></i><span style="font-weight:${c?'600':'400'};">${escHtml(nm)}</span></div>
        <span class="gdi-pl-size">${w?'\u2713 ':''}${escHtml(m.size||'')}</span>
      </div>`;
    });
    if(pv.length>shown.length)h+=`<div style="padding:6px 12px;font-size:11px;color:var(--ferreto-text-muted,#8b949e);">\u2026 +${pv.length-shown.length} aulas (Pr\u00f3xima/Anterior e a tecla J alcan\u00e7am todas)</div>`;
    list.innerHTML=h||'<div class="gdi-notes-empty">Todas assistidas (filtro ativo).</div>';
    if(pv[ci]){const el=list.querySelector('.gdi-playlist-item[data-idx="'+ci+'"]');
      if(el)try{el.scrollIntoView({block:'nearest'})}catch(_){}}
  }
  function renderMeta(){
    const pv=items(),ci=cur();
    const cnt=document.getElementById('gdi-pl-count')||document.getElementById('gdi-playlist-count');
    if(cnt)cnt.textContent=pv.length?`${ci+1} / ${pv.length}`:'';
  }
  function syncWatchedBtn(){
    const wb=document.getElementById('gdi-watched-btn');if(!wb)return;
    let done=false;
    try{done=GDIUser.isWatched(window.gdiVideoKey())||GDIUser.isWatched(norm(window.gdiVideoKey()))||GDIUser.isWatched(window.location.pathname)}catch(_){}
    wb.classList.toggle('done',done);
    wb.innerHTML=done?'<i class="bi bi-eye-fill"></i><span>Assistida \u2713</span>':'<i class="bi bi-eye"></i><span>Assistido</span>';
  }
  function refreshAll(){healKeys();renderItems();renderMeta();syncWatchedBtn();}
  function downloadJSON(){
    const pv=items();
    if(pv.length<2){showToast('Playlist muito curta para exportar');return;}
    const data=pv.map(v=>({n:v.origName||v.name,f:v.folderLabel||null,
      s:v.sizeBytes||0,l:v.rawLink||'',m:v.mimeType||'',fd:v.folder||'',t:v.thumbRaw||''}));
    const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='playlist.json';
    GDI_ROOT().appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    showToast('playlist.json baixado \u2014 suba na pasta SUPERIOR do curso');
  }
  function ensureUI(){
    let wrap=document.getElementById('gdi-playlist-wrap');
    if(!wrap){
      // ★FIX: app.min.js modular usa slots vazios (#gdi-slot-left) sem o
      // markup da playlist. Cria o wrap dentro do slot se não existir.
      const slot=document.getElementById('gdi-slot-left')||document.querySelector('.gdi-study-left');
      if(!slot)return null;
      wrap=document.createElement('div');
      wrap.id='gdi-playlist-wrap';
      slot.appendChild(wrap);
    }
    if(wrap.dataset.m20)return wrap;
    wrap.dataset.m20='1';
    wrap.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:6px;flex-wrap:wrap;">
      <button id="gdi-pl-toggle" class="gdi-mode-btn" style="padding:4px 10px;font-size:12px;flex:1;justify-content:flex-start;min-width:0;" title="Mostrar/ocultar a playlist">
        <i class="bi bi-collection-play me-2"></i><strong style="font-size:13px;">Playlist</strong>
        <span id="gdi-pl-count" style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);margin-left:6px;"></span>
        <i id="gdi-pl-chev" class="bi bi-chevron-down" style="margin-left:auto;"></i>
      </button>
      <button id="gdi-pl-filter" class="gdi-mode-btn" style="padding:4px 9px;font-size:11px;" title="Esconder aulas j\u00e1 assistidas"><i class="bi bi-funnel"></i></button>
      <button id="gdi-pl-reload" class="gdi-mode-btn" style="padding:4px 9px;font-size:11px;" title="Descartar o cache e reescanear as pastas"><i class="bi bi-arrow-clockwise"></i></button>
      <button id="gdi-pl-json" class="gdi-mode-btn" style="padding:4px 9px;font-size:11px;" title="Baixar playlist.json"><i class="bi bi-filetype-json"></i></button>
    </div>
    <div id="gdi-playlist-body" style="overflow-y:auto;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px;background:rgba(0,0,0,.2);max-height:240px;">
      <div id="gdi-playlist-list"></div>
    </div>`;
    const body=wrap.querySelector('#gdi-playlist-body');
    const chev=wrap.querySelector('#gdi-pl-chev');
    const setOpen=v=>{
      body.style.display=v?'block':'none';
      chev.className='bi bi-chevron-'+(v?'up':'down');
      try{localStorage.setItem(LS_OPEN,v?'1':'0')}catch(_){}
    };
    // ★FIX: por padrão a playlist fica RECOLHIDA (só o header visível),
    // como no bloco único. Usuário expande clicando no header.
    let open=false;try{open=localStorage.getItem(LS_OPEN)==='1'}catch(_){}
    setOpen(open);
    wrap.querySelector('#gdi-pl-toggle').addEventListener('click',()=>setOpen(body.style.display==='none'));
    const fBtn=wrap.querySelector('#gdi-pl-filter');
    const fSync=()=>{const on=localStorage.getItem(LS_HIDE)==='1';
      fBtn.classList.toggle('active',on);
      fBtn.innerHTML='<i class="bi bi-funnel'+(on?'-fill':'')+'"></i>';};
    fBtn.addEventListener('click',()=>{
      const on=localStorage.getItem(LS_HIDE)==='1';
      localStorage.setItem(LS_HIDE,on?'0':'1');fSync();renderItems();});
    fSync();
    wrap.querySelector('#gdi-pl-reload').addEventListener('click',()=>{
      try{localStorage.removeItem('gdi-xpl::'+(window.location.host||'')+'::'+parentPath())}catch(_){}
      try{Object.keys(sessionStorage).forEach(k=>{if(k.indexOf('gdi-pljson-probe')===0)sessionStorage.removeItem(k)})}catch(_){}
      showToast('Cache apagado \u2014 reescaneando\u2026');
      setTimeout(()=>location.reload(),600);
    });
    wrap.querySelector('#gdi-pl-json').addEventListener('click',downloadJSON);
    return wrap;
  }
  // expõe para o core (app.min.js renderPlaylistUI) poder garantir o wrap
  window.gdiEnsurePlaylist=function(){return ensureUI();};
  window.GDI_MODULES.push({name:'playlist-ui',init:function(){
    // ★FIX: roda em qualquer página de vídeo (tem #gdi-slot-left ou
    // #gdi-study), não exige #gdi-playlist-wrap pré-existente.
    const slot=document.getElementById('gdi-slot-left')||document.querySelector('.gdi-study-left');
    const existing=document.getElementById('gdi-playlist-wrap');
    if(!slot&&!existing)return;
    ensureUI();
    const list=document.getElementById('gdi-playlist-list');
    // ★FIX: UM listener delegado no container (era 1 por aula + observer infinito)
    if(list&&!list.__m20deleg){
      list.__m20deleg=true;
      list.addEventListener('click',e=>{
        const it=e.target.closest('.gdi-playlist-item');
        if(!it)return;
        const k=parseInt(it.dataset.idx,10);
        if(!isNaN(k)&&items()[k]&&window.switchVideo)window.switchVideo(k);
      });
    }
    refreshAll();
  }});
  // ★FIX: polling — buildPlaylist() no app.min.js é assíncrono; quando
  // ele popula window.playlistVideos, o init já rodou. Re-renderiza
  // quando detecta mudança no tamanho da playlist.
  let _plLen=-1,_plPoll=0;
  function _plPollFn(){
    const n=items().length;
    if(n!==_plLen){
      _plLen=n;
      if(n>0){ensureUI();refreshAll();}
    }
    if(++_plPoll<80&&_plPoll<80)setTimeout(_plPollFn,750); // ~60s
  }
  setTimeout(_plPollFn,500);
  Bus.onGlobal('watched:changed',()=>setTimeout(refreshAll,30));
  Bus.onGlobal('video:switched',()=>setTimeout(refreshAll,120));
  Bus.onGlobal('user:ready',()=>setTimeout(refreshAll,60));
})();

// ═══════════════════════════════════════════════════════════════
// M23: ESTUDO ATIVO — questões, simulados, cronograma, revisões
// Fornece renderQuestoes/renderSimulado/renderCronograma/renderRevisoes
// consumidos pelo M22 (Central de Estudos). Dados em localStorage.
// Integra com: GDIUser (SRS), /api/ai (ISA gera questões), playlist.
// ═══════════════════════════════════════════════════════════════
(function(){
  const LQ='gdi-questions-v1',LS_SRS='gdi-q-srs-v1',LS_SIM='gdi-simulados-v1',LS_CRON='gdi-cronograma-v1',LS_ERR='gdi-caderno-erros-v1';
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}};
  const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const fmtDate=ds=>{try{return new Date(ds+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}catch(_){return ds}};
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  // ── Banco de questões ──
  const questions=()=>lsGet(LQ,[]);
  const saveQ=q=>lsSet(LQ,q);
  const addQ=obj=>{const q=questions();const item={id:uid(),createdAt:Date.now(),hits:0,misses:0,...obj};q.push(item);saveQ(q);return item;};
  const delQ=id=>saveQ(questions().filter(q=>q.id!==id));
  const getQ=id=>questions().find(q=>q.id===id);

  // ── SRS das questões ( Leitner 5 boxes ) ──
  const qSrs=()=>lsGet(LS_SRS,{});
  const saveQSrs=s=>lsSet(LS_SRS,s);
  const BOX_INTERVALS=[1,3,7,21,60]; // dias
  function gradeQ(id,acertou){
    const s=qSrs();const cur=s[id]||{box:0,due:Date.now()+86400000,last:0};
    if(acertou){cur.box=Math.min(4,cur.box+1);}
    else{cur.box=0;}
    cur.due=Date.now()+BOX_INTERVALS[cur.box]*86400000;
    cur.last=Date.now();
    s[id]=cur;saveQSrs(s);
    // caderno de erros
    if(!acertou){const err=lsGet(LS_ERR,[]);if(!err.includes(id)){err.push(id);lsSet(LS_ERR,err);}}
  }
  const dueQ=()=>questions().filter(q=>{const s=qSrs()[q.id];return !s||s.due<=Date.now();});
  const errQ=()=>{const err=lsGet(LS_ERR,[]);return questions().filter(q=>err.includes(q.id));};

  // ── Simulados ──
  const simus=()=>lsGet(LS_SIM,[]);
  const saveSim=s=>lsSet(LS_SIM,s);

  // ── Aula atual (contexto para gerar questões) ──
  function currentLesson(){
    const t=document.querySelector('.gdi-file-header-name');
    return t?t.textContent.trim():'';
  }

  // ── Gerar questões via ISA (/api/ai) ──
  async function gerarViaISA(tema,n){
    const prompt='Gere '+n+' questões de múltipla escolha (4 alternativas) sobre: "'+tema+'". '+
      'Formato JSON array, cada item: {"statement":"...","options":["a","b","c","d"],"correct":0,"explanation":"..."}. '+
      'correct é o índice 0-3 da alternativa certa. Nível concurso público brasileiro. Sem comentários, só JSON.';
    const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:prompt,messages:[]})});
    const data=await r.json();
    if(!data.ok)throw new Error(data.error||'Meggy indisponível');
    // ★ parsing robusto: usa o helper compartilhado (window.__gdiParseJsonArray)
    const parseFn=window.__gdiParseJsonArray||function(raw){
      let t=String(raw||'').replace(/```(?:json)?\s*/gi,'').replace(/```\s*/g,'');
      const f=t.indexOf('['),l=t.lastIndexOf(']');
      if(f>=0&&l>f)t=t.slice(f,l+1);
      try{return JSON.parse(t);}catch(e){
        const err=new Error('Resposta não é JSON array válido. Primeiros 500 chars: '+String(raw).slice(0,500));
        throw err;
      }
    };
    const arr=parseFn(data.response);
    if(!Array.isArray(arr))throw new Error('Resposta não é array');
    return arr.map(q=>({
      subject:tema,
      statement:String(q.statement||''),
      options:Array.isArray(q.options)?q.options.map(String):[],
      correct:Number(q.correct)||0,
      explanation:String(q.explanation||''),
      source:'ISA'
    }));
  }

  // ── Render: Questões ──
  let _qFilterSubject=null; // null = todas
  window.renderQuestoes=function(box){
    const qs=questions();
    const due=dueQ().length;
    const err=errQ().length;
    box.innerHTML=`
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
        <b style="color:var(--ferreto-text,#f0f6fc);">${qs.length} questões</b>
        ${due?`<span style="color:var(--ferreto-primary,#ff8b9f);font-size:12px;">${due} p/ revisar hoje</span>`:''}
        ${err?`<span style="color:#ff8b8b;font-size:12px;">${err} no caderno de erros</span>`:''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <button id="gdi-q-resolve-due" class="gdi-btn gdi-btn-primary" style="font-size:12px;" ${due?'':'disabled'}><i class="bi bi-play-fill"></i> Resolver revisões (${due})</button>
        <button id="gdi-q-resolve-err" class="gdi-mode-btn" style="font-size:12px;" ${err?'':'disabled'}><i class="bi bi-x-circle"></i> Caderno de erros (${err})</button>
        <button id="gdi-q-gen" class="gdi-mode-btn" style="font-size:12px;"><i class="bi bi-stars"></i> Gerar com Meggy</button>
        <button id="gdi-q-add" class="gdi-mode-btn" style="font-size:12px;"><i class="bi bi-plus-lg"></i> Adicionar</button>
        <button id="gdi-q-import" class="gdi-mode-btn" style="font-size:12px;"><i class="bi bi-upload"></i> Importar JSON</button>
        <button id="gdi-q-flasherr" class="gdi-mode-btn" style="font-size:12px;" ${err?'':'disabled'} title="Cria flashcards a partir das questões que você errou"><i class="bi bi-card-text"></i> Flashcards das erradas</button>
      </div>
      <div id="gdi-q-subjects" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;max-width:760px;"></div>
      <div id="gdi-q-list" style="display:flex;flex-direction:column;gap:8px;max-width:760px;"></div>
    `;
    // ── Subject filter pills (Task 4) ──
    function drawSubjects(){
      const el=box.querySelector('#gdi-q-subjects');
      if(!el)return;
      const all=questions();
      if(!all.length){el.innerHTML='';return;}
      const map={};
      all.forEach(q=>{const s=q.subject||'—';map[s]=(map[s]||0)+1;});
      const entries=Object.entries(map).sort((a,b)=>b[1]-a[1]);
      let html=`<button class="gdi-mode-btn" data-s="" style="font-size:11px;padding:4px 10px;${_qFilterSubject===null?'background:var(--ferreto-grad);color:#fff;border:0;':''}">Todas (${all.length})</button>`;
      entries.forEach(([s,n])=>{
        const active=_qFilterSubject===s;
        html+=`<button class="gdi-mode-btn" data-s="${esc(s)}" style="font-size:11px;padding:4px 10px;${active?'background:var(--ferreto-grad);color:#fff;border:0;':''}">${esc(s)} (${n})</button>`;
      });
      el.innerHTML=html;
      el.querySelectorAll('button').forEach(b=>b.onclick=()=>{
        _qFilterSubject=b.dataset.s||null;
        if(!_qFilterSubject)_qFilterSubject=null;
        drawSubjects();
        drawList();
      });
    }
    function drawList(){
      const list=box.querySelector('#gdi-q-list');
      const all=questions();
      if(!all.length){list.innerHTML='<div class="gdi-notes-empty">Nenhuma questão. Clique em "Gerar com Meggy" ou "Adicionar".</div>';return;}
      const filtered=_qFilterSubject?all.filter(q=>(q.subject||'—')===_qFilterSubject):all;
      if(!filtered.length){list.innerHTML='<div class="gdi-notes-empty">Nenhuma questão nesta matéria.</div>';return;}
      list.innerHTML='';
      filtered.slice().reverse().forEach(q=>{
        const s=qSrs()[q.id];
        const dueNow=!s||s.due<=Date.now();
        const row=document.createElement('div');row.className='gdi-note';
        row.innerHTML=`<span style="flex:1;min-width:0;">
          <b style="color:var(--ferreto-text,#f0f6fc);">${esc(q.subject||'—')}</b> <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">· ${q.source||'manual'} · box ${s?s.box:0}</span>
          <div style="color:var(--ferreto-text,#e6edf3);font-size:13px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.statement.slice(0,90))}</div>
        </span>
        <span style="font-size:10px;color:${dueNow?'var(--ferreto-primary,#ff8b9f)':'var(--ferreto-text-muted,#8b949e)'};white-space:nowrap;">${dueNow?'hoje':fmtDate(new Date(s?s.due:Date.now()).toISOString().slice(0,10))}</span>
        <button class="gdi-note-del" title="Excluir"><i class="bi bi-x-lg"></i></button>`;
        row.querySelector('button').onclick=()=>{delQ(q.id);drawSubjects();drawList();};
        list.appendChild(row);
      });
    }
    drawSubjects();
    drawList();

    box.querySelector('#gdi-q-resolve-due').onclick=()=>startSession(box,dueQ(),'Revisões de hoje');
    box.querySelector('#gdi-q-resolve-err').onclick=()=>startSession(box,errQ(),'Caderno de erros');
    box.querySelector('#gdi-q-gen').onclick=()=>openGen(box,drawList);
    box.querySelector('#gdi-q-add').onclick=()=>openAddForm(box,drawList);
    box.querySelector('#gdi-q-import').onclick=()=>openImport(box,drawList);
    // Task 8: Gerar flashcards das questões erradas
    const flashBtn=box.querySelector('#gdi-q-flasherr');
    if(flashBtn)flashBtn.onclick=()=>{
      const errIds=lsGet(LS_ERR,[]);
      const errQs=questions().filter(q=>errIds.includes(q.id));
      if(!errQs.length){showToast('Nenhuma questão errada ainda');return;}
      // usa o mesmo LS_CARDS do M22 ('gdi-cards-v1')
      const LS_FC='gdi-cards-v1';
      const cards=lsGet(LS_FC,[]);
      let n=0,dup=0;
      errQs.forEach(q=>{
        // evita duplicar: verifica se já existe flashcard com o mesmo enunciado
        const front='Q: '+q.statement.slice(0,200);
        const exists=cards.some(c=>c.f===front);
        if(exists){dup++;return;}
        const back='R: '+(q.options[q.correct]||'')+(q.explanation?('\n\n'+q.explanation):'');
        cards.push({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),f:front,b:back,path:q.subject||'',at:Date.now(),box:0,due:Date.now()+86400000});
        n++;
      });
      lsSet(LS_FC,cards);
      if(n)showToast(n+' flashcards criados'+(dup?' ('+dup+' já existiam)':''));
      else showToast('Todos os flashcards já existiam ('+dup+')');
    };
  };

  // ── Sessão de resolução ──
  function startSession(box,queue,titulo){
    if(!queue.length){showToast('Nada para resolver aqui');return;}
    let idx=0,hits=0,misses=0,answers=[];
    const t0=Date.now();
    function draw(){
      if(idx>=queue.length){
        const dur=Math.round((Date.now()-t0)/1000);
        saveSim([...simus(),{id:uid(),date:Date.now(),title:titulo,duration:dur,hits,misses,total:queue.length,answers}]);
        box.innerHTML=`<div style="text-align:center;padding:30px;">
          <div style="font-size:40px;">${hits>=misses?'🎉':'📚'}</div>
          <h3 style="color:var(--ferreto-text,#f0f6fc);">${titulo} concluído!</h3>
          <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;">${hits}/${queue.length} corretas · ${misses} erradas · ${Math.floor(dur/60)}min${dur%60?' '+(dur%60)+'s':''}</p>
          <p style="color:var(--ferreto-text,#e6edf3);font-size:14px;margin-top:8px;">Acerto: <b style="color:var(--ferreto-primary,#ff8b9f);">${Math.round(hits/queue.length*100)}%</b></p>
          <button class="gdi-btn gdi-btn-primary" id="gdi-q-back" style="margin-top:14px;"><i class="bi bi-arrow-left"></i> Voltar</button>
        </div>`;
        box.querySelector('#gdi-q-back').onclick=()=>window.renderQuestoes(box);
        return;
      }
      const q=queue[idx];
      box.innerHTML=`<div style="max-width:760px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">${titulo} · ${idx+1}/${queue.length}</span>
          <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">✓ ${hits} ✗ ${misses}</span>
        </div>
        <div class="gdi-course" style="margin-bottom:14px;">
          <b style="color:var(--ferreto-secondary,#7aa2ff);font-size:11px;display:block;margin-bottom:8px;">${esc(q.subject||'')}</b>
          <div style="color:var(--ferreto-text,#f0f6fc);font-size:14px;line-height:1.6;">${esc(q.statement)}</div>
        </div>
        <div id="gdi-q-opts" style="display:flex;flex-direction:column;gap:8px;"></div>
        <div id="gdi-q-feedback" style="margin-top:14px;"></div>
      </div>`;
      const optsEl=box.querySelector('#gdi-q-opts');
      (q.options||[]).forEach((opt,i)=>{
        const b=document.createElement('button');
        b.className='gdi-note';b.style.cursor='pointer';b.style.textAlign='left';
        b.innerHTML=`<span style="display:flex;align-items:center;gap:10px;"><b style="color:var(--ferreto-primary,#ff8b9f);">${String.fromCharCode(65+i)})</b> <span style="color:var(--ferreto-text,#e6edf3);">${esc(opt)}</span></span>`;
        b.onclick=()=>{
          const acertou=i===q.correct;
          if(acertou)hits++;else misses++;
          gradeQ(q.id,acertou);
          answers.push({id:q.id,picked:i,correct:q.correct,acertou});
          // Task 8: errou → cria flashcard automaticamente
          if(!acertou){
            try{
              const LS_FC='gdi-cards-v1';
              const cards=lsGet(LS_FC,[]);
              const front='Q: '+String(q.statement||'').slice(0,200);
              // evita duplicar flashcard para a mesma questão
              if(!cards.some(c=>c.f===front)){
                const back='R: '+(q.options[q.correct]||'')+(q.explanation?('\n\n'+q.explanation):'');
                cards.push({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),f:front,b:back,path:q.subject||'',at:Date.now(),box:0,due:Date.now()+86400000});
                lsSet(LS_FC,cards);
              }
            }catch(_){/* não bloqueia o fluxo */}
          }
          // marca visual
          optsEl.querySelectorAll('button').forEach((bb,bi)=>{
            bb.disabled=true;bb.style.cursor='default';bb.style.opacity='.7';
            if(bi===q.correct)bb.style.background='rgba(63,185,80,.18)';
            if(bi===i&&!acertou)bb.style.background='rgba(255,107,107,.18)';
          });
          const fb=box.querySelector('#gdi-q-feedback');
          fb.innerHTML=`<div class="gdi-course" style="border-left:3px solid ${acertou?'#3fb950':'#ff6b6b'};">
            <b style="color:${acertou?'#3fb950':'#ff6b6b'};">${acertou?'✓ Correto':'✗ Errado'}</b>
            ${!acertou?'<span style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);margin-left:8px;">📦 flashcard criado</span>':''}
            ${q.explanation?`<div style="color:var(--ferreto-text,#e6edf3);font-size:13px;margin-top:6px;line-height:1.5;">${esc(q.explanation)}</div>`:''}
          </div>
          <button class="gdi-btn gdi-btn-primary" id="gdi-q-next" style="margin-top:12px;">${idx+1<queue.length?'Próxima →':'Ver resultado'}</button>`;
          fb.querySelector('#gdi-q-next').onclick=()=>{idx++;draw();};
        };
        optsEl.appendChild(b);
      });
    }
    draw();
  }

  // ── Modal: gerar com ISA ──
  function openGen(parent,after){
    const aula=currentLesson();
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:10002;background:rgba(5,7,10,.8);display:flex;align-items:center;justify-content:center;padding:16px;';
    ov.innerHTML=`<div class="gdi-central-box" style="max-width:520px;padding:24px;">
      <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 12px;"><i class="bi bi-stars" style="color:var(--ferreto-primary,#ff8b9f);"></i> Gerar questões com a Meggy 🐩</h3>
      <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin:0 0 14px;">A Meggy cria questões de concurso sobre o tema e salva no banco.</p>
      <label style="display:block;font-size:12px;color:var(--ferreto-text-muted,#8b949e);margin-bottom:4px;">Tema:</label>
      <input id="gdi-gen-tema" value="${esc(aula)}" placeholder="Ex: Competência da Justiça do Trabalho" style="width:100%;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px;font-size:13px;margin-bottom:12px;box-sizing:border-box;">
      <label style="display:block;font-size:12px;color:var(--ferreto-text-muted,#8b949e);margin-bottom:4px;">Quantidade:</label>
      <input id="gdi-gen-n" type="number" min="1" max="10" value="5" style="width:80px;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px;font-size:13px;margin-bottom:16px;">
      <div id="gdi-gen-status" style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin-bottom:12px;"></div>
      <div style="display:flex;gap:8px;">
        <button class="gdi-btn gdi-btn-primary" id="gdi-gen-go"><i class="bi bi-magic"></i> Gerar</button>
        <button class="gdi-mode-btn" id="gdi-gen-x">Cancelar</button>
      </div></div>`;
    GDI_ROOT().appendChild(ov);
    ov.querySelector('#gdi-gen-x').onclick=()=>ov.remove();
    ov.querySelector('#gdi-gen-go').onclick=async()=>{
      const tema=ov.querySelector('#gdi-gen-tema').value.trim();
      const n=parseInt(ov.querySelector('#gdi-gen-n').value,10)||5;
      if(!tema){showToast('Digite um tema');return;}
      const st=ov.querySelector('#gdi-gen-status');
      ov.querySelector('#gdi-gen-go').disabled=true;
      st.innerHTML='<i class="bi bi-hourglass-split"></i> Meggy gerando '+n+' questões sobre "'+esc(tema)+'"…';
      try{
        const arr=await gerarViaISA(tema,n);
        arr.forEach(q=>addQ(q));
        st.innerHTML='<b style="color:#3fb950;">✓ '+arr.length+' questões criadas!</b>';
        showToast(arr.length+' questões adicionadas');
        setTimeout(()=>{ov.remove();after();},1200);
      }catch(e){
        st.innerHTML='<b style="color:#ff6b6b;">Erro: '+esc(e.message)+'</b><br><span style="font-size:11px;">Verifique se a Meggy está ativa (configure ZHIPU_API_KEY no Cloudflare).</span>';
        ov.querySelector('#gdi-gen-go').disabled=false;
      }
    };
  }

  // ── Modal: adicionar manual ──
  function openAddForm(parent,after){
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:10002;background:rgba(5,7,10,.8);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    const inp='background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px;font-size:13px;width:100%;box-sizing:border-box;';
    ov.innerHTML=`<div class="gdi-central-box" style="max-width:600px;padding:24px;max-height:90vh;overflow-y:auto;">
      <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 14px;">Adicionar questão</h3>
      <input id="f-subj" placeholder="Matéria/tema" style="${inp}margin-bottom:8px;">
      <textarea id="f-stmt" placeholder="Enunciado" style="${inp}min-height:80px;margin-bottom:8px;"></textarea>
      <div id="f-opts" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;"></div>
      <label style="font-size:12px;color:var(--ferreto-text-muted,#8b949e);">Alternativa correta:</label>
      <select id="f-correct" style="${inp}width:auto;margin:4px 0 12px;"></select>
      <textarea id="f-exp" placeholder="Explicação (opcional)" style="${inp}min-height:60px;margin-bottom:14px;"></textarea>
      <div style="display:flex;gap:8px;">
        <button class="gdi-btn gdi-btn-primary" id="f-save">Salvar</button>
        <button class="gdi-mode-btn" id="f-x">Cancelar</button>
      </div></div>`;
    GDI_ROOT().appendChild(ov);
    const optsEl=ov.querySelector('#f-opts');
    const sel=ov.querySelector('#f-correct');
    for(let i=0;i<4;i++){
      const r=document.createElement('input');r.placeholder=String.fromCharCode(65+i)+') alternativa';r.style.cssText=inp;
      optsEl.appendChild(r);
      const o=document.createElement('option');o.value=i;o.textContent=String.fromCharCode(65+i)+')';sel.appendChild(o);
    }
    ov.querySelector('#f-x').onclick=()=>ov.remove();
    ov.querySelector('#f-save').onclick=()=>{
      const opts=[...optsEl.querySelectorAll('input')].map(i=>i.value.trim()).filter(Boolean);
      if(opts.length<2){showToast('Preencha ao menos 2 alternativas');return;}
      const stmt=ov.querySelector('#f-stmt').value.trim();
      if(!stmt){showToast('Digite o enunciado');return;}
      addQ({subject:ov.querySelector('#f-subj').value.trim()||'Geral',statement:stmt,options:opts,correct:parseInt(sel.value,10),explanation:ov.querySelector('#f-exp').value.trim(),source:'manual'});
      showToast('Questão adicionada');ov.remove();after();
    };
  }

  // ── Modal: importar JSON ──
  function openImport(parent,after){
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:10002;background:rgba(5,7,10,.8);display:flex;align-items:center;justify-content:center;padding:16px;';
    const inp='background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px;font-size:13px;width:100%;box-sizing:border-box;';
    ov.innerHTML=`<div class="gdi-central-box" style="max-width:620px;padding:24px;">
      <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 8px;">Importar questões (JSON)</h3>
      <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin:0 0 14px;">Cole um array: [{"statement":"...","options":["a","b","c","d"],"correct":0,"explanation":"...","subject":"..."}]</p>
      <textarea id="imp-txt" placeholder='[...]' style="${inp}min-height:160px;margin-bottom:14px;font-family:monospace;font-size:12px;"></textarea>
      <div style="display:flex;gap:8px;">
        <button class="gdi-btn gdi-btn-primary" id="imp-go">Importar</button>
        <button class="gdi-mode-btn" id="imp-x">Cancelar</button>
      </div></div>`;
    GDI_ROOT().appendChild(ov);
    ov.querySelector('#imp-x').onclick=()=>ov.remove();
    ov.querySelector('#imp-go').onclick=()=>{
      try{
        const arr=JSON.parse(ov.querySelector('#imp-txt').value);
        if(!Array.isArray(arr))throw new Error('Não é array');
        let n=0;
        arr.forEach(q=>{if(q.statement&&Array.isArray(q.options)){addQ({subject:q.subject||'Importado',statement:q.statement,options:q.options,correct:q.correct||0,explanation:q.explanation||'',source:'import'});n++;}});
        showToast(n+' questões importadas');ov.remove();after();
      }catch(e){showToast('JSON inválido: '+e.message);}
    };
  }

  // ── Render: Simulado ──
  window.renderSimulado=function(box){
    const qs=questions();
    const sims=simus().slice().reverse();
    box.innerHTML=`
      <div style="margin-bottom:18px;">
        <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;">Montar simulado</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <label style="font-size:12px;color:var(--ferreto-text-muted,#8b949e);">Questões:</label>
          <input id="sim-n" type="number" min="5" max="50" value="10" style="width:64px;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:6px;color:var(--ferreto-text,#e6edf3);padding:5px;text-align:center;font-size:12px;">
          <label style="font-size:12px;color:var(--ferreto-text-muted,#8b949e);">Tempo (min):</label>
          <input id="sim-time" type="number" min="5" max="180" value="30" style="width:64px;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:6px;color:var(--ferreto-text,#e6edf3);padding:5px;text-align:center;font-size:12px;">
          <button id="sim-go" class="gdi-btn gdi-btn-primary" style="font-size:12px;" ${qs.length>=5?'':'disabled'}><i class="bi bi-play-fill"></i> Iniciar simulado</button>
        </div>
        ${qs.length<5?'<p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin-top:8px;">Adicione ao menos 5 questões (gerar com a Meggy ou importar).</p>':''}
      </div>
      <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 8px;">Histórico</h4>
      <div id="sim-hist" style="display:flex;flex-direction:column;gap:6px;max-width:760px;"></div>
    `;
    if(qs.length>=5){
      box.querySelector('#sim-go').onclick=()=>{
        const n=Math.min(parseInt(box.querySelector('#sim-n').value,10)||10,qs.length);
        const mins=parseInt(box.querySelector('#sim-time').value,10)||30;
        // embaralha e pega N
        const shuffled=[...qs].sort(()=>Math.random()-0.5).slice(0,n);
        startSimulado(box,shuffled,mins);
      };
    }
    const hist=box.querySelector('#sim-hist');
    if(!sims.length){hist.innerHTML='<div class="gdi-notes-empty">Nenhum simulado ainda.</div>';return;}
    sims.slice(0,20).forEach(s=>{
      const pct=Math.round(s.hits/s.total*100);
      const row=document.createElement('div');row.className='gdi-note';
      row.innerHTML=`<span style="flex:1;"><b style="color:var(--ferreto-text,#f0f6fc);">${esc(s.title)}</b> <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">· ${new Date(s.date).toLocaleDateString('pt-BR')} · ${Math.floor(s.duration/60)}min</span></span>
        <span style="color:${pct>=60?'#3fb950':'#ff8b8b'};font-weight:600;font-size:13px;">${pct}%</span>
        <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${s.hits}/${s.total}</span>`;
      hist.appendChild(row);
    });
  };

  function startSimulado(box,queue,mins){
    let idx=0,answers=[],t0=Date.now();
    const deadline=Date.now()+mins*60000;
    function draw(){
      const left=Math.max(0,deadline-Date.now());
      if(left<=0){finish();return;}
      if(idx>=queue.length){finish();return;}
      const q=queue[idx];
      const mm=Math.floor(left/60000),ss=Math.floor((left%60000)/1000);
      box.innerHTML=`<div style="max-width:760px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">Simulado · ${idx+1}/${queue.length}</span>
          <span style="color:${left<60000?'#ff6b6b':'var(--ferreto-primary,#ff8b9f)'};font-weight:600;font-size:14px;font-variant-numeric:tabular-nums;">⏱ ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</span>
        </div>
        <div class="gdi-course" style="margin-bottom:14px;">
          <b style="color:var(--ferreto-secondary,#7aa2ff);font-size:11px;display:block;margin-bottom:8px;">${esc(q.subject||'')}</b>
          <div style="color:var(--ferreto-text,#f0f6fc);font-size:14px;line-height:1.6;">${esc(q.statement)}</div>
        </div>
        <div id="sim-opts" style="display:flex;flex-direction:column;gap:8px;"></div>
        <div style="margin-top:14px;display:flex;gap:8px;">
          <button class="gdi-mode-btn" id="sim-skip">Pular</button>
          ${idx>0?'<button class="gdi-mode-btn" id="sim-prev">← Anterior</button>':''}
        </div>
      </div>`;
      const optsEl=box.querySelector('#sim-opts');
      const picked=answers[idx]?answers[idx].picked:-1;
      (q.options||[]).forEach((opt,i)=>{
        const b=document.createElement('button');
        b.className='gdi-note';b.style.cursor='pointer';b.style.textAlign='left';
        if(i===picked)b.style.background='var(--ferreto-surface-3,rgba(255,255,255,.12))';
        b.innerHTML=`<span style="display:flex;align-items:center;gap:10px;"><b style="color:var(--ferreto-primary,#ff8b9f);">${String.fromCharCode(65+i)})</b> <span style="color:var(--ferreto-text,#e6edf3);">${esc(opt)}</span></span>`;
        b.onclick=()=>{
          answers[idx]={picked:i,correct:q.correct,id:q.id,acertou:i===q.correct};
          optsEl.querySelectorAll('button').forEach((bb,bi)=>{bb.style.background=bi===i?'var(--ferreto-surface-3,rgba(255,255,255,.12))':'';});
        };
        optsEl.appendChild(b);
      });
      box.querySelector('#sim-skip').onclick=()=>{idx++;draw();};
      const prev=box.querySelector('#sim-prev');if(prev)prev.onclick=()=>{idx--;draw();};
    }
    function finish(){
      const dur=Math.round((Date.now()-t0)/1000);
      let hits=0;
      answers.forEach(a=>{if(a){gradeQ(a.id,a.acertou);if(a.acertou)hits++;}});
      const total=queue.length;
      saveSim([...simus(),{id:uid(),date:Date.now(),title:'Simulado '+queue.length+'q',duration:dur,hits,misses:total-hits,total,answers:answers.map(a=>a?a.id:null)}]);
      const pct=Math.round(hits/total*100);
      box.innerHTML=`<div style="text-align:center;padding:30px;">
        <div style="font-size:40px;">${pct>=60?'🎉':'📚'}</div>
        <h3 style="color:var(--ferreto-text,#f0f6fc);">Simulado concluído!</h3>
        <p style="color:var(--ferreto-text,#e6edf3);font-size:16px;margin-top:8px;"><b style="color:${pct>=60?'#3fb950':'#ff8b8b'};">${hits}/${total}</b> · ${pct}% acerto</p>
        <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;">${Math.floor(dur/60)}min${dur%60?' '+(dur%60)+'s':''}</p>
        <button class="gdi-btn gdi-btn-primary" id="sim-back" style="margin-top:14px;"><i class="bi bi-arrow-left"></i> Voltar</button>
      </div>`;
      box.querySelector('#sim-back').onclick=()=>window.renderSimulado(box);
    }
    draw();
    const timer=setInterval(()=>{if(Date.now()>=deadline){clearInterval(timer);finish();}},1000);
    // armazena timer p/ limpeza se trocar de aba
    box.__simTimer=timer;
  }

  // ── Render: Cronograma ──
  window.renderCronograma=function(box){
    const cron=lsGet(LS_CRON,null);
    const todayStr=()=>{const d=new Date();return d.toISOString().slice(0,10);};
    const addDays=(ds,n)=>{const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
    if(!cron){
      box.innerHTML=`<div style="max-width:560px;">
        <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 8px;">📅 Cronograma de estudos</h3>
        <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin:0 0 18px;">Defina a data da prova. O sistema monta um plano distribuindo as aulas + revisões SRS até lá.</p>
        <label style="display:block;font-size:12px;color:var(--ferreto-text-muted,#8b949e);margin-bottom:4px;">Data da prova:</label>
        <input id="cr-prova" type="date" value="${addDays(todayStr(),90)}" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px;font-size:13px;margin-bottom:16px;">
        <label style="display:block;font-size:12px;color:var(--ferreto-text-muted,#8b949e);margin-bottom:4px;">Aulas/dia (meta):</label>
        <input id="cr-perday" type="number" min="1" max="10" value="2" style="width:70px;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px;font-size:13px;margin-bottom:16px;">
        <button class="gdi-btn gdi-btn-primary" id="cr-gen"><i class="bi bi-magic"></i> Gerar cronograma</button>
      </div>`;
      box.querySelector('#cr-gen').onclick=()=>{
        const prova=box.querySelector('#cr-prova').value;
        const perDay=parseInt(box.querySelector('#cr-perday').value,10)||2;
        // pega aulas do histórico (GDIUser.history) ou da playlist atual
        let aulas=[];
        try{const d=GDIUser.dump();if(d&&d.history)aulas=d.history.map(h=>({path:h.path,name:h.name}));}catch(_){}
        // se não houver, usa a playlist atual
        if(!aulas.length&&window.playlistVideos){aulas=window.playlistVideos.map(v=>({path:v.pageUrl,name:v.name}));}
        if(!aulas.length){showToast('Estude algumas aulas primeiro para o cronograma');return;}
        const days=Math.max(1,Math.round((new Date(prova+'T12:00:00')-new Date(todayStr()+'T12:00:00'))/86400000));
        const plan=[];
        let ai=0;
        for(let d=0;d<days&&ai<aulas.length;d++){
          for(let k=0;k<perDay&&ai<aulas.length;k++,ai++){
            plan.push({date:addDays(todayStr(),d),aula:aulas[ai].name,path:aulas[ai].path,type:'estudo'});
            // agenda revisões 1,7,30 dias depois
            [1,7,30].forEach(r=>{const rd=addDays(addDays(todayStr(),d),r);if(rd<=prova)plan.push({date:rd,aula:aulas[ai].name,path:aulas[ai].path,type:'revisão'});});
          }
        }
        lsSet(LS_CRON,{prova,perDay,gerado:Date.now(),plan});
        showToast('Cronograma gerado: '+plan.length+' tarefas em '+days+' dias');
        window.renderCronograma(box);
      };
      return;
    }
    // cronograma existe — mostra
    const todayQ=todayStr();
    const hoje=cron.plan.filter(t=>t.date===todayQ);
    const futuras=cron.plan.filter(t=>t.date>todayQ).slice(0,30);
    const diasRest=Math.max(0,Math.ceil((new Date(cron.prova+'T12:00:00')-new Date(todayQ+'T12:00:00'))/86400000));
    box.innerHTML=`<div style="max-width:760px;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
        <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0;">📅 Prova em ${fmtDate(cron.prova)}</h3>
        <span style="color:var(--ferreto-primary,#ff8b9f);font-weight:600;">${diasRest} dias restantes</span>
        <button class="gdi-mode-btn" id="cr-reset" style="font-size:11px;margin-left:auto;"><i class="bi bi-arrow-clockwise"></i> Refazer</button>
      </div>
      ${hoje.length?`<div style="margin-bottom:18px;">
        <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Hoje (${hoje.length} tarefas)</h4>
        ${hoje.map(t=>`<div class="gdi-note"><span style="flex:1;"><b style="color:${t.type==='revisão'?'var(--ferreto-secondary,#5ddeda)':'var(--ferreto-primary,#ff8b9f)'};">${t.type==='revisão'?'🔄':'▶'}</b> ${esc(t.aula)}</span><span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${t.type}</span></div>`).join('')}
      </div>`:'<p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin-bottom:18px;">Nada para hoje. 🎉</p>'}
      <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Próximos dias</h4>
      <div style="display:flex;flex-direction:column;gap:4px;">${futuras.map(t=>`<div class="gdi-note" style="padding:6px 10px;"><span style="flex:1;color:var(--ferreto-text,#e6edf3);font-size:12px;">${esc(t.aula)}</span><span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${fmtDate(t.date)} · ${t.type}</span></div>`).join('')||'<div class="gdi-notes-empty">Sem tarefas futuras.</div>'}</div>
    </div>`;
    box.querySelector('#cr-reset').onclick=()=>{lsSet(LS_CRON,null);window.renderCronograma(box);};
  };

  // ── Render: Revisões (calendário) ──
  window.renderRevisoes=function(box){
    const srs=qSrs();
    const qs=questions();
    const srsFC=lsGet('gdi-cards-v1',[]); // flashcards (mesma chave da Central)
    // agenda: questões + flashcards + aulas (GDIUser.resume)
    let items=[];
    qs.forEach(q=>{const s=srs[q.id];if(s){items.push({date:new Date(s.due).toISOString().slice(0,10),tipo:'questão',nome:q.subject,label:q.statement.slice(0,50)});}});
    srsFC.forEach(c=>{if(c.due){items.push({date:new Date(c.due).toISOString().slice(0,10),tipo:'flashcard',nome:'Flashcard',label:(c.f||'').slice(0,50)});}});
    try{const d=GDIUser.dump();if(d&&d.resume){for(const k in d.resume){const r=d.resume[k];if(r.due){items.push({date:new Date(r.due).toISOString().slice(0,10),tipo:'aula',nome:'Retomar aula',label:k});}}}}catch(_){}
    // agrupa por data
    const byDate={};
    items.forEach(it=>{if(!byDate[it.date])byDate[it.date]=[];byDate[it.date].push(it);});
    // calendário mensal
    const now=new Date();
    const y=now.getFullYear(),m=now.getMonth();
    const first=new Date(y,m,1);
    const startDay=(first.getDay()+6)%7; // segunda=0
    const daysInMonth=new Date(y,m+1,0).getDate();
    const todayStr=now.toISOString().slice(0,10);
    let cal='';
    const weekDays=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    cal+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:560px;">';
    weekDays.forEach(d=>cal+=`<div style="text-align:center;font-size:10px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;padding:4px;">${d}</div>`);
    for(let i=0;i<startDay;i++)cal+='<div></div>';
    for(let d=1;d<=daysInMonth;d++){
      const ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const its=byDate[ds]||[];
      const isToday=ds===todayStr;
      const isPast=ds<todayStr;
      cal+=`<div style="min-height:54px;border:1px solid ${isToday?'var(--ferreto-primary,#ff8b9f)':'var(--ferreto-border,#21262d)'};border-radius:6px;padding:3px;background:${isToday?'rgba(255,139,159,.08)':'var(--ferreto-surface-2,rgba(255,255,255,.03))'};">
        <div style="font-size:11px;color:${isToday?'var(--ferreto-primary,#ff8b9f)':isPast?'var(--ferreto-text-faint,#6b7488)':'var(--ferreto-text,#e6edf3)'};font-weight:${isToday?'700':'400'};">${d}</div>
        ${its.slice(0,3).map(it=>`<div style="font-size:9px;color:${it.tipo==='aula'?'var(--ferreto-secondary,#5ddeda)':it.tipo==='flashcard'?'#ffd43b':'var(--ferreto-primary,#ff8b9f)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(it.label)}">● ${esc(it.tipo)}</div>`).join('')}
        ${its.length>3?`<div style="font-size:9px;color:var(--ferreto-text-muted,#8b949e);">+${its.length-3}</div>`:''}
      </div>`;
    }
    cal+='</div>';
    const todayItems=byDate[todayStr]||[];
    box.innerHTML=`<div style="max-width:760px;">
      <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 4px;">⏰ Revisões de hoje</h3>
      <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin:0 0 14px;">${todayItems.length} revisão(ões) vencida(s) hoje.</p>
      ${todayItems.length?`<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px;max-width:560px;">${todayItems.map(it=>`<div class="gdi-note"><span style="flex:1;color:var(--ferreto-text,#e6edf3);font-size:13px;"><b style="color:${it.tipo==='aula'?'var(--ferreto-secondary,#5ddeda)':it.tipo==='flashcard'?'#ffd43b':'var(--ferreto-primary,#ff8b9f)'};">${it.tipo}</b> · ${esc(it.label)}</span></div>`).join('')}</div>`:''}
      <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 8px;">${now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h4>
      ${cal}
      <p style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-top:12px;">● <span style="color:var(--ferreto-primary,#ff8b9f);">questão</span> · <span style="color:#ffd43b;">flashcard</span> · <span style="color:var(--ferreto-secondary,#5ddeda);">aula</span></p>
    </div>`;
  };

  // CSS extra do M23 (estilos de inputs/overlays já herdam do M22)
  if(!document.getElementById('gdi-m23-style')){
    const s=document.createElement('style');s.id='gdi-m23-style';s.textContent=`
    .gdi-central-box textarea{font-family:inherit;resize:vertical;}
    .gdi-central-box textarea:focus,.gdi-central-box input:focus{outline:none;border-color:var(--ferreto-primary,#ff8b9f)!important;box-shadow:0 0 0 3px var(--ferreto-glow,rgba(255,139,159,.25))!important;}
    .gdi-central-box select{font-family:inherit;}
    `;
    document.head.appendChild(s);
  }

  // ★ Expõe startSession no window para que o M9-ISA (botão "Resolver
  // agora →" após gerar questões) possa chamar a sessão interativa
  // diretamente sobre o bodyEl da aula, sem precisar abrir a Central.
  window.__gdiStartSession=startSession;
  // ★ Expõe gradeQ para o quiz do M9-ISA (interativo na aba de questões)
  window.__gdiGradeQ=gradeQ;
  // ★ Expõe gradeQ para outros módulos (ex.: flashcards das erradas)
  window.__gdiQStats=function(){
    // retorna {perSubject:[{subject,total,hits,misses,acc}], worst:[...], overall:{...}}
    const all=questions();
    const srs=qSrs();
    const bySbj={};
    all.forEach(q=>{
      const s=(q.subject||'—');
      if(!bySbj[s])bySbj[s]={subject:s,total:0,hits:0,misses:0};
      bySbj[s].total++;
      // se a questão tem SRS, contamos como "respondida"
      const e=srs[q.id];
      if(e&&e.last){
        if(e.box>0)bySbj[s].hits++; // simplificação: box>0 = acertou última
        else bySbj[s].misses++;
      }
    });
    const perSubject=Object.values(bySbj).map(x=>{
      const answered=x.hits+x.misses;
      x.answered=answered;
      x.acc=answered?Math.round(x.hits/answered*100):null;
      return x;
    });
    perSubject.sort((a,b)=>(a.acc==null?101:a.acc)-(b.acc==null?101:b.acc));
    const overall={
      total:all.length,
      answered:perSubject.reduce((s,x)=>s+x.answered,0),
      hits:perSubject.reduce((s,x)=>s+x.hits,0),
      misses:perSubject.reduce((s,x)=>s+x.misses,0)
    };
    overall.acc=overall.answered?Math.round(overall.hits/overall.answered*100):null;
    return {perSubject,overall,worst:perSubject.filter(x=>x.acc!=null&&x.acc<60)};
  };

  console.log('[GDI Extras] M23 Estudo Ativo (questões/simulado/cronograma/revisões) ativo');
})();

// ═══ M22 v2: CENTRAL DE ESTUDOS — painel + botão FORA do body ═══
(function(){
  const LS_CARDS='gdi-cards-v1',LS_GOAL='gdi-goal-min',LS_WATCH='gdi-watch-v1',LS_MAR='gdi-marathon',LS_MARINTRO='gdi-marathon-intro',LS_HIDDEN='gdi-hidden-courses-v1';
  const log=(...a)=>{try{console.log('[GDI M22]',...a)}catch(_){}};
  const dec=s=>{try{return decodeURIComponent(String(s||''))}catch(_){return String(s||'')}};
  const norm=p=>dec(String(p||'').split('?')[0].replace(/\/+$/,''));
  const low=p=>norm(p).toLowerCase();
  const stripExt=s=>String(s||'').replace(/\.[a-z0-9]{1,5}$/i,'').trim();
  const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}};
  const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const fmtMin=m=>{m=Math.round(m);return m>=60?Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'):m+'min'};
  const dayKey=t=>{const d=new Date(t||Date.now());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const dateBr=t=>new Date(t).toLocaleDateString('pt-BR');
  let rescue=null,rescueAt=0;
  function ensureState(){
    if(rescue&&Date.now()-rescueAt<60000)return Promise.resolve(rescue);
    return fetch('/userstate',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(j=>{
      if(j&&typeof j==='object'){rescue=j;rescueAt=Date.now();}
      return rescue;
    }).catch(()=>rescue);
  }
  function stateD(){
    try{if(window.GDIUser&&GDIUser.loaded()){const d=GDIUser.dump();if(d)return d;}}catch(_){}
    return rescue;
  }
  function watchedLow(d){
    const s=new Set();const w=(d&&d.watched)||{};
    for(const k in w)s.add(low(k));
    return s;
  }
  function courseKeyOf(p){
    const seg=norm(p).split('/').filter(Boolean);
    if(!seg.length||!/^\d+:$/.test(seg[0]))return null;
    if(seg.length<=2)return seg[0];
    return [seg[0],...seg.slice(1,-1).slice(0,2)].join('/');
  }
  const courseName=ck=>ck.split('/').filter(Boolean).slice(1).join(' / ')||ck;
  function driveNameOf(ck){
    const m=/^\/(\d+):/.exec(ck||'');
    return(window.drive_names&&m&&window.drive_names[+m[1]])||'';
  }
  function collectCourses(){
    const d=stateD()||{};
    // ★ cursos ocultos pelo usuário (não aparecem em "Meus Cursos")
    const hidden=lsGet(LS_HIDDEN,[]);
    const isHidden=ck=>hidden.some(h=>low(h)===low(ck));
    const map=new Map();
    const add=(p,at,wd)=>{
      const ck=courseKeyOf(p);if(!ck)return;
      if(isHidden(ck))return; // ★ pula cursos ocultos
      let c=map.get(ck);
      if(!c){c={key:ck,lastAt:0,lessons:new Set(),watched:0};map.set(ck,c);}
      c.lessons.add(low(p));
      if(wd)c.watched++;
      const a=Number(at)||0;if(a>c.lastAt)c.lastAt=a;
    };
    const w=(d&&d.watched)||{},r=(d&&d.resume)||{};
    for(const k in w)add(k,w[k]&&w[k].at,true);
    for(const k in r)add(k,r[k]&&r[k].at,false);
    (Array.isArray(d.history)?d.history:[]).forEach(h=>{if(h&&h.path)add(h.path,h.at,false)});
    return [...map.values()].filter(c=>c.lessons.size).sort((a,b)=>b.lastAt-a.lastAt);
  }
  // ★ helpers para ocultar/restaurar cursos
  function hideCourse(ck){
    const hidden=lsGet(LS_HIDDEN,[]);
    if(!hidden.some(h=>low(h)===low(ck)))hidden.push(ck);
    lsSet(LS_HIDDEN,hidden);
  }
  function unhideCourse(ck){
    lsSet(LS_HIDDEN,lsGet(LS_HIDDEN,[]).filter(h=>low(h)!==low(ck)));
  }
  function listHiddenCourses(){
    return lsGet(LS_HIDDEN,[]);
  }
  const GW=/^(aula|aulas|v\u00eddeo|videos?|li[cç][aã]o|li[cç][oõ]es|licoes|lesson|class|modulo|m\u00f3dulo|module|parte|pt|cap|capitulo|ext|ep|live|arquivo|file)$/i;
  function isGeneric(n){
    n=stripExt(n).toLowerCase();if(!n)return true;
    return n.replace(/[\s\-_.:,;|()/\\]+/g,' ').split(' ')
      .filter(w2=>w2&&!/^\d+$/.test(w2)&&!GW.test(w2)&&!GW.test(w2.replace(/\d+$/,''))).join('')==='';
  }
  function realName(p){
    const seg=norm(p).split('/').filter(Boolean);
    let nm=stripExt(seg[seg.length-1]||'');
    if(isGeneric(nm))for(let j=seg.length-2;j>=0;j--){
      if(/^\d+:$/.test(seg[j]))break;
      if(!isGeneric(seg[j])){nm=stripExt(seg[j]);break;}
    }
    return nm||'Aula';
  }
  const vCache=new Map();
  function exists(p){
    if(vCache.has(p))return Promise.resolve(vCache.get(p));
    const pr=fetch(String(p).split('?')[0],{method:'POST',credentials:'same-origin'})
      .then(r2=>{vCache.set(p,r2.ok);return r2.ok})
      .catch(()=>{vCache.set(p,true);return true});
    vCache.set(p,pr);return pr;
  }
  const ghost=p=>{const s=norm(p).split('/').filter(Boolean);return s.length>=2&&s[s.length-1].indexOf(s[s.length-2]+' - ')===0;};
  function bestIn(courseKey){
    const d=stateD();
    if(!d)return Promise.resolve(null);
    const pre=low(courseKey);
    const inC=p=>{const l=low(p);return l===pre||l.indexOf(pre+'/')===0;};
    const cands=[],seen=new Set();
    const add=(k,at)=>{
      if(!k)return;const key=low(k);
      if(seen.has(key)||!inC(k))return;seen.add(key);
      cands.push({path:String(k).split('?')[0],at:Number(at)||0});
    };
    const w=(d&&d.watched)||{},r=(d&&d.resume)||{};
    for(const k in w)add(k,w[k]&&w[k].at);
    for(const k in r)add(k,r[k]&&r[k].at);
    if(d.last&&d.last.path)add(d.last.path,d.last.at);
    (Array.isArray(d.history)?d.history:[]).forEach(h=>{if(h&&h.path)add(h.path,h.at)});
    cands.sort((a,b)=>(ghost(a.path)-ghost(b.path))||(b.at-a.at));
    return (async()=>{
      for(const c of cands.slice(0,3)){if(await exists(c.path))return c.path;}
      return null;
    })();
  }
  let playing=false,mark=0;
  document.addEventListener('play',e=>{if(e.target&&e.target.tagName==='VIDEO'){playing=true;mark=Date.now();}},true);
  document.addEventListener('pause',e=>{if(e.target&&e.target.tagName==='VIDEO'){playing=false;flushWatch();}},true);
  document.addEventListener('ended',e=>{if(e.target&&e.target.tagName==='VIDEO'){playing=false;flushWatch();}},true);
  function flushWatch(){
    if(!mark)return;
    const sec=(Date.now()-mark)/1000;
    mark=playing?Date.now():0;
    if(sec>0&&sec<300){const w=lsGet(LS_WATCH,{});const k=dayKey();w[k]=(w[k]||0)+sec;lsSet(LS_WATCH,w);}
  }
  setInterval(flushWatch,30000);
  const todayMin=()=>Math.round((lsGet(LS_WATCH,{})[dayKey()]||0)/60);
  const goalMin=()=>Math.max(10,Math.min(480,parseInt(lsGet(LS_GOAL,60),10)||60));
  setInterval(()=>{
    const card=document.getElementById('gdi-home-card');
    if(!card)return;
    let chip=document.getElementById('gdi-goal-chip');
    if(!chip){
      chip=document.createElement('div');chip.id='gdi-goal-chip';
      chip.style.cssText='flex-basis:100%;margin-top:2px;font-size:12px;color:var(--ferreto-text-muted,#8b949e);display:flex;align-items:center;gap:8px;';
      card.appendChild(chip);
    }
    const t=todayMin(),g=goalMin();
    chip.innerHTML=`<span>\ud83c\udfaf Meta hoje: ${fmtMin(t)} / ${fmtMin(g)}</span>
      <div style="flex:1;max-width:220px;height:5px;background:var(--ferreto-surface-3,rgba(255,255,255,.1));border-radius:3px;overflow:hidden;">
        <div style="height:5px;width:${Math.min(100,Math.round(t/g*100))}%;background:${t>=g?'#2f9e44':'var(--ferreto-grad)'};transition:width .4s;"></div>
      </div>${t>=g?'<span style="color:#2f9e44;">\u2713 meta batida!</span>':''}`;
  },20000);
  const marOn=()=>lsGet(LS_MAR,false)===true;
  const marIntro=()=>lsGet(LS_MARINTRO,true)!==false;
  function marCourseKey(){
    try{
      const m=window.playlistVideos&&window.playlistVideos[window.currentIndex];
      if(m&&m.folder){const f=norm(m.folder);return f.endsWith('/')?f:f+'/';}
    }catch(_){}
    return window.location.pathname.split('/').slice(0,-1).join('/')+'/';
  }
  Bus.onGlobal('media:ready',({type,el})=>{
    if(type!=='video'||!el||el.__m22mar)return;
    el.__m22mar=true;
    el.addEventListener('ended',()=>{
      if(!marOn())return;
      const pv=window.playlistVideos;
      if(!pv||!pv.length)return;
      const wl=watchedLow(stateD());
      const isW=i=>{
        const raw=String(pv[i].pageUrl||'').split('?')[0];
        if(wl.has(low(raw)))return true;
        try{return !!(window.GDIUser&&GDIUser.isWatched&&GDIUser.isWatched(raw));}catch(_){return false;}
      };
      const ci=typeof window.currentIndex==='number'?window.currentIndex:-1;
      for(let i=ci+1;i<pv.length;i++){
        if(!isW(i)){
          showToast('\u25b6 Maratona: '+stripExt(pv[i].name||pv[i].origName||''));
          setTimeout(()=>{try{window.switchVideo(i);}catch(_){}},1800);
          return;
        }
      }
      showToast('Maratona: todas as aulas \u00e0 frente j\u00e1 foram assistidas \u2713');
    });
    const tryIntro=()=>{
      if(!marOn()||!marIntro())return;
      try{
        const S=window.GDIUser&&GDIUser.getIntro&&GDIUser.getIntro(marCourseKey());
        if(S&&S>0&&el.currentTime<S-1&&el.currentTime<300)el.currentTime=S;
      }catch(_){}
    };
    el.addEventListener('loadedmetadata',()=>setTimeout(tryIntro,300));
    el.addEventListener('play',tryIntro);
  });
  const cards=()=>lsGet(LS_CARDS,[]);
  const saveCards=c=>lsSet(LS_CARDS,c);
  const dueCards=()=>cards().filter(c=>(c.due||0)<=Date.now());
  let FC={active:false,flip:null,grade:null};
  let panel=null,tab='cursos';
  function openPanel(t){
    if(t)tab=t;
    if(!panel){
      panel=document.createElement('div');panel.id='gdi-central';
      panel.addEventListener('click',e=>{if(e.target===panel)closePanel();});
      GDI_ROOT().appendChild(panel);
    }
    panel.style.display='flex';
    renderPanel();
    ensureState().then(()=>{if(panel&&panel.style.display!=='none')renderPanel();});
  }
  function closePanel(){FC.active=false;if(panel)panel.style.display='none';}
  // ★ Expõe openPanel para outros módulos (ex.: M9-ISA botão "Resolver
  // agora →" pode abrir a Central na aba Questões como fallback).
  window.__gdiOpenCentral=openPanel;
  function renderPanel(){
    if(!panel)return;
    const t=todayMin(),g=goalMin(),pct=Math.min(100,Math.round(t/g*100));
    panel.innerHTML=`<div class="gdi-central-box">
      <div class="gdi-central-head">
        <b style="color:var(--ferreto-text,#f0f6fc);font-size:16px;font-family:var(--ferreto-font-display,'Poppins',sans-serif);">\ud83d\udcda Central de Estudos</b>
        <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">Meta hoje: ${fmtMin(t)}/${fmtMin(g)}</span>
        <div style="flex:1;max-width:160px;height:6px;background:var(--ferreto-surface-3,rgba(255,255,255,.1));border-radius:3px;overflow:hidden;"><div style="height:6px;width:${pct}%;background:${t>=g?'#2f9e44':'var(--ferreto-grad)'};"></div></div>
        <input id="gdi-goal-set" type="number" min="10" max="480" value="${g}" title="Meta di\u00e1ria (minutos)" style="width:56px;background:var(--ferreto-surface-2,rgba(255,255,255,.07));border:1px solid var(--ferreto-border,#30363d);border-radius:6px;color:var(--ferreto-text,#f0f6fc);text-align:center;padding:3px 5px;font-size:12px;">
        <button class="gdi-mode-btn" id="gdi-central-x" style="padding:4px 10px;">\u2715</button>
      </div>
      <div class="gdi-central-tabs">
        <button class="gdi-central-tab ${tab==='cursos'?'active':''}" data-t="cursos">\ud83d\udccd Meus Cursos</button>
        <button class="gdi-central-tab ${tab==='questoes'?'active':''}" data-t="questoes">\u2753 Quest\u00f5es</button>
        <button class="gdi-central-tab ${tab==='simulado'?'active':''}" data-t="simulado">\ud83c\udfaf Simulado</button>
        <button class="gdi-central-tab ${tab==='cronograma'?'active':''}" data-t="cronograma">\ud83d\udcc5 Cronograma</button>
        <button class="gdi-central-tab ${tab==='revisoes'?'active':''}" data-t="revisoes">\u23f0 Revis\u00f5es</button>
        <button class="gdi-central-tab ${tab==='resumos'?'active':''}" data-t="resumos">\ud83d\udccb Resumos</button>
        <button class="gdi-central-tab ${tab==='provas'?'active':''}" data-t="provas">\ud83d\udcc4 Provas</button>
        <button class="gdi-central-tab ${tab==='redacao'?'active':''}" data-t="redacao">\u270d\ufe0f Reda\u00e7\u00e3o</button>
        <button class="gdi-central-tab ${tab==='radar'?'active':''}" data-t="radar">\ud83c\udfaf Mapa de Fracos</button>
        <button class="gdi-central-tab ${tab==='stats'?'active':''}" data-t="stats">\ud83d\udcca Estat\u00edsticas</button>
        <button class="gdi-central-tab ${tab==='fc'?'active':''}" data-t="fc">\ud83e\uddf0 Flashcards</button>
        <button class="gdi-central-tab ${tab==='mar'?'active':''}" data-t="mar">\ud83d\ude80 Maratona</button>
      </div>
      <div class="gdi-central-body" id="gdi-central-body"></div>
    </div>`;
    panel.querySelector('#gdi-central-x').onclick=closePanel;
    panel.querySelector('#gdi-goal-set').addEventListener('change',e=>{
      const v=Math.max(10,Math.min(480,parseInt(e.target.value,10)||60));
      lsSet(LS_GOAL,v);renderPanel();
    });
    panel.querySelectorAll('.gdi-central-tab').forEach(b=>b.onclick=()=>{tab=b.dataset.t;FC.active=false;renderPanel();});
    const body=panel.querySelector('#gdi-central-body');
    if(tab==='cursos')renderCursos(body);
    else if(tab==='questoes')renderQuestoes(body);
    else if(tab==='simulado')renderSimulado(body);
    else if(tab==='cronograma')renderCronograma(body);
    else if(tab==='revisoes')renderRevisoes(body);
    else if(tab==='resumos'){if(window.renderResumos)renderResumos(body);else body.innerHTML='<div class="gdi-notes-empty">M\u00f3dulo de resumos indispon\u00edvel.</div>';}
    else if(tab==='provas'){if(window.renderProvas)window.renderProvas(body);else body.innerHTML='<div class="gdi-notes-empty">M\u00f3dulo de provas indispon\u00edvel.</div>';}
    else if(tab==='redacao'){if(window.renderRedacao)window.renderRedacao(body);else body.innerHTML='<div class="gdi-notes-empty">M\u00f3dulo de reda\u00e7\u00e3o indispon\u00edvel.</div>';}
    else if(tab==='radar'){if(window.renderRadar)window.renderRadar(body);else body.innerHTML='<div class="gdi-notes-empty">M\u00f3dulo de radar indispon\u00edvel.</div>';}
    else if(tab==='stats')renderStats(body);
    else if(tab==='fc')renderFlash(body);
    else renderMarathon(body);
  }
  // ★ Otimização: limpa nome do curso (remove paths crus, underscores, etc)
  function cleanCourseName(ck){
    let name=courseName(ck);
    // se veio vazio, usa o drive name
    if(!name||name==='—')name=driveNameOf(ck)||'Curso';
    // remove underscores → espaços, multiple slashes, trim
    name=name.replace(/_/g,' ').replace(/\/\s*\//g,' / ').replace(/\s+/g,' ').trim();
    // se muito longo, trunca
    if(name.length>45)name=name.slice(0,42)+'…';
    return name;
  }

  async function renderCursos(box){
    const cs=collectCourses();
    const hidden=listHiddenCourses();
    if(!cs.length){
      box.innerHTML=`<div class="gdi-notes-empty" style="padding:60px;text-align:center;">
        <i class="bi bi-mortarboard" style="font-size:48px;display:block;margin-bottom:14px;color:var(--ferreto-text-faint,#6b7488);"></i>
        Nenhum estudo registrado ainda.<br>
        <span style="font-size:12px;">Assista uma aula para começar!</span>
        ${hidden.length?`<div style="margin-top:24px;padding:14px;background:var(--ferreto-surface-2,#161b22);border:1px solid var(--ferreto-border,#21262d);border-radius:10px;text-align:left;">
          <b style="color:var(--ferreto-text,#f0f6fc);font-size:13px;display:block;margin-bottom:8px;"><i class="bi bi-eye-slash"></i> ${hidden.length} curso${hidden.length>1?'s':''} oculto${hidden.length>1?'s':''}</b>
          <button id="gdi-restore-courses" class="gdi-mode-btn" style="font-size:12px;"><i class="bi bi-arrow-counterclockwise"></i> Restaurar cursos ocultos</button>
        </div>`:''}
      </div>`;
      const restoreBtn=box.querySelector('#gdi-restore-courses');
      if(restoreBtn)restoreBtn.onclick=()=>{
        if(confirm('Restaurar todos os '+hidden.length+' curso(s) oculto(s)?')){
          lsSet(LS_HIDDEN,[]);
          showToast('Cursos restaurados');
          renderCursos(box);
        }
      };
      return;
    }
    box.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <b style="color:var(--ferreto-text,#f0f6fc);font-size:14px;">${cs.length} curso${cs.length>1?'s':''} em andamento</b>
      ${hidden.length?`<button id="gdi-show-hidden" class="gdi-mode-btn" style="font-size:11px;"><i class="bi bi-eye-slash"></i> ${hidden.length} oculto${hidden.length>1?'s':''}</button>`:''}
    </div>
    <div class="gdi-courses"></div>`;
    const grid=box.querySelector('.gdi-courses');

    // ★ botão "mostrar ocultos" (no header da lista)
    const showHiddenBtn=box.querySelector('#gdi-show-hidden');
    if(showHiddenBtn)showHiddenBtn.onclick=()=>{
      showHiddenCoursesModal(box);
    };

    // Mostra até 20 cursos
    cs.slice(0,20).forEach(c=>{
      const name=cleanCourseName(c.key);
      const drive=driveNameOf(c.key);
      const progress=c.lessons.size>0?Math.round(c.watched/c.lessons.size*100):0;
      const progressColor=progress>=80?'#3fb950':progress>=40?'#ffd43b':'var(--ferreto-primary,#ff8b9f)';
      const el=document.createElement('div');el.className='gdi-course';
      el.style.cursor='pointer';
      el.innerHTML=`
        <div class="gdi-course-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <b title="${escHtml(courseName(c.key))}" style="flex:1;min-width:0;">${escHtml(name)}</b>
          <button class="gdi-course-remove" title="Ocultar curso" style="background:transparent;border:0;color:var(--ferreto-text-muted,#8b949e);cursor:pointer;font-size:14px;padding:2px 6px;flex:none;border-radius:6px;transition:all .15s;"><i class="bi bi-x-lg"></i></button>
        </div>
        ${drive?`<small style="color:var(--ferreto-secondary,#5ddeda);font-size:10px;display:block;margin-top:2px;"><i class="bi bi-hdd"></i> ${escHtml(drive)}</small>`:''}
        <small>${c.lessons.size} aula${c.lessons.size>1?'s':''}${c.watched?` · <b style="color:#3fb950;">${c.watched} ✓</b>`:''} · última: ${c.lastAt?dateBr(c.lastAt):'—'}</small>
        ${c.lessons.size>0?`<div style="height:5px;background:var(--ferreto-surface-3,rgba(255,255,255,.08));border-radius:3px;overflow:hidden;margin:8px 0 12px;"><div style="height:5px;width:${progress}%;background:${progressColor};border-radius:3px;transition:width .3s;"></div></div>
        <small style="color:var(--ferreto-text-muted,#8b949e);font-size:10px;display:block;margin-bottom:8px;">${progress}% concluído</small>`:''}
        <button class="gdi-btn gdi-btn-primary gdi-course-continue" style="font-size:12px;width:100%;justify-content:center;" disabled><i class="bi bi-hourglass-split"></i> Verificando…</button>`;
      grid.appendChild(el);

      const contBtn=el.querySelector('.gdi-course-continue');
      bestIn(c.key).then(target=>{
        if(target){
          contBtn.disabled=false;
          contBtn.innerHTML=`<i class="bi bi-play-fill"></i> Continuar: ${escHtml(realName(target).slice(0,30))}`;
          contBtn.onclick=(e)=>{e.stopPropagation();location.href=target+(target.includes('?')?'&':'?')+'a=view';};
        }else{
          contBtn.disabled=true;
          contBtn.className='gdi-mode-btn gdi-course-continue';
          contBtn.style.width='100%';contBtn.style.justifyContent='center';
          contBtn.innerHTML='<i class="bi bi-check2-all" style="color:#3fb950;"></i> Tudo em dia!';
        }
      });

      // ★ botão remover (ocultar)
      const removeBtn=el.querySelector('.gdi-course-remove');
      if(removeBtn){
        removeBtn.onmouseenter=()=>{removeBtn.style.color='#ff8b8b';removeBtn.style.background='rgba(255,107,107,.15)';};
        removeBtn.onmouseleave=()=>{removeBtn.style.color='var(--ferreto-text-muted,#8b949e)';removeBtn.style.background='transparent';};
        removeBtn.onclick=(e)=>{
          e.stopPropagation();
          if(confirm('Ocultar "'+name+'" da sua lista de cursos?\n\nO curso não será excluído — você pode restaurá-lo depois. Apenas desaparece da lista "Meus Cursos".')){
            hideCourse(c.key);
            showToast('Curso ocultado');
            renderCursos(box);
          }
        };
      }

      // ★ clicar no card (não nos botões) abre detalhes
      el.onclick=(e)=>{
        if(e.target.closest('button'))return; // não abre detalhes se clicou em botão
        openCourseDetail(box,c);
      };
    });
  }

  // ★ Modal de cursos ocultos
  function showHiddenCoursesModal(box){
    const hidden=listHiddenCourses();
    if(!hidden.length){showToast('Nenhum curso oculto');return;}
    // monta lista de cursos ocultos com info básica
    const d=stateD()||{};
    const items=hidden.map(ck=>({
      key:ck,
      name:cleanCourseName(ck),
      drive:driveNameOf(ck)
    }));
    box.innerHTML=`<div style="max-width:680px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--ferreto-border,#21262d);">
        <b style="color:var(--ferreto-text,#f0f6fc);font-size:15px;"><i class="bi bi-eye-slash"></i> Cursos ocultos (${hidden.length})</b>
        <button id="gdi-hidden-back" class="gdi-mode-btn" style="font-size:12px;"><i class="bi bi-arrow-left"></i> Voltar</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${items.map(it=>`
          <div class="gdi-note" style="display:flex;align-items:center;gap:10px;">
            <i class="bi bi-folder-x" style="color:var(--ferreto-text-muted,#8b949e);font-size:16px;flex:none;"></i>
            <div style="flex:1;min-width:0;">
              <b style="color:var(--ferreto-text,#f0f6fc);font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(it.name)}</b>
              ${it.drive?`<small style="color:var(--ferreto-secondary,#5ddeda);font-size:10px;">${escHtml(it.drive)}</small>`:''}
            </div>
            <button class="gdi-mode-btn gdi-restore-one" data-ck="${escHtml(it.key)}" style="font-size:11px;"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--ferreto-border,#21262d);display:flex;gap:8px;justify-content:flex-end;">
        <button id="gdi-restore-all" class="gdi-btn gdi-btn-primary" style="font-size:12px;"><i class="bi bi-arrow-counterclockwise"></i> Restaurar todos</button>
      </div>
    </div>`;
    box.querySelector('#gdi-hidden-back').onclick=()=>renderCursos(box);
    box.querySelectorAll('.gdi-restore-one').forEach(b=>{
      b.onclick=()=>{
        unhideCourse(b.dataset.ck);
        showToast('Curso restaurado');
        showHiddenCoursesModal(box);
      };
    });
    box.querySelector('#gdi-restore-all').onclick=()=>{
      if(confirm('Restaurar todos os '+hidden.length+' cursos?')){
        lsSet(LS_HIDDEN,[]);
        showToast('Todos os cursos restaurados');
        renderCursos(box);
      }
    };
  }

  // ★ Painel de detalhes do curso (abre ao clicar no card)
  function openCourseDetail(box,c){
    const name=cleanCourseName(c.key);
    const drive=driveNameOf(c.key);
    const progress=c.lessons.size>0?Math.round(c.watched/c.lessons.size*100):0;
    const progressColor=progress>=80?'#3fb950':progress>=40?'#ffd43b':'var(--ferreto-primary,#ff8b9f)';
    const remaining=c.lessons.size-c.watched;

    // coleta aulas individuais do curso
    const d=stateD()||{};
    const pre=low(c.key);
    const inC=p=>{const l=low(p);return l===pre||l.indexOf(pre+'/')===0;};
    const lessons=[];
    const w=(d&&d.watched)||{},r=(d&&d.resume)||{};
    const seen=new Set();
    const addLesson=(p,watched,resume)=>{
      const lp=low(p);
      if(seen.has(lp))return;
      if(!inC(p))return;
      seen.add(lp);
      lessons.push({path:String(p).split('?')[0],name:realName(p),watched,resumed:!!resume});
    };
    for(const k in w)addLesson(k,true,r[k]);
    for(const k in r)if(!seen.has(low(k)))addLesson(k,false,r[k]);
    (Array.isArray(d.history)?d.history:[]).forEach(h=>{if(h&&h.path)addLesson(h.path,false,null);});
    lessons.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true}));

    box.innerHTML=`<div style="max-width:760px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--ferreto-border,#21262d);">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <button id="gdi-detail-back" class="gdi-mode-btn" style="font-size:12px;flex:none;"><i class="bi bi-arrow-left"></i></button>
          <i class="bi bi-folder-fill" style="color:var(--ferreto-primary,#ff8b9f);font-size:22px;flex:none;"></i>
          <div style="min-width:0;">
            <b style="color:var(--ferreto-text,#f0f6fc);font-size:16px;font-family:var(--ferreto-font-display,'Poppins',sans-serif);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(name)}</b>
            ${drive?`<small style="color:var(--ferreto-secondary,#5ddeda);font-size:11px;"><i class="bi bi-hdd"></i> ${escHtml(drive)}</small>`:''}
          </div>
        </div>
        <button id="gdi-detail-hide" class="gdi-mode-btn" style="font-size:11px;color:#ff8b8b;border-color:rgba(255,107,107,.3);" title="Ocultar curso"><i class="bi bi-eye-slash"></i> Ocultar</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:18px;">
        <div style="background:var(--ferreto-surface-2,#161b22);border:1px solid var(--ferreto-border,#21262d);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:var(--ferreto-text,#f0f6fc);">${c.lessons.size}</div>
          <div style="font-size:10px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;letter-spacing:.05em;margin-top:2px;">Aulas</div>
        </div>
        <div style="background:var(--ferreto-surface-2,#161b22);border:1px solid var(--ferreto-border,#21262d);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#3fb950;">${c.watched}</div>
          <div style="font-size:10px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;letter-spacing:.05em;margin-top:2px;">Assistidas</div>
        </div>
        <div style="background:var(--ferreto-surface-2,#161b22);border:1px solid var(--ferreto-border,#21262d);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#ffd43b;">${remaining}</div>
          <div style="font-size:10px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;letter-spacing:.05em;margin-top:2px;">Restantes</div>
        </div>
        <div style="background:var(--ferreto-surface-2,#161b22);border:1px solid var(--ferreto-border,#21262d);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:${progressColor};">${progress}%</div>
          <div style="font-size:10px;color:var(--ferreto-text-muted,#8b949e);text-transform:uppercase;letter-spacing:.05em;margin-top:2px;">Concluído</div>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <b style="color:var(--ferreto-text,#f0f6fc);font-size:13px;">Progresso do curso</b>
          <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${c.watched}/${c.lessons.size}</span>
        </div>
        <div style="height:8px;background:var(--ferreto-surface-3,rgba(255,255,255,.08));border-radius:4px;overflow:hidden;">
          <div style="height:8px;width:${progress}%;background:${progressColor};border-radius:4px;transition:width .3s;"></div>
        </div>
      </div>

      ${c.lastAt?`<div style="background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--ferreto-text-muted,#8b949e);">
        <i class="bi bi-clock-history"></i> Última atividade: <b style="color:var(--ferreto-text,#e6edf3);">${dateBr(c.lastAt)}</b>
      </div>`:''}

      <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="gdi-detail-continue" class="gdi-btn gdi-btn-primary" style="font-size:12px;flex:1;justify-content:center;" disabled><i class="bi bi-hourglass-split"></i> Verificando próxima aula…</button>
      </div>

      <div>
        <b style="color:var(--ferreto-text,#f0f6fc);font-size:13px;display:block;margin-bottom:8px;"><i class="bi bi-list-ul"></i> Aulas do curso (${lessons.length})</b>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${lessons.length?lessons.map(l=>`
            <div class="gdi-note" style="display:flex;align-items:center;gap:10px;cursor:pointer;" data-path="${escHtml(l.path)}">
              <i class="bi ${l.watched?'bi-check-circle-fill':'bi-play-circle'}" style="color:${l.watched?'#3fb950':'var(--ferreto-primary,#ff8b9f)'};font-size:18px;flex:none;"></i>
              <span style="flex:1;min-width:0;color:var(--ferreto-text,#e6edf3);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(l.name)}</span>
              ${l.watched?'<span style="font-size:10px;color:#3fb950;flex:none;">✓</span>':'<span style="font-size:10px;color:var(--ferreto-text-muted,#8b949e);flex:none;">não vista</span>'}
            </div>
          `).join(''):'<div class="gdi-notes-empty">Nenhuma aula registrada ainda.</div>'}
        </div>
      </div>
    </div>`;

    // back
    box.querySelector('#gdi-detail-back').onclick=()=>renderCursos(box);
    // hide
    box.querySelector('#gdi-detail-hide').onclick=()=>{
      if(confirm('Ocultar "'+name+'" da sua lista de cursos?')){
        hideCourse(c.key);
        showToast('Curso ocultado');
        renderCursos(box);
      }
    };
    // continue
    const contBtn=box.querySelector('#gdi-detail-continue');
    bestIn(c.key).then(target=>{
      if(target){
        contBtn.disabled=false;
        contBtn.innerHTML=`<i class="bi bi-play-fill"></i> Continuar: ${escHtml(realName(target).slice(0,40))}`;
        contBtn.onclick=()=>{location.href=target+(target.includes('?')?'&':'?')+'a=view';};
      }else{
        contBtn.disabled=true;
        contBtn.className='gdi-mode-btn';
        contBtn.style.flex='1';contBtn.style.justifyContent='center';
        contBtn.innerHTML='<i class="bi bi-check2-all" style="color:#3fb950;"></i> Tudo em dia!';
      }
    });
    // clicar numa aula → abrir
    box.querySelectorAll('[data-path]').forEach(el=>{
      el.onclick=()=>{
        const p=el.dataset.path;
        if(p)location.href=p+(p.includes('?')?'&':'?')+'a=view';
      };
    });
  }
  async function renderStats(box){
    let d=stateD();
    if(!d){
      // ★FIX: estado ainda não carregou — mostra loading, chama
      // ensureState() (fetch /userstate) e tenta de novo. Antes o
      // stateD()||{} caía pra objeto vazio e a aba parecia "parada"
      // mostrando zeros (sem dados para calcular streak/heatmap/etc).
      box.innerHTML=`<div class="gdi-notes-empty" style="padding:40px;text-align:center;">
        <div class="gdi-mat-isa-spin" style="margin:0 auto 12px;"></div>
        <div>Carregando estat\u00edsticas\u2026</div>
      </div>`;
      try{await ensureState();}catch(_){}
      d=stateD();
      if(!d){
        box.innerHTML=`<div class="gdi-notes-empty" style="padding:40px;text-align:center;">
          <i class="bi bi-exclamation-circle" style="font-size:32px;color:var(--ferreto-text-muted,#8b949e);"></i>
          <div style="margin-top:8px;">N\u00e3o foi poss\u00edvel carregar suas estat\u00edsticas.<br><span style="font-size:11px;">Estude algumas aulas e tente novamente.</span></div>
        </div>`;
        return;
      }
    }
    const chip=(ic,tx)=>`<span style="background:var(--ferreto-surface-2,#161b22);border:1px solid var(--ferreto-border,#21262d);border-radius:8px;padding:6px 10px;font-size:12px;color:var(--ferreto-text,#e6edf3);">${ic} ${tx}</span>`;
    const acts={};
    const addA=t=>{if(!t)return;const k=dayKey(t);acts[k]=(acts[k]||0)+1;};
    const w=(d.watched)||{},r=(d.resume)||{};
    for(const k in w)addA(w[k]&&w[k].at);
    for(const k in r)addA(r[k]&&r[k].at);
    if(d.last&&d.last.at)addA(d.last.at);
    for(const k in(d.notes||{}))(d.notes[k]||[]).forEach(n=>addA(n.at));
    (Array.isArray(d.history)?d.history:[]).forEach(h=>addA(h&&h.at));
    const days=new Set(Object.keys(acts));
    let streak=0;const dd=new Date();
    const hasD=t=>days.has(dayKey(t));
    if(!hasD(dd))dd.setDate(dd.getDate()-1);
    while(hasD(dd)){streak++;dd.setDate(dd.getDate()-1);}
    const today=new Date();today.setHours(12,0,0,0);
    const begin=new Date(today);begin.setDate(begin.getDate()-91);begin.setDate(begin.getDate()-begin.getDay());
    const n=Math.round((today-begin)/86400000)+1;
    let heat='';
    for(let i=0;i<n;i++){
      const t=new Date(begin.getTime()+i*86400000);
      const a=acts[dayKey(t)]||0;
      const lvl=a===0?0:a===1?1:a<=3?2:a<=6?3:4;
      heat+=`<i class="${lvl?'l'+lvl:''}" title="${dateBr(t)} \u00b7 ${a} atividade${a===1?'':'s'}"></i>`;
    }
    const ws=new Date();ws.setHours(0,0,0,0);ws.setDate(ws.getDate()-ws.getDay());
    let wkMin=0;
    const watch=lsGet(LS_WATCH,{});
    for(const k in watch){const p=k.split('-').map(Number);const t=new Date(p[0],p[1]-1,p[2],12);if(t>=ws)wkMin+=watch[k];}
    wkMin=Math.round(wkMin/60);
    const per={};
    for(const k in r){const ck=courseKeyOf(k);if(!ck)continue;const x=r[k]||{};per[ck]=(per[ck]||0)+Math.min(x.t||0,(x.d>0?x.d:x.t)||0);}
    const top=Object.entries(per).map(([ck,s])=>({ck,h:s/3600})).sort((a,b)=>b.h-a.h).slice(0,8);
    const maxH=top.length?Math.max(top[0].h,.1):1;
    let notesN=0;for(const k in(d.notes||{}))notesN+=(d.notes[k]||[]).length;
    let srsDue=0;const now=Date.now();
    for(const k in(d.notes||{}))(d.notes[k]||[]).forEach(x=>{const e=d.srs&&d.srs[k+'|'+x.at];if((e?e.due:(x.at+86400000))<=now)srsDue++;});
    const totalH=Object.values(per).reduce((a,b)=>a+b,0)/3600;
    box.innerHTML=`
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        ${chip('\ud83d\udd25',streak+' dia'+(streak===1?'':'s')+' seguidos')}
        ${chip('\u23f1\ufe0f',fmtMin(todayMin())+' hoje')}
        ${chip('\ud83d\udcca',fmtMin(wkMin)+' na semana')}
        ${chip('\u2753','\u2248'+totalH.toFixed(1).replace('.',',')+'h no total')}
        ${chip('\u2705',Object.keys(w).length+' conclu\u00eddas')}
        ${chip('\u25b6',Object.keys(r).length+' em andamento')}
        ${chip('\ud83d\udcdd',notesN+' anota\u00e7\u00f5es')}
        ${srsDue?chip('\ud83c\udf93',srsDue+' revis\u00f5es vencidas'):''}
      </div>
      <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">\u00daltimos 3 meses \u00b7 atividades por dia</h4>
      <div class="heat" style="margin-bottom:18px;overflow-x:auto;padding-bottom:4px;">${heat}</div>
      <h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Horas por curso (estimativa)</h4>
      ${top.map(t2=>`<div style="margin-bottom:8px;min-width:260px;max-width:640px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ferreto-text,#e6edf3);margin-bottom:3px;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:78%;">${escHtml(courseName(t2.ck))}</span>
          <span style="color:var(--ferreto-text-muted,#8b949e);">${t2.h.toFixed(1).replace('.',',')}h</span>
        </div>
        <div style="height:6px;background:var(--ferreto-surface-3,rgba(255,255,255,.08));border-radius:3px;overflow:hidden;"><div style="height:6px;width:${Math.max(3,Math.round(t2.h/maxH*100))}%;background:var(--ferreto-grad);"></div></div>
      </div>`).join('')||'<div class="gdi-notes-empty">Sem dados ainda.</div>'}`;
  }
  function renderFlash(box){
    const cs=cards(),due=dueCards();
    const currentAula=(document.querySelector('.gdi-player-wrap')&&window.gdiVideoKey)?norm(window.gdiVideoKey()):'';
    const inp='background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,rgba(255,255,255,.14));border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:8px;font-size:13px;';
    box.innerHTML=`
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
        <b style="color:var(--ferreto-text,#f0f6fc);">${cs.length} cart\u00e3o${cs.length===1?'':'\u00f5es'}</b>
        <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">${due.length} vencido${due.length===1?'':'s'}</span>
        <button id="gdi-fc-study" class="gdi-btn gdi-btn-primary" style="font-size:12px;" ${due.length?'':'disabled'}><i class="bi bi-play-fill"></i> Estudar (${due.length})</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;max-width:640px;">
        <input id="gdi-fc-f" placeholder="Frente (pergunta)" style="${inp}">
        <input id="gdi-fc-b" placeholder="Verso (resposta)" style="${inp}">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button id="gdi-fc-add" class="gdi-mode-btn" style="font-size:12px;"><i class="bi bi-plus-lg"></i> Adicionar</button>
          ${currentAula?`<span style="font-size:11px;color:var(--ferreto-text-muted,#8b949e);">aula atual: ${escHtml(realName(currentAula).slice(0,30))}</span>`:''}
        </div>
      </div>
      <div id="gdi-fc-list" class="gdi-fc-grid-m22" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;"></div>`;
    const list=box.querySelector('#gdi-fc-list');
    function drawList(){
      const all=cards();
      if(!all.length){list.innerHTML='<div class="gdi-notes-empty" style="grid-column:1/-1;">Nenhum cart\u00e3o ainda \u2014 crie o primeiro acima, ou abra uma aula e clique em "Resumo Meggy" na barra de materiais para gerar flashcards automaticamente.</div>';return;}
      list.innerHTML='';
      all.slice().reverse().forEach(c=>{
        const card=document.createElement('div');
        card.className='gdi-fc-card';
        card.style.height='160px';
        card.innerHTML=`
          <div class="gdi-fc-card-inner">
            <div class="gdi-fc-card-face gdi-fc-card-front">
              <div class="gdi-fc-card-label"><i class="bi bi-question-circle"></i> PERGUNTA</div>
              <div class="gdi-fc-card-text">${escHtml(String(c.f).slice(0,200))}</div>
              <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para virar</div>
            </div>
            <div class="gdi-fc-card-face gdi-fc-card-back">
              <div class="gdi-fc-card-label"><i class="bi bi-check-circle"></i> RESPOSTA</div>
              <div class="gdi-fc-card-text">${escHtml(String(c.b).slice(0,300))}</div>
              <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para voltar</div>
            </div>
          </div>
          <button class="gdi-fc-card-del" title="Excluir"><i class="bi bi-x-lg"></i></button>`;
        card.onclick=(e)=>{if(e.target.closest('.gdi-fc-card-del'))return;card.classList.toggle('gdi-fc-flipped');};
        card.querySelector('.gdi-fc-card-del').onclick=(e)=>{e.stopPropagation();saveCards(cards().filter(x=>x.id!==c.id));drawList();showToast('Cartão excluído');};
        list.appendChild(card);
      });
    }
    drawList();
    box.querySelector('#gdi-fc-add').onclick=()=>{
      const f=box.querySelector('#gdi-fc-f').value.trim();
      const b=box.querySelector('#gdi-fc-b').value.trim();
      if(!f||!b){showToast('Preencha frente e verso');return;}
      const all=cards();
      all.push({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),f,b,path:currentAula||'',lesson:currentAula?realName(currentAula):'',at:Date.now(),box:0,due:Date.now()+86400000});
      saveCards(all);
      box.querySelector('#gdi-fc-f').value='';box.querySelector('#gdi-fc-b').value='';
      drawList();showToast('Cart\u00e3o adicionado');
    };
    box.querySelector('#gdi-fc-study').onclick=()=>studyFlash(box);
  }
  function studyFlash(box){
    const queue=dueCards();
    if(!queue.length){renderFlash(box);return;}
    let i=0,ok=0;
    function draw(){
      if(i>=queue.length){
        FC.active=false;
        box.innerHTML=`<div style="text-align:center;padding:30px;">
          <div style="font-size:40px;">\ud83c\udf89</div>
          <h3 style="color:var(--ferreto-text,#f0f6fc);">Revis\u00e3o conclu\u00edda!</h3>
          <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;">${ok}/${queue.length} lembradas de primeira.</p>
          <button class="gdi-mode-btn" id="gdi-fc-back" style="margin-top:8px;">Voltar aos cart\u00f5es</button>
        </div>`;
        box.querySelector('#gdi-fc-back').onclick=()=>renderFlash(box);
        return;
      }
      const c=queue[i];
      box.innerHTML=`
        <div style="text-align:center;color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin-bottom:10px;">Cart\u00e3o ${i+1}/${queue.length} \u00b7 [espa\u00e7o] vira \u00b7 [1] esqueci \u00b7 [2] quase \u00b7 [3] lembrei</div>
        <div class="gdi-fc-card gdi-fc-card-large" id="gdi-fc-card" style="margin:0 auto 14px;">
          <div class="gdi-fc-card-inner">
            <div class="gdi-fc-card-face gdi-fc-card-front">
              <div class="gdi-fc-card-label"><i class="bi bi-question-circle"></i> PERGUNTA</div>
              <div class="gdi-fc-card-text">${escHtml(c.f)}</div>
              <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para virar</div>
            </div>
            <div class="gdi-fc-card-face gdi-fc-card-back">
              <div class="gdi-fc-card-label"><i class="bi bi-check-circle"></i> RESPOSTA</div>
              <div class="gdi-fc-card-text">${escHtml(c.b)}</div>
              <div class="gdi-fc-card-hint"><i class="bi bi-arrow-repeat"></i> clique para voltar</div>
            </div>
          </div>
        </div>
        <div id="gdi-fc-btns" style="display:none;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap;">
          <button class="gdi-mode-btn" data-g="1">1 \u00b7 Esqueci</button>
          <button class="gdi-mode-btn" data-g="2">2 \u00b7 Quase</button>
          <button class="gdi-btn gdi-btn-primary" data-g="3">3 \u00b7 Lembrei</button>
        </div>`;
      const card=box.querySelector('#gdi-fc-card'),btns=box.querySelector('#gdi-fc-btns');
      let flipped=false;
      const flip=()=>{
        if(flipped)return;flipped=true;
        card.classList.add('gdi-fc-flipped');
        btns.style.display='flex';
      };
      card.onclick=flip;
      box.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>grade(+b.dataset.g));
      FC.flip=flip;
      FC.grade=grade;
      FC.active=true;
    }
    function grade(g){
      const c=queue[i];
      const all=cards();
      const ix=all.findIndex(x=>x.id===c.id);
      if(ix>=0){
        const day=86400000,steps=[1,7,30,90];
        if(g===1){all[ix].box=0;all[ix].due=Date.now()+day;}
        else if(g===2){all[ix].due=Date.now()+3*day;}
        else{all[ix].box=Math.min((all[ix].box||0)+1,3);all[ix].due=Date.now()+steps[all[ix].box]*day;}
        saveCards(all);
      }
      if(g===3)ok++;
      i++;draw();
    }
    draw();
  }
  function renderMarathon(box){
    const on=marOn(),intro=marIntro();
    const sw=(id,chk,tit,sub)=>`<label style="display:flex;justify-content:space-between;align-items:center;gap:14px;background:var(--ferreto-surface-2,#161b22);border:1px solid var(--ferreto-border,#21262d);border-radius:12px;padding:14px;cursor:pointer;">
      <span><b style="color:var(--ferreto-text,#f0f6fc);">${tit}</b><br><small style="color:var(--ferreto-text-muted,#8b949e);">${sub}</small></span>
      <input type="checkbox" id="${id}" ${chk?'checked':''} style="accent-color:var(--ferreto-primary,#ff8b9f);width:20px;height:20px;cursor:pointer;flex-shrink:0;"></label>`;
    box.innerHTML=`<div style="max-width:560px;display:flex;flex-direction:column;gap:12px;">
      ${sw('gdi-mar-on',on,'\ud83d\ude80 Modo Maratona','Ao terminar uma aula, abre sozinho a pr\u00f3xima n\u00e3o assistida da playlist')}
      ${sw('gdi-mar-intro',intro,'\u23e9 Pular introdu\u00e7\u00e3o autom\u00e1tico','Usa o tempo memorizado pelo bot\u00e3o "Pular introdu\u00e7\u00e3o" (M7)')}
      <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">Vale nas p\u00e1ginas de aula com playlist. O check \u2713 da aula continua sendo dado pelo auto-assistido (90%).</p>
    </div>`;
    box.querySelector('#gdi-mar-on').addEventListener('change',e=>{
      lsSet(LS_MAR,e.target.checked);
      showToast('Modo Maratona '+(e.target.checked?'LIGADO \ud83d\ude80':'desligado'));
    });
    box.querySelector('#gdi-mar-intro').addEventListener('change',e=>lsSet(LS_MARINTRO,e.target.checked));
  }
  if(!document.getElementById('gdi-central-style')){
    const s=document.createElement('style');s.id='gdi-central-style';s.textContent=`
/* ★ TELA CHEIA — Central de Estudos ocupa toda a viewport */
#gdi-central{position:fixed;inset:0;z-index:10001;background:var(--ferreto-bg,#070910);display:none;align-items:stretch;justify-content:stretch;padding:0;}
.gdi-central-box{background:var(--ferreto-bg,#0f1218);border:0;border-radius:0;width:100%;max-width:none;max-height:100dvh;height:100dvh;display:flex;flex-direction:column;overflow:hidden;}
.gdi-central-head{display:flex;align-items:center;gap:12px;padding:14px 24px;border-bottom:1px solid var(--ferreto-border,#21262d);flex-wrap:wrap;background:linear-gradient(135deg,rgba(255,139,159,.1),rgba(93,222,218,.06));flex-shrink:0;}
.gdi-central-tabs{display:flex;gap:4px;padding:8px 24px 0;border-bottom:1px solid var(--ferreto-border,#21262d);flex-wrap:wrap;flex-shrink:0;overflow-x:auto;}
.gdi-central-tab{background:none;border:0;color:var(--ferreto-text-muted,#8b949e);padding:10px 16px;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;font-family:var(--ferreto-font-body,'Rubik',sans-serif);white-space:nowrap;}
.gdi-central-tab:hover{color:var(--ferreto-text,#f0f6fc);}
.gdi-central-tab.active{color:var(--ferreto-text,#f0f6fc);border-bottom-color:var(--ferreto-primary,#ff8b9f);}
.gdi-central-body{flex:1;overflow-y:auto;padding:24px;color:var(--ferreto-text,#f0f6fc);}
.gdi-courses{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;}
.gdi-course{background:var(--ferreto-surface-2,rgba(255,255,255,.045));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;padding:16px;transition:border-color .15s,transform .15s;}
.gdi-course:hover{border-color:var(--ferreto-border-strong,#30363d);transform:translateY(-2px);}
.gdi-course b{color:var(--ferreto-text,#f0f6fc);font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ferreto-font-display,'Poppins',sans-serif);}
.gdi-course small{color:var(--ferreto-text-muted,#8b949e);font-size:11px;display:block;margin:6px 0 12px;}
.heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,10px);gap:3px;width:max-content;}
.heat i{width:10px;height:10px;border-radius:2px;background:var(--ferreto-surface-3,rgba(255,255,255,.08));display:block;}
.heat i.l1{background:#0e4429}.heat i.l2{background:#006d32}.heat i.l3{background:#26a641}.heat i.l4{background:#39d353}
.gdi-fc{background:var(--ferreto-surface-2,rgba(255,255,255,.045));border:1px solid var(--ferreto-border-strong,#30363d);border-radius:14px;padding:26px 20px;min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;max-width:560px;margin:0 auto;}
`;document.head.appendChild(s);
  }
  // ★ Central de Estudos agora é uma ABA na navbar (não mais flutuante).
  // Injeta um .gdi-nav-btn em .gdi-nav-actions a cada render da navbar.
  function injectNavButton(){
    // 1) remove qualquer fab antigo (versão em cache pode ter criado)
    const oldFab=document.getElementById('gdi-central-fab');
    if(oldFab)oldFab.remove();

    // 2) injeta botão na navbar
    const actions=document.querySelector('.gdi-nav-actions');
    if(!actions)return false;
    if(actions.querySelector('#gdi-central-nav'))return true; // já injetou
    const btn=document.createElement('button');
    btn.id='gdi-central-nav';
    btn.className='gdi-nav-btn';
    btn.title='Central de Estudos (tecla C)';
    btn.innerHTML='<i class="bi bi-journal-bookmark-fill"></i><span class="d-none d-md-inline">Estudos</span>';
    btn.onclick=()=>openPanel('cursos');
    // insere antes do botão de tema (se existir) ou no início
    const themeBtn=document.getElementById('theme-toggle');
    if(themeBtn)actions.insertBefore(btn,themeBtn);
    else actions.appendChild(btn);
    return true;
  }
  // tenta injetar imediatamente + retries agressivos (navbar pode demorar)
  injectNavButton();
  for(let i=1;i<=10;i++)setTimeout(injectNavButton,i*300);
  Bus.onGlobal('page:change',()=>setTimeout(injectNavButton,100));
  Bus.onGlobal('page:change',()=>setTimeout(injectNavButton,500));
  Bus.onGlobal('rows:appended',()=>setTimeout(injectNavButton,50));
  // também registra como GDI_MODULE — o loader roda após a navbar estar pronta
  window.GDI_MODULES=window.GDI_MODULES||[];
  window.GDI_MODULES.push({name:'central-nav',init:function(){injectNavButton();}});
  // observer como fallback (navbar é reconstruída async pelo app.min.js)
  function setupNavObserver(){
    const navEl=document.querySelector('.gdi-nav')||document.getElementById('nav');
    if(!navEl){setTimeout(setupNavObserver,500);return;}
    new MutationObserver(()=>injectNavButton()).observe(navEl,{childList:true,subtree:true});
  }
  setupNavObserver();

  document.addEventListener('keydown',e=>{
    const t=e.target;
    if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Escape'){closePanel();return;}
    const k=e.key.toLowerCase();
    if(k==='c'){
      if(panel&&panel.style.display!=='none')closePanel();
      else openPanel();
      return;
    }
    if(!FC.active||!panel||panel.style.display==='none')return;
    if(e.code==='Space'){e.preventDefault();FC.flip&&FC.flip();}
    else if(e.key==='1'||e.key==='2'||e.key==='3'){FC.grade&&FC.grade(+e.key);}
  });
  log('central de estudos ativa (v2.6 \u2014 aba na navbar, sem observer loop)');
})();

// ═══════════════════════════════════════════════════════════════
// M24: ESTUDO AVANÇADO — Provas, Redação, Radar, Adaptativo
// Fornece renderProvas/renderRedacao/renderRadar para o M22.
// Integra com /api/ai (Meggy) e extractPdfText (M9-ISA).
// ═══════════════════════════════════════════════════════════════
(function(){
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}};
  const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  async function callMeggy(prompt){
    const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:prompt,messages:[]})});
    const data=await r.json();
    if(!data.ok)throw new Error(data.error||'Meggy indisponível');
    return data.response||'';
  }

  function renderMd(txt){
    if(window.marked){try{return marked.parse(txt);}catch(_){}}
    return esc(txt).replace(/\n/g,'<br>');
  }

  const inp='background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px;font-size:13px;width:100%;box-sizing:border-box;font-family:inherit;';

  // ── Render: Provas anteriores → plano de estudos ──
  window.renderProvas=function(box){
    const plans=lsGet('gdi-exam-plans-v1',[]);
    box.innerHTML=`
      <div style="margin-bottom:18px;">
        <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 8px;">📋 Análise de Provas Anteriores</h3>
        <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin:0 0 14px;">Faça upload de provas anteriores (PDF). A Meggy analisa os temas mais cobrados e cria um plano de estudos focado.</p>
        <div style="border:2px dashed var(--ferreto-border,#30363d);border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:.15s;" id="gdi-prova-drop">
          <i class="bi bi-cloud-upload" style="font-size:32px;color:var(--ferreto-primary,#ff8b9f);"></i>
          <p style="color:var(--ferreto-text,#e6edf3);font-size:14px;margin:8px 0 4px;">Clique para selecionar um PDF de prova</p>
          <p style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin:0;">ou arraste e solte aqui</p>
          <input type="file" id="gdi-prova-file" accept="application/pdf" style="display:none;">
        </div>
        <div id="gdi-prova-status" style="margin-top:12px;"></div>
      </div>
      ${plans.length?`<h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 8px;">Planos salvos (${plans.length})</h4>
      <div style="display:flex;flex-direction:column;gap:8px;">${plans.slice().reverse().map(p=>`<div class="gdi-note" style="cursor:pointer;" data-id="${p.id}">
        <span style="flex:1;"><b style="color:var(--ferreto-text,#f0f6fc);">${esc(p.name)}</b><br><span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${new Date(p.date).toLocaleDateString('pt-BR')} · ${p.topics||''} temas</span></span>
        <i class="bi bi-chevron-right" style="color:var(--ferreto-text-muted,#8b949e);"></i>
      </div>`).join('')}</div>`:''}
    `;
    const drop=box.querySelector('#gdi-prova-drop');
    const fileInput=box.querySelector('#gdi-prova-file');
    drop.onclick=()=>fileInput.click();
    drop.ondragover=e=>{e.preventDefault();drop.style.borderColor='var(--ferreto-primary,#ff8b9f)';};
    drop.ondragleave=()=>{drop.style.borderColor='var(--ferreto-border,#30363d)';};
    drop.ondrop=e=>{e.preventDefault();drop.style.borderColor='var(--ferreto-border,#30363d)';if(e.dataTransfer.files[0])analyzeProva(box,e.dataTransfer.files[0]);};
    fileInput.onchange=()=>{if(fileInput.files[0])analyzeProva(box,fileInput.files[0]);};
    // clickable saved plans
    box.querySelectorAll('[data-id]').forEach(el=>{
      el.onclick=()=>{
        const p=plans.find(x=>x.id===el.dataset.id);
        if(p)showPlan(box,p);
      };
    });
  };

  async function analyzeProva(box,file){
    const status=box.querySelector('#gdi-prova-status');
    if(!file.name.toLowerCase().endsWith('.pdf')){status.innerHTML='<div class="gdi-ai-err">Apenas arquivos PDF são suportados.</div>';return;}
    status.innerHTML='<div class="gdi-ai-loading" style="padding:20px;text-align:center;"><div class="gdi-ai-typing" style="margin:0 auto;"><span></span><span></span><span></span></div><p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin-top:10px;">Extraindo texto da prova…</p></div>';
    try{
      // carrega pdf.js
      const pdfjsLib=window.pdfjsLib;
      if(!pdfjsLib){
        await new Promise((res,rej)=>{
          const s=document.createElement('script');
          s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
          s.onload=()=>{window.pdfjsLib=window.pdfjsLib||pdfjsLib;res();};
          s.onerror=rej;
          document.head.appendChild(s);
        });
      }
      const lib=window.pdfjsLib;
      if(lib&&lib.GlobalWorkerOptions)lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const buf=await file.arrayBuffer();
      const doc=await lib.getDocument({data:buf,disableFontFace:true}).promise;
      const n=Math.min(doc.numPages,60);
      let txt='';
      for(let i=1;i<=n;i++){
        const pg=await doc.getPage(i);
        const tc=await pg.getTextContent({normalizeWhitespace:true,includeMarkedContent:true});
        let pt='';
        for(const item of tc.items){if(item.str!==undefined){pt+=item.str;if(item.hasEOL)pt+='\n';}}
        txt+=pt+'\n\n';
        if(txt.length>25000)break;
      }
      try{doc.destroy();}catch(_){}
      txt=txt.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,8000);
      if(txt.length<50){status.innerHTML='<div class="gdi-ai-err">Não foi possível extrair texto deste PDF.</div>';return;}

      status.innerHTML='<div class="gdi-ai-loading" style="padding:20px;text-align:center;"><div class="gdi-ai-typing" style="margin:0 auto;"><span></span><span></span><span></span></div><p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin-top:10px;">Meggy está analisando a prova e criando o plano…</p></div>';
      const resp=await callMeggy('Analise esta prova anterior de concurso/vestibular e crie um plano de estudos focado. Identifique os 5 temas mais cobrados e sugira quantas horas dedicar a cada um (total ~100h). Formato Markdown com ## títulos, lista de temas com horas, e justificativa breve:\n\n'+txt);
      const plan={id:uid(),name:file.name,date:Date.now(),plan:resp,topics:(resp.match(/##\s+(.+)/g)||[]).length};
      const plans=lsGet('gdi-exam-plans-v1',[]);
      plans.push(plan);
      lsSet('gdi-exam-plans-v1',plans);
      showPlan(box,plan);
      showToast('Plano de estudos criado!');
    }catch(e){
      status.innerHTML='<div class="gdi-ai-err">Erro: '+esc(e.message)+'</div>';
    }
  }

  function showPlan(box,plan){
    box.innerHTML=`<div style="max-width:760px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <button class="gdi-mode-btn" id="prova-back" style="font-size:12px;"><i class="bi bi-arrow-left"></i> Voltar</button>
        <b style="color:var(--ferreto-text,#f0f6fc);">${esc(plan.name)}</b>
        <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${new Date(plan.date).toLocaleDateString('pt-BR')}</span>
      </div>
      <div class="gdi-isa-summary-body" style="background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;padding:20px;color:var(--ferreto-text,#e6edf3);font-size:14px;line-height:1.8;">
        ${renderMd(plan.plan)}
      </div>
    </div>`;
    box.querySelector('#prova-back').onclick=()=>window.renderProvas(box);
  }

  // ── Render: Correção de Redação ──
  window.renderRedacao=function(box){
    const corrections=lsGet('gdi-essay-corrections-v1',[]);
    const BANCAS=['CEBRASPE (CESPE)','FGV','VUNESP','FCC','CESGRANRIO','IBFC','FUJB','OAB','TJ/SP','TRT','MPU','TRE','TCU','PF/PRF','Outra'];
    box.innerHTML=`
      <div style="margin-bottom:18px;">
        <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 8px;">✍️ Correção de Redação</h3>
        <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin:0 0 14px;">A Meggy corrige sua redação seguindo os critérios oficiais da banca escolhida.</p>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;color:var(--ferreto-text-muted,#8b949e);display:block;margin-bottom:4px;">Banca:</label>
          <select id="red-banca" style="${inp}width:auto;">
            ${BANCAS.map(b=>`<option value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <textarea id="red-text" placeholder="Cole sua redação aqui..." style="${inp}min-height:200px;resize:vertical;font-family:Georgia,serif;font-size:14px;line-height:1.6;"></textarea>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button class="gdi-btn gdi-btn-primary" id="red-corrigir"><i class="bi bi-pencil-square"></i> Corrigir com Meggy</button>
          <span id="red-status" style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;align-self:center;"></span>
        </div>
      </div>
      <div id="red-result"></div>
      ${corrections.length?`<h4 style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 8px;">Correções anteriores (${corrections.length})</h4>
      <div style="display:flex;flex-direction:column;gap:6px;">${corrections.slice().reverse().slice(0,10).map(c=>`<div class="gdi-note" style="cursor:pointer;" data-id="${c.id}">
        <span style="flex:1;"><b style="color:var(--ferreto-text,#f0f6fc);">${esc(c.banca)}</b> · <span style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${new Date(c.date).toLocaleDateString('pt-BR')} · Nota: ${c.score||'—'}</span></span>
      </div>`).join('')}</div>`:''}
    `;
    box.querySelector('#red-corrigir').onclick=async()=>{
      const banca=box.querySelector('#red-banca').value;
      const text=box.querySelector('#red-text').value.trim();
      const status=box.querySelector('#red-status');
      const result=box.querySelector('#red-result');
      if(!text||text.length<50){showToast('Escreva ou cole sua redação primeiro');return;}
      status.innerHTML='<i class="bi bi-hourglass-split"></i> Meggy está corrigindo…';
      result.innerHTML='';
      try{
        const bancaInfo={
          'CEBRASPE (CESPE)':'CEBRASPE/CESPE usa escala 0-10. Critérios: adequação ao tema, estrutura textual, desenvolvimento de ideias, coesão e coerência, gramática. Desclassifica se fuga ao tema.',
          'FGV':'FGV avalia: conteúdo (0-5), estrutura (0-3), linguagem (0-2). Total 0-10. Penaliza erros graves de português.',
          'VUNESP':'VUNESP avalia: tema e conteúdo (0-4), estrutura e coesão (0-3), norma culta (0-3). Total 0-10.',
          'FCC':'FCC avalia: adequação ao tema (0-3), estrutura e coesão (0-3), norma culta e clareza (0-4). Total 0-10.',
          'CESGRANRIO':'CESGRANRIO avalia: atendimento ao tema (0-4), estrutura e coesão (0-3), norma culta (0-3). Total 0-10.',
          'IBFC':'IBFC avalia: conteúdo e tema (0-4), estrutura e coesão (0-3), linguagem e norma culta (0-3). Total 0-10.',
          'OAB':'OAB avalia: correção jurídica, estrutura argumentativa, clareza e objetividade, norma culta. Total 0-10.',
          'FUJB':'FUJB avalia: adequação ao tema, coesão/coerência, norma culta, criatividade. Total 0-10.',
          'TJ/SP':'TJ/SP (VUNESP): tema e conteúdo (0-4), estrutura (0-3), norma culta (0-3).',
          'TRT':'TRT (CEBRASPE/FCC): mesma banca organizadora. Avalia tema, estrutura, gramática.',
          'MPU':'MPU (CEBRASPE): escala 0-10. Adequação ao tema, estrutura, desenvolvimento, coesão, gramática.',
          'TRE':'TRE (CEBRASPE): escala 0-10. Mesmos critérios CEBRASPE.',
          'TCU':'TCU (CEBRASPE): escala 0-10. Mesmos critérios CEBRASPE.',
          'PF/PRF':'PF/PRF (CEBRASPE): escala 0-10. Mesmos critérios CEBRASPE.',
          'Outra':'Critérios gerais de concurso público brasileiro.'
        };
        const criterios=bancaInfo[banca]||bancaInfo['Outra'];
        const resp=await callMeggy('Corrija esta redação de concurso público (banca: '+banca+'). CRITÉRIOS DESTA BANCA: '+criterios+'. Avalie cada critério com nota de 0 a 10 + nota geral + comentários detalhados ponto por ponto + sugestões de melhoria + versão reescrita de trechos problemáticos. Formato Markdown com ## seções:\n\nREDAÇÃO:\n'+text);
        // extrai nota geral (procura "Nota geral:" ou "Nota: X")
        const scoreMatch=resp.match(/nota\s*geral\s*:?\s*(\d+[,.]?\d*)/i)||resp.match(/nota\s*:?\s*(\d+[,.]?\d*)/i);
        const score=scoreMatch?scoreMatch[1]:'—';
        const correction={id:uid(),banca,date:Date.now(),text:text.slice(0,2000),correction:resp,score};
        const corr=lsGet('gdi-essay-corrections-v1',[]);
        corr.push(correction);
        lsSet('gdi-essay-corrections-v1',corr);
        status.innerHTML='';
        result.innerHTML=`<div class="gdi-isa-summary-body" style="background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;padding:20px;color:var(--ferreto-text,#e6edf3);font-size:14px;line-height:1.8;margin-top:14px;">
          ${renderMd(resp)}
        </div>`;
        showToast('Redação corrigida! Nota: '+score);
      }catch(e){
        status.innerHTML='<span style="color:#ff6b6b;">Erro: '+esc(e.message)+'</span>';
      }
    };
    box.querySelectorAll('[data-id]').forEach(el=>{
      el.onclick=()=>{
        const c=corrections.find(x=>x.id===el.dataset.id);
        if(c){
          box.querySelector('#red-banca').value=c.banca;
          box.querySelector('#red-text').value=c.text;
          box.querySelector('#red-result').innerHTML=`<div class="gdi-isa-summary-body" style="background:var(--ferreto-surface-2,rgba(255,255,255,.03));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;padding:20px;color:var(--ferreto-text,#e6edf3);font-size:14px;line-height:1.8;margin-top:14px;">${renderMd(c.correction)}</div>`;
        }
      };
    });
  };

  // ── Render: Radar de fracos (SVG) ──
  window.renderRadar=function(box){
    // coleta dados de questões por assunto
    const qs=lsGet('gdi-questions-v1',[]);
    const srs=lsGet('gdi-q-srs-v1',{});
    const bySubject={};
    qs.forEach(q=>{
      const s=q.subject||'Geral';
      if(!bySubject[s])bySubject[s]={total:0,correct:0,wrong:0};
      bySubject[s].total++;
      const st=srs[q.id];
      if(st){
        if(st.box>0)bySubject[s].correct++;
        else bySubject[s].wrong++;
      }
    });
    const subjects=Object.entries(bySubject).filter(([,v])=>v.total>=1).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
    if(!subjects.length){
      box.innerHTML='<div class="gdi-notes-empty">Resolva algumas questões para ver seu mapa de fracos.</div>';
      return;
    }
    // SVG radar
    const size=300,cx=150,cy=150,maxR=110;
    const n=subjects.length;
    const angle=i=>(-Math.PI/2)+(i*2*Math.PI/n);
    const pt=(r,i)=>[cx+r*Math.cos(angle(i)),cy+r*Math.sin(angle(i))];
    // grid (5 anéis)
    let grid='';
    for(let r=1;r<=5;r++){
      const rr=maxR*r/5;
      const pts=Array.from({length:n},(_,i)=>pt(rr,i).join(',')).join(' ');
      grid+=`<polygon points="${pts}" fill="none" stroke="var(--ferreto-border,#30363d)" stroke-width="1" opacity="${0.3+r*0.1}"/>`;
    }
    // eixos
    let axes='';
    subjects.forEach(([,],i)=>{const [x,y]=pt(maxR,i);axes+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--ferreto-border,#30363d)" stroke-width="1" opacity=".3"/>`;});
    // dados
    let dataPts='';
    let labels='';
    subjects.forEach(([subj,v],i)=>{
      const acc=v.total>0?(v.correct/v.total):0;
      const r=maxR*Math.max(0.1,1-acc); // quanto menor acerto, mais pra fora (pior)
      const [x,y]=pt(r,i);
      dataPts+=`${x},${y} `;
      // label
      const [lx,ly]=pt(maxR+22,i);
      const short=subj.length>18?subj.slice(0,16)+'…':subj;
      const color=acc<0.5?'#ff6b6b':acc<0.7?'#ffd43b':'#3fb950';
      labels+=`<text x="${lx}" y="${ly}" text-anchor="middle" font-size="9" fill="${color}">${esc(short)}</text>`;
      labels+=`<text x="${lx}" y="${ly+10}" text-anchor="middle" font-size="8" fill="var(--ferreto-text-muted,#8b949e)">${Math.round(acc*100)}%</text>`;
    });
    const weakSubjects=subjects.filter(([,v])=>v.total>0&&(v.correct/v.total)<0.6).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
    box.innerHTML=`<div style="max-width:760px;">
      <h3 style="color:var(--ferreto-text,#f0f6fc);margin:0 0 4px;">🎯 Mapa de Fracos</h3>
      <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin:0 0 16px;">Quanto mais pra fora, pior seu desempenho. Foque nas áreas vermelhas.</p>
      <div style="display:flex;justify-content:center;margin-bottom:20px;">
        <svg width="${size}" height="${size}" style="max-width:100%;">
          ${grid}${axes}
          <polygon points="${dataPts.trim()}" fill="rgba(255,139,159,.2)" stroke="var(--ferreto-primary,#ff8b9f)" stroke-width="2"/>
          ${dataPts.trim().split(' ').map(p=>{const[x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r="3" fill="var(--ferreto-primary,#ff8b9f)"/>`;}).join('')}
          ${labels}
        </svg>
      </div>
      ${weakSubjects.length?`<div style="background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.3);border-radius:12px;padding:14px;margin-bottom:14px;">
        <b style="color:#ff8b8b;">⚠️ Foque em:</b>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
          ${weakSubjects.map(([s,v])=>`<span style="color:var(--ferreto-text,#e6edf3);font-size:13px;">• ${esc(s)} — ${Math.round(v.correct/v.total*100)}% de acerto (${v.correct}/${v.total})</span>`).join('')}
        </div>
      </div>`:'<div style="background:rgba(63,185,80,.08);border:1px solid rgba(63,185,80,.3);border-radius:12px;padding:14px;"><b style="color:#3fb950;">✓ Bom desempenho geral!</b> Nenhuma matéria com taxa de acerto abaixo de 60%.</div>'}
    </div>`;
  };

  console.log('[GDI Extras] M24 Estudo Avançado (provas/redação/radar) ativo');
})();

// ═══════════════════════════════════════════════════════════════
// M-FERRETO: TEMA VISUAL FERRETO PARA OS MÓDULOS EXTRAS
// Carrega fontes (Poppins/Rubik/Inter), fixa tokens e reaplica a
// linguagem visual Ferreto (coral #ff8b9f / teal #5ddeda) sobre os
// componentes próprios deste extras (debug, pomodoro, notas,
// materiais, playlist, sleep, skip-intro, continue-card, progress,
// central de estudos). Não altera lógica dos módulos.
// ═══════════════════════════════════════════════════════════════
(function(){
  if(window.__gdiFerretoExtras)return;window.__gdiFerretoExtras=true;
  console.log('[GDI Extras] M-FERRETO tema aplicado');

  // ── 1) Fontes Ferreto (Poppins / Rubik / Inter) ──
  if(!document.getElementById('gdi-ferreto-fonts')){
    const f=document.createElement('link');
    f.id='gdi-ferreto-fonts';f.rel='stylesheet';
    f.href='https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Rubik:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(f);
  }
  if(!document.querySelector('link[rel="preconnect"][href*="fonts.gstatic"]')){
    const p=document.createElement('link');p.rel='preconnect';p.crossOrigin='';p.href='https://fonts.gstatic.com';document.head.appendChild(p);
  }

  // ── 2) Tokens (espelha app.min.js p/ tornar extras autossuficiente) ──
  if(!document.getElementById('gdi-ferreto-tokens')){
    const t=document.createElement('style');t.id='gdi-ferreto-tokens';t.textContent=`
:root{
  --ferreto-primary:#ff8b9f;--ferreto-primary-600:#f5697f;--ferreto-secondary:#5ddeda;
  --ferreto-accent:#c026d3;--ferreto-radius:16px;--ferreto-radius-sm:10px;
  --ferreto-font-display:'Poppins','Rubik',system-ui,sans-serif;
  --ferreto-font-body:'Rubik','Inter',system-ui,sans-serif;
  --ferreto-grad:linear-gradient(135deg,#ff8b9f 0%,#c026d3 55%,#5ddeda 130%);
  --ferreto-grad-soft:linear-gradient(135deg,rgba(255,139,159,.16),rgba(93,222,218,.12));
  --ferreto-glow:rgba(255,139,159,.35);
}
[data-bs-theme="dark"]{
  --ferreto-bg:#070910;--ferreto-bg-2:#0d1119;
  --ferreto-surface:rgba(22,27,38,.72);--ferreto-surface-2:rgba(255,255,255,.045);--ferreto-surface-3:rgba(255,255,255,.08);
  --ferreto-border:rgba(255,255,255,.09);--ferreto-border-strong:rgba(255,255,255,.16);
  --ferreto-text:#f3f5fa;--ferreto-text-muted:#9aa4b8;--ferreto-text-faint:#6b7488;
}
[data-bs-theme="light"]{
  --ferreto-bg:#f4f5fb;--ferreto-bg-2:#e9ebf5;
  --ferreto-surface:rgba(255,255,255,.78);--ferreto-surface-2:rgba(255,255,255,.6);--ferreto-surface-3:rgba(15,23,42,.05);
  --ferreto-border:rgba(15,23,42,.1);--ferreto-border-strong:rgba(15,23,42,.18);
  --ferreto-text:#1f2540;--ferreto-text-muted:#5a6478;--ferreto-text-faint:#9aa1b4;
  --ferreto-glow:rgba(255,139,159,.28);
}
`;document.head.appendChild(t);
  }

  // ── 3) Estilização Ferreto dos componentes extras ──
  if(!document.getElementById('gdi-ferreto-extras-style')){
    const s=document.createElement('style');s.id='gdi-ferreto-extras-style';s.textContent=`

/* Debug panel */
.gdi-debug-wrap{background:var(--ferreto-bg-2)!important;border-top:2px solid var(--ferreto-primary)!important;border-radius:0!important;}
.gdi-debug-head{background:var(--ferreto-surface)!important;color:var(--ferreto-text-muted)!important;}
.gdi-debug-head:hover{background:var(--ferreto-surface-3)!important;}
.gdi-debug-head strong{color:var(--ferreto-text)!important;font-family:var(--ferreto-font-display)!important;}
.gdi-dbg-count{background:var(--ferreto-grad)!important;color:#fff!important;}
.gdi-debug-actions button{background:var(--ferreto-surface-2)!important;border-color:var(--ferreto-border)!important;color:var(--ferreto-text-muted)!important;border-radius:999px!important;padding:3px 12px!important;font-size:11px!important;}
.gdi-debug-actions button:hover{background:var(--ferreto-primary)!important;color:#fff!important;border-color:var(--ferreto-primary)!important;}
#gdi-debug-log{background:var(--ferreto-bg-2)!important;color:var(--ferreto-text)!important;}
.gdi-dbg-entry{border-bottom-color:var(--ferreto-border)!important;}
.gdi-dbg-pre{background:var(--ferreto-surface)!important;border-left-color:var(--ferreto-primary)!important;color:var(--ferreto-text-muted)!important;}

/* Materiais (tabs + body) */
.gdi-mat-head strong{color:var(--ferreto-text)!important;font-family:var(--ferreto-font-display)!important;}
#gdi-mat-status{color:var(--ferreto-text-muted)!important;}
.gdi-mat-tab{background:var(--ferreto-surface-2)!important;border-color:var(--ferreto-border)!important;color:var(--ferreto-text-muted)!important;border-radius:12px!important;transition:all .15s!important;}
.gdi-mat-tab i{color:var(--ferreto-secondary)!important;}
.gdi-mat-tab span{font-family:var(--ferreto-font-body)!important;}
.gdi-mat-tab:hover{background:var(--ferreto-surface-3)!important;color:var(--ferreto-text)!important;transform:translateY(-1px);}
.gdi-mat-tab.active{background:var(--ferreto-grad)!important;border:0!important;color:#fff!important;box-shadow:0 6px 16px -8px var(--ferreto-glow);}
.gdi-mat-tab.active i{color:#fff!important;}
.gdi-mat-body{background:var(--ferreto-surface)!important;border-color:var(--ferreto-border)!important;border-radius:var(--ferreto-radius)!important;}
.gdi-mat-empty{color:var(--ferreto-text-muted)!important;}
.gdi-mat-loading{color:var(--ferreto-text-muted)!important;}

/* Notas */
.gdi-notes{background:var(--ferreto-surface-2)!important;border-color:var(--ferreto-border)!important;border-radius:var(--ferreto-radius-sm)!important;}
.gdi-notes-head{color:var(--ferreto-text)!important;font-family:var(--ferreto-font-display)!important;}
#gdi-note-input{background:var(--ferreto-surface-2)!important;border-color:var(--ferreto-border)!important;color:var(--ferreto-text)!important;border-radius:10px!important;font-family:var(--ferreto-font-body)!important;}
#gdi-note-input:focus{border-color:var(--ferreto-primary)!important;box-shadow:0 0 0 4px var(--ferreto-glow)!important;outline:none!important;}
#gdi-note-time{color:var(--ferreto-primary)!important;}
#gdi-note-save{background:var(--ferreto-grad)!important;color:#fff!important;border:0!important;border-radius:999px!important;font-family:var(--ferreto-font-body)!important;font-weight:600!important;box-shadow:0 6px 16px -8px var(--ferreto-glow);}
#gdi-note-save:hover{filter:brightness(1.08);}
#gdi-notes-list{scrollbar-width:thin;}
.gdi-note{background:var(--ferreto-surface-3)!important;border-radius:10px!important;}
.gdi-note-time{color:var(--ferreto-primary)!important;}
.gdi-note-text{color:var(--ferreto-text)!important;}
.gdi-note-del{color:var(--ferreto-text-muted)!important;}
.gdi-note-del:hover{color:#ff6b6b!important;}
.gdi-note-mark{background:var(--ferreto-primary)!important;}
.gdi-note-mark:hover{background:#ffd43b!important;}

/* Pomodoro FAB + painel */
#gdi-pom-fab{background:conic-gradient(var(--ferreto-primary) calc(var(--pom-p,0)*1%),var(--ferreto-surface-3) 0)!important;box-shadow:0 6px 22px rgba(0,0,0,.5),0 0 0 1px var(--ferreto-border-strong)!important;}
#gdi-pom-fab::after{background:var(--ferreto-bg-2)!important;border-color:var(--ferreto-border)!important;}
#gdi-pom-fab>span{color:var(--ferreto-text)!important;}
#gdi-pom-fab.warning{animation:gdi-pom-pulse .8s ease-in-out infinite;}
@keyframes gdi-pom-pulse{0%,100%{box-shadow:0 6px 22px rgba(0,0,0,.5),0 0 0 1px var(--ferreto-border-strong);}50%{box-shadow:0 0 0 12px rgba(255,139,159,.25),0 6px 22px rgba(0,0,0,.5);}}
#gdi-pom-panel{background:var(--ferreto-surface)!important;-webkit-backdrop-filter:blur(20px)!important;backdrop-filter:blur(20px)!important;border-color:var(--ferreto-border-strong)!important;border-radius:var(--ferreto-radius)!important;box-shadow:0 20px 56px rgba(0,0,0,.6)!important;color:var(--ferreto-text)!important;}

/* Sleep button */
#gdi-sleep-btn{color:var(--ferreto-text-muted)!important;background:var(--ferreto-surface-2)!important;border:1px solid var(--ferreto-border)!important;border-radius:999px!important;}
#gdi-sleep-btn:hover{color:var(--ferreto-primary)!important;background:var(--ferreto-surface-3)!important;}

/* Skip intro */
#gdi-skip-intro{background:var(--ferreto-surface)!important;border:1px solid var(--ferreto-border-strong)!important;color:var(--ferreto-text)!important;border-radius:999px!important;font-family:var(--ferreto-font-body)!important;font-weight:600!important;box-shadow:0 8px 24px rgba(0,0,0,.5)!important;}
#gdi-skip-intro:hover{background:var(--ferreto-grad)!important;color:#fff!important;border:0!important;}

/* Progress / module prog chips */
#gdi-progress-line{color:var(--ferreto-text-muted)!important;}
.gdi-modprog{background:var(--ferreto-surface-2)!important;color:var(--ferreto-text-muted)!important;border-radius:999px!important;border:1px solid var(--ferreto-border)!important;}
.gdi-modprog b{color:var(--ferreto-secondary)!important;}

/* Continue card + Home card */
#gdi-home-card,.gdi-continue-card{background:var(--ferreto-surface)!important;border:1px solid var(--ferreto-border)!important;border-radius:var(--ferreto-radius)!important;box-shadow:0 6px 22px -10px rgba(0,0,0,.4)!important;-webkit-backdrop-filter:blur(14px)!important;backdrop-filter:blur(14px)!important;}

/* Playlist count badge */
#gdi-playlist-count{color:var(--ferreto-text-muted)!important;}

/* Player nav buttons (Anterior/Próxima) */
#gdi-player-nav .gdi-mode-btn{justify-content:center;}

/* Nota: marks sobre o player */
#gdi-note-marks .gdi-note-mark{border-color:var(--ferreto-bg-2)!important;}

/* Central de estudos (M22) — painel flutuante */
.gdi-fc-panel,.gdi-fc-root,[class*="gdi-fc"]{background:var(--ferreto-surface)!important;border-color:var(--ferreto-border-strong)!important;border-radius:var(--ferreto-radius)!important;-webkit-backdrop-filter:blur(18px)!important;backdrop-filter:blur(18px)!important;color:var(--ferreto-text)!important;}

/* ★FIX tema: Continue-card (M13) — override dos estilos inline hardcoded
   p/ acompanhar claro/escuro. Em tema claro o texto #f0f6fc/#8b949e era
   ilegível no fundo claro. */
#gdi-home-card{background:var(--ferreto-surface)!important;border:1px solid var(--ferreto-border)!important;-webkit-backdrop-filter:blur(14px)!important;backdrop-filter:blur(14px)!important;color:var(--ferreto-text)!important;}
#gdi-home-card *{color:inherit;}
#gdi-home-card [style*="color:#8b949e"],#gdi-home-card [style*="color: #8b949e"]{color:var(--ferreto-text-muted)!important;}
#gdi-home-card [style*="color:#f0f6fc"],#gdi-home-card [style*="color: #f0f6fc"]{color:var(--ferreto-text)!important;}
#gdi-home-card [style*="color:#7aa2ff"],#gdi-home-card [style*="color: #7aa2ff"]{color:var(--ferreto-primary)!important;}
#gdi-home-card .gdi-mode-btn{background:var(--ferreto-surface-2)!important;border:1px solid var(--ferreto-border)!important;color:var(--ferreto-text-muted)!important;}
#gdi-home-card .gdi-mode-btn:hover{background:var(--ferreto-surface-3)!important;color:var(--ferreto-primary)!important;}

/* ★FIX tema: Central de Estudos (M22) — override dos estilos inline
   hardcoded em renderPanel/renderStats/renderFlash. */
.gdi-central-box [style*="color:#8b949e"],.gdi-central-box [style*="color: #8b949e"]{color:var(--ferreto-text-muted)!important;}
.gdi-central-box [style*="color:#f0f6fc"],.gdi-central-box [style*="color: #f0f6fc"]{color:var(--ferreto-text)!important;}
.gdi-central-box [style*="color:#e6edf3"],.gdi-central-box [style*="color: #e6edf3"]{color:var(--ferreto-text)!important;}
.gdi-central-box [style*="color:#7aa2ff"],.gdi-central-box [style*="color: #7aa2ff"]{color:var(--ferreto-secondary)!important;}
.gdi-central-box [style*="background:rgba(255,255,255,.06)"],.gdi-central-box [style*="background: rgba(255, 255, 255, .06)"]{background:var(--ferreto-surface-2)!important;}
.gdi-central-box [style*="background:rgba(255,255,255,.07)"],.gdi-central-box [style*="background: rgba(255, 255, 255, .07)"]{background:var(--ferreto-surface-2)!important;}
.gdi-central-box [style*="background:rgba(255,255,255,.08)"],.gdi-central-box [style*="background: rgba(255, 255, 255, .08)"]{background:var(--ferreto-surface-3)!important;}
.gdi-central-box [style*="background:var(--ferreto-surface-3,rgba(255,255,255,.1))"],.gdi-central-box [style*="background: rgba(255, 255, 255, .1)"]{background:var(--ferreto-surface-3)!important;}
.gdi-central-box [style*="background:#1f6feb"]{background:var(--ferreto-grad)!important;}
.gdi-central-box [style*="border:1px solid #30363d"]{border-color:var(--ferreto-border)!important;}
.gdi-central-box [style*="border:1px solid rgba(255,255,255,.14)"]{border-color:var(--ferreto-border)!important;}
.gdi-central-box [style*="border-top:1px solid #21262d"]{border-top-color:var(--ferreto-border)!important;}
.gdi-central-box input{background:var(--ferreto-surface-2)!important;border:1px solid var(--ferreto-border)!important;color:var(--ferreto-text)!important;}
.gdi-central-box input:focus{border-color:var(--ferreto-primary)!important;box-shadow:0 0 0 3px var(--ferreto-glow)!important;outline:none!important;}
.gdi-central-box input::placeholder{color:var(--ferreto-text-faint)!important;}
.gdi-central-box .gdi-note{background:var(--ferreto-surface-3)!important;}
.gdi-central-box .gdi-note-del{color:var(--ferreto-text-muted)!important;}
.gdi-central-box .gdi-note-del:hover{color:#ff6b6b!important;}
.gdi-central-box .gdi-notes-empty{color:var(--ferreto-text-muted)!important;}

/* Scrollbar dos painéis internos */
#gdi-notes-list::-webkit-scrollbar,#gdi-debug-log::-webkit-scrollbar{width:8px;}
#gdi-notes-list::-webkit-scrollbar-thumb,#gdi-debug-log::-webkit-scrollbar-thumb{background:var(--ferreto-surface-3);border-radius:20px;}

`;document.head.appendChild(s);
  }

  // ── 4) Garante data-bs-theme em <html> p/ os tokens casarem ──
  if(!document.documentElement.getAttribute('data-bs-theme')){
    document.documentElement.setAttribute('data-bs-theme',localStorage.getItem('gdi-theme')||'dark');
  }

  // ── 5) FIX modal serrilhada (belt-and-suspenders do CSS) ──
  // Força repaint quando qualquer modal abre, acabando com o
  // "serrilhado até clicar" mesmo em browsers teimosos.
  document.addEventListener('shown.bs.modal',function(ev){
    const dlg=ev.target&&ev.target.querySelector&&ev.target.querySelector('.modal-dialog');
    if(!dlg)return;
    dlg.style.transform='translateZ(0)';
    void dlg.offsetHeight;
    setTimeout(function(){dlg.style.transform='';},0);
  },true);
})();

// ═══════════════════════════════════════════════════════════════
// M-PLAYER-GUARD: WATCHDOG CONTRA VÍDEOS TRAVADOS
// Camada de segurança extra além do fix v2.6 (que removeu o loop do
// MutationObserver). Mesmo sem o loop, alguns streams do Drive
// expiram/ficam lentos e o player entra em buffering infinito sem
// evento de erro — a aba trava. Este watchdog monitora o <video>:
// se 15s sem progresso, faz retry silencioso (v.load); se travar de
// novo, mostra overlay [Recarregar][Continuar aguardando]. Também
// resolve autoplay bloqueado (hint de ▶).
// ═══════════════════════════════════════════════════════════════
(function(){
  const STALL_MS=15000;
  const FIRST_PLAY_HINT_MS=3500;

  if(!document.getElementById('gdi-stall-style')){
    const s=document.createElement('style');s.id='gdi-stall-style';s.textContent=`
.gdi-stall-overlay{position:absolute;inset:0;background:rgba(7,9,16,.82);
  -webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);
  display:flex;align-items:center;justify-content:center;z-index:30;
  animation:ferreto-fade .2s ease;}
.gdi-stall-card{display:flex;flex-direction:column;align-items:center;gap:9px;text-align:center;padding:22px;max-width:340px;}
.gdi-stall-card .gdi-stall-ico{font-size:36px;color:var(--ferreto-primary,#ff8b9f);
  filter:drop-shadow(0 4px 14px rgba(255,139,159,.5));}
.gdi-stall-title{font-family:var(--ferreto-font-display,'Poppins',sans-serif);font-size:15px;font-weight:600;color:#fff;}
.gdi-stall-sub{font-size:12px;color:#9aa4b8;margin-bottom:8px;line-height:1.4;}
.gdi-stall-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.gdi-play-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:20;cursor:pointer;
  background:rgba(0,0,0,.28);opacity:0;transition:opacity .2s;pointer-events:none;}
.gdi-play-hint.show{opacity:1;pointer-events:auto;}
.gdi-play-hint .bi{font-size:54px;color:#fff;filter:drop-shadow(0 6px 20px rgba(0,0,0,.6));}
.gdi-play-hint small{position:absolute;bottom:18px;color:#fff;font-size:12px;opacity:.85;}
`;document.head.appendChild(s);
  }

  function attach(v){
    if(!v||v.__gdiGuard)return;v.__gdiGuard=true;
    const st={timer:null,retryUsed:false,lastT:v.currentTime||0,lastAt:Date.now(),
              overlay:null,hint:null,hintTimer:null};

    function clearTimer(){if(st.timer){clearTimeout(st.timer);st.timer=null;}}
    function clearOverlay(){if(st.overlay){st.overlay.remove();st.overlay=null;}}
    function arm(){clearTimer();st.timer=setTimeout(check,STALL_MS);}

    function check(){
      if(!v.parentNode){clearOverlay();clearTimer();return;}
      if(v.paused){arm();return;}
      const dt=(v.currentTime||0)-st.lastT;
      if(dt>0.1){
        st.lastT=v.currentTime||0;st.lastAt=Date.now();clearOverlay();arm();return;
      }
      if(Date.now()-st.lastAt>=STALL_MS){
        if(!st.retryUsed){
          st.retryUsed=true;
          console.warn('[GDI Player-Guard] vídeo parou — retry silencioso');
          try{
            const cur=v.currentTime;
            v.load();
            v.play().catch(function(){});
            const onCanPlay=function(){try{if(cur>0)v.currentTime=cur;}catch(_){}v.removeEventListener('loadedmetadata',onCanPlay);};
            v.addEventListener('loadedmetadata',onCanPlay,{once:true});
          }catch(_){}
          st.lastAt=Date.now();st.lastT=0;
          arm();
        }else{
          showOverlay();
        }
      }else{arm();}
    }

    function showOverlay(){
      if(st.overlay)return;
      const wrap=v.closest('.gdi-player-wrap')||v.parentNode;
      if(!wrap)return;
      st.overlay=document.createElement('div');
      st.overlay.className='gdi-stall-overlay';
      st.overlay.innerHTML=
        '<div class="gdi-stall-card">'+
          '<i class="bi bi-exclamation-triangle gdi-stall-ico"></i>'+
          '<div class="gdi-stall-title">O vídeo parece ter travado</div>'+
          '<div class="gdi-stall-sub">Sem progresso há '+Math.round(STALL_MS/1000)+'s. O stream do Drive pode ter expirado ou ficado lento.</div>'+
          '<div class="gdi-stall-actions">'+
            '<button class="gdi-btn gdi-btn-primary" data-act="reload"><i class="bi bi-arrow-clockwise"></i> Recarregar</button>'+
            '<button class="gdi-btn gdi-btn-ghost" data-act="wait">Continuar aguardando</button>'+
          '</div>'+
        '</div>';
      wrap.appendChild(st.overlay);
      st.overlay.querySelector('[data-act="reload"]').addEventListener('click',function(){
        clearOverlay();st.retryUsed=false;st.lastAt=Date.now();st.lastT=0;
        try{v.load();v.play().catch(function(){});}catch(_){}
        arm();
      });
      st.overlay.querySelector('[data-act="wait"]').addEventListener('click',function(){
        clearOverlay();st.lastAt=Date.now();arm();
      });
    }

    function showHint(){
      if(st.hint)return;
      const wrap=v.closest('.gdi-player-wrap')||v.parentNode;
      if(!wrap)return;
      st.hint=document.createElement('div');
      st.hint.className='gdi-play-hint';
      st.hint.innerHTML='<i class="bi bi-play-circle-fill"></i><small>Toque para iniciar</small>';
      st.hint.addEventListener('click',function(){
        v.muted=false;
        v.play().catch(function(){v.muted=true;v.play().catch(function(){});});
        hideHint();
      });
      wrap.appendChild(st.hint);
      requestAnimationFrame(function(){st.hint&&st.hint.classList.add('show');});
    }
    function hideHint(){if(st.hint){st.hint.remove();st.hint=null;}clearTimeout(st.hintTimer);}
    function armHint(){clearTimeout(st.hintTimer);st.hintTimer=setTimeout(function(){
      if(v.paused&&v.readyState<3)showHint();
    },FIRST_PLAY_HINT_MS);}

    v.addEventListener('timeupdate',function(){
      st.lastT=v.currentTime||0;st.lastAt=Date.now();if(st.overlay)clearOverlay();hideHint();
    });
    v.addEventListener('waiting',function(){arm();});
    v.addEventListener('playing',function(){st.lastAt=Date.now();if(st.overlay)clearOverlay();hideHint();arm();});
    v.addEventListener('stalled',function(){arm();});
    v.addEventListener('canplay',function(){hideHint();});
    v.addEventListener('play',function(){arm();armHint();});
    v.addEventListener('pause',function(){clearTimer();});
    v.addEventListener('error',function(){
      console.error('[GDI Player-Guard] erro de mídia',v.error);
      if(!st.retryUsed){st.retryUsed=true;try{v.load();v.play().catch(function(){});}catch(_){}arm();}
      else{showOverlay();}
    });
    v.addEventListener('ended',function(){clearTimer();clearOverlay();});

    arm();armHint();
    console.log('[GDI Player-Guard] monitorando vídeo');
  }

  Bus.onGlobal('media:ready',function(d){
    if(d&&d.type==='video'&&d.el)attach(d.el);
  });

  window.GDI_MODULES.push({name:'player-guard',init:function(){
    try{
      const v=document.querySelector('.gdi-player-wrap video');
      if(v)attach(v);
    }catch(_){}
  }});
})();

// ═══════════════════════════════════════════════════════════════
// M-AI: WIDGET DA MEGGY 🐩 — poodle tutora de estudos
// Botão flutuante + painel de chat. PRIORIDADE de backend:
//   1) IA do navegador (Chrome Prompt API / Gemini Nano via
//      ai.languageModel — ativada por extensões Chrome). 100% local,
//      sem servidor, sem custo, funciona offline após download.
//   2) POST /api/ai (worker.js → CF Workers AI ou OpenAI-compat).
// Conversa persistida em sessionStorage. UI no <html> (fora do
// body) para sobreviver a trocas de página. Estilo Ferreto.
// ═══════════════════════════════════════════════════════════════
(function(){
  if(window.__gdiAiWidget)return;window.__gdiAiWidget=true;

  const MEGGY_NAME='Meggy';
  const MEGGY_AVATAR='🐩';
  const MEGGY_TAG='— a poodle tutora';
  const ISA_SYS='Você é a Meggy — uma poodle tutora de estudos brasileira, ' +
    'amigável, calorosa e didática (mascote do projeto, sempre acompanhada do emoji 🐩). ' +
    'Acompanha alunos em uma plataforma de videoaulas (Google Drive Index). Responda em ' +
    'português, de forma clara e objetiva. Ajude com dúvidas das aulas, resumos, ' +
    'explicações e organização dos estudos. Se não souber, diga. Seja motivadora e ' +
    'acolhedora. Use Markdown quando ajudar.';

  // CSS
  if(!document.getElementById('gdi-ai-style')){
    const s=document.createElement('style');s.id='gdi-ai-style';s.textContent=`
#gdi-ai-fab{position:fixed;bottom:20px;right:20px;z-index:10001;width:56px;height:56px;border-radius:50%;
  border:0;cursor:pointer;background:linear-gradient(135deg,#ff8b9f 0%,#c026d3 55%,#5ddeda 130%);
  color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;
  box-shadow:0 8px 28px -6px rgba(255,139,159,.5),0 0 0 1px rgba(255,255,255,.12);
  transition:transform .18s,box-shadow .18s;}
#gdi-ai-fab:hover{transform:scale(1.08) translateY(-2px);box-shadow:0 12px 36px -6px rgba(255,139,159,.6);}
#gdi-ai-fab .gdi-ai-fab-ico{font-size:26px;line-height:1;}
#gdi-ai-fab-badge{position:absolute;top:-2px;right:-2px;width:16px;height:16px;border-radius:50%;
  background:#5ddeda;border:2px solid var(--ferreto-bg,#070910);display:none;}
#gdi-ai-fab-badge.show{display:block;animation:gdi-ai-pulse 1.6s ease infinite;}
@keyframes gdi-ai-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.25);}}
#gdi-ai-panel{position:fixed;bottom:88px;right:20px;z-index:10001;width:380px;max-width:calc(100vw - 32px);
  height:540px;max-height:calc(100vh - 120px);display:none;flex-direction:column;
  background:var(--ferreto-surface,rgba(22,27,38,.92));
  -webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);
  border:1px solid var(--ferreto-border-strong,rgba(255,255,255,.16));
  border-radius:18px;box-shadow:0 20px 60px -12px rgba(0,0,0,.6);
  overflow:hidden;transform-origin:bottom right;animation:gdi-ai-in .22s ease;font-family:var(--ferreto-font-body,'Rubik',sans-serif);}
@keyframes gdi-ai-in{from{opacity:0;transform:scale(.92) translateY(12px);}to{opacity:1;transform:none;}}
#gdi-ai-panel.open{display:flex;}
#gdi-ai-head{display:flex;align-items:center;gap:10px;padding:14px 16px;
  background:linear-gradient(135deg,rgba(255,139,159,.18),rgba(93,222,218,.1));
  border-bottom:1px solid var(--ferreto-border,rgba(255,255,255,.09));}
#gdi-ai-head .gdi-ai-avatar{width:38px;height:38px;border-radius:50%;flex:none;
  background:linear-gradient(135deg,#ff8b9f,#c026d3);display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:22px;line-height:1;
  box-shadow:0 0 0 2px rgba(255,255,255,.1) inset;}
#gdi-ai-head .gdi-ai-info{flex:1;min-width:0;}
#gdi-ai-head .gdi-ai-name{font-family:var(--ferreto-font-display,'Poppins',sans-serif);font-size:15px;font-weight:700;color:var(--ferreto-text,#f3f5fa);line-height:1.1;}
#gdi-ai-head .gdi-ai-name .gdi-ai-tag{font-size:10px;font-weight:500;color:var(--ferreto-secondary,#5ddeda);margin-left:5px;letter-spacing:.02em;}
#gdi-ai-head .gdi-ai-status{font-size:11px;color:var(--ferreto-text-muted,#9aa4b8);display:flex;align-items:center;gap:5px;margin-top:2px;}
#gdi-ai-head .gdi-ai-dot{width:7px;height:7px;border-radius:50%;background:#3fb950;}
#gdi-ai-head .gdi-ai-dot.local{background:#5ddeda;}
#gdi-ai-close{background:none;border:0;color:var(--ferreto-text-muted,#9aa4b8);font-size:18px;cursor:pointer;padding:4px;border-radius:8px;}
#gdi-ai-close:hover{background:var(--ferreto-surface-3,rgba(255,255,255,.08));color:var(--ferreto-text,#f3f5fa);}
#gdi-ai-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
#gdi-ai-body::-webkit-scrollbar{width:6px;}
#gdi-ai-body::-webkit-scrollbar-thumb{background:var(--ferreto-surface-3,rgba(255,255,255,.08));border-radius:20px;}
.gdi-ai-msg{display:flex;gap:8px;max-width:88%;animation:gdi-ai-in .2s ease;}
.gdi-ai-msg.user{align-self:flex-end;flex-direction:row-reverse;}
.gdi-ai-msg .gdi-ai-bubble{padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;word-break:break-word;}
.gdi-ai-msg.assistant .gdi-ai-bubble{background:var(--ferreto-surface-3,rgba(255,255,255,.08));color:var(--ferreto-text,#f3f5fa);border-bottom-left-radius:4px;}
.gdi-ai-msg.user .gdi-ai-bubble{background:linear-gradient(135deg,#ff8b9f,#c026d3);color:#fff;border-bottom-right-radius:4px;}
.gdi-ai-msg .gdi-ai-bubble p{margin:0 0 6px;} .gdi-ai-msg .gdi-ai-bubble p:last-child{margin:0;}
.gdi-ai-msg .gdi-ai-bubble code{background:rgba(0,0,0,.25);padding:1px 5px;border-radius:4px;font-size:12px;}
.gdi-ai-msg .gdi-ai-bubble pre{background:rgba(0,0,0,.3);padding:8px;border-radius:8px;overflow-x:auto;margin:6px 0;}
.gdi-ai-typing{display:flex;gap:4px;padding:4px 0;}
.gdi-ai-typing span{width:7px;height:7px;border-radius:50%;background:var(--ferreto-text-muted,#9aa4b8);animation:gdi-ai-typ 1.2s ease infinite;}
.gdi-ai-typing span:nth-child(2){animation-delay:.2s;} .gdi-ai-typing span:nth-child(3){animation-delay:.4s;}
@keyframes gdi-ai-typ{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-4px);}}
#gdi-ai-input-wrap{display:flex;gap:8px;padding:12px;border-top:1px solid var(--ferreto-border,rgba(255,255,255,.09));background:var(--ferreto-surface-2,rgba(255,255,255,.045));}
#gdi-ai-input{flex:1;background:var(--ferreto-surface-3,rgba(255,255,255,.08));border:1px solid var(--ferreto-border,rgba(255,255,255,.09));
  border-radius:999px;padding:10px 14px;color:var(--ferreto-text,#f3f5fa);font-size:13.5px;outline:none;font-family:inherit;transition:.15s;}
#gdi-ai-input:focus{border-color:var(--ferreto-primary,#ff8b9f);box-shadow:0 0 0 3px rgba(255,139,159,.25);}
#gdi-ai-input::placeholder{color:var(--ferreto-text-faint,#6b7488);}
#gdi-ai-send{width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;flex:none;
  background:linear-gradient(135deg,#ff8b9f,#c026d3);color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;transition:.15s;}
#gdi-ai-send:hover{filter:brightness(1.1);transform:scale(1.05);}
#gdi-ai-send:disabled{opacity:.5;cursor:default;transform:none;}
.gdi-ai-err{font-size:12px;color:#ff8b8b;text-align:center;padding:8px;margin:0 4px;}
.gdi-ai-provider{font-size:10px;color:var(--ferreto-text-faint,#6b7488);text-align:center;padding:2px 0 6px;letter-spacing:.02em;}
.gdi-ai-provider b{color:var(--ferreto-secondary,#5ddeda);}
@media(max-width:480px){#gdi-ai-panel{right:8px;left:8px;width:auto;bottom:80px;height:calc(100vh - 160px);}}
`;document.documentElement.appendChild(s);
  }

  const STORE='gdi-ai-chat';
  let messages=[];
  try{messages=JSON.parse(sessionStorage.getItem(STORE))||[];}catch(_){}

  function save(){try{sessionStorage.setItem(STORE,JSON.stringify(messages.slice(-20)));}catch(_){}}

  function renderMd(txt){
    if(window.marked){try{return marked.parse(txt);}catch(_){}}
    return txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  // ── Detecção da IA do navegador ──
  // Chrome 127+ com "Prompt API for Gemini Nano" habilitado expõe
  // `ai.languageModel`. Extensões Chrome ativam/desativam isso.
  // Também tenta o alias antigo `window.ai`.
  let _browserAIState='unknown'; // 'unknown' | 'ready' | 'download' | 'no'
  let _browserSession=null;
  let _providerLabel='verificando…';

  async function detectBrowserAI(){
    try{
      const ai=(window.ai&&window.ai.languageModel)?window.ai.languageModel:(window.LanguageModel);
      if(ai&&typeof ai.capabilities==='function'){
        const caps=await ai.capabilities();
        if(caps&&caps.available==='readily'){_browserAIState='ready';return 'ready';}
        if(caps&&caps.available==='after-download'){_browserAIState='download';return 'download';}
        _browserAIState='no';return 'no';
      }
    }catch(_){}
    _browserAIState='no';return 'no';
  }

  async function getBrowserSession(){
    if(_browserSession)return _browserSession;
    try{
      const ai=(window.ai&&window.ai.languageModel)?window.ai.languageModel:(window.LanguageModel);
      if(!ai)return null;
      _browserSession=await ai.create({
        systemPrompt:ISA_SYS,
        temperature:0.7,
        topK:3
      });
      return _browserSession;
    }catch(e){console.warn('[Meggy] não pôde criar sessão do navegador:',e);_browserSession=null;return null;}
  }

  async function callBrowserAI(history){
    const sess=await getBrowserSession();
    if(!sess)return null;
    // Prompt API mantém o contexto internamente; enviamos só a última
    // mensagem do usuário (a sessão lembra as anteriores).
    const lastUser=[...history].reverse().find(m=>m.role==='user');
    if(!lastUser)return null;
    const out=await sess.prompt(lastUser.content);
    return out||null;
  }

  function updateStatus(){
    const dot=panel.querySelector('.gdi-ai-dot');
    const st=panel.querySelector('.gdi-ai-status');
    if(!dot||!st)return;
    if(_browserAIState==='ready'){dot.classList.add('local');st.innerHTML='<span class="gdi-ai-dot local"></span> Meggy · IA do navegador · 100% local';_providerLabel='IA do navegador <b>(Chrome/Gemini Nano — local)</b>';}
    else if(_browserAIState==='download'){dot.classList.remove('local');st.innerHTML='<span class="gdi-ai-dot"></span> Meggy · baixando modelo local…';_providerLabel='baixando modelo do navegador…';}
    else{dot.classList.remove('local');st.innerHTML='<span class="gdi-ai-dot"></span> Meggy · online';const sl=serverLabel();_providerLabel=sl.label;}
    const pv=panel.querySelector('.gdi-ai-provider');
    if(pv)pv.innerHTML='via '+_providerLabel;
  }

  // UI no <html> (fora do body) — sobrevive a trocas de página
  const root=GDI_ROOT();
  const fab=document.createElement('button');
  fab.id='gdi-ai-fab';fab.title='Meggy 🐩 · sua poodle tutora de estudos';
  fab.innerHTML='<span class="gdi-ai-fab-ico">🐩</span><span id="gdi-ai-fab-badge"></span>';
  root.appendChild(fab);

  const panel=document.createElement('div');
  panel.id='gdi-ai-panel';
  panel.innerHTML=`
    <div id="gdi-ai-head">
      <div class="gdi-ai-avatar">${MEGGY_AVATAR}</div>
      <div class="gdi-ai-info">
        <div class="gdi-ai-name">${MEGGY_NAME}<span class="gdi-ai-tag">${MEGGY_TAG}</span></div>
        <div class="gdi-ai-status"><span class="gdi-ai-dot"></span> verificando…</div>
      </div>
      <button id="gdi-ai-close" title="Fechar"><i class="bi bi-x-lg"></i></button>
    </div>
    <div id="gdi-ai-body"></div>
    <div class="gdi-ai-provider"></div>
    <div id="gdi-ai-input-wrap">
      <input id="gdi-ai-input" type="text" placeholder="Pergunte à Meggy 🐩 sobre a aula, peça um resumo..." autocomplete="off">
      <button id="gdi-ai-send" title="Enviar"><i class="bi bi-send-fill"></i></button>
    </div>`;
  root.appendChild(panel);

  const body=panel.querySelector('#gdi-ai-body');
  const input=panel.querySelector('#gdi-ai-input');
  const sendBtn=panel.querySelector('#gdi-ai-send');
  const badge=panel.querySelector('#gdi-ai-fab-badge');

  function addMsg(role,text){
    const m={role,text};
    messages.push(m);save();
    const el=document.createElement('div');
    el.className='gdi-ai-msg '+(role==='user'?'user':'assistant');
    el.innerHTML='<div class="gdi-ai-bubble">'+(role==='user'?esc(text):renderMd(text))+'</div>';
    body.appendChild(el);body.scrollTop=body.scrollHeight;
    return el;
  }
  function renderHistory(){
    body.innerHTML='';
    if(!messages.length){
      addMsg('assistant','Oi! Sou a **Meggy** 🐩 — sua poodle tutora de estudos.\n\nPosso ajudar com:\n- Explicar um tema da aula\n- Fazer um resumo\n- Tirar dúvidas\n- Sugerir um plano de estudos\n\nO que você precisa hoje? 🐾');
      messages.pop();save(); // saudação não conta no histórico
      return;
    }
    messages.forEach(m=>{
      const el=document.createElement('div');
      el.className='gdi-ai-msg '+(m.role==='user'?'user':'assistant');
      el.innerHTML='<div class="gdi-ai-bubble">'+(m.role==='user'?esc(m.text):renderMd(m.text))+'</div>';
      body.appendChild(el);
    });
    body.scrollTop=body.scrollHeight;
  }

  let typingEl=null;
  function showTyping(){
    typingEl=document.createElement('div');typingEl.className='gdi-ai-msg assistant';
    typingEl.innerHTML='<div class="gdi-ai-bubble"><div class="gdi-ai-typing"><span></span><span></span><span></span></div></div>';
    body.appendChild(typingEl);body.scrollTop=body.scrollHeight;
  }
  function hideTyping(){if(typingEl){typingEl.remove();typingEl=null;}}

  // ── BANCO DE MEMÓRIA da Meggy ──
  // A Meggy mantém um perfil do aluno e aprende com as interações.
  // Persistido em localStorage + enviado como contexto nas conversas.
  const MEMORY_KEY='gdi-meggy-memory-v1';
  const _meggyLsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}};
  const _meggyLsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  function loadMemory(){
    return _meggyLsGet(MEMORY_KEY,{interactions:0,topics:[],weaknesses:[],preferences:{},lastLessons:[]});
  }
  function saveMemory(mem){_meggyLsSet(MEMORY_KEY,mem);}
  function updateMemory(topic,context){
    const mem=loadMemory();
    mem.interactions=(mem.interactions||0)+1;
    if(topic&&!mem.topics.includes(topic)){
      mem.topics.push(topic);
      if(mem.topics.length>50)mem.topics.shift();
    }
    if(topic){
      mem.lastLessons=mem.lastLessons.filter(l=>l!==topic);
      mem.lastLessons.unshift(topic);
      if(mem.lastLessons.length>10)mem.lastLessons.pop();
    }
    try{
      const qs=_meggyLsGet('gdi-questions-v1',[]);
      const srs=_meggyLsGet('gdi-q-srs-v1',{});
      const bySubject={};
      qs.forEach(q=>{
        const s=q.subject||'Geral';
        if(!bySubject[s])bySubject[s]={total:0,correct:0};
        bySubject[s].total++;
        if(srs[q.id]&&srs[q.id].box>0)bySubject[s].correct++;
      });
      mem.weaknesses=Object.entries(bySubject)
        .filter(([,v])=>v.total>=2&&(v.correct/v.total)<0.5)
        .map(([k,v])=>({subject:k,acc:Math.round(v.correct/v.total*100)}))
        .slice(0,5);
    }catch(_){}
    saveMemory(mem);
    return mem;
  }
  function buildMemoryContext(){
    const mem=loadMemory();
    let ctx='';
    if(mem.interactions>0)ctx+=`Aluno tem ${mem.interactions} interações com a Meggy. `;
    if(mem.lastLessons&&mem.lastLessons.length)ctx+=`Últimas aulas estudadas: ${mem.lastLessons.slice(0,5).join(', ')}. `;
    if(mem.weaknesses&&mem.weaknesses.length)ctx+=`Pontos fracos: ${mem.weaknesses.map(w=>w.subject+' ('+w.acc+'%)').join(', ')}. `;
    if(mem.topics&&mem.topics.length>3)ctx+=`Já estudou ${mem.topics.length} tópicos diferentes. `;
    return ctx;
  }

  let busy=false;
  async function send(){
    const txt=input.value.trim();if(!txt||busy)return;
    busy=true;sendBtn.disabled=true;input.value='';
    addMsg('user',txt);
    showTyping();

    // histórico para enviar (role/content) + contexto de memória
    const hist=messages.filter(m=>m.role!=='system').slice(-8).map(m=>({role:m.role,content:m.text}));
    // adiciona contexto de memória na primeira mensagem do histórico
    const memCtx=buildMemoryContext();
    if(memCtx&&hist.length>0){
      hist[0]={role:'assistant',content:'Contexto do aluno: '+memCtx};
    }

    let response=null,usedLocal=false;
    // 1) tenta IA do navegador
    if(_browserAIState==='ready'){
      try{
        response=await callBrowserAI(hist);
        if(response)usedLocal=true;
      }catch(e){console.warn('[Meggy] IA do navegador falhou, caindo p/ servidor:',e);response=null;}
    }
    // 2) fallback servidor /api/ai
    if(!response){
      try{
        const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({message:txt,messages:hist})});
        const data=await r.json();
        hideTyping();
        if(data.ok&&data.response){response=data.response;}
        else{
          const errEl=document.createElement('div');errEl.className='gdi-ai-err';
          errEl.textContent=data.error||'Não consegui responder agora. Tente novamente.';
          body.appendChild(errEl);body.scrollTop=body.scrollHeight;
          setTimeout(()=>errEl.remove(),5000);
          busy=false;sendBtn.disabled=false;input.focus();
          return;
        }
      }catch(e){
        hideTyping();
        const errEl=document.createElement('div');errEl.className='gdi-ai-err';
        errEl.textContent='Erro de conexão. Verifique sua internet.';
        body.appendChild(errEl);body.scrollTop=body.scrollHeight;
        setTimeout(()=>errEl.remove(),5000);
        busy=false;sendBtn.disabled=false;input.focus();
        return;
      }
    }
    hideTyping();
    addMsg('assistant',response);
    // ★ atualiza banco de memória com a interação
    updateMemory(undefined,{question:txt,response:response});
    if(usedLocal)updateStatus(); // confirma que usou local
    busy=false;sendBtn.disabled=false;input.focus();
  }

  function toggle(){
    const open=panel.classList.toggle('open');
    try{sessionStorage.setItem('gdi-meggy-open',open?'1':'0');}catch(_){}
    if(open){badge.classList.remove('show');renderHistory();updateStatus();setTimeout(()=>input.focus(),100);}
  }
  fab.addEventListener('click',toggle);
  panel.querySelector('#gdi-ai-close').addEventListener('click',()=>{panel.classList.remove('open');try{sessionStorage.setItem('gdi-meggy-open','0');}catch(_){}});
  sendBtn.addEventListener('click',send);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});

  // ★ Meggy persiste entre trocas de página — reabre se estava aberta
  // O widget está em GDI_ROOT() (documentElement) que NÃO é recriado
  // pelo SPA. As mensagens ficam em sessionStorage. Só precisamos
  // restaurar o estado aberto/fechado.
  Bus.onGlobal('page:change',()=>{
    // re-renderiza o histórico se o painel estiver aberto
    if(panel.classList.contains('open')){
      renderHistory();
      updateStatus();
    }
    // atualiza memória com a aula atual
    const lesson=document.querySelector('.gdi-file-header-name');
    if(lesson&&lesson.textContent){
      updateMemory(lesson.textContent.trim());
    }
  });
  // restaura estado aberto ao carregar
  try{
    if(sessionStorage.getItem('gdi-meggy-open')==='1'){
      setTimeout(()=>{panel.classList.add('open');renderHistory();updateStatus();},500);
    }
  }catch(_){}

  // ── Ativação condicional ──
  // O botão 💖 só aparece se houver IA disponível: (1) IA do navegador
  // pronta, OU (2) /api/ai/status retornar enabled=true. Caso contrário
  // o widget fica oculto (display:none) mas TODO o código permanece
  // intacto — basta configurar ZHIPU_API_KEY no Cloudflare para ativar.
  function hideWidget(){fab.style.display='none';panel.style.display='none';}
  function showWidget(){fab.style.display='';panel.style.display='';}

  let _serverEnabled=null; // null=desconhecido, true/false
  let _serverProvider=null;
  function checkServerStatus(){
    return fetch('/api/ai/status',{cache:'no-store'}).then(r=>r.ok?r.json():{enabled:false}).then(d=>{ _serverEnabled=!!(d&&d.enabled); _serverProvider=(d&&d.provider)||null; return _serverEnabled; }).catch(()=>{ _serverEnabled=false; return false; });
  }
  function serverLabel(){
    if(_serverProvider==='nvidia-nim')return {name:'NVIDIA NIM',label:'NVIDIA NIM <b>(LLaMA · /api/ai)</b>'};
    if(_serverProvider==='zhipu-ai')return {name:'智谱AI (Zhipu)',label:'智谱AI <b>(Zhipu GLM · /api/ai)</b>'};
    if(_serverProvider==='cf-workers-ai')return {name:'CF Workers AI',label:'Cloudflare <b>(Workers AI · /api/ai)</b>'};
    if(_serverProvider==='openai')return {name:'OpenAI',label:'OpenAI <b>(/api/ai)</b>'};
    return {name:'智谱AI (Zhipu)',label:'智谱AI <b>(Zhipu GLM · /api/ai)</b>'};
  }

  // detecta a IA do navegador ao carregar (1×) + status do servidor
  Promise.all([
    detectBrowserAI(),
    checkServerStatus()
  ]).then(function(){
    updateStatus();
    const browserReady=(_browserAIState==='ready');
    const serverOk=!!_serverEnabled;
    console.log('[Meggy] IA do navegador:',_browserAIState,'| servidor habilitado:',serverOk);
    if(browserReady||serverOk){
      showWidget();
    }else{
      // Nenhum backend disponível — esconde o botão mas mantém o código.
      // Ativa automaticamente quando o usuário configurar ZHIPU_API_KEY.
      hideWidget();
      console.log('[Meggy] widget oculto — configure ZHIPU_API_KEY no Cloudflare para ativar');
    }
  });

  // badge de novidade após 8s se nunca abriu (só se visível)
  if(!sessionStorage.getItem('gdi-ai-seen')){
    setTimeout(()=>{if(fab.style.display!=='none'&&!panel.classList.contains('open'))badge.classList.add('show');},8000);
  }
  fab.addEventListener('click',()=>{sessionStorage.setItem('gdi-ai-seen','1');},{once:true});

  console.log('[GDI Extras] M-AI widget Meggy 🐩 — poodle tutora ativo');
})();