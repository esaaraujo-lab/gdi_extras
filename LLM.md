Atue como Desenvolvedor Full-Stack Senior e Engenheiro de Software especialista em JavaScript/Node.js, Cloudflare Workers e Arquitetura Frontend.

Estou te enviando meu projeto completo para análise profunda, correção de bugs, otimização de código e repaginação total de UI/UX.

---

### 1. Estrutura de Diretórios e Arquivos do Projeto

Siga estritamente a estrutura de arquivos para a entrega:

gdi_extras/
├── worker.js                 (Raiz: Cloudflare Worker backend)
├── core/
│   └── app.min.js            (Core da aplicação)
└── modular/
    ├── gdi-extras-loader.js  (Carregador modular)
    ├── gdi-core.js           (Lógica base)
    ├── gdi-pdf.js            (Manipulação de PDF)
    ├── gdi-ui.js             (Componentes e layout de interface)
    ├── gdi-meggy.js          (Agente IA / Meggy)
    └── gdi-study.js          (Central de Estudos e módulos de aprendizagem)

---

### 2. Etapa Inicial Obrigatória: Análise e Resumo Executivo (MD)

Antes de gerar os códigos finalizados, você deve:
1. Ler e analisar minuciosamente todos os arquivos do projeto.
2. Criar um documento `RESUMO_EXECUTIVO.md` detalhando:
   - Visão geral da arquitetura do projeto.
   - Mapeamento linha a linha das funções, utilitários e fluxos de dados.
   - Relatório de busca ativa de erros: bugs ocultos, memory leaks, problemas de concorrência, falhas de estado e glitches visuais encontrados.

---

### 3. Modificações, Correções e Melhorias Exigidas

#### 🛠️ A. Correções Críticas e Player de Vídeo
* **Player em Tela Cheia:** Corrigir o bug onde, ao entrar em modo janela cheia, o vídeo fica despencado/deslocado para cima com barras pretas nas laterais e na parte inferior. O vídeo deve ocupar 100% da área útil do container mantendo a proporção correta (`object-fit: contain`).
* **Busca Ativa de Bugs:** Identificar e corrigir gargalos de performance, tratamento de exceções ausentes e inconsistências no gerenciamento de estado entre as abas.

---

#### 🎨 B. Repaginação da Central de Estudos (UI/UX)
Repaginar a interface para um visual moderno, elegante e intuitivo. Apenas a barra lateral esquerda será mantida como referência estrutural; todo o restante da Central deve ser remodelado:

1. **Meus Cursos:**
   * Ao abrir um curso específico, integrar e exibir: resumo detalhado do curso, comentários, total de aulas, aulas assistidas, contagem de aulas restantes e atalhos diretos para os materiais gerados.

2. **Questões:**
   * Substituir o layout atual (apenas botões) por uma interface interativa baseada nos cursos matriculados e no histórico do aluno.
   * Ao responder qualquer questão (certa ou errada), apresentar imediatamente a resolução comentada. Em caso de erro, incluir obrigatoriamente a citação do **texto legal** e a **fundamentação detalhada** do acerto/erro.
   * Aplicar essa mesma lógica de fundamentação no gerador de resumos, questões e pílulas do módulo Meggy.

3. **Simulados:**
   * Utilizar o banco de questões por curso gerado pelo aluno + integrar questões de outros alunos sobre a mesma matéria/assunto.

4. **Modo Maratona:**
   * Refatorar a interface para design moderno e validar integralmente a funcionalidade do fluxo.

5. **Revisões:**
   * Expandir para ocupar 100% da tela quando selecionado.
   * Analisar a taxa de erro do aluno por assunto e indicar visualmente os pontos fracos e os tópicos prioritários para estudo.

6. **Flashcards:**
   * Vincular aos cursos em *Meus Cursos* e às questões geradas pela Meggy/aluno.
   * Adicionar alternância para visualizar flashcards da comunidade sobre o mesmo assunto.

7. **Matérias:**
   * Exibir em layout de *tiles* (mosaico) retangulares, reutilizando o design da seção *Meus Cursos*.

8. **Trilhas de Estudo:**
   * Conectar aos cursos matriculados com sugestões iniciais.
   * Permitir adicionar/remover concursos (ex: Auditor Fiscal) e selecionar disciplinas disponíveis no Drive.
   * Criar cronograma automático (pré-edital ou baseado na data da prova) com base nas horas diárias/semanais disponíveis do aluno.
   * **Banco de dados incremental no Drive:** Se um aluno já indexou uma pasta de aulas, reutilizar a playlist criada para economizar tempo de processamento.

9. **Resumos:**
   * Substituir o visual atual por um grid de *tiles* organizado por: Curso > Trilha > Matéria.
   * Incluir opção de visualizar resumos compartilhados por outros alunos no mesmo tópico.

10. **Provas e Redação:**
    * **Provas:** Reformular para um visual limpo e profissional.
    * **Redação:** 
      * Corrigir o bug visual do *dropdown* de bancas (ilegível no tema escuro).
      * Adicionar bancas de Vestibulares (incluindo Medicina), ENEM e Concursos.
      * Suportar digitação e upload de redação escaneada (OCR lido pela Meggy).
      * Ler os dados do perfil do aluno no Drive para direcionamento personalizado.
      * Identificar o gênero textual (Discursiva, Estudo de Caso, Dissertativa ENEM/FUVEST).
      * Salvar a correção **exclusivamente em Markdown (.md)** no diretório do aluno no Drive (não salvar PDF), contendo a nota, critérios da banca e pontos de atenção.

11. **Cronograma, Estatísticas e Mapa dos Fracos:**
    * **Cronograma:** Repaginar a UI reaproveitando estruturas para evitar chamadas desnecessárias à Cloudflare.
    * **Estatísticas:** Ajustar os gráficos estilo GitHub para ocupar `width: 100%` da largura do container.
    * **Mapa dos Fracos:** Implementar layout em *tiles* retangulares conectado aos dados de *Meus Cursos*, questões e aulas menos estudadas.
    * **Conquistas:** Padronizar paleta de cores e tipografia com as demais abas.

---

### 4. Entregáveis

Entregue o código completo, modularizado, testado e pronto para substituição direta no GitHub e no Cloudflare Workers, respeitando a estrutura de diretórios indicada na Seção 1.