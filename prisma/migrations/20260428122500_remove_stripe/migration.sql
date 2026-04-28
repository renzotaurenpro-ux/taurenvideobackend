CREATE TYPE "PaymentProvider" AS ENUM ('MERCADOPAGO', 'TRANSBANK');

ALTER TABLE "purchases" ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADOPAGO';
ALTER TABLE "purchases" ADD COLUMN "providerSessionId" TEXT;
ALTER TABLE "purchases" ADD COLUMN "providerPaymentId" TEXT;

UPDATE "purchases"
SET "providerSessionId" = "stripeSessionId",
    "providerPaymentId" = "stripePaymentId"
WHERE "providerSessionId" IS NULL;

ALTER TABLE "purchases" ALTER COLUMN "providerSessionId" SET NOT NULL;

DROP INDEX IF EXISTS "purchases_stripeSessionId_key";
ALTER TABLE "purchases" DROP COLUMN "stripeSessionId";
ALTER TABLE "purchases" DROP COLUMN "stripePaymentId";

CREATE UNIQUE INDEX "purchases_providerSessionId_key" ON "purchases"("providerSessionId");
