export interface VisualQueryInput {
  imageBase64: string;
  mimeType: string;
  question: string;
  // System-level guidance, e.g. which language to answer in.
  instructions?: string;
}

export interface VisualQueryProvider {
  explainImage(input: VisualQueryInput): Promise<string>;
}
