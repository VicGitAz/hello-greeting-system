import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Wand2 } from "lucide-react";
import { useAI } from "@/lib/ai-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AIConfigModal from "./AIConfigModal";
import mermaid from "mermaid";

export default function PromptPanel() {
  const { isConfigured, provider, model, isGenerating, generateApp } = useAI();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{
    text: string;
    code?: string;
    error?: string;
    mermaidCode?: string;
  } | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    "responsive",
  ]);

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: "neutral",
      securityLevel: "loose",
    });
  }, []);

  // Render mermaid diagram when result.mermaidCode changes
  useEffect(() => {
    if (result?.mermaidCode) {
      try {
        mermaid.render("flow-diagram", result.mermaidCode).then(({ svg }) => {
          // Dispatch event with the SVG
          const flowEvent = new CustomEvent("flow-diagram-update", {
            detail: { flowDiagram: svg },
          });
          document.dispatchEvent(flowEvent);

          // Add this new event dispatch for the mermaid code
          const mermaidCodeEvent = new CustomEvent("mermaid-code-update", {
            detail: { mermaidCode: result.mermaidCode },
          });
          document.dispatchEvent(mermaidCodeEvent);
        });
      } catch (error) {
        console.error("Error rendering mermaid diagram:", error);
      }
    }
  }, [result?.mermaidCode]);

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !isConfigured) return;

    // Add a message to the chat
    const userChatEvent = new CustomEvent("chat-update", {
      detail: {
        sender: "user",
        content: prompt,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
      },
    });
    document.dispatchEvent(userChatEvent);

    // Enhance prompt with selected features
    const enhancedPrompt = `
      Create a web application with the following requirements:\n
      ${prompt}\n
      \n
      Include these features: ${selectedFeatures.join(", ")}\n
    `;

    const response = await generateApp(enhancedPrompt);
    console.log("mermaid code:", response.mermaidCode);
    setResult(response);

    // Add AI response to chat
    const aiChatEvent = new CustomEvent("chat-update", {
      detail: {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        content:
          response.text ||
          "I've processed your request, but there was an issue generating the application.",
        timestamp: new Date().toISOString(),
      },
    });
    document.dispatchEvent(aiChatEvent);

    // Send the generated code to the preview panel
    if (response.code) {
      const previewEvent = new CustomEvent("app-preview-update", {
        detail: { code: response.code },
      });
      document.dispatchEvent(previewEvent);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border shadow-sm">
      <div className="p-3 border-b">
        <h3 className="font-medium text-lg">App Generator</h3>
        <p className="text-sm text-muted-foreground">
          Describe the web app you want to build
        </p>
      </div>

      <Tabs defaultValue="prompt" className="flex-1 flex flex-col">
        <div className="px-3 pt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="prompt"
          className="flex-1 flex flex-col p-3 space-y-4"
        >
          {!isConfigured && (
            <Alert variant="warning" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>AI Provider Not Configured</AlertTitle>
              <AlertDescription>
                Please configure your AI provider to generate web applications.
                <div className="mt-2">
                  <AIConfigModal />
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium">
                {isConfigured ? (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Using {provider} / {model}
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    Not configured
                  </span>
                )}
              </div>
            </div>
            <AIConfigModal />
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the web app you want to build..."
            className="flex-1 min-h-[200px] text-base"
          />

          {result?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating || !isConfigured}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin mr-2">⚙️</span> Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" /> Generate App
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="p-3 space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Features</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={
                  selectedFeatures.includes("auth") ? "default" : "outline"
                }
                className="justify-start"
                onClick={() => toggleFeature("auth")}
              >
                Authentication
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("database") ? "default" : "outline"
                }
                className="justify-start"
                onClick={() => toggleFeature("database")}
              >
                Database
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("api") ? "default" : "outline"
                }
                className="justify-start"
                onClick={() => toggleFeature("api")}
              >
                API Integration
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("upload") ? "default" : "outline"
                }
                className="justify-start"
                onClick={() => toggleFeature("upload")}
              >
                File Upload
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("darkmode") ? "default" : "outline"
                }
                className="justify-start"
                onClick={() => toggleFeature("darkmode")}
              >
                Dark Mode
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("responsive")
                    ? "default"
                    : "outline"
                }
                className="justify-start"
                onClick={() => toggleFeature("responsive")}
              >
                Responsive Design
              </Button>
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <h4 className="font-medium">Example Prompts</h4>
            <div className="space-y-2">
              <div
                className="p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  setPrompt(
                    "Create a personal portfolio website with a hero section, about me, skills, projects, and contact form."
                  )
                }
              >
                <p className="font-medium">Portfolio Website</p>
                <p className="text-sm text-gray-500">
                  Personal portfolio with projects showcase
                </p>
              </div>
              <div
                className="p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  setPrompt(
                    "Build a task management app with the ability to create, edit, and delete tasks. Include task categories and priority levels."
                  )
                }
              >
                <p className="font-medium">Task Manager</p>
                <p className="text-sm text-gray-500">
                  Simple todo/task management application
                </p>
              </div>
              <div
                className="p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  setPrompt(
                    "Create a weather dashboard that shows current weather and 5-day forecast for a city. Include temperature, humidity, and wind speed."
                  )
                }
              >
                <p className="font-medium">Weather Dashboard</p>
                <p className="text-sm text-gray-500">
                  Weather forecast application
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
