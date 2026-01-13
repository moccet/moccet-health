#!/bin/bash

EMAIL="hvdvpjyp2z@privaterelay.appleid.com"
BASE_URL="https://www.moccet.ai"

echo "=== Syncing Slack for $EMAIL ==="
curl -s -X POST "$BASE_URL/api/slack/fetch-data" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | jq -r '.patterns.dataPointsAnalyzed // .error // .' 2>/dev/null | head -20

echo ""
echo "=== Syncing Gmail for $EMAIL ==="
curl -s -X POST "$BASE_URL/api/gmail/fetch-data" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | jq -r '.patterns.dataPointsAnalyzed // .error // .' 2>/dev/null | head -20

echo ""
echo "=== Done ==="
