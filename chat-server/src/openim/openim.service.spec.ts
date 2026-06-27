import { OpenImService } from './openim.service';

describe('OpenImService', () => {
  const originalApiUrl = process.env.OPENIM_API_URL;
  const originalSecret = process.env.OPENIM_SECRET;

  afterEach(() => {
    process.env.OPENIM_API_URL = originalApiUrl;
    process.env.OPENIM_SECRET = originalSecret;
    jest.restoreAllMocks();
  });

  it('includes the required pagination when checking for a user', async () => {
    process.env.OPENIM_API_URL = 'http://openim-server:10002';
    process.env.OPENIM_SECRET = 'secret';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          errCode: 0,
          errMsg: '',
          data: { token: 'admin-token', expireTimeSeconds: 3600 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          errCode: 0,
          errMsg: '',
          data: { users: [{ userID: '1234567890' }] },
        }),
      );
    const service = new OpenImService();

    await expect(
      service.ensureUser('1234567890', '18888888888'),
    ).resolves.toBe(false);

    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      userIDs: ['1234567890'],
      pagination: { pageNumber: 1, showNumber: 1 },
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
