import type { TeacherProfile } from "./teacher";

export type DeckStatus = "interested" | "contacted" | "active" | "past";

export type DeckItem = {
  studentId: string;
  teacherId: string;
  status: DeckStatus;
  addedAt: string;
  sortOrder: number;
  userNotes: string;
  updatedAt: string;
  name?: string;
  photoUrl?: string;
} & Partial<TeacherProfile>;

export type DeckResponse = {
  deck: DeckItem[];
  count: number;
};
