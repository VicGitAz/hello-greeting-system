import React, { createContext, useContext, useState, useEffect } from "react";
import {
  AIClient,
  AIConfig,
  AIProvider as AIProviderType,
} from "./ai-providers";
import { useToast } from "@/components/ui/use-toast";
import { ProjectConfig } from "./project-generator";

interface AIContextType {
  client: AIClient | null;
  isConfigured: boolean;
  provider: AIProviderType;
  model: string;
  setProvider: (provider: AIProviderType) => void;
  configureClient: (
    apiKey: string,
    provider?: AIProviderType,
    model?: string
  ) => void;
  isGenerating: boolean;
  generateApp: (prompt: string) => Promise<{
    text: string;
    code?: string;
    error?: string;
    mermaidCode?: string;
    config?: ProjectConfig;
  }>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<AIClient | null>(null);
  const [provider, setProvider] = useState<AIProviderType>("gemini");
  const [model, setModel] = useState<string>("gemini-1.5-pro");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Check for stored API key on mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem("ai_api_key");
    const storedProvider =
      (localStorage.getItem("ai_provider") as AIProviderType) || "gemini";
    const storedModel = localStorage.getItem("ai_model") || "gemini-1.5-pro";

    if (storedApiKey) {
      configureClient(storedApiKey, storedProvider, storedModel);
    }
  }, []);

  const configureClient = (
    apiKey: string,
    newProvider?: AIProviderType,
    newModel?: string
  ) => {
    try {
      const providerToUse = newProvider || provider;
      const modelToUse = newModel || model;

      const config: AIConfig = {
        provider: providerToUse,
        apiKey: apiKey,
        model: modelToUse,
      };

      const newClient = new AIClient(config);
      setClient(newClient);
      setProvider(providerToUse);
      setModel(modelToUse);

      // Store API key, provider and model in localStorage
      localStorage.setItem("ai_api_key", apiKey);
      localStorage.setItem("ai_provider", providerToUse);
      localStorage.setItem("ai_model", modelToUse);

      toast({
        title: "AI Provider Configured",
        description: `Successfully configured ${providerToUse} with model ${modelToUse}.`,
      });
    } catch (error) {
      console.error("Error configuring AI client:", error);
      toast({
        title: "Configuration Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to configure AI provider",
        variant: "destructive",
      });
    }
  };

  const generateApp = async (prompt: string) => {
    if (!client) {
      return { text: "", error: "AI client not configured" };
    }

    setIsGenerating(true);
    try {
      const result = await client.generateApp(prompt);
      return result;
    } catch (error) {
      console.error("Error generating app:", error);
      return {
        text: "",
        error:
          error instanceof Error ? error.message : "Failed to generate app",
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AIContext.Provider
      value={{
        client,
        isConfigured: !!client,
        provider,
        model,
        setProvider: (newProvider) => {
          setProvider(newProvider);
          if (client) {
            const apiKey = localStorage.getItem("ai_api_key") || "";
            const currentModel = localStorage.getItem("ai_model") || model;
            configureClient(apiKey, newProvider, currentModel);
          }
        },
        configureClient,
        isGenerating,
        generateApp,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
}
