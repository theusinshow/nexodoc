"use client";

import { useCoverGenerator, type InitialData } from "../hooks/useCoverGenerator";
import { StepTemplateSelect, type TemplateOption } from "./StepTemplateSelect";
import { StepGeneralData } from "./StepGeneralData";
import { StepCoverGroups } from "./StepCoverGroups";
import { StepPreview } from "./StepPreview";
import { StepSummary } from "./StepSummary";
import { StepResult } from "./StepResult";
import { LdIntegrationBanner } from "@/modules/ld-interop/components/LdIntegrationBanner";
import { Stepper } from "@/components/layout/stepper";
import { Separator } from "@/components/ui/separator";

interface CoverGeneratorFlowProps {
  initialData?: InitialData;
}

export function CoverGeneratorFlow({ initialData }: CoverGeneratorFlowProps) {
  const ctx = useCoverGenerator(initialData);

  function handleNext() {
    ctx.goToStep(ctx.step + 1);
  }

  function handleBack() {
    ctx.goToStep(ctx.step - 1);
  }

  function handleStepClick(target: number) {
    ctx.goToStep(target);
  }

  function handleSelectTemplate(template: TemplateOption) {
    ctx.selectTemplate(template.id, {
      ...template.defaults,
      volumeFormat: template.volumeFormat ?? template.defaults.volumeFormat,
      tomoFormat: template.tomoFormat ?? template.defaults.tomoFormat,
      coverTitleMode:
        template.coverTitleMode ?? template.defaults.coverTitleMode,
      campos: template.campos,
    });
  }

  function handleGeneratePreview() {
    ctx.buildPages();
    ctx.goToStep(3);
  }

  function handleGenerate() {
    ctx.goToStep(5);
  }

  return (
    <div className="space-y-6">
      <Stepper currentStep={ctx.step} onStepClick={handleStepClick} />

      {ctx.fromLd && (
        <LdIntegrationBanner
          data={{
            codigoInterno: ctx.generalData.codigoInterno,
            codigoExibido: ctx.generalData.codigoExibido,
            revisao: ctx.generalData.revisao,
            nomeObra: ctx.generalData.nomeObra,
            fase: ctx.generalData.fase,
            orgao: ctx.generalData.orgao,
          }}
        />
      )}

      <Separator />

      <div className="relative">
        <div key={ctx.step} className="step-animate">
          {ctx.step === 0 && (
            <StepTemplateSelect
              templateId={ctx.templateId}
              onSelect={handleSelectTemplate}
              onNext={handleNext}
            />
          )}

          {ctx.step === 1 && (
            <StepGeneralData
              data={ctx.generalData}
              templateFields={ctx.templateFields}
              onChange={ctx.updateGeneralData}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}

          {ctx.step === 2 && (
            <StepCoverGroups
              groups={ctx.groups}
              volumeFormat={ctx.volumeFormat}
              templateFields={ctx.templateFields}
              coverTitleMode={ctx.coverTitleMode}
              onAdd={ctx.addGroup}
              onUpdate={ctx.updateGroup}
              onRemove={ctx.removeGroup}
              onBack={handleBack}
              onGenerate={handleGeneratePreview}
            />
          )}

          {ctx.step === 3 && (
            <StepPreview
              pages={ctx.pages}
              generalData={ctx.generalData}
              templateFields={ctx.templateFields}
              coverTitleMode={ctx.coverTitleMode}
              onUpdate={ctx.updatePage}
              onRemove={ctx.removePage}
              onAdd={ctx.addPage}
              onReorder={ctx.reorderPages}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}

          {ctx.step === 4 && (
            <StepSummary
              generalData={ctx.generalData}
              pages={ctx.pages}
              templateFields={ctx.templateFields}
              coverTitleMode={ctx.coverTitleMode}
              onBack={handleBack}
              onGenerate={handleGenerate}
            />
          )}

          {ctx.step === 5 && (
            <StepResult
              generalData={ctx.generalData}
              totalPages={ctx.pages.length}
              pages={ctx.pages}
              templateFields={ctx.templateFields}
              onReset={ctx.reset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
