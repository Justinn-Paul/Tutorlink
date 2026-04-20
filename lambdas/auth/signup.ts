import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  UsernameExistsException,
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

/** POST /auth/signup — APIGatewayProxyEvent from API Gateway */
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
    const role = record.role;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      (role !== "student" && role !== "teacher")
    ) {
      return jsonResponse(400, {
        success: false,
        error: "email, password, and role (student | teacher) are required",
      });
    }

    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error("Missing AWS region (set AWS_REGION)");
    }
    const client = new CognitoIdentityProviderClient({ region });

    await client.send(
      new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "custom:role", Value: role },
        ],
      })
    );

    return jsonResponse(201, {
      success: true,
      data: {
        message: "Verification email sent",
        email,
      },
    });
  } catch (err: unknown) {
    if (err instanceof UsernameExistsException) {
      return jsonResponse(409, {
        success: false,
        error: "Email already registered",
      });
    }
    console.error("signup error:", err);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    });
  }
};
