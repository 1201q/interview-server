import { OpenAIEmbeddings } from "@langchain/openai";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Document } from "langchain/document";
import { ConfigService } from "@nestjs/config";

import weaviate, { Filters, WeaviateClient } from "weaviate-client";
import { WeaviateStore } from "@langchain/weaviate";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private client: WeaviateClient;
  private embeddings: OpenAIEmbeddings;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.client = await weaviate.connectToWeaviateCloud(
      this.config.get<string>("WEAVIATE_URL"),
      {
        authCredentials: new weaviate.ApiKey(
          this.config.get<string>("WEAVIATE_API_KEY"),
        ),
        headers: {
          "X-OpenAI-Api-Key": this.config.get<string>("OPENAI_API_KEY"),
        },
      },
    );

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.get<string>("OPENAI_API_KEY"),
      model: "text-embedding-3-small",
    });
  }

  async save(resume: string, job: string, userId: string, requestId: string) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
    });

    const resumeChunks = await splitter.createDocuments([resume]);
    const jobChunks = await splitter.createDocuments([job]);

    const resumeDocs: Document[] = resumeChunks.map(
      (doc, i) =>
        new Document({
          pageContent: doc.pageContent,
          metadata: {
            type: "resume",
            userId: `user-${userId}`,
            requestId,
            chunkIndex: i,
          },
        }),
    );

    const jobDocs: Document[] = jobChunks.map(
      (doc, i) =>
        new Document({
          pageContent: doc.pageContent,
          metadata: {
            type: "job",
            userId: `user-${userId}`,
            requestId,
            chunkIndex: i,
          },
        }),
    );

    await WeaviateStore.fromDocuments(resumeDocs, this.embeddings, {
      client: this.client,
      indexName: "resume",
    });

    await WeaviateStore.fromDocuments(jobDocs, this.embeddings, {
      client: this.client,
      indexName: "job",
    });
  }

  async similaritySearch(
    query: string,
    requestId: string,
    topK = 2,
    namespace: "resume" | "job" = "resume",
  ) {
    const store = await WeaviateStore.fromExistingIndex(this.embeddings, {
      client: this.client,
      indexName: namespace,
    });

    const collection = this.client.collections.use(namespace);

    return await store.similaritySearch(
      query,
      topK,
      Filters.and(
        collection.filter.byProperty("requestId").equal(`${requestId}`),
      ),
    );
  }
}
