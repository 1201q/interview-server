import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRubric1759385183111 implements MigrationInterface {
  name = "AddRubric1759385183111";

  public async up(q: QueryRunner): Promise<void> {
    // 1) refined_words_json → refined_json (있을 때만, 멱등)
    await q.query(`
  DECLARE v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt
    FROM USER_TAB_COLS
    WHERE TABLE_NAME = UPPER('answer_analyses') AND UPPER(COLUMN_NAME) = UPPER('refined_words_json');
    IF v_cnt = 1 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" RENAME COLUMN "refined_words_json" TO "refined_json"';
    END IF;
  END;`);

    // 2) refined_json 컬럼이 없다면 생성(멱등; 이미 있으면 -1430 무시)
    await q.query(`
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" ADD "refined_json" JSON';
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -1430 THEN RAISE; END IF;
  END;`);

    // 3) questions.based_on을 255로 '축소' (스왑 방식; 기존 값 보존/잘라 넣기)
    //    - 절대 DROP 후 ADD NOT NULL 하지 말고, 임시 컬럼 → 복사 → 원본 DROP → RENAME → NOT NULL
    await q.query(`
  DECLARE
    v_exists NUMBER;
    v_type   VARCHAR2(30);
    v_charlen NUMBER;
  BEGIN
    -- 컬럼 존재 확인
    SELECT COUNT(*) INTO v_exists FROM USER_TAB_COLS
     WHERE TABLE_NAME=UPPER('questions') AND COLUMN_NAME=UPPER('based_on');

    IF v_exists = 1 THEN
      SELECT DATA_TYPE, CHAR_LENGTH INTO v_type, v_charlen
        FROM USER_TAB_COLS
       WHERE TABLE_NAME=UPPER('questions') AND COLUMN_NAME=UPPER('based_on');

      -- 이미 VARCHAR2(255)이면 스킵
      IF NOT (v_type = 'VARCHAR2' AND v_charlen <= 255) THEN
        BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "questions" DROP COLUMN "based_on_255"'; EXCEPTION WHEN OTHERS THEN NULL; END;
        EXECUTE IMMEDIATE 'ALTER TABLE "questions" ADD ("based_on_255" VARCHAR2(255))';
        EXECUTE IMMEDIATE 'UPDATE "questions" SET "based_on_255" = SUBSTR("based_on",1,255)';
        EXECUTE IMMEDIATE 'ALTER TABLE "questions" DROP COLUMN "based_on"';
        EXECUTE IMMEDIATE 'ALTER TABLE "questions" RENAME COLUMN "based_on_255" TO "based_on"';
        EXECUTE IMMEDIATE 'ALTER TABLE "questions" MODIFY ("based_on" NOT NULL)';
      END IF;

    ELSE
      -- 컬럼이 없을 때: 먼저 NULL 허용으로 추가 → 기본값 채움 → NOT NULL
      EXECUTE IMMEDIATE 'ALTER TABLE "questions" ADD ("based_on" VARCHAR2(255))';
      EXECUTE IMMEDIATE 'UPDATE "questions" SET "based_on" = ''unknown'' WHERE "based_on" IS NULL';
      EXECUTE IMMEDIATE 'ALTER TABLE "questions" MODIFY ("based_on" NOT NULL)';
    END IF;
  END;`);

    // 4) AnswerAnalysis: answer_id UNIQUE + FK 재설정 (멱등)
    await q.query(`
  BEGIN
    EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX "UX_AA_ANSWER_ID" ON "answer_analyses"("answerId")';
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;`);

    await q.query(
      `BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" DROP CONSTRAINT "UQ_8e8a12801ea1434d199e6bbdd8b"'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
    );
    await q.query(`
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" ADD CONSTRAINT "UQ_8e8a12801ea1434d199e6bbdd8b" UNIQUE ("answerId")';
  EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2260 THEN RAISE; END IF; END;`);

    await q.query(
      `BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" DROP CONSTRAINT "FK_8e8a12801ea1434d199e6bbdd8b"'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
    );
    await q.query(`
  ALTER TABLE "answer_analyses"
  ADD CONSTRAINT "FK_8e8a12801ea1434d199e6bbdd8b"
  FOREIGN KEY ("answerId") REFERENCES "answers"("id") ON DELETE CASCADE`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // 1) FK/UNIQUE/INDEX 정리 (존재 시만)
    await q.query(
      `BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" DROP CONSTRAINT "FK_8e8a12801ea1434d199e6bbdd8b"'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
    );
    await q.query(
      `BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" DROP CONSTRAINT "UQ_8e8a12801ea1434d199e6bbdd8b"'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
    );
    await q.query(
      `BEGIN EXECUTE IMMEDIATE 'DROP INDEX "UX_AA_ANSWER_ID"'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
    );

    // 2) questions.based_on 길이 완화 (원복은 불가, 스키마만 되돌림)
    await q.query(`
  DECLARE v_exists NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_exists FROM USER_TAB_COLS
     WHERE TABLE_NAME=UPPER('questions') AND COLUMN_NAME=UPPER('based_on');
    IF v_exists = 1 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE "questions" MODIFY ("based_on" VARCHAR2(500))';
    END IF;
  END;`);

    // 3) refined_json → refined_words_json 이름 되돌리기 (있을 때만)
    await q.query(`
  DECLARE v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt
      FROM USER_TAB_COLS
     WHERE TABLE_NAME=UPPER('answer_analyses') AND UPPER(COLUMN_NAME)=UPPER('refined_json');
    IF v_cnt = 1 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE "answer_analyses" RENAME COLUMN "refined_json" TO "refined_words_json"';
    END IF;
  END;`);

    // (선택) FK 재생성 원상복귀가 필요하면 아래처럼 다시 추가
    await q.query(`
  ALTER TABLE "answer_analyses"
  ADD CONSTRAINT "FK_8e8a12801ea1434d199e6bbdd8b"
  FOREIGN KEY ("answerId") REFERENCES "answers"("id") ON DELETE CASCADE`);
  }
}
