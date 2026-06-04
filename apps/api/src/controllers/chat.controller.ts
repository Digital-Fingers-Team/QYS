import { Response } from "express";
import { z } from "zod";
import { isAdminRole } from "../auth/rbac";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { AuthedRequest } from "../middleware/auth";

const chatScopeSchema = z.enum(["all", "center"]).default("center");
const chatMessageSchema = z.object({
  scope: chatScopeSchema,
  centerId: z.coerce.number().int().positive().optional(),
  body: z.string().trim().min(1).max(2000)
}).strict();

function scopeFromQuery(value: unknown) {
  return chatScopeSchema.parse(typeof value === "string" ? value : undefined);
}

function centerIdFromQuery(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return z.coerce.number().int().positive().parse(value);
}

async function assertCenterExists(centerId: number) {
  const center = await db.centers.get(centerId);
  if (!center) throw new ApiError(404, "Center not found", "CENTER_NOT_FOUND");
  return center;
}

export const chatController = {
  list: async (req: AuthedRequest, res: Response) => {
    const user = req.user;
    if (!user || (user.role !== "CENTER_MANAGER" && !isAdminRole(user.role))) {
      throw new ApiError(403, "Only admin and center manager accounts can open chat.", "CHAT_FORBIDDEN");
    }

    const scope = scopeFromQuery(req.query.scope);
    if (isAdminRole(user.role)) {
      if (scope === "all") return res.json(await db.chat.list({ target: "ALL" }));
      const centerId = centerIdFromQuery(req.query.centerId);
      if (!centerId) throw new ApiError(400, "centerId is required for center chat.", "CENTER_REQUIRED");
      await assertCenterExists(centerId);
      return res.json(await db.chat.list({ target: "CENTER", centerId }));
    }

    if (!user.centerId) throw new ApiError(400, "No center is linked to this account.", "CENTER_REQUIRED");
    if (scope === "all") return res.json(await db.chat.list({ target: "ALL" }));
    return res.json(await db.chat.list({ target: "CENTER", centerId: user.centerId }));
  },

  create: async (req: AuthedRequest, res: Response) => {
    const user = req.user;
    if (!user || (user.role !== "CENTER_MANAGER" && !isAdminRole(user.role))) {
      throw new ApiError(403, "Only admin and center manager accounts can send chat messages.", "CHAT_FORBIDDEN");
    }

    const data = chatMessageSchema.parse(req.body);
    if (isAdminRole(user.role)) {
      if (data.scope === "all") {
        const message = await db.chat.create({ target: "ALL", senderId: user.userId, senderRole: user.role, body: data.body });
        await db.activities.create("Sent broadcast chat message to all centers", user.userId);
        return res.status(201).json(message);
      }
      if (!data.centerId) throw new ApiError(400, "centerId is required for center chat.", "CENTER_REQUIRED");
      await assertCenterExists(data.centerId);
      const message = await db.chat.create({ target: "CENTER", centerId: data.centerId, senderId: user.userId, senderRole: user.role, body: data.body });
      await db.activities.create(`Sent chat message to center #${data.centerId}`, user.userId);
      return res.status(201).json(message);
    }

    if (!user.centerId) throw new ApiError(400, "No center is linked to this account.", "CENTER_REQUIRED");
    const message = await db.chat.create({ target: "CENTER", centerId: user.centerId, senderId: user.userId, senderRole: user.role, body: data.body });
    await db.activities.create(`Center #${user.centerId} replied in chat`, user.userId);
    return res.status(201).json(message);
  }
};
