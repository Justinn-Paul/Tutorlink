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

type DiscoveryTeacher = TeacherProfile & {
  name?: string;
  photoUrl?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 20;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 20;
  return Math.min(Math.max(1, n), 50);
}

function parseOptionalFloat(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

function decodeExclusiveStartKey(
  token: string | undefined
): Record<string, unknown> | undefined {
  if (token === undefined || token === "") return undefined;
  try {
    const json = Buffer.from(token, "base64").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid nextToken");
  }
}

async function getSavedTeacherIds(
  decksTable: string,
  studentId: string
): Promise<Set<string>> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: decksTable,
      KeyConditionExpression: "studentId = :sid",
      ExpressionAttributeValues: {
        ":sid": studentId,
      },
    })
  );

  const ids = new Set<string>();
  for (const item of out.Items ?? []) {
    const tid = (item as Record<string, unknown>).teacherId;
    if (typeof tid === "string") ids.add(tid);
  }
  return ids;
}

/** GET discovery feed — query teacher profiles by subject or location (GSI). */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) {
    return optionsResponse();
  }

  try {
    const q = event.queryStringParameters ?? {};
    console.log("discovery-feed query params:", JSON.stringify(q));

    const subject =
      typeof q.subject === "string" && q.subject.trim() !== ""
        ? q.subject.trim()
        : undefined;
    const location =
      typeof q.location === "string" && q.location.trim() !== ""
        ? q.location.trim()
        : undefined;
    const studentId =
      typeof q.studentId === "string" && q.studentId.trim() !== ""
        ? q.studentId.trim()
        : undefined;

    const limit = parseLimit(q.limit);
    const minRate = parseOptionalFloat(q.minRate);
    const maxRate = parseOptionalFloat(q.maxRate);

    let exclusiveStartKey: Record<string, unknown> | undefined;
    try {
      exclusiveStartKey = decodeExclusiveStartKey(q.nextToken);
    } catch {
      return jsonResponse(400, {
        success: false,
        error: "Invalid nextToken",
      } satisfies ApiResponse<never>);
    }

    if (!subject && !location) {
      return jsonResponse(400, {
        success: false,
        error: "Please provide subject or location filter",
      } satisfies ApiResponse<never>);
    }

    const teacherProfilesTable = requireEnv("DYNAMODB_TEACHER_PROFILES_TABLE");
    const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
    const decksTable = requireEnv("DYNAMODB_DECKS_TABLE");

    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {
      ":verified": "verified",
    };

    const filterParts: string[] = ["verificationStatus = :verified"];

    if (minRate !== undefined && maxRate !== undefined) {
      filterParts.push("minRate BETWEEN :minRate AND :maxRate");
      expressionAttributeValues[":minRate"] = minRate;
      expressionAttributeValues[":maxRate"] = maxRate;
    } else if (minRate !== undefined) {
      filterParts.push("minRate >= :minRate");
      expressionAttributeValues[":minRate"] = minRate;
    } else if (maxRate !== undefined) {
      filterParts.push("minRate <= :maxRate");
      expressionAttributeValues[":maxRate"] = maxRate;
    }

    const filterExpression = filterParts.join(" AND ");

    let keyConditionExpression: string;
    let indexName: string;

    if (subject) {
      indexName = "subjects-index";
      expressionAttributeNames["#subject"] = "subject";
      expressionAttributeValues[":subject"] = subject;
      keyConditionExpression = "#subject = :subject";
    } else {
      indexName = "location-rating-index";
      expressionAttributeNames["#location"] = "location";
      expressionAttributeValues[":location"] = location!;
      keyConditionExpression = "#location = :location";
    }

    const queryOut = await ddb.send(
      new QueryCommand({
        TableName: teacherProfilesTable,
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        FilterExpression: filterExpression,
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    let items = (queryOut.Items ?? []) as TeacherProfile[];

    if (studentId) {
      const savedIds = await getSavedTeacherIds(decksTable, studentId);
      items = items.filter((t) => !savedIds.has(t.teacherId));
    }

    const enrichedTeachers: DiscoveryTeacher[] = await Promise.all(
      items.map(async (teacher) => {
        const userOut = await ddb.send(
          new GetCommand({
            TableName: usersTable,
            Key: { userId: teacher.teacherId },
          })
        );
        const user = (userOut.Item ?? {}) as Record<string, unknown>;
        const name = typeof user.name === "string" ? user.name : undefined;
        const photoUrl =
          typeof user.photoUrl === "string" ? user.photoUrl : undefined;
        return { ...teacher, name, photoUrl };
      })
    );

    const nextPageToken = queryOut.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(queryOut.LastEvaluatedKey)).toString(
          "base64"
        )
      : null;

    return jsonResponse(200, {
      success: true,
      data: {
        teachers: enrichedTeachers,
        count: enrichedTeachers.length,
        nextToken: nextPageToken,
      },
    } satisfies ApiResponse<{
      teachers: DiscoveryTeacher[];
      count: number;
      nextToken: string | null;
    }>);
  } catch (error) {
    console.error("discovery-feed error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
