import { ForbiddenException } from '@nestjs/common';
import { EmployeesController } from './employee.controller';
import { EmployeesService } from './employee.service';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';

describe('EmployeesController', () => {
  let controller: EmployeesController;
  let service: { update: jest.Mock };

  beforeEach(() => {
    service = { update: jest.fn() };
    controller = new EmployeesController(
      service as unknown as EmployeesService,
    );
  });

  describe('updateMe', () => {
    const baseUser: AuthenticatedUserDto = {
      userId: 1,
      phone: '0900000001',
      mustChangePassword: false,
      roles: ['Employee'],
      branches: [],
      managedBranches: [],
      permissions: [],
    };

    it('throws ForbiddenException when the caller has no linked employee', async () => {
      const user = { ...baseUser, employeeId: undefined };

      await expect(
        controller.updateMe({ phoneNumber: '0911111111' }, user),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it("delegates to EmployeesService.update with the caller's own employee id", async () => {
      const user = { ...baseUser, employeeId: 42 };
      service.update.mockResolvedValue({ id: 42, phoneNumber: '0911111111' });

      const dto = { phoneNumber: '0911111111' };
      const result = await controller.updateMe(dto, user);

      expect(service.update).toHaveBeenCalledWith(42, dto, 1);
      expect(result.id).toBe(42);
    });
  });
});
