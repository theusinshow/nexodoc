"use client";

import type { VolumeMetadata } from "@/modules/volume-builder/lib/volume/volume-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VolumeMetadataFormProps {
  metadata: VolumeMetadata;
  onChange: (metadata: VolumeMetadata) => void;
}

export function VolumeMetadataForm({
  metadata,
  onChange,
}: VolumeMetadataFormProps) {
  function updateField(field: keyof VolumeMetadata, value: string) {
    onChange({ ...metadata, [field]: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados Gerais do Lote</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="projectCode" className="text-xs">
              Codigo do Projeto
            </Label>
            <Input
              id="projectCode"
              value={metadata.projectCode}
              onChange={(e) => updateField("projectCode", e.target.value)}
              placeholder="Ex: 106_25"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="projectName" className="text-xs">
              Nome do Projeto
            </Label>
            <Input
              id="projectName"
              value={metadata.projectName}
              onChange={(e) => updateField("projectName", e.target.value)}
              placeholder="Nome do projeto"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client" className="text-xs">
              Cliente
            </Label>
            <Input
              id="client"
              value={metadata.client ?? ""}
              onChange={(e) => updateField("client", e.target.value)}
              placeholder="Nome do cliente"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="city" className="text-xs">
              Cidade
            </Label>
            <Input
              id="city"
              value={metadata.city ?? ""}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="Cidade"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="volume" className="text-xs">
              Volume
            </Label>
            <Input
              id="volume"
              value={metadata.volume ?? ""}
              onChange={(e) => updateField("volume", e.target.value)}
              placeholder="Ex: 5"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tomo" className="text-xs">
              Tomo
            </Label>
            <Input
              id="tomo"
              value={metadata.tomo ?? ""}
              onChange={(e) => updateField("tomo", e.target.value)}
              placeholder="Ex: 01"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="revision" className="text-xs">
              Revisao
            </Label>
            <Input
              id="revision"
              value={metadata.revision ?? ""}
              onChange={(e) => updateField("revision", e.target.value)}
              placeholder="Ex: A"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date" className="text-xs">
              Data
            </Label>
            <Input
              id="date"
              value={metadata.date ?? ""}
              onChange={(e) => updateField("date", e.target.value)}
              placeholder="Ex: 2026-06"
              className="h-9"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
