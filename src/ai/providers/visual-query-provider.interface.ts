export interface VisualQueryInput {
  imageBase64: string;
  mimeType: string;
  question: string;
}

export interface VisualQueryProvider {
  explainImage(input: VisualQueryInput): Promise<string>;
}
