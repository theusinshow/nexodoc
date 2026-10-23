"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FONTES_DS } from "@/lib/ds/fontes";
import type { DadosDaMoldura, DestinoDoTopo } from "@/lib/moldura";

import { FaixaDeAviso, TelaDeAviso, useAvisoDeTela } from "./aviso-de-tela";
import { ContextoDaMoldura, type ModeloDeAviso } from "./contexto";
import { Atalhos, Avisos, juntarAviso, Paleta, type Aviso } from "./sobreposicoes";
import { ROTA_DO_DESTINO, Topo } from "./topo";
import "@/app/ds.css";
import "./moldura.css";

function digitando(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null;
  return !!el && (el.isContentEditable || !!el.closest("input, textarea, select, [contenteditable=true]"));
}

/** G e depois a letra. */
const AREAS: Record<string, DestinoDoTopo> = { p: "Painel", n: "Nexo", o: "Projetos", a: "Achados", j: "Ajuda", d: "Administração" };

/**
 * A MOLDURA de uma tela no sistema novo. Toda tela migrada mora aqui dentro:
 *
 *   <Moldura dados={await carregarMoldura("/achados")} atual="Achados">
 *     <div className="ac">…</div>
 *   </Moldura>
 *
 * Ela põe a raiz `.ds` com a fonte Geist (o CSS do sistema é `.ds .x`), o Topo,
 * e o que vale em qualquer tela: Ctrl K abre a busca, `?` os atalhos, G e uma
 * letra leva a uma área, e os avisos passageiros. Abaixo de 1024 px, antes da
 * tela, vem o aviso de que o Nexo funciona melhor numa tela grande.
 *
 * `buscaPropria`: a tela já é a busca (a home), então o Ctrl K é dela.
 */
export function Moldura({
  dados,
  atual,
  buscaPropria = false,
  buscaPorEvento,
  trabalhando = false,
  children,
}: {
  dados: DadosDaMoldura;
  atual: DestinoDoTopo | null;
  buscaPropria?: boolean;
  /**
   * A tela tem a PRÓPRIA paleta (o Nexo, com as ações da conversa): a busca do
   * Topo continua visível, mas o clique só dispara este evento na janela, e o
   * Ctrl K fica com a tela. Uma paleta só, com gatilho à vista.
   */
  buscaPorEvento?: string;
  trabalhando?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [paleta, setPaleta] = useState(false);
  const [termo, setTermo] = useState("");
  const [atalhos, setAtalhos] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  // a ação de cada aviso ("Tentar de novo", "Ver na fila"), pelo título dele
  const acoes = useRef(new Map<string, () => void>());
  const aviso = useAvisoDeTela();

  const avisar = useCallback((m: ModeloDeAviso, onAcao?: () => void) => {
    if (onAcao) acoes.current.set(m.titulo, onAcao);
    setAvisos((lista) => juntarAviso(lista, m));
  }, []);
  const fecharAviso = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);

  const contexto = useMemo(
    () => ({
      abrirBusca: (t?: string) => (buscaPorEvento ? window.dispatchEvent(new Event(buscaPorEvento)) : (setTermo(t ?? ""), setAtalhos(false), setPaleta(true))),
      abrirAtalhos: () => (setPaleta(false), setAtalhos(true)),
      avisar,
      primeiroNome: dados.usuario.nome.trim().split(/\s+/)[0] ?? "",
    }),
    [avisar, buscaPorEvento, dados.usuario.nome],
  );

  // Ctrl K e ? em qualquer tela
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !buscaPropria && !buscaPorEvento) {
        e.preventDefault();
        setAtalhos(false);
        setTermo("");
        setPaleta((p) => !p);
      } else if (e.key === "?" && !digitando(e.target)) {
        e.preventDefault();
        setPaleta(false);
        setAtalhos((a) => !a);
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [buscaPropria, buscaPorEvento]);

  // G e depois a letra. No window, em captura: a letra que vem depois do G não
  // chega aos atalhos de lista da tela (J/K/A).
  useEffect(() => {
    let g = 0;
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || digitando(e.target)) return;
      const k = e.key.toLowerCase();
      const destino = AREAS[k];
      if (g && Date.now() - g < 1200 && destino && (destino !== "Administração" || dados.usuario.ehAdmin)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        g = 0;
        router.push(ROTA_DO_DESTINO[destino]);
        return;
      }
      g = k === "g" ? Date.now() : 0;
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [router, dados.usuario.ehAdmin]);

  /*
   * O "Pular para o conteúdo" do layout raiz aponta para o começo da página
   * (antes do Topo); aqui quem pula é o do Topo, que vai para #conteudo. Enquanto
   * houver tela antiga, o do layout fica — só se esconde com a moldura na tela.
   */
  useEffect(() => {
    const antigo = document.querySelector<HTMLAnchorElement>('a[href="#main-content"]');
    if (!antigo) return;
    antigo.hidden = true;
    return () => {
      antigo.hidden = false;
    };
  }, []);

  return (
    <ContextoDaMoldura.Provider value={contexto}>
      <div className={`ds ${FONTES_DS} md-raiz`}>
        {/*
          O AVISO COBRE, NÃO SUBSTITUI. A tela fica montada por baixo (inerte):
          encolher a janela abaixo de 1024 e voltar — encaixá-la na metade de um
          monitor, por exemplo — não pode desmontar a página e perder o que a
          pessoa estava fazendo.
        */}
        {aviso.mostrarTela && <TelaDeAviso largura={aviso.largura} onContinuar={aviso.continuar} />}
        <div className={`md-tela${buscaPorEvento ? "" : " md-com-pe"}`} inert={aviso.mostrarTela} aria-hidden={aviso.mostrarTela || undefined}>
          {aviso.mostrarFaixa && <FaixaDeAviso largura={aviso.largura} onFechar={aviso.fecharFaixa} />}
          <Topo atual={atual} dados={dados} busca={!buscaPropria} trabalhando={trabalhando} />
          <main id="conteudo" className="md-conteudo" tabIndex={-1}>
            {children}
          </main>
          {/* O Nexo ocupa a altura toda da janela: lá o link mora no menu da conta. */}
          {!buscaPorEvento && (
            <footer className="md-pe">
              <Link href="/termos">Termos de uso e limitação de responsabilidade</Link>
            </footer>
          )}
        </div>
        <Paleta aberta={paleta} onFechar={() => setPaleta(false)} obras={dados.obras} recentes={dados.recentes} inicialQ={termo} />
        <Atalhos aberta={atalhos} onFechar={() => setAtalhos(false)} />
        <Avisos
          avisos={avisos}
          onFechar={fecharAviso}
          onAcao={(a) => {
            fecharAviso(a.id);
            acoes.current.get(a.titulo)?.();
          }}
        />
      </div>
    </ContextoDaMoldura.Provider>
  );
}
