import { PrismaClient } from "@prisma/client";
import mongoose, { Schema } from "mongoose";
import type {
  CenterInput,
  CenterUpdateInput,
  ChallengeInput,
  ChallengeUpdateInput,
  ComplaintInput,
  IdeaInput,
  MonthlyReportRow,
  MonthlyUploadItem,
  ProfileUpdateInput,
  ReportInput,
  UserAdminUpdateInput
} from "@qys/shared";
import { normalizeRole } from "../auth/rbac";
import { env } from "../config/env";

export type Role = "SUPER_ADMIN" | "MINISTRY_MANAGER" | "DIRECTORATE_MANAGER" | "CENTER_MANAGER" | "USER" | "ADMIN" | "CENTER";
type DatabaseProvider = "postgres" | "mongodb";

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  centerId?: number | null;
  createdBy?: number | null;
  isActive: boolean;
  lastLogin?: Date | null;
  points: number;
  status: string;
  avatar?: string | null;
  language: string;
  theme: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CenterRecord {
  id: number;
  name: string;
  location: string;
  capacity?: number | null;
  rating?: number | null;
  type: string;
  image?: string | null;
  description: string;
  createdAt: Date;
}

export interface ChallengeRecord {
  id: number;
  title: string;
  description: string;
  reward: number;
  status: string;
  category: string;
  participants: number;
  maxParticipants?: number | null;
  deadline: Date;
  createdAt: Date;
}

export interface ChallengeParticipationRecord {
  id: number;
  userId: number;
  challengeId: number;
  joinedAt: Date;
  completed: boolean;
  pointsEarned: number;
}

export interface IdeaRecord {
  id: number;
  userId: number;
  title: string;
  description: string;
  status: string;
  votes: number;
  createdAt: Date;
}

export interface ComplaintRecord {
  id: number;
  userId: number;
  title: string;
  description: string;
  status: string;
  type: string;
  createdAt: Date;
}

export interface ActivityRecord {
  id: number;
  action: string;
  userId?: number | null;
  userName?: string | null;
  timestamp: Date;
}

export interface ReportRecord {
  id: number;
  type: string;
  title: string;
  content: string;
  userId?: number | null;
  centerId?: number | null;
  date: Date;
  status: string;
}

export interface MonthlyReportRecord {
  id: number;
  centerId: number;
  month: string;
  revenues: number;
  expenses: number;
  seminarsCount: number;
  uploadedBy?: number | null;
  uploadedFileId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadedFileRecord {
  id: number;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  extension: string;
  hash: string;
  status: string;
  centerId?: number | null;
  month?: string | null;
  error?: string | null;
  uploadedBy?: number | null;
  uploadedAt: Date;
}

export interface UploadHistoryRecord {
  id: number;
  action: string;
  centerId?: number | null;
  month?: string | null;
  uploadedFileId?: number | null;
  reportId?: number | null;
  userId?: number | null;
  message?: string | null;
  createdAt: Date;
}

interface CounterRecord {
  key: string;
  seq: number;
}

export type PublicUser = Omit<UserRecord, "passwordHash">;
export type AuthUser = Pick<UserRecord, "id" | "name" | "email" | "role" | "passwordHash" | "centerId" | "createdBy" | "isActive" | "lastLogin" | "points" | "status" | "avatar" | "language" | "theme" | "createdAt" | "updatedAt">;
type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
  centerId?: number | null;
  createdBy?: number | null;
  isActive?: boolean;
  points?: number;
  status?: string;
  avatar?: string | null;
  language?: string;
  theme?: string;
};
type CreateMonthlyReportInput = {
  centerId: number;
  month: string;
  revenues: number;
  expenses: number;
  seminarsCount: number;
  uploadedBy?: number | null;
  uploadedFileId?: number | null;
};
type CreateUploadedFileInput = Omit<UploadedFileRecord, "id" | "uploadedAt"> & { uploadedAt?: Date };
type CreateUploadHistoryInput = Omit<UploadHistoryRecord, "id" | "createdAt"> & { createdAt?: Date };
type ChallengeListItem = ChallengeRecord & { _count: { participations: number }; joined?: boolean };
type IdeaListItem = IdeaRecord & { user: { name: string } };
type ComplaintListItem = ComplaintRecord & { user: { name: string } };

const databaseProvider: DatabaseProvider = env.DATABASE_URL ? "postgres" : "mongodb";
let prisma: PrismaClient | null = null;

if (databaseProvider === "postgres") {
  prisma = new PrismaClient();
}

const counterSchema = new Schema<CounterRecord>(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 }
  },
  { versionKey: false }
);

const mongoUserSchema = new Schema<UserRecord>(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["SUPER_ADMIN", "MINISTRY_MANAGER", "DIRECTORATE_MANAGER", "CENTER_MANAGER", "USER", "ADMIN", "CENTER"], default: "USER", required: true },
    centerId: { type: Number },
    createdBy: { type: Number },
    isActive: { type: Boolean, default: true, required: true },
    lastLogin: { type: Date },
    points: { type: Number, default: 0, required: true },
    status: { type: String, default: "ACTIVE", required: true },
    avatar: { type: String },
    language: { type: String, default: "ar", required: true },
    theme: { type: String, default: "light", required: true },
    createdAt: { type: Date, default: () => new Date(), required: true },
    updatedAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false, timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

const mongoCenterSchema = new Schema<CenterRecord>(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    capacity: { type: Number },
    rating: { type: Number },
    type: { type: String, required: true },
    image: { type: String },
    description: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false }
);

const mongoChallengeSchema = new Schema<ChallengeRecord>(
  {
    id: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    reward: { type: Number, required: true },
    status: { type: String, default: "ACTIVE", required: true },
    category: { type: String, required: true },
    participants: { type: Number, default: 0, required: true },
    maxParticipants: { type: Number },
    deadline: { type: Date, required: true },
    createdAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false }
);

const mongoChallengeParticipationSchema = new Schema<ChallengeParticipationRecord>(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: Number, required: true },
    challengeId: { type: Number, required: true },
    joinedAt: { type: Date, default: () => new Date(), required: true },
    completed: { type: Boolean, default: false, required: true },
    pointsEarned: { type: Number, default: 0, required: true }
  },
  { versionKey: false }
);
mongoChallengeParticipationSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

const mongoIdeaSchema = new Schema<IdeaRecord>(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, default: "PENDING", required: true },
    votes: { type: Number, default: 0, required: true },
    createdAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false }
);

const mongoComplaintSchema = new Schema<ComplaintRecord>(
  {
    id: { type: Number, required: true, unique: true },
    userId: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, default: "PENDING", required: true },
    type: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false }
);

const mongoActivitySchema = new Schema<ActivityRecord>(
  {
    id: { type: Number, required: true, unique: true },
    action: { type: String, required: true },
    userId: { type: Number },
    userName: { type: String },
    timestamp: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false }
);

const mongoReportSchema = new Schema<ReportRecord>(
  {
    id: { type: Number, required: true, unique: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    userId: { type: Number },
    centerId: { type: Number },
    date: { type: Date, default: () => new Date(), required: true },
    status: { type: String, default: "PENDING", required: true }
  },
  { versionKey: false }
);

const mongoMonthlyReportSchema = new Schema<MonthlyReportRecord>(
  {
    id: { type: Number, required: true, unique: true },
    centerId: { type: Number, required: true },
    month: { type: String, required: true },
    revenues: { type: Number, required: true },
    expenses: { type: Number, required: true },
    seminarsCount: { type: Number, required: true },
    uploadedBy: { type: Number },
    uploadedFileId: { type: Number },
    createdAt: { type: Date, default: () => new Date(), required: true },
    updatedAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false, timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);
mongoMonthlyReportSchema.index({ centerId: 1, month: 1 }, { unique: true });
mongoMonthlyReportSchema.index({ month: 1 });

const mongoUploadedFileSchema = new Schema<UploadedFileRecord>(
  {
    id: { type: Number, required: true, unique: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    extension: { type: String, required: true },
    hash: { type: String, required: true },
    status: { type: String, required: true },
    centerId: { type: Number },
    month: { type: String },
    error: { type: String },
    uploadedBy: { type: Number },
    uploadedAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false }
);
mongoUploadedFileSchema.index({ month: 1 });
mongoUploadedFileSchema.index({ centerId: 1, month: 1 });

const mongoUploadHistorySchema = new Schema<UploadHistoryRecord>(
  {
    id: { type: Number, required: true, unique: true },
    action: { type: String, required: true },
    centerId: { type: Number },
    month: { type: String },
    uploadedFileId: { type: Number },
    reportId: { type: Number },
    userId: { type: Number },
    message: { type: String },
    createdAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false }
);
mongoUploadHistorySchema.index({ month: 1 });
mongoUploadHistorySchema.index({ centerId: 1, month: 1 });

function getOrCreateModel<T>(name: string, schema: Schema<T>) {
  return (mongoose.models[name] as mongoose.Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

const Counter = getOrCreateModel<CounterRecord>("Counter", counterSchema);
const MongoUser = getOrCreateModel<UserRecord>("User", mongoUserSchema);
const MongoCenter = getOrCreateModel<CenterRecord>("Center", mongoCenterSchema);
const MongoChallenge = getOrCreateModel<ChallengeRecord>("Challenge", mongoChallengeSchema);
const MongoChallengeParticipation = getOrCreateModel<ChallengeParticipationRecord>("ChallengeParticipation", mongoChallengeParticipationSchema);
const MongoIdea = getOrCreateModel<IdeaRecord>("Idea", mongoIdeaSchema);
const MongoComplaint = getOrCreateModel<ComplaintRecord>("Complaint", mongoComplaintSchema);
const MongoActivity = getOrCreateModel<ActivityRecord>("Activity", mongoActivitySchema);
const MongoReport = getOrCreateModel<ReportRecord>("Report", mongoReportSchema);
const MongoMonthlyReport = getOrCreateModel<MonthlyReportRecord>("MonthlyReport", mongoMonthlyReportSchema);
const MongoUploadedFile = getOrCreateModel<UploadedFileRecord>("UploadedFile", mongoUploadedFileSchema);
const MongoUploadHistory = getOrCreateModel<UploadHistoryRecord>("UploadHistory", mongoUploadHistorySchema);

async function ensureMongoConnected(): Promise<void> {
  if (!env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required when DATABASE_URL is not set");
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URL);
}

async function nextId(key: string): Promise<number> {
  const counter = (await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
    .lean()
    .exec()) as CounterRecord | null;
  if (!counter) throw new Error(`Could not create counter for ${key}`);
  return counter.seq;
}

function clean<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== "")) as Partial<T>;
}

function asRole(role?: string): Role {
  return normalizeRole(role);
}

function parseDeadline(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function getPrisma() {
  if (!prisma) throw new Error("Prisma client is not initialized");
  return prisma as any;
}

async function userNameById(userId?: number | null) {
  if (!userId) return undefined;
  const user = await db.users.findById(userId);
  return user?.name;
}

export async function initDatabase(): Promise<void> {
  if (databaseProvider === "postgres") {
    await getPrisma().$connect();
    return;
  }
  await ensureMongoConnected();
}

export async function disconnectDatabase(): Promise<void> {
  if (databaseProvider === "postgres") {
    if (prisma) await prisma.$disconnect();
    return;
  }
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export const db = {
  provider: databaseProvider,
  users: {
    async findByEmail(email: string): Promise<AuthUser | null> {
      if (databaseProvider === "postgres") {
        return getPrisma().user.findUnique({ where: { email } });
      }
      await ensureMongoConnected();
      return (await MongoUser.findOne({ email }, { _id: 0 }).lean().exec()) as AuthUser | null;
    },

    async findAuthById(id: number): Promise<AuthUser | null> {
      if (databaseProvider === "postgres") {
        return getPrisma().user.findUnique({ where: { id } });
      }
      await ensureMongoConnected();
      return (await MongoUser.findOne({ id }, { _id: 0 }).lean().exec()) as AuthUser | null;
    },

    async findById(id: number): Promise<PublicUser | null> {
      if (databaseProvider === "postgres") {
        const user = await getPrisma().user.findUnique({ where: { id } });
        if (!user) return null;
        const { passwordHash: _passwordHash, ...publicUser } = user;
        return publicUser;
      }
      await ensureMongoConnected();
      const user = (await MongoUser.findOne({ id }, { _id: 0, passwordHash: 0 }).lean().exec()) as PublicUser | null;
      return user ?? null;
    },

    async create(input: CreateUserInput): Promise<PublicUser> {
      const payload = {
        ...input,
        role: asRole(input.role),
        points: input.points ?? 0,
        status: input.status ?? "ACTIVE",
        isActive: input.isActive ?? true,
        language: input.language ?? "ar",
        theme: input.theme ?? "light"
      };
      if (databaseProvider === "postgres") {
        const user = await getPrisma().user.create({ data: payload });
        const { passwordHash: _passwordHash, ...publicUser } = user;
        return publicUser;
      }

      await ensureMongoConnected();
      const id = await nextId("users");
      try {
        const user = await MongoUser.create({ ...payload, id });
        const object = user.toObject() as UserRecord;
        const { passwordHash: _passwordHash, ...publicUser } = object;
        return publicUser;
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) {
          throw new Error("Email exists");
        }
        throw error;
      }
    },

    async update(id: number, input: UserAdminUpdateInput | ProfileUpdateInput & { passwordHash?: string }): Promise<PublicUser> {
      const data = clean({ ...input, role: "role" in input ? asRole(input.role) : undefined });
      if (databaseProvider === "postgres") {
        const user = await getPrisma().user.update({ where: { id }, data });
        const { passwordHash: _passwordHash, ...publicUser } = user;
        return publicUser;
      }

      await ensureMongoConnected();
      const user = (await MongoUser.findOneAndUpdate({ id }, { $set: data }, { new: true, projection: { _id: 0, passwordHash: 0 } })
        .lean()
        .exec()) as PublicUser | null;
      if (!user) throw new Error("User not found");
      return user;
    },

    async delete(id: number): Promise<void> {
      if (databaseProvider === "postgres") {
        await getPrisma().user.delete({ where: { id } });
        return;
      }
      await ensureMongoConnected();
      await Promise.all([
        MongoUser.deleteOne({ id }).exec(),
        MongoIdea.deleteMany({ userId: id }).exec(),
        MongoComplaint.deleteMany({ userId: id }).exec(),
        MongoChallengeParticipation.deleteMany({ userId: id }).exec()
      ]);
    },

    async list(filter?: { centerId?: number }): Promise<PublicUser[]> {
      const where = filter?.centerId ? { centerId: filter.centerId } : {};
      if (databaseProvider === "postgres") {
        return getPrisma().user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            centerId: true,
            createdBy: true,
            isActive: true,
            lastLogin: true,
            points: true,
            status: true,
            avatar: true,
            language: true,
            theme: true,
            createdAt: true,
            updatedAt: true
          }
        });
      }
      await ensureMongoConnected();
      return (await MongoUser.find(where, { _id: 0, passwordHash: 0 }).sort({ createdAt: -1 }).lean().exec()) as PublicUser[];
    },

    async recordLogin(id: number): Promise<void> {
      const data = { lastLogin: new Date(), status: "ACTIVE" };
      if (databaseProvider === "postgres") {
        await getPrisma().user.update({ where: { id }, data });
        return;
      }
      await ensureMongoConnected();
      await MongoUser.updateOne({ id }, { $set: data }).exec();
    }
  },

  centers: {
    async list(): Promise<CenterRecord[]> {
      if (databaseProvider === "postgres") return getPrisma().center.findMany({ orderBy: { id: "asc" } });
      await ensureMongoConnected();
      return (await MongoCenter.find({}, { _id: 0 }).sort({ id: 1 }).lean().exec()) as CenterRecord[];
    },
    async get(id: number): Promise<CenterRecord | null> {
      if (databaseProvider === "postgres") return getPrisma().center.findUnique({ where: { id } });
      await ensureMongoConnected();
      return (await MongoCenter.findOne({ id }, { _id: 0 }).lean().exec()) as CenterRecord | null;
    },
    async create(data: CenterInput): Promise<CenterRecord> {
      if (databaseProvider === "postgres") return getPrisma().center.create({ data });
      await ensureMongoConnected();
      const center = await MongoCenter.create({ ...data, id: await nextId("centers") });
      return center.toObject() as unknown as CenterRecord;
    },
    async update(id: number, data: CenterUpdateInput): Promise<CenterRecord> {
      if (databaseProvider === "postgres") return getPrisma().center.update({ where: { id }, data: clean(data) });
      await ensureMongoConnected();
      const center = (await MongoCenter.findOneAndUpdate({ id }, { $set: clean(data) }, { new: true, projection: { _id: 0 } }).lean().exec()) as CenterRecord | null;
      if (!center) throw new Error("Center not found");
      return center;
    },
    async delete(id: number): Promise<void> {
      if (databaseProvider === "postgres") {
        await getPrisma().center.delete({ where: { id } });
        return;
      }
      await ensureMongoConnected();
      await MongoCenter.deleteOne({ id }).exec();
    }
  },

  challenges: {
    async list(userId?: number): Promise<ChallengeListItem[]> {
      if (databaseProvider === "postgres") {
        const items = await getPrisma().challenge.findMany({ include: { _count: { select: { participations: true } }, participations: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { createdAt: "desc" } });
        return items.map((item: any) => ({ ...item, joined: Boolean(item.participations?.length), participations: undefined }));
      }
      await ensureMongoConnected();
      const [challenges, participationCounts, joined] = await Promise.all([
        MongoChallenge.find({}, { _id: 0 }).sort({ createdAt: -1 }).lean().exec(),
        MongoChallengeParticipation.aggregate<{ _id: number; count: number }>([{ $group: { _id: "$challengeId", count: { $sum: 1 } } }]),
        userId ? MongoChallengeParticipation.find({ userId }, { _id: 0, challengeId: 1 }).lean().exec() : []
      ]);
      const counts = new Map(participationCounts.map((item) => [item._id, item.count]));
      const joinedIds = new Set((joined as Array<{ challengeId: number }>).map((item) => item.challengeId));
      return (challenges as ChallengeRecord[]).map((challenge) => ({
        ...challenge,
        _count: { participations: counts.get(challenge.id) ?? challenge.participants ?? 0 },
        joined: joinedIds.has(challenge.id)
      }));
    },
    async get(id: number, userId?: number): Promise<ChallengeListItem | null> {
      const [item] = (await this.list(userId)).filter((challenge) => challenge.id === id);
      return item ?? null;
    },
    async create(data: ChallengeInput): Promise<ChallengeRecord> {
      const payload = { ...data, deadline: parseDeadline(data.deadline), status: data.status ?? "ACTIVE", participants: data.participants ?? 0 };
      if (databaseProvider === "postgres") return getPrisma().challenge.create({ data: payload });
      await ensureMongoConnected();
      const challenge = await MongoChallenge.create({ ...payload, id: await nextId("challenges") });
      return challenge.toObject() as unknown as ChallengeRecord;
    },
    async update(id: number, data: ChallengeUpdateInput): Promise<ChallengeRecord> {
      const payload = clean({ ...data, deadline: data.deadline ? parseDeadline(data.deadline) : undefined });
      if (databaseProvider === "postgres") return getPrisma().challenge.update({ where: { id }, data: payload });
      await ensureMongoConnected();
      const challenge = (await MongoChallenge.findOneAndUpdate({ id }, { $set: payload }, { new: true, projection: { _id: 0 } }).lean().exec()) as ChallengeRecord | null;
      if (!challenge) throw new Error("Challenge not found");
      return challenge;
    },
    async delete(id: number): Promise<void> {
      if (databaseProvider === "postgres") {
        await getPrisma().challenge.delete({ where: { id } });
        return;
      }
      await ensureMongoConnected();
      await Promise.all([MongoChallenge.deleteOne({ id }).exec(), MongoChallengeParticipation.deleteMany({ challengeId: id }).exec()]);
    },
    async join(challengeId: number, userId: number): Promise<ChallengeParticipationRecord> {
      const challenge = await db.challenges.get(challengeId);
      if (!challenge) throw new Error("Challenge not found");
      if (challenge.maxParticipants && challenge._count.participations >= challenge.maxParticipants) throw new Error("Challenge is full");

      if (databaseProvider === "postgres") {
        const participation = await getPrisma().challengeParticipation.create({ data: { challengeId, userId } });
        await getPrisma().challenge.update({ where: { id: challengeId }, data: { participants: { increment: 1 } } });
        return participation;
      }

      await ensureMongoConnected();
      try {
        const participation = await MongoChallengeParticipation.create({ id: await nextId("challenge_participations"), challengeId, userId });
        await MongoChallenge.updateOne({ id: challengeId }, { $inc: { participants: 1 } }).exec();
        return participation.toObject() as unknown as ChallengeParticipationRecord;
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) {
          throw new Error("You already joined this challenge");
        }
        throw error;
      }
    }
  },

  ideas: {
    async list(): Promise<IdeaListItem[]> {
      if (databaseProvider === "postgres") return getPrisma().idea.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
      await ensureMongoConnected();
      const ideas = (await MongoIdea.find({}, { _id: 0 }).sort({ createdAt: -1 }).lean().exec()) as IdeaRecord[];
      const users = (await MongoUser.find({ id: { $in: [...new Set(ideas.map((idea) => idea.userId))] } }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>;
      const names = new Map(users.map((user) => [user.id, user.name]));
      return ideas.map((idea) => ({ ...idea, user: { name: names.get(idea.userId) ?? "Unknown" } }));
    },
    async create(data: IdeaInput, userId: number): Promise<IdeaRecord> {
      if (databaseProvider === "postgres") return getPrisma().idea.create({ data: { ...data, userId } });
      await ensureMongoConnected();
      const idea = await MongoIdea.create({ ...data, userId, id: await nextId("ideas") });
      return idea.toObject() as unknown as IdeaRecord;
    },
    async vote(id: number): Promise<IdeaRecord> {
      if (databaseProvider === "postgres") return getPrisma().idea.update({ where: { id }, data: { votes: { increment: 1 } } });
      await ensureMongoConnected();
      const idea = (await MongoIdea.findOneAndUpdate({ id }, { $inc: { votes: 1 } }, { new: true, projection: { _id: 0 } }).lean().exec()) as IdeaRecord | null;
      if (!idea) throw new Error("Idea not found");
      return idea;
    },
    async updateStatus(id: number, status: string): Promise<IdeaRecord> {
      if (databaseProvider === "postgres") return getPrisma().idea.update({ where: { id }, data: { status } });
      await ensureMongoConnected();
      const idea = (await MongoIdea.findOneAndUpdate({ id }, { $set: { status } }, { new: true, projection: { _id: 0 } }).lean().exec()) as IdeaRecord | null;
      if (!idea) throw new Error("Idea not found");
      return idea;
    }
  },

  complaints: {
    async list(userId?: number): Promise<ComplaintListItem[]> {
      if (databaseProvider === "postgres") {
        const where = userId ? { userId } : {};
        return getPrisma().complaint.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
      }
      await ensureMongoConnected();
      const filter = userId ? { userId } : {};
      const complaints = (await MongoComplaint.find(filter, { _id: 0 }).sort({ createdAt: -1 }).lean().exec()) as ComplaintRecord[];
      const users = (await MongoUser.find({ id: { $in: [...new Set(complaints.map((complaint) => complaint.userId))] } }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>;
      const names = new Map(users.map((user) => [user.id, user.name]));
      return complaints.map((complaint) => ({ ...complaint, user: { name: names.get(complaint.userId) ?? "Unknown" } }));
    },
    async create(data: ComplaintInput, userId: number): Promise<ComplaintRecord> {
      if (databaseProvider === "postgres") return getPrisma().complaint.create({ data: { ...data, userId } });
      await ensureMongoConnected();
      const complaint = await MongoComplaint.create({ ...data, userId, id: await nextId("complaints") });
      return complaint.toObject() as unknown as ComplaintRecord;
    },
    async updateStatus(id: number, status: string): Promise<ComplaintRecord> {
      if (databaseProvider === "postgres") return getPrisma().complaint.update({ where: { id }, data: { status } });
      await ensureMongoConnected();
      const complaint = (await MongoComplaint.findOneAndUpdate({ id }, { $set: { status } }, { new: true, projection: { _id: 0 } }).lean().exec()) as ComplaintRecord | null;
      if (!complaint) throw new Error("Complaint not found");
      return complaint;
    }
  },

  activities: {
    async create(action: string, userId?: number | null): Promise<ActivityRecord> {
      const userName = await userNameById(userId);
      if (databaseProvider === "postgres") return getPrisma().activity.create({ data: { action, userId, userName } });
      await ensureMongoConnected();
      const activity = await MongoActivity.create({ id: await nextId("activities"), action, userId, userName });
      return activity.toObject() as unknown as ActivityRecord;
    },
    async list(limit = 50): Promise<ActivityRecord[]> {
      if (databaseProvider === "postgres") return getPrisma().activity.findMany({ orderBy: { timestamp: "desc" }, take: limit });
      await ensureMongoConnected();
      return (await MongoActivity.find({}, { _id: 0 }).sort({ timestamp: -1 }).limit(limit).lean().exec()) as ActivityRecord[];
    }
  },

  reports: {
    async create(data: ReportInput & { userId?: number | null; centerId?: number | null; date?: Date }): Promise<ReportRecord> {
      if (databaseProvider === "postgres") return getPrisma().report.create({ data });
      await ensureMongoConnected();
      const report = await MongoReport.create({ ...data, id: await nextId("reports") });
      return report.toObject() as unknown as ReportRecord;
    },
    async list(filter?: { centerId?: number }): Promise<ReportRecord[]> {
      const where = filter?.centerId ? { centerId: filter.centerId } : {};
      if (databaseProvider === "postgres") return getPrisma().report.findMany({ where, orderBy: { date: "desc" } });
      await ensureMongoConnected();
      return (await MongoReport.find(where, { _id: 0 }).sort({ date: -1 }).lean().exec()) as ReportRecord[];
    }
  },

  monthlyReports: {
    async findByCenterMonth(centerId: number, month: string): Promise<MonthlyReportRecord | null> {
      if (databaseProvider === "postgres") {
        return getPrisma().monthlyReport.findUnique({ where: { centerId_month: { centerId, month } } });
      }
      await ensureMongoConnected();
      return (await MongoMonthlyReport.findOne({ centerId, month }, { _id: 0 }).lean().exec()) as MonthlyReportRecord | null;
    },
    async create(data: CreateMonthlyReportInput): Promise<MonthlyReportRecord> {
      if (databaseProvider === "postgres") return getPrisma().monthlyReport.create({ data });
      await ensureMongoConnected();
      const report = await MongoMonthlyReport.create({ ...data, id: await nextId("monthly_reports") });
      return report.toObject() as unknown as MonthlyReportRecord;
    },
    async replace(id: number, data: CreateMonthlyReportInput): Promise<MonthlyReportRecord> {
      if (databaseProvider === "postgres") return getPrisma().monthlyReport.update({ where: { id }, data });
      await ensureMongoConnected();
      const report = (await MongoMonthlyReport.findOneAndUpdate(
        { id },
        { $set: data },
        { new: true, projection: { _id: 0 } }
      ).lean().exec()) as MonthlyReportRecord | null;
      if (!report) throw new Error("Monthly report not found");
      return report;
    },
    async list(filter: { month: string; centerId?: number }): Promise<MonthlyReportRow[]> {
      const where = filter.centerId ? { month: filter.month, centerId: filter.centerId } : { month: filter.month };
      if (databaseProvider === "postgres") {
        const items = await getPrisma().monthlyReport.findMany({
          where,
          include: { center: { select: { name: true } }, uploadedFile: { select: { originalName: true } } },
          orderBy: { centerId: "asc" }
        });
        return items.map((item: any) => ({
          id: item.id,
          centerId: item.centerId,
          centerName: item.center.name,
          month: item.month,
          revenues: item.revenues,
          expenses: item.expenses,
          seminarsCount: item.seminarsCount,
          uploadedBy: item.uploadedBy,
          uploadedAt: item.updatedAt,
          sourceFileName: item.uploadedFile?.originalName ?? null
        }));
      }
      await ensureMongoConnected();
      const [reports, centers, files] = await Promise.all([
        MongoMonthlyReport.find(where, { _id: 0 }).sort({ centerId: 1 }).lean().exec(),
        MongoCenter.find({}, { _id: 0, id: 1, name: 1 }).lean().exec(),
        MongoUploadedFile.find({}, { _id: 0, id: 1, originalName: 1 }).lean().exec()
      ]);
      const centerNames = new Map((centers as Array<Pick<CenterRecord, "id" | "name">>).map((center) => [center.id, center.name]));
      const fileNames = new Map((files as Array<Pick<UploadedFileRecord, "id" | "originalName">>).map((file) => [file.id, file.originalName]));
      return (reports as MonthlyReportRecord[]).map((report) => ({
        id: report.id,
        centerId: report.centerId,
        centerName: centerNames.get(report.centerId) ?? "Unknown",
        month: report.month,
        revenues: report.revenues,
        expenses: report.expenses,
        seminarsCount: report.seminarsCount,
        uploadedBy: report.uploadedBy,
        uploadedAt: report.updatedAt,
        sourceFileName: report.uploadedFileId ? fileNames.get(report.uploadedFileId) ?? null : null
      }));
    },
    async statistics(limit = 6) {
      if (databaseProvider === "postgres") {
        const groups = await getPrisma().monthlyReport.groupBy({
          by: ["month"],
          _sum: { revenues: true, expenses: true, seminarsCount: true },
          _count: { centerId: true },
          orderBy: { month: "desc" },
          take: limit
        });
        return groups.reverse().map((item: any) => ({
          month: item.month,
          totalRevenues: item._sum.revenues ?? 0,
          totalExpenses: item._sum.expenses ?? 0,
          totalSeminars: item._sum.seminarsCount ?? 0,
          uploadedCenters: item._count.centerId ?? 0
        }));
      }
      await ensureMongoConnected();
      const groups = await MongoMonthlyReport.aggregate<{
        _id: string;
        totalRevenues: number;
        totalExpenses: number;
        totalSeminars: number;
        uploadedCenters: number;
      }>([
        { $group: { _id: "$month", totalRevenues: { $sum: "$revenues" }, totalExpenses: { $sum: "$expenses" }, totalSeminars: { $sum: "$seminarsCount" }, uploadedCenters: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: limit }
      ]).exec();
      return groups.reverse().map((item) => ({ month: item._id, totalRevenues: item.totalRevenues, totalExpenses: item.totalExpenses, totalSeminars: item.totalSeminars, uploadedCenters: item.uploadedCenters }));
    }
  },

  uploadedFiles: {
    async create(data: CreateUploadedFileInput): Promise<UploadedFileRecord> {
      if (databaseProvider === "postgres") return getPrisma().uploadedFile.create({ data });
      await ensureMongoConnected();
      const file = await MongoUploadedFile.create({ ...data, id: await nextId("uploaded_files") });
      return file.toObject() as unknown as UploadedFileRecord;
    },
    async update(id: number, data: Partial<CreateUploadedFileInput>): Promise<UploadedFileRecord> {
      if (databaseProvider === "postgres") return getPrisma().uploadedFile.update({ where: { id }, data });
      await ensureMongoConnected();
      const file = (await MongoUploadedFile.findOneAndUpdate({ id }, { $set: clean(data as Record<string, unknown>) }, { new: true, projection: { _id: 0 } }).lean().exec()) as UploadedFileRecord | null;
      if (!file) throw new Error("Uploaded file not found");
      return file;
    },
    async list(filter?: { month?: string; centerId?: number; limit?: number }): Promise<MonthlyUploadItem[]> {
      const where = clean({ month: filter?.month, centerId: filter?.centerId });
      const limit = filter?.limit ?? 50;
      if (databaseProvider === "postgres") {
        const items = await getPrisma().uploadedFile.findMany({
          where,
          include: { center: { select: { name: true } } },
          orderBy: { uploadedAt: "desc" },
          take: limit
        });
        return items.map((item: any) => ({ ...item, centerName: item.center?.name ?? null }));
      }
      await ensureMongoConnected();
      const [files, centers] = await Promise.all([
        MongoUploadedFile.find(where, { _id: 0 }).sort({ uploadedAt: -1 }).limit(limit).lean().exec(),
        MongoCenter.find({}, { _id: 0, id: 1, name: 1 }).lean().exec()
      ]);
      const centerNames = new Map((centers as Array<Pick<CenterRecord, "id" | "name">>).map((center) => [center.id, center.name]));
      return (files as UploadedFileRecord[]).map((file) => ({ ...file, centerName: file.centerId ? centerNames.get(file.centerId) ?? null : null }));
    }
  },

  uploadHistory: {
    async create(data: CreateUploadHistoryInput): Promise<UploadHistoryRecord> {
      if (databaseProvider === "postgres") return getPrisma().uploadHistory.create({ data });
      await ensureMongoConnected();
      const item = await MongoUploadHistory.create({ ...data, id: await nextId("upload_history") });
      return item.toObject() as unknown as UploadHistoryRecord;
    }
  },

  stats: {
    async admin() {
      const [users, centers, challenges, ideas, complaints, activities] = await Promise.all([
        db.users.list(),
        db.centers.list(),
        db.challenges.list(),
        db.ideas.list(),
        db.complaints.list(),
        db.activities.list(8)
      ]);
      return {
        totalUsers: users.length,
        activeCenters: centers.length,
        challenges: challenges.length,
        pendingIdeas: ideas.filter((idea) => idea.status === "PENDING" || idea.status === "تحت الدراسة").length,
        newComplaints: complaints.filter((complaint) => complaint.status === "PENDING" || complaint.status === "قيد المعالجة").length,
        participations: challenges.reduce((total, challenge) => total + challenge._count.participations, 0),
        recentActivities: activities
      };
    },
    async me(userId: number) {
      const [user, ideas, challenges, complaints] = await Promise.all([
        db.users.findById(userId),
        db.ideas.list(),
        db.challenges.list(userId),
        db.complaints.list(userId)
      ]);
      return {
        user,
        ideas: ideas.filter((idea) => idea.userId === userId).length,
        joinedChallenges: challenges.filter((challenge) => challenge.joined).length,
        complaints: complaints.length,
        totalVotes: ideas.filter((idea) => idea.userId === userId).reduce((total, idea) => total + idea.votes, 0),
        suggestedChallenges: challenges.filter((challenge) => !challenge.joined).slice(0, 3),
        recentIdeas: ideas.slice(0, 3)
      };
    }
  }
};
