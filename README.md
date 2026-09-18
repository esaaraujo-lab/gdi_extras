# Deploy no Cloudflare Workers — Guia Completo

Este guia explica como publicar o GDI Extras no Cloudflare Workers em **3 níveis diferentes**, do mais simples ao mais modular.

---

## 📦 O que você tem agora em `/download/` Apos Baixar este Repo

```
download/
├── app.min.js              ← core do app (jQuery, rotas, file viewer)
├── gdi-extras.js           ← MONOLITO (6.259 linhas, 358 KB) — versão atual em produção
├── worker.js               ← Cloudflare Worker (rotas, auth, Drive API, Meggy proxy)
├── modular/                ← VERSÃO MODULARIZADA (Nível 1)
│   ├── gdi-extras-loader.js   ← loader (carrega os 5 módulos)
│   ├── gdi-core.js            ← bootstrap + M1-M7 + M9 (47 KB)
│   ├── gdi-pdf.js             ← M17 visualizador PDF (5 KB)
│   ├── gdi-ui.js              ← M10-M14, M16, M18-M20 (65 KB)
│   ├── gdi-meggy.js           ← M9-ISA + M-AI (118 KB)
│   └── gdi-study.js           ← M22-M24, BlackTie, M-PLAYER-GUARD (135 KB)
└── test_flip_card.html     ← teste isolado do flip card
```

---

## 🟢 NÍEL 0 — Monolito (Dois monolitos completos)

Funciona, mas cada mudança = republish de 358 KB.

### Como funciona isso no worker
O worker serve o `gdi-extras.js` direto. Procure no `worker.js` por algo como:

```js
const CUSTOM_APP_SOURCES = [
  'https://raw.githubusercontent.com/.../app.min.js',
  'https://raw.githubusercontent.com/.../gdi-extras.js',
  // ...
];
```

Ou o worker pode estar servindo direto da pasta `/extras/` do próprio worker.

### Quando manter o monolito
- ✅ Está funcionando em produção
- ✅ Não quer mexer em time de produção
- ✅ Mudanças são raras

---

## 🟡 NÍVEL 1 — Multi-arquivo (RECOMENDADO para começar)

Divide o monolito em 5 arquivos físicos. Mantém as IIFEs (não muda o código interno, só separa em arquivos).

### Vantagens
- ✅ Cache granular: mudar 1 linha no Meggy só reinvalida 118 KB (não 358 KB)
- ✅ Carregamento paralelo (5 requests HTTP/2 simultâneos)
- ✅ Se 1 módulo quebrar, os outros 4 ainda carregam
- ✅ Mais fácil debugar (DevTools mostra arquivo específico)
- ✅ **Sem build step** — só subir arquivos no worker

### Como publicar no Cloudflare Workers

#### Passo 1 — Subir os 6 arquivos no worker

No `worker.js`, localize onde os assets estáticos são servidos. Provavelmente há um array `CUSTOM_APP_SOURCES` ou você publica via GitHub + jsdelivr CDN.

**Opção A: Servir do próprio worker (mais simples)**

Coloque os 6 arquivos na pasta `/extras/` do worker. Se o worker é deployado via wrangler:

```toml
# wrangler.toml
name = "curso"
main = "worker.js"
assets = { directory = "./public" }
```

Estrutura de pastas local:
```
curso/
├── worker.js              ← seu worker.js 
└── public/
    └── extras/
        ├── gdi-extras-loader.js
        ├── gdi-core.js
        ├── gdi-pdf.js
        ├── gdi-ui.js
        ├── gdi-meggy.js
        └── gdi-study.js
```

Deploy:
```bash
npx wrangler deploy
```

Pronto — os 6 arquivos ficam acessíveis em:
- `https://c.urso.workers.dev/extras/gdi-extras-loader.js`
- `https://c.urso.workers.dev/extras/gdi-core.js`
- etc.

**Opção B: Servir via GitHub + jsdelivr CDN (gratuito, com cache global)**

1. Crie um repositório público no GitHub (ex: `seu-nome/gdi-extras`)
2. Suba a pasta `modular/` inteira na branch `main`
3. O jsdelivr serve automaticamente:
   - `https://cdn.jsdelivr.net/gh/seu-nome/gdi-extras@main/modular/gdi-extras-loader.js`
4. No `gdi-extras-loader.js`, mude `BASE_URL`:
   ```js
   const BASE_URL = 'https://cdn.jsdelivr.net/gh/seu-nome/gdi-extras@main/modular/';
   ```
5. Commit → push → jsdelivr atualiza em ~5 min (ou force purge em https://purge.jsdelivr.net)

#### Passo 2 — Trocar referência no HTML/app.min.js

Onde o `app.min.js` (ou o worker) carrega o `gdi-extras.js`, troque por:

```html
<!-- ANTES -->
<script src="/extras/gdi-extras.js"></script>

<!-- DEPOIS -->
<script src="/extras/gdi-extras-loader.js"></script>
```

Ou, se a injeção é feita pelo worker via `CUSTOM_APP_SOURCES`:

```js
const CUSTOM_APP_SOURCES = [
  'https://cdn.jsdelivr.net/gh/.../app.min.js',
  // ANTES: 'https://cdn.jsdelivr.net/gh/.../gdi-extras.js',
  // DEPOIS:
  'https://cdn.jsdelivr.net/gh/.../gdi-extras-loader.js',
];
```

O loader injeta os 5 `<script>` tags automaticamente na ordem correta.

#### Passo 3 — Testar

1. Acesse `https://seu_workers.workers.dev/`
2. Abra DevTools → Network → filtre por "gdi-"
3. Deve ver 6 requests (loader + 5 módulos), todos 200 OK
4. Console deve mostrar:
   ```
   [GDI Loader] iniciando carga modular
   [GDI Loader] ✓ gdi-core.js carregado
   [GDI Loader] ✓ gdi-pdf.js
   [GDI Loader] ✓ gdi-ui.js
   [GDI Loader] ✓ gdi-meggy.js
   [GDI Loader] ✓ gdi-study.js
   [GDI Loader] carga completa em 280ms — 5 OK, 0 falhas
   ```

#### Passo 4 — Rollback (se quebrar)

Basta trocar de volta a referência para o monolito:
```html
<script src="/extras/gdi-extras.js"></script>
```
Nenhum dado é perdido — o `localStorage` (flashcards, resumos, etc.) é o mesmo.

---

## 🔴 NÍVEL 2 — ES Modules (mais limpo, exige refactor leve)

Converte cada módulo para ES module com `import`/`export`. Exige mudar a forma como o `app.min.js` chama o extras.

### Diferença do Nível 1

| Aspecto | Nível 1 (multi-arquivo) | Nível 2 (ES modules) |
|---------|-------------------------|----------------------|
| Sintaxe | IIFEs (igual ao monolito) | `import` / `export` |
| Script tag | `<script src="...">` | `<script type="module" src="...">` |
| Carregamento | Loader manual | Browser resolve imports |
| Tree-shaking | ❌ não | ✅ sim (se usar bundler) |
| Cache | Por arquivo | Por arquivo |
| Refactor | ❌ não precisa | ✅ preciso refatorar |

### COMO NÃO É (esclarecimento importante)

FAQ: *"é só pegar o workers.js e colar no cloudflare?"*

**NÃO.** ES modules no `worker.js` é uma coisa — ES modules no `gdi-extras.js` é outra completamente diferente.

#### O `worker (4).js` JÁ PODE usar ES modules nativamente
O Cloudflare Workers suporta ES modules desde 2023. Hoje seu worker usa `addEventListener('fetch', ...)` (formato antigo Service Worker). Para migrar para ES modules:

```js
// ANTES (formato  do  worker)
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

// DEPOIS (ES module format)
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, ctx);
  }
};
```

Mas isso é **mudança no worker**, não no extras. Não precisa fazer agora.

#### O `gdi-extras.js` em ES modules seria assim:

```js
// gdi-core.js (Nível 2)
export const Bus = (()=>{
  // ...
})();

export function showToast(msg){ /* ... */ }

export const GDI_MODULES = [];
```

```js
// gdi-meggy.js (Nível 2)
import { Bus, showToast } from './gdi-core.js';

export async function extractPdfText(url){ /* ... */ }
export async function callIsa(prompt){ /* ... */ }
```

```html
<!-- No HTML -->
<script type="module">
  import { extractPdfText } from '/extras/gdi-meggy.js';
  window.extractPdfText = extractPdfText; // expõe para app.min.js (não-module)
</script>
```

### Quando vale a pena o Nível 2?

- ✅ Quando quiser usar tree-shaking (remover código morto)
- ✅ Quando for usar TypeScript
- ✅ Quando quiser build system (Rollup/Vite) com source maps
- ✅ Quando o projeto crescer além de ~10 mil linhas

### Para o SEU caso se for novato: NÃO FAÇA Nível 2 ainda

Razões:
1. O `app.min.js` é jQuery-base (não-module) — não consegue `import` direto
2. Exige refactor em ~30 pontos do código (onde há `window.X = ...`)
3. O Nível 1 já resolve 90% dos seus problemas (cache granular, paralelismo)
4. Risco de quebrar produção é alto sem testes automatizados

**Faça Nível 2 só depois de estabilizar o Nível 1 e ter testes E2E.**

---

## 🚀 Plano de implantação recomendado

### Semana 1 — Preparar
1. ✅ Testar os 5 arquivos modulares localmente (já feitos em `/download/modular/`)
2. ✅ Validar que cada arquivo tem sintaxe OK (já validado)
3. Criar um **segundo worker** de teste (ex: `curso-staging.workers.dev`)
4. Publicar o monolito + os 5 arquivos modulares nesse worker de teste

### Semana 2 — Testar no staging
1. No worker de teste, trocar a referência do `gdi-extras.js` para `gdi-extras-loader.js`
2. Testar TODAS as funcionalidades:
   - Login
   - Player de vídeo (aulas)
   - Materiais (PDFs)
   - Meggy (resumo, questões, pílulas)
   - Flashcards (flip, sessão de estudo)
   - Central de Estudos (12 abas)
   - Pomodoro
   - OCR (PDFs escaneados)
3. Se algo quebrar, rollback é instantâneo (trocar 1 linha)

### Semana 3 — Migrar produção
1. Fazer backup do `gdi-extras.js` atual (renomear para `gdi-extras.monolith.bak.js`)
2. Subir os 6 arquivos modulares
3. Trocar referência no `app.min.js` (ou no `CUSTOM_APP_SOURCES` do worker)
4. Monitorar console por 24h
5. Se tudo OK, deletar o `.bak.js`

---

## 📋 Comparativo final

| Critério | Monolito (Nível 0) | Multi-arquivo (Nível 1) | ES Modules (Nível 2) |
|----------|--------------------|-----------------------|---------------------|
| Tamanho por mudança | 358 KB | 47-135 KB (só o alterado) | 47-135 KB + tree-shake |
| Carregamento inicial | 1 request (358 KB) | 6 requests paralelos | 6 requests paralelos |
| Cache HTTP | Tudo ou nada | Granular por arquivo | Granular por arquivo |
| Build step | ❌ | ❌ | ✅ (recomendado) |
| Refactor necessário | 0 | 0 | Médio (~30 pontos) |
| Risco de quebrar | 0 | Baixo (rollback 1 linha) | Médio |
| Manutenção | Difícil | Fácil | Muito fácil |
| Debug DevTools | Arquivo gigante | Arquivo por módulo | Arquivo por módulo + source maps |
| Recomendado para você | Mantenha em prod | ✅ **COMECE POR AQUI** | Faça depois de testar N1 |

---

## ❓ Perguntas frequentes

**P: Posso manter o monolito em produção e testar o modular em staging?**
R: ✅ Sim! É exatamente o que recomendamos. Os dois são 100% compatíveis — mesmo `localStorage`, mesmo comportamento.

**P: O loader bloqueia o render da página?**
R: ❌ Não. Ele usa `async` + `defer` nos scripts, então carrega em background sem travar o render. O `gdi-core.js` carrega primeiro (síncrono, ~50ms), os outros 4 em paralelo.

**P: E se o jsdelivr cair?**
R: Você pode usar fallback. No loader, adicione lógica: se `gdi-core.js` falhar, tentar carregar do worker direto. Para sua segurança, recomendamos servir do próprio worker (Opção A) em vez de CDN.

**P: Preciso mudar o `worker (4).js`?**
R: ❌ Não precisa mudar nada no worker. Só subir os 6 arquivos na pasta `public/extras/` e o wrangler cuida do resto.

**P: Como faço purge de cache no Cloudflare?**
R: Painel Cloudflare → Caching → Configuration → "Purge Everything" (cuidado, purga tudo) ou "Purge by URL" (recomendado — purga só os arquivos específicos).

**P: O `app.min.js` precisa mudar?**
R: Depende. Se o `app.min.js` referencia `gdi-extras.js` por string em algum lugar (ex: `CUSTOM_APP_SOURCES`), troque para `gdi-extras-loader.js`. Se a referência é num `<script>` tag no HTML que o worker gera, mude lá.

**P: Funciona com HTTP/2?**
R: ✅ Sim. HTTP/2 multiplexa os 6 requests num único TCP connection — overhead é mínimo.

**P: E HTTP/3?**
R: ✅ Cloudflare serve HTTP/3 por padrão. Ainda melhor que HTTP/2 para paralelismo.

---

## 📞 Suporte

Se algo quebrar na migração, de um google - GPT:
1. Print do Console do DevTools (errors em vermelho)
2. Print do Network → filtre por "gdi-"
3. URL do worker de teste


