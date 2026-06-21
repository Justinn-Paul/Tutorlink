import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  LimitExceededException,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  isOptionsRequest,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../shared/http";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

/** POST /auth/resend-code — resend Cognito email verification code */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) {
    return optionsResponse();
  }

  try {
    requireEnv("COGNITO_USER_POOL_ID");
    const clientId = requireEnv("COGNITO_CLIENT_ID");

    const body = parseJsonBody(event);
    if (body == null || typeof body !== "object") {
      return jsonResponse(400, {
        success: false,
        error: "Invalid JSON body",
      });
    }

    const record = body as Record<string, unknown>;
    const email = record.email;

    if (typeof email !== "string") {
      return jsonResponse(400, {
        success: false,
        error: "email is required",
      });
    }

    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error("Missing AWS region (set AWS_REGION)");
    }
    const client = new CognitoIdentityProviderClient({ region });

    await client.send(
      new ResendConfirmationCodeCommand({
        ClientId: clientId,
        Username: email,
      })
    );

    return jsonResponse(200, {
      success: true,
      data: {
        message: "Verification code resent",
      },
    });
  } catch (err: unknown) {
    if (err instanceof LimitExceededException) {
      return jsonResponse(429, {
        success: false,
        error: "Too many attempts, please wait before retrying",
      });
    }
    console.error("resend-code error:", err);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    });
  }
};
