# Dissolver o SelosPanel (item 3)

**Data:** 2026-07-24
**Escopo:** Remover o SelosPanel (redundante com o chat após o item 2) e isolar o
intake de projeto inteiro num `NexoDebugDrawer` atrás da flag dev. Sem mudança de
comportamento no chat.

## Contexto

Com o item 2 (volume/auditoria conversacionais), o chat cobre toda a GERAÇÃO
(LD/capa/conferência/volume/auditoria). O `SelosPanel` (dentro do drawer
`NEXT_PUBLIC_NEXO_DEBUG`) era o único caminho funcional desses fluxos — agora é
redundante e ainda DUPLICA a lógica (tem seu próprio gerarLd/gerarCapa/conferir/
montarVolume/auditarMemorial).

Decisão do usuário: **manter o intake como drawer dev enxuto** (o intake de
projeto inteiro — Anexar pasta → Dossiê + Estrutura por volume — não é
conversacional e é a única visão de projeto inteiro).

## Mudanças

### Remover de `NexoWorkspace.tsx`
- A função `SelosPanel` inteira (~890 linhas) e helpers exclusivos:
  `resolveReadFolhas`, `fileToBase64` local, interfaces locais
  `LdGenResult`/`CapaGenResult`/`NexoTemplateOption`, `auditVerdictVariant`.
- Imports que ficam órfãos após a remoção (limpeza guiada por eslint).

### Extrair `modules/nexo/components/NexoDebugDrawer.tsx`
Componente dev-only com o intake completo: Entrada (Anexar PDFs/pasta), Dossiê
detectado, Estrutura por volume. Leva junto `FileChips`, `DossieRow`,
`formatBytes`, `CONFIANCA_BADGE`.

Props (dados + callbacks; os `<input type=file>` escondidos ficam no
NexoWorkspace, compartilhados):
```ts
{
  files: File[];
  folderCount: number;
  dossie: NexoDossieDraft | null;
  loading: boolean;
  error: string | null;
  onPickFiles: () => void;   // dispara o input de PDFs
  onPickFolder: () => void;  // dispara o input de pasta
  onRemoveFile: (index: number) => void;
}
```

### `NexoWorkspace.tsx`
Mantém estado + inputs escondidos + handlers; renderiza
`{DEBUG && <NexoDebugDrawer ... />}`. Encolhe de ~1525 → ~350 linhas.

## Fora de escopo
Surfacing não-dev da estrutura por volume (fica dev). Item 4 (persistência/
histórico). Refatoração visual do chat (vem depois, pedido do usuário).

## Verificação
- `tsc` + `eslint` verdes; suíte Nexo passa.
- Intake segue funcionando com `NEXT_PUBLIC_NEXO_DEBUG=1`.
- Commit direto na main.
