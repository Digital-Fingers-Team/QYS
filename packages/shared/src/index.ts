import { z } from "zod";

export const RoleSchema = z.enum(["ADMIN", "USER"]);
export const StatusSchema = z.enum(["ACTIVE", "PENDING", "RESOLVED", "REJECTED"]);

export const authRegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});
export const authLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
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
  points: z.number().int().nonnegative().default(0),
  status: z.string().min(2).default("ACTIVE")
});
export const userAdminUpdateSchema = userAdminSchema.partial();

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

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
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
