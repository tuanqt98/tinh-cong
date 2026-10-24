-- DEC-009: preserve the previous Ca 1 rule and add a new effective version.
-- Source timestamps remain immutable; calculations select the highest effective version.
INSERT INTO "shift_rules" (
    "id",
    "shiftId",
    "version",
    "effectiveFrom",
    "timezone",
    "scheduledStartSeconds",
    "scheduledCompletionSeconds",
    "breakStartSeconds",
    "breakEndSeconds",
    "abnormalDurationThresholdSeconds",
    "tiers",
    "createdAt"
)
SELECT
    gen_random_uuid(),
    s."id",
    2,
    DATE '2026-09-01',
    'Asia/Ho_Chi_Minh',
    25200,
    68400,
    43200,
    46800,
    57600,
    '{"tier100":28800,"tier150After":28800,"targetWorkedSeconds":39600,"countEarlyArrivalSeconds":false,"postCompletionBlockSeconds":1800}'::jsonb,
    CURRENT_TIMESTAMP
FROM "shifts" s
WHERE s."code" = 'CA1'
  AND NOT EXISTS (
    SELECT 1
    FROM "shift_rules" r
    WHERE r."shiftId" = s."id" AND r."version" = 2
  );
