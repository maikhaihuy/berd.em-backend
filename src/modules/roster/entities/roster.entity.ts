import { RosterStatus } from '@prisma/client';

export class Roster {
  id: number;
  scheduleId: number;
  employeeId: number;
  assignedAt: Date;
  actualStartTime: Date | null;
  actualEndTime: Date | null;
  status: RosterStatus;
  note: string | null;
  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
  updatedBy: number;
}
