# 📚 MANUAL COMPLETO — Plataforma GDI Extras (Meggy)

> Documento único integrando o **Manual do Usuário** (Parte 1) e o **Manual Técnico** (Parte 2) da plataforma GDI Extras — sistema de estudos construído sobre o Google Drive Index (GDI v19 / GDI-JS 2.5.9), com mascote **Meggy** 🐩 (poodle tutora de IA) e camada de extras modularizada em 6 arquivos JS carregados via jsDelivr.
>
> **Versão analisada:** v2.7-PLANO-A · **Data:** 2026-09-19
> **Repo:** `github.com/esaaraujo-lab/gdi_extras` (branch `main`, pasta `modular/`)
> **CDN:** `https://cdn.jsdelivr.net/gh/esaaraujo-lab/gdi_extras@main/modular/`
> **Backend:** Cloudflare Worker (`worker.js`) + Google Drive REST API
> **Persistência:** localStorage (cliente) + arquivos JSON no Drive 0 (servidor)

---

# 📗 PARTE 1 — MANUAL DO USUÁRIO

## Visão geral da interface

A plataforma tem 3 grandes zonas visuais:

1. **Navbar (`.gdi-nav`)** — fixa no topo, contém logo, busca, botão **Estudos** (tecla `C`), **Pomodoro**, alternador de **tema claro/escuro** e botão **Entrar/Sair**.
2. **Área de conteúdo principal (`#content`)** — renderiza listagens de pastas, player de vídeo/aúdio/PDF, breadcrumbs e anotações.
3. **UI flutuante (anexada ao `<html>`, fora do body)** — botão da **Meggy** (FAB coral/teal), overlay do **Modo Descanso**, painel **Pomodoro**, modais customizados e a **Área do Aluno** (painel full-screen).

A **Área do Aluno** é aberta pelo botão **Estudos** na navbar (ou tecla `C`) e contém **16 abas** organizadas em 5 grupos laterais: Estudar, Revisar, Organizar, Materiais, Planejar.

---

## 1. Área do Aluno — Painel Principal

Painel full-screen (`#gdi-central`) com cabeçalho + sidebar + corpo. O cabeçalho exibe:
- 🔥 **Streak** (dias consecutivos estudando)
- ⏱ **Tempo hoje / meta** (em minutos, editável)
- 🃏 **Flashcards devidos hoje** (badge)
- 🤖 **Indicador do Batalhão de IA** (aparece quando ativo)
- Campo editável de meta diária (10–480 min)

Abre/fecha com `C` (tecla) ou botão **Estudos**. Fecha com `Esc` ou clicando fora.

### 1.1 Início (`home`)
- **O que faz:** Painel de boas-vindas com cartão "Continuar de onde parou" em cascata (a última aula tocada em qualquer curso), cartão de meta diária com barra de progresso, atalhos rápidos.
- **Como usar:** Abra a Área do Aluno → aba Início é a padrão. Clique no card "Continuar" para retomar a aula.
- **Onde aparece:** Primeira aba do painel; renderizada por `renderHome(box)` em `gdi-study.js:970`.

### 1.2 Meus Cursos (`cursos`)
- **O que faz:** Lista todos os cursos detectados automaticamente do histórico de aulas assistidas/retomadas (`/userstate`) + cursos adicionados manualmente (modal "Adicionar curso") + cursos sincronizados do Drive (`/api/courses/list`). Cada curso mostra: ícone, nome, contagem de aulas assistidas/total, última atividade, botão para abrir o curso, ocultar, definir meta de minutos.
- **Como usar:** Aba **Meus Cursos** → clique num curso para abri-lo no player. Use o menu (⋮) para ocultar ou definir meta de minutos.
- **Onde aparece:** Aba "Meus Cursos" (grupo Estudar). Função: `renderCursos(box)` + `openCourseDetail` em `gdi-study.js:1404`.

### 1.3 Questões (`questoes`)
- **O que faz:** Banco pessoal de questões de múltipla escolha/certo-errado, com SRS (Spaced Repetition System — algoritmo SM-2 simplificado, 5 caixas [1, 3, 7, 21, 60] dias). Permite:
  - Resolver revisões de hoje (questões vencidas)
  - Resolver caderno de erros
  - Gerar questões com a Meggy (prompt para `/api/ai`)
  - Adicionar manualmente
  - Importar JSON
  - Gerar flashcards a partir das questões erradas
  - Filtrar por matéria (pills clicáveis)
- **Como usar:** Aba **Questões** → clique **Gerar com Meggy** e digite o tema, OU **Adicionar** para criar manualmente. Marque acerto/erro para treinar o SRS.
- **Onde aparece:** Aba "Questões". Função: `renderQuestoes(box)` em `gdi-study.js:97`.
- **Hero state:** Quando vazio, mostra um cartão convidativo com CTA **Gerar agora**.

### 1.4 Simulado (`simulado`)
- **O que faz:** Gera um minissimulado cronometrado a partir do banco de questões. Filtra por curso (dropdown populado dinamicamente de `collectCourses()`), embaralha com Fisher-Yates (sem bias), integra questões compartilhadas de outros alunos (`fetchSharedQuestions()`), exibe timer regressivo, salva resultado automaticamente ao terminar. Anti-duplicar: limpa o `__simTimer` antes de salvar.
- **Como usar:** Aba **Simulado** → escolha curso e nº de questões → clique **Iniciar**. Responda dentro do tempo. Resultado fica salvo em `gdi-simulados-v1`.
- **Onde aparece:** Aba "Simulado". Função: `renderSimulado(box)` + `startSimulado` em `gdi-study.js:373`.

### 1.5 Maratona (`mar`)
- **O que faz:** Modo "playlist infinita" — ao terminar uma aula, automaticamente pula para a próxima **não-assistida** do curso. Pula intros memorizadas (curso-a-curso). Toggle on/off. Mantém rascunhos de anotações ao trocar de aula.
- **Como usar:** Aba **Maratona** → ative o toggle. Volte para o player e toque numa aula — ao terminar, a próxima não-vista começa automaticamente.
- **Onde aparece:** Aba "Maratona". Função: `renderMarathon(box)` em `gdi-study.js:2061`. Persistência: `gdi-marathon` (bool) e `gdi-marathon-intro` (bool).

### 1.6 Revisões (`revisoes`)
- **O que faz:** Calendário de revisão espaçada mostrando questões/flashcards pendentes por dia (caixas SRS 1–5). Lista do mês atual + dias anteriores. Cada item é clicável para iniciar a sessão de revisão.
- **Como usar:** Aba **Revisões** → clique num dia para ver pendentes → resolva.
- **Onde aparece:** Aba "Revisões". Função: `renderRevisoes(box)` em `gdi-study.js:536`. Persistência: `gdi-q-srs-v1` (questões) + `gdi-cards-v1` (flashcards).

### 1.7 Flashcards (`fc`)
- **O que faz:** Biblioteca de flashcards 3D flip (frente/verso), organizados por disciplina → tema, com SRS SM-2. Permite: estudar cards devidos hoje, criar cards manualmente, importar via JSON, compartilhar com colegas (`POST /api/ai/shared-flashcards`), buscar cards compartilhados (`GET /api/ai/shared-flashcards?subject=X`). Botões de avaliação: Sabia (+3d), Quase (mantém), Fácil (+7d×1.5).
- **Como usar:** Aba **Flashcards** → **Estudar agora** para treinar os devidos, ou **Criar card** para adicionar.
- **Onde aparece:** Aba "Flashcards" (badge com nº devido). Função: `renderFlash(box)` + `studyFlash` em `gdi-study.js:1931`. Persistência: `gdi-cards-v1` (cap 1500) + `gdi-cards-studied-count`.

### 1.8 Matérias (`subjects`)
- **O que faz:** Caderno de matérias do aluno — cada uma com ícone, cor, meta de minutos, anotações e link opcional para uma pasta do Drive. Funciona como "categorias" para organizar trilhas e cards.
- **Como usar:** Aba **Matérias** → **Adicionar matéria** → preencha nome/cor/meta. Ou use o botão **Adicionar matéria** (modal de navegação do Drive) para vincular uma pasta.
- **Onde aparece:** Aba "Matérias" (grupo Organizar). Função: `renderSubjects(box)` em `gdi-study.js:1253`. Persistência: `gdi-subjects-v1` via `window.gdiSubjects`.

### 1.9 Trilhas (`trails`)
- **O que faz:** Trilhas de estudo personalizadas que agrupam matérias + cursos em uma meta (ex: "Auditor Fiscal"). Cada trilha tem: nome, descrição, lista de matérias/cursos, prazo (opcional), progresso. Editável via modal.
- **Como usar:** Aba **Trilhas** → **Nova trilha** → preencha nome e selecione matérias/cursos. Edite/exclua clicando nos botões.
- **Onde aparece:** Aba "Trilhas" (grupo Organizar). Função: `renderTrails(box)` + `editTrail` em `gdi-study.js:1094`. Persistência: `gdi-trails-v1` via `window.gdiTrails`.

### 1.10 Resumos (`resumos`)
- **O que faz:** Lista resumos gerados pela Meggy a partir de PDFs das aulas, **organizados por curso em tiles retangulares** (cada tile = 1 curso com borda coral). Tiles expandem lista filtrada ao clicar. Mostra contador por curso, matérias e total de caracteres. Inclui seção "Resumos compartilhados por outros alunos" (pool compartilhado). Recupera resumos que sumiram do localStorage consultando `GET /api/materials/list?kind=resumos`.
- **Como usar:** Aba **Resumos** → clique num tile de curso para expandir → clique num resumo para ver o conteúdo Markdown renderizado (sanitizado).
- **Onde aparece:** Aba "Resumos" (grupo Materiais). Função: `window.renderResumos(box)` em `gdi-meggy.js:1940`. Persistência: `gdi-isa-summaries-v1` (cap 200) + Drive `isa_shared_summaries.json` + subpasta `resumos/`.

### 1.11 Provas (`provas`)
- **O que faz:** Análise de provas anteriores — cola/link de uma prova, a Meggy gera um plano de estudos personalizado baseado nos temas mais cobrados. Histórico clicável.
- **Como usar:** Aba **Provas** → cole a prova (ou descreva) → clique **Analisar com Meggy** → veja o plano gerado.
- **Onde aparece:** Aba "Provas" (grupo Materiais). Função: `window.renderProvas(box)` + `analyzeProva` em `gdi-study.js:2267`. Persistência: `gdi-exam-plans-v1`.

### 1.12 Redação (`redacao`)
- **O que faz:** Correção de redações por banca específica com critérios oficiais. Recursos:
  - **30+ bancas** organizadas em optgroups: Concurso (CEBRASPE/CESPE, FGV, VUNESP, FCC, CESGRANRIO, IBFC, FUJB, OAB, TJ/SP, TRT, MPU, TRE, TCU, PF/PRF, Outra), ENEM, Vestibulares Medicina (FUVEST, UNICAMP, UNIFESP, USP, ENEM Med, UECE Med, UERJ Med, UNESP Med), Outros (ITA, IME, UFRGS, UFPR, UFSC, UFRJ, PUC-SP, MACKENZIE).
  - **6 tipos** de redação: Dissertativa-argumentativa, Estudo de caso, Discursiva, Narrativa, Carta argumentativa, Artigo opinativo.
  - **Dropzone** para imagem escaneada (JPG/PNG) ou PDF — envia para `/api/ai/redacao` que faz OCR.
  - **Texto extraído** é colocado no textarea para revisão antes da correção.
  - Textarea Georgia serif grande, com no mínimo 50 caracteres.
  - **Correção** retorna Markdown com seções: Nota Geral, Avaliação por Critério, Comentários por Parágrafo (com citação), Pontos Fortes, Pontos Fracos, Sugestões de Melhoria, Versão Reescrita.
  - **Histórico** clicável (10 últimas correções) — restaura banca+tipo+texto+correção.
  - **MD salvo no Drive** (subpasta `redacoes/`) com YAML front matter (`banca`, `tipo`, `data`, `score`).
  - Dropdowns legíveis em dark mode (`color-scheme:dark` + override CSS).
- **Como usar:** Aba **Redação** → escolha banca → escolha tipo → cole/dropzone o texto → **Corrigir com Meggy**. Veja o resultado renderizado. Clique em correções anteriores para restaurar.
- **Onde aparece:** Aba "Redação" (grupo Materiais). Função: `window.renderRedacao(box)` em `gdi-study.js:2432`. Persistência: `gdi-essay-corrections-v1` (LS) + subpasta `redacoes/` no Drive.

### 1.13 Cronograma (`cronograma`)
- **O que faz:** Cronograma de estudos em texto — lista tarefas por dia (estudo, revisão, simulado), editável. Cada tarefa tem nome, tipo, data.
- **Como usar:** Aba **Cronograma** → **Adicionar tarefa** → preencha. Use o botão **Reset** para limpar.
- **Onde aparece:** Aba "Cronograma" (grupo Planejar). Função: `renderCronograma(box)` em `gdi-study.js:475`. Persistência: `gdi-cronograma-v1`.

### 1.14 Estatísticas (`stats`)
- **O que faz:** Estatísticas de uso: streak, horas estudadas, aulas assistidas, flashcards estudados, simulados feitos, **heatmap de atividade** (grid de dias coloridos por intensidade — `width:100%` com `grid-template-columns:repeat(auto-fill,minmax(13px,1fr))`), distribuição por curso.
- **Como usar:** Aba **Estatísticas** → veja os gráficos automaticamente.
- **Onde aparece:** Aba "Estatísticas" (grupo Planejar). Função: `renderStats(box)` async em `gdi-study.js:1851`. Dados: `/userstate` + `gdi-watch-v1` + `gdi-cards-studied-count` + `gdi-simulados-count`.

### 1.15 Mapa dos Fracos (`radar`)
- **O que faz:** Substituiu o SVG radar por **tiles retangulares ligados a Meus Cursos** — cada tile = 1 matéria com: % de acerto grande, breakdown acertos/erros/total, barra de progresso, **borda esquerda colorida** (vermelho <40%, amarelo 40–60%, verde 60–80%, verde escuro >80%). Box "Foque em" lista matérias <60%. Box "Aulas menos estudadas no cronograma" extrai do `gdi-cronograma-v1`. Contador de trilhas. Click no tile → navega para Questões filtrada pela matéria.
- **Como usar:** Aba **Mapa de Fracos** → veja matérias em vermelho/amarelo → clique para treinar questões daquela matéria.
- **Onde aparece:** Aba "Mapa de Fracos" (grupo Planejar). Função: `window.renderRadar(box)` em `gdi-study.js:2514`. Dados: `gdi-questions-v1`, `gdi-q-srs-v1`, `gdi-cronograma-v1`, `gdi-trails-v1`, `collectCourses()`.

### 1.16 Conquistas (`achievements`)
- **O que faz:** Sistema de gamificação com 12 marcos: 🎬 Primeira aula, 🔥 3 dias seguidos, ⚡ Semana completa, 🏆 Mês de ferro, 🃏 50/100/500 flashcards, 🎯 Primeiro simulado, 📊 5 simulados, ⭐ Meta batida, ✨ Criou um card, 📋 Primeiro resumo. Desbloqueio automático ao atingir condição + toast comemorativo.
- **Como usar:** Aba **Conquistas** → veja desbloqueadas vs. bloqueadas. Você desbloqueia automaticamente ao usar a plataforma.
- **Onde aparece:** Aba "Conquistas" (grupo Planejar). Função: `renderAchievements(box)` em `gdi-study.js:1220`. Defs em `window.gdiAchievements._defs` (12 itens). Persistência: `gdi-achievements-v1`.

### 1.17 Adicionar matéria (`addmateria`)
- **O que faz:** Aba que abre o **modal de navegação do Drive** para adicionar uma matéria vinculada a uma pasta do Drive. Mescla funcionalidades do modal Adicionar Curso com foco em matérias.
- **Como usar:** Aba **Adicionar matéria** → navegue até a pasta do Drive → clique **✓ Adicionar matéria**.
- **Onde aparece:** Aba "Adicionar matéria" (grupo Materiais). Handler: `window.__gdiAddSubjectFromButton(btn)` em `gdi-study.js:1687`.

### 1.18 Batalhão IA (background)
- **O que faz:** Indicador visual no cabeçalho da Área do Aluno. Mostra quando o Batalhão de IA está ativo, com texto "Batalhão escaneando..." (active) ou "Meggy gerando materiais..." (generating). Atualizado via `window.gdiUpdateBattalionStatus(status)`.
- **Como usar:** Aparece automaticamente ao adicionar um curso. Some quando termina.
- **Onde aparece:** Badge `#gdi-battalion-badge` no header do painel. CSS: `@keyframes gdi-pulse`.

---

## 2. Navegador de Drive (modal Adicionar Curso/Matéria)

Modal full-screen com layout de 3 painéis:
- **Esquerda:** árvore de pastas do Drive (collapsible, com ícones de pasta)
- **Centro:** lista de arquivos da pasta atual (PDFs contados automaticamente)
- **Direita:** info do curso selecionado + botão **✓ Selecionar esta pasta** (inline onclick) ou **✓ Adicionar** (rodapé)

**Fluxo do Adicionar Curso:**
1. Abra Área do Aluno → **Meus Cursos** → **Adicionar curso**.
2. Navegue até a pasta do curso no Drive.
3. Clique **✓ Selecionar esta pasta** (inline) ou role até o rodapé e clique **✓ Adicionar**.
4. Ambos chamam `window.gdiAddCourseFromButton(btn)` → `window.gdiAddCourseFromDrive(coursePath, courseName, pdfCount)`.
5. A função salva em `gdi-manual-courses-v1` (LS) + `POST /api/courses/add` (Drive `general_courses.json`) → dispara `window.gdiIsaPdf.startBattalion(coursePath, coursePath, courseName, [])` (background não-bloqueante).
6. Toast: "Curso adicionado! 🐩 Batalhão de IA iniciando em background..."
7. Modal fecha + lista de cursos re-renderiza.

**Event delegation:** Captura global de clicks no botão `#gdi-amc-select-current` em capture phase (fallback máximo caso inline onclick seja bloqueado por CSP).

**Arquivos:** `gdi-study.js` linhas 2179–2299 (modal) + 724–820 (gdiAddCourseFromDrive global) + 2421–2455 (gdiAddCourseFromButton alias). Event delegation: `__gdiAddCourseDelegationAttached` (document, capture phase).

---

## 3. Player de Vídeo — Modos

O player de vídeo (Plyr/VideoJS/DPlayer/JWPlayer/native) tem **4 modos de visualização** controlados por botões na slot `.gdi-slot-modes` acima do player:

| Modo | Classe no body | Botão | Comportamento |
|---|---|---|---|
| **Normal (Split)** | (default) | 🪟 `Dividido` | Tela dividida: vídeo à esquerda + materiais à direita (grid 58fr/42fr) |
| **Foco na aula** | `gdi-fv` | ⚡ `Foco na aula` | Vídeo ocupa 100% largura, painel de materiais oculto |
| **Foco no material** | `gdi-fm` | 📄 `Foco no material` | Apenas materiais (PDF), vídeo oculto, zoom automático 150% |
| **Fullscreen** | `:fullscreen` | (nativo do player) | Vídeo preenche 100vw×100vh, `object-fit:contain!important` — sem barras pretas |

Há também o botão **👁 Assistido** (toggle manual para marcar aula como assistida, ao lado dos modos).

**Fix crítico de fullscreen:** CSS injetado em `gdi-ui.js:42-93` força `width:100%!important; height:100%!important; max-height:none!important; object-fit:contain!important` em todos os players (Plyr, VideoJS, DPlayer, JWPlayer, native) quando em `:fullscreen` (e variantes webkit/moz/ms). Antes, `.gdi-player-wrap video { max-height:78vh }` do `app.min.js:1464` continuava ativo em fullscreen, deixando barra preta embaixo.

Persistência: `gdi-study-mode` (LS) — `split` | `fv` | `fm`.

---

## 4. Widget da Meggy 🐩 (Chat AI)

Botão flutuante (FAB) no canto inferior direito com avatar SVG da poodle. Abre painel de chat `#gdi-ai-panel` (380px×540px, glassmorphism).

**Backends (prioridade):**
1. **IA do navegador** (Chrome Prompt API / Gemini Nano via `ai.languageModel` — 100% local, funciona offline após download). Detectado via `detectBrowserAI()`.
2. **POST `/api/ai`** (worker.js) — chama `handleAi()` que tenta em ordem: NVIDIA NIM → Meggy (Zhipu GLM-4-Flash) → CF Workers AI → OpenAI. Cada backend tem timeout 45s (AbortController).

**Features:**
- Avatar SVG da Meggy + tag "— a poodle tutora"
- Status dinâmico (verde = online; teal = local; amarelo = baixando modelo)
- Conversa persistida em `sessionStorage` (`gdi-ai-chat`, últimas 20 msgs)
- Render Markdown sanitizado (`gdiSanitize` + DOMPurify)
- Indicador de "digitando..." (3 bolinhas pulsantes)
- Badge de notificação não-lida no FAB (pulsante)
- Auto-após 1ª interação não mostra hint novamente (`gdi-ai-seen` em sessionStorage)
- Persistência de estado aberto/fechado (`gdi-meggy-open` em sessionStorage)
- UI no `<html>` (fora do body) — sobrevive a trocas de página

**Rate limit:** 30 msgs/hora por usuário (ou `'anon'` se deslogado). Map `globalThis.__MEGGY_RATE` (per-isolate, não persiste entre restarts do worker).

**Anti-abuso:** Detecta prompt injection, pedidos de senha/API key/código fonte/URLs internas/web scraping/vulnerabilidades → recusa com escalada (1ª: recusa educada, 2ª: avisa sobre bloqueio, 3ª: ameaça bloqueio permanente).

**System prompt:** Define Meggy como "poodle fofinha e tutora de estudos brasileira, docemente protetora, firme quanto à segurança" — só responde sobre estudos, sempre responde em português, usa emojis (🐩, 📚, ✨, 💡), motiva: "Você consegue! Vamos juntos! 🐩".

**Arquivo:** `gdi-meggy.js` linhas 2111–2519 (M-AI widget).

---

## 5. Pomodoro

Botão na navbar (ao lado do alternador de tema) com ícone 🍅 + tempo restante. Abre painel dropdown `#gdi-pom-panel` (260px).

**Features:**
- Display grande 46px do tempo restante (`MM:SS`)
- Barra de progresso colorida (coral = foco, verde = pausa, roxo = pausa longa)
- 4 dots indicando sessões completas (1 a `cfg.sessions`, padrão 4)
- Botões: ▶ Iniciar/Pausar, ⏭ Pular fase, ↺ Reset
- Config: 🍅 Foco (1–90 min, padrão 25), ☕ Pausa curta (1–30 min, padrão 5), 🛋 Pausa longa (1–60 min, padrão 15), 🔁 Sessões p/ longa (1–10, padrão 4), ▶ Auto-iniciar próxima fase (checkbox)
- Aviso sonoro (Web Audio API, beep 880Hz escalonado nos últimos 10s, alarme de 3 notas ao fim)
- Flash de tela colorido ao trocar de fase
- Notificação nativa do navegador (se permitida)
- Título da aba mostra tempo restante + emoji durante o running
- Persistência: `gdi-pom-cfg-v2` (config) + `gdi-pom-state-v2` (estado atual)
- Só aparece quando há mídia (vídeo/áudio) na página

**Arquivo:** `gdi-ui.js` M12, linhas 363–555.

---

## 6. Modo Descanso

Botão flutuante (🌙) no canto inferior esquerdo, só visível quando há player de vídeo/áudio OU quando em fullscreen (caso o fullscreen não seja o vídeo, ex.: PDF em fullscreen).

**Comportamento:**
- Clique no botão → overlay preto 97% opacidade cobre a tela inteira (transição 2.5s) — só o áudio continua tocando.
- Botão vira ☀️ — clique para sair.
- Sai automaticamente com qualquer movimento do mouse/teclado/toque (após 2.5s de grace period pós-ativação).
- Sai automaticamente quando o vídeo termina (`ended` event).
- Desativa automaticamente se sair do fullscreen enquanto dormindo.
- UI no `<html>` (fora do body) com `z-index:2147483000` (máximo).

**Arquivo:** `gdi-ui.js` M11 v3.2, linhas 280–360.

---

## 7. Sistema de Senhas de Pastas

Pastas do Drive podem ser protegidas por senha (arquivo `.password` dentro da pasta). O GDI Extras gerencia isso com:
- `gdiSetPw(path, password)` — salva senha criptografada (XOR + base64) em `gdi_pw_<base64(path)>`
- `gdiGetPw(path)` — recupera senha
- Migração automática de chaves antigas `password<path>` → novo formato
- Flag `gdi_pw_migrated` após migração

**Como usar:** Ao abrir uma pasta protegida, digite a senha — ela fica memorizada para próximas visitas. As senhas ficam só no navegador do usuário (não no servidor).

**Arquivo:** `gdi-core.js` M1, linhas 344–360.

---

## 8. Tema Claro/Escuro

Toggle na navbar (botão com ícone 🌙/☀️) e FAB flutuante `gdi-theme-fab` no canto superior direito (em páginas estáticas como login/404).

**Como funciona:**
- Atributo `data-bs-theme` em `<html>` com valor `dark` (default) ou `light`
- Persistência: `gdi-theme` no localStorage
- CSS variables `--ferreto-*` definidas em 3 lugares (drift risk): `worker.js:138`, `app.min.js:1151`, `gdi-study.js:2550` (BlackTie)
- Função `gdiToggleTheme()` injetada em todas as páginas
- Carregamento imediato (inline script no `<head>`) para evitar flash de tema errado
- Override de estilos inline hardcoded (ex.: `color:#8b949e` → `var(--ferreto-text-muted)`) via CSS attribute selectors em `.gdi-central-box`

**Paleta Ferreto:**
- Primary: `#ff8b9f` (coral)
- Secondary: `#5ddeda` (teal)
- Accent: `#c026d3` (magenta)
- Gradiente: `linear-gradient(135deg, #ff8b9f 0%, #c026d3 55%, #5ddeda 130%)`

---

## 9. Atalhos de Teclado

| Tecla | Ação | Onde |
|---|---|---|
| `C` | Abrir/fechar Área do Aluno | Global |
| `Esc` | Fechar painel/modal | Global |
| `N` | Próxima aula (botão próximo) | Player |
| `P` | Aula anterior (botão anterior) | Player |
| `J` | Pular para próxima aula **não-assistida** da playlist | Player |
| `]` | Pular para próxima anotação (modo revisão) | Player |
| `[` | Pular para anotação anterior | Player |
| `Space` | Flip do flashcard atual (em sessão de cards) | Área do Aluno |
| `1` | Grade "Sabia" no flashcard | Área do Aluno |
| `2` | Grade "Quase" no flashcard | Área do Aluno |
| `3` | Grade "Fácil" no flashcard | Área do Aluno |
| Duplo-toque (mobile) | Avança/retrocede 10s no vídeo | Player (mobile) |

**Proteção:** Atalhos são desativados quando o foco está em `INPUT`, `TEXTAREA` ou `contentEditable`, ou quando Ctrl/Meta/Alt estão pressionados.

**Arquivo:** `gdi-core.js` M4, linhas 380–430.

---

## 10. Batalhão de IA (Background)

Quando o aluno **adiciona um curso**, o frontend dispara `POST /api/ai/battalion` (não-bloqueante via `event.waitUntil`). O worker então:

1. **Verifica cache ISA** — se o curso já foi processado (`battalionDone:true`), pula.
2. **Escaneia o `coursePath` no Drive** se `pdfList` estiver vazio — chama `drive0.request_list_of_files(coursePath, null, 0)`, filtra PDFs (incluindo subpastas com 1 nível de profundidade).
3. **Para cada PDF:** baixa o conteúdo (até 15.000 chars), dispara **3 chamadas paralelas** (race no OpenRouter com 3 modelos free; fallback para `callUnifiedAi`):
   - `battalionGenSummary` — gera resumo didático em Markdown com **detecção de leis desatualizadas** (Lei 8.666/1993 → 14.133/2021, CPC 1973 → 2015, etc.). Salva em `cache[keyPrefix].summary`, subpasta `resumos/`, e em `brain/` (memória persistente da Meggy em MD).
   - `battalionGenPills` — gera 15 pílulas de revisão em bullets Markdown (focadas em diferenças old vs new se desatualizado). Salva em `cache[keyPrefix].mindmap` e subpasta `pilulas/`.
   - `battalionGenQuestions` — se NÃO desatualizado, gera 10 questões JSON com `statement`, `options`, `correct`, `correctText`, `legalText`, `explanation`, `fundamentacao`. Salva em `cache[keyPrefix].questions`, subpasta `questoes/`, gera cards em `cards/` e um minissimulado de 5 questões em `simulados/`. Se desatualizado, **PULA** (aluno não deve treinar lei errada).
4. **Salva marcador** `battalionDone:true` + `battalionDate:Date.now()` no cache ISA.
5. **Compartilha** o primeiro resumo no pool `isa_shared_summaries.json` (com anti-clobber: só remove entradas do MESMO autor + mesmo lessonName).

**Frontend feedback:** `window.gdiUpdateBattalionStatus('active'|'generating')` controla o badge no header da Área do Aluno.

**Status check:** `GET /api/ai/battalion/status?courseKey=X` retorna `{ok, processed, hasSummary, hasQuestions, date}`.

**Arquivo:** `worker.js` linhas 2147–2383 (handleBattalion, runBattalionInBackground, battalionGen*). Frontend: `gdi-meggy.js:1900-1918` (startBattalion, getBattalionStatus).

---

## 11. Redação (Correção por Banca)

Já coberto em detalhe na seção 1.12. Resumo técnico do fluxo:

1. **Frontend** (`renderRedacao` em `gdi-study.js:2432`): monta prompt com critérios da banca específica (30+ bancas com descrições detalhadas) + seções Markdown padronizadas.
2. **Backend** (`handleRedacaoCorrect` em `worker.js:887`): aceita JSON `{text, banca, tipo}` OU multipart/form-data com `file` (imagem/PDF escaneado). Para PDFs usa pdf.js local; para imagens retorna erro (OCR não disponível até binding `@cf/llava`).
3. **AI call** via `callUnifiedAi` (OpenRouter race → Zhipu → NVIDIA → OpenAI → CF AI).
4. **Extrai nota** via regex `/nota\s*geral\s*:?\s*(\d+[,.]?\d*)/i`.
5. **Monta MD** com YAML front matter (`banca`, `tipo`, `data`, `score`) + redação original + correção.
6. **Salva** no Drive (subpasta `redacoes/`) via `gdiSaveEssayMD` → `gdiSaveMaterialToSubfolder(gd0, folderId, 'redacoes', fileName, md)`.

---

## 12. Materiais — Como São Gerados e Salvos

A tabela abaixo mostra cada tipo de material, **quem gera**, **onde é salvo (cliente + servidor)** e **qual aba consome**:

| Material | Gerado por | Cliente (LS) | Servidor (Drive) | Aba que consome |
|---|---|---|---|---|
| **Resumo IA** | `battalionGenSummary` ou `gdiIsaPdf.summary()` (on-demand) | `gdi-isa-summaries-v1` (cap 200) | `isa_cache.json` + subpasta `resumos/*.md` + `isa_shared_summaries.json` (pool) | Resumos |
| **Pílulas** | `battalionGenPills` ou `gdiIsaPdf.mindmap()` (on-demand) | `gdi-isa-summaries-v1[*].mindmap` | `isa_cache.json` + subpasta `pilulas/*.md` | (interna M9) |
| **Questões** | `battalionGenQuestions` ou `gerarViaISA()` em `renderQuestoes` | `gdi-questions-v1` | `isa_cache.json` + subpasta `questoes/*.json` + `isa_shared_flashcards.json` (kind=question) | Questões, Simulado |
| **Flashcards** | Derivado das questões geradas + cards manuais do aluno | `gdi-cards-v1` (cap 1500) | subpasta `cards/*.json` + `isa_shared_flashcards.json` (kind=card) | Flashcards |
| **Minissimulado** | `battalionGenQuestions` cria 1 simulado de 5 questões por PDF | `gdi-simulados-v1` | subpasta `simulados/*.json` | Simulado |
| **Redação corrigida** | `handleRedacaoCorrect` + `gdiSaveEssayMD` | `gdi-essay-corrections-v1` | subpasta `redacoes/*.md` | Redação |
| **Brain (memória MD)** | Toda geração do batalhão também anexa em `brain/` | — | subpasta `brain/*.md` | (interna Meggy) |
| **Anotações** | Aluno digita no painel "Minhas anotações" | (`GDIUser.notes`) | `userstate.json` do aluno (em `/userstate/save`) | Player |
| **Resume (posição do vídeo)** | Auto a cada 5s + em pausa/visibilitychange | (`GDIUser.resume`) | `userstate.json` | Player |

**Localização das subpastas:** Todas dentro da **pasta individual do aluno** no Drive 0, subpasta "AULAS - ESTADO DOS ALUNOS". Cada subpasta é criada sob demanda na primeira gravação.

---

# 📘 PARTE 2 — MANUAL TÉCNICO

## 1. Estrutura de Arquivos

```
gdi_extras/
├── worker.js              (3.161 linhas, ~162 KB) — Cloudflare Worker backend
├── core/
│   └── app.min.js         (1.585 linhas, ~99 KB) — Host platform (GDI v19, jQuery+Bootstrap SPA)
├── modular/
│   ├── gdi-extras-loader.js  (98 linhas, 3,5 KB)  — Carregador (jsDelivr)
│   ├── gdi-core.js           (1.009 linhas, 58 KB) — Bootstrap + M1-M7 + M9 (materiais)
│   ├── gdi-pdf.js            (98 linhas, 5,5 KB)  — Visualizador de PDF (pdf.js) mobile-friendly
│   ├── gdi-ui.js             (1.334 linhas, 64 KB) — M10-M20 (modos foco, pomodoro, playlist)
│   ├── gdi-meggy.js          (2.519 linhas, 129 KB) — M9-ISA (extração PDF + geração conteúdo) + M-AI (chat widget)
│   └── gdi-study.js          (3.902 linhas, 188 KB) — M22 Central de Estudos + M23 Questões/Simulados/Cronograma/Revisões + M24 Provas/Redação/Radar + BlackTie + M-PLAYER-GUARD
├── ARVORE_PROCESSOS.html    (363 linhas) — Visualização gráfica da árvore de processos
├── RESUMO_EXECUTIVO.md      (246 linhas) — Resumo pós-análise
└── REVISAO_EXECUTIVA.md     (142 linhas) — Revisão pós-análise (3×3 passadas)
```

### 1.1 Padrão de código
- **IIFEs** com `window.GDI_MODULES.push({name, init})` para auto-registro
- **Bus global** (`Bus.on` / `Bus.onGlobal` / `Bus.emit` / `Bus.reset`) para comunicação inter-módulos — `reset()` remove listeners de escopo `'page'` mas mantém `'global'`
- **localStorage** para persistência client-side (chaves `gdi-*-v1` ou `gdi-*-v2`)
- **Drive REST API** (v3) via OAuth refresh-token hardcoded em `authConfig`, com pasta compartilhada `AULAS - ESTADO DOS ALUNOS` para estado — NÃO usa R2
- **CSS variables** `--ferreto-*` definidas em 3 lugares (drift risk): `worker.js:138`, `app.min.js:1151`, `gdi-study.js:2550` (BlackTie)

### 1.2 Fluxo de carga
1. Browser carrega `app.min.js` (host) — injetado pela função `html()` do worker.js com tag `<script src="/app.min.js?v=13">`
2. `app.min.js` chama `init()` → renderiza navbar + content + injeta `<script src="/gdi-extras.js">`
3. Worker responde `/gdi-extras.js` buscando `gdi-extras-loader.js` em `CUSTOM_EXTRAS_SOURCES` (raw.githubusercontent.com)
4. Loader (`gdi-extras-loader.js`) baixa `gdi-core.js` primeiro (síncrono), depois os 5 módulos restantes em paralelo (Promise.allSettled) via jsDelivr
5. `gdi-core.js` IIFE inicializa `GDI_MODULES` (array), `Bus`, `showToast`, helpers SRS, e dispara `MutationObserver` para re-init em SPA via `Bus.onGlobal('page:change', schedule)`
6. Cada módulo empurra `{name, init}` em `GDI_MODULES` — o scheduler (debounce 150ms) chama `m.init()` em todos

### 1.3 Cache-busting
`gdi-extras-loader.js:17` usa `CACHE_VERSION = Date.now()` (invalida a cada refresh). Antes era string `'3'` que exigia bump manual.

---

## 2. Endpoints do Worker (TODOS)

O worker.js escuta em `addEventListener('fetch', event => event.respondWith(handleRequest(event.request, event)))`. Rotas são despachadas dentro de `handleRequest()` (linha 1274).

### 2.1 Endpoints Estáticos / Sistema

| Método | Path | Handler | Auth | Descrição |
|---|---|---|---|---|
| GET | `/sw.js` ou `/gdi-sw.js` | (inline template) | — | Retorna o Service Worker (PWA offline) |
| GET | `/app.min.js` | (fetch CUSTOM_APP_SOURCES) | — | Busca app.min.js customizado em GitHub raw |
| GET | `/gdi-extras.js` | (fetch CUSTOM_EXTRAS_SOURCES) | — | Busca loader modular em GitHub raw |
| GET | `/login` | `login_html()` | — | Página de login HTML |
| POST | `/login` | (inline em handleRequest) | — | Login: valida user/pass, seta cookie `session` |
| POST | `/signup` | (inline em handleRequest) | — | Cadastro: valida, cria hash SHA-256+salt, salva em `.gdi_users.json` no Drive 0 |
| GET | `/logout` | (inline) | cookie | Limpa cookie + redirect `/login` |
| GET | `/google_callback` | (inline) | — | OAuth Google callback |
| GET | `/admin` | `handleAdmin(request, url)` | ADMIN_USERS | Painel do professor (lista alunos, stats, anotações) |
| GET | `/api/ai/models` | (inline) | — | Diagnóstico: lista modelos NVIDIA NIM disponíveis |
| GET | `/api/ai/stats` | (inline) | — | Diagnóstico: latência/falhas por modelo |
| GET | `/api/ai/status` | (inline) | — | Diagnóstico: `{enabled, provider}` |

### 2.2 Endpoints de Estado do Usuário

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| GET | `/userstate` | `handleUserStateGet(request)` (worker.js:677) | cookie | — | JSON do `userstate.json` do aluno (ou `{}`) |
| POST | `/userstate/save` | `handleUserStateSave(request)` (worker.js:691) | cookie | body=JSON do estado (max 512 KB) | `{ok: boolean}` |

### 2.3 Endpoints de Cache ISA (Resumos/Questões por Aula)

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| GET | `/api/ai/cache` | `handleIsaCacheGet(request, url)` (worker.js:768) | cookie | `?key=<lessonPath>` | `{ok, cached: {summary, questions, mindmap, lessonName, date, battalionDone, outdated}}` |
| POST | `/api/ai/cache` | `handleIsaCacheSave(request)` (worker.js:781) | cookie | body=`{key, summary, questions, mindmap, lessonName}` | `{ok}` (cap 200, LRU) |
| GET | `/api/ai/cache/list` | `handleIsaCacheList(request)` (worker.js:752) | cookie | — | `{ok, entries: [{key, lessonName, hasSummary, hasQuestions, hasMindmap, outdated, battalionDone, date}], total}` |
| OPTIONS | `/api/ai/cache` | (inline CORS) | — | — | 204 |

### 2.4 Endpoints de Resumos/Flashcards Compartilhados

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| GET | `/api/ai/shared-summaries` | `handleSharedSummariesGet(request, url)` (worker.js:843) | cookie | `?lesson=<filter>` (opcional) | `{ok, summaries: [{lessonName, summary, questions, author, date}]}` (últimos 100, LRU 500) |
| POST | `/api/ai/shared-summaries` | `handleSharedSummariesSave(request)` (worker.js:856) | cookie | body=`{lessonName, summary, questions}` | `{ok}` — anti-clobber por autor+lessonName |
| OPTIONS | `/api/ai/shared-summaries` | (inline CORS) | — | — | 204 |
| GET | `/api/ai/shared-flashcards` | `handleSharedFlashcardsGet(request, url)` (worker.js:1064) | cookie | `?subject=<filter>&kind=question\|card` | `{ok, items: [...]}` (últimos 200, LRU 1000) |
| POST | `/api/ai/shared-flashcards` | `handleSharedFlashcardsSave(request)` (worker.js:1078) | cookie | body=`{subject, front, back, statement, options, correct, explanation, legalText, fundamentacao, type}` | `{ok}` — anti-clobber por autor+front |
| OPTIONS | `/api/ai/shared-flashcards` | (inline CORS) | — | — | 204 |

### 2.5 Endpoints do Batalhão de IA

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| POST | `/api/ai/battalion` | `handleBattalion(request, event)` (worker.js:2147) | cookie | body=`{courseKey, coursePath, lessonName, pdfs: [{name, url, text}]}` | `{ok:true, message:'Batalhão iniciado em background', courseKey, pdfs: <n>}` — dispara `event.waitUntil(runBattalionInBackground(...))` |
| GET | `/api/ai/battalion/status` | `handleBattalionStatus(request, url)` (worker.js:2532) | cookie | `?courseKey=<X>` | `{ok, processed: bool, hasSummary: bool, hasQuestions: bool, date}` |
| OPTIONS | `/api/ai/battalion` | (inline CORS) | — | — | 204 |

### 2.6 Endpoints de Redação

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| POST | `/api/ai/redacao` | `handleRedacaoCorrect(request)` (worker.js:887) | cookie | JSON `{text, banca, tipo}` OU multipart/form-data com `file` + `mode=ocr` + `banca` + `tipo` | `{ok, correction: <Markdown>, score}` |
| POST | `/api/ai/essay/save` | `handleEssaySave(request)` (worker.js:969) | cookie | body=`{markdown, banca, tipo, score}` | `{ok}` — salva MD na subpasta `redacoes/` |
| OPTIONS | `/api/ai/redacao` | (inline CORS) | — | — | 204 |
| OPTIONS | `/api/ai/essay/save` | (inline CORS) | — | — | 204 |

### 2.7 Endpoints de Brain (Memória MD da Meggy)

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| GET | `/api/brain/list` | `handleBrainList(request, url)` (worker.js:1101) | cookie | `?q=<filter>` (opcional, busca por nome) | `{ok, items: [{id, name, mimeType, modified, size}], total}` |
| POST | `/api/brain/save` | `handleBrainSave(request)` (worker.js:1124) | cookie | body=`{markdown, fileName}` | `{ok}` — salva MD na subpasta `brain/` |
| OPTIONS | `/api/brain/list`, `/api/brain/save` | (inline CORS) | — | — | 204 |

### 2.8 Endpoints de Cursos Compartilhados

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| POST | `/api/courses/add` | `handleCourseAdd(request)` (worker.js:2420) | cookie | body=`{coursePath, courseName, pdfCount}` | `{ok, entry, courseCount}` — salva em `general_courses.json` (cap 1000, LRU) |
| GET | `/api/courses/list` | `handleCourseList(request, url)` (worker.js:2455) | cookie | — | `{ok, courses: [{coursePath, courseName, pdfCount, addedAt, users, materialsReady}], total}` — só cursos do usuário OU públicos |
| OPTIONS | ambos | (inline CORS) | — | — | 204 |

### 2.9 Endpoint de Materiais (Subpastas)

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| GET | `/api/materials/list` | `handleMaterialsList(request, url)` (worker.js:2470) | cookie | `?kind=<resumos\|cards\|pilulas\|questoes\|simulados>&course=<filter>` (opcional) | `{ok, items: [{id, name, mimeType, modified, size, kind, downloadUrl}], total}` |
| OPTIONS | `/api/materials/list` | (inline CORS) | — | — | 204 |

### 2.10 Endpoint Principal de IA (Chat Meggy)

| Método | Path | Handler | Auth | Params | Resposta |
|---|---|---|---|---|---|
| POST | `/api/ai` | `handleAi(request)` (worker.js:2551) | cookie (ou anon) | body=`{message, messages: []}` (max 10 msgs de histórico) | `{ok, response, provider, model, latency_ms}` ou `{ok:false, error, errors[], hint}` (502) ou 429 se rate limit |
| OPTIONS | `/api/ai` | (inline CORS) | — | — | 204 (headers extras: `X-Key-Hint`) |

### 2.11 Endpoints Herdados do GDI v19 (Drive Index)

Estes fazem parte do GDI-JS original (não do Extras), mas o worker os serve:

| Método | Path | Handler | Descrição |
|---|---|---|---|
| POST | `/<driveId>:<path>` (folders) | `apiRequest(request, gd, user_ip)` | Lista arquivos da pasta (com paginação, senhas, IDs criptografados) |
| POST | `/<driveId>:search` | `handleSearch(request, gd, user_ip)` | Busca arquivos por nome |
| POST | `/<driveId>:id2path` | `handleId2Path(request, gd)` | Converte ID criptografado → path |
| GET | `/<driveId>:id2path?id=<encId>&view=<bool>` | `findId2Path(gd, url)` | Redirect 302 para path |
| GET | `/download.aspx?id=<encId>&m=<mime>` | `download(id, range, inline, exportFmt)` | Download/export de arquivo (suporta Range, GDOC exports, inline) |
| GET | `/0:/` | (render list) | Lista raiz do Drive 0 |
| GET | `/<driveId>:/<path>/<file>` | `file(path)` | Abre arquivo (player/listagem) |

### 2.12 Bindings do Cloudflare Worker

```toml
# wrangler.toml (presumed)
[vars]
ENV = "..."                    # Não usado — apenas para ENV namespace

# Secrets (via wrangler secret put)
ZHIPU_API_KEY = "..."          # Meggy (BlackTie) GLM-4-Flash
NVIDIA_API_KEY = "..."         # NVIDIA NIM (multi-key: NVIDIA_API_KEY_2..10)
NVIDIA_API_URL = "..."         # override endpoint (default integrate.api.nvidia.com/v1/chat/completions)
NVIDIA_MODELS = "..."           # CSV de modelos preferidos
OPENAI_API_KEY = "..."          # OpenAI compat (gpt-4o-mini default)
OPENAI_API_URL = "..."          # override
OPENROUTER_API_KEY = "..."     # OpenRouter (race entre free models)
AI_API_KEY = "..."              # alias para ZHIPU
AI_MODEL = "..."               # alias de modelo
CRYPTO_BASE_KEY = "..."        # chave AES-CBC para encryptString (cookie session)
HMAC_BASE_KEY = "..."          # chave HMAC para genIntegrity

# Bindings
[[r2_buckets]]                  # NÃO USA R2 (usa Drive REST)
[[d1_databases]]                # Opcional se login_database='d1'
[[kv_namespaces]]               # Opcional: sessions, rate-limit, ip-changed
[ai]
binding = "AI"                  # Opcional: Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct)
```

Acessados no worker como `globalThis.ZHIPU_API_KEY`, `globalThis.NVIDIA_API_KEY`, `globalThis.AI` (binding), etc.

---

## 3. localStorage Keys (TODAS)

| Chave | Tipo | Estrutura | Cap | Default | Arquivo |
|---|---|---|---|---|---|
| `gdi-theme` | string | `'dark'` \| `'light'` | — | `'dark'` | app.min.js:47, worker.js:219 |
| `gdi-rate` | string | número `'1.5'` (0.25–4) | — | — | gdi-core.js M3 |
| `gdi-study-mode` | string | `'split'` \| `'fv'` \| `'fm'` | — | `'split'` | gdi-ui.js:247,255 |
| `gdi-resume-v2` | JSON | `{<path>: {t, d, at}}` | — | — | app.min.js:929 (migrado) |
| `gdi-resume-migrated` | string | `'1'` | — | — | app.min.js:941 |
| `gdi_pw_<base64(path)>` | string | base64(XOR(path, salt) + path) | — | — | gdi-core.js M1 |
| `gdi_pw_migrated` | string | `'1'` | — | — | gdi-core.js M1 |
| `gdi-questions-v1` | JSON | `[{id, subject, statement, options[], correct, explanation, source, createdAt, hits, misses}]` | — | `[]` | gdi-study.js:24 (`LQ`) |
| `gdi-q-srs-v1` | JSON | `{<qId>: {box: 0-4, due, last}}` | — | `{}` | gdi-study.js:24 (`LS_SRS`) |
| `gdi-simulados-v1` | JSON | `[{title, date, questions[], source, ...}]` | — | `[]` | gdi-study.js:24 (`LS_SIM`) |
| `gdi-simulados-count` | string | número | — | `'0'` | gdi-study.js:509 |
| `gdi-cronograma-v1` | JSON | `{plan: [{name, type, date, ...}]}` | — | `null` | gdi-study.js:24 (`LS_CRON`) |
| `gdi-caderno-erros-v1` | JSON | `[<qId>, ...]` | — | `[]` | gdi-study.js:24 (`LS_ERR`) |
| `gdi-cards-v1` | JSON | `[{id, f, b, subject, type, box, due, lastReview, createdAt}]` | 1500 | `[]` | gdi-study.js:662 (`LS_CARDS`) |
| `gdi-cards-studied-count` | string | número | — | `'0'` | gdi-meggy.js:1792 |
| `gdi-goal-min` | string | número (10–480) | — | `'60'` | gdi-study.js:662 (`LS_GOAL`) |
| `gdi-watch-v1` | JSON | `{<YYYY-MM-DD>: <seconds>}` | — | `{}` | gdi-study.js:662 (`LS_WATCH`) |
| `gdi-marathon` | string | `'true'` \| `'false'` | — | `false` | gdi-study.js:662 (`LS_MAR`) |
| `gdi-marathon-intro` | string | `'true'` \| `'false'` | — | `true` | gdi-study.js:662 (`LS_MARINTRO`) |
| `gdi-hidden-courses-v1` | JSON | `[<coursePath>, ...]` | — | `[]` | gdi-study.js:662 (`LS_HIDDEN`) |
| `gdi-manual-courses-v1` | JSON | `[{id, name, icon, color, goal, notes, createdAt, manual, path, courseKey}]` | — | `[]` | gdi-study.js:728, 889, 2323, 2476 |
| `gdi-isa-summaries-v1` | JSON | `[{id, lesson, summary, questions, mindmap, path, subject, date, outdated, lessonKey, coursePath}]` | 200 | `[]` | gdi-meggy.js:25 (`LS_SUM`) |
| `gdi-subjects-v1` | JSON | `[{id, name, icon, color, goal, notes, drivePath}]` | — | `[]` | gdi-meggy.js:793 (`LS_SUBJECTS`) |
| `gdi-trails-v1` | JSON | `[{id, name, description, subjects[], courses[], deadline, progress, createdAt}]` | — | `[]` | gdi-core.js:72 |
| `gdi-achievements-v1` | JSON | `[<achievementId>, ...]` | — | `[]` | gdi-core.js:79 |
| `gdi-pom-cfg-v2` | JSON | `{work, short, long, sessions, autoStart}` | — | `{work:25, short:5, long:15, sessions:4, autoStart:true}` | gdi-ui.js:467 (`CKEY`) |
| `gdi-pom-state-v2` | JSON | `{phase, total, remain, running, dots, endAt}` | — | `{phase:'work', ...}` | gdi-ui.js:468 (`SKEY`) |
| `gdi-exam-plans-v1` | JSON | `[{...plan}]` | — | `[]` | gdi-study.js (renderProvas) |
| `gdi-essay-corrections-v1` | JSON | `[{id, banca, tipo, date, text, correction, score}]` | — | `[]` | gdi-study.js:2432 (renderRedacao) |
| `gdi-playlist-open` | string | `'1'` \| `'0'` | — | — | gdi-ui.js:1156 (`LS_OPEN`) |
| `gdi-hide-watched` | string | `'1'` \| `'0'` | — | — | gdi-ui.js:1156 (`LS_HIDE`) |

### 3.1 sessionStorage Keys

| Chave | Tipo | Estrutura | Arquivo |
|---|---|---|---|
| `gdi-ai-chat` | JSON | `[{role, content}, ...]` (últimas 20) | gdi-meggy.js M-AI |
| `gdi-meggy-open` | string | `'1'` \| `'0'` (estado do painel) | gdi-meggy.js:2442,2446 |
| `gdi-ai-seen` | string | `'1'` (já abriu o FAB — desativa hint) | gdi-meggy.js:2513,2516 |
| `gdi-sort` | JSON | `{col, dir}` (ordenação da lista de arquivos) | app.min.js:195 |

---

## 4. Funções Globais em `window`

### 4.1 API Completa do `window.gdiIsaPdf` (definida em `gdi-meggy.js:1920`)

```js
window.gdiIsaPdf = {
  // Geração on-demand (no painel de Materiais do player)
  summary(items, bodyEl, lessonName),     // gera/exibe resumo da aula
  questions(items, bodyEl, lessonName),   // gera/exibe questões
  mindmap(items, bodyEl, lessonName),     // gera/exibe pílulas
  flashcards(items, bodyEl, lessonName),  // gera/exibe flashcards
  regenerate(matTabsItems, bodyEl, lesson), // força regenerar tudo

  // Extração de texto
  extractPdfText(url),                     // baixa + extrai texto de PDF via pdf.js

  // Persistência local
  saveIsaSummary(summary, questions, mindmap, lesson, lessonKey, coursePath, path, subject), // salva em LS
  listIsaSummaries(),                      // lista do LS
  delIsaSummary(id),                        // remove do LS

  // Pool compartilhado
  fetchSharedSummaries(lessonFilter),      // GET /api/ai/shared-summaries
  saveSharedSummary(lessonName, summary, questions), // POST /api/ai/shared-summaries
  fetchSharedQuestions(subject),           // GET /api/ai/shared-flashcards?kind=question

  // Redação
  saveEssayMD(md, banca, tipo, score),     // POST /api/ai/essay/save

  // Batalhão
  startBattalion(courseKey, coursePath, lessonName, pdfList), // POST /api/ai/battalion
  getBattalionStatus(courseKey)           // GET /api/ai/battalion/status
};
```

### 4.2 Outras funções globais expostas

| Função | Arquivo:linha | Descrição |
|---|---|---|
| `window.gdiAddCourseFromButton(btn)` | gdi-study.js:681 | Handler do botão "Selecionar esta pasta" no modal — extrai path/nome do dataset |
| `window.gdiAddCourseFromDrive(coursePath, courseName, pdfCount)` | gdi-study.js:724 | Salva curso em LS + Drive + dispara batalhão (não-bloqueante) |
| `window.__gdiAddCourseFromButton` | gdi-study.js:2421 | Alias (versão fallback do document delegation) |
| `window.gdiUpdateBattalionStatus(status)` | gdi-study.js:3149 | Atualiza badge no header: `'active'` \| `'generating'` \| null |
| `window.__gdiAddSubjectFromButton(btn)` | gdi-study.js:1687 | Handler do botão "Adicionar matéria" no modal |
| `window.GDI_MODULES` | gdi-core.js:31 | Array de módulos `{name, init}` carregados |
| `window.gdiModal(opts)` | gdi-core.js:124 | Modal customizado (Promise<boolean>): `{title, message, confirmText, cancelText, danger, input}` |
| `window.gdiGradeCard(card, quality)` | gdi-core.js:44 | SM-2 SRS para flashcards: quality 1-4 → `{box, due, lastReview}` |
| `window.gdiSrsIntervals` | gdi-core.js:66 | Array `[1,3,7,21,60]` (intervalos em dias por caixa) |
| `window.gdiTrails` | gdi-core.js:72 | `{LS:'gdi-trails-v1', get(), save(t), delete(id)}` |
| `window.gdiSubjects` | gdi-meggy.js:805 | `{LS:'gdi-subjects-v1', get(), save(s), delete(id)}` |
| `window.gdiAchievements` | gdi-core.js:79 | `{LS:'gdi-achievements-v1', _defs[12], getUnlocked(), isUnlocked(id), unlock(id), checkAll(stats), defs()}` |
| `window.gdiSanitize(html)` | gdi-core.js:182 | Sanitiza HTML (DOMPurify se disponível, senão fallback remove scripts/on*) |
| `window.gdiSetPw(path, v)` / `window.gdiGetPw(path)` | gdi-core.js:348,349 | Senhas de pastas (XOR + base64) |
| `window.gdiRenderAuth()` | gdi-core.js:367 | Renderiza botão Entrar/Sair na navbar |
| `window.gdiReloadExtras` | gdi-extras-loader.js:97 | Re-executa o bootstrap do loader |
| `window.file_pdf(i,e,t,n,a,c)` | gdi-pdf.js:18 | Visualizador de PDF (substitui file_pdf do app.min.js) com pdf.js |
| `window.gdiListAllFiles(path, pw, onPage)` | app.min.js:59 | Lista arquivos de uma pasta (com cache 45s, paginação, 50 páginas máx) |
| `window.gdiNormKey(p)` | gdi-ui.js:1158 | Normaliza path (split `?`, trim) |
| `window.gdiVideoKey()` | gdi-ui.js:1159 | Chave de vídeo para watched/resume |
| `window.gdiMarkVideo()` | gdi-ui.js:1165 | Marca vídeo como assistido |
| `window.gdiUnmarkVideo()` | gdi-ui.js:1170 | Desmarca |
| `window.gdiOkPath(p)` | app.min.js | Valida path (não `/fallback`) |
| `window.__gdiOpenCentral(tab)` | gdi-study.js:1081 | Abre painel da Área do Aluno |
| `window.__gdiParseJsonArray(raw)` | gdi-meggy.js:90 | Parser robusto de JSON array (LLM) — stripp fences, fix trailing commas, parse item-a-item |
| `window.__gdiM6Render` | gdi-core.js:654 | Dispatcher global único para re-render do M6 (notas/marcas) |
| `window.gdiM13Debug()` | gdi-ui.js:807 | Diagnóstico do M13 (continue card) |
| `window.GDIDebug` | gdi-ui.js:1066 | Painel de debug (M18) |
| `window.gdiEnsurePlaylist()` | gdi-ui.js:1295 | Garante UI de playlist |
| `window.renderResumos(box)` | gdi-meggy.js:1940 | Renderiza aba Resumos |
| `window.renderProvas(box)` | gdi-study.js:3196 | Renderiza aba Provas |
| `window.renderRedacao(box)` | gdi-study.js:3294 | Renderiza aba Redação |
| `window.renderRadar(box)` | gdi-study.js:3466 | Renderiza aba Mapa dos Fracos |
| `window.renderQuestoes(box)` | gdi-study.js:101 | Renderiza aba Questões |
| `window.renderSimulado(box)` | gdi-study.js:392 | Renderiza aba Simulado |
| `window.renderCronograma(box)` | gdi-study.js:532 | Renderiza aba Cronograma |
| `window.renderRevisoes(box)` | gdi-study.js:593 | Renderiza aba Revisões |
| `window.__gdiCurrentTab` | gdi-study.js:923 | Variável de estado da aba ativa |
| `window.GDIUser` | app.min.js:900 | Classe singleton de estado do usuário (ver seção 5) |
| `window.Bus` | app.min.js:21 | Event bus global |
| `window.playlistVideos` | app.min.js:623 (fallback) | Array de vídeos da playlist atual |
| `window.currentIndex` | app.min.js | Índice do vídeo atual na playlist |
| `window.switchVideo(i)` | app.min.js:574 | Troca vídeo na playlist |
| `window.drive_names` | app.min.js | Array com nomes dos drives |
| `window.current_drive_order` | app.min.js | Drive atual |

### 4.3 `window.gdiBootstrapCentral`

**Não existe.** A função que injeta o botão **Estudos** na navbar é `injectNavButton()` (closure interna em `gdi-study.js` ~linha 3100), registrada como `GDI_MODULES.push({name:'central-nav', init: injectNavButton})`. Não é exposta no `window`. O bootstrap da Área do Aluno é totalmente automático via `GDI_MODULES`.

---

## 5. Schema do User State (GDIUser)

Definido em `app.min.js:900`. Schema version = `4`. Persistido em `userstate.json` no Drive do aluno (subpasta `AULAS - ESTADO DOS ALUNOS`).

### 5.1 Estado base (EMPTY)

```js
const SCHEMA = 4;
const EMPTY = {
  v: SCHEMA,
  watched: {},     // {<path>: {at: <timestamp>}}    — aulas assistidas
  last: null,      // {path: <string>, at: <timestamp>}  — última aula tocada
  resume: {},      // {<path>: {t: <seconds>, d: <duration>, at: <timestamp>}}  — posição de retomada
  notes: {},       // {<path>: [{t: <seconds>, text: <string>, at: <timestamp>}]}
  history: [],     // [{path, name, at}]  — últimas 12 aulas tocadas (MAX_HISTORY=12)
  intro: {},       // {<coursePath>: <seconds>}  — tempo de intro a pular por curso
  srs: {}          // {<cardId>: {box: 0-3, due: <timestamp>}}  — SRS de flashcards (MAX_SRS=1500)
};
```

### 5.2 Limites
- `MAX_RESUME = 300` (entradas de retomada, LRU por `at`)
- `MAX_HISTORY = 12` (entradas de histórico)
- `MAX_SRS = 1500` (flashcards em SRS, LRU por `due`)
- `MIN_SAVE = 5` (segundos mínimos para salvar posição de retomada — evita lixo)

### 5.3 Migração
`migrate(s)` itera de `s.v` até `SCHEMA`:
- v2: garante `watched`, `resume`, `notes`, `last`
- v3: garante `history` como array
- v4: garante `intro`, `srs`

### 5.4 API pública de GDIUser

| Método | Descrição |
|---|---|
| `GDIUser.ready()` | Carrega estado do `/userstate` (async, chamado em init) |
| `GDIUser.loaded()` | `bool` — estado carregado? |
| `GDIUser.auth()` | `'in'` \| `'out'` \| `'unknown'` |
| `GDIUser.markWatched(path)` | Marca aula como assistida |
| `GDIUser.unmarkWatched(path)` | Desmarca |
| `GDIUser.isWatched(path)` | `bool` |
| `GDIUser.setLast(path)` | Atualiza "última aula" |
| `GDIUser.getLast()` | `{path, at}` |
| `GDIUser.pushHistory(path, name)` | Adiciona ao histórico (max 12, dedup por path) |
| `GDIUser.setResume(path, t, d)` | Salva posição (t=tempo, d=duration) |
| `GDIUser.getResume(path)` | `{t, d, at}` ou `null` |
| `GDIUser.delResume(path)` | Remove posição |
| `GDIUser.addNote(path, t, text)` | Adiciona anotação (max 2000 chars) |
| `GDIUser.delNote(path, i)` | Remove anotação por índice |
| `GDIUser.getNotes(path)` | `[{t, text, at}]` |
| `GDIUser.getIntro(courseKey)` | `seconds` (0 se não definido) |
| `GDIUser.setIntro(courseKey, sec)` | Define intro a pular |
| `GDIUser.srsGrade(id, good)` | SM-2: se good, box+1 (cap 3 → delete quando graduado); se não, box=0 |
| `GDIUser.dump()` | Snapshot: `{watched, resume, notes, last, history, srs}` |
| `GDIUser.flush()` | Salva no servidor via `POST /userstate/save` (merge com remote, debounce 1500ms) |

### 5.5 Auto-flush
- `saveTimer = setTimeout(_flush, 1500)` após cada mutação
- `visibilitychange` (hidden) → `flush()` imediato
- `beforeunload` (em attachResumeTracking) → `save()` síncrono
- Toast de warning se flush falhar (uma vez por sessão): "Atenção: não foi possível salvar o progresso agora"

### 5.6 Merge local + remote
`mergeInto(local, remote)` — estratégia last-write-wins por chave (compara `at` timestamps), com exceção de `notes` (mantém o maior array) e `history` (mantém o maior array).

---

## 6. Estrutura do Drive 0

### 6.1 Pasta raiz de estado

```js
const USERSTATE_FOLDER = 'AULAS - ESTADO DOS ALUNOS';  // worker.js:636
const USERSTATE_PARENT_DRIVE = 0;                       // worker.js:637 (Drive 0)
```

Localizada na **raiz do Drive 0** (root id `1xZDP21i96vRq4Z5cJPiK1g` em authConfig.roots[0]). Criada sob demanda por `gdiUserFolderId(gd0)` se não existir.

### 6.2 Arquivos JSON na pasta de estado

| Arquivo | Conteúdo | Cap | LRU | Arquivo (handler) |
|---|---|---|---|---|
| `<username>.json` | Estado do usuário (GDIUser.dump()) | 512 KB | — | `gdiUserFileId` |
| `isa_cache.json` | Cache ISA por curso/aula: `{<keyPrefix>: {summary, questions, mindmap, lessonName, coursePath, outdated, battalionDone, battalionDate, date}}` | 200 entries | por `date` | `gdiIsaCacheFileId` |
| `isa_shared_summaries.json` | Pool de resumos compartilhados: `[{lessonName, summary, questions, author, date}]` | 500 | por `date` | `gdiSharedSummariesRead/Write` |
| `isa_shared_flashcards.json` | Pool de flashcards/questões compartilhados: `[{subject, front, back, statement, options, correct, explanation, legalText, fundamentacao, type, author, date}]` | 1000 | por `date` | `gdiSharedFlashcardsRead/Write` |
| `general_courses.json` | Catálogo de cursos compartilhados: `[{coursePath, courseName, pdfCount, addedAt, users[], materialsReady}]` | 1000 | por `addedAt` | `gdiGeneralCoursesRead/Write` |
| `.gdi_users.json` | Registro de usuários cadastrados: `[{username, salt, password_hash, created}]` | — | — | `gdiLoadDynamicUsers` / `gdiSaveDynamicUsers` |

### 6.3 Subpastas por aluno (criadas sob demanda)

Cada aluno tem subpastas DENTRO da pasta `AULAS - ESTADO DOS ALUNOS`, criadas por `gdiSaveMaterialToSubfolder(gd0, folderId, kind, fileName, content)`:

| Subpasta | Conteúdo | Arquivo |
|---|---|---|
| `resumos/` | `<course>_<pdf>_<timestamp>.md` — resumos gerados pelo batalhão ou on-demand | worker.js:2506 `gdiSaveMaterialToSubfolder` |
| `cards/` | `<course>_<pdf>_<timestamp>.json` — flashcards derivados de questões | battalionGenQuestions |
| `pilulas/` | `<course>_<pdf>_<timestamp>.md` — bullets de revisão | battalionGenPills |
| `questoes/` | `<course>_<pdf>_<timestamp>.json` — questões geradas (array de objetos) | battalionGenQuestions |
| `simulados/` | `<course>_<timestamp>.json` — minissimulado auto-gerado de 5 questões | battalionGenQuestions |
| `redacoes/` | `redacao_<banca>_<ISO-date>_<score>.md` — redações corrigidas pela Meggy (YAML front matter) | gdiSaveEssayMD |
| `brain/` | `resumo_<course>_<timestamp>.md` (e outros) — memória persistente em MD da Meggy | battalionGenSummary, handleBrainSave |

### 6.4 Ocultação (Hidden)

Itens ocultos na plataforma (não aparecem em listagens/busca/URL direta):

```js
const HIDDEN_EXTRA_NAMES = ['_arquivos_no_goog_drive_', 'GitHub', 'USERSTATE_FOLDER', 'AULAS - ESTADO DOS ALUNOS', ''];
const HIDDEN_EXTENSIONS = ['.py', '.gdi_users.json'];
const HIDDEN_EXACT_NAMES = [USERSTATE_FOLDER, USERS_REGISTRY_FILE, ...HIDDEN_EXTRA_NAMES];
// worker.js:1237-1247
```

- `isHiddenName(name)` — true se: começa com `.`, ou é um nome exato oculto, ou termina com extensão oculta
- `isHiddenPath(path)` — true se qualquer segmento do path for oculto (bloqueia acesso via URL)
- `HIDDEN_QUERY_EXCLUDE_LIST` — fragmento para queries de listagem: `and name !='AULAS - ESTADO DOS ALUNOS' and name !='.gdi_users.json' ...`
- `HIDDEN_QUERY_EXCLUDE_SEARCH` — mesmo mas com `AND` para busca
- Pós-filtro JS em `res_obj.files.filter(f => !isHiddenName(f.name))` (à prova de falha do query do Drive)

---

## 7. Fluxo do Batalhão de IA (Detalhado)

### 7.1 Trigger (Frontend)

1. Aluno clica **✓ Selecionar esta pasta** no modal Adicionar Curso (inline onclick) OU **✓ Adicionar** no rodapé.
2. `gdiAddCourseFromButton(btn)` (gdi-study.js:681) extrai `path`, `name`, `pdfs` do dataset do botão.
3. Chama `await window.gdiAddCourseFromDrive(p, n, pdfs)` (gdi-study.js:724).
4. Essa função:
   - Salva em `gdi-manual-courses-v1` (LS) → aparece imediatamente
   - `POST /api/courses/add` → `general_courses.json` no Drive (compartilhado entre usuários)
   - Re-renderiza lista de cursos
   - Fecha modal
   - **Dispara** `window.gdiIsaPdf.startBattalion(coursePath, coursePath, courseName, [])` (não-bloqueante via `.catch()`)
5. `startBattalion()` faz `POST /api/ai/battalion` com `{courseKey, coursePath, lessonName, pdfs: []}`.
6. Worker responde `200 OK` imediatamente: `{ok:true, message:'Batalhão iniciado em background', courseKey, pdfs: 0}`.
7. Worker chama `event.waitUntil(runBattalionInBackground(courseKey, coursePath, lessonName, [], user))` — mantém o isolate vivo após a resposta.

### 7.2 Scan do Drive (Worker)

Se `pdfList` estiver vazio (caso normal — frontend não envia PDFs pré-baixados):

```js
// worker.js:2178-2200
const result = await drive0.request_list_of_files(coursePath, null, 0);
// result.data.files (não result.files!)
if (result?.data?.files) {
  for (const f of result.data.files) {
    if (f.mimeType?.includes('pdf')) pdfList.push({name: f.name, id: f.id, text: ''});
    if (f.mimeType === 'application/vnd.google-apps.folder') {
      // scan 1 nível de subpasta
      const sub = await drive0.request_list_of_files(coursePath + '/' + encodeURIComponent(f.name), null, 0);
      for (const sf of sub.data.files) if (sf.mimeType?.includes('pdf')) pdfList.push({name: sf.name, id: sf.id, text: ''});
    }
  }
}
```

### 7.3 Download de PDFs (Worker)

Para cada PDF sem `text`, baixa do Drive:
```js
const r = await fetch('https://www.googleapis.com/drive/v3/files/'+pdf.id+'?alt=media&supportsAllDrives=true', opts);
if (r.ok) pdfText = (await r.text()).slice(0, 15000);  // cap 15k chars
```

### 7.4 Geração Paralela (Race no OpenRouter)

Para cada PDF, dispara 3 tarefas paralelas via `Promise.allSettled`:

| Tarefa | Função | Models (OpenRouter race) | Fallback |
|---|---|---|---|
| Resumo | `battalionGenSummary` | `google/gemini-flash-1.5`, `meta-llama/llama-3.1-8b-instruct:free`, `mistralai/mistral-7b-instruct:free` | `callUnifiedAi` (Zhipu → NVIDIA → OpenAI → CF AI) |
| Pílulas | `battalionGenPills` | `mistralai/mistral-7b-instruct:free`, `qwen/qwen-2.5-7b-instruct:free`, `google/gemma-2-9b-it:free` | `callUnifiedAi` |
| Questões | `battalionGenQuestions` | `qwen/qwen-2.5-7b-instruct:free`, `deepseek/deepseek-chat:free`, `meta-llama/llama-3.1-8b-instruct:free` | `callUnifiedAi` |

`callOpenRouterParallel(messages, opts)` (worker.js:2101):
- Dispara 3 modelos em paralelo via `Promise.any`
- Primeiro a retornar vence, outros são cancelados (AbortController, timeout 45s)
- `transforms: ['middle-out']` para compressão automática de contexto longo

### 7.5 Detecção de Leis Desatualizadas

`battalionGenSummary` detecta material desatualizado via regex:
```js
const isOutdated = /revogada|revogado|desatualizad|lei\s+8\.?666|lei\s+5\.?869|cpc\s+1973/i.test(result.response);
cache[keyPrefix].outdated = isOutdated;
```

Se desatualizado, **pula** `battalionGenQuestions` (aluno não deve treinar lei errada):
```js
if (cache0[keyPrefix]?.outdated) {
  console.log('[Battalion] '+keyPrefix+' desatualizado — PULANDO questões');
  return;
}
```

### 7.6 Salvamento em Subpastas

Para cada tipo de material, `gdiSaveMaterialToSubfolder(gd0, folderId, kind, fileName, content)`:
1. Procura subpasta `<kind>` (resumos/cards/pilulas/questoes/simulados) — cria se não existir (mimeType `application/vnd.google-apps.folder`)
2. Upload multipart/related com `Content-Type: text/markdown` ou `application/json`

### 7.7 Compartilhamento

Após processar todos os PDFs:
1. Salva marcador `cache[courseKey].battalionDone = true` + `battalionDate = Date.now()`
2. Itera `childKeys = Object.keys(finalCache).filter(k => k.startsWith(courseKey+'/'))`
3. Pega `firstSummaryKey = childKeys.find(k => finalCache[k]?.summary)`
4. Lê pool `isa_shared_summaries.json`
5. **Anti-clobber:** `filtered = existing.filter(s => !((s.lessonName||'') === lessonName && (s.author||'') === user))` — só remove entradas do MESMO autor + mesmo lessonName
6. Adiciona nova entrada: `{lessonName, summary, questions, author: user, date: Date.now()}`
7. LRU sort por `date`, cap 500
8. Salva via `gdiSharedSummariesWrite`

### 7.8 Schema do Cache ISA (por curso/aula)

```js
cache = {
  "<courseKey>/<pdfName>": {
    summary: "<Markdown>",          // battalionGenSummary
    mindmap: "<Markdown bullets>",  // battalionGenPills
    questions: [{...}, ...],       // battalionGenQuestions (ou string bruta se parse falhou)
    lessonName: "<course> - <pdf>",
    coursePath: "<course>",
    outdated: <bool>,
    date: <timestamp>,
    battalionDone: <bool>,         // só no <courseKey> (sem /pdfName)
    battalionDate: <timestamp>     // só no <courseKey>
  },
  // ... por aula
  "<courseKey>": {
    battalionDone: true,
    battalionDate: <timestamp>
  }
}
```

---

## 8. CSS Ferreto (Tokens, Tema Claro/Escuro)

### 8.1 Tokens (definidos em 3 lugares — drift risk)

`:root` + `[data-bs-theme="dark"]` + `[data-bs-theme="light"]` em:

| Arquivo:linha | Contexto |
|---|---|
| `worker.js:138` (em `ferretoStyle`) | Páginas estáticas (login, 404, homepage) |
| `app.min.js:1151` | Host platform (player, lista) |
| `gdi-study.js:2550` (BlackTie) | Área do Aluno + todos os componentes extras |

### 8.2 Tokens principais

```css
:root {
  --ferreto-primary: #ff8b9f;        /* coral */
  --ferreto-primary-600: #f5697f;
  --ferreto-secondary: #5ddeda;      /* teal */
  --ferreto-accent: #c026d3;         /* magenta */
  --ferreto-radius: 16px;
  --ferreto-radius-sm: 10px;
  --ferreto-font-display: 'Poppins', 'Rubik', system-ui, sans-serif;
  --ferreto-font-body: 'Rubik', 'Inter', system-ui, sans-serif;
  --ferreto-grad: linear-gradient(135deg, #ff8b9f 0%, #c026d3 55%, #5ddeda 130%);
  --ferreto-grad-soft: linear-gradient(135deg, rgba(255,139,159,.16), rgba(93,222,218,.12));
  --ferreto-glow: rgba(255,139,159,.35);
  --ferreto-shadow: 0 10px 30px -12px rgba(0,0,0,.55);
  --ferreto-shadow-soft: 0 6px 22px -10px rgba(0,0,0,.4);
}

[data-bs-theme="dark"] {
  --ferreto-bg: #070910;
  --ferreto-bg-2: #0d1119;
  --ferreto-surface: rgba(22, 27, 38, .72);
  --ferreto-surface-2: rgba(255, 255, 255, .045);
  --ferreto-surface-3: rgba(255, 255, 255, .08);
  --ferreto-border: rgba(255, 255, 255, .09);
  --ferreto-border-strong: rgba(255, 255, 255, .16);
  --ferreto-text: #f3f5fa;
  --ferreto-text-muted: #9aa4b8;
  --ferreto-text-faint: #6b7488;
}

[data-bs-theme="light"] {
  --ferreto-bg: #f4f5fb;
  --ferreto-bg-2: #e9ebf5;
  --ferreto-surface: rgba(255, 255, 255, .78);
  --ferreto-surface-2: rgba(255, 255, 255, .6);
  --ferreto-surface-3: rgba(15, 23, 42, .05);
  --ferreto-border: rgba(15, 23, 42, .1);
  --ferreto-border-strong: rgba(15, 23, 42, .18);
  --ferreto-text: #1f2540;
  --ferreto-text-muted: #5a6478;
  --ferreto-text-faint: #9aa1b4;
  --ferreto-glow: rgba(255, 139, 159, .28);
}
```

### 8.3 Override de estilos inline hardcoded

BlackTie (em `gdi-study.js:3690+`) usa attribute selectors para sobrescrever cores hardcoded em estilos inline (legados):
```css
.gdi-central-box [style*="color:#8b949e"] { color: var(--ferreto-text-muted) !important; }
.gdi-central-box [style*="color:#f0f6fc"] { color: var(--ferreto-text) !important; }
.gdi-central-box [style*="background:#1f6feb"] { background: var(--ferreto-grad) !important; }
/* ... etc */
```

### 8.4 Fix de Fullscreen (gdi-ui.js:42-93)

Força `width:100%!important; height:100%!important; max-height:none!important; object-fit:contain!important` em todos os players quando em `:fullscreen` (variantes webkit/moz/ms), eliminando barras pretas.

### 8.5 Fontes

Carregadas via Google Fonts: **Poppins** (400–800, display), **Rubik** (400–800, body), **Inter** (400–800, fallback body). Preconnect para `fonts.gstatic.com`.

---

## 9. Service Worker (PWA)

Servido em `/sw.js` ou `/gdi-sw.js` (inline template em `worker.js:1422-1536`). Habilita PWA offline.

### 9.1 Configuração

```js
const VERSION = 'gdi-v3';
const SHELL = VERSION + '-shell';        // cache do app shell (HTML, JS, CSS)
const MEDIA = VERSION + '-media';        // cache de mídia (vídeos, PDFs, áudios)
const MAX_MEDIA = 60;                    // máx 60 itens em mídia
const MAX_SHELL = 80;                    // máx 80 itens em shell
const MAX_BYTES = 250 * 1024 * 1024;     // 250 MB por arquivo
const CDN_HOSTS = ['cdn.plyr.io', 'vjs.zencdn.net', 'cdn.jsdelivr.net', 'content.jwplatform.com', 'raw.githack.com'];
const MEDIA_EXT = /\.(mp4|webm|mkv|m4v|mov|avi|mp3|m4a|wav|ogg|flac|pdf|jpg|jpeg|png|webp|gif|svg|ico)$/i;
```

### 9.2 Estratégias de cache

| Tipo de request | Estratégia |
|---|---|
| CDN cross-origin (js) | Network-first, fallback cache (revalida) |
| CDN cross-origin (outros) | Cache-first, fallback network |
| Same-origin POST `/userstate`, `/0:quota`, `/0:search`, `/0:id2path` | Bypass (não cacheia) |
| Same-origin media (com Range) | Cache-from-range → fallback network → fallback cache |
| Same-origin media (sem Range) | Cache-first, fallback network, fill cache (se ≤250MB) |
| Navegação (HTML) | Network-first, fallback cache (última versão ou `/`) — mostra página offline se não cacheada |

### 9.3 Helpers

- `isLoginRedirect(r)` — detecta redirect para `/login` (não cacheia)
- `trimCache(name, max)` — remove os itens mais antigos acima do limite
- `refreshRecency(url)` — move URL para o fim da fila LRU
- `fillMediaCache(pathname)` — background fill de mídia (se ≤250MB)
- `rangeFromCache(req, url)` — suporta HTTP 206 Partial Content (Range requests) a partir de cache

### 9.4 Lifecycle

- `install` → `self.skipWaiting()` (não espera reload)
- `activate` → limpa caches antigos (não-SHELL, não-MEDIA), `clients.claim()`

---

## 10. Eventos do Bus

O `Bus` é um event bus global singleton definido em `app.min.js:21`:

```js
const Bus = (() => {
  const m = new Map();
  function add(e, f, scope) {
    if (!m.has(e)) m.set(e, []);
    m.get(e).push({f, scope});
  }
  return {
    on(e, f)         { add(e, f, 'page'); },     // listener de página (limpo em Bus.reset())
    onGlobal(e, f)   { add(e, f, 'global'); },   // listener global (persiste entre páginas)
    reset()          { /* remove todos os 'page' */ },
    emit(e, ...a)    { /* invoca todos os listeners de e */ }
  };
})();
```

### 10.1 Eventos emitidos

| Evento | Payload | Emissor | Arquivo:linha |
|---|---|---|---|
| `media:ready` | `{type: 'video'\|'audio', el: <HTMLElement>, ap?: <aplayer>}` | `gdiAnnounceMedia(type, el, extra)` | app.min.js:36 |
| `page:change` | — | `render(path)` (após mudança de página) | app.min.js:154 |
| `rows:appended` | `{mode, basePath}` | listagem de arquivos (após append de linhas) | app.min.js:271 |
| `video:ended` | `{el: <video>}` | listener `ended` no vídeo | app.min.js:507 |
| `video:advance` | — | listener que avança playlist | app.min.js:574 (consumidor) |
| `title:change` | — | `title()` após atualizar document.title | app.min.js:693 |
| `video:switched` | `{index: <n>, video: <m>}` | `switchVideo(i)` após trocar vídeo | app.min.js:708 |
| `auth:change` | `auth: 'in'\|'out'` | `_load()` após carregar user state | app.min.js:992 |
| `user:ready` | — | `_load()` após carregar user state | app.min.js:993 |
| `watched:changed` | — | `gdiMarkVideo`/`gdiUnmarkVideo` (após marcar/desmarcar) | gdi-ui.js:1168,1174 / gdi-core.js:445 |

### 10.2 Listeners registrados (consumidores)

| Evento | Listener (escopo) | Módulo | Arquivo |
|---|---|---|---|
| `media:ready` | (page) — attach resume tracking, M5 cronômetro, M6 marks, M7 skip intro, M11 sleep, M14 progress, M-player-guard | M5/M6/M7/M11/M14/guard | app.min.js:498,866 / gdi-core.js:431,492,694 / gdi-ui.js:348,1144 / gdi-study.js:1023,3890 |
| `media:ready` | (global) — Pomodoro `check()` | M12 | gdi-ui.js:430 |
| `media:ready` | (global) — M10 focus `updBtn()` | M10 | (via `watched:changed` indireto) |
| `page:change` | (global) — limpa `_listCache` | app.min.js | app.min.js:58 |
| `page:change` | (global) — scheduler de módulos (debounce 150ms) | gdi-core | gdi-core.js:338 |
| `page:change` | (global) — M2 render auth | M2 | gdi-core.js:378 (via auth:change) |
| `page:change` | (global) — Pomodoro inject + refreshBase | M12 | gdi-ui.js:415,431 |
| `page:change` | (global) — M13 continue card refresh | M13 | gdi-ui.js (continueCardInit em user:ready) |
| `page:change` | (global) — M19 clean title apply | M19 | gdi-ui.js:1141 |
| `page:change` | (global) — Playlist refresh | M20 | gdi-ui.js |
| `page:change` | (global) — Meggy panel rebind | M-AI | gdi-meggy.js:2454 |
| `page:change` | (global) — Central nav re-inject | central-nav | gdi-study.js:3116,3117 |
| `page:change` | (global) — M14 progress line | M14 | gdi-ui.js (via user:ready) |
| `rows:appended` | (global) — re-inject nav button | central-nav | gdi-study.js:3118 |
| `title:change` | (global) — Pomodoro refreshBase | M12 | gdi-ui.js:432 |
| `title:change` | (global) — M19 apply | M19 | gdi-ui.js:1142 |
| `video:switched` | (page) — M6 render (limpa rascunho) | M6 | gdi-core.js:648 |
| `video:switched` | (global) — M9 materiais re-build | M9 | gdi-core.js:1007 |
| `video:switched` | (global) — M10 updBtn | M10 | gdi-ui.js:198 |
| `video:switched` | (global) — M19 apply | M19 | gdi-ui.js:1143 |
| `video:switched` | (global) — Playlist refresh | M20 | gdi-ui.js:1330 |
| `watched:changed` | (global) — M10 updBtn | M10 | gdi-ui.js:196 |
| `watched:changed` | (global) — Playlist refreshAll | M20 | gdi-ui.js:1329 |
| `auth:change` | (global) — M2 renderAuth | M2 | gdi-core.js:378 |
| `user:ready` | (global) — M6 render dispatcher | M6 | gdi-core.js:568 |
| `user:ready` | (global) — M6 draw marks | M6 | gdi-core.js:684 |
| `user:ready` | (global) — M10 updBtn | M10 | gdi-ui.js:197 |
| `user:ready` | (global) — M13 continueCardInit | M13 | gdi-ui.js:916 |
| `user:ready` | (global) — M14 progress line | M14 | gdi-ui.js:1043 |
| `user:ready` | (global) — Resume applySeek | attachResumeTracking | app.min.js:1084 |

### 10.3 Padrão de uso

```js
// Registrar listener global (sobrevive a trocas de página)
Bus.onGlobal('video:switched', () => setTimeout(updBtn, 150));

// Registrar listener de página (limpo em Bus.reset() ao trocar de página)
Bus.on('video:switched', () => { /* ... */ });

// Emitir evento
Bus.emit('watched:changed');
Bus.emit('media:ready', {type: 'video', el: videoElement});
```

`Bus.reset()` é chamado em `render(path)` (app.min.js:154) — limpa todos os listeners `'page'` antes de re-renderizar, evitando acúmulo infinito de handlers.

---

## Apêndice A — Mapa Rápido de Arquivos

```
worker.js (3161 linhas)
├── authConfig, uiConfig, player_config       (linhas 26-105)
├── CUSTOM_APP_SOURCES, CUSTOM_EXTRAS_SOURCES  (linhas 110-118)
├── ferrotoStyle, ferrotoFonts, ferrotoThemeScript (linhas 120-225) — CSS Ferreto injetado
├── html(), homepage(), login_html(), not_found()  (linhas 225-590) — templates HTML
├── encryptString, decryptString, genIntegrity, checkintegrity (linhas 588-628) — AES-CBC + HMAC
├── gdiSessionUser, gdiUserFolderId, gdiUserFileId  (linhas 639-675) — helpers de sessão/pasta
├── handleUserStateGet, handleUserStateSave    (linhas 677-716) — /userstate
├── gdiIsaCache*                               (linhas 718-810) — isa_cache.json
├── gdiSharedSummaries*                        (linhas 811-885) — isa_shared_summaries.json
├── handleRedacaoCorrect, gdiSaveEssayMD, handleEssaySave (linhas 887-980) — redação
├── callUnifiedAi                              (linhas 982-1033) — wrapper AI (OpenRouter → Zhipu → NVIDIA → OpenAI → CF AI)
├── gdiSharedFlashcards*                       (linhas 1035-1100) — isa_shared_flashcards.json
├── handleBrainList, handleBrainSave           (linhas 1101-1140) — brain/
├── hashPassword, gdiRegistryFolderId, gdiLoadDynamicUsers, gdiVerifyUser, gdiUsernameExists (linhas 1142-1232) — .gdi_users.json
├── HIDDEN_EXTRA_NAMES, isHiddenName, isHiddenPath (linhas 1237-1272) — ocultação
├── handleRequest                              (linhas 1274-2140) — roteador principal
│   ├── handleAdmin                            (linhas 1314-1410) — /admin
│   ├── /sw.js (inline SW template)            (linhas 1422-1538)
│   ├── /app.min.js, /gdi-extras.js (proxy GitHub) (linhas 1540-1579)
│   ├── /logout                                (linhas 1581-1587)
│   ├── login flow (/login POST, /signup POST, /login GET, session check) (linhas 1589-1742)
│   └── Dispatch de rotas API                  (linhas 1755-1832)
├── apiRequest, handleSearch, handleId2Path, findId2Path (linhas 2742-2839)
├── class googleDrive                          (linhas 2841-3093) — wrapper Drive REST API
├── download(id, range, inline, exportFmt)     (linhas 3096-3142) — handler de download
└── addEventListener('fetch', ...)             (linhas 3158-3162) — entrypoint

core/app.min.js (1585 linhas)
├── FILE_TYPES, GDOC_TYPES, getFileIcon        (linhas 1-10)
├── Os (detecção de OS), getQueryVariable, escHtml, escJs (linhas 11-30)
├── Bus (event bus)                            (linhas 21-32)
├── gdiAnnounceMedia, gdiOkPath, trimChar      (linhas 33-43)
├── applyTheme, toggleTheme                    (linhas 45-50)
├── gdiListAllFiles                            (linhas 59-92) — listagem com cache
├── init()                                     (linhas 95+) — layout base
├── render(path)                               (linha 154) — roteador SPA
├── list(), file(), fallback(), render_search_result_list()
├── attachResumeTracking(media, getKey)        (linhas 920+)
├── GDIUser (singleton)                         (linhas 900-1055) — estado do usuário
├── switchVideo(i), playlistVideos             (linhas 574+, 623)
├── file_pdf (original, substituído por gdi-pdf.js)

modular/gdi-core.js (1009 linhas)
├── window.GDI_MODULES, gdiGradeCard, gdiSrsIntervals (linhas 31-67)
├── window.gdiTrails                            (linhas 72-78)
├── window.gdiAchievements                      (linhas 79-122)
├── window.gdiModal                             (linhas 124-180)
├── window.gdiSanitize                          (linhas 182-200)
├── CSS injetado                                (linhas 210-340)
├── Loader scheduler (debounce 150ms)           (linhas 320-340)
├── M1: Senhas (gdiSetPw/gdiGetPw)              (linhas 344-360)
├── M2: Auth (gdiRenderAuth)                    (linhas 362-379)
├── M3: Velocidade do vídeo (gdi-rate)          (linhas 380-390)
├── M4: Atalhos (N/P/J/[/])                     (linhas 392-430)
├── M5: Cronômetro + auto-assistido 90%         (linhas 431-470)
├── M6: Marcas + notas + revisão + export      (linhas 472-680)
├── M7: Pular intro por curso                   (linhas 682-718)
└── M9: Materiais (PDFs por aula)               (linhas 720-1009)

modular/gdi-ui.js (1334 linhas)
├── M10: Modos de foco + botão assistido       (linhas 25-265)
├── M11: Modo descanso                          (linhas 267-360)
├── M12: Pomodoro v2.6                          (linhas 363-555)
├── M13: Card "Continuar" em cascata           (linhas 557-916)
├── M14: Progressos por módulo                  (linhas 1015-1065)
├── M18: Painel de debug (GDIDebug)            (linhas 1066-1075)
├── M19: Título limpo da aba                    (linhas 1130-1150)
├── gdiNormKey, gdiVideoKey, gdiMarkVideo, gdiUnmarkVideo (linhas 1156-1180)
└── M20: Playlist (sem observer loop)          (linhas 1180-1334)

modular/gdi-meggy.js (2519 linhas)
├── M9-ISA: parseJsonArray, esc, lsGet, lsSet, uid (linhas 24-90)
├── CSS injetado                                (linhas 100-450)
├── extractPdfText(url)                         (PDF.js + OCR Tesseract fallback)
├── gdiIsaPdf.summary/questions/mindmap/flashcards (geração on-demand)
├── saveIsaSummary, listIsaSummaries, delIsaSummary
├── saveSharedSummary, fetchSharedSummaries, fetchSharedQuestions
├── saveEssayMD                                 (POST /api/ai/essay/save)
├── startBattalion, getBattalionStatus          (POST /api/ai/battalion)
├── window.gdiIsaPdf = {...}                    (linha 1920 — API pública)
├── window.renderResumos(box)                   (linha 1940 — aba Resumos)
├── window.gdiSubjects                          (linha 805)
├── Flashcards study UI (3D flip)               (linhas 1615-1810)
└── M-AI: Widget da Meggy 🐩 (chat)             (linhas 2111-2519)

modular/gdi-study.js (3902 linhas)
├── M23: Estudo Ativo (IIFE linhas 14-670)
│   ├── Banco de questões (questions, addQ, delQ, getQ)
│   ├── SRS (gradeQ, dueQ, errQ) + fisherYates
│   ├── Simulados (simus, saveSim)
│   ├── gerarViaISA (geração via /api/ai)
│   ├── renderQuestoes(box)                     (linha 101 — exposto em window)
│   ├── renderSimulado(box)                     (linha 392 — exposto em window)
│   ├── renderCronograma(box)                   (linha 532 — exposto em window)
│   └── renderRevisoes(box)                     (linha 593 — exposto em window)
├── M22: Área do Aluno (IIFE linhas 670-3200)
│   ├── gdiAddCourseFromButton, gdiAddCourseFromDrive
│   ├── collectCourses, hideCourse, unhideCourse
│   ├── Maratona (marOn, marIntro, marCourseKey)
│   ├── openPanel(t), closePanel, renderPanel
│   ├── TAB_GROUPS (16 abas em 5 grupos)
│   ├── renderHome, renderCursos, renderMarathon, renderStats, renderFlash, renderSubjects, renderTrails, renderAchievements
│   ├── showAddCourseModal (navegador de Drive)
│   ├── injectNavButton (botão "Estudos" na navbar)
│   ├── window.gdiUpdateBattalionStatus
│   └── Atalhos de teclado (C, Esc, Space, 1/2/3)
├── M24: Provas/Redação/Radar (IIFE linhas 3200-3570)
│   ├── callMeggy(prompt)
│   ├── renderMd(txt) (marked + gdiSanitize)
│   ├── window.renderProvas(box)                (linha 3196)
│   ├── window.renderRedacao(box)               (linha 3294) — 30+ bancas + dropzone
│   └── window.renderRadar(box)                  (linha 3466) — tiles por matéria
├── BlackTie: Tema Ferreto (IIFE linhas 3573-3688)
│   ├── Fontes (Poppins, Rubik, Inter)
│   ├── Tokens --ferreto-* (espelha app.min.js)
│   ├── Override de estilos inline hardcoded
│   └── Fix modal serrilhada
└── M-PLAYER-GUARD: Watchdog contra vídeos travados (IIFE linhas 3690-3900)
    ├── attach(video) — monitora progresso, faz retry silencioso em 15s sem progresso
    ├── showOverlay() — overlay [Recarregar][Continuar aguardando]
    └── showHint() — ▶ hint de autoplay bloqueado

modular/gdi-pdf.js (98 linhas)
└── window.file_pdf = function(i, e, t, n, a, c) — substitui file_pdf do app.min.js
    ├── Canvas pdf.js com controles (prev/next/zoom)
    ├── Suporte mobile aprimorado (escala automática, scroll touch)
    ├── Debounce no zoom (150ms)
    └── Fallback de erro amigável
```

---

## Apêndice B — Constantes Importantes

| Constante | Valor | Arquivo:linha |
|---|---|---|
| `CDN_VERSION` | `'2.5.9'` | worker.js:25 |
| `USERSTATE_FOLDER` | `'AULAS - ESTADO DOS ALUNOS'` | worker.js:636 |
| `USERSTATE_PARENT_DRIVE` | `0` | worker.js:637 |
| `USERS_REGISTRY_FILE` | `'.gdi_users.json'` | worker.js:1144 |
| `ISA_CACHE_FILE` | `'isa_cache.json'` | worker.js:724 |
| `ISA_SHARED_FILE` | `'isa_shared_summaries.json'` | worker.js:810 |
| `ISA_SHARED_FC_FILE` | `'isa_shared_flashcards.json'` | worker.js:1036 |
| `GENERAL_COURSES_FILE` | `'general_courses.json'` | worker.js:2387 |
| `ADMIN_USERS` | `['elton@araujo.eu.org']` | worker.js:1276 (hardcoded) |
| `crypto_base_key` | ENV.CRYPTO_BASE_KEY ou fallback hardcoded | worker.js:70 |
| `hmac_base_key` | ENV.HMAC_BASE_KEY ou fallback hardcoded | worker.js:71 |
| `GDI SCHEMA` | `4` | app.min.js:901 |
| `MAX_RESUME` | `300` | app.min.js:907 |
| `MAX_HISTORY` | `12` | app.min.js:907 |
| `MAX_SRS` | `1500` | app.min.js:907 |
| `MIN_SAVE` | `5` (segundos) | app.min.js:907 |
| `LIST_TTL` | `45000` (ms) | app.min.js:57 |
| `BOX_INTERVALS` (SRS) | `[1, 3, 7, 21, 60]` (dias) | gdi-core.js:46, gdi-study.js |
| `STALL_MS` (player-guard) | `15000` (ms) | gdi-study.js:3700 |
| `FIRST_PLAY_HINT_MS` | `3500` (ms) | gdi-study.js:3701 |
| `MAX_MSGS` (rate limit Meggy) | `30` msgs/hora | worker.js:2566 |
| `WINDOW` (rate limit) | `3600000` (1h) | worker.js:2565 |
| `PL_CAP` (playlist cap) | `600` | gdi-ui.js:1156 |

---

## Apêndice C — Issues Conhecidos e Próximos Passos

### Issues de segurança pendentes
1. **Auth bypass:** Cookie `session` valida apenas `username` (não password). Formato atual: `encryptString(username)|encryptString(password)|encryptString(expiry)`. Recomendado: `username|expiry|hmac(username|expiry)` + revalidar password hash.
2. **Rate limit per-isolate:** `globalThis.__MEGGY_RATE` não persiste entre restarts do worker. Recomendado: KV com sliding window.
3. **`/copy` sem authZ:** Qualquer user pode copiar para qualquer pasta.
4. **`users_list` hardcoded:** `admin/admin`, `user1/user1`, `user2/user2` ainda ativos.
5. **`ADMIN_USERS` hardcoded:** `['elton@araujo.eu.org']`.

### Issues de UX pendentes
1. **OCR de redações escaneadas:** Frontend envia imagem, mas worker não tem binding `@cf/llava` ativo.
2. **Trilhas com cronograma por data de prova:** Falta campo "data da prova" + slider "horas/dia" + gerar plano automaticamente.
3. **Flashcards não filtram por `collectCourses()`** (só por disciplina).
4. **Provas não repaginadas** com visual profissional (hero + dropzone maior).
5. **Cronograma não repaginado** com strip horizontal de 30 dias.
6. **Maratona design** não repaginado (mas funcional).
7. **Revisões não ocupam tela inteira.**

### Drift risks
1. **`--ferreto-*` tokens definidos 3×** (worker.js, app.min.js, gdi-study.js) — recomenda-se centralizar.
2. **Helper `esc` definido 5×** entre módulos com implementação diferente (3 bugs de XSS conhecidos).
3. **`lsGet`/`lsSet` definidos 5×** idênticos — recomenda-se centralizar em `gdi-core.js`.
4. **96 `console.log` de debug** (28 só em `[AddCourse]`) — recomenda-se remover em produção.

---

*Fim do Manual Completo — GDI Extras v2.7-PLANO-A · 2026-09-19*
