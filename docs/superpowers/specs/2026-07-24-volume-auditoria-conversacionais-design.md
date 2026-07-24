# Volume e auditoria conversacionais (item 2)

**Data:** 2026-07-24
**Escopo:** Tornar `volume` e `auditoria` funcionais NO CHAT (hoje read-only via
`DeferredConfirmation`). Destrava o item 3 (dissolver o SelosPanel). Sem tocar no
cérebro do agente nem nas rotas.

## Diagnóstico

O agente JÁ propõe `volume` e `auditoria` ([run-turn.ts](../../../server/nexo/agent/run-turn.ts))
e `normalizeProposals` já os passa (testes 11/11). O gargalo é só o
`ConfirmationCard`: os dois kinds caem em `DeferredConfirmation` (botão
desabilitado) porque os INPUTS não chegam ao card:
- **Volume** precisa dos bytes das partes: capa PDF + LD PDF (gerados na conversa)
  + as pranchas originais (`File[]`) com faixas de página.
- **Auditoria** precisa do MEMORIAL (arquivo novo, distinto das pranchas) +
  gabarito.

Hoje `readSelos` (NexoWorkspace) lê todo PDF como prancha e **descarta os
`File[]`**; e não há caminho para o memorial no chat.

## Design

### A. Partição determinística no anexo (NexoWorkspace)
`readSelos(list)` passa a partir os PDFs por `parseFilename(nome).tipo`:
- `memorial` → guarda `memorialFile` (o primeiro; permite trocar) + status
  "Memorial anexado: `<nome>`".
- resto → pranchas: lê selos (como hoje) **e retém `pranchaFiles: File[]`**.

Helper puro `isMemorialFile(fileName)` (reusa `parseFilename`) — mas para manter
o teste em node cru, a partição é testada por um núcleo import-free
`splitByRole(names, tipoOf)` que recebe o classificador injetado. (Alternativa
mais simples: testar `isMemorialFile` diretamente aceitando o custo de o teste
importar parse-filename — decidir na implementação; parse-filename tem imports
sem extensão, então o núcleo injetável é o caminho seguro.)

Ponto único: composer 📎 e drop global já caem em `readSelos`.

### B. Assembler compartilhado — `modules/nexo/lib/assemble-volume.ts`
Extrai a lógica de `SelosPanel.montarVolume`, parametrizada:
```ts
assembleVolume({
  selos,          // SeloForLd[] → faixas de página via resolveSheetNumbers
  pranchaFiles,   // File[] originais
  capaPdf64,      // base64 cru (dos object URLs do artifact-store)
  ldPdf64,        // base64 cru
  separatrizTitle // best-effort (postSeparatriz); falha → segue sem
}): Promise<VolumeGenResult>
```
Reusa `buildVolumeParts` (puro, testado) + `postVolume`. `urlToBase64(objectUrl)`
converte os PDFs do store em bytes sem duplicar binário no estado React (§2).

### C. Cards vivos (substituem DeferredConfirmation)
- **VolumeConfirmation**: lê o artifact-store (LD + capa desta conversa) +
  `pranchaFiles`. Pré-condições honestas: falta LD/capa PDF ou pranchas → botão
  desabilitado + frase. No clique, `assembleVolume` → registra artefato `volume`.
- **AuditoriaConfirmation**: usa `memorialFile` + gabarito `{ obra }`
  (`summarizeSelos(selos).obra`) + prefeitura best-effort (do rótulo "Capa X" do
  artefato de capa, se houver) + `nivel` do param → `postAudit`. Sem memorial →
  "Arraste o PDF do memorial." Mostra veredito + achados (como no painel).

### D. Fiação
`NexoWorkspace` → `NexoChat` → `ConfirmationCard`: novas props `pranchaFiles` e
`memorialFile`. O artifact-store o card já acessa (`useArtifactStore`).

## Fora de escopo
Multi-tomo no volume (o painel também monta 1 volume). Dissolver o SelosPanel
(item 3, na sequência). Prefeitura no gabarito é best-effort.

## Verificação
- Teste do núcleo de partição (memorial vs prancha).
- `tsc` + `eslint` verdes. Commit direto na main. E2E ao vivo pelo usuário
  (precisa OpenAI + LibreOffice p/ o PDF das partes).
