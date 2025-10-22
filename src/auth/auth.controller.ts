import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { GoogleAuthGuard } from "src/auth/guard/google-auth.guard";
import { AuthService } from "./auth.service";
import { UserService } from "src/user/user.service";
import { ConfigService } from "@nestjs/config";

type SameSite = "lax" | "strict" | "none";

export interface User {
  name: string;
  email: string;
  user_id: string;
  provider: string;
}

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  // 배포 환경인지 확인
  private get isProd() {
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  private baseCookie = {
    httpOnly: true,
    secure: this.isProd,
    sameSite: "lax" as SameSite,
    path: "/",
  };

  private get accessCookieOpts() {
    return { ...this.baseCookie, maxAge: 1000 * 60 * 120 }; // 120분
  }

  private get refreshCookieOpts() {
    return { ...this.baseCookie, maxAge: 1000 * 60 * 60 * 24 * 7 }; // 7일
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleLogin(@Req() req: Request) {}

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user as User;

      // db에서 유저가 존재하는지 검색
      const exists = await this.userService.findUserByGoogleId(user.user_id);

      // db에 유저가 없을 경우
      if (!exists) {
        await this.userService.createGoogleUser({
          name: user.name,
          email: user.email,
          user_id: user.user_id,
          provider: user.provider,
        });
      }

      // 토큰 발급
      const { accessToken, refreshToken } =
        await this.authService.generateTokens(user.user_id);

      // 쿠키 세팅
      res.cookie("accessToken", accessToken, this.accessCookieOpts);
      res.cookie("refreshToken", refreshToken, this.refreshCookieOpts);

      // res.cookie("accessToken", accessToken, {
      //   httpOnly: true,
      //   secure: this.configService.get<string>("NODE_ENV") === "production",
      //   sameSite: "lax",
      //   domain:
      //     this.configService.get<string>("NODE_ENV") === "production"
      //       ? ".aiterview.tech"
      //       : undefined,
      //   maxAge: 1000 * 60 * 120,
      // });

      // res.cookie("refreshToken", refreshToken, {
      //   httpOnly: true,
      //   secure: this.configService.get<string>("NODE_ENV") === "production",
      //   sameSite: "lax",
      //   domain:
      //     this.configService.get<string>("NODE_ENV") === "production"
      //       ? ".aiterview.tech"
      //       : undefined,
      //   maxAge: 1000 * 60 * 60 * 24 * 7,
      // });

      const url = this.isProd
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
    const rft = req.cookies["refreshToken"];

    if (!rft) {
      throw new UnauthorizedException("Refresh token not found");
    }

    const { accessToken, refreshToken } =
      await this.authService.refreshTokens(rft);

    // const newTokens = await this.authService.refreshTokens(refreshToken);

    // res.cookie("accessToken", newTokens.accessToken, {
    //   httpOnly: true,
    //   secure: this.configService.get<string>("NODE_ENV") === "production",
    //   sameSite: "lax",
    //   domain:
    //     this.configService.get<string>("NODE_ENV") === "production"
    //       ? ".aiterview.tech"
    //       : undefined,
    //   maxAge: 1000 * 60 * 120,
    // });

    // res.cookie("refreshToken", newTokens.refreshToken, {
    //   httpOnly: true,
    //   secure: this.configService.get<string>("NODE_ENV") === "production",
    //   sameSite: "lax",
    //   domain:
    //     this.configService.get<string>("NODE_ENV") === "production"
    //       ? ".aiterview.tech"
    //       : undefined,
    //   maxAge: 1000 * 60 * 60 * 24 * 7,
    // });

    res.cookie("accessToken", accessToken, this.accessCookieOpts);
    res.cookie("refreshToken", refreshToken, this.refreshCookieOpts);

    // return res.status(200).json({ accessToken: newTokens.accessToken });

    return res.status(200).json({ accessToken });
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res() res: Response) {
    // res.clearCookie("accessToken", {
    //   httpOnly: true,
    //   secure: this.configService.get<string>("NODE_ENV") === "production",
    //   sameSite: "lax",
    //   domain:
    //     this.configService.get<string>("NODE_ENV") === "production"
    //       ? ".aiterview.tech"
    //       : undefined,
    //   maxAge: 1000 * 60 * 120,
    //   path: "/",
    // });

    // res.clearCookie("refreshToken", {
    //   httpOnly: true,
    //   secure: this.configService.get<string>("NODE_ENV") === "production",
    //   sameSite: "lax",
    //   domain:
    //     this.configService.get<string>("NODE_ENV") === "production"
    //       ? ".aiterview.tech"
    //       : undefined,
    //   maxAge: 1000 * 60 * 60 * 24 * 7,
    //   path: "/",
    // });

    // return res.status(200).json({ message: "로그아웃 성공" });

    // maxAge를 0으로 설정하여 쿠키 삭제
    res.cookie("accessToken", "", { ...this.accessCookieOpts, maxAge: 0 });
    res.cookie("refreshToken", "", { ...this.refreshCookieOpts, maxAge: 0 });

    return res.status(200).json({ message: "로그아웃 성공" });
  }

  @Get("profile")
  async getProfile(@Req() req: Request) {
    const token = req.cookies.accessToken as string;
    const decoded = await this.authService.decodeAccessToken(token);

    const findUser = await this.userService.findUserByGoogleId(decoded.id);

    if (!findUser) {
      throw new UnauthorizedException("User not found");
    }

    return findUser;
  }
}
