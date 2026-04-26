import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { ApiResponse } from "./types";

const DEFAULT_ALLOW_HEADERS = "Content-Type,Authorization";
const DEFAULT_ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": DEFAULT_ALLOW_METHODS,
    "Content-Type": "application/json",
  };
}

export function isOptionsRequest(event: APIGatewayProxyEvent): boolean {
  return event.httpMethod?.toUpperCase() === "OPTIONS";
}

export function optionsResponse(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: corsHeaders(),
    body: "",
  };
}

export function parseJsonBody(event: APIGatewayProxyEvent): unknown {
  if (event.body == null || event.body === "") {
    return undefined;
  }
  const raw =
    event.isBase64Encoded === true
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function jsonResponse<T>(
  statusCode: number,
  payload: ApiResponse<T>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(payload),
  };
}
