## **Executive Summary** 

The Model Context Protocol (MCP), developed by Anthropic, provides a standardized approach to integrating artificial intelligence systems with external data sources, tools, and applications. This protocol significantly reduces complexity and enhances interoperability; however, as with all open source technology, its adoption could also introduce security issues, like: 

*   **Server Trust Issues:** Malicious MCP servers from unofficial repositories can impersonate legitimate servers, potentially leading to security breaches. Consent fatigue attacks occur when a malicious MCP server repeatedly triggers consent requests, causing users to unknowingly grant excessive permissions.
*   **Runtime Environment Security:** Insufficient sandboxing poses a significant risk, as inadequate isolation of MCP servers and tools increases the likelihood of security breaches.
*   **Authentication and Credential Management:** Plaintext credential exposure happens when local configuration files store sensitive data, such as tokens used by the MCP server, making them susceptible to theft. Additionally, weak or missing authentication between the MCP client and server, heightens the risk of unauthorized access.

Given the increasing reliance on AI and the wide-ranging applications of MCP, organizations must be fully aware of these security challenges. Proactively addressing these security issues through best practices, secure credential management, and reliable authentication methods is essential for the safe and effective implementation of MCP.

## **Introduction to MCP**

The [Model Context Protocol (MCP)](https://www.anthropic.com/news/model-context-protocol) is an open standard introduced by [Anthropic](https://www.anthropic.com/), designed to enable seamless integration between AI systems and external data sources, tools, and applications. 

Before the introduction of the Model Context Protocol (MCP), integrating large language models (LLMs) with external data sources and tools was a complex and resource-intensive process. Developers had to create custom connections for each data source, leading to increased development time, higher maintenance costs, and scalability challenges. This fragmented approach hindered the seamless interaction between AI systems and the diverse tools they needed to access, limiting the effectiveness and efficiency of AI applications.​

MCP addresses these challenges by providing a standardized protocol that facilitates seamless communication between AI models and external systems. By offering a universal interface, MCP allows developers to build integrations once, enabling AI models to dynamically interact with various data sources and tools without the need for custom code for each connection. 

As MCP continues to grow as an open-source initiative, it actively invites the community to participate, discuss, and contribute to its ongoing improvement. While adopting MCP brings significant advantages, it's essential for developers and organizations to implement it thoughtfully, adhering to security best practices. By verifying sources, conducting thorough code reviews, securely managing credentials, and enforcing strong authentication, organizations can confidently leverage MCP's benefits while ensuring robust security and reliability.

![Figure 1: MCP Architecture](https://live.paloaltonetworks.com/t5/image/serverpage/image-id/67228iC5CF3C53E704ADB7/image-size/large?v=v2&px=999 "xzou_0-1745343689872.jpeg")Figure 1: MCP Architecture

## **MCP Technical Overview**

The MCP operates on a client-server architecture designed to facilitate seamless interaction between LLMs and tools. In this setup, the **MCP client** resides within the host application—such as an AI assistant or integrated development environment (IDE)—and is responsible for initiating and managing connections to MCP servers. The MCP client is responsible for  discovering available server capabilities, sending requests, and processing responses to relay back to the host application. Conversely, the **MCP server** is a lightweight program that exposes specific functionalities to the client. It acts as an intermediary between the client and external data sources or services, handling incoming requests and providing appropriate responses.​ The server is responsible for implementing the logic required to communicate with external services.

MCP servers offer several key functionalities, principally **Resources** and **Tools**:​

*   [**Resources**](https://modelcontextprotocol.io/docs/concepts/resources)**:** Data elements made available by servers, such as documents, database records, or API responses, which clients can use as context for LLM interactions.​  
    
*   [**Tools**](https://modelcontextprotocol.io/docs/concepts/tools)**:** Executable functions exposed by servers, enabling LLMs to perform actions like computations, API calls, or interactions with external systems.

To accommodate various communication needs, MCP supports different transport mechanisms between clients and servers:

*   [**stdio**](https://modelcontextprotocol.io/docs/concepts/transports#standard-input%2Foutput-stdio) (standard input/output)**:** Used for local server connections where the server runs on the same machine as the client, facilitating direct communication through the host's standard input and output streams.​  
    
*   [**sse**](https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse) (server-sent events) or [**streamable http**](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)**:** Employed for remote server connections, these methods leverage HTTP to enable servers to push updates to clients over a persistent connection. They're particularly suitable when the MCP server operates remotely, allowing efficient real-time data transmission.

## **Security Taxonomy & Vulnerability Analysis**

While MCP’s architecture offers significant advantages in interoperability and efficiency, it also introduces unique security challenges; let’s now examine these vulnerabilities in detail.

### **Hidden Dangers: Unofficial Repositories and Malicious MCP Servers**

Based on the state of the current technology, the absence of an official repository for the MCP introduces significant security concerns. In the current landscape, attackers can upload MCP servers to unofficial repositories without undergoing security checks. These malicious MCP servers can be disguised with icons and branding from legitimate companies to deceive users into trusting and integrating them into their systems. This deception can lead to unauthorized access, data breaches, or system compromises, as users may unknowingly execute harmful code hidden in the malicious server.​ An [official MCP registry](https://modelcontextprotocol.io/development/roadmap#registry) is currently planned according to the [protocol’s roadmap](https://modelcontextprotocol.io/development/roadmap).

Furthermore, the ability to upload any MCP Server to public registries without verification processes exacerbates this risk. Executing an MCP server locally without verification involves executing arbitrary code, which inherently carries significant security risks. If a user integrates a malicious or vulnerable server from an unverified source, they are essentially granting it the same permissions as legitimate software. This can result in unauthorized data access, corruption of files, or the installation of additional malware. Users should take the same caution when installing MCP servers as they would when installing any third-party software.

#### **Examples**

*   Installing an MCP server is as simple as running "[pip install mcp-server-app](https://github.com/modelcontextprotocol/servers?tab=readme-ov-file#-getting-started)" from the client. However, as cybercriminals increasingly target official registries with malicious packages—often through supply-chain attacks—developers may inadvertently install compromised servers due to common issues like [typos or dependency confusion](https://unit42.paloaltonetworks.com/malicious-packages-in-pypi/).
*   [Prompts](https://modelcontextprotocol.io/docs/concepts/prompts) is a feature that allows MCP servers to define reusable prompt templates, helping applications generate more efficient requests for tool access. However, a malicious server could deliver a subtly modified prompt designed to trick the application into revealing sensitive information.
*   As explicitly noted in the [MCP specification](https://modelcontextprotocol.io/specification/2025-03-26#key-principles), descriptions of tool behavior—including annotations—must be treated as untrusted unless sourced from verified servers. A malicious MCP server can embed hidden jailbreak payloads in its tool description, which the MCP client automatically appends to the agent's system prompt without validation. AI Agents can be instructed to exfiltrate sensitive data or make unauthorized calls to powerful internal tools.
*   Additionally, the [MCP specification](https://modelcontextprotocol.io/specification/2025-03-26#key-principles)'s guidance about untrusted descriptions extends to tool registration. A malicious MCP server can register a tool using the same name as one from a trusted server. Without proper validation or namespace isolation, AI agents may inadvertently invoke the attacker-controlled version. The rogue tool can then read or modify sensitive payloads, produce forged responses, or trigger unintended side-effects.

### **Consent Fatigue: The User’s Unseen Risk**

​Incorporating human oversight in AI-driven tools is essential for ensuring safety and maintaining user trust. A key best practice for safeguarding AI-suggested actions that involve data access or system modifications is to require explicit human approval before those actions are executed. This "**human-in-the-loop**" approach empowers users to review and approve actions, thereby preventing unauthorized or potentially harmful activities. 

![Figure 2: Consent Fatigue Attack Flow](https://live.paloaltonetworks.com/t5/image/serverpage/image-id/67229i6118A77AD7E86ECD/image-size/large?v=v2&px=999 "xzou_1-1745343689866.jpeg")Figure 2: Consent Fatigue Attack Flow

However, this consent mechanism can be exploited through a tactic known as "**consent fatigue**." In such scenarios, a malicious MCP Server might inundate the MCP Client with numerous benign requests, such as multiple read permissions, before presenting a critical action like a write operation. The repetitive nature of these requests can lead to user desensitization, causing them to simply click through alerts without taking the time to read and understand what they are authorizing. The core idea of this attack is similar to [Multi-Factor Authentication (MFA) fatigue attacks](https://en.wikipedia.org/wiki/Multi-factor_authentication#Fatigue_attack), where users, overwhelmed by continuous authentication prompts, may inadvertently grant access to unauthorized entities. 

#### **Examples**

*   An MCP server connected to [GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/github) may regularly request user approval for actions such as updating files, creating issues, or opening pull requests. A malicious server could attempt to slip a harmful commit request among a series of otherwise benign requests, making it harder for users to spot.
*   An MCP server that provides [browser automation](https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer) capabilities typically requires user confirmation for sensitive actions such as sending emails or filling in login credentials. A malicious server could attempt to insert an unauthorized order request among a series of legitimate actions, making it difficult for users to detect the threat.

![Figure 3: Consent Fatigue of human-in-the-loop](https://live.paloaltonetworks.com/t5/image/serverpage/image-id/67230iB93159ECC4D87AED/image-dimensions/745x745?v=v2 "xzou_2-1745343690054.png")Figure 3: Consent Fatigue of human-in-the-loop

### **Security Risks in Non-Sandboxed Deployments**

In the context of MCP, sandboxing refers to isolating the server and its associated tools within a tightly controlled execution environment. This isolation ensures that even if untrusted or malicious action is executed, it remains confined and cannot access broader system resources, like files, folders, databases, API, git repo…etc, and undermine overall security. Without such containment, malicious or compromised components could lead to significant security incidents. Today, the sandboxes for an MCP environment are not natively supported. 

The sandbox acts as a strong security boundary around the MCP server. Even if the AI agent is compromised and attempts to misuse the server's tools, the sandbox prevents the malicious instructions from having a significant impact by restricting access to sensitive resources and preventing data from leaving the controlled environment.

![Figure 4: Attack Flow of the Security Risks in Non-Sandboxed Deployments](https://live.paloaltonetworks.com/t5/image/serverpage/image-id/67231i5A10E9536628BB2E/image-dimensions/1029x579?v=v2 "xzou_3-1745343689876.jpeg")Figure 4: Attack Flow of the Security Risks in Non-Sandboxed Deployments

Containers offer an immediate step towards isolating the MCP server. However, containerization alone is not a silver bullet. Additionally, sensitive configuration files should be managed with encryption methods instead of storing them as plaintext. Enhancing network security by limiting container communications through strict network segmentation can further mitigate risks. These measures, combined with regular updates and monitoring, provide a more comprehensive defense-in-depth strategy that addresses the security issues.

#### **Examples**

*   An attacker could craft a benign-looking white paper embedded with obfuscated commands. When an AI agent processes the document, it may unknowingly extract and act on these hidden instructions, leading to unintended code execution or SQL queries. This is an example of **indirect prompt injection** attack.

### **Exposed Credentials and Identities: Uncovering Risks to Sensitive Data**

One significant concern in MCP deployments is the handling of configuration files, particularly those stored locally in plaintext format, like [claude\_desktop\_config.json](https://github.com/modelcontextprotocol/servers/tree/main/src/github#usage-with-claude-desktop). The Local MCP Server configuration files, being stored in plaintext, can contain sensitive data—such as the tokens used by the local MCP Server—making them highly susceptible to theft. Without encryption, the configuration file presents an enticing target for attackers and malware, which commonly scan file systems looking for valuable data. Sensitive files like these, similar to id\_rsa, .pem, or .env files, can be easily discovered and exploited if not adequately secured.

To illustrate the severity of this security issue, consider a scenario where malware gains access to the local system. Such malware could effortlessly read and extract plaintext credentials from the MCP Server configuration, enabling unauthorized access to private repositories or sensitive services.

#### **Examples**

*   If malware runs on the host where an MCP server is deployed, it could extract plaintext credentials from the server’s configuration. This may lead to unauthorized access to private repositories or other sensitive services.
*   An MCP server that provides [file system access](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) can be abused to retrieve credentials from the host if it is not properly configured or sandboxed.

### **Authentication Gaps: Challenges in MCP Security**

According to the [latest MCP specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization#1-2-protocol-requirements), authentication in MCP implementation is optional. Currently, the MCP SDK does not include built-in authentication mechanisms, making it critical for users to implement or integrate their own authentication solutions. Deploying an MCP server without proper authentication significantly increases the risk of unauthorized access, resource misuse, and Denial of Service (DoS) attacks, potentially compromising the integrity and availability of the system. Note that there is [ongoing work by security professionals within the community](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/284) to update the MCP specification to use third-party identity providers for authorization.

Furthermore, many MCP remote server code examples available online use HTTP rather than HTTPS. Operating over HTTP can inadvertently expose sensitive communications to interception or manipulation. Developers are therefore strongly advised to proactively switch MCP communications to HTTPS to ensure secure, encrypted connections. This practice will protect data confidentiality and reinforce the overall security posture.

#### **Examples**

*   A misconfigured MCP server exposed to the internet may allow unauthenticated users to discover and interact with its available tools. This can lead to misuse, unauthorized access, and potential data leaks.
*   MCP server packages currently lack digital signatures, preventing users from easily verifying their authenticity or integrity. Without digital signatures, attackers could silently modify these packages—injecting malicious code or altering their functionality. To effectively mitigate this risk, users should consistently verify the hashes of MCP server packages each time before execution, ensuring no unauthorized changes have occurred since the last verification.

## **Conclusion & Recommendations**

After exploring MCP’s security challenges in detail, let's wrap up by summarizing the key points and suggesting practical steps to address these risks.

The Model Context Protocol (MCP) significantly streamlines the integration of artificial intelligence systems with external data sources, tools, and applications, offering substantial advantages in efficiency, interoperability, and scalability. However, without security in mind, the adoption of MCP may also introduce new security risks, including malicious tools disguised in unofficial repositories, consent fatigue attacks, security breaches due to insufficient sandboxing, plaintext credential exposure, and weak authentication mechanisms. Given the rapid increase in AI adoption and reliance on MCP, proactively identifying and addressing these security issues is essential to prevent substantial operational disruption, data breaches, compromised system integrity, and erosion of user trust.

To securely adopt MCP, organizations should first establish or rely on a trustworthy repository for MCP servers with rigorous verification and security vetting procedures. Regular auditing and timely updates of integrated MCP servers are essential to maintain compliance with evolving security standards, thereby preventing malicious MCP servers from entering and persisting within systems. It's also critical to log and securely store all security-relevant events of MCP servers, including events like authentication attempts, sensitive action invocations, and configuration changes. These logs serve as valuable indicators and forensic evidence in the event of a security breach

Furthermore, deploying comprehensive sandboxing and granting minimum access control to effectively isolate MCP servers and tools can significantly reduce the risk of security breaches. Sensitive configuration files containing credentials must be securely encrypted, supported by robust credential management solutions to minimize plaintext exposure. Lastly, it is critical to mandate strong authentication protocols for MCP deployments and transition all client-server interactions from HTTP to HTTPS, thereby safeguarding data confidentiality and integrity.

## **Palo Alto Networks AI Runtime Security Can Help**

[AI Runtime Security](https://docs.paloaltonetworks.com/whats-new/new-features/july-2024/ai-runtime-security) is a comprehensive solution designed to safeguard enterprise AI applications and traffic flows. It protects against a wide range of threats—including AI-specific vulnerabilities such as prompt injection, jailbreaks, malicious responses, embedded unsafe URLs, data exfiltration, and prompt-triggered attacks. AI Runtime Security also plans to support emerging Model Context Protocol (MCP) risks, such as malicious payloads embedded in tool descriptions and tool name collision attacks.

The solution combines continuous runtime threat analysis with real-time, AI-powered defenses to effectively stop attackers. It also leverages advanced AI-driven detection to protect AI models from manipulation and to help ensure the reliability and integrity of AI-generated outputs. By securing both the models and their interactions in real time, it lays the foundation for safe, trustworthy, and resilient AI deployments at scale.

## **References**

1.  [Introducing the Model Context Protocol \\ Anthropic](https://www.anthropic.com/news/model-context-protocol)
2.  [Resources - Model Context Protocol](https://modelcontextprotocol.io/docs/concepts/resources)
3.  [Tools - Model Context Protocol](https://modelcontextprotocol.io/docs/concepts/tools)
4.  [Stdio MCP Server](https://modelcontextprotocol.io/docs/concepts/transports#standard-input%2Foutput-stdio)  
5.  [SSE MCP Server](https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse) 
6.  [Multi-factor authentication - Wikipedia](https://en.wikipedia.org/wiki/Multi-factor_authentication#Fatigue_attack)
7.  [Roadmap - Model Context Protocol](https://modelcontextprotocol.io/development/roadmap#distribution-%26-discovery)
8.  [Authorization – Model Context Protocol Specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/) 
9.  [The official MCP registry API announced](https://x.com/opentools_/status/1893696402477453819)
10.  [Usage with Claude Desktop](https://github.com/modelcontextprotocol/servers/tree/main/src/github#usage-with-claude-desktop)
11.  [AI Runtime Security](https://docs.paloaltonetworks.com/whats-new/new-features/july-2024/ai-runtime-security)
12.  [Getting Started with MCP](https://github.com/modelcontextprotocol/servers?tab=readme-ov-file#-getting-started) 
13.  [Malicious Python Packages](https://unit42.paloaltonetworks.com/malicious-packages-in-pypi/)
14.  [Prompts - Model Context Protocol](https://modelcontextprotocol.io/docs/concepts/prompts)
15.  [Github MCP Servers](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
16.  [Browser automation](https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer)
17.  [FileSystem MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) 
18.  [Key Principles - Model Context Protocol](https://modelcontextprotocol.io/specification/2025-03-26#key-principles)
19.  [Tools - Model Context Protocol](https://modelcontextprotocol.io/specification/2025-03-26/server/tools#data-types)
20.  [Roadmap - Model Context Protocol](https://modelcontextprotocol.io/development/roadmap#registry)