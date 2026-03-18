import { Request, Response } from 'express';
import { getTestResponse } from './test.service';

export async function getTest(_req: Request, res: Response): Promise<void> {
  const data = getTestResponse();
  res.json({
    success: true,
    data,
  });
}
