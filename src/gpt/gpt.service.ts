import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

@Injectable()
export class GptService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  async testAnswer(answer: string): Promise<string> {
    try {
      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI interview evaluator. Provide constructive feedback on answers.',
          },
          {
            role: 'user',
            content: `Evaluate this interview response: "${answer}"`,
          },
        ],
        temperature: 0.7,
      });

      console.log(res);

      return res.choices[0]?.message?.content || 'no response';
    } catch (error) {
      console.error(error);
      return 'no response';
    }
  }
}
