"use client";

/**
 * CONVERSOR DE OBRA — a calculadora que a calculadora não faz.
 *
 * Ele entrou no lugar de uma "calculadora" genérica, e o motivo é o critério da
 * seção: um widget precisa responder algo que hoje custa sair do produto. Somar
 * dois números não custa — todo sistema operacional tem calculadora a dois
 * atalhos. Já converter **1:12 de inclinação em graus**, ou saber quantos m² são
 * 2450 cm², é o tipo de conta que quem confere memorial faz o dia inteiro e vai
 * buscar num site com anúncio.
 *
 * TRÊS EIXOS, e só os três que aparecem em memorial:
 *
 *  · COMPRIMENTO — mm ↔ cm ↔ m. O memorial mistura as três unidades na mesma
 *    página (esquadria em mm, pé-direito em m), e a divergência entre elas é
 *    achado comum;
 *  · ÁREA — cm² ↔ m². O quantitativo vem em m² e a especificação em cm²;
 *  · INCLINAÇÃO — % ↔ graus ↔ proporção (1:x). É a que não tem widget em lugar
 *    nenhum, e a que mais aparece: rampa, telhado e caimento de piso são
 *    escritos em três notações diferentes no mesmo documento.
 *
 * NÃO GUARDA NADA e não conversa com o servidor. É aritmética, e por isso é o
 * widget mais barato da lista — nenhuma rota, nenhum estado persistido.
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { Casco } from "./casco";

type Eixo = "comprimento" | "area" | "inclinacao";

const EIXOS: { id: Eixo; rotulo: string }[] = [
  { id: "comprimento", rotulo: "mm/m" },
  { id: "area", rotulo: "área" },
  { id: "inclinacao", rotulo: "incl." },
];

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

  return (
    <Casco
      titulo="Conversor"
      acessorio={
        <div className="flex items-center gap-1">
          {EIXOS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEixo(e.id)}
              aria-pressed={eixo === e.id}
              className={cn(
                "nx-cut-4 px-1.5 py-0.5 font-mono text-[10.5px] transition-colors duration-[var(--duration-fast)]",
                eixo === e.id
                  ? "bg-[var(--secondary)] text-[var(--nexodoc-accent)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {e.rotulo}
            </button>
          ))}
        </div>
      }
    >
      <input
        value={bruto}
        onChange={(ev) => setBruto(ev.target.value)}
        inputMode="decimal"
        placeholder={ENTRADA[eixo].exemplo}
        aria-label={ENTRADA[eixo].rotulo}
        className="nx-cut-5 w-full bg-[var(--nexodoc-recessed)] px-3 py-2 font-mono text-[13px] tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
      />

      <p className="m-0 mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {ENTRADA[eixo].rotulo}
      </p>

      <dl className="m-0 mt-2.5 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
        {(valido ? converter(eixo, valor) : ENTRADA[eixo].vazio).map((linha) => (
          <React.Fragment key={linha.unidade}>
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
              {linha.unidade}
            </dt>
            <dd className="m-0 truncate font-mono text-[13px] tabular-nums text-foreground">
              {linha.texto}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </Casco>
  );
}

const ENTRADA: Record<Eixo, { rotulo: string; exemplo: string; vazio: Linha[] }> = {
  comprimento: {
    rotulo: "valor em metros",
    exemplo: "2,80",
    vazio: [
      { unidade: "mm", texto: "—" },
      { unidade: "cm", texto: "—" },
    ],
  },
  area: {
    rotulo: "valor em m²",
    exemplo: "12,5",
    vazio: [
      { unidade: "cm²", texto: "—" },
      { unidade: "ha", texto: "—" },
    ],
  },
  inclinacao: {
    rotulo: "inclinação em %",
    exemplo: "8,33",
    vazio: [
      { unidade: "graus", texto: "—" },
      { unidade: "proporção", texto: "—" },
    ],
  },
};

type Linha = { unidade: string; texto: string };

function converter(eixo: Eixo, valor: number): Linha[] {
  if (eixo === "comprimento") {
    return [
      { unidade: "mm", texto: num(valor * 1000) },
      { unidade: "cm", texto: num(valor * 100) },
    ];
  }

  if (eixo === "area") {
    return [
      { unidade: "cm²", texto: num(valor * 10_000) },
      { unidade: "ha", texto: num(valor / 10_000, 4) },
    ];
  }

  /*
   * A INCLINAÇÃO é a única com armadilha. Porcentagem NÃO é grau: 100% é 45°,
   * e não 90°. `atan(p/100)` é a conversão certa, e é a que a régua de bolso
   * ("cada 1% ≈ 0,57°") aproxima mal a partir de 15%.
   *
   * A proporção 1:x é a notação de projeto ("rampa 1:12"), e ela INVERTE: 8,33%
   * é 1:12, e quanto menor a porcentagem, maior o x. Zero não tem proporção —
   * dividir por zero daria `Infinity`, que a tela imprimiria como "1:∞".
   */
  const graus = (Math.atan(valor / 100) * 180) / Math.PI;

  return [
    { unidade: "graus", texto: `${num(graus, 2)}°` },
    {
      unidade: "proporção",
      texto: valor === 0 ? "plano" : `1:${num(100 / Math.abs(valor), 2)}`,
    },
  ];
}

/** Até `casas` decimais, sem zero à toa: 2800 e não 2800,00. */
function num(valor: number, casas = 2) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}
