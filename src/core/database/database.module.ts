import { Module } from "@nestjs/common";
import { DatabaseProvider } from "./database.providers";

@Module({
  imports: [DatabaseProvider],
  exports: [DatabaseProvider],
})
export class DatabaseModule {}
