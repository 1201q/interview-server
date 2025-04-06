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

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleLogin(@Req() req: Request) {}

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;

    const { accessToken, refreshToken } = await this.authService.generateTokens(
      user.user_id,
    );

    console.log("Access Token:", accessToken);
    console.log("Refresh Token:", refreshToken);
    console.log(user);
    res.send("Login successful! You can close this window.");
  }
}
