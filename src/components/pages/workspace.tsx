import React from "react";
import WorkspaceLayout from "../workspace/WorkspaceLayout";
import { AIProvider } from "@/lib/ai-context";

export default function Workspace() {
  return (
    <div className="min-h-screen bg-background">
      <AIProvider>
        <WorkspaceLayout />
      </AIProvider>
    </div>
  );
}
