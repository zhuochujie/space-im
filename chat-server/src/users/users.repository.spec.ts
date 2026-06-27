import { Model } from 'mongoose';
import { UserDocument } from './user.entity';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  it('does not overwrite the password of an existing bootstrap admin', async () => {
    const exec = jest.fn().mockResolvedValue({
      userID: '1234567890',
      phoneNumber: '18888888888',
      isAdmin: true,
      status: 'active',
    });
    const model = {
      updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({ exec }),
        }),
      }),
    };
    const repository = new UsersRepository(
      model as unknown as Model<UserDocument>,
    );

    await repository.upsertBootstrapAdmin({
      userID: '9999999999',
      phoneNumber: '18888888888',
      passwordHash: 'new-default-password-hash',
    });

    expect(model.updateOne).toHaveBeenCalledWith(
      { phoneNumber: '18888888888' },
      {
        $set: { status: 'active', isAdmin: true },
        $setOnInsert: {
          userID: '9999999999',
          phoneNumber: '18888888888',
          passwordHash: 'new-default-password-hash',
        },
      },
      { upsert: true },
    );
  });
});
