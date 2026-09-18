// ═══════════════════════════════════════════════════════════════
// gdi-study.js — Central de Estudos + Estudo Ativo + Visual
// 
// Módulos:
//   • M22: Central de Estudos (painel full-screen com 12 abas:
//     Cursos, Questões, Simulado, Cronograma, Revisões, Resumos,
//     Provas, Redação, Radar, Estatísticas, Flashcards, Maratona)
//   • M23: Estudo Ativo (banco de questões, simulado, cronograma SRS)
//   • M24: Provas anteriores, Redação, Radar de Fracos
//   • BlackTie: tema visual (fontes, cores, override de estilos)
//   • M-PLAYER-GUARD: watchdog contra vídeos travados
//
// Depende de: gdi-core.js, gdi-meggy.js (para extractPdfText)
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
  function closePanel(){
    FC.active=false;
    // ★ limpa timer do simulado se ativo (evita salvar simulado fantasma)
    const body=panel&&panel.querySelector('#gdi-central-body');
    if(body&&body.__simTimer){clearInterval(body.__simTimer);body.__simTimer=null;}
    if(panel)panel.style.display='none';
  }
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
        <button class="gdi-mode-btn" id="gdi-central-x" style="padding:4px 10px;margin-left:auto;order:99;" title="Fechar (Esc)">\u2715</button>
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
        <button class="gdi-central-tab ${tab==='subjects'?'active':''}" data-t="subjects">\ud83d\udcdd Mat\u00e9rias</button>
        <button class="gdi-central-tab ${tab==='trails'?'active':''}" data-t="trails">\ud83c\udfaft Trilhas</button>
        <button class="gdi-central-tab ${tab==='achievements'?'active':''}" data-t="achievements">\ud83c\udfc6 Conquistas</button>
        <button class="gdi-central-tab ${tab==='mar'?'active':''}" data-t="mar">\ud83d\ude80 Maratona</button>
      </div>
      <div class="gdi-central-body" id="gdi-central-body"></div>
    </div>`;
    panel.querySelector('#gdi-central-x').onclick=closePanel;
    panel.querySelector('#gdi-goal-set').addEventListener('change',e=>{
      const v=Math.max(10,Math.min(480,parseInt(e.target.value,10)||60));
      lsSet(LS_GOAL,v);renderPanel();
    });
    panel.querySelectorAll('.gdi-central-tab').forEach(b=>b.onclick=()=>{
      // ★ limpa timer do simulado ao trocar de aba
      const body=panel.querySelector('#gdi-central-body');
      if(body&&body.__simTimer){clearInterval(body.__simTimer);body.__simTimer=null;}
      tab=b.dataset.t;FC.active=false;renderPanel();
    });
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
    else if(tab==='subjects')renderSubjects(body);
    else if(tab==='trails')renderTrails(body);
    else if(tab==='achievements')renderAchievements(body);
    else renderMarathon(body);
  }

  // ★ Aba "Trilhas" — agrupar cursos em uma meta
  function renderTrails(box){
    if(!window.gdiTrails){
      box.innerHTML='<div class="gdi-notes-empty">Sistema de trilhas indisponível.</div>';
      return;
    }
    const trails=window.gdiTrails.get();
    box.innerHTML=`<div style="max-width:760px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <b style="color:var(--ferreto-text,#f0f6fc);font-size:15px;">Trilhas de Estudo</b>
          <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin:4px 0 0;">Agrupe cursos e matérias em uma meta. Ex: "Auditor Fiscal" = Direito Tributário + Contabilidade + Português.</p>
        </div>
        <button id="gdi-trail-add" class="gdi-btn gdi-btn-primary" style="font-size:12px;"><i class="bi bi-plus-lg"></i> Nova trilha</button>
      </div>
      <div id="gdi-trail-list" style="display:flex;flex-direction:column;gap:10px;"></div>
    </div>`;
    const list=box.querySelector('#gdi-trail-list');
    function drawList(){
      const all=window.gdiTrails.get();
      if(!all.length){
        list.innerHTML='<div class="gdi-notes-empty" style="padding:40px;text-align:center;"><i class="bi bi-signpost-2" style="font-size:36px;display:block;margin-bottom:10px;color:var(--ferreto-text-faint,#6b7488);"></i>Nenhuma trilha criada.<br><span style="font-size:12px;">Clique em "Nova trilha" para organizar seus cursos em uma meta.</span></div>';
        return;
      }
      list.innerHTML='';
      all.forEach(t=>{
        const total=t.courses?t.courses.length:0;
        const el=document.createElement('div');
        el.className='gdi-note';
        el.style.cssText='display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer;';
        el.innerHTML=`
          <span style="font-size:28px;flex:none;">${t.icon||'🎯'}</span>
          <div style="flex:1;min-width:0;">
            <b style="color:var(--ferreto-text,#f0f6fc);font-size:14px;">${escHtml(t.name)}</b>
            ${t.description?`<small style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;display:block;margin-top:2px;">${escHtml(t.description)}</small>`:''}
            <small style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${total} curso${total!==1?'s':''} · meta: ${t.goal||'—'} dias</small>
          </div>
          <button class="gdi-mode-btn gdi-trail-edit" data-id="${escHtml(t.id)}" style="font-size:11px;padding:5px 10px;"><i class="bi bi-pencil"></i></button>
          <button class="gdi-mode-btn gdi-trail-del" data-id="${escHtml(t.id)}" style="font-size:11px;padding:5px 10px;color:#ff8b8b;"><i class="bi bi-trash"></i></button>
        `;
        list.appendChild(el);
      });
      list.querySelectorAll('.gdi-trail-edit').forEach(b=>b.onclick=()=>editTrail(b.dataset.id,box,drawList));
      list.querySelectorAll('.gdi-trail-del').forEach(b=>b.onclick=async ()=>{
        const tr=window.gdiTrails.get().find(x=>x.id===b.dataset.id);
        if(!tr)return;
        const ok=await window.gdiModal({
          title:'Excluir trilha',
          message:'Excluir "'+tr.name+'"? Os cursos vinculados NÃO serão excluídos.',
          confirmText:'Excluir',
          cancelText:'Cancelar',
          danger:true
        });
        if(ok){
          window.gdiTrails.delete(b.dataset.id);
          showToast('Trilha excluída');
          drawList();
        }
      });
    }
    drawList();
    box.querySelector('#gdi-trail-add').onclick=()=>editTrail(null,box,drawList);
  }
  function editTrail(id,box,afterSave){
    const existing=id?window.gdiTrails.get().find(t=>t.id===id):null;
    const icons=['🎯','🏆','🚀','⭐','🎓','💼','🏛️','⚖️','📊','🔬','🌍','💡'];
    const overlay=document.createElement('div');
    overlay.className='gdi-modal-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100002;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML=`<div style="background:var(--ferreto-bg-2,#0d1119);border:1px solid var(--ferreto-border,#21262d);border-radius:14px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.6);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--ferreto-border,#21262d);position:sticky;top:0;background:var(--ferreto-bg-2,#0d1119);z-index:1;">
        <b style="color:var(--ferreto-text,#f0f6fc);font-size:15px;font-family:var(--ferreto-font-display,'Poppins',sans-serif);">${existing?'Editar trilha':'Nova trilha'}</b>
        <button id="gdi-trail-x" style="background:transparent;border:0;color:var(--ferreto-text-muted,#8b949e);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Nome *</label>
          <input id="gdi-trail-name" placeholder="Ex: Auditor Fiscal 2026" value="${existing?escHtml(existing.name):''}" style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;">
        </div>
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Descrição (opcional)</label>
          <input id="gdi-trail-desc" placeholder="Ex: Concurso para Receita Federal" value="${existing?escHtml(existing.description||''):''}" style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;">
        </div>
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Ícone</label>
          <div id="gdi-trail-icons" style="display:flex;gap:6px;flex-wrap:wrap;">${icons.map(ic=>`<button class="gdi-trail-ic" data-ic="${ic}" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid ${existing&&existing.icon===ic?'var(--ferreto-primary,#ff8b9f)':'var(--ferreto-border,#30363d)'};border-radius:8px;padding:8px 10px;font-size:18px;cursor:pointer;">${ic}</button>`).join('')}</div>
        </div>
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Meta (dias para terminar)</label>
          <input id="gdi-trail-goal" type="number" min="1" max="3650" value="${existing?(existing.goal||90):90}" style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 20px 16px;position:sticky;bottom:0;background:var(--ferreto-bg-2,#0d1119);">
        <button id="gdi-trail-cancel" class="gdi-mode-btn" style="font-size:13px;">Cancelar</button>
        <button id="gdi-trail-save" style="font-size:13px;padding:8px 16px;border-radius:8px;border:0;cursor:pointer;font-weight:600;background:var(--ferreto-grad);color:#fff;">${existing?'Salvar':'Criar trilha'}</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    let selIcon=existing?existing.icon:icons[0];
    overlay.querySelectorAll('.gdi-trail-ic').forEach(b=>b.onclick=()=>{
      overlay.querySelectorAll('.gdi-trail-ic').forEach(x=>x.style.borderColor='var(--ferreto-border,#30363d)');
      b.style.borderColor='var(--ferreto-primary,#ff8b9f)';
      selIcon=b.dataset.ic;
    });
    const close=()=>overlay.remove();
    overlay.querySelector('#gdi-trail-x').onclick=close;
    overlay.querySelector('#gdi-trail-cancel').onclick=close;
    overlay.onclick=(e)=>{if(e.target===overlay)close();};
    overlay.querySelector('#gdi-trail-save').onclick=()=>{
      const name=overlay.querySelector('#gdi-trail-name').value.trim();
      if(!name){showToast('Digite o nome da trilha');return;}
      const desc=overlay.querySelector('#gdi-trail-desc').value.trim();
      const goal=parseInt(overlay.querySelector('#gdi-trail-goal').value)||90;
      window.gdiTrails.save({
        id:existing?existing.id:('trail-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)),
        name,description:desc,icon:selIcon,goal,
        courses:existing?existing.courses:[],
        createdAt:existing?existing.createdAt:Date.now()
      });
      close();
      showToast(existing?'Trilha atualizada':'Trilha criada!');
      if(afterSave)afterSave();
    };
    setTimeout(()=>overlay.querySelector('#gdi-trail-name').focus(),50);
  }

  // ★ Aba "Conquistas" — gamificação
  function renderAchievements(box){
    if(!window.gdiAchievements){
      box.innerHTML='<div class="gdi-notes-empty">Sistema de conquistas indisponível.</div>';
      return;
    }
    const unlocked=window.gdiAchievements.getUnlocked();
    const defs=window.gdiAchievements.defs();
    const total=defs.length;
    const pct=Math.round(unlocked.length/total*100);
    box.innerHTML=`<div style="max-width:760px;">
      <div style="text-align:center;margin-bottom:20px;padding:20px;background:linear-gradient(135deg,rgba(255,139,159,.1),rgba(93,222,218,.06));border:1px solid var(--ferreto-border,#21262d);border-radius:14px;">
        <div style="font-size:48px;margin-bottom:8px;">🏆</div>
        <b style="color:var(--ferreto-text,#f0f6fc);font-size:18px;font-family:var(--ferreto-font-display,'Poppins',sans-serif);">Conquistas</b>
        <p style="color:var(--ferreto-text-muted,#8b949e);font-size:13px;margin:6px 0 0;">${unlocked.length} de ${total} desbloqueadas · ${pct}% completo</p>
        <div style="height:8px;background:var(--ferreto-surface-3,rgba(255,255,255,.08));border-radius:4px;overflow:hidden;margin:14px auto 0;max-width:300px;">
          <div style="height:8px;width:${pct}%;background:var(--ferreto-grad);border-radius:4px;transition:width .4s;"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
        ${defs.map(d=>{
          const isUnlocked=unlocked.includes(d.id);
          return `<div style="background:var(--ferreto-surface-2,rgba(255,255,255,.04));border:1px solid ${isUnlocked?'rgba(63,185,80,.3)':'var(--ferreto-border,#21262d)'};border-radius:12px;padding:14px;text-align:center;${isUnlocked?'':'opacity:.5;'}">
            <div style="font-size:32px;margin-bottom:6px;${isUnlocked?'':'filter:grayscale(1);'}">${d.icon}</div>
            <b style="color:${isUnlocked?'#3fb950':'var(--ferreto-text-muted,#8b949e)'};font-size:13px;display:block;">${escHtml(d.title)}</b>
            <small style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;display:block;margin-top:4px;line-height:1.4;">${escHtml(d.desc)}</small>
            ${isUnlocked?'<div style="font-size:10px;color:#3fb950;margin-top:6px;font-weight:600;">✓ DESBLOQUEADA</div>':'<div style="font-size:10px;color:var(--ferreto-text-faint,#6b7488);margin-top:6px;">bloqueada</div>'}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // ★ Aba "Matérias" — gerenciar matérias manuais
  function renderSubjects(box){
    if(!window.gdiSubjects){
      box.innerHTML='<div class="gdi-notes-empty">Sistema de matérias indisponível.</div>';
      return;
    }
    const subs=window.gdiSubjects.get();
    box.innerHTML=`<div style="max-width:760px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <b style="color:var(--ferreto-text,#f0f6fc);font-size:15px;">Matérias</b>
          <p style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;margin:4px 0 0;">Crie matérias para organizar seus flashcards. Ex: "Direito Constitucional", "Português", "Raciocínio Lógico".</p>
        </div>
        <button id="gdi-subj-add" class="gdi-btn gdi-btn-primary" style="font-size:12px;"><i class="bi bi-plus-lg"></i> Nova matéria</button>
      </div>
      <div id="gdi-subj-list" style="display:flex;flex-direction:column;gap:8px;"></div>
    </div>`;
    const list=box.querySelector('#gdi-subj-list');
    function drawList(){
      const all=window.gdiSubjects.get();
      if(!all.length){
        list.innerHTML='<div class="gdi-notes-empty" style="padding:40px;text-align:center;"><i class="bi bi-journal-text" style="font-size:36px;display:block;margin-bottom:10px;color:var(--ferreto-text-faint,#6b7488);"></i>Nenhuma matéria criada ainda.<br><span style="font-size:12px;">Clique em "Nova matéria" para começar.</span></div>';
        return;
      }
      // contar cards por matéria
      const cards=lsGet('gdi-cards-v1',[]);
      const countByName={};
      cards.forEach(c=>{if(c.subject)countByName[c.subject]=(countByName[c.subject]||0)+1;});
      list.innerHTML='';
      all.forEach(s=>{
        const count=countByName[s.name]||0;
        const el=document.createElement('div');
        el.className='gdi-note';
        el.style.cssText='display:flex;align-items:center;gap:12px;padding:12px 14px;';
        el.innerHTML=`
          <span style="font-size:24px;flex:none;">${s.icon||'📚'}</span>
          <div style="flex:1;min-width:0;">
            <b style="color:var(--ferreto-text,#f0f6fc);font-size:14px;display:flex;align-items:center;gap:6px;">${escHtml(s.name)}<span style="width:8px;height:8px;border-radius:50%;background:${s.color||'#ff8b9f'};display:inline-block;"></span></b>
            ${s.notes?`<small style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;display:block;margin-top:2px;">${escHtml(s.notes)}</small>`:''}
            <small style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">${count} card${count!==1?'s':''} · meta: ${s.goal||60} min/dia</small>
          </div>
          <button class="gdi-mode-btn gdi-subj-edit" data-id="${escHtml(s.id)}" style="font-size:11px;padding:5px 10px;"><i class="bi bi-pencil"></i></button>
          <button class="gdi-mode-btn gdi-subj-del" data-id="${escHtml(s.id)}" style="font-size:11px;padding:5px 10px;color:#ff8b8b;"><i class="bi bi-trash"></i></button>
        `;
        list.appendChild(el);
      });
      list.querySelectorAll('.gdi-subj-edit').forEach(b=>b.onclick=()=>editSubject(b.dataset.id,box));
      list.querySelectorAll('.gdi-subj-del').forEach(b=>b.onclick=async ()=>{
        const sub=all.find(x=>x.id===b.dataset.id);
        if(!sub)return;
        const ok=await window.gdiModal({
          title:'Excluir matéria',
          message:'Excluir "'+sub.name+'"? Os flashcards vinculados NÃO serão excluídos — apenas a matéria some da lista.',
          confirmText:'Excluir',
          cancelText:'Cancelar',
          danger:true
        });
        if(ok){
          window.gdiSubjects.delete(b.dataset.id);
          showToast('Matéria excluída');
          drawList();
        }
      });
    }
    drawList();
    box.querySelector('#gdi-subj-add').onclick=()=>editSubject(null,box,drawList);
  }
  function editSubject(id,box,afterSave){
    const colors=['#ff8b9f','#5ddeda','#c026d3','#3fb950','#ffd43b','#7aa2ff','#ff6b6b','#a78bfa'];
    const icons=['⚖️','📐','📚','🎯','🧮','📖','🔬','💼','🌍','🏛️','⚙️','🎵','📝','🎨','💻','🏥'];
    const existing=id?window.gdiSubjects.get().find(s=>s.id===id):null;
    const overlay=document.createElement('div');
    overlay.className='gdi-modal-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100002;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML=`<div style="background:var(--ferreto-bg-2,#0d1119);border:1px solid var(--ferreto-border,#21262d);border-radius:14px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.6);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--ferreto-border,#21262d);position:sticky;top:0;background:var(--ferreto-bg-2,#0d1119);z-index:1;">
        <b style="color:var(--ferreto-text,#f0f6fc);font-size:15px;font-family:var(--ferreto-font-display,'Poppins',sans-serif);">${existing?'Editar matéria':'Nova matéria'}</b>
        <button id="gdi-subj-x" style="background:transparent;border:0;color:var(--ferreto-text-muted,#8b949e);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Nome *</label>
          <input id="gdi-subj-name" placeholder="Ex: Direito Constitucional" value="${existing?escHtml(existing.name):''}" style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;">
        </div>
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Ícone</label>
          <div id="gdi-subj-icons" style="display:flex;gap:6px;flex-wrap:wrap;">${icons.map(ic=>`<button class="gdi-subj-ic" data-ic="${ic}" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid ${existing&&existing.icon===ic?'var(--ferreto-primary,#ff8b9f)':'var(--ferreto-border,#30363d)'};border-radius:8px;padding:8px 10px;font-size:18px;cursor:pointer;">${ic}</button>`).join('')}</div>
        </div>
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Cor</label>
          <div id="gdi-subj-colors" style="display:flex;gap:6px;flex-wrap:wrap;">${colors.map(c=>`<button class="gdi-subj-cl" data-cl="${c}" style="background:${c};border:${existing&&existing.color===c?'4px':'2px'} solid ${existing&&existing.color===c?'#fff':'transparent'};border-radius:50%;width:32px;height:32px;cursor:pointer;"></button>`).join('')}</div>
        </div>
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Meta diária (minutos)</label>
          <input id="gdi-subj-goal" type="number" min="10" max="480" value="${existing?(existing.goal||60):60}" style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;">
        </div>
        <div>
          <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Observações (opcional)</label>
          <textarea id="gdi-subj-notes" placeholder="Ex: Prova em dezembro, banca CESPE..." style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;min-height:60px;resize:vertical;">${existing?escHtml(existing.notes||''):''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 20px 16px;position:sticky;bottom:0;background:var(--ferreto-bg-2,#0d1119);">
        <button id="gdi-subj-cancel" class="gdi-mode-btn" style="font-size:13px;">Cancelar</button>
        <button id="gdi-subj-save" style="font-size:13px;padding:8px 16px;border-radius:8px;border:0;cursor:pointer;font-weight:600;background:var(--ferreto-grad);color:#fff;">${existing?'Salvar':'Criar matéria'}</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    let selIcon=existing?existing.icon:icons[0];
    let selColor=existing?existing.color:colors[0];
    overlay.querySelectorAll('.gdi-subj-ic').forEach(b=>b.onclick=()=>{
      overlay.querySelectorAll('.gdi-subj-ic').forEach(x=>x.style.borderColor='var(--ferreto-border,#30363d)');
      b.style.borderColor='var(--ferreto-primary,#ff8b9f)';
      selIcon=b.dataset.ic;
    });
    overlay.querySelectorAll('.gdi-subj-cl').forEach(b=>b.onclick=()=>{
      overlay.querySelectorAll('.gdi-subj-cl').forEach(x=>{x.style.borderWidth='2px';x.style.borderColor='transparent';});
      b.style.borderWidth='4px';b.style.borderColor='#fff';
      selColor=b.dataset.cl;
    });
    const close=()=>overlay.remove();
    overlay.querySelector('#gdi-subj-x').onclick=close;
    overlay.querySelector('#gdi-subj-cancel').onclick=close;
    overlay.onclick=(e)=>{if(e.target===overlay)close();};
    overlay.querySelector('#gdi-subj-save').onclick=()=>{
      const name=overlay.querySelector('#gdi-subj-name').value.trim();
      if(!name){showToast('Digite o nome da matéria');return;}
      const goal=parseInt(overlay.querySelector('#gdi-subj-goal').value)||60;
      const notes=overlay.querySelector('#gdi-subj-notes').value.trim();
      window.gdiSubjects.save({
        id:existing?existing.id:('subj-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)),
        name,icon:selIcon,color:selColor,goal,notes,
        createdAt:existing?existing.createdAt:Date.now()
      });
      close();
      showToast(existing?'Matéria atualizada':'Matéria criada!');
      if(afterSave)afterSave();
    };
    setTimeout(()=>overlay.querySelector('#gdi-subj-name').focus(),50);
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
      if(restoreBtn)restoreBtn.onclick=async ()=>{
        const ok=await window.gdiModal({
          title:'Restaurar cursos',
          message:'Restaurar todos os '+hidden.length+' curso(s) oculto(s)?',
          confirmText:'Restaurar',
          cancelText:'Cancelar'
        });
        if(ok){
          lsSet(LS_HIDDEN,[]);
          showToast('Cursos restaurados');
          renderCursos(box);
        }
      };
      return;
    }
    box.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <b style="color:var(--ferreto-text,#f0f6fc);font-size:14px;">${cs.length} curso${cs.length>1?'s':''} em andamento</b>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button id="gdi-add-manual-course" class="gdi-mode-btn" style="font-size:11px;"><i class="bi bi-plus-lg"></i> Adicionar curso</button>
        ${hidden.length?`<button id="gdi-show-hidden" class="gdi-mode-btn" style="font-size:11px;"><i class="bi bi-eye-slash"></i> ${hidden.length} oculto${hidden.length>1?'s':''}</button>`:''}
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <input id="gdi-courses-search" type="search" placeholder="Buscar curso..." style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:9px 12px;font-size:13px;font-family:inherit;" value="${escHtml(box.__search||'')}">
    </div>
    <div class="gdi-courses"></div>
    <div id="gdi-courses-pager" style="margin-top:14px;text-align:center;"></div>`;
    const grid=box.querySelector('.gdi-courses');
    const pagerEl=box.querySelector('#gdi-courses-pager');
    const searchInput=box.querySelector('#gdi-courses-search');

    // ★ botão "Adicionar curso manual"
    const addManualBtn=box.querySelector('#gdi-add-manual-course');
    if(addManualBtn)addManualBtn.onclick=()=>showAddCourseModal(box);

    // ★ botão "mostrar ocultos"
    const showHiddenBtn=box.querySelector('#gdi-show-hidden');
    if(showHiddenBtn)showHiddenBtn.onclick=()=>showHiddenCoursesModal(box);

    // ★ busca + paginação
    const PAGE_SIZE=12;
    let currentPage=box.__page||0;
    function applyFilter(){
      const q=(box.__search||'').toLowerCase().trim();
      const filtered=q?cs.filter(c=>cleanCourseName(c.key).toLowerCase().includes(q)||driveNameOf(c.key).toLowerCase().includes(q)):cs;
      const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
      if(currentPage>=totalPages)currentPage=totalPages-1;
      if(currentPage<0)currentPage=0;
      const slice=filtered.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
      // limpar grid
      grid.innerHTML='';
      if(!slice.length){
        grid.innerHTML='<div class="gdi-notes-empty" style="padding:40px;text-align:center;">'+(q?'Nenhum curso encontrado para "'+escHtml(q)+'"':'Nenhum curso ainda.')+'</div>';
      }
      slice.forEach(c=>renderCourseCard(grid,c,box));
      // paginação
      if(totalPages>1){
        pagerEl.innerHTML=`<div style="display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap;">
          <button class="gdi-mode-btn" id="gdi-courses-prev" style="font-size:11px;padding:5px 10px;" ${currentPage===0?'disabled':''}><i class="bi bi-chevron-left"></i> Anterior</button>
          <span style="color:var(--ferreto-text-muted,#8b949e);font-size:12px;">Página ${currentPage+1} de ${totalPages}</span>
          <button class="gdi-mode-btn" id="gdi-courses-next" style="font-size:11px;padding:5px 10px;" ${currentPage===totalPages-1?'disabled':''}>Próxima <i class="bi bi-chevron-right"></i></button>
        </div>
        <div style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-top:6px;">Mostrando ${slice.length} de ${filtered.length} curso${filtered.length>1?'s':''}${q?' (filtrado por "'+escHtml(q)+'")':''}</div>`;
        const prev=pagerEl.querySelector('#gdi-courses-prev');
        const next=pagerEl.querySelector('#gdi-courses-next');
        if(prev)prev.onclick=()=>{currentPage--;applyFilter();};
        if(next)next.onclick=()=>{currentPage++;applyFilter();};
      }else{
        pagerEl.innerHTML=filtered.length>PAGE_SIZE?`<div style="color:var(--ferreto-text-muted,#8b949e);font-size:11px;">Mostrando ${slice.length} de ${filtered.length} cursos</div>`:'';
      }
    }
    function renderCourseCard(grid,c,box){
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

      // botão remover
      const removeBtn=el.querySelector('.gdi-course-remove');
      if(removeBtn){
        removeBtn.onmouseenter=()=>{removeBtn.style.color='#ff8b8b';removeBtn.style.background='rgba(255,107,107,.15)';};
        removeBtn.onmouseleave=()=>{removeBtn.style.color='var(--ferreto-text-muted,#8b949e)';removeBtn.style.background='transparent';};
        removeBtn.onclick=async (e)=>{
          e.stopPropagation();
          const ok=await window.gdiModal({
            title:'Ocultar curso',
            message:'Ocultar "'+name+'" da sua lista de cursos?\n\nO curso não será excluído — você pode restaurá-lo depois.',
            confirmText:'Ocultar',
            cancelText:'Cancelar',
            danger:true
          });
          if(ok){
            hideCourse(c.key);
            showToast('Curso ocultado');
            renderCursos(box);
          }
        };
      }

      // clicar no card abre detalhes
      el.onclick=(e)=>{
        if(e.target.closest('button'))return;
        openCourseDetail(box,c);
      };
    }
    if(searchInput){
      let _searchTimer=null;
      searchInput.addEventListener('input',function(){
        if(_searchTimer)clearTimeout(_searchTimer);
        _searchTimer=setTimeout(()=>{
          box.__search=this.value;
          currentPage=0;
          box.__page=0;
          applyFilter();
        },250);
      });
    }
    applyFilter();
  }

  // ★ Modal para adicionar curso manualmente
  function showAddCourseModal(box){
    const colors=['#ff8b9f','#5ddeda','#c026d3','#3fb950','#ffd43b','#7aa2ff','#ff6b6b','#a78bfa'];
    const icons=['⚖️','📐','📚','🎯','🧮','📖','🔬','💼','🌍','🏛️','⚙️','🎵'];
    const html=`<div style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Nome do curso *</label>
        <input id="gdi-amc-name" placeholder="Ex: Direito Constitucional para Concurso" style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;">
      </div>
      <div>
        <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Ícone</label>
        <div id="gdi-amc-icons" style="display:flex;gap:6px;flex-wrap:wrap;">
          ${icons.map((ic,i)=>`<button class="gdi-amc-icon-btn" data-icon="${ic}" style="background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;padding:8px 10px;font-size:18px;cursor:pointer;">${ic}</button>`).join('')}
        </div>
      </div>
      <div>
        <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Cor</label>
        <div id="gdi-amc-colors" style="display:flex;gap:6px;flex-wrap:wrap;">
          ${colors.map((c,i)=>`<button class="gdi-amc-color-btn" data-color="${c}" style="background:${c};border:2px solid transparent;border-radius:50%;width:32px;height:32px;cursor:pointer;"></button>`).join('')}
        </div>
      </div>
      <div>
        <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Meta diária (minutos)</label>
        <input id="gdi-amc-goal" type="number" min="10" max="480" value="60" style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;">
      </div>
      <div>
        <label style="display:block;color:var(--ferreto-text-muted,#8b949e);font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Observações (opcional)</label>
        <textarea id="gdi-amc-notes" placeholder="Ex: Prova em dezembro, banca CESPE..." style="width:100%;box-sizing:border-box;background:var(--ferreto-surface-2,rgba(255,255,255,.06));border:1px solid var(--ferreto-border,#30363d);border-radius:8px;color:var(--ferreto-text,#e6edf3);padding:10px 12px;font-size:14px;font-family:inherit;min-height:60px;resize:vertical;"></textarea>
      </div>
    </div>`;
    // cria overlay custom (gdiModal só suporta 1 input, então fazemos manual)
    const overlay=document.createElement('div');
    overlay.className='gdi-modal-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100002;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML=`<div style="background:var(--ferreto-bg-2,#0d1119);border:1px solid var(--ferreto-border,#21262d);border-radius:14px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.6);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--ferreto-border,#21262d);position:sticky;top:0;background:var(--ferreto-bg-2,#0d1119);z-index:1;">
        <b style="color:var(--ferreto-text,#f0f6fc);font-size:15px;font-family:var(--ferreto-font-display,'Poppins',sans-serif);">+ Adicionar curso manual</b>
        <button id="gdi-amc-x" style="background:transparent;border:0;color:var(--ferreto-text-muted,#8b949e);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;">✕</button>
      </div>
      <div style="padding:20px;">${html}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 20px 16px;position:sticky;bottom:0;background:var(--ferreto-bg-2,#0d1119);">
        <button id="gdi-amc-cancel" class="gdi-mode-btn" style="font-size:13px;">Cancelar</button>
        <button id="gdi-amc-save" style="font-size:13px;padding:8px 16px;border-radius:8px;border:0;cursor:pointer;font-weight:600;background:var(--ferreto-grad);color:#fff;">Salvar curso</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    let selectedIcon=icons[0];
    let selectedColor=colors[0];
    overlay.querySelectorAll('.gdi-amc-icon-btn').forEach(b=>{
      b.onclick=()=>{
        overlay.querySelectorAll('.gdi-amc-icon-btn').forEach(x=>x.style.borderColor='var(--ferreto-border,#30363d)');
        b.style.borderColor='var(--ferreto-primary,#ff8b9f)';
        selectedIcon=b.dataset.icon;
      };
    });
    overlay.querySelectorAll('.gdi-amc-color-btn').forEach(b=>{
      b.onclick=()=>{
        overlay.querySelectorAll('.gdi-amc-color-btn').forEach(x=>x.style.borderWidth='2px');
        b.style.borderWidth='4px';
        selectedColor=b.dataset.color;
      };
    });
    // default selection
    const firstIcon=overlay.querySelector('.gdi-amc-icon-btn');
    if(firstIcon)firstIcon.style.borderColor='var(--ferreto-primary,#ff8b9f)';
    const firstColor=overlay.querySelector('.gdi-amc-color-btn');
    if(firstColor)firstColor.style.borderWidth='4px';
    const close=()=>overlay.remove();
    overlay.querySelector('#gdi-amc-x').onclick=close;
    overlay.querySelector('#gdi-amc-cancel').onclick=close;
    overlay.onclick=(e)=>{if(e.target===overlay)close();};
    overlay.querySelector('#gdi-amc-save').onclick=async ()=>{
      const name=overlay.querySelector('#gdi-amc-name').value.trim();
      if(!name){showToast('Digite o nome do curso');return;}
      const goal=parseInt(overlay.querySelector('#gdi-amc-goal').value)||60;
      const notes=overlay.querySelector('#gdi-amc-notes').value.trim();
      // salvar curso manual
      const LS_MANUAL='gdi-manual-courses-v1';
      const manual=lsGet(LS_MANUAL,[]);
      manual.push({
        id:'mc-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
        name,icon:selectedIcon,color:selectedColor,
        goal,notes,createdAt:Date.now(),
        manual:true
      });
      lsSet(LS_MANUAL,manual);
      close();
      showToast('Curso "'+name+'" adicionado!');
      renderCursos(box);
    };
    setTimeout(()=>overlay.querySelector('#gdi-amc-name').focus(),50);
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
    box.querySelector('#gdi-restore-all').onclick=async ()=>{
      const ok=await window.gdiModal({
        title:'Restaurar todos',
        message:'Restaurar todos os '+hidden.length+' cursos?',
        confirmText:'Restaurar todos',
        cancelText:'Cancelar'
      });
      if(ok){
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
    box.querySelector('#gdi-detail-hide').onclick=async ()=>{
      const ok=await window.gdiModal({
        title:'Ocultar curso',
        message:'Ocultar "'+name+'" da sua lista de cursos?',
        confirmText:'Ocultar',
        cancelText:'Cancelar',
        danger:true
      });
      if(ok){
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
        // ★ SRS unificado via gdiGradeCard (SM-2 simplificado)
        // M22 usava [1,7,30,90] com 4 caixas cap 3; agora usa [1,3,7,21,60] com 5 caixas cap 4
        // (mesmo algoritmo do M9-ISA)
        const result=window.gdiGradeCard(all[ix],g);
        all[ix].box=result.box;
        all[ix].due=result.due;
        all[ix].lastReview=result.lastReview;
        saveCards(all);
      }
      if(g===3||g===4)ok++;  // Good ou Easy contam como "lembrou"
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
    if(window.marked){try{return window.gdiSanitize?window.gdiSanitize(marked.parse(txt)):marked.parse(txt);}catch(_){}}
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
// BlackTie: TEMA VISUAL FERRETO PARA OS MÓDULOS EXTRAS
// Carrega fontes (Poppins/Rubik/Inter), fixa tokens e reaplica a
// linguagem visual Ferreto (coral #ff8b9f / teal #5ddeda) sobre os
// componentes próprios deste extras (debug, pomodoro, notas,
// materiais, playlist, sleep, skip-intro, continue-card, progress,
// central de estudos). Não altera lógica dos módulos.
// ═══════════════════════════════════════════════════════════════
(function(){
  if(window.__gdiFerretoExtras)return;window.__gdiFerretoExtras=true;
  console.log('[GDI Extras] BlackTie tema aplicado');

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
