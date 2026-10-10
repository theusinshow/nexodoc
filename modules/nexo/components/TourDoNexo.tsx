"use client";

/**
 * O TOUR GUIADO: holofote no alvo + balão ao lado, caminhando pela tela real.
 *
 * O HOLOFOTE (09/10/2026, pedido do Matheus: "desfocar as seções que não
 * importam, focar na objetiva"). Uma película só cobre a janela, desfocada e
 * escurecida, com um recorte em chanfro no alvo — o que o passo explica fica
 * nítido e clicável, o resto recua. O recorte desliza de um alvo ao outro; o
 * passo que troca de vista fecha o recorte, troca, e reabre. Geometria em
 * [[holofote.ts]], desenho em docs/superpowers/specs/2026-10-09-holofote-do-tour-design.md.
 *
 * NÃO PRENDE: clique na película encerra, como Esc. O passo em que a pessoa
 * saiu fica guardado ([[retomada-do-tour.ts]]) e o tour reabre nele.
 *
 * O tour DIRIGE a tela clicando nos mesmos controles que o usuário clicaria
 * (`clicarAntes`), em vez de mexer no estado por dentro: o que ele mostra é o
 * comportamento de verdade, e não uma encenação que pode divergir do produto.
 */

import { X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { DURACAO_DA_APROXIMACAO_MS, pedirAproximacao, pedirDevolucao } from "../lib/aproximar-no-tour";
import { ausentesPrevistos, capitulosDoRoteiro, cliqueQueOPassoPressupoe, ondeEsta, semOsAusentes } from "../lib/capitulos-do-tour";
import { recorteDoAlvo, recorteDoHolofote } from "../lib/holofote";
import { posicaoDoBalao, type Retangulo } from "../lib/posicao-do-balao";
import { PASSOS_DO_TOUR, type PassoDoTour } from "../lib/passos-do-tour";
import { esquecerRetomada, guardarRetomada, lerRetomada } from "../lib/retomada-do-tour";

import "./tour-do-nexo.css";

const LARGURA_BALAO = 340;
/** Quadros (~1 s) esperando um alvo nascer antes de o balão desistir dele e ir para o centro. */
const QUADROS_DE_ESPERA = 60;
/** Quanto um passo com `soSeExistir` espera o que explica entrar na tela antes de ser pulado. */
const ESPERA_DO_ALVO_MS = 2500;
/** O recorte fechado antes de reabrir numa vista nova: o `--duration-slow` da película. */
const TROCA_DE_VISTA_MS = 240;

export function TourDoNexo({
  aoSair,
  passos = PASSOS_DO_TOUR,
  rotulo = "Passo a passo do Nexo",
  rotuloFinal = "Começar",
  roteiro,
}: {
  aoSair: () => void;
  /** O roteiro; o padrão é o do primeiro contato. O resultado da auditoria tem o dele. */
  passos?: PassoDoTour[];
  rotulo?: string;
  /** O botão do último passo. */
  rotuloFinal?: string;
  /** Nome do roteiro para guardar onde a pessoa parou. Sem ele, todo tour começa do início. */
  roteiro?: string;
}) {
  const [indice, setIndice] = useState(() => {
    if (!roteiro) return 0;
    const guardado = lerRetomada(roteiro);
    return Math.max(0, passos.findIndex((p) => p.id === guardado));
  });
  /** O sentido do último passo dado: um passo pulado (`soSeExistir`) segue no mesmo sentido. */
  const sentido = useRef<1 | -1>(1);
  /** Chegou ao passo por salto (retomada, voltar, pular capítulo): refaz o clique de vista que o caminho faria. */
  const saltou = useRef(indice > 0);
  /** O canvas foi aproximado por um passo e ainda não devolveu o enquadramento. */
  const aproximado = useRef(false);
  /** Este passo mexeu no enquadramento do canvas: medir só depois que ele chegar. */
  const mexeuNoCanvas = useRef(false);
  // O fim do tour devolve o enquadramento que a pessoa tinha.
  useEffect(
    () => () => {
      if (aproximado.current) pedirDevolucao();
    },
    [],
  );
  /** O passo cuja tela já está pronta: até lá o balão não aparece (um passo que vai ser pulado não pisca). */
  const [pronto, setPronto] = useState<number | null>(null);
  /** O passo já medido: o balão aparece no lugar dele, nunca no do anterior. */
  const [medido, setMedido] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [janela, setJanela] = useState(() =>
    typeof window === "undefined" ? { largura: 0, altura: 0 } : { largura: window.innerWidth, altura: window.innerHeight },
  );
  const balaoRef = useRef<HTMLDivElement | null>(null);

  const passo = passos[indice];
  /**
   * Os passos que NÃO vão aparecer: os pulados por `soSeExistir` e os que já se
   * prevê que serão. A contagem e a barra andam só sobre os que ficam.
   */
  const [ausentes, setAusentes] = useState<ReadonlySet<number>>(() => new Set());
  const visiveis = useMemo(() => semOsAusentes(passos, ausentes), [passos, ausentes]);
  const posicao = Math.max(0, visiveis.indices.indexOf(indice));
  const ultimo = posicao === visiveis.passos.length - 1;
  const capitulos = useMemo(() => capitulosDoRoteiro(visiveis.passos), [visiveis]);
  const onde = ondeEsta(capitulos, posicao);
  const comCapitulos = capitulos.length > 1;

  // Pela ref: quem chama pode passar uma função nova a cada render, e o clique do passo não pode repetir por isso.
  const aoSairRef = useRef(aoSair);
  const passoRef = useRef(passo);
  useEffect(() => {
    aoSairRef.current = aoSair;
    passoRef.current = passo;
  });
  /** `terminou`: chegou ao fim (ou não sobrou passo). Senão, guarda onde parou. */
  const encerrar = useCallback(
    (terminou: boolean) => {
      if (roteiro) {
        const id = passoRef.current.id;
        if (terminou || id === passos[0].id) esquecerRetomada(roteiro);
        else guardarRetomada(roteiro, id);
      }
      aoSairRef.current();
    },
    [roteiro, passos],
  );
  const sair = useCallback(() => encerrar(false), [encerrar]);

  // O clique que leva a tela ao estado do passo. Roda ANTES de medir: medir um
  // alvo que só nasce depois do clique devolveria zero.
  useEffect(() => {
    let vivo = true;
    let espera = 0;
    const comecar = () => {
      const clique = saltou.current ? cliqueQueOPassoPressupoe(passos, indice) : passo.clicarAntes;
      saltou.current = false;
      // Chegou e existe: se tinha sido dado como ausente, volta à contagem.
      setAusentes((s) => {
        if (!s.has(indice)) return s;
        const n = new Set(s);
        n.delete(indice);
        return n;
      });
      // O recorte fecha durante a troca de vista: a tela pulando atrás do holofote não é o que se quer mostrar.
      if (passo.clicarAntes) setAlvo(null);
      setPronto(indice);
      if (clique) document.querySelector<HTMLElement>(clique)?.click();
      // O canvas chega perto do alvo, ou devolve o enquadramento que a pessoa tinha.
      if (passo.aproximar && passo.alvo) {
        pedirAproximacao(passo.alvo);
        aproximado.current = true;
        mexeuNoCanvas.current = true;
      } else if (aproximado.current) {
        pedirDevolucao();
        aproximado.current = false;
        mexeuNoCanvas.current = true;
      }
    };
    if (!passo.soSeExistir) {
      comecar();
      return;
    }
    /*
     * O que o passo explica pode ainda estar ENTRANDO (a fila desliza depois
     * que a leitura anterior sai): espera um pouco antes de concluir que não
     * existe. Só então pula — sem PDF, sem texto corrigido, explicar o
     * invisível é pior que pular. Por relógio, não por quadro: a animação
     * que se espera é ela mesma feita de quadros.
     */
    const inicio = Date.now();
    const procurar = () => {
      if (!vivo) return;
      if (document.querySelector(passo.soSeExistir!)) return comecar();
      if (Date.now() - inicio < ESPERA_DO_ALVO_MS) {
        espera = window.setTimeout(procurar, 60);
        return;
      }
      setAusentes((s) => (s.has(indice) ? s : new Set(s).add(indice)));
      const proximo = indice + sentido.current;
      if (proximo >= 0 && proximo < passos.length) setIndice(proximo);
      else encerrar(true);
    };
    procurar();
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [passo, indice, passos, encerrar]);

  // O que só aparece no hover (as ações da linha) fica à vista enquanto o passo fala dele.
  useEffect(() => {
    if (!passo.revelar) return;
    const el = document.querySelector<HTMLElement>(passo.revelar);
    el?.setAttribute("data-tour-revelado", "");
    return () => el?.removeAttribute("data-tour-revelado");
  }, [passo]);

  /*
   * A medição do alvo. `useLayoutEffect` porque o balão precisa nascer no lugar
   * certo — medir depois da pintura faria o balão aparecer num canto e pular
   * para o outro, que é o tipo de movimento sem significado que a DESIGN.md
   * proíbe.
   */
  useLayoutEffect(() => {
    let vivo = true;
    let quadro = 0;
    let atraso = 0;
    let tentativas = 0;
    let rolou = false;

    // Só mede o passo cuja tela já está pronta (o clique dele feito, o alvo dele na tela).
    if (pronto !== indice) return;

    // Medido o passo, com a tela dele assentada: prevê os que vão ser pulados adiante (mesma vista).
    const marcarMedido = () => {
      setMedido(indice);
      const previstos = ausentesPrevistos(passos, indice, (sel) => Boolean(document.querySelector(sel)));
      setAusentes((s) => (previstos.every((j) => s.has(j)) ? s : new Set([...s, ...previstos])));
    };
    const medir = () => {
      if (!vivo) return;
      setJanela({ largura: window.innerWidth, altura: window.innerHeight });
      if (!passo.alvo) {
        setAlvo(null);
        setPos(null);
        marcarMedido();
        return;
      }
      const el = document.querySelector(passo.alvo);
      if (!el) {
        // O alvo pode ainda não ter sido montado (a vista acabou de trocar).
        // Insistir por alguns quadros é mais honesto que pular o passo; mas
        // não para sempre, ou o balão nunca aparece.
        if (++tentativas < QUADROS_DE_ESPERA) quadro = requestAnimationFrame(medir);
        else {
          setAlvo(null);
          setPos(null);
          marcarMedido();
        }
        return;
      }
      if (!rolou) {
        // Alvo abaixo da dobra (o rodapé da fila numa janela baixa): traz para a vista e mede no quadro seguinte.
        rolou = true;
        el.scrollIntoView({ block: "nearest" });
        quadro = requestAnimationFrame(medir);
        return;
      }
      const r = el.getBoundingClientRect();
      const retangulo = { x: r.left, y: r.top, largura: r.width, altura: r.height };
      setAlvo(retangulo);
      const alturaBalao = balaoRef.current?.offsetHeight ?? 200;
      setPos(
        posicaoDoBalao(
          // O balão se afasta do RECORTE, não do alvo: senão encosta na borda nítida.
          recorteDoAlvo(retangulo, { largura: window.innerWidth, altura: window.innerHeight }),
          { largura: LARGURA_BALAO, altura: alturaBalao },
          { largura: window.innerWidth, altura: window.innerHeight },
          passo.lado ?? "abaixo",
        ),
      );
      marcarMedido();
    };
    const remedir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(medir);
    };

    // Vista nova: o recorte termina de fechar antes de reabrir. Canvas se
    // movendo: mede quando ele chegar. Senão, um quadro de espera.
    if (passo.clicarAntes) atraso = window.setTimeout(remedir, TROCA_DE_VISTA_MS);
    else if (mexeuNoCanvas.current) atraso = window.setTimeout(remedir, DURACAO_DA_APROXIMACAO_MS + 30);
    else quadro = requestAnimationFrame(medir);
    mexeuNoCanvas.current = false;
    window.addEventListener("resize", remedir);
    // Rolagem de qualquer painel (captura): o recorte acompanha o alvo.
    window.addEventListener("scroll", remedir, true);
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
      window.clearTimeout(atraso);
      window.removeEventListener("resize", remedir);
      window.removeEventListener("scroll", remedir, true);
    };
  }, [passo, pronto, indice, passos]);

  const avancar = useCallback(() => {
    sentido.current = 1;
    if (ultimo) encerrar(true);
    else setIndice((i) => i + 1);
  }, [ultimo, encerrar]);

  const voltar = useCallback(() => {
    sentido.current = -1;
    saltou.current = true;
    setIndice((i) => Math.max(0, i - 1));
  }, []);

  const pularCapitulo = useCallback(() => {
    if (onde.proximoCapitulo === null) return;
    sentido.current = 1;
    saltou.current = true;
    setIndice(visiveis.indices[onde.proximoCapitulo]);
  }, [onde.proximoCapitulo, visiveis]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") sair();
      else if (e.key === "ArrowRight" || e.key === "Enter") avancar();
      else if (e.key === "ArrowLeft") voltar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [avancar, voltar, sair]);

  const visivel = pronto === indice && medido === indice;
  const alvoVisivel = visivel ? alvo : passo.clicarAntes ? null : alvo;
  const moldura = alvoVisivel ? recorteDoAlvo(alvoVisivel, janela) : null;

  /*
   * NO BODY, por portal: dentro do `.ds` (o resultado da auditoria) o `zoom`
   * de 1.125 multiplicaria `left`/`top`, e o recorte andaria 12,5% longe do
   * alvo medido pela janela.
   */
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {/*
        A película. Recebe o clique de fora do recorte e encerra; dentro do
        recorte ela não existe, e o alvo continua clicável.
      */}
      <div
        aria-hidden
        data-tour-pelicula
        className="tour-pelicula"
        style={{ clipPath: recorteDoHolofote(alvoVisivel, janela) }}
        onPointerDown={sair}
      />
      <div
        aria-hidden
        data-tour-anel
        data-tour-alvo={passo.alvo}
        className="tour-moldura"
        data-aceso={moldura ? "" : undefined}
        style={
          moldura
            ? { left: moldura.x, top: moldura.y, width: moldura.largura, height: moldura.altura }
            : { left: janela.largura / 2, top: janela.altura / 2, width: 0, height: 0 }
        }
      />

      <div
        key={`${indice}-${visivel ? "v" : "h"}`}
        ref={balaoRef}
        role="dialog"
        aria-label={rotulo}
        data-tour-balao
        data-centro={pos ? undefined : ""}
        className="tour-balao"
        style={{ width: LARGURA_BALAO, ...(pos ? { left: pos.x, top: pos.y } : null), visibility: visivel ? undefined : "hidden" }}
      >
        <div className="tour-balao-corpo nx-edge-8">
          <div className="tour-balao-topo">
            <p className="tour-balao-onde" data-tour-onde>
              {comCapitulos && onde.capitulo.nome ? (
                <>
                  {onde.capitulo.nome} · {onde.passo} de {onde.capitulo.total}
                </>
              ) : (
                <>
                  {posicao + 1} de {visiveis.passos.length}
                </>
              )}
            </p>
            <button type="button" className="tour-balao-sair" aria-label="Sair do passo a passo" onClick={sair}>
              <X size={14} aria-hidden />
            </button>
          </div>

          <div className="tour-capitulos" aria-hidden>
            {(comCapitulos ? capitulos : [{ nome: "", inicio: 0, total: visiveis.passos.length }]).map((c, k) => {
              const feito = Math.min(c.total, Math.max(0, posicao - c.inicio + 1));
              return (
                <span key={c.inicio} className="tour-capitulo" style={{ flexGrow: c.total }} data-atual={comCapitulos && k === onde.ordem ? "" : undefined}>
                  <span style={{ width: `${(feito / c.total) * 100}%` }} />
                </span>
              );
            })}
          </div>

          <h2 className="tour-balao-titulo">{passo.titulo}</h2>
          <p className="tour-balao-texto">{passo.corpo}</p>

          <div className="tour-balao-acoes">
            <Button size="sm" onClick={avancar} data-tour-proximo>
              {ultimo ? rotuloFinal : "Próximo"}
            </Button>
            {posicao > 0 && !ultimo && (
              <Button size="sm" variant="ghost" onClick={voltar}>
                Voltar
              </Button>
            )}
            {!ultimo &&
              (comCapitulos ? (
                onde.proximoCapitulo !== null && (
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={pularCapitulo} data-tour-pular-capitulo>
                    Pular capítulo
                  </Button>
                )
              ) : (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={sair}>
                  Pular
                </Button>
              ))}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
