/**
 * O ARQUIVO GUARDADO — os bytes, para quem tem direito a eles.
 *
 * É esta rota que faz o achado ser conferível por quem não estava lá. Antes
 * dela, `podeVerNoDocumento` dependia do IndexedDB da própria máquina, e o botão
 * não existia justamente para quem recebeu o achado por e-mail.
 *
 * 404, E NUNCA 403, para arquivo de outro escritório. "Existe, mas não é seu" já
 * entrega que existe — e um checksum é conhecido por quem tem o arquivo, o que
 * transformaria a resposta num oráculo de "este documento passou por aqui".
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const CHECKSUM = /^[a-f0-9]{64}$/i;

function naoEncontrado() {
  return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ checksum: string }> },
) {
  try {
    const actor = await requireActor();
    const { checksum } = await params;

    if (!isDatabaseConfigured() || !CHECKSUM.test(checksum)) {
      return naoEncontrado();
    }

    /*
     * O ESCRITÓRIO ENTRA NA CONSULTA, e não numa comparação depois.
     *
     * Buscar por checksum e conferir a organização em seguida é a mesma coisa
     * até o dia em que alguém acrescenta um `early return` no meio. Aqui não há
     * meio: ou a linha é do escritório de quem pede, ou ela não existe.
     */
    const arquivo = await getPrisma().storedFile.findFirst({
      where: {
        checksumSha256: checksum.toLowerCase(),
        organizationId: actor.organizationId,
      },
      select: { bytes: true, mimeType: true, sizeBytes: true },
    });

    if (!arquivo) return naoEncontrado();

    return new NextResponse(Buffer.from(arquivo.bytes), {
      headers: {
        "Content-Type": arquivo.mimeType,
        "Content-Length": String(arquivo.sizeBytes),
        /*
         * `inline`: o visor de PDF do parecer o abre dentro da tela, e
         * `attachment` faria o navegador baixá-lo em vez de mostrá-lo.
         */
        "Content-Disposition": "inline",
        /*
         * IMUTÁVEL, e por um ano: a chave É o conteúdo. Um checksum nunca passa
         * a apontar para outros bytes, então revalidar seria pagar rede para
         * confirmar o que a chave já garante.
         *
         * `private` porque o conteúdo é do escritório — cache compartilhado o
         * serviria a quem a consulta acima recusaria.
         */
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
