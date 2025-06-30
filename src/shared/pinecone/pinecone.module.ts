import { Module } from "@nestjs/common";
import { PineconeService } from "./pinecone.service";
import { PineconeController } from "./pinecone.controller";

@Module({
  imports: [],
  providers: [PineconeService],
  controllers: [PineconeController],
  exports: [PineconeModule],
})
export class PineconeModule {}
