import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { isOptionsRequest, jsonResponse, optionsResponse } from "../shared/http";

/** Works for direct Lambda invokes, API Gateway HTTP API, and Function URLs. */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (isOptionsRequest(event)) {
    return optionsResponse();
  }

  return jsonResponse(200, {
    success: true,
    data: {
      message: "Hello from TutorLink",
      event,
    },
  });
};
