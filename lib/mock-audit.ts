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
- Memorial: referência a bairro diferente do indicado na identificação principal.
- Prancha A-02: código do projeto divergente do memorial.

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
- Memorial: referência a bairro diferente do indicado na identificação principal da obra.
- Prancha A-02: código do projeto divergente do código indicado no memorial.
- Selo/carimbo: indício de reaproveitamento de identificação de outro projeto.

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
