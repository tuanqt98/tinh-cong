-- CreateTable
CREATE TABLE "company_holidays" (
    "id" UUID NOT NULL,
    "holidayDate" DATE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_holidays_holidayDate_key" ON "company_holidays"("holidayDate");

-- CreateIndex
CREATE INDEX "company_holidays_holidayDate_idx" ON "company_holidays"("holidayDate");

-- CreateIndex
CREATE INDEX "company_holidays_createdById_createdAt_idx" ON "company_holidays"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
