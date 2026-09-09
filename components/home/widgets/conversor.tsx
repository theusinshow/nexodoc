"use client";

/**
 * CONVERSOR DE OBRA — a calculadora que a calculadora não faz.
 *
 * Ele entrou no lugar de uma "calculadora" genérica, e o motivo é o critério da
 * seção: um widget precisa responder algo que hoje custa sair do produto. Somar
 * dois números não custa — todo sistema operacional tem calculadora a dois
 * atalhos. Já converter **1:12 de inclinação em graus**, ou saber quantos m²
 * são 2450 cm², é a conta que quem confere memorial faz o dia inteiro e vai
 * buscar num site com anúncio.
 *
 * QUATRO EIXOS, e os quatro aparecem em memorial de obra pública:
 *
 *  · COMPRIMENTO — m ↔ cm ↔ mm. O documento mistura as três na mesma página
 *    (esquadria em mm, pé-direito em m), e a divergência entre elas é achado
 *    comum;
 *  · ÁREA — m² ↔ cm² ↔ ha. O quantitativo vem em m², a especificação em cm², e
 *    o terreno em hectare;
 *  · VOLUME — m³ ↔ L. Concreto é orçado em m³ e dosado em litro, e a conversão
 *    de mil é onde some uma vírgula;
 *  · INCLINAÇÃO — % ↔ graus ↔ 1:X ↔ mm/m. A que não tem widget em lugar nenhum
 *    e a que mais aparece: rampa, telhado e caimento de piso vêm escritos em
 *    quatro notações diferentes no mesmo documento.
 *
 * MASSA FICOU DE FORA. kg ↔ t é uma vírgula de três casas, e ninguém abre um
 * widget para mover vírgula. O que seria útil de verdade — kg/m de perfil
 * metálico para peso total — depende de tabela de bitola, que é um dado do
 * produto e não uma conversão de unidade.
 *
 * NÃO GUARDA NADA e não conversa com o servidor. É aritmética, e por isso é o
 * widget mais barato da lista — nenhuma rota, nenhum estado persistido.
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { Casco } from "./casco";

type Eixo = "comprimento" | "area" | "volume" | "inclinacao";

type Ficha = {
  id: Eixo;
  /** O que vai na aba. Curto porque são quatro numa caixa de 300px. */
  aba: string;
  /** O que a pessoa digita, com a unidade — vira o rótulo abaixo do campo. */
  entrada: string;
  exemplo: string;
  /** As linhas do resultado, dado um valor válido. */
  saida: (v: number) => Linha[];
  /** As mesmas linhas, sem valor. Existe para a caixa não pular de altura. */
  vazio: string[];
};

type Linha = { unidade: string; texto: string };

export function WidgetConversor() {
  const [eixo, setEixo] = React.useState<Eixo>("comprimento");
  const [bruto, setBruto] = React.useState("");

  /*
   * VÍRGULA E PONTO, os dois. Quem digita "1,5" em teclado brasileiro está
   * certo, e `Number("1,5")` é `NaN` — o campo ficaria mudo sem dizer por quê.
   * O separador de milhar NÃO é aceito de propósito: "1.500" é ambíguo entre
   * mil e quinhentos e um e meio, e adivinhar num conversor de obra é pior que
   * recusar.
   */
  const valor = Number(bruto.replace(",", "."));
  const valido = bruto.trim() !== "" && Number.isFinite(valor);

  const ficha = EIXOS.find((e) => e.id === eixo)!;
  const linhas: Linha[] = valido
    ? ficha.saida(valor)
    : ficha.vazio.map((unidade) => ({ unidade, texto: "—" }));

  return (
    <Casco titulo="Conversor de obra">
      {/*
        AS ABAS VIRARAM UM CONTROLE SEGMENTADO, e saíram do cabeçalho.

        Eram quatro botões de 10,5px no `acessorio` do casco — a mesma fileira
        em que os outros widgets põem um carimbo de estado. Três problemas de
        uma vez: alvo de 18px, nenhuma superfície dizendo que eram um grupo, e
        a aba ativa distinguindo-se só pela cor do texto.

        Agora é o mesmo segmentado da lista de projetos: fundo `--nexodoc-recessed`
        (a superfície que a DESIGN.md destina a controle embutido), 28px de alvo,
        e a seleção com fundo próprio. Uma forma a menos para aprender na tela.
      */}
      <div
        role="tablist"
        aria-label="O que converter"
        className="nx-cut-5 flex items-center gap-0.5 bg-[var(--nexodoc-recessed)] p-0.5"
      >
        {EIXOS.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={eixo === e.id}
            onClick={() => setEixo(e.id)}
            className={cn(
              "nx-cut-4 flex-1 cursor-pointer px-1.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors duration-[var(--duration-fast)]",
              eixo === e.id
                ? "bg-[var(--secondary)] text-[var(--nexodoc-accent)]"
                : "text-muted-foreground hover:bg-[var(--nexodoc-raised)] hover:text-foreground",
            )}
          >
            {e.aba}
          </button>
        ))}
      </div>

      {/*
        O RÓTULO SUBIU para cima do campo. Ele ficava embaixo, e um campo com a
        unidade só embaixo obriga a digitar antes de saber em que unidade se
        digita — a ordem de leitura desmentia a ordem de uso.
      */}
      <label className="mt-3 block">
        <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          {ficha.entrada}
        </span>
        <input
          value={bruto}
          onChange={(ev) => setBruto(ev.target.value)}
          inputMode="decimal"
          placeholder={ficha.exemplo}
          className="nx-cut-5 w-full bg-[var(--nexodoc-recessed)] px-3 py-2 font-mono text-[14px] tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
        />
      </label>

      {/*
        O RESULTADO NUM BLOCO PRÓPRIO, com um fio acima. Ele era uma `<dl>`
        solta logo abaixo do campo, e a 12px de distância entrada e saída liam
        como duas linhas do mesmo formulário. O fio é o sinal de igual.
      */}
      <dl className="m-0 mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 border-t border-border pt-2.5">
        {linhas.map((linha) => (
          <React.Fragment key={linha.unidade}>
            <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              {linha.unidade}
            </dt>
            <dd
              className="m-0 truncate font-mono text-[14px] tabular-nums"
              style={{ color: valido ? "var(--foreground)" : "var(--muted-foreground)" }}
            >
              {linha.texto}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </Casco>
  );
}

const EIXOS: Ficha[] = [
  {
    id: "comprimento",
    aba: "compr.",
    entrada: "valor em metros",
    exemplo: "2,80",
    vazio: ["cm", "mm"],
    saida: (v) => [
      { unidade: "cm", texto: num(v * 100) },
      { unidade: "mm", texto: num(v * 1000) },
    ],
  },
  {
    id: "area",
    aba: "área",
    entrada: "valor em m²",
    exemplo: "12,5",
    vazio: ["cm²", "ha"],
    saida: (v) => [
      { unidade: "cm²", texto: num(v * 10_000) },
      { unidade: "ha", texto: num(v / 10_000, 4) },
    ],
  },
  {
    id: "volume",
    aba: "vol.",
    entrada: "valor em m³",
    exemplo: "0,45",
    vazio: ["litros", "cm³"],
    saida: (v) => [
      { unidade: "litros", texto: num(v * 1000) },
      { unidade: "cm³", texto: num(v * 1_000_000, 0) },
    ],
  },
  {
    id: "inclinacao",
    aba: "incl.",
    entrada: "inclinação em %",
    exemplo: "8,33",
    vazio: ["graus", "proporção", "mm/m"],
    /*
     * A INCLINAÇÃO é a única com armadilha. Porcentagem NÃO é grau: 100% é 45°,
     * e não 90°. `atan(p/100)` é a conversão certa, e é a que a régua de bolso
     * ("cada 1% ≈ 0,57°") aproxima mal a partir de 15%.
     *
     * A PROPORÇÃO 1:X é a notação de projeto ("rampa 1:12"), e ela INVERTE:
     * 8,33% é 1:12, e quanto menor a porcentagem, maior o x. Zero não tem
     * proporção — dividir por zero daria `Infinity`, que a tela imprimiria como
     * "1:∞".
     *
     * MM/M é a notação de caimento de piso e calha, e é a mais simples das
     * quatro: 1% é 10 mm por metro, e ponto. Ela entrou porque é a que aparece
     * escrita no memorial de hidráulica, e traduzi-la de cabeça para % é onde a
     * conferência erra.
     */
    saida: (v) => [
      { unidade: "graus", texto: `${num((Math.atan(v / 100) * 180) / Math.PI, 2)}°` },
      { unidade: "proporção", texto: v === 0 ? "plano" : `1:${num(100 / Math.abs(v), 2)}` },
      { unidade: "mm/m", texto: num(v * 10, 1) },
    ],
  },
];

/** Até `casas` decimais, sem zero à toa: 2800 e não 2800,00. */
function num(valor: number, casas = 2) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}
