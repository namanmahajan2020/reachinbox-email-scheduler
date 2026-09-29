import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { indexEmail } from '../src/services/email.service.js';

const emailAddress = `codex-${randomUUID()}@example.test`;
let userId = '';

afterAll(async () => {
  if (!userId) return;
  await prisma.campaign.deleteMany({ where: { userId } });
  await prisma.sender.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe('local password sessions and persisted email actions', () => {
  it('registers, authenticates, persists email actions, and invalidates logout sessions', async () => {
    const session = request.agent(app);
    const created = await session.post('/api/auth/register').send({ name: 'Integration Test', email: emailAddress, password: 'correct horse battery staple' });
    expect(created.status).toBe(201);
    expect(created.body.passwordHash).toBeUndefined();
    userId = created.body.id;
    expect(created.headers['set-cookie']?.join(';')).toContain('HttpOnly');

    const guest = request.agent(app);
    expect((await guest.post('/api/auth/login').send({ email: emailAddress, password: 'wrong password' })).status).toBe(401);
    expect((await guest.post('/api/auth/login').send({ email: '', password: '' })).status).toBe(400);
    const login = await guest.post('/api/auth/login').send({ email: emailAddress, password: 'correct horse battery staple' });
    expect(login.status).toBe(200);
    expect(login.body.passwordHash).toBeUndefined();
    expect((await guest.get('/api/me')).status).toBe(200);
    expect((await guest.post('/api/auth/password').send({ password: 'short' })).status).toBe(400);
    expect((await guest.post('/api/auth/password').send({ password: 'updated-password-5182' })).status).toBe(204);
    const savedCredential = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    expect(savedCredential.passwordHash).toMatch(/^scrypt:/);
    expect((await request.agent(app).post('/api/auth/login').send({ email: emailAddress, password: 'updated-password-5182' })).status).toBe(200);

    const sender = await prisma.sender.create({ data: { userId, email: 'sender@example.test', displayName: 'Integration Sender' } });
    const campaign = await prisma.campaign.create({ data: { userId, subject: 'Integration test', body: 'Test message', startTime: new Date(Date.now() + 3600000), delayBetweenEmails: 1000, hourlyLimit: 20 } });
    const scheduled = await prisma.email.create({ data: { campaignId: campaign.id, senderId: sender.id, recipient: 'one@example.test', subject: campaign.subject, body: campaign.body, scheduledAt: campaign.startTime, idempotencyKey: randomUUID() } });
    const removable = await prisma.email.create({ data: { campaignId: campaign.id, senderId: sender.id, recipient: `two-${randomUUID()}@example.test`, subject: campaign.subject, body: campaign.body, scheduledAt: campaign.startTime, status: 'sent', sentAt: new Date(), idempotencyKey: randomUUID() } });
    await indexEmail(removable);
    const search = await guest.get('/api/search').query({ q: removable.recipient });
    expect(search.status).toBe(200);
    expect(search.body.some((row: { id: string }) => row.id === removable.id)).toBe(true);

    expect((await guest.patch(`/api/emails/${scheduled.id}/star`).send({ starred: true })).status).toBe(200);
    expect((await prisma.email.findUniqueOrThrow({ where: { id: scheduled.id } })).isStarred).toBe(true);
    expect((await guest.patch(`/api/emails/${scheduled.id}/star`).send({ starred: false })).status).toBe(200);
    expect((await guest.patch(`/api/emails/${scheduled.id}/archive`).send()).status).toBe(204);
    expect((await guest.get('/api/emails')).body.some((row: { id: string }) => row.id === scheduled.id)).toBe(false);
    expect((await prisma.email.findUniqueOrThrow({ where: { id: scheduled.id } })).isArchived).toBe(true);
    expect((await guest.delete(`/api/emails/${removable.id}`)).status).toBe(204);
    expect(await prisma.email.findUnique({ where: { id: removable.id } })).toBeNull();

    expect((await guest.post('/api/auth/logout')).status).toBe(204);
    expect((await guest.get('/api/me')).status).toBe(401);
  });
});
