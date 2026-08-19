import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus, TaskType } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { userWithEmployeeInclude } from '@modules/users/user.types';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import {
  TaskCompletionResponseDto,
  TaskResponseDto,
} from './dto/task-response.dto';
import { TaskMapper } from './task.mapper';
import { taskCompletionInclude, taskInclude } from './task.types';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateTaskDto,
    currentUserId: number,
  ): Promise<TaskResponseDto> {
    await this.validateScope(dto);
    const task = await this.prisma.task.create({
      data: {
        taskTemplateId: dto.taskTemplateId,
        masterShiftId: dto.masterShiftId,
        subShiftId: dto.subShiftId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        status: dto.status ?? TaskStatus.PENDING,
        sortOrder: dto.sortOrder ?? 0,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        note: dto.note,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
      include: taskInclude,
    });
    return TaskMapper.toDto(task);
  }

  async findAll(
    masterShiftId?: number,
    subShiftId?: number,
  ): Promise<TaskResponseDto[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        ...(masterShiftId ? { masterShiftId } : {}),
        ...(subShiftId ? { subShiftId } : {}),
      },
      include: taskInclude,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return TaskMapper.toDtos(tasks);
  }

  async findOne(id: number): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException('Task not found');
    return TaskMapper.toDto(task);
  }

  async update(
    id: number,
    dto: UpdateTaskDto,
    currentUserId: number,
  ): Promise<TaskResponseDto> {
    const existing = await this.findOne(id);
    await this.validateScope({
      taskTemplateId:
        dto.taskTemplateId ?? existing.taskTemplateId ?? undefined,
      masterShiftId: dto.masterShiftId ?? existing.masterShiftId ?? undefined,
      subShiftId: dto.subShiftId ?? existing.subShiftId ?? undefined,
      title: dto.title ?? existing.title,
      type: dto.type ?? existing.type,
    });

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        updatedBy: currentUserId,
      },
      include: taskInclude,
    });
    return TaskMapper.toDto(task);
  }

  async complete(
    id: number,
    dto: CompleteTaskDto,
    currentUserId: number,
  ): Promise<TaskCompletionResponseDto> {
    const task = await this.findOne(id);
    const employeeId =
      dto.completedByEmployeeId ??
      (await this.getEmployeeIdForUser(currentUserId));

    await this.ensureEmployeeCanCompleteTask(task, employeeId);

    return this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: { status: TaskStatus.COMPLETED, updatedBy: currentUserId },
      });
      const completion = await tx.taskCompletion.upsert({
        where: { taskId: id },
        create: {
          taskId: id,
          completedByEmployeeId: employeeId,
          evidence: dto.evidence as Prisma.InputJsonValue,
          note: dto.note,
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        update: {
          completedByEmployeeId: employeeId,
          completedAt: new Date(),
          evidence: dto.evidence as Prisma.InputJsonValue,
          note: dto.note,
          updatedBy: currentUserId,
        },
        include: taskCompletionInclude,
      });
      return TaskMapper.toCompletionDto(completion);
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
    return { message: 'Task deleted successfully' };
  }

  private async validateScope(dto: {
    masterShiftId?: number;
    subShiftId?: number;
    type: TaskType;
    title: string;
    taskTemplateId?: number;
  }) {
    if (dto.type === TaskType.DEDICATED) {
      if (!dto.subShiftId || dto.masterShiftId) {
        throw new BadRequestException(
          'Dedicated tasks must target one sub shift only',
        );
      }
      const subShift = await this.prisma.subShift.findUnique({
        where: { id: dto.subShiftId },
      });
      if (!subShift) throw new NotFoundException('Sub shift not found');
      return;
    }

    if (!dto.masterShiftId || dto.subShiftId) {
      throw new BadRequestException(
        'Shared tasks must target one master shift only',
      );
    }
    const masterShift = await this.prisma.masterShift.findUnique({
      where: { id: dto.masterShiftId },
    });
    if (!masterShift) throw new NotFoundException('Master shift not found');
  }

  private async getEmployeeIdForUser(currentUserId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: userWithEmployeeInclude,
    });
    if (!user?.employee) {
      throw new ForbiddenException('User must be associated with an employee');
    }
    return user.employee.id;
  }

  private async ensureEmployeeCanCompleteTask(
    task: Awaited<ReturnType<TasksService['findOne']>>,
    employeeId: number,
  ) {
    if (
      task.type === TaskType.SHARED_MANDATORY ||
      task.type === TaskType.SHARED_OPTIONAL
    ) {
      const masterShiftId = task.masterShiftId;
      const assignment = await this.prisma.assignment.findFirst({
        where: {
          employeeId,
          subShift: { masterShiftId: masterShiftId ?? -1 },
        },
      });
      if (!assignment) {
        throw new ForbiddenException(
          'Employee must be assigned under this master shift to complete shared tasks',
        );
      }
      return;
    }

    const assignment = await this.prisma.assignment.findFirst({
      where: { employeeId, subShiftId: task.subShiftId ?? -1 },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Employee must be assigned to this sub shift to complete dedicated tasks',
      );
    }
  }
}
