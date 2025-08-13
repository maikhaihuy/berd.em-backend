import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PublicUserDto {
  @Expose()
  id: number;

  @Expose()
  username: string;

  constructor(partial: Partial<PublicUserDto>) {
    Object.assign(this, partial);
  }
}
