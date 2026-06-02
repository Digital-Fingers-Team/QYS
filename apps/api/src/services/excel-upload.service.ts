import crypto from "crypto";
import path from "path";
import multer from "multer";
import { env } from "../config/env";
import { ApiError } from "../errors/api-error";

const allowedExtension = ".xlsx";
const allowedMimeTypes = new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const forbiddenEntryExtensions = new Set([".bat", ".bin", ".cmd", ".com", ".dll", ".exe", ".js", ".msi", ".ps1", ".scr", ".sh", ".vba", ".vbs"]);
const maxZipEntries = 200;
const maxTotalUncompressedBytes = 25 * 1024 * 1024;
const maxCompressionRatio = 100;

export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.EXCEL_MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
    fields: 2,
    fieldSize: 128,
    parts: 3
  },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== allowedExtension) {
      return callback(new ApiError(400, "Only .xlsx files are accepted.", "INVALID_EXTENSION"));
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(400, "Invalid Excel MIME type.", "INVALID_MIME_TYPE"));
    }
    return callback(null, true);
  }
});

export function sanitizeOriginalFilename(name: string) {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, ext)
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return `${base || "monthly-report"}${allowedExtension}`;
}

export function safeStoredFilename() {
  return `${crypto.randomUUID()}${allowedExtension}`;
}

export function fileHash(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function hasXlsxSignature(buffer: Buffer) {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function inspectZipContainer(buffer: Buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new ApiError(400, "Malformed .xlsx ZIP container.", "INVALID_ZIP_CONTAINER");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount <= 0 || entryCount > maxZipEntries) throw new ApiError(400, "Workbook contains too many ZIP entries.", "ZIP_ENTRY_LIMIT");
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) throw new ApiError(400, "Malformed .xlsx central directory.", "INVALID_ZIP_CONTAINER");

  let offset = centralDirectoryOffset;
  let totalUncompressed = 0;
  let hasWorkbook = false;
  let hasWorksheet = false;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new ApiError(400, "Malformed .xlsx central directory entry.", "INVALID_ZIP_CONTAINER");
    }

    const generalPurposeFlag = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > buffer.length) throw new ApiError(400, "Malformed .xlsx ZIP entry name.", "INVALID_ZIP_CONTAINER");

    const entryName = buffer.toString("utf8", nameStart, nameEnd);
    const normalizedEntry = entryName.replace(/\\/g, "/").toLowerCase();
    const entryExtension = path.extname(normalizedEntry);

    if ((generalPurposeFlag & 0x0001) !== 0) throw new ApiError(400, "Encrypted workbooks are not accepted.", "ENCRYPTED_WORKBOOK");
    if (normalizedEntry.includes("..") || normalizedEntry.startsWith("/")) throw new ApiError(400, "Unsafe workbook ZIP entry.", "UNSAFE_ZIP_ENTRY");
    if (normalizedEntry.includes("vbaproject") || forbiddenEntryExtensions.has(entryExtension)) {
      throw new ApiError(400, "Workbook contains executable or macro content.", "EXECUTABLE_CONTENT_REJECTED");
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxTotalUncompressedBytes) throw new ApiError(400, "Workbook expands beyond the allowed size.", "ZIP_BOMB_REJECTED");
    if (compressedSize > 0 && uncompressedSize / compressedSize > maxCompressionRatio) {
      throw new ApiError(400, "Workbook compression ratio is unsafe.", "ZIP_BOMB_REJECTED");
    }
    if (normalizedEntry === "xl/workbook.xml") hasWorkbook = true;
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(normalizedEntry)) hasWorksheet = true;

    offset = nameEnd + extraFieldLength + commentLength;
  }

  if (!hasWorkbook || !hasWorksheet) throw new ApiError(400, "Workbook structure is incomplete.", "INVALID_EXCEL_STRUCTURE");
}

export function validateExcelFile(file?: Express.Multer.File) {
  if (!file) throw new ApiError(400, "Please choose an Excel file to upload.", "FILE_REQUIRED");
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension !== allowedExtension) throw new ApiError(400, "Only .xlsx files are accepted.", "INVALID_EXTENSION");
  if (!allowedMimeTypes.has(file.mimetype)) throw new ApiError(400, "Invalid Excel MIME type.", "INVALID_MIME_TYPE");
  if (!hasXlsxSignature(file.buffer)) throw new ApiError(400, "File content does not match .xlsx format.", "INVALID_FILE_SIGNATURE");
  inspectZipContainer(file.buffer);
  return {
    extension,
    originalName: sanitizeOriginalFilename(file.originalname),
    storedName: safeStoredFilename(),
    hash: fileHash(file.buffer)
  };
}
