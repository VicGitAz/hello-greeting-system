import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAI } from "@/lib/ai-context";
import { Brain } from "lucide-react";

export default function AIConfigModal() {
  const { configureClient, provider, setProvider, isConfigured } = useAI();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-1.5-pro");
  const [open, setOpen] = useState(false);

  // Model options for each provider
  const modelOptions = {
    gemini: [
      { value: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro-exp-03-25", label: "Gemini 2.5 Pro" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { value: "gemini-pro", label: "Gemini Pro" },
    ],
    openai: [
      { value: "gpt-4", label: "GPT-4" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
    claude: [
      { value: "claude-3-opus", label: "Claude 3 Opus" },
      { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
      { value: "claude-3-haiku", label: "Claude 3 Haiku" },
    ],
    azure: [
      { value: "azure-gpt-4", label: "Azure GPT-4" },
      { value: "azure-gpt-35-turbo", label: "Azure GPT-3.5 Turbo" },
    ],
  };

  // Set default model when provider changes
  useEffect(() => {
    if (modelOptions[provider as keyof typeof modelOptions]) {
      setModel(modelOptions[provider as keyof typeof modelOptions][0].value);
    }
  }, [provider]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    configureClient(apiKey, provider, model);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isConfigured ? "outline" : "default"}
          className="gap-2 bg-background"
        >
          <Brain className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>AI Provider Configuration</DialogTitle>
          <DialogDescription>
            Enter your API key and select a model for your preferred AI
            provider.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as any)}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="openai" disabled>
                  OpenAI (Coming Soon)
                </SelectItem>
                <SelectItem value="claude" disabled>
                  Anthropic Claude (Coming Soon)
                </SelectItem>
                <SelectItem value="azure" disabled>
                  Azure OpenAI (Coming Soon)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions[provider as keyof typeof modelOptions]?.map(
                  (modelOption) => (
                    <SelectItem
                      key={modelOption.value}
                      value={modelOption.value}
                    >
                      {modelOption.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === "gemini"
                  ? "Enter your Gemini API key"
                  : "Enter API key"
              }
              required
            />
            {provider === "gemini" && (
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://ai.google.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!apiKey || !model}>
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
