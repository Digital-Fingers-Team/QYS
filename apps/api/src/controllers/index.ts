import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { login, register } from "../services/auth.service";
import {
  centerSchema,
  centerUpdateSchema,
  challengeSchema,
  challengeUpdateSchema,
  complaintSchema,
  ideaSchema,
  profileUpdateSchema,
  statusUpdateSchema,
  userAdminSchema,
  userAdminUpdateSchema
} from "@qys/shared";
import { AuthedRequest } from "../middleware/auth";

const idParam = (req: Request) => Number(req.params.id);

async function hashPassword(password?: string) {
  return password ? bcrypt.hash(password, 10) : undefined;
}

export const authController = {
  register: async (req: Request, res: Response) => res.status(201).json(await register(req.body)),
  login: async (req: Request, res: Response) => res.json(await login(req.body)),
  me: async (req: AuthedRequest, res: Response) => {
    const user = await db.users.findById(req.user!.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  },
  updateMe: async (req: AuthedRequest, res: Response) => {
    const user = await db.users.update(req.user!.userId, profileUpdateSchema.parse(req.body));
    await db.activities.create("Updated profile settings", req.user!.userId);
    res.json(user);
  }
};

export const usersController = {
  list: async (_: Request, res: Response) => res.json(await db.users.list()),
  create: async (req: Request, res: Response) => {
    const data = userAdminSchema.parse(req.body);
    const { password, ...rest } = data;
    const user = await db.users.create({ ...rest, passwordHash: await bcrypt.hash(password || "password123", 10) });
    await db.activities.create(`Created user ${user.email}`, user.id);
    res.status(201).json(user);
  },
  update: async (req: Request, res: Response) => {
    const data = userAdminUpdateSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);
    const { password: _password, ...rest } = data;
    const user = await db.users.update(idParam(req), { ...rest, passwordHash });
    await db.activities.create(`Updated user ${user.email}`, user.id);
    res.json(user);
  },
  delete: async (req: Request, res: Response) => {
    await db.users.delete(idParam(req));
    await db.activities.create(`Deleted user #${idParam(req)}`);
    res.status(204).send();
  }
};

export const centersController = {
  list: async (_: Request, res: Response) => res.json(await db.centers.list()),
  get: async (req: Request, res: Response) => {
    const center = await db.centers.get(idParam(req));
    if (!center) return res.status(404).json({ message: "Center not found" });
    res.json(center);
  },
  create: async (req: AuthedRequest, res: Response) => {
    const center = await db.centers.create(centerSchema.parse(req.body));
    await db.activities.create(`Created center ${center.name}`, req.user?.userId);
    res.status(201).json(center);
  },
  update: async (req: AuthedRequest, res: Response) => {
    const center = await db.centers.update(idParam(req), centerUpdateSchema.parse(req.body));
    await db.activities.create(`Updated center ${center.name}`, req.user?.userId);
    res.json(center);
  },
  delete: async (req: AuthedRequest, res: Response) => {
    await db.centers.delete(idParam(req));
    await db.activities.create(`Deleted center #${idParam(req)}`, req.user?.userId);
    res.status(204).send();
  }
};

export const challengesController = {
  list: async (req: AuthedRequest, res: Response) => res.json(await db.challenges.list(req.user?.userId)),
  get: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.get(idParam(req), req.user?.userId);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    res.json(challenge);
  },
  create: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.create(challengeSchema.parse(req.body));
    await db.activities.create(`Created challenge ${challenge.title}`, req.user?.userId);
    res.status(201).json(challenge);
  },
  update: async (req: AuthedRequest, res: Response) => {
    const challenge = await db.challenges.update(idParam(req), challengeUpdateSchema.parse(req.body));
    await db.activities.create(`Updated challenge ${challenge.title}`, req.user?.userId);
    res.json(challenge);
  },
  delete: async (req: AuthedRequest, res: Response) => {
    await db.challenges.delete(idParam(req));
    await db.activities.create(`Deleted challenge #${idParam(req)}`, req.user?.userId);
    res.status(204).send();
  },
  join: async (req: AuthedRequest, res: Response) => {
    const participation = await db.challenges.join(idParam(req), req.user!.userId);
    await db.activities.create(`Joined challenge #${idParam(req)}`, req.user!.userId);
    res.status(201).json(participation);
  }
};

export const ideasController = {
  list: async (_: Request, res: Response) => res.json(await db.ideas.list()),
  create: async (req: AuthedRequest, res: Response) => {
    const idea = await db.ideas.create(ideaSchema.parse(req.body), req.user!.userId);
    await db.activities.create(`Submitted idea ${idea.title}`, req.user!.userId);
    res.status(201).json(idea);
  },
  vote: async (req: AuthedRequest, res: Response) => {
    const idea = await db.ideas.vote(idParam(req));
    await db.activities.create(`Voted for idea #${idParam(req)}`, req.user?.userId);
    res.json(idea);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const idea = await db.ideas.updateStatus(idParam(req), status);
    await db.activities.create(`Updated idea status to ${status}`, req.user?.userId);
    res.json(idea);
  }
};

export const complaintsController = {
  list: async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.role === "ADMIN" ? undefined : req.user?.userId;
    res.json(await db.complaints.list(userId));
  },
  create: async (req: AuthedRequest, res: Response) => {
    const complaint = await db.complaints.create(complaintSchema.parse(req.body), req.user!.userId);
    await db.activities.create(`Submitted complaint ${complaint.title}`, req.user!.userId);
    res.status(201).json(complaint);
  },
  updateStatus: async (req: AuthedRequest, res: Response) => {
    const { status } = statusUpdateSchema.parse(req.body);
    const complaint = await db.complaints.updateStatus(idParam(req), status);
    await db.activities.create(`Updated complaint status to ${status}`, req.user?.userId);
    res.json(complaint);
  }
};

export const reportsController = {
  list: async (_: Request, res: Response) => res.json(await db.reports.list())
};

export const activitiesController = {
  list: async (_: Request, res: Response) => res.json(await db.activities.list())
};

export const statsController = {
  admin: async (_: Request, res: Response) => res.json(await db.stats.admin()),
  me: async (req: AuthedRequest, res: Response) => res.json(await db.stats.me(req.user!.userId))
};
