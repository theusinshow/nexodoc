export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function isValidPdfFileName(fileName: string): boolean {
  if (!fileName || fileName.trim() === "") {
    return false;
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return false;
  }

  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(fileName)) {
    return false;
  }

  if (fileName.includes(" ")) {
    return false;
  }

  return true;
}
