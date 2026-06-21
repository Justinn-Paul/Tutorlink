import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse } from "../shared/types";

const dynamoClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(dynamoClient);

const MAX_NOTE_LENGTH = 500;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** PUT /decks/{studentId}/{teacherId}/note */
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

    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, {
        success: false,
        error: "Invalid request body",
      } satisfies ApiResponse<never>);
    }

    const note = (body as Record<string, unknown>).note;
    if (typeof note !== "string") {
      return jsonResponse(400, {
        success: false,
        error: "note must be a string",
      } satisfies ApiResponse<never>);
    }

    if (note.length > MAX_NOTE_LENGTH) {
      return jsonResponse(400, {
        success: false,
        error: "note must be 500 characters or fewer",
      } satisfies ApiResponse<never>);
    }

    const decksTable = requireEnv("DYNAMODB_DECKS_TABLE");

    await ddb.send(
      new UpdateCommand({
        TableName: decksTable,
        Key: { studentId, teacherId },
        UpdateExpression: "SET #note = :note, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#note": "userNotes",
        },
        ExpressionAttributeValues: {
          ":note": note,
          ":updatedAt": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(studentId)",
      })
    );

    return jsonResponse(200, {
      success: true,
      data: {
        message: "Note saved",
      },
    } satisfies ApiResponse<{ message: string }>);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, {
        success: false,
        error: "Deck item not found",
      } satisfies ApiResponse<never>);
    }

    console.error("add-private-note error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
