'use client'
import { useState, useEffect } from 'react'
import { useRole } from '@/app/hooks/useRole'
import { supabase } from '@/lib/supabase' // Asegúrate de que esta ruta sea correcta
import { 
  ShieldCheck, Loader2, Users, Wallet, 
  Stethoscope, BarChart3, Search, HeartPulse,
  ArrowUpRight, Clock, CalendarDays, LayoutGrid, 
  Sparkles, Activity, History, BellRing, Cake, Timer
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function WelcomeDashboard() {
  const { rol, isAdmin, isRecepcionista, isDentista, cargando } = useRole()
  const [mounted, setMounted] = useState(false)
  const [fechaHora, setFechaHora] = useState(new Date())

  // Estados para los widgets dinámicos
  const [pacienteReciente, setPacienteReciente] = useState<any>(null)
  const [alertas, setAlertas] = useState<{ count: number, mensajes: string[] }>({ count: 0, mensajes: [] })
  const [cumpleaneros, setCumpleaneros] = useState<any[]>([])
  const [resumenTurno, setResumenTurno] = useState({ total: 0, atendidos: 0, restantes: 0 })

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setFechaHora(new Date()), 60000)
    
    if (!cargando) {
      fetchWidgetData()
    }
    
    return () => clearInterval(timer)
  }, [cargando])

  async function fetchWidgetData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const hoy = new Date()
      const startOfDay = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0).toISOString()
      const endOfDay = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString()
      const mesActual = hoy.getMonth() + 1
      const diaActual = hoy.getDate()

      // 1. OBTENER PACIENTE RECIENTE (Última cita creada/gestionada por el usuario)
      const { data: citaReciente } = await supabase
        .from('citas')
        .select('paciente_id, pacientes(id, nombre, apellido, rut)')
        .eq('creado_por', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (citaReciente && citaReciente.pacientes) {
        setPacienteReciente(citaReciente.pacientes)
      }

      // 2. ALERTAS (Solo Admin/Recepción)
      if (isAdmin || isRecepcionista) {
        const msjs = []
        // Cajas abiertas
        const { count: cajasAbiertas } = await supabase.from('sesiones_caja').select('*', { count: 'exact', head: true }).eq('estado', 'abierta')
        if (cajasAbiertas && cajasAbiertas > 0) msjs.push(`${cajasAbiertas} caja(s) aún abierta(s)`)
        
        // Laboratorios pendientes (Items con costo laboratorio y en estado pendiente)
        const { count: labsPendientes } = await supabase.from('presupuesto_items').select('*', { count: 'exact', head: true }).gt('costo_laboratorio', 0).eq('estado', 'pendiente')
        if (labsPendientes && labsPendientes > 0) msjs.push(`${labsPendientes} lab(s) por gestionar`)

        setAlertas({ count: msjs.length, mensajes: msjs })
      }

      // 3. CUMPLEAÑOS DE HOY (Pacientes agendados hoy que están de cumpleaños)
      if (isAdmin || isRecepcionista) {
        const { data: citasHoy } = await supabase
          .from('citas')
          .select('inicio, pacientes(id, nombre, apellido, fecha_nacimiento)')
          .gte('inicio', startOfDay)
          .lte('inicio', endOfDay)
          .neq('estado', 'cancelada')

        if (citasHoy) {
          const bdays = citasHoy.filter((c: any) => {
            // TypeScript a veces devuelve las relaciones como array, así que lo normalizamos
            const paciente = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes
            
            if (!paciente?.fecha_nacimiento) return false
            const [y, m, d] = paciente.fecha_nacimiento.split('-')
            return parseInt(m) === mesActual && parseInt(d) === diaActual
          }).map((c: any) => {
            const paciente = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes
            return {
              id: paciente.id,
              nombre: `${paciente.nombre.split(' ')[0]} ${paciente.apellido.split(' ')[0]}`,
              hora: new Date(c.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
            }
          })
          
          // Eliminar duplicados por si un paciente tiene 2 citas hoy
          const uniqueBdays = Array.from(new Map(bdays.map(item => [item.id, item])).values())
          setCumpleaneros(uniqueBdays)
        }
      }

      // 4. RESUMEN DE TURNO (Solo Dentistas)
      if (isDentista) {
        const { data: misCitas } = await supabase
          .from('citas')
          .select('estado')
          .eq('profesional_id', user.id)
          .gte('inicio', startOfDay)
          .lte('inicio', endOfDay)
          .neq('estado', 'cancelada')

        if (misCitas) {
          const total = misCitas.length
          const atendidos = misCitas.filter(c => c.estado === 'atendido').length
          setResumenTurno({ total, atendidos, restantes: total - atendidos })
        }
      }

    } catch (error) {
      console.error("Error cargando widgets:", error)
    }
  }

  const getSaludo = () => {
    const hora = fechaHora.getHours()
    if (hora < 12) return 'Buenos días'
    if (hora < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const getRolTitle = () => {
    if (isAdmin) return 'Administrador'
    if (isDentista) return 'Especialista'
    if (isRecepcionista) return 'Recepción'
    return rol || 'Usuario'
  }

  const getAccesosRapidos = () => {
    const accesos = []

    if (isAdmin || isRecepcionista) {
      accesos.push({
        titulo: 'Diario Global',
        desc: 'Disponibilidad de doctores',
        icono: <LayoutGrid size={24} />,
        href: '/semana',
        color: 'bg-blue-50 text-blue-600 border-blue-100',
        hover: 'group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'
      })
      accesos.push({
        titulo: 'Nuevo Paciente',
        desc: 'Registrar ficha clínica',
        icono: <Users size={24} />,
        href: '/pacientes/nuevo',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        hover: 'group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500'
      })
      accesos.push({
        titulo: 'Caja y Pagos',
        desc: 'Gestión de ingresos diarios',
        icono: <Wallet size={24} />,
        href: '/caja',
        color: 'bg-amber-50 text-amber-600 border-amber-100',
        hover: 'group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500'
      })
    }

    if (isDentista) {
      accesos.push({
        titulo: 'Mi Agenda',
        desc: 'Citas y pacientes del día',
        icono: <CalendarDays size={24} />,
        href: '/agenda',
        color: 'bg-blue-50 text-blue-600 border-blue-100',
        hover: 'group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'
      })
      accesos.push({
        titulo: 'Buscar Ficha',
        desc: 'Historial y evolución',
        icono: <Search size={24} />,
        href: '/pacientes',
        color: 'bg-purple-50 text-purple-600 border-purple-100',
        hover: 'group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600'
      })
    }

    if (isAdmin) {
      accesos.push({
        titulo: 'Métricas',
        desc: 'Reportes de desempeño',
        icono: <BarChart3 size={24} />,
        href: '/reportes/desempeno',
        color: 'bg-slate-900 text-white border-slate-800',
        hover: 'group-hover:bg-black group-hover:text-white group-hover:border-black'
      })
    }

    return accesos
  }

  if (!mounted || cargando) return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="font-black text-xs uppercase tracking-widest text-slate-400">Preparando Entorno...</p>
    </div>
  )

  const accesos = getAccesosRapidos()

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans pb-24 text-left overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOP BAR: RELOJ Y ROL */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 shadow-sm border border-blue-200/50">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none">Sesión Activa</p>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight mt-1">{getRolTitle()}</h2>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="bg-white px-6 py-4 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
              <Clock size={18} className="text-slate-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-600">
                {fechaHora.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600">
                {fechaHora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </motion.div>
        </header>

        {/* HERO BANNER PRINCIPAL */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-blue-600 rounded-[3rem] p-8 md:p-14 shadow-2xl shadow-blue-600/20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
            <HeartPulse size={300} />
          </div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

          <div className="relative z-10 text-white text-center md:text-left w-full">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-4 uppercase italic">
              {getSaludo()},
            </h1>
            <h2 className="text-3xl md:text-4xl font-black text-blue-200 tracking-tighter uppercase mb-6">
              ¿Qué gestionaremos hoy?
            </h2>
            <p className="text-blue-100 font-bold max-w-xl text-xs md:text-sm tracking-widest uppercase opacity-90 leading-relaxed">
              Tu entorno de trabajo está listo. Selecciona una acción rápida o navega utilizando el menú lateral para acceder a las opciones detalladas.
            </p>
          </div>

          <div className="relative z-10 shrink-0 hidden lg:block">
            <div className="w-48 h-48 bg-white/10 rounded-[3rem] border border-white/20 backdrop-blur-md flex items-center justify-center shadow-inner transform rotate-6 hover:rotate-0 transition-transform duration-500">
              <Activity size={100} className="text-white opacity-80" strokeWidth={1} />
            </div>
          </div>
        </motion.div>

        {/* ETIQUETA DE SECCIÓN - ATAJOS */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="pt-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
            <Sparkles size={16} /> Atajos Principales
          </h3>
        </motion.div>

        {/* ACCESOS RÁPIDOS GRID */}
        <motion.div 
          variants={containerVariants} initial="hidden" animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {accesos.map((item, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Link href={item.href} className="block group h-full">
                <div className={`p-8 rounded-[3rem] border border-slate-100 transition-all duration-300 flex flex-col h-full bg-white shadow-sm hover:shadow-xl ${item.hover}`}>
                  <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center mb-8 transition-colors duration-300 border ${item.color}`}>
                    {item.icono}
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-xl font-black tracking-tighter uppercase text-slate-800 group-hover:text-white transition-colors">
                      {item.titulo}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white/80 transition-colors">
                        {item.desc}
                      </p>
                      <ArrowUpRight size={20} className="text-slate-300 group-hover:text-white transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* ETIQUETA DE SECCIÓN - WIDGETS */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pt-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
            <Activity size={16} /> Resumen en Tiempo Real
          </h3>
        </motion.div>

        {/* WIDGETS DINÁMICOS */}
        <motion.div 
          variants={containerVariants} initial="hidden" animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* OPCIÓN 1: ÚLTIMA FICHA VISITADA (Visible para todos) */}
          {pacienteReciente ? (
            <motion.div variants={itemVariants}>
              <Link href={`/pacientes/${pacienteReciente.id}`} className="block h-full">
                <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-6 group cursor-pointer hover:border-purple-200 transition-all h-full">
                  <div className="bg-purple-50 text-purple-600 p-6 rounded-[2rem] shrink-0 border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                    <History size={32} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acceso Reciente</p>
                    <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{pacienteReciente.nombre} {pacienteReciente.apellido}</h4>
                    <p className="text-xs font-bold text-slate-500 tracking-widest mt-1">RUT: {pacienteReciente.rut}</p>
                  </div>
                  <ArrowUpRight size={24} className="text-slate-300 group-hover:text-purple-600 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>
              </Link>
            </motion.div>
          ) : (
             <motion.div variants={itemVariants} className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-6 opacity-60">
              <div className="bg-slate-50 text-slate-400 p-6 rounded-[2rem] shrink-0 border border-slate-100">
                <History size={32} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acceso Reciente</p>
                <h4 className="text-xl font-black text-slate-500 uppercase tracking-tighter">Sin historial reciente</h4>
              </div>
            </motion.div>
          )}

          {/* OPCIÓN 4: RESUMEN DE TURNO (Solo para Dentistas) */}
          {isDentista && (
            <motion.div variants={itemVariants} className="bg-slate-900 p-8 md:p-10 rounded-[3rem] shadow-xl flex items-center gap-6 relative overflow-hidden h-full">
              <div className="absolute right-0 top-0 opacity-10 p-4 pointer-events-none">
                <Timer size={150} />
              </div>
              <div className="bg-white/10 text-emerald-400 p-6 rounded-[2rem] shrink-0 border border-white/5 relative z-10">
                <Stethoscope size={32} />
              </div>
              <div className="relative z-10 flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tu jornada de hoy</p>
                <h4 className="text-2xl font-black text-white uppercase tracking-tighter">{resumenTurno.total} Pacientes en total</h4>
                <div className="flex gap-4 mt-3">
                  <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase bg-emerald-400/10 px-3 py-1.5 rounded-xl border border-emerald-400/20">{resumenTurno.atendidos} Atendidos</span>
                  <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">{resumenTurno.restantes} Restantes</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* OPCIÓN 2: ALERTAS (Para Admin y Recepción) */}
          {(isAdmin || isRecepcionista) && (
            <motion.div variants={itemVariants} className={`p-8 md:p-10 rounded-[3rem] border shadow-sm flex items-center gap-6 h-full ${alertas.count > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
              <div className={`p-6 rounded-[2rem] shrink-0 shadow-lg ${alertas.count > 0 ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-slate-100 text-slate-400 shadow-none'}`}>
                <BellRing size={32} />
              </div>
              <div className="flex-1">
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${alertas.count > 0 ? 'text-amber-600/70' : 'text-slate-400'}`}>Avisos del Sistema</p>
                <h4 className={`text-2xl font-black uppercase tracking-tighter ${alertas.count > 0 ? 'text-amber-900' : 'text-slate-800'}`}>
                  {alertas.count > 0 ? `${alertas.count} Tareas Pendientes` : 'Todo al día'}
                </h4>
                {alertas.count > 0 ? (
                  <div className="mt-2 space-y-1">
                    {alertas.mensajes.map((msj, i) => (
                      <p key={i} className="text-[10px] font-bold text-amber-700 tracking-widest uppercase flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> {msj}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-2 uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sin alertas
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* OPCIÓN 3: CUMPLEAÑOS (Para Admin y Recepción) */}
          {(isAdmin || isRecepcionista) && (
            <motion.div variants={itemVariants} className={`p-8 md:p-10 rounded-[3rem] border shadow-sm flex items-center gap-6 h-full ${cumpleaneros.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
              <div className={`p-6 rounded-[2rem] shrink-0 shadow-lg ${cumpleaneros.length > 0 ? 'bg-rose-400 text-white shadow-rose-400/30' : 'bg-slate-100 text-slate-400 shadow-none'}`}>
                <Cake size={32} />
              </div>
              <div className="flex-1">
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${cumpleaneros.length > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Fidelización</p>
                <h4 className={`text-2xl font-black uppercase tracking-tighter ${cumpleaneros.length > 0 ? 'text-rose-900' : 'text-slate-800'}`}>
                  {cumpleaneros.length > 0 ? `${cumpleaneros.length} Cumpleaños Hoy` : 'Sin Cumpleaños Hoy'}
                </h4>
                {cumpleaneros.length > 0 ? (
                  <div className="mt-2 space-y-1 max-h-[60px] overflow-y-auto custom-scrollbar">
                    {cumpleaneros.map((paciente, idx) => (
                      <p key={idx} className="text-xs font-bold text-rose-600 tracking-widest uppercase">
                        {paciente.nombre} ({paciente.hora} hrs)
                      </p>
                    ))}
                  </div>
                ) : (
                   <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-2 uppercase">
                     Ningún paciente agendado celebra hoy.
                   </p>
                )}
              </div>
            </motion.div>
          )}

        </motion.div>

      </div>
    </main>
  )
}
