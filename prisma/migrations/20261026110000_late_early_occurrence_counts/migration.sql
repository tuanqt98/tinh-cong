-- DEC-014: late/early are occurrence counts. Historical duration columns stay immutable.
ALTER TABLE "attendance_calculations"
ADD COLUMN "lateCount" INTEGER,
ADD COLUMN "earlyCount" INTEGER;

INSERT INTO "shift_rules" (
    "id", "shiftId", "version", "effectiveFrom", "effectiveTo", "timezone",
    "scheduledStartSeconds", "scheduledCompletionSeconds",
    "breakStartSeconds", "breakEndSeconds", "abnormalDurationThresholdSeconds", "tiers", "createdAt"
)
SELECT
    gen_random_uuid(), s."id", 5, DATE '2026-09-01', NULL, 'Asia/Ho_Chi_Minh',
    25200, 68400, 43200, 46800, 57600,
    '{"tier100":28800,"tier150After":28800,"targetWorkedSeconds":39600,"countEarlyArrivalSeconds":false,"checkOutBlockSeconds":1800,"postCompletionBlockSeconds":1800,"sundayTierPercentage":200,"lateAfterSeconds":28860}'::jsonb,
    CURRENT_TIMESTAMP
FROM "shifts" s
WHERE s."code" = 'CA1'
  AND NOT EXISTS (
      SELECT 1 FROM "shift_rules" r WHERE r."shiftId" = s."id" AND r."version" = 5
  );

INSERT INTO "shift_rules" (
    "id", "shiftId", "version", "effectiveFrom", "effectiveTo", "timezone",
    "scheduledStartSeconds", "scheduledCompletionSeconds",
    "breakStartSeconds", "breakEndSeconds", "abnormalDurationThresholdSeconds", "tiers", "createdAt"
)
SELECT
    gen_random_uuid(), s."id", 4, DATE '2026-09-01', NULL, 'Asia/Ho_Chi_Minh',
    68400, 111600, 86400, 90000, 57600,
    '{"tier100":14400,"tier130":14400,"tier210After":28800,"targetWorkedSeconds":39600,"countEarlyArrivalSeconds":false,"postCompletionBlockSeconds":1800,"sundayTierPercentage":230,"lateAfterSeconds":79260}'::jsonb,
    CURRENT_TIMESTAMP
FROM "shifts" s
WHERE s."code" = 'CA3'
  AND NOT EXISTS (
      SELECT 1 FROM "shift_rules" r WHERE r."shiftId" = s."id" AND r."version" = 4
  );
