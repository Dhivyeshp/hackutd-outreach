import { google, type gmail_v1 } from 'googleapis';
import { decryptSecret } from './crypto';
import { QUOTA_COST } from './limits';
import { backoffMs, classifyGmailError, type GmailErrorKind } from './safety';

export class GmailError extends Error {
  constructor(
    public kind: GmailErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Per-user Gmail client. Tracks estimated quota units; retries rate limits with jittered backoff. */
export class GmailClient {
  units = 0;

  private constructor(private readonly api: gmail_v1.Gmail) {}

  static forRefreshToken(encryptedRefreshToken: string): GmailClient {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: decryptSecret(encryptedRefreshToken) });
    return new GmailClient(google.gmail({ version: 'v1', auth }));
  }

  private async call<T>(cost: number, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      this.units += cost;
      try {
        return await fn();
      } catch (err) {
        const e = err as { message?: string };
        const kind = classifyGmailError(err as Parameters<typeof classifyGmailError>[0]);
        if (kind === 'rate_limit' && attempt < MAX_ATTEMPTS - 1) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new GmailError(kind, e.message ?? 'Gmail request failed');
      }
    }
  }

  async send(raw: string): Promise<{ id: string; threadId: string }> {
    const res = await this.call(QUOTA_COST.send, () => this.api.users.messages.send({ userId: 'me', requestBody: { raw } }));
    if (!res.data.id || !res.data.threadId) throw new GmailError('other', 'Gmail send returned no ids');
    return { id: res.data.id, threadId: res.data.threadId };
  }

  async listMessages(q: string, maxResults: number, pageToken?: string) {
    const res = await this.call(QUOTA_COST.messagesList, () =>
      this.api.users.messages.list({ userId: 'me', q, maxResults, pageToken }),
    );
    return { messages: res.data.messages ?? [], nextPageToken: res.data.nextPageToken ?? undefined };
  }

  async getMessage(id: string) {
    const res = await this.call(QUOTA_COST.messagesGet, () => this.api.users.messages.get({ userId: 'me', id, format: 'full' }));
    return res.data;
  }
}
