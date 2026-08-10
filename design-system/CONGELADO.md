# Este diretório está congelado

`design-system/` é um **segundo aplicativo Next**, com gerenciador de pacotes próprio
(pnpm) e 82 arquivos versionados. Ele não faz parte do build do produto:

- `tsconfig.json` o exclui (`"exclude": [..., "design-system", ...]`)
- `eslint.config.mjs` o exclui (`"design-system/**"`)
- **nenhum arquivo de `app/`, `components/`, `modules/`, `lib/`, `hooks/`, `server/` ou
  `scripts/` importa qualquer coisa daqui** — conferido na Fase 0 da refatoração de UI/UX

Ou seja: nada aqui dentro chega ao usuário. É protótipo.

## Por que congelar em vez de apagar

Porque protótipo tem valor de consulta e apagar 82 arquivos é irreversível na prática.
O problema nunca foi ele existir — foi ele parecer autoridade. Havia três fontes de
verdade concorrentes sobre o design do NexoDoc, e esta era uma delas.

## A fonte de verdade é a `DESIGN.md` da raiz

Para qualquer decisão de cor, tipografia, raio, espaçamento, movimento ou estado de
componente, vale a [`DESIGN.md`](../DESIGN.md) na raiz do repositório, e o que está
efetivamente escrito em `app/globals.css`. Nada daqui.

Se um componente daqui contradiz a `DESIGN.md`, **a `DESIGN.md` está certa** — este
diretório não é mantido.

## O que é permitido

- Ler, para consultar uma ideia de layout ou uma variação que já foi tentada.
- Copiar um trecho para o app principal, **adaptando aos tokens da `DESIGN.md`**.

## O que não é

- Importar daqui em tempo de build. Não há caminho configurado e não deve haver.
- Tratar um componente daqui como especificação.
- "Sincronizar" o app principal com este diretório.

## Se um dia for aposentado

A decisão de remover não é técnica, é de arquivo: alguém precisa dizer que as ideias
aqui já foram absorvidas ou descartadas. Enquanto isso não acontece, congelado é a
postura honesta — melhor que apagar por engano ou manter por inércia.
