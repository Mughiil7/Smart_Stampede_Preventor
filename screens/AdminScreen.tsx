
import React, { useState, useEffect } from 'react';
import { SafetyLevel, UserState, Alert, AdminSettings, EmergencyContact } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AdminScreenProps {
  isAuthenticated: boolean;
  onLogin: (password: string) => boolean;
  userState: UserState;
  alerts: Alert[];
}

const AdminScreen: React.FC<AdminScreenProps> = ({ isAuthenticated, onLogin, userState, alerts }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Settings State
  const defaultSettings: AdminSettings = {
    contacts: [],
    autoCall: true,
    autoSMS: true,
    shakeThreshold: 15,
    panicThreshold: 85
  };

  const [settings, setSettings] = useState<AdminSettings>(() => {
    const saved = localStorage.getItem('stampede_admin_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  
  // Maps Grounding State
  const [safetyInsights, setSafetyInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightSources, setInsightSources] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('stampede_admin_settings', JSON.stringify(settings));
    localStorage.setItem('stampede_panic_threshold', settings.panicThreshold.toString());
    localStorage.setItem('stampede_shake_threshold', settings.shakeThreshold.toString());
    window.dispatchEvent(new Event('storage'));
  }, [settings]);

  const saveContact = () => {
    if (!contactName || !contactPhone) return;
    
    if (editingContactId) {
      setSettings(prev => ({
        ...prev,
        contacts: prev.contacts.map(c => c.id === editingContactId ? { ...c, name: contactName, phone: contactPhone } : c)
      }));
    } else {
      const contact: EmergencyContact = {
        id: Math.random().toString(36).substr(2, 9),
        name: contactName,
        phone: contactPhone,
        active: true
      };
      setSettings(prev => ({ ...prev, contacts: [...prev.contacts, contact] }));
    }
    resetContactForm();
  };

  const resetContactForm = () => {
    setEditingContactId(null);
    setContactName('');
    setContactPhone('');
  };

  const editContact = (contact: EmergencyContact) => {
    setEditingContactId(contact.id);
    setContactName(contact.name);
    setContactPhone(contact.phone);
  };

  const removeContact = (id: string) => {
    setSettings(prev => ({ ...prev, contacts: prev.contacts.filter(c => c.id !== id) }));
  };

  const toggleContact = (id: string) => {
    setSettings(prev => ({
      ...prev,
      contacts: prev.contacts.map(c => c.id === id ? { ...c, active: !c.active } : c)
    }));
  };

  const getSafetyInsights = async () => {
    if (!userState.location) return;
    setLoadingInsights(true);
    setSafetyInsights('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `I am managing a potential crowd stampede emergency. The user is at coordinates ${userState.location.lat}, ${userState.location.lng}. 
        Find nearby emergency facilities like hospitals, police stations, and large open areas (parks, stadiums) that could serve as assembly points. 
        Provide specific advice for crowd control in this exact area if possible.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: userState.location.lat,
                longitude: userState.location.lng
              }
            }
          }
        },
      });

      setSafetyInsights(response.text || 'No detailed insights found.');
      setInsightSources(response.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
    } catch (err) {
      console.error("Gemini Error:", err);
      setSafetyInsights("Could not fetch safety insights. Please check API configuration.");
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogin(password)) setError('Invalid credentials.');
  };

  if (!isAuthenticated) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Admin Control</h2>
        <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin Password" className="w-full p-4 border rounded-xl outline-none" />
          {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
          <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg">Enter Panel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* Live Monitor Section */}
      <section className={`p-6 rounded-3xl transition-all shadow-xl border-2 ${
        userState.safetyLevel === SafetyLevel.RED ? 'bg-red-600 border-red-400 text-white' : 
        userState.safetyLevel === SafetyLevel.YELLOW ? 'bg-yellow-400 border-yellow-300 text-slate-900' : 
        'bg-slate-900 border-slate-700 text-white'
      }`}>
        <div className="flex justify-between items-start mb-4">
           <div>
             <span className="text-[10px] font-bold opacity-70 uppercase block mb-1">Live Tracking</span>
             <h3 className="text-xl font-black">{userState.userName || 'User-01'}</h3>
           </div>
           <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">{userState.safetyLevel}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-black/20 p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] opacity-60 block uppercase font-bold mb-1">Sound Level</span>
            <div className="text-xl font-black">{Math.round(userState.soundLevel)}%</div>
          </div>
          <div className="bg-black/20 p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] opacity-60 block uppercase font-bold mb-1">Shake Pulses</span>
            <div className="text-xl font-black">{userState.shakeCount}/3</div>
          </div>
        </div>

        <button 
          onClick={getSafetyInsights} 
          disabled={loadingInsights || !userState.location}
          className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-white/10"
        >
          {loadingInsights ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
          Analyze Surroundings
        </button>

        {safetyInsights && (
          <div className="mt-4 p-4 bg-white/10 border border-white/10 rounded-2xl text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
            <h4 className="font-bold mb-2 uppercase text-[10px] tracking-widest opacity-80 underline">AI Safety Insights</h4>
            {safetyInsights}
            {insightSources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                {insightSources.map((chunk, idx) => (
                  chunk.maps && <a key={idx} href={chunk.maps.uri} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-300 truncate">📍 {chunk.maps.title}</a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Global Config Section */}
      <section className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Global Configuration</h3>
        
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase">Panic Sensitivity (Sound)</label>
              <span className="text-xs font-black text-indigo-600">{settings.panicThreshold}%</span>
            </div>
            <input type="range" min="10" max="100" step="1" value={settings.panicThreshold} onChange={(e) => setSettings(s => ({ ...s, panicThreshold: parseInt(e.target.value) }))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase">Shake Sensitivity (Magnitude)</label>
              <span className="text-xs font-black text-indigo-600">{settings.shakeThreshold} Gs</span>
            </div>
            <input type="range" min="5" max="30" step="1" value={settings.shakeThreshold} onChange={(e) => setSettings(s => ({ ...s, shakeThreshold: parseInt(e.target.value) }))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Lower value = More sensitive</p>
          </div>
        </div>
      </section>

      {/* Emergency Contacts Management (CRUD) */}
      <section className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Emergency Contacts</h3>
          {editingContactId && <button onClick={resetContactForm} className="text-[10px] font-bold text-red-500 uppercase">Cancel Edit</button>}
        </div>

        <div className="space-y-3">
          {settings.contacts.map(contact => (
            <div key={contact.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <button onClick={() => toggleContact(contact.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${contact.active ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                {contact.active && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-800 truncate">{contact.name}</p>
                <p className="text-xs text-slate-500">{contact.phone}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editContact(contact)} className="p-2 bg-slate-200 rounded-lg text-slate-600 hover:bg-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => removeContact(contact.id)} className="p-2 bg-red-50 rounded-lg text-red-500 hover:bg-red-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}

          <div className="bg-slate-100 p-4 rounded-2xl space-y-3 border border-slate-200">
            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{editingContactId ? 'Edit Contact' : 'New Contact'}</div>
            <div className="space-y-2">
              <input type="text" placeholder="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="tel" placeholder="Phone Number" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button onClick={saveContact} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95">
              {editingContactId ? 'UPDATE CONTACT' : 'ADD EMERGENCY CONTACT'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminScreen;
