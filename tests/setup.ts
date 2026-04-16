import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'test-jwt-secret-must-be-32-chars-min!!';
}
if (!process.env.JWT_EXPIRES_IN) {
  process.env.JWT_EXPIRES_IN = '7d';
}
if (!process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS = 'http://localhost:3000';
}
