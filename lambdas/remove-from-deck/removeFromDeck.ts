import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse } from "../shared/http";
import type { ApiResponse } from "../shared/types";

const dynamoClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(dynamoClient);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** DELETE /decks/{studentId}/{teacherId} */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) return optionsResponse();

  try {
    const studentId = event.pathParameters?.studentId;
    const teacherId = event.pathParameters?.teacherId;

    if (!studentId || !teacherId) {
      return jsonResponse(400, {
        success: false,
        error: "Missing studentId or teacherId path parameter",
      } satisfies ApiResponse<never>);
    }

    const decksTable = requireEnv("DYNAMODB_DECKS_TABLE");

    const existingOut = await ddb.send(
      new GetCommand({
        TableName: decksTable,
        Key: { studentId, teacherId },
      })
    );

    if (!existingOut.Item) {
      return jsonResponse(404, {
        success: false,
        error: "Deck item not found",
      } satisfies ApiResponse<never>);
    }

    await ddb.send(
      new DeleteCommand({
        TableName: decksTable,
        Key: { studentId, teacherId },
      })
    );

    return jsonResponse(200, {
      success: true,
      data: {
        message: "Teacher removed from deck",
      },
    } satisfies ApiResponse<{ message: string }>);
  } catch (error) {
    console.error("remove-from-deck error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
