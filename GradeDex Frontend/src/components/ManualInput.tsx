import { motion } from 'motion/react';
import { BookOpen, Home, User as UserIcon, Sparkles } from 'lucide-react';

export function ManualInput() {
  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass rounded-3xl p-8 h-full flex flex-col max-w-5xl mx-auto"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Predict Student Performance</h2>
        <p className="text-gray-600 mt-1">Enter student details below to generate an ML-powered grade prediction.</p>
      </div>

      <form className="space-y-8 flex-1 flex flex-col">
        {/* Section 1: Academic Factors */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Academic Factors</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <InputField label="Hours Studied / week" type="number" placeholder="25" />
            <InputField label="Attendance (%)" type="number" placeholder="90" />
            <InputField label="Previous Scores" type="number" placeholder="85" />
            <InputField label="Sleep Hours / night" type="number" placeholder="7" />
            <InputField label="Tutoring Sessions" type="number" placeholder="2" />
            <InputField label="Physical Activity (hrs/wk)" type="number" placeholder="3" />
          </div>
        </div>

        {/* Section 2: Learning Environment */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Learning Environment</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <SelectField label="Parental Involvement" options={['— Select —', 'Low', 'Medium', 'High']} />
            <SelectField label="Access to Resources" options={['— Select —', 'Low', 'Medium', 'High']} />
            <SelectField label="Extracurricular Activities" options={['— Select —', 'Yes', 'No']} />
            <SelectField label="Internet Access" options={['— Select —', 'Yes', 'No']} />
            <SelectField label="School Type" options={['— Select —', 'Public', 'Private']} />
            <SelectField label="Teacher Quality" options={['— Select (auto-imputed if blank) —', 'Low', 'Medium', 'High']} />
          </div>
        </div>

        {/* Section 3: Personal & Socioeconomic */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <UserIcon className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Personal & Socioeconomic</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <SelectField label="Motivation Level" options={['— Select —', 'Low', 'Medium', 'High']} />
            <SelectField label="Family Income" options={['— Select (auto-imputed if blank) —', 'Low', 'Medium', 'High']} />
            <SelectField label="Peer Influence" options={['— Select —', 'Positive', 'Neutral', 'Negative']} />
            <SelectField label="Learning Disabilities" options={['— Select —', 'Yes', 'No']} />
            <SelectField label="Parental Education Level" options={['— Select (auto-imputed if blank) —', 'High School', 'College', 'Postgraduate']} />
            <SelectField label="Distance from Home" options={['— Select (auto-imputed if blank) —', 'Near', 'Moderate', 'Far']} />
            <SelectField label="Gender" options={['— Select —', 'Male', 'Female', 'Other']} />
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-white/50 flex justify-end gap-4">
          <button
            type="button"
            className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-white/50 transition-colors border border-transparent hover:border-gray-200"
          >
            Clear
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            className="bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-8 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/30 flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Predict Grade
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

function InputField({ label, type, placeholder, min, max }: any) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
      <input 
        type={type} 
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full glass-input rounded-xl px-4 py-2.5 text-gray-800 placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function SelectField({ label, options }: any) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider truncate" title={label}>{label}</label>
      <select className="w-full glass-input rounded-xl px-4 py-2.5 text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 appearance-none bg-white/50">
        {options.map((opt: string, i: number) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
