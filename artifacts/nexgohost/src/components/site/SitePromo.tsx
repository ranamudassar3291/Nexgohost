import { motion } from "framer-motion";
import { UserPlus, CreditCard, Rocket, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: <UserPlus size={32} />,
    title: "Create Your Account",
    description: "Sign up in seconds and access your powerful client dashboard to manage your digital assets.",
    color: "bg-blue-500",
  },
  {
    icon: <CreditCard size={32} />,
    title: "Choose Your Plan",
    description: "Select from our range of high-performance shared or reseller hosting packages that fit your needs.",
    color: "bg-primary",
  },
  {
    icon: <Rocket size={32} />,
    title: "Launch Your Business",
    description: "Deploy your websites or start your own hosting brand with our white-label reseller tools.",
    color: "bg-emerald-500",
  },
];

export function SitePromo() {
  return (
    <section className="py-14 bg-[#0F172A] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: "linear-gradient(rgba(106,98,254,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(106,98,254,0.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-3">3-Step Onboarding Guide</h2>
          <p className="text-base text-slate-400 font-medium">
            Your journey to a successful online presence starts here. Follow these simple steps to get launched.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="relative group"
            >
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent z-0 -translate-x-10" />
              )}

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl ${step.color} text-white flex items-center justify-center mb-6 shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform duration-500 border border-white/10`}>
                  {step.icon}
                </div>

                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-black border border-white/20 text-xs shadow-xl">
                  {i + 1}
                </div>

                <h3 className="text-xl font-black text-white mb-3 group-hover:text-primary transition-colors">{step.title}</h3>
                <p className="text-slate-400 font-medium leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href="/order" className="px-8 py-4 bg-primary hover:bg-primary-600 text-white rounded-2xl font-black transition-all inline-flex items-center gap-3 mx-auto shadow-2xl shadow-primary/30 text-sm group">
            Start Your Business Now
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
}
