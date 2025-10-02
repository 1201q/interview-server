import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRubric1759368927929 implements MigrationInterface {
  name = "AddRubric1759368927929";

  public async up(q: QueryRunner): Promise<void> {
    // 0) UNUSED 컬럼 정리 (존재 시에만)
    await q.query(`
DECLARE v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM USER_UNUSED_COL_TABS WHERE TABLE_NAME = UPPER('questions');
  IF v_cnt > 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE "questions" DROP UNUSED COLUMNS'; END IF;
END;`);

    // 1) sessions 컬럼들: 존재 시 스킵
    await q.query(`
DECLARE v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM USER_TAB_COLS WHERE TABLE_NAME=UPPER('sessions') AND COLUMN_NAME=UPPER('rubric_gen_status');
  IF v_cnt = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE "sessions" ADD ("rubric_gen_status" VARCHAR2(16) DEFAULT ''pending'' NOT NULL)'; END IF;
END;`);

    await q.query(`
DECLARE v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM USER_TAB_COLS WHERE TABLE_NAME=UPPER('sessions') AND COLUMN_NAME=UPPER('rubric_json');
  IF v_cnt = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE "sessions" ADD ("rubric_json" JSON)'; END IF;
END;`);

    await q.query(`
DECLARE v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM USER_TAB_COLS WHERE TABLE_NAME=UPPER('sessions') AND COLUMN_NAME=UPPER('rubric_last_error');
  IF v_cnt = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE "sessions" ADD ("rubric_last_error" CLOB)'; END IF;
END;`);

    // 2) session_questions 컬럼들: 존재 시 스킵
    await q.query(`
DECLARE v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM USER_TAB_COLS WHERE TABLE_NAME=UPPER('session_questions') AND COLUMN_NAME=UPPER('rubric_status');
  IF v_cnt = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE "session_questions" ADD ("rubric_status" VARCHAR2(16) DEFAULT ''pending'' NOT NULL)'; END IF;
END;`);

    await q.query(`
DECLARE v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM USER_TAB_COLS WHERE TABLE_NAME=UPPER('session_questions') AND COLUMN_NAME=UPPER('rubric_json');
  IF v_cnt = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE "session_questions" ADD ("rubric_json" JSON)'; END IF;
END;`);

    await q.query(`
DECLARE v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM USER_TAB_COLS WHERE TABLE_NAME=UPPER('session_questions') AND COLUMN_NAME=UPPER('rubric_last_error');
  IF v_cnt = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE "session_questions" ADD ("rubric_last_error" CLOB)'; END IF;
END;`);

    // 3) questions.based_on 을 255로 '강제 축소' (이미 255면 스킵)
    //    - 길이 축소는 MODIFY가 막히므로(ORA-01441), 스왑 방식
    await q.query(`
DECLARE
  v_type  VARCHAR2(30);
  v_charlen NUMBER;
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists
  FROM USER_TAB_COLS
  WHERE TABLE_NAME=UPPER('questions') AND COLUMN_NAME=UPPER('based_on');

  IF v_exists = 1 THEN
    SELECT DATA_TYPE, CHAR_LENGTH INTO v_type, v_charlen
    FROM USER_TAB_COLS
    WHERE TABLE_NAME=UPPER('questions') AND COLUMN_NAME=UPPER('based_on');

    -- 이미 VARCHAR2(255) NOT NULL이면 스킵
    IF NOT (v_type = 'VARCHAR2' AND v_charlen <= 255) THEN
      -- 중간 임시 컬럼이 남아있다면 정리
      BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE "questions" DROP COLUMN "based_on_255"';
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      -- 스왑 수행
      EXECUTE IMMEDIATE 'ALTER TABLE "questions" ADD ("based_on_255" VARCHAR2(255))';
      EXECUTE IMMEDIATE 'UPDATE "questions" SET "based_on_255" = SUBSTR("based_on",1,255)';
      EXECUTE IMMEDIATE 'ALTER TABLE "questions" DROP COLUMN "based_on"';
      EXECUTE IMMEDIATE 'ALTER TABLE "questions" RENAME COLUMN "based_on_255" TO "based_on"';
      EXECUTE IMMEDIATE 'ALTER TABLE "questions" MODIFY ("based_on" NOT NULL)';
    END IF;
  END IF;
END;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // 되돌릴 때: 신규 컬럼 제거 (존재 시만)
    await q.query(`
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE "session_questions" DROP COLUMN "rubric_last_error"';
EXCEPTION WHEN OTHERS THEN NULL; END;`);
    await q.query(`
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE "session_questions" DROP COLUMN "rubric_json"';
EXCEPTION WHEN OTHERS THEN NULL; END;`);
    await q.query(`
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE "session_questions" DROP COLUMN "rubric_status"';
EXCEPTION WHEN OTHERS THEN NULL; END;`);

    await q.query(`
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE "sessions" DROP COLUMN "rubric_last_error"';
EXCEPTION WHEN OTHERS THEN NULL; END;`);
    await q.query(`
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE "sessions" DROP COLUMN "rubric_json"';
EXCEPTION WHEN OTHERS THEN NULL; END;`);
    await q.query(`
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE "sessions" DROP COLUMN "rubric_gen_status"';
EXCEPTION WHEN OTHERS THEN NULL; END;`);

    // based_on 은 손실 복구 불가. 길이만 넉넉히 풀어주는 정도로 롤백
    await q.query(`ALTER TABLE "questions" MODIFY ("based_on" VARCHAR2(500))`);
  }
}
