export interface TutorLinkUser {
  userId: string;
  email: string;
  role: "student" | "teacher";
  createdAt: string;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PricingEntry {
  subject: string;
  level: string;
  hourlyRate: number;
  trialRate: number;
}

export interface TeacherProfile {
  teacherId: string;
  subject: string;
  subjects: string[];
  pricing: PricingEntry[];
  qualifications: Array<{
    degree: string;
    institution: string;
    year: number;
  }>;
  verificationStatus: "pending" | "verified" | "rejected";
  verificationDocUrl?: string;
  location: string;
  bio: string;
  ratingAvg: number;
  reviewCount: number;
  minRate: number;
  stripeConnectId?: string;
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
}
