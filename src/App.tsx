import { useEffect, useState, useRef } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';
import { Power, Thermometer, Droplets, Mic, Zap, StopCircle, RefreshCw } from 'lucide-react';

// Initialize SpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  const [temperature, setTemperature] = useState<number>(0);
  const [humidity, setHumidity] = useState<number>(0);
  
  const [relays, setRelays] = useState({
    Relay1: false,
    Relay2: false,
    Relay3: false,
    Relay4: false,
  });

  const [activeVariation, setActiveVariation] = useState<string | null>(null);
  const variationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Create recognition instance only once if available
  const recognition = useRef<any>(null);

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'id-ID';

      recognition.current.onstart = () => {
        setIsListening(true);
      };

      recognition.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript.toLowerCase();
        setTranscript(text);
        handleVoiceCommand(text);
      };

      recognition.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Fetch Firebase Data
  useEffect(() => {
    const suhuRef = ref(database, 'IoT/Suhu');
    const kelembapanRef = ref(database, 'IoT/Kelembapan');
    
    const r1Ref = ref(database, 'IoT/Relay1');
    const r2Ref = ref(database, 'IoT/Relay2');
    const r3Ref = ref(database, 'IoT/Relay3');
    const r4Ref = ref(database, 'IoT/Relay4');

    const unsubscribeSuhu = onValue(suhuRef, (snapshot) => {
      setTemperature(snapshot.val() || 0);
    });
    
    const unsubscribeKelembapan = onValue(kelembapanRef, (snapshot) => {
      setHumidity(snapshot.val() || 0);
    });

    const unsubscribeR1 = onValue(r1Ref, (s) => setRelays(prev => ({ ...prev, Relay1: !!s.val() })));
    const unsubscribeR2 = onValue(r2Ref, (s) => setRelays(prev => ({ ...prev, Relay2: !!s.val() })));
    const unsubscribeR3 = onValue(r3Ref, (s) => setRelays(prev => ({ ...prev, Relay3: !!s.val() })));
    const unsubscribeR4 = onValue(r4Ref, (s) => setRelays(prev => ({ ...prev, Relay4: !!s.val() })));

    return () => {
      unsubscribeSuhu();
      unsubscribeKelembapan();
      unsubscribeR1();
      unsubscribeR2();
      unsubscribeR3();
      unsubscribeR4();
    };
  }, []);

  const clearVariation = () => {
    if (variationIntervalRef.current) {
      clearInterval(variationIntervalRef.current);
      variationIntervalRef.current = null;
    }
    setActiveVariation(null);
  };

  const updateRelay = (relayKey: string, state: boolean) => {
    // If user interacts manually, we might want to stop the variation
    if (activeVariation) {
      clearVariation();
    }
    set(ref(database, `IoT/${relayKey}`), state);
  };

  const updateMultipleRelays = (states: { [key: string]: boolean }) => {
    Object.keys(states).forEach(key => {
      set(ref(database, `IoT/${key}`), states[key]);
    });
  };

  const toggleListen = () => {
    if (isListening) {
      recognition.current?.stop();
    } else {
      setTranscript('');
      recognition.current?.start();
    }
  };

  const handleVoiceCommand = (command: string) => {
    if (command.includes('semua') || command.includes('semuanya')) {
      if (command.includes('nyala') || command.includes('hidup')) {
        updateMultipleRelays({ Relay1: true, Relay2: true, Relay3: true, Relay4: true });
      } else if (command.includes('mati') || command.includes('padam')) {
        updateMultipleRelays({ Relay1: false, Relay2: false, Relay3: false, Relay4: false });
      }
    } else {
      if (command.includes('1') || command.includes('satu')) {
        updateRelay('Relay1', command.includes('nyala') || command.includes('hidup'));
      }
      if (command.includes('2') || command.includes('dua')) {
        updateRelay('Relay2', command.includes('nyala') || command.includes('hidup'));
      }
      if (command.includes('3') || command.includes('tiga')) {
        updateRelay('Relay3', command.includes('nyala') || command.includes('hidup'));
      }
      if (command.includes('4') || command.includes('empat')) {
        updateRelay('Relay4', command.includes('nyala') || command.includes('hidup'));
      }
    }

    if (command.includes('variasi') || command.includes('animasi')) {
      if (command.includes('1') || command.includes('satu')) {
        startVariation1();
      } else if (command.includes('2') || command.includes('dua')) {
        startVariation2();
      } else if (command.includes('berhenti') || command.includes('stop')) {
        clearVariation();
        updateMultipleRelays({ Relay1: false, Relay2: false, Relay3: false, Relay4: false });
      }
    }
  };

  // Variasi 1: Genap Ganjil
  // Toggles Relay 1 & 3 vs Relay 2 & 4 every 500ms
  const startVariation1 = () => {
    clearVariation();
    setActiveVariation('variasi1');
    let state = true;
    
    variationIntervalRef.current = setInterval(() => {
      updateMultipleRelays({
        Relay1: state,
        Relay2: !state,
        Relay3: state,
        Relay4: !state,
      });
      state = !state;
    }, 500);
  };

  // Variasi 2: 1-3-2-4
  // Sequential running order
  const startVariation2 = () => {
    clearVariation();
    setActiveVariation('variasi2');
    const sequence = ['Relay1', 'Relay3', 'Relay2', 'Relay4'];
    let step = 0;
    
    variationIntervalRef.current = setInterval(() => {
      const states = {
        Relay1: false,
        Relay2: false,
        Relay3: false,
        Relay4: false,
      };
      states[sequence[step] as keyof typeof states] = true;
      updateMultipleRelays(states);
      
      step = (step + 1) % sequence.length;
    }, 500);
  };

  const stopAll = () => {
    clearVariation();
    updateMultipleRelays({ Relay1: false, Relay2: false, Relay3: false, Relay4: false });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 sm:p-10 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Zap className="text-yellow-400 w-8 h-8" />
            Smart IoT Home
          </h1>
          <p className="text-slate-400 mt-1">Control and monitor your devices remotely</p>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Sensor Monitoring */}
        <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg flex items-center gap-6">
            <div className="bg-red-500/20 p-4 rounded-xl">
              <Thermometer className="text-red-400 w-10 h-10" />
            </div>
            <div>
              <p className="text-slate-400 font-medium">Suhu</p>
              <div className="text-4xl font-bold text-white flex items-baseline gap-1">
                {temperature.toFixed(1)} <span className="text-xl text-slate-500">°C</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg flex items-center gap-6">
            <div className="bg-blue-500/20 p-4 rounded-xl">
              <Droplets className="text-blue-400 w-10 h-10" />
            </div>
            <div>
              <p className="text-slate-400 font-medium">Kelembapan</p>
              <div className="text-4xl font-bold text-white flex items-baseline gap-1">
                {humidity.toFixed(1)} <span className="text-xl text-slate-500">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Relay Controls */}
        <div className="col-span-1 md:col-span-2 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg">
          <h2 className="text-xl font-semibold mb-6">Kendali Perangkat (Relay)</h2>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((num) => {
              const key = `Relay${num}` as keyof typeof relays;
              const isOn = relays[key];
              return (
                <button
                  key={key}
                  onClick={() => updateRelay(key, !isOn)}
                  className={`relative overflow-hidden group flex flex-col items-center justify-center gap-3 p-6 rounded-xl transition-all duration-300 border ${
                    isOn 
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className={`p-4 rounded-full transition-colors duration-300 ${isOn ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`}>
                    <Power className={`w-8 h-8 ${isOn ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors duration-300'}`} />
                  </div>
                  <span className={`font-semibold tracking-wide ${isOn ? 'text-emerald-400' : 'text-slate-400'}`}>
                    Lamp {num}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tools and Voice Control */}
        <div className="col-span-1 flex flex-col gap-6">
          
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg flex-1">
            <h2 className="text-xl font-semibold mb-6">Variasi Animasi</h2>
            <div className="flex flex-col gap-3">
              <button 
                onClick={startVariation1}
                className={`p-4 rounded-xl flex items-center gap-3 font-medium transition-all ${
                  activeVariation === 'variasi1' ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${activeVariation === 'variasi1' ? 'animate-spin' : ''}`} />
                Variasi 1 (Genap Ganjil)
              </button>
              
              <button 
                onClick={startVariation2}
                className={`p-4 rounded-xl flex items-center gap-3 font-medium transition-all ${
                  activeVariation === 'variasi2' ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${activeVariation === 'variasi2' ? 'animate-spin' : ''}`} />
                Variasi 2 (1-3-2-4)
              </button>

              <button 
                onClick={stopAll}
                className="mt-2 p-4 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center gap-2 font-medium transition-all"
              >
                <StopCircle className="w-5 h-5" />
                Stop Semua
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg flex-1 flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Perintah Suara</h2>
            {!SpeechRecognition && (
              <p className="text-sm text-rose-400 mb-4 font-mono bg-rose-500/10 p-3 rounded">
                Browser Anda tidak mendukung Web Speech API. Gunakan Chrome.
              </p>
            )}
            
            <button
              disabled={!SpeechRecognition}
              onClick={toggleListen}
              className={`flex-1 min-h-[100px] flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all ${
                isListening 
                  ? 'border-fuchsia-500 bg-fuchsia-500/10' 
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
              } ${!SpeechRecognition && 'opacity-50 cursor-not-allowed'}`}
            >
              <div className={`p-4 rounded-full transition-all duration-500 ${isListening ? 'bg-fuchsia-500 animate-pulse shadow-[0_0_30px_rgba(217,70,239,0.5)]' : 'bg-slate-700'}`}>
                <Mic className={`w-8 h-8 ${isListening ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <span className={`text-sm font-medium ${isListening ? 'text-fuchsia-400' : 'text-slate-400'}`}>
                {isListening ? 'Mendengarkan...' : 'Klik untuk Bicara'}
              </span>
            </button>
            
            {transcript && (
              <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Terdeteksi:</p>
                <p className="text-sm font-mono text-emerald-400">"{transcript}"</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
