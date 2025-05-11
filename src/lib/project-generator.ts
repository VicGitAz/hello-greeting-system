import { ProjectExecutor } from "./project-executor";
import { TerminalService } from "./terminal-service";

export interface ProjectConfig {
  type: "frontend" | "backend" | "fullstack";
  language: "javascript" | "typescript";
  frontend?: {
    framework: "react" | "nextjs";
    styling: "tailwind" | "css";
    features: string[];
  };
  backend?: {
    framework: string;
    database: string;
  };
  name: string;
  description?: string;
}

export interface ProjectSession {
  id: string;
  config: ProjectConfig;
  files: Record<string, string>;
}

interface GeminiResponse {
  text: string;
  code?: string;
  config?: ProjectConfig;
  mermaidCode?: string;
}

export class ProjectGenerator {
  /**
   * Parses generated code and extracts files based on code blocks
   */
  static parseGeneratedCode(
    generatedResponse: GeminiResponse | null | undefined
  ): Record<string, string> {
    const files: Record<string, string> = {};

    // Handle null or undefined response
    if (!generatedResponse) {
      files[`README.md`] = "# Generated Project\n\nNo content was generated.";
      return files;
    }

    // Start with the README.md
    files[`README.md`] = generatedResponse.text || "Generated Project";

    // Extract code blocks and map them to files
    if (generatedResponse.code) {
      // First check for file path comments pattern like "// src/App.tsx"
      const filePathPattern =
        /\/\/\s*([^\n]+\.[a-zA-Z0-9]+)\s*\n([\s\S]*?)(?=\/\/\s*[^\n]+\.[a-zA-Z0-9]+\s*\n|$)/g;
      let filePathMatch;
      let foundFiles = false;

      while (
        (filePathMatch = filePathPattern.exec(generatedResponse.code)) !== null
      ) {
        const filePath = filePathMatch[1].trim();
        const content = filePathMatch[2].trim();

        if (filePath && content) {
          files[filePath] = content;
          foundFiles = true;
        }
      }

      // If we found files using the file path pattern, return early
      if (foundFiles) {
        return files;
      }

      // Otherwise try the code block with filename pattern
      const fileRegex =
        /(?:```(?:javascript|typescript|jsx|tsx|json|html|css|md)?\s*\n)?(?:(?:\/\/|#)?\s*([^\n]+\.[a-zA-Z0-9]+)[\s:]*)(?:\n|$)([\s\S]*?)(?:```(?:\s*\n|$)|(?=(?:\/\/|#)?\s*[^\n]+\.[a-zA-Z0-9]+[\s:]*(?:\n|$)))/g;

      let match;
      while ((match = fileRegex.exec(generatedResponse.code)) !== null) {
        const fileName = match[1].trim();
        const content = match[2].trim();

        if (fileName && content) {
          files[fileName] = content;
        }
      }

      // If no files were extracted using the regex patterns, try to identify common file patterns
      if (Object.keys(files).length <= 1) {
        this.extractCommonFiles(generatedResponse.code, files);
      }
    }

    return files;
  }

  /**
   * Extracts common files from code string when regex pattern fails
   */
  private static extractCommonFiles(
    code: string,
    files: Record<string, string>
  ): void {
    // Common file patterns to look for
    const commonFiles = [
      { pattern: "package.json", path: "package.json" },
      { pattern: "tsconfig.json", path: "tsconfig.json" },
      { pattern: "tailwind.config", path: "tailwind.config.js" },
      { pattern: "import React", path: "src/App.tsx" },
      { pattern: "ReactDOM.createRoot", path: "src/index.tsx" },
      { pattern: "@tailwind base", path: "src/index.css" },
      { pattern: "<!DOCTYPE html>", path: "public/index.html" },
      { pattern: "express", path: "src/index.ts" },
    ];

    const codeBlocks = code.split("```");
    for (let i = 0; i < codeBlocks.length; i++) {
      if (i % 2 === 1) {
        // Every other block is code
        const codeBlock = codeBlocks[i];
        const lines = codeBlock.split("\n");
        const lang = lines[0].trim();
        const content = lines.slice(1).join("\n").trim();

        if (!content) continue;

        // Check for known file patterns
        for (const file of commonFiles) {
          if (content.includes(file.pattern)) {
            files[file.path] = content;
            break;
          }
        }
      }
    }
  }

  /**
   * Creates a project from the Gemini response
   */
  static async createProject(response: GeminiResponse): Promise<boolean> {
    try {
      // Create default config to use as fallback
      const defaultConfig: ProjectConfig = {
        type: "frontend",
        language: "typescript",
        frontend: {
          framework: "react",
          styling: "tailwind",
          features: [],
        },
        name: "my-app",
        description: "Default web application",
      };

      // Ensure there's always a valid config object
      // Key fix: Check if response and response.config exist before accessing properties
      const config: ProjectConfig =
        response && response.config
          ? {
              ...defaultConfig, // Start with defaults
              ...response.config, // Overlay with response config if available
              frontend: {
                // Deep merge frontend
                ...defaultConfig.frontend,
                ...(response.config.frontend || {}),
              },
              // Ensure name exists, prioritizing response config name
              name: response.config.name || defaultConfig.name,
            }
          : defaultConfig; // Use default if no config is available

      // Update response object with the finalized config if response exists
      if (response) {
        response.config = config;
      }

      // Add a log to confirm config is valid
      console.log("Using project configuration:", config);

      // Parse files from generated code
      const files = this.parseGeneratedCode(response);

      // Create a session
      const session: ProjectSession = {
        id: `session-${Date.now()}`,
        config: config, // Use our validated config here
        files,
      };

      // Organize files into proper project structure
      const organizedFiles = this.organizeProjectFiles(session);

      // Log status for debugging
      console.log(`Created project session with ID: ${session.id}`);
      console.log(`Project type: ${config.type}`);
      console.log(`Number of files: ${Object.keys(organizedFiles).length}`);

      // Attempt to create project structure and files using ProjectExecutor
      let projectCreationSuccess = false;
      try {
        const structureResult = await ProjectExecutor.executeProject(session);
        if (structureResult) {
          const filesResult = await ProjectExecutor.createProjectFiles(
            session,
            organizedFiles
          );
          if (filesResult) {
            projectCreationSuccess = true;
          } else {
            console.error(
              "Failed to create project files using ProjectExecutor"
            );
            // Try fallback approach - create downloadable files
            this.createLocalFiles(session);
            // Return true even though we couldn't create files via WebSocket
            // since we're providing a fallback download
            return true;
          }
        } else {
          console.error(
            "Failed to create project structure using ProjectExecutor"
          );
        }
      } catch (executorError) {
        console.error("Error during ProjectExecutor execution:", executorError);
      }

      // If ProjectExecutor failed, try the TerminalService approach as a fallback
      if (!projectCreationSuccess) {
        console.warn(
          "ProjectExecutor failed. Attempting creation using TerminalService as fallback."
        );
        try {
          const commands = this.generateCommands(session);
          await TerminalService.executeCommands(commands, session);
          await TerminalService.createFiles(session, organizedFiles);
          projectCreationSuccess = true; // Set to true if fallback succeeds
        } catch (terminalError) {
          console.error("TerminalService fallback also failed:", terminalError);
          projectCreationSuccess = false; // Ensure it's false if fallback fails
        }
      }

      return projectCreationSuccess; // Return the final status
    } catch (error) {
      console.error("Error creating project:", error);
      return false;
    }
  }

  /**
   * Organizes files into proper project structure
   */
  private static organizeProjectFiles(
    session: ProjectSession
  ): Record<string, string> {
    const { config, files } = session;
    const organizedFiles: Record<string, string> = {};
    const projectName = config.name;

    // Helper to determine the correct path for a file
    const getFilePath = (fileName: string): string => {
      // If file already has a directory structure, preserve it
      if (fileName.includes("/")) {
        return `${projectName}/${fileName}`;
      }

      const normalizedName = fileName.toLowerCase();

      // Root level files
      if (
        normalizedName === "readme.md" ||
        normalizedName === ".gitignore" ||
        normalizedName.endsWith(".md")
      ) {
        return `${projectName}/${fileName}`;
      }

      // Config and package files
      if (
        normalizedName.includes("config") ||
        normalizedName === "package.json" ||
        normalizedName.endsWith(".json")
      ) {
        // Determine if frontend or backend
        if (
          normalizedName.includes("tsconfig") ||
          normalizedName.includes("tailwind")
        ) {
          return config.type === "backend"
            ? `${projectName}/${fileName}`
            : `${projectName}/frontend/${fileName}`;
        }

        if (normalizedName === "package.json") {
          // Check content to determine if frontend or backend
          const content = files[fileName] || "";
          const isFrontend =
            content.includes("react") || content.includes("tailwind");
          const isBackend =
            content.includes("express") || content.includes("nestjs");

          if (config.type === "fullstack") {
            if (isFrontend) {
              return `${projectName}/frontend/${fileName}`;
            } else if (isBackend) {
              return `${projectName}/backend/${fileName}`;
            }
          }

          return config.type === "backend"
            ? `${projectName}/${fileName}`
            : `${projectName}/frontend/${fileName}`;
        }

        return `${projectName}/${fileName}`;
      }

      // Source files
      if (
        normalizedName.endsWith(".tsx") ||
        normalizedName.endsWith(".jsx") ||
        normalizedName.endsWith(".ts") ||
        normalizedName.endsWith(".js") ||
        normalizedName.endsWith(".css") ||
        normalizedName.endsWith(".html")
      ) {
        // Frontend files
        if (
          normalizedName.includes("react") ||
          normalizedName.includes("component") ||
          normalizedName.includes("app.") ||
          normalizedName.includes("index.") ||
          normalizedName.endsWith(".css") ||
          normalizedName.endsWith(".html")
        ) {
          if (config.type === "fullstack" || config.type === "frontend") {
            // Check if it's a component
            if (
              normalizedName.includes("component") ||
              (normalizedName.charAt(0).toUpperCase() ===
                normalizedName.charAt(0) &&
                !normalizedName.startsWith("index."))
            ) {
              return `${projectName}/frontend/src/components/${fileName}`;
            }

            // Check if it's a page
            if (
              normalizedName.includes("page") ||
              normalizedName.includes("screen")
            ) {
              return `${projectName}/frontend/src/pages/${fileName}`;
            }

            // HTML files go to public
            if (normalizedName.endsWith(".html")) {
              return `${projectName}/frontend/public/${fileName}`;
            }

            return `${projectName}/frontend/src/${fileName}`;
          }
        }

        // Backend files
        if (
          normalizedName.includes("express") ||
          normalizedName.includes("controller") ||
          normalizedName.includes("service") ||
          normalizedName.includes("model") ||
          normalizedName.includes("route")
        ) {
          if (config.type === "fullstack" || config.type === "backend") {
            // Route files
            if (normalizedName.includes("route")) {
              return `${projectName}/backend/src/routes/${fileName}`;
            }

            // Controller files
            if (normalizedName.includes("controller")) {
              return `${projectName}/backend/src/controllers/${fileName}`;
            }

            // Service files
            if (normalizedName.includes("service")) {
              return `${projectName}/backend/src/services/${fileName}`;
            }

            // Model files
            if (normalizedName.includes("model")) {
              return `${projectName}/backend/src/models/${fileName}`;
            }

            return `${projectName}/backend/src/${fileName}`;
          }
        }

        // Default source files
        if (config.type === "frontend") {
          return `${projectName}/src/${fileName}`;
        } else if (config.type === "backend") {
          return `${projectName}/src/${fileName}`;
        } else {
          // Guess based on content
          const content = files[fileName] || "";
          const isFrontend =
            content.includes("React") ||
            content.includes("Component") ||
            content.includes("render");

          return isFrontend
            ? `${projectName}/frontend/src/${fileName}`
            : `${projectName}/backend/src/${fileName}`;
        }
      }

      // Default to project root
      return `${projectName}/${fileName}`;
    };

    // Organize all files
    for (const [fileName, content] of Object.entries(files)) {
      const filePath = getFilePath(fileName);
      organizedFiles[filePath] = content;
    }

    return organizedFiles;
  }

  /**
   * Generates shell commands to create the project structure
   */
  private static generateCommands(session: ProjectSession): string[] {
    const { config } = session;
    const commands: string[] = [];
    const projectName = config.name;

    // Create project directory
    commands.push(`mkdir -p ${projectName}`);
    commands.push(`cd ${projectName}`);

    // Setup frontend and backend folders for fullstack projects
    if (config.type === "fullstack") {
      commands.push(`mkdir -p frontend backend`);

      // Frontend setup
      commands.push(`cd frontend`);
      if (config.frontend?.framework === "react") {
        commands.push(`npx create-react-app . --template typescript`);

        if (config.frontend.styling === "tailwind") {
          commands.push(`npm install -D tailwindcss postcss autoprefixer`);
          commands.push(`npx tailwindcss init -p`);
        }

        commands.push(`mkdir -p src/components src/pages public`);
      } else if (config.frontend?.framework === "nextjs") {
        commands.push(
          `npx create-next-app . --typescript --tailwind --eslint --app`
        );
      }
      commands.push(`cd ..`);

      // Backend setup
      commands.push(`cd backend`);
      commands.push(`npm init -y`);
      commands.push(`npm install express cors dotenv`);

      if (config.language === "typescript") {
        commands.push(
          `npm install -D typescript @types/express @types/node @types/cors ts-node-dev`
        );
        commands.push(`npx tsc --init`);
      }

      commands.push(
        `mkdir -p src/routes src/controllers src/models src/services`
      );
      commands.push(`cd ..`);
    }
    // Setup for frontend-only projects
    else if (config.type === "frontend") {
      if (config.frontend?.framework === "react") {
        commands.push(`npx create-react-app . --template typescript`);

        if (config.frontend.styling === "tailwind") {
          commands.push(`npm install -D tailwindcss postcss autoprefixer`);
          commands.push(`npx tailwindcss init -p`);
        }

        commands.push(`mkdir -p src/components src/pages public`);
      } else if (config.frontend?.framework === "nextjs") {
        commands.push(
          `npx create-next-app . --typescript --tailwind --eslint --app`
        );
      }
    }
    // Setup for backend-only projects
    else if (config.type === "backend") {
      commands.push(`npm init -y`);
      commands.push(`npm install express cors dotenv`);

      if (config.language === "typescript") {
        commands.push(
          `npm install -D typescript @types/express @types/node @types/cors ts-node-dev`
        );
        commands.push(`npx tsc --init`);
      }

      commands.push(
        `mkdir -p src/routes src/controllers src/models src/services`
      );
    }

    return commands;
  }

  /**
   * Fallback method for when WebSocket terminal is unavailable
   * Generates files locally in browser memory and provides download option
   */
  static createLocalFiles(session: ProjectSession): void {
    try {
      const { files, config } = session;

      // Create a zip file containing all the project files
      import("jszip")
        .then(({ default: JSZip }) => {
          const zip = new JSZip();

          // Add all files to the zip
          Object.entries(files).forEach(([path, content]) => {
            zip.file(path, content);
          });

          // Generate the zip file
          zip.generateAsync({ type: "blob" }).then((blob) => {
            // Create download link
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${config.name}.zip`;

            // Add to document, trigger click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Show success notification
            const event = new CustomEvent("project-creation-complete", {
              detail: {
                success: true,
                message:
                  "Project files created and downloaded as zip. Terminal connection unavailable.",
                projectName: config.name,
              },
            });
            document.dispatchEvent(event);
          });
        })
        .catch((error) => {
          console.error("Error creating zip file:", error);
          // Dispatch error event
          const event = new CustomEvent("project-creation-error", {
            detail: {
              error: "Failed to create project files for download.",
            },
          });
          document.dispatchEvent(event);
        });
    } catch (error) {
      console.error("Error in fallback file creation:", error);
    }
  }
}
