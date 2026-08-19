import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './role.controller';
import { RolesService } from './role.service';
import { PrismaService } from '@modules/prisma/prisma.service';

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [RolesService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = module.get<RolesController>(RolesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
