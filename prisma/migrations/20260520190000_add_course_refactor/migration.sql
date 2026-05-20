-- Limpiar datos que dependen de la estructura anterior
DELETE FROM "certificates";
DELETE FROM "exam_attempts";
DELETE FROM "purchases";

-- Crear tabla courses
CREATE TABLE "courses" (
  "id"           TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "thumbnailUrl" TEXT,
  "priceClp"     INTEGER NOT NULL,
  "published"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- Agregar courseId a videos y quitar priceClp
ALTER TABLE "videos" ADD COLUMN "courseId" TEXT;
ALTER TABLE "videos" DROP COLUMN IF EXISTS "priceClp";

-- Actualizar exams: reemplazar videoId por courseId
ALTER TABLE "exams" ADD COLUMN "courseId" TEXT;
ALTER TABLE "exams" DROP COLUMN IF EXISTS "videoId";

-- Actualizar purchases: reemplazar videoId por courseId
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_userId_videoId_key";
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_videoId_fkey";
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "videoId";
ALTER TABLE "purchases" ADD COLUMN "courseId" TEXT NOT NULL DEFAULT '';

-- Foreign keys
ALTER TABLE "videos" ADD CONSTRAINT "videos_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "exams" ADD CONSTRAINT "exams_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchases" ADD CONSTRAINT "purchases_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint nueva
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_userId_courseId_key";
CREATE UNIQUE INDEX "purchases_userId_courseId_key" ON "purchases"("userId", "courseId");
