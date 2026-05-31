-- CreateEnum
CREATE TYPE "public"."SubShiftType" AS ENUM ('MAIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "public"."AvailabilityStatus" AS ENUM ('REGISTERED', 'ASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TaskType" AS ENUM ('SHARED_MANDATORY', 'SHARED_OPTIONAL', 'DEDICATED');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('PENDING', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "public"."shifts" DROP CONSTRAINT "shifts_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."work_slots" DROP CONSTRAINT "work_slots_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."work_slots" DROP CONSTRAINT "work_slots_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."attendance_histories" DROP CONSTRAINT "attendance_histories_workSlotId_fkey";

-- DropForeignKey
ALTER TABLE "public"."leave_requests" DROP CONSTRAINT "leave_requests_workSlotId_fkey";

-- DropForeignKey
ALTER TABLE "public"."time_logs" DROP CONSTRAINT "time_logs_workSlotId_fkey";

-- AlterTable
ALTER TABLE "public"."availabilities" ADD COLUMN     "status" "public"."AvailabilityStatus" NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN     "subShiftId" INTEGER NOT NULL,
ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."attendance_histories" DROP COLUMN "workSlotId",
ADD COLUMN     "assignmentId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."leave_requests" DROP COLUMN "workSlotId",
ADD COLUMN     "assignmentId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."time_logs" DROP COLUMN "workSlotId",
ADD COLUMN     "assignmentId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."shifts";

-- DropTable
DROP TABLE "public"."work_slots";

-- CreateTable
CREATE TABLE "public"."branch_schedule_configs" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "allowCustomAvailabilityTime" BOOLEAN NOT NULL DEFAULT false,
    "availabilityOpenDaysBefore" INTEGER,
    "availabilityCloseHoursBefore" INTEGER,
    "scheduleGenerationDay" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "branch_schedule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."master_shift_templates" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "status" "public"."ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "master_shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sub_shift_templates" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "masterShiftTemplateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."SubShiftType" NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "maxAssignments" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "sub_shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_templates" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "masterShiftTemplateId" INTEGER,
    "subShiftTemplateId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."TaskType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."master_shifts" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "masterShiftTemplateId" INTEGER,
    "workDate" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "public"."ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "master_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sub_shifts" (
    "id" SERIAL NOT NULL,
    "masterShiftId" INTEGER NOT NULL,
    "subShiftTemplateId" INTEGER,
    "title" TEXT NOT NULL,
    "type" "public"."SubShiftType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxAssignments" INTEGER,
    "status" "public"."ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "sub_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assignments" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "subShiftId" INTEGER NOT NULL,
    "availabilityId" INTEGER,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "status" "public"."WorkSlotStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" SERIAL NOT NULL,
    "taskTemplateId" INTEGER,
    "masterShiftId" INTEGER,
    "subShiftId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."TaskType" NOT NULL,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_completions" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "completedByEmployeeId" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER NOT NULL,

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_schedule_configs_branchId_key" ON "public"."branch_schedule_configs"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "master_shift_templates_branchId_name_key" ON "public"."master_shift_templates"("branchId", "name");

-- CreateIndex
CREATE INDEX "sub_shift_templates_branchId_idx" ON "public"."sub_shift_templates"("branchId");

-- CreateIndex
CREATE INDEX "sub_shift_templates_masterShiftTemplateId_idx" ON "public"."sub_shift_templates"("masterShiftTemplateId");

-- CreateIndex
CREATE INDEX "task_templates_branchId_idx" ON "public"."task_templates"("branchId");

-- CreateIndex
CREATE INDEX "task_templates_masterShiftTemplateId_idx" ON "public"."task_templates"("masterShiftTemplateId");

-- CreateIndex
CREATE INDEX "task_templates_subShiftTemplateId_idx" ON "public"."task_templates"("subShiftTemplateId");

-- CreateIndex
CREATE INDEX "master_shifts_masterShiftTemplateId_idx" ON "public"."master_shifts"("masterShiftTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "master_shifts_branchId_workDate_title_key" ON "public"."master_shifts"("branchId", "workDate", "title");

-- CreateIndex
CREATE INDEX "sub_shifts_masterShiftId_idx" ON "public"."sub_shifts"("masterShiftId");

-- CreateIndex
CREATE INDEX "sub_shifts_subShiftTemplateId_idx" ON "public"."sub_shifts"("subShiftTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_availabilityId_key" ON "public"."assignments"("availabilityId");

-- CreateIndex
CREATE INDEX "assignments_subShiftId_idx" ON "public"."assignments"("subShiftId");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_employeeId_subShiftId_key" ON "public"."assignments"("employeeId", "subShiftId");

-- CreateIndex
CREATE INDEX "tasks_taskTemplateId_idx" ON "public"."tasks"("taskTemplateId");

-- CreateIndex
CREATE INDEX "tasks_masterShiftId_idx" ON "public"."tasks"("masterShiftId");

-- CreateIndex
CREATE INDEX "tasks_subShiftId_idx" ON "public"."tasks"("subShiftId");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_taskId_key" ON "public"."task_completions"("taskId");

-- CreateIndex
CREATE INDEX "task_completions_completedByEmployeeId_idx" ON "public"."task_completions"("completedByEmployeeId");

-- CreateIndex
CREATE INDEX "availabilities_subShiftId_idx" ON "public"."availabilities"("subShiftId");

-- CreateIndex
CREATE UNIQUE INDEX "availabilities_employeeId_subShiftId_key" ON "public"."availabilities"("employeeId", "subShiftId");

-- CreateIndex
CREATE INDEX "attendance_histories_assignmentId_idx" ON "public"."attendance_histories"("assignmentId");

-- CreateIndex
CREATE INDEX "leave_requests_assignmentId_idx" ON "public"."leave_requests"("assignmentId");

-- CreateIndex
CREATE INDEX "time_logs_assignmentId_idx" ON "public"."time_logs"("assignmentId");

-- AddForeignKey
ALTER TABLE "public"."availabilities" ADD CONSTRAINT "availabilities_subShiftId_fkey" FOREIGN KEY ("subShiftId") REFERENCES "public"."sub_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_schedule_configs" ADD CONSTRAINT "branch_schedule_configs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."master_shift_templates" ADD CONSTRAINT "master_shift_templates_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sub_shift_templates" ADD CONSTRAINT "sub_shift_templates_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sub_shift_templates" ADD CONSTRAINT "sub_shift_templates_masterShiftTemplateId_fkey" FOREIGN KEY ("masterShiftTemplateId") REFERENCES "public"."master_shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_templates" ADD CONSTRAINT "task_templates_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_templates" ADD CONSTRAINT "task_templates_masterShiftTemplateId_fkey" FOREIGN KEY ("masterShiftTemplateId") REFERENCES "public"."master_shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_templates" ADD CONSTRAINT "task_templates_subShiftTemplateId_fkey" FOREIGN KEY ("subShiftTemplateId") REFERENCES "public"."sub_shift_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."master_shifts" ADD CONSTRAINT "master_shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."master_shifts" ADD CONSTRAINT "master_shifts_masterShiftTemplateId_fkey" FOREIGN KEY ("masterShiftTemplateId") REFERENCES "public"."master_shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sub_shifts" ADD CONSTRAINT "sub_shifts_masterShiftId_fkey" FOREIGN KEY ("masterShiftId") REFERENCES "public"."master_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sub_shifts" ADD CONSTRAINT "sub_shifts_subShiftTemplateId_fkey" FOREIGN KEY ("subShiftTemplateId") REFERENCES "public"."sub_shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_subShiftId_fkey" FOREIGN KEY ("subShiftId") REFERENCES "public"."sub_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assignments" ADD CONSTRAINT "assignments_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "public"."availabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "public"."task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_masterShiftId_fkey" FOREIGN KEY ("masterShiftId") REFERENCES "public"."master_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_subShiftId_fkey" FOREIGN KEY ("subShiftId") REFERENCES "public"."sub_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_completions" ADD CONSTRAINT "task_completions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_completions" ADD CONSTRAINT "task_completions_completedByEmployeeId_fkey" FOREIGN KEY ("completedByEmployeeId") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_histories" ADD CONSTRAINT "attendance_histories_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leave_requests" ADD CONSTRAINT "leave_requests_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."time_logs" ADD CONSTRAINT "time_logs_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

