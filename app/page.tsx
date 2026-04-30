'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/app/hooks/useRole'
import { toast } from 'sonner'
import { 
  DollarSign, Users, Calendar, ArrowUpRight, UserPlus, 
  Activity, Clock, User, LogOut, MessageCircle, 
  CheckCircle2, BarChart3, Wallet, TrendingUp, TrendingDown,
  LayoutGrid, Stethoscope, Edit3, X, Loader2, HeartPulse, 
  CalendarCheck, ShieldCheck
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import CierreCaja from './dashboard/cierrecaja' 

export default function Dashboard() {
  const router = useRouter()
  const { rol, isAdmin, isRecepcionista, isDentista, cargando } = useRole()
  const [stats, setStats] = useState({ citas: 0, pacientesNuevos: 0, ingresos: 0 })
  const [proximasCitas, setProximasCitas] = useState<any[]>([])
  const [balance, setBalance] = useState({ ingresos: 0, gastos: 0, utilidad: 0 })
  const [mounted, setMounted] = useState(false)

  // ESTADOS PARA REPROGRAMAR
  const [citaAEditar, setCitaAEditar] = useState<any>(null)
  const [nuevaHora, setNuevaHora] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')

  const horasDisponibles = ['09:00', '10:00', '11:00', '12:00', '13:00', '15:00', '16:00', '17:00', '18:00']

  useEffect(() => {
    setMounted(true)
    if (!cargando) {
        fetchRealStats()
        fetchProximasCitas()
        if (isAdmin) fetchBalanceMensual()
    }
  }, [cargando, isAdmin])

  // --- LÓGICA REALTIME ---
  useEffect(() => {
    if (!mounted || cargando) return;
    const canalCitas = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => {
        fetchProximasCitas()
        fetchRealStats()
      })
      .subscribe()
    return () => { supabase.removeChannel(canalCitas) }
  }, [cargando, mounted])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function fetchBalanceMensual() {
    const mes = new Date().getMonth() + 1
    const anio = new Date().getFullYear()
    const { data } = await supabase.rpc('obtener_balance_mensual', { mes, anio })
    if (data && data[0]) {
      setBalance({
        ingresos: Number(data[0].total_ingresos || 0),
        gastos: Number(data[0].total_egresos || 0),
        utilidad: Number(data[0].utilidad_neta || 0)
      })
    }
  }

  const reprogramarCita = async () => {
    if (!nuevaHora || !nuevaFecha) return toast.error("Selecciona fecha y hora");
    const inicio = `${nuevaFecha}T${nuevaHora}:00`;
    const horaFin = (parseInt(nuevaHora.split(':')[0]) + 1).toString().padStart(2, '0') + ':00';
    const fin = `${nuevaFecha}T${horaFin}:00`;

    const { error } = await supabase.from('citas').update({ inicio, fin }).eq('id', citaAEditar.id);
    if (error) toast.error("Horario no disponible");
    else {
      toast.success("Cita reprogramada");
      setCitaAEditar(null);
      fetchProximasCitas();
    }
  }

  const gestionarConfirmacionWsp = async (cita: any) => {
    const mensaje = `Hola ${cita.paciente_nombre}, confirmamos tu cita hoy a las ${cita.hora.substring(0, 5)} en Clínica Dignidad. ¿Asistirás?`;
    const tel = cita.paciente_telefono?.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=56${tel}&text=${encodeURIComponent(mensaje)}`, '_blank');
    await supabase.from('citas').update({ estado_confirmacion: 'enviado' }).eq('id', cita.id);
    fetchProximasCitas();
  }

  const marcarLlegada = async (id: string) => {
    const { error } = await supabase
      .from('citas')
      .update({ 
        llegada_confirmada: true, 
        hora_llegada: new Date().toISOString(),
        hora_inicio_atencion: new Date().toISOString()
      })
      .eq('id', id);

    if (error) toast.error("Error al registrar llegada");
    else {
      toast.success("Paciente en sillón / Box");
      fetchProximasCitas();
    }
  }

  const finalizarAtencion = async (id: string) => {
    if (typeof window !== 'undefined' && window.confirm("¿Deseas finalizar la atención de este paciente?")) {
        const { error } = await supabase
          .from('citas')
          .update({ 
            estado: 'finalizada',
            llegada_confirmada: false,
            hora_fin_atencion: new Date().toISOString()
          })
          .eq('id', id);

        if (error) toast.error("Error al finalizar la atención");
        else {
          toast.success("Atención finalizada");
          fetchProximasCitas();
          fetchRealStats();
        }
    }
  }

  async function fetchRealStats() {
    const hoy = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD local
    const { count: cCitas } = await supabase.from('citas').select('*', { count: 'exact', head: true }).gte('inicio', `${hoy}T00:00:00`).lte('inicio', `${hoy}T23:59:59`)
    const { count: cPac } = await supabase.from('pacientes').select('*', { count: 'exact', head: true }).gte('created_at', hoy)
    
    let totalIngresos = 0
    if (isAdmin) {
        const { data: pagos } = await supabase.from('pagos').select('monto').gte('fecha_pago', `${hoy}T00:00:00`)
        totalIngresos = pagos?.reduce((acc: number, curr: any) => acc + Number(curr.monto || 0), 0) || 0
    }
    setStats({ citas: cCitas || 0, pacientesNuevos: cPac || 0, ingresos: totalIngresos })
  }

  async function fetchProximasCitas() {
    const hoy = new Date().toLocaleDateString('sv-SE')
    let query = supabase.from('citas_detalladas').select('*').eq('fecha', hoy).eq('estado', 'programada').order('hora', { ascending: true })
    
    if (isDentista) {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) query = query.eq('profesional_id', u.id);
    }

    const { data } = await query
    setProximasCitas(data || [])
  }

  if (!mounted || cargando) return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="font-black text-xs uppercase tracking-widest text-slate-400">Sincronizando Sistema...</p>
    </div>
  )

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50 text-slate-900 text-left">
      
      {/* PACIENTE EN SILLÓN */}
      {isDentista && proximasCitas.filter(c => c.llegada_confirmada).map(cita => (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} key={cita.id} className="mb-8 bg-blue-600 text-white p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border-4 border-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><HeartPulse size={120}/></div>
          <div className="flex items-center gap-6 relative z-10 text-left">
            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md shrink-0"><User size={40} /></div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase opacity-70 tracking-widest mb-1 text-left">Paciente en Box {cita.box_id}</p>
              <h4 className="text-3xl font-black tracking-tight text-left">{cita.paciente_nombre} {cita.paciente_apellido}</h4>
            </div>
          </div>
          <div className="flex gap-3 relative z-10">
            <Link href={`/pacientes/${cita.paciente_id}`} className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-black text-xs uppercase hover:bg-blue-50 transition-all shadow-lg">Ficha Clínica</Link>
            <button onClick={() => finalizarAtencion(cita.id)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase hover:bg-black transition-all">Finalizar Atención</button>
          </div>
        </motion.div>
      ))}

      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 text-left">
        <div className="text-left w-full md:w-auto">
          <div className="flex items-center gap-2 justify-start mb-2 text-left">
            <ShieldCheck size={16} className="text-blue-500" />
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-left">Sistema de Gestión Clínica</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none text-left">
            {isAdmin ? 'Dashboard Admin' : isDentista ? 'Mi Agenda Médica' : 'Panel de Recepción'}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {(isAdmin || isRecepcionista) && (
            <Link href="/pacientes/nuevo" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-blue-700 shadow-xl transition-all uppercase text-[10px]">
              <UserPlus size={18} /> Registrar Paciente
            </Link>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left">
        <CardMetrica label="Citas para hoy" valor={stats.citas.toString()} sub="Total programado" icon={<CalendarCheck className="text-blue-600" />} color="bg-blue-50" />
        
        {isAdmin ? (
          <CardMetrica label="Ingresos del día" valor={`$${stats.ingresos.toLocaleString('es-CL')}`} sub="Recaudación caja" icon={<DollarSign className="text-emerald-600" />} color="bg-emerald-50" destacado />
        ) : (
          <CardMetrica label="Pacientes nuevos" valor={stats.pacientesNuevos.toString()} sub="Registros hoy" icon={<UserPlus className="text-purple-600" />} color="bg-purple-50" />
        )}
        
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center gap-4 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Atajos rápidos</p>
          <div className="grid grid-cols-2 gap-2 text-left">
            <Link href={isAdmin ? "/reportes/desempeno" : "/datos"} className="p-3 bg-slate-50 rounded-xl flex flex-col gap-2 hover:bg-blue-50 transition-all text-left">
                {isAdmin ? <BarChart3 size={16} className="text-blue-600"/> : <User size={16} className="text-blue-600"/>}
                <span className="text-[9px] font-black uppercase text-left">{isAdmin ? 'Desempeño' : 'Mi Perfil'}</span>
            </Link>
            <button onClick={handleSignOut} className="p-3 bg-red-50 rounded-xl flex flex-col gap-2 hover:bg-red-100 transition-all text-left">
                <LogOut size={16} className="text-red-600"/>
                <span className="text-[9px] font-black uppercase text-red-600 text-left">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {isAdmin && (
        <section className="mb-10 text-left">
          <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden text-left">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 items-center text-left">
              <div className="text-left">
                <p className="text-blue-400 font-black text-[10px] uppercase tracking-widest mb-4 text-left">Estado Mensual</p>
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0"><TrendingUp size={16} className="text-emerald-400"/></div>
                    <div className="text-left"><p className="text-[9px] text-slate-400 uppercase font-bold text-left">Ingresos</p><p className="text-2xl font-black text-left">${balance.ingresos.toLocaleString('es-CL')}</p></div>
                  </div>
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2 bg-red-500/20 rounded-lg shrink-0"><TrendingDown size={16} className="text-red-400"/></div>
                    <div className="text-left"><p className="text-[9px] text-slate-400 uppercase font-bold text-left">Gastos</p><p className="text-2xl font-black text-left">-${balance.gastos.toLocaleString('es-CL')}</p></div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-8 text-left">
                <div className="text-left">
                  <p className="text-blue-400 font-black text-xs uppercase tracking-widest mb-2 text-left">Utilidad Estimada</p>
                  <p className={`text-6xl font-black tracking-tighter text-left ${balance.utilidad >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                    ${balance.utilidad.toLocaleString('es-CL')}
                  </p>
                </div>
                <Link href="/pagos" className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-[10px] uppercase hover:scale-105 transition-all shadow-lg">Gestión Financiera</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        <div className="lg:col-span-2 text-left">
          <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-slate-100 text-left">
            <div className="flex justify-between items-center mb-8 text-left">
                <h3 className="text-2xl font-black flex items-center gap-3 text-left text-slate-800"><Clock className="text-blue-500" /> Agenda Próxima</h3>
                <Link href="/agenda" className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-full uppercase">Agenda Completa</Link>
            </div>
            
            <div className="space-y-3 text-left">
                {proximasCitas.length > 0 ? proximasCitas.map((cita) => (
                    <div key={cita.id} className={`flex flex-col md:flex-row items-center justify-between p-5 rounded-[2rem] border-2 transition-all gap-4 text-left ${
                      cita.llegada_confirmada ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-transparent'
                    }`}>
                        <div className="flex items-center gap-5 w-full text-left">
                            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 ${cita.llegada_confirmada ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-900 shadow-sm'}`}>
                              <span className="text-xs">{cita.hora?.substring(0, 5) || 'S/H'}</span>
                              <span className="text-[8px] uppercase opacity-60">Box {cita.box_id}</span>
                            </div>
                            <div className="text-left">
                                <h4 className="font-black text-slate-800 uppercase text-sm mb-1 text-left">{cita.paciente_nombre} {cita.paciente_apellido}</h4>
                                <div className="flex items-center gap-3 text-left">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1 text-left"><Stethoscope size={10}/> Dr/a. {cita.nombre_dentista}</span>
                                  {cita.llegada_confirmada && <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-[5px] text-[7px] font-black animate-pulse uppercase">En Box</span>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 w-full md:w-auto justify-end text-left">
                            {(isRecepcionista || isAdmin) && !cita.llegada_confirmada && (
                              <>
                                <button onClick={() => gestionarConfirmacionWsp(cita)} className="p-3 bg-white text-amber-500 rounded-xl border border-slate-100 hover:bg-amber-500 hover:text-white transition-all shadow-sm"><MessageCircle size={16}/></button>
                                <button onClick={() => { setCitaAEditar(cita); setNuevaFecha(cita.fecha); setNuevaHora(cita.hora.substring(0, 5)); }} className="p-3 bg-white text-blue-500 rounded-xl border border-slate-100 hover:bg-blue-500 hover:text-white transition-all shadow-sm"><Edit3 size={16}/></button>
                                <button onClick={() => marcarLlegada(cita.id)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase shadow-lg hover:bg-blue-600">Ingresar</button>
                              </>
                            )}
                            <Link href={`/pacientes/${cita.paciente_id}`} className="p-3 bg-white rounded-xl text-slate-300 hover:text-blue-600 border border-slate-100 shadow-sm"><ArrowUpRight size={16} /></Link>
                        </div>
                    </div>
                )) : <p className="text-center text-slate-300 py-16 italic text-sm font-bold uppercase tracking-widest">No hay citas para hoy</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6 text-left">
           {isAdmin && <CierreCaja />}
           
           <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-left">
             <div className="flex items-center gap-3 mb-6 text-left">
               <div className="bg-blue-100 p-2 rounded-lg text-blue-600 shrink-0"><LayoutGrid size={18}/></div>
               <h4 className="font-black text-sm uppercase tracking-widest text-slate-800 text-left">Estado de Boxes</h4>
             </div>
             <div className="space-y-4 text-left">
                {[1, 2, 3].map(box => {
                    const ocupado = proximasCitas.find(c => c.box_id === box && c.llegada_confirmada);
                    return (
                        <div key={box} className={`p-4 rounded-2xl border-2 transition-all text-left ${ocupado ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="flex items-center justify-between mb-1 text-left">
                              <span className="text-[10px] font-black uppercase text-slate-500 text-left">Box {box}</span>
                              <span className={`h-2 w-2 rounded-full ${ocupado ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                            </div>
                            <p className="text-xs font-black uppercase text-slate-800 text-left">{ocupado ? ocupado.paciente_nombre : 'Disponible'}</p>
                            {ocupado && <p className="text-[8px] font-bold text-red-400 uppercase mt-1 text-left">Atendiendo: Dr. {ocupado.nombre_dentista}</p>}
                        </div>
                    )
                })}
             </div>
           </div>
        </div>
      </div>

      {/* MODAL REPROGRAMAR */}
      <AnimatePresence>
        {citaAEditar && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-6 text-left">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative text-left"
            >
              <button onClick={() => setCitaAEditar(null)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500"><X size={24}/></button>
              <h3 className="text-2xl font-black text-slate-900 mb-6 tracking-tighter text-left">Reprogramar Cita</h3>
              
              <div className="space-y-6 text-left">
                <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-900 shadow-inner" />
                
                <div className="grid grid-cols-3 gap-2 text-left">
                    {horasDisponibles.map(h => (
                      <button key={h} onClick={() => setNuevaHora(h)}
                        className={`py-3 rounded-xl font-black text-[10px] transition-all ${nuevaHora === h ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        {h}
                      </button>
                    ))}
                </div>
                <button onClick={reprogramarCita} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-blue-600 transition-all">Confirmar Cambio</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}

function CardMetrica({ label, valor, sub, icon, color, destacado = false }: any) {
  return (
    <div className={`p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-6 transition-all bg-white text-left ${destacado ? 'border-b-[12px] border-b-emerald-500 shadow-xl' : ''}`}>
      <div className={`${color} p-5 rounded-[1.8rem] shadow-sm shrink-0`}>{icon}</div>
      <div className="text-left">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">{label}</p>
        <p className="text-3xl font-black text-slate-900 tracking-tighter text-left">{valor}</p>
        <p className="text-[9px] font-bold text-slate-300 uppercase mt-1 text-left">{sub}</p>
      </div>
    </div>
  )
}
