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
import { ExternalLink, Pencil, Scissors, Trash2 } from "lucide-react";

import { AgentPopover } from "@/components/ui/agent-popover";
import { Button } from "@/components/ui/button";
import type { FolhaId } from "../lib/folhas";
import { corDaDisciplina, siglaDaDisciplina } from "../lib/disciplina-cor";
import type { DivergenciaDaFolha } from "../lib/conferencia-por-folha";
import { densidadeDoZoom, oQueMostrar } from "../lib/densidade-do-canvas";
import { AcaoDoNo } from "./AcaoDoNo";
import "@/components/telas/nexo/cartao-da-folha.css";

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
  /**
   * "Tomo aqui" (16/10/2026): começa um tomo nesta folha — ela e as seguintes
   * vão para o próximo. Ausente = o canvas não deixa mexer na divisão.
   */
  onComecarTomo?: (id: FolhaId) => void;
  /** Esta folha já abre um tomo: o "Tomo aqui" não tem o que fazer. */
  comecaTomo?: boolean;
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

  /*
   * O CARTÃO CARIMBO (desenho aprovado no lab, 01/10/2026: "já tem a
   * disciplina e ajuda quando monta volume com várias disciplinas"). A folha
   * se lê como o selo da prancha: células com fio, rótulo pequeno e valor.
   *
   * A DENSIDADE SEGUE O ZOOM (`oQueMostrar`): de longe só o número grande e
   * as marcas; no meio, folha, disciplina e título; de perto, o código do
   * arquivo também. As MARCAS sobrevivem aos três níveis — são sinal de
   * defeito, e a varredura de conjunto é onde ele passaria batido:
   *  - ponto coral/âmbar: a conferência divergiu (sem verde: o normal é mudo);
   *  - quadrado: corrigida à mão;
   *  - anel vazio ao lado do número: número deduzido pela ordem, ninguém leu;
   *  - travessão no lugar do número: a folha não tem número.
   */
  const distancia = !mostrar.titulo ? "longe" : mostrar.carimbo ? "perto" : "media";
  const numeroTexto = semNumero ? "—" : String(data.numero).padStart(2, "0");
  const marcas = (
    <>
      {data.divergencia && (
        <i
          className={`ct-marca mp-tom--${data.divergencia.severidade === "critico" ? "critico" : data.divergencia.severidade === "aviso" ? "aviso" : "neutro"}`}
          title={data.divergencia.motivos.join(" · ")}
          aria-label={`conferência: ${data.divergencia.motivos.join(". ")}`}
        />
      )}
      {data.editado && !data.divergencia && <i className="ct-marca mp-tom--mao" title="corrigido à mão" aria-label="corrigido à mão" />}
    </>
  );
  const anelDaOrdem =
    data.origemDoNumero === "ordem" ? <span className="nx-folha-ordem" aria-label="número deduzido pela ordem das páginas" /> : null;

  const corpo = (
    <div
      className={`ct ct--carimbo ct--${distancia} nx-folha${cor ? " nx-folha--disc" : ""}${selected ? " ct--sel" : ""}${data.editado ? " nx-folha--editada" : ""}`}
      // A cor da disciplina tinge o cartão de leve (03/10/2026): os blocos se separam de relance.
      style={cor ? { ["--dc-cor" as string]: cor } : undefined}
    >
      {distancia === "longe" ? (
        <div className="ct-carimbo-longe">
          <span className={`ct-grande${semNumero ? " ct-falta" : ""}`} title={fonteDoNumero}>
            {numeroTexto}
          </span>
          {marcas}
        </div>
      ) : (
        <div className={`ct-tabela${distancia === "perto" ? " nx-tabela--perto" : ""}`}>
          <div className="ct-cel">
            <small>folha</small>
            <b className={`ct-mono${semNumero ? " ct-falta" : ""}`} title={fonteDoNumero}>
              {numeroTexto}
              {data.total ? `/${String(data.total).padStart(2, "0")}` : ""}
              {anelDaOrdem}
            </b>
          </div>
          <div className="ct-cel">
            <small>disc.</small>
            <b>
              {sigla ? (
                <span className="ct-sigla" style={{ ["--dc-cor" as string]: cor ?? "var(--ds-text-tertiary)" }} title={data.disciplina ?? undefined}>
                  <i />
                  {sigla}
                </span>
              ) : (
                <span className="ct-sigla">—</span>
              )}
            </b>
            {marcas}
          </div>
          <div className="ct-cel ct-cel--titulo nx-cel-titulo">
            <small>título</small>
            <b title={data.titulo}>{data.titulo || "—"}</b>
          </div>
          {distancia === "perto" && data.arquivo?.trim() && (
            <div className="ct-cel ct-cel--titulo ct-cel--codigo">
              <b className="ct-mono" title={data.arquivo}>
                {data.arquivo}
              </b>
            </div>
          )}
        </div>
      )}
      {/*
        A folha sem PDF é DIFERENTE e precisa parecer diferente: entra na LD e
        não entra no volume montado. Quem for montar tem de saber olhando.
      */}
      {data.avulsa && (
        <p className={`nx-folha-avulsa${semCodigo ? " nx-folha-avulsa--sem-codigo" : ""}`} title={semCodigo ? "sem código · não sai na LD" : "sem PDF · só na LD"}>
          {distancia === "longe" ? "" : semCodigo ? "sem código · não sai na LD" : "sem PDF · só na LD"}
        </p>
      )}
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
                  : "Esta prancha não está guardada no projeto. Solte o PDF de novo para ver a página."
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
          {data.onComecarTomo && (
            <AcaoDoNo
              icone={Scissors}
              rotulo="Tomo aqui"
              ajuda={
                data.comecaTomo
                  ? "Esta prancha já abre um tomo."
                  : "Começa um tomo novo nesta prancha: ela e as seguintes vão para o próximo tomo. Para ajustar depois, arraste a marca na régua dos tomos."
              }
              desabilitado={data.comecaTomo === true}
              onClick={() => data.onComecarTomo?.(data.id)}
            />
          )}
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
