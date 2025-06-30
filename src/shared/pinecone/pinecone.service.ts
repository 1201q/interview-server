import { OpenAIEmbeddings } from "@langchain/openai";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { Document } from "langchain/document";

@Injectable()
export class PineconeService implements OnModuleInit {
  private pinecone: Pinecone;
  private index: ReturnType<Pinecone["index"]>;
  private embeddings: OpenAIEmbeddings;

  constructor(private config: ConfigService) {}

  //
  async onModuleInit() {
    this.pinecone = new Pinecone({
      apiKey: this.config.get("PINECONE_API_KEY"),
    });

    this.index = this.pinecone.Index(this.config.get("PINECONE_INDEX_NAME"));

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.get("OPENAI_API_KEY"),
      model: "text-embedding-3-small",
    });
  }

  async saveResumeAndJobTexts(
    resume: string,
    job: string,
    userId: string,
    requestId: string,
  ) {
    const texts = [resume, job];
    const types = ["resume", "job"];

    const docs = texts.map((text, i) => {
      return new Document({
        pageContent: text,
        metadata: {
          userId,
          type: types[i],
          requestId,
        },
      });
    });

    const store = await PineconeStore.fromExistingIndex(this.embeddings, {
      pineconeIndex: this.index,
    });

    await store.addDocuments(docs);
  }

  async similaritySearch(query: string, userId: string, topK = 3) {
    const store = await PineconeStore.fromExistingIndex(this.embeddings, {
      pineconeIndex: this.index,
    });

    const results = await store.similaritySearch(query, topK);

    return results.filter((r) => r.metadata?.userId === userId);
  }
}
