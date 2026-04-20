import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotConfirmedException,
} from "@aws-sdk/client-cognito-identity-provider";
import type { AuthTokens } from "../shared/types";
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

/** POST /auth/login — APIGatewayProxyEvent from API Gateway */
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
    const password = record.password;

    if (typeof email !== "string" || typeof password !== "string") {
      return jsonResponse(400, {
        success: false,
        error: "email and password are required",
      });
    }

    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error("Missing AWS region (set AWS_REGION)");
    }
    const client = new CognitoIdentityProviderClient({ region });

    const out = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    );

    const auth = out.AuthenticationResult;
    if (
      !auth?.IdToken ||
      !auth.AccessToken ||
      !auth.RefreshToken ||
      auth.ExpiresIn == null
    ) {
      console.error("login: missing AuthenticationResult fields", out);
      return jsonResponse(500, {
        success: false,
        error: "Internal server error",
      });
    }

    const tokens: AuthTokens = {
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn,
    };

    return jsonResponse(200, {
      success: true,
      data: tokens,
    });
  } catch (err: unknown) {
    if (err instanceof NotAuthorizedException) {
      return jsonResponse(401, {
        success: false,
        error: "Invalid email or password",
      });
    }
    if (err instanceof UserNotConfirmedException) {
      return jsonResponse(403, {
        success: false,
        error: "Please verify your email first",
      });
    }
    console.error("login error:", err);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    });
  }
};
