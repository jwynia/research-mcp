declare module 'mammoth' {
  interface ConversionOptions {
    buffer?: Buffer;
    path?: string;
    [key: string]: any;
  }

  interface ConversionResult {
    value: string;
    messages: Array<{ message: string; type?: string }>;
  }

  function convertToHtml(options: ConversionOptions): Promise<ConversionResult>;
  
  export { convertToHtml };
}
