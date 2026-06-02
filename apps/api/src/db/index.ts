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
import { ApiError } from "../errors/api-error";

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
      const user = (await MongoUser.findOneAndUpdate({ id }, { $set: data }, { new: true, projection: { _id: 0, passwordHash: 0 } }).lean().exec()) as PublicUser | null;
      if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
      return user;
    },
    async delete(id: number): Promise<void> {
      await ensureMongoConnected();
      await Promise.all([
        MongoUser.deleteOne({ id }).exec(),
        MongoIdea.deleteMany({ userId: id }).exec(),
        MongoComplaint.deleteMany({ userId: id }).exec(),
        MongoChallengeParticipation.deleteMany({ userId: id }).exec()
      ]);
    },
    async list(filter?: { centerId?: number }): Promise<PublicUser[]> {
      await ensureMongoConnected();
      const where = filter?.centerId ? { centerId: filter.centerId } : {};
      return (await MongoUser.find(where, { _id: 0, passwordHash: 0 }).sort({ createdAt: -1 }).lean().exec()) as PublicUser[];
    },
    async recordLogin(id: number): Promise<void> {
      await ensureMongoConnected();
      await MongoUser.updateOne({ id }, { $set: { lastLogin: new Date(), status: "ACTIVE" } }).exec();
    }
  },

  centers: {
    async list(): Promise<CenterRecord[]> {
      await ensureMongoConnected();
      return (await MongoCenter.find({}, { _id: 0 }).sort({ id: 1 }).lean().exec()) as CenterRecord[];
    },
    async get(id: number): Promise<CenterRecord | null> {
      await ensureMongoConnected();
      return (await MongoCenter.findOne({ id }, { _id: 0 }).lean().exec()) as CenterRecord | null;
    },
    async create(data: CenterInput): Promise<CenterRecord> {
      await ensureMongoConnected();
      const center = await MongoCenter.create({ ...data, id: await nextId("centers") });
      return center.toObject() as unknown as CenterRecord;
    },
    async update(id: number, data: CenterUpdateInput): Promise<CenterRecord> {
      await ensureMongoConnected();
      const center = (await MongoCenter.findOneAndUpdate({ id }, { $set: clean(data) }, { new: true, projection: { _id: 0 } }).lean().exec()) as CenterRecord | null;
      if (!center) throw new ApiError(404, "Center not found", "CENTER_NOT_FOUND");
      return center;
    },
    async delete(id: number): Promise<void> {
      await ensureMongoConnected();
      await MongoCenter.deleteOne({ id }).exec();
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
    async get(id: number, userId?: number): Promise<ChallengeListItem | null> {
      return (await this.list(userId)).find((challenge) => challenge.id === id) ?? null;
    },
    async create(data: ChallengeInput): Promise<ChallengeRecord> {
      await ensureMongoConnected();
      const payload = { ...data, deadline: parseDeadline(data.deadline), status: data.status ?? "ACTIVE", participants: data.participants ?? 0 };
      const challenge = await MongoChallenge.create({ ...payload, id: await nextId("challenges") });
      return challenge.toObject() as unknown as ChallengeRecord;
    },
    async update(id: number, data: ChallengeUpdateInput): Promise<ChallengeRecord> {
      await ensureMongoConnected();
      const payload = clean({ ...data, deadline: data.deadline ? parseDeadline(data.deadline) : undefined });
      const challenge = (await MongoChallenge.findOneAndUpdate({ id }, { $set: payload }, { new: true, projection: { _id: 0 } }).lean().exec()) as ChallengeRecord | null;
      if (!challenge) throw new ApiError(404, "Challenge not found", "CHALLENGE_NOT_FOUND");
      return challenge;
    },
    async delete(id: number): Promise<void> {
      await ensureMongoConnected();
      await Promise.all([MongoChallenge.deleteOne({ id }).exec(), MongoChallengeParticipation.deleteMany({ challengeId: id }).exec()]);
    },
    async join(challengeId: number, userId: number): Promise<ChallengeParticipationRecord> {
      await ensureMongoConnected();
      const challenge = await db.challenges.get(challengeId);
      if (!challenge) throw new ApiError(404, "Challenge not found", "CHALLENGE_NOT_FOUND");
      if (challenge.maxParticipants && challenge._count.participations >= challenge.maxParticipants) throw new ApiError(409, "Challenge is full", "CHALLENGE_FULL");
      try {
        const participation = await MongoChallengeParticipation.create({ id: await nextId("challenge_participations"), challengeId, userId });
        await MongoChallenge.updateOne({ id: challengeId }, { $inc: { participants: 1 } }).exec();
        return participation.toObject() as unknown as ChallengeParticipationRecord;
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) throw new ApiError(409, "You already joined this challenge", "CHALLENGE_ALREADY_JOINED");
        throw error;
      }
    }
  },

  ideas: {
    async list(): Promise<IdeaListItem[]> {
      await ensureMongoConnected();
      const ideas = (await MongoIdea.find({}, { _id: 0 }).sort({ createdAt: -1 }).lean().exec()) as IdeaRecord[];
      const users = (await MongoUser.find({ id: { $in: [...new Set(ideas.map((idea) => idea.userId))] } }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>;
      const names = new Map(users.map((user) => [user.id, user.name]));
      return ideas.map((idea) => ({ ...idea, user: { name: names.get(idea.userId) ?? "Unknown" } }));
    },
    async create(data: IdeaInput, userId: number): Promise<IdeaRecord> {
      await ensureMongoConnected();
      const idea = await MongoIdea.create({ ...data, userId, id: await nextId("ideas") });
      return idea.toObject() as unknown as IdeaRecord;
    },
    async vote(id: number): Promise<IdeaRecord> {
      await ensureMongoConnected();
      const idea = (await MongoIdea.findOneAndUpdate({ id }, { $inc: { votes: 1 } }, { new: true, projection: { _id: 0 } }).lean().exec()) as IdeaRecord | null;
      if (!idea) throw new ApiError(404, "Idea not found", "IDEA_NOT_FOUND");
      return idea;
    },
    async updateStatus(id: number, status: string): Promise<IdeaRecord> {
      await ensureMongoConnected();
      const idea = (await MongoIdea.findOneAndUpdate({ id }, { $set: { status } }, { new: true, projection: { _id: 0 } }).lean().exec()) as IdeaRecord | null;
      if (!idea) throw new ApiError(404, "Idea not found", "IDEA_NOT_FOUND");
      return idea;
    }
  },

  complaints: {
    async list(userId?: number): Promise<ComplaintListItem[]> {
      await ensureMongoConnected();
      const complaints = (await MongoComplaint.find(userId ? { userId } : {}, { _id: 0 }).sort({ createdAt: -1 }).lean().exec()) as ComplaintRecord[];
      const users = (await MongoUser.find({ id: { $in: [...new Set(complaints.map((complaint) => complaint.userId))] } }, { _id: 0, id: 1, name: 1 }).lean().exec()) as Array<Pick<UserRecord, "id" | "name">>;
      const names = new Map(users.map((user) => [user.id, user.name]));
      return complaints.map((complaint) => ({ ...complaint, user: { name: names.get(complaint.userId) ?? "Unknown" } }));
    },
    async create(data: ComplaintInput, userId: number): Promise<ComplaintRecord> {
      await ensureMongoConnected();
      const complaint = await MongoComplaint.create({ ...data, userId, id: await nextId("complaints") });
      return complaint.toObject() as unknown as ComplaintRecord;
    },
    async updateStatus(id: number, status: string): Promise<ComplaintRecord> {
      await ensureMongoConnected();
      const complaint = (await MongoComplaint.findOneAndUpdate({ id }, { $set: { status } }, { new: true, projection: { _id: 0 } }).lean().exec()) as ComplaintRecord | null;
      if (!complaint) throw new ApiError(404, "Complaint not found", "COMPLAINT_NOT_FOUND");
      return complaint;
    }
  },

  activities: {
    async create(action: string, userId?: number | null): Promise<ActivityRecord> {
      await ensureMongoConnected();
      const safeAction = action.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240);
      const activity = await MongoActivity.create({ id: await nextId("activities"), action: safeAction, userId });
      return activity.toObject() as unknown as ActivityRecord;
    },
    async list(limit = 50): Promise<ActivityRecord[]> {
      await ensureMongoConnected();
      return (await MongoActivity.find({}, { _id: 0 }).sort({ timestamp: -1 }).limit(limit).lean().exec()) as ActivityRecord[];
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
      return report.toObject() as unknown as MonthlyReportRecord;
    },
    async replace(id: number, data: CreateMonthlyReportInput): Promise<MonthlyReportRecord> {
      await ensureMongoConnected();
      const report = (await MongoMonthlyReport.findOneAndUpdate({ id }, { $set: data }, { new: true, projection: { _id: 0 } }).lean().exec()) as MonthlyReportRecord | null;
      if (!report) throw new ApiError(404, "Monthly report not found", "MONTHLY_REPORT_NOT_FOUND");
      return report;
    },
    async list(filter: { month: string; centerId?: number }): Promise<MonthlyReportRow[]> {
      await ensureMongoConnected();
      const where = filter.centerId ? { month: filter.month, centerId: filter.centerId } : { month: filter.month };
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
      await ensureMongoConnected();
      const groups = await MongoMonthlyReport.aggregate<{ _id: string; totalRevenues: number; totalExpenses: number; totalSeminars: number; uploadedCenters: number }>([
        { $group: { _id: "$month", totalRevenues: { $sum: "$revenues" }, totalExpenses: { $sum: "$expenses" }, totalSeminars: { $sum: "$seminarsCount" }, uploadedCenters: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: limit }
      ]).exec();
      return groups.reverse().map((item) => ({ month: item._id, totalRevenues: item.totalRevenues, totalExpenses: item.totalExpenses, totalSeminars: item.totalSeminars, uploadedCenters: item.uploadedCenters }));
    }
  },

  uploadedFiles: {
    async create(data: CreateUploadedFileInput): Promise<UploadedFileRecord> {
      await ensureMongoConnected();
      const file = await MongoUploadedFile.create({ ...data, id: await nextId("uploaded_files") });
      return file.toObject() as unknown as UploadedFileRecord;
    },
    async update(id: number, data: Partial<CreateUploadedFileInput>): Promise<UploadedFileRecord> {
      await ensureMongoConnected();
      const file = (await MongoUploadedFile.findOneAndUpdate({ id }, { $set: clean(data as Record<string, unknown>) }, { new: true, projection: { _id: 0 } }).lean().exec()) as UploadedFileRecord | null;
      if (!file) throw new ApiError(404, "Uploaded file not found", "UPLOADED_FILE_NOT_FOUND");
      return file;
    },
    async list(filter?: { month?: string; centerId?: number; limit?: number }): Promise<MonthlyUploadItem[]> {
      await ensureMongoConnected();
      const where = clean({ month: filter?.month, centerId: filter?.centerId });
      const [files, centers] = await Promise.all([
        MongoUploadedFile.find(where, { _id: 0 }).sort({ uploadedAt: -1 }).limit(filter?.limit ?? 50).lean().exec(),
        MongoCenter.find({}, { _id: 0, id: 1, name: 1 }).lean().exec()
      ]);
      const centerNames = new Map((centers as Array<Pick<CenterRecord, "id" | "name">>).map((center) => [center.id, center.name]));
      return (files as UploadedFileRecord[]).map((file) => ({ ...file, centerName: file.centerId ? centerNames.get(file.centerId) ?? null : null }));
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
