'use client'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Printer, DollarSign, Loader2, Activity, Wallet } from 'lucide-react'
import Link from 'next/link'

export default function DetalleLiquidacionPage() {
  const { id } = useParams()
  const [profesional, setProfesional] = useState<any>(null)
  const [produccion, setProduccion] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  async function fetchData() {
    setCargando(true)
    try {
      // 1. Obtener datos del profesional
      const { data: prof } = await supabase
        .from('profesionales')
        .select('*')
        .eq('id', id)
        .single()
      
      if (!prof) return
      setProfesional(prof)

      // 2. Obtener Atenciones Realizadas con cast de tipo para evitar errores de compilación
      const { data: atenciones, error: errAtenciones } = await supabase
        .from('atenciones_realizadas')
        .select(`
          fecha, 
          monto_cobrado, 
          pacientes(nombre, apellido),
          prestaciones!atenciones_realizadas_prestacion_id_fkey(id, "Nombre Accion")
        `)
        .eq('profesional_id', prof.user_id)

      if (errAtenciones) console.error("Error Atenciones:", errAtenciones)

      // 3. Obtener Abonos de presupuesto_items
      const { data: abonos, error: errAbonos } = await supabase
        .from('presupuesto_items')
        .select(`
          abonado,
          prestaciones!fk_items_prestaciones(id, "Nombre Accion"),
          presupuestos!inner(
            fecha_creacion,
            especialista_id,
            pacientes(nombre, apellido)
          )
        `)
        .eq('presupuestos.especialista_id', prof.user_id)
        .gt('abonado', 0)

      if (errAbonos) console.error("Error Abonos:", errAbonos)

      // 4. Formatear datos usando 'as any' para satisfacer al compilador de Vercel
      const atencionesFormateadas = (atenciones || []).map((a: any) => ({
        fecha: a.fecha,
        paciente: a.pacientes ? `${a.pacientes.nombre} ${a.pacientes.apellido}` : 'Paciente no encontrado',
        prestacion: a.prestaciones?.["Nombre Accion"] || 'Atención Directa',
        valor: Number(a.monto_cobrado),
        tipo: 'Atención'
      }))

      const abonosFormateados = (abonos || []).map((a: any) => {
        const presup = a.presupuestos as any;
        const pac = presup?.pacientes as any;
        
        return {
          fecha: presup?.fecha_creacion,
          paciente: pac ? `${pac.nombre} ${pac.apellido}` : 'Paciente no encontrado',
          prestacion: a.prestaciones?.["Nombre Accion"] || 'Abono tratamiento',
          valor: Number(a.abonado),
          tipo: 'Abono Plan'
        }
      })

      setProduccion([...atencionesFormateadas, ...abonosFormateados])

    } catch (error) {
      console.error("Error crítico:", error)
    } finally {
      setCargando(false)
    }
  }

  const totalRealizado = produccion.reduce((acc, curr) => acc + curr.valor, 0)
  const totalHonorario = totalRealizado * 0.4

  if (cargando) return <div className="p-40 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40}/></div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <Link href="/administracion/liquidaciones" className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-widest transition-all">
          <ChevronLeft size={16}/> Volver a liquidaciones
        </Link>

        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-left">
          
          <div className="flex justify-between items-start">
            <div className="text-left">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 text-left">Ficha de Liquidación</p>
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none text-left">
                Detalle de Producción
              </h1>
              <div className="flex items-center gap-4 mt-4 text-left">
                <div className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-600 uppercase">
                  Dr. {profesional?.nombre} {profesional?.apellido}
                </div>
              </div>
            </div>
            <button onClick={() => window.print()} className="bg-slate-100 text-slate-600 p-4 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
              <Printer size={20}/>
            </button>
          </div>

          <div className="mt-12 overflow-hidden rounded-[2.5rem] border border-slate-100 shadow-inner text-left">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase text-left">Fecha</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase text-left">Tipo</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase text-left">Paciente</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase text-left">Prestación</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase text-right">Monto</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase text-right">Honorario (40%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {produccion.length === 0 ? (
                  <tr><td colSpan={6} className="p-20 text-center text-xs font-bold text-slate-300 uppercase italic">Sin producción registrada</td></tr>
                ) : produccion.map((item, idx) => (
                  <tr key={idx} className="text-xs font-bold text-slate-600 hover:bg-slate-50/50 transition-colors text-left">
                    <td className="px-6 py-4 text-slate-400 text-left">{item.fecha ? new Date(item.fecha).toLocaleDateString('es-CL') : 'S/F'}</td>
                    <td className="px-6 py-4 text-left">
                      <span className={`px-2 py-1 rounded-md text-[8px] uppercase font-black ${item.tipo === 'Atención' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 uppercase text-left">{item.paciente}</td>
                    <td className="px-6 py-4 uppercase text-slate-400 text-left">{item.prestacion}</td>
                    <td className="px-6 py-4 text-right text-slate-800">${(item.valor || 0).toLocaleString('es-CL')}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-black">${((item.valor || 0) * 0.4).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 flex flex-col md:flex-row justify-end gap-6 text-left">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-center min-w-[280px] relative overflow-hidden text-left">
                <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest text-left">Líquido a Pagar (40%)</p>
                <p className="text-4xl font-black mt-2 flex items-center gap-2 text-left">
                  <DollarSign className="text-emerald-400" size={28}/>
                  {totalHonorario.toLocaleString('es-CL')}
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
