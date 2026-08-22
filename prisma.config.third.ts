import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma_third/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL_THIRD,
  },
});
