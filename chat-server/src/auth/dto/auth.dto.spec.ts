import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.dto';

describe('RegisterDto', () => {
  it('requires a nickname', async () => {
    const request = plainToInstance(RegisterDto, {
      phoneNumber: '13800138000',
      password: 'password123',
    });

    const errors = await validate(request);

    expect(errors.some((error) => error.property === 'nickname')).toBe(true);
  });
});
