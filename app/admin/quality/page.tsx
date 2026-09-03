import { redirect } from "next/navigation";

/**
 * A rota antiga, mantida viva.
 *
 * `/admin/quality` existiu por meses e está em favoritos, em anotação e em link
 * colado em conversa. Um 404 aqui trocaria "a tela mudou de nome" por "o painel
 * quebrou" — e quem levar o 404 não tem como adivinhar para onde a tela foi.
 */
export default function RotaAntiga() {
  redirect("/admin/motor");
}
