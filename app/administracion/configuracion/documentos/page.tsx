'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  FileText, Plus, Search, Trash2, Loader2, X, Save, 
  CheckCircle2, XCircle, Edit2, ChevronRight, AlertCircle 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function DocumentosConfigPage() {
  const [categorias, setCategorias] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  
  // Estados Modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombreCat, setNombreCat] = useState('')

  useEffect(() => {
    fetchCategorias()
  }, [])

  async function fetchCategorias() {
    setCargando(true)
    const { data } = await supabase
      .from('documentos_categorias')
      .select('*')
      .order('nombre', { ascending: true })
    if (data) setCategorias(data)
    setCargando(false)
  }

  const handleGuardar = async () => {
    if (!nombreCat.trim()) return
    setGuardando(true)
    try {
      if (editandoId) {
        await supabase.from('documentos_categorias').update({ nombre: nombreCat.toUpperCase() }).eq('id', editandoId)
      } else {
        await supabase.from('documentos_categorias').insert([{ nombre: nombreCat.toUpperCase(), estado: 'Habilitado' }])
      }
      setModalAbierto(false)
      setNombreCat('')
      setEditandoId(null)
      fetchCategorias()
    } catch (err) { alert("Error") } finally { setGuardando(false) }
  }

  const toggleEstado = async (id: string, estadoActual: string) => {
    const nuevo = estadoActual === 'Habilitado' ? 'Deshabilitado' : 'Habilitado'
    await supabase.from('documentos_categorias').update({ estado: nuevo }).eq('id', id)
    setCategorias(categorias.map(c => c.id === id ? { ...c, estado: nuevo } : c))
  }

  const eliminarCat = async (id: string) => {
    if (!confirm("¿Eliminar esta sección?")) return
    await supabase.from('documentos_categorias').delete().eq('id', id)
    setCategorias(categorias.filter(c => c.id !== id))
  }

  if (cargando) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl">
              <FileText size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none">Documentos Clínicos</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3">Configuración de formatos y plantillas</p>
            </div>
          </div>
          <button 
            onClick={() => { setEditandoId(null); setNombreCat(''); setModalAbierto(true); }}
            className="bg-blue-600 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center gap-2"
          >
            <Plus size={18} /> Nuevo documento clínico
          </button>
        </header>

        {/* TABLA DE CATEGORÍAS */}
        <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="p-10">Nombre de la Sección</th>
                <th className="p-10 text-center">Estado</th>
                <th className="p-10 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {categorias.map((cat) => (
                <tr key={cat.id} className="group hover:bg-slate-50/30 transition-all">
                  <td className="p-10">
                    <Link href={`/administracion/configuracion/documentos/${cat.id}`} className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <FileText size={20} />
                      </div>
                      <span className="text-sm font-black text-slate-700 uppercase italic group-hover:text-blue-600 transition-colors">
                        {cat.nombre}
                      </span>
                    </Link>
                  </td>
                  <td className="p-10 text-center">
                    <button 
                      onClick={() => toggleEstado(cat.id, cat.estado)}
                      className={`px-6 py-2.5 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border
                        ${cat.estado === 'Habilitado' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white' 
                          : 'bg-red-50 text-red-500 border-red-100 hover:bg-red-500 hover:text-white'}`}
                    >
                      {cat.estado}
                    </button>
                  </td>
                  <td className="p-10 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setEditandoId(cat.id); setNombreCat(cat.nombre); setModalAbierto(true); }}
                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => eliminarCat(cat.id)}
                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                      <Link 
                        href={`/administracion/configuracion/documentos/${cat.id}`}
                        className="p-3 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-md"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR/EDITAR */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative border border-white/20">
              <button onClick={() => setModalAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              <h2 className="text-2xl font-black text-slate-900 uppercase italic leading-none mb-6">
                {editandoId ? 'Editar Nombre' : 'Nueva Sección'}
              </h2>
              <div className="space-y-6">
                <input 
                  autoFocus
                  className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase"
                  placeholder="Ej: CONSENTIMIENTOS"
                  value={nombreCat}
                  onChange={(e) => setNombreCat(e.target.value)}
                />
                <button 
                  onClick={handleGuardar}
                  disabled={guardando || !nombreCat}
                  className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3"
                >
                  {guardando ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}