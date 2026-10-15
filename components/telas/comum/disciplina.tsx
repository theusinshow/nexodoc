import type { FindingDiscipline } from "@/lib/audit-report";
import { DISCIPLINAS } from "@/lib/nivel-do-achado";

const POR_ID = Object.fromEntries(DISCIPLINAS.map((d) => [d.id, d])) as Record<FindingDiscipline, (typeof DISCIPLINAS)[number]>;

/**
 * O SELO DA DISCIPLINA (veio do lab: resultado-e/disciplina.tsx): um ponto
 * quadrado e a sigla da prancha (ARQ, EST, HID…), na cor da disciplina.
 * Quadrado de propósito: o ponto redondo já é do nível do achado, e os dois
 * aparecem lado a lado. `neutro`: sigla cinza, quando a cor da tela é do nível.
 */
export function SeloDaDisciplina({ disc, nome, neutro }: { disc: FindingDiscipline; nome?: boolean; neutro?: boolean }) {
  const d = POR_ID[disc] ?? POR_ID.geral;
  return (
    <span className={`dc dc--${d.id}${nome ? " dc--nome" : ""}${neutro ? " dc--neutro" : ""}`} title={d.nome}>
      <i />
      {nome ? d.nome : d.sigla}
    </span>
  );
}

/**
 * A PRINCIPAL E AS ENVOLVIDAS (15/10/2026): um conflito entre o capítulo de
 * arquitetura e o de hidrossanitário é dos dois. A principal vem como sempre
 * (com nome, se pedido); as outras, só a sigla, com "+N" depois de `maximo`.
 */
export function SelosDasDisciplinas({ discs, nome, maximo = 2 }: { discs: readonly FindingDiscipline[]; nome?: boolean; maximo?: number }) {
  const [principal = "geral", ...outras] = discs;
  if (!outras.length) return <SeloDaDisciplina disc={principal} nome={nome} />;
  const vistas = outras.slice(0, maximo);
  const sobra = outras.slice(maximo);
  const nomes = outras.map((d) => (POR_ID[d] ?? POR_ID.geral).nome).join(", ");
  return (
    <span className="dc-varias" title={`Também envolve: ${nomes}`}>
      <SeloDaDisciplina disc={principal} nome={nome} />
      {vistas.map((d) => (
        <SeloDaDisciplina key={d} disc={d} />
      ))}
      {sobra.length > 0 && <span className="dc-mais ds-num">+{sobra.length}</span>}
    </span>
  );
}
