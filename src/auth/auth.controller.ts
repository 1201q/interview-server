import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { GoogleAuthGuard } from "src/auth/guard/google-auth.guard";
import { User } from "../common/interfaces/common.interface";
import { AuthService } from "./auth.service";
import { UserService } from "src/user/user.service";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "./guard/jwt-auh.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleLogin(@Req() req: Request) {}

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user as User;

      // db에서 유저가 존재하는지 검색
      const findUser = await this.userService.findUserByGoogleId(user.user_id);

      // db에 유저가 없을 경우
      if (!findUser) {
        await this.userService.createGoogleUser({
          name: user.name,
          email: user.email,
          user_id: user.user_id,
          provider: user.provider,
        });
      }

      const { accessToken, refreshToken } =
        await this.authService.generateTokens(user.user_id);

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: this.configService.get<string>("NODE_ENV") === "production",
        sameSite: "lax",
        domain:
          this.configService.get<string>("NODE_ENV") === "production"
            ? ".aiterview.tech"
            : undefined,
        maxAge: 1000 * 60 * 120,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: this.configService.get<string>("NODE_ENV") === "production",
        sameSite: "lax",
        domain:
          this.configService.get<string>("NODE_ENV") === "production"
            ? ".aiterview.tech"
            : undefined,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });

      const url =
        this.configService.get<string>("NODE_ENV") === "production"
          ? `https://aiterview.tech`
          : `http://localhost:3000`;

      return res.redirect(url);
    } catch (error) {
      res
        .status(500)
        .json({ message: "구글 로그인 실패", error: error.message });
    }
  }

  @Post("refresh")
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies["refreshToken"];

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    const newTokens = await this.authService.refreshTokens(refreshToken);

    res.cookie("accessToken", newTokens.accessToken, {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      domain:
        this.configService.get<string>("NODE_ENV") === "production"
          ? ".aiterview.tech"
          : undefined,
      maxAge: 1000 * 60 * 120,
    });

    res.cookie("refreshToken", newTokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      domain:
        this.configService.get<string>("NODE_ENV") === "production"
          ? ".aiterview.tech"
          : undefined,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.status(200).json({ accessToken: newTokens.accessToken });
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res() res: Response) {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      domain:
        this.configService.get<string>("NODE_ENV") === "production"
          ? ".aiterview.tech"
          : undefined,
      maxAge: 1000 * 60 * 120,
      path: "/",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      domain:
        this.configService.get<string>("NODE_ENV") === "production"
          ? ".aiterview.tech"
          : undefined,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/",
    });

    return res.status(200).json({ message: "로그아웃 성공" });
  }
}
