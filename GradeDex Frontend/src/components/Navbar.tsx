import { motion } from 'motion/react';
import { GraduationCap } from 'lucide-react';

export function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 glass mx-4 mt-4 rounded-2xl px-6 py-4 flex justify-between items-center"
    >
      <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
        <GraduationCap className="w-6 h-6" />
        <span>GradeDex</span>
      </div>
      <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
        <a href="#" className="hover:text-primary transition-colors">Home</a>
        <a href="#model" className="hover:text-primary transition-colors">Model</a>
        <a href="#upload" className="hover:text-primary transition-colors">Upload</a>
        <a href="#predict" className="hover:text-primary transition-colors">Predict</a>
      </div>
    </motion.nav>
  );
}
