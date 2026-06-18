CREATE TABLE "attendance_eligibility" (
  "id"            TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "firstName"     TEXT NOT NULL,
  "lastName"      TEXT NOT NULL,
  "watchedOver80" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_eligibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_eligibility_email_key" ON "attendance_eligibility"("email");

CREATE TABLE "attendance_certificates" (
  "id"              TEXT NOT NULL,
  "eligibilityId"   TEXT NOT NULL,
  "certificateCode" TEXT NOT NULL,
  "issuedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_certificates_eligibilityId_key" ON "attendance_certificates"("eligibilityId");
CREATE UNIQUE INDEX "attendance_certificates_certificateCode_key" ON "attendance_certificates"("certificateCode");

ALTER TABLE "attendance_certificates" ADD CONSTRAINT "attendance_certificates_eligibilityId_fkey"
  FOREIGN KEY ("eligibilityId") REFERENCES "attendance_eligibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
