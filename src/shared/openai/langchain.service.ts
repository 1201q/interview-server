import { ChatOpenAI } from "@langchain/openai";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VectorStoreService } from "../vector-store/vector-store.service";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { RunnableMap } from "@langchain/core/runnables";
import { followUpPrompt } from "./prompts/followup.prompt";

@Injectable()
export class LangChainService {
  private llm: ChatOpenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly vector: VectorStoreService,
  ) {
    this.llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3,
      apiKey: this.config.get("OPENAI_API_KEY"),
    });
  }

  async generateFollowup(input: {
    original_question: string;
    current_answer: string;
    qa_history: string;
    requestId: string;
  }) {
    const [resumeDocs, jobDocs] = await Promise.all([
      this.vector.similaritySearch(
        input.current_answer,
        input.requestId,
        2,
        "resume",
      ),
      this.vector.similaritySearch(
        input.current_answer,
        input.requestId,
        2,
        "job",
      ),
    ]);

    const context = [...resumeDocs, ...jobDocs]
      .map((doc) => doc.pageContent)
      .join("\n---\n");

    const parser = new JsonOutputParser();

    const chain = RunnableMap.from({
      original_question: async () => input.original_question,
      current_answer: async () => input.current_answer,
      qa_history: async () => input.qa_history,
      retrieved_context: async () => context,
    })
      .pipe(followUpPrompt)
      .pipe(this.llm)
      .pipe(parser);

    // console.log(
    //   await followUpPrompt.format({
    //     original_question: input.original_question,
    //     current_answer: input.current_answer,
    //     qa_history: input.qa_history,
    //     retrieved_context: context,
    //   }),
    // );

    const test = await chain.invoke({});

    console.log(test);

    return test;
  }
}
