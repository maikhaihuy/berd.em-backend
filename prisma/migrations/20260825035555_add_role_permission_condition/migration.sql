-- AlterTable
ALTER TABLE "public"."permissions" DROP COLUMN "condition";

-- AlterTable
ALTER TABLE "public"."role_permissions" ADD COLUMN     "condition" JSONB;
