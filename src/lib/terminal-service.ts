import { ProjectSession } from "./project-generator";

export interface TerminalCommand {
  command: string;
  session: ProjectSession;
}

export interface TerminalResponse {
  output: string;
  success: boolean;
  error?: string;
}

export class TerminalService {
  private static socket: WebSocket | null = null;
  private static commandQueue: {
    command: string;
    resolve: (response: TerminalResponse) => void;
    reject: (error: any) => void;
  }[] = [];
  private static isProcessingQueue = false;
  private static commandResponses: Map<string, string> = new Map();
  private static commandPromises: Map<
    string,
    {
      resolve: (response: TerminalResponse) => void;
      reject: (error: any) => void;
    }
  > = new Map();
  private static connectionPromise: Promise<WebSocket> | null = null;

  /**
   * Initialize WebSocket connection to terminal server
   */
  static async getConnection(): Promise<WebSocket> {
    // Return existing promise if connection is already being established
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Return existing socket if it's already open
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    // Close any existing socket that's not in OPEN state
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // Ignore errors when closing
      }
      this.socket = null;
    }

    // Create a new connection promise
    this.connectionPromise = new Promise<WebSocket>((resolve, reject) => {
      try {
        const socket = new WebSocket("ws://localhost:3001");

        // Set up event handlers
        socket.onopen = () => {
          console.log("Terminal WebSocket connected");
          this.socket = socket;
          resolve(socket);
          this.connectionPromise = null;

          // Process any pending commands
          this.processCommandQueue();
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "commandResponse" && data.id) {
              // Store command response
              this.commandResponses.set(data.id, data.output || "");

              // Resolve command promise if exists
              const promise = this.commandPromises.get(data.id);
              if (promise) {
                promise.resolve({
                  output: data.output || "",
                  success: data.success !== false,
                });
                this.commandPromises.delete(data.id);
              }
            }
          } catch (error) {
            console.error("Error processing message:", error);
          }
        };

        socket.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
          this.connectionPromise = null;
        };

        socket.onclose = () => {
          console.log("WebSocket connection closed");
          this.socket = null;
          this.processCommandQueue();
        };
      } catch (error) {
        console.error("Failed to connect to WebSocket server:", error);
        reject(error);
        this.connectionPromise = null;
      }
    });

    return this.connectionPromise;
  }

  /**
   * Execute a command in the terminal
   */
  static async executeCommand(
    command: TerminalCommand
  ): Promise<TerminalResponse> {
    const { command: cmd, session } = command;
    const commandId = `cmd_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    return new Promise<TerminalResponse>((resolve, reject) => {
      // Add command to queue
      this.commandQueue.push({
        command: JSON.stringify({
          type: "command",
          command: cmd,
          sessionId: session.id,
          id: commandId,
        }),
        resolve,
        reject,
      });

      // Store promise in map for later resolution
      this.commandPromises.set(commandId, { resolve, reject });

      // Process queue
      this.processCommandQueue();
    });
  }

  /**
   * Process command queue
   */
  private static async processCommandQueue() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      let socket: WebSocket;

      try {
        socket = await this.getConnection();
      } catch (error) {
        // Handle connection failure
        while (this.commandQueue.length > 0) {
          const { resolve } = this.commandQueue.shift()!;
          resolve({
            output: "Failed to connect to terminal server",
            success: false,
            error: "Connection failed",
          });
        }
        this.isProcessingQueue = false;
        return;
      }

      // Process all commands in the queue
      while (this.commandQueue.length > 0) {
        const { command, resolve, reject } = this.commandQueue.shift()!;

        try {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(command);

            // We'll resolve this later when we get the response
            // But set a timeout in case response never comes
            setTimeout(() => {
              const id = JSON.parse(command).id;
              const promise = this.commandPromises.get(id);
              if (promise) {
                promise.resolve({
                  output: "Command timed out",
                  success: false,
                  error: "Timeout",
                });
                this.commandPromises.delete(id);
              }
            }, 10000);
          } else {
            resolve({
              output: "Terminal server disconnected",
              success: false,
              error: "Disconnected",
            });
          }
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute multiple commands in sequence
   */
  static async executeCommands(
    commands: string[],
    session: ProjectSession
  ): Promise<TerminalResponse[]> {
    const responses: TerminalResponse[] = [];

    for (const cmd of commands) {
      const response = await this.executeCommand({ command: cmd, session });
      responses.push(response);

      // Stop execution if a command fails
      if (!response.success) {
        break;
      }

      // Add a small delay between commands
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return responses;
  }

  /**
   * Create a file in the terminal
   */
  static async createFile(
    session: ProjectSession,
    filePath: string,
    content: string
  ): Promise<TerminalResponse> {
    try {
      // Ensure directories exist
      const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
      await this.executeCommand({
        command: `mkdir -p ${dirPath}`,
        session,
      });

      // Escape content for shell
      const escapedContent = content
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\$/g, "\\$")
        .replace(/`/g, "\\`");

      // Write file content
      return await this.executeCommand({
        command: `echo "${escapedContent}" > ${filePath}`,
        session,
      });
    } catch (error) {
      return {
        output: "",
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Create multiple files
   */
  static async createFiles(
    session: ProjectSession,
    files: Record<string, string>
  ): Promise<TerminalResponse[]> {
    const responses: TerminalResponse[] = [];
    const filePaths = Object.keys(files);

    // Process files in batches to avoid overwhelming the terminal
    const batchSize = 5;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchPromises = batch.map((filePath) =>
        this.createFile(session, filePath, files[filePath])
      );

      const batchResponses = await Promise.all(batchPromises);
      responses.push(...batchResponses);

      // Check if any file creation failed
      if (batchResponses.some((response) => !response.success)) {
        break;
      }

      // Add a small delay between batches
      if (i + batchSize < filePaths.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return responses;
  }

  /**
   * Interface with the TerminalPanel component
   * This method should be called when the TerminalPanel mounts to register its WebSocket
   */
  static registerTerminalSocket(socket: WebSocket): void {
    // Store the socket reference
    this.socket = socket;

    // Process any pending commands
    this.processCommandQueue();
  }

  /**
   * Clear current socket reference (e.g., when TerminalPanel unmounts)
   */
  static unregisterTerminalSocket(): void {
    this.socket = null;
  }

  /**
   * Check if terminal service is connected
   */
  static isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}
