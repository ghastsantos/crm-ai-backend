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

  it('does not expose an endpoint to create optional columns', async () => {
    const { token, organizationId } = await registerAndLogin();
    const create = await request(app)
      .post('/api/v1/pipeline-columns')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId, title: 'Retorno' });

    expect(create.status).toBe(404);

    const list = await request(app)
      .get('/api/v1/pipeline-columns')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(5);
  });

  it('keeps the default five stages protected', async () => {
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
  });

  it('does not allow renaming or reordering the default stages', async () => {
    const { token, organizationId } = await registerAndLogin();

    const before = await request(app)
      .get('/api/v1/pipeline-columns')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);

    const firstColumnId = before.body.data[0].id as string;
    const secondColumnId = before.body.data[1].id as string;

    const rename = await request(app)
      .patch(`/api/v1/pipeline-columns/${firstColumnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Custom lead' });

    const reorder = await request(app)
      .patch(`/api/v1/pipeline-columns/${secondColumnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ position: 0 });

    expect(rename.status).toBe(400);
    expect(rename.body.error.code).toBe('PIPELINE_COLUMNS_FIXED');
    expect(reorder.status).toBe(400);
    expect(reorder.body.error.code).toBe('PIPELINE_COLUMNS_FIXED');

    const after = await request(app)
      .get('/api/v1/pipeline-columns')
      .query({ organizationId })
      .set('Authorization', `Bearer ${token}`);

    expect(after.status).toBe(200);
    expect(
      (after.body.data as { id: string; position: number; title: string }[]).map((column) => ({
        id: column.id,
        position: column.position,
        title: column.title,
      }))
    ).toEqual(
      (before.body.data as { id: string; position: number; title: string }[]).map((column) => ({
        id: column.id,
        position: column.position,
        title: column.title,
      }))
    );
  });
});
