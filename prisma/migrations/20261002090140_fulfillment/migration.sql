-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SupplierOrderStatus" ADD VALUE 'NEEDS_CHECK';
ALTER TYPE "SupplierOrderStatus" ADD VALUE 'MANUAL_ACTION_REQUIRED';

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "aliexpressAutoPay" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "usdToEurMicros" INTEGER;

-- AlterTable
ALTER TABLE "SupplierOffer" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "shippingMethod" TEXT;

-- AlterTable
ALTER TABLE "SupplierOrder" ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupplierCredential" (
    "adapter" "SupplierAdapterKind" NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "refreshExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCredential_pkey" PRIMARY KEY ("adapter")
);
