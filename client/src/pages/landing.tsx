import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Users, Calendar, BarChart3, Shield, Smartphone } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AutoGlass Pro</span>
            </div>
            <a href="/api/login">
              <Button data-testid="button-login" className="bg-cyan-600 hover:bg-cyan-700">
                Sign In
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Manage Your Auto Glass
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                Business Like a Pro
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              The complete CRM for auto glass professionals. Track jobs, manage technicians, 
              and grow your business with our powerful pipeline management system.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/api/login">
                <Button 
                  data-testid="button-get-started"
                  size="lg" 
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-lg px-8"
                >
                  Get Started
                </Button>
              </a>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Visual Pipeline</h3>
                <p className="text-slate-400">
                  Kanban-style board to track jobs from quote to completion. 
                  See your entire workflow at a glance.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Team Management</h3>
                <p className="text-slate-400">
                  Role-based access for admins, CSRs, and technicians. 
                  Everyone sees exactly what they need.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Mobile-First Tech View</h3>
                <p className="text-slate-400">
                  Technicians get a dedicated mobile interface for field work. 
                  Photo uploads, signatures, and payments on the go.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Calendar Sync</h3>
                <p className="text-slate-400">
                  Automatic Google Calendar integration. 
                  Schedule jobs and keep your team in sync.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Insurance Ready</h3>
                <p className="text-slate-400">
                  Track claims, deductibles, and insurance payments. 
                  All the data you need for quick processing.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-rose-500/20 flex items-center justify-center mb-4">
                  <Wrench className="w-6 h-6 text-rose-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Parts & Pricing</h3>
                <p className="text-slate-400">
                  Automatic labor pricing, VIN decoding, and parts lookup. 
                  Quote jobs faster and more accurately.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-slate-400 mb-4">
              Trusted by auto glass professionals
            </p>
            <a href="/api/login">
              <Button 
                variant="outline" 
                size="lg"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
                data-testid="button-sign-in-bottom"
              >
                Sign In to Get Started
              </Button>
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-700 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500">
            AutoGlass Pro CRM
          </p>
        </div>
      </footer>
    </div>
  );
}
