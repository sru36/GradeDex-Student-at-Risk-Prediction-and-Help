import { motion } from 'motion/react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { useRef } from 'react';

export function CsvUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      className="glass rounded-3xl p-8"
      id="upload"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-highlight/50 rounded-lg text-purple-500">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">Batch Prediction</h3>
      </div>
      <p className="text-gray-600 mb-6 ml-14">
        Upload your dataset to generate predictions for multiple students at once. We support CSV and Excel formats.
      </p>

      <div 
        className="border-2 border-dashed border-secondary/50 rounded-2xl p-10 text-center bg-white/30 hover:bg-white/50 transition-colors cursor-pointer group"
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".csv, .xlsx, .xls" 
        />
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/80 text-primary mb-4 group-hover:scale-110 transition-transform shadow-sm">
          <UploadCloud className="w-8 h-8" />
        </div>
        <p className="text-gray-800 font-semibold mb-1">Drag and drop your CSV or Excel file here</p>
        <p className="text-sm text-gray-500 mb-6">or click to browse from your computer</p>
        
        <button className="px-6 py-2 bg-white text-primary font-bold rounded-lg border border-primary/20 hover:border-primary/50 transition-colors shadow-sm">
          Browse Files
        </button>
      </div>

      <div className="mt-6 flex justify-end">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/30 hover:bg-opacity-90 transition-all flex items-center gap-2"
        >
          <SparklesIcon /> Generate Predictions
        </motion.button>
      </div>
    </motion.div>
  );
}

function SparklesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}
