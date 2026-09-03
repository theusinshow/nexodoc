"use client";

/**
 * MOTOR — a auditoria está melhorando, e com que configuração?
 *
 * Duas telas viraram uma. Qualidade media o resultado; Configuração declarava o
 * que produz esse resultado — e elas viviam em abas diferentes, o que obrigava a
 * abrir duas telas para responder a uma pergunta só ("a taxa de falso positivo
 * caiu depois que eu troquei o modelo dos blocos?").
 *
 * A Configuração era o depósito do painel: nove seções de naturezas diferentes
 * empilhadas na ordem em que foram escritas. As que não são do motor saem daqui
 * — a cotação vai para Dinheiro, o freio do cadastro vai para Pessoas.
 */

import { ShieldCheck } from "lucide-react";

import { AdminPageHeader, AdminPageShell } from "@/components/admin/admin-page-shell";
import { CorpoDaConfiguracao } from "@/components/admin/conteudo/configuracao";
import { CorpoDosControles } from "@/components/admin/conteudo/controles";
import { TituloDaSecao } from "@/components/admin/admin-page-shell";
import { Gauge } from "lucide-react";
import { CorpoDaQualidade } from "@/components/admin/conteudo/qualidade";

export default function AdminMotorPage() {
  return (
    <AdminPageShell maxWidth="max-w-[1300px]">
      <AdminPageHeader
        icon={ShieldCheck}
        title="Motor"
        description="O que a auditoria está achando, e a configuração que produz isso. A medida em cima, a régua embaixo."
      />
      <CorpoDaQualidade />

      <section className="flex flex-col gap-4">
        <TituloDaSecao
          icon={Gauge}
          titulo="Vazão e limites de leitura"
          descricao="O que a máquina aguenta e quanto ela lê. Dois destes mudam o que a auditoria acha — e por isso entram na versão do auditor."
        />
        <CorpoDosControles
          chaves={[
            "vazao.usuario",
            "vazao.global",
            "limites.blocosPorArquivo",
            "limites.saidaProfundo",
            "limites.concorrencia",
            "limites.timeoutMs",
          ]}
        />
      </section>

      <CorpoDaConfiguracao />
    </AdminPageShell>
  );
}
