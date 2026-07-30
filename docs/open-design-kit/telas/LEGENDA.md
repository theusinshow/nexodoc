# As capturas — o software rodando hoje

Tiradas em 2026-07-30, do software real. A conversa foi semeada com dados
fabricados (obra "Revitalização da Feira Municipal de Chapecó", 8 pranchas de
arquitetura) para mostrar a tela cheia sem expor projeto de cliente.

**Leia estas imagens como "o que existe", não como "o que deve continuar".** O
que se mantém está escrito em `01-contexto-e-regras.md`; o resto está aberto.

| Arquivo | O que mostra | O que observar |
|---|---|---|
| `01-login` | Entrada | O único lugar com o tipo Display |
| `02-nexo-boas-vindas` | **A tela principal, vazia** | O orbe centrado — a presença do agente. Composer em variante herói |
| `03-nexo-conversa-cartoes` | **A tela principal, trabalhando** | Três colunas: sidebar, canvas ao centro, conversa à direita. O cartão "vou gerar 4 documentos" é o padrão central do produto: parâmetros somente-leitura + confirmar |
| `04-nexo-canvas-folhas` | O canvas | Cada retângulo é uma prancha lida do carimbo. Um projeto pode ter 200 — por isso são texto puro, sem miniatura |
| `05-nexo-sidebar-historico` | A barra lateral | Histórico agrupado em pasta por obra (o código "040-26"). Rodapé com o resto do software |
| `06-ferramentas-antigas` | Telas de antes | Precisam parecer legado sem parecer quebradas |
| `07-projetos` | Projetos | Superfície de tabela |
| `08-admin` | Painel admin | Densidade de dado, seis subpáginas iguais a esta |
| `09-legado-ld` | Montagem de LD (legado) | A tabela densa — muitas linhas de uma vez é o padrão certo aqui |
| `10-legado-capas` | Capas (legado) | Fluxo em passos |
| `11-legado-separatrizes` | Separatrizes (legado) | Formulário simples |
| `12-legado-volumes` | Volumes (legado) | Mesa de montagem, a tela mais complexa do software |

## O que as capturas NÃO mostram

Estes estados existem no software mas não aparecem aqui — precisam ser
desenhados a partir da descrição nos lotes:

- O orbe em movimento e seus sete estados (a captura é um quadro parado do `idle`).
- A caixa de confirmação nos estados **pendente** (documento envelheceu) e
  **aplicado** (com os downloads).
- A auditoria em curso e o resultado com os achados.
- Arrastar arquivo, ler carimbo, streaming da resposta.
- Erro, vazio e carregando de cada tela.
