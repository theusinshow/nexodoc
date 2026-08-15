"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  accept?: Record<string, string[]>;
  label?: string;
  description?: string;
}

export function FileDropzone({
  onFilesAccepted,
  accept = { "application/pdf": [".pdf"] },
  label = "Importar PDFs",
  description = "Arraste arquivos PDF ou clique para selecionar",
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        /*
         * A GRADE TECNICA. Esta e a area onde entram pranchas e memoriais, e a
         * grade de pontos diz isso antes de qualquer texto: coordenada, modulo,
         * prancheta. Ela e ESTATICA — a linha d'agua (DESIGN.md secao 4) proibe
         * borrao sob o que se le, e uma grade parada a 3% nao borra nada. Custo
         * de runtime zero: um gradiente, nenhum JavaScript.
         *
         * O raio tracejado fica: a secao 11 lista o campo tracejado como uma das
         * tres excecoes em que o raio sobrevive ao chanfro, porque tracejado nao
         * atravessa o recorte.
         */
        "nx-dotgrid flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 transition-colors",
        isDragActive
          ? "border-primary bg-primary/8"
          : "border-border hover:border-primary/50"
      )}
    >
      <input {...getInputProps()} />
      <Upload className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
