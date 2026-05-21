import { ChangeEvent, useRef } from "react";
import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";

type FileUploadProps = {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
};

export function FileUpload({
  onFilesSelected,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    onFilesSelected(selectedFiles);
    event.target.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Paperclip />
        Anexar PDFs
      </Button>
    </>
  );
}
