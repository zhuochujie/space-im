import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OpenImResponse, OpenImTokenData } from './openim.types';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class OpenImService {
  private adminToken?: CachedToken;

  async registerUser(userID: string, nickname = ''): Promise<void> {
    const token = await this.getAdminToken();
    await this.request(
      '/user/user_register',
      {
        users: [{ userID, nickname, faceURL: '' }],
      },
      token,
    );
  }

  async getUserToken(
    userID: string,
    platformID: number,
  ): Promise<OpenImTokenData> {
    const token = await this.getAdminToken();

    return this.request<OpenImTokenData>(
      '/auth/get_user_token',
      { userID, platformID },
      token,
    );
  }

  private async getAdminToken(): Promise<string> {
    if (this.adminToken && this.adminToken.expiresAt > Date.now() + 60_000) {
      return this.adminToken.token;
    }

    const secret = process.env.OPENIM_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('缺少 OPENIM_SECRET 配置');
    }

    const userID = process.env.OPENIM_ADMIN_USER_ID ?? 'imAdmin';
    const data = await this.request<OpenImTokenData>('/auth/get_admin_token', {
      secret,
      userID,
    });
    this.adminToken = {
      token: data.token,
      expiresAt: Date.now() + data.expireTimeSeconds * 1000,
    };
    return data.token;
  }

  private async request<T>(
    path: string,
    body: unknown,
    token?: string,
  ): Promise<T> {
    const baseUrl = process.env.OPENIM_API_URL?.replace(/\/+$/, '');
    if (!baseUrl) {
      throw new ServiceUnavailableException('缺少 OPENIM_API_URL 配置');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          operationID: randomUUID(),
          ...(token ? { token } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new BadGatewayException('无法连接 OpenIM 服务', {
        cause: error,
      });
    }

    let result: OpenImResponse<T>;
    try {
      result = (await response.json()) as OpenImResponse<T>;
    } catch (error) {
      throw new BadGatewayException('OpenIM 返回了无效响应', {
        cause: error,
      });
    }

    if (!response.ok || result.errCode !== 0) {
      const detail = [result.errMsg, result.errDlt]
        .filter((part): part is string => Boolean(part))
        .join(' | ');
      throw new BadGatewayException(
        `OpenIM 请求失败 (${path}, errCode=${result.errCode ?? response.status}): ${detail || response.statusText}`,
      );
    }
    if (
      result.data === undefined &&
      path !== '/user/user_register'
    ) {
      throw new BadGatewayException('OpenIM 响应缺少 data');
    }

    return result.data as T;
  }
}
