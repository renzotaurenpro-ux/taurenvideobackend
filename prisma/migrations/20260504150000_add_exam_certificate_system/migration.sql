CREATE TABLE "exams" (
  "id" TEXT NOT NULL,
  "videoId" TEXT,
  "title" TEXT NOT NULL,
  "passingScore" INTEGER NOT NULL DEFAULT 60,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_questions" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_options" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "exam_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_attempts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "certificates" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "certificateCode" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_options" ADD CONSTRAINT "exam_options_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "certificates_certificateCode_key" ON "certificates"("certificateCode");
CREATE UNIQUE INDEX "certificates_userId_examId_key" ON "certificates"("userId", "examId");
