import type { AuditMode } from "@/lib/audit-mode";

const DEMO_MEMORIAL_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026
Endereco: Rua das Acacias, 120
Bairro: Centro
Municipio: Municipio Exemplo
Orgao/cliente: Secretaria Municipal de Educacao

2. Status geral
com incongruencia relevante

3. Arquivos analisados
- Memorial descritivo.pdf | Tipo: memorial

4. Analise por arquivo
Arquivo: Memorial descritivo.pdf
Tipo: memorial
Resumo: o memorial identifica a obra principal, mas contem referencia residual a outro bairro no corpo do texto.
Pontos de atencao: conferir trecho de identificacao inicial e historico de revisoes.

5. Comparacoes entre arquivos
- Nao houve comparacao LD x pranchas neste modo. A leitura foi focada na coerencia interna do memorial.

6. Incongruencias relevantes encontradas
Achado 1: Bairro divergente no memorial
Documento: Memorial descritivo.pdf
Pagina provavel: 3
Local: identificacao inicial do memorial
Evidencia: o corpo do memorial cita Bairro Jardim Modelo
Conflito: a identificacao principal indica Bairro Centro
Acao recomendada: revisar o trecho de identificacao e confirmar o bairro correto
Categoria: memorial interno
Referencia comparada: identificacao principal x corpo do memorial

7. Conclusao objetiva
memorial com incongruencia relevante e necessidade de revisao textual
`.trim();

const DEMO_VOLUME_AUDIT_RESULT = `
1. Projeto analisado
Obra: Escola Municipal Exemplo
Projeto: NX-001/2026
Endereco: Rua das Acacias, 120
Bairro: Centro
Municipio: Municipio Exemplo
Orgao/cliente: Secretaria Municipal de Educacao
Volume/Tomo/Disciplina: Volume unico / Arquitetura

2. Status geral
com incongruencia relevante

3. Arquivos analisados
- Capa e separatriz.pdf | Tipo: capa/separatriz
- LD arquitetura.pdf | Tipo: LD
- Pranchas arquitetura.pdf | Tipo: pranchas

4. Analise por arquivo
Arquivo: Capa e separatriz.pdf
Tipo: capa
Resumo: capa identifica o volume como Arquitetura, codigo NX-001/2026.
Pontos de atencao: nenhum

Arquivo: LD arquitetura.pdf
Tipo: LD
Resumo: LD lista pranchas A-01, A-02 e A-03 com revisao R01.
Pontos de atencao: conferir correspondencia dos titulos.

Arquivo: Pranchas arquitetura.pdf
Tipo: pranchas
Resumo: selos das pranchas indicam o mesmo projeto, mas ha divergencia de titulo e revisao.
Pontos de atencao: prancha E-01 parece pertencer a disciplina fora do volume.

5. Comparacoes entre arquivos
- LD item A-02 x selo da prancha A-02: titulo divergente.
- LD item A-03 x selo da prancha A-03: revisao divergente.
- Capa do volume x selo da prancha E-01: disciplina divergente.

6. Incongruencias relevantes encontradas
Achado 1: Prancha listada na LD nao corresponde ao PDF anexado
Documento: LD arquitetura.pdf
Pagina provavel: 2
Local: LD
Evidencia: LD lista a prancha A-02 como "Planta baixa - bloco administrativo"
Conflito: o selo da prancha A-02 apresenta titulo "Cortes e Fachadas"
Acao recomendada: conferir se a prancha A-02 correta foi anexada ao volume
Categoria: LD x prancha
Referencia comparada: LD item A-02 x selo da prancha A-02

Achado 2: Revisao do selo divergente da LD
Documento: Pranchas arquitetura.pdf
Pagina provavel: 12
Local: selo/carimbo da prancha A-03
Evidencia: selo da prancha A-03 indica revisao R02
Conflito: LD indica revisao R01 para a prancha A-03
Acao recomendada: alinhar a revisao da prancha A-03 com a LD antes da emissao
Categoria: selo x LD
Referencia comparada: selo da prancha A-03 x LD item A-03

Achado 3: Prancha fora do volume
Documento: Pranchas arquitetura.pdf
Pagina provavel: 18
Local: selo/carimbo da prancha E-01
Evidencia: prancha E-01 indica disciplina Estrutural
Conflito: capa e LD indicam volume de Arquitetura
Acao recomendada: verificar se a prancha E-01 deve compor outro volume
Categoria: estrutura do volume
Referencia comparada: capa do volume x selo da prancha E-01

7. Conclusao objetiva
volume com incongruencia relevante entre LD, selos e estrutura documental
`.trim();

export function getDemoAuditResult(mode: AuditMode) {
  return mode === "volume" ? DEMO_VOLUME_AUDIT_RESULT : DEMO_MEMORIAL_AUDIT_RESULT;
}
