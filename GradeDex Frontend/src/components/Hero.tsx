import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export function Hero({ onPredictClick }: { onPredictClick?: () => void }) {
  return (
    <section className="relative z-10 pt-24 pb-16 px-4 text-center max-w-4xl mx-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 border border-highlight text-primary text-xs font-bold uppercase tracking-wider mb-6 shadow-sm backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-accent" />
          <span>ML-Powered Predictions</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-primary mb-4 tracking-wide drop-shadow-sm">
          GradeDex
        </h2>
        <h1 className="text-5xl md:text-7xl font-extrabold text-gray-800 mb-6 tracking-tight leading-tight">
          Predict Student Performance <br/>
          <span className="text-[#9381FF] text-4xl md:text-5xl drop-shadow-md inline-block mt-2">
            Smarter & Faster
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Leverage advanced machine learning to forecast academic outcomes, identify at-risk students, and optimize educational strategies with precision.
        </p>
        <motion.button
          onClick={onPredictClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-gradient-to-r from-primary to-secondary text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all border border-white/20"
        >
          Start Predicting
        </motion.button>
      </motion.div>
    </section>
  );
}
