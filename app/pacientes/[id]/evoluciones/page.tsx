'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Stethoscope, Plus, Save, X, Loader2, 
  Clipboard, UserCheck, Trash2, Edit3, AlertTriangle 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function EvolucionesPage() {
  const { id } = useParams()
  const [evoluciones, setEvoluciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [usuarioEsProfesional, setUsuarioEsProfesional] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  
  const [nuevaEv, setNuevaEv] = useState({ 
    descripcion_procedimiento: '', 
    observaciones: '' 
  })

  useEffect(() => { 
    if (id) {
      fetchEvoluciones()
      verificarPerfilProfesional()
    }
  }, [id])

  async function verificarPerfilProfesional() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profesionales')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()
        setUsuarioEsProfesional(!!data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchEvoluciones() {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('evoluciones')
        .select(`
          *,
          profesionales:especialista_id ( nombre, apellido )
        `)
        .eq('paciente_id', id)
        .order('fecha_registro', { ascending: false })
      
      if (!error) setEvoluciones(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const prepararEdicion = (ev: any) => {
    setEditandoId(ev.id)
    setNuevaEv({
      descripcion_procedimiento: ev.descripcion_procedimiento || '',
      observaciones: ev.observaciones || ''
    })
    setModalAbierto(true)
  }

  const guardarEvolucion = async () => {
    if (!nuevaEv.descripcion_procedimiento.trim()) {
        return alert("Debe ingresar la descripción clínica.");
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Sesión no válida");

      if (editandoId) {
        const { error } = await supabase
          .from('evoluciones')
          .update({
            descripcion_procedimiento: nuevaEv.descripcion_procedimiento,
            observaciones: nuevaEv.observaciones,
          })
          .eq('id', editandoId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('evoluciones').insert([{ 
          paciente_id: id,
          descripcion_procedimiento: nuevaEv.descripcion_procedimiento,
          observaciones: nuevaEv.observaciones,
          especialista_id: usuarioEsProfesional ? user.id : null, 
          profesional_id: user.id 
        }])
        if (error) throw error
      }
      
      cerrarModal()
      fetchEvoluciones()
      alert(editandoId ? "Registro actualizado" : "Atención registrada");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  }

  const eliminarEvolucion = async (evId: string) => {
    if (typeof window !== 'undefined' && window.confirm("¿Estás seguro de eliminar este registro clínico? Esta acción no se puede deshacer.")) {
        const { error } = await supabase
          .from('evoluciones')
          .delete()
          .eq('id', evId)

        if (error) alert("Error al eliminar")
        else fetchEvoluciones()
    }
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setEditandoId(null)
    setNuevaEv({ descripcion_procedimiento: '', observaciones: '' })
  }

  if (cargando && evoluciones.length === 0) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando Evoluciones...</p>
    </div>
  )

  return (
    <div className="space-y-6 text-left">
      {/* HEADER */}
      <div className="flex justify-between items-center px-2 text-left">
        <div className="text-left">
          <h3 className="text-xl font-black text-slate-800 uppercase italic text-left">Evoluciones Clínicas</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 text-left">Historial técnico</p>
        </div>
        <button 
          onClick={() => setModalAbierto(true)} 
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          <Plus size={16}/> Registrar Atención
        </button>
      </div>

      {/* LISTADO */}
      <div className="space-y-6 text-left">
        {evoluciones.map(ev => {
          const prof = ev.profesionales as any;
          return (
            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={ev.id} className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 group hover:border-blue-200 transition-all text-left">
              <div className="p-7">
                <div className="flex justify-between items-start mb-6 text-left">
                  <div className="flex items-center gap-4 text-left">
                    <div className="bg-slate-50 p-3 rounded-2xl text-blue-600 border border-slate-100">
                      <Stethoscope size={20}/>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase text-left">
                        {ev.fecha_registro ? new Date(ev.fecha_registro).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'S/F'}
                      </p>
                      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest text-left">
                        {prof ? `Dr/a. ${prof.nombre} ${prof.apellido}` : "Registro Administrativo"}
                      </p>
                    </div>
                  </div>
                  
                  {/* ACCIONES */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => prepararEdicion(ev)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Editar registro"
                    >
                      <Edit3 size={16}/>
                    </button>
                    <button 
                      onClick={() => eliminarEvolucion(ev.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Eliminar registro"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 text-left">
                  <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-dashed border-slate-200 text-left">
                    <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap italic text-left">"{ev.descripcion_procedimiento}"</p>
                  </div>
                  {ev.observaciones && (
                    <div className="px-6 border-l-2 border-slate-100 text-left">
                      <p className="text-xs text-slate-500 italic leading-relaxed text-left">{ev.observaciones}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* MODAL (NUEVO / EDITAR) */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex items-start justify-center p-4 pt-32">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[3.5rem] p-10 shadow-2xl relative text-left">
              <button onClick={cerrarModal} className="absolute top-8 right-8 text-slate-300 hover:text-red-500 transition-colors"><X/></button>
              
              <div className="flex items-center gap-3 mb-8 text-left">
                <div className={`p-3 rounded-2xl ${editandoId ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  {editandoId ? <Edit3 size={24}/> : <Clipboard size={24}/>}
                </div>
                <div className="text-left">
                  <h2 className="text-3xl font-black tracking-tighter uppercase italic text-slate-800 leading-none text-left">
                    {editandoId ? "Editar Registro" : "Nueva Evolución"}
                  </h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase mt-1 tracking-widest text-left">
                    {editandoId ? "Modificando entrada existente" : "Ingreso de atención clínica"}
                  </p>
                </div>
              </div>
              
              <div className="space-y-6 text-left">
                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-2 text-left">Descripción de la atención *</label>
                  <textarea 
                    rows={8} 
                    className="w-full p-6 bg-slate-50 rounded-[2rem] font-medium text-slate-700 outline-none focus:ring-2 ring-blue-500/20 shadow-inner transition-all leading-relaxed border-none" 
                    value={nuevaEv.descripcion_procedimiento || ''} 
                    onChange={(e) => setNuevaEv({...nuevaEv, descripcion_procedimiento: e.target.value})} 
                    placeholder="Detalle el procedimiento..."
                  />
                </div>

                <div className="text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-2 text-left">Notas Internas</label>
                  <input 
                    type="text" 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-medium text-slate-700 outline-none border-none focus:ring-2 ring-blue-500/20 shadow-inner" 
                    value={nuevaEv.observaciones || ''} 
                    onChange={(e) => setNuevaEv({...nuevaEv, observaciones: e.target.value})} 
                    placeholder="Escriba notas privadas..."
                  />
                </div>

                <div className="flex gap-4 pt-4 text-left">
                  <button onClick={cerrarModal} className="flex-1 bg-slate-100 text-slate-400 py-6 rounded-[2rem] font-black text-sm uppercase">Cancelar</button>
                  <button 
                    onClick={guardarEvolucion} 
                    className={`flex-[2] py-6 rounded-[2rem] font-black text-xl shadow-xl transition-all flex items-center justify-center gap-3 text-white ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    <Save size={24}/> {editandoId ? "Actualizar Ficha" : "Guardar en Ficha"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
