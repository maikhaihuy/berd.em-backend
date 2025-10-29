import { ScheduleStatus } from '@prisma/client';

export class Schedule {
  id: number;
  shiftId: number;
  branchId: number;
  name: string;
  abbreviation: string;
  maxSlots: number;
  workDate: Date;
  startTime: Date;
  endTime: Date;
  status: ScheduleStatus;
  note: string | null;
  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
  updatedBy: number;
}
