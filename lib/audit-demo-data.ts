import type { AuditMode } from "@/lib/audit-mode";

const DEMO_FAST_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026
Endereço: Rua das Acácias, 120
Bairro: Centro
Município: Município Exemplo
Órgão/cliente: Secretaria Municipal de Educação

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

const DEMO_COMPLETE_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026
Endereço: Rua das Acácias, 120
Bairro: Centro
Município: Município Exemplo
Órgão/cliente: Secretaria Municipal de Educação
Volume/Tomo/Disciplina: Volume único / Arquitetura

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

const DEMO_VOLUME_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026
Endereço: Rua das Acácias, 120
Bairro: Centro
Município: Município Exemplo
Órgão/cliente: Secretaria Municipal de Educação
Volume/Tomo/Disciplina: Volume único / Arquitetura

2. Status geral
com incongruência relevante

3. Memorial
O memorial está compatível com a identificação principal da capa, mas deve ser usado como referência para confirmar código, bairro e município nas pranchas.

4. Pranchas
O conjunto de pranchas apresenta divergências entre a lista de desenhos, os selos/carimbos e a numeração indicada nas folhas. Há indício de prancha fora da sequência do volume e revisão divergente entre LD e selo.

5. Incongruências relevantes encontradas
Achado 1: Prancha listada na LD não corresponde ao PDF anexado
Documento: Lista de Desenhos.pdf
Página provável: 2
Local: lista de desenhos
Evidência: LD lista a prancha A-02 como "Planta baixa - bloco administrativo"
Conflito: o PDF anexado com identificação A-02 apresenta título "Cortes e Fachadas"
Ação recomendada: conferir se a prancha A-02 correta foi anexada ao volume
Categoria: LD x prancha
Referência comparada: LD item A-02 x selo da prancha A-02

Achado 2: Revisão do selo divergente da lista de desenhos
Documento: Pranchas.pdf
Página provável: 12
Local: selo/carimbo da prancha A-03
Evidência: selo da prancha A-03 indica revisão R02
Conflito: lista de desenhos indica revisão R01 para a prancha A-03
Ação recomendada: alinhar a revisão da prancha A-03 com a LD antes da emissão
Categoria: selo x LD
Referência comparada: selo da prancha A-03 x LD item A-03

Achado 3: Indício de prancha fora do volume
Documento: Pranchas.pdf
Página provável: 18
Local: selo/carimbo da prancha E-01
Evidência: prancha E-01 indica disciplina Estrutural, mas o volume está identificado como Arquitetura
Conflito: capa e LD indicam volume de Arquitetura, enquanto a prancha E-01 pertence a outra disciplina
Ação recomendada: verificar se a prancha E-01 deve compor outro volume ou se a LD/capa precisam ser atualizadas
Categoria: estrutura do volume
Referência comparada: capa do volume x selo da prancha E-01

6. Conclusão objetiva
volume com incongruência relevante entre LD, selos e estrutura documental
`.trim();

export function getDemoAuditResult(mode: AuditMode) {
  if (mode === "volume") {
    return DEMO_VOLUME_AUDIT_RESULT;
  }

  return mode === "complete" ? DEMO_COMPLETE_AUDIT_RESULT : DEMO_FAST_AUDIT_RESULT;
}
