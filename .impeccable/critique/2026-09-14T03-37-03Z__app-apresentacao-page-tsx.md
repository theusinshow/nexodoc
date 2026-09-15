---
target: /apresentacao analisada como possível comprador (desktop-only)
total_score: 22
max_score: 28
na_heuristics: 7,9,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Dev\\trabalho\\empresa\\nexodoc\\app\\apresentacao\\page.tsx"
target_fingerprint: "sha256:bd504ed0c168cec31b307f30ec12566cb3b78b78997c9685dd183cce608a7e32"
target_path: "C:\\Dev\\trabalho\\empresa\\nexodoc\\app\\apresentacao\\page.tsx"
timestamp: 2026-09-14T03-37-03Z
slug: app-apresentacao-page-tsx
closed: true
---
Method: dual-agent (A: assessment_a · B: assessment_b)

# Crítica da página `/apresentacao`

## Design Health Score

| # | Heurística | Nota | Problema principal |
|---|---|---:|---|
| 1 | Visibilidade do estado | 3/4 | Trilho e contador situam bem; mudanças de folha não são anunciadas a tecnologia assistiva. |
| 2 | Correspondência com o mundo real | 4/4 | Exemplos e vocabulário pertencem ao cotidiano de projetos e documentos técnicos. |
| 3 | Controle e liberdade | 3/4 | Teclado é completo e o anexo preserva a folha; o CTA focado não tem indicação visual. |
| 4 | Consistência e padrões | 4/4 | Sistema visual e gramática de movimento são excepcionalmente coesos. |
| 5 | Prevenção de erros | 3/4 | Navegação tem limites seguros e não há ações destrutivas; faltam critérios comerciais objetivos que previnam expectativas erradas. |
| 6 | Reconhecimento em vez de memória | 2/4 | Preço, prova e ressalvas ficam separados por muitas folhas e duas abas; a ajuda desaparece. |
| 7 | Flexibilidade e eficiência | n/a | Não se aplica a um deck Persuade de uso episódico. |
| 8 | Estética e design minimalista | 3/4 | Visual forte, mas folhas 10, 13–16 e C/E concentram texto e cifras demais para uma sala. |
| 9 | Recuperação de erros | n/a | A superfície não possui entrada de dados nem fluxo de erro relevante. |
| 10 | Ajuda e documentação | n/a | Não é requisito central do deck; notas do apresentador cumprem esse papel. |
| **Total** |  | **22/28 (79%)** | **Bom — execução forte, caso comercial ainda incompleto.** |

## Veredito de especificidade

### Avaliação humana independente

O design tem alta especificidade e é claramente autoral. O trilho de 19 folhas, a linguagem de instrumento calibrado, o mapa das 218 páginas, a página 92, o orbe e a combinação Plex Sans/Mono pertencem ao NexoDoc. Isto não parece template de SaaS.

A identidade, porém, está mais resolvida que o argumento de compra. A apresentação prova que existe trabalho sério e domínio do problema, mas ainda não oferece a um diretor elementos suficientes para aprovar um piloto de R$ 10 mil sem diligência adicional.

### Varredura determinística

O detector encontrou 34 advisories: 19 usos de cor fora dos tokens documentados, 14 tamanhos tipográficos fora do sistema e 1 raio divergente. Vinte e nove ocorrências estão em `app/apresentacao/palco.css`, quatro em `app/apresentacao/folhas/o-que-e.tsx` e uma em `app/apresentacao/valores/slides-valores.tsx`.

A maioria dos tamanhos tipográficos é falso positivo: um deck fixo 1920×1080 precisa de escala diferente da UI operacional. O teal marcado pelo overlay também é a cor canônica do produto. Os sinais reais são a deriva para `#3d474d`/`#5f6b72`, o coral `#ff4d5a` da assinatura e o contraste aproximado de 3,54:1 de `#5f6b72` sobre `#0a0e11` em textos pequenos.

### Evidência visual

As 19 folhas e as seis folhas do anexo foram percorridas. Estados representativos foram medidos em 1366×768, 1440×900 e 1920×1080. Não houve corte, overflow, erro de página ou erro de console. A restrição informada pelo usuário é desktop-only, portanto mobile não entra como requisito ou penalidade.

O overlay Impeccable marcou 17 ocorrências brutas em cinco visualizações, majoritariamente falsos positivos da paleta teal e do spotlight do orbe. O sinal técnico importante não veio do overlay: o CTA “Abrir os valores” recebe foco por teclado, mas continua visualmente idêntico ao repouso (`outline: none`, sem sombra).

## Impressão geral como comprador

Minha reação seria: “isto existe, é sério e foi construído por alguém que conhece o trabalho; ainda não sei se a compra está suficientemente provada e governada”.

A página vende muito bem autoria, cuidado e consciência dos riscos. Vende menos bem o piloto. Ela apresenta dois produtos — conferência e montagem —, mas a prova forte é da conferência e o ganho mais concreto de tempo é da montagem. Depois ancora preço no custo de quem construiu e termina em propriedade intelectual, quando deveria terminar na decisão que o comprador precisa tomar.

A maior oportunidade não é deixar o visual mais bonito. É reorganizar o final para converter credibilidade técnica em segurança comercial.

## O que está funcionando

- **Identidade memorável e coerente.** O mapa das 218 páginas e o achado ligado à página 92 transformam uma abstração em evidência concreta. O deck parece parte do produto.
- **Honestidade bem utilizada.** “Peca pelo excesso”, variabilidade entre execuções, estimativas em âmbar e responsabilidade final do projetista aumentam a confiança porque delimitam o que o sistema ainda não sabe.
- **Ergonomia desktop sólida.** Setas, PageUp/Down, espaço, Home/End, notas, tela cheia, movimento reduzido e abertura dos valores em outra aba funcionam. O palco não apresentou corte nas resoluções testadas.

## Carga cognitiva e jornada emocional

A carga é moderada: duas falhas em oito critérios. O deck falha em chunking nas seis garantias da folha 10, nas objeções 13–16 e nas folhas C/E do anexo. Também cria uma ponte de memória: o comprador precisa lembrar números e ressalvas apresentados muitas folhas antes e em outra aba. Não há ponto de decisão com mais de quatro escolhas visíveis.

A jornada começa muito bem: autoridade silenciosa, compreensão progressiva e um pico forte na demonstração das 218 páginas. As folhas 6–8 aumentam a tensão; a folha 9 usa honestidade para gerar confiança. Depois, 13–16 viram um corredor defensivo. O CTA da 17 recupera energia, mas é condicional: “se você quiser ver”. O anexo termina em propriedade. Pela regra peak-end, o último sentimento é cautela jurídica, não desejo de começar.

## Problemas prioritários

### [P1] A prova e o ROI pertencem a capacidades diferentes

**O que:** A evidência concreta da folha 5 é a conferência: 218 páginas, 57 candidatos, um achado real e custo de US$ 1,49. A economia mais palpável da folha 12 é a montagem: dezesseis horas mensais. A montagem, porém, aparece apenas como “uso acompanhado”, sem antes/depois, arquivo gerado, tempo medido ou erro evitado.

**Por que importa:** O comprador precisa fazer dois saltos sozinho: assumir que os 57 candidatos têm precisão comercialmente útil e assumir que a montagem entrega as dezesseis horas usadas no argumento.

**Correção:** Eleger uma capacidade como wedge do piloto ou dar à montagem prova equivalente: projeto real, número de pranchas, tempo antes/depois, arquivos produzidos e divergência evitada. Trocar “57 achados” por composição: confirmados, refutados, recorrentes e pendentes de julgamento.

**Comando sugerido:** `$impeccable clarify`

### [P1] O preço está ancorado no esforço do vendedor, não no valor do comprador

**O que:** O anexo apresenta R$ 24.600–38.600 como custo de construção e conclui que R$ 10 mil é menos da metade. O próprio deck também mostra operação a R$ 285/mês e licença equivalente a R$ 1.667/mês, mas evita conectar preço a benefício mensurável.

**Por que importa:** Custo afundado do fornecedor não é justificativa de compra. Para procurement, a pergunta é o que reduz risco, o que será entregue e qual evidência permanecerá na empresa.

**Correção:** Ancorar os R$ 10 mil em escopo de implantação, risco reduzido, acompanhamento, entregáveis, governança e evidência produzida. Deixar custo de construção como nota de diligência, não como eixo da proposta.

**Comando sugerido:** `$impeccable shape`

### [P1] O deck termina sem pedir uma decisão

**O que:** “Abrir os valores” é a única ação e é introduzida como opcional. Depois do preço, o anexo termina em propriedade intelectual. Não há aprovação do piloto, projeto inicial, responsáveis, data, checkpoints nem próximo gesto.

**Por que importa:** A diretoria precisa inventar o processo de compra. Um deck de venda que não formula a decisão converte interesse em “vamos pensar”.

**Correção:** Terminar com uma folha de decisão: projeto de entrada, sponsor, usuários, início, checkpoints, critério objetivo de sucesso e ação concreta — aprovar piloto, marcar reunião de implantação ou nomear responsáveis. Propriedade e limitações vêm antes.

**Comando sugerido:** `$impeccable clarify`

### [P2] A defesa ocupa palco demais e pode ensinar a sala a atacar

**O que:** As folhas 13–16 antecipam quatro objeções, com três respostas e um fecho em cada uma. “Regras determinísticas”, “LDs”, “selos”, “ODT” e a contradição entre capacidade de ler PDF escaneado e OCR fora do piloto criam fricção adicional.

**Por que importa:** A demonstração perde ritmo, o público precisa ler demais e objeções que talvez nem aparecessem ganham quatro telas de destaque.

**Correção:** Manter apenas as duas objeções inevitáveis. Levar as respostas restantes, privacidade e propriedade para notas/anexo. Usar o tempo recuperado para produto real, prova de montagem e fechamento.

**Comando sugerido:** `$impeccable distill`

### [P2] Acessibilidade de teclado e contraste contradizem o acabamento percebido

**O que:** O CTA é alcançável por Tab, mas não exibe foco visível. Textos pequenos em `#5f6b72` sobre `#0a0e11` ficam em aproximadamente 3,54:1; slides correntes depois da capa usam `h2` sem `h1` presente.

**Por que importa:** A navegação principal do deck é por teclado. Esconder foco no único link clicável é um defeito real, e o baixo contraste piora justamente em notebook/tela compartilhada.

**Correção:** Criar `:focus-visible` forte e coerente com o teal; elevar os textos informativos para contraste AA; manter rótulos puramente decorativos como exceção explícita; corrigir a hierarquia de heading do slide ativo.

**Comando sugerido:** `$impeccable audit`

## Red flags por persona

### Jordan — primeiro contato

Entende a categoria até a folha 2, mas tropeça em “regras determinísticas”, “LDs”, “selos” e “ODT”. Lê 57 como 57 erros; só quatro folhas depois descobre excesso e precisão ainda não julgada. Encontra o preço, mas não o caminho para iniciar o piloto.

### Riley — comprador que testa promessas

Vai exigir provedor, retenção, subprocessadores e região para validar “nenhum documento treina o modelo”. Também notará que a capacidade de ler PDF escaneado existe no brief, enquanto OCR está excluído do piloto, e perguntará qual meta mínima de precisão, amostra e critério de interrupção serão usados.

### Helena — diretora compradora em desktop

Entende o preço e o escopo, mas não sabe quem responde pelo piloto, qual projeto começa, quantas pessoas participam, quando ocorrem checkpoints, qual precisão caracteriza sucesso ou qual artefato formaliza a aprovação. A última folha a deixa discutindo propriedade, não implementação.

## Observações menores

- O painel de notas ocupa 460px em 1366×768; é útil para ensaio, mas inadequado se a mesma tela for compartilhada na reunião.
- A régua de controles some após três segundos. Coerente para palco, menos descobrível para quem recebe o deck sozinho.
- O coral `#ff4d5a` da assinatura é drift real, mas pontual; `#000` é apenas máscara de gradiente.
- O console mostrou cinco avisos não bloqueantes de depreciação de `THREE.Clock`; não houve erro funcional.
- A frase “vergonha não passada” é memorável, mas pode soar acusatória para gestores ligados ao episódio. A narração precisa retirar culpa.
- Não existe falha de layout desktop demonstrada: sete estados medidos ficaram sem overflow ou corte.

## Perguntas para considerar

- Se apenas uma capacidade puder justificar o piloto, é conferência ou montagem?
- Qual prova mínima transforma “57 candidatos” em risco real evitado antes do pedido de R$ 10 mil?
- As quatro objeções respondem à sala ou ensinam a sala a atacar?
- Qual decisão concreta deve estar tomada quando a última tela apagar?
