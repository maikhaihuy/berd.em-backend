import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
      log:
        configService.get<string>('NODE_ENV') === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  // async cleanDatabase() {
  //   if (this.configService.get('NODE_ENV') === 'production') {
  //     throw new Error('cleanDatabase is not allowed in production');
  //   }

  //   const modelKeys = Reflect.ownKeys(this).filter(
  //     (key) =>
  //       typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
  //   ) as (keyof this)[];

  //   for (const modelKey of modelKeys) {
  //     const model = this[modelKey];
  //     if (typeof model?.deleteMany === 'function') {
  //       await model.deleteMany();
  //     }
  //   }
  // }
}
