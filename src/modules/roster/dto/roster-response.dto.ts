import { Roster, RosterStatus } from '@prisma/client';

export class RosterResponseDto {
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

  // Related data
  schedule?: {
    id: number;
    name: string;
    abbreviation: string;
    workDate: Date;
    startTime: Date;
    endTime: Date;
    status: string;
    shift: {
      id: number;
      name: string;
      abbreviation: string;
    };
    branch: {
      id: number;
      name: string;
      abbreviation: string;
    };
  };

  employee?: {
    id: number;
    fullName: string;
    phoneNumber: string;
    email: string | null;
  };

  constructor(partial: Partial<Roster>) {
    Object.assign(this, partial);
  }
}
