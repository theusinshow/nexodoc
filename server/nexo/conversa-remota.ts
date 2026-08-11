/**
 * A CONVERSA QUE ATRAVESSA A REDE — regras puras, sem React e sem Prisma.
 *
 * O que roda aqui: validar o que chega do navegador, decidir o que é grande
 * demais e fundir a lista do servidor com a do disco local. São as três coisas
 * que erram em silêncio se ninguém as testar, e as três que não precisam de
 * banco nem de tela para serem provadas (`node scripts/test-nexo-conversa-remota.ts`).
 *
 * Nada aqui importa o alias `@/`, de propósito: com ele o arquivo deixa de
 * rodar sob o type-stripping do node cru e o teste morre junto.
 */

/** O que a lista precisa saber de uma conversa sem abrir o JSON inteiro. */
export interface ResumoDaConversa {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  folderKey?: string;
  /**
   * A seção da sidebar: montagem de volume ou auditoria de memorial.
   *
   * A lista do SERVIDOR não traz este campo — ele vive dentro do JSON da
   * conversa, e a listagem lê só as colunas de fora. Por isso `fundirListas`
   * preserva o que o disco local já sabia em vez de deixar a conversa saltar de
   * seção sozinha depois de uma sincronização.
   */
  tipo?: "volume" | "auditoria";
  temAuditoriaPendente?: boolean;
  /** Verdadeiro quando o registro veio do servidor e não existe neste disco. */
  soNoServidor?: boolean;
}

/**
 * O contrato mínimo do registro. Estrutural de propósito: o `StoredConversation`
 * é schemaless e cresce toda semana — repetir a lista de campos aqui só criaria
 * um segundo lugar para esquecer de atualizar.
 */
export interface RegistroDaConversa {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  folderKey?: string;
  tipo?: "volume" | "auditoria";
  auditoriaPendente?: unknown;
  [campo: string]: unknown;
}

/**
 * Teto do que vai para o banco.
 *
 * O que engorda uma conversa não são as mensagens: são os `payload` das
 * auditorias e o `conteudo` lido de cada carimbo. Duzentas folhas com texto
 * extraído passam fácil de um megabyte. O teto existe para o servidor recusar
 * com um motivo em vez de estourar em algum lugar mais fundo — e a recusa TEM
 * que chegar na tela, senão o testador acha que salvou.
 */
export const LIMITE_BYTES = 4_000_000;

export type Veredito =
  | { ok: true; registro: RegistroDaConversa; bytes: number }
  | { ok: false; motivo: string };

function textoNaoVazio(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function horaValida(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Valida o corpo que chegou do navegador.
 *
 * Deliberadamente frouxo com o miolo e rígido com a moldura: os campos que o
 * servidor LÊ (id, título, datas, pasta) precisam estar certos, porque viram
 * coluna e índice; o resto é opaco e vai como veio.
 */
export function validarRegistro(corpo: unknown): Veredito {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return { ok: false, motivo: "corpo não é um registro" };
  }
  const r = corpo as Record<string, unknown>;

  if (!textoNaoVazio(r.id)) return { ok: false, motivo: "id ausente" };
  if (!textoNaoVazio(r.title)) return { ok: false, motivo: "título ausente" };
  if (!horaValida(r.createdAt)) return { ok: false, motivo: "createdAt inválido" };
  if (!horaValida(r.updatedAt)) return { ok: false, motivo: "updatedAt inválido" };
  if (r.folderKey !== undefined && typeof r.folderKey !== "string") {
    return { ok: false, motivo: "folderKey inválido" };
  }

  let bytes: number;
  try {
    // O tamanho medido é o do JSON que o banco vai guardar, não o do corpo da
    // requisição: é esse que importa, e é ele que a mensagem de erro cita.
    bytes = new TextEncoder().encode(JSON.stringify(corpo)).length;
  } catch {
    return { ok: false, motivo: "registro não é serializável" };
  }
  if (bytes > LIMITE_BYTES) {
    const mb = (bytes / 1_000_000).toFixed(1);
    const teto = (LIMITE_BYTES / 1_000_000).toFixed(0);
    return { ok: false, motivo: `conversa grande demais: ${mb} MB (teto ${teto} MB)` };
  }

  return { ok: true, registro: r as unknown as RegistroDaConversa, bytes };
}

/** O resumo que vira coluna — o mesmo cálculo dos dois lados da rede. */
export function resumoDoRegistro(r: RegistroDaConversa): ResumoDaConversa {
  return {
    id: r.id,
    title: r.title,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ...(r.folderKey ? { folderKey: r.folderKey } : {}),
    ...(r.tipo ? { tipo: r.tipo } : {}),
    ...(r.auditoriaPendente ? { temAuditoriaPendente: true } : {}),
  };
}

/**
 * Funde a lista do disco com a do servidor.
 *
 * Regras, nesta ordem:
 *
 * 1. **o mais novo vence**, por `updatedAt`. Não há relógio comum entre as duas
 *    máquinas, e fingir que há seria pior: o empate resolve para o LOCAL, que é
 *    o que a pessoa está vendo;
 * 2. **o que só existe no servidor entra marcado** (`soNoServidor`). Ele abre,
 *    mas os arquivos gerados não estão nesta máquina — e a tela precisa poder
 *    dizer isso em vez de mostrar uma conversa com artefatos que sumiram;
 * 3. **o que só existe no disco fica.** Sincronizar pode ter falhado, e sumir
 *    com o trabalho de alguém por causa de uma rede ruim é inaceitável.
 *
 * O que esta função NÃO faz: apagar. Ausência no servidor nunca é ordem de
 * apagar o local, porque é indistinguível de "ainda não subiu".
 */
export function fundirListas(
  locais: ResumoDaConversa[],
  remotas: ResumoDaConversa[],
): ResumoDaConversa[] {
  const porId = new Map<string, ResumoDaConversa>();

  for (const l of locais) porId.set(l.id, { ...l, soNoServidor: false });

  for (const r of remotas) {
    const local = porId.get(r.id);
    if (!local) {
      porId.set(r.id, { ...r, soNoServidor: true });
      continue;
    }
    // Empate resolve para o local: é o que a pessoa tem na frente.
    if (r.updatedAt > local.updatedAt) {
      /*
       * O `tipo` do local sobrevive quando o remoto não tem nenhum.
       *
       * A listagem do servidor devolve só as colunas de fora, e `tipo` não é
       * uma delas — sem esta linha, toda conversa editada noutra máquina
       * voltaria para "Montagem de volumes" na próxima sincronização, e uma
       * auditoria saltaria de seção sem ninguém ter mexido nela.
       */
      porId.set(r.id, {
        ...r,
        ...(r.tipo ? {} : local.tipo ? { tipo: local.tipo } : {}),
        soNoServidor: false,
      });
    }
  }

  return [...porId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
