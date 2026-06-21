#!/usr/bin/env bash
# Wire POST /auth/verify and POST /auth/resend-code on an HTTP API (tutorlink-api).
#
# Prerequisite: Lambda functions must exist in AWS with env vars matching other auth lambdas.
#   tutorlink-auth-verify
#   tutorlink-auth-resend-code
#
# Usage:
#   export AWS_REGION=ap-southeast-1
#   export API_GATEWAY_ID=w7ysx08o50
#   ./scripts/wire-auth-verify-routes.sh
#
set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-1}"
API_ID="${API_GATEWAY_ID:?Set API_GATEWAY_ID (e.g. w7ysx08o50)}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

wire_route() {
  local route_key="$1"
  local lambda_name="$2"
  local lambda_arn="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${lambda_name}"

  echo "→ $route_key → $lambda_name"

  aws lambda add-permission \
    --region "$REGION" \
    --function-name "$lambda_name" \
    --statement-id "apigw-${API_ID}-$(echo "$route_key" | tr '/ ' '-')" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
    2>/dev/null || echo "  (invoke permission may already exist)"

  local integration_id
  integration_id="$(aws apigatewayv2 get-integrations --region "$REGION" --api-id "$API_ID" \
    --query "Items[?IntegrationUri=='${lambda_arn}'].IntegrationId | [0]" --output text)"

  if [[ -z "$integration_id" || "$integration_id" == "None" ]]; then
    integration_id="$(aws apigatewayv2 create-integration \
      --region "$REGION" \
      --api-id "$API_ID" \
      --integration-type AWS_PROXY \
      --integration-uri "$lambda_arn" \
      --payload-format-version 2.0 \
      --query IntegrationId --output text)"
  fi

  local existing_route
  existing_route="$(aws apigatewayv2 get-routes --region "$REGION" --api-id "$API_ID" \
    --query "Items[?RouteKey=='${route_key}'].RouteId | [0]" --output text)"

  if [[ -z "$existing_route" || "$existing_route" == "None" ]]; then
    aws apigatewayv2 create-route \
      --region "$REGION" \
      --api-id "$API_ID" \
      --route-key "$route_key" \
      --target "integrations/${integration_id}"
    echo "  ✓ route created"
  else
    echo "  ✓ route already exists ($existing_route)"
  fi
}

echo "API: $API_ID  Region: $REGION"
echo ""

wire_route "POST /auth/verify" "tutorlink-auth-verify"
wire_route "POST /auth/resend-code" "tutorlink-auth-resend-code"

echo ""
echo "Done. Test:"
echo "  curl -i -X POST \"https://${API_ID}.execute-api.${REGION}.amazonaws.com/auth/verify\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"email\":\"you@example.com\",\"code\":\"123456\"}'"
