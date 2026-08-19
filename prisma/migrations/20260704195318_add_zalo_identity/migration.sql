-- DropIndex
DROP INDEX "public"."users_zaloId_key";

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "zaloId";

-- CreateTable
CREATE TABLE "public"."zalo_identities" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "zaloUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zalo_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zalo_identities_userId_key" ON "public"."zalo_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "zalo_identities_zaloUserId_key" ON "public"."zalo_identities"("zaloUserId");

-- AddForeignKey
ALTER TABLE "public"."zalo_identities" ADD CONSTRAINT "zalo_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
