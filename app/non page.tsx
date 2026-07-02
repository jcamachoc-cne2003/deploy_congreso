// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Definimos la estructura que tiene un producto en nuestra base de datos
interface Producto {
  ID: number;
  categoria: string;
  nombre: string;
}

export default function Home() {
  const [categoria, setCategoria] = useState<string>('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);

  useEffect(() => {
    async function obtenerProductos() {
      if (!categoria) {
        setProductos([]);
        return;
      }

      setCargando(true);

      // Consulta a la tabla 'productos' filtrando por la columna 'categoria'
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('categoria', categoria);

      if (error) {
        console.error('Error al consultar Supabase:', error.message);
      } else {
        // Forzamos el tipado de los datos recibidos para que TypeScript esté feliz
        setProductos((data as Producto[]) || []);
      }
      
      setCargando(false);
    }

    obtenerProductos();
  }, [categoria]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 flex flex-col items-center">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white text-center">
          Filtro de Productos
        </h1>

        <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Selecciona una categoría:
        </label>
        
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="w-full p-2.5 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white mb-6"
        >
          <option value="">-- Selecciona --</option>
          <option value="TECNOLOGIA">no es Tecnologia</option>
          <option value="AUTO">no es Auto</option>
        </select>

        <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
          Resultados:
        </h2>

        {cargando && (
          <p className="text-blue-500 text-sm animate-pulse">Consultando base de datos...</p>
        )}

        {!cargando && productos.length === 0 && categoria && (
          <p className="text-gray-500 text-sm italic">
            No hay productos registrados en "{categoria}".
          </p>
        )}

        <ul className="space-y-2 mt-2">
          {productos.map((producto) => (
            <li
              key={producto.ID}
              className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-sm"
            >
              {producto.ID} - {producto.nombre}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}