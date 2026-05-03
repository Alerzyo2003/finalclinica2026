'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Settings, User, Lock, ShieldCheck, 
  Save, Loader2, CheckCircle2, AlertCircle,
  CalendarCheck2, Users2, TrendingUp, BarChart3
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ConfiguracionPage() {
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [notificacion, setNotificacion] = useState<{tipo: 'exito' | 'error', msg: string} | null>(null)
  
  // Estados de Estadísticas
  const [stats, setStats] = useState({ total: 0, realizadas: 0, efectividad: 0 })

  // Estados del formulario
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetchPerfil()
  }, [])

  const fetchPerfil = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data } = await supabase
          .from('profesionales')
          .select('*, especialidades(nombre)')
          .eq('user_id', session.user.id)
          .maybeSingle() // Más seguro que .single() para el build
        
        if (data) {
          setPerfil(data)
          setNombre(data.nombre || '')
          setApellido(data.apellido || '')
          fetchEstadisticas(data.user_id)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEstadisticas = async (userId: string) => {
    const ahora = new Date()
    const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    
    // 1. Citas Totales del mes
    const { count: total } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('profesional_id', userId)
      .gte('inicio', primerDia)

    // 2. Citas Realizadas
    const { count: realizadas } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('profesional_id', userId)
      .eq('estado', 'realizada')
      .gte('inicio', primerDia)

    const efectividad = total && total > 0 ? Math.round((realizadas! / total) * 100) : 0
    setStats({ total: total || 0, realizadas: realizadas || 0, efectividad })
  }

  const mostrarAviso = (tipo: 'exito' | 'error', msg: string) => {
    setNotificacion({ tipo, msg })
    setTimeout(() => setNotificacion(null), 3000)
  }

  const handleActualizarPerfil = async () => {
    setGuardando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Sesión no encontrada")

      await supabase.from('profesionales').update({ nombre, apellido }).eq('user_id', session.user.id)
      await supabase.from('perfiles').update({ nombre_completo: `${nombre} ${apellido}` }).eq('id', session.user.id)
      
      mostrarAviso('exito', 'Perfil actualizado correctamente')
      fetchPerfil()
    } catch (error: any) {
      mostrarAviso('error', error.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleCambiarPassword = async () => {
    if (newPassword.length < 6) return mostrarAviso('error', 'Mínimo 6 caracteres')
    if (newPassword !== confirmPassword) return mostrarAviso('error', 'Las contraseñas no coinciden')
    
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) mostrarAviso('error', error.message)
    else {
      mostrarAviso('exito', 'Contraseña actualizada')
      setNewPassword(''); setConfirmPassword('')
    }
    setGuardando(false)
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans text-left">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex items-center justify-between text-left">
          <div className="flex items-center gap-6 text-left">
            <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl">
              <Settings size={32} />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none text-left">Configuración</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3 text-left">Panel Personal de Trabajo</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100">
             <BarChart3 size={16} className="text-blue-600" />
             <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Resumen Mensual Activo</span>
          </div>
        </header>

        {/* MINI DASHBOARD ESTADÍSTICO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            label="Pacientes este mes" 
            value={stats.total} 
            icon={<Users2 size={24}/>} 
            color="text-blue-600" 
            bg="bg-blue-50"
          />
          <StatCard 
            label="Citas Finalizadas" 
            value={stats.realizadas} 
            icon={<CalendarCheck2 size={24}/>} 
            color="text-emerald-600" 
            bg="bg-emerald-50"
          />
          <StatCard 
            label="Tasa de Asistencia" 
            value={`${stats.efectividad}%`} 
            icon={<TrendingUp size={24}/>} 
            color="text-orange-600" 
            bg="bg-orange-50"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {/* COLUMNA IZQUIERDA: PERFIL */}
          <div className="md:col-span-1 space-y-6 text-center">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-4 shadow-inner">
                <User size={48} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase leading-tight">{perfil?.nombre} {perfil?.apellido}</h3>
              <span className="inline-block bg-blue-50 text-blue-600 text-[9px] font-black uppercase px-3 py-1 rounded-full mt-2">
                {(perfil?.especialidades as any)?.nombre || 'General'}
              </span>
              <div className="mt-8 pt-6 border-t border-slate-50">
                 <p className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">ID Profesional</p>
                 <p className="text-xs font-bold text-slate-600 mt-1">{perfil?.user_id?.substring(0,13)}...</p>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: FORMULARIOS */}
          <div className="md:col-span-2 space-y-8 text-left">
            <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8 text-left">
              <h2 className="text-lg font-black text-slate-800 uppercase italic flex items-center gap-3 text-left">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full" /> Datos Personales
              </h2>
              <div className="grid grid-cols-2 gap-6 text-left">
                <Input label="Nombre" value={nombre} onChange={setNombre} />
                <Input label="Apellido" value={apellido} onChange={setApellido} />
              </div>
              <button onClick={handleActualizarPerfil} disabled={guardando} className="bg-slate-900 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 hover:bg-blue-600 transition-all active:scale-95 disabled:bg-slate-200">
                {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Actualizar Perfil
              </button>
            </section>

            <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8 text-left">
              <h2 className="text-lg font-black text-slate-800 uppercase italic flex items-center gap-3 text-left">
                <div className="w-1.5 h-6 bg-red-500 rounded-full" /> Seguridad de Acceso
              </h2>
              <div className="grid grid-cols-2 gap-6 text-left">
                <Input label="Nueva Contraseña" type="password" value={newPassword} onChange={setNewPassword} />
                <Input label="Confirmar Contraseña" type="password" value={confirmPassword} onChange={setConfirmPassword} />
              </div>
              <button onClick={handleCambiarPassword} disabled={guardando || !newPassword || newPassword !== confirmPassword} className="bg-blue-600 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 hover:bg-slate-900 transition-all active:scale-95 disabled:bg-slate-200">
                {guardando ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Cambiar Contraseña
              </button>
            </section>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {notificacion && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-10 right-10 z-[1000] px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 border text-white ${notificacion.tipo === 'exito' ? 'bg-slate-900 border-slate-700' : 'bg-red-600 border-red-400'}`}>
            {notificacion.tipo === 'exito' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} />}
            <span className="text-xs font-black uppercase tracking-widest">{notificacion.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, icon, color, bg }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6 text-left"
    >
      <div className={`${bg} ${color} p-4 rounded-[1.5rem] shadow-inner`}>
        {icon}
      </div>
      <div className="text-left">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">{label}</p>
        <p className={`text-2xl font-black ${color} leading-none text-left`}>{value}</p>
      </div>
    </motion.div>
  )
}

function Input({ label, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-2 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest italic text-left">{label}</label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-blue-500/20 focus:bg-white transition-all shadow-inner border-none text-slate-900" 
      />
    </div>
  )
}
