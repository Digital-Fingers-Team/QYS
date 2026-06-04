import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { authLoginSchema, centerSchema, paginationQuerySchema, profileUpdateSchema } from "@qys/shared";

function configureEnv() {
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URL = "mongodb://localhost:27017/qys_test";
  process.env.JWT_SECRET = "test_secret_with_at_least_32_chars";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

async function workbookBuffer(row: Record<string, unknown>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monthly Report");
  sheet.columns = [
    { header: "event_name", key: "eventName" },
    { header: "month", key: "month" },
    { header: "revenues", key: "revenues" },
    { header: "expenses", key: "expenses" }
  ];
  sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function uploadFile(buffer: Buffer, originalname = "report.xlsx", mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
  return {
    buffer,
    originalname,
    mimetype,
    size: buffer.length,
    fieldname: "file",
    encoding: "7bit",
    destination: "",
    filename: originalname,
    path: "",
    stream: undefined as never
  };
}

test("shared auth schemas reject unknown fields", () => {
  assert.throws(() => authLoginSchema.parse({ email: "user@example.com", password: "password", role: "ADMIN" }));
});

test("shared text schemas normalize control characters", () => {
  const center = centerSchema.parse({
    name: " Test\u0000 Center ",
    location: " Cairo ",
    type: "Youth",
    description: " Safe description "
  });
  assert.equal(center.name, "Test Center");
});

test("shared pagination schema coerces bounded page parameters", () => {
  assert.deepEqual(paginationQuerySchema.parse({ page: "2", pageSize: "25" }), { page: 2, pageSize: 25 });
  assert.throws(() => paginationQuerySchema.parse({ page: "1", pageSize: "101" }));
});

test("shared profile schema accepts empty avatar removal marker", () => {
  assert.deepEqual(profileUpdateSchema.parse({ avatar: "" }), { avatar: "" });
});

test("Excel upload validation accepts valid xlsx and assigns safe names", async () => {
  configureEnv();
  const { validateExcelFile } = await import("./services/excel-upload.service");
  const buffer = await workbookBuffer({ eventName: "Event", month: "2026-05", revenues: 1, expenses: 1 });
  const metadata = validateExcelFile(uploadFile(buffer, "../evil.xlsx"));
  assert.match(metadata.storedName, /^[0-9a-f-]{36}\.xlsx$/);
  assert.equal(metadata.originalName, "evil.xlsx");
});

test("Excel upload validation rejects malformed zip containers", async () => {
  configureEnv();
  const { validateExcelFile } = await import("./services/excel-upload.service");
  assert.throws(
    () => validateExcelFile(uploadFile(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))),
    /Malformed|Invalid|ZIP/
  );
});

test("Excel parser rejects formulas", async () => {
  const { parseMonthlyReportExcel } = await import("./services/excel-parser.service");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monthly Report");
  sheet.addRow(["event_name", "month", "revenues", "expenses"]);
  sheet.addRow(["Event", "2026-05", { formula: "1+1", result: 2 }, 1]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(() => parseMonthlyReportExcel(buffer), /formulas|UNSAFE_EXCEL_CELL/);
});
