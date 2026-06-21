import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse } from "../shared/types";

const dynamoClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(dynamoClient);

type OrderEntry = {
  teacherId: string;
  sortOrder: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isValidOrderEntry(entry: unknown): entry is OrderEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.teacherId === "string" &&
    e.teacherId.trim().length > 0 &&
    typeof e.sortOrder === "number" &&
    Number.isFinite(e.sortOrder)
  );
}

/** PUT /decks/{studentId}/reorder */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) return optionsResponse();

  try {
    const studentId = event.pathParameters?.studentId;
    if (!studentId) {
      return jsonResponse(400, {
        success: false,
        error: "Missing studentId path parameter",
      } satisfies ApiResponse<never>);
    }

    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, {
        success: false,
        error: "Invalid request body",
      } satisfies ApiResponse<never>);
    }

    const order = (body as Record<string, unknown>).order;
    if (!Array.isArray(order) || order.length === 0) {
      return jsonResponse(400, {
        success: false,
        error: "order must be a non-empty array",
      } satisfies ApiResponse<never>);
    }

    if (!order.every(isValidOrderEntry)) {
      return jsonResponse(400, {
        success: false,
        error: "Each order entry must include teacherId and sortOrder",
      } satisfies ApiResponse<never>);
    }

    const decksTable = requireEnv("DYNAMODB_DECKS_TABLE");
    const updatedAt = new Date().toISOString();

    await Promise.all(
      order.map((item) =>
        ddb.send(
          new UpdateCommand({
            TableName: decksTable,
            Key: { studentId, teacherId: item.teacherId },
            UpdateExpression: "SET sortOrder = :sortOrder, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":sortOrder": item.sortOrder,
              ":updatedAt": updatedAt,
            },
            ConditionExpression: "attribute_exists(studentId)",
          })
        )
      )
    );

    return jsonResponse(200, {
      success: true,
      data: {
        message: "Deck reordered",
      },
    } satisfies ApiResponse<{ message: string }>);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return jsonResponse(404, {
        success: false,
        error: "One or more deck items not found",
      } satisfies ApiResponse<never>);
    }

    console.error("reorder-deck error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
