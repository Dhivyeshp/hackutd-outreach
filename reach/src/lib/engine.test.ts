import type { Campaign, Contact, User } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  contact: { updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  user: { update: vi.fn(), updateMany: vi.fn() },
  sendLog: { create: vi.fn() },
  alert: { create: vi.fn() },
  setting: { upsert: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
}));
vi.mock('./db', () => ({ prisma: db }));
vi.mock('./gmail', () => {
  class GmailError extends Error {
    constructor(
      public kind: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { GmailError, GmailClient: class {} };
});

import { GmailError } from './gmail';
import { sendOne } from './engine';

const user = { id: 'u1', email: 'sam@hackutd.co', name: 'Sam' } as User;
const campaign = { subject: 'Hi {{first_name}}', body: 'Hello', mailingAddress: '1 Main St', allowNonValid: false } as Campaign;
const contact = { id: 'c1', email: 'jane@utd.edu', name: 'Jane Smith', verification: 'VALID' } as Contact;

const send = vi.fn();
const gmail = { send } as never;

beforeEach(() => {
  vi.clearAllMocks();
  db.contact.updateMany.mockResolvedValue({ count: 1 });
});

describe('sendOne', () => {
  it('does not send when another tick already claimed the contact (idempotency)', async () => {
    db.contact.updateMany.mockResolvedValue({ count: 0 });
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('skip');
    expect(send).not.toHaveBeenCalled();
  });

  it('claims QUEUED -> SENDING atomically, then records SENT + log', async () => {
    send.mockResolvedValue({ id: 'm1', threadId: 't1' });
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('sent');
    expect(db.contact.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'QUEUED', assignedToId: 'u1' },
      data: { status: 'SENDING' },
    });
    expect(db.contact.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SENT', gmailThreadId: 't1', gmailMessageId: 'm1' }) }));
    expect(db.sendLog.create).toHaveBeenCalledTimes(1);
  });

  it('never sends to non-valid contacts unless allowed, and never to invalid', async () => {
    expect(await sendOne(user, { ...contact, verification: 'RISKY' } as Contact, campaign, gmail, [])).toBe('skip');
    expect(await sendOne(user, { ...contact, verification: 'INVALID' } as Contact, { ...campaign, allowNonValid: true } as Campaign, gmail, [])).toBe('skip');
    expect(send).not.toHaveBeenCalled();
  });

  it('rate limit: requeues contact, pauses user 1h, stops the batch', async () => {
    send.mockRejectedValue(new GmailError('rate_limit', '429'));
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('stop');
    expect(db.contact.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'QUEUED' } });
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paused: true }) }));
  });

  it('suspicious activity pauses everyone', async () => {
    send.mockRejectedValue(new GmailError('suspicious', 'Suspicious activity'));
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('stop');
    expect(db.setting.upsert).toHaveBeenCalled();
    expect(db.alert.create).toHaveBeenCalledWith({ data: expect.objectContaining({ level: 'critical' }) });
  });

  it('network failure is ambiguous: marks ERROR (unconfirmed), never requeues', async () => {
    send.mockRejectedValue(new GmailError('ambiguous', 'ETIMEDOUT'));
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('stop');
    const calls = db.contact.update.mock.calls.map((c) => c[0].data.status);
    expect(calls).toEqual(['ERROR']);
  });

  it('Gmail 5xx requeues without pausing', async () => {
    send.mockRejectedValue(new GmailError('transient', '503'));
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('stop');
    expect(db.contact.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'QUEUED' } });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('a per-contact error is logged and the batch can continue', async () => {
    send.mockRejectedValue(new GmailError('other', 'Invalid To header'));
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('error');
    expect(db.sendLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ result: expect.stringContaining('error') }) });
  });

  it('a DB failure after a successful send stops without re-sending', async () => {
    send.mockResolvedValue({ id: 'm1', threadId: 't1' });
    db.$transaction.mockRejectedValue(new Error('db down'));
    db.contact.findUnique.mockResolvedValue({ status: 'SENDING' });
    expect(await sendOne(user, contact, campaign, gmail, [])).toBe('stop');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
