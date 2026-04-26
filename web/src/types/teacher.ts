export type PricingEntry = {
  subject: string;
  level: string;
  hourlyRate: number;
  trialRate: number;
};

export type Qualification = {
  degree: string;
  institution: string;
  year: number;
};

export type TeacherProfile = {
  teacherId: string;
  subject: string;
  subjects: string[];
  pricing: PricingEntry[];
  qualifications: Qualification[];
  verificationStatus: "pending" | "verified" | "rejected";
  verificationDocUrl?: string;
  location: string;
  bio: string;
  ratingAvg?: number;
  reviewCount?: number;
  rating_avg?: number;
  review_count?: number;
  minRate: number;
  stripeConnectId?: string;
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
};
