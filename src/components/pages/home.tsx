import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  Code,
  MessageSquare,
  Settings,
  User,
  Workflow,
  Laptop,
  Layers,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../supabase/auth";

export default function LandingPage() {
  const { user, signOut } = useAuth();

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full bg-[rgba(255,255,255,0.8)] backdrop-blur-md border-b border-[#f5f5f7]/30">
        <div className="max-w-[980px] mx-auto flex h-12 items-center justify-between px-4">
          <div className="flex items-center">
            <Link to="/" className="font-medium text-xl">
              AI App Generator
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/workspace">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm font-medium hover:bg-blue-50 hover:text-blue-600 border-blue-200"
                  >
                    <Code className="mr-2 h-4 w-4" />
                    App Builder
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button
                    variant="ghost"
                    className="text-sm font-light hover:text-gray-500"
                  >
                    Dashboard
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-8 w-8 hover:cursor-pointer">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                        alt={user.email || ""}
                      />
                      <AvatarFallback>
                        {user.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="rounded-xl border-none shadow-lg"
                  >
                    <DropdownMenuLabel className="text-xs text-gray-500">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => signOut()}
                    >
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="ghost"
                    className="text-sm font-light hover:text-gray-500"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="rounded-full bg-black text-white hover:bg-gray-800 text-sm px-4">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="pt-12">
        {/* Hero section */}
        <section className="py-20 text-center">
          <h2 className="text-5xl font-semibold tracking-tight mb-1">
            AI-Powered Web App Generator
          </h2>
          <h3 className="text-2xl font-medium text-gray-500 mb-4">
            Create complete web applications with natural language prompts
          </h3>
          <div className="flex justify-center space-x-6 text-xl text-blue-600">
            {user ? (
              <Link
                to="/workspace"
                className="flex items-center hover:underline"
              >
                Open App Builder <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/signup" className="flex items-center hover:underline">
                Get started <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {/* App Builder Preview Image */}
          <div className="mt-8 max-w-5xl mx-auto px-4">
            <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
              <div className="h-8 bg-gray-800 flex items-center px-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              <div className="flex h-[400px]">
                <div className="w-16 bg-gray-800 flex flex-col items-center py-4 space-y-4">
                  <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                  <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                  <div className="w-8 h-8 rounded-full bg-blue-600"></div>
                  <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                </div>
                <div className="flex-1 flex">
                  <div className="w-1/4 bg-gray-900 border-r border-gray-800 p-2">
                    <div className="h-full bg-gray-800 rounded-md"></div>
                  </div>
                  <div className="w-2/4 flex flex-col">
                    <div className="h-3/5 bg-gray-900 border-b border-gray-800 p-2">
                      <div className="h-full bg-gray-800 rounded-md"></div>
                    </div>
                    <div className="h-2/5 bg-gray-900 p-2">
                      <div className="h-full bg-gray-800 rounded-md"></div>
                    </div>
                  </div>
                  <div className="w-1/4 bg-gray-900 border-l border-gray-800 p-2">
                    <div className="h-full bg-gray-800 rounded-md"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section className="py-20 bg-[#f5f5f7] text-center">
          <h2 className="text-5xl font-semibold tracking-tight mb-1">
            Powerful Features
          </h2>
          <h3 className="text-2xl font-medium text-gray-500 mb-4">
            Everything you need to build modern web applications
          </h3>
          <div className="mt-8 max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm text-left">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="text-xl font-medium mb-2">AI Chat Assistant</h4>
              <p className="text-gray-500">
                Conversational AI helps you refine your app requirements and
                provides guidance throughout the development process.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm text-left">
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Workflow className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="text-xl font-medium mb-2">Flow Visualization</h4>
              <p className="text-gray-500">
                Automatically generate and edit MermaidJS diagrams to visualize
                your application structure and user flows.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm text-left">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Laptop className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="text-xl font-medium mb-2">Live Preview</h4>
              <p className="text-gray-500">
                See your application come to life with real-time previews as you
                make changes through natural language prompts.
              </p>
            </div>
          </div>
        </section>

        {/* Grid section for other features */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
          <div className="bg-[#f5f5f7] rounded-3xl p-12 text-center">
            <h2 className="text-4xl font-semibold tracking-tight mb-1">
              Multi-Panel Interface
            </h2>
            <h3 className="text-xl font-medium text-gray-500 mb-4">
              Intuitive workspace for app development
            </h3>
            <div className="mt-4 bg-white p-6 rounded-xl shadow-sm max-w-sm mx-auto">
              <div className="flex gap-2">
                <div className="h-40 w-1/4 bg-gray-100 rounded-md"></div>
                <div className="h-40 w-3/4 bg-gray-100 rounded-md flex flex-col">
                  <div className="h-1/2 bg-gray-200 rounded-t-md"></div>
                  <div className="h-1/2 bg-gray-300 rounded-b-md"></div>
                </div>
              </div>
              <div className="h-10 bg-gray-100 rounded-md w-full mt-2"></div>
            </div>
            {user ? (
              <Link to="/workspace">
                <Button className="mt-6 bg-blue-600 hover:bg-blue-700 text-white">
                  Open App Builder
                </Button>
              </Link>
            ) : (
              <Link to="/signup">
                <Button className="mt-6 bg-blue-600 hover:bg-blue-700 text-white">
                  Sign Up to Try
                </Button>
              </Link>
            )}
          </div>
          <div className="bg-[#f5f5f7] rounded-3xl p-12 text-center">
            <h2 className="text-4xl font-semibold tracking-tight mb-1">
              AI Integration
            </h2>
            <h3 className="text-xl font-medium text-gray-500 mb-4">
              Multiple LLM providers
            </h3>
            <div className="mt-4 bg-gray-900 p-6 rounded-xl shadow-sm max-w-sm mx-auto text-left">
              <pre className="text-green-400 text-xs font-mono overflow-x-auto">
                <code>
                  {`// Select your preferred AI model
const { response } = await aiClient
  .setModel('gpt-4')
  .generateApp({
    prompt: "Create a todo app",
    features: ["auth", "database"]
  });
`}
                </code>
              </pre>
            </div>
            <div className="flex justify-center mt-6 gap-4">
              <div className="bg-white p-2 rounded-lg shadow-sm w-12 h-12 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600">GPT</span>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-sm w-12 h-12 flex items-center justify-center">
                <span className="text-lg font-bold text-purple-600">C</span>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-sm w-12 h-12 flex items-center justify-center">
                <span className="text-lg font-bold text-red-600">G</span>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-sm w-12 h-12 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-500">Az</span>
              </div>
            </div>
          </div>
        </section>

        {/* Call to action section */}
        <section className="py-20 text-center bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <h2 className="text-5xl font-semibold tracking-tight mb-4">
            Start Building Today
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Transform your ideas into fully functional web applications in
            minutes with our AI-powered platform.
          </p>
          {user ? (
            <Link to="/workspace">
              <Button className="rounded-full bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6">
                <Layers className="mr-2 h-5 w-5" /> Open App Builder
              </Button>
            </Link>
          ) : (
            <Link to="/signup">
              <Button className="rounded-full bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6">
                Get Started for Free
              </Button>
            </Link>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#f5f5f7] py-12 text-xs text-gray-500">
        <div className="max-w-[980px] mx-auto px-4">
          <div className="border-b border-gray-300 pb-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">
                AI App Generator
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Components
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Examples
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">
                Resources
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Getting Started
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Tutorials
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">
                Community
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    GitHub
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Discord
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Twitter
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    YouTube
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Licenses
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="py-4">
            <p>Copyright © 2025 AI App Generator. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
