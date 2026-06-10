export const ALLOWED_CV_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".rtf"] as const;

export const ALLOWED_CV_ACCEPT =
  ".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf";

export const ALLOWED_CV_LABEL = "PDF, Word, RTF, or TXT";

export function isAllowedCvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ALLOWED_CV_EXTENSIONS.some((ext) => name.endsWith(ext));
}
