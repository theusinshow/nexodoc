"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const PdfPageThumbnailGridInternal = dynamic(
  () => import("./pdf-page-thumbnail-grid-internal"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface PdfPageThumbnailGridProps {
  file: File;
  pageCount: number;
  selectedPages?: number[];
  onPageSelect?: (page: number) => void;
  onRangeSelect?: (start: number, end: number) => void;
}

export function PdfPageThumbnailGrid(props: PdfPageThumbnailGridProps) {
  return <PdfPageThumbnailGridInternal {...props} />;
}
