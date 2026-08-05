/**
 * CONFERÊNCIA DO VOLUME MONTADO — núcleo puro.
 *
 * O portão final. As outras duas conferências olham os SELOS LIDOS, antes da
 * montagem; esta abre o PDF que vai ser enviado e o confere contra o plano que
 * o gerou.
 *
 * A divisão de trabalho é a mesma do resto do sistema, e é o ponto do módulo:
 *
 *   a IA lê, a regra julga.
 *
 * O modelo devolve o que enxerga no carimbo de cada página e nada mais. Comparar
 * com o gabarito é código determinístico, aqui, testável em node cru. Um modelo
 * que erra a leitura produz um achado errado, que se vê e se corrige; um modelo
 * que erra o veredito produz um volume aprovado no escuro.
 *
 * A SEVERIDADE segue de quem afirma o quê. A estrutura (contagem, papel) é
 * aritmética sobre o plano e não passa pelo modelo — crítico ali é confiável.
 * O conteúdo passa pela leitura, e leitura erra: divergência isolada é aviso, e
 * só o padrão SISTEMÁTICO sobe para crítico. Um crítico falso ensina a ignorar
 * o semáforo, que é o pior estrago que uma conferência pode fazer.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-volume-check.ts`.
 */

export type Severidade = "critico" | "aviso" | "info";
export type Veredito = "ok" | "aviso" | "critico";

/** Espelha `LightCheckFinding` de `light-check-core.ts`. Redeclarado: núcleo puro. */
export interface Achado {
  severidade: Severidade;
  campo: string;
  mensagem: string;
  detalhe?: string;
}

/** Uma linha da LD como ela foi IMPRESSA dentro do volume. */
export interface LinhaDaLdImpressa {
  sheet: string;
  file: string;
  description: string;
}

/** O que se leu de UMA página do PDF montado. Leitura, não juízo. */
export interface LeituraDaPagina {
  pagina: number;
  /** A página tem carimbo de prancha? Vem da contagem de âncoras, não do modelo. */
  temCarimbo: boolean;
  numeracaoTexto: string;
  folha: number | null;
  total: number | null;
  codigo: string;
  titulo: string;
  disciplina: string;
  orgao: string;
  obra: string;
  /** Só em página de LD: as linhas lidas por extração de texto. */
  linhasDaLd?: LinhaDaLdImpressa[];
  /** A página não pôde ser lida. Impede o veredito "ok". */
  erro?: string;
}

/** Contra o que se confere. */
export interface AlvoDoVolume {
  /** A prefeitura DECLARADA — a da capa. Nunca inferida do próprio selo. */
  orgao: string;
  /** O `pageCount` que a montagem devolveu para o PDF final. */
  pageCount: number;
}

export interface VolumeCheckResult {
  veredito: Veredito;
  findings: Achado[];
  /** Quantas páginas entraram no juízo — a UI diz sobre o que ele fala. */
  paginasConferidas: number;
}

/** Redeclarado de `volume-plano.ts`: núcleo puro não importa. */
export interface PaginaEsperada {
  pagina: number;
  papel: "capa" | "separatriz" | "ld" | "prancha";
  bloco: string;
  folha: number | null;
  total: number | null;
  codigo: string | null;
  titulo: string | null;
}

const RANK: Record<Veredito, number> = { ok: 0, aviso: 1, critico: 2 };

/** Lista curta e legível (a mensagem não pode estourar com 200 páginas). */
function juntar(itens: string[], max = 6): string {
  if (itens.length <= max) return itens.join(", ");
  return `${itens.slice(0, max).join(", ")} (+${itens.length - max})`;
}

/** minúsculas, sem acento, sem pontuação — para comparar disciplina e obra. */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palavras que todo nome de prefeitura carrega e que, por isso, não identificam
 * ninguém. Mesma lista e mesma razão de `selo-identity-core.ts`: sem tirá-las,
 * "Prefeitura Municipal de Chapecó" e "Prefeitura Municipal de Criciúma"
 * casariam em três das quatro palavras — e a conferência aprovaria justamente o
 * erro que ela existe para pegar. Duplicada aqui porque núcleo puro não importa.
 */
const VAZIAS = new Set([
  "prefeitura",
  "municipal",
  "municipio",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "estado",
  "governo",
  "secretaria",
  "obras",
  "planejamento",
  "urbanismo",
  "desenvolvimento",
]);

/** O que RESTA de um nome de órgão depois de tirar o que é comum a todos. */
function nucleo(valor: string): string[] {
  return normalizar(valor)
    .split(" ")
    .filter((p) => p.length > 2 && !VAZIAS.has(p));
}

/** Dois nomes de órgão apontam para o mesmo município? `null` = não dá para dizer. */
function mesmoOrgao(a: string, b: string): boolean | null {
  const na = nucleo(a);
  const nb = nucleo(b);
  if (na.length === 0 || nb.length === 0) return null;
  return na.some((p) => nb.includes(p));
}

/** Valor mais frequente entre números; 0 quando não há nenhum. */
function moda(valores: number[]): { valor: number; vezes: number } {
  const contas = new Map<number, number>();
  for (const v of valores) contas.set(v, (contas.get(v) ?? 0) + 1);
  let valor = 0;
  let vezes = 0;
  for (const [k, n] of contas) if (n > vezes) [valor, vezes] = [k, n];
  return { valor, vezes };
}

/**
 * As linhas da LD como ela foi IMPRESSA no volume.
 *
 * O gabarito do plano vem das linhas ATUAIS da LD; esta leitura vem do papel que
 * está encadernado. As duas discordarem é exatamente o caso que se quer pegar:
 * o volume montado com uma LD gerada antes de alguém mexer nas folhas.
 *
 * O parse é por FORMA DA LINHA, ancorado na numeração, e não por posição de
 * coluna: o texto extraído já chega linha a linha, e a âncora sobrevive a uma
 * coluna mudar de largura ou a um cabeçalho a mais.
 */
export function parseLinhasDaLd(texto: string): LinhaDaLdImpressa[] {
  const linhas: LinhaDaLdImpressa[] = [];
  for (const bruta of texto.split("\n")) {
    const limpa = bruta.replace(/\s+/g, " ").trim();
    const m = /^(\d{1,3}\s*\/\s*\d{1,3})\s+(\S+)\s*(.*)$/.exec(limpa);
    if (!m) continue;
    linhas.push({
      sheet: m[1].replace(/\s+/g, ""),
      file: m[2],
      description: m[3].trim(),
    });
  }
  return linhas;
}

export function checkVolumeMontado(
  esperado: readonly PaginaEsperada[],
  lido: readonly LeituraDaPagina[],
  alvo: AlvoDoVolume,
): VolumeCheckResult {
  const findings: Achado[] = [];
  const porPagina = new Map(lido.map((l) => [l.pagina, l]));

  // --- Estrutura: a contagem (CRÍTICO) ---------------------------------------
  if (esperado.length > 0 && alvo.pageCount !== esperado.length) {
    findings.push({
      severidade: "critico",
      campo: "paginas",
      mensagem: `O volume saiu com ${alvo.pageCount} página(s); o plano previa ${esperado.length}.`,
      detalhe:
        "A fusão comeu ou duplicou páginas — o PDF não corresponde às partes que foram montadas.",
    });
  }

  /*
   * --- Estrutura: papel trocado (CRÍTICO) ----------------------------------
   *
   * A prova é a presença do CARIMBO, que vem da contagem de âncoras e não de uma
   * leitura de papel pelo modelo (o modelo não devolve papel). A ordem canônica
   * em si não é reconferida: ela sai de `buildVolumeParts`, que é puro e já
   * travado por `test:nexo:parts`. O que pode dar errado da montagem para o PDF
   * é a FAIXA de páginas de cada parte, e é isso que estas duas regras pegam.
   */
  const semCarimbo: string[] = [];
  const carimboAMais: string[] = [];
  for (const p of esperado) {
    const l = porPagina.get(p.pagina);
    // Página não lida não prova nada; acusar seria inventar defeito.
    if (!l || l.erro) continue;
    if (p.papel === "prancha" && !l.temCarimbo) semCarimbo.push(`p.${p.pagina}`);
    if (p.papel !== "prancha" && l.temCarimbo) {
      carimboAMais.push(`p.${p.pagina} (devia ser ${p.papel})`);
    }
  }
  if (semCarimbo.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "papel",
      mensagem: `${semCarimbo.length} página(s) deveriam ser prancha e não têm carimbo.`,
      detalhe: `${juntar(semCarimbo)} — a faixa recortada trouxe capa ou índice para dentro do bloco.`,
    });
  }
  if (carimboAMais.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "papel",
      mensagem: `${carimboAMais.length} página(s) trazem carimbo de prancha onde deveria haver outra parte.`,
      detalhe: juntar(carimboAMais),
    });
  }

  // --- Conteúdo, página a página --------------------------------------------
  const pranchas = esperado.filter((p) => p.papel === "prancha");
  const blocosDoPlano = [...new Set(pranchas.map((p) => p.bloco))];

  for (const bloco of blocosDoPlano) {
    const doBloco = pranchas.filter((p) => p.bloco === bloco);
    const rotulo = bloco ? bloco.toUpperCase() : "Sem disciplina";

    /*
     * A FAIXA DESLOCADA vem primeiro porque ela EXPLICA as divergências
     * individuais. Quando metade ou mais das páginas do bloco erram pelo MESMO
     * valor, não são N leituras ruins: é uma faixa recortada errada, e reportar
     * página por página esconderia a causa atrás do sintoma.
     */
    const desvios: number[] = [];
    const divergentes: string[] = [];
    let comparaveis = 0;
    for (const p of doBloco) {
      const l = porPagina.get(p.pagina);
      if (!l || l.erro || p.folha == null || l.folha == null) continue;
      comparaveis++;
      if (l.folha !== p.folha) {
        desvios.push(l.folha - p.folha);
        divergentes.push(`p.${p.pagina}: selo diz ${l.folha}, esperado ${p.folha}`);
      }
    }

    const { valor: desvio, vezes } = moda(desvios);
    /*
     * DUAS condições, e o piso de 2 é tão necessário quanto a proporção. Num
     * bloco de duas folhas, uma leitura ruim é metade do bloco — e só a
     * proporção a promoveria a "faixa recortada errada", que é justamente o
     * crítico falso que esta regra existe para evitar. Uma página concordando
     * consigo mesma não é padrão nenhum; padrão começa em duas.
     */
    const sistematico =
      comparaveis > 0 && desvio !== 0 && vezes >= 2 && vezes >= Math.ceil(comparaveis / 2);

    if (sistematico) {
      findings.push({
        severidade: "critico",
        campo: "faixa",
        mensagem: `${rotulo}: ${vezes} de ${comparaveis} folha(s) deslocadas em ${desvio > 0 ? "+" : ""}${desvio} — a faixa de páginas deste bloco foi recortada errada.`,
        detalhe: juntar(divergentes),
      });
    } else if (divergentes.length > 0) {
      findings.push({
        severidade: "aviso",
        campo: "numeracao",
        mensagem: `${rotulo}: a numeração do carimbo discorda do esperado em ${divergentes.length} página(s).`,
        detalhe: juntar(divergentes),
      });
    }

    // --- Presença e duplicata dentro do bloco (CRÍTICO) ---------------------
    const esperadas = doBloco
      .map((p) => p.folha)
      .filter((n): n is number => n != null);
    const contagem = new Map<number, number>();
    for (const p of doBloco) {
      const l = porPagina.get(p.pagina);
      if (!l || l.erro || l.folha == null) continue;
      contagem.set(l.folha, (contagem.get(l.folha) ?? 0) + 1);
    }

    /*
     * Faixa deslocada já explica a ausência e a duplicata inteiras: com o bloco
     * corrido em +1, TODA folha some e TODA folha aparece fora do lugar. Somar
     * os três achados sobre a mesma causa entulha a tela e esconde o conserto.
     */
    if (!sistematico && contagem.size > 0) {
      /*
       * A FALTA é INFERIDA da leitura, e por isso cede ao aviso de numeração.
       * Uma página lida como "7" onde se esperava "2" faz a folha 2 parecer
       * ausente — mas ela está ali, com o número mal lido, e a página existe
       * (senão a contagem ou o carimbo já teriam acusado, que são as provas
       * estruturais e confiáveis). Emitir crítico de falta em cima de um aviso
       * de leitura seria dizer duas coisas sobre o mesmo fato, e escolher a
       * mais alarmante das duas.
       */
      if (divergentes.length === 0) {
        const faltando = esperadas.filter((n) => !contagem.has(n));
        if (faltando.length > 0) {
          findings.push({
            severidade: "critico",
            campo: "sequencia",
            mensagem: `${rotulo}: folha(s) faltando no volume: ${faltando.join(", ")}.`,
            detalhe: `A LD deste bloco promete ${esperadas.length} folha(s).`,
          });
        }
      }
      /*
       * A DUPLICATA é OBSERVADA: duas páginas afirmando ser a mesma folha é um
       * fato sobre o documento, não uma dedução sobre o que falta. Ela vale
       * mesmo com ruído de leitura em volta.
       */
      const duplicadas = [...contagem.entries()]
        .filter(([, n]) => n > 1)
        .map(([n]) => n)
        .sort((a, b) => a - b);
      if (duplicadas.length > 0) {
        findings.push({
          severidade: "critico",
          campo: "sequencia",
          mensagem: `${rotulo}: folha(s) duplicada(s) no volume: ${duplicadas.join(", ")}.`,
          detalhe: duplicadas
            .map((n) => `folha ${n} aparece ${contagem.get(n)}x`)
            .join(" | "),
        });
      }
    }

    // --- Disciplina: a prancha caiu no bloco certo? (CRÍTICO) ---------------
    const foraDoBloco: string[] = [];
    for (const p of doBloco) {
      const l = porPagina.get(p.pagina);
      if (!l || l.erro || !l.disciplina.trim() || !bloco) continue;
      const lida = normalizar(l.disciplina);
      const doPlano = normalizar(bloco);
      /*
       * O carimbo escreve a sigla ("EST") ou o nome ("ESTRUTURAL"); o plano tem
       * o código do bloco ("est"). Prefixo cobre os dois sem exigir uma tabela
       * de rótulos aqui dentro — e tabela de rótulos num núcleo puro seria uma
       * segunda verdade sobre nomes de disciplina, que já moram em `disciplinas.ts`.
       */
      if (!lida.startsWith(doPlano) && !doPlano.startsWith(lida)) {
        foraDoBloco.push(`p.${p.pagina}: carimbo diz "${l.disciplina}"`);
      }
    }
    if (foraDoBloco.length > 0) {
      findings.push({
        severidade: "critico",
        campo: "disciplina",
        mensagem: `${rotulo}: ${foraDoBloco.length} página(s) de outra disciplina dentro deste bloco.`,
        detalhe: juntar(foraDoBloco),
      });
    }

    /*
     * --- A LD IMPRESSA × as pranchas que vieram depois dela (CRÍTICO) -------
     *
     * A LD é o documento que PROMETE o conteúdo do volume. Ela discordar do que
     * está encadernado logo abaixo é o defeito que não tem meio-termo: quem
     * recebe confere pela lista, e uma lista errada é pior do que lista nenhuma.
     *
     * Compara por CÓDIGO quando o bloco tem um código distinto por folha; quando
     * a família imprime o mesmo em todas (`arq` escreve "040_26_arq_a" nas três),
     * o código não separa nada e a comparação cai na CONTAGEM.
     */
    const paginaDaLd = esperado.find((p) => p.papel === "ld" && p.bloco === bloco);
    const leituraDaLd = paginaDaLd ? porPagina.get(paginaDaLd.pagina) : undefined;
    const impressa = leituraDaLd?.linhasDaLd;
    if (impressa && impressa.length > 0) {
      const codigosDoPlano = doBloco
        .map((p) => p.codigo?.trim())
        .filter((c): c is string => Boolean(c));
      const distintos = new Set(codigosDoPlano).size;

      if (distintos > 1 && distintos === codigosDoPlano.length) {
        const naLd = new Set(impressa.map((l) => l.file.trim().toLowerCase()));
        const noVolume = new Set(codigosDoPlano.map((c) => c.toLowerCase()));
        const soNaLd = [...naLd].filter((c) => !noVolume.has(c));
        const soNoVolume = [...noVolume].filter((c) => !naLd.has(c));
        if (soNaLd.length > 0 || soNoVolume.length > 0) {
          findings.push({
            severidade: "critico",
            campo: "ld",
            mensagem: `${rotulo}: a LD encadernada não bate com as pranchas do volume.`,
            detalhe: [
              soNaLd.length > 0 ? `na LD e ausentes do volume: ${juntar(soNaLd)}` : "",
              soNoVolume.length > 0 ? `no volume e ausentes da LD: ${juntar(soNoVolume)}` : "",
              "provável LD gerada antes da última mudança nas folhas.",
            ]
              .filter(Boolean)
              .join(" | "),
          });
        }
      } else if (impressa.length !== doBloco.length) {
        findings.push({
          severidade: "critico",
          campo: "ld",
          mensagem: `${rotulo}: a LD encadernada lista ${impressa.length} folha(s), mas o volume traz ${doBloco.length}.`,
          detalhe: "provável LD gerada antes da última mudança nas folhas.",
        });
      }
    }
  }

  // --- Identidade: para QUEM este volume está indo (CRÍTICO) -----------------
  const outroOrgao = lido.filter(
    (l) => !l.erro && l.orgao.trim() && mesmoOrgao(l.orgao, alvo.orgao) === false,
  );
  if (outroOrgao.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "orgao",
      mensagem: `${outroOrgao.length} página(s) do volume apontam outro órgão que não ${alvo.orgao}.`,
      detalhe: juntar(outroOrgao.map((l) => `p.${l.pagina}: "${l.orgao}"`)),
    });
  }

  const obras = new Map<string, number[]>();
  for (const l of lido) {
    if (l.erro) continue;
    const chave = normalizar(l.obra);
    if (!chave) continue;
    if (!obras.has(chave)) obras.set(chave, []);
    obras.get(chave)!.push(l.pagina);
  }
  if (obras.size > 1) {
    findings.push({
      severidade: "critico",
      campo: "obra",
      mensagem: `Nomes de obra divergentes dentro do volume (${obras.size} versões) — prancha de outro projeto encadernada junto.`,
      detalhe: [...obras.entries()]
        .map(([obra, pgs]) => `"${obra}": ${juntar(pgs.map((p) => `p.${p}`))}`)
        .join(" | "),
    });
  }

  /*
   * --- Leitura parcial (AVISO, e trava o "ok") -----------------------------
   *
   * Mesma regra do auditor: análise parcial não aprova. O veredito "ok" afirma
   * que o volume foi conferido, e ele não foi — dizer "ok" sobre um documento
   * que não se olhou inteiro é a única saída pior do que não conferir.
   */
  const naoLidas = lido.filter((l) => l.erro);
  const faltantes = esperado.filter((p) => !porPagina.has(p.pagina));
  const semConferir = naoLidas.length + faltantes.length;
  if (semConferir > 0) {
    findings.push({
      severidade: "aviso",
      campo: "leitura",
      mensagem: `${semConferir} de ${esperado.length} página(s) não puderam ser conferidas — o veredito fala só do resto.`,
      detalhe: juntar([
        ...naoLidas.map((l) => `p.${l.pagina}: ${l.erro}`),
        ...faltantes.map((p) => `p.${p.pagina}: não lida`),
      ]),
    });
  }

  let veredito: Veredito = "ok";
  for (const f of findings) {
    const como: Veredito =
      f.severidade === "critico" ? "critico" : f.severidade === "aviso" ? "aviso" : "ok";
    if (RANK[como] > RANK[veredito]) veredito = como;
  }

  return { veredito, findings, paginasConferidas: lido.length };
}
