"use client";

/**
 * PRECISA DA SUA ATENÇÃO — três números, e nenhum cartão.
 *
 * A faixa fica entre a retomada e a lista, e responde a segunda pergunta de
 * quem entra ("o que está esperando por mim") antes de a pessoa ter que ler
 * oito linhas para descobrir. Hoje esse número existe — ele está espalhado em
 * oito chips que é preciso somar de cabeça.
 *
 * NÃO É UMA GRADE DE KPI, e a diferença não é de estilo. Um cartão de métrica
 * afirma "este número é o assunto"; aqui o assunto é a LISTA logo abaixo, e a
 * faixa é o índice dela. Por isso: uma linha, altura de texto, sem fundo, sem
 * caixa por número, e cada item é um CONTROLE — clicar filtra a lista. Um
 * número que não leva a lugar nenhum vira decoração no segundo dia.
 *
 * ELA CONTA O QUE ESTÁ ABAIXO, e não consulta nada. `contadoresDaAtencao`
 * recebe a mesma lista que a tela desenha, em [[lib/atencao-do-painel.ts]]. Uma
 * segunda fonte poderia dizer "3 achados" sobre uma lista que mostra dois, e a
 * faixa perderia a única coisa que a justifica.
 *
 * ZERADA, SOME INTEIRA. Um "0 achados com você" é a interface pedindo atenção
 * para dizer que não precisa de atenção — e ensina a não olhar para a linha no
 * dia em que ela tiver um número.
 */

import type { ContadorDaAtencao, FocoDaAtencao } from "@/lib/atencao-do-painel";
import { cn } from "@/lib/utils";

export function PrecisaDaSuaAtencao({
  contadores,
  foco,
  aoFocar,
}: {
  contadores: ContadorDaAtencao[];
  /** O filtro em vigor, ou nulo. Vem de cima: quem manda na lista é a lista. */
  foco: FocoDaAtencao | null;
  aoFocar: (foco: FocoDaAtencao | null) => void;
}) {
  if (contadores.length === 0) return null;

  return (
    <section aria-labelledby="atencao" className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <h2
        id="atencao"
        className="mr-0.5 shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        Precisa da sua atenção
      </h2>

      {contadores.map((c) => (
        <Contador
          key={c.foco}
          contador={c}
          ativo={foco === c.foco}
          // SEGUNDO CLIQUE DESLIGA. Sem isso, quem filtra por engano precisa
          // procurar o "limpar" — e o alvo mais óbvio para desfazer um filtro é
          // o controle que o ligou.
          aoClicar={() => aoFocar(foco === c.foco ? null : c.foco)}
        />
      ))}
    </section>
  );
}

/**
 * UM CONTADOR — número forte, palavra fraca, cor só no que é status.
 *
 * O número em `--foreground` e o rótulo em `--muted-foreground` na MESMA linha:
 * é o que faz "3" saltar sem precisar de fundo. Só `parados` recebe cor, porque
 * só ele é status (§2 — âmbar é atenção); "meus achados" e "da equipe" são
 * fatos, não severidades, e pintá-los faria a faixa inteira acender.
 *
 * A BORDA CHEGOU NA SEGUNDA RODADA, e ela é o conserto de um defeito real: sem
 * fundo e sem contorno, os três contadores liam como TEXTO — a interface tinha
 * três controles disfarçados de legenda, e a única forma de descobrir que
 * clicavam era passar o mouse por cima. Descobrir por hover é não descobrir: no
 * toque não há hover, e no desktop ninguém varre a tela com o cursor.
 *
 * Contorno em `--border` (a mesma linha estrutural de todo o produto) mais o
 * `py-1.5` que leva o alvo a 30px de altura. Continua sendo um chip, e não
 * virou botão: fundo transparente, peso de rótulo.
 *
 * O ESTADO ATIVO é o teal do sistema — filtro ligado é seleção, e seleção é
 * interativo. É a regra do acento único aplicada: o âmbar diz o que a coisa É,
 * o teal diz o que VOCÊ fez.
 */
function Contador({
  contador,
  ativo,
  aoClicar,
}: {
  contador: ContadorDaAtencao;
  ativo: boolean;
  aoClicar: () => void;
}) {
  const alerta = contador.foco === "parados";

  // O rótulo já vem montado com o número na frente ("3 achados com você"); a
  // tela separa os dois para dar pesos diferentes sem duplicar a regra do texto.
  const [numero, ...resto] = contador.rotulo.split(" ");

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      title={
        ativo
          ? "Clique para ver a lista inteira"
          : `Filtrar a lista: ${contador.rotulo} em ${contador.projetos} ${contador.projetos === 1 ? "projeto" : "projetos"}`
      }
      className={cn(
        "nx-cut-4 inline-flex shrink-0 cursor-pointer items-baseline gap-1.5 border px-2.5 py-1.5 text-left transition-colors duration-[var(--duration-fast)]",
        ativo
          ? "border-[var(--primary)] bg-[var(--secondary)]"
          : "border-border hover:border-[var(--nexodoc-raised)] hover:bg-[var(--nexodoc-raised)]",
      )}
    >
      <span
        className="font-mono text-[13.5px] font-semibold leading-none tabular-nums"
        style={{
          color: ativo
            ? "var(--nexodoc-accent)"
            : alerta
              ? "var(--status-warning)"
              : "var(--foreground)",
        }}
      >
        {numero}
      </span>
      <span
        className="text-[13px] leading-none"
        style={{ color: ativo ? "var(--nexodoc-accent)" : "var(--muted-foreground)" }}
      >
        {resto.join(" ")}
      </span>
    </button>
  );
}
