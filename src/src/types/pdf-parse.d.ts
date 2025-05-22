declare module 'pdf-parse' {
  interface PDFInfo {
    Title?: string;
    Author?: string;
    CreationDate?: string;
    [key: string]: any;
  }

  interface PDFData {
    text: string;
    info: PDFInfo;
    numpages: number;
    numrender: number;
    metadata: any;
    version: string;
  }

  function parse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  
  export default parse;
}
