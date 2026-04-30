'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  History, Calendar, Clock, Stethoscope, 
  Loader2, Image as ImageIcon, 
  DollarSign, User, CheckCircle2,
  CalendarDays, Wallet, FileSignature
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HistorialPage() {
  const { id: paciente_id } = useParams()
  const [bitacora, setBitacora] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todas' | 'mias'>('todas')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (paciente_id) {
      obtenerTodoElHistorial()
    }
  }, [paciente_id])

  async function obtenerTodoElHistorial() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      // CONSULTAS EN PARALELO
      const [
        { data: evoluciones },
        { data: presupuestos },
        { data: archivos },
        { data: documentos },
        { data: pagos },
        { data: citas },
        { data: profesionales }
      ] = await Promise.all([
        supabase.from('evoluciones').select('*').eq('paciente_id', paciente_id),
        supabase.from('presupuestos').select('*').eq('paciente_id', paciente_id),
        supabase.from('documentos_pacientes').select('*').eq('paciente_id', paciente_id),
        supabase.from('documentos_clinicos').select('*').eq('paciente_id', paciente_id),
        supabase.from('pagos').select('*').eq('paciente_id', paciente_id),
        supabase.from('citas').select('*').eq('paciente_id', paciente_id),
        supabase.from('profesionales').select('user_id, nombre, apellido')
      ])

      // 1. NORMALIZAR EVOLUCIONES
      const evs = (evoluciones || []).map(e => ({
        ...e,
        tipo: 'evolucion',
        fecha: e.fecha_registro,
        titulo: 'Evolución Clínica',
        descripcion: e.descripcion_procedimiento,
        icon: <Stethoscope size={16} />,
        color: 'blue'
      }))

      // 2. NORMALIZAR PRESUPUESTOS
      const pres = (presupuestos || []).map(p => ({
        ...p,
        tipo: 'presupuesto',
        fecha: p.created_at,
        titulo: `Plan de Tratamiento: ${p.nombre_tratamiento || 'Tratamiento'}`,
        descripcion: `Monto total: $${Number(p.total || 0).toLocaleString('es-CL')} | Estado: ${p.estado}`,
        icon: <DollarSign size={16} />,
        color: 'emerald'
      }))

      // 3. NORMALIZAR ARCHIVOS (RX)
      const arcs = (archivos || []).map(a => ({
        ...a,
        tipo: 'archivo',
        fecha: a.fecha_subida,
        titulo: `RX / Archivo: ${a.titulo || a.nombre_archivo}`,
        descripcion: a.descripcion || `Archivo cargado al expediente.`,
        url_archivo: a.url_archivo,
        icon: <ImageIcon size={16} />,
        color: 'purple'
      }))

      // 4. NORMALIZAR DOCUMENTOS CLÍNICOS
      const docs = (documentos || []).map(d => ({
        ...d,
        tipo: 'documento',
        fecha: d.fecha_creacion,
        titulo: d.titulo_documento || 'Documento Clínico',
        descripcion: `Documento generado y archivado.`,
        icon: <FileSignature size={16} />,
        color: 'orange'
      }))

      // 5. NORMALIZAR PAGOS
      const pgs = (pagos || []).map(pg => ({
        ...pg,
        tipo: 'pago',
        fecha: pg.fecha_pago,
        titulo: `Abono Recibido: $${Number(pg.monto || 0).toLocaleString('es-CL')}`,
        descripcion: `Método: ${pg.metodo_pago} ${pg.numero_boleta ? `- Boleta: ${pg.numero_boleta}` : ''}`,
        icon: <Wallet size={16} />,
        color: 'cyan'
      }))

      // 6. NORMALIZAR CITAS
      const cts = (citas || []).map(c => ({
        ...c,
        tipo: 'cita',
        fecha: c.inicio,
        titulo: `Cita Agendada: ${c.estado}`,
        descripcion: `Motivo: ${c.motivo || 'Consulta General'}`,
        icon: <CalendarDays size={16} />,
        color: 'slate'
      }))

      // UNIR TODO Y ORDENAR
      const total = [...evs, ...pres, ...arcs, ...docs, ...pgs, ...cts].sort((a, b) => 
        new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
      )

      // MAPEAR AUTORES CON CASTING
      const final = total.map(item => ({
        ...item,
        autor: profesionales?.find((p: any) => p.user_id === (item.profesional_id || item.especialista_id || item.creado_por || item.usuario_id))
      }))

      setBitacora(final)
    } catch (err) {
      console.error("Error en historial:", err)
    } finally {
      setLoading(false)
    }
  }

  const bitacoraFiltrada = bitacora.filter(item => {
    if (filtro === 'mias') return (item.profesional_id || item.especialista_id || item.creado_por) === currentUserId
    return true
  })

  if (!mounted || loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest animate-pulse text-center">Sincronizando Historial Maestro...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 text-left">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden text-left">
        <div className="flex items-center gap-4 relative z-10 text-left">
          <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
            <History size={24} />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none text-left">Línea de Tiempo</h2>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-1 text-left">Actividad completa del Paciente</p>
          </div>
        </div>

        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 relative z-10">
          <button onClick={() => setFiltro('todas')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${filtro === 'todas' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Toda la Clínica</button>
          <button onClick={() => setFiltro('mias')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${filtro === 'mias' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><User size={10} /> Mis Acciones</button>
        </div>
      </div>

      {/* TIMELINE */}
      <div className="relative ml-6 border-l-2 border-slate-100 pl-10 space-y-10 text-left">
        <AnimatePresence mode='popLayout'>
          {bitacoraFiltrada.map((item) => {
            const autor = item.autor as any;
            return (
              <motion.div 
                layout key={`${item.tipo}-${item.id}`} 
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                className="relative text-left"
              >
                {/* PUNTO */}
                <div className={`absolute -left-[51px] top-2 w-5 h-5 bg-white border-4 rounded-full shadow-sm z-10 ${
                  item.color === 'blue' ? 'border-blue-500' : 
                  item.color === 'emerald' ? 'border-emerald-500' :
                  item.color === 'purple' ? 'border-purple-500' :
                  item.color === 'orange' ? 'border-orange-500' :
                  item.color === 'cyan' ? 'border-cyan-500' : 'border-slate-400'
                }`}></div>
                
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden text-left">
                  <div className="flex justify-between items-start mb-5 relative z-10 text-left">
                    <div className="flex items-center gap-4 text-left">
                      <div className={`p-3 rounded-2xl shadow-sm ${
                        item.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
                        item.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                        item.color === 'purple' ? 'bg-purple-50 text-purple-600' :
                        item.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                        item.color === 'cyan' ? 'bg-cyan-50 text-cyan-600' : 'bg-slate-50 text-slate-500'
                      }`}>
                        {item.icon}
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight text-left">
                          {item.titulo}
                        </h4>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase mt-1 text-left">
                          <Calendar size={10} />
                          {item.fecha ? new Date(item.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : 'S/F'}
                          <span className="mx-1">•</span>
                          <Clock size={10} />
                          {item.fecha ? new Date(item.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'S/H'} hrs
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className="text-[7px] font-black text-slate-300 uppercase tracking-[0.2em] block mb-1">Responsable</span>
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                          <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[7px] text-white font-black uppercase">
                              {autor?.nombre?.[0] || 'S'}
                          </div>
                          <span className="text-[9px] font-black text-slate-600 uppercase italic">
                              {autor ? `Dr/a. ${autor.nombre} ${autor.apellido}` : 'Sistema'}
                          </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-50 relative z-10 text-left">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic text-left">
                      {item.descripcion}
                    </p>
                    
                    {item.tipo === 'archivo' && item.url_archivo && (
                      <div className="mt-4 flex gap-3 text-left">
                          <div className="relative overflow-hidden rounded-2xl border-2 border-white shadow-lg w-40 h-28 group/img shrink-0 text-left">
                              <img src={item.url_archivo} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Vista previa" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                  <ImageIcon className="text-white" size={20} />
                              </div>
                          </div>
                          <div className="flex flex-col justify-center text-left">
                              <a href={item.url_archivo} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-blue-600 uppercase hover:underline text-left">Ver pantalla completa</a>
                              <a href={item.url_archivo} download className="text-[9px] font-black text-slate-400 uppercase mt-2 hover:text-slate-600 text-left">Descargar original</a>
                          </div>
                      </div>
                    )}
                  </div>

                  <div className="absolute -bottom-6 -right-6 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none text-slate-900">
                      {item.icon}
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {bitacoraFiltrada.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center gap-4 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <History className="text-slate-200" size={48} />
                <p className="text-slate-400 font-black uppercase text-xs italic tracking-widest text-center">No hay registros de actividad todavía</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  )
}
