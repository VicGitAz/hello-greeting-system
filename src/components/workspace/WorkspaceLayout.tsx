import React, { useState, useEffect } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import PreviewPanel from "./panels/PreviewPanel";
import CodePanel from "./panels/CodePanel";
import FlowPanel from "./panels/FlowPanel";
import ChatPanel from "./panels/ChatPanel";
import {
  ProjectGenerator,
  ProjectConfig,
  ProjectSession,
} from "@/lib/project-generator";
import TerminalPanel from "./panels/TerminalPanel";

export default function WorkspaceLayout() {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    "responsive",
  ]);
  const [currentSession, setCurrentSession] = useState<ProjectSession | null>(
    null
  );

  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  // Listen for project creation events
  useEffect(() => {
    const handleProjectCreate = (event: CustomEvent) => {
      // Change this to extract the full response object instead of just config
      const { response } = event.detail;

      // Now pass the full response to ProjectGenerator.createProject
      ProjectGenerator.createProject(response)
        .then((success) => {
          if (success) {
            console.log("Project created successfully");
          } else {
            console.error("Failed to create project");
          }
        })
        .catch((error) => {
          console.error("Error creating project:", error);
        });
    };

    document.addEventListener(
      "project-create",
      handleProjectCreate as EventListener
    );
    return () => {
      document.removeEventListener(
        "project-create",
        handleProjectCreate as EventListener
      );
    };
  }, []);

  return (
    <div className="h-screen w-full bg-muted/20 dark:bg-gray-950 overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Content */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <ChatPanel />
        </ResizablePanel>

        <ResizableHandle withHandle className="hover:bg-blue-500 w-0.5" />

        <ResizablePanel defaultSize={50}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={40}>
              <PreviewPanel />
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="hover:bg-blue-500"
              style={{ height: "2px" }}
            />
            <ResizablePanel defaultSize={50} minSize={8} maxSize={93}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={70}>
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={50}>
                      <CodePanel />
                    </ResizablePanel>
                    <ResizableHandle
                      withHandle
                      className="hover:bg-blue-500 w-0.5"
                    />
                    <ResizablePanel defaultSize={50}>
                      <FlowPanel />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
                <ResizableHandle
                  withHandle
                  className="hover:bg-blue-500"
                  style={{ height: "2px" }}
                />

                {/* Terminal Section */}
                <ResizablePanel defaultSize={3} minSize={4}>
                  <div className="flex relative transition-all duration-200 h-full">
                    <div className="w-full h-full relative">
                      <div className="h-full">
                        <TerminalPanel className="h-full w-full" />
                      </div>
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
