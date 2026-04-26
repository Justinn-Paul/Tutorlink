import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse } from "../shared/http";
import type { ApiResponse, TeacherProfile } from "../shared/types";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** GET /teachers/{teacherId} (public) */
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

    const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
    const teacherProfilesTable = requireEnv("DYNAMODB_TEACHER_PROFILES_TABLE");

    const teacherOut = await ddb.send(
      new GetCommand({
        TableName: teacherProfilesTable,
        Key: { teacherId },
      })
    );

    if (!teacherOut.Item) {
      return jsonResponse(404, {
        success: false,
        error: "Teacher profile not found",
      } satisfies ApiResponse<never>);
    }

    const userOut = await ddb.send(
      new GetCommand({
        TableName: usersTable,
        Key: { userId: teacherId },
      })
    );

    const user = (userOut.Item ?? {}) as Record<string, unknown>;
    const merged = {
      ...(teacherOut.Item as TeacherProfile),
      name: typeof user.name === "string" ? user.name : undefined,
      photoUrl: typeof user.photoUrl === "string" ? user.photoUrl : undefined,
    };

    return jsonResponse(200, {
      success: true,
      data: merged,
    } satisfies ApiResponse<typeof merged>);
  } catch (error) {
    console.error("get-teacher-profile error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
