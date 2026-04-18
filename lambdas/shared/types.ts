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
