'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Stethoscope, Plus, Save, X, Loader2, 
  Clipboard, UserCheck, Trash2, Edit3, 
  Printer, EyeOff, User
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function EvolucionesPage() {
  const { id: paciente_id } = useParams()
  const [evoluciones, setEvoluciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [sessionUser, setSessionUser] = useState<any>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  
  const [verAnuladas, setVerAnuladas] = useState(false)
  const [soloMias, setSoloMisEvoluciones] = useState(false)

  const [nuevaEv, setNuevaEv] = useState({ 
    descripcion_procedimiento: '', 
    observaciones: '' 
  })

  useEffect(() => { 
    if (paciente_id) {
      obtenerUsuario()
      fetchEvoluciones()
    }
  }, [paciente_id])

  async function obtenerUsuario() {
    const { data: { user } } = await supabase.auth.getUser()
    setSessionUser(user)
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
        .eq('paciente_id', paciente_id)
        .order('fecha_registro', { ascending: false })
      
      if (!error) setEvoluciones(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const guardarEvolucion = async () => {
    if (!nuevaEv.descripcion_procedimiento.trim()) return toast.error("La descripción es obligatoria");
    
    try {
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
          paciente_id,
          descripcion_procedimiento: nuevaEv.descripcion_procedimiento,
          observaciones: nuevaEv.observaciones,
          especialista_id: sessionUser?.id,
          estado: 'activa'
        }])
        if (error) throw error
      }
      
      toast.success(editandoId ? "Registro actualizado" : "Atención registrada")
      cerrarModal()
      fetchEvoluciones()
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  }

  const anularEvolucion = async (evId: string, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'anulada' ? 'activa' : 'anulada';
    const confirmar = window.confirm(`¿Seguro que desea ${nuevoEstado === 'anulada' ? 'anular' : 'restaurar'} este registro?`);
    if (confirmar) {
      const { error } = await supabase.from('evoluciones').update({ estado: nuevoEstado }).eq('id', evId)
      if (error) toast.error("Error al cambiar estado")
      else { toast.success(`Registro ${nuevoEstado}`); fetchEvoluciones(); }
    }
  }

  const imprimirEvolucion = (ev: any) => {
    const prof = ev.profesionales;
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) return;
    const fecha = new Date(ev.fecha_registro).toLocaleString('es-CL');
    ventanaImpresion.document.write(`
      <html>
        <head><style>body { font-family: sans-serif; padding: 40px; } .header { border-bottom: 2px solid #000; }</style></head>
        <body><div class="header"><h2>EVOLUCIÓN CLÍNICA</h2></div><p><strong>Fecha:</strong> ${fecha}</p><p><strong>Dr/a:</strong> ${prof?.nombre} ${prof?.apellido}</p><hr/><p>${ev.descripcion_procedimiento}</p></body>
      </html>
    `);
    ventanaImpresion.document.close();
    ventanaImpresion.print();
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setEditandoId(null)
    setNuevaEv({ descripcion_procedimiento: '', observaciones: '' })
  }

  const evolucionesFiltradas = evoluciones.filter(ev => {
    const cumpleEstado = verAnuladas ? ev.estado === 'anulada' : ev.estado === 'activa';
    const cumpleAutor = soloMias ? ev.especialista_id === sessionUser?.id : true;
    return cumpleEstado && cumpleAutor;
  });

  return (
    <div className="space-y-6 max-w-full text-left">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="text-left">
          <h3 className="text-2xl font-black text-slate-800 uppercase italic leading-none">Ficha de Evoluciones</h3>
          <div className="flex gap-4 mt-3">
            <button onClick={() => setVerAnuladas(false)} className={`text-[10px] font-black uppercase tracking-widest transition-all ${!verAnuladas ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>
              Activas ({evoluciones.filter(e => e.estado === 'activa').length})
            </button>
            <button onClick={() => setVerAnuladas(true)} className={`text-[10px] font-black uppercase tracking-widest transition-all ${verAnuladas ? 'text-red-500 border-b-2 border-red-500' : 'text-slate-400'}`}>
              Anuladas ({evoluciones.filter(e => e.estado === 'anulada').length})
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSoloMisEvoluciones(!soloMias)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${soloMias ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            <User size={14}/> {soloMias ? "Mis Registros" : "Todos los Registros"}
          </button>
          <button onClick={() => setModalAbierto(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
            <Plus size={16}/> Registrar Atención
          </button>
        </div>
      </div>

      {/* LISTADO */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode='popLayout'>
          {evolucionesFiltradas.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No hay registros disponibles</p>
            </motion.div>
          ) : (
            evolucionesFiltradas.map(ev => {
              const prof = ev.profesionales as any;
              const esMio = ev.especialista_id === sessionUser?.id;
              return (
                <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={ev.id} className={`bg-white rounded-[2.5rem] shadow-sm border border-slate-100 group transition-all ${ev.estado === 'anulada' ? 'opacity-60 bg-slate-50' : 'hover:border-blue-300'}`}>
                  <div className="p-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${ev.estado === 'anulada' ? 'bg-slate-200' : 'bg-blue-50 text-blue-600'}`}><Stethoscope size={24}/></div>
                        <div className="text-left">
                          <p className="text-[11px] font-black text-slate-400 uppercase italic">
                            {new Date(ev.fecha_registro).toLocaleDateString('es-CL')} - {new Date(ev.fecha_registro).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs font-black text-blue-500 uppercase tracking-tighter">Dr/a. {prof?.nombre} {prof?.apellido}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => imprimirEvolucion(ev)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Printer size={18}/></button>
                        {esMio && ev.estado !== 'anulada' && (
                          <button onClick={() => { setEditandoId(ev.id); setNuevaEv({ descripcion_procedimiento: ev.descripcion_procedimiento, observaciones: ev.observaciones }); setModalAbierto(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"><Edit3 size={18}/></button>
                        )}
                        {esMio && (
                          <button onClick={() => anularEvolucion(ev.id, ev.estado)} className={`p-2 rounded-xl transition-all ${ev.estado === 'anulada' ? 'text-green-500' : 'text-slate-400 hover:text-red-600'}`}>
                            {ev.estado === 'anulada' ? <Plus size={18}/> : <EyeOff size={18}/>}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`p-6 rounded-[2rem] border ${ev.estado === 'anulada' ? 'bg-slate-100' : 'bg-slate-50/30 border-blue-50'}`}>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap italic">"{ev.descripcion_procedimiento}"</p>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* MODAL CON ARREGLO DE NIVEL SUPERIOR (Z-INDEX 9999) */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto bg-slate-900/80 backdrop-blur-md pt-10 md:pt-24">
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }} 
              animate={{ scale: 1, y: 0, opacity: 1 }} 
              exit={{ scale: 0.9, y: 50, opacity: 0 }} 
              className="bg-white w-full max-w-2xl rounded-[3rem] p-8 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.4)] relative mb-20"
            >
              <button onClick={cerrarModal} className="absolute top-8 right-8 p-3 bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={20}/></button>
              
              <div className="flex items-center gap-4 mb-10 text-left">
                <div className={`p-4 rounded-2xl ${editandoId ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  {editandoId ? <Edit3 size={32}/> : <Clipboard size={32}/>}
                </div>
                <div className="text-left">
                  <h2 className="text-3xl font-black uppercase italic text-slate-800 leading-none">
                    {editandoId ? "Editar Registro" : "Nueva Evolución"}
                  </h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase mt-2 tracking-[0.2em]">Ficha Clínica Digital</p>
                </div>
              </div>
              
              <div className="space-y-6 text-left">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-4">Detalle del Procedimiento</label>
                  <textarea 
                    rows={7} 
                    className="w-full p-8 bg-slate-50 rounded-[2.5rem] font-medium text-slate-700 outline-none focus:ring-4 ring-blue-500/10 shadow-inner transition-all border-none text-base" 
                    value={nuevaEv.descripcion_procedimiento} 
                    onChange={(e) => setNuevaEv({...nuevaEv, descripcion_procedimiento: e.target.value})} 
                    placeholder="Escriba aquí..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-4">Notas Internas</label>
                  <input 
                    type="text" 
                    className="w-full p-6 bg-slate-50 rounded-2xl font-medium text-slate-700 outline-none border-none focus:ring-4 ring-blue-500/10 shadow-inner" 
                    value={nuevaEv.observaciones} 
                    onChange={(e) => setNuevaEv({...nuevaEv, observaciones: e.target.value})} 
                    placeholder="Solo visibles para ti..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={cerrarModal} className="flex-1 bg-slate-100 text-slate-500 py-6 rounded-[2rem] font-black text-xs uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                  <button 
                    onClick={guardarEvolucion} 
                    className={`flex-[2.5] py-6 rounded-[2rem] font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 text-white ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    <Save size={24}/> {editandoId ? "Actualizar" : "Guardar Registro"}
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