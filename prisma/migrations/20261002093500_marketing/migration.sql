-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingContext" JSONB;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "metaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiktokEnabled" BOOLEAN NOT NULL DEFAULT true;
