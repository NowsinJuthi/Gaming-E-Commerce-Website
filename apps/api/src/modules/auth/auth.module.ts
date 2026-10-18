import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  AuthSession,
  AuthSessionSchema,
} from '../../database/schemas/auth-session.schema';
import {
  VerificationToken,
  VerificationTokenSchema,
} from '../../database/schemas/verification-token.schema';
import { SecurityModule } from '../../security/security.module';
import { CustomerPanelModule } from '../customer-panel/customer-panel.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    SecurityModule,
    CustomerPanelModule,
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: VerificationToken.name, schema: VerificationTokenSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OptionalJwtAuthGuard],
  exports: [AuthService, OptionalJwtAuthGuard],
})
export class AuthModule {}
