import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { VoyageAIClient } from "voyageai";
import { CommentSimilaritySearchResult, DatabaseItem, IssueSimilaritySearchResult } from "../../types/ai";

export class Embeddings {
  protected supabase: SupabaseClient;
  protected voyage: VoyageAIClient;

  constructor(supabase: SupabaseClient | void, client: VoyageAIClient) {
    if (!supabase) {
      throw new Error("Supabase client is required to use Embeddings");
    }
    this.supabase = supabase;
    this.voyage = client;
  }

  async getIssue(issueNodeId: string): Promise<DatabaseItem[] | null> {
    const { data, error } = await this.supabase.from("issues").select("*").eq("id", issueNodeId).returns<DatabaseItem[]>();
    if (error) {
      logger.error("Error getting issue", { error });
      return null;
    }
    return data;
  }

  async getComment(commentNodeId: string): Promise<DatabaseItem[] | null> {
    const { data, error } = await this.supabase.from("issue_comments").select("*").eq("id", commentNodeId);
    if (error) {
      logger.error("Error getting comment", { error });
    }
    return data;
  }

  async findSimilarIssues(plaintext: string, threshold: number): Promise<IssueSimilaritySearchResult[] | null> {
    const embedding = await this.createEmbedding({ text: plaintext, prompt: "This is a query for the stored documents:" });
    plaintext = plaintext.replace(/'/g, "''").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "\\%").replace(/_/g, "\\_");
    const { data, error } = await this.supabase.rpc("find_similar_issue_ftse", {
      current_id: "",
      query_text: plaintext,
      query_embedding: embedding,
      threshold: threshold,
      max_results: 10,
    });
    if (error) {
      logger.error("Error finding similar issues", { error });
      throw new Error("Error finding similar issues");
    }
    return data;
  }

  async findSimilarComments(query: string, threshold: number): Promise<CommentSimilaritySearchResult[] | null> {
    const embedding = await this.createEmbedding({ text: query, prompt: "This is a query for the stored documents:" });
    query = query.replace(/'/g, "''").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "\\%").replace(/_/g, "\\_");
    logger.info(`Query: ${query}`);
    const { data, error } = await this.supabase.rpc("find_similar_comments", {
      current_id: "",
      query_text: query,
      query_embedding: embedding,
      threshold: threshold,
      max_results: 10,
    });
    if (error) {
      logger.error("Error finding similar comments", { error });
      throw new Error("Error finding similar comments");
    }
    return data;
  }

  async createEmbedding(input: { text?: string; prompt?: string } = {}): Promise<number[]> {
    const VECTOR_SIZE = 1024;
    const { text = null, prompt = null } = input;
    if (text === null) {
      return new Array(VECTOR_SIZE).fill(0);
    } else {
      const response = await this.voyage.embed({
        input: prompt ? `${prompt} ${text}` : text,
        model: "voyage-large-2-instruct",
      });
      return response.data?.[0]?.embedding || [];
    }
  }

  async reRankResults(results: string[], query: string, topK: number = 5): Promise<string[]> {
    let response;
    try {
      response = await this.voyage.rerank({
        query,
        documents: results,
        model: "rerank-2",
        returnDocuments: true,
        topK,
      });
    } catch (e: unknown) {
      logger.error("Reranking failed!", { e });
      return results;
    }
    const rerankedResults = response.data || [];
    return rerankedResults.map((result) => result.document).filter((document): document is string => document !== undefined);
  }
}
