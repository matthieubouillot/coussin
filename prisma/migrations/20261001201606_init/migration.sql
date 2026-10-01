-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('FRANCHISE_293B', 'STANDARD');

-- CreateEnum
CREATE TYPE "SupplierAdapterKind" AS ENUM ('ALIEXPRESS', 'CJ', 'MANUAL');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "BundleKind" AS ENUM ('QUANTITY', 'COMBO');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'SENT_TO_SUPPLIER', 'SHIPPED', 'DELIVERED', 'FULFILLMENT_ERROR', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'WEBHOOK', 'CRON', 'ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('QUEUED', 'PLACING', 'AWAITING_SUPPLIER_PAYMENT', 'PLACED', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'RETURN_RECEIVED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('ORDER_CONFIRMATION', 'SHIPPED', 'DELIVERED', 'REVIEW_REQUEST', 'REFUND', 'DELAY_NOTICE', 'WITHDRAWAL_ACK');

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "shopName" TEXT NOT NULL,
    "legalIdentity" JSONB NOT NULL,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'FRANCHISE_293B',
    "defaultTaxRateBps" INTEGER NOT NULL DEFAULT 0,
    "christmasBannerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "christmasBannerText" TEXT,
    "marginAlertThresholdBps" INTEGER NOT NULL DEFAULT 3000,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "microRevenueCeilingCents" INTEGER,
    "vatFranchiseThresholdCents" INTEGER,
    "thresholdAlertRatioBps" INTEGER NOT NULL DEFAULT 8000,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'BTQ',
    "cgvVersion" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "contentBlocks" JSONB NOT NULL,
    "sizeGuide" JSONB NOT NULL,
    "packageContents" TEXT NOT NULL,
    "textileComposition" TEXT,
    "careInstructions" TEXT,
    "sortingInstructions" TEXT,
    "manufacturerName" TEXT,
    "manufacturerAddress" TEXT,
    "manufacturerContact" TEXT,
    "euResponsibleName" TEXT,
    "euResponsibleAddress" TEXT,
    "euResponsibleContact" TEXT,
    "productReference" TEXT,
    "safetyWarnings" TEXT,
    "defaultAdapter" "SupplierAdapterKind" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "alt" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "widthCm" INTEGER NOT NULL,
    "lengthCm" INTEGER NOT NULL,
    "recommendedFor" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "showReferencePrice" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePriceHistory" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOffer" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "adapter" "SupplierAdapterKind" NOT NULL,
    "supplierName" TEXT NOT NULL,
    "externalProductId" TEXT,
    "externalSkuId" TEXT,
    "externalUrl" TEXT,
    "priority" INTEGER NOT NULL,
    "purchaseCostCents" INTEGER NOT NULL,
    "shippingCostCents" INTEGER NOT NULL,
    "deliveryDaysMin" INTEGER NOT NULL,
    "deliveryDaysMax" INTEGER NOT NULL,
    "lastKnownStock" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SupplierOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCostHistory" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "purchaseCostCents" INTEGER NOT NULL,
    "shippingCostCents" INTEGER NOT NULL,
    "stock" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCostHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "BundleKind" NOT NULL,
    "minQuantity" INTEGER,
    "comboVariantIds" TEXT[],
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "BundleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minSubtotalCents" INTEGER,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "priceCents" INTEGER NOT NULL,
    "freeAboveCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "customerId" TEXT,
    "email" TEXT NOT NULL,
    "shippingName" TEXT,
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCity" TEXT,
    "shippingCountry" TEXT NOT NULL DEFAULT 'FR',
    "phone" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "bundleDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "promoDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "taxMode" "TaxMode" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "promoCodeId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paymentMethodType" TEXT,
    "paidAt" TIMESTAMP(3),
    "payoutAt" TIMESTAMP(3),
    "estimatedDeliveryMax" TIMESTAMP(3),
    "cgvAcceptedAt" TIMESTAMP(3),
    "cgvVersion" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "ttclid" TEXT,
    "marketingEventId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "unitCostCents" INTEGER,
    "supplierOrderId" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "adapter" "SupplierAdapterKind" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'QUEUED',
    "externalOrderId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "costCents" INTEGER,
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "trackingUrl" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRecord" (
    "id" TEXT NOT NULL,
    "supplierOrderId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "supplierName" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellerSnapshot" JSONB NOT NULL,
    "customerSnapshot" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "legalMention" TEXT NOT NULL,
    "pdfBlobUrl" TEXT NOT NULL,
    "pdfSha256" TEXT NOT NULL,
    "relatedInvoiceId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "series" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("series")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stripeRefundId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "creditNoteId" TEXT,
    "adminId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "message" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewInvite" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderNumber" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "EmailType" NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "resendId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_position_idx" ON "ProductMedia"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");

-- CreateIndex
CREATE INDEX "SalePriceHistory_variantId_validFrom_idx" ON "SalePriceHistory"("variantId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOffer_variantId_priority_key" ON "SupplierOffer"("variantId", "priority");

-- CreateIndex
CREATE INDEX "SupplierCostHistory_offerId_recordedAt_idx" ON "SupplierCostHistory"("offerId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");

-- CreateIndex
CREATE INDEX "OrderStatusEvent_orderId_createdAt_idx" ON "OrderStatusEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_idempotencyKey_key" ON "SupplierOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierOrder_status_lastPolledAt_idx" ON "SupplierOrder"("status", "lastPolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRecord_supplierOrderId_key" ON "PurchaseRecord"("supplierOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_creditNoteId_key" ON "Refund"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewInvite_orderId_key" ON "ReviewInvite"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewInvite_tokenHash_key" ON "ReviewInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_dedupKey_key" ON "EmailLog"("dedupKey");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_consentId_idx" ON "ConsentRecord"("consentId");

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePriceHistory" ADD CONSTRAINT "SalePriceHistory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOffer" ADD CONSTRAINT "SupplierOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCostHistory" ADD CONSTRAINT "SupplierCostHistory_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusEvent" ADD CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRecord" ADD CONSTRAINT "PurchaseRecord_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewInvite" ADD CONSTRAINT "ReviewInvite_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
