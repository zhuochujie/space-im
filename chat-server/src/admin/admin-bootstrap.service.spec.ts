import { OpenImService } from '../openim/openim.service';
import { UsersRepository } from '../users/users.repository';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  const originalPhoneNumber = process.env.SPACE_ADMIN_PHONE_NUMBER;
  const originalPassword = process.env.SPACE_ADMIN_PASSWORD;

  afterEach(() => {
    process.env.SPACE_ADMIN_PHONE_NUMBER = originalPhoneNumber;
    process.env.SPACE_ADMIN_PASSWORD = originalPassword;
  });

  it('ensures the bootstrap admin also exists in OpenIM', async () => {
    process.env.SPACE_ADMIN_PHONE_NUMBER = '18888888888';
    process.env.SPACE_ADMIN_PASSWORD = 'password123';
    const usersRepository = {
      upsertBootstrapAdmin: jest.fn().mockResolvedValue({
        userID: '1234567890',
        phoneNumber: '18888888888',
        isAdmin: true,
        status: 'active',
      }),
    };
    const openImService = {
      ensureUser: jest.fn().mockResolvedValue(true),
    };
    const service = new AdminBootstrapService(
      usersRepository as unknown as UsersRepository,
      openImService as unknown as OpenImService,
    );

    await service.onModuleInit();

    expect(usersRepository.upsertBootstrapAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '18888888888',
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
      }),
    );
    expect(openImService.ensureUser).toHaveBeenCalledWith(
      '1234567890',
      '18888888888',
    );
  });
});
