import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FaceService } from './face.service'
import { User } from '@/modules/users/entities/user.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [FaceService],
  exports: [FaceService],
})
export class FaceModule {}
