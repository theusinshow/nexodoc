"use client";

/**
 * AS PEÇAS DA PÁGINA DE ACHADOS — cada função da fila como um bloco, para os
 * modelos de layout arranjarem. Comportamento idêntico ao da fila de produção
 * (`components/telas/resultado/fila.tsx`); só a disposição muda entre modelos.
 */
import { encerrouComMouse } from "@/modules/nexo/lib/dicas-da-auditoria";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Check, ChevronDown, CircleCheck, Copy, FileSearch, Files, Gauge, Link2, Mail, Search, SlidersHorizontal, Split, ThumbsUp, Undo2, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { Botao, Menu, Segmento, Selo, Seletor, Tecla } from "@/components/ds/basicos";
import { AvatarDaPessoa } from "@/components/ds/avatar-da-pessoa";
import { BotaoDoGrupo, Dica, GrupoDeBotoes } from "@/components/ds/micro";
import { CartaoDoMotor } from "@/components/achado/cartao-do-motor";
import { ConversaDoAchado } from "@/components/achado/conversa-do-achado";
import { OQueFazer } from "@/components/achado/o-que-fazer";
import { getHighlightNeedle } from "@/components/audit-result";
import { SelosDasDisciplinas } from "@/components/telas/comum/disciplina";
import { Trecho } from "@/components/telas/resultado/fila";
import { PreviaDoTrecho } from "@/components/telas/resultado/previa-do-trecho";
import { NOME_DO_DESFECHO, conta } from "@/components/telas/resultado/textos";
import type { AchadoDaTela } from "@/components/telas/resultado/use-parecer-vivo";
import { findingCard } from "@/lib/audit-engine/finding-card";
import { resolverFonte } from "@/lib/fonte-da-evidencia";
import { NIVEIS } from "@/lib/nivel-do-achado";
import { achadoParaArrastar } from "@/lib/pergunta-sobre-achado";
import { comecarArrasto } from "@/components/achado/arrasto-do-achado";
import { paginasEmConflito, trechosDaEvidencia } from "@/lib/trechos-da-evidencia";

import { Flutuante, MenuSolto } from "./flutuante";
import { NOMES_DO_FILTRO, iniciais, quando, type Filtro, type Fila } from "./use-fila";

/* =============================== a lista =============================== */

export function Busca({ f }: { f: Fila }) {
  const { registrarBusca, busca, setBusca } = f;
  return (
    <label className="rs-busca">
      <Search size={14} />
      <input ref={registrarBusca} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por texto, referência ou página" />
      {busca ? (
        <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}>
          <X size={13} />
        </button>
      ) : (
        <Tecla>/</Tecla>
      )}
    </label>
  );
}

/** As seis situações, todas à vista (o jeito de hoje). */
export function SituacoesTodas({ f }: { f: Fila }) {
  return (
    <Segmento
      rotulo="Mostrar"
      valor={f.filtro}
      onTroca={f.setFiltro}
      opcoes={(Object.keys(NOMES_DO_FILTRO) as Filtro[]).map((v) => ({ valor: v, rotulo: <>{NOMES_DO_FILTRO[v]} <em>{f.contagem[v]}</em></> }))}
    />
  );
}

/** Três situações à vista e o resto num "Mais" — o enxugamento proposto. */
export function SituacoesEnxutas({ f }: { f: Fila }) {
  const principais: Filtro[] = ["pendentes", "meus", "corrigidos"];
  const outras: Filtro[] = ["todos", "sem", "encerrados"];
  const ehOutra = outras.includes(f.filtro);
  return (
    <div className="am-situacoes" data-tour="fila-situacoes">
      <Segmento
        rotulo="Mostrar"
        valor={ehOutra ? ("__outra" as Filtro) : f.filtro}
        onTroca={f.setFiltro}
        opcoes={principais.map((v) => ({ valor: v, rotulo: <>{NOMES_DO_FILTRO[v]} <em>{f.contagem[v]}</em></> }))}
      />
      <MenuSolto
        rotulo={ehOutra ? `${NOMES_DO_FILTRO[f.filtro]} · ${f.contagem[f.filtro]}` : "Mais"}
        variante={ehOutra ? "ghost" : "quiet"}
        itens={outras.map((v) => ({ rotulo: `${NOMES_DO_FILTRO[v]} (${f.contagem[v]})`, onClick: () => f.setFiltro(v) }))}
      />
    </div>
  );
}

/** A situação numa lista suspensa — para colunas estreitas. */
export function SituacaoNoSeletor({ f }: { f: Fila }) {
  return (
    <Seletor
      valor={f.filtro}
      onTroca={f.setFiltro}
      opcoes={(["pendentes", "meus", "sem", "corrigidos", "encerrados", "todos"] as Filtro[]).map((v) => ({ valor: v, rotulo: `${NOMES_DO_FILTRO[v]} · ${f.contagem[v]}` }))}
    />
  );
}

/** O conteúdo de "Exibição": responsável, ordem, agrupar, gravidade, disciplina, tipo. */
export function ConteudoDeExibicao({ f, onFechar }: { f: Fila; onFechar?: () => void }) {
  return (
    <div className="fl-painel-dentro">
      <div className="fl-selects">
        <span>
          Responsável
          <Seletor valor={f.responsavel} onTroca={f.setResponsavel} opcoes={[{ valor: "qualquer", rotulo: "Qualquer" }, ...f.pessoas.map((p) => ({ valor: p.email, rotulo: p.souEu ? "Você" : p.nome }))]} />
        </span>
        <span>
          Ordem
          <Seletor
            valor={f.ordem}
            onTroca={f.setOrdem}
            opcoes={[
              { valor: "impacto", rotulo: "Por impacto" },
              { valor: "pagina", rotulo: "Por página" },
              { valor: "disciplina", rotulo: "Por disciplina" },
              { valor: "referencia", rotulo: "Por referência" },
            ]}
          />
        </span>
        <span>
          Agrupar
          <Seletor
            valor={f.agrupar}
            onTroca={f.setAgrupar}
            opcoes={[
              { valor: "impacto", rotulo: "Por impacto" },
              { valor: "disciplina", rotulo: "Por disciplina" },
            ]}
          />
        </span>
      </div>
      <div className="fl-linha">
        <span className="fl-rotulo">Gravidade</span>
        <div className="fl-chips">
          {NIVEIS.map((n) => (
            <button key={n.id} type="button" aria-pressed={f.niveis.includes(n.id)} className="fl-chip" onClick={() => f.alternarEm(f.niveis, f.setNiveis, n.id)}>
              <i className={`rs-ponto rs-ponto--${n.id}`} />
              {n.nome}
              <em>{f.confirmados.filter((a) => a.nivel === n.id).length}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="fl-linha">
        <span className="fl-rotulo">Disciplina</span>
        <div className="fl-chips">
          {f.discsPresentes.map((d) => (
            <button key={d.id} type="button" aria-pressed={f.discs.includes(d.id)} className={`fl-chip fl-chip--disc dc--${d.id}`} onClick={() => f.alternarEm(f.discs, f.setDiscs, d.id)}>
              <i className="dc-ponto" />
              {d.nome}
              <em>{d.n}</em>
            </button>
          ))}
        </div>
      </div>
      {f.tiposPresentes.length > 0 && (
        <div className="fl-linha">
          <span className="fl-rotulo">Tipo</span>
          <div className="fl-chips">
            {f.tiposPresentes.map((t) => (
              <button key={t.id} type="button" aria-pressed={f.tipos.includes(t.id)} className="fl-chip" onClick={() => f.alternarEm(f.tipos, f.setTipos, t.id)}>
                {t.nome}
                <em>{t.n}</em>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="fl-pe">
        <span className="ds-num">
          {f.visiveis.length} de {f.confirmados.length} achados
        </span>
        {f.nFiltros > 0 && (
          <button type="button" className="rs-link" onClick={f.limparFiltros}>
            Limpar filtros
          </button>
        )}
        {onFechar && (
          <Botao variante="quiet" tamanho="sm" onClick={onFechar}>
            Fechar
          </Botao>
        )}
      </div>
    </div>
  );
}

/** Filtros finos + ordem + agrupamento, num painel que se abre na lista. */
export function PainelDeExibicao({ f, aberto, onFechar }: { f: Fila; aberto: boolean; onFechar?: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {aberto && (
        <motion.div className="fl-painel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
          <ConteudoDeExibicao f={f} onFechar={onFechar} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** "Exibição" como popover que flutua por cima — não empurra a lista nem é cortado. */
export function ExibicaoFlutuante({ f }: { f: Fila }) {
  return (
    <Flutuante
      alinhar="direita"
      largura={420}
      className="am-exibicao"
      gatilho={(aberto, alternar) => (
        <Dica texto="Filtros, ordem e agrupamento">
          <button type="button" className={`fl-botao am-exibicao-botao${aberto || f.nFiltros ? " fl-botao--ligado" : ""}`} aria-expanded={aberto} aria-label="Exibição: filtros, ordem e agrupamento" onClick={alternar}>
            <SlidersHorizontal size={14} />
            {f.nFiltros > 0 && <b className="ds-num">{f.nFiltros}</b>}
          </button>
        </Dica>
      )}
    >
      {(fechar) => <ConteudoDeExibicao f={f} onFechar={fechar} />}
    </Flutuante>
  );
}

export function BotaoDeExibicao({ f, aberto, onTroca, rotulo = "Exibição" }: { f: Fila; aberto: boolean; onTroca: () => void; rotulo?: string }) {
  return (
    <button type="button" className={`fl-botao${aberto || f.nFiltros ? " fl-botao--ligado" : ""}`} aria-expanded={aberto} onClick={onTroca}>
      <SlidersHorizontal size={14} />
      {rotulo}
      {f.nFiltros > 0 && <b className="ds-num">{f.nFiltros}</b>}
    </button>
  );
}

/** "N pessoas esperam aviso por e-mail" — com a confirmação antes de enviar. */
export function Notificar({ f, compacto }: { f: Fila; compacto?: boolean }) {
  const p = f.parecer;
  if (!p.aAvisar.length) return null;
  return (
    <div className="rs-notificar">
      <button type="button" className="rs-notificar-barra" aria-expanded={f.confirmandoAviso} onClick={() => f.setConfirmandoAviso(!f.confirmandoAviso)}>
        <Mail size={14} />
        {!compacto && <span>{conta(p.aAvisar.length, "pessoa espera", "pessoas esperam")} aviso por e-mail</span>}
        <b>{compacto ? `Notificar ${p.aAvisar.length}` : "Notificar por e-mail"}</b>
      </button>
      {f.confirmandoAviso && (
        <div className="rs-notificar-painel">
          <ul>
            {p.aAvisar.map((x) => (
              <li key={x.email}>
                <span>
                  {x.nome}
                  {x.convidado && <em> convidado, ainda não entrou</em>}
                </span>
                <span className="ds-num">{conta(x.quantidade, "achado", "achados")}</span>
              </li>
            ))}
          </ul>
          <p>O e-mail leva a contagem, o projeto e o link para o achado. O conteúdo dos achados não sai do sistema.</p>
          <span className="rs-notificar-acoes">
            <Botao variante="quiet" tamanho="sm" onClick={() => f.setConfirmandoAviso(false)}>
              Cancelar
            </Botao>
            <Botao variante="primary" tamanho="sm" disabled={p.avisando} onClick={() => void p.avisarPorEmail().then((ok) => ok && f.setConfirmandoAviso(false))}>
              <Mail size={14} /> {p.avisando ? "Enviando…" : `Notificar ${conta(p.aAvisar.length, "pessoa", "pessoas")}`}
            </Botao>
          </span>
        </div>
      )}
    </div>
  );
}

/** A caixinha de marcar (seleção em lote). */
export function Marcar({ f, a, desligado }: { f: Fila; a: AchadoDaTela; desligado?: boolean }) {
  const marcado = f.marcados.includes(a.chave);
  return (
    <button type="button" data-sem-arrasto role="checkbox" aria-checked={marcado} aria-label={`Selecionar ${a.id} para atribuir`} className="rs-marcar" disabled={Boolean(a.desfecho) || desligado} onClick={() => f.alternar(a.chave)}>
      {marcado && (
        <svg viewBox="0 0 16 16">
          <path d="M4 8.5 L7 11 L12 5" />
        </svg>
      )}
    </button>
  );
}

/** O que diz a ponta direita de uma linha: desfecho, ou disciplina + conversa + dono. */
export function MetaDaLinha({ f, a }: { f: Fila; a: AchadoDaTela }) {
  if (a.desfecho?.tipo === "FIXED_IN_DOC") return <Selo tom="ok">Corrigido</Selo>;
  if (a.desfecho)
    return (
      <span className="rs-linha-desfecho">
        <Check size={12} /> {NOME_DO_DESFECHO[a.desfecho.tipo]}
      </span>
    );
  return (
    <>
      {f.agrupar === "disciplina" ? <i className={`rs-ponto rs-ponto--${a.nivel}`} title={NIVEIS.find((n) => n.id === a.nivel)?.nome} /> : <SelosDasDisciplinas discs={a.discs} maximo={1} />}
      {a.comentarios > 0 && <span className="rs-linha-conversa ds-num" title={conta(a.comentarios, "comentário", "comentários")}>{a.comentarios}</span>}
      {a.responsavel ? <AvatarDaPessoa email={a.responsavel.email} iniciais={iniciais(a.responsavel.nome)} pequeno /> : <span className="rs-sem-dono">sem responsável</span>}
    </>
  );
}

/** Ações que aparecem no hover da linha: corrigir e atribuir sem abrir o achado. */
export function AcoesRapidas({ f, a }: { f: Fila; a: AchadoDaTela }) {
  if (a.desfecho || !a.confirmado) return null;
  return (
    <span className="am-rapidas" data-sem-arrasto onClick={(e) => e.stopPropagation()}>
      <button type="button" className="am-rapida" title="Marcar corrigido" aria-label={`Marcar ${a.id} como corrigido`} disabled={!f.auditId || f.parecer.salvando === a.chave} onClick={() => (encerrouComMouse(), void f.encerrar("FIXED_IN_DOC", undefined, a))}>
        <Check size={14} />
      </button>
      <Flutuante
        className="am-pessoas"
        largura={300}
        alinhar="direita"
        gatilho={(aberto, alternar) => (
          <Botao variante="quiet" tamanho="sm" icone aria-haspopup="dialog" aria-expanded={aberto} title={`Atribuir ${a.id}`} aria-label={`Atribuir ${a.id}`} disabled={!f.auditId} onClick={alternar}>
            <UserPlus />
          </Botao>
        )}
      >
        {(fechar) => <ListaDePessoas f={f} atual={a.responsavel?.email ?? null} aoEscolher={(email) => void f.parecer.atribuir([a.chave], email)} fechar={fechar} />}
      </Flutuante>
    </span>
  );
}

/** Uma linha da lista, no visual de hoje (com ações rápidas opcionais). */
export function LinhaDoAchado({ f, a, sugestao, rapidas, onAbrir }: { f: Fila; a: AchadoDaTela; sugestao?: boolean; rapidas?: boolean; onAbrir?: () => void }) {
  const ativo = a.chave === f.atual?.chave;
  return (
    <div
      className={`rs-linha${ativo ? " rs-linha--ativa" : ""}${a.desfecho ? " rs-linha--encerrada" : ""}${a.desfecho?.tipo === "FIXED_IN_DOC" ? " rs-linha--corrigida" : ""}${f.marcados.length ? " rs-linha--selecionando" : ""}${rapidas ? " am-linha-com-rapidas" : ""} rs-linha--sev-${a.nivel}`}
      /* Arrastada até o chat, entra pela fenda e vira uma pergunta sobre este achado. */
      onPointerDown={(e) => comecarArrasto(e, achadoParaArrastar(a))}
      title="Arraste para o chat para perguntar ao Nexo sobre este achado"
    >
      {ativo && <span className="rs-linha-fundo" />}
      <Marcar f={f} a={a} desligado={sugestao} />
      <button type="button" className="rs-linha-corpo" onClick={() => (onAbrir ? onAbrir() : f.abrir(a.chave, f.visiveis.indexOf(a) > f.posicao ? 1 : -1))}>
        <span className="rs-linha-id">
          {a.desfecho?.tipo === "FIXED_IN_DOC" && <CircleCheck className="rs-linha-ok" size={13} strokeWidth={1.75} aria-label="Corrigido" />}
          {a.id}
        </span>
        <span className="rs-linha-titulo">{a.titulo}</span>
        <span className="rs-linha-meta">
          <MetaDaLinha f={f} a={a} />
        </span>
      </button>
      {rapidas && <AcoesRapidas f={f} a={a} />}
    </div>
  );
}

/** Os grupos (por impacto ou disciplina) + "Corrigidos por você" + vazio. */
export function LinhasAgrupadas({ f, rapidas }: { f: Fila; rapidas?: boolean }) {
  return (
    <>
      {f.visiveis.length === 0 && f.meusCorrigidos.length > 0 ? (
        <p className="rs-meus-vazio">Nada pendente com você.</p>
      ) : f.visiveis.length === 0 ? (
        <div className="rs-vazio">
          <b>Nenhum achado com {f.busca ? `“${f.busca}”` : "esse filtro"}.</b>
          <span>A busca olha o título, a referência, a disciplina, a página e o trecho.</span>
          <Botao variante="ghost" tamanho="sm" onClick={() => (f.setBusca(""), f.setFiltro("todos"), f.limparFiltros())}>
            Limpar busca e filtros
          </Botao>
        </div>
      ) : (
        f.grupos.map((g) =>
          g.itens.length ? (
            <div key={g.id} className={`rs-grupo${f.agrupar === "disciplina" ? ` rs-grupo--disc dc--${g.id}` : ""}`}>
              <h4>
                <i className={g.ponto} />
                {g.nome}
                <span className="ds-num">{g.itens.length}</span>
              </h4>
              {g.itens.map((a) => (
                <LinhaDoAchado key={a.chave} f={f} a={a} rapidas={rapidas} />
              ))}
            </div>
          ) : null,
        )
      )}
      {f.meusCorrigidos.length > 0 && (
        <div className="rs-grupo rs-grupo--meus-corrigidos">
          <h4>
            <Check size={12} aria-hidden />
            Corrigidos por você
            <span className="ds-num">{f.meusCorrigidos.length}</span>
          </h4>
          {f.meusCorrigidos.map((a) => (
            <LinhaDoAchado key={a.chave} f={f} a={a} />
          ))}
        </div>
      )}
    </>
  );
}

export function SugestoesDaIA({ f }: { f: Fila }) {
  if (!f.sugestoes.length) return null;
  return (
    <div className="rs-grupo rs-grupo--sugestoes">
      <button type="button" className="rs-sugestoes-barra" aria-expanded={f.verSugestoes} onClick={() => f.setVerSugestoes(!f.verSugestoes)}>
        {conta(f.sugestoes.length, "sugestão da IA", "sugestões da IA")}
        <span>não contam no veredito</span>
        <ChevronDown size={13} style={{ transform: f.verSugestoes ? "rotate(180deg)" : undefined }} />
      </button>
      {f.verSugestoes && f.sugestoes.map((a) => <LinhaDoAchado key={a.chave} f={f} a={a} sugestao />)}
    </div>
  );
}

export function Faltou({ f }: { f: Fila }) {
  return (
    <div className="rs-faltou" data-tour="faltou">
      {f.faltou === null ? (
        <button type="button" className="rs-link" onClick={() => f.setFaltou("")}>
          Faltou apontar algum problema?
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (f.faltou?.trim() && (await f.parecer.faltou(f.faltou.trim()))) f.setFaltou(null);
          }}
        >
          <textarea autoFocus rows={2} value={f.faltou} onChange={(e) => f.setFaltou(e.target.value)} placeholder="O que a auditoria deixou passar, e em que página" />
          <span>
            <Botao variante="quiet" tamanho="sm" onClick={() => f.setFaltou(null)}>
              Cancelar
            </Botao>
            <Botao variante="ghost" tamanho="sm" type="submit" disabled={!f.faltou?.trim()}>
              Registrar
            </Botao>
          </span>
        </form>
      )}
    </div>
  );
}

/** A barra que aparece com achados marcados: atribuir em lote. */
export function BarraDeSelecao({ f, flutuante = true }: { f: Fila; flutuante?: boolean }) {
  return (
    <AnimatePresence>
      {f.marcados.length > 0 && (
        <motion.div className={`rs-selecao${flutuante ? "" : " am-selecao-fixa"}`} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
          <b className="ds-num">{f.marcados.length}</b> selecionados
          <span className="rs-selecao-acoes">
            <Flutuante
              className="am-pessoas"
              largura={300}
              lado={flutuante ? "cima" : "baixo"}
              gatilho={(aberto, alternar) => (
                <Botao variante="ghost" tamanho="sm" aria-haspopup="dialog" aria-expanded={aberto} onClick={alternar}>
                  <UserPlus /> Atribuir
                </Botao>
              )}
            >
              {(fechar) => (
                <ListaDePessoas
                  f={f}
                  atual={null}
                  aoEscolher={(email) => void f.parecer.atribuir(f.marcados, email).then((ok) => ok && f.setMarcados([]))}
                  fechar={fechar}
                />
              )}
            </Flutuante>
            <Botao variante="quiet" tamanho="sm" icone aria-label="Limpar seleção (Esc)" title="Limpar seleção (Esc)" onClick={() => f.setMarcados([])}>
              <X />
            </Botao>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================== o detalhe ============================== */

/** Código, nível, disciplina, origem, navegação e o menu "Mais". */
export function CabecaDoAchado({ f, a, navegar = true }: { f: Fila; a: AchadoDaTela; navegar?: boolean }) {
  const nivel = NIVEIS.find((n) => n.id === a.nivel);
  return (
    <div className="rs-detalhe-topo am-cabeca">
      <span className="rs-detalhe-id">{a.id}</span>
      <Selo tom={a.nivel} ponto>
        {nivel?.nome}
      </Selo>
      <SelosDasDisciplinas discs={a.discs} nome />
      <span className="rs-origem">
        {!a.confirmado ? "Sugestão da IA: não conta" : a.origem === "regra" ? "Regra verificada" : a.origem === "chat" ? "Achado da conversa" : "Lido pela IA, mantido pelo 2º modelo"}
      </span>
      <span className="rs-navegar">
        {navegar && (
          <>
            <span className="ds-num">{f.posicao < 0 ? "fora do filtro" : `${f.posicao + 1} de ${f.visiveis.length}`}</span>
            <Botao variante="quiet" tamanho="sm" icone aria-label="Achado anterior (K)" onClick={() => f.ir(-1)}>
              <ChevronDown style={{ transform: "rotate(180deg)" }} />
            </Botao>
            <Botao variante="quiet" tamanho="sm" icone aria-label="Próximo achado (J)" onClick={() => f.ir(1)}>
              <ChevronDown />
            </Botao>
          </>
        )}
        <MenuSolto
          rotulo="Mais"
          variante="quiet"
          alinhar="direita"
          itens={[
            { rotulo: "O achado procede", dica: "Conta a favor do motor; não encerra", icone: <Check size={14} />, onClick: () => void f.parecer.julgar(a, "CONFIRMED") },
            { rotulo: "Gravidade errada", dica: "Avisa o motor; o achado continua na fila", icone: <X size={14} />, onClick: () => void f.parecer.julgar(a, "WRONG_SEVERITY") },
            ...(f.auditId ? [{ rotulo: "Copiar link do achado", icone: <Link2 size={14} />, onClick: () => void f.copiarLink(a) }] : []),
          ]}
        />
      </span>
    </div>
  );
}

/** As páginas do achado (conflito ou várias), cada uma um botão. */
export function paginasDoAchado(a: AchadoDaTela) {
  const emConflito = paginasEmConflito(a.bruto.evidencia);
  const entre = emConflito.length >= 2;
  const ordem = [...a.paginas].sort((x, y) => x - y);
  return { entre, varias: !entre && a.paginas.length >= 2, paginas: entre ? emConflito : ordem };
}

/** Estado em uma faixa: corrigido e/ou várias páginas. */
export function FaixasDoAchado({ f, a, compacta }: { f: Fila; a: AchadoDaTela; compacta?: boolean }) {
  const p = paginasDoAchado(a);
  const temArquivo = f.temArquivo(a);
  return (
    <>
      {a.desfecho?.tipo === "FIXED_IN_DOC" && (
        <p className="rs-faixa rs-faixa--ok" role="status">
          <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
          <span>
            <b>Corrigido no documento</b>
            <small>
              {a.desfecho.por ? `por ${a.desfecho.por} · ` : ""}
              <time>{quando(a.desfecho.quando)}</time>
            </small>
          </span>
        </p>
      )}
      {(p.entre || p.varias) && (
        <div className="rs-faixa rs-faixa--paginas" role="note">
          {p.entre ? <Split size={16} strokeWidth={1.75} aria-hidden /> : <Files size={16} strokeWidth={1.75} aria-hidden />}
          <span>
            <b>{p.entre ? "Conflito entre páginas" : `Envolve ${p.paginas.length} páginas`}</b>
            {!compacta && <small>{p.entre ? "o defeito é a divergência entre elas" : "o achado se apoia em mais de uma"}</small>}
          </span>
          <span className="rs-faixa-paginas">
            {p.paginas.map((n) =>
              temArquivo ? (
                <Botao key={n} variante="ghost" tamanho="sm" onClick={() => f.onVerNoMemorial(a.chave, n)} title={`Abrir o PDF na página ${n}`}>
                  <FileSearch /> p. {n}
                </Botao>
              ) : (
                <Selo key={n} tom="line">
                  p. {n}
                </Selo>
              ),
            )}
          </span>
        </div>
      )}
    </>
  );
}

/*
 * A IA ACERTOU? (pedido de 05/10/2026). Era um item escondido no "Mais"; o voto
 * de quem revisa é o que ensina o motor, então fica à vista, com o voto dado
 * aceso. "Falso positivo" mora nas ações: ele também ENCERRA o achado.
 */
export function AvaliarIA({ f, a }: { f: Fila; a: AchadoDaTela }) {
  const ocupado = !f.auditId || f.parecer.salvando === a.chave;
  const procede = a.validade === "CONFIRMED";
  const gravidade = a.validade === "WRONG_SEVERITY";
  const rotuloDaGravidade = !gravidade ? "Gravidade errada" : a.severidade === "MAIS_GRAVE" ? "Mais grave" : a.severidade === "MENOS_GRAVE" ? "Menos grave" : "Gravidade errada";
  return (
    <div className="am-avaliar" role="group" aria-label="Avaliar a leitura da IA" data-tour="avaliar-ia">
      <span className="am-avaliar-rotulo">A IA acertou?</span>
      <Dica texto={procede ? "Clique para desfazer o voto." : "A IA acertou: conta a favor do motor. Não encerra o achado."}>
        <button type="button" className="am-voto" aria-pressed={procede} disabled={ocupado} onClick={() => void f.parecer.julgar(a, procede ? null : "CONFIRMED")}>
          <ThumbsUp />
          Procede
        </button>
      </Dica>
      {/*
        GRAVIDADE ERRADA PEDE O SENTIDO (05/10/2026): "errada" sozinho diz que o
        motor errou, mas não para onde. Mais grave / menos grave é o dado que
        calibra o nível; e o voto se desfaz dali mesmo.
      */}
      <Flutuante
        alinhar="direita"
        className="ds-menu ds-menu--acoes am-menu-solto"
        gatilho={(aberto, alternar) => (
          <button type="button" className="am-voto" aria-pressed={gravidade} aria-haspopup="menu" aria-expanded={aberto} disabled={ocupado} onClick={alternar}>
            {a.severidade === "MAIS_GRAVE" && gravidade ? <ArrowUp /> : a.severidade === "MENOS_GRAVE" && gravidade ? <ArrowDown /> : <Gauge />}
            {rotuloDaGravidade}
            <ChevronDown className="am-voto-seta" />
          </button>
        )}
      >
        {(fechar) => (
          <>
            <p className="am-menu-titulo">O nível deste achado deveria ser…</p>
            {(
              [
                { s: "MAIS_GRAVE" as const, rotulo: "Mais grave", dica: "O motor subestimou: o problema pesa mais do que o nível dado.", icone: <ArrowUp size={14} /> },
                { s: "MENOS_GRAVE" as const, rotulo: "Menos grave", dica: "O motor exagerou: o problema existe, mas pesa menos.", icone: <ArrowDown size={14} /> },
              ]
            ).map((o) => (
              <button
                key={o.s}
                type="button"
                role="menuitemradio"
                aria-checked={gravidade && a.severidade === o.s}
                onClick={() => {
                  void f.parecer.julgar(a, "WRONG_SEVERITY", o.s);
                  fechar();
                }}
              >
                <span style={{ width: 16, display: "inline-flex" }}>{o.icone}</span>
                <span className="ds-menu-texto">
                  {o.rotulo}
                  <small>{o.dica}</small>
                </span>
                {gravidade && a.severidade === o.s && <Check size={14} className="am-menu-marca" />}
              </button>
            ))}
            {a.validade && (
              <button
                type="button"
                role="menuitem"
                className="am-menu-desfazer"
                onClick={() => {
                  void f.parecer.julgar(a, null);
                  fechar();
                }}
              >
                <span style={{ width: 16, display: "inline-flex" }}>
                  <Undo2 size={14} />
                </span>
                <span className="ds-menu-texto">
                  Desfazer o voto
                  <small>O achado volta a não ter avaliação.</small>
                </span>
              </button>
            )}
          </>
        )}
      </Flutuante>
    </div>
  );
}

/*
 * O ATRIBUIDOR DO CARD (05/10/2026): o mesmo ícone da lista (pessoa com +), e
 * a pessoa, quando já há uma — com o avatar. Abre uma lista com busca, você
 * primeiro, e a marca em quem está com o achado.
 */
export function Atribuidor({ f, a }: { f: Fila; a: AchadoDaTela }) {
  const com = a.responsavel;
  if (a.desfecho) {
    return com ? (
      <span className="am-atribuidor am-atribuidor--fixo">
        <AvatarDaPessoa email={com.email} iniciais={iniciais(com.nome)} pequeno /> Estava com {com.souEu ? "você" : com.nome}
      </span>
    ) : null;
  }
  return (
    <Flutuante
      className="am-pessoas"
      largura={300}
      gatilho={(aberto, alternar) => (
        <Dica texto={com ? "Trocar o responsável" : "Atribuir a alguém"}>
          <button type="button" data-tour="atribuir" className={`am-atribuidor${com ? " am-atribuidor--com" : ""}`} aria-haspopup="dialog" aria-expanded={aberto} disabled={!f.auditId} onClick={alternar}>
            {com ? <AvatarDaPessoa email={com.email} iniciais={iniciais(com.nome)} pequeno /> : <span className="am-atribuidor-icone"><UserPlus size={14} /></span>}
            <span>{com ? (com.souEu ? "Com você" : `Com ${com.nome}`) : "Atribuir"}</span>
            <ChevronDown size={13} className="am-voto-seta" />
          </button>
        </Dica>
      )}
    >
      {(fechar) => <ListaDePessoas f={f} atual={com?.email ?? null} aoEscolher={(email) => void f.parecer.atribuir([a.chave], email)} fechar={fechar} />}
    </Flutuante>
  );
}

/**
 * AS PESSOAS DO ESCRITÓRIO, com busca e você primeiro — a MESMA lista na linha,
 * no lote e no detalhe (07/10/2026, R4). Eram dois menus diferentes: com busca
 * no detalhe, sem busca na linha e no lote, e com rótulos diferentes
 * ("Atribuir", "Atribuir a…", o ícone). Atribuir não manda e-mail: quem
 * recebeu aparece em "Notificar por e-mail", no topo da fila.
 */
export function ListaDePessoas({ f, atual, aoEscolher, fechar }: { f: Fila; atual: string | null; aoEscolher: (email: string) => void; fechar: () => void }) {
  const [busca, setBusca] = useState("");
  const eu = f.parecer.euSou;
  const pessoas = [...f.parecer.membros]
    .map((m) => ({ email: m.email, nome: m.name || m.email, convidado: m.status === "INVITED", souEu: Boolean(eu) && m.email.toLowerCase() === eu }))
    .sort((x, y) => Number(y.souEu) - Number(x.souEu) || x.nome.localeCompare(y.nome, "pt-BR"));
  const q = busca.trim().toLowerCase();
  const filtradas = q ? pessoas.filter((p) => `${p.nome} ${p.email}`.toLowerCase().includes(q)) : pessoas;
  return (
    <div className="am-pessoas-dentro">
      <label className="am-pessoas-busca">
        <Search size={13} />
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" aria-label="Buscar pessoa para atribuir" />
      </label>
      <div className="am-pessoas-lista" role="listbox" aria-label="Pessoas do escritório">
        {filtradas.map((p) => {
          const marcada = atual?.toLowerCase() === p.email.toLowerCase();
          return (
            <button
              key={p.email}
              type="button"
              role="option"
              aria-selected={marcada}
              className="am-pessoa"
              onClick={() => {
                if (!marcada) aoEscolher(p.email);
                setBusca("");
                fechar();
              }}
            >
              <AvatarDaPessoa email={p.email} iniciais={iniciais(p.nome)} pequeno />
              <span className="am-pessoa-nome">
                {p.souEu ? `${p.nome} (você)` : p.nome}
                <small>{p.convidado ? "convidado, ainda não entrou" : p.email}</small>
              </span>
              {marcada && <Check size={14} className="am-menu-marca" />}
            </button>
          );
        })}
        {filtradas.length === 0 && <p className="am-menu-vazio">Ninguém com “{busca}”.</p>}
      </div>
    </div>
  );
}

export function CopiarLink({ f, a }: { f: Fila; a: AchadoDaTela }) {
  if (!f.auditId) return null;
  return (
    <Dica texto="Copiar o link deste achado">
      <Botao variante="quiet" tamanho="sm" icone aria-label="Copiar o link deste achado" onClick={() => void f.copiarLink(a)}>
        <Link2 />
      </Botao>
    </Dica>
  );
}

/** Com quem está + trocar/atribuir + "Ver no memorial". */
export function Responsavel({ f, a, verNoMemorial = true }: { f: Fila; a: AchadoDaTela; verNoMemorial?: boolean }) {
  const pagina = a.paginas.length ? (a.paginas.length === 1 ? `p. ${a.paginas[0]}` : `p. ${a.paginas[0]} e mais ${a.paginas.length - 1}`) : "";
  return (
    <div className="rs-dono">
      {a.responsavel ? (
        <>
          <AvatarDaPessoa email={a.responsavel.email} iniciais={iniciais(a.responsavel.nome)} pequeno /> Com {a.responsavel.souEu ? "você" : a.responsavel.nome}
        </>
      ) : (
        <span className="rs-sem-dono">Sem responsável</span>
      )}
      {!a.desfecho && f.opcoesDePessoas.length > 0 && (
        <MenuSolto rotulo={a.responsavel ? "Trocar" : "Atribuir a…"} variante="quiet" itens={f.opcoesDePessoas.map((p) => ({ rotulo: p.rotulo, onClick: () => void f.parecer.atribuir([a.chave], p.valor) }))} />
      )}
      {verNoMemorial && (
        <Botao variante="ghost" tamanho="sm" className="rs-ver-memorial" disabled={!f.temArquivo(a)} onClick={() => f.onVerNoMemorial(a.chave)}>
          <FileSearch /> Ver no memorial{pagina ? `, ${pagina}` : ""} <Tecla>M</Tecla>
        </Botao>
      )}
    </div>
  );
}

export function Previa({ f, a }: { f: Fila; a: AchadoDaTela }) {
  const fonte = f.fonteDe(a);
  if (fonte.tipo !== "arquivo" || !a.paginas.length) return <p className="rs-nota am-sem-previa">Sem o arquivo do memorial, não há prévia da página.</p>;
  return <PreviaDoTrecho achado={a} url={fonte.fonte.url} onAmpliar={(p) => f.onVerNoMemorial(a.chave, p)} />;
}

/** O que está errado / por que importa / o que fazer (com o texto corrigido). */
export function Partes({ f, a, juntar }: { f: Fila; a: AchadoDaTela; juntar?: boolean }) {
  const corretor = { auditId: f.auditId ?? undefined, findingId: a.chave, achado: a.bruto, inicial: a.bruto.texto_corrigido, aoGerar: f.aoGerarTexto };
  if (a.estruturado.motor) {
    return (
      <CartaoDoMotor
        modelo={findingCard(
          {
            descricao: a.estruturado.descricao ?? "",
            conflito: a.estruturado.conflito ?? "",
            evidencia: a.estruturado.evidencia ?? "",
            sugestao_correcao: a.estruturado.acao ?? "",
            pagina: a.estruturado.pagina ?? "",
            motor: a.estruturado.motor,
          },
          { hasRevision: (rev: string, arquivo?: string) => resolverFonte({ revisao: rev, arquivo }, f.catalogo).tipo === "arquivo" },
        )}
        aoAbrir={() => f.onVerNoMemorial(a.chave)}
        corretor={corretor}
      />
    );
  }
  return (
    <dl className={`rs-partes${juntar ? " am-partes-juntas" : ""}`}>
      <div>
        <dt>O que está errado</dt>
        <dd>{a.estruturado.descricao || a.titulo}</dd>
      </div>
      <div>
        <dt>Por que importa</dt>
        <dd>{a.estruturado.conflito || a.estruturado.referencia || "Consequência não detalhada no parecer."}</dd>
      </div>
      <div className="rs-parte-fazer">
        <dt>O que fazer</dt>
        <dd>
          <OQueFazer acao={a.estruturado.acao || "Ação recomendada não identificada."} corretor={corretor} />
        </dd>
      </div>
    </dl>
  );
}

export function Evidencias({ f, a }: { f: Fila; a: AchadoDaTela }) {
  const grifo = getHighlightNeedle(a.estruturado);
  const trechos = trechosDaEvidencia(a.bruto.evidencia);
  const p = paginasDoAchado(a);
  const temArquivo = f.temArquivo(a);
  return (
    <div className="rs-evidencias">
      {p.entre ? (
        trechos.map((t, i) => (
          <figure key={i} className="rs-trecho-de-conflito">
            <figcaption>
              <b>
                Trecho {i + 1} de {trechos.length}
                {t.pagina !== null ? `, p. ${t.pagina}` : ""}
              </b>
              {temArquivo && t.pagina !== null && (
                <Botao variante="quiet" tamanho="sm" onClick={() => f.onVerNoMemorial(a.chave, t.pagina!)}>
                  <FileSearch /> Abrir p. {t.pagina}
                </Botao>
              )}
            </figcaption>
            <blockquote>
              {a.bruto.origem === "regra" && "…"}
              <Trecho texto={t.texto} marca={grifo} />
              {a.bruto.origem === "regra" && "…"}
            </blockquote>
          </figure>
        ))
      ) : (
        <figure>
          <figcaption>
            {a.estruturado.documento ?? "Memorial"}
            {a.paginas.length ? `, p. ${a.paginas.join(", ")}` : ""}
            {temArquivo &&
              (p.varias ? (
                p.paginas.map((n) => (
                  <Botao key={n} variante="quiet" tamanho="sm" onClick={() => f.onVerNoMemorial(a.chave, n)}>
                    <FileSearch /> Abrir p. {n}
                  </Botao>
                ))
              ) : (
                <Botao variante="quiet" tamanho="sm" onClick={() => f.onVerNoMemorial(a.chave)}>
                  <FileSearch /> Abrir no PDF
                </Botao>
              ))}
          </figcaption>
          <blockquote>{a.bruto.evidencia ? <Trecho texto={a.bruto.evidencia} marca={grifo} /> : "Evidência não informada no parecer."}</blockquote>
        </figure>
      )}
      {grifo && (a.bruto.evidencia ?? "").toLowerCase().includes(grifo.toLowerCase()) && (
        <p className="rs-dica-copiar">
          <Copy size={12} strokeWidth={1.75} aria-hidden /> Clique no trecho destacado para copiar — e cole no Ctrl+F do arquivo editável.
        </p>
      )}
      {a.bruto.referencia_comparada && (
        <figure>
          <figcaption>Comparado com</figcaption>
          <blockquote>{a.bruto.referencia_comparada}</blockquote>
        </figure>
      )}
    </div>
  );
}

export function Conversa({ f, a }: { f: Fila; a: AchadoDaTela }) {
  if (!f.auditId) return <p className="rs-nota">A conversa existe quando o parecer está gravado no servidor.</p>;
  return (
    <ConversaDoAchado
      auditId={f.auditId}
      findingId={a.chave}
      membros={f.parecer.membros}
      rascunho={f.rascunhos[a.chave] ?? ""}
      onRascunho={(t) => f.setRascunhos({ ...f.rascunhos, [a.chave]: t })}
      onPublicado={f.parecer.reler}
    />
  );
}

export function Historico({ a }: { a: AchadoDaTela }) {
  const linha = a.linha;
  return (
    <ol className="rs-historico">
      <li>
        <time>{quando(linha?.createdAt) || "—"}</time> Encontrado{" "}
        {a.origem === "regra" ? "pela regra de coerência" : a.origem === "chat" ? "na conversa sobre o parecer" : "pela leitura da IA e mantido pelo segundo modelo"}
        {a.bruto.herdado_de ? `, herdado do parecer de ${a.bruto.herdado_de.quando}` : ""}
      </li>
      {linha?.assignedAt && linha.assigneeName && (
        <li>
          <time>{quando(linha.assignedAt)}</time> Atribuído a {linha.assigneeName}
          {linha.notifiedAt ? ", avisado por e-mail" : ""}
        </li>
      )}
      {a.validade && a.validade !== "FALSE_POSITIVE" && (
        <li>
          <time>{quando(linha?.updatedAt)}</time> {a.validade === "CONFIRMED" ? "Marcado como procedente" : a.validade === "WRONG_SEVERITY" ? "Gravidade contestada" : "Avaliado"}
        </li>
      )}
      {a.desfecho && (
        <li>
          <time>{quando(a.desfecho.quando)}</time> {NOME_DO_DESFECHO[a.desfecho.tipo]}
          {a.desfecho.por ? `, por ${a.desfecho.por}` : ""}
        </li>
      )}
    </ol>
  );
}

/** Evidência / Conversa / Histórico em abas. */
export function AbasDoAchado({ f, a }: { f: Fila; a: AchadoDaTela }) {
  return (
    <>
      <Segmento
        rotulo="Detalhe do achado"
        tour="achado-abas"
        valor={f.aba}
        onTroca={f.setAba}
        opcoes={[
          { valor: "evidencia", rotulo: "Evidência" },
          { valor: "conversa", rotulo: <>Conversa {a.comentarios > 0 && <em>{a.comentarios}</em>}</> },
          { valor: "historico", rotulo: "Histórico" },
        ]}
      />
      <div className="rs-aba">
        {f.aba === "evidencia" && <Evidencias f={f} a={a} />}
        {f.aba === "conversa" && <Conversa f={f} a={a} />}
        {f.aba === "historico" && <Historico a={a} />}
      </div>
    </>
  );
}

/** Encerrar (corrigido / decisão técnica com motivo / falso positivo), reabrir e desfazer. */
export function AcoesDoAchado({ f, a, compacta }: { f: Fila; a: AchadoDaTela; compacta?: boolean }) {
  const p = f.parecer;
  const decidindo = f.decisao && f.atual?.chave === a.chave;
  return (
    <div className="rs-acoes">
      {p.aviso && (
        <p className={`rs-aviso rs-aviso--${p.aviso.tom}`} role={p.aviso.tom === "falha" ? "alert" : "status"}>
          {p.aviso.texto}
        </p>
      )}
      {a.desfecho ? (
        <div className="rs-encerrado">
          <span className="rs-encerrado-marca">
            <Check size={14} />
          </span>
          <div>
            <b>
              {NOME_DO_DESFECHO[a.desfecho.tipo]}
              <span>
                , por {a.desfecho.por ?? "você"}
                {a.desfecho.quando ? ` em ${quando(a.desfecho.quando)}` : ""}
              </span>
            </b>
            {a.desfecho.nota && <p>{a.desfecho.nota}</p>}
          </div>
          {f.ultimo === a.chave ? (
            <Botao variante="ghost" tamanho="sm" onClick={f.desfazer}>
              <Undo2 /> Desfazer <Tecla>Z</Tecla>
            </Botao>
          ) : (
            <Botao variante="quiet" tamanho="sm" disabled={p.salvando === a.chave} onClick={() => void p.reabrir(a)}>
              Reabrir
            </Botao>
          )}
        </div>
      ) : decidindo ? (
        <form
          className="rs-decisao"
          onSubmit={(e) => {
            e.preventDefault();
            if (f.motivo.trim()) void f.encerrar("ACCEPTED_RISK", f.motivo.trim(), a);
          }}
        >
          <label>
            Motivo da decisão técnica <span>Fica no histórico e vai no parecer.</span>
          </label>
          <textarea autoFocus rows={2} value={f.motivo} onChange={(e) => f.setMotivo(e.target.value)} placeholder="Por que o projeto segue assim" />
          <div>
            <Botao variante="quiet" tamanho="sm" onClick={() => f.setDecisao(false)}>
              Cancelar <Tecla>Esc</Tecla>
            </Botao>
            <Botao variante="primary" tamanho="sm" type="submit" disabled={!f.motivo.trim() || p.salvando === a.chave}>
              Gravar decisão técnica
            </Botao>
          </div>
        </form>
      ) : (
        <div className="rs-botoes" data-tour="encerrar">
          <GrupoDeBotoes rotulo="Encerrar o achado">
            <BotaoDoGrupo principal tecla={compacta ? undefined : "C"} curto="Corrigido" disabled={!f.auditId || p.salvando === a.chave} onClick={() => (encerrouComMouse(), void f.encerrar("FIXED_IN_DOC", undefined, a))}>
              <Check /> Marcar corrigido
            </BotaoDoGrupo>
            <BotaoDoGrupo
              tecla={compacta ? undefined : "D"}
              curto="Decisão"
              disabled={!f.auditId}
              onClick={() => {
                if (f.atual?.chave !== a.chave) f.abrir(a.chave);
                f.setDecisao(true);
              }}
            >
              Decisão técnica
            </BotaoDoGrupo>
            <BotaoDoGrupo tecla={compacta ? undefined : "F"} curto="Falso positivo" disabled={!f.auditId || p.salvando === a.chave} onClick={() => (encerrouComMouse(), void f.encerrar("FALSE_POSITIVE", undefined, a))}>
              Falso positivo
            </BotaoDoGrupo>
          </GrupoDeBotoes>
          {!compacta && (
            <span className="rs-atalhos" title="J próximo, K anterior">
              <Tecla>J</Tecla>
              <Tecla>K</Tecla> andam
            </span>
          )}
        </div>
      )}
    </div>
  );
}
