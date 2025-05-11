import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  Ref,
} from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { Terminal as TerminalIcon, X } from "lucide-react";
import { TerminalService } from "../../../lib/terminal-service";
import "xterm/css/xterm.css";
import { useTheme } from "../../theme-provider"; // Import useTheme

// Define the interface for the ref being exposed
export interface TerminalPanelRef {
  writeToTerminal: (text: string) => void;
  focus: () => void;
  isConnected: boolean;
  terminal: Terminal | null;
}

interface TerminalPanelProps {
  className?: string;
  onConnected?: (connected: boolean) => void;
}

// Define terminal themes
const terminalThemes = {
  dark: {
    background: "bg-background",
    foreground: "#ffffff",
    cursor: "#ffffff",
    selection: "#ffffff",
    selectionBackground: "#444444",
  },
  light: {
    background: "#ffffff",
    foreground: "#000000", // Changed to black for better contrast
    cursor: "#000000", // Add cursor color
    selection: "#000000",
    selectionBackground: "#cccccc", // Add selection background
  },
};

// Use forwardRef to receive the ref from the parent component
const TerminalPanel: React.ForwardRefRenderFunction<
  TerminalPanelRef,
  TerminalPanelProps
> = (
  { className, onConnected },
  ref // This is the ref from the parent
) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false); // Use this state for connection status
  const socketRef = useRef<WebSocket | null>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const [outputBuffer, setOutputBuffer] = useState<string[]>([]);
  const unmountedRef = useRef(false); // Ref to track if the component is unmounted
  const { theme } = useTheme(); // Get the current theme

  // Handle window resize to adjust terminal size - moved outside useEffect
  const handleResize = () => {
    if (fitAddon) {
      try {
        fitAddon.fit();

        // Send terminal dimensions to server
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN &&
          terminalInstanceRef.current
        ) {
          const dimensions =
            terminalInstanceRef.current.rows && terminalInstanceRef.current.cols
              ? {
                  rows: terminalInstanceRef.current.rows,
                  cols: terminalInstanceRef.current.cols,
                }
              : { rows: 24, cols: 80 }; // Fallback dimensions

          socketRef.current.send(
            JSON.stringify({
              type: "resize",
              rows: dimensions.rows,
              cols: dimensions.cols,
            })
          );
        }
      } catch (err) {
        console.error("Error resizing terminal:", err);
      }
    }
  };

  // Initialize terminal and websocket connection on component mount
  useEffect(() => {
    unmountedRef.current = false; // Component is mounted

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "monospace",
      scrollback: 5000,
      // Initial theme is set by the second useEffect
    });

    terminalInstanceRef.current = term;

    // Create fit addon to resize terminal
    const fit = new FitAddon();
    term.loadAddon(fit);
    setFitAddon(fit); // Store fit addon in state

    // Mount terminal to DOM
    if (terminalRef.current) {
      term.open(terminalRef.current);
      fit.fit(); // Perform initial fit

      setTerminal(term); // Store terminal in state

      // Improved WebSocket connection handling
      let retryCount = 0;
      const maxRetries = 5; // Increased retries

      const connectWebSocket = () => {
        if (unmountedRef.current) return; // Don't connect if component unmounted

        console.log(`Attempting WebSocket connection. Retry: ${retryCount}`);

        // Close any existing connection attempt before creating a new one
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.CONNECTING
        ) {
          try {
            socketRef.current.close(1000, "New connection attempt"); // Use a code for closing
          } catch (e) {
            console.warn("Error closing existing connecting socket:", e);
          }
        }

        const ws = new WebSocket("ws://localhost:3001");
        socketRef.current = ws;
        setSocket(ws); // Update socket state

        ws.onopen = () => {
          console.log("Terminal WebSocket connected");
          setIsConnected(true);
          retryCount = 0;
          if (terminalInstanceRef.current) {
            terminalInstanceRef.current.writeln(
              "\r\n\x1b[1;32mConnected to terminal server\x1b[0m"
            );
            terminalInstanceRef.current.writeln(
              "Terminal is ready. You can run npm, git, and bash commands."
            );
          }
        };

        ws.onmessage = (event) => {
          if (terminalInstanceRef.current) {
            try {
              const data = JSON.parse(event.data);
              // Handle normal terminal output
              if (data.type === "output") {
                terminalInstanceRef.current.write(data.content);
              }
              // Handle command responses
              else if (data.type === "commandResponse") {
                // No need to write to terminal as this is handled by TerminalService
              }
              // Handle custom project creation status messages
              else if (data.type === "projectStatus") {
                terminalInstanceRef.current.writeln(
                  `\r\n\x1b[1;34m${data.message}\x1b[0m`
                );
              }
            } catch (error) {
              console.error("Error processing message:", error);
              if (terminalInstanceRef.current) {
                terminalInstanceRef.current.writeln(
                  "\r\n\x1b[1;31mError processing server message\x1b[0m"
                );
              }
            }
          }
        };

        ws.onerror = (error) => {
          console.error("Terminal WebSocket error:", error);
          if (terminalInstanceRef.current) {
            terminalInstanceRef.current.writeln(
              "\r\n\x1b[1;31mWebSocket error. Check console for details.\x1b[0m"
            );
          }
          // The onerror event typically precedes the onclose event,
          // so the reconnection logic will be handled in onclose.
        };

        ws.onclose = (event) => {
          console.log("Terminal WebSocket closed", event.code, event.reason);
          setIsConnected(false);
          if (terminalInstanceRef.current) {
            terminalInstanceRef.current.writeln(
              `\r\n\x1b[1;31mDisconnected from terminal server (${event.code})\x1b[0m`
            );
            if (!unmountedRef.current && retryCount < maxRetries) {
              terminalInstanceRef.current.writeln(
                `Attempting to reconnect (${retryCount + 1}/${maxRetries})...`
              );
            } else if (!unmountedRef.current) {
              terminalInstanceRef.current.writeln(
                "\r\n\x1b[1;31mMaximum reconnection attempts reached.\x1b[0m"
              );
            }
          }

          // Try to reconnect unless unmounting and retry limit not reached
          if (!unmountedRef.current && retryCount < maxRetries) {
            retryCount++;
            // Exponential backoff with jitter
            const delay =
              Math.min(1000 + retryCount * 500, 5000) + Math.random() * 1000;
            setTimeout(connectWebSocket, delay);
          }
        };

        // Set up terminal key handling
        term.onKey(({ key, domEvent }) => {
          if (
            socketRef.current &&
            socketRef.current.readyState === WebSocket.OPEN
          ) {
            // Check for Ctrl-C
            if (domEvent.ctrlKey && domEvent.key === "c") {
              socketRef.current.send(JSON.stringify({ type: "SIGINT" }));
            } else {
              // Send any other key directly to the server
              socketRef.current.send(JSON.stringify({ type: "key", key }));
            }
          }
        });

        // Also handle paste events
        term.onData((data) => {
          if (
            socketRef.current &&
            socketRef.current.readyState === WebSocket.OPEN
          ) {
            // If this is a large chunk of data (likely a paste), send it as a paste event
            if (data.length > 1) {
              socketRef.current.send(JSON.stringify({ type: "paste", data }));
            }
          }
        });

        // Store in window object for other components to use
        (window as any).__terminalSocket = ws;
      };

      // Connect on mount
      connectWebSocket();

      // Handle window resize to adjust terminal size
      window.addEventListener("resize", handleResize);

      // Initial resize
      setTimeout(handleResize, 100);
    }

    // Clean up
    return () => {
      unmountedRef.current = true; // Mark component as unmounted
      window.removeEventListener("resize", handleResize); // Remove specific handler

      if (socketRef.current) {
        try {
          socketRef.current.close(1000, "Component unmounted"); // Use a standard close code
        } catch (e) {
          console.warn("Error closing socket on unmount:", e);
        }
        socketRef.current = null;
      }
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
        terminalInstanceRef.current = null;
      }

      // Unregister from TerminalService
      TerminalService.unregisterTerminalSocket();
    };
  }, []); // Add dependencies for handleResize

  // Effect to apply theme changes to the terminal
  useEffect(() => {
    if (terminal) {
      // Determine the effective theme based on the hook's theme value
      let effectiveTheme = theme;
      if (theme === "system") {
        effectiveTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
      }

      const currentTheme =
        effectiveTheme === "dark" ? terminalThemes.dark : terminalThemes.light;
      terminal.options.theme = currentTheme;
    }
  }, [theme, terminal]); // Rerun when theme or terminal instance changes

  // Write to terminal function - can be called from parent components
  const writeToTerminal = (text: string) => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.writeln(text);
    } else {
      // Buffer output until terminal is ready
      setOutputBuffer([...outputBuffer, text]);
    }
  };

  // Focus the terminal when clicked
  const focusTerminal = () => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.focus();
    }
  };

  // Expose methods and state to the parent component via the ref
  useImperativeHandle(
    ref,
    () => ({
      writeToTerminal,
      focus: focusTerminal,
      isConnected,
      terminal: terminalInstanceRef.current,
    }),
    [writeToTerminal, focusTerminal, isConnected, terminalInstanceRef.current]
  ); // Include dependencies

  return (
    <div
      className={`flex flex-col ${
        className || ""
      } shadow-lg transition-all duration-300 overflow-hidden
      h-full`}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-2 py-1 bg-background border-b border-gray">
        <div className="flex items-center">
          <TerminalIcon size={16} className="mr-2 text-green-400" />
          <span className="text-xs font-mono text-bg-background">
            Terminal {isConnected ? "(Connected)" : "(Disconnected)"}
          </span>
        </div>
        <div className="flex space-x-1">
          {/* Removed minimize/maximize button */}
        </div>
      </div>

      {/* Terminal content - always render the terminal container */}
      <div
        className="flex-1 overflow-hidden relative" // Changed overflow to hidden as xterm handles scrolling
        onClick={focusTerminal}
      >
        <div ref={terminalRef} className="w-full h-full" />
        {/* Anchor for scroll, maybe not needed with fit addon and flex layout */}
        {/* <div id="terminal-scroll-anchor" className="bg-[#1a1a1a] pb-4" /> */}
      </div>

      {/* Optionally show an overlay status message */}
      {!isConnected && ( // Removed minimized condition
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-white p-4 z-10">
          <div className="text-center">
            <p>Terminal connection unavailable</p>
            <p className="text-sm text-gray-400 mt-2">
              Code generation will still work, but terminal interactions are
              offline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default forwardRef(TerminalPanel);
