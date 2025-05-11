import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../supabase/auth.tsx";
import { AIProvider } from "./lib/ai-context";
import { Toaster } from "./components/ui/toaster";
import { ThemeProvider } from "./components/theme-provider";

import { TempoDevtools } from "tempo-devtools";
TempoDevtools.init();

const basename = import.meta.env.BASE_URL;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light">
      <BrowserRouter basename={basename}>
        <AuthProvider>
          <AIProvider>
            <App />
            <Toaster />
          </AIProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
