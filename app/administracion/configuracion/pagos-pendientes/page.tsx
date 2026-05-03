'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  DollarSign, Search, User, ArrowRight, Loader2, 
  CheckCircle2, CreditCard, Hash
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function PagosPendientesPage() {
  const [pacientesDeudores, setPacientesDeudores] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    fetchDeudores()

    // Suscripción Realtime para actualizar si el saldo cambia
    const canal = supabase
      .channel('cambios-saldos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pacientes' }, () => {
        fetchDeudores()
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [])

  async function fetchDeudores() {
    try {
      // Traemos directamente a los pacientes que tengan saldo pendiente > 0
      // Esta es la misma columna que usas en la página principal
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nombre, apellido, rut, saldo_pendiente')
        .gt('saldo_pendiente', 0) // Solo los que deben dinero
        .order('saldo_pendiente', { ascending: false })

      if (error) throw error
      setPacientesDeudores(data || [])
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setCargando(false)
    }
  }

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor)
  }

  const filtrados = pacientesDeudores.filter(p => 
    `${p.nombre} ${p.apellido} ${p.rut}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={30} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Sincronizando deudas...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans text-left">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5 w-full">
            <div className="bg-red-500 p-4 rounded-2xl text-white shadow-xl shadow-red-100">
              <DollarSign size={28} />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-slate-800 uppercase italic leading-none tracking-tighter">Cuentas por Cobrar</h1>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Sincronizado con el Directorio General</p>
            </div>
          </div>
          
          <div className="bg-slate-900 px-8 py-4 rounded-[1.8rem] text-right shadow-2xl min-w-[220px]">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Deuda Total Cartera</p>
            <p className="text-xl font-black text-emerald-400 italic">
              {formatearMoneda(filtrados.reduce((acc, curr) => acc + Number(curr.saldo_pendiente), 0))}
            </p>
          </div>
        </header>

        {/* BUSCADOR */}
        <div className="relative group max-w-sm">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text"
            placeholder="BUSCAR DEUDOR..."
            className="w-full bg-white p-4 pl-12 rounded-2xl border border-slate-100 shadow-sm outline-none focus:ring-4 ring-blue-50 transition-all font-bold text-[10px] uppercase"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* GRILLA DE DEUDORES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode='popLayout'>
            {filtrados.map((p) => (
              <motion.div 
                key={p.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-red-200 transition-all group relative overflow-hidden text-left"
              >
                <div className="flex items-center gap-4 mb-5 text-left">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-red-500 group-hover:text-white transition-all shadow-inner shrink-0">
                    <User size={24} />
                  </div>
                  <div className="overflow-hidden text-left flex-1">
                    <p className="text-[13px] font-black text-slate-800 uppercase italic truncate leading-tight">
                      {p.nombre} {p.apellido}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1">
                      <Hash size={10} /> {p.rut}
                    </p>
                  </div>
                </div>

                <div className="bg-red-50/50 p-5 rounded-[1.5rem] border border-red-100/50 mb-5 text-left">
                  <p className="text-[10px] font-black text-red-400 uppercase italic tracking-tighter mb-1">Monto Pendiente:</p>
                  <p className="text-2xl font-black text-red-600 italic tracking-tighter">
                    {formatearMoneda(p.saldo_pendiente)}
                  </p>
                </div>

                <Link 
                  href={`/pacientes/${p.id}`}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-blue-600 transition-all active:scale-95 shadow-lg"
                >
                  Gestionar Cobro <ArrowRight size={14}/>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtrados.length === 0 && !cargando && (
          <div className="py-32 text-center flex flex-col items-center gap-5 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
            <CheckCircle2 size={40} className="text-emerald-400" />
            <p className="text-slate-400 font-black text-xs uppercase italic tracking-widest">No hay saldos pendientes en el sistema</p>
          </div>
        )}
      </div>
    </div>
  )
}