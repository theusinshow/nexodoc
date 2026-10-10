"use client";

/**
 * AS DICAS DA AUDITORIA, uma vez cada (auditoria UX do memorial, 07/10/2026).
 *
 * O tour de 11 passos abria sozinho e ensinava de uma vez o que a pessoa ainda
 * não estava fazendo — metade sobre volume, para quem tinha vindo auditar.
 * Agora cada dica aparece NA HORA em que a pessoa faz aquilo, e não volta:
 *
 * - `processamento`: o que o Nexo procura enquanto lê (painel da auditoria em curso);
 * - `primeira-revisao`: o que cada botão de encerrar significa (a fila, na primeira vez);
 * - `atalhos`: J/K, C/D/F, M e ? para quem já encerrou três achados com o mouse;
 * - `tour-do-resultado`: o passo a passo da tela de resultado, que abre sozinho
 *   na primeira vez que a pessoa vê um parecer (e volta pelo "?" do trilho).
 *
 * E as de MONTAR UM VOLUME (09/10/2026), que perdeu as suas quando o tour saiu
 * do primeiro acesso — mesma regra, cada uma na hora:
 *
 * - `volume-plano`: como um volume se compõe e o que conferir (o plano, na primeira vez);
 * - `volume-canvas`: o que é cada fileira e onde se monta (o canvas, com tomo à vista);
 * - `volume-entrega`: por que os editáveis vêm antes dos PDFs (a doca, na primeira vez);
 * - `volume-teto`: o que fazer com tomo acima de 20 MB (só quando acontece).
 *
 * E as do PRIMEIRO ACESSO (10/10/2026, M1 e M2 do doc 08):
 *
 * - `memorial-de-exemplo`: a oferta "Usar um memorial de exemplo" na zona de
 *   soltar, para quem ainda não auditou. Não tem "Entendi": some na primeira
 *   auditoria de verdade (ou quando a lista mostra que já houve uma);
 * - `ficha-da-obra`: por que conferir o nome da obra, na linha "Obra" da
 *   primeira ficha. Some no lápis ou no "Conferi — auditar".
 *
 * Guardadas no navegador (decisão D4): não há preferência por usuário no
 * banco, e um navegador novo mostrar as dicas de novo é um custo pequeno.
 * "Como funciona o Nexo" as traz de volta (`esquecerDicas`).
 */
import { useSyncExternalStore } from "react";

const IDS = [
  "processamento",
  "primeira-revisao",
  "atalhos",
  "tour-do-resultado",
  "volume-plano",
  "volume-canvas",
  "volume-entrega",
  "volume-teto",
  "memorial-de-exemplo",
  "ficha-da-obra",
] as const;
export type IdDaDica = (typeof IDS)[number];

const CHAVE = "nexo:dicas-vistas";
const ouvintes = new Set<() => void>();
let vistas: ReadonlySet<IdDaDica> | null = null;
const NENHUMA: ReadonlySet<IdDaDica> = new Set();
/** No servidor e antes de ler o navegador, nenhuma dica aparece: melhor calar do que piscar. */
const TODAS: ReadonlySet<IdDaDica> = new Set(IDS);

function ler(): ReadonlySet<IdDaDica> {
  if (vistas) return vistas;
  try {
    const cru = JSON.parse(window.localStorage.getItem(CHAVE) ?? "[]") as unknown;
    vistas = new Set(Array.isArray(cru) ? (cru.filter((x) => typeof x === "string") as IdDaDica[]) : []);
  } catch {
    // Sem armazenamento, nenhuma dica: ela voltaria a cada visita e viraria ruído.
    vistas = TODAS;
  }
  return vistas;
}

function gravar(proximas: ReadonlySet<IdDaDica>) {
  vistas = proximas;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify([...proximas]));
  } catch {
    // Vale só nesta aba.
  }
  for (const f of ouvintes) f();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Marca a dica como vista. Chamar mais de uma vez não faz nada. */
export function marcarDica(id: IdDaDica) {
  const atuais = ler();
  if (atuais.has(id)) return;
  gravar(new Set([...atuais, id]));
}

/**
 * "Como funciona o Nexo": as dicas voltam a aparecer, cada uma na hora dela.
 * Menos o passo a passo do resultado: o tour do Nexo abre um parecer de
 * exemplo, e o do resultado abriria por cima dele — dois balões brigando. Ele
 * tem o botão próprio no trilho.
 */
export function esquecerDicas() {
  gravar(ler().has("tour-do-resultado") ? new Set<IdDaDica>(["tour-do-resultado"]) : NENHUMA);
}

export function useDica(id: IdDaDica) {
  const atuais = useSyncExternalStore(assinar, ler, () => TODAS);
  return { mostrar: !atuais.has(id), fechar: () => marcarDica(id) };
}

/*
 * OS ATALHOS SÓ PARA QUEM JÁ ESTÁ RÁPIDO: a dica aparece depois de três achados
 * encerrados com o mouse nesta sessão. Quem já usa o teclado nunca a vê.
 */
let encerradosComMouse = 0;
const lerEncerrados = () => encerradosComMouse;

export function encerrouComMouse() {
  encerradosComMouse++;
  for (const f of ouvintes) f();
}

export function useEncerradosComMouse() {
  return useSyncExternalStore(assinar, lerEncerrados, () => 0);
}
