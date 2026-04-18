import { Activity, Users, Clock, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const pieData = [
  { name: 'Medium', value: 4085, color: '#FFD8BE' }, // Accent (Yellowish)
  { name: 'Low', value: 4085, color: '#FFB3B3' },    // Soft Red
  { name: 'High', value: 4085, color: '#B3E6CB' },   // Soft Green
];

const barData = [
  { name: 'Logistic Regression', 'Accuracy (%)': 66, 'F1-Score (%)': 76, 'CV F1 (%)': 65 },
  { name: 'Random Forest', 'Accuracy (%)': 90, 'F1-Score (%)': 89, 'CV F1 (%)': 96 },
  { name: 'SVM', 'Accuracy (%)': 93, 'F1-Score (%)': 93, 'CV F1 (%)': 97 },
  { name: 'Gradient Boosting', 'Accuracy (%)': 93, 'F1-Score (%)': 93, 'CV F1 (%)': 96 },
  { name: 'XGBoost (default)', 'Accuracy (%)': 93, 'F1-Score (%)': 93, 'CV F1 (%)': 97 },
  { name: 'XGBoost (Tuned)', 'Accuracy (%)': 94.6, 'F1-Score (%)': 94.2, 'CV F1 (%)': 97.5 },
];

export function DashboardMetrics() {
  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<Activity />} title="MODEL ACCURACY" value="94.63%" color="text-primary" bg="bg-primary/10" />
        <MetricCard icon={<Users />} title="TOTAL STUDENTS" value="6,607" color="text-secondary" bg="bg-secondary/20" />
        <MetricCard icon={<Clock />} title="F1-SCORE" value="94.25%" color="text-emerald-500" bg="bg-emerald-500/10" />
        <MetricCard icon={<Star />} title="BEST MODEL" value="XGBoost" color="text-amber-500" bg="bg-amber-500/10" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Distribution (Left) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass rounded-3xl p-6 flex flex-col"
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-bold text-gray-800 leading-tight">Class<br/>Distribution</h3>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-bold rounded-full border border-emerald-500/20">
              SMOTE Applied
            </span>
          </div>
          
          <div className="h-48 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend */}
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                  {item.name}
                </div>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mt-8">
            <StatBox label="Low (before)" value="1162" valueColor="text-red-500" />
            <StatBox label="Low (after SMOTE)" value="4085" valueColor="text-red-500" />
            <StatBox label="Medium (before)" value="4085" valueColor="text-amber-500" />
            <StatBox label="Medium (after SMOTE)" value="4085" valueColor="text-amber-500" />
            <StatBox label="High (before)" value="38" valueColor="text-emerald-500" />
            <StatBox label="High (after SMOTE)" value="4085" valueColor="text-emerald-500" />
          </div>
        </motion.div>

        {/* Model Comparison (Right) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-3xl p-6 lg:col-span-2 flex flex-col"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-gray-800">Model Comparison</h3>
            <span className="text-xs font-medium text-gray-500">Accuracy & F1-Score (%)</span>
          </div>

          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 0, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6B7280' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  domain={[0, 100]}
                  ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(147, 129, 255, 0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                  iconType="square"
                  iconSize={10}
                />
                <Bar dataKey="Accuracy (%)" fill="#9381FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="F1-Score (%)" fill="#B8B8FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CV F1 (%)" fill="#B3E6CB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, color, bg }: { icon: React.ReactNode, title: string, value: string, color: string, bg: string }) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="glass rounded-2xl p-5 flex items-center gap-4"
    >
      <div className={`p-3 rounded-xl ${bg} ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{title}</p>
        <p className="text-2xl font-extrabold text-gray-800">{value}</p>
      </div>
    </motion.div>
  );
}

function StatBox({ label, value, valueColor }: { label: string, value: string, valueColor: string }) {
  return (
    <div className="bg-white/40 rounded-xl p-3 border border-white/50">
      <p className="text-[10px] text-gray-500 font-medium mb-1 leading-tight">{label}</p>
      <p className={`text-sm font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
