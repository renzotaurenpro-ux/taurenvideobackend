-- AlterTable
ALTER TABLE "purchases" ALTER COLUMN "provider" DROP DEFAULT;

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
