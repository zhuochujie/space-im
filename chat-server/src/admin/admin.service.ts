import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  GetGroupMembersDto,
  ListAdminGroupsDto,
  ListAdminUsersDto,
  SearchGroupMessagesDto,
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
      contentType: query.contentType,
      sessionType: query.sessionType ?? 1,
      pagination: {
        pageNumber: page,
        showNumber: count,
      },
    });
    return this.openImService.searchMessages(body);
  }

  async listGroups(query: ListAdminGroupsDto) {
    const page = query.page ?? 1;
    const count = query.count ?? 50;
    if (!query.userID) {
      return { groups: [], total: 0, page, count };
    }
    const result = await this.openImService.getJoinedGroupList({
      fromUserID: query.userID,
      pagination: {
        pageNumber: page,
        showNumber: count,
      },
    });
    return {
      groups: result.groups ?? [],
      total: result.total ?? null,
      page,
      count,
    };
  }

  async getGroup(groupID: string) {
    const result = await this.openImService.getGroupsInfo([groupID]);
    return {
      group: result.groupInfos?.[0] ?? null,
    };
  }

  async getGroupMembers(groupID: string, query: GetGroupMembersDto) {
    const page = query.page ?? 1;
    const count = query.count ?? 50;
    const body = removeEmptyValues({
      groupID,
      keyword: query.keyword,
      filter: query.filter ?? 0,
      pagination: {
        pageNumber: page,
        showNumber: count,
      },
    }) as {
      groupID: string;
      keyword?: string;
      filter?: number;
      pagination: { pageNumber: number; showNumber: number };
    };
    const result = await this.openImService.getGroupMemberList(body);
    return {
      members: result.members ?? [],
      total: result.total ?? null,
      page,
      count,
    };
  }

  searchGroupMessages(groupID: string, query: SearchGroupMessagesDto) {
    const page = query.page ?? 1;
    const count = query.count ?? 50;
    const body = removeEmptyValues({
      groupID,
      sendID: query.sendID,
      contentType: query.contentType,
      sessionType: 3,
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
