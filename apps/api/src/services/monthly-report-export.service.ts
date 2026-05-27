import ExcelJS from "exceljs";
import type { CenterRecord } from "../db";
import type { MonthlyReportRow } from "@qys/shared";

function safeCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function buildMonthlyReportWorkbook(month: string, centers: CenterRecord[], reports: MonthlyReportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QYS Platform";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Monthly Report", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "center_name", key: "centerName", width: 36 },
    { header: "month", key: "month", width: 14 },
    { header: "revenues", key: "revenues", width: 16 },
    { header: "expenses", key: "expenses", width: 16 },
    { header: "seminars_count", key: "seminarsCount", width: 18 },
    { header: "status", key: "status", width: 16 }
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F7A5C" } };
  sheet.getRow(1).alignment = { horizontal: "center" };

  const byCenter = new Map(reports.map((report) => [report.centerId, report]));
  for (const center of centers) {
    const report = byCenter.get(center.id);
    sheet.addRow({
      centerName: safeCell(center.name),
      month,
      revenues: report?.revenues ?? 0,
      expenses: report?.expenses ?? 0,
      seminarsCount: report?.seminarsCount ?? 0,
      status: report ? "تم الرفع" : "لم يتم الرفع"
    });
  }

  const totalRow = sheet.addRow({
    centerName: "الإجمالي",
    month,
    revenues: reports.reduce((total, report) => total + report.revenues, 0),
    expenses: reports.reduce((total, report) => total + report.expenses, 0),
    seminarsCount: reports.reduce((total, report) => total + report.seminarsCount, 0),
    status: ""
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE7E0" } };

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDCE7E0" } },
        left: { style: "thin", color: { argb: "FFDCE7E0" } },
        bottom: { style: "thin", color: { argb: "FFDCE7E0" } },
        right: { style: "thin", color: { argb: "FFDCE7E0" } }
      };
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildMonthlyTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monthly Report", { views: [{ rightToLeft: true }] });
  sheet.columns = [
    { header: "center_name", key: "centerName", width: 36 },
    { header: "month", key: "month", width: 14 },
    { header: "revenues", key: "revenues", width: 16 },
    { header: "expenses", key: "expenses", width: 16 },
    { header: "seminars_count", key: "seminarsCount", width: 18 }
  ];
  sheet.addRow({ centerName: "اسم المركز كما هو في النظام", month: "2026-05", revenues: 0, expenses: 0, seminarsCount: 0 });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F7A5C" } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
