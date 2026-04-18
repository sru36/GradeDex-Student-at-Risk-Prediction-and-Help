import { motion } from 'motion/react';
import { Download, Table as TableIcon } from 'lucide-react';

export function OutputSection() {
  const dummyData = [
    { id: 'STU-001', prev: 85, att: 92, hours: 15, motiv: 'High', pred: 'A', predColor: 'text-green-700 bg-green-100 border-green-200' },
    { id: 'STU-002', prev: 65, att: 78, hours: 8, motiv: 'Low', pred: 'C', predColor: 'text-yellow-700 bg-yellow-100 border-yellow-200' },
    { id: 'STU-003', prev: 92, att: 98, hours: 20, motiv: 'High', pred: 'A+', predColor: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
    { id: 'STU-004', prev: 55, att: 60, hours: 5, motiv: 'Low', pred: 'D', predColor: 'text-red-700 bg-red-100 border-red-200' },
    { id: 'STU-005', prev: 78, att: 85, hours: 12, motiv: 'Medium', pred: 'B', predColor: 'text-blue-700 bg-blue-100 border-blue-200' },
  ];

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      className="glass rounded-3xl p-8"
      id="predict"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg text-primary">
            <TableIcon className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Prediction Results</h3>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:border-primary hover:text-primary transition-colors shadow-sm text-sm"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </motion.button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/40 shadow-inner">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-white/60 text-xs uppercase tracking-wider text-gray-500 border-b border-white/60">
              <th className="p-4 font-bold">Student ID</th>
              <th className="p-4 font-bold">Prev. Score</th>
              <th className="p-4 font-bold">Attendance</th>
              <th className="p-4 font-bold">Hours Studied</th>
              <th className="p-4 font-bold">Motivation</th>
              <th className="p-4 font-bold">Predicted Grade</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700">
            {dummyData.map((row, i) => (
              <tr key={i} className="border-b border-white/40 hover:bg-white/60 transition-colors last:border-0">
                <td className="p-4 font-mono font-bold text-primary/80">{row.id}</td>
                <td className="p-4 font-medium">{row.prev}%</td>
                <td className="p-4 font-medium">{row.att}%</td>
                <td className="p-4 font-medium">{row.hours} hrs/wk</td>
                <td className="p-4 font-medium">
                  <span className="px-2 py-1 bg-white/50 rounded-md border border-white text-xs">{row.motiv}</span>
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1.5 rounded-lg font-bold text-xs border shadow-sm ${row.predColor}`}>
                    {row.pred}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
