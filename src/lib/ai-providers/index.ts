import { GeminiProvider } from "./gemini";

export type AIProvider = "gemini" | "openai" | "claude" | "azure";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface AIResponse {
  text: string;
  code?: string;
  error?: string;
}

export class AIClient {
  private config: AIConfig;
  private geminiProvider?: GeminiProvider;

  constructor(config: AIConfig) {
    this.config = config;
    this.initProvider();
  }

  private initProvider() {
    switch (this.config.provider) {
      case "gemini":
        this.geminiProvider = new GeminiProvider({
          apiKey: this.config.apiKey,
          model: this.config.model,
        });
        break;
      // Add other providers as needed
      default:
        console.warn(`Provider ${this.config.provider} not implemented yet`);
    }
  }

  setProvider(provider: AIProvider): AIClient {
    this.config.provider = provider;
    this.initProvider();
    return this;
  }

  setModel(model: string): AIClient {
    this.config.model = model;
    this.initProvider();
    return this;
  }

  async generateApp(prompt: string): Promise<AIResponse> {
    switch (this.config.provider) {
      case "gemini":
        if (!this.geminiProvider) {
          return { text: "", error: "Gemini provider not initialized" };
        }
        return this.geminiProvider.generateWebApp(prompt);
      // Add other providers as needed
      default:
        return {
          text: "",
          error: `Provider ${this.config.provider} not implemented yet`,
        };
    }
  }

  async generateContent(prompt: string): Promise<AIResponse> {
    switch (this.config.provider) {
      case "gemini":
        if (!this.geminiProvider) {
          return { text: "", error: "Gemini provider not initialized" };
        }
        return this.geminiProvider.generateContent(prompt);
      // Add other providers as needed
      default:
        return {
          text: "",
          error: `Provider ${this.config.provider} not implemented yet`,
        };
    }
  }
}
