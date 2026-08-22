import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@generated/prisma-third/client';

@Injectable()
export class PrismaThirdService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({ adapter: new PrismaMariaDb(process.env.DATABASE_URL_THIRD!) });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
