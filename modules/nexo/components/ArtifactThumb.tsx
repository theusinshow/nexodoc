"use client";

/**
 * Wrapper client-only da miniatura (react-pdf não pode renderizar no server — o
 * pdfjs precisa do DOM). `dynamic(ssr:false)` isola o import pesado; enquanto
 * carrega, um skeleton na forma final.
 */

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { ArtifactThumbProps } from "./ArtifactThumb-internal";

const Inner = dynamic(() => import("./ArtifactThumb-internal"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export function ArtifactThumb(props: ArtifactThumbProps) {
  return <Inner {...props} />;
}
