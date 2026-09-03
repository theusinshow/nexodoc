"use client";

/**
 * DADOS — o que o banco guarda, e o que dá para apagar.
 *
 * Auditorias e LDs eram duas telas com a mesma forma (listar, filtrar, apagar em
 * lote) e a mesma pergunta por trás. Juntá-las é o que permite a próxima coisa:
 * o expurgo por obra, que atravessa as duas e mais as conversas.
 */

import { Database } from "lucide-react";

import { AdminPageHeader, AdminPageShell } from "@/components/admin/admin-page-shell";
import { CorpoDasAuditorias } from "@/components/admin/conteudo/auditorias";
import { CorpoDoExpurgo } from "@/components/admin/conteudo/expurgo";
import { CorpoDasLds } from "@/components/admin/conteudo/lds";

export default function AdminDadosPage() {
  return (
    <AdminPageShell>
      <AdminPageHeader
        icon={Database}
        title="Dados"
        description="O que ficou gravado no servidor. Apagar aqui é permanente — e alcança as máquinas que montaram, não só o banco."
      />
      {/*
        O EXPURGO VEM PRIMEIRO — é a única coisa desta tela que não existia, e é
        a pergunta que traz alguém aqui ("o que o banco guarda, e como eu limpo
        isso?"). As duas listas abaixo continuam sendo consulta.
      */}
      <CorpoDoExpurgo />
      <CorpoDasAuditorias />
      <CorpoDasLds />
    </AdminPageShell>
  );
}
