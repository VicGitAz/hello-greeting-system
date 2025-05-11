import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Code,
  Download,
  Laptop,
  Smartphone,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { TerminalService } from "@/lib/terminal-service";

export default function PreviewPanel() {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [devServerUrl, setDevServerUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Listen for code updates from the prompt panel
    const handleAppPreviewUpdate = (event: CustomEvent) => {
      setIsLoading(true);
      setGeneratedCode(event.detail.code);
      setTimeout(() => setIsLoading(false), 1000);
    };

    // Listen for dev server updates
    const handleDevServerStarted = (event: CustomEvent) => {
      if (event.detail && event.detail.url) {
        console.log("Dev server started:", event.detail.url);
        setDevServerUrl(event.detail.url);
        setIsLoading(false);
      }
    };

    document.addEventListener(
      "app-preview-update",
      handleAppPreviewUpdate as EventListener
    );
    document.addEventListener(
      "dev-server-started",
      handleDevServerStarted as EventListener
    );
    return () => {
      document.removeEventListener(
        "app-preview-update",
        handleAppPreviewUpdate as EventListener
      );
      document.removeEventListener(
        "dev-server-started",
        handleDevServerStarted as EventListener
      );
    };
  }, []);

  // Check for active dev server on component mount
  useEffect(() => {
    const activeServer = TerminalService.getActiveDevServer();
    if (activeServer) {
      setDevServerUrl(activeServer.url);
    }
  }, []);

  useEffect(() => {
    // If we have a dev server URL, use that in the iframe
    if (devServerUrl && iframeRef.current) {
      setIsLoading(true);
      const iframe = iframeRef.current;
      iframe.src = devServerUrl;
      
      // Add a load event listener to detect when the iframe has loaded
      const handleLoad = () => {
        setIsLoading(false);
      };
      
      iframe.addEventListener('load', handleLoad);
      return () => {
        iframe.removeEventListener('load', handleLoad);
      };
    }
    // Otherwise use the generated code
    else if (generatedCode && iframeRef.current && !devServerUrl) {
      const iframe = iframeRef.current;
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        try {
          // Handle file structure format or fallback to raw HTML
          if (generatedCode.includes("// src/") || generatedCode.includes("// components/")) {
            // Create a simple web app structure with the extracted files
            const files = parseFiles(generatedCode);
            
            // Build a basic HTML structure to show the app
            let htmlContent = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Generated App Preview</title>
                <style>
                  /* Reset and base styles */
                  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; }
                  * { box-sizing: border-box; }
                </style>
            `;
            
            // Add any CSS files
            const cssFiles = Object.entries(files).filter(([path]) => path.endsWith('.css'));
            cssFiles.forEach(([_, content]) => {
              htmlContent += `<style>${content}</style>`;
            });
            
            htmlContent += `</head><body>`;
            
            // Add HTML content if it exists
            const htmlFiles = Object.entries(files).filter(([path]) => path.endsWith('.html'));
            if (htmlFiles.length > 0) {
              htmlContent += htmlFiles[0][1]; // Use first HTML file content for body
            } else {
              // If no HTML files, just add a div for React to mount
              htmlContent += `<div id="root"></div>`;
            }
            
            // Add any JS files
            const jsFiles = Object.entries(files).filter(([path]) => 
              path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.tsx')
            );
            
            jsFiles.forEach(([_, content]) => {
              // For simplicity, we're just embedding the JS code directly
              // In a real implementation, you would want to properly handle React/JSX content
              htmlContent += `<script>\n/* JS content would be processed here in a real implementation */\n</script>`;
            });
            
            htmlContent += `</body></html>`;
            
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();
          } else {
            // Just use the code as-is if it's not in file format
            iframeDoc.open();
            iframeDoc.write(generatedCode);
            iframeDoc.close();
          }
        } catch (error) {
          console.error("Error updating iframe with generated code:", error);
          iframeDoc.open();
          iframeDoc.write(`
            <html>
              <body>
                <div style="color: red; padding: 20px;">
                  <h3>Error rendering preview</h3>
                  <p>${(error as Error).message}</p>
                </div>
              </body>
            </html>
          `);
          iframeDoc.close();
        }
      }
    }
  }, [generatedCode, isLoading, devServerUrl]);

  // Helper function to parse files from code with file path comments
  const parseFiles = (code: string): Record<string, string> => {
    const files: Record<string, string> = {};
    let currentFilePath: string | null = null;
    let currentFileContent: string[] = [];
    
    // Split the code by lines
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line is a file path comment (e.g., "// src/App.tsx")
      if (line.trimStart().startsWith('// ') && line.includes('.')) {
        // If we were collecting content for a previous file, save it
        if (currentFilePath) {
          files[currentFilePath] = currentFileContent.join('\n');
          currentFileContent = [];
        }
        
        // Extract path from comment
        const path = line.trimStart().replace('// ', '');
        if (path.includes('.')) { // Only treat as file path if it contains a dot
          currentFilePath = path;
        }
      } 
      // If not a path comment and we have a current file path, add to content
      else if (currentFilePath) {
        currentFileContent.push(line);
      }
    }
    
    // Don't forget to add the last file
    if (currentFilePath && currentFileContent.length > 0) {
      files[currentFilePath] = currentFileContent.join('\n');
    }
    
    return files;
  };

  const handleRefresh = () => {
    setIsLoading(true);
    
    // If we have a dev server URL, just reload the iframe
    if (devServerUrl && iframeRef.current) {
      const iframe = iframeRef.current;
      iframe.src = iframe.src;
      return;
    }
    
    setTimeout(() => {
      if (iframeRef.current && generatedCode) {
        const iframe = iframeRef.current;
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;

        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(generatedCode);
          iframeDoc.close();
        }
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleDownload = () => {
    if (!generatedCode) return;

    const blob = new Blob([generatedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated-app.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openInNewTab = () => {
    if (devServerUrl) {
      window.open(devServerUrl, "_blank");
      return;
    }
    
    if (!generatedCode) return;

    const blob = new Blob([generatedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm">
      <div className="p-3 border-b flex justify-between items-center">
        <div>
          <h3 className="font-medium text-lg">Live Preview</h3>
          <p className="text-sm text-muted-foreground">
            {devServerUrl ? "Connected to dev server" : "See your app in real-time"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "desktop" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setViewMode("desktop")}
            >
              <Laptop className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "mobile" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-0"
              onClick={() => setViewMode("mobile")}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openInNewTab}
            disabled={!generatedCode && !devServerUrl}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!generatedCode}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-muted/30 p-4 flex items-center justify-center overflow-auto">
        <div
          className={`bg-background border rounded-md shadow-sm overflow-hidden transition-all duration-300 ${
            viewMode === "mobile" ? "w-[375px] h-[667px]" : "w-full h-full"
          }`}
        >
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : devServerUrl || generatedCode ? (
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              title="Generated App Preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center">
              <div className="mb-4 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 17h6" />
                  <path d="M12 11v6" />
                  <path d="M11 7h.01" />
                  <path d="M17 7h.01" />
                  <path d="M7 7h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-medium">No Preview Available</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Generate an app using the prompt panel to see a live preview
                here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
