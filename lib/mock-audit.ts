import type { AuditMode } from "@/lib/audit-mode";

const MOCK_FAST_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026

2. Status geral
com incongruência relevante

3. Memorial
O memorial apresenta identificação principal compatível com a obra, mas contém referência residual a bairro divergente.

4. Pranchas
As pranchas indicam a mesma obra, porém o selo da prancha A-02 apresenta código de projeto divergente.

5. Incongruências relevantes encontradas
Achado 1: Bairro divergente
Documento: Memorial.pdf
Página provável: 3
Local: identificação inicial do memorial
Evidência: bairro informado no memorial diverge da identificação principal da obra
Conflito: capa indica Bairro Centro, memorial cita Bairro Jardim Modelo
Ação recomendada: revisar o trecho de identificação do memorial

Achado 2: Código do projeto divergente
Documento: Pranchas.pdf
Página provável: 12
Local: selo/carimbo da prancha A-02
Evidência: código do projeto no selo não coincide com o memorial
Conflito: memorial indica NX-001/2026, selo indica NX-009/2025
Ação recomendada: revisar o código no selo da prancha A-02

6. Conclusão objetiva
conjunto com incongruência relevante e necessidade de revisão
`.trim();

const MOCK_COMPLETE_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026

2. Status geral
com incongruência relevante

3. Memorial
O memorial identifica a obra como Escola Municipal Exemplo e informa o município de referência. Há, porém, menção residual a bairro divergente em trecho de identificação documental, indicando provável reaproveitamento parcial de texto.

4. Pranchas
As pranchas apresentam identificação geral compatível com a obra, mas o selo da prancha A-02 contém código de projeto divergente do memorial. A capa e a lista de desenhos devem ser conferidas para confirmar qual código deve prevalecer.

5. Incongruências relevantes encontradas
Achado 1: Bairro divergente no memorial
Documento: Memorial.pdf
Página provável: 3
Local: identificação inicial do memorial
Evidência: o memorial cita bairro diferente do indicado na capa e na identificação principal
Conflito: capa indica Bairro Centro, memorial cita Bairro Jardim Modelo
Ação recomendada: revisar o trecho de identificação do memorial e confirmar o bairro correto

Achado 2: Código do projeto divergente em prancha
Documento: Pranchas.pdf
Página provável: 12
Local: selo/carimbo da prancha A-02
Evidência: o selo da prancha A-02 apresenta código de projeto diferente do memorial
Conflito: memorial indica NX-001/2026, selo indica NX-009/2025
Ação recomendada: revisar o código no selo da prancha A-02 e alinhar com a capa/lista de desenhos

Achado 3: Indício de reaproveitamento de identificação
Documento: Pranchas.pdf
Página provável: 12
Local: selo/carimbo
Evidência: combinação de código divergente e referência residual sugere reaproveitamento de identificação
Conflito: identificação do selo não corresponde integralmente ao conjunto analisado
Ação recomendada: conferir se a prancha pertence ao mesmo projeto antes da emissão

6. Conclusão objetiva
conjunto com incongruência relevante e necessidade de revisão
`.trim();

export function getMockAuditResult(mode: AuditMode) {
  return mode === "complete"
    ? MOCK_COMPLETE_AUDIT_RESULT
    : MOCK_FAST_AUDIT_RESULT;
}

export function isMockModeEnabled() {
  return process.env.NEXODOC_MOCK_MODE === "true";
}

export async function waitForMockAudit() {
  const delay = Number(process.env.NEXODOC_MOCK_DELAY_MS ?? 3500);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
