import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { ApiResponse } from "../shared/types";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function parseJsonBody(event: APIGatewayProxyEvent): unknown {
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

function jsonResponse<T>(
  statusCode: number,
  payload: ApiResponse<T>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

type RefreshData = {
  idToken: string;
  accessToken: string;
  expiresIn: number;
};

/** POST /auth/refresh — APIGatewayProxyEvent from API Gateway */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    requireEnv("COGNITO_USER_POOL_ID");
    const clientId = requireEnv("COGNITO_CLIENT_ID");

    const body = parseJsonBody(event);
    if (body == null || typeof body !== "object" || body === null) {
      return jsonResponse(400, {
        success: false,
        error: "Invalid JSON body",
      });
    }

    const refreshToken = (body as Record<string, unknown>).refreshToken;
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      return jsonResponse(400, {
        success: false,
        error: "refreshToken is required",
      });
    }

    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error("Missing AWS region (set AWS_REGION)");
    }
    const client = new CognitoIdentityProviderClient({ region });

    const out = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })
    );

    const auth = out.AuthenticationResult;
    if (
      !auth?.IdToken ||
      !auth.AccessToken ||
      auth.ExpiresIn == null
    ) {
      console.error("refresh: missing AuthenticationResult fields", out);
      return jsonResponse(500, {
        success: false,
        error: "Internal server error",
      });
    }

    const data: RefreshData = {
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      expiresIn: auth.ExpiresIn,
    };

    return jsonResponse(200, {
      success: true,
      data,
    });
  } catch (err: unknown) {
    console.error("refresh error:", err);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    });
  }
};
