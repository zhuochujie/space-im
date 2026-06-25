import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OpenImService } from '../openim/openim.service';
import { User } from '../users/user.entity';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: Map<string, User>;
  let repository: jest.Mocked<
    Pick<
      UsersRepository,
      | 'findByPhoneNumber'
      | 'reserve'
      | 'activate'
      | 'deletePending'
      | 'updatePasswordHash'
    >
  >;
  let openIm: jest.Mocked<Pick<OpenImService, 'registerUser' | 'getUserToken'>>;

  beforeEach(() => {
    users = new Map();
    repository = {
      findByPhoneNumber: jest.fn((phoneNumber: string) =>
        Promise.resolve(
          users.get(phoneNumber)?.status === 'active'
            ? users.get(phoneNumber)
            : null,
        ),
      ),
      reserve: jest.fn((user) => {
        if (users.has(user.phoneNumber)) {
          return Promise.reject(new ConflictException('手机号已注册'));
        }
        users.set(user.phoneNumber, { ...user, status: 'pending' });
        return Promise.resolve();
      }),
      activate: jest.fn((userID: string) => {
        const user = [...users.values()].find(
          (candidate) => candidate.userID === userID,
        );
        if (user) {
          user.status = 'active';
        }
        return Promise.resolve();
      }),
      deletePending: jest.fn((userID: string) => {
        const user = [...users.values()].find(
          (candidate) => candidate.userID === userID,
        );
        if (user?.status === 'pending') {
          users.delete(user.phoneNumber);
        }
        return Promise.resolve();
      }),
      updatePasswordHash: jest.fn((userID: string, passwordHash: string) => {
        const user = [...users.values()].find(
          (candidate) => candidate.userID === userID,
        );
        if (user) {
          user.passwordHash = passwordHash;
        }
        return Promise.resolve();
      }),
    };
    openIm = {
      registerUser: jest.fn().mockResolvedValue(undefined),
      getUserToken: jest.fn().mockResolvedValue({
        token: 'user-token',
        expireTimeSeconds: 3600,
      }),
    };
    service = new AuthService(
      repository as unknown as UsersRepository,
      openIm as unknown as OpenImService,
    );
  });

  it('registers the user in OpenIM and stores a password hash', async () => {
    const result = await service.register({
      phoneNumber: '13800138000',
      password: 'password123',
    });

    expect(result.phoneNumber).toBe('13800138000');
    expect(result.userID).toMatch(/^\d{10}$/);
    expect(openIm.registerUser).toHaveBeenCalledWith(
      result.userID,
      '13800138000',
    );
    const storedUser = repository.reserve.mock.calls[0][0];
    expect(storedUser.userID).toBe(result.userID);
    expect(storedUser.phoneNumber).toBe('13800138000');
    expect(storedUser.passwordHash).toMatch(/^\$argon2id\$/);
    expect(repository.activate).toHaveBeenCalledWith(result.userID);
  });

  it('keeps compatibility with nickname on registration', async () => {
    const result = await service.register({
      phoneNumber: '13800138000',
      nickname: '艾丽丝',
      password: 'password123',
    });

    expect(openIm.registerUser).toHaveBeenCalledWith(result.userID, '艾丽丝');
  });

  it('rejects duplicate phoneNumbers', async () => {
    users.set('13800138000', {
      userID: 'existing-id',
      phoneNumber: '13800138000',
      passwordHash: '$argon2id$invalid',
      status: 'active',
    });

    await expect(
      service.register({
        phoneNumber: '13800138000',
        nickname: '艾丽丝',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(openIm.registerUser).not.toHaveBeenCalled();
  });

  it('removes the pending user when OpenIM registration fails', async () => {
    openIm.registerUser.mockRejectedValueOnce(new Error('OpenIM unavailable'));

    await expect(
      service.register({
        phoneNumber: '13800138000',
        nickname: '艾丽丝',
        password: 'password123',
      }),
    ).rejects.toThrow('OpenIM unavailable');

    expect(repository.deletePending).toHaveBeenCalled();
    expect(users.has('13800138000')).toBe(false);
  });

  it('returns an OpenIM token after password verification', async () => {
    await service.register({
      phoneNumber: '13800138000',
      nickname: '艾丽丝',
      password: 'password123',
    });

    await expect(
      service.login({
        phoneNumber: '13800138000',
        password: 'password123',
        platformID: 5,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        phoneNumber: '13800138000',
        token: 'user-token',
        expireTimeSeconds: 3600,
      }),
    );
    expect(openIm.getUserToken).toHaveBeenCalledWith(expect.any(String), 5);
  });

  it('rejects an incorrect password', async () => {
    await service.register({
      phoneNumber: '13800138000',
      nickname: '艾丽丝',
      password: 'password123',
    });

    await expect(
      service.login({
        phoneNumber: '13800138000',
        password: 'incorrect-password',
        platformID: 5,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('changes the password after verifying the old password', async () => {
    await service.register({
      phoneNumber: '13800138000',
      nickname: '艾丽丝',
      password: 'password123',
    });

    const changedUser = await service.changePassword({
      phoneNumber: '13800138000',
      oldPassword: 'password123',
      newPassword: 'new-password123',
    });
    expect(typeof changedUser.userID).toBe('string');
    expect(changedUser.phoneNumber).toBe('13800138000');
    expect(repository.updatePasswordHash).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/^\$argon2id\$/),
    );
    await expect(
      service.login({
        phoneNumber: '13800138000',
        password: 'new-password123',
        platformID: 5,
      }),
    ).resolves.toEqual(expect.objectContaining({ phoneNumber: '13800138000' }));
  });

  it('rejects password changes when the old password is incorrect', async () => {
    await service.register({
      phoneNumber: '13800138000',
      nickname: '艾丽丝',
      password: 'password123',
    });

    await expect(
      service.changePassword({
        phoneNumber: '13800138000',
        oldPassword: 'incorrect-password',
        newPassword: 'new-password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('finds a userID by exact phoneNumber', async () => {
    users.set('13800138000', {
      userID: '1234567890',
      phoneNumber: '13800138000',
      passwordHash: '$argon2id$invalid',
      status: 'active',
    });

    await expect(
      service.findUserIDByPhoneNumber('13800138000'),
    ).resolves.toEqual({
      userID: '1234567890',
      phoneNumber: '13800138000',
    });
  });

  it('rejects missing users when searching by phoneNumber', async () => {
    await expect(
      service.findUserIDByPhoneNumber('13800138000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
