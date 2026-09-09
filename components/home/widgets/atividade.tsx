"use client";

/**
 * ATIVIDADE DO ESCRITÓRIO — a tabela que ninguém lia.
 *
 * `ProjectEvent` é escrita desde o começo do produto por auditoria, volume,
 * capa, LD e upload, tem índice por data, e não tinha UM consumidor. Este
 * widget não inventa dado: ele abre uma janela para o que já estava lá.
 *
 * A PERGUNTA QUE ELE RESPONDE é a terceira do dia ("o que aconteceu enquanto eu
 * não estava"), e é a única que a Home não respondia de forma alguma — a
 * retomada diz onde VOCÊ parou, a lista diz o que espera VOCÊ. Num escritório
 * de seis pessoas mexendo nas mesmas obras, não saber que o Victor montou o
 * volume do 088 ontem é retrabalho amanhã.
 *
 * VOCÊ APARECE NA LISTA, e é decisão. Ver a própria linha no meio das outras
 * ancora o fio ("é daqui que eu saí"); uma lista em que você nunca entra parece
 * o mural de outra equipe. Quem é você vem marcado, para a leitura ser rápida.
 *
 * RÉGUA DE 1px, sem cartão por linha — o padrão de tabela da DESIGN.md, que é
 * o que deixa oito linhas caberem sem a seção virar uma pilha de caixas.
 */

import * as React from "react";
import Link from "next/link";

import { Casco, Nada, quando } from "./casco";

type Evento = {
  id: string;
  quem: string;
  souEu: boolean;
  verbo: string;
  projectId: string | null;
  onde: string;
  quando: string;
};

export function WidgetAtividade() {
  const [eventos, setEventos] = React.useState<Evento[] | null>(null);
  const [falhou, setFalhou] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;

    fetch("/api/home/atividade")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { eventos: Evento[] }) => vivo && setEventos(d.eventos ?? []))
      .catch(() => vivo && setFalhou(true));

    return () => {
      vivo = false;
    };
  }, []);

  return (
    <Casco titulo="Atividade do escritório">
      {/*
        SEM ESQUELETO AQUI, e é diferente da lista de projetos de propósito: o
        esqueleto existe para segurar a altura de um bloco que a pessoa está
        esperando. Um widget opcional que pula 120px durante o carregamento
        empurra o rodapé da página; um que nasce curto e cresce, não.
      */}
      {!eventos && !falhou ? <Nada>Carregando…</Nada> : null}

      {falhou ? <Nada>Não deu para carregar a atividade agora.</Nada> : null}

      {eventos?.length === 0 ? (
        <Nada>Ninguém mexeu em nada por aqui ainda.</Nada>
      ) : null}

      {eventos && eventos.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {eventos.map((ev) => (
            <li key={ev.id} className="border-t border-border first:border-t-0">
              <Linha evento={ev} />
            </li>
          ))}
        </ul>
      ) : null}
    </Casco>
  );
}

function Linha({ evento }: { evento: Evento }) {
  const miolo = (
    <>
      <span
        className="shrink-0 truncate text-[12.5px]"
        style={{
          maxWidth: "9ch",
          // Você em texto normal, os outros em cinza: a inversão do que se
          // esperaria, e é o certo — a lista é dos OUTROS, e a sua linha é a
          // âncora. Marcar o mais frequente destacaria a lista inteira.
          color: evento.souEu ? "var(--foreground)" : "var(--muted-foreground)",
        }}
      >
        {evento.souEu ? "Você" : primeiroNome(evento.quem)}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
        {evento.verbo}{" "}
        <span className="font-mono text-[11.5px] tracking-[0.03em] text-foreground">
          {evento.onde}
        </span>
      </span>

      <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
        {quando(evento.quando)}
      </span>
    </>
  );

  const classe =
    "flex items-baseline gap-2.5 py-[7px] transition-colors duration-[var(--duration-fast)]";

  /*
   * SEM PROJETO NÃO VIRA LINK. O evento sobrevive ao projeto apagado
   * (`onDelete: SetNull` no ator, e o projeto some com cascade), e um link para
   * `/projetos/null` é um 404 disfarçado de linha de histórico.
   */
  if (!evento.projectId) return <div className={classe}>{miolo}</div>;

  return (
    <Link href={`/projetos/${evento.projectId}`} className={`${classe} hover:text-foreground`}>
      {miolo}
    </Link>
  );
}

/** "Victor Almeida" → "Victor"; e-mail → o que vem antes do `@`. */
function primeiroNome(valor: string) {
  const local = valor.includes("@") ? valor.split("@")[0] : valor;
  return local.trim().split(/\s+/)[0] || local;
}
