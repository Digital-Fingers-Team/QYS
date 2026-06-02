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

export type Center = { id: number; name: string; location: string; rating?: number; type: string; image?: string; description: string };
export type Challenge = { id: number; title: string; description: string; reward: number; status: string; category: string; participants: number; deadline: string; joined?: boolean; _count?: { participations: number } };
export type Idea = { id: number; userId: number; title: string; description: string; status: string; votes: number; createdAt: string; user?: { name: string } };
export type Complaint = { id: number; userId: number; title: string; description: string; type: string; status: string; createdAt: string; user?: { name: string } };
export type Activity = { id: number; action: string; userName?: string; timestamp: string };
export type Report = { id: number; title: string; type: string; content: string; status: string; date: string; userId?: number | null; centerId?: number | null };
export type MonthlyReportUploadResponse = { replaced: boolean; message: string; report: MonthlyReportRow };
