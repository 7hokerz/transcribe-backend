import { Pool } from 'undici';

export const AudioPool = new Pool('https://api.openai.com', {
  connections: 20,
  pipelining: 1,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connectTimeout: 5_000,
  headersTimeout: 90_000,
  bodyTimeout: 90_000,
});
