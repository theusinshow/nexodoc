"use client";

import type { GeneralData } from "../types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MESES, FIELD_CLASS, LABEL_CLASS } from "../constants";

interface StepGeneralDataProps {
  data: GeneralData;
  templateFields: string[];
  onChange: (partial: Partial<GeneralData>) => void;
  onBack: () => void;
  onNext: () => void;
}

/** Marca visual + semantica de campo obrigatorio. */
function RequiredMark() {
  return (
    <span className="ml-1 text-destructive" aria-hidden="true">
      *
    </span>
  );
}

export function StepGeneralData({
  data,
  templateFields,
  onChange,
  onBack,
  onNext,
}: StepGeneralDataProps) {
  const canProceed = data.templateId && data.orgao && data.nomeObra;
  const missingRequired = [
    !data.orgao.trim() && "orgao",
    !data.nomeObra.trim() && "nome da obra",
  ].filter(Boolean);
  const showSecretaria =
    templateFields.length === 0 || templateFields.includes("SECRETARIA");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, index) =>
    String(currentYear - 3 + index)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-medium tracking-[-0.01em]">Dados Gerais</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha as informacoes do projeto. Todos os campos podem ser
          editados a qualquer momento.{" "}
          <span className="text-destructive">*</span> indica obrigatorio.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>
            Orgao
            <RequiredMark />
          </span>
          <input
            className={FIELD_CLASS}
            value={data.orgao}
            onChange={(e) => onChange({ orgao: e.target.value })}
            placeholder="PREFEITURA MUNICIPAL DE..."
            required
            aria-required="true"
          />
        </label>

        {showSecretaria && (
          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>Secretaria</span>
            <input
              className={FIELD_CLASS}
              value={data.secretaria}
              onChange={(e) => onChange({ secretaria: e.target.value })}
              placeholder="SECRETARIA MUNICIPAL DE..."
            />
          </label>
        )}

        <label className="block space-y-1.5 sm:col-span-2">
          <span className={LABEL_CLASS}>
            Nome da Obra
            <RequiredMark />
          </span>
          <textarea
            className={`${FIELD_CLASS} min-h-[68px] py-2`}
            value={data.nomeObra}
            onChange={(e) => onChange({ nomeObra: e.target.value })}
            placeholder={"UBS SANTO ANTONIO - PORTE 2\nbairro SANTO ANTONIO"}
            rows={2}
            required
            aria-required="true"
          />
          <span className="block text-xs text-muted-foreground">
            Use uma linha extra quando o modelo precisar de complemento, como
            bairro, localidade ou bloco.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>Fase</span>
          <input
            className={FIELD_CLASS}
            value={data.fase}
            onChange={(e) => onChange({ fase: e.target.value })}
            placeholder="PROJETO EXECUTIVO"
          />
        </label>

        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>Codigo Interno</span>
          <input
            className={FIELD_CLASS}
            value={data.codigoInterno}
            onChange={(e) => onChange({ codigoInterno: e.target.value })}
            placeholder="196_25"
          />
        </label>

        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>Codigo Exibido</span>
          <input
            className={FIELD_CLASS}
            value={data.codigoExibido}
            onChange={(e) => onChange({ codigoExibido: e.target.value })}
            placeholder="196-25"
          />
          <span className="block text-xs text-muted-foreground">
            Preenchido automaticamente a partir do codigo interno. Edite se
            precisar de um formato diferente.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>Complemento do nome do arquivo</span>
          <input
            className={FIELD_CLASS}
            value={data.siglaArquivo}
            onChange={(e) => onChange({ siglaArquivo: e.target.value })}
            placeholder="ex.: est, hidr, fundacoes"
          />
          <span className="block text-xs text-muted-foreground">
            Opcional. Use para diferenciar pacotes quando gerar mais de um
            conjunto de capas para o mesmo codigo.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>Revisao</span>
          <input
            className={FIELD_CLASS}
            value={data.revisao}
            onChange={(e) => onChange({ revisao: e.target.value })}
            placeholder="a"
          />
        </label>

        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>Mes</span>
          <select
            className={FIELD_CLASS}
            value={data.mes}
            onChange={(e) => onChange({ mes: e.target.value })}
          >
            <option value="">Selecionar mes</option>
            {MESES.map((mes) => (
              <option key={mes} value={mes}>
                {mes}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>Ano</span>
          <select
            className={FIELD_CLASS}
            value={data.ano}
            onChange={(e) => onChange({ ano: e.target.value })}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        {data.codigoInterno && data.revisao && (
          <div className="sm:col-span-2 rounded-md border border-border bg-card p-4">
            <p className={`${LABEL_CLASS} mb-1`}>Previa do nome do arquivo</p>
            <p className="font-mono text-sm">
              {[data.codigoInterno, "capas", data.siglaArquivo, data.revisao]
                .filter((part) => part.trim())
                .join("_")}
              .odt
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex flex-col items-end gap-1">
          {missingRequired.length > 0 && (
            <p className="font-mono text-xs text-muted-foreground">
              Preencha {missingRequired.join(" e ")} para continuar.
            </p>
          )}
          <Button disabled={!canProceed} onClick={onNext}>
            Continuar
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
