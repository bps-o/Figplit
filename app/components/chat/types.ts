export interface SnippetSuggestion {
  id: string;
  title: string;
  description: string | null;
  path: string;
  filename: string;
  bestFor: string[] | null;
  prompt: string | null;
  docblock: string[];
  code: string;
}

export interface SnippetSuggestionStreamEvent {
  type: 'snippet-suggestions';
  snippets: SnippetSuggestion[];
  segment: number;
}
