import type { AuditMode } from "@/lib/audit-mode";

const DEMO_MEMORIAL_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026
Endereço: Rua das Acácias, 120
Bairro: Centro
Município: Município Exemplo
Órgão/cliente: Secretaria Municipal de Educação

2. Status geral
com inconsistências críticas

3. Arquivos analisados
- Memorial descritivo.pdf | Tipo: memorial

4. Análise por arquivo
Arquivo: Memorial descritivo.pdf
Tipo: memorial
Resumo: o memorial identifica a obra principal, mas contém referência residual a outro bairro no corpo do texto.
Pontos de atenção: conferir trecho de identificação inicial e histórico de revisões.

5. Comparações entre arquivos
- Não houve comparação LD x pranchas neste modo. A leitura foi focada na coerência interna do memorial.

6. Achados encontrados
Achado 1: Endereço divergente no memorial
Documento: Memorial descritivo.pdf
Página provável: 2
Local: item de identificação da obra
Evidência: o corpo do memorial cita Rua Bento Góia, Bairro Jardim Modelo
Termo de busca: Rua Bento Góia
Conflito: a capa e a identificação principal indicam Rua das Acácias, Bairro Centro
Ação recomendada: corrigir endereço e bairro em todos os campos de identificação antes da emissão
Categoria: identidade/localização
Referência comparada: capa do memorial x item de identificação

Achado 2: Norma citada sem confirmação de aplicabilidade
Documento: Memorial descritivo.pdf
Página provável: 9
Local: critérios técnicos
Evidência: o texto cita atendimento ao Manual Municipal de Resíduos sem identificar versão ou município
Termo de busca: Manual Municipal de Resíduos
Conflito: a referência técnica precisa ser confirmada para o município correto do projeto
Ação recomendada: confirmar a norma/manual aplicável e registrar a versão correta
Categoria: revisão técnica
Referência comparada: critérios técnicos x município do projeto

7. Conclusão objetiva
memorial com inconsistência crítica de endereço e ponto de revisão técnica
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
com inconsistências críticas

3. Arquivos analisados
- Capa e separatriz.pdf | Tipo: capa/separatriz
- LD arquitetura.pdf | Tipo: LD
- Pranchas arquitetura.pdf | Tipo: pranchas

4. Análise por arquivo
Arquivo: Capa e separatriz.pdf
Tipo: capa
Resumo: capa identifica o volume como Arquitetura, código NX-001/2026.
Pontos de atenção: nenhum

Arquivo: LD arquitetura.pdf
Tipo: LD
Resumo: LD lista pranchas A-01, A-02 e A-03 com revisão R01.
Pontos de atenção: conferir correspondência dos títulos.

Arquivo: Pranchas arquitetura.pdf
Tipo: pranchas
Resumo: selos das pranchas indicam o mesmo projeto, mas há divergência de título e revisão.
Pontos de atenção: prancha E-01 parece pertencer a disciplina fora do volume.

5. Comparações entre arquivos
- LD item A-02 x selo da prancha A-02: título divergente.
- LD item A-03 x selo da prancha A-03: revisão divergente.
- Capa do volume x selo da prancha E-01: disciplina divergente.

6. Achados encontrados
Achado 1: Prancha listada na LD não corresponde ao PDF anexado
Documento: LD arquitetura.pdf
Página provável: 2
Local: LD
Evidência: LD lista a prancha A-02 como "Planta baixa - bloco administrativo"
Termo de busca: Planta baixa - bloco administrativo
Conflito: o selo da prancha A-02 apresenta título "Cortes e Fachadas"
Ação recomendada: conferir se a prancha A-02 correta foi anexada ao volume
Categoria: LD x prancha
Referência comparada: LD item A-02 x selo da prancha A-02

Achado 2: Revisão do selo divergente da LD
Documento: Pranchas arquitetura.pdf
Página provável: 12
Local: selo/carimbo da prancha A-03
Evidência: selo da prancha A-03 indica revisão R02
Termo de busca: revisão R02
Conflito: LD indica revisão R01 para a prancha A-03
Ação recomendada: alinhar a revisão da prancha A-03 com a LD antes da emissão
Categoria: selo x LD
Referência comparada: selo da prancha A-03 x LD item A-03

Achado 3: Prancha fora do volume
Documento: Pranchas arquitetura.pdf
Página provável: 18
Local: selo/carimbo da prancha E-01
Evidência: prancha E-01 indica disciplina Estrutural
Termo de busca: disciplina Estrutural
Conflito: capa e LD indicam volume de Arquitetura
Ação recomendada: verificar se a prancha E-01 deve compor outro volume
Categoria: estrutura do volume
Referência comparada: capa do volume x selo da prancha E-01

7. Conclusão objetiva
volume com inconsistências críticas entre LD, selos e estrutura documental
`.trim();

export function getDemoAuditResult(mode: AuditMode) {
  return mode === "volume" ? DEMO_VOLUME_AUDIT_RESULT : DEMO_MEMORIAL_AUDIT_RESULT;
}
