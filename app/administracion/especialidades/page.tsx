'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Stethoscope, Plus, Search, Trash2, 
  Edit3, X, Save, Loader2, Tag, ChevronRight 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function EspecialidadesPage() {
  const [especialidades, setEspecialidades] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    fetchEspecialidades()
  }, [])

  async function fetchEspecialidades() {
    setCargando(true)
    // Traemos las especialidades y contamos cuántos profesionales tienen asociada cada una
    const { data } = await supabase
      .from('especialidades')
      .select(`
        *,
        profesionales:profesionales(count)
      `)
      .order('nombre')
    
    if (data) setEspecialidades(data)
    setCargando(false)
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) return alert("El nombre es obligatorio")
    setGuardando(true)

    try {
      if (editandoId) {
        const { error } = await supabase
          .from('especialidades')
          .update({ nombre: nombre.trim() })
          .eq('id', editandoId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('especialidades')
          .insert([{ nombre: nombre.trim() }])
        if (error) throw error
      }

      setModalAbierto(false)
      setNombre('')
      setEditandoId(null)
      fetchEspecialidades()
    } catch (error: any) {
      alert("Error: " + (error.message.includes('unique') ? 'Esa especialidad ya existe' : error.message))
    } finally {
      setGuardando(false)
    }
  }

  const eliminarEspecialidad = async (id: string, count: number) => {
    if (count > 0) return alert("No puedes eliminar una especialidad que tiene profesionales asignados.")
    if (!confirm("¿Seguro que deseas eliminar esta especialidad?")) return

    await supabase.from('especialidades').delete().eq('id', id)
    fetchEspecialidades()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-blue-600 p-5 rounded-[2rem] text-white shadow-xl shadow-blue-100">
              <Tag size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none">Especialidades</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3">Categorización del staff clínico</p>
            </div>
          </div>
          <button 
            onClick={() => { setEditandoId(null); setNombre(''); setModalAbierto(true); }}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus size={18}/> Nueva Especialidad
          </button>
        </div>

        {/* LISTADO TIPO TABLA LIMPIA */}
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Especialidad</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Profesionales</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cargando ? (
                  <tr>
                    <td colSpan={3} className="py-20 text-center">
                      <Loader2 className="animate-spin mx-auto text-blue-600" size={30} />
                    </td>
                  </tr>
                ) : especialidades.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">
                      No hay especialidades creadas
                    </td>
                  </tr>
                ) : especialidades.map((esp) => (
                  <tr key={esp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-10 py-6">
                      <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{esp.nombre}</p>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className="bg-blue-50 text-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase">
                        {esp.profesionales[0]?.count || 0} asignados
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditandoId(esp.id); setNombre(esp.nombre); setModalAbierto(true); }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => eliminarEspecialidad(esp.id, esp.profesionales[0]?.count)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL PEQUEÑO DE CREACIÓN */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 flex justify-between items-center border-b border-slate-50">
                <h3 className="text-xl font-black text-slate-800 uppercase italic">
                  {editandoId ? 'Editar Especialidad' : 'Nueva Especialidad'}
                </h3>
                <button onClick={() => setModalAbierto(false)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 italic">Nombre de la Especialidad</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Ortodoncia, Endodoncia..."
                    className="w-full bg-slate-50 p-5 rounded-2xl text-sm font-bold border-none outline-none focus:ring-2 ring-blue-500/20 transition-all"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoFocus
                  />
                </div>

                <button 
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:bg-slate-300"
                >
                  {guardando ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  {editandoId ? 'Actualizar Especialidad' : 'Guardar Especialidad'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}