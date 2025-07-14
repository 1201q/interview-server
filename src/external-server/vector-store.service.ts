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

  async save(resume: string, job: string, requestId: string) {
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

            requestId,
            chunkIndex: i,
          },
        }),
    );

    const resumeStore = await WeaviateStore.fromExistingIndex(this.embeddings, {
      client: this.client,
      indexName: "resume",
    });

    const jobStore = await WeaviateStore.fromExistingIndex(this.embeddings, {
      client: this.client,
      indexName: "job",
    });

    await resumeStore.addDocuments(resumeDocs);
    await jobStore.addDocuments(jobDocs);
  }

  async deleteByRequestId(requestId: string) {
    const resume = this.client.collections.use("resume");
    const job = this.client.collections.use("job");

    await resume.data.deleteMany(
      Filters.and(resume.filter.byProperty("requestId").equal(requestId)),
    );

    await job.data.deleteMany(
      Filters.and(job.filter.byProperty("requestId").equal(requestId)),
    );
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
