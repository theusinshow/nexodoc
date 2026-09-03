"use client";

/**
 * A COTAÇÃO DO DÓLAR — que é do Dinheiro, e não da Configuração.
 *
 * Ela morava no depósito de nove seções da Config, entre o teste de
 * conectividade e a lista de chaves. Não é configuração de motor: é o câmbio
 * que traduz a fatura do provedor no número que decide se vale rodar mais uma
 * auditoria hoje. Ela pertence ao lado do consumo que ela converte.
 *
 * DECLARADA, NÃO BUSCADA, e isso é decisão antiga do produto: cotação que se
 * busca envelhece em silêncio, e o número que precifica o trabalho é o do
 * contador, não o do mercado à vista.
 */

import { CheckCircle2, Coins, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminError, TituloDaSecao } from "@/components/admin/admin-page-shell";
import { useAdminToken } from "@/components/admin/admin-token";
import { Button } from "@/components/ui/button";
import {
  normalizarCotacao,
  procedenciaDaCotacao,
  validarCotacao,
  type CotacaoDeclarada,
} from "@/lib/cambio";

type Cambio = {
  cotacao: CotacaoDeclarada;
  origem: string;
  databaseConfigured: boolean;
};

export function CorpoDaCotacao() {
  const { token, restaurado, recarga, registrarResposta } = useAdminToken();
  const [cambio, setCambio] = useState<Cambio | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  const erros = validarCotacao(normalizarCotacao({ valor: rascunho }));

  const carregar = useCallback(
    async (tokenAtual: string) => {
      try {
        const resposta = await fetch("/api/admin/config", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${tokenAtual.trim()}` },
        });
        const corpo = (await resposta.json().catch(() => null)) as
          | { cambio?: Cambio; error?: string }
          | null;

        if (!resposta.ok || !corpo?.cambio) {
          throw new Error(corpo?.error ?? "Não foi possível carregar a cotação.");
        }

        registrarResposta(true);
        setCambio(corpo.cambio);
        setErro("");
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar a cotação.");
        registrarResposta(false);
      }
    },
    [registrarResposta],
  );

  useEffect(() => {
    if (!restaurado || !token.trim()) return;
    queueMicrotask(() => void carregar(token));
  }, [restaurado, token, recarga, carregar]);

  async function declarar() {
    setSalvando(true);
    setSalvo(false);
    setErro("");

    try {
      const resposta = await fetch("/api/admin/config", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "cambio", cambio: rascunho }),
      });
      const corpo = (await resposta.json().catch(() => null)) as
        | { config?: { cambio?: Cambio }; error?: string }
        | null;

      if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível salvar a cotação.");

      if (corpo?.config?.cambio) setCambio(corpo.config.cambio);
      setSalvo(true);
      setRascunho("");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar a cotação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <TituloDaSecao
        icon={Coins}
        titulo="Cotação do dólar"
        descricao="A fatura do provedor é em dólar; a decisão de rodar é em real. A cotação é declarada, não buscada — e todo valor convertido sai com “≈” e com a data desta declaração."
      />

      <AdminError message={erro} />

      <div className="nx-edge-8 flex flex-col gap-3 p-4">
        <span className="nx-cut-5 inline-flex w-fit items-center gap-1.5 border border-[var(--signal-info-border)] bg-[var(--signal-info-bg)] px-2.5 py-1 font-mono text-[11px] text-[var(--signal-info)]">
          {cambio
            ? procedenciaDaCotacao(cambio.cotacao, new Date())
            : "cotação não declarada — os valores ficam em dólar"}
        </span>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              Reais por US$ 1
            </span>
            <input
              value={rascunho}
              placeholder="ex.: 5,42"
              inputMode="decimal"
              disabled={!cambio || salvando}
              onChange={(evento) => {
                setSalvo(false);
                setRascunho(evento.target.value);
              }}
              className="nx-edge-7 h-9 w-40 bg-transparent px-3 font-mono text-xs outline-none disabled:opacity-60 [--nx-fill:var(--nexodoc-recessed)]"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!cambio || !cambio.databaseConfigured || salvando || erros.length > 0}
            onClick={() => void declarar()}
          >
            {salvando ? <Loader2 className="animate-spin" /> : <Save />}
            Declarar cotação
          </Button>
          {!cambio ? (
            <span className="text-xs text-muted-foreground">
              Informe o token admin para declarar.
            </span>
          ) : !cambio.databaseConfigured ? (
            <span className="font-mono text-[11px] text-[var(--status-warning)]">
              sem DATABASE_URL — só leitura do que veio do ambiente
            </span>
          ) : salvo ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--status-ok)]">
              <CheckCircle2 className="size-3.5" /> declarada agora
            </span>
          ) : null}
        </div>

        {erros.length > 0 ? (
          <ul className="space-y-1">
            {erros.map((mensagem) => (
              <li key={mensagem} className="font-mono text-[11px] text-[var(--status-warning)]">
                {mensagem}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Campo vazio apaga a cotação — e o consumo volta a aparecer só em dólar, que é melhor que
          um real com procedência inventada.
        </p>
      </div>
    </section>
  );
}
