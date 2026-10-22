\pset pager off

WITH r AS (
  SELECT * FROM attendance_raw
  WHERE "importId" = (
    SELECT id FROM attendance_imports
    WHERE status = 'ACCEPTED'
    ORDER BY "confirmedAt" DESC
    LIMIT 1
  )
)
SELECT
  count(*) AS raw_rows,
  count(DISTINCT "employeeCode") AS employee_codes,
  count(DISTINCT "departmentName") AS departments,
  min("attendanceDateRaw") AS min_date,
  max("attendanceDateRaw") AS max_date,
  count(*) FILTER (WHERE trim("employeeCode") = '') AS blank_employee_code,
  count(*) FILTER (WHERE trim("employeeName") = '') AS blank_employee_name,
  count(*) FILTER (WHERE trim("departmentName") = '') AS blank_department
FROM r;

WITH r AS (
  SELECT * FROM attendance_raw
  WHERE "importId" = (
    SELECT id FROM attendance_imports
    WHERE status = 'ACCEPTED'
    ORDER BY "confirmedAt" DESC
    LIMIT 1
  )
), by_code AS (
  SELECT
    "employeeCode",
    count(DISTINCT "employeeName") AS names,
    count(DISTINCT "departmentName") AS departments
  FROM r
  GROUP BY "employeeCode"
)
SELECT
  count(*) FILTER (WHERE names > 1) AS employee_codes_with_multiple_names,
  count(*) FILTER (WHERE departments > 1) AS employee_codes_with_multiple_departments
FROM by_code;

WITH r AS (
  SELECT * FROM attendance_raw
  WHERE "importId" = (
    SELECT id FROM attendance_imports
    WHERE status = 'ACCEPTED'
    ORDER BY "confirmedAt" DESC
    LIMIT 1
  )
), grouped AS (
  SELECT
    "employeeCode",
    "attendanceDateRaw",
    count(*) AS rows,
    count(DISTINCT coalesce("shiftNameRaw", '')) AS shifts
  FROM r
  GROUP BY "employeeCode", "attendanceDateRaw"
)
SELECT
  count(*) FILTER (WHERE rows > 1) AS employee_days_with_multiple_rows,
  count(*) FILTER (WHERE shifts > 1) AS employee_days_with_multiple_shifts,
  max(rows) AS max_rows_per_employee_day
FROM grouped;

WITH r AS (
  SELECT * FROM attendance_raw
  WHERE "importId" = (
    SELECT id FROM attendance_imports
    WHERE status = 'ACCEPTED'
    ORDER BY "confirmedAt" DESC
    LIMIT 1
  )
)
SELECT coalesce(nullif(trim("shiftNameRaw"), ''), '(blank)') AS shift_value, count(*)
FROM r
GROUP BY 1
ORDER BY 2 DESC;

WITH r AS (
  SELECT * FROM attendance_raw
  WHERE "importId" = (
    SELECT id FROM attendance_imports
    WHERE status = 'ACCEPTED'
    ORDER BY "confirmedAt" DESC
    LIMIT 1
  )
)
SELECT
  count(*) FILTER (WHERE "checkInRaw" ~ '^[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?$') AS valid_time_checkin,
  count(*) FILTER (WHERE "checkOutRaw" ~ '^[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?$') AS valid_time_checkout,
  count(*) FILTER (WHERE "checkInRaw" IS NULL OR trim("checkInRaw") = '') AS missing_checkin,
  count(*) FILTER (WHERE "checkOutRaw" IS NULL OR trim("checkOutRaw") = '') AS missing_checkout
FROM r;

WITH r AS (
  SELECT * FROM attendance_raw
  WHERE "importId" = (
    SELECT id FROM attendance_imports
    WHERE status = 'ACCEPTED'
    ORDER BY "confirmedAt" DESC
    LIMIT 1
  )
), c3 AS (
  SELECT * FROM r
  WHERE lower(trim("shiftNameRaw")) = 'ca3'
    AND "checkInRaw" ~ '^[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?$'
    AND "checkOutRaw" ~ '^[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?$'
)
SELECT
  count(*) AS c3_with_both_times,
  count(*) FILTER (WHERE "checkOutRaw"::time < "checkInRaw"::time) AS checkout_earlier,
  count(*) FILTER (WHERE "checkOutRaw"::time >= "checkInRaw"::time) AS checkout_same_day_candidate
FROM c3;

WITH r AS (
  SELECT * FROM attendance_raw
  WHERE "importId" = (
    SELECT id FROM attendance_imports
    WHERE status = 'ACCEPTED'
    ORDER BY "confirmedAt" DESC
    LIMIT 1
  )
), conflict_keys AS (
  SELECT "employeeCode", "attendanceDateRaw"
  FROM r
  GROUP BY "employeeCode", "attendanceDateRaw"
  HAVING count(*) > 1
)
SELECT
  count(*) AS conflict_rows,
  count(*) FILTER (WHERE lower(trim(r."shiftNameRaw")) IN ('ca1', 'ca3')) AS conflict_rows_with_supported_shift,
  count(*) FILTER (WHERE r."checkInRaw" IS NULL OR trim(r."checkInRaw") = '') AS conflict_rows_missing_checkin,
  count(*) FILTER (WHERE r."checkOutRaw" IS NULL OR trim(r."checkOutRaw") = '') AS conflict_rows_missing_checkout
FROM r
JOIN conflict_keys k
  ON k."employeeCode" = r."employeeCode"
 AND k."attendanceDateRaw" = r."attendanceDateRaw";
