
import React, { useState, useEffect, useRef } from 'react';
import { SafetyLevel, UserState, Alert } from '../types';

const UserScreen: React.FC = () => {
  const [userId, setUserId] = useState(localStorage.getItem('stampede_user_id') || `USER-${Math.floor(Math.random() * 1000)}`);
  const [userName, setUserName] = useState(localStorage.getItem('stampede_user_name') || '');
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>(SafetyLevel.GREEN);
  const [soundLevel, setSoundLevel] = useState(0);
  const [shakeCount, setShakeCount] = useState(0);
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('stampede_user_id'));
  
  // Dynamic Thresholds from shared storage
  const [panicThreshold, setPanicThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('stampede_panic_threshold');
    return saved ? parseInt(saved, 10) : 85;
  });
  const [shakeThreshold, setShakeThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('stampede_shake_threshold');
    return saved ? parseInt(saved, 10) : 15;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastShakeTimeRef = useRef<number>(0);
  const shakeTimeoutRef = useRef<any>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('stampede_user_id', userId);
    localStorage.setItem('stampede_user_name', userName);
  }, [userId, userName]);

  // Sync thresholds if changed globally
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stampede_panic_threshold' && e.newValue) setPanicThreshold(parseInt(e.newValue, 10));
      if (e.key === 'stampede_shake_threshold' && e.newValue) setShakeThreshold(parseInt(e.newValue, 10));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize Sensors
  useEffect(() => {
    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          const normalized = Math.min(100, (average / 128) * 100);
          setSoundLevel(normalized);

          // Get latest threshold from ref/storage to avoid closure issues
          const currentPThreshold = parseInt(localStorage.getItem('stampede_panic_threshold') || '85', 10);
          
          if (normalized > currentPThreshold) { 
            triggerEmergency(`Excessive Panic Sound Level (> ${currentPThreshold}%)`);
          } else if (normalized > currentPThreshold * 0.6 && safetyLevel !== SafetyLevel.RED) {
             setSafetyLevel(SafetyLevel.YELLOW);
          }
          requestAnimationFrame(checkAudio);
        };
        checkAudio();
      } catch (err) {
        console.error("Mic access denied", err);
      }
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      
      const currentSThreshold = parseInt(localStorage.getItem('stampede_shake_threshold') || '15', 10);
      const magnitude = Math.sqrt(acc.x!**2 + acc.y!**2 + acc.z!**2);
      
      if (magnitude > currentSThreshold) {
        const now = Date.now();
        if (now - lastShakeTimeRef.current > 500) {
          setShakeCount(prev => {
            const next = prev + 1;
            if (next >= 3) {
              triggerEmergency("Device Shaken Thrice");
              return 3;
            }
            return next;
          });
          lastShakeTimeRef.current = now;
          if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
          shakeTimeoutRef.current = setTimeout(() => setShakeCount(0), 5000);
        }
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => console.error("Location access denied", err),
      { enableHighAccuracy: true }
    );

    initMic();
    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      navigator.geolocation.clearWatch(watchId);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (emergencyTriggered) return;
    if (shakeCount >= 1 || soundLevel > (panicThreshold * 0.6)) {
      setSafetyLevel(SafetyLevel.YELLOW);
    } else {
      setSafetyLevel(SafetyLevel.GREEN);
    }
  }, [shakeCount, soundLevel, emergencyTriggered, panicThreshold]);

  useEffect(() => {
    const state: UserState = {
      id: userId,
      userName: userName,
      safetyLevel,
      soundLevel,
      shakeCount,
      location,
      lastUpdate: Date.now()
    };
    localStorage.setItem('stampede_user_state', JSON.stringify(state));
    window.dispatchEvent(new Event('storage'));
  }, [safetyLevel, soundLevel, shakeCount, location, userId, userName]);

  const triggerEmergency = (reason: string) => {
    if (emergencyTriggered) return;
    setEmergencyTriggered(true);
    setSafetyLevel(SafetyLevel.RED);

    const newAlert: Alert = {
      id: Math.random().toString(36).substr(2, 9),
      userId: userId,
      userName: userName,
      timestamp: Date.now(),
      safetyLevel: SafetyLevel.RED,
      location: location ? { lat: location.lat, lng: location.lng } : null,
      reason: reason
    };

    const existingAlerts = JSON.parse(localStorage.getItem('stampede_alerts') || '[]');
    localStorage.setItem('stampede_alerts', JSON.stringify([newAlert, ...existingAlerts]));
    window.dispatchEvent(new Event('storage'));

    console.log(`EMERGENCY: Trigerred due to ${reason}`);
  };

  const resetEmergency = () => {
    setEmergencyTriggered(false);
    setShakeCount(0);
    setSafetyLevel(SafetyLevel.GREEN);
  };

  return (
    <div className="p-6 flex flex-col items-center gap-6 animate-fade-in relative">
      <div className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="overflow-hidden">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">User Identity</h2>
          <p className="font-bold text-slate-800 truncate">{userName || 'Anonymous'} ({userId})</p>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      {showSettings && (
        <div className="w-full bg-slate-100 p-4 rounded-2xl border-2 border-slate-200 animate-slide-down space-y-4 shadow-inner">
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">User Display Name</label>
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Enter your name" className="w-full p-2 rounded-lg border bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Unique User ID</label>
              <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. USER-123" className="w-full p-2 rounded-lg border bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
            </div>
          </div>
          <button onClick={() => setShowSettings(false)} className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">DISMISS</button>
        </div>
      )}

      <div className={`w-44 h-44 rounded-full border-8 flex flex-col items-center justify-center transition-all duration-500 shadow-lg ${
        safetyLevel === SafetyLevel.RED ? 'border-red-500 bg-red-50 text-red-600' :
        safetyLevel === SafetyLevel.YELLOW ? 'border-yellow-400 bg-yellow-50 text-yellow-600' :
        'border-green-500 bg-green-50 text-green-600'
      }`}>
        <span className="text-4xl font-black">{safetyLevel}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest mt-1">Safety Status</span>
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Mic Level</span>
          <div className="text-xl font-black text-slate-700">{Math.round(soundLevel)}%</div>
          <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div className={`h-full ${soundLevel >= panicThreshold ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${soundLevel}%` }} />
          </div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Shake Counter</span>
          <div className="flex justify-center gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center ${shakeCount >= i ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                {i}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full bg-slate-800 text-white p-4 rounded-2xl flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full ${location ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        <div className="flex-1 overflow-hidden">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">GPS Coordinate</span>
          <p className="text-xs font-mono truncate">{location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Waiting for GPS...'}</p>
        </div>
      </div>

      {safetyLevel === SafetyLevel.RED && (
        <button onClick={resetEmergency} className="w-full py-4 bg-slate-100 text-slate-800 rounded-2xl font-black shadow-inner border border-slate-200 animate-pulse">MARK AS SAFE</button>
      )}

      <button onClick={() => triggerEmergency("Manual Panic Button")} className="w-full py-6 bg-red-600 text-white rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-transform">PANIC ALERT</button>
    </div>
  );
};

export default UserScreen;
