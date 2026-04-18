import { LayoutDashboard, User, FileSpreadsheet, Activity, Info, Menu } from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ isOpen, setIsOpen, activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'predict', label: 'Predict Student', icon: User },
    { id: 'bulk', label: 'Bulk Upload', icon: FileSpreadsheet },
    { id: 'insights', label: 'Model Insights', icon: Activity },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <motion.div 
      animate={{ width: isOpen ? 260 : 80 }}
      className="glass border-r border-white/50 h-screen flex flex-col relative z-50 shrink-0 bg-white/40 rounded-none border-y-0 border-l-0"
    >
      <div className="p-6 flex items-center justify-center h-24">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-500 hover:text-primary transition-colors rounded-lg hover:bg-white/50"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-primary/10 text-primary font-bold shadow-sm border border-primary/20' 
                  : 'text-gray-600 hover:bg-white/50 hover:text-primary'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : 'text-gray-500'}`} />
              {isOpen && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
