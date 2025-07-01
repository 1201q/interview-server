import { Module } from "@nestjs/common";
import { VectorStoreService } from "./vector-store.service";
import { VectorStoreController } from "./vector-store.controller";

@Module({
  imports: [],
  providers: [VectorStoreService],
  controllers: [VectorStoreController],
  exports: [VectorStoreModule],
})
export class VectorStoreModule {}
