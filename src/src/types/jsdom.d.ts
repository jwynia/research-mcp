declare module 'jsdom' {
  interface JSDOMOptions {
    url?: string;
    contentType?: string;
    referrer?: string;
    includeNodeLocations?: boolean;
    storageQuota?: number;
    runScripts?: 'dangerously' | 'outside-only' | undefined;
    resources?: any;
    virtualConsole?: any;
    cookieJar?: any;
    beforeParse?: (window: Window) => void;
    [key: string]: any;
  }

  interface JSDOM {
    window: Window & typeof globalThis;
    virtualConsole: any;
    cookieJar: any;
    getVirtualConsole(): any;
    serialize(): string;
    reconfigure(settings: JSDOMOptions): void;
  }

  export class JSDOM {
    constructor(html?: string | Buffer, options?: JSDOMOptions);
    static fromURL(url: string, options?: JSDOMOptions): Promise<JSDOM>;
    static fromFile(path: string, options?: JSDOMOptions): Promise<JSDOM>;
  }
}
