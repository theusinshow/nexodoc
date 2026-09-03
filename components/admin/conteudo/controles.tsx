"use client";

/**
 * OS CONTROLES, na tela — o fim do "ver muito e poder pouco".
 *
 * O painel mostrava o gasto do mês sem mostrar o teto, listava os limites de
 * leitura em modo leitura pura e não dizia uma palavra sobre a vazão. Tudo isso
 * só mudava por variável de ambiente, ou seja: por deploy.
 *
 * CADA CAMPO DIZ DE ONDE VEIO O VALOR — banco, ambiente ou não declarado. Sem
 * isso, um campo preenchido é ambíguo entre "alguém decidiu isto" e "é o que a
 * variável do provedor diz", e essas duas coisas se desfazem de jeitos
 * diferentes.
 *
 * Este componente é usado por três destinos, cada um com as suas chaves: o teto
 * no Dinheiro, a vazão e os limites no Motor, o freio no Pessoas.
 */

import { Loader2, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminError } from "@/components/admin/admin-page-shell";
import { useAdminToken } from "@/components/admin/admin-token";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Origem = "banco" | "ambiente" | "padrao";

type Controle = {
  chave: string;
  rotulo: string;
  descricao: string;
  variavel: string;
  minimo: number;
  maximo: number;
  unidade: string;
  padrao: number | null;
  valor: number | null;
  origem: Origem;
};

type Freio = {
  estado: "prosul" | "convite" | "outra";
  organizationId: string | null;
  origem: Origem;
};

type Retrato = { databaseConfigured: boolean; controles: Controle[]; freio: Freio };

const rotuloDaOrigem: Record<Origem, string> = {
  banco: "declarado aqui",
  ambiente: "vem do ambiente",
  padrao: "não declarado",
};

function formatar(valor: number | null, unidade: string) {
  if (valor === null) return "";
  if (unidade === "ms") return String(valor);
  return String(valor).replace(".", ",");
}

export function CorpoDosControles({
  chaves,
  comFreio = false,
}: {
  /** Quais controles este destino mostra. */
  chaves: readonly string[];
  /** O interruptor do cadastro automático — só o Pessoas o mostra. */
  comFreio?: boolean;
}) {
  const { token, restaurado, recarga, registrarResposta } = useAdminToken();
  const [retrato, setRetrato] = useState<Retrato | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(
    async (tokenAtual: string) => {
      try {
        const resposta = await fetch("/api/admin/controles", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${tokenAtual.trim()}` },
        });
        const corpo = (await resposta.json().catch(() => null)) as
          | (Retrato & { error?: string })
          | null;

        if (!resposta.ok || !corpo) {
          throw new Error(corpo?.error ?? "Não foi possível carregar os controles.");
        }

        registrarResposta(true);
        setRetrato(corpo);
        /*
         * O RASCUNHO É REDESENHADO A CADA CARGA, e é o certo: depois de salvar,
         * o campo tem que mostrar o que o servidor aceitou — não o que foi
         * digitado. Os dois divergem quando a guarda arredonda ou recusa.
         */
        setRascunho(
          Object.fromEntries(
            corpo.controles.map((c) => [c.chave, formatar(c.valor, c.unidade)]),
          ),
        );
        setErro("");
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar os controles.");
        registrarResposta(false);
      }
    },
    [registrarResposta],
  );

  useEffect(() => {
    if (!restaurado || !token.trim()) return;
    queueMicrotask(() => void carregar(token));
  }, [restaurado, token, recarga, carregar]);

  async function mandar(corpo: Record<string, unknown>, marca: string) {
    setSalvando(marca);
    setErro("");

    try {
      const resposta = await fetch("/api/admin/controles", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corpo),
      });
      const dados = (await resposta.json().catch(() => null)) as
        | (Retrato & { error?: string })
        | null;

      if (!resposta.ok || !dados) throw new Error(dados?.error ?? "Não foi possível salvar.");

      setRetrato(dados);
      setRascunho(
        Object.fromEntries(dados.controles.map((c) => [c.chave, formatar(c.valor, c.unidade)])),
      );
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar.");
    } finally {
      setSalvando("");
    }
  }

  const mostrados = (retrato?.controles ?? []).filter((c) => chaves.includes(c.chave));

  return (
    <div className="flex flex-col gap-3">
      <AdminError message={erro} />

      {retrato && !retrato.databaseConfigured ? (
        <p className="nx-edge-8 p-3 text-sm text-[var(--status-warning)] [--nx-edge:var(--status-warning)]">
          Sem DATABASE_URL: os controles continuam valendo pelo ambiente, e nada do que for
          declarado aqui é gravado.
        </p>
      ) : null}

      {!retrato ? (
        <p className="flex items-center gap-2 px-1 font-mono text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          carregando…
        </p>
      ) : null}

      {mostrados.map((controle) => (
        <article key={controle.chave} className="nx-edge-8 flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{controle.rotulo}</h3>
            <span className="font-mono text-[11px] text-muted-foreground">
              {rotuloDaOrigem[controle.origem]} · {controle.variavel}
            </span>
          </div>

          <p className="max-w-3xl text-xs leading-5 text-muted-foreground">{controle.descricao}</p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={rascunho[controle.chave] ?? ""}
              onChange={(evento) =>
                setRascunho((atual) => ({ ...atual, [controle.chave]: evento.target.value }))
              }
              inputMode="decimal"
              /*
               * O PLACEHOLDER É A FAIXA, não um exemplo. Campo vazio aqui
               * significa "desligado" ou "quem decide é o motor", e a pessoa
               * precisa saber o que pode digitar antes de digitar.
               */
              placeholder={`vazio = não declarado · aceita ${controle.minimo} a ${controle.maximo}`}
              className="nx-edge-7 h-9 w-[340px] max-w-full bg-transparent px-3 text-sm outline-none [--nx-fill:var(--nexodoc-recessed)]"
            />
            <Button
              size="sm"
              loading={salvando === controle.chave}
              disabled={Boolean(salvando)}
              onClick={() =>
                void mandar(
                  { chave: controle.chave, valor: rascunho[controle.chave] ?? "" },
                  controle.chave,
                )
              }
            >
              <Save />
              Salvar
            </Button>
            {controle.origem === "banco" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={Boolean(salvando)}
                onClick={() =>
                  void mandar(
                    { acao: "esquecer", chave: controle.chave },
                    `${controle.chave}:esquecer`,
                  )
                }
                title="Apaga a declaração e volta a valer o ambiente (ou o padrão do motor)"
              >
                <RotateCcw />
                voltar ao ambiente
              </Button>
            ) : null}
          </div>
        </article>
      ))}

      {comFreio && retrato ? <PainelDoFreio freio={retrato.freio} onMandar={mandar} salvando={salvando} /> : null}
    </div>
  );
}

/**
 * O FREIO DO CADASTRO AUTOMÁTICO — três estados, e o aviso do que cada um abre.
 *
 * O aviso não é decoração: com "entra na PROSUL", o login é Google e QUALQUER
 * conta Google que abrir o site vira membro e enxerga os projetos. Isso estava
 * escrito num comentário do código, onde quem opera nunca leria.
 */
function PainelDoFreio({
  freio,
  onMandar,
  salvando,
}: {
  freio: Freio;
  onMandar: (corpo: Record<string, unknown>, marca: string) => Promise<void>;
  salvando: string;
}) {
  const [estado, setEstado] = useState(freio.estado);
  const [organizationId, setOrganizationId] = useState(freio.organizationId ?? "");

  return (
    <article className="nx-edge-8 flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Quem entra sem convite</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {rotuloDaOrigem[freio.origem]} · NEXODOC_ESCRITORIO_PADRAO
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={estado}
          onChange={(evento) => setEstado(evento.target.value as Freio["estado"])}
          className="h-9 w-[280px]"
          aria-label="Quem entra sem convite"
        >
          <option value="prosul">Entra na PROSUL como MEMBER</option>
          <option value="convite">Exige convite</option>
          <option value="outra">Entra em outro escritório</option>
        </Select>
        {estado === "outra" ? (
          <input
            value={organizationId}
            onChange={(evento) => setOrganizationId(evento.target.value)}
            placeholder="id do escritório"
            className="nx-edge-7 h-9 w-[220px] bg-transparent px-3 text-sm outline-none [--nx-fill:var(--nexodoc-recessed)]"
          />
        ) : null}
        <Button
          size="sm"
          loading={salvando === "freio"}
          disabled={Boolean(salvando)}
          onClick={() => void onMandar({ acao: "freio", estado, organizationId }, "freio")}
        >
          <Save />
          Salvar
        </Button>
      </div>

      {estado === "prosul" ? (
        <p className="border-l-2 border-[var(--status-warning)] pl-3 text-xs leading-5 text-[var(--status-warning)]">
          O login é Google: qualquer pessoa com conta Google que abrir o site vira membro e passa a
          enxergar os projetos do escritório. Quem já foi desligado à mão não volta — essa trava é
          separada.
        </p>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          {estado === "convite"
            ? "Conta nova sem convite leva 403 até alguém liberá-la em Pessoas."
            : "Quem chega sem convite entra no escritório informado, como MEMBER."}
        </p>
      )}
    </article>
  );
}
