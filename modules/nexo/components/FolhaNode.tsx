"use client";

/**
 * Uma folha (prancha) como nó do canvas. BARATO de propósito: texto puro, nenhum
 * PDF renderizado — um projeto pode ter 200+ folhas, e miniatura em todas
 * trocaria este trabalho por um trabalho sobre performance.
 *
 * O nó mostra o que o selo diz. Quando algum campo veio de ajuste manual
 * (`editado`), ele se marca — sem a marca o usuário não distingue o que o sistema
 * leu do que ele mesmo mudou.
 */

import { useState } from "react";
import { Handle, Position, useStore, type Node, type NodeProps } from "@xyflow/react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { AgentPopover } from "@/components/ui/agent-popover";
import { Button } from "@/components/ui/button";
import type { FolhaId } from "../lib/folhas";
import { corDaDisciplina, siglaDaDisciplina } from "../lib/disciplina-cor";
import type { DivergenciaDaFolha } from "../lib/conferencia-por-folha";
import { densidadeDoZoom, oQueMostrar } from "../lib/densidade-do-canvas";
import { AcaoDoNo } from "./AcaoDoNo";

export type FolhaNodeData = {
  id: FolhaId;
  /** Número da folha resolvido (`resolveSheetNumbers`), ou null quando não há. */
  numero: number | null;
  /** Total de folhas do conjunto — o "24" de "05/24". */
  total?: number | null;
  titulo: string;
  /** Disciplina lida do carimbo: vira a sigla e o fio de cor no topo. */
  disciplina?: string | null;
  editado: boolean;
  /** Falso na conversa restaurada: os bytes da prancha não persistem. */
  podeAbrir: boolean;
  onAbrir: (id: FolhaId) => void;
  /** Código da prancha (campo ARQUIVO do carimbo) — sai na coluna ARQUIVOS da LD. */
  arquivo?: string | null;
  /** Criada à mão: não há PDF por trás dela, então ela não entra no volume. */
  avulsa?: boolean;
  /** Campo VAZIO desfaz aquele ajuste e devolve o que o selo dizia. */
  /**
   * DE ONDE VEIO O NÚMERO desta folha.
   *
   * `ordem` é o único que aparece SEM hover, e é decisão: ele quer dizer que
   * ninguém leu este número — a reconciliação o deduziu da posição da página.
   * Um palpite por posição que se parece com uma leitura é a informação mais
   * cara de esconder nesta tela.
   */
  origemDoNumero?: "mao" | "nome" | "carimbo" | "ordem" | null;
  /**
   * O que a CONFERÊNCIA pesa sobre esta folha — traduzido do achado agregado
   * pelo índice de `conferencia-por-folha.ts`. Ausente = nada pesa, e o nó não
   * ganha marca nenhuma: um "ok" em cada uma das duzentas folhas é ruído que
   * apaga as três que importam.
   */
  divergencia?: DivergenciaDaFolha;
  /**
   * O formulário de correção está aberto NESTE nó.
   *
   * A decisão mora no canvas: é ele que sabe quantos nós estão selecionados e é
   * ele que recebe a tecla `E`. O nó só desenha o que lhe dizem.
   */
  emCorrecao?: boolean;
  /** Pede ao canvas para abrir a correção aqui. */
  onPedirCorrecao: (id: FolhaId) => void;
  /** Fecha a correção — cancelar, salvar ou clicar fora. */
  onFecharCorrecao: () => void;
  onCorrigir: (
    id: FolhaId,
    patch: {
      titulo?: string;
      numero?: string;
      total?: string;
      arquivo?: string;
      disciplina?: string;
    },
  ) => void;
  /** Tira a folha do conjunto (ou apaga de vez, se ela foi criada à mão). */
  onRemover: (id: FolhaId) => void;
} & Record<string, unknown>;

/**
 * As disciplinas do escritório, para a lista de sugestão do campo.
 *
 * É `datalist` e não `select`: a lista fechada recusaria a disciplina que o
 * escritório ainda não catalogou, e a folha ficaria sem bloco por causa de um
 * campo — o pior jeito de perder um documento.
 */
const DISCIPLINAS_SUGERIDAS = [
  "Arquitetonico",
  "Urbanismo",
  "Paisagismo",
  "Maquete",
  "Fundacoes",
  "Estrutural",
  "Estrutura metalica",
  "Eletrico",
  "Cabeamento estruturado",
  "CFTV",
  "Hidrossanitario",
  "Preventivo contra incendio",
  "SPDA",
  "Climatizacao",
  "Gases medicinais",
  "Topografia",
  "Sondagem",
  "Levantamento",
  "Geometrico",
  "Terraplenagem",
  "Drenagem",
  "Pavimentacao",
];

export function FolhaNode({ data, selected }: NodeProps<Node<FolhaNodeData>>) {
  /*
   * QUEM ABRE A CORREÇÃO É O CANVAS, e não este nó.
   *
   * Era estado local, aberto só pelo botão "Corrigir" — e o teclado não tem
   * como apertar um botão que só existe dentro de um nó. Com a decisão no
   * canvas, mouse e tecla `E` passam pela MESMA porta; duas portas para o mesmo
   * formulário divergiriam na primeira correção (uma semeando os campos, a
   * outra não).
   */
  const corrigindo = data.emCorrecao === true;
  const [confirmando, setConfirmando] = useState(false);
  /*
   * `null` = "não mexeram neste campo", e aí vale o que veio do carimbo.
   *
   * Antes os campos eram semeados no clique do botão. Semear é um passo que só
   * o caminho do mouse dava: aberto pelo teclado, o formulário apareceria com o
   * número e a disciplina em branco, e salvar apagaria o que o OCR tinha lido
   * certo. Derivar do dado remove o passo — e com ele o modo de errar.
   */
  const [texto, setTexto] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [total, setTotal] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [disciplina, setDisciplina] = useState<string | null>(null);

  const vTexto = texto ?? data.titulo ?? "";
  const vNumero = numero ?? (data.numero != null ? String(data.numero) : "");
  const vTotal = total ?? (data.total != null ? String(data.total) : "");
  const vArquivo = arquivo ?? data.arquivo ?? "";
  const vDisciplina = disciplina ?? data.disciplina ?? "";

  /** Fecha e esquece o que foi digitado: reabrir mostra o carimbo de novo. */
  function fecharCorrecao() {
    setTexto(null);
    setNumero(null);
    setTotal(null);
    setArquivo(null);
    setDisciplina(null);
    data.onFecharCorrecao();
  }

  /*
   * "Corrigido à mão" é ÊNFASE, não status: o valor não está errado nem certo —
   * ele veio de uma pessoa em vez do carimbo. Era âmbar, e âmbar aqui dizia
   * "atenção, tem algo errado com esta folha", que é justamente o contrário.
   */
  /* A cor do contorno vira --nx-edge: com chanfro, a borda e o FUNDO do
     elemento e o miolo e o ::before -- `border` seria cortada nas diagonais. */
  const borda = selected
    ? "[--nx-edge:var(--ring)]"
    : data.editado
      ? "[--nx-edge:var(--nexodoc-tertiary-strong)]"
      : "[--nx-edge:var(--border)]";

  /*
   * A DENSIDADE, e não o zoom.
   *
   * `useViewport()` devolveria um número novo a cada quadro do gesto, e cada
   * quadro reenderizaria os duzentos nós — o oposto do que o zoom semântico
   * existe para resolver. O seletor mapeia o zoom para UM DOS TRÊS NOMES antes
   * da comparação: o nó só volta a renderizar quando a faixa muda, o que
   * acontece duas vezes num gesto inteiro, e não sessenta.
   *
   * Render CONDICIONAL, e não CSS que esconde: DOM oculto em duzentos nós pesa
   * igual, e a economia seria só visual.
   */
  const densidade = useStore((estado) => densidadeDoZoom(estado.transform[2]));
  const mostrar = oQueMostrar(densidade);

  /*
   * A PROVENIÊNCIA EM PALAVRAS, no `title`.
   *
   * A proposta pede "marcador discreto que acende no hover, nunca uma segunda
   * linha de texto permanente" — e num nó de 120px com duzentos irmãos, a
   * frase é o `title`: custa zero pixel e responde a pergunta inteira.
   */
  const FONTE: Record<string, string> = {
    mao: "número corrigido à mão",
    nome: "número lido do nome do arquivo",
    carimbo: "número lido do carimbo",
    ordem: "número deduzido pela ordem das páginas — ninguém o leu",
  };
  const fonteDoNumero = data.origemDoNumero ? FONTE[data.origemDoNumero] : undefined;

  const cor = corDaDisciplina(data.disciplina);
  const sigla = siglaDaDisciplina(data.disciplina);
  const semNumero = data.numero == null;
  /*
   * Folha criada à mão SEM código não sai na LD: a proposta descarta o selo que
   * não tem nem arquivo nem nome, e o código é a única coisa que uma folha sem
   * PDF tem para se identificar. Uma linha que o engenheiro criou e não aparece
   * no documento é pior do que não ter podido criá-la — então isto é dito no nó.
   */
  const semCodigo = data.avulsa === true && !data.arquivo?.trim();

  const corpo = (
    <div
      className={`nx-edge-6 w-[120px] overflow-hidden ${borda} transition-colors duration-[var(--duration-fast)] ease-[var(--ease-feedback)]`}
    >
      {/*
       * O fio de 2px no topo é a disciplina — a ÚNICA cor do nó, e secundária à
       * sigla: quem não distingue matiz continua lendo "ARQ". Disciplina fora
       * das oito famílias não ganha cor: sem cor é melhor que cor errada.
       */}
      <div
        className="h-0.5 w-full"
        style={{ background: cor ?? "transparent" }}
        aria-hidden
      />
      <div className="px-2 py-1.5">
      <div className="flex items-center gap-1">
        {/* O travessão em rust marca a AUSÊNCIA do número sem chamar de erro:
            a folha continua arrastável e continua entrando no volume. */}
        <span
          title={fonteDoNumero}
          className={`font-mono text-[10px] tabular-nums ${
            semNumero
              ? "text-[var(--nexodoc-tertiary-strong)]"
              : "text-muted-foreground"
          }`}
        >
          {semNumero ? "—" : String(data.numero).padStart(2, "0")}
          {data.total ? `/${String(data.total).padStart(2, "0")}` : ""}
          {/*
            O ANEL VAZIO do número deduzido — e SÓ dele.
            Marcar as quatro origens encheria o nó de pontos e apagaria o único
            que muda o que se faz: os outros três são leituras de algum lugar;
            este é posição. Anel vazio, e não ponto cheio: a forma diz "falta
            miolo aqui" sem gastar uma cor do sistema.
          */}
          {data.origemDoNumero === "ordem" && (
            <span
              aria-label="número deduzido pela ordem das páginas"
              className="ml-1 inline-block size-1.5 rounded-full border border-muted-foreground align-middle"
            />
          )}
        </span>
        {sigla && mostrar.sigla && (
          <span className="font-mono text-[10px] tracking-[0.05em] text-muted-foreground">
            · {sigla}
          </span>
        )}
        {data.editado && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--nexodoc-tertiary-strong)]"
            title="corrigido à mão"
            aria-label="corrigido à mão"
          />
        )}
        {/*
          A MARCA DA CONFERÊNCIA, e ela sobrevive aos três níveis de zoom pelo
          mesmo motivo da marca de "corrigido à mão": é sinal de DEFEITO, e a
          varredura de conjunto é exatamente aquela em que ele passaria batido.

          Sem verde. "Sem divergência" é o normal, e o normal é mudo — duzentos
          pontos verdes apagariam os três coloridos que importam.
        */}
        {data.divergencia && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background:
                data.divergencia.severidade === "critico"
                  ? "var(--status-critical)"
                  : data.divergencia.severidade === "aviso"
                    ? "var(--status-warning)"
                    : "var(--muted-foreground)",
            }}
            title={data.divergencia.motivos.join(" · ")}
            aria-label={`conferência: ${data.divergencia.motivos.join(". ")}`}
          />
        )}
      </div>
      {/*
        CINCO LINHAS, não duas.
        Com 44 folhas na tela, conferir o título era abrir cada uma — e conferir
        é justamente o que se vai fazer ali. Pior: o corte do carimbo devolvia
        "PLANTA DE" onde o desenho diz "PLANTA DE IMPLANTAÇÃO", e um clamp de
        duas linhas fazia esse pedaço parecer um título completo. O defeito se
        escondia atrás do próprio recorte da tela.

        CINCO é medido, não escolhido: as descrições reais dos quatro projetos
        têm mediana de 37 caracteres e p90 de 97, e num nó de 120px a 10px isso
        cabe em cinco linhas. O que passa disso é raro e continua com o texto
        inteiro no `title`.

        NÃO É ROLAGEM INTERNA, e a razão é o canvas: um `overflow-y-auto` aqui
        exigiria `nowheel` do React Flow, e com quarenta e quatro nós metade da
        tela viraria zona morta de zoom. Altura fixa mantém a grade regular —
        cartão de altura variável vira escada e destrói a varredura, que é a
        razão desta tela existir.
      */}
      {mostrar.titulo && (
        <p
          className="mt-0.5 line-clamp-5 min-h-[3.6em] text-[10px] leading-tight"
          title={data.titulo}
        >
          {data.titulo || "—"}
        </p>
      )}
      {/*
        O CARIMBO INTEIRO só de perto — e é aqui que o zoom semântico paga.
        Código do arquivo e disciplina por extenso são o que se confere contra a
        prancha, folha a folha; de longe eles são ruído sobre duzentos nós, e no
        meio do caminho competiriam com o título.
      */}
      {mostrar.carimbo && (data.arquivo?.trim() || data.disciplina?.trim()) && (
        <div className="mt-1 grid gap-0.5 border-t border-[var(--border)] pt-1">
          {data.arquivo?.trim() && (
            <p
              className="truncate font-mono text-[9px] text-muted-foreground"
              title={data.arquivo}
            >
              {data.arquivo}
            </p>
          )}
          {data.disciplina?.trim() && (
            <p className="truncate text-[9px] text-muted-foreground" title={data.disciplina}>
              {data.disciplina}
            </p>
          )}
        </div>
      )}
      {/*
        A folha sem PDF é DIFERENTE das outras e precisa parecer diferente: ela
        entra na lista de documentos e não entra no volume montado. Quem for
        montar tem de saber disso olhando, não descobrindo no PDF final.
      */}
      {data.avulsa && !mostrar.titulo && (
        /*
         * DE LONGE O AVISO VIRA PONTO, e não desaparece: "sem código · não sai
         * na LD" é um defeito de verdade, e uma varredura que o esconde no zoom
         * de conjunto é justamente a varredura em que ele passaria batido.
         */
        <span
          className={
            semCodigo
              ? "mt-1 block h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]"
              : "mt-1 block h-1.5 w-1.5 rounded-full bg-muted-foreground"
          }
          title={semCodigo ? "sem código · não sai na LD" : "sem PDF · só na LD"}
          aria-label={semCodigo ? "sem código, não sai na LD" : "sem PDF, só na LD"}
        />
      )}
      {data.avulsa && mostrar.titulo && (
        <p
          className={
            semCodigo
              ? "mt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--status-warning)]"
              : "mt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground"
          }
        >
          {semCodigo ? "sem código · não sai na LD" : "sem PDF · só na LD"}
        </p>
      )}
      {/* As ações só no nó SELECIONADO: com 200 folhas na tela, botões em todas
          seriam ruído maior que o conteúdo.

          E SÓ ONDE DÁ PARA LÊ-LAS. No zoom de conjunto os rótulos viram fiapo
          de 4px, e o nó selecionado ficava três vezes mais alto que os vizinhos
          — a escada que o comentário das cinco linhas existe para evitar, agora
          criada pela própria seleção. Quem navega por teclado não perde nada:
          `E` e `Enter` fazem o mesmo sem os botões. */}
      {selected && !confirmando && mostrar.titulo && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <AcaoDoNo
            icone={ExternalLink}
            rotulo="Abrir"
            ajuda={
              data.avulsa
                ? "Esta folha foi criada à mão: não existe PDF para abrir."
                : data.podeAbrir
                  ? "Abre a página original desta prancha em outra aba."
                  : "Os PDFs anexados não ficam guardados. Reanexe as pranchas para ver a página."
            }
            desabilitado={!data.podeAbrir}
            onClick={() => data.onAbrir(data.id)}
          />
          <AcaoDoNo
            icone={Pencil}
            rotulo="Corrigir"
            ajuda="Corrige o que a IA leu do carimbo: nº da prancha, total do conjunto, código do arquivo, disciplina e título. Os valores novos saem na LD gerada depois."
            onClick={() => data.onPedirCorrecao(data.id)}
          />
          <AcaoDoNo
            icone={Trash2}
            rotulo="Remover"
            ajuda={
              data.avulsa
                ? "Apaga esta folha criada à mão. Ela não veio de PDF nenhum, então não há o que restaurar."
                : "Tira esta folha da LD, do volume e da conferência. Dá para trazer de volta pela barra do canvas."
            }
            tom="perigo"
            onClick={() => setConfirmando(true)}
          />
        </div>
      )}
      {/*
        Confirmação INLINE, no próprio nó — o mesmo padrão do nó de artefato.
        Remover é reversível (ou, na folha criada à mão, é desfazer o que a
        própria pessoa criou há pouco), então um modal custaria mais atenção do
        que a decisão vale.
      */}
      {selected && confirmando && (
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">
            {data.avulsa ? "Apagar?" : "Remover?"}
          </span>
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              data.onRemover(data.id);
            }}
            className="nodrag nopan font-medium text-destructive underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="nodrag nopan text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            Não
          </button>
        </div>
      )}
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      </div>
    </div>
  );

  return (
    <AgentPopover
      open={corrigindo}
      onClose={fecharCorrecao}
      label="Corrigir a folha"
      panelClassName="w-[280px]"
      anchor={corpo}
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          data.onCorrigir(data.id, {
            titulo: vTexto,
            numero: vNumero,
            total: vTotal,
            arquivo: vArquivo,
            disciplina: vDisciplina,
          });
          fecharCorrecao();
        }}
      >
        {/*
          Os campos que o carimbo erra e que a tela antiga corrigia: o nº da
          prancha, o código do arquivo, a disciplina e o título. Ficam aqui, no
          lugar onde o engenheiro já corrigia o título — sem tela nova, e sem
          transformar o cartão de confirmação em formulário.
        */}
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
              Nº da prancha
            </span>
            {/* Wrapper pela mesma razao do primitivo Input: campo nativo nao
                renderiza ::before, entao a camada de contorno mora fora. */}
            <div className="nx-edge-6 w-full [--nx-edge:var(--border)] [--nx-fill:var(--background)]">
              <input
                value={vNumero}
                onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="—"
                autoFocus
                className="nodrag nopan w-full border-0 bg-transparent p-1.5 font-mono text-[11px] tabular-nums outline-none"
              />
            </div>
          </label>
          {/*
            O TOTAL é o "/24" do carimbo — e é ele que diz quantas folhas
            deveriam existir. Sai do total dominante lido pela IA, e quando o
            OCR erra na maioria das pranchas a conferência acusa folhas
            faltando num conjunto completo. Vale para a DISCIPLINA inteira,
            porque é assim que o carimbo é impresso: todas as folhas de uma
            disciplina dizem o mesmo total.
          */}
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
              de (total)
            </span>
            <div className="nx-edge-6 w-full [--nx-edge:var(--border)] [--nx-fill:var(--background)]">
              <input
                value={vTotal}
                onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="—"
                className="nodrag nopan w-full border-0 bg-transparent p-1.5 font-mono text-[11px] tabular-nums outline-none"
              />
            </div>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
            Código do arquivo
          </span>
          <div className="nx-edge-6 w-full [--nx-edge:var(--border)] [--nx-fill:var(--background)]">
            <input
              value={vArquivo}
              onChange={(e) => setArquivo(e.target.value)}
              placeholder="040_26_arq_005_a"
              className="nodrag nopan w-full border-0 bg-transparent p-1.5 font-mono text-[11px] outline-none"
            />
          </div>
        </label>
        {/*
          A DISCIPLINA decide em que bloco do volume a folha entra — e, com ela,
          sob qual separatriz e em qual LD a prancha vai sair impressa. Era o
          único campo do carimbo sem conserto: quando o OCR lia errado, a folha
          ia para o bloco errado do volume e não havia onde dizer que não.
        */}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
            Disciplina
          </span>
          <div className="nx-edge-6 w-full [--nx-edge:var(--border)] [--nx-fill:var(--background)]">
            <input
              value={vDisciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              list="nexo-disciplinas"
              placeholder="Drenagem"
              className="nodrag nopan w-full border-0 bg-transparent p-1.5 text-[11px] outline-none"
            />
          </div>
          <datalist id="nexo-disciplinas">
            {DISCIPLINAS_SUGERIDAS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.07em] text-muted-foreground">
            Título
          </span>
          <div className="nx-edge-6 w-full [--nx-edge:var(--border)] [--nx-fill:var(--background)]">
            <textarea
              value={vTexto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              className="nodrag nopan w-full resize-none border-0 bg-transparent p-1.5 text-[11px] outline-none"
            />
          </div>
        </label>
        <p className="text-[10px] leading-4 text-muted-foreground">
          Campo vazio devolve o que o selo dizia. O nº posto aqui vence o carimbo
          e o nome do arquivo; a disciplina posta aqui manda no bloco do volume.
          O <strong className="font-medium text-foreground">total</strong> vale
          para a disciplina inteira — é ele que diz quantas folhas deveriam
          existir, na LD e na conferência.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fecharCorrecao}
            className="nodrag nopan"
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" className="nodrag nopan">
            Aplicar
          </Button>
        </div>
      </form>
    </AgentPopover>
  );
}
