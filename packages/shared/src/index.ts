import { z } from "zod";

export const RoleSchema = z.enum(["DIRECTORATE_MANAGER", "CENTER_MANAGER", "USER"]);
export const AccountStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const WorkflowStatusSchema = z.enum(["ACTIVE", "PENDING", "RESOLVED", "REJECTED"]);
export const ReportStatusSchema = z.enum(["PENDING", "RESOLVED", "REJECTED"]);
export const UploadStatusSchema = z.enum(["ACCEPTED", "REPLACED", "REJECTED", "DUPLICATE"]);
export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM format");

const text = (min = 1, max = 500) =>
  z
    .string()
    .transform((value) => value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim())
    .pipe(z.string().min(min).max(max));

const optionalUrl = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().url())
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Only http(s) URLs are allowed")
  .optional();

const avatarImage = optionalUrl
  .or(z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/, "Use a PNG, JPEG, WebP, or GIF image."))
  .or(z.literal(""))
  .optional();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();

export const authRegisterSchema = z.object({
  name: text(2, 120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(6, "Password must be at least 6 characters.").max(128),
  centerId: z.number().int().positive()
}).strict();
export const authLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
}).strict();
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6, "Password must be at least 6 characters.").max(128)
}).strict();
export const profileUpdateSchema = z.object({
  name: text(2, 120).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  avatar: avatarImage,
  language: z.enum(["ar", "en"]).optional(),
  theme: z.enum(["light", "dark"]).optional()
}).strict();
export const userAdminSchema = z.object({
  name: text(2, 120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(6, "Password must be at least 6 characters.").max(128),
  role: RoleSchema.default("USER"),
  centerId: z.number().int().positive().nullable().optional(),
  points: z.number().int().nonnegative().default(0),
  status: AccountStatusSchema.default("ACTIVE"),
  isActive: z.boolean().default(true)
}).strict();
export const userAdminUpdateSchema = userAdminSchema.partial();
export const passwordResetSchema = z.object({ password: z.string().min(6, "Password must be at least 6 characters.").max(128) }).strict();

export const centerSchema = z.object({
  name: text(2, 160),
  location: text(2, 160),
  capacity: z.number().int().nonnegative().optional(),
  rating: z.number().min(0).max(5).optional(),
  type: text(2, 80),
  image: optionalUrl,
  description: text(2, 1000)
}).strict();
export const centerUpdateSchema = centerSchema.partial();

export const challengeSchema = z.object({
  title: text(2, 160),
  description: text(2, 2000),
  image: avatarImage,
  reward: z.number().int().nonnegative(),
  status: WorkflowStatusSchema.default("ACTIVE"),
  category: text(2, 80),
  participants: z.number().int().nonnegative().optional(),
  maxParticipants: z.number().int().positive().optional(),
  deadline: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
}).strict();
export const challengeUpdateSchema = challengeSchema.partial();
export const challengeJoinSchema = z.object({
  participantName: text(2, 120),
  phone: text(5, 30),
  age: z.number().int().min(6).max(100),
  notes: text(0, 1000).optional(),
  image: avatarImage
}).strict();

export const ideaSchema = z.object({ title: text(2, 160), description: text(2, 2000) }).strict();
export const complaintSchema = z.object({ title: text(2, 160), description: text(2, 2000), type: text(2, 80) }).strict();
export const statusUpdateSchema = z.object({ status: WorkflowStatusSchema }).strict();
export const reportSchema = z.object({
  type: text(2, 80),
  title: text(2, 160),
  content: text(2, 4000),
  status: ReportStatusSchema.default("PENDING")
}).strict();
export const monthSchema = MonthSchema;
export const monthlyReportQuerySchema = z.object({ month: monthSchema }).strict();
export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    q: z.string().trim().max(160).optional()
  })
  .strict();
export const monthlyReportUploadBodySchema = z.object({
  centerId: z.coerce.number().int().positive().optional(),
  replace: z.coerce.boolean().default(false)
}).strict();

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MonthlyReportRow = {
  id: number;
  centerId: number;
  centerName: string;
  eventName?: string | null;
  month: string;
  revenues: number;
  expenses: number;
  seminarsCount: number;
  uploadedBy?: number | null;
  uploadedAt: string | Date;
  sourceFileName?: string | null;
};

export type MonthlyUploadItem = {
  id: number;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  extension: string;
  hash: string;
  status: string;
  centerId?: number | null;
  centerName?: string | null;
  month?: string | null;
  error?: string | null;
  uploadedBy?: number | null;
  uploadedAt: string | Date;
};

export type MonthlyReportsSummary = {
  month: string;
  totalRevenues: number;
  totalExpenses: number;
  totalSeminars: number;
  uploadedCenters: number;
  missingCenters: Array<{ id: number; name: string; location: string }>;
  missingCentersTotal: number;
  missingCentersPage: number;
  missingCentersPageSize: number;
  latestUploads: MonthlyUploadItem[];
  monthlyStatistics: Array<{
    month: string;
    totalRevenues: number;
    totalExpenses: number;
    totalSeminars: number;
    uploadedCenters: number;
  }>;
};

export type MonthlyReportUploadResponse = {
  report: MonthlyReportRow;
  upload: MonthlyUploadItem;
  replaced: boolean;
  message: string;
};

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type UserAdminInput = z.infer<typeof userAdminSchema>;
export type UserAdminUpdateInput = z.infer<typeof userAdminUpdateSchema>;
export type CenterInput = z.infer<typeof centerSchema>;
export type CenterUpdateInput = z.infer<typeof centerUpdateSchema>;
export type ChallengeInput = z.infer<typeof challengeSchema>;
export type ChallengeUpdateInput = z.infer<typeof challengeUpdateSchema>;
export type ChallengeJoinInput = z.infer<typeof challengeJoinSchema>;
export type IdeaInput = z.infer<typeof ideaSchema>;
export type ComplaintInput = z.infer<typeof complaintSchema>;
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type MonthlyReportQueryInput = z.infer<typeof monthlyReportQuerySchema>;
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
export type MonthlyReportUploadBodyInput = z.infer<typeof monthlyReportUploadBodySchema>;
