import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRegister } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, UserPlus } from "lucide-react";

export default function Register() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    company: "",
    phone: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: formData }, {
      onSuccess: (data) => {
        login(data.token);
        toast({ title: "Account created!", description: "Welcome to Nexgohost." });
        setLocation("/client/dashboard");
      },
      onError: (error: any) => {
        toast({ 
          title: "Registration failed", 
          description: error.message || "Please check your inputs", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background py-12">
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Abstract Background" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/90 to-background" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl z-10 p-4"
      >
        <div className="glass-card p-8 md:p-10 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
          
          <div className="relative z-10 mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">Create Account</h1>
            <p className="text-muted-foreground mt-2">Join Nexgohost to deploy and manage your infrastructure.</p>
          </div>

          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">First Name *</label>
                <Input name="firstName" required value={formData.firstName} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Last Name *</label>
                <Input name="lastName" required value={formData.lastName} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Email Address *</label>
                <Input type="email" name="email" required value={formData.email} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Password *</label>
                <Input type="password" name="password" required value={formData.password} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Company Name</label>
                <Input name="company" value={formData.company} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Phone Number</label>
                <Input name="phone" value={formData.phone} onChange={handleChange} className="bg-background/50 border-white/10 h-11" />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 mt-4 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2"><UserPlus className="w-5 h-5"/> Complete Registration</span>}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground relative z-10">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
