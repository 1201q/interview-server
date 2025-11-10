import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRubric1762822407317 implements MigrationInterface {
  name = "AddRubric1762822407317";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generate_requests" ADD ("user_id" VARCHAR2(64))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generate_requests" DROP COLUMN "user_id"
    `);
  }
}
