import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import type { CenterInput } from "@qys/shared";
import { db, disconnectDatabase, initDatabase, type CenterRecord } from "./db";

const imagePool = [
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
  "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800",
  "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800"
];

type CenterAccountSeed = {
  rowNumber: number;
  name: string;
  location: string;
  email: string;
  password: string;
};

const centerAccountsWorkbookPath = process.env.CENTER_ACCOUNTS_XLSX
  ? path.resolve(process.cwd(), process.env.CENTER_ACCOUNTS_XLSX)
  : path.resolve(__dirname, "..", "..", "..", "center-accounts.xlsx");

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

async function loadCenterAccounts(): Promise<CenterAccountSeed[]> {
  if (!fs.existsSync(centerAccountsWorkbookPath)) {
    throw new Error(`Missing center accounts workbook: ${centerAccountsWorkbookPath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(centerAccountsWorkbookPath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("center-accounts.xlsx does not contain a worksheet");

  const headers = headerColumns(sheet);
  const columns = {
    name: requiredColumn(headers, "Center Name"),
    location: requiredColumn(headers, "Location"),
    email: requiredColumn(headers, "Email"),
    password: requiredColumn(headers, "Password"),
    role: requiredColumn(headers, "Role")
  };
  const accounts: CenterAccountSeed[] = [];
  const seenCenters = new Set<string>();
  const seenEmails = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row, columns.name);
    const location = cellText(row, columns.location);
    const email = cellText(row, columns.email).toLowerCase();
    const password = cellText(row, columns.password);
    const role = cellText(row, columns.role);
    if (!name && !location && !email && !password) return;
    if (!name || !location || !email || !password) {
      throw new Error(`center-accounts.xlsx row ${rowNumber} must include center name, location, email, and password`);
    }
    if (role && role !== "CENTER_MANAGER") {
      throw new Error(`center-accounts.xlsx row ${rowNumber} must use CENTER_MANAGER role`);
    }
    if (seenCenters.has(name)) throw new Error(`Duplicate center name in center-accounts.xlsx: ${name}`);
    if (seenEmails.has(email)) throw new Error(`Duplicate center email in center-accounts.xlsx: ${email}`);
    seenCenters.add(name);
    seenEmails.add(email);
    accounts.push({ rowNumber, name, location, email, password });
  });

  if (accounts.length === 0) throw new Error("center-accounts.xlsx does not contain any center accounts");
  return accounts;
}

const users = [
  { email: "user@example.com", password: process.env.SEED_USER_PASSWORD || "UserDevPass!2026", role: "USER" as const, name: "مستخدم تجريبي", points: 150 },
  { email: "admin@example.com", password: process.env.SEED_ADMIN_PASSWORD || "AdminDevPass!2026", role: "DIRECTORATE_MANAGER" as const, name: "مدير المديرية", points: 0 }
];

const centerRows = `
مركز شباب إمياي|طوخ|4.5
مركز شباب السيفا|طوخ|4.2
مركز شباب طنط الجزيرة|طوخ|4.3
مركز شباب المنيرة|القناطر الخيرية|4.6
مركز شباب برشوم الكبرى|طوخ|4.1
مركز شباب العمار|طوخ|4.4
مركز شباب شبرا شهاب|القناطر الخيرية|4.2
مركز شباب أجهور الصغرى|القناطر الخيرية|4.3
مركز شباب الوقف|شبين القناطر|4
مركز شباب بهادة|القناطر الخيرية|4.2
مركز شباب البرادعة|القناطر الخيرية|4.5
مركز شباب صنافير|قليوب|4.1
مركز شباب حلابة|قليوب|4.2
مركز شباب قلما|قليوب|4.4
مركز شباب كفر بطا|بنها|4.3
مركز شباب طحلة|بنها|4.5
مركز شباب شبلنجة|بنها|4.2
مركز شباب جمجرة الجديدة|بنها|4.1
مركز شباب جمجرة الكبرى|بنها|4.3
مركز شباب كفر الجزار|بنها|4.6
مركز شباب نقباس|بنها|4.2
مركز شباب منية السباع|بنها|4
مركز شباب الرملة|بنها|4.4
مركز شباب المنشية|بنها|4.5
مركز شباب بطا|بنها|4.3
مركز شباب كفر الشيخ إبراهيم|بنها|4.1
مركز شباب بتمدة|بنها|4.2
مركز شباب جزيرة بلي|بنها|4.4
مركز شباب ميت الحوفيين|بنها|4.1
مركز شباب سندنهور|بنها|4.3
مركز شباب فرسيس|بنها|4.2
مركز شباب عزبة نجيب|بنها|4
مركز شباب كفر طحلة|بنها|4.2
مركز شباب كفر أبو ذكري|بنها|4.1
مركز شباب كفر الأربعين|بنها|4.3
مركز شباب منشأة دياب|بنها|4.2
مركز شباب كفر العرب|بنها|4.1
مركز شباب الحسانية|طوخ|4.3
مركز شباب شبرا هارس|طوخ|4.4
مركز شباب الناصرية|القناطر الخيرية|4.2
مركز شباب كفر الحدادين|طوخ|4.1
مركز شباب كفر علوان|قليوب|4.3
مركز شباب نامول|طوخ|4.4
مركز شباب الدير|طوخ|4.5
مركز شباب الصفا|شبين القناطر|4.2
مركز شباب الصالحية|شبين القناطر|4.3
مركز شباب كفر العمار|طوخ|4.1
مركز شباب كفر الجمال|طوخ|4.2
مركز شباب سندوة|الخانكة|4.4
مركز شباب سرياقوس|الخانكة|4.5
مركز شباب كفر الربعيين|شبين القناطر|4.1
مركز شباب 24 يوليو|شبين القناطر|4.3
مركز شباب كفر حمزة|الخانكة|4.2
مركز شباب الشقر|كفر شكر|4.4
مركز شباب كفر عامر|بنها|4.1
مركز شباب كفر عزب غنيم|القناطر الخيرية|4.3
مركز شباب كفر الولجا|كفر شكر|4.2
مركز شباب كفر رجب|شبين القناطر|4.4
مركز شباب كفر الحبش|شبين القناطر|4.1
مركز شباب زاوية النجار|قليوب|4.3
مركز شباب كفر الدير|طوخ|4.2
مركز شباب الشيخة سالمة|شبين القناطر|4.4
مركز شباب الشيخ سند|قليوب|4.1
مركز شباب القلزم|قليوب|4.3
مركز شباب كفر طحوريا|شبين القناطر|4.2
مركز شباب الجبلاوي وعمر|شبين القناطر|4.4
مركز شباب الحرية والسماع|شبين القناطر|4.1
مركز شباب سندبيس|القناطر الخيرية|4.3
مركز شباب قرنفيل|القناطر الخيرية|4.5
مركز شباب شلقان|القناطر الخيرية|4.2
`.trim();

const additionalCenterRows = `
مركز شباب 15 مايو|شبرا الخيمة|4.2
مركز شباب أجهور الكبرى|القناطر الخيرية|4.2
مركز شباب أسنيت|كفر شكر|4.2
مركز شباب الأحراز|شبين القناطر|4.2
مركز شباب الأمل|القليوبية|4.1
مركز شباب أبو المنجا|شبرا الخيمة|4.1
مركز شباب إبراهيم بك|القليوبية|4.1
مركز شباب الإصلاح الزراعي|قليوب|4.1
مركز شباب باسوس|القناطر الخيرية|4.3
مركز شباب بنها|بنها|4.3
مركز شباب بيجام|شبرا الخيمة|4.3
مركز شباب تصفا|كفر شكر|4.1
مركز شباب الخانكة|الخانكة|4.2
مركز شباب الخصوص الرياضي|الخصوص|4.2
مركز شباب دمنهور شبرا|شبرا الخيمة|4.1
مركز شباب الحدادين|طوخ|4.1
مركز شباب الحصة|طوخ|4.1
مركز شباب الساحل|شبرا الخيمة|4.1
مركز شباب سليم|شبرا الخيمة|4.1
مركز شباب سنديون|قليوب|4.3
مركز شباب سنهرة|طوخ|4.2
مركز شباب شبرا البلد|شبرا الخيمة|4.3
مركز شباب الشموت|بنها|4.1
مركز شباب الشرقاوية والفرنواني|شبرا الخيمة|4.2
مركز شباب الصفين|كفر شكر|4.1
مركز شباب طحانوب|شبين القناطر|4.1
مركز شباب عرب الغديري|طوخ|4.1
مركز شباب عرب جهينة|شبين القناطر|4.1
مركز شباب العبادلة|طوخ|4.2
مركز شباب العبور|العبور|4.2
مركز شباب العسايلة|شبين القناطر|4.2
مركز شباب عزبة الجندي|قليوب|4.1
مركز شباب عزيز وبدوي|بنها|4.3
مركز شباب الفاخورة|بنها|4.3
مركز شباب القلج|الخانكة|4.2
مركز شباب القناطر الخيرية|القناطر الخيرية|4.2
مركز شباب قليوب|قليوب|4.3
مركز شباب قها|طوخ|4.3
مركز شباب كفر تصفا|كفر شكر|4.1
مركز شباب كفر الحصة|بنها|4.1
مركز شباب كفر الشرفا القبلي|شبين القناطر|4.1
مركز شباب كفر الشوبك|بنها|4.1
مركز شباب كفر الشموت|بنها|4.1
مركز شباب كفر الصهبي|شبين القناطر|4.1
مركز شباب كفر علي|القليوبية|4.1
مركز شباب كفر عابد|طوخ|4.1
مركز شباب كفر عبيان|القليوبية|4.1
مركز شباب كفر كردي|كفر شكر|4.1
مركز شباب كفر منصور|القليوبية|4.1
مركز شباب كفر مناقر|بنها|4.2
مركز شباب كفر رضوان|القليوبية|4.1
مركز شباب كفر شبين|شبين القناطر|4.1
مركز شباب كفر فرسيس|بنها|4.1
مركز شباب مدينة شبين القناطر|شبين القناطر|4.3
مركز شباب مدينة كفر شكر|كفر شكر|4.3
مركز شباب مساكن إسكو|شبرا الخيمة|4.1
مركز شباب مشتهر|طوخ|4.2
مركز شباب المفتي|كفر شكر|4.1
مركز شباب المنشأة الصغرى|كفر شكر|4.1
مركز شباب المنشأة الكبرى|كفر شكر|4.2
مركز شباب المنزلة|القليوبية|4.1
مركز شباب المنشية الجديدة|شبرا الخيمة|4.3
مركز شباب منشأة الكرام|شبين القناطر|4.2
مركز شباب منشية مشتهر|طوخ|4.1
مركز شباب منطى|شبرا الخيمة|4.3
مركز شباب منية شبين|شبين القناطر|4.1
مركز شباب ميت الدريج|كفر شكر|4.1
مركز شباب ميت كنانة|طوخ|4.2
مركز شباب ميت نما|شبرا الخيمة|4.2
مركز شباب ميت راضي|بنها|4.1
مركز شباب ناصر|شبرا الخيمة|4.2
مركز شباب نوى|شبين القناطر|4.1
مركز شباب طنان|قليوب|4.1
مركز شباب مرصفا|بنها|4.1
مركز شباب برقطا|كفر شكر|4.1
مركز شباب كفر طحا|شبين القناطر|4.1
`.trim();

const seededCenterRows = [centerRows, additionalCenterRows].filter(Boolean).join("\n");

const centers = seededCenterRows.split("\n").map((row, index) => {
  const [name, location, rating] = row.split("|");
  return {
    name,
    location,
    rating: Number(rating),
    type: "مركز شباب",
    image: imagePool[index % imagePool.length],
    description: `${name} في ${location}`
  };
});

const challenges = [
  {
    title: "تحدي اللياقة البدنية",
    description: "مارس الرياضة لمدة 30 دقيقة يومياً لمدة أسبوع",
    reward: 100,
    status: "ACTIVE" as const,
    category: "fitness",
    participants: 15,
    deadline: "2026-06-01"
  },
  {
    title: "بطولة الشطرنج الرمضانية",
    description: "شارك في بطولة الشطرنج السنوية بمركز شباب بنها",
    reward: 500,
    status: "ACTIVE" as const,
    category: "mental",
    participants: 40,
    deadline: "2026-05-15"
  },
  {
    title: "ماراثون القليوبية للجري",
    description: "ماراثون 5 كم في شوارع مدينة بنها",
    reward: 300,
    status: "PENDING" as const,
    category: "running",
    participants: 0,
    deadline: "2026-07-10"
  }
];

function centerInputFromAccount(account: CenterAccountSeed, index: number): CenterInput {
  return {
    name: account.name,
    location: account.location,
    rating: 4.2,
    type: "مركز شباب",
    image: imagePool[index % imagePool.length],
    description: `${account.name} في ${account.location}`
  };
}

async function main() {
  await initDatabase();
  const centerAccounts = await loadCenterAccounts();
  const centersFromWorkbook = centerAccounts.map(centerInputFromAccount);

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    const exists = await db.users.findByEmail(user.email);
    if (!exists) {
      await db.users.create({
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        passwordHash
      });
    } else {
      await db.users.update(exists.id, {
        name: user.name,
        role: user.role,
        points: user.points,
        status: "ACTIVE",
        passwordHash
      });
    }
  }

  const existingCenters = await db.centers.list();
  const centersByName = new Map(existingCenters.map((center) => [center.name, center]));
  const seededCentersByName = new Map<string, CenterRecord>();
  for (const center of centersFromWorkbook) {
    const existingCenter = centersByName.get(center.name);
    const savedCenter = existingCenter ? await db.centers.update(existingCenter.id, center) : await db.centers.create(center);
    seededCentersByName.set(savedCenter.name, savedCenter);
  }

  const existingUsers = await db.users.list();
  const centerManagersByCenterId = new Map<number, { id: number }>();
  for (const user of existingUsers) {
    if (user.role === "CENTER_MANAGER" && user.centerId && !centerManagersByCenterId.has(user.centerId)) {
      centerManagersByCenterId.set(user.centerId, { id: user.id });
    }
  }

  for (const account of centerAccounts) {
    const center = seededCentersByName.get(account.name);
    if (!center) throw new Error(`Could not seed center account from row ${account.rowNumber}: ${account.name}`);
    const passwordHash = await bcrypt.hash(account.password, 12);
    const existingByEmail = await db.users.findByEmail(account.email);
    const existingCenterManager = centerManagersByCenterId.get(center.id);
    const existingAccount = existingByEmail ?? existingCenterManager;
    if (existingAccount) {
      await db.users.update(existingAccount.id, {
        name: account.name,
        email: account.email,
        role: "CENTER_MANAGER",
        centerId: center.id,
        points: 0,
        status: "ACTIVE",
        isActive: true,
        passwordHash
      });
    } else {
      await db.users.create({
        name: account.name,
        email: account.email,
        role: "CENTER_MANAGER",
        centerId: center.id,
        points: 0,
        status: "ACTIVE",
        isActive: true,
        passwordHash
      });
    }
  }

  const seededCenter = seededCentersByName.values().next().value;
  const demoUserAccount = await db.users.findByEmail("user@example.com");
  if (seededCenter && demoUserAccount) {
    await db.users.update(demoUserAccount.id, { centerId: seededCenter.id, role: "USER" });
  }

  const existingChallenges = await db.challenges.list();
  const challengeTitles = new Set(existingChallenges.map((challenge) => challenge.title));
  for (const challenge of challenges) {
    if (!challengeTitles.has(challenge.title)) {
      await db.challenges.create(challenge);
    }
  }

  const seededUser = await db.users.findByEmail("user@example.com");
  if (!seededUser) throw new Error("Seed user was not created");

  const existingIdeas = await db.ideas.list();
  if (!existingIdeas.some((idea) => idea.title === "تطوير ملاعب التنس")) {
    const idea = await db.ideas.create(
      {
        title: "تطوير ملاعب التنس",
        description: "نقترح إضافة ملاعب تنس جديدة في مركز شباب بنها"
      },
      seededUser.id,
      seededUser.centerId ?? seededCenter?.id
    );
    await db.ideas.updateStatus(idea.id, "ACTIVE");
    for (let i = 0; i < 25; i += 1) await db.ideas.vote(idea.id);
  }
  if (!existingIdeas.some((idea) => idea.title === "تطبيق للمسابقات")) {
    const idea = await db.ideas.create(
      {
        title: "تطبيق للمسابقات",
        description: "إنشاء تطبيق خاص للمسابقات الرياضية بين مراكز المحافظة"
      },
      seededUser.id,
      seededUser.centerId ?? seededCenter?.id
    );
    await db.ideas.updateStatus(idea.id, "RESOLVED");
    for (let i = 0; i < 42; i += 1) await db.ideas.vote(idea.id);
  }

  const existingComplaints = await db.complaints.list();
  if (!existingComplaints.some((complaint) => complaint.title === "صيانة الإنارة")) {
    const complaint = await db.complaints.create(
      {
        title: "صيانة الإنارة",
        description: "الإنارة في الملعب الخماسي تحتاج لصيانة",
        type: "صيانة"
      },
      seededUser.id,
      seededUser.centerId ?? seededCenter?.id
    );
    await db.complaints.updateStatus(complaint.id, "PENDING");
  }

  const reports = await db.reports.list();
  if (reports.length === 0) {
    await db.reports.create({
      type: "summary",
      title: "تقرير المنصة الأولي",
      content: "بيانات أولية مستخرجة من نسخة IndexedDB التجريبية.",
      status: "PENDING"
    });
  }

  const activities = await db.activities.list(1);
  if (activities.length === 0) {
    await db.activities.create("Seeded legacy IndexedDB data");
  }

  const counts = {
    users: (await db.users.list()).length,
    centers: (await db.centers.list()).length,
    challenges: (await db.challenges.list()).length,
    ideas: (await db.ideas.list()).length,
    complaints: (await db.complaints.list()).length
  };
  console.log("Seed complete", counts);
}

main().finally(() => disconnectDatabase());
