/*
 * O CONTEÚDO DA AJUDA. Veio do lab (app/lab/telas/ajuda/dados.ts), onde cada
 * caminho foi conferido nas telas aprovadas: uma ajuda que descreve um botão
 * que não existe é pior que ajuda nenhuma. Quando uma tela mudar de nome de
 * botão, este arquivo muda junto.
 *
 * A MONTAGEM MANUAL SAIU (/volumes, decisão do Matheus em 01/10/2026): o
 * lugar "Anexos de um volume" foi junto. Montar volume é no Nexo.
 */

export type Passo = { texto: string; caminho?: string[]; tecla?: string };

export type Tarefa = {
  id: string;
  nome: string;
  precisa: string;
  comeca: string;
  passos: Passo[];
  ir: string;
  palavras: string[];
  principal?: boolean;
  sinonimos?: string[];
};

export type Lugar = { id: string; nome: string; caminho: string[]; precisa: string; tecla?: string; nota?: string; sinonimos?: string[] };

export type Palavra = { id: string; termo: string; texto: string; nivel?: number; ve?: string[]; sinonimos?: string[] };

export const TAREFAS: Tarefa[] = [
  {
    id: "auditar",
    nome: "Auditar um memorial",
    principal: true,
    precisa: "O memorial descritivo em PDF.",
    comeca: "Painel",
    passos: [
      { texto: "No Painel, escolha a tarefa e solte o PDF. Também vale soltar direto numa conversa do Nexo.", caminho: ["Painel", "Auditar um memorial"] },
      { texto: "O Nexo lê a capa e mostra a ficha da obra. Confira principalmente o nome da obra; algum dado errado se corrige no lápis da linha. Sem código na capa, o cartão pergunta de qual projeto é." },
      { texto: "Clique em Conferi — auditar. Pode fechar a aba enquanto roda: a análise segue no servidor e o resultado abre no palco.", caminho: ["Conversa", "Conferi — auditar"] },
      { texto: "O resultado abre com o veredito escrito no topo e os achados por nível, do que bloqueia a emissão ao que é só gramática.", caminho: ["Resultado", "Resumo"] },
    ],
    ir: "Abrir o Painel",
    palavras: ["parecer", "achado", "veredito", "nivel"],
    sinonimos: ["auditoria", "memorial descritivo", "revisar memorial", "conferir memorial", "analisar"],
  },
  {
    id: "tratar",
    nome: "Tratar os achados",
    precisa: "Um parecer aberto.",
    comeca: "Resultado",
    passos: [
      { texto: "No trilho do resultado, abra Achados (tecla 2). J e K andam de achado em achado.", caminho: ["Resultado", "Achados"], tecla: "J K" },
      { texto: "Encerre cada achado: C marca corrigido, D grava uma decisão técnica com o motivo (vai no parecer), F marca falso positivo. Z desfaz logo depois; depois disso, Reabrir.", caminho: ["Achado", "Marcar corrigido"], tecla: "C D F" },
      { texto: "A IA acertou? Procede e Gravidade errada entram na medida de acerto do Nexo e não encerram o achado.", caminho: ["Achado", "Procede"] },
      { texto: "Ver no memorial (tecla M) abre o PDF na página do trecho.", caminho: ["Achado", "Ver no memorial"], tecla: "M" },
      { texto: "Para passar um achado a alguém: Atribuir. Atribuir não manda e-mail: quem recebeu e ainda não foi avisado aparece no topo da fila, em Notificar por e-mail.", caminho: ["Achado", "Atribuir"] },
    ],
    ir: "Abrir o último parecer",
    palavras: ["achado", "tratamento", "nivel"],
    sinonimos: ["corrigir achado", "falso positivo", "decisao tecnica", "fila"],
  },
  {
    id: "levar",
    nome: "Levar o parecer à prefeitura",
    precisa: "Um parecer aberto.",
    comeca: "Resultado",
    passos: [
      { texto: "No trilho da direita do Resultado, em Levar adiante: Parecer em PDF. Ele abre numa aba nova.", caminho: ["Resultado", "Levar adiante", "Parecer em PDF"] },
      { texto: "Para colar num e-mail: abra o Relatório (tecla 3) e use Copiar o texto.", caminho: ["Resultado", "Relatório", "Copiar o texto"] },
    ],
    ir: "Abrir o último parecer",
    palavras: ["parecer", "veredito"],
    sinonimos: ["exportar parecer", "pdf do parecer", "relatorio", "imprimir", "planilha"],
  },
  {
    id: "ld",
    nome: "Gerar LD, capa e separatrizes",
    precisa: "As pranchas em PDF.",
    comeca: "Painel",
    passos: [
      { texto: "Solte as pranchas no Nexo. Ele lê o carimbo de cada folha e põe tudo no Mapa do volume.", caminho: ["Painel", "Gerar LD e capa"] },
      { texto: "Confira as folhas marcadas no mapa: folha sem número, revisão diferente, carimbo ilegível.", caminho: ["Mapa do volume"] },
      { texto: "Peça na conversa: “pode gerar”. Capa, separatrizes e LD saem do que está nos carimbos." },
    ],
    ir: "Abrir o Painel",
    palavras: ["ld", "capa", "separatriz", "carimbo"],
    sinonimos: ["lista de documentos", "gerar capa", "separadora", "indice"],
  },
  {
    id: "volume",
    nome: "Montar o volume",
    precisa: "As pranchas lidas no Mapa do volume.",
    comeca: "Nexo",
    passos: [
      { texto: "Com as folhas no mapa, diga o que quer na conversa: “divide em 2 tomos”, “tira a ARQ-12”, “monta os volumes”. O mapa muda a cada pedido.", caminho: ["Nexo", "Mapa do volume"] },
      { texto: "Para mudar a ordem, arraste a folha no mapa.", caminho: ["Mapa do volume", "arrastar a folha"] },
      { texto: "Os PDFs gerados aparecem na coluna da conversa; Baixar os editáveis (ODT) traz capa, LD e separatriz, antes do PDF do volume.", caminho: ["Conversa", "Volume montado", "Baixar os editáveis (ODT)"] },
    ],
    ir: "Abrir o Nexo",
    palavras: ["volume", "tomo", "grupo"],
    sinonimos: ["juntar pdf", "montar tomo", "dividir tomos", "encadernar"],
  },
  {
    id: "conferir",
    nome: "Conferir as folhas",
    precisa: "As pranchas em PDF.",
    comeca: "Painel",
    passos: [
      { texto: "Solte as pranchas em Conferir as folhas. O Nexo confere código, disciplina, revisão e o nome da obra em cada carimbo.", caminho: ["Painel", "Conferir as folhas"] },
      { texto: "O que divergiu fica marcado no mapa; corrija o carimbo de uma folha com E.", caminho: ["Mapa do volume", "folha", "Corrigir"], tecla: "E" },
    ],
    ir: "Abrir o Painel",
    palavras: ["carimbo", "folha"],
    sinonimos: ["conferir carimbo", "revisao", "codigo da prancha"],
  },
];

export const LUGARES: Lugar[] = [
  { id: "pdf", nome: "Parecer em PDF", caminho: ["Resultado", "Levar adiante", "Parecer em PDF"], precisa: "Um parecer aberto.", nota: "Abre numa aba nova.", sinonimos: ["exportar parecer", "imprimir", "relatorio"] },
  { id: "copiar", nome: "Copiar o texto do parecer", caminho: ["Resultado", "Relatório", "Copiar o texto"], precisa: "Um parecer aberto.", nota: "Texto para colar no e-mail.", sinonimos: ["planilha", "excel", "copiar", "colar", "exportar"] },
  { id: "atribuir", nome: "Atribuir um achado", caminho: ["Resultado", "Achados", "Atribuir"], precisa: "Um parecer aberto.", nota: "Vários de uma vez: marque as caixas da lista e escolha a pessoa na barra que aparece embaixo. Atribuir não manda e-mail; Notificar por e-mail, no topo da fila, avisa todos de uma vez.", sinonimos: ["delegar", "responsavel", "passar achado", "notificar", "email"] },
  { id: "link", nome: "Copiar o link de um achado", caminho: ["Achado", "Copiar o link deste achado"], precisa: "Um achado aberto na fila.", nota: "O ícone de corrente, ao lado das setas. Quem abre o link cai no mesmo achado do mesmo parecer.", sinonimos: ["compartilhar", "link"] },
  { id: "memorial", nome: "Ver o trecho no memorial", caminho: ["Achado", "Ver no memorial"], precisa: "Um achado aberto.", tecla: "M", nota: "O memorial abre na página do trecho. Para ver todos os achados sobre as páginas: No documento, no trilho (tecla 4).", sinonimos: ["pagina", "evidencia", "trecho"] },
  { id: "carimbo", nome: "Corrigir o carimbo de uma folha", caminho: ["Nexo", "Mapa do volume", "folha", "Corrigir"], precisa: "As pranchas lidas.", tecla: "E", sinonimos: ["corrigir numero", "titulo da prancha", "revisao errada"] },
  { id: "ordem", nome: "Mudar a ordem das folhas", caminho: ["Nexo", "Mapa do volume", "arrastar a folha"], precisa: "As pranchas lidas.", sinonimos: ["reordenar", "mover", "subir", "descer"] },
  { id: "tomos", nome: "Dividir em tomos", caminho: ["Nexo", "conversa", "“divide em 2 tomos”"], precisa: "As pranchas lidas.", sinonimos: ["tomo", "dividir volume"] },
  { id: "zip", nome: "Baixar os editáveis (ODT)", caminho: ["Conversa", "Volume montado", "Baixar os editáveis (ODT)"], precisa: "LD, capa ou volume já gerados.", sinonimos: ["exportar volume", "baixar volume", "zip", "editaveis"] },
];

/** Projeto › Conversa e auditoria › Volume › Grupo › Documento e página. */
export const HIERARQUIA = ["Projeto", "Conversa e auditoria", "Volume", "Grupo", "Documento e página"];

export const PALAVRAS: Palavra[] = [
  { id: "projeto", termo: "Projeto", nivel: 0, texto: "A obra. Guarda conversas, auditorias, volumes e arquivos. Cria-se em Projetos, ou nasce do memorial que o Nexo lê." },
  { id: "conversa", termo: "Conversa", nivel: 1, texto: "Um trabalho no Nexo: você solta PDFs e pede o que precisa. Ela entra num projeto quando os documentos dizem qual é." },
  { id: "parecer", termo: "Auditoria e parecer", nivel: 1, texto: "A leitura do memorial contra a obra declarada. O parecer é o que sai dela: veredito, achados e o texto para a prefeitura.", ve: ["pdf", "copiar"], sinonimos: ["auditoria"] },
  { id: "veredito", termo: "Veredito", nivel: 1, texto: "O resumo do parecer: Liberado, Liberado com ressalvas, Revisar antes de emitir, Não emitir ou Análise parcial. É do documento auditado e não muda com o tratamento; para mudá-lo, audite a revisão corrigida. Abaixo dele, a faixa mostra quantos achados já foram tratados." },
  { id: "achado", termo: "Achado", nivel: 1, texto: "Um ponto do memorial que o Nexo apontou, com o trecho, a página e o que fazer. Na tela se lê ACH-014.", ve: ["memorial", "atribuir", "link"], sinonimos: ["ach", "problema"] },
  { id: "nivel", termo: "Nível do achado", nivel: 1, texto: "O peso de um achado: Bloqueia a emissão (corrigir antes de gerar), Exige decisão técnica (alguém responsável aceita), Revisão de texto (numeração, unidades, referências) e Gramática (só texto)." },
  { id: "tratamento", termo: "Tratamento", nivel: 1, texto: "O que foi feito com o achado: pendente, com alguém, corrigido, decisão técnica com motivo, ou falso positivo.", ve: ["atribuir"] },
  { id: "volume", termo: "Volume", nivel: 2, texto: "Um PDF final do pacote. Tem grupos, e cada grupo tem separatriz, lista de documentos e pranchas.", ve: ["zip"] },
  { id: "tomo", termo: "Tomo", nivel: 2, texto: "Uma parte física do volume, encadernada à parte. “Divide em 2 tomos” separa as disciplinas.", ve: ["tomos"] },
  { id: "grupo", termo: "Grupo", nivel: 3, texto: "Uma parte do volume, quase sempre uma disciplina, aberta por sua separatriz." },
  { id: "capa", termo: "Capa", nivel: 2, texto: "A primeira folha do volume, no modelo da prefeitura: obra, bairro, fase, volume e mês." },
  { id: "ld", termo: "Lista de documentos (LD)", nivel: 3, texto: "A relação das pranchas do volume, com código, título e revisão, saída dos carimbos.", sinonimos: ["ld", "indice"] },
  { id: "separatriz", termo: "Separatriz", nivel: 3, texto: "A folha que abre cada grupo, com a disciplina. Gerada no Nexo com as pranchas." },
  { id: "folha", termo: "Folha e prancha", nivel: 4, texto: "Folha é a unidade do volume; página é do PDF. Uma prancha pode ocupar mais de uma página." },
  { id: "carimbo", termo: "Carimbo", nivel: 4, texto: "O selo no canto da prancha: número, código, disciplina, título e revisão. É dele que o Nexo tira a LD.", ve: ["carimbo"], sinonimos: ["selo"] },
];

/** Sem acento e sem caixa: quem digita "separatriz" ou "SEPARATRIZ" acha igual. */
export const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const casa = (q: string, campos: (string | undefined)[]) => !q || campos.some((c) => c && semAcento(c).includes(q));

export const achaTarefa = (q: string, t: Tarefa) => casa(q, [t.nome, t.precisa, ...t.passos.map((p) => p.texto), ...(t.sinonimos ?? [])]);
export const achaLugar = (q: string, l: Lugar) => casa(q, [l.nome, l.precisa, l.nota, ...l.caminho, ...(l.sinonimos ?? [])]);
export const achaPalavra = (q: string, p: Palavra) => casa(q, [p.termo, p.texto, ...(p.sinonimos ?? [])]);
