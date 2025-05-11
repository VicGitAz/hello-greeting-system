import WebSocket, { WebSocketServer } from "ws";
import pty from "node-pty";
import os from "os";
import * as fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Create WebSocket server
const wss = new WebSocketServer({ port: 3001 });
console.log("Terminal server running on port 3001");

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Unique session directory
  const userId = uuidv4();
  const userBaseDir = path.join("/tmp/term-users", userId);
  fs.mkdirSync(userBaseDir, { recursive: true });

  // Write .bashrc to disable 'cd'
  fs.writeFileSync(
    path.join(userBaseDir, ".bashrc"),
    `
      alias cd='echo "cd is disabled in this terminal session."'
      export PS1="\\u@restricted:\\w\\$ "
    `
  );

  const shell = os.platform() === "win32" ? "powershell.exe" : "/bin/bash";
  let cols = 80;
  let rows = 24;
  let ptyProcess = null;

  const startShell = () => {
    console.log(`Starting ${shell} in ${userBaseDir}`);

    ptyProcess = pty.spawn(shell, ["--rcfile", ".bashrc"], {
      name: "xterm-color",
      cols,
      rows,
      cwd: userBaseDir,
      env: {
        ...process.env,
        HOME: userBaseDir,
      },
    });

    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", content: data }));
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`Shell exited with code ${exitCode}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "output",
            content: `\r\nProcess exited (code ${exitCode}). Restarting...\r\n`,
          })
        );
        startShell();
      }
    });
  };

  startShell();

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (!ptyProcess) return;

      switch (data.type) {
        case "key":
          ptyProcess.write(data.key);
          break;
        case "paste":
          ptyProcess.write(data.data);
          break;
        case "SIGINT":
          ptyProcess.write("\x03");
          break;
        case "resize":
          cols = data.cols;
          rows = data.rows;
          ptyProcess.resize(cols, rows);
          break;
        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (err) {
      console.error("Failed to process message:", err);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");

    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }

    // Clean up user directory
    try {
      fs.rmSync(userBaseDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      console.log(`Cleaned up directory: ${userBaseDir}`);
    } catch (err) {
      console.error(`Failed to clean up ${userBaseDir}:`, err);
    }
  });
});
