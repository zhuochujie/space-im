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
    });
    return this.searchMessagesDesc(body, page, count);
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
      recvID: groupID,
      sendID: query.sendID,
      contentType: query.contentType,
      sessionType: 3,
    });
    return this.searchMessagesDesc(body, page, count);
  }

  private async searchMessagesDesc(
    baseBody: Record<string, unknown>,
    page: number,
    count: number,
  ) {
    const probe = await this.openImService.searchMessages({
      ...baseBody,
      pagination: {
        pageNumber: 1,
        showNumber: 1,
      },
    });
    const total = getChatLogsTotal(probe);
    if (total === null) {
      return this.openImService.searchMessages({
        ...baseBody,
        pagination: {
          pageNumber: page,
          showNumber: count,
        },
      });
    }
    if (total <= 0) {
      return withChatLogs(probe, []);
    }

    const descStart = (page - 1) * count;
    if (descStart >= total) {
      return withChatLogs(probe, []);
    }

    const descEnd = Math.min(descStart + count, total);
    const ascStart = total - descEnd;
    const ascEnd = total - descStart;
    const fetchSize = 100;
    const firstAscPage = Math.floor(ascStart / fetchSize) + 1;
    const lastAscPage = Math.floor((ascEnd - 1) / fetchSize) + 1;
    const rows: unknown[] = [];

    for (let ascPage = firstAscPage; ascPage <= lastAscPage; ascPage += 1) {
      const result = await this.openImService.searchMessages({
        ...baseBody,
        pagination: {
          pageNumber: ascPage,
          showNumber: fetchSize,
        },
      });
      const pageRows = getChatLogs(result);
      const pageAscStart = (ascPage - 1) * fetchSize;
      pageRows.forEach((row, index) => {
        const ascIndex = pageAscStart + index;
        if (ascIndex >= ascStart && ascIndex < ascEnd) {
          rows.push(row);
        }
      });
    }

    return withChatLogs(probe, rows.reverse());
  }
}

function getChatLogsTotal(value: unknown): number | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const total = (value as Record<string, unknown>).chatLogsNum;
  return typeof total === 'number' && Number.isFinite(total) ? total : null;
}

function getChatLogs(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const chatLogs = (value as Record<string, unknown>).chatLogs;
  return Array.isArray(chatLogs) ? chatLogs : [];
}

function withChatLogs(value: unknown, chatLogs: unknown[]) {
  if (!value || typeof value !== 'object') {
    return {
      chatLogs,
      chatLogsNum: chatLogs.length,
    };
  }
  return {
    ...(value as Record<string, unknown>),
    chatLogs,
  };
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
