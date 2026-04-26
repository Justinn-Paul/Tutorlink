import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse } from "../shared/http";
import type { ApiResponse, TutorLinkUser } from "../shared/types";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** GET /users/{userId} */
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

    const tableName = requireEnv("DYNAMODB_USERS_TABLE");
    const out = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId },
      })
    );

    if (!out.Item) {
      return jsonResponse(404, {
        success: false,
        error: "User not found",
      } satisfies ApiResponse<never>);
    }

    return jsonResponse(200, {
      success: true,
      data: out.Item as TutorLinkUser,
    } satisfies ApiResponse<TutorLinkUser>);
  } catch (error) {
    console.error("get-profile error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
