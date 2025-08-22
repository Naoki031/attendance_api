import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module';
import { CountriesModule } from './modules/countries/countries.module';
// import { RolesModule } from './modules/roles/roles.module';
// import { AuthService } from './modules/auth/auth.service';
// import { AuthModule } from './modules/auth/auth.module';
// import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { UsersModule } from './modules/users/users.module';
import { PermissionGroupsModule } from './modules/permission_groups/permission_groups.module';
import { UserGroupPermissionsModule } from './modules/user_group_permissions/user_group_permissions.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtStrategy } from '@/modules/auth/strategy/jwt.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from '@/modules/auth/guards/jwt.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CountriesModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    PermissionGroupsModule,
    UserGroupPermissionsModule,
    AuthModule,
    // GroupsModule,
    // CitiesModule,
    // CompaniesModule,
    // EmployeesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    JwtStrategy,
  ],
  // controllers: [AppController],
  // providers: [AppService],
})
export class AppModule {}
