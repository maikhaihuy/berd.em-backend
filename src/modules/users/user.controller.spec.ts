import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './user.controller';
import { UsersService } from './user.service';
import { AbilitiesService } from '@modules/abilities/abilities.service';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { reissueInitialPassword: jest.Mock };

  const authUser = new AuthenticatedUserDto({
    userId: 99,
    phone: '0900000001',
    roles: ['Admin'],
    branches: [],
    managedBranches: [],
    permissions: [],
  });

  beforeEach(async () => {
    usersService = { reissueInitialPassword: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: AbilitiesService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('reissueInitialPassword', () => {
    it('delegates to UsersService with the target id and the caller as actor', async () => {
      const expected = { password: 'RANDOM42', expiresAt: new Date() };
      usersService.reissueInitialPassword.mockResolvedValue(expected);

      const result = await controller.reissueInitialPassword(5, authUser);

      expect(usersService.reissueInitialPassword).toHaveBeenCalledWith(
        5,
        authUser.userId,
      );
      expect(result).toBe(expected);
    });
  });
});
