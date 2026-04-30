'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  BookOpen, Layers, Plus, ChevronRight, 
  Loader2, AlertCircle, X, Save, Trash2 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function ArancelesCategoriasPage() {
  const [categorias, setCategorias] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para el Modal de Nueva Categoría
  const [modalAbierto, setModalAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nombreNuevaCat, setNombreNuevaCat] = useState('')

  useEffect(() => {
    fetchCategorias()
  }, [])

  async function fetchCategorias() {
    setCargando(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('prestaciones')
        .select('"Nombre Categoria"')

      if (dbError) throw dbError

      if (data) {
        const conteo = data.reduce((acc: any, curr: any) => {
          const cat = curr["Nombre Categoria"] || "SIN CATEGORÍA"
          acc[cat] = (acc[cat] || 0) + 1
          return acc
        }, {})

        const listaFinal = Object.keys(conteo).map(nombre => ({
          nombre,
          cantidad: conteo[nombre]
        })).sort((a, b) => a.nombre.localeCompare(b.nombre))

        setCategorias(listaFinal)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  // FUNCIÓN PARA CREAR LA CATEGORÍA "SEMILLA"
  const handleCrearCategoria = async () => {
    if (!nombreNuevaCat.trim()) return alert("Escribe un nombre para la categoría")
    
    setCreando(true)
    try {
      const { error } = await supabase
        .from('prestaciones')
        .insert([{
          "Nombre Categoria": nombreNuevaCat.toUpperCase().trim(),
          "Nombre Accion": "Acción Inicial (Editar)",
          "Precio": 0,
          "Habilitado": "Sí"
        }])

      if (error) throw error

      setModalAbierto(false)
      setNombreNuevaCat('')
      fetchCategorias()
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setCreando(false)
    }
  }

  // FUNCIÓN PARA ELIMINAR CATEGORÍA COMPLETA
  const eliminarCategoria = async (e: React.MouseEvent, nombreCat: string) => {
    e.preventDefault(); // Evita que el Link se active al hacer clic en borrar
    e.stopPropagation();

    const confirmar = confirm(`¿Estás seguro de eliminar la categoría "${nombreCat}" y TODAS sus acciones? Esta acción no se puede deshacer.`);
    if (!confirmar) return;

    try {
      const { error } = await supabase
        .from('prestaciones')
        .delete()
        .eq('Nombre Categoria', nombreCat);

      if (error) throw error;

      alert("Categoría eliminada con éxito");
      fetchCategorias(); // Recargar la lista
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  }

  if (cargando) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl">
              <BookOpen size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none">Arancel Maestro</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3">Gestión de Categorías Clínicas</p>
            </div>
          </div>
          <button 
            onClick={() => setModalAbierto(true)}
            className="bg-blue-600 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus size={18} /> Crear Nueva Categoría
          </button>
        </header>

        {/* GRID DE CATEGORÍAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categorias.map((cat, index) => (
            <div key={index} className="relative group">
              {/* BOTÓN ELIMINAR (FLOTANTE) */}
              <button 
                onClick={(e) => eliminarCategoria(e, cat.nombre)}
                className="absolute top-4 right-4 z-10 p-3 bg-red-50 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm border border-red-100"
                title="Eliminar categoría completa"
              >
                <Trash2 size={16} />
              </button>

              <Link href={`/administracion/configuracion/aranceles/${encodeURIComponent(cat.nombre)}`}>
                <motion.div 
                  whileHover={{ y: -8 }} 
                  className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all mb-6">
                      <Layers size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase italic leading-tight group-hover:text-blue-600 transition-colors pr-8">
                      {cat.nombre}
                    </h3>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {cat.cantidad} Acciones
                    </span>
                    <div className="bg-slate-50 p-2 rounded-xl text-slate-300 group-hover:text-blue-600">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </motion.div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL PARA EL NOMBRE DE LA CATEGORÍA */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative border border-white/20">
              <button onClick={() => setModalAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-6">Nueva Categoría</h2>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Nombre del Arancel</label>
                  <input 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase"
                    placeholder="Ej: CIRUGÍA"
                    value={nombreNuevaCat}
                    onChange={(e) => setNombreNuevaCat(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleCrearCategoria}
                  disabled={creando || !nombreNuevaCat}
                  className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-sm uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200"
                >
                  {creando ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                  Confirmar y Crear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}