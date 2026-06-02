"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PageRangeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function PageRangeInput({
  value,
  onChange,
  placeholder = "Ex: 1-10 ou 1,3,5",
  label = "Selecao de paginas",
}: PageRangeInputProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}
