import { assistantChatSchema, AssistantAction, AssistantChatResponse, AssistantChatInput } from "@qys/shared";
import { isAdminRole } from "../auth/rbac";
import { db } from "../db";
import { env } from "../config/env";
import { AuthedRequest } from "../middleware/auth";

type AssistantContext = {
  role: string;
  name: string;
  center?: string;
  summary: string[];
};

type AiAttempt = {
  configured: boolean;
  provider?: "OpenRouter" | "Grok" | "Gemini" | "OpenAI";
  answer?: string | null;
  error?: string;
};

function configuredKey(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^(your_key_here|replace_me|changeme)$/i.test(trimmed)) return undefined;
  return trimmed;
}

function looksLikeGeminiKey(value?: string) {
  return Boolean(value && /^AIza/i.test(value.trim()));
}

function looksLikeXaiKey(value?: string) {
  return Boolean(value && /^xai-/i.test(value.trim()));
}

function looksLikeOpenRouterKey(value?: string) {
  return Boolean(value && /^sk-or-/i.test(value.trim()));
}

function pageInfo(path?: string) {
  const normalized = path?.split("?")[0] || "";
  const pages: Record<string, string> = {
    "/admin": "لوحة الإدارة الرئيسية: بطاقات إحصائية، تنبيهات تشغيلية، نشاط حديث، مؤشرات التقارير والشكاوى.",
    "/admin/users": "إدارة المستخدمين: فصل بين المستخدمين العاديين وحسابات المراكز، بحث، إضافة حساب، تعديل، تفعيل أو تعطيل.",
    "/admin/centers": "إدارة المراكز: دليل بطاقات للمراكز، تفاصيل المركز في نافذة، بيانات الاعتماد ومحادثة المركز.",
    "/admin/map": "خريطة المراكز: خريطة القليوبية مع قائمة مناطق ومراكز وبطاقة للمركز المحدد.",
    "/admin/ideas": "إدارة الأفكار: بطاقات قابلة للفتح، التفاصيل والقرارات داخل نافذة تفاصيل.",
    "/admin/challenges": "إدارة التحديات: إنشاء وتعديل التحديات، البطاقات تفتح تفاصيل وإجراءات الإدارة.",
    "/admin/complaints": "إدارة الشكاوى: مراجعة الطلبات، تحديث الحالة والتقدم من نافذة التفاصيل.",
    "/admin/reports": "التقارير الشهرية: اختيار شهر، تحميل قالب Excel، رفع ملفات، تصدير، مؤشرات ومراكز لم ترفع.",
    "/admin/chat": "محادثات المراكز: محادثة خاصة مع مركز محدد أو رسالة عامة لكل المراكز.",
    "/admin/settings": "إعدادات المدير: الملف الشخصي، اللغة، الوضع الفاتح أو الداكن، كلمة المرور.",
    "/center": "لوحة المركز: ملخص تقرير الشهر في بطاقات إحصائية، تنبيهات تشغيلية، آخر ملفات مرفوعة، مخطط أداء الشهر، ومسار تقرير الشهر.",
    "/center/reports": "تقرير المركز الشهري: شريط اختيار الشهر، أزرار الشهر الحالي/الماضي، تحميل قالب Excel، رفع ملف، حالة الرفع، بيانات التقرير، سجل الأشهر وآخر ملفات المركز.",
    "/center/map": "خريطة المراكز للمركز: استعراض المناطق والمراكز على الخريطة.",
    "/center/ideas": "أفكار المركز: مراجعة الأفكار المرتبطة بالمركز، فتح التفاصيل من البطاقة، واتخاذ قرار الموافقة أو الرفض من نافذة التفاصيل.",
    "/center/users": "مستخدمو المركز: زر إضافة مستخدم، نموذج إضافة حساب عضو للمركز، وجدول يعرض الاسم والبريد والدور والحالة وآخر دخول.",
    "/center/challenges": "تحديات المركز: استعراض التحديات المتاحة.",
    "/center/complaints": "شكاوى المركز: مراجعة شكاوى ومقترحات المركز، فتح التفاصيل من البطاقة، قبول أو رفض مراجعة المركز، وتحديث التقدم للمستخدمين.",
    "/center/chat": "محادثة المديرية: قناة خاصة بين المركز والمديرية، رسائل المركز تظهر يمين الشاشة، والرسائل العامة للقراءة فقط.",
    "/center/settings": "إعدادات المركز: الملف الشخصي، اللغة، الوضع الفاتح أو الداكن، كلمة المرور.",
    "/dashboard": "لوحة المستخدم: نقاط المستخدم، تنبيهات، أفكار حديثة وتحديات مقترحة.",
    "/centers": "دليل المراكز: بطاقات مراكز الشباب مع الصور والموقع والتفاصيل.",
    "/map": "خريطة المراكز: خريطة تفاعلية وقائمة مناطق ومراكز.",
    "/ideas": "بنك الأفكار: إرسال فكرة ومتابعة الأفكار المنشورة أو قيد المراجعة.",
    "/challenges": "التحديات: استعراض التحديات والانضمام لها.",
    "/complaints": "الشكاوى والمقترحات: إرسال شكوى أو مقترح ومتابعة حالته.",
    "/settings": "إعدادات المستخدم: الملف الشخصي، اللغة، الوضع الفاتح أو الداكن، كلمة المرور."
  };
  return pages[normalized] || "صفحة داخل منصة QYS. استخدم بنية المنصة العامة: شريط جانبي، رأس علوي، محتوى في بطاقات وجداول ونوافذ تفاصيل عند الحاجة.";
}

function centerManagerKnowledge() {
  return [
    "Center manager experience:",
    "- The center manager starts at /center. The dashboard is operational: report status, pending complaints, rejected uploads, recent uploads, monthly performance, and a timeline for the monthly report.",
    "- Center reports are scoped to the logged-in center only. The center manager should not see all-center exports or other centers' data.",
    "- On /center/reports, the center manager downloads the Excel template, fills the month data, uploads the file, then checks whether status is مرفوع or غير مرفوع. If a duplicate exists, the UI asks before replacing.",
    "- On /center/users, the center manager can add normal USER accounts for their own center only. They cannot create directorate managers or other center manager accounts.",
    "- On /center/complaints, complaint cards can open a detail overlay. The center manager reviews center-linked complaints, can approve/reject center review when applicable, and can update progress text/status for users.",
    "- On /center/ideas, center-linked ideas can be opened for details and reviewed. The assistant should guide the manager to open the card first, then use the overlay actions.",
    "- On /center/chat, center managers use the private conversation with the directorate to ask questions or respond. Broadcast/all-center messages are informational/read-only for centers.",
    "- On /center/map, the center manager can inspect other centers and areas on the interactive map, but it is mainly informational.",
    "- The center interface uses the same sidebar/top-header layout as the rest of the app, but the navigation is focused on center operations: dashboard, reports, map, ideas, users, challenges, complaints, chat, settings.",
    "- When guiding a center manager, use operational Arabic: ارفع التقرير, راجع الشكوى, افتح التفاصيل, حدّث التقدم, أضف مستخدم للمركز. Mention the exact page and visible button when possible."
  ].join("\n");
}

function adminKnowledge() {
  return [
    "Admin experience:",
    "- Admins manage the whole platform: users, center accounts, centers, map, ideas, challenges, complaints, monthly reports, chat, and settings.",
    "- Admin cards for ideas/challenges/complaints open detail overlays; destructive or visibility/status actions should happen from the overlay after review.",
    "- Admin reports can view missing centers, all-center monthly data, latest uploads, and export the monthly report workbook."
  ].join("\n");
}

function userKnowledge() {
  return [
    "Normal user experience:",
    "- Users can browse centers and the map, submit ideas, join challenges, submit complaints/proposals, and manage settings.",
    "- Users do not access admin or center operational routes. Guide them to public dashboard, centers, map, ideas, challenges, complaints, and settings."
  ].join("\n");
}

function roleNavigation(role: string) {
  if (role === "مدير المديرية") {
    return [
      "admin dashboard /admin",
      "users /admin/users",
      "centers /admin/centers",
      "map /admin/map",
      "ideas /admin/ideas",
      "challenges /admin/challenges",
      "complaints /admin/complaints",
      "reports /admin/reports",
      "chat /admin/chat",
      "settings /admin/settings"
    ];
  }
  if (role === "مسؤول مركز") {
    return [
      "center dashboard /center",
      "reports /center/reports",
      "map /center/map",
      "ideas /center/ideas",
      "users /center/users",
      "challenges /center/challenges",
      "complaints /center/complaints",
      "chat /center/chat",
      "settings /center/settings"
    ];
  }
  return [
    "dashboard /dashboard",
    "centers /centers",
    "map /map",
    "ideas /ideas",
    "challenges /challenges",
    "complaints /complaints",
    "settings /settings"
  ];
}

function platformKnowledge(ctx: AssistantContext, currentPath?: string) {
  const roleSpecific = ctx.role === "مسؤول مركز"
    ? centerManagerKnowledge()
    : ctx.role === "مدير المديرية"
      ? adminKnowledge()
      : userKnowledge();

  return [
    "Platform identity: QYS is an Arabic RTL web platform for Qalyubia youth/sports services. It connects the directorate, youth centers, and normal users.",
    "Visual layout: authenticated pages use a fixed sidebar for navigation, a top header with profile/settings, and a central content wrapper. The UI uses panels, cards, statistics tiles, tables, badges, segmented controls, modals/overlays for details, and a floating AI assistant button at the bottom.",
    "Theme and language: Arabic RTL is the main experience. The settings page lets users switch language and light/dark theme. Dark mode should keep panels, forms, tables, chat, maps and assistant surfaces dark.",
    "UX rules: guide users by naming the visible page, the button or control, and the expected result. Prefer short step-by-step instructions. If a task changes data, say what screen confirms it; do not pretend the assistant already changed it.",
    "Reports workflow: monthly reports use Excel. Users choose a month, download the template, fill it, upload it, then review status/statistics/latest uploads. Admin can export monthly reports; centers see only their own center report state.",
    "Ideas/challenges/complaints workflow: cards open detail overlays for managers. Admin decisions usually happen in the detail overlay footer. Center managers review center-linked ideas/complaints. Normal users submit and track their own items.",
    "Chat workflow: admin can message all centers or a selected center; center managers use the private directorate chat. Own messages appear on the right.",
    roleSpecific,
    `Current page path: ${currentPath || "unknown"}. Current page description: ${pageInfo(currentPath)}.`,
    `Navigation available for this role:\n- ${roleNavigation(ctx.role).join("\n- ")}`
  ].join("\n");
}

function systemPrompt(ctx: AssistantContext, actions: AssistantAction[], currentPath?: string) {
  return [
    "You are QYS Assistant inside an Arabic youth/sports platform.",
    "Answer in Arabic unless the user clearly asks for English.",
    "Be concise, practical, and role-aware.",
    "Never claim you performed a write action. You may guide the user or point to provided actions.",
    "Answer the user's actual question first, then use platform context only when useful.",
    "You know the product UI/UX. When asked how to use the web app, describe the visible navigation, page layout, button names, modals, tables, and expected next step.",
    "If the user asks you to perform an admin/center action, explain the safest route and use available action links. Do not fabricate completed mutations.",
    `User role: ${ctx.role}. User name: ${ctx.name}.`,
    ctx.center ? `Center: ${ctx.center}.` : "",
    platformKnowledge(ctx, currentPath),
    `Current platform context:\n- ${ctx.summary.join("\n- ")}`,
    actions.length ? `Available UI actions:\n- ${actions.map((action) => `${action.label}: ${action.href || action.intent}`).join("\n- ")}` : "No UI action matched the request."
  ].filter(Boolean).join("\n");
}

async function aiError(response: Response) {
  const text = await response.text().catch(() => "");
  try {
    const payload = JSON.parse(text) as { error?: { message?: string; status?: string } };
    const message = payload.error?.message || text || response.statusText;
    const status = payload.error?.status ? `${payload.error.status}: ` : "";
    return `${response.status} ${status}${message}`.slice(0, 700);
  } catch {
    return `${response.status} ${text || response.statusText}`.slice(0, 700);
  }
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function roleName(role: string) {
  if (isAdminRole(role)) return "مدير المديرية";
  if (role === "CENTER_MANAGER") return "مسؤول مركز";
  return "مستخدم";
}

function actionsFor(role: string, message: string): AssistantAction[] {
  const text = message.toLowerCase();
  const actions: AssistantAction[] = [];

  if (isAdminRole(role)) {
    if (/user|account|مستخدم|حساب/.test(text)) actions.push({ label: "إدارة المستخدمين", href: "/admin/users", intent: "open_users" });
    if (/center|مركز|مراكز/.test(text)) actions.push({ label: "إدارة المراكز", href: "/admin/centers", intent: "open_centers" });
    if (/report|excel|تقرير|تقارير|اكسل/.test(text)) actions.push({ label: "مراجعة التقارير", href: "/admin/reports", intent: "open_reports" });
    if (/complaint|شكوى|شكاوى/.test(text)) actions.push({ label: "مراجعة الشكاوى", href: "/admin/complaints", intent: "open_complaints" });
    if (/chat|message|رسالة|محادثة/.test(text)) actions.push({ label: "فتح محادثات المراكز", href: "/admin/chat", intent: "open_chat" });
  } else if (role === "CENTER_MANAGER") {
    if (/report|excel|تقرير|تقارير|اكسل/.test(text)) actions.push({ label: "رفع تقرير المركز", href: "/center/reports", intent: "open_reports" });
    if (/user|account|مستخدم|حساب/.test(text)) actions.push({ label: "مستخدمو المركز", href: "/center/users", intent: "open_center_users" });
    if (/complaint|progress|review|approve|reject|شكوى|شكاوى|تقدم|مراجعة|قبول|رفض/.test(text)) actions.push({ label: "شكاوى المركز", href: "/center/complaints", intent: "open_complaints" });
    if (/idea|ideas|فكرة|أفكار/.test(text)) actions.push({ label: "أفكار المركز", href: "/center/ideas", intent: "open_ideas" });
    if (/map|location|area|خريطة|منطقة|موقع/.test(text)) actions.push({ label: "خريطة المراكز", href: "/center/map", intent: "open_map" });
    if (/challenge|تحدي|تحديات/.test(text)) actions.push({ label: "تحديات المركز", href: "/center/challenges", intent: "open_challenges" });
    if (/chat|message|رسالة|محادثة/.test(text)) actions.push({ label: "محادثة المديرية", href: "/center/chat", intent: "open_chat" });
    if (/setting|theme|dark|language|password|إعداد|الوضع|داكن|لغة|كلمة/.test(text)) actions.push({ label: "إعدادات المركز", href: "/center/settings", intent: "open_settings" });
  } else {
    if (/challenge|تحدي|تحديات/.test(text)) actions.push({ label: "التحديات", href: "/challenges", intent: "open_challenges" });
    if (/idea|فكرة|أفكار/.test(text)) actions.push({ label: "بنك الأفكار", href: "/ideas", intent: "open_ideas" });
    if (/complaint|شكوى|مقترح/.test(text)) actions.push({ label: "الشكاوى والمقترحات", href: "/complaints", intent: "open_complaints" });
    if (/center|مركز|مراكز/.test(text)) actions.push({ label: "دليل المراكز", href: "/centers", intent: "open_centers" });
  }

  return actions.slice(0, 4);
}

async function contextFor(req: AuthedRequest): Promise<AssistantContext> {
  const user = await db.users.findById(req.user!.userId);
  const role = req.user!.role;
  const month = currentMonthValue();
  const summary: string[] = [];
  let centerName: string | undefined;

  if (isAdminRole(role)) {
    const [stats, reports, uploads] = await Promise.all([
      db.stats.admin(),
      db.monthlyReports.summary({ month }),
      db.uploadedFiles.list({ month, limit: 5 })
    ]);
    summary.push(`عدد المراكز: ${stats.activeCenters}`);
    summary.push(`عدد المستخدمين: ${stats.totalUsers}`);
    summary.push(`الأفكار المعلقة: ${stats.pendingIdeas}`);
    summary.push(`الشكاوى الجديدة: ${stats.newComplaints}`);
    summary.push(`مراكز رفعت تقرير ${month}: ${reports.uploadedCenterIds.length}`);
    summary.push(`آخر ملفات التقارير: ${uploads.map((upload) => `${upload.centerName || "مركز"} (${upload.status})`).join(", ") || "لا يوجد"}`);
  } else if (role === "CENTER_MANAGER") {
    const center = req.user!.centerId ? await db.centers.get(req.user!.centerId) : null;
    const [reportSummary, reports, complaints, uploads] = await Promise.all([
      db.monthlyReports.summary({ month, centerId: req.user!.centerId ?? undefined }),
      req.user!.centerId ? db.monthlyReports.list({ month, centerId: req.user!.centerId }) : Promise.resolve([]),
      db.complaints.list({ centerId: req.user!.centerId ?? -1 }),
      db.uploadedFiles.list({ month, centerId: req.user!.centerId ?? undefined, limit: 5 })
    ]);
    centerName = center?.name;
    summary.push(`المركز: ${center?.name || "غير محدد"}`);
    summary.push(`تقرير ${month}: ${reports.length > 0 ? "مرفوع" : "غير مرفوع"}`);
    summary.push(`إيرادات الشهر: ${reportSummary.totalRevenues}`);
    summary.push(`مصروفات الشهر: ${reportSummary.totalExpenses}`);
    summary.push(`شكاوى مرتبطة بالمركز: ${complaints.length}`);
    summary.push(`آخر ملفات التقارير: ${uploads.map((upload) => `${upload.originalName} (${upload.status})`).join(", ") || "لا يوجد"}`);
  } else {
    const [stats, complaints, ideas, challenges] = await Promise.all([
      db.stats.me(req.user!.userId),
      db.complaints.list({ userId: req.user!.userId }),
      db.ideas.list({ userId: req.user!.userId }),
      db.challenges.list(req.user!.userId)
    ]);
    summary.push(`النقاط: ${stats.user?.points ?? 0}`);
    summary.push(`الشكاوى الخاصة بك: ${complaints.length}`);
    summary.push(`أفكارك: ${ideas.length}`);
    summary.push(`التحديات المتاحة أو المنضم لها: ${challenges.length}`);
  }

  return {
    role: roleName(role),
    name: user?.name || "مستخدم",
    center: centerName,
    summary
  };
}

function guidedAnswer(input: AssistantChatInput, ctx: AssistantContext, actions: AssistantAction[]): string {
  const message = input.message.toLowerCase();
  const intro = `أنا مساعد المنصة. سأساعدك كـ ${ctx.role}${ctx.center ? ` في ${ctx.center}` : ""}.`;
  const pageLine = input.currentPath ? `\n\nأنت الآن في: ${pageInfo(input.currentPath)}` : "";
  const contextLine = ctx.summary.length ? `\n\nملخص سريع:\n- ${ctx.summary.join("\n- ")}` : "";
  const actionLine = actions.length ? `\n\nأقرب خطوة مناسبة: ${actions[0].label}.` : "";
  const centerManager = ctx.role === "مسؤول مركز";

  if (/ui|ux|interface|تصميم|واجهة|شكل|صفحة|استخدم|فين|أين|ازاي|كيف|click|اضغط/.test(message)) {
    return `${intro}${pageLine}\n\nطريقة استخدام الواجهة هنا: ابدأ من الشريط الجانبي للتنقل، ثم استخدم البطاقات أو الجداول داخل المحتوى. الأزرار الأساسية تكون بلون رئيسي، وأزرار الحذف أو التعطيل تظهر كلون تحذيري. التفاصيل والإجراءات الكبيرة تظهر غالبا داخل نافذة منبثقة حتى تراجع البيانات قبل القرار.${centerManager ? "\n\nكمسؤول مركز ركّز على صفحات: تقارير المركز، مستخدمو المركز، شكاوى المركز، أفكار المركز، ومحادثة المديرية." : ""}${actionLine}`;
  }

  if (/report|excel|تقرير|تقارير|اكسل/.test(message)) {
    return `${intro}${pageLine}\n\nللتقارير الشهرية: حمّل القالب، املأ بيانات الشهر، ثم ارفع ملف Excel من صفحة التقارير. إذا ظهر رفض للملف، راجع اسم الشهر والحقول المالية ثم ارفع نسخة جديدة.${centerManager ? " في واجهة المركز سترى حالة تقرير مركزك فقط، وسجل الأشهر، وآخر ملفات المركز." : ""}${contextLine}${actionLine}`;
  }
  if (/complaint|شكوى|شكاوى|مقترح/.test(message)) {
    return `${intro}${pageLine}\n\nللشكاوى والمقترحات: تابع الحالة من صفحة الشكاوى. المسؤول أو المركز يمكنه مراجعة الطلب وتحديث التقدم حسب الصلاحية.${centerManager ? " كمسؤول مركز افتح بطاقة الشكوى، راجع التفاصيل، ثم استخدم أزرار القبول/الرفض أو تحديث التقدم داخل النافذة." : ""}${contextLine}${actionLine}`;
  }
  if (/user|account|مستخدم|حساب/.test(message)) {
    return `${intro}${pageLine}\n\nللحسابات: استخدم صفحة المستخدمين لإضافة أو تعديل الحسابات المسموح لك بإدارتها. سأرشدك للصفحة المناسبة، وأي عملية حساسة يجب تأكيدها من الشاشة.${centerManager ? " كمسؤول مركز يمكنك إضافة مستخدم عادي مرتبط بمركزك من صفحة مستخدمو المركز فقط." : ""}${contextLine}${actionLine}`;
  }
  if (/idea|ideas|فكرة|أفكار/.test(message)) {
    return `${intro}${pageLine}\n\nللأفكار: افتح صفحة الأفكار، ثم افتح بطاقة الفكرة لمراجعة التفاصيل. ${centerManager ? "كمسؤول مركز راجع الفكرة المرتبطة بمركزك واتخذ قرار المركز من نافذة التفاصيل." : "يمكن للمستخدم إرسال فكرة ومتابعتها، بينما المدير يراجع النشر والحالة."}${contextLine}${actionLine}`;
  }
  if (/challenge|تحدي|تحديات/.test(message)) {
    return `${intro}${pageLine}\n\nللتحديات: يمكنك مراجعة التحديات المتاحة، الانضمام لها كمستخدم، أو إدارتها من لوحة المديرية إذا كنت تملك الصلاحية.${contextLine}${actionLine}`;
  }

  return `${intro}${pageLine}\n\nاسألني عن التقارير، الشكاوى، المستخدمين، المراكز، الأفكار، التحديات، أو أين تجد وظيفة معينة داخل المنصة. أستطيع أيضا اقتراح الصفحة المناسبة حسب صلاحيتك.${contextLine}${actionLine}`;
}

async function askOpenAI(input: AssistantChatInput, ctx: AssistantContext, actions: AssistantAction[]): Promise<AiAttempt> {
  const apiKey = configuredKey(env.OPENAI_API_KEY);
  if (!apiKey || looksLikeGeminiKey(apiKey) || looksLikeXaiKey(apiKey) || looksLikeOpenRouterKey(apiKey)) return { configured: false };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: systemPrompt(ctx, actions, input.currentPath)
        },
        ...input.history.slice(-8).map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: input.message }
      ]
    })
  });

  if (!response.ok) return { configured: true, provider: "OpenAI", answer: null, error: await aiError(response) };
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { configured: true, provider: "OpenAI", answer: data.choices?.[0]?.message?.content?.trim() || null };
}

async function askOpenRouter(input: AssistantChatInput, ctx: AssistantContext, actions: AssistantAction[]): Promise<AiAttempt> {
  const apiKey = configuredKey(env.OPENROUTER_API_KEY) || (looksLikeOpenRouterKey(env.OPENAI_API_KEY) ? configuredKey(env.OPENAI_API_KEY) : undefined);
  if (!apiKey) return { configured: false };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.FRONTEND_URL || env.CORS_ORIGIN,
      "X-Title": "QYS Platform"
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt(ctx, actions, input.currentPath) },
        ...input.history.slice(-8).map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: input.message }
      ]
    })
  });

  if (!response.ok) return { configured: true, provider: "OpenRouter", answer: null, error: await aiError(response) };
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { configured: true, provider: "OpenRouter", answer: data.choices?.[0]?.message?.content?.trim() || null };
}

async function askGrok(input: AssistantChatInput, ctx: AssistantContext, actions: AssistantAction[]): Promise<AiAttempt> {
  const apiKey = configuredKey(env.XAI_API_KEY) || configuredKey(env.GROK_API_KEY) || (looksLikeXaiKey(env.OPENAI_API_KEY) ? configuredKey(env.OPENAI_API_KEY) : undefined);
  if (!apiKey) return { configured: false };

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.GROK_MODEL,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt(ctx, actions, input.currentPath) },
        ...input.history.slice(-8).map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: input.message }
      ]
    })
  });

  if (!response.ok) return { configured: true, provider: "Grok", answer: null, error: await aiError(response) };
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { configured: true, provider: "Grok", answer: data.choices?.[0]?.message?.content?.trim() || null };
}

async function askGemini(input: AssistantChatInput, ctx: AssistantContext, actions: AssistantAction[]): Promise<AiAttempt> {
  const apiKey = configuredKey(env.GEMINI_API_KEY) || configuredKey(env.GOOGLE_API_KEY) || (looksLikeGeminiKey(env.OPENAI_API_KEY) ? configuredKey(env.OPENAI_API_KEY) : undefined);
  if (!apiKey) return { configured: false };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt(ctx, actions, input.currentPath) }]
      },
      contents: [
        ...input.history.slice(-8).map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }]
        })),
        { role: "user", parts: [{ text: input.message }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 700
      }
    })
  });

  if (!response.ok) return { configured: true, provider: "Gemini", answer: null, error: await aiError(response) };
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return { configured: true, provider: "Gemini", answer: data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || null };
}

export async function assistantChat(req: AuthedRequest): Promise<AssistantChatResponse> {
  const input = assistantChatSchema.parse(req.body);
  const ctx = await contextFor(req);
  const actions = actionsFor(req.user!.role, input.message);
  const openrouter = await askOpenRouter(input, ctx, actions);
  const grok = openrouter.answer ? { configured: false } : await askGrok(input, ctx, actions);
  const gemini = openrouter.answer || grok.answer ? { configured: false } : await askGemini(input, ctx, actions);
  const openai = openrouter.answer || grok.answer || gemini.answer ? { configured: false } : await askOpenAI(input, ctx, actions);
  const aiAnswer = openrouter.answer || grok.answer || gemini.answer || openai.answer;
  const failedProvider = openrouter.error ? openrouter : grok.error ? grok : gemini.error ? gemini : openai.error ? openai : null;

  if (!aiAnswer && failedProvider?.error) {
    return {
      answer: `${failedProvider.provider} لم يرجع إجابة من النموذج.\n\nالسبب: ${failedProvider.error}\n\nسأظل أساعدك بالإرشاد داخل المنصة، لكن للحصول على إجابة AI حقيقية يجب إصلاح إعدادات أو حصة ${failedProvider.provider}.`,
      actions,
      mode: "guided"
    };
  }

  return {
    answer: aiAnswer || guidedAnswer(input, ctx, actions),
    actions,
    mode: aiAnswer ? "ai" : "guided"
  };
}
