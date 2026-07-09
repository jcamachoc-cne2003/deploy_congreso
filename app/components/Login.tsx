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
  const [mostrarClave, setMostrarClave] = useState(false);

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
    <div 
      className="min-h-screen bg-no-repeat bg-[length:100%_100%] bg-center flex items-start pt-16 pb-6 px-6 md:pt-[8vh] md:pl-[270px] selection:bg-yellow-100 relative overflow-hidden font-sans"
    style={{ backgroundImage: "url('/Media/Background_login.png')" }}
    >
      
      {/* Contenedor del Formulario Blanco */}
      <div className="bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden border border-slate-100 z-20">
        
        {/* Encabezado con el Logo, Títulos y Separador */}
        <div className="px-10 ptx-6 pb-4 text-center flex flex-col items-center">
          <img 
            src="/Media/Logo.png" 
            alt="Logo Congreso de la República" 
            className="w-auto h-28 object-contain mb-4"
          />
          
          {/* Título Principal */}
          <h1 className="text-[#001f4d] font-serif font-bold text-2xl tracking-wide uppercase mb-1">
            CONGRESO EN ACCIÓN
          </h1>
          
          {/* Eslogan / Subtítulo */}
          <p className="text-slate-600 italic text-sm mb-2">
            Inteligencia legislativa al servicio del país
          </p>
          
          {/* Línea Divisoria */}
          <hr className="w-full border-t border-slate-300 mb-2" />

          {/* Descripción de la plataforma */}
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            Plataforma de votación y seguimientos de proyectos Congreso de la República de Colombia.
          </p>
        </div>

        {/* Formulario de Entrada */}
        <div className="px-10 pb-6 pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#001f4d] uppercase tracking-wider mb-2">
                Usuario
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">👤</span>
                <input 
                  type="text" 
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all placeholder:text-slate-400"
                  placeholder="Ingrese su usuario"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#001f4d] uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔒</span>
                <input 
                  type={mostrarClave ? "text" : "password"}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-12 py-3.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all placeholder:text-slate-400"
                  placeholder="Ingrese su contraseña"
                />
                <button 
                  type="button"
                  onClick={() => setMostrarClave(!mostrarClave)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-lg"
                >
                  {mostrarClave ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 border border-rose-100 text-xs font-semibold p-3.5 rounded-lg text-center">
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={cargando}
              className="w-full bg-[#001f4d] hover:bg-[#002a66] text-white font-bold text-base px-6 py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span>🔒</span> {cargando ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>

          {/* Banner de información inferior interior */}
          <div className="mt-6 flex items-center gap-3 bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-slate-600 text-xs leading-normal">
            <span className="text-xl shrink-0">🛡️</span>
            <p>Seguridad, transparencia y trazabilidad en cada votación</p>
          </div>
          
          {/* Barra tricolor decorativa en la base de la tarjeta */}
          <div className="flex h-1.5 mt-6 rounded-full overflow-hidden">
            <div className="w-1/3 bg-yellow-400"></div>
            <div className="w-1/3 bg-blue-600"></div>
            <div className="w-1/3 bg-red-600"></div>
          </div>
        </div>
      </div>

    </div>
  );
}