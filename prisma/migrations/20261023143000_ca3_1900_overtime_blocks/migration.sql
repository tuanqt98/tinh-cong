-- DEC-008: preserve the previous Ca 3 rule and add a new effective version.
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
    68400,
    111600,
    86400,
    90000,
    57600,
    '{"tier100":14400,"tier130":14400,"tier210After":28800,"targetWorkedSeconds":39600,"countEarlyArrivalSeconds":false,"postCompletionBlockSeconds":1800}'::jsonb,
    CURRENT_TIMESTAMP
FROM "shifts" s
WHERE s."code" = 'CA3'
  AND NOT EXISTS (
    SELECT 1
    FROM "shift_rules" r
    WHERE r."shiftId" = s."id" AND r."version" = 2
  );
