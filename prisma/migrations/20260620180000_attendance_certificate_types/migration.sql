CREATE TYPE "AttendanceCertificateType" AS ENUM ('LIVE_VIEWING', 'EXAM');

DROP INDEX "attendance_certificates_eligibilityId_key";

ALTER TABLE "attendance_certificates" ADD COLUMN "type" "AttendanceCertificateType" NOT NULL DEFAULT 'LIVE_VIEWING';

UPDATE "attendance_certificates" ac
SET "type" = 'EXAM'
FROM "attendance_eligibility" ae
WHERE ac."eligibilityId" = ae.id AND ae."watchedOver80" = false;

CREATE UNIQUE INDEX "attendance_certificates_eligibilityId_type_key"
  ON "attendance_certificates"("eligibilityId", "type");
