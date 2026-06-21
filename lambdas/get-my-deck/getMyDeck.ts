import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { isOptionsRequest, jsonResponse, optionsResponse } from "../shared/http";
import type { ApiResponse, TeacherProfile } from "../shared/types";

const dynamoClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(dynamoClient);

type DeckItem = {
  studentId: string;
  teacherId: string;
  status: string;
  addedAt: string;
  sortOrder: number;
  userNotes: string;
  updatedAt: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** GET /decks/{studentId} */
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

    const decksTable = requireEnv("DYNAMODB_DECKS_TABLE");
    const teacherProfilesTable = requireEnv("DYNAMODB_TEACHER_PROFILES_TABLE");
    const usersTable = requireEnv("DYNAMODB_USERS_TABLE");

    const deckOut = await ddb.send(
      new QueryCommand({
        TableName: decksTable,
        KeyConditionExpression: "studentId = :studentId",
        ExpressionAttributeValues: {
          ":studentId": studentId,
        },
      })
    );

    const deckItems = (deckOut.Items ?? []) as DeckItem[];

    if (deckItems.length === 0) {
      return jsonResponse(200, {
        success: true,
        data: {
          deck: [],
          count: 0,
        },
      } satisfies ApiResponse<{ deck: unknown[]; count: number }>);
    }

    const enrichedDeck = await Promise.all(
      deckItems.map(async (deckItem) => {
        const [teacherOut, userOut] = await Promise.all([
          ddb.send(
            new GetCommand({
              TableName: teacherProfilesTable,
              Key: { teacherId: deckItem.teacherId },
            })
          ),
          ddb.send(
            new GetCommand({
              TableName: usersTable,
              Key: { userId: deckItem.teacherId },
            })
          ),
        ]);

        const teacher = (teacherOut.Item ?? {}) as Partial<TeacherProfile>;
        const user = (userOut.Item ?? {}) as Record<string, unknown>;

        return {
          ...deckItem,
          ...teacher,
          name: typeof user.name === "string" ? user.name : undefined,
          photoUrl: typeof user.photoUrl === "string" ? user.photoUrl : undefined,
        };
      })
    );

    enrichedDeck.sort((a, b) => a.sortOrder - b.sortOrder);

    return jsonResponse(200, {
      success: true,
      data: {
        deck: enrichedDeck,
        count: enrichedDeck.length,
      },
    } satisfies ApiResponse<{ deck: unknown[]; count: number }>);
  } catch (error) {
    console.error("get-my-deck error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
