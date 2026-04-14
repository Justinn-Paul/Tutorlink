import type { Handler } from "aws-lambda";

/** Works for direct Lambda invokes, API Gateway HTTP API, and Function URLs. */
export const handler: Handler = async (event) => {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "Hello from TutorLink",
      event,
    }),
  };
};
