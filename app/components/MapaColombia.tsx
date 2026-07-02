"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet"; 
import { MapContainer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Congresista {
  ID_CONGRESISTA: number;
  DEPARTAMENTO: string;
}

interface Voto {
  ID_CONGRESISTA: number;
  VOTACION: 'SI' | 'NO' | 'INDECISO';
  COD_PROYECTO: number;
}

interface MapaColombiaProps {
  onSeleccionarDepartamento: (nombre: string) => void;
  congresistas: Congresista[]; 
  votos: Voto[];               
  proyectoSeleccionado: number; 
}

export default function MapaColombia({ 
  onSeleccionarDepartamento, 
  congresistas, 
  votos, 
  proyectoSeleccionado 
}: MapaColombiaProps) {
  
  const posicionColombia: [number, number] = [4.9209, -72.2973];
  const zoomInicial = 5.45;
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonRef = useRef<any>(null);
  const capaActivaRef = useRef<any>(null);

  const [dataColombia, setDataColombia] = useState<any>(null);
  const [errorMapa, setErrorMapa] = useState<string | null>(null);
  const [modoMapa, setModoMapa] = useState<'GENERAL' | 'SI' | 'NO' | 'INDECISO'>('GENERAL');

  // 1. CARGA POR FETCH: Evita que Next.js sature la memoria al compilar
  useEffect(() => {
    fetch('/colombia.geo.json')
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo encontrar el archivo");
        return res.json();
      })
      .then((data) => setDataColombia(data))
      .catch((err) => {
        console.error("Error al cargar el archivo GeoJSON:", err);
        setErrorMapa("No se pudo cargar colombia.geo.json. Asegúrate de haberlo movido a la carpeta 'public' en la raíz del proyecto.");
      });
  }, []);

const obtenerColorPorTendencia = useCallback((nombreDepto: string) => {
    if (!nombreDepto || !congresistas || congresistas.length === 0) return "#f8fafc";

    const normalizar = (texto: string) => 
      (texto || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const deptoLimpio = normalizar(nombreDepto);
    
    const representantesDepto = congresistas.filter(c => 
      normalizar(c.DEPARTAMENTO).includes(deptoLimpio) || deptoLimpio.includes(normalizar(c.DEPARTAMENTO))
    );

    if (representantesDepto.length === 0) return "#f8fafc";

    let si = 0, no = 0, indecisos = 0;

    representantesDepto.forEach(rep => {
      const registroVoto = votos.find(v => v.ID_CONGRESISTA === rep.ID_CONGRESISTA && v.COD_PROYECTO === proyectoSeleccionado);
      const voto = registroVoto ? registroVoto.VOTACION : 'INDECISO';
      
      if (voto === 'SI') si++;
      else if (voto === 'NO') no++;
      else indecisos++;
    });

    const total = si + no + indecisos;
    if (total === 0) return "#f8fafc";

    // Proporciones
    const pSi = si / total;
    const pNo = no / total;
    const pInd = indecisos / total;

    // 🌍 MODO 1: Mapa General (Mixto)
    if (modoMapa === 'GENERAL') {
      const empate = Math.min(pSi, pNo); 
      const effSi = pSi - empate;         
      const effNo = pNo - empate;         
      const effInd = pInd + (empate * 2); 

      const r = Math.round((effSi * 16) + (effNo * 244) + (effInd * 251));
      const g = Math.round((effSi * 185) + (effNo * 63) + (effInd * 191));
      const b = Math.round((effSi * 129) + (effNo * 94) + (effInd * 36));
      return `rgb(${r}, ${g}, ${b})`;
    }

    // 🔴🟢🟡 MODO 2: Mapas de Calor Específicos
    // Función para crear gradientes desde Blanco (0%) hacia el color puro (100%)
    const crearGradiente = (porcentaje: number, rTarget: number, gTarget: number, bTarget: number) => {
      const r = Math.round(255 * (1 - porcentaje) + rTarget * porcentaje);
      const g = Math.round(255 * (1 - porcentaje) + gTarget * porcentaje);
      const b = Math.round(255 * (1 - porcentaje) + bTarget * porcentaje);
      return `rgb(${r}, ${g}, ${b})`;
    };

    if (modoMapa === 'SI') return crearGradiente(pSi, 16, 185, 129);        // Degradado hacia Verde
    if (modoMapa === 'NO') return crearGradiente(pNo, 244, 63, 94);         // Degradado hacia Rojo
    if (modoMapa === 'INDECISO') return crearGradiente(pInd, 251, 191, 36); // Degradado hacia Amarillo

    return "#f8fafc";
  }, [congresistas, votos, proyectoSeleccionado, modoMapa]); // <-- Agregamos modoMapa a las dependencias

  const estiloGeoJson = useCallback((feature: any): L.PathOptions => {
    const nombreDepto = feature.properties?.NOMBRE_DPT || feature.properties?.name;
    const colorDinamico = obtenerColorPorTendencia(nombreDepto);

    return {
      fillColor: colorDinamico, 
      weight: 1,           
      opacity: 1,
      color: "#0F0F0F", 
      fillOpacity: 0.9,
      lineJoin: "round", 
      lineCap: "round",     
      className: feature.properties?.["geojsonstudio-feature-type"] === "text" 
        ? "pointer-events-none" 
        : "map-polygon" 
    };
  }, [obtenerColorPorTendencia]);

  useEffect(() => {
    if (geoJsonRef.current && dataColombia) {
      geoJsonRef.current.eachLayer((layer: any) => {
        if (layer.feature && typeof layer.setStyle === "function") {
          layer.setStyle(estiloGeoJson(layer.feature));
        }
      });
    }
  }, [proyectoSeleccionado, votos, congresistas, dataColombia, estiloGeoJson]);

const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties?.["geojsonstudio-feature-type"] === "text") return;
    const nombreDepartamento = feature.properties?.NOMBRE_DPT || feature.properties?.name;
    if (!layer || typeof layer.on !== "function") return;

    layer.on({
      mouseover: (e: any) => {
        const l = e.target;

        // 🛡️ 1. LIMPIEZA DE SEGURIDAD: 
        // Si el mouse se movió tan rápido que el departamento anterior olvidó limpiarse, lo forzamos.
        if (capaActivaRef.current && capaActivaRef.current !== l) {
          const capaViejaSvg = capaActivaRef.current._path;
          if (capaViejaSvg) capaViejaSvg.classList.remove("map-polygon-hover");
        }

        capaActivaRef.current = l; // Guardamos este departamento como el activo

        // 🎨 2. TRAER AL FRENTE:
        // Garantiza que los departamentos vecinos no se superpongan sobre el borde negro
        if (typeof l.bringToFront === "function") {
          l.bringToFront();
        }

        // ✨ 3. APLICAR EFECTO HOVER
        const elementoSvg = l?._path;
        if (elementoSvg) elementoSvg.classList.add("map-polygon-hover");
      },
      
      mouseout: (e: any) => {
        const l = e.target;
        const elementoSvg = l?._path;
        if (elementoSvg) elementoSvg.classList.remove("map-polygon-hover");

        // Si salimos del departamento normalmente, vaciamos la referencia
        if (capaActivaRef.current === l) {
          capaActivaRef.current = null;
        }
      },
      
      click: () => {
        if (nombreDepartamento) onSeleccionarDepartamento(nombreDepartamento);
      }
    });
  };

  const mapearPuntosATexto = (feature: any, latlng: L.LatLng) => {
    const textoEtiqueta = feature.properties?.["geojsonstudio-text-content"] || "";
    const colorTexto = feature.properties?.["geojsonstudio-text-color"] || "#1e3a8a";
    const haloColor = feature.properties?.["geojsonstudio-text-halo-color"] || "#FFFFFF";

    const iconoTexto = L.divIcon({
      className: "etiqueta-interna-geojson pointer-events-none",
      html: `<span style="color: ${colorTexto}; --halo-color: ${haloColor};">${textoEtiqueta}</span>`,
      iconSize: [100, 16],   
      iconAnchor: [50, 8]    
    });

    const coordenadasCorregidas = L.latLng(
      feature.geometry.coordinates[1], 
      feature.geometry.coordinates[0]  
    );

    return L.marker(coordenadasCorregidas, { 
      icon: iconoTexto,
      interactive: false 
    });
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative z-0">
      {/* 🎛️ SELECTOR DE MODO DE MAPA */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-slate-200 w-48">
        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5 px-1">
          Filtro de Visualización
        </label>
        <select 
          value={modoMapa}
          onChange={(e) => setModoMapa(e.target.value as any)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm transition-all"
        >
          <option value="GENERAL">🌍 General (Mixto)</option>
          <option value="SI">✅ Votos Aprobación</option>
          <option value="NO">❌ Votos Rechazo</option>
          <option value="INDECISO">🤔 Votos Indecisos</option>
        </select>
      </div>
      <style jsx global>{`
        .map-polygon {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.2s ease, stroke-width 0.2s ease !important;
          transform-origin: center !important;
          transform-box: fill-box !important;
          shape-rendering: geometricPrecision;
          pointer-events: auto;
        }
        .map-polygon-hover {
          transform: scale(1.01) !important;
          stroke: #000000 !important; 
          stroke-width: 2.5px !important; 
          filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.1));
          z-index: 999 !important;
        }
        .etiqueta-interna-geojson {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          font-weight: 800;
          font-size: 8.5px; 
          text-align: center;
          white-space: nowrap;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .etiqueta-interna-geojson span {
          text-shadow: -1px -1px 0 var(--halo-color), 1px -1px 0 var(--halo-color), -1px 1px 0 var(--halo-color), 1px 1px 0 var(--halo-color);
        }
        .leaflet-container svg {
          image-rendering: crisp-edges;
        }
        .leaflet-control-attribution { display: none !important; }
      `}</style>

      {errorMapa ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 p-6 text-center gap-2">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm font-bold text-red-600">{errorMapa}</p>
        </div>
      ) : !dataColombia ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-400 animate-pulse">Cargando mapa de Colombia...</p>
        </div>
      ) : (
        <MapContainer
          center={posicionColombia}
          zoom={zoomInicial}
          className="w-full h-full bg-[#e0f2fe]"
          zoomSnap={0.1}             
          dragging={false}           
          zoomControl={false}      
          scrollWheelZoom={false}    
          doubleClickZoom={false}    
          boxZoom={false}            
          keyboard={false}           
          touchZoom={false}          
          ref={mapRef} 
        >
          <GeoJSON
            key={proyectoSeleccionado}
            ref={geoJsonRef}
            data={dataColombia}
            style={estiloGeoJson}
            onEachFeature={onEachFeature}
            pointToLayer={mapearPuntosATexto}
            smoothFactor={0} 
            noClip={true}
          />
        </MapContainer>
      )}
    </div>
  );
}