import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';

describe('Auth HTTP validation', () => {
  it('POST /api/v1/auth/register returns 400 when body invalid', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/login returns 400 when body invalid', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/auth/me returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/auth/me returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid');
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Auth flow with database', () => {
  it('registers, logs in, and returns current user', async () => {
    const id = randomUUID();
    const email = `user-${id}@example.com`;
    const password = 'password123';

    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        name: 'Test User',
        organizationName: 'Test Org',
        organizationNiche: 'Serviços',
      });

    expect(reg.status).toBe(201);
    expect(reg.body.success).toBe(true);
    expect(reg.body.data.token).toBeTruthy();
    expect(reg.body.data.user.email).toBe(email);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const token = login.body.data.token as string;

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
    expect(me.body.data.memberships).toHaveLength(1);
    expect(me.body.data.memberships[0].role).toBe('OWNER');
  });

  it('authenticates /me via HTTP-only cookie when Authorization is omitted', async () => {
    const id = randomUUID();
    const email = `cookie-${id}@example.com`;
    const password = 'password123';

    await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'Cookie User',
      organizationName: 'Cookie Org',
      organizationNiche: 'Serviços',
    });

    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeDefined();

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
  });

  it('adds a unique JWT id on each login', async () => {
    const id = randomUUID();
    const email = `jti-${id}@example.com`;
    const password = 'password123';

    await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'JTI User',
      organizationName: 'JTI Org',
      organizationNiche: 'Serviços',
    });

    const first = await request(app).post('/api/v1/auth/login').send({ email, password });
    const second = await request(app).post('/api/v1/auth/login').send({ email, password });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstToken = first.body.data.token as string;
    const secondToken = second.body.data.token as string;
    const firstPayload = jwt.decode(firstToken) as jwt.JwtPayload;
    const secondPayload = jwt.decode(secondToken) as jwt.JwtPayload;

    expect(firstPayload.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(secondPayload.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(secondPayload.jti).not.toBe(firstPayload.jti);
    expect(secondToken).not.toBe(firstToken);
  });

  it('POST /logout clears session cookie', async () => {
    const id = randomUUID();
    const email = `logout-${id}@example.com`;
    const password = 'password123';

    await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'Logout User',
      organizationName: 'Logout Org',
      organizationNiche: 'Serviços',
    });

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password });
    const out = await agent.post('/api/v1/auth/logout');
    expect(out.status).toBe(204);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });

  it('returns 409 when email already registered', async () => {
    const id = randomUUID();
    const email = `dup-${id}@example.com`;
    const body = {
      email,
      password: 'password123',
      name: 'A',
      organizationName: 'Org A',
      organizationNiche: 'Serviços',
    };

    const first = await request(app).post('/api/v1/auth/register').send(body);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/v1/auth/register').send({
      ...body,
      organizationName: 'Org B',
      organizationNiche: 'Tecnologia',
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_ALREADY_IN_USE');
  });

  it('returns 401 when login password wrong', async () => {
    const id = randomUUID();
    const email = `login-${id}@example.com`;
    await request(app).post('/api/v1/auth/register').send({
      email,
      password: 'rightpassword1',
      name: 'U',
      organizationName: 'O',
      organizationNiche: 'Serviços',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrongpassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
