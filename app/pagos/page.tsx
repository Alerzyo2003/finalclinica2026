'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  DollarSign, TrendingUp, Users, 
  Download, Loader2, Calendar as CalendarIcon,
  ArrowUpRight, Wallet, Receipt
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function PagosPage() {
  const [pagos, setPagos] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, promedio: 0, cantidad: 0 })
  const [cargando, setCargando] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchFinanzas()
  }, [])

  async function fetchFinanzas() {
    setCargando(true)
    
    try {
      // Consultamos todas las fuentes de ingresos en paralelo
      const [resEvoluciones, resPagos, resAtenciones, resPresupuestos] = await Promise.all([
        supabase.from('evoluciones').select('id, monto_cobrado, descripcion_procedimiento, fecha_registro, pacientes(nombre, apellido)').gt('monto_cobrado', 0),
        supabase.from('pagos').select('id, monto, comentario, fecha_pago, pacientes(nombre, apellido)'),
        supabase.from('atenciones_realizadas').select('id, monto_cobrado, observacion, fecha, pacientes(nombre, apellido)').eq('estado', 'Pagado'),
        supabase.from('presupuestos').select('id, total_abonado, nombre_tratamiento, created_at, pacientes(nombre, apellido)').gt('total_abonado', 0)
      ])

      const consolidado: any[] = []

      // Mapeo de Evoluciones (Casting 'as any' para evitar error de propiedad pacientes)
      resEvoluciones.data?.forEach((e: any) => consolidado.push({
        id: e.id,
        monto: Number(e.monto_cobrado || 0),
        detalle: e.descripcion_procedimiento,
        fecha: e.fecha_registro,
        paciente: e.pacientes ? `${e.pacientes.nombre} ${e.pacientes.apellido}` : 'Paciente no registrado',
        tipo: 'Evolución'
      }))

      // Mapeo de Pagos
      resPagos.data?.forEach((p: any) => consolidado.push({
        id: p.id,
        monto: Number(p.monto || 0),
        detalle: p.comentario || 'Pago registrado',
        fecha: p.fecha_pago,
        paciente: p.pacientes ? `${p.pacientes.nombre} ${p.pacientes.apellido}` : 'Paciente no registrado',
        tipo: 'Abono/Pago'
      }))

      // Mapeo de Atenciones
      resAtenciones.data?.forEach((a: any) => consolidado.push({
        id: a.id,
        monto: Number(a.monto_cobrado || 0),
        detalle: a.observacion || 'Atención Clínica',
        fecha: a.fecha,
        paciente: a.pacientes ? `${a.pacientes.nombre} ${a.pacientes.apellido}` : 'Paciente no registrado',
        tipo: 'Prestación'
      }))

      // Mapeo de Presupuestos
      resPresupuestos.data?.forEach((pr: any) => consolidado.push({
        id: pr.id,
        monto: Number(pr.total_abonado || 0),
        detalle: `Abono Tratamiento: ${pr.nombre_tratamiento}`,
        fecha: pr.created_at,
        paciente: pr.pacientes ? `${pr.pacientes.nombre} ${pr.pacientes.apellido}` : 'Paciente no registrado',
        tipo: 'Tratamiento'
      }))

      // Ordenar por fecha más reciente de forma segura
      consolidado.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())

      const total = consolidado.reduce((acc: number, curr: any) => acc + (curr.monto || 0), 0)
      
      setPagos(consolidado)
      setStats({
        total: total,
        cantidad: consolidado.length,
        promedio: consolidado.length > 0 ? total / consolidado.length : 0
      })
    } catch (error) {
      console.error("Error en finanzas:", error)
    } finally {
      setCargando(false)
    }
  }

  // Prevenir errores de hidratación en Vercel
  if (!mounted || cargando) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consolidando Caja Global...</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-10 text-left">
        
        <header className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 text-left">
          <div className="flex items-center gap-6 text-left">
            <div className="bg-emerald-500 p-5 rounded-[2rem] text-white shadow-xl shadow-emerald-100">
              <Wallet size={32} />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none text-left">Caja Global</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3 text-left">Ingresos Consolidados (Incluye Abonos de Tratamiento)</p>
            </div>
          </div>
          <button 
            onClick={() => window.print()}
            className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95 text-left"
          >
            <Download size={18} /> Imprimir Reporte
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <StatCard label="Ingresos Totales" value={`$${stats.total.toLocaleString('es-CL')}`} icon={<DollarSign size={24} />} color="text-emerald-600" bg="bg-emerald-50" trend="Total percibido" />
          <StatCard label="Promedio Transacción" value={`$${Math.round(stats.promedio).toLocaleString('es-CL')}`} icon={<TrendingUp size={24} />} color="text-blue-600" bg="bg-blue-50" trend="Ticket medio" />
          <StatCard label="Movimientos" value={stats.cantidad.toString()} icon={<Receipt size={24} />} color="text-purple-600" bg="bg-purple-50" trend="Operaciones totales" />
        </div>

        <section className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden text-left">
          <div className="overflow-x-auto text-left">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest text-left">
                  <th className="p-8 text-left">Fecha / Origen</th>
                  <th className="p-8 text-left">Paciente</th>
                  <th className="p-8 text-left">Detalle del Movimiento</th>
                  <th className="p-8 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-left">
                {pagos.length > 0 ? pagos.map((p, index) => (
                  <motion.tr 
                    key={`${p.tipo}-${p.id}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-slate-50 transition-colors group text-left"
                  >
                    <td className="p-8 text-left">
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-slate-600 text-left">
                          {p.fecha ? new Date(p.fecha).toLocaleDateString('es-CL') : 'S/F'}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full w-fit mt-1 text-left ${
                          p.tipo === 'Evolución' ? 'bg-blue-50 text-blue-600' : 
                          p.tipo === 'Abono/Pago' ? 'bg-emerald-50 text-emerald-600' : 
                          p.tipo === 'Tratamiento' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {p.tipo}
                        </span>
                      </div>
                    </td>
                    <td className="p-8 font-black text-slate-700 uppercase text-sm text-left">{p.paciente}</td>
                    <td className="p-8 text-xs font-medium text-slate-500 italic max-w-xs truncate text-left">"{p.detalle}"</td>
                    <td className="p-8 text-right font-black text-emerald-600 text-lg">
                      ${p.monto.toLocaleString('es-CL')}
                    </td>
                  </motion.tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="p-20 text-center">
                      <p className="text-slate-400 font-black text-xs uppercase italic tracking-widest text-center">No hay registros de dinero todavía</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value, icon, color, bg, trend }: any) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6 relative overflow-hidden text-left">
      <div className="flex justify-between items-start relative z-10 text-left">
        <div className={`${bg} ${color} p-4 rounded-2xl`}>{icon}</div>
        <div className="text-[9px] font-black text-slate-300 uppercase bg-slate-50 px-3 py-1 rounded-full text-left">{trend}</div>
      </div>
      <div className="relative z-10 text-left">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">{label}</p>
        <h3 className={`text-3xl font-black ${color} text-left`}>{value}</h3>
      </div>
      <div className={`absolute -right-4 -bottom-4 opacity-[0.03] ${color} pointer-events-none`}>
        {icon}
      </div>
    </motion.div>
  )
}
