CREATE TABLE "attendance_exam_attempts" (
  "id"            TEXT NOT NULL,
  "eligibilityId" TEXT NOT NULL,
  "examId"        TEXT NOT NULL,
  "score"         INTEGER NOT NULL,
  "passed"        BOOLEAN NOT NULL,
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_exam_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_exam_attempts_eligibilityId_examId_key"
  ON "attendance_exam_attempts"("eligibilityId", "examId");

ALTER TABLE "attendance_exam_attempts" ADD CONSTRAINT "attendance_exam_attempts_eligibilityId_fkey"
  FOREIGN KEY ("eligibilityId") REFERENCES "attendance_eligibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_exam_attempts" ADD CONSTRAINT "attendance_exam_attempts_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
