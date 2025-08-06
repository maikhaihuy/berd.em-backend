import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async findOne(id: number): Promise<User> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByUsername(username: string): Promise<User> {
    return await this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findOneWithRelations(id: number): Promise<User> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            branches: true,
          },
        },
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });
  }

  async updateRoles(userId: number, roleIds: number[]) {
    const user = await this.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove existing roles
    // await this.prisma.userRole.deleteMany({
    //   where: { userId },
    // });

    // // Add new roles
    // if (roleIds.length > 0) {
    //   await this.prisma.userRole.createMany({
    //     data: roleIds.map((roleId) => ({
    //       userId,
    //       roleId,
    //     })),
    //   });
    // }

    return this.findOneWithRelations(userId);
  }

  async assignDefaultRole(userId: number) {
    // Find the default employee role
    const employeeRole = await this.prisma.role.findFirst({
      where: { name: 'employee' },
    });

    // if (employeeRole) {
    //   await this.prisma.userRole.create({
    //     data: {
    //       userId,
    //       roleId: employeeRole.id,
    //     },
    //   });
    // }
  }
}
