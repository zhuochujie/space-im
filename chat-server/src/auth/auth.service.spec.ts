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
      | 'findByUsername'
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
      findByUsername: jest.fn((username: string) =>
        Promise.resolve(
          users.get(username)?.status === 'active' ? users.get(username) : null,
        ),
      ),
      reserve: jest.fn((user) => {
        if (users.has(user.username)) {
          return Promise.reject(new ConflictException('用户名已存在'));
        }
        users.set(user.username, { ...user, status: 'pending' });
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
          users.delete(user.username);
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
      username: 'alice',
      password: 'password123',
    });

    expect(result.username).toBe('alice');
    expect(result.userID).toMatch(/^\d{10}$/);
    expect(openIm.registerUser).toHaveBeenCalledWith(result.userID, 'alice');
    const storedUser = repository.reserve.mock.calls[0][0];
    expect(storedUser.userID).toBe(result.userID);
    expect(storedUser.username).toBe('alice');
    expect(storedUser.passwordHash).toMatch(/^\$argon2id\$/);
    expect(repository.activate).toHaveBeenCalledWith(result.userID);
  });

  it('keeps compatibility with nickname on registration', async () => {
    const result = await service.register({
      username: 'alice',
      nickname: '艾丽丝',
      password: 'password123',
    });

    expect(openIm.registerUser).toHaveBeenCalledWith(result.userID, '艾丽丝');
  });

  it('rejects duplicate usernames', async () => {
    users.set('alice', {
      userID: 'existing-id',
      username: 'alice',
      passwordHash: '$argon2id$invalid',
      status: 'active',
    });

    await expect(
      service.register({
        username: 'alice',
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
        username: 'alice',
        nickname: '艾丽丝',
        password: 'password123',
      }),
    ).rejects.toThrow('OpenIM unavailable');

    expect(repository.deletePending).toHaveBeenCalled();
    expect(users.has('alice')).toBe(false);
  });

  it('returns an OpenIM token after password verification', async () => {
    await service.register({
      username: 'alice',
      nickname: '艾丽丝',
      password: 'password123',
    });

    await expect(
      service.login({
        username: 'alice',
        password: 'password123',
        platformID: 5,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        username: 'alice',
        token: 'user-token',
        expireTimeSeconds: 3600,
      }),
    );
    expect(openIm.getUserToken).toHaveBeenCalledWith(expect.any(String), 5);
  });

  it('rejects an incorrect password', async () => {
    await service.register({
      username: 'alice',
      nickname: '艾丽丝',
      password: 'password123',
    });

    await expect(
      service.login({
        username: 'alice',
        password: 'incorrect-password',
        platformID: 5,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('changes the password after verifying the old password', async () => {
    await service.register({
      username: 'alice',
      nickname: '艾丽丝',
      password: 'password123',
    });

    await expect(
      service.changePassword({
        username: 'alice',
        oldPassword: 'password123',
        newPassword: 'new-password123',
      }),
    ).resolves.toEqual({
      userID: expect.any(String),
      username: 'alice',
    });
    expect(repository.updatePasswordHash).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/^\$argon2id\$/),
    );
    await expect(
      service.login({
        username: 'alice',
        password: 'new-password123',
        platformID: 5,
      }),
    ).resolves.toEqual(expect.objectContaining({ username: 'alice' }));
  });

  it('rejects password changes when the old password is incorrect', async () => {
    await service.register({
      username: 'alice',
      nickname: '艾丽丝',
      password: 'password123',
    });

    await expect(
      service.changePassword({
        username: 'alice',
        oldPassword: 'incorrect-password',
        newPassword: 'new-password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('finds a userID by exact username', async () => {
    users.set('alice', {
      userID: '1234567890',
      username: 'alice',
      passwordHash: '$argon2id$invalid',
      status: 'active',
    });

    await expect(service.findUserIDByUsername('alice')).resolves.toEqual({
      userID: '1234567890',
      username: 'alice',
    });
  });

  it('rejects missing users when searching by username', async () => {
    await expect(service.findUserIDByUsername('alice')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
