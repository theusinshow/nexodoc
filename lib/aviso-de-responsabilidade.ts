/**
 * O TEXTO DO AVISO DE RESPONSABILIDADE, em um lugar só.
 *
 * Mora aqui, sem nenhum import, porque três mundos diferentes o leem: o
 * componente da tela (`components/aviso-de-responsabilidade.tsx`), o parecer
 * em PDF (via `lib/parecer-em-papel.ts`, que roda em node cru nas provas) e a
 * página /termos. Copiar a frase para cada um deles é o jeito de o papel e a
 * tela passarem a dizer coisas diferentes — o repositório já pagou por verdade
 * duplicada.
 *
 * Mudou o texto? Revise com um advogado e considere subir `VERSAO_DOS_TERMOS`:
 * quem aceitou a versão anterior será consultado de novo antes da próxima
 * auditoria.
 */
export const AVISO_DE_RESPONSABILIDADE =
  "O NexoDoc é uma ferramenta de apoio à revisão. Não substitui a análise do responsável técnico, pode não identificar todas as inconsistências e não garante a conformidade do projeto. A verificação final, as correções e a responsabilidade técnica (ART/RRT) são de quem elabora e assina o projeto.";

/**
 * A versão do termo de uso que o aceite registra (`User.termsVersion`).
 * Formato AAAA-MM-DD da última alteração do texto de /termos.
 */
export const VERSAO_DOS_TERMOS = "2026-10-19";

export const ROTA_DOS_TERMOS = "/termos";
