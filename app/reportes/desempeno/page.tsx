'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  TrendingUp, Users, Calendar, DollarSign, Clock, 
  Filter, Activity, ArrowUpRight, ArrowDownRight,
  FileText, CheckCircle2, Receipt, Calculator, Trophy,
  AlertCircle, Loader2, Briefcase, Stethoscope, PieChart as PieChartIcon
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, Cell,
  PieChart, Pie, Legend
} from 'recharts'

export default function PanelDesempenoPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    setMounted(true)
    fetchMetrics()
  }, [mes, anio])

  async function fetchMetrics() {
    setLoading(true)
    try {
      const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0).toISOString()
      const finMes = new Date(anio, mes, 0, 23, 59, 59).toISOString()
      const fechaHistorialInicio = new Date(anio, mes - 6, 1).toISOString()

      const [
        { data: citasData },
        { count: pacientesNuevos },
        { count: totalPresupuestos },
        { data: pagosData },
        { data: atencionesData },
        { data: cajasData },
        { data: historialCajas },
        { data: historialPagos }
      ] = await Promise.all([
        supabase.from('citas').select('*').gte('inicio', inicioMes).lte('inicio', finMes),
        supabase.from('pacientes').select('*', { count: 'exact', head: true }).gte('created_at', inicioMes).lte('created_at', finMes),
        supabase.from('presupuestos').select('*', { count: 'exact', head: true }).gte('fecha_creacion', inicioMes).lte('fecha_creacion', finMes),
        supabase.from('pagos').select('*, perfiles:profesional_id(nombre_completo)').gte('fecha_pago', inicioMes).lte('fecha_pago', finMes),
        supabase.from('atenciones_realizadas').select('*, pacientes(prevision), perfiles:profesional_id(nombre_completo)').gte('fecha', inicioMes).lte('fecha', finMes),
        supabase.from('sesiones_caja').select('*, pagos(monto)').gte('fecha_apertura', inicioMes).lte('fecha_apertura', finMes),
        supabase.from('sesiones_caja').select('monto_cierre, monto_apertura, fecha_apertura').gte('fecha_apertura', fechaHistorialInicio).lte('fecha_apertura', finMes),
        supabase.from('pagos').select('monto, fecha_pago').gte('fecha_pago', fechaHistorialInicio).lte('fecha_pago', finMes)
      ])

      const abonosPorEspecialista = (pagosData || []).reduce((acc: any, curr: any) => {
        const nombre = (curr.perfiles as any)?.nombre_completo || 'Clínica / General'
        acc[nombre] = (acc[nombre] || 0) + Number(curr.monto || 0)
        return acc
      }, {})

      const chartVentasProf = Object.entries(abonosPorEspecialista)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)

      const atencionesConvenio = (atencionesData || []).reduce((acc: any, curr: any) => {
        const convenio = (curr.pacientes as any)?.prevision || 'Particular'
        acc[convenio] = (acc[convenio] || 0) + 1
        return acc
      }, {})

      const chartPieConvenio = Object.entries(atencionesConvenio)
        .map(([name, value]) => ({ name, value }))

      const ventasCajaMesActual = (cajasData || []).reduce((acc: number, caja: any) => {
        const neto = caja.estado === 'cerrada' 
          ? (Number(caja.monto_cierre || 0) - Number(caja.monto_apertura || 0))
          : ((caja.pagos as any[])?.reduce((sum: number, p: any) => sum + Number(p.monto || 0), 0) || 0)
        return acc + neto
      }, 0)

      const mesesLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      const chartHistory = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anio, mes - 1 - i, 1)
        const mIdx = d.getMonth(); const yVal = d.getFullYear()
        const totalVentasM = (historialCajas || []).filter((c: any) => {
          const cDate = new Date(c.fecha_apertura); return cDate.getMonth() === mIdx && cDate.getFullYear() === yVal
        }).reduce((acc: number, c: any) => acc + (Number(c.monto_cierre || 0) - Number(c.monto_apertura || 0)), 0)
        
        const totalRecM = (historialPagos || []).filter((p: any) => {
          const pDate = new Date(p.fecha_pago); return pDate.getMonth() === mIdx && pDate.getFullYear() === yVal
        }).reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0)
        
        chartHistory.push({ name: mesesLabels[mIdx], ventas: totalVentasM || (i === 0 ? ventasCajaMesActual : 0), recaudacion: totalRecM })
      }

      setData({
        agenda: {
          pacientesNuevos: pacientesNuevos || 0,
          anuladas: (citasData || []).filter((c: any) => c.estado === 'anulada').length || 0,
          presupuestos: totalPresupuestos || 0,
          ocupacion: citasData?.length ? Math.round((citasData.filter((c: any) => c.estado === 'finalizada').length / citasData.length) * 100) : 0,
          espera: "17.9"
        },
        financiero: { ventas: ventasCajaMesActual, recaudacion: (pagosData || []).reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0) },
        charts: {
          ventasProf: chartVentasProf || [],
          pieConvenio: chartPieConvenio || [],
          history: chartHistory || [],
          convenios: Object.entries((pagosData || []).reduce((acc: any, curr: any) => {
            const conv = curr.convenio || 'Particular'; acc[conv] = (acc[conv] || 0) + Number(curr.monto || 0); return acc
          }, {})).map(([name, value]) => ({ name, value: value as number })).sort((a: any, b: any) => b.value - a.value)
        }
      })
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  if (!mounted || loading || !data) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 italic">Analizando Desempeño Clínica...</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-8 max-md:p-4 font-sans text-slate-900 text-left">
      <div className="max-w-7xl mx-auto space-y-8 text-left">
        
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 gap-6 text-left">
          <div className="text-left">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-800 leading-none text-left">Panel de Desempeño</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] mt-2 text-left">CENTRO MEDICO Y DENTAL DIGNIDAD SPA</p>
          </div>
          <div className="flex items-center gap-3 text-left">
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="bg-slate-50 border-none rounded-2xl py-3 px-6 text-xs font-black uppercase outline-none focus:ring-2 ring-blue-500/20 cursor-pointer shadow-sm text-slate-900">
              {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="bg-slate-50 border-none rounded-2xl py-3 px-6 text-xs font-black outline-none focus:ring-2 ring-blue-500/20 cursor-pointer shadow-sm text-slate-900">
              {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-left">
          <MetricCard title="Pacientes Nuevos" value={data.agenda.pacientesNuevos} icon={<Users size={20}/>} color="blue" />
          <MetricCard title="Citas Anuladas" value={data.agenda.anuladas} icon={<AlertCircle size={20}/>} color="red" />
          <MetricCard title="Ocupación" value={`${data.agenda.ocupacion}%`} icon={<Activity size={20}/>} color="emerald" />
          <MetricCard title="Presupuestos" value={data.agenda.presupuestos} icon={<FileText size={20}/>} color="purple" />
          <MetricCard title="Finalizados" value={`${data.agenda.ocupacion}%`} icon={<CheckCircle2 size={20}/>} color="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 text-left">
            <div className="flex justify-between items-start mb-8 text-left">
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-left">Producción Clínica (Ventas)</p>
                <h2 className="text-4xl font-black text-slate-800 mt-3 text-left">${Number(data.financiero.ventas).toLocaleString('es-CL')}</h2>
                <span className="text-blue-500 text-[10px] font-bold flex items-center gap-1 mt-2"><Briefcase size={12}/> Flujo neto de cajas</span>
              </div>
              <div className="bg-blue-50 p-4 rounded-3xl text-blue-600 shadow-inner shrink-0"><TrendingUp size={24}/></div>
            </div>
            <div className="h-[280px] w-full text-left">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts?.history || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-bold" />
                  <Tooltip 
                    contentStyle={{borderRadius: '20px', border:'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                    formatter={(val: any) => `$${Number(val || 0).toLocaleString('es-CL')}`}
                  />
                  <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={4} fill="#3b82f6" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 text-left">
            <div className="flex justify-between items-start mb-8 text-left">
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-left">Recaudación (Ingresos)</p>
                <h2 className="text-4xl font-black text-emerald-600 mt-3 text-left">${Number(data.financiero.recaudacion).toLocaleString('es-CL')}</h2>
                <span className="text-emerald-500 text-[10px] font-bold flex items-center gap-1 mt-2"><ArrowUpRight size={12}/> Pagos ingresados</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-3xl text-emerald-600 shadow-inner shrink-0"><DollarSign size={24}/></div>
            </div>
            <div className="h-[280px] w-full text-left">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts?.history || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-bold uppercase" />
                  <Tooltip 
                    contentStyle={{borderRadius: '20px', border:'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                    formatter={(val: any) => `$${Number(val || 0).toLocaleString('es-CL')}`}
                  />
                  <Bar dataKey="recaudacion" fill="#10b981" radius={[10, 10, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 text-left">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-8 flex items-center gap-2 text-left">
              <Trophy size={16} className="text-amber-500" /> Producción por Especialista (Abonos)
            </h3>
            <div className="h-[400px] text-left">
              {data.charts.ventasProf.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.ventasProf} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={130} className="text-[9px] font-black uppercase" />
                    <Tooltip 
                      cursor={{fill: 'transparent'}} 
                      formatter={(val: any) => `$${Number(val || 0).toLocaleString('es-CL')}`} 
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={25}>
                      {data.charts.ventasProf.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#94a3b8'} fillOpacity={1 - (index * 0.15)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 font-black uppercase text-[10px] text-center">Sin abonos registrados</div>
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 text-left">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-8 flex items-center gap-2 text-left">
              <PieChartIcon size={16} className="text-blue-500" /> Atenciones por Convenio
            </h3>
            <div className="h-[400px] text-left">
              {data.charts.pieConvenio.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.pieConvenio}
                      cx="50%" cy="45%"
                      innerRadius={80} outerRadius={120}
                      paddingAngle={5} dataKey="value"
                      // @ts-ignore
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.charts.pieConvenio.map((entry: any, index: number) => (
                        <Cell key={`cell-pie-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => Number(val || 0)} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 font-black uppercase text-[10px] text-center">Sin flujo de pacientes</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10 text-left">
          <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 pointer-events-none"><Activity size={200} /></div>
            <div className="space-y-6 relative z-10 text-left">
              <div className="flex items-center gap-4 text-left">
                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20 shrink-0"><Clock size={24} /></div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-left">Eficiencia Operativa</p>
              </div>
              <h4 className="text-5xl font-black italic tracking-tighter text-left">{data.agenda.espera} min</h4>
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-widest italic text-left">Tiempo promedio real</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-10 relative z-10 text-left">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Top Convenios ($)</p>
                <div className="space-y-3 text-left">
                  {data.charts.convenios.slice(0, 4).map((c: any) => (
                    <div key={c.name} className="flex justify-between items-center text-[10px] font-bold border-b border-white/5 pb-1">
                      <span className="truncate pr-2 uppercase text-slate-300">{c.name}</span>
                      <span className="text-blue-400 font-black">${Number(c.value).toLocaleString('es-CL')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col justify-center items-center text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Estado General</p>
                <p className="text-2xl font-black text-emerald-400">SALUDABLE</p>
                <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[85%] shadow-[0_0_10px_#10b981]"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center space-y-4">
             <div className="p-4 bg-blue-50 text-blue-600 rounded-full shrink-0"><Stethoscope size={32} /></div>
             <h3 className="text-lg font-black uppercase italic text-slate-800">Distribución de Flujo</h3>
             <p className="text-xs text-slate-500 font-medium max-w-xs text-center">Convenio con mayor flujo: <strong>{data?.charts?.pieConvenio?.[0]?.name || 'Ninguno'}</strong>.</p>
             <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[85%] rounded-full"></div>
             </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function MetricCard({ title, value, icon, color, subtitle }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600"
  }
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:scale-105 transition-all cursor-default">
      <div className={`${colors[color]} p-4 rounded-2xl mb-4 group-hover:rotate-12 transition-transform shadow-sm shrink-0`}>{icon}</div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none text-center">{title}</p>
      <h3 className="text-3xl font-black text-slate-800 leading-none text-center">{value}</h3>
      {subtitle && <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-tighter text-center">{subtitle}</p>}
    </div>
  )
}
