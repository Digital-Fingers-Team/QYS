import { z } from "zod";

export const RoleSchema = z.enum(["ADMIN", "USER"]);
export const StatusSchema = z.enum(["ACTIVE", "PENDING", "RESOLVED", "REJECTED"]);

export const authRegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});
export const authLoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export const centerSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  capacity: z.number().int().nonnegative().optional(),
  rating: z.number().min(0).max(5).optional(),
  type: z.string().min(2),
  image: z.string().url().optional(),
  description: z.string().min(2)
});

export const challengeSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  reward: z.number().int().nonnegative(),
  category: z.string().min(2),
  maxParticipants: z.number().int().positive().optional(),
  deadline: z.string().datetime()
});

export const ideaSchema = z.object({ title: z.string().min(2), description: z.string().min(2) });
export const complaintSchema = z.object({ title: z.string().min(2), description: z.string().min(2), type: z.string().min(2) });

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type CenterInput = z.infer<typeof centerSchema>;
export type ChallengeInput = z.infer<typeof challengeSchema>;
export type IdeaInput = z.infer<typeof ideaSchema>;
export type ComplaintInput = z.infer<typeof complaintSchema>;
