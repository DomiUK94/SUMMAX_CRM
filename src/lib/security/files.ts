const IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream"
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
]);

const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  ".exe",
  ".msi",
  ".bat",
  ".cmd",
  ".com",
  ".js",
  ".mjs",
  ".cjs",
  ".vbs",
  ".ps1",
  ".scr",
  ".jar",
  ".sh",
  ".hta",
  ".docm",
  ".xlsm",
  ".pptm"
]);

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream"
]);

function getLowerExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index >= 0 ? normalized.slice(index) : "";
}

export function validateImportFile(file: File) {
  const extension = getLowerExtension(file.name);
  if (file.size === 0) {
    throw new Error("file_missing");
  }
  if (file.size > IMPORT_MAX_FILE_SIZE_BYTES) {
    throw new Error("file_too_large");
  }
  if (extension !== ".xlsx") {
    throw new Error("xlsx_required_for_sourcecrm_import");
  }
  if (file.type && !XLSX_MIME_TYPES.has(file.type)) {
    throw new Error("invalid_import_mime_type");
  }
}

export function validateAttachmentFile(file: File) {
  const extension = getLowerExtension(file.name);
  if (file.size === 0) {
    throw new Error("file_missing");
  }
  if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
    throw new Error("file_too_large");
  }
  if (!extension || BLOCKED_ATTACHMENT_EXTENSIONS.has(extension)) {
    throw new Error("file_type_blocked");
  }
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
    throw new Error("file_type_not_allowed");
  }
  if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
    throw new Error("file_type_not_allowed");
  }
}

export const FILE_LIMITS = {
  importMaxBytes: IMPORT_MAX_FILE_SIZE_BYTES,
  attachmentMaxBytes: ATTACHMENT_MAX_FILE_SIZE_BYTES
};
