import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

type CenterAccount = {
  number?: number;
  name: string;
  location: string;
  email: string;
  password: string;
  role: "CENTER_MANAGER";
};

const requiredHeaders = ["Center Name", "Location", "Email", "Password", "Role"] as const;

function cellText(row: ExcelJS.Row, columnNumber: number): string {
  return row.getCell(columnNumber).text.trim();
}

function headerColumns(sheet: ExcelJS.Worksheet): Map<string, number> {
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = cell.text.trim();
    if (header) headers.set(header, columnNumber);
  });
  return headers;
}

function requiredColumn(headers: Map<string, number>, name: string): number {
  const column = headers.get(name);
  if (!column) throw new Error(`center-accounts.xlsx is missing the "${name}" column`);
  return column;
}

async function readWorkbookAccounts(workbookPath: string): Promise<CenterAccount[]> {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Missing center accounts workbook: ${workbookPath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("center-accounts.xlsx does not contain a worksheet");

  const headers = headerColumns(sheet);
  const columns = {
    number: headers.get("No."),
    name: requiredColumn(headers, "Center Name"),
    location: requiredColumn(headers, "Location"),
    email: requiredColumn(headers, "Email"),
    password: requiredColumn(headers, "Password"),
    role: requiredColumn(headers, "Role")
  };
  const accounts: CenterAccount[] = [];
  const seenCenters = new Set<string>();
  const seenEmails = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row, columns.name);
    const location = cellText(row, columns.location);
    const email = cellText(row, columns.email).toLowerCase();
    const password = cellText(row, columns.password);
    const role = cellText(row, columns.role);
    if (!name && !location && !email && !password && !role) return;
    if (!name || !location || !email || !password) {
      throw new Error(`center-accounts.xlsx row ${rowNumber} must include center name, location, email, and password`);
    }
    if (role !== "CENTER_MANAGER") {
      throw new Error(`center-accounts.xlsx row ${rowNumber} must use CENTER_MANAGER role`);
    }
    if (seenCenters.has(name)) throw new Error(`Duplicate center name in center-accounts.xlsx: ${name}`);
    if (seenEmails.has(email)) throw new Error(`Duplicate center email in center-accounts.xlsx: ${email}`);
    seenCenters.add(name);
    seenEmails.add(email);
    accounts.push({
      number: columns.number ? Number(cellText(row, columns.number)) || accounts.length + 1 : accounts.length + 1,
      name,
      location,
      email,
      password,
      role
    });
  });

  if (accounts.length === 0) throw new Error("center-accounts.xlsx does not contain any center accounts");
  return accounts;
}

function safeCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

async function writeWorkbook(accounts: CenterAccount[], outputPath: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QYS Platform";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Center Accounts", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "No.", key: "number", width: 8 },
    { header: "Center Name", key: "name", width: 46 },
    { header: "Location", key: "location", width: 28 },
    { header: "Email", key: "email", width: 28 },
    { header: "Password", key: "password", width: 24 },
    { header: "Role", key: "role", width: 20 }
  ];

  for (const [index, account] of accounts.entries()) {
    sheet.addRow({
      number: account.number ?? index + 1,
      name: safeCell(account.name),
      location: safeCell(account.location),
      email: account.email,
      password: account.password,
      role: account.role
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length }
  };

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F7A5C" } };
  sheet.getRow(1).alignment = { horizontal: "center" };

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDCE7E0" } },
        left: { style: "thin", color: { argb: "FFDCE7E0" } },
        bottom: { style: "thin", color: { argb: "FFDCE7E0" } },
        right: { style: "thin", color: { argb: "FFDCE7E0" } }
      };
    });
  });

  for (const header of requiredHeaders) {
    if (!sheet.getRow(1).values?.toString().includes(header)) {
      throw new Error(`Failed to write required "${header}" column`);
    }
  }

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}

async function main() {
  const apiDir = path.resolve(__dirname, "..");
  const defaultWorkbookPath = path.resolve(apiDir, "..", "..", "center-accounts.xlsx");
  const sourcePath = process.env.CENTER_ACCOUNTS_XLSX
    ? path.resolve(process.cwd(), process.env.CENTER_ACCOUNTS_XLSX)
    : defaultWorkbookPath;
  const outputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : sourcePath;
  const accounts = await readWorkbookAccounts(sourcePath);

  await writeWorkbook(accounts, outputPath);
  console.log(`Wrote ${accounts.length} center accounts to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
