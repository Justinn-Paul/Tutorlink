import type { TeacherProfile } from "../lambdas/shared/types";

export type SeedUser = {
  userId: string;
  email: string;
  role: "student" | "teacher";
  roles?: string[];
  name: string;
  phone?: string;
  location?: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type SeedDeckEntry = {
  studentId: string;
  teacherId: string;
  status: "interested" | "contacted" | "booked";
  createdAt: string;
};

const now = new Date().toISOString();

/** Dummy teachers — userId matches teacherId for simplicity. */
export const SEED_USERS: SeedUser[] = [
  {
    userId: "seed-t-001",
    email: "sarah.tan@seed.tutorlink.test",
    role: "teacher",
    roles: ["teacher"],
    name: "Sarah Tan",
    phone: "+6591234001",
    location: "Tampines",
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: "seed-t-002",
    email: "marcus.lim@seed.tutorlink.test",
    role: "teacher",
    roles: ["teacher"],
    name: "Marcus Lim",
    phone: "+6591234002",
    location: "Bishan",
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: "seed-t-003",
    email: "priya.nair@seed.tutorlink.test",
    role: "teacher",
    roles: ["teacher"],
    name: "Priya Nair",
    phone: "+6591234003",
    location: "Clementi",
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: "seed-t-004",
    email: "wei.chen@seed.tutorlink.test",
    role: "teacher",
    roles: ["teacher"],
    name: "Wei Chen",
    phone: "+6591234004",
    location: "Jurong West",
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: "seed-t-005",
    email: "amira.rahman@seed.tutorlink.test",
    role: "teacher",
    roles: ["teacher"],
    name: "Amira Rahman",
    phone: "+6591234005",
    location: "Ang Mo Kio",
    createdAt: now,
    updatedAt: now,
  },
  {
    userId: "seed-student-001",
    email: "student.demo@seed.tutorlink.test",
    role: "student",
    roles: ["student"],
    name: "Demo Student",
    location: "Bedok",
    createdAt: now,
    updatedAt: now,
  },
];

export const SEED_TEACHERS: TeacherProfile[] = [
  {
    teacherId: "seed-t-001",
    subject: "Primary Maths",
    subjects: ["Primary Maths", "Primary Science"],
    pricing: [
      { subject: "Primary Maths", level: "P4-P6", hourlyRate: 45, trialRate: 25 },
      { subject: "Primary Science", level: "P4-P6", hourlyRate: 45, trialRate: 25 },
    ],
    qualifications: [
      { degree: "BSc Mathematics", institution: "NIE/NTU", year: 2019 },
    ],
    verificationStatus: "verified",
    location: "Tampines",
    bio: "MOE-trained primary tutor with 5 years experience. Patient, structured lessons focused on problem-solving and exam techniques.",
    ratingAvg: 4.8,
    reviewCount: 24,
    minRate: 45,
    organizationId: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    teacherId: "seed-t-002",
    subject: "Secondary English",
    subjects: ["Secondary English", "General Paper"],
    pricing: [
      { subject: "Secondary English", level: "Sec 1-4", hourlyRate: 60, trialRate: 35 },
      { subject: "General Paper", level: "JC", hourlyRate: 75, trialRate: 40 },
    ],
    qualifications: [
      { degree: "BA English Literature", institution: "NUS", year: 2017 },
    ],
    verificationStatus: "verified",
    location: "Bishan",
    bio: "Former school teacher specialising in composition and comprehension. I help students build confidence in writing and critical reading.",
    ratingAvg: 4.6,
    reviewCount: 18,
    minRate: 60,
    organizationId: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    teacherId: "seed-t-003",
    subject: "JC Chemistry",
    subjects: ["JC Chemistry", "JC Biology"],
    pricing: [
      { subject: "JC Chemistry", level: "H2", hourlyRate: 85, trialRate: 45 },
      { subject: "JC Biology", level: "H2", hourlyRate: 80, trialRate: 45 },
    ],
    qualifications: [
      { degree: "MSc Chemistry", institution: "NUS", year: 2020 },
    ],
    verificationStatus: "verified",
    location: "Clementi",
    bio: "JC science specialist — clear explanations, past-year focus, and customised revision plans before A-Levels.",
    ratingAvg: 4.9,
    reviewCount: 31,
    minRate: 80,
    organizationId: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    teacherId: "seed-t-004",
    subject: "Primary Science",
    subjects: ["Primary Science", "Primary Maths"],
    pricing: [
      { subject: "Primary Science", level: "P3-P6", hourlyRate: 40, trialRate: 22 },
      { subject: "Primary Maths", level: "P3-P6", hourlyRate: 40, trialRate: 22 },
    ],
    qualifications: [
      { degree: "BSc Life Sciences", institution: "NTU", year: 2021 },
    ],
    verificationStatus: "verified",
    location: "Jurong West",
    bio: "Hands-on science tutor using experiments and real-world examples. Great for students who find textbooks dry.",
    ratingAvg: 4.5,
    reviewCount: 12,
    minRate: 40,
    organizationId: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    teacherId: "seed-t-005",
    subject: "Secondary Maths",
    subjects: ["Secondary Maths", "Primary Maths"],
    pricing: [
      { subject: "Secondary Maths", level: "Sec 1-4", hourlyRate: 55, trialRate: 30 },
      { subject: "Primary Maths", level: "P5-P6", hourlyRate: 48, trialRate: 28 },
    ],
    qualifications: [
      { degree: "BEng", institution: "SMU", year: 2018 },
    ],
    verificationStatus: "verified",
    location: "Ang Mo Kio",
    bio: "Maths tutor with a practical approach — algebra, geometry, and exam drills. Flexible weekday evenings and weekends.",
    ratingAvg: 4.7,
    reviewCount: 20,
    minRate: 48,
    organizationId: null,
    createdAt: now,
    updatedAt: now,
  },
];

/** Optional deck rows — only written when DYNAMODB_DECKS_TABLE is set. */
export const SEED_DECKS: SeedDeckEntry[] = [
  {
    studentId: "seed-student-001",
    teacherId: "seed-t-001",
    status: "interested",
    createdAt: now,
  },
];
