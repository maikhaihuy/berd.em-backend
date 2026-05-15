import { Prisma } from '@prisma/client';

export const employeeHourlyRateWithEmployeeInclude = {
  employee: true,
} satisfies Prisma.EmployeeHourlyRateInclude;

export type EmployeeHourlyRateWithEmployee =
  Prisma.EmployeeHourlyRateGetPayload<{
    include: typeof employeeHourlyRateWithEmployeeInclude;
  }>;
