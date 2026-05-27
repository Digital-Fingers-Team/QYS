import { z } from "zod";

export const RoleSchema = z.enum(["SUPER_ADMIN", "MINISTRY_MANAGER", "DIRECTORATE_MANAGER", "CENTER_MANAGER", "USER"]);
export const StatusSchema = z.enum(["ACTIVE", "PENDING", "RESOLVED", "REJECTED"]);

export const authRegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  centerId: z.number().int().positive()
});
export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});
export const profileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().url().or(z.literal("")).optional(),
  language: z.enum(["ar", "en"]).optional(),
  theme: z.enum(["light", "dark"]).optional()
});
export const userAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: RoleSchema.default("USER"),
  centerId: z.number().int().positive().nullable().optional(),
  points: z.number().int().nonnegative().default(0),
  status: z.string().min(2).default("ACTIVE"),
  isActive: z.boolean().default(true)
});
export const userAdminUpdateSchema = userAdminSchema.partial();
export const passwordResetSchema = z.object({ password: z.string().min(8) });

export const centerSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  capacity: z.number().int().nonnegative().optional(),
  rating: z.number().min(0).max(5).optional(),
  type: z.string().min(2),
  image: z.string().url().optional(),
  description: z.string().min(2)
});
export const centerUpdateSchema = centerSchema.partial();

export const challengeSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  reward: z.number().int().nonnegative(),
  status: z.string().min(2).default("ACTIVE"),
  category: z.string().min(2),
  participants: z.number().int().nonnegative().optional(),
  maxParticipants: z.number().int().positive().optional(),
  deadline: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
});
export const challengeUpdateSchema = challengeSchema.partial();

export const ideaSchema = z.object({ title: z.string().min(2), description: z.string().min(2) });
export const complaintSchema = z.object({ title: z.string().min(2), description: z.string().min(2), type: z.string().min(2) });
export const statusUpdateSchema = z.object({ status: z.string().min(2) });
export const reportSchema = z.object({
  type: z.string().min(2),
  title: z.string().min(2),
  content: z.string().min(2),
  status: z.string().min(2).default("PENDING")
});
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM format");
export const monthlyReportQuerySchema = z.object({ month: monthSchema });
export const monthlyReportUploadBodySchema = z.object({
  centerId: z.coerce.number().int().positive().optional(),
  replace: z.coerce.boolean().default(false)
});

export type MonthlyReportRow = {
  id: number;
  centerId: number;
  centerName: string;
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
export type IdeaInput = z.infer<typeof ideaSchema>;
export type ComplaintInput = z.infer<typeof complaintSchema>;
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type MonthlyReportQueryInput = z.infer<typeof monthlyReportQuerySchema>;
export type MonthlyReportUploadBodyInput = z.infer<typeof monthlyReportUploadBodySchema>;
