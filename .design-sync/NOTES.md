# design-sync — notas do Nexo

Projeto: "Nexo — Design System" (`a0471125-6f92-44e0-b2cd-81a7696b3d25`),
https://claude.ai/design/p/a0471125-6f92-44e0-b2cd-81a7696b3d25. Primeira sync em 27/10/2026.

## Como este repositório foi encaixado

- **Não há pacote nem `dist/`**: o sistema `ds` mora dentro do app Next (`components/ds/`, `app/ds.css`).
  A entrada é `.design-sync/entrada.tsx`, que reexporta de `components/ds/basicos.tsx`. O PKG_DIR
  vira a raiz do repo (package.json "nexodoc"); `pkg: "nexo-ds"` / `globalName: "NexoDs"` são nomes do pacote enviado.
- **Escopo escolhido pelo usuário: "só o essencial"** — os 10 de `basicos.tsx` menos o `Orbe`, mais a `RaizDs`.
  Gráficos (`graficos.tsx`, `medidas.tsx`, `serie-com-meta.tsx`) e `micro.tsx` ficaram para uma próxima sync:
  para incluir, reexporte em `entrada.tsx`, acrescente em `componentSrcMap`/`dtsPropsFor`, escreva `docs/` e `previews/`.
- **`Orbe` ficou de fora**: aponta para `/marca/orbe-*.png` do app, que não existe no Claude Design.
  Incluir exige levar os PNGs junto (ex.: data URI) sem reimplementar o componente.
- **`RaizDs`** (`.design-sync/base/raiz-ds.tsx`) é a raiz `.ds` fora do Next: classe `ds` + `--font-ds-sans/mono`
  apontando para "Geist"/"Geist Mono". É o `cfg.provider`. Tem de ficar em `base/` — a pasta define o grupo.
- **Sem `.d.ts`**: os contratos de props estão à mão em `cfg.dtsPropsFor`. Mudou a assinatura em `basicos.tsx`? Atualize lá.
- **Categorias** vêm do frontmatter de `.design-sync/docs/<Name>.md` — use ASCII (acento vira `a-es`).
- `guidelinesGlob: ["DESIGN.md"]` — sem isso o conversor copia os ~34 `.md` de `docs/` para o projeto.
- Fontes: `.design-sync/fontes.css` declara as `@font-face` sobre `lib/ds/arquivos-de-fonte/*.woff2` (via `extraFonts`).
- Heredoc grande no bash do Windows quebrou ("unexpected EOF"): escreva as prévias com o editor, não com `cat <<EOF`.
- Playwright 1.61.1 do repo + chromium-1228 em `%LOCALAPPDATA%\ms-playwright` funcionam para o render check.

## Known render warns

- `[TOKENS_MISSING]` `--font-ds-sans`, `--font-ds-mono` (injetadas pela `RaizDs`), `--ds-orbe-parado` (Orbe fora), `--tom` (inline). Esperado.
- `[FONT_MISSING] "Cascadia Mono"`: é só a reserva do Windows na pilha `--ds-font-mono`, depois da Geist Mono, que vai junto. Aceito.

## Re-sync risks

- `dtsPropsFor` é cópia manual das assinaturas de `basicos.tsx`: pode envelhecer em silêncio.
- `.design-sync/docs/*.md` e `conventions.md` repetem regras da `DESIGN.md`: quando a DESIGN.md mudar, reconferir.
- `app/ds.css` vai inteiro como `cssEntry`; se ele passar a usar `url()` relativa, conferir `[FONT_DANGLING]`/assets.
- Grades são da máquina local (`.cache/`); a âncora durável é o `_ds_sync.json` no projeto.
