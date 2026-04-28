import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse, PricingEntry, TeacherProfile } from "../shared/types";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type Qualification = {
  degree: string;
  institution: string;
  year: number;
};

type CreateTeacherProfileRequest = {
  teacherId: string;
  location: string;
  bio: string;
  pricing: PricingEntry[];
  qualifications?: Qualification[];
  verificationDocUrl?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isValidPricingEntry(entry: unknown): entry is PricingEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.subject === "string" &&
    e.subject.trim().length > 0 &&
    typeof e.level === "string" &&
    e.level.trim().length > 0 &&
    typeof e.hourlyRate === "number" &&
    Number.isFinite(e.hourlyRate) &&
    typeof e.trialRate === "number" &&
    Number.isFinite(e.trialRate)
  );
}

function normalizeQualifications(input: unknown): Qualification[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((q) => q && typeof q === "object")
    .map((q) => q as Record<string, unknown>)
    .filter(
      (q) =>
        typeof q.degree === "string" &&
        typeof q.institution === "string" &&
        typeof q.year === "number"
    )
    .map((q) => ({
      degree: q.degree as string,
      institution: q.institution as string,
      year: q.year as number,
    }));
}

function userHasTeacherRole(user: Record<string, unknown>): boolean {
  const roles = user.roles;
  if (Array.isArray(roles)) {
    return roles.some((r) => typeof r === "string" && r.toLowerCase() === "teacher");
  }
  return typeof user.role === "string" && user.role.toLowerCase() === "teacher";
}

/** POST /teachers */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) return optionsResponse();

  try {
    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, {
        success: false,
        error: "Invalid request body",
      } satisfies ApiResponse<never>);
    }

    const payload = body as Partial<CreateTeacherProfileRequest>;
    if (!payload.teacherId || !payload.location || !Array.isArray(payload.pricing)) {
      return jsonResponse(400, {
        success: false,
        error: "teacherId, location, and pricing are required",
      } satisfies ApiResponse<never>);
    }

    if (payload.pricing.length === 0 || !payload.pricing.every(isValidPricingEntry)) {
      return jsonResponse(400, {
        success: false,
        error: "pricing must contain valid entries with subject, level, hourlyRate, and trialRate",
      } satisfies ApiResponse<never>);
    }

    const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
    const teacherProfilesTable = requireEnv("DYNAMODB_TEACHER_PROFILES_TABLE");

    const userOut = await ddb.send(
      new GetCommand({
        TableName: usersTable,
        Key: { userId: payload.teacherId },
      })
    );

    if (!userOut.Item) {
      return jsonResponse(404, {
        success: false,
        error: "User not found",
      } satisfies ApiResponse<never>);
    }

    if (!userHasTeacherRole(userOut.Item as Record<string, unknown>)) {
      return jsonResponse(403, {
        success: false,
        error: "User does not have teacher role",
      } satisfies ApiResponse<never>);
    }

    const existingProfileOut = await ddb.send(
      new GetCommand({
        TableName: teacherProfilesTable,
        Key: { teacherId: payload.teacherId },
      })
    );

    if (existingProfileOut.Item) {
      return jsonResponse(409, {
        success: false,
        error: "Teacher profile already exists",
      } satisfies ApiResponse<never>);
    }

    const subjects = [...new Set(payload.pricing.map((p) => p.subject))];
    const subject = payload.pricing[0]!.subject;
    const minRate = Math.min(...payload.pricing.map((p) => p.hourlyRate));
    const now = new Date().toISOString();

    const teacherProfile: TeacherProfile = {
      teacherId: payload.teacherId,
      subject,
      subjects,
      pricing: payload.pricing,
      qualifications: normalizeQualifications(payload.qualifications),
      verificationStatus: "pending",
      verificationDocUrl:
        typeof payload.verificationDocUrl === "string"
          ? payload.verificationDocUrl
          : undefined,
      location: payload.location,
      bio: payload.bio ?? "",
      ratingAvg: 0,
      reviewCount: 0,
      minRate,
      organizationId: null,
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: teacherProfilesTable,
        Item: teacherProfile,
      })
    );

    return jsonResponse(201, {
      success: true,
      data: teacherProfile,
    } satisfies ApiResponse<TeacherProfile>);
  } catch (error) {
    console.error("create-teacher-profile error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
