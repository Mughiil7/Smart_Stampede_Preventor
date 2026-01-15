
import React, { useState, useEffect } from 'react';
import UserScreen from './screens/UserScreen';
import AdminScreen from './screens/AdminScreen';
import { SafetyLevel, UserState, Alert } from './types';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'user' | 'admin'>('user');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // We use a shared key in localStorage to simulate a backend for the demo
  const [globalState, setGlobalState] = useState<UserState>({
    id: 'user-001',
    safetyLevel: SafetyLevel.GREEN,
    soundLevel: 0,
    shakeCount: 0,
    location: null,
    lastUpdate: Date.now()
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Load alerts from storage
  useEffect(() => {
    const savedAlerts = localStorage.getItem('stampede_alerts');
    if (savedAlerts) setAlerts(JSON.parse(savedAlerts));

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'stampede_user_state' && e.newValue) {
        setGlobalState(JSON.parse(e.newValue));
      }
      if (e.key === 'stampede_alerts' && e.newValue) {
        setAlerts(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogin = (password: string) => {
    // Both passwords mentioned in prompt: Demon@Slayer and 1234567
    if (password === 'Demon@Slayer' || password === '1234567') {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-white shadow-xl relative overflow-hidden flex flex-col">
      {/* Navigation Header */}
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center z-50">
        <h1 className="font-bold text-lg flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full animate-pulse ${
            globalState.safetyLevel === SafetyLevel.RED ? 'bg-red-500' : 
            globalState.safetyLevel === SafetyLevel.YELLOW ? 'bg-yellow-400' : 'bg-green-500'
          }`} />
          Stampede Guard
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentScreen('user')}
            className={`px-3 py-1 text-xs rounded-full transition ${currentScreen === 'user' ? 'bg-indigo-600' : 'bg-slate-800'}`}
          >
            User
          </button>
          <button 
            onClick={() => setCurrentScreen('admin')}
            className={`px-3 py-1 text-xs rounded-full transition ${currentScreen === 'admin' ? 'bg-indigo-600' : 'bg-slate-800'}`}
          >
            Admin
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {currentScreen === 'user' ? (
          <UserScreen />
        ) : (
          <AdminScreen 
            isAuthenticated={isAuthenticated} 
            onLogin={handleLogin} 
            userState={globalState}
            alerts={alerts}
          />
        )}
      </main>

      {/* Footer Status */}
      <footer className="bg-slate-100 p-2 text-[10px] text-center text-slate-500 border-t">
        System Status: {globalState.safetyLevel} | Sensors Active
      </footer>
    </div>
  );
};

export default App;
