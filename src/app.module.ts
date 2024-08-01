import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module';
import { CountriesModule } from './modules/countries/countries.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuthService } from './modules/auth/auth.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CountriesModule,
    RolesModule,
    AuthModule,
    UsersModule,
    // GroupsModule,
    // CitiesModule,
    // CompaniesModule,
    // EmployeesModule,
  ],
  providers: [AuthService],
  // controllers: [AppController],
  // providers: [AppService],
})
export class AppModule {}
