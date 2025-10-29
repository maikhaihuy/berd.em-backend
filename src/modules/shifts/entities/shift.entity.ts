import { ShiftStatus } from '@prisma/client';

export class Shift {
  id: number;
  branchId: number;
  name: string;
  abbreviation: string;
  maxSlots: number;
  startTime: Date;
  endTime: Date;
  multiplier: number;
  status: ShiftStatus;
  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
  updatedBy: number;
}
