import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse } from "../shared/types";

const dynamoClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(dynamoClient);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** POST /decks */
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

    const record = body as Record<string, unknown>;
    const studentId = record.studentId;
    const teacherId = record.teacherId;

    if (typeof studentId !== "string" || typeof teacherId !== "string") {
      return jsonResponse(400, {
        success: false,
        error: "studentId and teacherId are required",
      } satisfies ApiResponse<never>);
    }

    const decksTable = requireEnv("DYNAMODB_DECKS_TABLE");
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
        error: "Teacher not found",
      } satisfies ApiResponse<never>);
    }

    const existingOut = await ddb.send(
      new GetCommand({
        TableName: decksTable,
        Key: { studentId, teacherId },
      })
    );

    if (existingOut.Item) {
      return jsonResponse(409, {
        success: false,
        error: "Teacher already in deck",
      } satisfies ApiResponse<never>);
    }

    const deckQueryOut = await ddb.send(
      new QueryCommand({
        TableName: decksTable,
        KeyConditionExpression: "studentId = :studentId",
        ExpressionAttributeValues: {
          ":studentId": studentId,
        },
      })
    );

    const sortOrder = (deckQueryOut.Items ?? []).length;
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: decksTable,
        Item: {
          studentId,
          teacherId,
          status: "interested",
          addedAt: now,
          sortOrder,
          userNotes: "",
          updatedAt: now,
        },
      })
    );

    return jsonResponse(201, {
      success: true,
      data: {
        message: "Teacher added to deck",
        teacherId,
      },
    } satisfies ApiResponse<{ message: string; teacherId: string }>);
  } catch (error) {
    console.error("add-to-deck error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
