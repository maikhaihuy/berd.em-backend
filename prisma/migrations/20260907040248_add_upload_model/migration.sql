-- CreateTable
CREATE TABLE "public"."uploads" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploads_key_key" ON "public"."uploads"("key");

-- CreateIndex
CREATE INDEX "uploads_uploadedByUserId_idx" ON "public"."uploads"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "public"."uploads" ADD CONSTRAINT "uploads_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
