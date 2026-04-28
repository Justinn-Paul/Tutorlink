import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse, TutorLinkUser } from "../shared/types";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** POST /users/{userId}/switch-role */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) {
    return optionsResponse();
  }

  try {
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return jsonResponse(400, {
        success: false,
        error: "Missing userId path parameter",
      } satisfies ApiResponse<never>);
    }

    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, {
        success: false,
        error: "Invalid request body",
      } satisfies ApiResponse<never>);
    }

    const role = (body as Record<string, unknown>).role;
    if (role !== "teacher") {
      return jsonResponse(400, {
        success: false,
        error: "Only role 'teacher' is supported",
      } satisfies ApiResponse<never>);
    }

    const tableName = requireEnv("DYNAMODB_USERS_TABLE");

    const currentUserOut = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId },
      })
    );

    if (!currentUserOut.Item) {
      return jsonResponse(404, {
        success: false,
        error: "User not found",
      } satisfies ApiResponse<never>);
    }

    const currentUser = currentUserOut.Item as TutorLinkUser & {
      roles?: string[];
    };

    if (Array.isArray(currentUser.roles) && currentUser.roles.includes("teacher")) {
      return jsonResponse(200, {
        success: true,
        data: {
          message: "Already a teacher",
        },
      } satisfies ApiResponse<{ message: string }>);
    }

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { userId },
        UpdateExpression: "SET roles = list_append(if_not_exists(roles, :emptyList), :newRole), #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":newRole": ["teacher"],
          ":emptyList": [],
          ":updatedAt": new Date().toISOString(),
        },
      })
    );

    return jsonResponse(200, {
      success: true,
      data: {
        message: "Role updated to teacher",
        userId,
      },
    } satisfies ApiResponse<{ message: string; userId: string }>);
  } catch (error) {
    console.error("switch-role error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
