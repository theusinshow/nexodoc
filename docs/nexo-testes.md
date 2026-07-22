# Nexo — Checklist de testes definitivo (fechar o motor)

Objetivo: validar de ponta a ponta o **caso comum** do Nexo (pranchas → LD + capa →
conferência → volume → auditoria) e o endurecimento. Marque cada item; anote o que
falhar. Critério de aprovação em **negrito**.

## Pré-requisitos
- [ ] Dev server no ar: `npm run dev` (pode subir na **3000** ou **3001** — olhe o log).
- [ ] Abrir `http://localhost:<porta>/nexo` e **logar**.
- [ ] **Ctrl+Shift+R** (hard refresh) para pegar o bundle novo — importante.

Arquivos de amostra (do próprio repo):
- **PDF combinado por tomo (EST):** `docs/samples/040-26/7_est/040_26_est_tomo1.pdf` (… tomo2/3/4)
- **Arquivos separados (HIS, 1 por prancha):** `docs/samples/040-26/10_his_inc_spd/arquivos separados/1_his/040_26_his_001_a.pdf` … `_015_a.pdf`
- **Memorial da MESMA obra (040-26):** `docs/samples/040-26/1_memorial/040_26_md_geral_a.pdf`
- **Memorial de OUTRA obra (113-22):** `docs/samples/113-22/1_memorial/113_22_md_geral_a.pdf`

---

## A — Leitura de selos (o bug dos "16")
1. **PDF combinado.** Em "Selos das pranchas" → *Ler pranchas* → anexe `040_26_est_tomo1.pdf`.
   - [ ] A coluna **Folha** vem **sequencial (01, 02, 03…)**, **sem "16" repetido**.
   - [ ] A ordem da tabela é por folha (não a ordem de leitura).
   - [ ] Descrição e disciplina (EST) coerentes por linha.
2. **Arquivos separados.** *Ler pranchas* → selecione as `040_26_his_001_a.pdf` … `_015_a.pdf`.
   - [ ] Folha vem do **número do nome** (01…15), correta.

**Aprova se:** nenhuma folha "16" duplicada; sequência limpa nos dois casos.

---

## B — LD (lista de documentos)
Com as pranchas lidas (do passo A):
3. Campo **Título da LD** começa **em branco** (você preenche; ex.: `PROJETO ESTRUTURAL`).
   - [ ] Não vem auto-preenchido com a secretaria nem nada.
4. Deixe **Número de tomos = 1** → *Gerar LD* → baixe o ODT/PDF e abra.
   - [ ] Coluna **Nº DA FOLHA** correta e sequencial (sem "16/16" repetido).
   - [ ] Coluna **ARQUIVOS** com o código de cada prancha.
   - [ ] **DESCRIÇÃO limpa** (sem "IMP/DATA/ESCALA/REV" grudado no fim).
   - [ ] **Sem "folhas faltando"** fantasma.
5. **Divisão em tomos.** Volte, ponha **Número de tomos = 4** → *Gerar LD*.
   - [ ] A LD sai com **4 seções** ("… (TOMO 1)", "(TOMO 2)", …), folhas distribuídas.

**Aprova se:** folhas certas, descrições limpas, título é decisão sua, divide em N.

---

## C — Capa
6. Escolha a **Prefeitura (capa) = Chapecó** → *Gerar capa* → baixe o ZIP/PDF e abra.
   - [ ] Capa em **1 página por tomo** (sem aquela página em branco com "040-26 + PROSUL").
   - [ ] **Título automático**: a obra (REVITALIZAÇÃO…) + disciplina; você **não** digita título.
   - [ ] Sai **com PDF** (não só ODT).
7. **Volume:** ponha `Volume (capa) = 2` → gerar → a capa mostra **Vol. II**.
8. **Mês/Ano:** escolha `Mês = MAIO`, `Ano = 2026` → gerar → a capa mostra **MAIO/2026**.
9. **Tomos na capa:** `Número de tomos = 4` → gerar → saem **4 capas** (TOMO 01…04).

**Aprova se:** 1 página por capa, título/obra automáticos, volume/mês/ano/tomos respeitados.

---

## D — Conferência leve (sem memorial)
10. Botão **Conferir** (com as pranchas lidas).
    - [ ] Veredito **🟢 Consistente** para um conjunto normal.
11. **Erro proposital:** leia junto uma prancha de OUTRO projeto (ex.: um `_his_` do 040-26
    **+** um arquivo de outra obra, se tiver) → *Conferir*.
    - [ ] Veredito **🔴/🟡** apontando **código/obra divergente** ou **folha faltando**.

**Aprova se:** conjunto limpo = 🟢; mistura de projeto = achado crítico.

---

## E — Montar volume
12. Gere **capa + LD** (passos B/C) e clique **Montar volume**.
    - [ ] Baixa um **PDF único** que abre.
    - [ ] Ordem: **capa → LD → pranchas** (na ordem das folhas).
    - [ ] Nº de páginas coerente (capa + LD + pranchas).

**Aprova se:** o volume sai na ordem certa e abre.

---

## F — Auditoria do memorial (reusa o motor completo)
13. Na seção **Auditoria do memorial**: *Anexar* → `040_26_md_geral_a.pdf` (mesma obra) →
    nível *padrão* → **Auditar**.
    - [ ] Veredito **🟢 / 🟡** (sem crítico de identidade — obra bate).
    - [ ] Conclusão + achados fazem sentido.
14. **Erro proposital:** *Trocar* → `113_22_md_geral_a.pdf` (OUTRA obra) → **Auditar**.
    - [ ] Veredito **🔴** com achado de **obra/identidade divergente** (memorial de outro projeto).

**Aprova se:** memorial certo = ok; memorial de outra obra = 🔴 identidade.

---

## G — Chat / agente (roteador de intenção)
Com as pranchas lidas, no painel **Conversa**:
15. Digite: **"cria a LD e a capa da prefeitura de chapeco, volume 2, em 4 tomos"**
    (repare: "chapeco" sem acento, de propósito).
    - [ ] O agente **afirma os fatos** (obra/código/disciplina) sem re-perguntar.
    - [ ] Aparecem **2 cards**: LD e Capa.
    - [ ] A capa mapeou **Chapecó** mesmo sem acento.
    - [ ] Volume = 2, tomos = 4 refletidos nos cards.
    - [ ] O agente **pergunta o título da LD** (não inventa).
16. Nos cards, **[Confirmar e gerar]** → baixa os arquivos (mesmo resultado do painel).

**Aprova se:** mapeia a prefeitura, propõe LD+capa, respeita volume/tomos, pergunta o título.

---

## Casos-limite / regressão
- [ ] Gerar capa no módulo **/capas** original (Chapecó) → continua **1 página** (sem regressão).
- [ ] Módulo **/ld** original ainda funciona (a extração de descrição foi compartilhada).
- [ ] Reler as mesmas pranchas 2x → folha estável (reconciliação por ordem de página).

---

## O que me reportar
Para cada seção, só preciso de **passou / não passou** e, se não passou:
1. Qual item (ex.: "B-4: descrição ainda com IMP no fim").
2. O que apareceu (print ajuda muito).
3. Qual arquivo você usou.

Prioridade de report: **A (folha "16")** e **G (agente)** — são os últimos calibrados.
