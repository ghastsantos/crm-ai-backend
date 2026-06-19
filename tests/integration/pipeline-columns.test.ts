import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';

describe.skipIf(!process.env.DATABASE_URL)('Pipeline columns with database', () => {
  async function registerAndLogin(): Promise<{ token: string; organizationId: string }> {
    const id = randomUUID();
    const email = `pcol-${id}@example.com`;
    const password = 'password123';

    const reg = await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      name: 'PC User',
      organizationName: 'PC Org',
      organizationNiche: 'Serviços',
    });

    const token = reg.body.data.token as string;
    const organizationId = reg.body.data.user.memberships[0].organizationId as string;
    return { token, organizationId };
  }

  it('lists default columns after register', async () => {
    const { token, organizationId } = await registerAndLogin();
    const res = await request(app)
      .get('/api/v1/pipeline-columns')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cols = res.body.data as { position: number; title: string }[];
    expect(cols.map((c) => c.title)).toEqual([
      'Lead',
      'Qualificação',
      'Em negociação',
      'Fechamento',
      'Não fechou',
    ]);
    expect(cols.map((c) => c.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it('creates and deletes an optional sixth empty column', async () => {
    const { token, organizationId } = await registerAndLogin();
    const create = await request(app)
      .post('/api/v1/pipeline-columns')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId, title: 'Retorno' });

    expect(create.status).toBe(201);
    const id = create.body.data.id as string;

    const del = await request(app)
      .delete(`/api/v1/pipeline-columns/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(204);
  });

  it('keeps the pipeline between five and six stages', async () => {
    const { token, organizationId } = await registerAndLogin();

    const before = await request(app)
      .get('/api/v1/pipeline-columns')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);

    const firstColumnId = before.body.data[0].id as string;
    const deleteDefault = await request(app)
      .delete(`/api/v1/pipeline-columns/${firstColumnId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteDefault.status).toBe(400);
    expect(deleteDefault.body.error.code).toBe('PIPELINE_COLUMN_MINIMUM_REACHED');

    const createSixth = await request(app)
      .post('/api/v1/pipeline-columns')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId, title: 'Retorno' });

    expect(createSixth.status).toBe(201);

    const createSeventh = await request(app)
      .post('/api/v1/pipeline-columns')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId, title: 'Pós-venda' });

    expect(createSeventh.status).toBe(400);
    expect(createSeventh.body.error.code).toBe('PIPELINE_COLUMN_LIMIT_REACHED');
  });
});
