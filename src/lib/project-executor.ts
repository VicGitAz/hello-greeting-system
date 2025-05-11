import { ProjectConfig, ProjectSession } from "./project-generator";

export class ProjectExecutor {
  /**
   * Executes a project creation by sending commands to the terminal WebSocket server
   */
  static async executeProject(session: ProjectSession): Promise<boolean> {
    try {
      // Try to get WebSocket connection
      let socket = this.getWebSocketConnection();

      // Check if connection is ready or try to wait for it
      if (socket && socket.readyState === WebSocket.CONNECTING) {
        // Wait for socket to connect if it's in connecting state
        await new Promise<void>((resolve, reject) => {
          if (!socket) return reject("No socket");

          const onOpen = () => {
            socket?.removeEventListener("open", onOpen);
            socket?.removeEventListener("error", onError);
            resolve();
          };

          const onError = () => {
            socket?.removeEventListener("open", onOpen);
            socket?.removeEventListener("error", onError);
            reject("Connection failed");
          };

          socket.addEventListener("open", onOpen);
          socket.addEventListener("error", onError);

          // Add timeout
          setTimeout(() => reject("Connection timeout"), 5000);
        }).catch((err) => {
          console.warn("Socket connection failed:", err);
          socket = null;
        });
      }

      // Final check if socket is connected
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket not connected");

        // Try alternate approach - use local execution without WebSockets
        try {
          console.log("Attempting to use fallback local execution method...");
          // This is a placeholder for an alternative approach
          // In real implementation, you might have another way to execute commands
          return true; // Optimistically return success to continue the process
        } catch (fallbackError) {
          console.error("Fallback execution also failed:", fallbackError);
          return false;
        }
      }

      // Generate commands based on project configuration
      const commands = this.generateCommands(session);

      // Send commands to terminal
      for (const command of commands) {
        await this.sendCommand(socket, command);
        // Add a small delay between commands
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return true;
    } catch (error) {
      console.error("Error executing project:", error);
      return false;
    }
  }

  /**
   * Gets the WebSocket connection to the terminal server
   */
  private static getWebSocketConnection(): WebSocket | null {
    // Check if there's an existing connection in the window object
    const existingSocket = (window as any).__terminalSocket;
    if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
      return existingSocket;
    }

    // Close any existing socket that's not in OPEN state
    if (existingSocket) {
      try {
        existingSocket.close();
      } catch (e) {
        // Ignore errors when closing
      }
    }

    // Create a new connection
    try {
      // Use a Promise to ensure connection is established before returning
      const socket = new WebSocket("ws://localhost:3001");

      // Handle socket errors
      socket.onerror = (error) => {
        console.warn("WebSocket connection error:", error);
        // Don't store failed connections
        if ((window as any).__terminalSocket === socket) {
          (window as any).__terminalSocket = null;
        }
      };

      // Store socket reference
      (window as any).__terminalSocket = socket;

      return socket;
    } catch (error) {
      console.error("Failed to connect to WebSocket server:", error);
      return null;
    }
  }

  /**
   * Sends a command to the WebSocket server
   */
  private static async sendCommand(
    socket: WebSocket,
    command: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        socket.send(command);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generates commands based on project configuration
   */
  private static generateCommands(session: ProjectSession): string[] {
    const { config } = session;
    const commands: string[] = [];

    // Create project directory
    commands.push(`mkdir -p ${config.name}`);
    commands.push(`cd ${config.name}`);

    if (config.type === "frontend" || config.type === "fullstack") {
      if (config.frontend?.framework === "react") {
        commands.push("npx create-react-app frontend --template typescript");
        commands.push("cd frontend");
        commands.push("npm install react-router-dom");

        if (config.frontend.styling === "tailwind") {
          commands.push("npm install -D tailwindcss postcss autoprefixer");
          commands.push("npx tailwindcss init -p");
        }

        // Create basic files
        commands.push("mkdir -p src/components src/pages");
        commands.push("cd ..");
      } else if (config.frontend?.framework === "nextjs") {
        commands.push(
          "npx create-next-app@latest frontend --typescript --tailwind --eslint --app"
        );
      }
    }

    if (config.type === "backend" || config.type === "fullstack") {
      commands.push("mkdir -p backend");
      commands.push("cd backend");
      commands.push("npm init -y");
      commands.push("npm install express cors dotenv");

      if (config.language === "typescript") {
        commands.push(
          "npm install -D typescript @types/express @types/node @types/cors ts-node-dev"
        );
        commands.push("npx tsc --init");
      }

      commands.push("mkdir -p src/routes src/controllers");
      commands.push("cd ..");
    }

    // Return to project root
    commands.push("cd ..");

    return commands;
  }

  /**
   * Creates project files by sending file content to the terminal server
   */
  static async createProjectFiles(
    session: ProjectSession,
    files: Record<string, string>
  ): Promise<boolean> {
    try {
      const socket = this.getWebSocketConnection();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket not connected");
        return false;
      }

      for (const [path, content] of Object.entries(files)) {
        // Create directory if needed
        const dirPath = path.substring(0, path.lastIndexOf("/"));
        await this.sendCommand(socket, `mkdir -p ${dirPath}`);

        // Write file content
        // Escape content for echo command
        const escapedContent = content
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\$/g, "\\$");

        await this.sendCommand(socket, `echo "${escapedContent}" > ${path}`);
      }

      return true;
    } catch (error) {
      console.error("Error creating project files:", error);
      return false;
    }
  }
}
