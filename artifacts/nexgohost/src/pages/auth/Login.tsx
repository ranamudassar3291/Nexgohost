import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (data) => {
        login(data.token);
        toast({ title: "Welcome back!", description: "Successfully logged in." });
        if (data.user.role === 'admin') {
          setLocation("/admin/dashboard");
        } else {
          setLocation("/client/dashboard");
        }
      },
      onError: (error: any) => {
        toast({ 
          title: "Login failed", 
          description: error.message || "Invalid credentials", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Abstract Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Abstract Server Background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-md z-10 p-4"
      >
        <div className="glass-card p-8 rounded-3xl relative overflow-hidden">
          {/* Subtle glow effect inside card */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/30 rounded-full blur-[60px]" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-[60px]" />

          <div className="relative z-10 flex flex-col items-center mb-8">
            <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Nexgohost" className="w-16 h-16 mb-4 drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
            <h1 className="text-3xl font-display font-bold text-foreground text-center">Welcome Back</h1>
            <p className="text-muted-foreground text-center mt-2">Sign in to manage your hosting</p>
          </div>

          <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground/80 ml-1">Email Address</label>
              <Input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nexgohost.com"
                className="bg-background/50 border-white/10 focus:border-primary focus:ring-primary/20 h-12 rounded-xl text-base placeholder:text-muted-foreground/50"
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-foreground/80">Password</label>
                <Link href="#" className="text-xs text-primary hover:text-primary/80 transition-colors">Forgot password?</Link>
              </div>
              <Input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background/50 border-white/10 focus:border-primary focus:ring-primary/20 h-12 rounded-xl text-base"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">Sign In <ArrowRight className="w-4 h-4" /></span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground relative z-10">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline decoration-primary/50 underline-offset-4">
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
