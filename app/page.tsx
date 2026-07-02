'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import Login from './components/Login';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MapaColombia = dynamic(() => import('./components/MapaColombia'), {
  ssr: false,
  loading: () => <div className="w-full h-[600px] rounded-xl bg-slate-100 animate-pulse" />,
});

interface Congresista {
  ID_CONGRESISTA: number;
  CIRCUNSCRIPCION: string;
  DEPARTAMENTO: string;
  "COD PARTIDO": string;
  AGRUPACION: string;
  ORIENTACION: string;
  CANDIDATO: string;
  CEDULA: string;
  ANTIGUEDAD: string;
  EDAD: number;
  "TOTAL VOTOS": number;
  "FECHA NACIMIENTO"?: Date;
  "AFINIDAD POLITICA"?: string;
  ASISTENCIA?: 'PRESENTE' | 'AUSENTE'; // 👈 NUEVO CAMPO
}

interface Proyecto {
  COD_PROYECTO: number;
  DESCRIPCION: string;
  PLENARIA: string;
  MAYORIA?: 'SIMPLE' | 'ABSOLUTA' | 'CALIFICADA' | 'ESPECIAL'; // 👈 NUEVO CAMPO
}

interface Voto {
  ID_CONGRESISTA: number;
  VOTACION: 'SI' | 'NO' | 'INDECISO';
  COD_PROYECTO: number;
}

function MenuItem({ icon, label, href = "#" }: { icon: string, label: string, href?: string }) {
  // Función para manejar el clic en botones no funcionales
  const handleClick = (e: React.MouseEvent) => {
    if (href === "#") {
      e.preventDefault(); // Evita que la página recargue o suba al inicio
      alert(`⚠️ El módulo de "${label}" se encuentra actualmente EN DESARROLLO.`);
    }
  };

  return (
    <Link 
      href={href} 
      onClick={handleClick}
      className="flex items-center p-4 hover:bg-slate-800 transition-colors group/item rounded-xl mx-2"
    >
      <span className="text-xl min-w-[40px] flex justify-center">{icon}</span>
      <span className="ml-4 font-bold text-slate-400 group-hover/item:text-white opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
        {label}
      </span>
    </Link>
  );
}


export default function DashboardLegislativo() {

  const [usuarioLogueado, setUsuarioLogueado] = useState<string | null>(null);
    const [modalCrearProyecto, setModalCrearProyecto] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  
  // Variables del formulario del nuevo proyecto
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaPlenaria, setNuevaPlenaria] = useState('CAMARA');
  const [nuevaMayoria, setNuevaMayoria] = useState<'SIMPLE'|'ABSOLUTA'|'CALIFICADA'|'ESPECIAL'>('SIMPLE');

useEffect(() => {
    const sesionGuardada = localStorage.getItem('usuario_congreso');
    if (sesionGuardada) {
      setUsuarioLogueado(sesionGuardada);
    }
  }, []);

  // Función de login actualizada para guardar en localStorage
  const handleLoginExitoso = (nombre: string) => {
    setUsuarioLogueado(nombre);
    localStorage.setItem('usuario_congreso', nombre);
  };

  // Datos maestro
  const [congresistas, setCongresistas] = useState<Congresista[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [votos, setVotos] = useState<Voto[]>([]);

  // Selecciones globales
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<number>(0);
    const [modoColor, setModoColor] = useState<'PARTIDO' | 'VOTACION' | 'ASISTENCIA'>('PARTIDO'); // 👈 Agregado 'ASISTENCIA'
  const [cargando, setCargando] = useState<boolean>(true);

  // Popovers e Interacciones
  const [congresistaActivo, setCongresistaActivo] = useState<Congresista | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  
  // Modal de departamento seleccionado
  const [deptoModal, setDeptoModal] = useState<{ nombre: string; x: number; y: number } | null>(null);

  // 1. CARGA INICIAL DE DATOS
  useEffect(() => {
    async function inicializarDashboard() {
      setCargando(true);
      try {
        const { data: dataCongresistas } = await supabase.from('CamaraRepresentantes').select('*');
        const { data: dataProyectos } = await supabase.from('PROYECTOS').select('*');
        const { data: dataVotos } = await supabase.from('VOTOS').select('*');

        if (dataCongresistas) setCongresistas(dataCongresistas);
        if (dataProyectos) {
          setProyectos(dataProyectos);
          if (dataProyectos.length > 0 && proyectoSeleccionado === 0) {
            setProyectoSeleccionado(dataProyectos[0].COD_PROYECTO);
          }
        }
        if (dataVotos) setVotos(dataVotos);
      } catch (err) {
        console.error("Error cargando el ecosistema de tablas:", err);
      } finally {
        setCargando(false);
      }
    }
    inicializarDashboard();
  }, []);

  // 2. CREACIÓN DE PROYECTO CON AUTO-INSERCIÓN DE INDECISOS
const ejecutarCrearProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaDesc.trim()) return;
    
    setCargando(true);
    try {
      // 1. Insertamos dejando que la BD genere el COD_PROYECTO y pedimos que nos devuelva el registro (.select)
      const { data: newProj, error: errProj } = await supabase
        .from('PROYECTOS')
        .insert([{ 
          DESCRIPCION: nuevaDesc.trim(), 
          PLENARIA: nuevaPlenaria,
          MAYORIA: nuevaMayoria
        }])
        .select();

      if (errProj || !newProj) throw errProj;
      
      const codGenerado = newProj[0].COD_PROYECTO;

      // 2. Insertamos los votos INDECISOS iniciales usando el nuevo ID
      const registrosVotos = congresistas.map(c => ({
        ID_CONGRESISTA: c.ID_CONGRESISTA,
        COD_PROYECTO: codGenerado,
        VOTACION: 'INDECISO'
      }));

      const { error: errVotos } = await supabase.from('VOTOS').insert(registrosVotos as any);
      if (errVotos) throw errVotos;

      // 3. Actualizamos la memoria de React
      setProyectos(prev => [...prev, newProj[0] as Proyecto]);
      setVotos(prev => [...prev, ...registrosVotos as Voto[]]);
      setProyectoSeleccionado(codGenerado);
      
      // 4. Limpiamos y cerramos
      setNuevaDesc('');
      setModalCrearProyecto(false);
      
    } catch (err: any) {
      alert(`Error al crear proyecto: ${err.message || 'Desconocido'}`);
    } finally {
      setCargando(false);
    }
  };

  // 🗑️ ELIMINAR PROYECTO
  const ejecutarEliminarProyecto = async () => {
    if (!proyectoSeleccionado) return;
    setCargando(true);
    try {
      // 1. Eliminar primero los votos (Integridad referencial)
      await supabase.from('VOTOS').delete().eq('COD_PROYECTO', proyectoSeleccionado);
      
      // 2. Eliminar el proyecto
      await supabase.from('PROYECTOS').delete().eq('COD_PROYECTO', proyectoSeleccionado);

      // 3. Actualizar Interfaz
      const proyectosRestantes = proyectos.filter(p => p.COD_PROYECTO !== proyectoSeleccionado);
      setProyectos(proyectosRestantes);
      setVotos(prev => prev.filter(v => v.COD_PROYECTO !== proyectoSeleccionado));
      
      if (proyectosRestantes.length > 0) {
        setProyectoSeleccionado(proyectosRestantes[0].COD_PROYECTO);
      } else {
        setProyectoSeleccionado(0);
      }
      
      setModalEliminar(false);
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || 'Desconocido'}`);
    } finally {
      setCargando(false);
    }
  };

  const obtenerVotoCongresista = (id: number) => {
    const registro = votos.find(v => v.ID_CONGRESISTA === id && v.COD_PROYECTO === proyectoSeleccionado);
    return registro ? registro.VOTACION : 'INDECISO';
  };
const estadisticas = (() => {
    // 1. Identificar el proyecto actual y su tipo de mayoría
    const proyectoActual = proyectos.find(p => p.COD_PROYECTO === proyectoSeleccionado);
    const tipoMayoria = proyectoActual?.MAYORIA || 'SIMPLE'; 

    // 2. Cálculos de Asistencia (Quórum)
    const totalCongresistas = congresistas.length || 1;
    const presentes = congresistas.filter(c => c.ASISTENCIA === 'PRESENTE').length;
    const ausentes = totalCongresistas - presentes;
    const asistenciaPct = Math.round((presentes / totalCongresistas) * 100);

    // 3. Filtrar votos válidos (LOGICA ACTUALIZADA: Solo cuentan los PRESENTES para cualquier mayoría)
    const votosProyecto = votos.filter(v => v.COD_PROYECTO === proyectoSeleccionado);
    
    const votosValidos = votosProyecto.filter(v => {
      const congresista = congresistas.find(c => c.ID_CONGRESISTA === v.ID_CONGRESISTA);
      return congresista?.ASISTENCIA === 'PRESENTE';
    });

    // 4. Conteo de votos sobre los congresistas que sí están en el recinto
    const si = votosValidos.filter(v => v.VOTACION === 'SI').length;
    const no = votosValidos.filter(v => v.VOTACION === 'NO').length;
    const indecisos = votosValidos.filter(v => v.VOTACION === 'INDECISO').length;

    // 5. Base de cálculo y Umbrales
    const baseCalculo = tipoMayoria === 'SIMPLE' ? presentes : totalCongresistas;
    const divisor = baseCalculo > 0 ? baseCalculo : 1; 

    const porcentajeSi = Math.round((si / divisor) * 100);
    const porcentajeNo = Math.round((no / divisor) * 100);
    const porcentajeIndecisos = Math.round((indecisos / divisor) * 100);

    let umbral = 0;
    if (tipoMayoria === 'SIMPLE') umbral = Math.floor(presentes / 2) + 1; 
    else if (tipoMayoria === 'ABSOLUTA') umbral = Math.floor(totalCongresistas / 2) + 1; 
    else if (tipoMayoria === 'CALIFICADA') umbral = Math.floor((totalCongresistas * 2) / 3) + 1; 
    else if (tipoMayoria === 'ESPECIAL') umbral = Math.ceil(totalCongresistas * 0.75); 

    const faltanParaAprobar = Math.max(0, umbral - si);
    const aprobado = si >= umbral;

    return {
      tipoMayoria,
      totalCongresistas, presentes, ausentes, asistenciaPct,
      si, no, indecisos, baseCalculo,
      porcentajeSi, porcentajeNo, porcentajeIndecisos,
      umbral, faltanParaAprobar, aprobado
    };
  })();



const cambiarVotoLocal = async (idCongresista: number, nuevaVotacion: 'SI' | 'NO' | 'INDECISO') => {
    try {
      // 1. Buscamos si ya existe un voto en la memoria para este proyecto
      const votoExistente = votos.find(v => v.ID_CONGRESISTA === idCongresista && v.COD_PROYECTO === proyectoSeleccionado);

      if (votoExistente) {
        // 🔄 SI EXISTE: Hacemos una actualización normal (UPDATE)
        const { error } = await supabase
          .from('VOTOS')
          .update({ VOTACION: nuevaVotacion })
          .match({ ID_CONGRESISTA: idCongresista, COD_PROYECTO: proyectoSeleccionado });

        if (!error) {
          setVotos(prev => prev.map(v => 
            v.ID_CONGRESISTA === idCongresista && v.COD_PROYECTO === proyectoSeleccionado
              ? { ...v, VOTACION: nuevaVotacion }
              : v
          ));
        }
      } else {
        // ➕ SI NO EXISTE: Insertamos el registro por primera vez (INSERT)
        const { error } = await supabase
          .from('VOTOS')
          .insert([{ 
            ID_CONGRESISTA: idCongresista, 
            COD_PROYECTO: proyectoSeleccionado, 
            VOTACION: nuevaVotacion 
          }]);

        if (!error) {
          setVotos(prev => [...prev, { 
            ID_CONGRESISTA: idCongresista, 
            COD_PROYECTO: proyectoSeleccionado, 
            VOTACION: nuevaVotacion 
          }]);
        }
      }
    } catch (err) {
      console.error("Error al registrar el voto:", err);
    }
  };

  const toggleAsistencia = async (idCongresista: number, estadoActual?: 'PRESENTE' | 'AUSENTE') => {
    // Si no tiene estado o es AUSENTE, lo pasamos a PRESENTE. Si es PRESENTE, a AUSENTE.
    const nuevoEstado = estadoActual === 'PRESENTE' ? 'AUSENTE' : 'PRESENTE';

    // 1. Actualización optimista: Cambiamos el estado local de la lista maestra
    setCongresistas(prev => prev.map(c => 
      c.ID_CONGRESISTA === idCongresista ? { ...c, ASISTENCIA: nuevoEstado } : c
    ));

    // 2. Si el congresista está abierto en el Modal de Perfil, también lo actualizamos ahí
    if (congresistaActivo?.ID_CONGRESISTA === idCongresista) {
      setCongresistaActivo(prev => prev ? { ...prev, ASISTENCIA: nuevoEstado } : null);
    }

    // 3. Petición silenciosa a Supabase
    try {
      const { error } = await supabase
        .from('CamaraRepresentantes')
        .update({ ASISTENCIA: nuevoEstado })
        .match({ ID_CONGRESISTA: idCongresista });

      if (error) throw error;
    } catch (err) {
      console.error("Error actualizando la asistencia:", err);
      // Opcional: Podrías revertir el cambio local aquí si falla la base de datos
    }
  };

  const generarPosicionesHemiciclo = (totalEscaños: number) => {
    const posiciones: { x: number; y: number }[] = [];
    if (totalEscaños === 0) return posiciones;

    const centerX = 320;  
    const centerY = 385; 
    let totalFilas = 8; 

    const radioMinimo = 85;
    const radioMaximo = 285; 
    const pasoRadio = (radioMaximo - radioMinimo) / (totalFilas - 1);

    const pesosFilas = Array.from({length: totalFilas}, (_, f) => radioMinimo + f * pasoRadio);
    const sumaPesos = pesosFilas.reduce((a,b)=>a+b, 0);
    let capacidadPorFila = pesosFilas.map(peso => Math.round((peso / sumaPesos) * totalEscaños));
    
    let sumaCapacidades = capacidadPorFila.reduce((a, b) => a + b, 0);
    while (sumaCapacidades !== totalEscaños) {
      capacidadPorFila[capacidadPorFila.length - 1] += (totalEscaños > sumaCapacidades ? 1 : -1);
      sumaCapacidades = capacidadPorFila.reduce((a, b) => a + b, 0);
    }

    const escañosAsignadosPorFila = new Array(totalFilas).fill(0);

    for (let i = 0; i < totalEscaños; i++) {
      const ratioGlobal = totalEscaños > 1 ? i / (totalEscaños - 1) : 0.5;
      const margenAngular = 0.10; 
      const angulo = Math.PI - margenAngular - ratioGlobal * (Math.PI - margenAngular * 2);

      let filaElegida = 0;
      let menorOcupacionRelativa = Infinity;

      for (let f = 0; f < totalFilas; f++) {
        const cupoMaximoHastaAhora = (capacidadPorFila[f] * (i + 1)) / totalEscaños;
        const ocupacionRelativa = escañosAsignadosPorFila[f] - cupoMaximoHastaAhora;

        if (escañosAsignadosPorFila[f] < capacidadPorFila[f] && ocupacionRelativa < menorOcupacionRelativa) {
          menorOcupacionRelativa = ocupacionRelativa;
          filaElegida = f;
        }
      }

      escañosAsignadosPorFila[filaElegida]++;
      const radio = radioMinimo + filaElegida * pasoRadio;
      posiciones.push({ x: centerX + radio * Math.cos(angulo), y: centerY - radio * Math.sin(angulo) });
    }
    return posiciones;
  };

  const posicionesEscaños = generarPosicionesHemiciclo(congresistas.length);

const obtenerColorCurul = (congresista: Congresista) => {
    // 👇 NUEVO: Modo Asistencia
    if (modoColor === 'ASISTENCIA') {
      if (congresista.ASISTENCIA === 'PRESENTE') return 'bg-emerald-500 shadow-emerald-500/50 ring-1 ring-emerald-600';
      return 'bg-rose-500 shadow-rose-500/50 ring-1 ring-rose-600 opacity-60'; // Opacidad un poco reducida para dar efecto de "silla vacía"
    }

    if (modoColor === 'VOTACION') {
      const v = obtenerVotoCongresista(congresista.ID_CONGRESISTA);
      if (v === 'SI') return 'bg-emerald-500 shadow-emerald-500/50 ring-1 ring-emerald-600';
      if (v === 'NO') return 'bg-rose-500 shadow-rose-500/50 ring-1 ring-rose-600';
      return 'bg-amber-400 shadow-amber-400/50 ring-1 ring-amber-500';
    }

    const textoLimpio = congresista.AGRUPACION?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (textoLimpio?.includes('PACTO HISTORICO')) return 'bg-rose-500';
    if (textoLimpio?.includes('LIBERAL')) return 'bg-red-500';
    if (textoLimpio?.includes('CONSERVADOR')) return 'bg-blue-700';
    if (textoLimpio?.includes('CENTRO DEMOCRATICO')) return 'bg-sky-500';
    if (textoLimpio?.includes('ALIANZA VERDE')) return 'bg-emerald-500';
    return 'bg-slate-400';
  };

  const obtenerMetricasDepartamento = (nombreDepto: string) => {
    const deptoLimpio = nombreDepto.toUpperCase().trim();
    const representantesDepto = congresistas.filter(c => c.DEPARTAMENTO?.toUpperCase().trim().includes(deptoLimpio));
    
    let si = 0, no = 0, indecisos = 0;
    representantesDepto.forEach(r => {
      const v = obtenerVotoCongresista(r.ID_CONGRESISTA);
      if (v === 'SI') si++;
      else if (v === 'NO') no++;
      else indecisos++;
    });

    const total = representantesDepto.length || 1;
    return {
      representantes: representantesDepto,
      conteo: { si, no, indecisos },
      porcentajes: {
        si: Math.round((si / total) * 100),
        no: Math.round((no / total) * 100),
        indecisos: Math.round((indecisos / total) * 100),
      }
    };
  };

  const obtenerUrlFoto = (cedula: string) => {
    if (!cedula) return null;
    return supabase.storage.from('IMAGENES').getPublicUrl(`${String(cedula).trim()}.jpg`).data.publicUrl;
  };

const obtenerUrlLogo = (codPartido: string) => {
  if (!codPartido) return null;
  
  const cleanCode = String(codPartido).trim();
  const { data } = supabase.storage.from('LOGOS').getPublicUrl(`${cleanCode}.jpg`);
  
  // LOG PARA DIAGNÓSTICO: Copia esta URL en una pestaña nueva del navegador
  console.log(`Buscando logo: ${cleanCode} -> URL: ${data.publicUrl}`);
  
  return data.publicUrl;
};

function LogoPartido({ codPartido }: { codPartido: string }) {
  const [cargado, setCargado] = useState(true);
  
  if (!codPartido || !cargado) return null;

  const url = supabase.storage.from('LOGOS').getPublicUrl(`${codPartido.trim()}.jpg`).data.publicUrl;

  return (
    <img 
      src={url} 
      alt="Logo"
      className="w-full h-full object-contain"
      onError={() => setCargado(false)} 
    />
  );
}

  const metricasDeptoActivo = deptoModal ? obtenerMetricasDepartamento(deptoModal.nombre) : null;

  if (!usuarioLogueado) return <Login onLoginExitoso={handleLoginExitoso} />;
  


return (
    <main className="h-screen bg-slate-50 text-slate-800 flex flex-row overflow-hidden selection:bg-blue-100 relative">
      <aside className="group w-20 hover:w-80 bg-slate-900 h-full flex flex-col transition-all duration-300 ease-in-out z-[101] shadow-2xl shrink-0 border-r border-slate-800">
      <div className="h-16 flex items-center px-6 mb-6 border-b border-slate-800 shrink-0">
        <span className="text-2xl">🏛️</span>
        <span className="ml-4 font-black text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          MENÚ <span className="text-blue-500">SISTEMA</span>
        </span>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        <MenuItem icon="📊" label="Dashboard" href="/" />
        <MenuItem icon="👤" label="Análisis Candidatos" />
        <MenuItem icon="📈" label="Estadísticas" />
        <MenuItem icon="💼" label="Gestión Congresistas" />
        <MenuItem icon="📋" label="Votación y Asistencia" href="/asistencia" />
        <MenuItem icon="📁" label="Gestión Proyectos" />
      </nav>

      {/* Indicador inferior de versión o estado */}
      <div className="p-6 border-t border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">V 2.0 • 2024</p>
      </div>
    </aside>


     <div className="flex-1 flex flex-col min-w-0"> 
      {/* 🚀 1. ENCABEZADO PRINCIPAL (NAVBAR) */}
       <header className="w-full bg-slate-900 text-white shadow-lg shrink-0 h-16 z-[100] relative">
        <div className="w-full max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between">
          
          {/* LADO IZQUIERDO: LOGO */}
          <div className="flex items-center gap-3">
            <span className="text-2xl drop-shadow-md">🏛️</span>
            <h1 className="text-xl font-black tracking-tight text-white">
              Congreso <span className="text-blue-500">Virtual</span>
            </h1>
          </div>

          {/* LADO DERECHO: BOTÓN + PERFIL (Agrupados) */}
          <div className="flex items-center gap-4">
            
            {/* El botón de asistencia ahora está aquí, pegado al perfil */}
            <Link 
              href="/asistencia"
              className="hidden md:flex bg-slate-800 hover:bg-blue-600 text-white text-[11px] font-black px-4 py-2 rounded-xl shadow-sm border border-slate-700 hover:border-blue-500 transition-all items-center gap-2 uppercase tracking-wider"
            >
              📋 Gestión de Escaños
            </Link>

            <div className="relative group flex items-center gap-3 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 shadow-inner">
              <div className="w-8 h-8 rounded-full bg-blue-600 overflow-hidden border-2 border-slate-800 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{usuarioLogueado.substring(0,2).toUpperCase()}</span>
              </div>
              <div className="hidden md:block text-sm">
                <p className="font-bold text-slate-100 leading-tight">{usuarioLogueado}</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest leading-none mt-1">En línea</p>
              </div>
              {/* Botón de cerrar sesión opcional */}
              <button 
                onClick={() => {
                  localStorage.removeItem('usuario_congreso');
                  window.location.reload();
                }}
                className="ml-2 text-slate-500 hover:text-rose-500 transition-colors"
                title="Cerrar Sesión"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 grid-rows-1 lg:grid-rows-2 gap-4 md:gap-6 overflow-hidden">
      {/* 📦 CONTENEDOR PRINCIPAL TIPO DASHBOARD GRID (Sin scroll) */}
      
        {/* 🏛️ SECCIÓN 1: HEMICICLO (Top Left: 2/3 ancho, 1/2 alto) */}
        <div className="lg:col-span-2 lg:row-span-1 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col relative overflow-hidden h-full">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900">CONGRESO DE LA REPUPLICA</h2>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-0.5">
  {proyectos.find(p => p.COD_PROYECTO === proyectoSeleccionado)?.PLENARIA || 'Cargando...'}
</p>
            </div>
            <div className="flex flex-col items-end">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">
                Visualización de Curules
              </label>
              <select 
                value={modoColor}
                onChange={(e) => setModoColor(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm transition-all"
              >
                <option value="PARTIDO">🎨 Bancadas Políticas</option>
                <option value="VOTACION">🗳️ Intención de Voto</option>
                 <option value="ASISTENCIA">📋 Asistencia (Quórum)</option> {/* 👈 NUEVA OPCIÓN AQUÍ */}
              </select>
            </div>
          </div>

          <div className="flex-1 w-full flex justify-center items-end min-h-0 relative pb-2 overflow-visible">
            {/* TRUCO VISUAL: Escala automática para que encaje en el 50% de alto */}
            <div className="relative w-[640px] h-[400px] border-b-2 border-dashed border-slate-200 rounded-b-sm transform scale-[0.6] md:scale-75 lg:scale-[0.80] xl:scale-[0.95] 2xl:scale-100 origin-bottom transition-transform duration-300">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-8 bg-slate-50 border border-slate-200 rounded-t-2xl flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">
                MESA DIRECTIVA
              </div>

              {[...congresistas]
                .sort((a, b) => {
                  const peso = (orientacion: string) => {
                    const limpia = (orientacion || '').toUpperCase().trim();
                    if (limpia.includes('CENTRO IZQUIERDA') || limpia.includes('CENTRO-IZQUIERDA')) return 2;
                    if (limpia.includes('CENTRO DERECHA') || limpia.includes('CENTRO-DERECHA')) return 4;
                    if (limpia.includes('IZQUIERDA')) return 1;
                    if (limpia.includes('DERECHA')) return 5;
                    if (limpia === 'CENTRO' || limpia.includes('CENTRO')) return 3;
                    return 6;
                  };

                  const pesoA = peso(a.ORIENTACION);
                  const pesoB = peso(b.ORIENTACION);
                  if (pesoA !== pesoB) return pesoA - pesoB;

                  const partidoA = (a.AGRUPACION || '').toUpperCase().trim();
                  const partidoB = (b.AGRUPACION || '').toUpperCase().trim();
                  if (partidoA !== partidoB) return partidoA.localeCompare(partidoB);

                  return (a.CANDIDATO || '').toUpperCase().trim().localeCompare((b.CANDIDATO || '').toUpperCase().trim());
                })
                .map((congresista, index) => {
                  const pos = posicionesEscaños[index];
                  if (!pos) return null;
                  const estaActivo = congresistaActivo?.ID_CONGRESISTA === congresista.ID_CONGRESISTA;

                  return (
                    <button
                      key={congresista.ID_CONGRESISTA}
                      onClick={() => setCongresistaActivo(congresista)}
                      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                      className={`absolute w-3.5 h-3.5 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-150 shadow-sm hover:scale-150 ${obtenerColorCurul(congresista)} ${estaActivo ? 'ring-4 ring-blue-400 scale-150 z-30' : ''}`}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        {/* 🗺️ SECCIÓN 2: MAPA (Derecha: 1/3 ancho, Ocupa todo el alto [2 filas]) */}
        <div className="lg:col-span-1 lg:row-span-2 bg-white p-2 rounded-3xl border border-slate-200 shadow-sm relative flex flex-col overflow-hidden h-full">
          <MapaColombia 
            congresistas={congresistas}
            votos={votos}
            proyectoSeleccionado={proyectoSeleccionado}
            onSeleccionarDepartamento={(nombre) => {
              setDeptoModal({ nombre, x: 20, y: 80 });
            }} 
          />

          {/* POPUP MAPA DEPARTAMENTO (Ajustado para no salir de la pantalla) */}
          {deptoModal && metricasDeptoActivo && (
            <div className="absolute top-4 left-4 right-4 bg-white/95 border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-sm max-h-[90%] flex flex-col gap-4 animate-fadeIn">
              
              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div>
                  <h3 className="font-black text-slate-900 text-md uppercase tracking-tight">{deptoModal.nombre}</h3>
                  <p className="text-[11px] text-slate-400">Delegación legislativa e intención de voto</p>
                </div>
                <button onClick={() => setDeptoModal(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm">✕</button>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Intención General del Departamento</span>
                <div className="w-full h-5 rounded-lg overflow-hidden flex font-mono text-[10px] text-white font-bold text-center">
                  <div style={{ width: `${metricasDeptoActivo.porcentajes.si}%` }} className="bg-emerald-500 flex items-center justify-center transition-all">{metricasDeptoActivo.porcentajes.si > 0 && `${metricasDeptoActivo.porcentajes.si}%`}</div>
                  <div style={{ width: `${metricasDeptoActivo.porcentajes.no}%` }} className="bg-rose-500 flex items-center justify-center transition-all">{metricasDeptoActivo.porcentajes.no > 0 && `${metricasDeptoActivo.porcentajes.no}%`}</div>
                  <div style={{ width: `${metricasDeptoActivo.porcentajes.indecisos}%` }} className="bg-amber-400 flex items-center justify-center transition-all">{metricasDeptoActivo.porcentajes.indecisos > 0 && `${metricasDeptoActivo.porcentajes.indecisos}%`}</div>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Representantes a la Cámara ({metricasDeptoActivo.representantes.length})
                </span>
                
                <div className="overflow-y-auto flex-1 border border-slate-100 rounded-xl p-2 bg-slate-50/50 space-y-2.5 pr-1.5 scrollbar-thin">
                  {metricasDeptoActivo.representantes.map(rep => {
                    const suVoto = obtenerVotoCongresista(rep.ID_CONGRESISTA);
                    const logoUrlRep = obtenerUrlLogo(rep["COD PARTIDO"]);
                    
                    return (
                      <div key={rep.ID_CONGRESISTA} className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 relative shadow-inner flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={obtenerUrlFoto(rep.CEDULA) || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="55%" font-size="34" font-family="sans-serif" font-weight="bold" fill="%2394a3b8" dominant-baseline="middle" text-anchor="middle">${((rep.CANDIDATO?.trim().split(/\s+/)[0]?.[0] || '') + (rep.CANDIDATO?.trim().split(/\s+/)[1]?.[0] || '')).toUpperCase()}</text></svg>`} alt={rep.CANDIDATO} className="w-full h-full object-cover" />
                            {logoUrlRep && (
                              <div className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md bg-white border-t border-l border-slate-100 flex items-center justify-center p-0.5 shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={logoUrlRep} alt="Partido" className="w-full h-full object-contain"/>
                              </div>
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <span className="text-xs font-bold text-slate-900 truncate block leading-tight">{rep.CANDIDATO}</span>
                            <span className="text-[10px] font-semibold text-blue-600 truncate block mt-0.5">{rep.AGRUPACION}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button 
    onClick={() => toggleAsistencia(rep.ID_CONGRESISTA, rep.ASISTENCIA)}
    className={`text-[9px] font-bold px-2 py-1 rounded w-full flex items-center justify-center gap-1 transition-all shadow-sm border ${
      rep.ASISTENCIA === 'PRESENTE' 
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
    }`}
  >
    {rep.ASISTENCIA === 'PRESENTE' ? '✅ PRESENTE' : '❌ AUSENTE'}
  </button>
  {/* 👆 FIN NUEVO BOTÓN */}

                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg text-white uppercase text-center min-w-[48px] shadow-sm ${suVoto === 'SI' ? 'bg-emerald-500' : suVoto === 'NO' ? 'bg-rose-500' : 'bg-amber-400'}`}>
                            {suVoto === 'INDECISO' ? 'INDECISO' : suVoto}
                          </span>
                          <select value={suVoto} onChange={(e) => cambiarVotoLocal(rep.ID_CONGRESISTA, e.target.value as any)} className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-1 py-0.5 focus:outline-none cursor-pointer hover:bg-slate-200 transition-colors w-full">
                            <option value="SI">Votar SÍ</option>
                            <option value="NO">Votar NO</option>
                            <option value="INDECISO">Indeciso</option>
                          </select>
                          <button onClick={() => setCongresistaActivo(rep)} className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 w-full hover:bg-blue-100 hover:border-blue-300 transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95">
                            🔍 Perfil
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

          <div className="lg:col-span-1 lg:row-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-full overflow-hidden">
            <div>
              <h2 className="text-xl font-black mb-4">🗂️ Gestión De proyectos vigentes</h2>
              <select 
                value={proyectoSeleccionado} 
                onChange={(e) => setProyectoSeleccionado(Number(e.target.value))} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold shadow-inner focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {proyectos.map(p => (
                  <option key={p.COD_PROYECTO} value={p.COD_PROYECTO}>
                    [{p.COD_PROYECTO}] {p.DESCRIPCION.substring(0, 50)}
                  </option>
                ))}
              </select>
            </div>

            {/* BOTONES DE ACCIÓN: CREAR Y ELIMINAR */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button 
                onClick={() => setModalCrearProyecto(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2 py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                ➕ CREAR NUEVO
              </button>
              <button 
                onClick={() => setModalEliminar(true)}
                disabled={!proyectoSeleccionado || proyectos.length === 0}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs px-2 py-3.5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ ELIMINAR
              </button>
            </div>
          </div>

        {/* 📊 SECCIÓN 4: ESTADÍSTICAS Y QUÓRUM */}
        {/* 📊 SECCIÓN 4: ESTADÍSTICAS Y QUÓRUM */}
        <div className="lg:col-span-1 lg:row-span-1 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col h-full overflow-hidden relative">
          {/* 📌 1. ENCABEZADO FIJO (No hace scroll) */}
          <div className="flex justify-between items-center mb-4 shrink-0 border-b border-slate-100 pb-3">
             <div>
               <h2 className="text-lg font-black text-slate-900 leading-tight">Análisis de Votación</h2>
               <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Datos en Tiempo Real</p>
             </div>
             <div className="text-right flex flex-col items-end gap-1">
               <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm border border-blue-200">
                 MAYORÍA {estadisticas.tipoMayoria}
               </span>
             </div>
          </div>
          
          {/* 📜 2. CONTENEDOR CON SCROLL (Para que todo quepa en pantallas pequeñas) */}
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-2 flex flex-col gap-4 pb-2">
            
            {/* 🏆 VEREDICTO Y VOTOS FALTANTES (Movido al inicio) */}
            <div className="shrink-0">
             {estadisticas.aprobado ? (
               <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-center py-3.5 px-4 rounded-xl shadow-md border border-emerald-700 flex flex-col transform transition-all duration-500 hover:scale-[1.02]">
                 <div className="flex items-center justify-center gap-2 mb-1">
                   <span className="text-2xl animate-bounce">✅</span>
                   <span className="text-lg font-black tracking-tight drop-shadow-sm">¡PROYECTO APROBADO!</span>
                 </div>
                 <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider">
                   Se superó el umbral requerido ({estadisticas.umbral} votos)
                 </span>
               </div>
             ) : (
               <div className="bg-gradient-to-r from-amber-100 to-amber-50 text-amber-800 text-center py-3.5 px-4 rounded-xl border-2 border-amber-300 shadow-inner flex flex-col relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                 <div className="flex items-center justify-center gap-2 mb-1">
                   <span className="text-xl">⚠️</span>
                   <span className="text-base font-black tracking-tight">
                     FALTAN <span className="text-xl text-rose-600 mx-1">{estadisticas.faltanParaAprobar}</span> VOTOS "SÍ"
                   </span>
                 </div>
                 <span className="text-[10px] font-black text-amber-600/80 uppercase tracking-widest">
                   Para el umbral de {estadisticas.umbral} de un total de {estadisticas.baseCalculo} votos posibles
                 </span>
               </div>
             )}
            </div>

            {/* 🎯 BARRA DE PROGRESO Y LÍMITE MÁXIMO (Movido al inicio) */}
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl shrink-0">
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider mb-2">
                 <span className="text-slate-500">Progreso</span>
                 <span className="text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Meta: {estadisticas.umbral} Votos</span>
               </div>
               
               <div className="w-full h-4 bg-slate-200/70 rounded-full overflow-hidden relative border border-slate-200/50 flex shadow-inner">
                 <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${estadisticas.porcentajeSi}%` }} />
                 <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${estadisticas.porcentajeNo}%` }} />
                 <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${estadisticas.porcentajeIndecisos}%` }} />
                 
                 {/* 📍 Marcador Negro Fijo del Umbral Requerido */}
                 <div 
                   className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10 shadow-[0_0_5px_rgba(0,0,0,0.5)] transition-all duration-500" 
                   style={{ left: `${(estadisticas.umbral / (estadisticas.baseCalculo || 1)) * 100}%` }} 
                 />
               </div>
            </div>

            {/* 🗳️ TARJETAS DE VOTOS (SI / NO / INDECISOS) */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 shrink-0">
              <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl text-center shadow-sm flex flex-col justify-center">
                 <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">A Favor</span>
                 <span className="block text-3xl font-black text-emerald-700 leading-none mb-1">{estadisticas.si}</span>
                 <span className="text-[10px] font-bold text-emerald-600/70 bg-emerald-100/50 px-2 py-0.5 rounded-md mx-auto">{estadisticas.porcentajeSi}%</span>
              </div>
               <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-2xl text-center shadow-sm flex flex-col justify-center">
                 <span className="block text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1">En Contra</span>
                 <span className="block text-3xl font-black text-rose-700 leading-none mb-1">{estadisticas.no}</span>
                 <span className="text-[10px] font-bold text-rose-600/70 bg-rose-100/50 px-2 py-0.5 rounded-md mx-auto">{estadisticas.porcentajeNo}%</span>
              </div>
               <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl text-center shadow-sm flex flex-col justify-center">
                 <span className="block text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">Indecisos</span>
                 <span className="block text-3xl font-black text-amber-600 leading-none mb-1">{estadisticas.indecisos}</span>
                 <span className="text-[10px] font-bold text-amber-600/70 bg-amber-100/50 px-2 py-0.5 rounded-md mx-auto">{estadisticas.porcentajeIndecisos}%</span>
              </div>
            </div>

            {/* 👥 MÓDULO DE ASISTENCIA / QUÓRUM (Relegado al fondo) */}
            <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100 shrink-0 mt-1">
               <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Asistencia al Debate</p>
                 <p className="text-sm font-black text-slate-700">
                   {estadisticas.presentes} Presentes <span className="text-slate-400 font-medium text-xs">| {estadisticas.ausentes} Ausentes</span>
                 </p>
               </div>
               <div className="text-right flex items-center gap-2">
                 <span className={`text-2xl font-black tracking-tighter ${estadisticas.asistenciaPct >= 50 ? 'text-emerald-500' : 'text-rose-500'}`}>
                   {estadisticas.asistenciaPct}%
                 </span>
               </div>
            </div>

          </div>
        </div>

       </div>
      </div>
{/* 🟢 MODAL: CREAR PROYECTO */}
      {modalCrearProyecto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-8 relative">
            <button onClick={() => setModalCrearProyecto(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
            
            <h2 className="text-2xl font-black text-slate-900 mb-1">Nuevo Proyecto</h2>
            <p className="text-xs text-slate-500 mb-6">El código será generado automáticamente por el sistema.</p>

            <form onSubmit={ejecutarCrearProyecto} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción del Proyecto</label>
                <textarea 
                  required
                  rows={3}
                  value={nuevaDesc}
                  onChange={(e) => setNuevaDesc(e.target.value)}
                  placeholder="Ej: Reforma Constitucional sobre..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Plenaria / Comisión</label>
                  <select 
                    value={nuevaPlenaria} 
                    onChange={(e) => setNuevaPlenaria(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="CAMARA">CÁMARA</option>
                    <option value="SENADO">SENADO</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                      <option key={num} value={`COMISION ${num}`}>COMISIÓN {num}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipo de Mayoría</label>
                  <select 
                    value={nuevaMayoria} 
                    onChange={(e) => setNuevaMayoria(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="SIMPLE">SIMPLE</option>
                    <option value="ABSOLUTA">ABSOLUTA</option>
                    <option value="CALIFICADA">CALIFICADA (2/3)</option>
                    <option value="ESPECIAL">ESPECIAL (75%)</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={cargando}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-4 rounded-xl shadow-md transition-all mt-6 disabled:opacity-50"
              >
                {cargando ? 'CREANDO...' : 'GUARDAR E INICIALIZAR QUÓRUM'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔴 MODAL: CONFIRMAR ELIMINACIÓN */}
      {modalEliminar && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
            <h2 className="text-xl font-black text-slate-900 mb-2">¿Eliminar Proyecto?</h2>
            <p className="text-sm text-slate-500 mb-6">Esta acción borrará el proyecto <strong className="text-slate-700">[{proyectoSeleccionado}]</strong> y <strong>TODO el historial de votaciones</strong> asociado de forma permanente.</p>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setModalEliminar(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm py-3 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={ejecutarEliminarProyecto}
                disabled={cargando}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all flex justify-center items-center disabled:opacity-50"
              >
                {cargando ? 'Borrando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL FULLSCREEN DE ESCAÑO INDIVIDUAL (MANTENIDO EXACTAMENTE IGUAL) */}
      {congresistaActivo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 bg-slate-900/70 backdrop-blur-sm transition-opacity">
          <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative animate-fadeIn max-h-[95vh]">
            <button onClick={() => setCongresistaActivo(null)} className="absolute top-4 right-4 z-50 bg-white/90 hover:bg-slate-100 text-slate-600 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-md transition-all active:scale-90">✕</button>

            {/* COLUMNA IZQUIERDA */}
            <div className="w-full md:w-2/5 relative bg-slate-100 min-h-[300px] md:min-h-full flex-shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={obtenerUrlFoto(congresistaActivo.CEDULA) || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="55%" font-size="30" font-family="sans-serif" font-weight="bold" fill="%2364748b" dominant-baseline="middle" text-anchor="middle">${((congresistaActivo.CANDIDATO?.trim().split(/\s+/)[0]?.[0] || '') + (congresistaActivo.CANDIDATO?.trim().split(/\s+/)[1]?.[0] || '')).toUpperCase()}</text></svg>`} alt={congresistaActivo.CANDIDATO} className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex items-end justify-center pb-8">
                <div className="w-28 h-28 bg-white rounded-2xl p-3 shadow-2xl border-4 border-white/10 transform translate-y-4">
                  <LogoPartido codPartido={congresistaActivo["COD PARTIDO"]} />
                </div>
              </div>
            </div>

            <div className="w-full md:w-3/5 bg-white flex flex-col max-h-[95vh] overflow-hidden">
  <div className="p-6 md:p-10 overflow-y-auto flex-1 scrollbar-thin">
    <div className="mb-8 text-center md:text-left mt-4 md:mt-0">
      <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-2">{congresistaActivo.CANDIDATO}</h2>
      
      {/* Contenedor flexible para el Partido y el Estado de Asistencia */}
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
        <h3 className="text-lg md:text-xl font-bold text-blue-600 bg-blue-50 inline-block px-4 py-1.5 rounded-lg border border-blue-100">
          {congresistaActivo.AGRUPACION}
        </h3>
        
        {/* 👇 NUEVO BOTÓN DE ASISTENCIA */}
        <button 
          onClick={() => toggleAsistencia(congresistaActivo.ID_CONGRESISTA, congresistaActivo.ASISTENCIA)}
          className={`text-sm font-bold px-4 py-1.5 rounded-lg border flex items-center gap-2 transition-all shadow-sm active:scale-95 ${
            congresistaActivo.ASISTENCIA === 'PRESENTE' 
              ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600' 
              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
          }`}
        >
          {congresistaActivo.ASISTENCIA === 'PRESENTE' ? '✅ Asistencia: PRESENTE' : '❌ Asistencia: AUSENTE'}
        </button>
        {/* 👆 FIN NUEVO BOTÓN */}
      </div>
    </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">ID Congresista</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo.ID_CONGRESISTA}</span></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cédula</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo.CEDULA}</span></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Departamento</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo.DEPARTAMENTO}</span></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Circunscripción</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo.CIRCUNSCRIPCION}</span></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Orientación</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo.ORIENTACION || 'No definida'}</span></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Afinidad Política</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo["AFINIDAD POLITICA"] || 'No registrada'}</span></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Edad</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo.EDAD ? `${congresistaActivo.EDAD} años` : 'No registrada'}</span></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Fecha Nacimiento</span>
                    <span className="font-bold text-slate-700 text-sm">{congresistaActivo["FECHA NACIMIENTO"] ? new Date(congresistaActivo["FECHA NACIMIENTO"]).toLocaleDateString('es-CO', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'}) : 'No registrada'}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 sm:col-span-2"><span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Antigüedad</span><span className="font-bold text-slate-700 text-sm">{congresistaActivo.ANTIGUEDAD || 'No registrada'}</span></div>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-200 shrink-0">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">Intención de Voto Actual</label>
                <div className="grid grid-cols-3 gap-3 md:gap-4 text-center font-sans font-bold text-xs md:text-sm">
                  <button onClick={() => cambiarVotoLocal(congresistaActivo.ID_CONGRESISTA, 'SI')} className={`py-3 md:py-4 rounded-xl border-2 transition-all shadow-sm ${obtenerVotoCongresista(congresistaActivo.ID_CONGRESISTA) === 'SI' ? 'bg-emerald-500 text-white border-emerald-600 scale-105' : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200'}`}>👍 SÍ</button>
                  <button onClick={() => cambiarVotoLocal(congresistaActivo.ID_CONGRESISTA, 'NO')} className={`py-3 md:py-4 rounded-xl border-2 transition-all shadow-sm ${obtenerVotoCongresista(congresistaActivo.ID_CONGRESISTA) === 'NO' ? 'bg-rose-500 text-white border-rose-600 scale-105' : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:border-rose-200'}`}>👎 NO</button>
                  <button onClick={() => cambiarVotoLocal(congresistaActivo.ID_CONGRESISTA, 'INDECISO')} className={`py-3 md:py-4 rounded-xl border-2 transition-all shadow-sm ${obtenerVotoCongresista(congresistaActivo.ID_CONGRESISTA) === 'INDECISO' ? 'bg-amber-400 text-white border-amber-500 scale-105' : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:border-amber-200'}`}>🤔 INDECISO</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}