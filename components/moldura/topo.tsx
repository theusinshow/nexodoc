"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowRight, Bell, Bug, ChevronDown, FolderOpen, Keyboard, LayoutGrid, LifeBuoy, ListChecks, LogOut, MessageSquare, Repeat2, Search, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent as KE, type ReactNode, type RefObject } from "react";

import { Avatar, Botao, Orbe, Tecla } from "@/components/ds/basicos";
import { corDaPessoa } from "@/lib/cor-da-pessoa";
import { CURVA } from "@/lib/ds/movimento";
import { useTempo } from "@/lib/ds/tempo";
import { linkDoAchado } from "@/lib/link-do-achado";
import { diaEmBrasilia } from "@/lib/fuso-de-brasilia";
import { dataCurta, marcaDeVisto, naoVistas, NOVIDADES } from "@/lib/novidades";
import type { DadosDaMoldura, DestinoDoTopo } from "@/lib/moldura";
import { plural } from "@/lib/plural";
import { abrirSuporte } from "@/lib/suporte/cliente";

import { useMoldura } from "./contexto";
import "./topo.css";

/** Onde cada destino da barra mora. Administração só aparece para quem administra. */
export const ROTA_DO_DESTINO: Record<DestinoDoTopo, string> = {
  Painel: "/",
  Nexo: "/nexo",
  Projetos: "/projetos",
  Achados: "/achados",
  Ajuda: "/ajuda",
  Administração: "/admin",
};
const TODOS: DestinoDoTopo[] = ["Painel", "Nexo", "Projetos", "Achados", "Ajuda", "Administração"];
export const destinosDe = (ehAdmin: boolean) => TODOS.filter((d) => d !== "Administração" || ehAdmin);

/**
 * A barra de cima das telas (fora do palco do Nexo). Uma só, para as telas não
 * divergirem. `busca={false}` onde a própria tela já é a busca.
 *
 * ELA SE MEDE PELA CAIXA, NÃO PELA JANELA (container query em `.pn-topo-caixa`):
 * abaixo de 1280px os destinos vão para o cartão da marca; abaixo de 900 a busca
 * vira o ícone com o Ctrl K; abaixo de 600 fica só o avatar.
 *
 * EM PÍLULA desde 03/10/2026 (ref.: Navbar Interaction, aprovada no lab): solta
 * da borda, o orbe num círculo, os destinos com o realce que segue o gesto e a
 * conta como a pílula de contraste.
 */
export function Topo({ atual, dados, trabalhando = false, busca = true }: { atual: DestinoDoTopo | null; dados: DadosDaMoldura; trabalhando?: boolean; busca?: boolean }) {
  const { abrirBusca } = useMoldura();
  const destinos = destinosDe(dados.usuario.ehAdmin);
  return (
    <div className="pn-topo-caixa pn-topo-caixa--pilula">
      <a href="#conteudo" className="pn-pular">
        Pular para o conteúdo
        <Tecla>↵</Tecla>
      </a>
      <header className="pn-topo">
        {/* larga: a marca leva ao Painel; estreita (abaixo de 1280): a marca abre o cartão de navegação */}
        <Link className="pn-marca pn-marca--link" href="/">
          <span className="pn-marca-circulo">
            <Orbe tamanho={22} estado={trabalhando ? "trabalhando" : "repouso"} />
          </span>
          <span className="pn-marca-nome">Nexo</span>
        </Link>
        <CartaoDeNavegacao atual={atual} destinos={destinos} dados={dados} trabalhando={trabalhando} />
        <NavComRealce atual={atual} destinos={destinos} />
        {busca ? (
          <button type="button" className="pn-busca" onClick={() => abrirBusca()} aria-label="Buscar obra, código ou ação (Ctrl K)">
            <Search size={15} />
            <span className="pn-busca-texto">Buscar obra, código ou ação</span>
            <Tecla>Ctrl K</Tecla>
          </button>
        ) : (
          <span style={{ marginLeft: "auto" }} />
        )}
        <Sino dados={dados} />
        <MenuDaConta dados={dados} />
      </header>
    </div>
  );
}

/*
 * OS DESTINOS COM REALCE. Uma cápsula clara mora no destino atual e desliza
 * para onde o mouse ou o foco está; ao sair, volta para o atual. Só se move em
 * resposta ao gesto, nunca sozinha. O `LayoutGroup` com id próprio impede que
 * duas barras na mesma página troquem o realce entre si.
 */
function NavComRealce({ atual, destinos }: { atual: DestinoDoTopo | null; destinos: DestinoDoTopo[] }) {
  const { dur } = useTempo();
  const grupo = useId();
  const [sob, setSob] = useState<DestinoDoTopo | null>(null);
  const realce = sob ?? atual;
  return (
    <LayoutGroup id={grupo}>
      <nav className="pn-nav" aria-label="Principal" onPointerLeave={() => setSob(null)}>
        {destinos.map((n) => (
          <Link
            key={n}
            href={ROTA_DO_DESTINO[n]}
            aria-current={n === atual ? "page" : undefined}
            onPointerEnter={() => setSob(n)}
            onFocus={() => setSob(n)}
            onBlur={() => setSob(null)}
          >
            {n === realce && <motion.span layoutId="pn-realce" className="pn-realce" transition={{ duration: dur("state"), ease: [...CURVA.out] }} aria-hidden />}
            <span className="pn-nav-texto">{n}</span>
          </Link>
        ))}
      </nav>
    </LayoutGroup>
  );
}

const ICONE_DO_DESTINO: Record<DestinoDoTopo, ReactNode> = {
  Painel: <LayoutGrid size={16} />,
  Nexo: <MessageSquare size={16} />,
  Projetos: <FolderOpen size={16} />,
  Achados: <ListChecks size={16} />,
  Ajuda: <LifeBuoy size={16} />,
  Administração: <ShieldCheck size={16} />,
};

/*
 * O CARTÃO DE NAVEGAÇÃO (ref.: Card Nav). Abaixo de 1280 os destinos não cabem
 * na barra; a marca vira o botão que abre um cartão com os destinos, cada um com
 * uma linha do que tem lá agora. Sem cor de enfeite: a cor fica para o sinal.
 */
function CartaoDeNavegacao({ atual, destinos, dados, trabalhando }: { atual: DestinoDoTopo | null; destinos: DestinoDoTopo[]; dados: DadosDaMoldura; trabalhando: boolean }) {
  const { dur, k } = useTempo();
  const { aberto, fechar, raiz, botao, painel, andar, aoClicar, aoTeclar } = usePainel();
  const router = useRouter();
  const comVoce = dados.comVoce.reduce((n, c) => n + c.total, 0);
  const ultimo = dados.recentes[0];
  const LINHA: Record<DestinoDoTopo, ReactNode> = {
    Painel: "Tarefas e o que retomar",
    Nexo: ultimo ? (
      <>
        {ultimo.codigo && <span className="ds-code">{ultimo.codigo}</span>} {ultimo.titulo}
      </>
    ) : (
      "Conversar, auditar, montar"
    ),
    Projetos: <span className="ds-num">{plural(dados.obras.length, "obra aberta", "obras abertas")}</span>,
    Achados: (
      <span className="pn-cartao-sinal">
        <span className="ds-num">{comVoce}</span> com você
      </span>
    ),
    Ajuda: "Tarefas, lugares e palavras",
    Administração: "Centro de controle",
  };
  return (
    <div ref={raiz} className="pn-conta pn-marca-raiz">
      <button ref={botao} type="button" className="pn-marca pn-marca--botao" aria-haspopup="menu" aria-expanded={aberto} aria-label="Navegação" onClick={aoClicar} onKeyDown={aoTeclar}>
        <span className="pn-marca-circulo">
          <Orbe tamanho={22} estado={trabalhando ? "trabalhando" : "repouso"} />
        </span>
        <span className="pn-marca-nome">Nexo</span>
        <motion.span className="pn-quem-seta" animate={{ rotate: aberto ? 180 : 0 }} transition={{ duration: dur("state"), ease: [...CURVA.out] }}>
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence>
        {aberto && (
          <Painel ref={painel} andar={andar} rotulo="Navegação" classe="pn-cartao-nav">
            <div className="pn-cartao-grade">
              {destinos.map((d, i) => (
                <motion.button
                  key={d}
                  type="button"
                  role="menuitem"
                  aria-current={d === atual ? "page" : undefined}
                  className="pn-cartao-destino"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur("enter"), delay: (0.04 + i * 0.03) * k, ease: [...CURVA.out] }}
                  onClick={() => (fechar(false), router.push(ROTA_DO_DESTINO[d]))}
                >
                  <span className="pn-cartao-icone">{ICONE_DO_DESTINO[d]}</span>
                  <b>{d}</b>
                  <span className="pn-cartao-linha">{LINHA[d]}</span>
                </motion.button>
              ))}
            </div>
          </Painel>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Os itens que dá para focar agora (os destinos ficam escondidos com a barra larga). */
const visiveis = (raiz: HTMLElement | null) => [...(raiz?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])].filter((el) => el.offsetParent !== null);

/**
 * Um painel que cresce de um botão: fecha com clique fora e com Esc (que
 * devolve o foco ao botão), anda com ↑ ↓ Home End entre os itens, e quando
 * abre pelo teclado já entrega o foco no primeiro item.
 */
function usePainel() {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const peloTeclado = useRef(false);

  const fechar = useCallback((devolver = true) => {
    setAberto(false);
    if (devolver) botao.current?.focus();
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      fechar();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc, true);
    if (peloTeclado.current) requestAnimationFrame(() => visiveis(painel.current)[0]?.focus());
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc, true);
    };
  }, [aberto, fechar]);

  const andar = (e: KE<HTMLDivElement>) => {
    const itens = visiveis(painel.current);
    if (!itens.length) return;
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const ir = (n: number) => (e.preventDefault(), itens[(n + itens.length) % itens.length].focus());
    if (e.key === "ArrowDown") ir(i + 1);
    else if (e.key === "ArrowUp") ir(i < 0 ? itens.length - 1 : i - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(itens.length - 1);
    else if (e.key === "Tab") setAberto(false);
  };

  const aoClicar = (e: React.MouseEvent) => {
    peloTeclado.current = e.detail === 0;
    setAberto((a) => !a);
  };
  const aoTeclar = (e: KE<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      peloTeclado.current = true;
      setAberto(true);
    }
  };
  return { aberto, fechar, raiz, botao, painel, andar, aoClicar, aoTeclar };
}

function Painel({ ref, andar, rotulo, classe, children }: { ref: RefObject<HTMLDivElement | null>; andar: (e: KE<HTMLDivElement>) => void; rotulo: string; classe: string; children: ReactNode }) {
  const { dur } = useTempo();
  return (
    <motion.div
      ref={ref}
      role="menu"
      aria-label={rotulo}
      className={`pn-painel ${classe}`}
      onKeyDown={andar}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: dur("feedback"), ease: [...CURVA.exit] } }}
      transition={{ duration: dur("enter"), ease: [...CURVA.out] }}
    >
      {children}
    </motion.div>
  );
}

const desde = (iso: string) => {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return { dias, texto: dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias` };
};

/**
 * O SINO É "COM VOCÊ": os achados atribuídos a você e ainda não resolvidos — a
 * mesma consulta da tela de Achados (`pendenciasDe`). O app não tem caixa de
 * notificações e esta não inventa uma: sem "lido/não lido", o ponto só diz que
 * a lista não está vazia.
 */
/*
 * O QUE HÁ DE NOVO (09/10/2026). "Visto até" mora no navegador — conveniência
 * de quem usa, não registro: perder (aba privada, outra máquina) só mostra de
 * novo as últimas novidades. Lido por `useSyncExternalStore`: o servidor pinta
 * "nada novo", o cliente acende o ponto.
 */
const CHAVE_DAS_NOVIDADES = "nexo.novidades.vistoAte";
const EVENTO_DAS_NOVIDADES = "nexo.novidades";
function lerVistoAte(): string {
  try {
    return localStorage.getItem(CHAVE_DAS_NOVIDADES) ?? "";
  } catch {
    return "";
  }
}
function assinarNovidades(avisar: () => void) {
  window.addEventListener(EVENTO_DAS_NOVIDADES, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_DAS_NOVIDADES, avisar);
    window.removeEventListener("storage", avisar);
  };
}
function useNovidades() {
  // "-" no servidor: nada novo até o cliente ler o navegador.
  const vistoAte = useSyncExternalStore(assinarNovidades, lerVistoAte, () => "-");
  const novas = vistoAte === "-" ? [] : naoVistas(NOVIDADES, vistoAte || null, diaEmBrasilia(new Date()));
  const marcarVistas = useCallback(() => {
    const marca = marcaDeVisto(NOVIDADES);
    if (!marca) return;
    try {
      localStorage.setItem(CHAVE_DAS_NOVIDADES, marca);
    } catch {}
    window.dispatchEvent(new Event(EVENTO_DAS_NOVIDADES));
  }, []);
  return { novas, marcarVistas };
}

function Sino({ dados }: { dados: DadosDaMoldura }) {
  const { aberto, fechar, raiz, botao, painel, andar, aoClicar, aoTeclar } = usePainel();
  const router = useRouter();
  const total = dados.comVoce.reduce((n, c) => n + c.total, 0);
  const { novas, marcarVistas } = useNovidades();
  /*
   * As novidades que estavam novas quando o painel ABRIU: abrir marca como
   * vistas, e sem esta foto elas sumiriam da lista no mesmo instante em que a
   * pessoa foi olhar.
   */
  const [novasAoAbrir, setNovasAoAbrir] = useState<string[]>([]);
  const temAlgo = total > 0;
  const temNovidade = novas.length > 0;
  const abrir = (e: Parameters<typeof aoClicar>[0]) => {
    if (!aberto) {
      setNovasAoAbrir(novas.map((n) => n.id));
      marcarVistas();
    }
    aoClicar(e);
  };
  return (
    <div ref={raiz} className="pn-conta">
      <Botao
        ref={botao}
        variante="quiet"
        icone
        aria-label={[temAlgo ? `Com você: ${plural(total, "achado", "achados")}` : "Com você: nada", temNovidade ? plural(novas.length, "novidade", "novidades") : ""].filter(Boolean).join(" · ")}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="pn-sino"
        onClick={abrir}
        onKeyDown={aoTeclar}
      >
        <Bell />
        {(temAlgo || temNovidade) && <i />}
      </Botao>
      <AnimatePresence>
        {aberto && (
          <Painel ref={painel} andar={andar} rotulo="Com você" classe="pn-sino-painel">
            {novasAoAbrir.length > 0 && (
              <div className="pn-novidades">
                <div className="pn-sino-cabeca">
                  <b>O que há de novo</b>
                  <span className="ds-num">{plural(novasAoAbrir.length, "novidade", "novidades")}</span>
                </div>
                {NOVIDADES.filter((n) => novasAoAbrir.includes(n.id)).map((n) => (
                  <div key={n.id} className="pn-novidade">
                    <span className="pn-sino-linha">
                      <b>{n.titulo}</b>
                      <span className="pn-novidade-data">{dataCurta(n.id)}</span>
                    </span>
                    <span className="pn-sino-sub">{n.linha}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="pn-sino-cabeca">
              <b>Com você</b>
              <span className="ds-num">{plural(total, "achado", "achados")}</span>
            </div>
            {temAlgo ? (
              dados.comVoce.map((c) => {
                const d = desde(c.enviadoEm);
                return (
                  <button key={c.auditId} type="button" role="menuitem" className="pn-sino-item" onClick={() => (fechar(false), router.push(linkDoAchado({ base: "", auditId: c.auditId, findingId: c.findingId, fila: "meus" })))}>
                    <span className="pn-sino-linha">
                      <span className="ds-code">{c.codigo}</span>
                      <b>{c.titulo}</b>
                    </span>
                    <span className="pn-sino-sub">
                      {c.enviadoPor ? `Enviado por ${c.enviadoPor}` : "Da sua auditoria"}, {d.texto}
                      {d.dias >= 5 && <em className="pn-sino-parado">parado há {d.dias} dias</em>}
                    </span>
                    <span className="pn-sino-conta">
                      <span className="ds-num">{c.total}</span> {c.total === 1 ? "achado" : "achados"}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="pn-sino-vazio">{dados.semBanco ? "Sem banco neste ambiente." : "Nada com você agora."}</p>
            )}
            <div className="pn-painel-pe">
              <button type="button" role="menuitem" onClick={() => (fechar(false), router.push("/achados"))}>
                Abrir Achados <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </Painel>
        )}
      </AnimatePresence>
    </div>
  );
}

const PAPEL: Record<"OWNER" | "ADMIN" | "MEMBER", string> = { OWNER: "dono", ADMIN: "admin", MEMBER: "membro" };

/**
 * O MENU DA CONTA: quem você é e com que alçada (as mesmas duas chaves de
 * Pessoas: centro de controle e escritório), os atalhos e as duas saídas
 * (Sair, e Entrar com outra conta — o mesmo `signOut` para /login).
 */
function MenuDaConta({ dados }: { dados: DadosDaMoldura }) {
  const { dur } = useTempo();
  const { abrirAtalhos } = useMoldura();
  const { aberto, fechar, raiz, botao, painel, andar, aoClicar, aoTeclar } = usePainel();
  const u = dados.usuario;
  const papel = u.papelNoEscritorio ? PAPEL[u.papelNoEscritorio] : null;
  return (
    <div ref={raiz} className="pn-conta">
      <button
        ref={botao}
        type="button"
        className="pn-quem"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={aoClicar}
        onKeyDown={aoTeclar}
        // O brilho segue o ponteiro por dentro da pílula.
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        }}
      >
        <span className="pn-quem-brilho" aria-hidden />
        <Avatar iniciais={u.iniciais} cor={corDaPessoa({ grupo: u.grupo, role: u.papelNoEscritorio })} />
        <span className="pn-quem-texto">
          {u.nome.split(" ")[0]}
          <small>{[u.escritorio, u.ehAdmin ? "admin" : papel].filter(Boolean).join(", ")}</small>
        </span>
        <motion.span className="pn-quem-seta" animate={{ rotate: aberto ? 180 : 0 }} transition={{ duration: dur("state"), ease: [...CURVA.out] }}>
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence>
        {aberto && (
          <Painel ref={painel} andar={andar} rotulo="Conta" classe="pn-menu">
            <div className="pn-menu-quem">
              {/* O MESMO avatar da pílula, maior: era um <span> à parte e ficava cinza (08/10). */}
              <Avatar iniciais={u.iniciais} grande cor={corDaPessoa({ grupo: u.grupo, role: u.papelNoEscritorio })} />
              <span className="pn-menu-nome">
                <b>{u.nome}</b>
                <small className="mp-mono">{u.email}</small>
              </span>
            </div>
            <dl className="pn-menu-alcada">
              <div>
                <dt>Centro de controle</dt>
                <dd>{u.ehAdmin ? <em>Admin</em> : "Usuário"}</dd>
              </div>
              {u.escritorio && (
                <div>
                  <dt>Escritório</dt>
                  <dd>
                    {u.escritorio} {papel && <span className="pn-menu-papel">{papel}</span>}
                  </dd>
                </div>
              )}
            </dl>
            <div className="pn-menu-grupo">
              <button type="button" role="menuitem" onClick={() => (fechar(false), abrirAtalhos())}>
                <Keyboard size={15} aria-hidden />
                Atalhos de teclado
                <Tecla>?</Tecla>
              </button>
              <button type="button" role="menuitem" onClick={() => (fechar(false), abrirSuporte())}>
                <Bug size={15} aria-hidden />
                Reportar um problema
                <Tecla>Ctrl ⇧ B</Tecla>
              </button>
            </div>
            <div className="pn-menu-grupo">
              <button type="button" role="menuitem" onClick={() => void signOut({ redirectTo: "/login" })}>
                <Repeat2 size={15} aria-hidden />
                Entrar com outra conta
              </button>
              <button type="button" role="menuitem" className="pn-menu-sair" onClick={() => void signOut({ redirectTo: "/login" })}>
                <LogOut size={15} aria-hidden />
                Sair
              </button>
            </div>
            <p className="pn-menu-nota">
              Conta Google. Sair encerra a sessão só neste navegador. <Link href="/termos" onClick={() => fechar(false)}>Termos de uso</Link>
            </p>
          </Painel>
        )}
      </AnimatePresence>
    </div>
  );
}
