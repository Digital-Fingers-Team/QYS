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
  Paginated,
  ProfileUpdateInput,
  PaginationQueryInput,
  ReportInput,
  UserAdminUpdateInput
} from "@qys/shared";
import { normalizeRole } from "../auth/rbac";
import { env } from "../config/env";
import { ApiError } from "../errors/api-error";
import { cache, cacheKey } from "../services/cache.service";

export type Role = "DIRECTORATE_MANAGER" | "CENTER_MANAGER" | "USER" | "ADMIN" | "CENTER";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

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
  deletedAt?: Date | null;
  deletedBy?: number | null;
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
export type AuthUser = Pick<UserRecord, "id" | "name" | "email" | "role" | "passwordHash" | "centerId" | "createdBy" | "isActive" | "lastLogin" | "points" | "status" | "avatar" | "language" | "theme" | "deletedAt" | "deletedBy" | "createdAt" | "updatedAt">;
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
type PageFilter = Pick<PaginationQueryInput, "page" | "pageSize">;
type ListFilter = { q?: string; page?: number; pageSize?: number };

const counterSchema = new Schema<CounterRecord>({ key: { type: String, required: true, unique: true }, seq: { type: Number, required: true, default: 0 } }, { versionKey: false });

const mongoUserSchema = new Schema<UserRecord>(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["DIRECTORATE_MANAGER", "CENTER_MANAGER", "USER", "ADMIN", "CENTER"], default: "USER", required: true },
    centerId: { type: Number },
    createdBy: { type: Number },
    isActive: { type: Boolean, default: true, required: true },
    lastLogin: { type: Date },
    points: { type: Number, default: 0, required: true },
    status: { type: String, default: "ACTIVE", required: true },
    avatar: { type: String },
    language: { type: String, default: "ar", required: true },
    theme: { type: String, default: "light", required: true },
    deletedAt: { type: Date },
    deletedBy: { type: Number },
    createdAt: { type: Date, default: () => new Date(), required: true },
    updatedAt: { type: Date, default: () => new Date(), required: true }
  },
  { versionKey: false, timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);
mongoUserSchema.index({ centerId: 1 });
mongoUserSchema.index({ createdAt: -1 });
mongoUserSchema.index({ isActive: 1, status: 1, deletedAt: 1 });

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
mongoCenterSchema.index({ name: 1, location: 1 });

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
mongoChallengeSchema.index({ status: 1, createdAt: -1 });

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
mongoIdeaSchema.index({ userId: 1, createdAt: -1 });
mongoIdeaSchema.index({ status: 1, createdAt: -1 });

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
mongoComplaintSchema.index({ userId: 1, createdAt: -1 });
mongoComplaintSchema.index({ status: 1, createdAt: -1 });

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
mongoActivitySchema.index({ timestamp: -1 });

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
mongoReportSchema.index({ centerId: 1, date: -1 });

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
mongoUploadedFileSchema.index({ uploadedAt: -1 });

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
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URL);
}

async function nextId(key: string): Promise<number> {
  const counter = (await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean().exec()) as CounterRecord | null;
  if (!counter) throw new ApiError(500, "Could not create database counter", "DATABASE_COUNTER_ERROR");
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

function wantsPage(filter?: ListFilter): filter is PageFilter & ListFilter {
  return filter?.page !== undefined || filter?.pageSize !== undefined;
}

function pageFilter(filter?: ListFilter): PageFilter {
  return {
    page: Math.max(1, Math.trunc(Number(filter?.page ?? 1))),
    pageSize: Math.min(100, Math.max(1, Math.trunc(Number(filter?.pageSize ?? 20))))
  };
}

function paginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

function regexFor(value?: string) {
  const q = value?.trim();
  if (!q) return undefined;
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function notDeleted() {
  return { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };
}

export async function initDatabase(): Promise<void> {
  await ensureMongoConnected();
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export const db = {
  provider: "mongodb" as const,
  users: {
    async findByEmail(email: string): Promise<AuthUser | null> {
      await ensureMongoConnected();
      return (await MongoUser.findOne({ email }, { _id: 0 }).lean().exec()) as AuthUser | null;
    },
    async findAuthById(id: number): Promise<AuthUser | null> {
      await ensureMongoConnected();
      return (await MongoUser.findOne({ id }, { _id: 0 }).lean().exec()) as AuthUser | null;
    },
    async findById(id: number): Promise<PublicUser | null> {
      await ensureMongoConnected();
      return (await MongoUser.findOne({ id }, { _id: 0, passwordHash: 0 }).lean().exec()) as PublicUser | null;
    },
    async create(input: CreateUserInput): Promise<PublicUser> {
      await ensureMongoConnected();
      const payload = {
        ...input,
        role: asRole(input.role),
        points: input.points ?? 0,
        status: input.status ?? "ACTIVE",
        isActive: input.isActive ?? true,
        language: input.language ?? "ar",
        theme: input.theme ?? "light"
      };
      try {
        const user = await MongoUser.create({ ...payload, id: await nextId("users") });
        cache.invalidate("users");
        cache.invalidate("stats");
        const object = user.toObject() as UserRecord;
        const { passwordHash: _passwordHash, ...publicUser } = object;
        return publicUser;
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) throw new ApiError(409, "Email exists", "EMAIL_EXISTS");
        throw error;
      }
    },
    async update(id: number, input: UserAdminUpdateInput | ProfileUpdateInput & { passwordHash?: string }): Promise<PublicUser> {
      await ensureMongoConnected();
      const data = clean({ ...input, role: "role" in input ? asRole(input.role) : undefined });
      const unset = "avatar" in input && input.avatar === "" ? { avatar: "" } : {};
      const update = (data as { isActive?: boolean }).isActive === true
        ? { $set: data, $unset: { deletedAt: "", deletedBy: "", ...unset } }
        : Object.keys(unset).length
          ? { $set: data, $unset: unset }
          : { $set: data };
      try {
        const user = (await MongoUser.findOneAndUpdate({ id }, update, { new: true, projection: { _id: 0, passwordHash: 0 } }).lean().exec()) as PublicUser | null;
        if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
        cache.invalidate("users");
        cache.invalidate("stats");
        return user;
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) throw new ApiError(409, "Email exists", "EMAIL_EXISTS");
        throw error;
      }
    },
    async delete(id: number, deletedBy?: number | null): Promise<PublicUser> {
      await ensureMongoConnected();
      const user = (await MongoUser.findOneAndUpdate(
        { id },
        { $set: { isActive: false, status: "INACTIVE", deletedAt: new Date(), deletedBy } },
        { new: true, projection: { _id: 0, passwordHash: 0 } }
      ).lean().exec()) as PublicUser | null;
      if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
      cache.invalidate("users");
      cache.invalidate("stats");
      return user;
    },
    async list(filter?: { centerId?: number; q?: string }): Promise<PublicUser[]> {
      await ensureMongoConnected();
      const q = regexFor(filter?.q);
      const where = clean({ centerId: filter?.centerId }) as Record<string, unknown>;
      if (q) where.$or = [{ name: q }, { email: q }];
      return (await MongoUser.find(where, { _id: 0, passwordHash: 0 }).sort({ createdAt: -1 }).lean().exec()) as PublicUser[];
    },
    async listPage(filter?: { centerId?: number; q?: string; page?: number; pageSize?: number }): Promise<Paginated<PublicUser>> {
      await ensureMongoConnected();
      const q = regexFor(filter?.q);
      const where = clean({ centerId: filter?.centerId }) as Record<string, unknown>;
      if (q) where.$or = [{ name: q }, { email: q }];
      const { page, pageSize } = pageFilter(filter);
      const [items, total] = await Promise.all([
        MongoUser.find(where, { _id: 0, passwordHash: 0 }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoUser.countDocuments(where).exec()
      ]);
      return paginated(items as PublicUser[], total, page, pageSize);
    },
    async recordLogin(id: number): Promise<void> {
      await ensureMongoConnected();
      await MongoUser.updateOne({ id }, { $set: { lastLogin: new Date(), status: "ACTIVE" } }).exec();
    }
  },

  centers: {
    async list(filter?: { q?: string }): Promise<CenterRecord[]> {
      await ensureMongoConnected();
      const q = regexFor(filter?.q);
      const where = q ? { $or: [{ name: q }, { location: q }] } : {};
      return cache.getOrSet("centers", cacheKey({ scope: "list", q: filter?.q ?? "" }), async () =>
        (await MongoCenter.find(where, { _id: 0 }).sort({ id: 1 }).lean().exec()) as CenterRecord[]
      );
    },
    async listPage(filter?: { q?: string; page?: number; pageSize?: number }): Promise<Paginated<CenterRecord>> {
      await ensureMongoConnected();
      const q = regexFor(filter?.q);
      const where = q ? { $or: [{ name: q }, { location: q }] } : {};
      const { page, pageSize } = pageFilter(filter);
      return cache.getOrSet("centers", cacheKey({ scope: "page", q: filter?.q ?? "", page, pageSize }), async () => {
        const [items, total] = await Promise.all([
          MongoCenter.find(where, { _id: 0 }).sort({ id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
          MongoCenter.countDocuments(where).exec()
        ]);
        return paginated(items as CenterRecord[], total, page, pageSize);
      });
    },
    async get(id: number): Promise<CenterRecord | null> {
      await ensureMongoConnected();
      return cache.getOrSet("centers", cacheKey({ scope: "get", id }), async () =>
        (await MongoCenter.findOne({ id }, { _id: 0 }).lean().exec()) as CenterRecord | null
      );
    },
    async create(data: CenterInput): Promise<CenterRecord> {
      await ensureMongoConnected();
      const center = await MongoCenter.create({ ...data, id: await nextId("centers") });
      cache.invalidate("centers");
      cache.invalidate("stats");
      cache.invalidate("monthly");
      return center.toObject() as unknown as CenterRecord;
    },
    async update(id: number, data: CenterUpdateInput): Promise<CenterRecord> {
      await ensureMongoConnected();
      const center = (await MongoCenter.findOneAndUpdate({ id }, { $set: clean(data) }, { new: true, projection: { _id: 0 } }).lean().exec()) as CenterRecord | null;
      if (!center) throw new ApiError(404, "Center not found", "CENTER_NOT_FOUND");
      cache.invalidate("centers");
      cache.invalidate("monthly");
      return center;
    },
    async delete(id: number): Promise<void> {
      await ensureMongoConnected();
      await MongoCenter.deleteOne({ id }).exec();
      cache.invalidate("centers");
      cache.invalidate("stats");
      cache.invalidate("monthly");
    }
  },

  challenges: {
    async list(userId?: number): Promise<ChallengeListItem[]> {
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
    async listPage(filter?: { userId?: number; page?: number; pageSize?: number }): Promise<Paginated<ChallengeListItem>> {
      await ensureMongoConnected();
      const { page, pageSize } = pageFilter(filter);
      const [challenges, total] = await Promise.all([
        MongoChallenge.find({}, { _id: 0 }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoChallenge.countDocuments({}).exec()
      ]);
      const challengeIds = (challenges as ChallengeRecord[]).map((challenge) => challenge.id);
      const [participationCounts, joined] = await Promise.all([
        challengeIds.length
          ? MongoChallengeParticipation.aggregate<{ _id: number; count: number }>([
              { $match: { challengeId: { $in: challengeIds } } },
              { $group: { _id: "$challengeId", count: { $sum: 1 } } }
            ])
          : [],
        filter?.userId && challengeIds.length
          ? MongoChallengeParticipation.find({ userId: filter.userId, challengeId: { $in: challengeIds } }, { _id: 0, challengeId: 1 }).lean().exec()
          : []
      ]);
      const counts = new Map(participationCounts.map((item) => [item._id, item.count]));
      const joinedIds = new Set((joined as Array<{ challengeId: number }>).map((item) => item.challengeId));
      const items = (challenges as ChallengeRecord[]).map((challenge) => ({
        ...challenge,
        _count: { participations: counts.get(challenge.id) ?? challenge.participants ?? 0 },
        joined: joinedIds.has(challenge.id)
      }));
      return paginated(items, total, page, pageSize);
    },
    async get(id: number, userId?: number): Promise<ChallengeListItem | null> {
      await ensureMongoConnected();
      const challenge = (await MongoChallenge.findOne({ id }, { _id: 0 }).lean().exec()) as ChallengeRecord | null;
      if (!challenge) return null;
      const [participations, joined] = await Promise.all([
        MongoChallengeParticipation.countDocuments({ challengeId: id }).exec(),
        userId ? MongoChallengeParticipation.exists({ challengeId: id, userId }) : null
      ]);
      return { ...challenge, _count: { participations: participations || challenge.participants || 0 }, joined: Boolean(joined) };
    },
    async create(data: ChallengeInput): Promise<ChallengeRecord> {
      await ensureMongoConnected();
      const payload = { ...data, deadline: parseDeadline(data.deadline), status: data.status ?? "ACTIVE", participants: data.participants ?? 0 };
      const challenge = await MongoChallenge.create({ ...payload, id: await nextId("challenges") });
      cache.invalidate("stats");
      return challenge.toObject() as unknown as ChallengeRecord;
    },
    async update(id: number, data: ChallengeUpdateInput): Promise<ChallengeRecord> {
      await ensureMongoConnected();
      const payload = clean({ ...data, deadline: data.deadline ? parseDeadline(data.deadline) : undefined });
      const challenge = (await MongoChallenge.findOneAndUpdate({ id }, { $set: payload }, { new: true, projection: { _id: 0 } }).lean().exec()) as ChallengeRecord | null;
      if (!challenge) throw new ApiError(404, "Challenge not found", "CHALLENGE_NOT_FOUND");
      cache.invalidate("stats");
      return challenge;
    },
    async delete(id: number): Promise<void> {
      await ensureMongoConnected();
      await Promise.all([MongoChallenge.deleteOne({ id }).exec(), MongoChallengeParticipation.deleteMany({ challengeId: id }).exec()]);
      cache.invalidate("stats");
    },
    async join(challengeId: number, userId: number): Promise<ChallengeParticipationRecord> {
      await ensureMongoConnected();
      const challenge = await db.challenges.get(challengeId);
      if (!challenge) throw new ApiError(404, "Challenge not found", "CHALLENGE_NOT_FOUND");
      if (challenge.maxParticipants && challenge._count.participations >= challenge.maxParticipants) throw new ApiError(409, "Challenge is full", "CHALLENGE_FULL");
      try {
        const participation = await MongoChallengeParticipation.create({ id: await nextId("challenge_participations"), challengeId, userId });
        await MongoChallenge.updateOne({ id: challengeId }, { $inc: { participants: 1 } }).exec();
        cache.invalidate("stats");
        return participation.toObject() as unknown as ChallengeParticipationRecord;
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) throw new ApiError(409, "You already joined this challenge", "CHALLENGE_ALREADY_JOINED");
        throw error;
      }
    }
  },

  ideas: {
    async list(filter?: { userId?: number }): Promise<IdeaListItem[]> {
      await ensureMongoConnected();
      const where = filter?.userId ? { userId: filter.userId } : {};
      const ideas = (await MongoIdea.find(where, { _id: 0 }).sort({ createdAt: -1 }).lean().exec()) as IdeaRecord[];
      const userIds = [...new Set(ideas.map((idea) => idea.userId))];
      const users = (await MongoUser.find({ id: mongoose.trusted({ $in: userIds }) }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>;
      const names = new Map(users.map((user) => [user.id, user.name]));
      return ideas.map((idea) => ({ ...idea, user: { name: names.get(idea.userId) ?? "Unknown" } }));
    },
    async listPage(filter?: { userId?: number; page?: number; pageSize?: number }): Promise<Paginated<IdeaListItem>> {
      await ensureMongoConnected();
      const where = filter?.userId ? { userId: filter.userId } : {};
      const { page, pageSize } = pageFilter(filter);
      const [ideas, total] = await Promise.all([
        MongoIdea.find(where, { _id: 0 }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoIdea.countDocuments(where).exec()
      ]);
      const userIds = [...new Set((ideas as IdeaRecord[]).map((idea) => idea.userId))];
      const users = userIds.length
        ? ((await MongoUser.find({ id: { $in: userIds } }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>)
        : [];
      const names = new Map(users.map((user) => [user.id, user.name]));
      const items = (ideas as IdeaRecord[]).map((idea) => ({ ...idea, user: { name: names.get(idea.userId) ?? "Unknown" } }));
      return paginated(items, total, page, pageSize);
    },
    async create(data: IdeaInput, userId: number): Promise<IdeaRecord> {
      await ensureMongoConnected();
      const idea = await MongoIdea.create({ ...data, userId, id: await nextId("ideas") });
      cache.invalidate("stats");
      return idea.toObject() as unknown as IdeaRecord;
    },
    async vote(id: number): Promise<IdeaRecord> {
      await ensureMongoConnected();
      const idea = (await MongoIdea.findOneAndUpdate({ id }, { $inc: { votes: 1 } }, { new: true, projection: { _id: 0 } }).lean().exec()) as IdeaRecord | null;
      if (!idea) throw new ApiError(404, "Idea not found", "IDEA_NOT_FOUND");
      cache.invalidate("stats");
      return idea;
    },
    async updateStatus(id: number, status: string): Promise<IdeaRecord> {
      await ensureMongoConnected();
      const idea = (await MongoIdea.findOneAndUpdate({ id }, { $set: { status } }, { new: true, projection: { _id: 0 } }).lean().exec()) as IdeaRecord | null;
      if (!idea) throw new ApiError(404, "Idea not found", "IDEA_NOT_FOUND");
      cache.invalidate("stats");
      return idea;
    }
  },

  complaints: {
    async list(userId?: number): Promise<ComplaintListItem[]> {
      await ensureMongoConnected();
      const complaints = (await MongoComplaint.find(userId ? { userId } : {}, { _id: 0 }).sort({ createdAt: -1 }).lean().exec()) as ComplaintRecord[];
      const userIds = [...new Set(complaints.map((complaint) => complaint.userId))];
      const users = (await MongoUser.find({ id: mongoose.trusted({ $in: userIds }) }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>;
      const names = new Map(users.map((user) => [user.id, user.name]));
      return complaints.map((complaint) => ({ ...complaint, user: { name: names.get(complaint.userId) ?? "Unknown" } }));
    },
    async listPage(filter?: { userId?: number; page?: number; pageSize?: number }): Promise<Paginated<ComplaintListItem>> {
      await ensureMongoConnected();
      const where = filter?.userId ? { userId: filter.userId } : {};
      const { page, pageSize } = pageFilter(filter);
      const [complaints, total] = await Promise.all([
        MongoComplaint.find(where, { _id: 0 }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoComplaint.countDocuments(where).exec()
      ]);
      const userIds = [...new Set((complaints as ComplaintRecord[]).map((complaint) => complaint.userId))];
      const users = userIds.length
        ? ((await MongoUser.find({ id: { $in: userIds } }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>)
        : [];
      const names = new Map(users.map((user) => [user.id, user.name]));
      const items = (complaints as ComplaintRecord[]).map((complaint) => ({ ...complaint, user: { name: names.get(complaint.userId) ?? "Unknown" } }));
      return paginated(items, total, page, pageSize);
    },
    async create(data: ComplaintInput, userId: number): Promise<ComplaintRecord> {
      await ensureMongoConnected();
      const complaint = await MongoComplaint.create({ ...data, userId, id: await nextId("complaints") });
      cache.invalidate("stats");
      return complaint.toObject() as unknown as ComplaintRecord;
    },
    async updateStatus(id: number, status: string): Promise<ComplaintRecord> {
      await ensureMongoConnected();
      const complaint = (await MongoComplaint.findOneAndUpdate({ id }, { $set: { status } }, { new: true, projection: { _id: 0 } }).lean().exec()) as ComplaintRecord | null;
      if (!complaint) throw new ApiError(404, "Complaint not found", "COMPLAINT_NOT_FOUND");
      cache.invalidate("stats");
      return complaint;
    }
  },

  activities: {
    async create(action: string, userId?: number | null): Promise<ActivityRecord> {
      await ensureMongoConnected();
      const safeAction = action.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240);
      const activity = await MongoActivity.create({ id: await nextId("activities"), action: safeAction, userId });
      cache.invalidate("stats");
      return activity.toObject() as unknown as ActivityRecord;
    },
    async list(limit = 50): Promise<ActivityRecord[]> {
      await ensureMongoConnected();
      return (await MongoActivity.find({}, { _id: 0 }).sort({ timestamp: -1 }).limit(limit).lean().exec()) as ActivityRecord[];
    },
    async listPage(filter?: { page?: number; pageSize?: number }): Promise<Paginated<ActivityRecord>> {
      await ensureMongoConnected();
      const { page, pageSize } = pageFilter(filter);
      const [items, total] = await Promise.all([
        MongoActivity.find({}, { _id: 0 }).sort({ timestamp: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoActivity.countDocuments({}).exec()
      ]);
      return paginated(items as ActivityRecord[], total, page, pageSize);
    }
  },

  reports: {
    async create(data: ReportInput & { userId?: number | null; centerId?: number | null; date?: Date }): Promise<ReportRecord> {
      await ensureMongoConnected();
      const report = await MongoReport.create({ ...data, id: await nextId("reports") });
      return report.toObject() as unknown as ReportRecord;
    },
    async list(filter?: { centerId?: number }): Promise<ReportRecord[]> {
      await ensureMongoConnected();
      const where = filter?.centerId ? { centerId: filter.centerId } : {};
      return (await MongoReport.find(where, { _id: 0 }).sort({ date: -1 }).lean().exec()) as ReportRecord[];
    },
    async listPage(filter?: { centerId?: number; page?: number; pageSize?: number }): Promise<Paginated<ReportRecord>> {
      await ensureMongoConnected();
      const where = filter?.centerId ? { centerId: filter.centerId } : {};
      const { page, pageSize } = pageFilter(filter);
      const [items, total] = await Promise.all([
        MongoReport.find(where, { _id: 0 }).sort({ date: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoReport.countDocuments(where).exec()
      ]);
      return paginated(items as ReportRecord[], total, page, pageSize);
    }
  },

  monthlyReports: {
    async findByCenterMonth(centerId: number, month: string): Promise<MonthlyReportRecord | null> {
      await ensureMongoConnected();
      return (await MongoMonthlyReport.findOne({ centerId, month }, { _id: 0 }).lean().exec()) as MonthlyReportRecord | null;
    },
    async create(data: CreateMonthlyReportInput): Promise<MonthlyReportRecord> {
      await ensureMongoConnected();
      const report = await MongoMonthlyReport.create({ ...data, id: await nextId("monthly_reports") });
      cache.invalidate("monthly");
      return report.toObject() as unknown as MonthlyReportRecord;
    },
    async replace(id: number, data: CreateMonthlyReportInput): Promise<MonthlyReportRecord> {
      await ensureMongoConnected();
      const report = (await MongoMonthlyReport.findOneAndUpdate({ id }, { $set: data }, { new: true, projection: { _id: 0 } }).lean().exec()) as MonthlyReportRecord | null;
      if (!report) throw new ApiError(404, "Monthly report not found", "MONTHLY_REPORT_NOT_FOUND");
      cache.invalidate("monthly");
      return report;
    },
    async list(filter: { month: string; centerId?: number }): Promise<MonthlyReportRow[]> {
      await ensureMongoConnected();
      const where = filter.centerId ? { month: filter.month, centerId: filter.centerId } : { month: filter.month };
      const reports = (await MongoMonthlyReport.find(where, { _id: 0 }).sort({ centerId: 1 }).lean().exec()) as MonthlyReportRecord[];
      return enrichMonthlyReports(reports);
    },
    async listPage(filter: { month: string; centerId?: number; page?: number; pageSize?: number }): Promise<Paginated<MonthlyReportRow>> {
      await ensureMongoConnected();
      const where = filter.centerId ? { month: filter.month, centerId: filter.centerId } : { month: filter.month };
      const { page, pageSize } = pageFilter(filter);
      const [reports, total] = await Promise.all([
        MongoMonthlyReport.find(where, { _id: 0 }).sort({ centerId: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoMonthlyReport.countDocuments(where).exec()
      ]);
      return paginated(await enrichMonthlyReports(reports as MonthlyReportRecord[]), total, page, pageSize);
    },
    async summary(filter: { month: string; centerId?: number }) {
      await ensureMongoConnected();
      const where = filter.centerId ? { month: filter.month, centerId: filter.centerId } : { month: filter.month };
      return cache.getOrSet("monthly", cacheKey({ scope: "summary", month: filter.month, centerId: filter.centerId ?? "" }), async () => {
        const [summary] = await MongoMonthlyReport.aggregate<{
          _id: null;
          totalRevenues: number;
          totalExpenses: number;
          totalSeminars: number;
          uploadedCenters: number[];
        }>([
          { $match: where },
          {
            $group: {
              _id: null,
              totalRevenues: { $sum: "$revenues" },
              totalExpenses: { $sum: "$expenses" },
              totalSeminars: { $sum: "$seminarsCount" },
              uploadedCenters: { $addToSet: "$centerId" }
            }
          }
        ]).exec();
        return {
          totalRevenues: summary?.totalRevenues ?? 0,
          totalExpenses: summary?.totalExpenses ?? 0,
          totalSeminars: summary?.totalSeminars ?? 0,
          uploadedCenterIds: summary?.uploadedCenters ?? []
        };
      });
    },
    async missingCenters(filter: { month: string; centerId?: number; page?: number; pageSize?: number }): Promise<Paginated<Pick<CenterRecord, "id" | "name" | "location">>> {
      await ensureMongoConnected();
      const { page, pageSize } = pageFilter(filter);
      const uploaded = (await MongoMonthlyReport.distinct("centerId", filter.centerId ? { month: filter.month, centerId: filter.centerId } : { month: filter.month }).exec()) as number[];
      if (filter.centerId && uploaded.includes(filter.centerId)) return paginated([], 0, page, pageSize);
      const where = filter.centerId ? { id: filter.centerId } : { id: { $nin: uploaded } };
      const [items, total] = await Promise.all([
        MongoCenter.find(where, { _id: 0, id: 1, name: 1, location: 1 }).sort({ id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoCenter.countDocuments(where).exec()
      ]);
      return paginated(items as Array<Pick<CenterRecord, "id" | "name" | "location">>, total, page, pageSize);
    },
    async statistics(limit = 6) {
      await ensureMongoConnected();
      return cache.getOrSet("monthly", cacheKey({ scope: "statistics", limit }), async () => {
        const groups = await MongoMonthlyReport.aggregate<{ _id: string; totalRevenues: number; totalExpenses: number; totalSeminars: number; uploadedCenters: number }>([
          { $group: { _id: "$month", totalRevenues: { $sum: "$revenues" }, totalExpenses: { $sum: "$expenses" }, totalSeminars: { $sum: "$seminarsCount" }, uploadedCenters: { $sum: 1 } } },
          { $sort: { _id: -1 } },
          { $limit: limit }
        ]).exec();
        return groups.reverse().map((item) => ({ month: item._id, totalRevenues: item.totalRevenues, totalExpenses: item.totalExpenses, totalSeminars: item.totalSeminars, uploadedCenters: item.uploadedCenters }));
      });
    }
  },

  uploadedFiles: {
    async create(data: CreateUploadedFileInput): Promise<UploadedFileRecord> {
      await ensureMongoConnected();
      const file = await MongoUploadedFile.create({ ...data, id: await nextId("uploaded_files") });
      cache.invalidate("monthly");
      return file.toObject() as unknown as UploadedFileRecord;
    },
    async update(id: number, data: Partial<CreateUploadedFileInput>): Promise<UploadedFileRecord> {
      await ensureMongoConnected();
      const file = (await MongoUploadedFile.findOneAndUpdate({ id }, { $set: clean(data as Record<string, unknown>) }, { new: true, projection: { _id: 0 } }).lean().exec()) as UploadedFileRecord | null;
      if (!file) throw new ApiError(404, "Uploaded file not found", "UPLOADED_FILE_NOT_FOUND");
      cache.invalidate("monthly");
      return file;
    },
    async list(filter?: { month?: string; centerId?: number; limit?: number }): Promise<MonthlyUploadItem[]> {
      await ensureMongoConnected();
      const where = clean({ month: filter?.month, centerId: filter?.centerId });
      const files = (await MongoUploadedFile.find(where, { _id: 0 }).sort({ uploadedAt: -1 }).limit(filter?.limit ?? 50).lean().exec()) as UploadedFileRecord[];
      return enrichUploads(files);
    },
    async listPage(filter?: { month?: string; centerId?: number; page?: number; pageSize?: number }): Promise<Paginated<MonthlyUploadItem>> {
      await ensureMongoConnected();
      const where = clean({ month: filter?.month, centerId: filter?.centerId });
      const { page, pageSize } = pageFilter(filter);
      const [files, total] = await Promise.all([
        MongoUploadedFile.find(where, { _id: 0 }).sort({ uploadedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
        MongoUploadedFile.countDocuments(where).exec()
      ]);
      return paginated(await enrichUploads(files as UploadedFileRecord[]), total, page, pageSize);
    }
  },

  uploadHistory: {
    async create(data: CreateUploadHistoryInput): Promise<UploadHistoryRecord> {
      await ensureMongoConnected();
      const item = await MongoUploadHistory.create({ ...data, id: await nextId("upload_history") });
      return item.toObject() as unknown as UploadHistoryRecord;
    }
  },

  stats: {
    async admin() {
      await ensureMongoConnected();
      return cache.getOrSet("stats", "admin", async () => {
        const [totalUsers, activeCenters, challenges, pendingIdeas, newComplaints, participationGroups, activities] = await Promise.all([
          MongoUser.countDocuments(notDeleted()).exec(),
          MongoCenter.countDocuments({}).exec(),
          MongoChallenge.countDocuments({}).exec(),
          MongoIdea.countDocuments({ status: "PENDING" }).exec(),
          MongoComplaint.countDocuments({ status: "PENDING" }).exec(),
          MongoChallengeParticipation.aggregate<{ _id: null; count: number }>([{ $group: { _id: null, count: { $sum: 1 } } }]).exec(),
          db.activities.list(8)
        ]);
        return {
          totalUsers,
          activeCenters,
          challenges,
          pendingIdeas,
          newComplaints,
          participations: participationGroups[0]?.count ?? 0,
          recentActivities: activities
        };
      });
    },
    async me(userId: number) {
      const [user, ideas, joinedChallenges, complaints, voteGroups, suggestedChallenges, recentIdeas] = await Promise.all([
        db.users.findById(userId),
        MongoIdea.countDocuments({ userId }).exec(),
        MongoChallengeParticipation.countDocuments({ userId }).exec(),
        MongoComplaint.countDocuments({ userId }).exec(),
        MongoIdea.aggregate<{ _id: null; votes: number }>([{ $match: { userId } }, { $group: { _id: null, votes: { $sum: "$votes" } } }]).exec(),
        db.challenges.listPage({ userId, page: 1, pageSize: 10 }),
        db.ideas.listPage({ userId, page: 1, pageSize: 3 })
      ]);
      return {
        user,
        ideas,
        joinedChallenges,
        complaints,
        totalVotes: voteGroups[0]?.votes ?? 0,
        suggestedChallenges: suggestedChallenges.items.filter((challenge: ChallengeListItem) => !challenge.joined).slice(0, 3),
        recentIdeas: recentIdeas.items
      };
    }
  }
};

async function enrichMonthlyReports(reports: MonthlyReportRecord[]): Promise<MonthlyReportRow[]> {
  const centerIds = [...new Set(reports.map((report) => report.centerId))];
  const fileIds = [...new Set(reports.map((report) => report.uploadedFileId).filter((id): id is number => typeof id === "number"))];
  const [centers, files] = await Promise.all([
    centerIds.length ? MongoCenter.find({ id: { $in: centerIds } }, { _id: 0, id: 1, name: 1 }).lean().exec() : [],
    fileIds.length ? MongoUploadedFile.find({ id: { $in: fileIds } }, { _id: 0, id: 1, originalName: 1 }).lean().exec() : []
  ]);
  const centerNames = new Map((centers as Array<Pick<CenterRecord, "id" | "name">>).map((center) => [center.id, center.name]));
  const fileNames = new Map((files as Array<Pick<UploadedFileRecord, "id" | "originalName">>).map((file) => [file.id, file.originalName]));
  return reports.map((report) => ({
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
}

async function enrichUploads(files: UploadedFileRecord[]): Promise<MonthlyUploadItem[]> {
  const centerIds = [...new Set(files.map((file) => file.centerId).filter((id): id is number => typeof id === "number"))];
  const centers = centerIds.length
    ? ((await MongoCenter.find({ id: { $in: centerIds } }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<CenterRecord, "id" | "name">>)
    : [];
  const centerNames = new Map(centers.map((center) => [center.id, center.name]));
  return files.map((file) => ({ ...file, centerName: file.centerId ? centerNames.get(file.centerId) ?? null : null }));
}
