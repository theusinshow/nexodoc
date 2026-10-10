"use client";

/**
 * A FILA DE ACHADOS — modelo A, "Três faixas" (aprovado em 05/10/2026 no
 * laboratório, `/lab/telas/achados-modelos`).
 *
 * Lista: busca + Exibição (popover) numa linha; 3 situações + "Mais" na de
 * baixo; corrigir e atribuir no hover da linha.
 * Detalhe: TOPO fixo (quem é, estado, com quem está e o voto na IA à vista),
 * MEIO que rola (texto ao lado da prévia; depois evidência/conversa/histórico) e
 * RODAPÉ fixo com as ações de encerrar.
 *
 * A lógica é a da fila anterior (`../fila.tsx`), separada em `use-fila.ts`; as
 * peças moram em `pecas.tsx`; o que flutua (menus, popovers) em
 * `flutuante.tsx`, que não é cortado pela borda dos painéis.
 */
import { ChevronDown, ChevronUp } from "lucide-react";

import { Botao, Selo, Tecla } from "@/components/ds/basicos";
import { DicaDeUmaVez } from "@/components/telas/comum/dica-de-uma-vez";
import { SeloDaDisciplina } from "@/components/telas/comum/disciplina";
import { useEncerradosComMouse } from "@/modules/nexo/lib/dicas-da-auditoria";
import type { FonteDoCatalogo } from "@/lib/fonte-da-evidencia";
import { NIVEIS, type Nivel } from "@/lib/nivel-do-achado";
import type { TextoCorrigido } from "@/lib/texto-corrigido";

import type { ParecerVivo } from "../use-parecer-vivo";
import {
  AbasDoAchado,
  AcoesDoAchado,
  Atribuidor,
  AvaliarIA,
  BarraDeSelecao,
  Busca,
  CopiarLink,
  ExibicaoFlutuante,
  FaixasDoAchado,
  Faltou,
  LinhasAgrupadas,
  Notificar,
  Partes,
  Previa,
  SituacoesEnxutas,
  SugestoesDaIA,
} from "./pecas";
import { useFila, type Fila } from "./use-fila";
import "./fila-a.css";

/** O layout, dado o cérebro da fila. */
export function FilaA({ f }: { f: Fila }) {
  const encerradosComMouse = useEncerradosComMouse();
  const a = f.atual;
  const nivel = a ? NIVEIS.find((n) => n.id === a.nivel) : null;

  if (!a) {
    return (
      <div className="am-a am-a--vazia">
        <p className="rs-vazio">
          <b>Nenhum achado nesta auditoria.</b>
          <span>O escopo analisado não mostrou problema. Se faltou apontar algo, conte abaixo.</span>
        </p>
        <Faltou f={f} />
      </div>
    );
  }

  return (
    <div className="am-a">
      <section className="am-a-lista" aria-label="Fila de achados">
        <div className="am-a-lista-topo">
          <div className="am-a-busca" data-tour="fila-busca">
            <Busca f={f} />
            <ExibicaoFlutuante f={f} />
          </div>
          <SituacoesEnxutas f={f} />
          <Notificar f={f} />
        </div>
        <div className="am-rolagem am-a-linhas" data-tour="fila-linhas">
          <LinhasAgrupadas f={f} rapidas />
          <SugestoesDaIA f={f} />
          <Faltou f={f} />
        </div>
        <BarraDeSelecao f={f} />
      </section>

      <section className="am-a-detalhe" aria-label={`Achado ${a.id}`}>
        <header className="am-a-topo">
          <div className="am-a-identidade" data-tour="achado-identidade">
            <span className="rs-detalhe-id">{a.id}</span>
            <Selo tom={a.nivel} ponto>
              {nivel?.nome}
            </Selo>
            <SeloDaDisciplina disc={a.disc} nome />
            <span className="am-a-origem">
              {!a.confirmado ? "Sugestão da IA: não conta" : a.origem === "regra" ? "Regra verificada" : a.origem === "chat" ? "Achado da conversa" : "Lido pela IA, mantido pelo 2º modelo"}
            </span>
            <span className="am-a-navegar">
              <span className="ds-num">{f.posicao < 0 ? "fora do filtro" : `${f.posicao + 1} de ${f.visiveis.length}`}</span>
              <Botao variante="quiet" tamanho="sm" icone aria-label="Achado anterior (K)" title="Anterior (K)" onClick={() => f.ir(-1)}>
                <ChevronUp />
              </Botao>
              <Botao variante="quiet" tamanho="sm" icone aria-label="Próximo achado (J)" title="Próximo (J)" onClick={() => f.ir(1)}>
                <ChevronDown />
              </Botao>
              <CopiarLink f={f} a={a} />
            </span>
          </div>
          <h2>{a.titulo}</h2>
          <FaixasDoAchado f={f} a={a} compacta />
          <div className="am-a-meta">
            <Atribuidor f={f} a={a} />
            <AvaliarIA f={f} a={a} />
          </div>
        </header>

        <div className="am-a-meio" key={a.chave}>
          <div className="am-a-lado-a-lado" data-tour="achado-conteudo">
            <Partes f={f} a={a} juntar />
            <Previa f={f} a={a} />
          </div>
          <AbasDoAchado f={f} a={a} />
        </div>

        <DicaDeUmaVez id="primeira-revisao" titulo="Como encerrar um achado">
          <ul>
            <li><b>Marcar corrigido</b>: você vai corrigir (ou já corrigiu) o memorial. O PDF não muda sozinho.</li>
            <li><b>Decisão técnica</b>: o projeto segue assim de propósito. O motivo vai no parecer.</li>
            <li><b>Falso positivo</b>: a IA errou. Entra na medida de acerto do Nexo.</li>
          </ul>
          <p>Tudo se desfaz: Z logo depois, ou Reabrir.</p>
        </DicaDeUmaVez>
        <DicaDeUmaVez id="atalhos" titulo="Dá para ir mais rápido" quando={encerradosComMouse >= 3}>
          <p>J e K andam, C, D e F encerram, M abre o PDF. A tecla ? mostra todos.</p>
        </DicaDeUmaVez>
        {f.verAtalhos && <AtalhosDaFila onFechar={() => f.setVerAtalhos(false)} />}
        <footer className="am-a-rodape">
          <AcoesDoAchado f={f} a={a} />
          <span className="am-a-atalhos" aria-hidden data-tour="atalhos-da-fila">
            <Tecla>J</Tecla>
            <Tecla>K</Tecla> andam · <Tecla>M</Tecla> PDF · <Tecla>?</Tecla> atalhos
          </span>
        </footer>
      </section>
    </div>
  );
}

/** A fila com as mesmas props da anterior — é ela que entra no lugar de `FilaDeAchados`. */
export function FilaDeAchadosA({
  parecer,
  auditId,
  catalogo,
  inicial,
  nivelInicial,
  filtroInicial,
  onVerNoMemorial,
  aoGerarTexto,
  teclado = true,
}: {
  parecer: ParecerVivo;
  auditId?: string | null;
  catalogo: FonteDoCatalogo[];
  inicial?: string | null;
  nivelInicial?: Nivel | null;
  filtroInicial?: "meus" | null;
  onVerNoMemorial: (chave: string, pagina?: number) => void;
  aoGerarTexto?: (findingId: string, texto: TextoCorrigido) => void;
  /** Desligado enquanto o visor está aberto: as teclas são dele. */
  teclado?: boolean;
}) {
  const f = useFila({ parecer, auditId: auditId ?? null, catalogo, onVerNoMemorial, inicial: inicial ?? null, nivelInicial: nivelInicial ?? null, filtroInicial: filtroInicial ?? null, aoGerarTexto, teclado });
  return <FilaA f={f} />;
}

/** OS ATALHOS DA FILA (tecla ?): estavam espalhados em dicas e rodapés, e nenhum lugar os listava juntos. */
const ATALHOS: [string, string][] = [
  ["J / K", "próximo / anterior"],
  ["C", "marcar corrigido"],
  ["D", "decisão técnica (pede o motivo)"],
  ["F", "falso positivo"],
  ["Z", "desfazer o último, logo depois"],
  ["M", "abrir o PDF na página do trecho"],
  ["/", "buscar"],
  ["1 2 3 4", "Resumo, Achados, Relatório, No documento"],
  ["Esc", "fechar"],
];

function AtalhosDaFila({ onFechar }: { onFechar: () => void }) {
  return (
    <aside className="am-atalhos" aria-label="Atalhos da fila">
      <header>
        <b>Atalhos</b>
        <Botao variante="quiet" tamanho="sm" onClick={onFechar}>
          Fechar <Tecla>Esc</Tecla>
        </Botao>
      </header>
      <dl>
        {ATALHOS.map(([tecla, faz]) => (
          <div key={tecla}>
            <dt>
              <Tecla>{tecla}</Tecla>
            </dt>
            <dd>{faz}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
