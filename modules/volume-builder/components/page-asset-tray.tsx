"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { PageAsset } from "@/modules/volume-builder/lib/volume/volume-types";

const PageAssetTrayInternal = dynamic(
  () => import("./page-asset-tray-internal"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-md border border-dashed py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface PageAssetTrayProps {
  assets: PageAsset[];
  fileDataMap: Map<string, File>;
  selectedAssetIds: string[];
  onSelectedAssetIdsChange: (ids: string[]) => void;
  onAssetsChange: (assets: PageAsset[]) => void;
  onSendToCover: (asset: PageAsset) => void;
  onSendToLd: (asset: PageAsset) => void;
  onSendToDocuments: (assets: PageAsset[]) => void;
}

export function PageAssetTray(props: PageAssetTrayProps) {
  return <PageAssetTrayInternal {...props} />;
}
