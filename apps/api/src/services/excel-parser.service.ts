import ExcelJS from "exceljs";
import { ApiError } from "../errors/api-error";

const requiredHeaders = ["event_name", "month", "revenues", "expenses", "seminars_count"] as const;
type RequiredHeader = (typeof requiredHeaders)[number];
const maxRows = 20;
const maxColumns = requiredHeaders.length;

export type ParsedMonthlyReport = {
  eventName: string;
  month: string;
  revenues: number;
  expenses: number;
  seminarsCount: number;
};

function isFormulaOrLink(value: ExcelJS.CellValue) {
  return Boolean(value && typeof value === "object" && ("formula" in value || "sharedFormula" in value || "hyperlink" in value));
}

function cellText(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") return "";
  return String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function parseNumber(value: unknown, label: string) {
  const text = cellText(value);
  const raw = typeof value === "number" ? value : Number(text.replace(/,/g, ""));
  if (!Number.isFinite(raw)) throw new ApiError(400, `${label} must be a valid number.`, "INVALID_EXCEL_VALUE");
  if (raw < 0) throw new ApiError(400, `${label} cannot be negative.`, "INVALID_EXCEL_VALUE");
  if (raw > Number.MAX_SAFE_INTEGER) throw new ApiError(400, `${label} is too large.`, "INVALID_EXCEL_VALUE");
  return raw;
}

function readRow(row: ExcelJS.Row) {
  const values: unknown[] = [];
  for (let column = 1; column <= maxColumns; column += 1) {
    const cell = row.getCell(column);
    if (isFormulaOrLink(cell.value)) throw new ApiError(400, "Workbook formulas and hyperlinks are not accepted.", "UNSAFE_EXCEL_CELL");
    values.push(cell.value);
  }
  return values;
}

function assertNoExtraCells(sheet: ExcelJS.Worksheet) {
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > maxRows) throw new ApiError(400, "Workbook contains too many rows.", "INVALID_EXCEL_STRUCTURE");
    for (let column = maxColumns + 1; column <= row.cellCount; column += 1) {
      const cell = row.getCell(column);
      if (isFormulaOrLink(cell.value)) throw new ApiError(400, "Workbook formulas and hyperlinks are not accepted.", "UNSAFE_EXCEL_CELL");
      if (cellText(cell.value)) throw new ApiError(400, "Workbook contains unexpected columns.", "INVALID_COLUMNS");
    }
  });
}

export async function parseMonthlyReportExcel(buffer: Buffer): Promise<ParsedMonthlyReport> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new ApiError(400, "Could not read Excel workbook.", "INVALID_EXCEL_FILE");
  }

  if (workbook.worksheets.length !== 1) {
    throw new ApiError(400, "Workbook must contain exactly one worksheet.", "INVALID_EXCEL_STRUCTURE");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount < 2) {
    throw new ApiError(400, "Workbook must contain one header row and one data row.", "INVALID_EXCEL_STRUCTURE");
  }

  assertNoExtraCells(sheet);

  const headers = readRow(sheet.getRow(1)).map(cellText);
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) throw new ApiError(400, `Missing required columns: ${requiredHeaders.join(", ")}.`, "MISSING_COLUMNS", { missing });

  const extras = headers.filter((header) => header && !requiredHeaders.includes(header as RequiredHeader));
  if (extras.length) throw new ApiError(400, "Workbook contains unexpected columns.", "INVALID_COLUMNS", { extras });

  const dataRows = sheet
    .getRows(2, Math.min(maxRows - 1, Math.max(sheet.actualRowCount, 1)))!
    .filter((row) => readRow(row).some((cell) => cellText(cell)));
  if (dataRows.length !== 1) throw new ApiError(400, "Workbook must contain exactly one data row.", "INVALID_ROW_COUNT");

  const rowValues = readRow(dataRows[0]);
  const value = (header: RequiredHeader) => rowValues[headers.indexOf(header)];
  const eventName = cellText(value("event_name"));
  const month = cellText(value("month"));
  if (!eventName) throw new ApiError(400, "event_name is required.", "MISSING_VALUE");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, "month must use YYYY-MM format.", "INVALID_MONTH");

  const revenues = parseNumber(value("revenues"), "revenues");
  const expenses = parseNumber(value("expenses"), "expenses");
  const seminarsCount = parseNumber(value("seminars_count"), "seminars_count");
  if (!Number.isInteger(seminarsCount)) throw new ApiError(400, "seminars_count must be an integer.", "INVALID_EXCEL_VALUE");

  return { eventName, month, revenues, expenses, seminarsCount };
}
