import OpenAI from "openai";

export interface ResponseFromLlm {
  answer: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

export class Completions {
  protected client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey: apiKey });
  }

  createSystemMessage({
    additionalContext,
    constraints,
    directives,
    embeddingsSearch,
    outputStyle,
    query,
  }: {
    directives: string[];
    constraints: string[];
    query: string;
    embeddingsSearch: string[];
    additionalContext: string[];
    outputStyle: string;
  }): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return [
      {
        role: "system",
        content: `You are UbiquityOS, a Telegram-integrated GitHub-first assistant for UbiquityDAO.

                # Directives
                ${directives.join("\n- ")}

                # Constraints
                ${constraints.join("\n- ")}

                ${embeddingsSearch.length > 0 ? `## Embeddings Search Results\n${embeddingsSearch.join("\n- ")}` : ""}

                ${additionalContext.length > 0 ? `### Additional Context\n${additionalContext.join("\n- ")}` : ""}

                # Output Style
                ${outputStyle}
                `
          .replace(/ {16}/g, "")
          .trim(),
      },
      {
        role: "user",
        content: query,
      },
    ];
  }

  async createCompletion({
    directives,
    constraints,
    additionalContext,
    embeddingsSearch,
    outputStyle,
    query,
    model,
  }: {
    directives: string[];
    constraints: string[];
    additionalContext: string[];
    embeddingsSearch: string[];
    outputStyle: string;
    query: string;
    model: string;
  }): Promise<ResponseFromLlm | undefined> {
    const res: OpenAI.Chat.Completions.ChatCompletion = await this.client.chat.completions.create({
      model: model,
      messages: this.createSystemMessage({ directives, constraints, query, embeddingsSearch, additionalContext, outputStyle }),
      temperature: 0.2,
      top_p: 0.5,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        type: "text",
      },
    });
    const answer = res.choices[0].message;
    if (answer?.content && res.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = res.usage;
      return {
        answer: answer.content,
        tokenUsage: { input: prompt_tokens, output: completion_tokens, total: total_tokens },
      };
    }
  }
}
