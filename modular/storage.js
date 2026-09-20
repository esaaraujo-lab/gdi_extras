// ═══════════════════════════════════════════════════════════════
// storage.js — Camada de Abstração de Armazenamento
//
// VERSÃO: DRIVE (Google Drive API)
//
// Todas as funções de persistência passam por este arquivo.
// Para mudar de Drive para D1/KV, basta trocar este arquivo.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  const STORAGE_VERSION = 'drive-v1';
  const MEGGY_FOLDER = '.meggy.ai';

  // ═══ Helpers de URL curta (compartilhados entre todas as versões) ═══

  // Gera ID curto e estável a partir de um path
  function shortUrlId(path){
    let hash=0;
    for(let i=0;i<path.length;i++) hash=((hash<<5)-hash+path.charCodeAt(i))|0;
    return 'f'+Math.abs(hash).toString(36).padStart(6,'0').slice(0,8);
  }

  // Registra mapeamento path → shortUrl no worker (via KV)
  async function getShortUrl(fullPath){
    try{
      const r=await fetch('/api/shorturl/register',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({path:fullPath})
      });
      if(r.ok){const d=await r.json();if(d&&d.ok&&d.shortUrl)return d.shortUrl;}
    }catch(_){}
    return fullPath;
  }

  // Hash curto de lessonKey (estável, 8 chars)
  function shortLessonKey(path){
    const p=(path||window.location.pathname||'').split('?')[0];
    let hash=0;
    for(let i=0;i<p.length;i++) hash=((hash<<5)-hash+p.charCodeAt(i))|0;
    return 'L'+Math.abs(hash).toString(36);
  }

  // Nome de arquivo deduplicável (hash estável, não timestamp)
  function materialFileName(coursePath, pdfName, kind){
    let hash=0;
    const str=coursePath+'/'+pdfName;
    for(let i=0;i<str.length;i++) hash=((hash<<5)-hash+str.charCodeAt(i))|0;
    const raw='m'+Math.abs(hash).toString(36);
    if(kind==='questoes'||kind==='flashcards'||kind==='simulados')return raw+'.json';
    return raw+'.md';
  }

  // ═══ API de Storage (Drive) ═══

  // Lê cache ISA por lessonKey
  async function isaCacheGet(lessonKey){
    try{
      const r=await fetch('/api/ai/cache?key='+encodeURIComponent(lessonKey),{cache:'no-store'});
      if(!r.ok)return null;
      const d=await r.json();
      return d&&d.ok?d.cached:null;
    }catch(_){return null;}
  }

  // Salva cache ISA por lessonKey
  async function isaCacheSet(lessonKey, data){
    try{
      await fetch('/api/ai/cache',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key:lessonKey,...data})});
    }catch(_){}
  }

  // Lista todo o cache ISA (para recuperar resumos que sumiram do localStorage)
  async function isaCacheList(){
    try{
      const r=await fetch('/api/ai/cache/list',{cache:'no-store'});
      if(!r.ok)return [];
      const d=await r.json();
      return d&&d.ok&&Array.isArray(d.entries)?d.entries:[];
    }catch(_){return [];}
  }

  // Salva material em subpasta (.meggy.ai/<kind>/)
  async function saveMaterial(coursePath, pdfName, kind, content){
    try{
      await fetch('/api/materials/save',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({coursePath,pdfName,kind,content})});
    }catch(_){}
  }

  // Verifica se material já existe (cache hit)
  async function materialExists(coursePath, pdfName, kind){
    try{
      const fileName=materialFileName(coursePath, pdfName, kind);
      const r=await fetch('/api/materials/exists?fileName='+encodeURIComponent(fileName)+'&kind='+kind,{cache:'no-store'});
      if(!r.ok)return false;
      const d=await r.json();
      return !!(d&&d.ok&&d.exists);
    }catch(_){return false;}
  }

  // Lista materiais por tipo
  async function listMaterials(kind, courseFilter){
    try{
      let url='/api/materials/list?kind='+kind;
      if(courseFilter)url+='&course='+encodeURIComponent(courseFilter);
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)return [];
      const d=await r.json();
      return d&&d.ok&&Array.isArray(d.items)?d.items:[];
    }catch(_){return [];}
  }

  // Salva curso
  async function saveCourse(coursePath, courseName, pdfCount){
    try{
      await fetch('/api/courses/add',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({coursePath,courseName,pdfCount:pdfCount||0,addedAt:Date.now()})});
    }catch(_){}
  }

  // Lista cursos do aluno
  async function listCourses(){
    try{
      const r=await fetch('/api/courses/list',{cache:'no-store'});
      if(!r.ok)return [];
      const d=await r.json();
      return d&&d.ok&&Array.isArray(d.courses)?d.courses:[];
    }catch(_){return [];}
  }

  // Status do batalhão
  async function battalionStatus(courseKey){
    try{
      const r=await fetch('/api/ai/battalion/status?courseKey='+encodeURIComponent(courseKey),{cache:'no-store'});
      if(!r.ok)return {processed:false};
      return await r.json();
    }catch(_){return {processed:false};}
  }

  // Dispara batalhão
  async function startBattalion(courseKey, coursePath, lessonName, pdfList){
    try{
      const r=await fetch('/api/ai/battalion',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({courseKey,coursePath,lessonName,pdfs:pdfList||[]})});
      const d=await r.json();
      return !!(d&&d.ok);
    }catch(_){return false;}
  }

  // Salva MD na memória da Meggy
  async function saveMemory(fileName, markdown){
    try{
      await fetch('/api/brain/save',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({fileName,markdown})});
    }catch(_){}
  }

  // Lista memória da Meggy
  async function listMemory(filter){
    try{
      let url='/api/brain/list';
      if(filter)url+='?q='+encodeURIComponent(filter);
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)return [];
      const d=await r.json();
      return d&&d.ok&&Array.isArray(d.items)?d.items:[];
    }catch(_){return [];}
  }

  // Salva redação corrigida em MD
  async function saveEssay(markdown, banca, tipo, score){
    try{
      await fetch('/api/ai/essay/save',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({markdown,banca,tipo,score})});
    }catch(_){}
  }

  // Salva flashcard compartilhado
  async function saveSharedFlashcard(card){
    try{
      await fetch('/api/ai/shared-flashcards',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(card)});
    }catch(_){}
  }

  // Lista flashcards compartilhados
  async function listSharedFlashcards(subject){
    try{
      let url='/api/ai/shared-flashcards';
      if(subject)url+='?subject='+encodeURIComponent(subject);
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)return [];
      const d=await r.json();
      return d&&d.ok&&Array.isArray(d.items)?d.items:[];
    }catch(_){return [];}
  }

  // ═══ PROGRESS (curso clicável) — scan + user KV + shared Drive ═══

  // Escaneia curso recursivamente, devolve lista de aulas {id,name,path,type}
  // Roda em background — não bloqueia o usuário
  async function scanCourseProgress(coursePath){
    try{
      const r=await fetch('/api/courses/scan-progress',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({coursePath})
      },{cache:'no-store'});
      if(!r.ok)return null;
      const d=await r.json();
      return d&&d.ok?d:null;
    }catch(_){return null;}
  }

  // Salva progresso do usuário no KV (privado por usuário)
  // progress: [{path, watched:bool, lastPosition?:number}]
  async function saveUserProgress(coursePath, progress, totalLessons){
    try{
      await fetch('/api/courses/user-progress',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({coursePath, progress:progress||[], totalLessons:totalLessons||0})
      });
    }catch(_){}
  }

  // Lê progresso do usuário no KV
  async function getUserProgress(coursePath){
    try{
      const r=await fetch('/api/courses/user-progress?coursePath='+encodeURIComponent(coursePath),{cache:'no-store'});
      if(!r.ok)return null;
      const d=await r.json();
      return d&&d.ok?d.progress:null;
    }catch(_){return null;}
  }

  // Lê MD compartilhado em .meggy.ai/progress/course-<hash>.md
  // Se existe: outro usuário já escaneou — só marcar início deste aluno
  async function getSharedProgress(coursePath){
    try{
      const r=await fetch('/api/courses/shared-progress?coursePath='+encodeURIComponent(coursePath),{cache:'no-store'});
      if(!r.ok)return null;
      const d=await r.json();
      return d&&d.ok?{markdown:d.markdown, hash:d.hash, fileName:d.fileName, modified:d.modified}:null;
    }catch(_){return null;}
  }

  // Salva MD compartilhado em .meggy.ai/progress/course-<hash>.md
  async function saveSharedProgress(coursePath, markdown){
    try{
      const r=await fetch('/api/courses/shared-progress',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({coursePath, markdown})
      });
      if(!r.ok)return false;
      const d=await r.json();
      return !!(d&&d.ok);
    }catch(_){return false;}
  }

  // Helper: constrói markdown de progresso compartilhado (formato Meggy brain)
  // Conteúdo: metadados do curso + lista de aulas + quem já estudou
  function buildSharedProgressMarkdown(opts){
    const {coursePath, courseName, lessons, scannedBy, scannedAt, startedBy} = opts;
    const lines = [];
    lines.push('# Curso: '+(courseName||coursePath));
    lines.push('');
    lines.push('> Memória compartilhada da Meggy — este curso já foi escaneado.');
    lines.push('> Outros alunos que iniciarem o mesmo curso verão esta lista e não dispararão novo scan.');
    lines.push('');
    lines.push('**Path:** `'+coursePath+'`');
    lines.push('**Total de aulas:** '+(lessons?lessons.length:0));
    lines.push('**Scanned by:** '+(scannedBy||'—'));
    lines.push('**Scanned at:** '+(scannedAt?new Date(scannedAt).toISOString():'—'));
    lines.push('');
    if(startedBy&&startedBy.length){
      lines.push('## Alunos que iniciaram este curso');
      for(const u of startedBy)lines.push('- @'+u.username+' — iniciado em '+new Date(u.startedAt).toISOString());
      lines.push('');
    }
    if(lessons&&lessons.length){
      lines.push('## Lista de aulas');
      for(let i=0;i<lessons.length;i++){
        const l=lessons[i];
        lines.push((i+1)+'. ['+l.type.toUpperCase()+'] '+l.name);
        lines.push('   - Path: `'+l.path+'`');
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('_Gerado automaticamente por Meggy (gdi_extras). Atualize apenas se a estrutura do curso mudar._');
    return lines.join('\n');
  }

  // ═══ Expõe API global ═══
  window.GDIStorage = {
    version: STORAGE_VERSION,
    // URL helpers
    shortUrlId,
    getShortUrl,
    shortLessonKey,
    materialFileName,
    // ISA cache
    isaCacheGet,
    isaCacheSet,
    isaCacheList,
    // Materials
    saveMaterial,
    materialExists,
    listMaterials,
    // Courses
    saveCourse,
    listCourses,
    // Course progress (novo)
    scanCourseProgress,
    saveUserProgress,
    getUserProgress,
    getSharedProgress,
    saveSharedProgress,
    buildSharedProgressMarkdown,
    // Battalion
    battalionStatus,
    startBattalion,
    // Memory (brain)
    saveMemory,
    listMemory,
    // Essay
    saveEssay,
    // Shared flashcards
    saveSharedFlashcard,
    listSharedFlashcards,
  };

  // Helper global para navegação com URL curta.
  // Recebe path longo (ex: /7:/TJ SP/.../video.mp4)
  // Devolve URL final pronta para location.href (com ?a=view)
  // Falha silenciosamente para o path longo original em caso de erro.
  window.gdiShortNavigate = async function(target){
    const t = String(target||'');
    if(!t) return t;
    try{
      if(window.GDIStorage && typeof window.GDIStorage.getShortUrl==='function'){
        const short = await window.GDIStorage.getShortUrl(t);
        if(short && short.indexOf('/f/')===0){
          return short + (short.includes('?')?'&':'?') + 'a=view';
        }
      }
    }catch(_){}
    return t + (t.includes('?')?'&':'?') + 'a=view';
  };

  console.log('[GDI Storage] Drive v1 carregado');
})();
