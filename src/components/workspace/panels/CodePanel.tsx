
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
  FileCode,
  Copy,
  Download,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Save,
  Plus,
  Folder,
  File,
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
  // State for file tree structure
  const [fileTree, setFileTree] = useState({});

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
      if (event.detail.code) {
        setGeneratedCode(event.detail.code);
        parseCodeIntoFiles(event.detail.code);
      }
    };

    document.addEventListener("app-preview-update", handleAppPreviewUpdate);
    return () => {
      document.removeEventListener("app-preview-update", handleAppPreviewUpdate);
    };
  }, []);

  // Build file tree from flat paths
  const buildFileTree = (files) => {
    const tree = {};
    
    Object.keys(files).forEach(path => {
      const parts = path.split('/');
      let currentLevel = tree;
      
      // Process each part of the path
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Skip empty parts
        if (!part) continue;
        
        // If this is the last part (file)
        if (i === parts.length - 1) {
          currentLevel[part] = { type: 'file', path };
        } else {
          // This is a directory
          if (!currentLevel[part]) {
            currentLevel[part] = { type: 'directory', children: {} };
          }
          currentLevel = currentLevel[part].children;
        }
      }
    });
    
    return tree;
  };

  const parseCodeIntoFiles = (code) => {
    // Check if the code is a string
    if (typeof code !== 'string') {
      console.error("Code is not a string:", code);
      return;
    }

    try {
      // Improved regex to detect file path comments like "// src/App.tsx"
      // This handles both comment formats: "// src/App.tsx" and "// src/App.tsx Content..."
      const filePathPattern = /\/\/\s+([^\n]+\.[a-zA-Z0-9]+)(?:\s*|\n|$)([\s\S]*?)(?=\/\/\s+[^\n]+\.[a-zA-Z0-9]+(?:\s*|\n|$)|$)/g;
      
      const files = {};
      let match;
      let foundFiles = false;
      
      // Clone the code string to avoid modifying the original
      let codeToProcess = code;
      
      while ((match = filePathPattern.exec(codeToProcess)) !== null) {
        const filePath = match[1].trim();
        // Get content, but trim whitespace and remove any leading/trailing comments
        let content = match[2] ? match[2].trim() : "";
        
        // Clean up the content if needed
        if (content.startsWith("// ")) {
          const lines = content.split("\n");
          if (lines[0].trim().startsWith("// ")) {
            lines.shift(); // Remove the first line if it's a comment
            content = lines.join("\n");
          }
        }
        
        if (filePath) {
          files[filePath] = content;
          foundFiles = true;
        }
      }
      
      if (foundFiles && Object.keys(files).length > 0) {
        setParsedFiles(files);
        setFileTree(buildFileTree(files));
        
        // Open the first file by default
        const firstFile = Object.keys(files)[0];
        setSelectedFile(firstFile);
        setOpenFiles([firstFile]);
        
        // Clear unsaved state when new code is generated
        setUnsavedChanges(new Set());
        return;
      }
      
      // Fallback: If no structured file paths found, treat as a single HTML file
      setParsedFiles({
        "index.html": code,
      });
      setFileTree(buildFileTree({ "index.html": code }));
      setSelectedFile("index.html");
      setOpenFiles(["index.html"]);
      setUnsavedChanges(new Set());
      
    } catch (error) {
      console.error("Error parsing code into files:", error);
      // Fallback to treating the entire code as a single HTML file
      setParsedFiles({
        "index.html": code || "<!-- Error parsing code -->",
      });
      setFileTree(buildFileTree({ "index.html": code }));
      setSelectedFile("index.html");
      setOpenFiles(["index.html"]);
    }
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
    if (!parsedFiles || Object.keys(parsedFiles).length === 0) return;

    // Use JSZip to create a zip file with the project structure
    import("jszip").then((JSZip) => {
      const zip = new JSZip.default();
      
      // Add all files to the zip with their folder structure
      Object.entries(parsedFiles).forEach(([path, content]) => {
        zip.file(path, content);
      });
      
      // Generate the zip file
      zip.generateAsync({ type: "blob" }).then((content) => {
        // Create download link
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = "project.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }).catch(error => {
      console.error("Error creating zip file:", error);
      toast({
        title: "Download failed",
        description: "Could not create zip file",
        variant: "destructive"
      });
    });
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

        return true; // Signal that the command handled the event
      }
    );
  };

  // Handle code changes in the editor
  const handleEditorChange = (value) => {
    const currentFile = selectedFileRef.current;
    setParsedFiles((prev) => ({
      ...prev,
      [currentFile]: value,
    }));
    // Mark file as unsaved
    setUnsavedChanges((prev) => new Set(prev).add(currentFile));
  };

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
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

  // Render file tree recursively
  const renderFileTree = (tree, basePath = "") => {
    return Object.entries(tree).map(([name, item]) => {
      const path = basePath ? `${basePath}/${name}` : name;
      
      if (item.type === 'file') {
        return (
          <div 
            key={item.path}
            onClick={() => openFile(item.path)}
            className={`pl-2 py-1 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center ${
              selectedFile === item.path ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
            }`}
          >
            <File className="h-4 w-4 mr-2" />
            {name}
          </div>
        );
      }
      
      if (item.type === 'directory') {
        return (
          <div key={path} className="pl-2">
            <div className="flex items-center py-1 text-sm font-medium">
              <Folder className="h-4 w-4 mr-2" />
              {name}
            </div>
            <div className="pl-2 border-l border-gray-200 dark:border-gray-700 ml-2">
              {renderFileTree(item.children, path)}
            </div>
          </div>
        );
      }
      
      return null;
    });
  };

  // Function to handle the "Save All & Preview" button
  const handleSaveAndPreview = () => {
    // Get all the code as a string
    let allCode = '';
    Object.entries(parsedFiles).forEach(([path, content]) => {
      allCode += `// ${path}\n${content}\n\n`;
    });
    
    // Dispatch the event with all code for preview
    const previewEvent = new CustomEvent("app-preview-update", {
      detail: { code: allCode },
    });
    document.dispatchEvent(previewEvent);
    
    // Clear all unsaved changes
    setUnsavedChanges(new Set());
    
    toast({
      title: "All files saved",
      description: "Preview updated with all files"
    });
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm overflow-hidden">
      <div className="p-3 border-b flex justify-between items-center">
        <div>
          <h3 className="font-medium text-lg">Code Editor</h3>
          <p className="text-sm text-muted-foreground">
            Edit code and view project files
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            disabled={!parsedFiles[selectedFile]}
          >
            <Copy className="h-4 w-4 mr-1" /> Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCode}
            disabled={!parsedFiles[selectedFile]}
          >
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
          {Object.keys(parsedFiles).length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
            >
              <Download className="h-4 w-4 mr-1" /> Download All
            </Button>
          )}
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
                  <h4 className="text-sm font-medium mb-2 px-2">Project Files</h4>
                  <div className="space-y-1">
                    {/* Render the hierarchical file tree */}
                    {Object.keys(fileTree).length > 0 ? 
                      renderFileTree(fileTree) :
                      <div className="text-sm text-muted-foreground px-2">No files generated yet</div>
                    }
                  </div>

                  {Object.keys(parsedFiles).length > 1 && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                        onClick={handleSaveAndPreview}
                      >
                        <Save className="h-4 w-4 mr-1" /> Save All & Preview
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
                        {file.split('/').pop()} {/* Only show filename, not path */}
                        {/* Unsaved indicator - using SaveIcon */}
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
              </div>

              {/* Monaco editor */}
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
                  }}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
