/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Hero } from './components/Hero';
import { ModelOverview } from './components/ModelOverview';
import { ManualInput } from './components/ManualInput';
import { CsvUpload } from './components/CsvUpload';
import { OutputSection } from './components/OutputSection';
import { FloatingClouds } from './components/FloatingClouds';
import { Sidebar } from './components/Sidebar';
import { About } from './components/About';
import { DashboardMetrics } from './components/DashboardMetrics';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="h-screen w-full relative overflow-hidden font-sans selection:bg-primary/30 flex bg-background text-gray-800">
      <FloatingClouds />
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <main className="flex-1 h-full overflow-y-auto relative z-10">
        <div className="max-w-7xl mx-auto pb-24">
          {activeTab === 'dashboard' && (
            <>
              <Hero onPredictClick={() => setActiveTab('predict')} />
              <DashboardMetrics />
            </>
          )}

          {activeTab === 'predict' && (
            <div className="p-6 md:p-10">
              <ManualInput />
            </div>
          )}

          {activeTab === 'bulk' && (
            <div className="p-6 md:p-10 max-w-4xl mx-auto">
              <CsvUpload />
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="p-6 md:p-10">
              <ModelOverview />
            </div>
          )}

          {activeTab === 'about' && (
            <About />
          )}
        </div>
      </main>
    </div>
  );
}
