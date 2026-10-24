-- DEC-010: add explicit Sunday tiers while preserving all prior rules/calculations.
ALTER TABLE "attendance_calculations"
ADD COLUMN "tier200Seconds" INTEGER,
ADD COLUMN "tier230Seconds" INTEGER;

-- The highest effective version is selected for new/recalculated rows.
INSERT INTO "shift_rules" (
    "id", "shiftId", "version", "effectiveFrom", "timezone",
    "scheduledStartSeconds", "scheduledCompletionSeconds",
    "breakStartSeconds", "breakEndSeconds",
    "abnormalDurationThresholdSeconds", "tiers", "createdAt"
)
SELECT
    gen_random_uuid(), s."id", 3, DATE '2026-09-01', 'Asia/Ho_Chi_Minh',
    25200, 68400, 43200, 46800, 57600,
    '{"tier100":28800,"tier150After":28800,"targetWorkedSeconds":39600,"countEarlyArrivalSeconds":false,"postCompletionBlockSeconds":1800,"sundayTierPercentage":200}'::jsonb,
    CURRENT_TIMESTAMP
FROM "shifts" s
WHERE s."code" = 'CA1'
  AND NOT EXISTS (
    SELECT 1 FROM "shift_rules" r WHERE r."shiftId" = s."id" AND r."version" = 3
  );

INSERT INTO "shift_rules" (
    "id", "shiftId", "version", "effectiveFrom", "timezone",
    "scheduledStartSeconds", "scheduledCompletionSeconds",
    "breakStartSeconds", "breakEndSeconds",
    "abnormalDurationThresholdSeconds", "tiers", "createdAt"
)
SELECT
    gen_random_uuid(), s."id", 3, DATE '2026-09-01', 'Asia/Ho_Chi_Minh',
    68400, 111600, 86400, 90000, 57600,
    '{"tier100":14400,"tier130":14400,"tier210After":28800,"targetWorkedSeconds":39600,"countEarlyArrivalSeconds":false,"postCompletionBlockSeconds":1800,"sundayTierPercentage":230}'::jsonb,
    CURRENT_TIMESTAMP
FROM "shifts" s
WHERE s."code" = 'CA3'
  AND NOT EXISTS (
    SELECT 1 FROM "shift_rules" r WHERE r."shiftId" = s."id" AND r."version" = 3
  );
