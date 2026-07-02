'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Interfaces necesarias
interface Congresista {
  ID_CONGRESISTA: number;
  CANDIDATO: string;
  "COD PARTIDO": string;
  AGRUPACION: string;
  ORIENTACION: string;
  DEPARTAMENTO: string;
  CEDULA: string;
  ASISTENCIA?: 'PRESENTE' | 'AUSENTE';
  // 👇 Añade estos campos:
  CIRCUNSCRIPCION: string;
  "AFINIDAD POLITICA"?: string;
  EDAD?: number;
  "FECHA NACIMIENTO"?: string | Date;
  ANTIGUEDAD?: string;
}

interface Proyecto {
  COD_PROYECTO: number;
  DESCRIPCION: string;
}

interface Voto {
  ID_CONGRESISTA: number;
  VOTACION: 'SI' | 'NO' | 'INDECISO';
  COD_PROYECTO: number;
}

export default function GestorAsistencia() {
  const [usuarioLogueado, setUsuarioLogueado] = useState<string | null>(null);
  
  // Estados de datos
  const [congresistas, setCongresistas] = useState<Congresista[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<number>(0);
  const [cargando, setCargando] = useState(true);

  // Estados de interfaz (Filtros y Selección)
  const [busqueda, setBusqueda] = useState('');
  const [filtroAsistencia, setFiltroAsistencia] = useState('TODOS');
  const [filtroVoto, setFiltroVoto] = useState('TODOS');
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  
  // 🔍 NUEVO: Estado para el PopUp de Perfil
  const [congresistaActivo, setCongresistaActivo] = useState<Congresista | null>(null);

  // Carga inicial
  useEffect(() => {
    const sesion = localStorage.getItem('usuario_congreso');
    if (!sesion) {
      window.location.href = '/';
    } else {
      setUsuarioLogueado(sesion);
    }
    async function fetchData() {
      setCargando(true);
      const [{ data: cData }, { data: pData }, { data: vData }] = await Promise.all([
        supabase.from('CamaraRepresentantes').select('*'),
        supabase.from('PROYECTOS').select('*'),
        supabase.from('VOTOS').select('*')
      ]);

      if (cData) setCongresistas(cData);
      if (pData) {
        setProyectos(pData);
        if (pData.length > 0) setProyectoSeleccionado(pData[0].COD_PROYECTO);
      }
      if (vData) setVotos(vData);
      setCargando(false);
    }
    fetchData();
  }, []);

  // Helpers de Imagen
  const obtenerUrlFoto = (cedula: string) => {
    return supabase.storage.from('IMAGENES').getPublicUrl(`${String(cedula).trim()}.jpg`).data.publicUrl;
  };

  const obtenerUrlLogo = (cod: string) => {
    return supabase.storage.from('LOGOS').getPublicUrl(`${cod.trim()}.jpg`).data.publicUrl;
  };

  const obtenerVoto = (id: number) => {
    const v = votos.find(v => v.ID_CONGRESISTA === id && v.COD_PROYECTO === proyectoSeleccionado);
    return v ? v.VOTACION : 'INDECISO';
  };

  // ======= ACTUALIZACIONES INDIVIDUALES (Para el Modal) =======
  const cambiarAsistenciaIndividual = async (id: number, nuevoEstado: 'PRESENTE' | 'AUSENTE') => {
    setCongresistas(prev => prev.map(c => c.ID_CONGRESISTA === id ? { ...c, ASISTENCIA: nuevoEstado } : c));
    if (congresistaActivo?.ID_CONGRESISTA === id) {
        setCongresistaActivo(prev => prev ? {...prev, ASISTENCIA: nuevoEstado} : null);
    }
    await supabase.from('CamaraRepresentantes').update({ ASISTENCIA: nuevoEstado }).eq('ID_CONGRESISTA', id);
  };

  const cambiarVotoIndividual = async (id: number, val: 'SI' | 'NO' | 'INDECISO') => {
    setVotos(prev => {
      const filtrados = prev.filter(v => !(v.COD_PROYECTO === proyectoSeleccionado && v.ID_CONGRESISTA === id));
      return [...filtrados, { ID_CONGRESISTA: id, COD_PROYECTO: proyectoSeleccionado, VOTACION: val }];
    });
    await supabase.from('VOTOS').delete().match({ COD_PROYECTO: proyectoSeleccionado, ID_CONGRESISTA: id });
    await supabase.from('VOTOS').insert([{ ID_CONGRESISTA: id, COD_PROYECTO: proyectoSeleccionado, VOTACION: val }]);
  };

  // Filtrado reactivo de la lista
  const listaFiltrada = useMemo(() => {
    return congresistas.filter(c => {
      const matchBusqueda = `${c.CANDIDATO} ${c.AGRUPACION} ${c.DEPARTAMENTO}`.toLowerCase().includes(busqueda.toLowerCase());
      const asisReal = c.ASISTENCIA === 'PRESENTE' ? 'PRESENTE' : 'AUSENTE';
      const matchAsistencia = filtroAsistencia === 'TODOS' || asisReal === filtroAsistencia;
      const matchVoto = filtroVoto === 'TODOS' || obtenerVoto(c.ID_CONGRESISTA) === filtroVoto;
      
      return matchBusqueda && matchAsistencia && matchVoto;
    });
  }, [congresistas, votos, busqueda, filtroAsistencia, filtroVoto, proyectoSeleccionado]);

  // ======= ACCIONES MASIVAS =======
  const manejarAsistenciaMasiva = async (estado: 'PRESENTE' | 'AUSENTE') => {
    if (seleccionados.length === 0) return;
    setCongresistas(prev => prev.map(c => seleccionados.includes(c.ID_CONGRESISTA) ? { ...c, ASISTENCIA: estado } : c));
    await supabase.from('CamaraRepresentantes').update({ ASISTENCIA: estado }).in('ID_CONGRESISTA', seleccionados);
  };

  const manejarVotoMasivo = async (nuevaVotacion: 'SI' | 'NO' | 'INDECISO') => {
    if (seleccionados.length === 0) return;
    setVotos(prev => {
      const otrosVotos = prev.filter(v => !(v.COD_PROYECTO === proyectoSeleccionado && seleccionados.includes(v.ID_CONGRESISTA)));
      const nuevosVotos = seleccionados.map(id => ({ ID_CONGRESISTA: id, COD_PROYECTO: proyectoSeleccionado, VOTACION: nuevaVotacion }));
      return [...otrosVotos, ...nuevosVotos];
    });
    await supabase.from('VOTOS').delete().eq('COD_PROYECTO', proyectoSeleccionado).in('ID_CONGRESISTA', seleccionados);
    const registros = seleccionados.map(id => ({ ID_CONGRESISTA: id, COD_PROYECTO: proyectoSeleccionado, VOTACION: nuevaVotacion }));
    await supabase.from('VOTOS').insert(registros);
  };

  const toggleSeleccionarTodos = () => {
    if (seleccionados.length === listaFiltrada.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(listaFiltrada.map(c => c.ID_CONGRESISTA));
    }
  };

  const toggleFila = (id: number) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (cargando) return <div className="h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500 italic">Sincronizando con el Congreso...</div>;
  if (!usuarioLogueado) return null; 

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-blue-600 font-bold transition-colors">
            ← Volver al Dashboard
          </Link>
          <div className="h-6 w-px bg-slate-200"></div>
          <h1 className="text-xl font-black text-slate-800">Gestión de Escaños</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Debate Activo:</span>
          <select 
            value={proyectoSeleccionado}
            onChange={(e) => setProyectoSeleccionado(Number(e.target.value))}
            className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {proyectos.map(p => (
              <option key={p.COD_PROYECTO} value={p.COD_PROYECTO}>
                [{p.COD_PROYECTO}] {p.DESCRIPCION.substring(0, 40)}...
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input 
              type="text" placeholder="🔍 Buscar congresista..." 
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select value={filtroAsistencia} onChange={e => setFiltroAsistencia(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 cursor-pointer">
              <option value="TODOS">👥 Asistencia: Todos</option>
              <option value="PRESENTE">✅ Solo Presentes</option>
              <option value="AUSENTE">❌ Solo Ausentes</option>
            </select>
            <select value={filtroVoto} onChange={e => setFiltroVoto(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 cursor-pointer">
              <option value="TODOS">🗳️ Voto: Todos</option>
              <option value="SI">SÍ</option>
              <option value="NO">NO</option>
              <option value="INDECISO">INDECISOS</option>
            </select>
          </div>

          <div className={`flex items-center gap-2 transition-all ${seleccionados.length > 0 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded mr-2">
              {seleccionados.length} SELECCIONADOS
            </span>
            <div className="flex border-r border-slate-200 pr-2 gap-1">
              <button onClick={() => manejarAsistenciaMasiva('PRESENTE')} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">✅ Presentes</button>
              <button onClick={() => manejarAsistenciaMasiva('AUSENTE')} className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">❌ Ausentes</button>
            </div>
            <div className="flex gap-1 pl-2">
              <button onClick={() => manejarVotoMasivo('SI')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm">SÍ</button>
              <button onClick={() => manejarVotoMasivo('NO')} className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm">NO</button>
              <button onClick={() => manejarVotoMasivo('INDECISO')} className="bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm">INDECISOS</button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[500px]">
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-4 text-xs font-black text-slate-500 uppercase tracking-wider">
            <input 
              type="checkbox" 
              checked={seleccionados.length === listaFiltrada.length && listaFiltrada.length > 0} 
              onChange={toggleSeleccionarTodos}
              className="w-4 h-4 cursor-pointer accent-blue-600"
            />
            <div className="w-16">Foto</div>
            <div className="flex-1">Nombre y Colectividad</div>
            <div className="w-32 text-center">Asistencia</div>
            <div className="w-40 text-center">Intención de Voto</div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-1 scrollbar-thin">
            {listaFiltrada.map(c => {
              const suVoto = obtenerVoto(c.ID_CONGRESISTA);
              const isSelected = seleccionados.includes(c.ID_CONGRESISTA);

              return (
                <div key={c.ID_CONGRESISTA} onClick={() => toggleFila(c.ID_CONGRESISTA)} className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}`}>
                  <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 accent-blue-600 pointer-events-none" />

                  <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 relative group">
                    <img src={obtenerUrlFoto(c.CEDULA)} alt={c.CANDIDATO} className="w-full h-full object-cover" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); setCongresistaActivo(c); }}
                        className="absolute inset-0 bg-blue-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold"
                    >
                        PERFIL
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-900 truncate">{c.CANDIDATO}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded uppercase">{c.AGRUPACION}</span>
                      <span className="text-[10px] font-bold text-slate-500">{c.DEPARTAMENTO}</span>
                    </div>
                  </div>

                  <div className="w-32 shrink-0" onClick={e => e.stopPropagation()}>
                    <select 
                      value={c.ASISTENCIA === 'PRESENTE' ? 'PRESENTE' : 'AUSENTE'}
                      onChange={(e) => cambiarAsistenciaIndividual(c.ID_CONGRESISTA, e.target.value as any)}
                      className={`w-full text-xs font-bold px-2 py-1.5 rounded border focus:outline-none cursor-pointer transition-colors ${c.ASISTENCIA === 'PRESENTE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                    >
                      <option value="PRESENTE">✅ PRESENTE</option>
                      <option value="AUSENTE">❌ AUSENTE</option>
                    </select>
                  </div>

                  <div className="w-40 shrink-0" onClick={e => e.stopPropagation()}>
                    <select 
                      value={suVoto}
                      onChange={(e) => cambiarVotoIndividual(c.ID_CONGRESISTA, e.target.value as any)}
                      className={`w-full text-xs font-bold px-2 py-1.5 rounded border focus:outline-none cursor-pointer text-white transition-colors ${suVoto === 'SI' ? 'bg-emerald-500 border-emerald-600' : suVoto === 'NO' ? 'bg-rose-500 border-rose-600' : 'bg-amber-400 border-amber-500'}`}
                    >
                      <option value="SI">👍 A FAVOR</option>
                      <option value="NO">👎 EN CONTRA</option>
                      <option value="INDECISO">🤔 INDECISO</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 🏛️ MODAL DETALLADO DE CONGRESISTA */}
      {congresistaActivo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative max-h-[90vh]">
            <button 
                onClick={() => setCongresistaActivo(null)} 
                className="absolute top-6 right-6 z-50 bg-white/90 hover:bg-slate-100 text-slate-600 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold shadow-md transition-all active:scale-90"
            >✕</button>

            {/* COLUMNA IZQUIERDA: FOTO */}
            <div className="w-full md:w-2/5 relative bg-slate-100 min-h-[300px] md:min-h-full flex-shrink-0">
              <img 
                src={obtenerUrlFoto(congresistaActivo.CEDULA)} 
                alt={congresistaActivo.CANDIDATO} 
                className="absolute inset-0 w-full h-full object-cover object-top" 
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900/90 via-transparent flex items-end justify-center pb-10">
                <div className="w-24 h-24 bg-white rounded-2xl p-3 shadow-2xl border-4 border-white/20">
                  <img src={obtenerUrlLogo(congresistaActivo["COD PARTIDO"])} className="w-full h-full object-contain" alt="Logo Partido" />
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: INFO */}
            <div className="w-full md:w-3/5 bg-white flex flex-col overflow-hidden">
              <div className="p-10 overflow-y-auto flex-1 scrollbar-thin">
                <div className="mb-8">
                    <h2 className="text-3xl font-black text-slate-900 leading-tight mb-2 tracking-tight">{congresistaActivo.CANDIDATO}</h2>
                    <span className="text-blue-600 font-black bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100 text-sm uppercase tracking-wide">
                        {congresistaActivo.AGRUPACION}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {/* Fila 1 */}
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Congresista</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo.ID_CONGRESISTA}</span>
  </div>
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cédula</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo.CEDULA}</span>
  </div>

  {/* Fila 2 */}
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Departamento</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo.DEPARTAMENTO}</span>
  </div>
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Circunscripción</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo.CIRCUNSCRIPCION}</span>
  </div>

  {/* Fila 3 */}
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Orientación</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo.ORIENTACION || 'No definida'}</span>
  </div>
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Afinidad Política</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo["AFINIDAD POLITICA"] || 'No registrada'}</span>
  </div>

  {/* Fila 4 */}
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Edad</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo.EDAD ? `${congresistaActivo.EDAD} años` : 'No registrada'}</span>
  </div>
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Nacimiento</span>
    <span className="font-bold text-slate-700 text-sm">
      {congresistaActivo["FECHA NACIMIENTO"] 
        ? new Date(congresistaActivo["FECHA NACIMIENTO"]).toLocaleDateString('es-CO', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'}) 
        : 'No registrada'}
    </span>
  </div>

  {/* Fila 5 (Ancho completo) */}
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 sm:col-span-2">
    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Antigüedad en el Cargo</span>
    <span className="font-bold text-slate-700 text-sm">{congresistaActivo.ANTIGUEDAD || 'No registrada'}</span>
  </div>
</div>

                {/* CONTROL ASISTENCIA INDIVIDUAL */}
                <div className="mt-8">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Estado de Asistencia</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => cambiarAsistenciaIndividual(congresistaActivo.ID_CONGRESISTA, 'PRESENTE')}
                      className={`py-4 rounded-2xl font-black text-xs transition-all shadow-sm border-2 ${congresistaActivo.ASISTENCIA === 'PRESENTE' ? 'bg-emerald-500 text-white border-emerald-600 scale-[1.02]' : 'bg-white text-slate-400 border-slate-100 hover:border-emerald-200'}`}
                    >✅ PRESENTE</button>
                    <button 
                      onClick={() => cambiarAsistenciaIndividual(congresistaActivo.ID_CONGRESISTA, 'AUSENTE')}
                      className={`py-4 rounded-2xl font-black text-xs transition-all shadow-sm border-2 ${congresistaActivo.ASISTENCIA === 'AUSENTE' ? 'bg-rose-500 text-white border-rose-600 scale-[1.02]' : 'bg-white text-slate-400 border-slate-100 hover:border-rose-200'}`}
                    >❌ AUSENTE</button>
                  </div>
                </div>
              </div>

              {/* FOOTER MODAL: VOTACIÓN */}
              <div className="p-8 bg-slate-50 border-t border-slate-200">
                <label className="block text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Intención de Voto Actual</label>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => cambiarVotoIndividual(congresistaActivo.ID_CONGRESISTA, 'SI')}
                    className={`py-4 rounded-2xl font-black text-sm shadow-md transition-all active:scale-95 ${obtenerVoto(congresistaActivo.ID_CONGRESISTA) === 'SI' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}
                  >SÍ</button>
                  <button 
                    onClick={() => cambiarVotoIndividual(congresistaActivo.ID_CONGRESISTA, 'NO')}
                    className={`py-4 rounded-2xl font-black text-sm shadow-md transition-all active:scale-95 ${obtenerVoto(congresistaActivo.ID_CONGRESISTA) === 'NO' ? 'bg-rose-500 text-white' : 'bg-white text-slate-400'}`}
                  >NO</button>
                  <button 
                    onClick={() => cambiarVotoIndividual(congresistaActivo.ID_CONGRESISTA, 'INDECISO')}
                    className={`py-4 rounded-2xl font-black text-sm shadow-md transition-all active:scale-95 ${obtenerVoto(congresistaActivo.ID_CONGRESISTA) === 'INDECISO' ? 'bg-amber-400 text-white' : 'bg-white text-slate-400'}`}
                  >INDECISO</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}