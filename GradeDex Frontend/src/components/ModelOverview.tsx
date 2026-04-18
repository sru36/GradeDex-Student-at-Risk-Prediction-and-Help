import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const modelComparisonData = [
  { model: 'Logistic Regression', accuracy: '66.41%', precision: '94.27%', recall: '66.41%', f1: '77.07%', cvF1: '65.35% ± 0.18%' },
  { model: 'Random Forest', accuracy: '90.77%', precision: '89.86%', recall: '90.77%', f1: '90.15%', cvF1: '97.35% ± 0.18%' },
  { model: 'SVM', accuracy: '94.40%', precision: '95.04%', recall: '94.40%', f1: '94.67%', cvF1: '98.44% ± 0.13%' },
  { model: 'Gradient Boosting', accuracy: '94.63%', precision: '93.87%', recall: '94.63%', f1: '94.24%', cvF1: '97.36% ± 0.33%' },
  { model: 'XGBoost (default)', accuracy: '94.10%', precision: '93.39%', recall: '94.10%', f1: '93.72%', cvF1: '98.05% ± 0.24%' },
  { model: 'XGBoost (Tuned)', accuracy: '94.63%', precision: '93.93%', recall: '94.63%', f1: '94.25%', cvF1: '98.02% ± 0%', isBest: true },
];

const featureImportanceData = [
  { name: 'Hours Studied', value: 5 },
  { name: 'Parental Education Level', value: 5 },
  { name: 'Parental Involvement', value: 5 },
  { name: 'Family Income', value: 6 },
  { name: 'Internet Access', value: 6 },
  { name: 'Distance from Home', value: 6 },
  { name: 'Motivation Level', value: 7 },
  { name: 'Attendance', value: 8 },
  { name: 'Gender', value: 11 },
  { name: 'Extracurricular Activities', value: 12 },
];

const hyperparameters = [
  { key: 'colsample_bytree', value: '1' },
  { key: 'learning_rate', value: '0.2' },
  { key: 'max_depth', value: '7' },
  { key: 'n_estimators', value: '200' },
  { key: 'subsample', value: '0.8' },
];

const smoteDetails = [
  { label: 'F', before: '464', after: '500', color: '#FFB3B3' },
  { label: 'D', before: '697', after: '697', color: '#FFD8BE' },
  { label: 'C', before: '543', after: '543', color: '#FFD8BE' },
  { label: 'B', before: '601', after: '601', color: '#FFD8BE' },
  { label: 'B+', before: '574', after: '574', color: '#B3E6CB' },
  { label: 'A', before: '607', after: '607', color: '#B3E6CB' },
  { label: 'AA', before: '933', after: '933', color: '#B3E6CB' },
  { label: 'AAA', before: '866', after: '866', color: '#B3E6CB' },
];

const classificationReportData = [
  { grade: 'F', precision: '84.2%', recall: '73.3%', f1: '78.3%', support: '116', f1Value: 78.3, color: '#FFB3B3' },
  { grade: 'D', precision: '61.7%', recall: '63.4%', f1: '62.5%', support: '175', f1Value: 62.5, color: '#FFD8BE' },
  { grade: 'C', precision: '35.8%', recall: '36.0%', f1: '35.9%', support: '136', f1Value: 35.9, color: '#FFD8BE' },
  { grade: 'B', precision: '36.7%', recall: '34.0%', f1: '35.3%', support: '150', f1Value: 35.3, color: '#FFD8BE' },
  { grade: 'B+', precision: '41.5%', recall: '42.7%', f1: '42.1%', support: '143', f1Value: 42.1, color: '#B3E6CB' },
  { grade: 'A', precision: '41.1%', recall: '42.8%', f1: '41.9%', support: '152', f1Value: 41.9, color: '#B3E6CB' },
  { grade: 'AA', precision: '62.7%', recall: '63.5%', f1: '63.1%', support: '233', f1Value: 63.1, color: '#B3E6CB' },
  { grade: 'AAA', precision: '81.3%', recall: '83.9%', f1: '82.5%', support: '217', f1Value: 82.5, color: '#B3E6CB' },
];

const classificationAverages = [
  { label: 'macro avg', precision: '55.6%', recall: '54.9%', f1: '55.2%', support: '1322' },
  { label: 'weighted avg', precision: '57.0%', recall: '56.9%', f1: '56.9%', support: '1322' },
];

export function ModelOverview() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Model Comparison Table */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass rounded-3xl p-6 md:p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">Model Comparison</h3>
          <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">5-fold CV</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-white/50">
                <th className="pb-4 pl-4">Model</th>
                <th className="pb-4">Accuracy</th>
                <th className="pb-4">Precision</th>
                <th className="pb-4">Recall</th>
                <th className="pb-4">F1-Score</th>
                <th className="pb-4">CV F1 (Mean)</th>
              </tr>
            </thead>
            <tbody>
              {modelComparisonData.map((row, idx) => (
                <tr key={idx} className={`border-b border-white/30 last:border-0 transition-colors ${row.isBest ? 'bg-primary/10 rounded-xl' : 'hover:bg-white/40'}`}>
                  <td className={`py-4 pl-4 font-medium flex items-center gap-2 ${row.isBest ? 'text-primary font-bold' : 'text-gray-800'}`}>
                    {row.isBest && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                    {row.model}
                  </td>
                  <td className={`py-4 font-semibold ${row.isBest ? 'text-primary' : 'text-gray-600'}`}>{row.accuracy}</td>
                  <td className={`py-4 font-semibold ${row.isBest ? 'text-primary' : 'text-gray-600'}`}>{row.precision}</td>
                  <td className={`py-4 font-semibold ${row.isBest ? 'text-primary' : 'text-gray-600'}`}>{row.recall}</td>
                  <td className={`py-4 font-semibold ${row.isBest ? 'text-primary' : 'text-gray-600'}`}>{row.f1}</td>
                  <td className={`py-4 font-semibold ${row.isBest ? 'text-primary' : 'text-gray-600'}`}>{row.cvF1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feature Importance */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-3xl p-6 md:p-8 flex flex-col"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 leading-tight">Feature<br/>Importance</h3>
              <span className="text-sm font-medium text-gray-500">(XGBoost)</span>
            </div>
            <span className="text-[10px] font-medium text-gray-500 mt-1">Top 10 features</span>
          </div>
          <div className="flex-1 min-h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportanceData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6B7280' }} 
                  width={140} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(147, 129, 255, 0.05)' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  formatter={(value: number) => [`${value}%`, 'Importance']}
                />
                <Bar dataKey="value" fill="#9381FF" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Hyperparameters & SMOTE */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl p-6 md:p-8 lg:col-span-2 flex flex-col gap-8"
        >
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Best Hyperparameters</h3>
            <div className="space-y-2">
              {hyperparameters.map((hp, idx) => (
                <div key={idx} className="flex justify-between items-center p-3.5 bg-white/40 rounded-xl border border-white/50 hover:bg-white/60 transition-colors">
                  <span className="text-sm text-gray-600 font-medium">{hp.key}</span>
                  <span className="text-sm font-bold text-primary">{hp.value}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">SMOTE Balancing</h3>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
              {smoteDetails.map((sm, idx) => (
                <div key={idx} className="flex justify-between items-center p-3.5 bg-white/40 rounded-xl border border-white/50 hover:bg-white/60 transition-colors">
                  <span className="text-sm font-bold" style={{ color: sm.color }}>{sm.label}</span>
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="text-gray-500">{sm.before}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-primary">{sm.after}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Classification Report */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-3xl p-6 md:p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">Classification Report</h3>
          <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">Per-class metrics</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-white/50">
                <th className="pb-4 pl-4">Grade</th>
                <th className="pb-4">Precision</th>
                <th className="pb-4">Recall</th>
                <th className="pb-4 w-48">F1-Score</th>
                <th className="pb-4">Support</th>
              </tr>
            </thead>
            <tbody>
              {classificationReportData.map((row, idx) => (
                <tr key={idx} className="border-b border-white/30 hover:bg-white/40 transition-colors">
                  <td className="py-4 pl-4 font-bold" style={{ color: row.color }}>{row.grade}</td>
                  <td className="py-4 font-semibold text-gray-600">{row.precision}</td>
                  <td className="py-4 font-semibold text-gray-600">{row.recall}</td>
                  <td className="py-4 font-semibold text-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="w-12">{row.f1}</span>
                      <div className="flex-1 h-1.5 bg-white/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ width: `${row.f1Value}%`, backgroundColor: row.color }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 font-semibold text-gray-600">{row.support}</td>
                </tr>
              ))}
              {classificationAverages.map((row, idx) => (
                <tr key={`avg-${idx}`} className="border-t border-white/50">
                  <td className="py-4 pl-4 font-medium italic text-gray-500">{row.label}</td>
                  <td className="py-4 font-medium italic text-gray-500">{row.precision}</td>
                  <td className="py-4 font-medium italic text-gray-500">{row.recall}</td>
                  <td className="py-4 font-medium italic text-gray-500">{row.f1}</td>
                  <td className="py-4 font-medium italic text-gray-500">{row.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
