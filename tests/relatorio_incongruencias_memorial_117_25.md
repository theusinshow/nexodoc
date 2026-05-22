# Relatório de Incongruências — Memorial Descritivo

**Arquivo analisado:** `117_25_md_geral_a.pdf`  
**Obra:** UBS Vila Manaus — Porte 1  
**Município:** Criciúma/SC  
**Documento:** Volume 1 — Memorial Descritivo  
**Código:** 117-25  
**Data do documento:** Outubro/2025  

---

## 1. Resumo da análise

Foi realizada uma verificação textual do memorial descritivo com foco em incongruências internas, indícios de reaproveitamento de trechos de outros projetos, conflitos de informação, problemas de nomenclatura e possíveis erros de cálculo ou redação.

A análise identificou inconsistências relevantes, principalmente relacionadas a:

- Nome incorreto de município/proprietário;
- Bairro divergente em trecho do memorial;
- Ruas aparentemente pertencentes a outro projeto;
- Conflito de hierarquia entre projetos e especificações;
- Norma técnica possivelmente citada de forma incorreta;
- Divergência em cálculo/capacidade de climatização;
- Divergência em cálculo de autonomia de reservatório;
- Problemas de redação e formatação.

---

## 2. Incongruências encontradas

| ID | Prioridade | Local aproximado | Tipo de erro | Descrição | Correção sugerida |
|---|---|---|---|---|---|
| INC-001 | Alta | Cap. 9 — Projeto Hidrossanitário — item 9.1.2 | Município/proprietário divergente | O memorial é da Prefeitura Municipal de Criciúma, porém no item de proprietário consta “Prefeitura Municipal de Chapecó”. O endereço do item seguinte volta a indicar Criciúma. | Corrigir o proprietário para “Prefeitura Municipal de Criciúma”. |
| INC-002 | Alta | Cap. 1 — item 1.3 — Plantas e desenhos | Bairro divergente | O texto informa que os documentos servirão de referência para a construção da Unidade Básica de Saúde Bairro Vila Francesa, mas o restante do memorial identifica a obra como UBS Vila Manaus. | Substituir “Bairro Vila Francesa” por “Bairro Vila Manaus”. |
| INC-003 | Alta | Cap. 2 — item 2.12 — Movimento de terra | Logradouro divergente | O memorial cita limpeza e microdrenagem da Rua Bento Goiá e Av. Engenheiro Max de Souza. Entretanto, a obra está localizada na Rua São Francisco de Assis, Bairro Vila Manaus. O trecho aparenta ter sido reaproveitado de outro projeto. | Verificar origem do trecho. Remover ou substituir pelos logradouros corretos do projeto. |
| INC-004 | Média/Alta | Cap. 2 — Condições gerais e preliminares | Conflito de hierarquia documental | Em um trecho, o memorial estabelece que, em caso de divergência entre especificações e projetos, prevalecem os projetos. Em outro trecho, afirma que as especificações técnicas e normas de execução prevalecerão sobre todos os projetos e que o projeto arquitetônico prevalecerá sobre os demais. | Padronizar a regra de prevalência entre projetos, memoriais, especificações e orçamento. |
| INC-005 | Média | Cap. 7 — Esquadrias / portas de vidro | Norma técnica possivelmente incorreta | O texto menciona sinalização de portas de vidro, porém cita a ABNT NBR ISO 9050:2022, relacionada a vidros na construção civil e determinação de transmissão de luz/energia. A norma não parece adequada para o tema de sinalização/acessibilidade. | Conferir a norma aplicável. Provavelmente separar norma de vidro e norma de acessibilidade, como NBR 9050 quando aplicável. |
| INC-006 | Média | Cap. 13 — Projeto de Climatização | Divergência de carga térmica | A carga térmica total indicada é de aproximadamente 21,10 TR e a carga simultânea total é de 21,08 TR. Porém, o texto informa instalação de 9 pontos de mini-split totalizando 240.000 BTU/h, equivalente a 20 TR. Há diferença aproximada de 1,08 a 1,10 TR. | Verificar se foi aplicado fator de simultaneidade, arredondamento ou se a capacidade instalada precisa ser revista. |
| INC-007 | Média | Cap. 9 — Reúso de água pluvial | Divergência de cálculo/autonomia | A demanda diária de irrigação foi indicada como 44,86 L/dia. O reservatório adotado é de 1000 L e o texto informa atendimento de 10 dias de demanda. Pela conta direta, 1000 / 44,86 ≈ 22,3 dias. | Corrigir a autonomia para aproximadamente 22 dias ou revisar a demanda considerada. |
| INC-008 | Baixa/Média | Cap. 2 — Licenciamentos / placas de obra | Nomenclatura institucional | O texto define CREA como “Conselho Regional de Engenharia e Arquitetura”. Em outro ponto, o memorial cita CAU-BR e CREA separadamente. A nomenclatura está imprecisa. | Revisar a redação, separando corretamente CREA e CAU conforme as responsabilidades técnicas. |
| INC-009 | Baixa | Cap. 9 — Contentores / depósito temporário de lixo | Erro de redação/formatação | Aparecem termos como “1contentores” e “2contentores”, sem espaçamento. Também há repetição de “resíduos classe A” em itens distintos. | Corrigir espaçamentos e revisar se uma das classificações de resíduos deveria ser diferente. |
| INC-010 | Baixa | Transição Cap. 13 para Cap. 14 | Erro de formatação/cabeçalho | Na transição entre capítulos aparece texto colado, como “14 PROJETO DE GASES MEDICINAIS14 – PROJETO...”. | Ajustar quebra de página, cabeçalho e formatação do início do capítulo 14. |

---

## 3. Itens críticos para correção imediata

Os pontos abaixo devem ser tratados com prioridade antes da emissão final:

1. Corrigir “Prefeitura Municipal de Chapecó” para “Prefeitura Municipal de Criciúma”.
2. Corrigir “Bairro Vila Francesa” para “Bairro Vila Manaus”.
3. Revisar o trecho que cita “Rua Bento Goiá” e “Av. Engenheiro Max de Souza”.
4. Padronizar a hierarquia documental entre projetos, memoriais e especificações.
5. Conferir a diferença entre carga térmica calculada e capacidade instalada no projeto de climatização.

---

## 4. Modelo de retorno estruturado para aplicativo

```json
{
  "arquivo": "117_25_md_geral_a.pdf",
  "tipo_documento": "Memorial Descritivo",
  "obra": "UBS Vila Manaus - Porte 1",
  "codigo": "117-25",
  "municipio": "Criciúma/SC",
  "data_documento": "Outubro/2025",
  "status_analise": "concluida",
  "total_incongruencias": 10,
  "incongruencias": [
    {
      "id": "INC-001",
      "prioridade": "Alta",
      "local": "Cap. 9 - Projeto Hidrossanitário - item 9.1.2",
      "tipo": "Município/proprietário divergente",
      "descricao": "O memorial é da Prefeitura Municipal de Criciúma, porém no item de proprietário consta Prefeitura Municipal de Chapecó.",
      "sugestao_correcao": "Corrigir o proprietário para Prefeitura Municipal de Criciúma."
    },
    {
      "id": "INC-002",
      "prioridade": "Alta",
      "local": "Cap. 1 - item 1.3 - Plantas e desenhos",
      "tipo": "Bairro divergente",
      "descricao": "O texto cita Bairro Vila Francesa, enquanto o restante do memorial identifica a obra como UBS Vila Manaus.",
      "sugestao_correcao": "Substituir Bairro Vila Francesa por Bairro Vila Manaus."
    },
    {
      "id": "INC-003",
      "prioridade": "Alta",
      "local": "Cap. 2 - item 2.12 - Movimento de terra",
      "tipo": "Logradouro divergente",
      "descricao": "O memorial cita Rua Bento Goiá e Av. Engenheiro Max de Souza, mas a obra está localizada na Rua São Francisco de Assis.",
      "sugestao_correcao": "Remover ou substituir os logradouros divergentes pelos corretos."
    },
    {
      "id": "INC-004",
      "prioridade": "Media/Alta",
      "local": "Cap. 2 - Condições gerais e preliminares",
      "tipo": "Conflito de hierarquia documental",
      "descricao": "Há conflito entre trechos que definem prevalência dos projetos e trechos que definem prevalência das especificações.",
      "sugestao_correcao": "Padronizar uma única regra de prevalência documental."
    },
    {
      "id": "INC-005",
      "prioridade": "Media",
      "local": "Cap. 7 - Esquadrias / portas de vidro",
      "tipo": "Norma técnica possivelmente incorreta",
      "descricao": "A norma citada não parece adequada ao tema de sinalização de portas de vidro.",
      "sugestao_correcao": "Conferir norma aplicável e separar norma de vidro de norma de acessibilidade."
    },
    {
      "id": "INC-006",
      "prioridade": "Media",
      "local": "Cap. 13 - Projeto de Climatização",
      "tipo": "Divergência de carga térmica",
      "descricao": "Carga térmica aproximada de 21,10 TR, mas capacidade instalada indicada como 20 TR.",
      "sugestao_correcao": "Revisar dimensionamento, simultaneidade ou capacidade instalada."
    },
    {
      "id": "INC-007",
      "prioridade": "Media",
      "local": "Cap. 9 - Reúso de água pluvial",
      "tipo": "Divergência de cálculo/autonomia",
      "descricao": "Reservatório de 1000 L para demanda de 44,86 L/dia resulta em cerca de 22,3 dias, não 10 dias.",
      "sugestao_correcao": "Corrigir autonomia ou revisar demanda adotada."
    },
    {
      "id": "INC-008",
      "prioridade": "Baixa/Media",
      "local": "Cap. 2 - Licenciamentos / placas de obra",
      "tipo": "Nomenclatura institucional",
      "descricao": "CREA é descrito como Conselho Regional de Engenharia e Arquitetura, mas o documento também cita CAU-BR separadamente.",
      "sugestao_correcao": "Ajustar nomenclatura de CREA e CAU."
    },
    {
      "id": "INC-009",
      "prioridade": "Baixa",
      "local": "Cap. 9 - Contentores",
      "tipo": "Erro de redação/formatação",
      "descricao": "Há textos como 1contentores e 2contentores, além de possível repetição de classe de resíduos.",
      "sugestao_correcao": "Corrigir espaçamento e revisar classificação dos resíduos."
    },
    {
      "id": "INC-010",
      "prioridade": "Baixa",
      "local": "Transição Cap. 13 para Cap. 14",
      "tipo": "Erro de formatação/cabeçalho",
      "descricao": "Texto de cabeçalho do capítulo 14 aparece colado na transição entre capítulos.",
      "sugestao_correcao": "Ajustar quebra de página e cabeçalho."
    }
  ]
}
```

---

## 5. Observação para desenvolvimento do aplicativo

Este retorno pode servir como base para um formato de saída de análise automatizada. Para uso no aplicativo, recomenda-se que cada incongruência contenha pelo menos os seguintes campos:

- `id`
- `prioridade`
- `pagina`
- `capitulo`
- `local`
- `tipo`
- `descricao`
- `evidencia`
- `sugestao_correcao`
- `status`
- `confianca`

Exemplo de status:

- `pendente`
- `corrigido`
- `ignorado`
- `necessita_validacao_manual`

Exemplo de níveis de confiança:

- `alta`
- `media`
- `baixa`
