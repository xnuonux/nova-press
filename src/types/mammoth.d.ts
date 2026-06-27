// mammoth ships no types and there is no @types/mammoth on the registry, so this
// is a minimal ambient declaration for the surface nova uses: docx -> markdown.
declare module "mammoth" {
  interface MammothResult {
    value: string;
    messages: unknown[];
  }
  interface MammothInput {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }
  export function convertToMarkdown(input: MammothInput, options?: unknown): Promise<MammothResult>;
  export function convertToHtml(input: MammothInput, options?: unknown): Promise<MammothResult>;
  export function extractRawText(input: MammothInput): Promise<MammothResult>;
  const mammoth: {
    convertToMarkdown: typeof convertToMarkdown;
    convertToHtml: typeof convertToHtml;
    extractRawText: typeof extractRawText;
  };
  export default mammoth;
}
