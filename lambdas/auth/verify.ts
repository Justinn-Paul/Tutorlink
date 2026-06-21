import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CodeMismatchException,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  ExpiredCodeException,
  NotAuthorizedException,
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

/** POST /auth/verify — confirm Cognito signup with email verification code */
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
    const code = record.code;

    if (typeof email !== "string" || typeof code !== "string") {
      return jsonResponse(400, {
        success: false,
        error: "email and code are required",
      });
    }

    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error("Missing AWS region (set AWS_REGION)");
    }
    const client = new CognitoIdentityProviderClient({ region });

    await client.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: email,
        ConfirmationCode: code,
      })
    );

    return jsonResponse(201, {
      success: true,
      data: {
        message: "Email verified successfully",
      },
    });
  } catch (err: unknown) {
    if (err instanceof CodeMismatchException) {
      return jsonResponse(400, {
        success: false,
        error: "Invalid verification code",
      });
    }
    if (err instanceof ExpiredCodeException) {
      return jsonResponse(400, {
        success: false,
        error: "Code has expired, please request a new one",
      });
    }
    if (err instanceof NotAuthorizedException) {
      return jsonResponse(400, {
        success: false,
        error: "User is already verified",
      });
    }
    console.error("verify error:", err);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    });
  }
};
