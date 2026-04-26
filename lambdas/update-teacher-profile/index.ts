import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse, PricingEntry } from "../shared/types";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ALLOWED_FIELDS = ["bio", "location", "pricing", "qualifications"] as const;

type Qualifications = Array<{ degree: string; institution: string; year: number }>;

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

/** PUT /teachers/{teacherId} */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) return optionsResponse();

  try {
    const teacherId = event.pathParameters?.teacherId;
    if (!teacherId) {
      return jsonResponse(400, {
        success: false,
        error: "Missing teacherId path parameter",
      } satisfies ApiResponse<never>);
    }

    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, {
        success: false,
        error: "Invalid request body",
      } satisfies ApiResponse<never>);
    }

    const payload = body as Record<string, unknown>;

    if (payload.pricing !== undefined) {
      if (!Array.isArray(payload.pricing) || payload.pricing.length === 0) {
        return jsonResponse(400, {
          success: false,
          error: "pricing must be a non-empty array",
        } satisfies ApiResponse<never>);
      }
      if (!payload.pricing.every(isValidPricingEntry)) {
        return jsonResponse(400, {
          success: false,
          error: "pricing contains invalid entries",
        } satisfies ApiResponse<never>);
      }
    }

    const expressionNames: Record<string, string> = {
      "#updatedAt": "updatedAt",
    };
    const expressionValues: Record<string, unknown> = {
      ":updatedAt": new Date().toISOString(),
    };
    const setClauses: string[] = ["#updatedAt = :updatedAt"];

    let idx = 0;
    for (const field of ALLOWED_FIELDS) {
      if (payload[field] !== undefined) {
        idx += 1;
        const nameKey = `#f${idx}`;
        const valueKey = `:v${idx}`;
        expressionNames[nameKey] = field;
        expressionValues[valueKey] = payload[field];
        setClauses.push(`${nameKey} = ${valueKey}`);
      }
    }

    if (Array.isArray(payload.pricing) && payload.pricing.length > 0) {
      const pricing = payload.pricing as PricingEntry[];
      const subjects = [...new Set(pricing.map((p) => p.subject))];
      const subject = pricing[0]!.subject;
      const minRate = Math.min(...pricing.map((p) => p.hourlyRate));

      expressionNames["#subjects"] = "subjects";
      expressionNames["#subject"] = "subject";
      expressionNames["#minRate"] = "minRate";
      expressionValues[":subjects"] = subjects;
      expressionValues[":subject"] = subject;
      expressionValues[":minRate"] = minRate;
      setClauses.push("#subjects = :subjects");
      setClauses.push("#subject = :subject");
      setClauses.push("#minRate = :minRate");
    }

    if (setClauses.length === 1) {
      return jsonResponse(400, {
        success: false,
        error: "No updatable fields provided",
      } satisfies ApiResponse<never>);
    }

    const teacherProfilesTable = requireEnv("DYNAMODB_TEACHER_PROFILES_TABLE");

    await ddb.send(
      new UpdateCommand({
        TableName: teacherProfilesTable,
        Key: { teacherId },
        UpdateExpression: `SET ${setClauses.join(", ")}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ConditionExpression: "attribute_exists(teacherId)",
      })
    );

    return jsonResponse(200, {
      success: true,
      data: {
        message: "Profile updated",
        teacherId,
      },
    } satisfies ApiResponse<{ message: string; teacherId: string }>);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, {
        success: false,
        error: "Teacher profile not found",
      } satisfies ApiResponse<never>);
    }

    console.error("update-teacher-profile error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
