// src/typeorm-datasource.ts
import { DataSource } from "typeorm";
import { config } from "dotenv";

const isTs = __filename.endsWith(".ts");
config();

export default new DataSource({
  type: "oracle",
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECTION,
  synchronize: false,
  logging: false,
  entities: [
    isTs
      ? "src/common/entities/entities.ts"
      : "dist/common/entities/entities.js",
  ],
  migrations: [isTs ? "src/migrations/*.ts" : "dist/migrations/*.js"],
});
