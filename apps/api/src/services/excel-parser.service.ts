import * as XLSX from "xlsx";
import { ApiError } from "../errors/api-error";

const requiredHeaders = ["center_name", "month", "revenues", "expenses", "seminars_count"] as const;
type RequiredHeader = (typeof requiredHeaders)[number];

export type ParsedMonthlyReport = {
  centerName: string;
  month: string;
  revenues: number;
  expenses: number;
  seminarsCount: number;
};

function cellText(value: unknown) {
  return String(value ?? "").trim();
}

function parseNumber(value: unknown, label: string) {
  const raw = typeof value === "number" ? value : Number(cellText(value).replace(/,/g, ""));
  if (!Number.isFinite(raw)) throw new ApiError(400, `${label} يجب أن يكون رقماً صحيحاً.`, "INVALID_EXCEL_VALUE");
  if (raw < 0) throw new ApiError(400, `${label} لا يمكن أن يكون أقل من صفر.`, "INVALID_EXCEL_VALUE");
  return raw;
}

export function parseMonthlyReportExcel(buffer: Buffer): ParsedMonthlyReport {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch {
    throw new ApiError(400, "تعذر قراءة ملف Excel. تأكد من أن الملف غير تالف.", "INVALID_EXCEL_FILE");
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new ApiError(400, "ملف Excel لا يحتوي على أي أوراق عمل.", "EMPTY_WORKBOOK");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], { header: 1, defval: "", blankrows: false });
  if (rows.length < 2) throw new ApiError(400, "الملف يجب أن يحتوي على صف عناوين وصف بيانات واحد.", "INVALID_EXCEL_STRUCTURE");

  const headers = rows[0].map(cellText);
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new ApiError(400, `أعمدة الملف غير مكتملة. الأعمدة المطلوبة: ${requiredHeaders.join(", ")}.`, "MISSING_COLUMNS", { missing });
  }
  const extras = headers.filter((header) => header && !requiredHeaders.includes(header as RequiredHeader));
  if (extras.length) {
    throw new ApiError(400, "قالب الملف غير صحيح. يرجى استخدام القالب المعتمد كما هو.", "INVALID_COLUMNS", { extras });
  }

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cellText(cell)));
  if (dataRows.length !== 1) {
    throw new ApiError(400, "الملف يجب أن يحتوي على صف بيانات واحد فقط للمركز والشهر.", "INVALID_ROW_COUNT");
  }

  const row = dataRows[0];
  const value = (header: RequiredHeader) => row[headers.indexOf(header)];
  const centerName = cellText(value("center_name"));
  const month = cellText(value("month"));
  if (!centerName) throw new ApiError(400, "اسم المركز مطلوب في عمود center_name.", "MISSING_VALUE");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, "الشهر يجب أن يكون بصيغة YYYY-MM مثل 2026-05.", "INVALID_MONTH");

  const revenues = parseNumber(value("revenues"), "الإيرادات");
  const expenses = parseNumber(value("expenses"), "المصروفات");
  const seminarsCount = parseNumber(value("seminars_count"), "عدد الندوات");
  if (!Number.isInteger(seminarsCount)) throw new ApiError(400, "عدد الندوات يجب أن يكون رقماً صحيحاً.", "INVALID_EXCEL_VALUE");

  return { centerName, month, revenues, expenses, seminarsCount };
}
