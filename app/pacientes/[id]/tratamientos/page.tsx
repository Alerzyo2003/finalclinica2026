'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Plus, Loader2, Wallet, Stethoscope, ChevronRight, 
  FileText, Trash2, CheckCircle2, X, Calendar, Activity, AlertCircle, Tag
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ListaTratamientosPage() {
  const params = useParams()
  const paciente_id = params.id as string
  const router = useRouter()
  
  const [planes, setPlanes] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroActivo, setFiltroActivo] = useState<string>('TODOS')
  
  const [modalNuevoPlan, setModalNuevoPlan] = useState(false)
  const [creandoPlan, setCreandoPlan] = useState(false)
  const [nuevoPlan, setNuevoPlan] = useState({
    nombre: '',
    especialista_id: ''
  })

  useEffect(() => {
    if (paciente_id) {
      fetchInicial()
    }
  }, [paciente_id])

  async function fetchInicial() {
    setCargando(true)
    try {
      await Promise.all([fetchPlanes(), fetchProfesionales()])
    } catch (error) {
      console.error(error)
    } finally {
      setCargando(false)
    }
  }

  async function fetchProfesionales() {
    const { data } = await supabase.from('profesionales').select('user_id, nombre, apellido').eq('activo', true)
    setProfesionales(data || [])
  }

  async function fetchPlanes() {
    const { data, error } = await supabase
      .from('presupuestos')
      .select(`
        *,
        profesionales(nombre, apellido, especialidades(nombre)),
        presupuesto_items(id, estado),
        citas(inicio)
      `)
      .eq('paciente_id', paciente_id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error("Error al cargar planes:", error)
      return
    }

    if (data) {
      const planesProcesados = data.map((plan: any) => {
        // 1. Cálculo de Progreso Clínico
        const totalItems = plan.presupuesto_items?.length || 0
        const itemsRealizados = plan.presupuesto_items?.filter((i: any) => i.estado === 'realizado').length || 0
        const progresoClinico = totalItems > 0 ? Math.round((itemsRealizados / totalItems) * 100) : 0

        // 2. Cálculo Financiero
        const total = Number(plan.total || 0)
        const abonado = Number(plan.total_abonado || 0)
        const deuda = total - abonado
        let estadoFinanciero = 'SIN COSTO'
        if (total > 0) {
          estadoFinanciero = deuda <= 0 ? 'SALDADO' : 'CON DEUDA'
        }

        // 3. Última Cita
        const citasOrdenadas = plan.citas?.sort((a: any, b: any) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime()) || []
        const ultimaCita = citasOrdenadas.length > 0 ? citasOrdenadas[0].inicio : null

        // 4. Corrección de Doctor y Especialidad (Tolerante a nulos)
        const nombreDoctor = plan.profesionales 
          ? `Dr/a. ${plan.profesionales.nombre} ${plan.profesionales.apellido}` 
          : 'Doctor no asignado'
          
        const especialidad = plan.profesionales?.especialidades?.nombre || 'Odontología General'

        return {
          ...plan,
          progresoClinico,
          deuda,
          estadoFinanciero,
          ultimaCita,
          nombreDoctor,
          especialidad
        }
      })
      
      setPlanes(planesProcesados)
    }
  }

  const handleCrearPlan = async () => {
    if (!nuevoPlan.nombre || !nuevoPlan.especialista_id) {
      return toast.error("Completa el nombre y selecciona un doctor")
    }

    setCreandoPlan(true)
    try {
      const { data, error } = await supabase
        .from('presupuestos')
        .insert([{
          paciente_id: paciente_id,
          nombre_tratamiento: nuevoPlan.nombre.toUpperCase(),
          especialista_id: nuevoPlan.especialista_id,
          estado: 'borrador',
          aprobado: false,
          total: 0,
          total_abonado: 0
        }])
        .select()
        .single()

      if (error) throw error

      toast.success("Plan creado correctamente")
      setModalNuevoPlan(false)
      setNuevoPlan({ nombre: '', especialista_id: '' })
      fetchPlanes()
    } catch (error: any) {
      toast.error("Error al crear plan")
    } finally {
      setCreandoPlan(false)
    }
  }

  const planesFiltrados = planes.filter(plan => {
    if (filtroActivo === 'TODOS') return true
    if (filtroActivo === 'EN CURSO') return plan.progresoClinico > 0 && plan.progresoClinico < 100
    if (filtroActivo === 'FINALIZADOS') return plan.progresoClinico === 100
    if (filtroActivo === 'DEUDA') return plan.estadoFinanciero === 'CON DEUDA'
    return true
  })

  if (cargando) return (
    <div className="h-96 flex flex-col items-center justify-center bg-white/50 rounded-[3rem] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Planes...</p>
    </div>
  )

  return (
    <div className="space-y-8 text-left font-sans pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic flex items-center gap-3 leading-none">
            <Wallet className="text-blue-600" size={24} /> Tratamientos y Evoluciones
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Auditoría Clínica y Financiera</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/pacientes/${paciente_id}`} className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors">Volver</Link>
          <button 
            onClick={() => setModalNuevoPlan(true)}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg shadow-blue-200 hover:bg-slate-900 transition-all flex items-center gap-2"
          >
            <Plus size={18} /> Nuevo Tratamiento
          </button>
        </div>
      </div>

      {/* FILTROS RÁPIDOS */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {['TODOS', 'EN CURSO', 'FINALIZADOS', 'DEUDA'].map(filtro => (
          <button 
            key={filtro}
            onClick={() => setFiltroActivo(filtro)}
            className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border-2
              ${filtroActivo === filtro ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
          >
            {filtro}
          </button>
        ))}
      </div>

      {/* LISTADO DE PLANES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {planesFiltrados.length === 0 ? (
          <div className="lg:col-span-2 bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-100">
            <FileText size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">No hay planes en esta categoría</p>
          </div>
        ) : (
          planesFiltrados.map((plan) => (
            <motion.div 
              layout
              key={plan.id}
              onClick={() => router.push(`/pacientes/${paciente_id}/tratamientos/${plan.id}`)}
              className="group bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 hover:border-blue-500 transition-all cursor-pointer shadow-sm relative overflow-hidden text-left flex flex-col justify-between h-full"
            >
              {/* BADGE ESTADO FINANCIERO */}
              <div className="absolute top-6 right-6">
                 {plan.estadoFinanciero === 'SALDADO' && <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12}/> Saldado</span>}
                 {plan.estadoFinanciero === 'CON DEUDA' && <span className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><AlertCircle size={12}/> Con Deuda</span>}
                 {plan.estadoFinanciero === 'SIN COSTO' && <span className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Sin Costo</span>}
              </div>

              <div className="flex items-start gap-5 mb-8">
                <div className="bg-slate-50 w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-slate-400 shrink-0 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <span className="text-[8px] font-black uppercase opacity-50">Folio</span>
                  <span className="text-sm font-black italic">#{plan.id.substring(0,4)}</span>
                </div>
                <div className="text-left flex-1 pr-24">
                  <h3 className="text-xl font-black text-slate-800 uppercase leading-none mb-2">{plan.nombre_tratamiento || 'Diagnóstico Inicial'}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <Stethoscope size={12}/> {plan.nombreDoctor}
                  </p>
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1 ml-4 opacity-80">{plan.especialidad}</p>
                </div>
              </div>

              {/* BARRA DE PROGRESO */}
              <div className="mb-8">
                 <div className="flex justify-between items-end mb-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Activity size={12}/> Progreso Clínico</p>
                    <p className="text-xs font-black text-slate-800">{plan.progresoClinico}%</p>
                 </div>
                 <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${plan.progresoClinico}%` }} 
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full absolute left-0 top-0 rounded-full ${plan.progresoClinico === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                    />
                 </div>
              </div>

              {/* FOOTER: FECHAS Y FINANZAS */}
              <div className="flex justify-between items-end border-t border-slate-100 pt-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={12}/> Última Cita
                  </p>
                  <p className="text-[11px] font-bold text-slate-800 uppercase ml-4">
                    {plan.ultimaCita ? new Date(plan.ultimaCita).toLocaleDateString('es-CL') : 'Sin agendamientos'}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Pendiente</p>
                  <p className={`text-2xl font-black leading-none mt-1 ${plan.deuda > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                    ${plan.deuda.toLocaleString('es-CL')}
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* MODAL NUEVO PLAN */}
      <AnimatePresence>
        {modalNuevoPlan && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 text-left">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center text-left">
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Nuevo Tratamiento</h2>
                <button onClick={() => setModalNuevoPlan(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
              </div>

              <div className="p-8 space-y-6 text-left">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre del Plan / Diagnóstico</label>
                  <input 
                    autoFocus
                    placeholder="EJ: REHABILITACIÓN COMPLETA"
                    className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-black text-sm text-slate-800 shadow-inner"
                    value={nuevoPlan.nombre}
                    onChange={(e) => setNuevoPlan({...nuevoPlan, nombre: e.target.value})}
                  />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Especialista Responsable</label>
                  <select 
                    className="w-full p-5 bg-slate-50 rounded-2xl border-none outline-none font-black text-sm text-slate-800 shadow-inner appearance-none cursor-pointer"
                    value={nuevoPlan.especialista_id}
                    onChange={(e) => setNuevoPlan({...nuevoPlan, especialista_id: e.target.value})}
                  >
                    <option value="">SELECCIONAR DOCTOR...</option>
                    {profesionales.map(p => (
                      <option key={p.user_id} value={p.user_id}>DR/A. {p.nombre} {p.apellido}</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={handleCrearPlan}
                  disabled={creandoPlan}
                  className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300"
                >
                  {creandoPlan ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                  {creandoPlan ? 'Procesando...' : 'Crear Plan Clínico'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}