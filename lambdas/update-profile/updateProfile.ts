import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse } from "../shared/types";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ALLOWED_FIELDS = [
  "name",
  "phone",
  "location",
  "preferences",
  "photoUrl",
] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** PUT /users/{userId} */
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
        error: "Invalid or empty request body",
      } satisfies ApiResponse<never>);
    }

    const payload = body as Record<string, unknown>;

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

    if (setClauses.length === 1) {
      return jsonResponse(400, {
        success: false,
        error: "No updatable profile fields provided",
      } satisfies ApiResponse<never>);
    }

    const tableName = requireEnv("DYNAMODB_USERS_TABLE");

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { userId },
        UpdateExpression: `SET ${setClauses.join(", ")}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ConditionExpression: "attribute_exists(userId)",
      })
    );

    return jsonResponse(200, {
      success: true,
      data: {
        message: "Profile updated",
        userId,
      },
    } satisfies ApiResponse<{ message: string; userId: string }>);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, {
        success: false,
        error: "User not found",
      } satisfies ApiResponse<never>);
    }

    console.error("update-profile error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
