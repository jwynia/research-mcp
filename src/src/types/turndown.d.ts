declare module 'turndown' {
  interface TurndownOptions {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: '-' | '+' | '*';
    codeBlockStyle?: 'indented' | 'fenced';
    fence?: '```' | '~~~';
    emDelimiter?: '_' | '*';
    strongDelimiter?: '__' | '**';
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
    [key: string]: any;
  }

  interface TurndownRule {
    filter: string | string[] | ((node: Node) => boolean);
    replacement: (content: string, node: Node, options?: any) => string;
  }

  class TurndownService {
    constructor(options?: TurndownOptions);
    addRule(key: string, rule: TurndownRule): this;
    keep(filter: string | string[] | ((node: Node) => boolean)): this;
    remove(filter: string | string[] | ((node: Node) => boolean)): this;
    use(plugin: (service: TurndownService) => void): this;
    turndown(html: string | Node): string;
  }

  export default TurndownService;
}
