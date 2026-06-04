import type { MonthlyReportRow } from '@qys/shared';

export type Role = 'DIRECTORATE_MANAGER' | 'CENTER_MANAGER' | 'USER';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  centerId?: number | null;
  createdBy?: number | null;
  isActive: boolean;
  lastLogin?: string | null;
  points: number;
  status: string;
  avatar?: string | null;
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
};

export type Center = { id: number; name: string; location: string; rating?: number; type: string; image?: string; description: string; createdAt?: string };
export type CenterMetrics = { centerId: number; usersCount: number; eventsCount: number };
export type CenterCredentials = { email: string; password: string };
export type Challenge = { id: number; title: string; description: string; image?: string | null; reward: number; status: string; category: string; location?: string | null; targetAreas?: string[]; participants: number; deadline: string; joined?: boolean; _count?: { participations: number } };
export type Idea = { id: number; userId: number; centerId?: number | null; visibleToUsers?: boolean; voted?: boolean; title: string; description: string; status: string; votes: number; createdAt: string; user?: { name: string } };
export type Complaint = { id: number; userId: number; centerId?: number | null; centerReviewStatus?: string | null; showProgress?: boolean; resolvedAt?: string | null; rejectedAt?: string | null; title: string; description: string; type: string; status: string; createdAt: string; user?: { name: string }; center?: { name: string; location: string } | null };
export type Activity = { id: number; action: string; userName?: string; timestamp: string };
export type Report = { id: number; title: string; type: string; content: string; status: string; date: string; userId?: number | null; centerId?: number | null };
export type MonthlyReportUploadResponse = { replaced: boolean; message: string; report: MonthlyReportRow };
export type ChatMessage = {
  id: number;
  target: 'ALL' | 'CENTER';
  centerId?: number | null;
  senderId: number;
  senderRole: Role;
  body: string;
  createdAt: string;
  sender?: { name: string };
  center?: { name: string; location: string } | null;
};
