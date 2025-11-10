import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(error: any, user: any, info: any) {
    if (error) {
      throw new UnauthorizedException(`인증 실패: ${error.message}`);
    }

    if (!user) {
      if (info?.message === "No auth token") {
        throw new UnauthorizedException("인증 실패: 액세스 토큰이 필요합니다.");
      } else if (info?.message === "jwt expired") {
        throw new UnauthorizedException("인증 실패: 토큰이 만료되었습니다.");
      } else {
        throw new UnauthorizedException("인증 실패: 유효하지 않은 토큰입니다.");
      }
    }

    this.logger.debug(`Authenticated user: ${JSON.stringify(user)}`);

    return user;
  }
}
