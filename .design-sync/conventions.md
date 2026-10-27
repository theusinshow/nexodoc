# Nexo — sistema `ds` (leia antes de desenhar)

Interface escura, quieta e densa de uma ferramenta de engenharia lida por horas. Texto da interface em **português do Brasil**.

## 1. Sempre dentro da `RaizDs`

Todo o CSS mora sob a classe `.ds`. Sem a raiz, nada tem estilo e a fonte cai para a do sistema. Envolva a tela inteira **uma vez**; ela pinta o fundo grafite, põe a Geist e o texto claro.

```jsx
const { RaizDs, Botao, Selo } = window.NexoDs;
<RaizDs style={{ minHeight: "100vh", padding: 32 }}>…</RaizDs>
```

## 2. Estilo = tokens `var(--ds-*)` (não há classes utilitárias)

Para o seu próprio layout use estilo inline com estes tokens (definidos em `styles.css` → `_ds_bundle.css`):

| Família | Tokens |
|---|---|
| Superfície (do fundo para a frente) | `--ds-surface-page` `--ds-surface-sunken` `--ds-surface-card` `--ds-surface-raised` `--ds-surface-overlay` |
| Texto | `--ds-text-primary` `--ds-text-secondary` `--ds-text-tertiary` |
| Borda (luz, desenhada por dentro) | `boxShadow: "var(--ds-edge)"` / `"var(--ds-edge-strong)"`; flutuante: `--ds-shadow-float`, `--ds-shadow-overlay` |
| Cor do Nexo (violeta) | `--ds-nexo` `--ds-nexo-strong` `--ds-nexo-wash` `--ds-nexo-line` |
| Gravidade | `--ds-sev-block` `--ds-sev-risco` `--ds-sev-decide` `--ds-sev-note` `--ds-sev-texto` (+ `-wash`) |
| Estado | `--ds-state-ok` `--ds-state-info` `--ds-state-attention` `--ds-state-error` (+ `-wash`) |
| Disciplina | `--ds-disc-arq` `-est` `-fnd` `-hid` `-ele` `-pci` `-cli` `-ter` `-pai` `-cab` `-gas` `-ace` `-ger` |
| Raio (por papel) | `--ds-radius-tag` 6 · `-control` 10 · `-row` 12 · `-card` 16 · `-panel` 18 · `-composer` 22 · `-pill` |
| Espaço (base 4) | `--ds-space-1` … `--ds-space-16` |
| Texto | `--ds-text-2xs` … `--ds-text-display`; mono: `fontFamily: "var(--ds-font-mono)"` |

Classes prontas que valem usar: `ds-code` (código inline, ex. `117-25`), `ds-num` (números tabulares).

## 3. As regras que fazem parecer o Nexo

- **Violeta só para o Nexo**: presente/trabalhando (`<Selo tom="nexo" ponto>Auditando</Selo>`), seleção e foco. Nunca decorativo, nunca em botão.
- **Ação principal = `<Botao variante="primary">`** (pílula de papel claro). **Uma por tela.** Alternativas: `ghost`; baixa ênfase: `quiet`.
- Cartões: `background: var(--ds-surface-card)`, `boxShadow: var(--ds-edge)`, `borderRadius: var(--ds-radius-card)`. Sem borda cinza sólida, sem sombra clara, sem gradiente.
- Títulos **leves** (300–500) e grandes; corpo 14px. **Nunca rótulo em caixa alta.**
- Cor de gravidade sempre com o texto do degrau ("Bloqueia a emissão").
- Léxico: folha/prancha, lote, tomo, carimbo, memorial, LD, separatriz, parecer, achado, conferir, gerar.
- **Não existe** teal, chanfro nem IBM Plex: são do sistema antigo.

## 4. Onde está a verdade

`guidelines/DESIGN.md` (a lei completa) e os `.prompt.md` de cada componente. O `Orbe` (a marca viva) não está neste pacote.

## 5. Exemplo

```jsx
const { RaizDs, Botao, Selo, Tecla } = window.NexoDs;
<RaizDs style={{ padding: 32 }}>
  <div style={{ background: "var(--ds-surface-card)", boxShadow: "var(--ds-edge)", borderRadius: "var(--ds-radius-card)", padding: 20, display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span className="ds-code">117-25</span>
      <span style={{ fontSize: 17, fontWeight: 500 }}>Muro de contenção da Rua Anita Garibaldi</span>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ds-text-secondary)" }}>
      <Selo tom="block" ponto>Bloqueia a emissão</Selo> Volumes divergentes entre memorial e quadro
    </div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Botao>Agora não</Botao>
      <Botao variante="primary">Auditar <Tecla>↵</Tecla></Botao>
    </div>
  </div>
</RaizDs>
```
