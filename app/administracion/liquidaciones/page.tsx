'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Calculator, Search, Eye, CheckCircle2, 
  Loader2, Calendar as CalendarIcon, DollarSign,
  TrendingUp, Users, ArrowUpRight, Filter
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function LiquidacionesPage() {
  const [liquidaciones, setLiquidaciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM

  useEffect(() => {
    fetchData()
  }, [mesSeleccionado])

  async function fetchData() {
    setCargando(true)
    try {
      const inicioMes = `${mesSeleccionado}-01T00:00:00`
      const finMes = `${mesSeleccionado}-31T23:59:59`

      // 1. Obtener todos los profesionales activos
      const { data: profs } = await supabase
        .from('profesionales')
        .select('id, nombre, apellido, user_id')
        .eq('activo', true)

      if (!profs) return

      // 2. Producción por Atenciones Realizadas (Evoluciones terminadas)
      const { data: atenciones } = await supabase
        .from('atenciones_realizadas')
        .select('monto_cobrado, profesional_id')
        .gte('fecha', inicioMes)
        .lte('fecha', finMes)

      // 3. Producción por Abonos Directos a ítems del presupuesto
      // Usamos la relación con profesional_id que agregamos a presupuesto_items
      const { data: abonosItems } = await supabase
        .from('pagos')
        .select(`
          monto,
          profesional_id,
          presupuesto_items!inner(profesional_id)
        `)
        .gte('fecha_pago', inicioMes)
        .lte('fecha_pago', finMes)

      // 4. Mapeo y Cruce de datos
      const informeReal = profs.map(p => {
        // Sumar atenciones directas
        const sumaAtenciones = atenciones
          ?.filter(a => a.profesional_id === p.user_id)
          .reduce((acc, curr) => acc + Number(curr.monto_cobrado || 0), 0) || 0

        // Sumar abonos donde él es el ejecutor del ítem
        const sumaAbonos = abonosItems
          ?.filter(pago => pago.profesional_id === p.user_id)
          .reduce((acc, curr) => acc + Number(curr.monto || 0), 0) || 0

        const totalProduccion = sumaAtenciones + sumaAbonos

        return {
          id: p.id,
          user_id: p.user_id,
          nombreCompleto: `${p.nombre} ${p.apellido}`,
          atenciones: sumaAtenciones,
          abonos: sumaAbonos,
          total: totalProduccion,
          honorarios: totalProduccion * 0.40, // 40% configurable
          utilidad: totalProduccion * 0.60
        }
      })

      setLiquidaciones(informeReal)
    } catch (error) {
      console.error("Error financiero:", error)
      toast.error("Error al calcular liquidaciones")
    } finally {
      setCargando(false)
    }
  }

  const globalTotal = liquidaciones.reduce((acc, curr) => acc + curr.total, 0)
  const globalHonorarios = liquidaciones.reduce((acc, curr) => acc + curr.honorarios, 0)
  const globalUtilidad = globalTotal - globalHonorarios

  const filtradas = liquidaciones.filter(l => 
    l.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-24 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* TOP BAR / HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-slate-900 p-5 rounded-[2.2rem] text-white shadow-2xl">
              <Calculator size={30} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Cierre de Caja</h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mt-2">
                <TrendingUp size={12} className="text-emerald-500"/> Rendimiento por especialista
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <CalendarIcon size={16} className="text-blue-600"/>
              <input 
                type="month" 
                value={mesSeleccionado} 
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="bg-transparent font-black text-xs uppercase outline-none text-slate-700"
              />
            </div>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Buscar Dr..." 
                className="pl-11 pr-6 py-3 bg-slate-50 rounded-xl text-xs font-bold border border-transparent focus:border-blue-500 outline-none transition-all w-64"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StatCard label="Producción Total" value={globalTotal} icon={<DollarSign size={20}/>} color="blue" />
          <StatCard label="Honorarios a Pagar" value={globalHonorarios} icon={<Users size={20}/>} color="emerald" />
          <StatCard label="Margen Clínica" value={globalUtilidad} icon={<ArrowUpRight size={20}/>} color="slate" isDark />
        </div>

        {/* TABLA DE LIQUIDACIONES */}
        <div className="bg-white rounded-[3.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest">Especialista Responsable</th>
                <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-center">Atenciones</th>
                <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-center">Abonos Items</th>
                <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-center">Producción</th>
                <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-center">Comisión (40%)</th>
                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="py-32 text-center">
                    <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
                    <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculando balances...</p>
                  </td>
                </tr>
              ) : filtradas.map((liq) => (
                <tr key={liq.id} className="hover:bg-blue-50/30 transition-all group">
                  <td className="px-10 py-7">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        {liq.nombreCompleto.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 uppercase italic leading-none">{liq.nombreCompleto}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 tracking-tighter">ID: {liq.user_id.substring(0,8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-7 text-center text-xs font-bold text-slate-500">
                    ${(liq.atenciones || 0).toLocaleString('es-CL')}
                  </td>
                  <td className="px-6 py-7 text-center text-xs font-bold text-blue-600">
                    ${(liq.abonos || 0).toLocaleString('es-CL')}
                  </td>
                  <td className="px-6 py-7 text-center">
                    <span className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-800">
                      ${(liq.total || 0).toLocaleString('es-CL')}
                    </span>
                  </td>
                  <td className="px-6 py-7 text-center">
                    <span className="text-sm font-black text-emerald-600">
                      ${(liq.honorarios || 0).toLocaleString('es-CL')}
                    </span>
                  </td>
                  <td className="px-10 py-7 text-right">
                    <Link 
                      href={`/administracion/liquidaciones/${liq.user_id}?mes=${mesSeleccionado}`}
                      className="inline-flex items-center justify-center w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    >
                      <Eye size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, isDark }: any) {
  return (
    <div className={`p-10 rounded-[3rem] border transition-all hover:scale-[1.02] duration-300 ${
      isDark ? 'bg-slate-900 border-slate-800 text-white shadow-2xl' : 'bg-white border-slate-100 text-slate-900 shadow-sm'
    }`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-800 text-blue-400' : `bg-${color}-50 text-${color}-600`}`}>
          {icon}
        </div>
        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>Actualizado</span>
      </div>
      <p className={`text-[10px] font-black uppercase tracking-widest opacity-60 mb-2`}>{label}</p>
      <p className="text-4xl font-black italic tracking-tighter">${(value || 0).toLocaleString('es-CL')}</p>
    </div>
  )
}