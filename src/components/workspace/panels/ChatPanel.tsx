// chatpanel2.tsx
import React, { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Download, Settings, Loader } from "lucide-react";
import { useAuth } from "../../../../supabase/auth";
import ReactMarkdown from "react-markdown";
import { useAI } from "@/lib/ai-context";
import AIConfigModal from "./AIConfigModal";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Define custom components for react-markdown to apply styles and reduce spacing
const components = {
  p: ({ node, ...props }) => (
    // Apply a smaller bottom margin to paragraphs to control spacing between them
    <p className="mb-1" {...props} />
  ),
};

// Define message types for better organization
type MessageStatus = "complete" | "thinking" | "processing" | "error";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  status?: MessageStatus;
  processSteps?: string[];
};

export default function ChatPanel() {
  const { user } = useAuth();
  const { isConfigured, provider, model, isGenerating, generateApp } = useAI();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm WebSmith. How can I help you build your web application today?",
      sender: "ai",
      timestamp: new Date(),
      status: "complete",
    },
  ]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Listen for chat updates from the prompt panel
  useEffect(() => {
    const handleChatUpdate = (event: CustomEvent) => {
      const { id, content, sender, timestamp, status, processSteps } =
        event.detail;
      const newMessage: Message = {
        id: id || Date.now().toString(),
        content: content,
        sender: sender,
        timestamp: new Date(timestamp), // Parse the timestamp string
        status: status || "complete",
        processSteps: processSteps || [],
      };
      setMessages((prev) => [...prev, newMessage]);
    };

    // Add the event listener to document instead of window
    document.addEventListener("chat-update", handleChatUpdate as EventListener);
    return () => {
      document.removeEventListener(
        "chat-update",
        handleChatUpdate as EventListener
      );
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 100);
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || !isConfigured) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
      status: "complete",
    };

    setMessages((prev) => [...prev, userMessage]);

    // Clear input field
    const userQuery = input;
    setInput("");

    // Show thinking indicator
    const aiMessageId = Date.now() + 1;
    const aiMessage: Message = {
      id: aiMessageId.toString(),
      content: "",
      sender: "ai",
      timestamp: new Date(),
      status: "thinking",
      processSteps: ["Analyzing your request..."],
    };

    setMessages((prev) => [...prev, aiMessage]);

    try {
      // First update: Show processing
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId.toString()
              ? {
                  ...msg,
                  status: "processing",
                  processSteps: [
                    ...(msg.processSteps || []),
                    "Generating response...",
                  ],
                }
              : msg
          )
        );
      }, 1000);

      // Second update: Add another step
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId.toString()
              ? {
                  ...msg,
                  processSteps: [
                    ...(msg.processSteps || []),
                    "Formatting code and diagrams...",
                  ],
                }
              : msg
          )
        );
      }, 2000);

      // Send to AI and get response
      const enhancedPrompt = `
        Create a web application with the following requirements:\n
        ${userQuery}\n
        \n
        Include these features: Responseive Design\n
        Use either React or Next.js as the frontend framework, depending on the requirements.\n
        If the app needs server-side rendering, API routes, or would benefit from file-based routing, use Next.js.\n
        If it's a simpler client-side application, use React with React Router.\n
        Always use Tailwind CSS for styling.\n
        For backend needs, use Express.js with TypeScript.\n
        Organize the code into proper components and follow best practices for the chosen framework.\n
      `;
      const response = await generateApp(enhancedPrompt);

      // Dispatch event to create a new project
      const projectEvent = new CustomEvent("project-create", {
        detail: { config: response.config },
      });
      document.dispatchEvent(projectEvent);

      if (response.config) {
        try {
          // Create a project event with the full response
          const projectEvent = new CustomEvent("project-create", {
            detail: {
              response: response, // Pass the full response object
            },
          });
          document.dispatchEvent(projectEvent);
        } catch (error) {
          console.error("Error creating project:", error);
        }
      }

      // Final update: Complete response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId.toString()
            ? {
                ...msg,
                content:
                  response.text || "Sorry, I couldn't generate a response.",
                status: "complete",
                processSteps: [
                  ...(msg.processSteps || []),
                  "Response complete!",
                ],
              }
            : msg
        )
      );

      // Dispatch events to update other panels if response contains code or mermaid
      if (response.code) {
        const previewEvent = new CustomEvent("app-preview-update", {
          detail: { code: response.code },
        });
        document.dispatchEvent(previewEvent);
      }

      if (response.mermaidCode) {
        const mermaidCodeEvent = new CustomEvent("mermaid-code-update", {
          detail: { mermaidCode: response.mermaidCode },
        });
        document.dispatchEvent(mermaidCodeEvent);
      }
    } catch (error) {
      // Handle error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId.toString()
            ? {
                ...msg,
                content:
                  "Sorry, there was an error processing your request. Please try again.",
                status: "error",
                processSteps: [
                  ...(msg.processSteps || []),
                  "Error encountered!",
                ],
              }
            : msg
        )
      );
      console.error("Error generating response:", error);
    }
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;

    const chatText = messages
      .map(
        (msg) =>
          `[${msg.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}] ${msg.sender === "user" ? "You" : "AI"}: ${msg.content}`
      )
      .join("\n\n");

    const blob = new Blob([chatText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Renders the status indicator based on the message's status
  const renderStatusIndicator = (status?: MessageStatus) => {
    switch (status) {
      case "thinking":
        return (
          <div className="flex items-center gap-2 text-xs text-blue-500 mt-1">
            <Loader className="h-3 w-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        );
      case "processing":
        return (
          <div className="flex items-center gap-2 text-xs text-amber-500 mt-1">
            <Loader className="h-3 w-3 animate-spin" />
            <span>Processing...</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2 text-xs text-red-500 mt-1">
            <span>Error occurred</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm">
      <div className="p-3 border-b flex justify-between items-center">
        <div>
          <h3 className="font-medium text-lg">WebSmith</h3>
          <p className="text-sm text-muted-foreground">
            Chat with AI to refine your app
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportChat}
            disabled={messages.length <= 1}
            className="bg-background"
          >
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`${
                  message.sender === "user"
                    ? "border p-3 rounded-lg max-w-[80%] "
                    : "w-full px-4"
                }`}
              >
                {message.sender === "ai" && (
                  <div className="flex items-center mb-2">
                    <Avatar className="h-6 w-6 mr-2">
                      <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=ai" />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">WebSmith</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-tight">
                  <ReactMarkdown components={components}>
                    {message.content}
                  </ReactMarkdown>
                </div>

                {/* Status indicator for AI messages */}
                {message.sender === "ai" &&
                  renderStatusIndicator(message.status)}

                {/* Processing steps for AI messages */}
                {message.sender === "ai" &&
                  message.processSteps &&
                  message.processSteps.length > 0 &&
                  message.status !== "complete" && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <ul className="list-disc pl-4 space-y-1">
                        {message.processSteps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <span
                  className={`text-xs opacity-70 block mt-1 ${
                    message.sender === "user" ? "text-right" : "text-left"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the WebSmith..."
            className="flex-1"
            disabled={isGenerating}
          />
          <AIConfigModal />
          <Button
            type="submit"
            size="icon"
            disabled={isGenerating || !input.trim() || !isConfigured}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
