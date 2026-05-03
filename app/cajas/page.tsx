'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Wallet, Plus, Lock, Unlock, Users, Info, 
  Calendar, ArrowRight, Loader2, CheckCircle2, History,
  Banknote, X, ReceiptText, ChevronRight, AlertCircle, TrendingUp, Clock4
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function GestionCajasPage() {
  const router = useRouter()
  const [cajasAbiertas, setCajasAbiertas] = useState<any[]>([])
  const [cajasCerradas, setCajasCerradas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalApertura, setModalApertura] = useState(false)
  const [abriendoCaja, setAbriendoCaja] = useState(false)
  
  const [responsable, setResponsable] = useState('Cargando...')
  const [montoInicial, setMontoInicial] = useState('0')

  useEffect(() => {
    fetchCajas()
    obtenerNombreUsuario()
  }, [])

  async function obtenerNombreUsuario() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('nombre_completo')
          .eq('id', user.id)
          .maybeSingle() // Cambiado de single a maybeSingle para evitar errores si no hay perfil

        setResponsable(perfil?.nombre_completo || user.user_metadata?.nombre_completo || user.email || 'Recepcionista')
      }
    } catch (err) {
      setResponsable('Error al cargar nombre')
    }
  }

  async function fetchCajas() {
    setCargando(true)
    try {
      const { data: abiertas, error: errAb } = await supabase
        .from('sesiones_caja')
        .select(`*, pagos(monto)`)
        .eq('estado', 'abierta')
        .order('fecha_apertura', { ascending: false })

      if (errAb) throw errAb

      const { data: cerradas, error: errCe } = await supabase
        .from('sesiones_caja')
        .select('*')
        .eq('estado', 'cerrada')
        .limit(15)
        .order('fecha_cierre', { ascending: false })
      
      if (errCe) throw errCe
      
      // CORRECCIÓN: Casting a any para evitar error de propiedad pagos
      const abiertasProcesadas = abiertas?.map((caja: any) => {
        const sumaPagos = (caja.pagos as any[])?.reduce((acc: number, p: any) => acc + Number(p.monto), 0) || 0
        return { ...caja, acumulado: Number(caja.monto_apertura) + sumaPagos }
      }) || []

      setCajasAbiertas(abiertasProcesadas)
      setCajasCerradas(cerradas || [])
    } catch (error) {
      toast.error("Error al sincronizar datos de caja")
    } finally {
      setCargando(false)
    }
  }

  const handleAbrirCaja = async () => {
    if (cajasAbiertas.length > 0) {
      toast.error("Ya existe una caja abierta.")
      return
    }
    if (abriendoCaja) return
    setAbriendoCaja(true)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error("No autenticado")

      const nuevaCaja = {
        usuario_id: user.id,
        nombre_responsable: responsable,
        monto_apertura: Number(montoInicial) || 0,
        estado: 'abierta',
        fecha_apertura: new Date().toISOString()
      }

      const { error } = await supabase.from('sesiones_caja').insert([nuevaCaja])
      if (error) throw error

      toast.success("Caja abierta correctamente")
      setModalApertura(false)
      setMontoInicial('0')
      fetchCajas()
    } catch (error: any) {
      toast.error(`Error: ${error.message}`)
    } finally {
      setAbriendoCaja(false)
    }
  }

  const handleCerrarCaja = async (caja: any) => {
    // CORRECCIÓN: Uso seguro de confirm para SSR
    if (typeof window !== 'undefined') {
        if (!window.confirm(`¿Confirmas el cierre del turno de ${caja.nombre_responsable}?`)) return
    }

    try {
      const { error } = await supabase.from('sesiones_caja')
        .update({ 
          estado: 'cerrada', 
          fecha_cierre: new Date().toISOString(),
          monto_cierre: caja.acumulado 
        })
        .eq('id', caja.id)

      if (error) throw error
      toast.success("Caja liquidada con éxito")
      fetchCajas()
    } catch (error: any) {
      toast.error("Error al cerrar caja")
    }
  }

  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#FDFDFD]">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400">Verificando Finanzas...</p>
    </div>
  )

  const hayCajaAbierta = cajasAbiertas.length > 0

  return (
    <main className="min-h-screen bg-[#FDFDFD] p-8 md:p-12 font-sans text-slate-900 text-left">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1 text-left">
            <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none italic text-left">Control <br/> <span className="text-blue-600">de Caja</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] ml-1 text-left">Terminal de Arqueo y Recaudación</p>
          </div>
          
          <button 
            disabled={hayCajaAbierta}
            onClick={() => setModalApertura(true)}
            className={`px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 ${
              hayCajaAbierta 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' 
              : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200 active:scale-95'
            }`}
          >
            {hayCajaAbierta ? <Lock size={18} /> : <Plus size={18} />}
            {hayCajaAbierta ? 'Caja bloqueada' : 'Nuevo Turno'}
          </button>
        </header>

        {/* ALERTA */}
        <div className={`p-6 rounded-3xl flex items-center gap-5 border shadow-sm ${hayCajaAbierta ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
          <div className="bg-white p-3 rounded-2xl shadow-sm shrink-0">
            {hayCajaAbierta ? <TrendingUp size={24} className="text-blue-500" /> : <Info size={24} className="text-amber-500" />}
          </div>
          <p className="text-[11px] font-bold uppercase leading-relaxed tracking-wide text-left">
            {hayCajaAbierta 
              ? `Sesión activa iniciada por ${cajasAbiertas[0].nombre_responsable}. Solo se permite una caja abierta a la vez.`
              : `Aviso: Los totales mostrados corresponden únicamente a ingresos directos registrados en sistema.`
            }
          </p>
        </div>

        {/* SESIÓN ACTIVA */}
        <section className="space-y-6 text-left">
          <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] ml-6 text-left">Operación en Curso</h2>
          {cajasAbiertas.length === 0 ? (
            <div className="bg-white p-12 rounded-[3rem] border-2 border-dashed border-slate-100 text-center">
              <p className="text-slate-300 font-black uppercase text-xs italic tracking-widest">No hay turnos abiertos actualmente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {cajasAbiertas.map((caja) => (
                <div key={caja.id} className="bg-slate-900 rounded-[3.5rem] p-4 shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Banknote size={150} className="text-white"/></div>
                  
                  <div className="bg-white/5 backdrop-blur-md rounded-[3rem] p-10 flex flex-col md:flex-row justify-between items-center gap-8 relative z-10 border border-white/10">
                    <div className="space-y-4 text-left w-full md:w-auto">
                      <div className="flex items-center gap-3 bg-blue-600/20 w-fit px-4 py-1.5 rounded-full border border-blue-500/20">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                         <span className="text-[9px] font-black uppercase text-blue-200 tracking-widest">Turno Activo</span>
                      </div>
                      <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter text-left">{caja.nombre_responsable}</h3>
                      <div className="flex items-center gap-4 text-slate-400 text-xs font-bold uppercase text-left">
                        <span className="flex items-center gap-1 text-left"><Calendar size={14}/> {new Date(caja.fecha_apertura).toLocaleDateString('es-CL')}</span>
                        <span className="flex items-center gap-1 text-left"><Clock4 size={14}/> {new Date(caja.fecha_apertura).toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'})} hrs</span>
                      </div>
                    </div>

                    <div className="flex gap-4 md:gap-8">
                      <div className="text-center md:text-right">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Base Inicial</p>
                        <p className="text-xl font-bold text-white">${Number(caja.monto_apertura).toLocaleString('es-CL')}</p>
                      </div>
                      <div className="w-px h-12 bg-white/10 hidden md:block" />
                      <div className="text-center md:text-right">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 italic">Total Acumulado</p>
                        <p className="text-4xl font-black text-blue-400 tracking-tighter">${Number(caja.acumulado || 0).toLocaleString('es-CL')}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleCerrarCaja(caja)}
                      className="bg-white text-slate-900 px-8 py-5 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
                    >
                      Cerrar Turno
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* HISTORIAL */}
        <section className="space-y-6 pt-6 text-left">
          <div className="flex items-center justify-between px-6">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center gap-2 text-left"><History size={16} /> Registro Histórico</h2>
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Mostrando últimos cierres</span>
          </div>
          
          <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden text-left">
            <div className="grid grid-cols-1 divide-y divide-slate-50">
              {cajasCerradas.map((caja) => (
                <div 
                  key={caja.id} 
                  onClick={() => router.push(`/cajas/${caja.id}`)}
                  className="p-8 flex flex-col md:flex-row items-center justify-between hover:bg-slate-50/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="bg-slate-100 p-5 rounded-2xl text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                      <ReceiptText size={24} />
                    </div>
                    <div className="space-y-1 text-left">
                      <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight text-left">{caja.nombre_responsable}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">
                        Cierre: {new Date(caja.fecha_cierre).toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 mt-4 md:mt-0">
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Monto de Liquidación</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">${(caja.monto_cierre || 0).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-full text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <ChevronRight size={24} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* MODAL APERTURA */}
      <AnimatePresence>
        {modalApertura && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden border border-slate-100 text-center"
            >
              <div className="p-12 text-center space-y-6">
                <div className="bg-blue-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-200">
                  <Unlock size={44} />
                </div>
                <div>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Apertura Turno</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Configuración inicial del cajero</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsable:</span>
                  <span className="font-black uppercase italic text-slate-800 tracking-tight">{responsable}</span>
                </div>

                <div className="space-y-4 pt-4 text-center">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Monto en efectivo (Sencillo)</label>
                  <div className="relative group">
                    <span className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-black text-emerald-500">$</span>
                    <input 
                      type="number" 
                      autoFocus
                      value={montoInicial} 
                      onChange={(e) => setMontoInicial(e.target.value)}
                      className="w-full bg-slate-50 border-4 border-transparent focus:border-blue-500 focus:bg-white rounded-[2.5rem] py-10 pl-16 pr-8 text-6xl font-black outline-none transition-all text-center text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-6">
                  <button 
                    disabled={abriendoCaja}
                    onClick={handleAbrirCaja}
                    className="w-full bg-slate-900 text-white py-8 rounded-[2.2rem] font-black text-sm uppercase shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300"
                  >
                    {abriendoCaja ? <Loader2 className="animate-spin" /> : 'Confirmar e Iniciar Operaciones'}
                  </button>
                  <button onClick={() => setModalApertura(false)} className="py-2 text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors tracking-widest">Cancelar Proceso</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}
