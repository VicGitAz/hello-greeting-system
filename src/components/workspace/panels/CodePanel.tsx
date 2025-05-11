import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  FileCode,
  Copy,
  Download,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Save,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import "devicon/devicon.min.css";

// Dynamically import Monaco Editor to prevent SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      Loading editor...
    </div>
  ),
});

export default function CodePanel() {
  const [selectedFile, setSelectedFile] = useState("index.html");
  const [openFiles, setOpenFiles] = useState(["index.html"]);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [parsedFiles, setParsedFiles] = useState({
    "index.html": "<!-- No code generated yet -->",
  });
  const [editorTheme, setEditorTheme] = useState("vs-light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();
  const editorRef = useRef(null);
  // State to track files with unsaved changes
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());
  // Ref to hold the latest selectedFile for event listeners
  const selectedFileRef = useRef(selectedFile);

  // Update the ref whenever selectedFile changes
  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  // Update editor theme based on document theme
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setEditorTheme(isDarkMode ? "vs-dark" : "vs-light");

    // Create a mutation observer to watch for class changes on the html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          const isDarkMode =
            document.documentElement.classList.contains("dark");
          setEditorTheme(isDarkMode ? "vs-dark" : "vs-light");
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const getDeviconClass = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    switch (ext) {
      case "html":
        return "devicon-html5-plain colored";
      case "css":
        return "devicon-css3-plain colored";
      case "js":
      case "jsx":
        return "devicon-javascript-plain colored";
      case "ts":
      case "tsx":
        return "devicon-typescript-plain colored";
      case "json":
        return "devicon-nodejs-plain colored";
      case "md":
        return "devicon-markdown-original colored";
      default:
        return "devicon-code-plain";
    }
  };

  // Get language based on file extension
  const getLanguage = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    if (ext === "html") return "html";
    if (ext === "css") return "css";
    if (ext === "js") return "javascript";
    if (ext === "jsx") return "javascript";
    if (ext === "ts") return "typescript";
    if (ext === "tsx") return "typescript";
    if (ext === "json") return "json";
    if (ext === "md") return "markdown";
    return "plaintext";
  };

  useEffect(() => {
    // Listen for code updates from the prompt panel
    const handleAppPreviewUpdate = (event) => {
      setGeneratedCode(event.detail.code);
      parseCodeIntoFiles(event.detail.code);
    };

    document.addEventListener("app-preview-update", handleAppPreviewUpdate);
    return () => {
      document.removeEventListener(
        "app-preview-update",
        handleAppPreviewUpdate
      );
    };
  }, []);

  const parseCodeIntoFiles = (code) => {
    // Default to a single HTML file if no clear separation
    const files = {
      "index.html": code,
    };

    // Try to extract CSS and JavaScript if they're in separate blocks
    const cssMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const jsMatch = code.match(/<script[^>]*>([\s\S]*?)<\/script>/i);

    if (cssMatch && cssMatch[1]) {
      files["styles.css"] = cssMatch[1].trim();
    }

    if (jsMatch && jsMatch[1]) {
      files["script.js"] = jsMatch[1].trim();
    }

    setParsedFiles(files);
    setSelectedFile("index.html");
    setOpenFiles(["index.html"]);
    // Clear unsaved state when new code is generated
    setUnsavedChanges(new Set());
  };

  const handleCopyCode = () => {
    if (!parsedFiles[selectedFile]) return;

    navigator.clipboard.writeText(parsedFiles[selectedFile]);
    toast({
      title: "Code copied",
      description: `${selectedFile} copied to clipboard`,
    });
  };

  const handleDownloadCode = () => {
    if (!parsedFiles[selectedFile]) return;

    const blob = new Blob([parsedFiles[selectedFile]], {
      type: selectedFile.endsWith(".html")
        ? "text/html"
        : selectedFile.endsWith(".css")
        ? "text/css"
        : "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
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

  // Handle editor mounting
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add Ctrl+S command to trigger preview update and clear unsaved state
    const saveCommandDisposable = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        const currentFile = selectedFileRef.current;
        const editorValue = editor.getValue();

        // Dispatch event with the updated code for live preview
        const previewEvent = new CustomEvent("app-preview-update", {
          detail: { code: editorValue },
        });
        document.dispatchEvent(previewEvent);

        // Update parsedFiles state with the saved content
        // This ensures parsedFiles reflects the content that was just 'saved' and dispatched
        setParsedFiles((prev) => ({
          ...prev,
          [currentFile]: editorValue,
        }));

        // Remove unsaved changes indicator for the saved file
        setUnsavedChanges((prev) => {
          const next = new Set(prev);
          next.delete(currentFile);
          return next;
        });

        // Show a toast notification for saving
        toast({
          title: "File saved",
          description: `${currentFile} saved`,
        });

        // Prevent default browser save dialog
        return true; // Signal that the command handled the event
      }
    );

    // Clean up the command when the component unmounts (if necessary, though editor mounting is rare)
    // return () => {
    //   saveCommandDisposable.dispose();
    // };
  };

  // Handle code changes in the editor
  const handleEditorChange = (value) => {
    const currentFile = selectedFileRef.current; // Use ref for latest selected file
    setParsedFiles((prev) => ({
      ...prev,
      [currentFile]: value,
    }));
    // Mark file as unsaved
    setUnsavedChanges((prev) => new Set(prev).add(currentFile));
    // REMOVED: Dispatch event with the updated code for live preview
    // const previewEvent = new CustomEvent("app-preview-update", {
    //   detail: { code: value },
    // });
    // document.dispatchEvent(previewEvent);
  };

  // Toggle editor theme
  const toggleTheme = () => {
    setEditorTheme((prev) => (prev === "vs-light" ? "vs-dark" : "vs-light"));
  };

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  // Get file extension abbreviation
  const getFileExtAbbr = (filename) => {
    return filename.split(".").pop().toUpperCase();
  };

  // Open a file in editor
  const openFile = (filename) => {
    setSelectedFile(filename);
    if (!openFiles.includes(filename)) {
      setOpenFiles((prev) => [...prev, filename]);
    }
  };

  // Close a file tab
  const closeFileTab = (filename, e) => {
    e.stopPropagation();

    // Remove the file from open files
    const newOpenFiles = openFiles.filter((file) => file !== filename);

    // ALSO remove the file from unsaved changes
    setUnsavedChanges((prev) => {
      const next = new Set(prev);
      next.delete(filename);
      return next;
    });

    setOpenFiles(newOpenFiles);

    // If we're closing the currently selected file, select another one
    if (selectedFile === filename && newOpenFiles.length > 0) {
      setSelectedFile(newOpenFiles[0]);
    } else if (
      newOpenFiles.length === 0 &&
      Object.keys(parsedFiles).length > 0
    ) {
      // If no tabs are open but files exist, open the first file
      const firstFile = Object.keys(parsedFiles)[0];
      setOpenFiles([firstFile]);
      setSelectedFile(firstFile);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm overflow-hidden">
      <div className="p-3 border-b flex justify-between items-center">
        <div>
          <h3 className="font-medium text-lg">Code Editor</h3>
          <p className="text-sm text-muted-foreground">
            Edit code and use terminal
          </p>
        </div>
        <div className="flex gap-2">
          {/* Copy and Download buttons now work with the currently active tab's content */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            disabled={!parsedFiles[selectedFile]} // Disable if no content for selected file
          >
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCode}
            disabled={!parsedFiles[selectedFile]} // Disable if no content for selected file
          >
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        </div>
      </div>

      {/* Editor Section */}
      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={60} minSize={20}>
          <div className="flex relative overflow-hidden transition-all duration-200 h-full">
            {/* Collapsible sidebar with integrated toggle button */}
            <div className="relative flex h-full">
              {/* Sidebar content */}
              <div
                className={`transition-all duration-300 border-r bg-white dark:bg-gray-900 ${
                  sidebarCollapsed
                    ? "w-0 opacity-0 overflow-hidden"
                    : "w-48 opacity-100"
                }`}
              >
                <div className="p-2 overflow-auto h-full bg-background">
                  <h4 className="text-sm font-medium mb-2 px-2">Files</h4>
                  <div className="space-y-1">
                    {Object.keys(parsedFiles).map((file) => (
                      <Button
                        key={file}
                        variant={selectedFile === file ? "secondary" : "ghost"}
                        className="w-full justify-start text-sm h-8"
                        onClick={() => openFile(file)}
                      >
                        <FileCode className="h-4 w-4 mr-2" />
                        {file}
                      </Button>
                    ))}
                  </div>

                  {/* Download All button downloads the initially generated code */}
                  {generatedCode && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                        onClick={handleDownloadAll}
                      >
                        <Download className="h-4 w-4 mr-1" /> Download All HTML
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle sidebar button - attached to the sidebar */}
              <button
                className={`h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border-t border-b border-r border-gray-200 dark:border-gray-700 transition-all duration-300 text-gray-600 dark:text-gray-300 ${
                  sidebarCollapsed ? "rounded-r-md" : ""
                }`}
                onClick={toggleSidebar}
                style={{
                  width: "16px",
                  position: sidebarCollapsed ? "relative" : "absolute",
                  left: sidebarCollapsed ? "0" : "192px",
                  top: sidebarCollapsed ? "auto" : "0",
                }}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between bg-gray-100 dark:bg-background px-2 border-b">
                <div className="flex items-center overflow-x-auto">
                  {openFiles.map((file) => (
                    <div
                      key={file}
                      className={`flex items-center h-8 px-3 text-xs ${
                        selectedFile === file
                          ? "bg-white dark:bg-gray-900 border-t border-r border-l border-gray-200 dark:border-gray-700 border-b-0 rounded-t"
                          : "text-gray-600 dark:text-gray-400"
                      } cursor-pointer`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <span
                        className={`flex items-center gap-2 ${
                          selectedFile === file
                            ? "text-blue-600 dark:text-blue-400"
                            : ""
                        }`}
                      >
                        <i className={`${getDeviconClass(file)} text-sm`}></i>
                        {file}
                        {/* Unsaved indicator - using CircleDot icon */}
                        {unsavedChanges.has(file) && (
                          <Save className="ml-1 h-3 w-3 text-black" />
                        )}
                      </span>
                      <button
                        className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={(e) => closeFileTab(file, e)}
                      >
                        <span className="text-xs">×</span>
                      </button>
                    </div>
                  ))}
                </div>
                {/* Maximize button placeholder if needed */}
                {/* <div><Maximize className="h-4 w-4 text-gray-600 dark:text-gray-400" /></div> */}
              </div>

              {/* Monaco editor - Always render */}
              <div className="flex-1">
                <MonacoEditor
                  height="100%"
                  language={getLanguage(selectedFile)}
                  value={parsedFiles[selectedFile] || ""}
                  theme={editorTheme}
                  onChange={handleEditorChange}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: true },
                    scrollBeyondLastLine: true,
                    fontSize: 14,
                    wordWrap: "on",
                    automaticLayout: true,
                    readOnly: false,
                    lineNumbers: "on",
                    folding: true,
                    renderLineHighlight: "all",
                    scrollbar: {
                      useShadows: false,
                      verticalHasArrows: false,
                      horizontalHasArrows: false,
                      vertical: "visible",
                      horizontal: "visible",
                    },
                    lineNumbersMinChars: 3,
                    padding: {
                      top: 12,
                      bottom: 12,
                    },
                    // Add placeholder option if supported by monaco-editor/react or handle empty state within Monaco
                  }}
                />
                {/* Removed the conditional rendering for the "No files open" message */}
                {/* Replaced with Monaco editor always rendering */}
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
