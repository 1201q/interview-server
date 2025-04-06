import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InterviewUser } from "./entities/user.entity";
import { DataSource, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class UserService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InterviewUser)
    private readonly userRepository: Repository<InterviewUser>,
  ) {}

  async findUserByGoogleId(userId: string) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });

    if (!user) {
      return null;
    }

    return user;
  }

  async createGoogleUser(user: Partial<InterviewUser>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newUser = new InterviewUser();
      newUser.id = uuidv4();
      newUser.user_id = user.user_id;
      newUser.name = user.name;
      newUser.email = user.email;
      newUser.provider = user.provider;

      const savedUser = await queryRunner.manager.save(newUser);
      await queryRunner.commitTransaction();

      return savedUser;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException("Failed to create user", error);
    } finally {
      await queryRunner.release();
    }
  }
}
