import { Prisma } from '@prisma/client';

// Include pattern for attendance history with assignment, employee and branch
// details. Always loading related data avoids N+1 queries.
export const attendanceHistoryInclude = {
  assignment: {
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
        },
      },
      subShift: {
        include: {
          masterShift: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.AttendanceHistoryInclude;

export type AttendanceHistoryWithRelations =
  Prisma.AttendanceHistoryGetPayload<{
    include: typeof attendanceHistoryInclude;
  }>;
