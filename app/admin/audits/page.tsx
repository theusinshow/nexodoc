import { redirect } from "next/navigation";

/**
 * A rota antiga, mantida viva — e COM o filtro que vinha nela.
 *
 * `/admin/audits?status=FAILED` é o destino do cartão "Falhas" do cockpit, e um
 * `redirect("/admin/dados")` seco jogaria fora o `?status=`: o clique cairia na
 * lista completa e quem administra teria que refazer o filtro à mão — que é
 * exatamente o defeito que o parâmetro foi criado para corrigir.
 */
export default async function RotaAntiga({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = new URLSearchParams();

  for (const [chave, valor] of Object.entries(await searchParams)) {
    if (typeof valor === "string") parametros.set(chave, valor);
    else if (Array.isArray(valor) && valor[0]) parametros.set(chave, valor[0]);
  }

  const consulta = parametros.toString();

  redirect(consulta ? `/admin/dados?${consulta}` : "/admin/dados");
}
