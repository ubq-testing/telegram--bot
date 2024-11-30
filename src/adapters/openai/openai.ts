import OpenAI from "openai";
import { logger } from "../../utils/logger";
import { Context } from "../../types";

export class Completions {
  protected client: OpenAI;

  constructor(context: Context) {
    const {
      env,
      config: {
        aiConfig: { baseUrl, kind },
      },
    } = context;
    const apiKey = kind === "OpenAi" ? env.OPENAI_API_KEY : env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(`Plugin is configured to use ${kind} but ${kind === "OpenAi" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"} is not set in the environment`);
    }

    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey,
    });
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
        role: "user",
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

  async createCompletion(params: {
    directives: string[];
    constraints: string[];
    additionalContext: string[];
    embeddingsSearch: string[];
    outputStyle: string;
    query: string;
    model: string;
  }): Promise<string> {
    const ctxWindow = this.createSystemMessage(params);

    logger.info("ctxWindow:\n\n", { ctxWindow });

    const res: OpenAI.Chat.Completions.ChatCompletion = await this.client.chat.completions.create({
      model: params.model,
      messages: ctxWindow,
      response_format: {
        type: "text",
      },
    });

    const answer = res.choices[0].message;
    if (answer?.content) {
      return answer.content;
    }

    logger.error("No answer found", { res });
    return `There was an error processing your request. Please try again later.`;
  }
}
