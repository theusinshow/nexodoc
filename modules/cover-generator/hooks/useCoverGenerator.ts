"use client";

import { useState, useCallback } from "react";
import type { CoverGroup, CoverPage, GeneralData } from "../types";
import { generatePages } from "./helpers";
import type { CoverTitleMode, TomoFormat, VolumeFormat } from "@/lib/cover-utils";

export function emptyGeneralData(): GeneralData {
  return {
    templateId: "",
    orgao: "",
    secretaria: "",
    nomeObra: "",
    fase: "",
    mes: "",
    ano: new Date().getFullYear().toString(),
    codigoInterno: "",
    codigoExibido: "",
    siglaArquivo: "",
    revisao: "",
  };
}

export interface InitialData {
  codigoInterno?: string;
  codigoExibido?: string;
  revisao?: string;
  nomeObra?: string;
  fase?: string;
  orgao?: string;
  tomos?: string[];
  volume?: string;
}

interface TemplateDefaults {
  orgao: string;
  secretaria: string;
  fase: string;
  volumeFormat?: VolumeFormat;
  tomoFormat?: TomoFormat;
  coverTitleMode?: CoverTitleMode;
  campos?: string[];
}

export function useCoverGenerator(initialData?: InitialData) {
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState("");
  const [templateFields, setTemplateFields] = useState<string[]>([]);
  const [fromLd, setFromLd] = useState(!!initialData);
  const [volumeFormat, setVolumeFormat] = useState<VolumeFormat>("roman");
  const [tomoFormat, setTomoFormat] = useState<TomoFormat>("parenthesized-padded");
  const [coverTitleMode, setCoverTitleMode] = useState<CoverTitleMode>("items");
  const [generalData, setGeneralData] = useState<GeneralData>(() => {
    const base = emptyGeneralData();
    if (initialData) {
      return {
        ...base,
        codigoInterno: initialData.codigoInterno ?? base.codigoInterno,
        codigoExibido: initialData.codigoExibido ?? base.codigoExibido,
        revisao: initialData.revisao ?? base.revisao,
        nomeObra: initialData.nomeObra ?? base.nomeObra,
        fase: initialData.fase ?? base.fase,
        orgao: initialData.orgao ?? base.orgao,
      };
    }
    return base;
  });
  const [groups, setGroups] = useState<CoverGroup[]>(() => {
    if (initialData?.tomos && initialData.tomos.length > 0) {
      return [
        {
          id: crypto.randomUUID(),
          tituloCapa: initialData.nomeObra ?? "",
          disciplina: "",
          volume: initialData.volume ?? "I",
          tomoMode: "list",
          tomoQuantity: 1,
          tomoList: initialData.tomos,
        },
      ];
    }
    return [];
  });
  const [pages, setPages] = useState<CoverPage[]>([]);

  const goToStep = useCallback((n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selectTemplate = useCallback(
    (id: string, defaults?: TemplateDefaults) => {
      setTemplateId(id);
      if (defaults?.volumeFormat) {
        setVolumeFormat(defaults.volumeFormat);
      }
      setTomoFormat(defaults?.tomoFormat ?? "parenthesized-padded");
      setCoverTitleMode(defaults?.coverTitleMode ?? "items");
      setTemplateFields(defaults?.campos ?? []);
      setGeneralData((prev) => ({
        ...prev,
        templateId: id,
        orgao: prev.orgao || defaults?.orgao || "",
        secretaria: prev.secretaria || defaults?.secretaria || "",
        fase: prev.fase || defaults?.fase || "",
      }));
    },
    []
  );

  const updateGeneralData = useCallback(
    (partial: Partial<GeneralData>) => {
      setGeneralData((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const addGroup = useCallback(() => {
    const group: CoverGroup = {
      id: crypto.randomUUID(),
      tituloCapa: "",
      disciplina: "",
      volume: volumeFormat === "numeric" ? "1" : "I",
      tomoMode: "quantity",
      tomoQuantity: 1,
      tomoList: [],
    };
    setGroups((prev) => [...prev, group]);
  }, [volumeFormat]);

  const updateGroup = useCallback((id: string, partial: Partial<CoverGroup>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...partial } : g))
    );
  }, []);

  const removeGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const buildPages = useCallback(() => {
    setPages((currentPages) =>
      generatePages(
        groups,
        currentPages.length > 0 ? currentPages : undefined,
        volumeFormat,
        tomoFormat
      )
    );
  }, [groups, tomoFormat, volumeFormat]);

  const updatePage = useCallback(
    (id: string, partial: Partial<CoverPage>) => {
      setPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...partial } : p))
      );
    },
    []
  );

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    });
  }, []);

  const addPage = useCallback(() => {
    setPages((prev) => {
      const page: CoverPage = {
        id: crypto.randomUUID(),
        groupId: "",
        tituloCapa: "",
        disciplina: "",
        tomo: "",
        volume: "",
        pageNumber: prev.length + 1,
      };
      return [...prev, page];
    });
  }, []);

  const reorderPages = useCallback((newOrder: CoverPage[]) => {
    setPages(newOrder.map((p, i) => ({ ...p, pageNumber: i + 1 })));
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setTemplateId("");
    setTemplateFields([]);
    setFromLd(false);
    setVolumeFormat("roman");
    setTomoFormat("parenthesized-padded");
    setCoverTitleMode("items");
    setGeneralData(emptyGeneralData());
    setGroups([]);
    setPages([]);
  }, []);

  return {
    step,
    templateId,
    templateFields,
    generalData,
    groups,
    pages,
    fromLd,
    volumeFormat,
    tomoFormat,
    coverTitleMode,
    goToStep,
    selectTemplate,
    updateGeneralData,
    addGroup,
    updateGroup,
    removeGroup,
    buildPages,
    updatePage,
    removePage,
    addPage,
    reorderPages,
    reset,
  };
}
