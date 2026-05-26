import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { login, register } from "../services/auth.service";
import { centerSchema, challengeSchema, complaintSchema, ideaSchema } from "@qys/shared";
import { AuthedRequest } from "../middleware/auth";

export const authController = {
  register: async (req: Request, res: Response) => res.status(201).json(await register(req.body)),
  login: async (req: Request, res: Response) => res.json(await login(req.body))
};

export const usersController = { list: async (_: Request, res: Response) => res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, points: true, status: true, createdAt: true } })) };
export const centersController = {
  list: async (_: Request, res: Response) => res.json(await prisma.center.findMany()),
  create: async (req: Request, res: Response) => res.status(201).json(await prisma.center.create({ data: centerSchema.parse(req.body) }))
};
export const challengesController = {
  list: async (_: Request, res: Response) => res.json(await prisma.challenge.findMany({ include: { _count: { select: { participations: true } } } })),
  create: async (req: Request, res: Response) => res.status(201).json(await prisma.challenge.create({ data: challengeSchema.parse(req.body) })),
  join: async (req: AuthedRequest, res: Response) => {
    const challengeId = Number(req.params.id);
    const participation = await prisma.challengeParticipation.create({ data: { challengeId, userId: req.user!.userId } });
    res.status(201).json(participation);
  }
};
export const ideasController = {
  list: async (_: Request, res: Response) => res.json(await prisma.idea.findMany({ include: { user: { select: { name: true } } } })),
  create: async (req: AuthedRequest, res: Response) => res.status(201).json(await prisma.idea.create({ data: { ...ideaSchema.parse(req.body), userId: req.user!.userId } }))
};
export const complaintsController = {
  list: async (_: Request, res: Response) => res.json(await prisma.complaint.findMany({ include: { user: { select: { name: true } } } })),
  create: async (req: AuthedRequest, res: Response) => res.status(201).json(await prisma.complaint.create({ data: { ...complaintSchema.parse(req.body), userId: req.user!.userId } }))
};
