import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface AdminSessionPayload {
  exp: number;
  phoneNumber: string;
  sub: string;
}

@Injectable()
export class AdminSessionService {
  sign(payload: Omit<AdminSessionPayload, 'exp'>): string {
    const exp = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
    const signature = this.signBody(body);
    return `${body}.${signature}`;
  }

  verify(token: string): AdminSessionPayload {
    const [body, signature] = token.split('.');
    if (!body || !signature || !this.isValidSignature(body, signature)) {
      throw new UnauthorizedException('后台登录已失效');
    }

    let payload: AdminSessionPayload;
    try {
      payload = JSON.parse(base64UrlDecode(body)) as AdminSessionPayload;
    } catch {
      throw new UnauthorizedException('后台登录已失效');
    }

    if (
      !payload.sub ||
      !payload.phoneNumber ||
      payload.exp < Date.now() / 1000
    ) {
      throw new UnauthorizedException('后台登录已失效');
    }
    return payload;
  }

  private get secret(): string {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('缺少 ADMIN_SESSION_SECRET 配置');
    }
    return secret;
  }

  private get ttlSeconds(): number {
    const configured = Number(process.env.ADMIN_SESSION_TTL_SECONDS);
    return Number.isFinite(configured) && configured > 0 ? configured : 86_400;
  }

  private signBody(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  private isValidSignature(body: string, signature: string): boolean {
    const expected = Buffer.from(this.signBody(body));
    const actual = Buffer.from(signature);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}
