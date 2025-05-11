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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import "devicon/devicon.min.css";
import { TerminalService } from "@/lib/terminal-service";
import { ProjectSession } from "@/lib/project-generator";

// Define interfaces for file tree structure
interface FileItem {
  type: 'file';
  path: string;
}

interface DirectoryItem {
  type: 'directory';
  children: Record<string, FileTreeItem>;
  expanded: boolean;
}

type FileTreeItem = FileItem | DirectoryItem;

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
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [parsedFiles, setParsedFiles] = useState<Record<string, string>>({
    "index.html": "<!-- No code generated yet -->",
  });
  const [editorTheme, setEditorTheme] = useState("vs-light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(192); // Default width
  const { toast } = useToast();
  const editorRef = useRef(null);
  // State to track files with unsaved changes
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  // Ref to hold the latest selectedFile for event listeners
  const selectedFileRef = useRef(selectedFile);
  // State for file tree structure
  const [fileTree, setFileTree] = useState<Record<string, FileTreeItem>>({});
  // Current project session
  const [currentSession, setCurrentSession] = useState<ProjectSession | null>(null);
  // Project directory
  const [projectDirectory, setProjectDirectory] = useState<string>("");

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

  const getDeviconClass = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
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
  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
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
    const handleAppPreviewUpdate = (event: CustomEvent<{ code: string, session?: ProjectSession, projectDir?: string }>) => {
      if (event.detail.code) {
        setGeneratedCode(event.detail.code);
        parseCodeIntoFiles(event.detail.code);
        
        // If a session is provided, store it
        if (event.detail.session) {
          setCurrentSession(event.detail.session);
        }
        
        // If a project directory is provided, store it
        if (event.detail.projectDir) {
          setProjectDirectory(event.detail.projectDir);
        }
      }
    };

    document.addEventListener("app-preview-update", handleAppPreviewUpdate as EventListener);
    return () => {
      document.removeEventListener("app-preview-update", handleAppPreviewUpdate as EventListener);
    };
  }, []);

  // Build file tree from flat paths
  const buildFileTree = (files: Record<string, string>): Record<string, FileTreeItem> => {
    const tree: Record<string, FileTreeItem> = {};
    
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
          currentLevel[part] = { 
            type: 'file', 
            path 
          };
        } else {
          // This is a directory
          if (!currentLevel[part]) {
            currentLevel[part] = { 
              type: 'directory', 
              children: {},
              expanded: true // Directories start expanded
            };
          }
          // TypeScript needs this cast to safely access children
          const dirItem = currentLevel[part] as DirectoryItem;
          currentLevel = dirItem.children;
        }
      }
    });
    
    return tree;
  };

  const parseCodeIntoFiles = (code: string | null) => {
    // Check if the code is a string
    if (typeof code !== 'string') {
      console.error("Code is not a string:", code);
      return;
    }

    try {
      // Improved regex to detect file path comments like "// src/App.tsx"
      const filePathRegex = /\/\/\s+([^\s]+\.[a-zA-Z0-9]+)(?:\s*|\n|$)/gm;
      
      const files: Record<string, string> = {};
      let matches: RegExpExecArray | null;
      let lastIndex = 0;
      let lastPath = '';
      
      // Find all file path markers
      while ((matches = filePathRegex.exec(code)) !== null) {
        const filePath = matches[1].trim();
        
        // If this isn't the first match, save the previous file's content
        if (lastPath) {
          // Extract content between previous match and this one
          const contentStart = lastIndex;
          const contentEnd = matches.index;
          let content = code.substring(contentStart, contentEnd).trim();
          
          // Remove the file path comment line from content
          const firstLineBreak = content.indexOf('\n');
          if (firstLineBreak !== -1) {
            content = content.substring(firstLineBreak + 1);
          }
          
          files[lastPath] = content;
        }
        
        lastPath = filePath;
        lastIndex = matches.index + matches[0].length;
      }
      
      // Don't forget to add the last file
      if (lastPath) {
        let content = code.substring(lastIndex).trim();
        
        // Remove the file path comment line from content
        const firstLineBreak = content.indexOf('\n');
        if (firstLineBreak !== -1) {
          content = content.substring(firstLineBreak + 1);
        }
        
        files[lastPath] = content;
      }
      
      // If no structured files found but we have code, treat it as a single HTML file
      if (Object.keys(files).length === 0 && code.trim()) {
        files['index.html'] = code;
      }
      
      // Update state with parsed files and built file tree
      if (Object.keys(files).length > 0) {
        setParsedFiles(files);
        setFileTree(buildFileTree(files));
        
        // Open the first file by default
        const firstFile = Object.keys(files)[0];
        setSelectedFile(firstFile);
        setOpenFiles([firstFile]);
        
        // Clear unsaved state when new code is generated
        setUnsavedChanges(new Set());
        
        // If we have a current session and project directory, try to start a dev server
        if (currentSession && projectDirectory && Object.keys(files).some(file => file.includes('package.json'))) {
          startDevServer();
        }
        
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

  // Function to start dev server
  const startDevServer = async () => {
    if (!currentSession || !projectDirectory) {
      console.error("Cannot start dev server: missing session or directory");
      return;
    }
    
    toast({
      title: "Starting development server",
      description: "Creating and starting a live development environment...",
    });
    
    // Create all the files in the correct directory structure
    await TerminalService.createFiles(currentSession, parsedFiles);
    
    // Try to start the dev server
    const serverUrl = await TerminalService.startDevServer(currentSession, projectDirectory);
    
    if (serverUrl) {
      toast({
        title: "Development server running",
        description: `Server started at ${serverUrl}`,
      });
      
      // Dispatch event to update preview panel with dev server URL
      const devServerEvent = new CustomEvent('dev-server-started', {
        detail: { url: serverUrl }
      });
      document.dispatchEvent(devServerEvent);
    } else {
      toast({
        title: "Failed to start development server",
        description: "Check the terminal output for more details",
        variant: "destructive"
      });
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
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Add Ctrl+S command to trigger preview update and clear unsaved state
    const saveCommandDisposable = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        const currentFile = selectedFileRef.current;
        const editorValue = editor.getValue();

        // Update parsedFiles state with the saved content
        setParsedFiles((prev) => ({
          ...prev,
          [currentFile]: editorValue,
        }));

        // Generate code for the preview event
        let allCode = '';
        Object.entries(parsedFiles).forEach(([path, content]) => {
          // Use the updated content for the current file
          const fileContent = path === currentFile ? editorValue : content;
          allCode += `// ${path}\n${fileContent}\n\n`;
        });

        // Dispatch event with all code for preview
        const previewEvent = new CustomEvent("app-preview-update", {
          detail: { 
            code: allCode,
            session: currentSession,
            projectDir: projectDirectory
          },
        });
        document.dispatchEvent(previewEvent);

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
  const handleEditorChange = (value: string | undefined) => {
    if (typeof value === 'undefined') return;
    
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
  const openFile = (filename: string) => {
    setSelectedFile(filename);
    if (!openFiles.includes(filename)) {
      setOpenFiles((prev) => [...prev, filename]);
    }
  };

  // Close a file tab
  const closeFileTab = (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Remove the file from open files
    const newOpenFiles = openFiles.filter((file) => file !== filename);

    // Remove the file from unsaved changes
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

  // Toggle directory expand/collapse
  const toggleDirectory = (path: string) => {
    const pathParts = path.split('/');
    let current = fileTree;
    
    // Navigate to the directory in the tree
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue;
      
      if (current[part] && (current[part] as DirectoryItem).type === 'directory') {
        if (i === pathParts.length - 1) {
          // We've found the directory, toggle its expanded state
          setFileTree(prevTree => {
            // Create a new tree to avoid mutation
            const newTree = JSON.parse(JSON.stringify(prevTree));
            let target = newTree;
            
            // Navigate to the directory in the new tree
            for (let j = 0; j < pathParts.length; j++) {
              const navPart = pathParts[j];
              if (!navPart) continue;
              
              if (j === pathParts.length - 1) {
                // Toggle expanded state
                (target[navPart] as DirectoryItem).expanded = !(target[navPart] as DirectoryItem).expanded;
              } else {
                // Navigate deeper
                target = (target[navPart] as DirectoryItem).children;
              }
            }
            
            return newTree;
          });
          break;
        } else {
          // Keep navigating deeper
          current = (current[part] as DirectoryItem).children;
        }
      } else {
        // Path doesn't exist or isn't a directory
        break;
      }
    }
  };

  // Render file tree recursively
  const renderFileTree = (tree: Record<string, FileTreeItem>, basePath = "") => {
    return Object.entries(tree).map(([name, item]) => {
      const path = basePath ? `${basePath}/${name}` : name;
      
      if ((item as FileItem).type === 'file') {
        const fileItem = item as FileItem;
        return (
          <div 
            key={fileItem.path}
            onClick={() => openFile(fileItem.path)}
            className={`pl-2 py-1 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center ${
              selectedFile === fileItem.path ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
            }`}
          >
            <File className="h-4 w-4 mr-2" />
            {name}
          </div>
        );
      }
      
      if ((item as DirectoryItem).type === 'directory') {
        const dirItem = item as DirectoryItem;
        return (
          <div key={path} className="pl-2">
            <div 
              className="flex items-center py-1 text-sm font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => toggleDirectory(path)}
            >
              {dirItem.expanded ? 
                <ChevronDown className="h-4 w-4 mr-1" /> :
                <ChevronRight className="h-4 w-4 mr-1" />
              }
              <Folder className="h-4 w-4 mr-2" />
              {name}
            </div>
            {dirItem.expanded && (
              <div className="pl-2 border-l border-gray-200 dark:border-gray-700 ml-2">
                {renderFileTree(dirItem.children, path)}
              </div>
            )}
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
      detail: { 
        code: allCode,
        session: currentSession,
        projectDir: projectDirectory
      },
    });
    document.dispatchEvent(previewEvent);
    
    // Clear all unsaved changes
    setUnsavedChanges(new Set());
    
    toast({
      title: "All files saved",
      description: "Preview updated with all files"
    });
    
    // If we have a current session and project directory, try to start a dev server
    if (currentSession && projectDirectory && Object.keys(parsedFiles).some(file => file.includes('package.json'))) {
      startDevServer();
    }
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
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* File Explorer */}
            <ResizablePanel 
              defaultSize={25} 
              minSize={15} 
              maxSize={40}
              className={`${sidebarCollapsed ? 'hidden' : 'block'}`}
            >
              <div className="p-2 overflow-auto h-full bg-background border-r">
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
            </ResizablePanel>

            {/* Toggle sidebar button */}
            <div className="flex items-center border-r border-gray-200 dark:border-gray-700">
              <button
                className="h-8 w-4 flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-300 text-gray-600 dark:text-gray-300"
                onClick={toggleSidebar}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Code Editor */}
            <ResizablePanel defaultSize={75} minSize={20}>
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 px-2 border-b">
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
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
