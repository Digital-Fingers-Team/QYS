import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

type CenterAccount = {
  number: number;
  name: string;
  location: string;
  email: string;
  password: string;
  role: "CENTER_MANAGER";
};

const expectedCenterCount = 146;

function readSeedBlock(source: string, constName: string) {
  const marker = `const ${constName} = \``;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Could not find ${constName} in seed.ts`);
  const contentStart = start + marker.length;
  const end = source.indexOf("`", contentStart);
  if (end < 0) throw new Error(`Could not find the end of ${constName} in seed.ts`);
  return source.slice(contentStart, end).trim();
}

function parseCenterAccounts(seedPath: string): CenterAccount[] {
  const source = fs.readFileSync(seedPath, "utf8");
  const rows = [readSeedBlock(source, "centerRows"), readSeedBlock(source, "additionalCenterRows")]
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length !== expectedCenterCount) {
    throw new Error(`Expected ${expectedCenterCount} centers, found ${rows.length}.`);
  }

  return rows.map((row, index) => {
    const [name, location] = row.split("|");
    const accountNumber = String(index + 1).padStart(3, "0");
    return {
      number: index + 1,
      name,
      location,
      email: `center-${accountNumber}@qys.local`,
      password: `QysCenter-${accountNumber}!2026`,
      role: "CENTER_MANAGER"
    };
  });
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

  for (const account of accounts) {
    sheet.addRow({
      ...account,
      name: safeCell(account.name),
      location: safeCell(account.location)
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

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
}

async function main() {
  const apiDir = path.resolve(__dirname, "..");
  const seedPath = path.join(apiDir, "src", "seed.ts");
  const outputPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(apiDir, "..", "..", "center-accounts.xlsx");
  const accounts = parseCenterAccounts(seedPath);

  await writeWorkbook(accounts, outputPath);
  console.log(`Wrote ${accounts.length} center accounts to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
