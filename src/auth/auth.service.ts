import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async generateTokens(userId: string) {
    const payload = { id: userId };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_SECRET"),
      expiresIn: "15m",
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_REFRESH_SECRET"),
      expiresIn: "7d",
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
      });

      const newTokens = await this.generateTokens(decoded.id);

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException(`Invalid refresh token`);
    }
  }

  async decodeAccessToken(
    accessToken: string,
  ): Promise<{ id: string; iat: number; exp: number }> {
    try {
      const decoded = this.jwtService.verify(accessToken, {
        secret: this.configService.get("JWT_SECRET"),
      });
      return decoded;
    } catch (error) {
      throw new UnauthorizedException(`Invalid access token`);
    }
  }
}
