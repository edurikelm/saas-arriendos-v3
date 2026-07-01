-- CreateTable
CREATE TABLE "PropertyExportFeed" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channel" "ExternalChannel" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenLastFour" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "lastFetchedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyExportFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyExportFeed_tokenHash_key" ON "PropertyExportFeed"("tokenHash");

-- CreateIndex
CREATE INDEX "PropertyExportFeed_propertyId_idx" ON "PropertyExportFeed"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyExportFeed_tokenHash_idx" ON "PropertyExportFeed"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyExportFeed_propertyId_channel_key" ON "PropertyExportFeed"("propertyId", "channel");

-- AddForeignKey
ALTER TABLE "PropertyExportFeed" ADD CONSTRAINT "PropertyExportFeed_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;