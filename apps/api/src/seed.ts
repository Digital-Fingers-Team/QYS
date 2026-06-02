import bcrypt from "bcryptjs";
import { db, disconnectDatabase, initDatabase } from "./db";

const imagePool = [
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
  "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=800",
  "https://images.unsplash.com/photo-1540747737273-46c70b0e9851?w=800"
];

const users = [
  { email: "user@example.com", password: process.env.SEED_USER_PASSWORD || "UserDevPass!2026", role: "USER" as const, name: "مستخدم تجريبي", points: 150 },
  { email: "admin@example.com", password: process.env.SEED_ADMIN_PASSWORD || "AdminDevPass!2026", role: "DIRECTORATE_MANAGER" as const, name: "مدير المديرية", points: 0 },
  { email: "center@example.com", password: process.env.SEED_CENTER_PASSWORD || "CenterDevPass!2026", role: "CENTER_MANAGER" as const, name: "حساب مركز", points: 0 }
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

const centers = centerRows.split("\n").map((row, index) => {
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

async function main() {
  await initDatabase();

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
  const centerNames = new Set(existingCenters.map((center) => center.name));
  const legacyCenterNames = new Set(centers.map((center) => center.name));
  for (const center of existingCenters) {
    if (!legacyCenterNames.has(center.name)) {
      await db.centers.delete(center.id);
    }
  }
  for (const center of centers) {
    if (!centerNames.has(center.name)) {
      await db.centers.create(center);
    }
  }

  const seededCenter = (await db.centers.list())[0];
  const centerAccount = await db.users.findByEmail("center@example.com");
  if (seededCenter && centerAccount) {
    await db.users.update(centerAccount.id, { centerId: seededCenter.id, role: "CENTER_MANAGER" });
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
      seededUser.id
    );
    await db.ideas.updateStatus(idea.id, "PENDING");
    for (let i = 0; i < 25; i += 1) await db.ideas.vote(idea.id);
  }
  if (!existingIdeas.some((idea) => idea.title === "تطبيق للمسابقات")) {
    const idea = await db.ideas.create(
      {
        title: "تطبيق للمسابقات",
        description: "إنشاء تطبيق خاص للمسابقات الرياضية بين مراكز المحافظة"
      },
      seededUser.id
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
      seededUser.id
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
