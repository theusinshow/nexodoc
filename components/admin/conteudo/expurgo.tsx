"use client";

/**
 * O EXPURGO, na tela — agrupado por obra, que é a unidade em que se pensa.
 *
 * Três alcances: a seleção, a obra inteira, e tudo. Os três passam pela mesma
 * gaveta, e a gaveta CONTA no banco antes de perguntar — ver
 * [[server/admin/expurgo.ts]]. O freio não é teclar, é **saber**: a lista do que
 * vai embora, o que fica, e quantas máquinas vão obedecer à lápide.
 *
 * A confirmação pede o NOME DO ALVO, e não uma palavra genérica. O acidente que
 * este campo evita não é "apertei sem querer" — é "apertei o gesto certo no
 * objeto errado", que é o que de fato acontece numa lista de obras parecidas.
 */

import { AlertTriangle, Database, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminError, TituloDaSecao } from "@/components/admin/admin-page-shell";
import { useAdminToken } from "@/components/admin/admin-token";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { palavraDeConfirmacao, type Alcance } from "@/lib/expurgo";
import { plural } from "@/lib/plural";

type Conversa = {
  id: string;
  userEmail: string;
  title: string;
  tipo: string | null;
  atualizadaEm: string;
  obra: string;
  rotulo: string;
};

type Previa = {
  conversas: number;
  auditorias: number;
  achados: number;
  mensagensDeAchado: number;
  lds: number;
  artefatos: number;
  arquivos: number;
  bytes: number;
  donos: number;
  preservado: { eventosDeConsumo: number; custoUsd: number };
};

type Pendente = { alcance: Alcance; rotulo: string; previa: Previa | null };

function formatarBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return "menos de 0,1 MB";
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

function formatarData(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

/**
 * A MESMA comparação de [[lib/expurgo.ts]], para o botão acender junto.
 *
 * Duplicada de propósito, e a duplicação é declarada: o módulo puro roda em
 * node cru e não pode ser importado por uma tela que o bundler trata como
 * cliente sem arrastar a árvore inteira. O que NÃO pode divergir é a regra — e
 * ela é uma linha: sem acento, sem caixa, sem espaço sobrando.
 *
 * Se as duas divergirem, quem manda é o servidor: este `disabled` é
 * conveniência, e a recusa de verdade está na rota.
 */
function pareceConfirmado(digitado: string, esperado: string) {
  const limpar = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

  return limpar(esperado).length > 0 && limpar(digitado) === limpar(esperado);
}

function rotuloDoTipo(tipo: string | null) {
  if (tipo === "auditoria") return "auditoria";
  if (tipo === "volume") return "montagem de volume";
  return "sem trabalho registrado";
}

export function CorpoDoExpurgo() {
  const { token, restaurado, recarga, registrarResposta } = useAdminToken();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  const carregar = useCallback(
    async (tokenAtual: string) => {
      setCarregando(true);
      setErro("");

      try {
        const resposta = await fetch("/api/admin/dados", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${tokenAtual.trim()}` },
        });
        const corpo = (await resposta.json().catch(() => null)) as
          | { conversas?: Conversa[]; error?: string }
          | null;

        if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível carregar as conversas.");

        registrarResposta(true);
        setConversas(corpo?.conversas ?? []);
        setSelecionadas(new Set());
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar as conversas.");
        setConversas([]);
        registrarResposta(false);
      } finally {
        setCarregando(false);
      }
    },
    [registrarResposta],
  );

  /*
   * Busca quando houver token e quando o trilho pedir recarga. `queueMicrotask`
   * pelo mesmo motivo das outras telas do painel: a carga chama `setState` no
   * corpo dela, e o React Compiler barra `setState` síncrono dentro de efeito.
   */
  useEffect(() => {
    if (!restaurado || !token.trim()) return;
    queueMicrotask(() => void carregar(token));
  }, [restaurado, token, recarga, carregar]);

  /** As obras, na ordem da conversa mais recente de cada uma. */
  const obras = useMemo(() => {
    const mapa = new Map<string, { chave: string; rotulo: string; conversas: Conversa[] }>();

    for (const conversa of conversas) {
      const atual = mapa.get(conversa.obra);
      if (atual) atual.conversas.push(conversa);
      else mapa.set(conversa.obra, { chave: conversa.obra, rotulo: conversa.rotulo, conversas: [conversa] });
    }

    return [...mapa.values()];
  }, [conversas]);

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function alternarObra(chave: string) {
    const daObra = conversas.filter((conversa) => conversa.obra === chave).map((c) => c.id);
    const todasDentro = daObra.every((id) => selecionadas.has(id));

    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      for (const id of daObra) {
        if (todasDentro) proximo.delete(id);
        else proximo.add(id);
      }
      return proximo;
    });
  }

  /** Abre a gaveta e vai contar no banco. A prévia nunca é estimada aqui. */
  async function pedirPrevia(alcance: Alcance, rotulo: string) {
    setPendente({ alcance, rotulo, previa: null });
    setConfirmacao("");
    setErro("");
    setFeito("");

    try {
      const resposta = await fetch("/api/admin/dados/previa", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alcance }),
      });
      const corpo = (await resposta.json().catch(() => null)) as
        | { previa?: Previa; error?: string }
        | null;

      if (!resposta.ok || !corpo?.previa) {
        throw new Error(corpo?.error ?? "Não foi possível contar o que seria apagado.");
      }

      setPendente({ alcance, rotulo, previa: corpo.previa });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível contar o que seria apagado.");
      setPendente(null);
    }
  }

  async function executar() {
    if (!pendente) return;

    setExecutando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/admin/dados/expurgo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alcance: pendente.alcance,
          rotulo: pendente.rotulo,
          confirmacao,
        }),
      });
      const corpo = (await resposta.json().catch(() => null)) as
        | { apagado?: Previa; error?: string }
        | null;

      if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível expurgar.");

      const apagado = corpo?.apagado;

      setFeito(
        apagado
          ? `Expurgado: ${plural(apagado.conversas, "conversa", "conversas")}, ` +
              `${plural(apagado.auditorias, "auditoria", "auditorias")} e ` +
              `${formatarBytes(apagado.bytes)} de arquivos. ` +
              `${plural(apagado.donos, "máquina vai obedecer", "donos vão receber a lápide")}.`
          : "Expurgado.",
      );
      setPendente(null);
      setConfirmacao("");
      await carregar(token);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível expurgar.");
    } finally {
      setExecutando(false);
    }
  }

  const esperado = pendente
    ? palavraDeConfirmacao(pendente.alcance, pendente.rotulo)
    : "";

  return (
    <section className="flex flex-col gap-4">
      <TituloDaSecao
        icon={Database}
        titulo="Conversas e expurgo"
        descricao="As conversas do Nexo agrupadas por obra. Apagar aqui é permanente e alcança as máquinas que montaram — não só o banco."
      />

      <AdminError message={erro} />

      {feito ? (
        <p className="nx-edge-8 p-3 text-sm text-[var(--status-ok)] [--nx-edge:var(--status-ok)]">
          {feito}
        </p>
      ) : null}

      {pendente ? (
        <GavetaDeConfirmacao
          pendente={pendente}
          esperado={esperado}
          confirmacao={confirmacao}
          executando={executando}
          onConfirmacao={setConfirmacao}
          onCancelar={() => {
            setPendente(null);
            setConfirmacao("");
          }}
          onExecutar={() => void executar()}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        {obras.map((obra) => {
          const ids = obra.conversas.map((conversa) => conversa.id);
          const todasDentro = ids.every((id) => selecionadas.has(id));

          return (
            <article key={obra.chave} className="nx-edge-8">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
                <label className="flex min-w-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={todasDentro}
                    onChange={() => alternarObra(obra.chave)}
                    className="size-3.5 accent-[var(--primary)]"
                  />
                  <span className="truncate text-sm font-semibold">{obra.rotulo}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {plural(obra.conversas.length, "conversa", "conversas")}
                  </span>
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[var(--status-critical)]"
                  onClick={() =>
                    void pedirPrevia({ tipo: "obra", chave: obra.chave }, obra.rotulo)
                  }
                >
                  <Trash2 />
                  expurgar a obra
                </Button>
              </header>

              <ul className="divide-y divide-border">
                {obra.conversas.map((conversa) => (
                  <li key={conversa.id}>
                    <label className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selecionadas.has(conversa.id)}
                        onChange={() => alternar(conversa.id)}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{conversa.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {rotuloDoTipo(conversa.tipo)} · {conversa.userEmail} ·{" "}
                        {formatarData(conversa.atualizadaEm)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}

        {!carregando && conversas.length === 0 ? (
          <EmptyState description="Nenhuma conversa no servidor." className="py-10" />
        ) : null}
        {carregando ? (
          <p className="flex items-center gap-2 px-1 font-mono text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            carregando…
          </p>
        ) : null}
      </div>

      {conversas.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {selecionadas.size > 0
                ? plural(selecionadas.size, "conversa selecionada", "conversas selecionadas")
                : "nenhuma selecionada"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-[var(--status-critical)]"
              disabled={selecionadas.size === 0}
              onClick={() =>
                void pedirPrevia({ tipo: "selecao", ids: [...selecionadas] }, "a seleção")
              }
            >
              <Trash2 />
              expurgar a seleção
            </Button>
          </div>

          {/*
            "Zerar tudo" fica NO CANTO OPOSTO do gesto que se usa todo dia, e
            longe das caixas de seleção. É o único botão da tela que não tem
            alvo visível — e o único cujo acidente não se conserta.
          */}
          <Button
            size="sm"
            variant="ghost"
            className="text-[var(--status-critical)]"
            onClick={() => void pedirPrevia({ tipo: "tudo" }, "tudo")}
          >
            <AlertTriangle />
            zerar tudo
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A gaveta: o que vai, o que fica, quem obedece — e só então o campo.
 *
 * A ORDEM DOS BLOCOS É A DA DECISÃO. O campo de confirmação vem por último, e
 * de propósito: quem chega nele já passou os olhos pela conta. Um campo no topo
 * viraria o único conteúdo lido.
 */
function GavetaDeConfirmacao({
  pendente,
  esperado,
  confirmacao,
  executando,
  onConfirmacao,
  onCancelar,
  onExecutar,
}: {
  pendente: Pendente;
  esperado: string;
  confirmacao: string;
  executando: boolean;
  onConfirmacao: (valor: string) => void;
  onCancelar: () => void;
  onExecutar: () => void;
}) {
  const previa = pendente.previa;

  return (
    <section
      role="alertdialog"
      aria-label={`Expurgar ${pendente.rotulo}`}
      className="nx-edge-8 flex flex-col gap-3 p-4 [--nx-edge:var(--status-critical)]"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--status-critical)]">
        <AlertTriangle className="size-4" />
        Expurgar {pendente.rotulo}
      </h3>

      {!previa ? (
        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          contando no banco…
        </p>
      ) : (
        <>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              vai embora
            </p>
            <ul className="mt-1 grid gap-x-6 gap-y-0.5 font-mono text-xs sm:grid-cols-2">
              <li>{plural(previa.conversas, "conversa", "conversas")}</li>
              <li>{plural(previa.auditorias, "auditoria", "auditorias")}</li>
              <li>{plural(previa.achados, "achado", "achados")}</li>
              <li>
                {plural(previa.mensagensDeAchado, "mensagem de achado", "mensagens de achado")}
              </li>
              <li>{plural(previa.lds, "LD", "LDs")}</li>
              <li>{plural(previa.artefatos, "artefato", "artefatos")}</li>
              <li className="sm:col-span-2">
                {plural(previa.arquivos, "arquivo guardado", "arquivos guardados")} (
                {formatarBytes(previa.bytes)})
              </li>
            </ul>
          </div>

          {/*
            O QUE FICA aparece com o mesmo peso do que vai. Preservar o consumo
            foi decisão, e uma decisão que o operador precisa VER — senão ele
            procura depois por um gasto que acha que apagou.
          */}
          <div className="border-l-2 border-[var(--status-ok)] pl-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              fica
            </p>
            <p className="mt-0.5 font-mono text-xs">
              {plural(
                previa.preservado.eventosDeConsumo,
                "evento de consumo",
                "eventos de consumo",
              )}{" "}
              (US$ {previa.preservado.custoUsd.toFixed(2).replace(".", ",")})
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              O custo por obra vai passar a listar isto como “conversa removida”.
            </p>
          </div>

          {previa.donos > 0 ? (
            <p className="border-l-2 border-[var(--status-warning)] pl-3 font-mono text-xs text-[var(--status-warning)]">
              {plural(previa.donos, "dono vai receber", "donos vão receber")} a lápide: as máquinas
              deles apagam a cópia local no próximo carregamento do Nexo.
            </p>
          ) : null}

          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-muted-foreground">
                digite <strong className="text-foreground">{esperado}</strong> para liberar
              </span>
              <input
                value={confirmacao}
                onChange={(evento) => onConfirmacao(evento.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="nx-edge-7 h-9 w-[280px] bg-transparent px-3 text-sm outline-none [--nx-fill:var(--nexodoc-recessed)]"
              />
            </label>
            <Button
              variant="destructive"
              loading={executando}
              /*
               * A comparação de verdade é do servidor — este `disabled` é
               * conveniência. Se ele fosse a única guarda, qualquer cliente que
               * chamasse a rota direto passaria por cima dela.
               */
              disabled={executando || !pareceConfirmado(confirmacao, esperado)}
              onClick={onExecutar}
            >
              <Trash2 />
              Expurgar
            </Button>
            <Button variant="ghost" onClick={onCancelar} disabled={executando}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
