import { motion } from 'motion/react';

export function About() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12 pb-20">
      <div className="text-center">
        <h2 className="text-4xl font-extrabold text-gray-800 mb-4">About GradeDex</h2>
        <p className="text-xl text-primary font-medium">ML-based student performance prediction</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard 
          icon="🎓" 
          title="Project Overview" 
          content="GradeDex is an end-to-end machine learning web application that predicts student academic performance using real-world structured data. It is inspired by the research paper 'Predicting Student Performance Using Deep Learning and Machine Learning Techniques', adapted to use only Machine Learning models."
        />
        <InfoCard 
          icon="🤖" 
          title="Primary Model: XGBoost" 
          content="XGBoost (Extreme Gradient Boosting) is the central model, tuned via GridSearchCV across 72 hyperparameter combinations with 5-fold stratified cross-validation. It is compared against Logistic Regression, Random Forest, SVM, and Gradient Boosting."
        />
        <InfoCard 
          icon="🩺" 
          title="Missing Value Handling" 
          content="Four columns have confirmed missing values: Teacher_Quality, Distance_from_Home, Parental_Education_Level, and Family_Income. All are imputed using mode (most frequent) strategy. Numeric features use median imputation for robustness against outliers."
        />
        <InfoCard 
          icon="⚖️" 
          title="Class Imbalance: SMOTE" 
          content="The target grades (Low / Medium / High) are imbalanced — High scorers are rare. SMOTE (Synthetic Minority Oversampling Technique) is applied only on the training set after preprocessing. The test set is never oversampled, ensuring honest evaluation metrics."
        />
        <InfoCard 
          icon="📊" 
          title="Dataset" 
          content="6,608 student records with 19 features covering academic habits, socioeconomic factors, and learning environment. Target variable: Exam_Score bucketed into Low (<65), Medium (65–79), and High (≥80)."
        />
        <InfoCard 
          icon="🛠️" 
          title="Tech Stack" 
          content="Backend: Python, FastAPI, scikit-learn, XGBoost, imbalanced-learn, pandas, numpy, joblib. Frontend: Vanilla HTML/CSS/JavaScript, Chart.js. Architecture: REST API + Single-page application."
        />
      </div>

      <div className="pt-10 border-t border-white/50">
        <h3 className="text-2xl font-bold text-gray-800 mb-10 text-center">About the Developers</h3>
        <div className="flex flex-wrap justify-center gap-16">
          <DeveloperCard name="Srushti Rawal" seed="srushti-rawal" />
          <DeveloperCard name="Mayank Saini" seed="mayank-saini" />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, content }: { icon: string, title: string, content: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass rounded-3xl p-8 h-full flex flex-col"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h4 className="text-xl font-bold text-gray-800 mb-3">{title}</h4>
      <p className="text-gray-600 text-sm leading-relaxed flex-1">{content}</p>
    </motion.div>
  );
}

function DeveloperCard({ name, seed }: { name: string, seed: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.05 }}
      className="flex flex-col items-center text-center group"
    >
      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl mb-4 bg-primary/10 relative">
        <img 
          src={`https://picsum.photos/seed/${seed}/200/200`} 
          alt={name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors" />
      </div>
      <h5 className="text-xl font-bold text-gray-800">{name}</h5>
      <p className="text-sm text-primary font-bold uppercase tracking-wider mt-1">Developer</p>
    </motion.div>
  );
}
