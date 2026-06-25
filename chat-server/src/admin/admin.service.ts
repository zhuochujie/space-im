import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  ListAdminUsersDto,
  SearchMessagesDto,
  SetUserStatusDto,
} from './dto/admin.dto';
import { OpenImService } from '../openim/openim.service';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly openImService: OpenImService,
  ) {}

  async listUsers(query: ListAdminUsersDto) {
    const count = query.count ?? 50;
    const offset = query.offset ?? 0;
    const result = await this.usersRepository.list({
      search: query.search,
      status: query.status,
      offset,
      count,
    });
    return { ...result, offset, count };
  }

  async resetUserPassword(userID: string, newPassword: string) {
    const passwordHash = await argon2.hash(newPassword);
    await this.usersRepository.updatePasswordHash(userID, passwordHash);
    return this.usersRepository.findByUserID(userID);
  }

  setUserLoginStatus(userID: string, body: SetUserStatusDto) {
    return this.usersRepository.setStatus(userID, body.status);
  }

  searchMessages(query: SearchMessagesDto) {
    const page = query.page ?? 1;
    const count = query.count ?? 50;
    const body = removeEmptyValues({
      sendID: query.sendID,
      recvID: query.recvID,
      groupID: query.groupID,
      keyword: query.keyword,
      startTime: query.startTime,
      endTime: query.endTime,
      startSendTime: query.startTime,
      endSendTime: query.endTime,
      page,
      count,
      pageNumber: page,
      showNumber: count,
      pagination: {
        pageNumber: page,
        showNumber: count,
      },
    });
    return this.openImService.searchMessages(body);
  }
}

function removeEmptyValues(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      return typeof value !== 'string' || value.length > 0;
    }),
  );
}
