"use client";

/**
 * GERADOS RECENTEMENTE — o caminho de volta para o arquivo de ontem.
 *
 * "Onde foi parar o volume que eu montei ontem?" custa três passos hoje:
 * lembrar a obra, abrir o projeto, rolar até os artefatos. É a pergunta mais
 * banal do produto e a que tem o pior caminho.
 *
 * SEUS, e não do escritório — o contrário de [[atividade.tsx]], que fica logo
 * ao lado. A diferença é a pergunta: "o que aconteceu aqui" é do escritório,
 * "onde está o meu arquivo" é seu, e uma lista misturada responderia pior as
 * duas com o mesmo espaço.
 *
 * O LINK VAI PARA O PROJETO, e não para o arquivo. Baixar de dentro do widget
 * exigiria a rota de download e um estado de erro de download numa caixa de
 * 200px de altura; a página do projeto já resolve os dois, e é lá que estão os
 * outros artefatos da mesma obra — que é o que a pessoa costuma querer em
 * seguida.
 */

import * as React from "react";
import Link from "next/link";

import { Casco, Nada, quando } from "./casco";

type Gerado = {
  id: string;
  rotulo: string;
  projectId: string;
  codigo: string;
  quando: string;
};

export function WidgetGerados() {
  const [gerados, setGerados] = React.useState<Gerado[] | null>(null);
  const [falhou, setFalhou] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;

    fetch("/api/home/gerados")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { gerados: Gerado[] }) => vivo && setGerados(d.gerados ?? []))
      .catch(() => vivo && setFalhou(true));

    return () => {
      vivo = false;
    };
  }, []);

  return (
    <Casco titulo="Gerados recentemente">
      {!gerados && !falhou ? <Nada>Carregando…</Nada> : null}
      {falhou ? <Nada>Não deu para carregar agora.</Nada> : null}
      {gerados?.length === 0 ? (
        <Nada>Capas, LDs e volumes que você gerar aparecem aqui.</Nada>
      ) : null}

      {gerados && gerados.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {gerados.map((g) => (
            <li key={g.id} className="border-t border-border first:border-t-0">
              <Link
                href={`/projetos/${g.projectId}`}
                className="flex items-baseline gap-2.5 py-[7px] transition-colors duration-[var(--duration-fast)] hover:text-foreground"
              >
                <span className="shrink-0 text-[13px] text-foreground">{g.rotulo}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] tracking-[0.03em] text-muted-foreground">
                  {g.codigo}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {quando(g.quando)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Casco>
  );
}
