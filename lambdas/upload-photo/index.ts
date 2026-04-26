import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isOptionsRequest, jsonResponse, optionsResponse, parseJsonBody } from "../shared/http";
import type { ApiResponse } from "../shared/types";

const s3 = new S3Client({});
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const FILE_EXTENSIONS: Record<(typeof ALLOWED_TYPES)[number], string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** POST /users/{userId}/photo-upload-url */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) {
    return optionsResponse();
  }

  try {
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return jsonResponse(400, {
        success: false,
        error: "Missing userId path parameter",
      } satisfies ApiResponse<never>);
    }

    const body = parseJsonBody(event);
    if (!body || typeof body !== "object") {
      return jsonResponse(400, {
        success: false,
        error: "Invalid request body",
      } satisfies ApiResponse<never>);
    }

    const fileType = (body as Record<string, unknown>).fileType;
    if (typeof fileType !== "string" || !ALLOWED_TYPES.includes(fileType as (typeof ALLOWED_TYPES)[number])) {
      return jsonResponse(400, {
        success: false,
        error: "fileType must be one of: image/jpeg, image/png, image/webp",
      } satisfies ApiResponse<never>);
    }

    const typedFileType = fileType as (typeof ALLOWED_TYPES)[number];
    const bucket = requireEnv("S3_PROFILE_PHOTOS_BUCKET");
    const extension = FILE_EXTENSIONS[typedFileType];
    const key = `profile-photos/${userId}/${Date.now()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: typedFileType,
    });

    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
    const photoUrl = `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${key}`;

    return jsonResponse(200, {
      success: true,
      data: {
        uploadUrl,
        photoUrl,
        expiresIn,
      },
    } satisfies ApiResponse<{ uploadUrl: string; photoUrl: string; expiresIn: number }>);
  } catch (error) {
    console.error("upload-photo error:", error);
    return jsonResponse(500, {
      success: false,
      error: "Internal server error",
    } satisfies ApiResponse<never>);
  }
};
