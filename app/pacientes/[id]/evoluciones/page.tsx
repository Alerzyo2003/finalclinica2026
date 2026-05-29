'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Stethoscope, Plus, Save, X, Loader2, 
  Clipboard, Trash2, Edit3, 
  Printer, EyeOff, User, Calendar, Clock
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
        <body><div class="header"><h2>EVOLUCIÓN CLÍNICA</h2></div><p><strong>Fecha:</strong> ${fecha}</p><p><strong>Dr/a:</strong> ${prof?.nombre} ${prof?.apellido}</p><hr/><p>${ev.descripcion_procedimiento.replace(/\n/g, '<br/>')}</p></body>
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
    <div className="max-w-4xl mx-auto space-y-8 p-4 text-left">
      
      {/* HEADER AL ESTILO HISTORIAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden text-left">
        <div className="flex items-center gap-4 relative z-10 text-left">
          <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
            <Clipboard size={24} />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none text-left">Ficha de Evoluciones</h2>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-1 text-left">Historial y Procedimientos</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200">
            <button onClick={() => setVerAnuladas(false)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${!verAnuladas ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              Activas ({evoluciones.filter(e => e.estado === 'activa').length})
            </button>
            <button onClick={() => setVerAnuladas(true)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${verAnuladas ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              Anuladas ({evoluciones.filter(e => e.estado === 'anulada').length})
            </button>
          </div>

          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200">
            <button onClick={() => setSoloMisEvoluciones(!soloMias)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${soloMias ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <User size={10}/> Mis Registros
            </button>
          </div>

          <button onClick={() => setModalAbierto(true)} className="bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
            <Plus size={16}/> Registrar
          </button>
        </div>
      </div>

      {/* LISTADO DE EVOLUCIONES */}
      <div className="space-y-6 text-left">
        <AnimatePresence mode='popLayout'>
          {cargando ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="animate-spin text-blue-600" size={40} />
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest animate-pulse text-center">Cargando Evoluciones...</p>
            </div>
          ) : evolucionesFiltradas.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center flex flex-col items-center gap-4 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
              <Clipboard className="text-slate-200" size={48} />
              <p className="text-slate-400 font-black uppercase text-xs italic tracking-widest text-center">No hay registros de actividad todavía</p>
            </motion.div>
          ) : (
            evolucionesFiltradas.map((ev) => {
              const prof = ev.profesionales as any;
              const esMio = ev.especialista_id === sessionUser?.id;
              
              return (
                <motion.div 
                  layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={ev.id} 
                  className={`bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden text-left ${ev.estado === 'anulada' ? 'opacity-60 bg-slate-50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-5 relative z-10 text-left">
                    <div className="flex items-center gap-4 text-left">
                      <div className={`p-3 rounded-2xl shadow-sm ${ev.estado === 'anulada' ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                        <Stethoscope size={24}/>
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight text-left">
                          Atención Clínica {ev.estado === 'anulada' && '- ANULADA'}
                        </h4>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase mt-1 text-left">
                          <Calendar size={10}/> {new Date(ev.fecha_registro).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                          <span className="mx-1">•</span>
                          <Clock size={10}/> {new Date(ev.fecha_registro).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs
                        </div>
                      </div>
                    </div>
                    
                    {/* BOTONES DE ACCIÓN */}
                    <div className="flex gap-2 relative z-20 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => imprimirEvolucion(ev)} className="p-2.5 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Printer size={16}/></button>
                      {esMio && ev.estado !== 'anulada' && (
                        <button onClick={() => { setEditandoId(ev.id); setNuevaEv({ descripcion_procedimiento: ev.descripcion_procedimiento, observaciones: ev.observaciones }); setModalAbierto(true); }} className="p-2.5 bg-slate-100 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"><Edit3 size={16}/></button>
                      )}
                      {esMio && (
                        <button onClick={() => anularEvolucion(ev.id, ev.estado)} className={`p-2.5 bg-slate-100 rounded-xl transition-all ${ev.estado === 'anulada' ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}>
                          {ev.estado === 'anulada' ? <Plus size={16}/> : <EyeOff size={16}/>}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`bg-slate-50/50 p-6 rounded-3xl border ${ev.estado === 'anulada' ? 'border-slate-200' : 'border-blue-50/50'} relative z-10 text-left`}>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic text-left whitespace-pre-wrap">
                      {ev.descripcion_procedimiento}
                    </p>
                    {ev.observaciones && esMio && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">Notas Internas:</span>
                        <p className="text-xs text-slate-500 italic">{ev.observaciones}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right flex flex-col items-end shrink-0 mt-5 relative z-10">
                    <span className="text-[7px] font-black text-slate-300 uppercase tracking-[0.2em] block mb-1">Responsable Clínico</span>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[8px] text-white font-black uppercase">
                          {prof?.nombre?.[0] || 'D'}
                        </div>
                        <span className="text-[9px] font-black text-slate-600 uppercase italic">
                          Dr/a. {prof?.nombre} {prof?.apellido}
                        </span>
                    </div>
                  </div>

                  {/* ICONO DE FONDO FLOTANTE */}
                  <div className="absolute -bottom-6 -right-6 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none text-slate-900">
                      <Stethoscope size={150} />
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* MODAL CON ESTILO REDONDEADO EXTREMO */}
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-4">Detalle del Procedimiento *</label>
                  <textarea 
                    rows={7} 
                    className="w-full p-8 bg-slate-50 rounded-[2.5rem] font-medium text-slate-700 outline-none focus:ring-4 ring-blue-500/10 shadow-inner transition-all border-none text-sm" 
                    value={nuevaEv.descripcion_procedimiento} 
                    onChange={(e) => setNuevaEv({...nuevaEv, descripcion_procedimiento: e.target.value})} 
                    placeholder="Escriba aquí los detalles del procedimiento..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-4">Notas Internas (Opcional)</label>
                  <input 
                    type="text" 
                    className="w-full p-6 bg-slate-50 rounded-3xl font-medium text-slate-700 outline-none border-none focus:ring-4 ring-blue-500/10 shadow-inner text-sm" 
                    value={nuevaEv.observaciones} 
                    onChange={(e) => setNuevaEv({...nuevaEv, observaciones: e.target.value})} 
                    placeholder="Solo visibles para ti..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={cerrarModal} className="flex-1 bg-slate-100 text-slate-500 py-6 rounded-[2.5rem] font-black text-xs uppercase hover:bg-slate-200 transition-all">Cancelar</button>
                  <button 
                    onClick={guardarEvolucion} 
                    className={`flex-[2.5] py-6 rounded-[2.5rem] font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 text-white ${editandoId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
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