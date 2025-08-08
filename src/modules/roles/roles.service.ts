import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto, currentUserId: number) {
    const existing = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });

    if (existing) {
      throw new ConflictException(
        `Role '${createRoleDto.name}' already exists.`,
      );
    }

    return this.prisma.role.create({
      data: {
        ...createRoleDto,
        createdBy: currentUserId,
        updatedBy: currentUserId,
      },
    });
  }

  findAll() {
    return `This action returns all roles`;
  }

  findOne(id: number) {
    return `This action returns a #${id} role`;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return this.prisma.role.update({
      where: { id },
      data: updateRoleDto,
    });
  }

  remove(id: number) {
    return `This action removes a #${id} role`;
  }
}
