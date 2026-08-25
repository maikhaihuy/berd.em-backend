import { Module } from '@nestjs/common';
import { ExceptionModule } from '@common/exception.module';
import { CaslAbilityFactory } from './casl-ability.factory';

@Module({
  imports: [ExceptionModule],
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
