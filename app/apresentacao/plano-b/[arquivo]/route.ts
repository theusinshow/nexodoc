import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";

/**
 * AS CAPTURAS DE PLANO B — servidas por rota autenticada, e nunca por `public/`.
 *
 * POR QUE NÃO `public/`. Tudo o que mora lá é servido a qualquer pessoa com o
 * endereço, sem login. Estas imagens mostram o parecer de um projeto REAL da
 * PROSUL — obra, órgão, e 57 achados com transcrição literal do memorial. Pôr
 * isso num caminho aberto contradiz a decisão que o próprio produto declara no
 * slide 15: nenhum PDF anexado é armazenado, e o que sobra é protegido.
 *
 * O MESMO PORTÃO da página que as consome (`app/apresentacao/page.tsx`):
 * administrador ativo, e nada mais.
 *
 * Os arquivos ficam em `assets-privados/`, fora de `public/` e fora de `docs/`
 * — `docs` está no `.dockerignore` e sumiria da imagem de produção, o que
 * transformaria o plano B em quadrado vazio justamente no dia em que ele fosse
 * necessário.
 */

const PASTA = path.join(process.cwd(), "assets-privados", "apresentacao");

/**
 * Lista fechada, e não caminho montado a partir do parâmetro: `[arquivo]` vem
 * da URL, e concatenar entrada de URL com caminho de disco é como se lê arquivo
 * que não se queria entregar.
 */
const PERMITIDOS: Record<string, string> = {
  resumo: "plano-b-resumo.jpg",
  achados: "plano-b-achados.jpg",
};

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ arquivo: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse("Não autenticado.", { status: 401 });
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive || !access.isAdmin) {
    return new NextResponse("Sem acesso.", { status: 403 });
  }

  const { arquivo } = await params;
  const nome = PERMITIDOS[arquivo];

  if (!nome) {
    return new NextResponse("Não encontrado.", { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(PASTA, nome));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        // Privado: nunca em cache compartilhado.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Não encontrado.", { status: 404 });
  }
}
