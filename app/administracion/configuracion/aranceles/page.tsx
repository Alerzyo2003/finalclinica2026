'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  BookOpen, Plus, Loader2, X, Layers, FolderPlus
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ArancelesCategoriasPage() {
  const [categorias, setCategorias] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [nombreNuevaCat, setNombreNuevaCat] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    fetchCategorias()
  }, [])

  async function fetchCategorias() {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('prestaciones')
        .select('"Nombre Categoria"')
      
      if (error) throw error
      
      const catsUnicas = [...new Set(data?.map(p => p['Nombre Categoria']) || [])].filter(Boolean)
      setCategorias(catsUnicas.map(c => ({ nombre: c })))
    } catch (err: any) {
      toast.error("Error al cargar categorías: " + err.message)
    } finally {
      setCargando(false)
    }
  }

  const handleCrearCategoria = async () => {
    if (!nombreNuevaCat.trim()) return toast.error("Escribe un nombre para la categoría")
    
    setCreando(true)
    try {
      const { error } = await supabase.from('prestaciones').insert({
        'Nombre Categoria': nombreNuevaCat.trim(),
        'Nombre Accion': 'Acción de Ejemplo (Puedes borrarla)',
        'Precio': 0,
        'Habilitado': 'No'
      })

      if (error) throw error

      toast.success("Categoría creada con una acción de ejemplo.")
      setModalAbierto(false)
      setNombreNuevaCat('')
      fetchCategorias()
    } catch (err: any) {
      toast.error("Error al crear la categoría: " + err.message)
    } finally {
      setCreando(false)
    }
  }

  if (cargando) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-blue-600" size={40}/></div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-100 text-slate-500 rounded-2xl"><BookOpen size={24} /></div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 uppercase italic leading-none">Arancel de Prestaciones</h1>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Agrupado por Categorías</p>
            </div>
          </div>
          <button onClick={() => setModalAbierto(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2"><Plus size={18} /> Nueva Categoría</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cargando ? (
            <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32}/></div>
          ) : categorias.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <Layers size={40} className="mx-auto text-slate-300 mb-4"/>
                <p className="font-black text-slate-500">No hay categorías de aranceles.</p>
                <p className="text-sm text-slate-400 mt-2">Crea la primera para empezar a organizar tus prestaciones.</p>
            </div>
          ) : (
            categorias.map((cat) => (
              <Link key={cat.nombre} href={`/administracion/configuracion/aranceles/${encodeURIComponent(cat.nombre)}`}>
                <motion.div whileHover={{ y: -5 }} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><BookOpen size={24}/></div>
                    <h3 className="text-lg font-black text-slate-700 uppercase italic leading-tight">{cat.nombre}</h3>
                  </div>
                </motion.div>
              </Link>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative border border-white/20">
              <button onClick={() => setModalAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-8">Nueva Categoría</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Nombre de la Categoría</label>
                  <input autoFocus className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase" value={nombreNuevaCat} onChange={(e) => setNombreNuevaCat(e.target.value)} />
                </div>
                <p className="text-xs text-slate-400 p-2">Se creará una prestación de ejemplo dentro de esta categoría para que no quede vacía. Podrás editarla o borrarla después.</p>
                <button onClick={handleCrearCategoria} disabled={creando} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 mt-6">
                  {creando ? <Loader2 className="animate-spin" /> : <FolderPlus size={18} />} 
                  Crear Categoría
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}