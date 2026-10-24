INSERT INTO "shift_rules" (
    "id", "shiftId", "version", "effectiveFrom", "effectiveTo", "timezone",
    "scheduledStartSeconds", "scheduledCompletionSeconds",
    "breakStartSeconds", "breakEndSeconds", "abnormalDurationThresholdSeconds", "tiers", "createdAt"
)
SELECT
    gen_random_uuid(), s."id", 4, DATE '2026-09-01', NULL, 'Asia/Ho_Chi_Minh',
    25200, 68400, 43200, 46800, 57600,
    '{"tier100":28800,"tier150After":28800,"targetWorkedSeconds":39600,"countEarlyArrivalSeconds":false,"checkOutBlockSeconds":1800,"postCompletionBlockSeconds":1800,"sundayTierPercentage":200}'::jsonb,
    CURRENT_TIMESTAMP
FROM "shifts" s
WHERE s."code" = 'CA1'
  AND NOT EXISTS (
      SELECT 1
      FROM "shift_rules" r
      WHERE r."shiftId" = s."id" AND r."version" = 4
  );
