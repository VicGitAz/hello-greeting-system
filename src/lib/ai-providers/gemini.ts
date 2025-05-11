// Updated GeminiProvider.ts with proper config extraction

import { ProjectConfig } from "../project-generator";

export interface GeminiResponse {
  text: string;
  code?: string;
  mermaidCode?: string;
  error?: string;
  config?: ProjectConfig;
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export class GeminiProvider {
  private apiKey: string;
  private model: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-2.5-flash-preview-04-17";
  }

  // Helper function to sanitize Mermaid labels and edge names
  private sanitizeMermaidLabel(label: string): string {
    return label
      .replace(/[()":']/g, "") // Remove problematic characters
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  // Extract only text content, removing all code blocks
  private extractTextOnly(fullText: string): string {
    if (!fullText) return "";

    // Remove all code blocks (mermaid, html, js, jsx, tsx, ts, css, etc.)
    const cleanedText = fullText
      .replace(/```(?:mermaid|html|js|jsx|tsx|ts|css|[^\s]*)?[\s\S]*?```/g, "")
      .trim();

    // If after removing code blocks we have nothing left, return something meaningful from the original text
    if (!cleanedText && fullText) {
      // Try to extract the first paragraph or sentence if there are no code blocks
      const firstParagraph = fullText.split("\n\n")[0]?.trim();
      if (firstParagraph && !firstParagraph.includes("```")) {
        return firstParagraph;
      }
    }

    return cleanedText;
  }

  // Extract all code blocks except mermaid
  private extractCodeBlocks(fullText: string): string {
    const codeRegex = /```(?!mermaid)([^\s]*)?[\s\S]*?```/g;
    let match: RegExpExecArray | null;
    let extractedCode = "";
    const tempText = fullText.replace(/```mermaid[\s\S]*?```/g, ""); // Remove mermaid blocks first

    // Process code blocks to ensure file information is preserved
    const codeBlocks = tempText.match(codeRegex);
    if (codeBlocks) {
      for (const block of codeBlocks) {
        // Check for filename comments before code blocks
        const fileCommentMatch = block.match(
          /```[^\s]*\s*\n(?:\/\/|#)\s*([^\n]+\.[a-zA-Z0-9]+)/
        );

        // Extract the code content without the backticks
        let codeContent = block
          .replace(/```[^\s]*?\s*\n/, "")
          .replace(/\s*```$/, "");

        // Add filename comment if found
        if (fileCommentMatch && fileCommentMatch[1]) {
          codeContent = `// ${fileCommentMatch[1]}\n${codeContent}`;
        }

        extractedCode += codeContent + "\n\n";
      }
    }

    return extractedCode.trim();
  }

  // Extract project configuration from text
  private extractProjectConfig(fullText: string): ProjectConfig | undefined {
    // Default config - always define this first to ensure we have a fallback
    const defaultConfig: ProjectConfig = {
      type: "frontend",
      language: "typescript",
      frontend: {
        framework: "react",
        styling: "tailwind",
        features: [],
      },
      name: "my-app",
      description: "Web application generated from prompt",
    };

    try {
      // Try to find JSON configuration in the text
      const configRegex =
        /\{[\s\S]*?"type"\s*:\s*"(?:frontend|backend|fullstack)"[\s\S]*?\}/;
      const configMatch = fullText.match(configRegex);

      if (configMatch) {
        try {
          const configText = configMatch[0];
          // Additional validation: check if the JSON is properly formed
          // Count braces to ensure they're balanced
          let openBraces = 0;
          let closeBraces = 0;

          for (const char of configText) {
            if (char === "{") openBraces++;
            if (char === "}") closeBraces++;
          }

          if (openBraces !== closeBraces) {
            console.warn(
              "Unbalanced braces in config JSON, using default config"
            );
            return defaultConfig;
          }

          const config = JSON.parse(configText);
          // Validate minimum required properties
          if (config.type && config.language) {
            return {
              ...defaultConfig, // Start with defaults for safety
              ...config, // Override with parsed values
              frontend: {
                ...defaultConfig.frontend, // Ensure frontend defaults
                ...(config.frontend || {}), // Override with any frontend config
              },
              name: config.name || defaultConfig.name, // Ensure name exists
            };
          }
        } catch (jsonError) {
          console.error("Error parsing JSON config:", jsonError);
          // Continue with default config on JSON parse error
        }
      }
    } catch (error) {
      console.error("Error extracting project config:", error);
      // Continue with default config on error
    }

    // Return default config if none found or on error
    return defaultConfig;
  }

  // Extract only mermaid code block
  private extractMermaidCode(fullText: string): string | undefined {
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/;
    const mermaidMatch = fullText.match(mermaidRegex);

    if (mermaidMatch) {
      // Sanitize mermaid code
      return mermaidMatch[1]
        .trim()
        .split("\n")
        .map((line) => this.sanitizeMermaidLabel(line))
        .join("\n");
    }

    return undefined;
  }

  async generateContent(prompt: string): Promise<GeminiResponse> {
    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          text: "",
          error: data.error?.message || "Failed to generate content",
        };
      }

      const fullText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      // Extract config from the full text response
      const config = this.extractProjectConfig(fullText);

      return {
        text: this.extractTextOnly(fullText),
        code: this.extractCodeBlocks(fullText) || undefined,
        mermaidCode: this.extractMermaidCode(fullText),
        config: config,
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        text: "",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        // Always provide a default config to prevent undefined errors
        config: {
          type: "frontend",
          language: "typescript",
          name: "error-project",
          frontend: {
            framework: "react",
            styling: "tailwind",
            features: [],
          },
        } as ProjectConfig,
      };
    }
  }

  async generateWebApp(prompt: string): Promise<GeminiResponse> {
    try {
      // First, extract project configuration from the prompt
      const configPrompt = `Based on the following user requirements, determine the best configuration for a web application project. Return ONLY a JSON object with the following structure:
      {
        "type": "frontend" or "backend" or "fullstack",
        "language": "javascript" or "typescript",
        "frontend": {
          "framework": "react" or "nextjs",
          "styling": "tailwind" or "css",
          "features": [array of features like "auth", "api", "darkmode", etc.]
        },
        "backend": {
          "framework": "express" or "nest" or other backend framework,
          "database": "mongodb" or "postgres" or "supabase" or "none"
        },
        "name": "project-name",
        "description": "Brief project description"
      }
      User requirements: ${prompt}
      Only return the JSON object, no explanation or other text.`;

      // Generate configuration based on prompt
      const configResponse = await this.generateContent(configPrompt);

      // Default config
      const defaultConfig: ProjectConfig = {
        type: "frontend",
        language: "typescript",
        frontend: {
          framework: "react",
          styling: "tailwind",
          features: [],
        },
        name: "my-app",
        description: "Web application generated from user prompt",
      };

      // Always ensure we have a config object
      let config = defaultConfig;

      // Try to use the extracted config if available
      if (configResponse.config) {
        config = {
          ...defaultConfig,
          ...configResponse.config,
          frontend: {
            ...defaultConfig.frontend,
            ...(configResponse.config.frontend || {}),
          },
          name: configResponse.config.name || defaultConfig.name,
        };
      }
      // Otherwise try to extract it from the text
      else {
        try {
          const configText = configResponse.text || "{}";

          // Find JSON object in the text
          const jsonRegex =
            /\{[\s\S]*?"type"\s*:\s*"(?:frontend|backend|fullstack)"[\s\S]*?\}/;
          const jsonMatch = configText.match(jsonRegex);

          if (jsonMatch) {
            const jsonString = jsonMatch[0];

            // Check for balanced braces to avoid malformed JSON
            let openBraces = 0;
            let closeBraces = 0;

            for (const char of jsonString) {
              if (char === "{") openBraces++;
              if (char === "}") closeBraces++;
            }

            if (openBraces === closeBraces) {
              try {
                const parsedConfig = JSON.parse(jsonString);

                // Validate minimum required properties and merge with defaults
                if (parsedConfig.type && parsedConfig.language) {
                  config = {
                    ...defaultConfig,
                    ...parsedConfig,
                    name: parsedConfig.name || defaultConfig.name,
                    frontend: {
                      ...defaultConfig.frontend,
                      ...(parsedConfig.frontend || {}),
                    },
                    ...(parsedConfig.backend
                      ? {
                          backend: {
                            ...(defaultConfig.backend || {}),
                            ...parsedConfig.backend,
                          },
                        }
                      : {}),
                  };
                }
              } catch (jsonError) {
                console.error("Error parsing config JSON:", jsonError);
                // Continue with default config
              }
            }
          }
        } catch (error) {
          console.error("Error extracting config from text:", error);
          // Continue with default config
        }
      }

      // Ensure we have a valid config at this point
      console.log("Using project configuration:", config);

      // Generate the web app code and description using the extracted configuration
      const webAppPrompt = `Create a complete web application based on the following requirements and configuration:
  
      User requirements: ${prompt}
  
      Project configuration:
      - Project type: ${config.type}
      - Language: ${config.language}
      - Frontend framework: ${config.frontend?.framework || "react"}
      - Styling: ${config.frontend?.styling || "tailwind"}
      - Features to implement: ${JSON.stringify(
        config.frontend?.features || []
      )}
      ${
        config.type !== "frontend"
          ? `- Backend framework: ${config.backend?.framework || "express"}
      - Database: ${config.backend?.database || "none"}`
          : ""
      }
      - Project name: ${config.name}
  
      Structure your response like this:
      - First, write a paragraph or two explaining the web application, its features, and how it works
      - Then provide the complete code with proper file names as comments before each code block, like:
  
      // src/App.tsx
      import React from 'react';
      // Rest of code
  
      // src/components/Header.tsx
      import React from 'react';
      // Rest of code
  
      - Use ${config.frontend?.styling || "Tailwind CSS"} for styling
      - Include proper routing (${
        config.frontend?.framework === "nextjs"
          ? "App Router for Next.js"
          : "React Router for React"
      })
      - Organize code into separate components
      IMPORTANT: Always prepend each code block with a comment containing the file path, like "// src/App.tsx".`;

      const webAppResponse = await this.generateContent(webAppPrompt);

      // Then generate a mermaid diagram based on the generated code and configuration
      const mermaidPrompt = `Generate a Mermaid diagram that visualizes the key components and flow of the following web application.
  
      Project configuration:
      - Project type: ${config.type}
      - Frontend framework: ${config.frontend?.framework || "react"}
      ${
        config.type !== "frontend"
          ? `- Backend framework: ${config.backend?.framework || "express"}
      - Database: ${config.backend?.database || "none"}`
          : ""
      }
  
      Application code:
      \`\`\`
      ${webAppResponse.code || "No code generated."}
      \`\`\`
  
      Use graph TD notation with proper syntax. Use sequential letters (A, B, C, etc.) as node IDs, followed by descriptive labels in square brackets.
      The diagram should follow this pattern:
      A[ComponentName] --> B[ComponentName];
      B -- action --> C[ComponentName];
  
      Include both component connections with arrows and labeled actions between components.
      Show the data flow between frontend and backend components if applicable.
      Only return the Mermaid diagram code without any explanation. The diagram should be detailed and correctly formatted.`;

      const mermaidResponse = await this.generateContent(mermaidPrompt);

      // Create a fallback mermaid diagram if none was returned
      let finalMermaidCode = mermaidResponse.mermaidCode;
      if (!finalMermaidCode) {
        // Create a basic diagram as fallback based on the configuration
        if (config.type === "fullstack") {
          finalMermaidCode = `graph TD
            A[User] --> B[Frontend - ${config.frontend?.framework || "React"}]
            B --> C[API Routes]
            C --> D[Backend - ${config.backend?.framework || "Express"}]
            D --> E[Database - ${config.backend?.database || "None"}]
            E --> D
            D --> C
            C --> B`;
        } else if (config.type === "frontend") {
          finalMermaidCode = `graph TD
            A[User] --> B[Frontend App]
            B --> C[Components]
            C --> D[State Management]
            D --> C
            C --> E[API Services]
            E --> F[External APIs]
            F --> E
            E --> C`;
        } else {
          finalMermaidCode = `graph TD
            A[Client Request] --> B[API Routes]
            B --> C[Controllers]
            C --> D[Services]
            D --> E[Database - ${config.backend?.database || "None"}]
            E --> D
            D --> C
            C --> B
            B --> F[Client Response]`;
        }
      }

      // Always include the config in the response
      return {
        text: webAppResponse.text || "",
        code: webAppResponse.code || "",
        mermaidCode: finalMermaidCode,
        config: config, // Ensure config is always included
        error: webAppResponse.error || mermaidResponse.error,
      };
    } catch (error) {
      console.error("Error generating web app:", error);
      // Always provide a fallback config to prevent undefined errors
      const fallbackConfig: ProjectConfig = {
        type: "frontend",
        language: "typescript",
        name: "error-project",
        frontend: {
          framework: "react",
          styling: "tailwind",
          features: [],
        },
      };

      return {
        text: "Failed to generate the web application.",
        code: "",
        mermaidCode: "graph TD\n  A[Error] --> B[Error Occurred]",
        config: fallbackConfig,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}
