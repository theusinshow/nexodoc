# Calibração de gravidade — design

17/09/2026. Aprovado na conversa com o Matheus, a partir do benchmark
`docs/benchmarks/027-24/comparacao-2026-09-17.md`.

## O defeito

No 027-24 o topo do parecer ("bloqueia a emissão") tinha um falso positivo e um
arredondamento (2.269,34 × 2.269,36 m³), enquanto os dois achados que o benchmark põe no
topo — hierarquia documental contraditória (p.17 × p.21) e caixa de gordura (N=471 ×
V=2×75+20) — ficaram em "exige decisão técnica".

## Causas (conferidas no código)

1. **Duas definições de faixa na mesma chamada.** A validação manda como `instructions` o
   prompt do auditor ("duas ordens opostas de prevalência" e "erro aritmético" = crítico) e
   como `input` o prompt de validação, que diz "crítico = somente troca real de obra…;
   norma/cálculo/hierarquia = técnico" e autoriza rebaixar. O prompt dos blocos do Profundo
   (`route.ts`) tem uma terceira versão, abreviada.
2. **Achado de regra é rebaixável.** `validateFindingsWithModel` protege achado de regra de
   REMOÇÃO, mas aceita o `impacto` da decisão. A regra da hierarquia emite crítico (decisão
   de 12/08/2026) e saiu técnico.
3. **Conta errada sem nome.** Nenhuma definição diz que valor adotado ≠ valor usado na
   própria fórmula é erro aritmético; a IA chamou de "premissa não rastreável" (técnico).
4. **Aritmética sem tolerância.** "Erro aritmético = crítico" pega diferença de 0,02 m³.

## Decisões

1. **Uma definição só**, em `lib/faixas-de-impacto.ts` (puro), usada pelo prompt do
   auditor, pelo da validação e pelo dos blocos. Ela acrescenta:
   - valor adotado incompatível com o usado na própria fórmula é erro aritmético (crítico);
   - resíduo genérico de modelo que não identifica outra obra ("número do apartamento" num
     projeto sem apartamentos) é **técnico** — decisão do Matheus; crítico continua sendo
     nome, código, endereço ou município de outro empreendimento;
   - diferença de conta que cabe no arredondamento dos valores impressos é editorial.
2. **Regra mantém a faixa.** A validação não muda o `impacto` de achado de regra nem de
   guarda; quando pede outra faixa, vira contestação registrada (mesmo mecanismo da
   remoção). A lógica sai de `route.ts` para `lib/decisao-da-validacao.ts`, testável.
3. **Arredondamento é determinístico.** `lib/arredondamento.ts`: achado de conta com
   exatamente dois valores decimais de mesma precisão, diferença > 0, até 5 unidades da
   última casa e até 0,1% do maior, desce para `revisao_editorial` antes da matriz de
   severidade, com o motivo escrito no `conflito` e no `severity_reason`. Nada é removido
   (regra de 12/08: reportar tudo, classificar por consequência).

## Fora do escopo

Dedupe regra × IA (INC-022/033, INC-044/045); o "terceira etapa" não detectado; o casador
de `recall-vs-benchmark.ts` que errou para mais.

## Provas

- Sem token: teste de deriva dos três prompts contra a definição única; teste da decisão da
  validação com o INC-007 real; teste do arredondamento com INC-002 (desce), INC-017, INC-006
  e INC-008 (não descem).
- Com token (aprovado, ~US$ 0,56): auditoria nova do 027-24, comparada com o benchmark.
