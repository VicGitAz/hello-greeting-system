import React from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIConfigModal from "./panels/AIConfigModal";
import { Code, Settings, Terminal, Zap } from "lucide-react";

interface SidebarProps {
  selectedFeatures: string[];
  toggleFeature: (feature: string) => void;
}

export default function Sidebar({
  selectedFeatures,
  toggleFeature,
}: SidebarProps) {
  return (
    <div className="h-full w-16 border-r flex flex-col items-center py-4 bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-6 w-full">
        {/* Logo */}
        <div className="flex justify-center items-center w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg">
          T
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* AI Config */}
        <AIConfigModal />

        {/* Settings */}
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>

        {/* Terminal Controls */}
        <div className="flex flex-col items-center space-y-2 pt-4">
          <Button variant="ghost" size="icon" title="Clear Terminal">
            <Terminal className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Restart Terminal">
            <Zap className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Relaunch Terminal">
            <Code className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mt-auto">
        <Tabs defaultValue="features" orientation="vertical" className="w-full">
          <TabsList className="hidden">
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>
          <TabsContent value="features" className="w-full">
            <div className="flex flex-col items-center space-y-2">
              <Button
                variant={
                  selectedFeatures.includes("auth") ? "default" : "ghost"
                }
                size="icon"
                onClick={() => toggleFeature("auth")}
                title="Authentication"
              >
                <span className="text-xs">A</span>
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("database") ? "default" : "ghost"
                }
                size="icon"
                onClick={() => toggleFeature("database")}
                title="Database"
              >
                <span className="text-xs">D</span>
              </Button>
              <Button
                variant={selectedFeatures.includes("api") ? "default" : "ghost"}
                size="icon"
                onClick={() => toggleFeature("api")}
                title="API Integration"
              >
                <span className="text-xs">API</span>
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("upload") ? "default" : "ghost"
                }
                size="icon"
                onClick={() => toggleFeature("upload")}
                title="File Upload"
              >
                <span className="text-xs">U</span>
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("darkmode") ? "default" : "ghost"
                }
                size="icon"
                onClick={() => toggleFeature("darkmode")}
                title="Dark Mode"
              >
                <span className="text-xs">DM</span>
              </Button>
              <Button
                variant={
                  selectedFeatures.includes("responsive") ? "default" : "ghost"
                }
                size="icon"
                onClick={() => toggleFeature("responsive")}
                title="Responsive Design"
              >
                <span className="text-xs">R</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
