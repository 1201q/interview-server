import { OpenAIEmbeddings } from "@langchain/openai";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

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

  async save(resume: string, job: string, userId: string, requestId: string) {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
    });

    const resumeChunks = await textSplitter.createDocuments([resume]);
    const jobChunks = await textSplitter.createDocuments([job]);

    const resumeDocs: Document[] = [
      ...resumeChunks.map(
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
      ),
    ];

    const jobDocs: Document[] = [
      ...jobChunks.map(
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
      ),
    ];

    await PineconeStore.fromDocuments(resumeDocs, this.embeddings, {
      pineconeIndex: this.index,
      namespace: "resume",
    });

    await PineconeStore.fromDocuments(jobDocs, this.embeddings, {
      pineconeIndex: this.index,
      namespace: "job",
    });
  }

  async similaritySearch(query: string, userId: string, topK = 3) {
    const store = await PineconeStore.fromExistingIndex(this.embeddings, {
      pineconeIndex: this.index,
      namespace: "resume",
    });

    const results = await store.similaritySearch(query, topK);

    const filtered = results.filter(
      (r) => r.metadata?.userId === `user-${userId}`,
    );

    console.log(filtered);

    return filtered;
  }
}
