import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { CaslModule } from '@modules/casl/casl.module';
import { AbilitiesService } from './abilities.service';
import { MeController } from './me.controller';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [MeController],
  providers: [AbilitiesService],
  exports: [AbilitiesService],
})
export class AbilitiesModule {}
