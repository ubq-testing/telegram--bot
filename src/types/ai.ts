export type DatabaseItem = {
  id: string;
  markdown?: string;
  plaintext: string;
  author_id: number;
  payload?: Record<string, unknown>;
  created_at: string;
  modified_at: string;
  embedding: number[];
};

export type CommentSimilaritySearchResult = {
  comment_id: string;
  comment_plaintext: string;
  comment_issue_id: string;
  similarity: number;
  text_similarity: number;
};

export type IssueSimilaritySearchResult = {
  issue_id: string;
  issue_plaintext: string;
  similarity: number;
  text_similarity: number;
};
