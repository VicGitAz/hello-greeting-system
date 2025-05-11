import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

export default function FlowPanel() {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [mermaidCode, setMermaidCode] = useState<string>(``);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);

  // Listen for flow diagram updates
  useEffect(() => {
    const handleFlowDiagramUpdate = (event: CustomEvent) => {
      setIsLoading(true);
      const { flowDiagram } = event.detail;

      if (flowDiagram) {
        // If the event provides Mermaid code instead of rendered SVG
        setMermaidCode(flowDiagram);
        renderMermaid(flowDiagram);
      } else {
        setTimeout(() => setIsLoading(false), 500);
      }
    };

    const handleMermaidCodeUpdate = (event: CustomEvent) => {
      const { mermaidCode } = event.detail;
      if (mermaidCode) {
        setMermaidCode(mermaidCode);
        renderMermaid(mermaidCode);
      }
    };

    // Add both event listeners
    document.addEventListener(
      "flow-diagram-update",
      handleFlowDiagramUpdate as EventListener
    );

    document.addEventListener(
      "mermaid-code-update",
      handleMermaidCodeUpdate as EventListener
    );

    // Clean up both event listeners
    return () => {
      document.removeEventListener(
        "flow-diagram-update",
        handleFlowDiagramUpdate as EventListener
      );
      document.removeEventListener(
        "mermaid-code-update",
        handleMermaidCodeUpdate as EventListener
      );
    };
  }, []);

  // Initial render
  useEffect(() => {
    renderMermaid(mermaidCode);
  }, []);

  // Effect to apply rendered SVG when it changes
  useEffect(() => {
    if (renderedSvg && mermaidRef.current) {
      mermaidRef.current.innerHTML = renderedSvg;
    }
  }, [renderedSvg]);

  const renderMermaid = async (code: string) => {
    setIsLoading(true);

    // Add condition to prevent rendering if code is empty
    if (!code || code.trim() === "") {
      setRenderedSvg(null); // Clear previous SVG
      setIsLoading(false);
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = `
          <div class="h-full w-full flex items-center justify-center text-muted-foreground text-lg">
            Build an App for workflow
          </div>
        `;
      }
      return; // Exit the function
    }

    try {
      // Dynamically import mermaid
      const mermaidModule = await import("mermaid");
      const mermaid = mermaidModule.default;

      // Initialize mermaid with appropriate settings
      mermaid.initialize({
        startOnLoad: false, // Important: Don't auto-render on page load
        theme: "neutral",
        securityLevel: "loose",
        fontFamily: "sans-serif",
      });

      // Generate a unique ID for this render
      const id = `mermaid-${Date.now()}`;

      try {
        // Use mermaid.render() to get the SVG
        const { svg } = await mermaid.render(id, code);

        // Store the SVG in state to persist across tab switches
        setRenderedSvg(svg);

        // Insert the SVG directly into the container
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = svg;

          // Adjust SVG styling for proper display
          const svgElement = mermaidRef.current.querySelector("svg");
          if (svgElement) {
            svgElement.style.maxWidth = "100%";
            svgElement.style.height = "100%";
            svgElement.style.display = "block";
            svgElement.style.margin = "0 auto";

            // Add viewBox if missing for better scaling
            if (
              !svgElement.hasAttribute("viewBox") &&
              svgElement.hasAttribute("width") &&
              svgElement.hasAttribute("height")
            ) {
              const width = svgElement.getAttribute("width") || "800";
              const height = svgElement.getAttribute("height") || "600";
              svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
            }
          }
        }
      } catch (renderError) {
        console.error("Mermaid render error:", renderError);
        // Display error message with code preview
        const errorHtml = `
          <div class="p-4 border border-red-300 bg-red-50 rounded-md text-red-800">
            <p class="font-medium">Error rendering diagram</p>
            <p class="text-sm mt-1">Please check your Mermaid syntax.</p>
            <pre class="text-xs mt-2 p-2 bg-white border rounded">${renderError.toString()}</pre>
          </div>
        `;

        setRenderedSvg(errorHtml);

        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = errorHtml;
        }
      }
    } catch (error) {
      console.error("Error loading mermaid:", error);
      const fallbackContent = `
        <div class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="text-sm text-muted-foreground mb-2">Flow Diagram Preview</div>
            <div class="border rounded-lg p-4 bg-muted/30">
              <pre class="text-xs text-left">${code}</pre>
            </div>
            <div class="mt-2 text-sm text-red-600">
              Error loading Mermaid library. Check console for details.
            </div>
          </div>
        </div>
      `;

      setRenderedSvg(fallbackContent);

      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = fallbackContent;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));
  };

  // Handle wheel events for zooming
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoomLevel = Math.max(0.5, Math.min(2, zoomLevel + delta));
      setZoomLevel(newZoomLevel);
    }
  };

  const handleRefresh = () => {
    renderMermaid(mermaidCode);
  };

  const handleExport = () => {
    const svgElement = mermaidRef.current?.querySelector("svg");
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "flow-diagram.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Fallback to text export if SVG is not available
      const blob = new Blob([mermaidCode], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "flow-diagram.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm">
      <div className="p-3 border-b flex justify-between items-center">
        <div>
          <h3 className="font-medium text-lg">Flow Diagram</h3>
          <p className="text-sm text-muted-foreground">
            Visualize app structure
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 2}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPanPosition({ x: 0, y: 0 });
            }}
            title="Reset Pan Position"
          >
            <span className="flex items-center justify-center h-4 w-4">⊕</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="diagram" className="flex-1 overflow-y-auto">
        <div className="px-3 pt-2">
          <TabsList>
            <TabsTrigger value="diagram">Diagram</TabsTrigger>
            <TabsTrigger value="code">Mermaid Code</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="diagram"
          className="flex-1 p-3"
          style={{ height: "calc(100% - 42px)" }}
        >
          {!mermaidCode || mermaidCode.trim() === "" ? (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-lg">
              Build an App for workflow
            </div>
          ) : isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div
              className="h-full overflow-hidden flex items-center justify-center relative"
              onMouseDown={(e) => {
                if (e.button === 0) {
                  // Left mouse button
                  setIsPanning(true);
                  setStartPanPosition({ x: e.clientX, y: e.clientY });
                }
              }}
              onMouseMove={(e) => {
                if (isPanning) {
                  setPanPosition((prev) => ({
                    x: prev.x + (e.clientX - startPanPosition.x) / zoomLevel,
                    y: prev.y + (e.clientY - startPanPosition.y) / zoomLevel,
                  }));
                  setStartPanPosition({ x: e.clientX, y: e.clientY });
                }
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
              onWheel={handleWheel}
              style={{
                cursor: isPanning ? "grabbing" : "grab",
                userSelect: "none",
              }}
            >
              <div
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x}px, ${panPosition.y}px)`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.2s ease",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div ref={mermaidRef} className="h-full w-full max-w-full" />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="p-3">
          <div className="border rounded bg-muted p-3 h-64 overflow-auto">
            <textarea
              className="w-full h-full text-xs font-mono resize-none bg-transparent outline-none"
              value={mermaidCode}
              onChange={(e) => setMermaidCode(e.target.value)}
              spellCheck="false"
            ></textarea>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Edit the Mermaid code above and use the Refresh button at the top to
            update the diagram.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
