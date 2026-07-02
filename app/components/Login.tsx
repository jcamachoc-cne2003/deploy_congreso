'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Login({ onLoginExitoso }: { onLoginExitoso: (nombreUsuario: string) => void }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      // Buscamos coincidencia exacta en la tabla USUARIOS
      const { data, error: err } = await supabase
        .from('USUARIOS')
        .select('*')
        .eq('USUARIO', usuario.trim())
        .eq('CLAVE', clave)
        .single();

      if (err || !data) {
        setError('Usuario o contraseña incorrectos.');
      } else {
        onLoginExitoso(data.USUARIO); // Pasamos la barrera
      }
    } catch (err) {
      setError('Error conectando con la base de datos.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 selection:bg-blue-100">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 animate-fadeIn">
        
        {/* Encabezado */}
        <div className="bg-slate-900 px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <span className="text-5xl drop-shadow-md block mb-4">🏛️</span>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">
            Congreso <span className="text-blue-500">Virtual</span>
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            Acceso Administrativo
          </p>
        </div>

        {/* Formulario */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Usuario
              </label>
              <input 
                type="text" 
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                autoComplete="off"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Ingrese su usuario"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Contraseña
              </label>
              <input 
                type="password" /* 👈 Esto pone los asteriscos automáticamente */
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold p-3 rounded-lg text-center animate-bounce">
                ❌ {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={cargando}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
            >
              {cargando ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}