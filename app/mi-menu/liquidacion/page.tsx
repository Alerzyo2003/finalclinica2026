'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle2, Clock, ChevronRight, CalendarDays, Wallet } from 'lucide-react'
import { toast } from 'sonner'

interface MesResumen {
  mes: string        // 'YYYY-MM'
  etiqueta: string    // 'Julio 2026'
  totalGenerado: number
  totalPagado: number
  saldoPendiente: number
  estado: 'Finalizada' | 'Pendiente' | 'Sin Movimiento'
}

const MESES_A_MOSTRAR = 12 // Cuántos meses hacia atrás se listan (incluye el actual)

export default function MisLiquidacionesPage() {
  const [cargando, setCargando] = useState(true)
  const [errorSesion, setErrorSesion] = useState('')
  const [profesional, setProfesional] = useState<any>(null)
  const [meses, setMeses] = useState<MesResumen[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  function generarListaMeses(): string[] {
    const lista: string[] = []
    const hoy = new Date()
    for (let i = 0; i < MESES_A_MOSTRAR; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      lista.push(`${y}-${m}`)
    }
    return lista
  }

  function etiquetaMes(mes: string) {
    const [y, m] = mes.split('-')
    const fecha = new Date(Number(y), Number(m) - 1, 1)
    const texto = fecha.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    return texto.charAt(0).toUpperCase() + texto.slice(1)
  }

  async function fetchData() {
    setCargando(true)
    try {
      // 1. Validar sesión activa
      const { data: { user }, error: errUser } = await supabase.auth.getUser()
      if (errUser || !user) {
        setErrorSesion('No se encontró una sesión activa. Por favor inicia sesión nuevamente.')
        return
      }

      // 2. Perfil de profesional asociado a este usuario (nunca se recibe por URL)
      const { data: prof, error: errProf } = await supabase
        .from('profesionales')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (errProf || !prof) {
        setErrorSesion('Tu usuario no tiene un perfil de profesional asociado.')
        return
      }

      setProfesional(prof)
      const porcentajeDr = Number(prof.porcentaje_comision || 40) / 100

      const mesesLista = generarListaMeses()
      const primerMes = `${mesesLista[mesesLista.length - 1]}-01`
      const [ultY, ultM] = mesesLista[0].split('-')
      const ultimoDiaNum = new Date(Number(ultY), Number(ultM), 0).getDate()
      const ultimoMes = `${mesesLista[0]}-${String(ultimoDiaNum).padStart(2, '0')}`

      // 3. Traer toda la producción, pagos y liquidaciones del rango en un solo viaje
      const { data: atenciones } = await supabase
        .from('atenciones_realizadas')
        .select('id, fecha, monto_cobrado, profesional_id')
        .eq('profesional_id', prof.user_id)
        .gte('fecha', `${primerMes} 00:00:00`)
        .lte('fecha', `${ultimoMes} 23:59:59`)

      const { data: pagos } = await supabase
        .from('pagos')
        .select(`
          id, monto, fecha_pago, profesional_id,
          presupuesto_items ( profesional_id, precio_pactado, estado, tipo_reparto )
        `)
        .gte('fecha_pago', `${primerMes} 00:00:00`)
        .lte('fecha_pago', `${ultimoMes} 23:59:59`)
        .not('estado', 'eq', 'Anulado')

      const { data: liqs } = await supabase
        .from('liquidaciones')
        .select('*')
        .eq('profesional_id', prof.id)
        .eq('estado', 'Finalizada')
        .gte('periodo_desde', primerMes)
        .lte('periodo_hasta', ultimoMes)

      const pagosDelDoctor = (pagos || []).filter((p: any) => {
        const docId = p.profesional_id || p.presupuesto_items?.profesional_id || null
        return docId === prof.user_id
      })

      // 4. Calcular resumen por cada mes del rango
      const resumenPorMes: MesResumen[] = mesesLista
        .map((mes) => {
          const [y, m] = mes.split('-')

          const totalAtenciones = (atenciones || [])
            .filter((a: any) => {
              const f = new Date((a.fecha || '').replace(' ', 'T'))
              return f.getFullYear() === Number(y) && f.getMonth() === Number(m) - 1
            })
            .reduce((acc: number, a: any) => acc + Number(a.monto_cobrado) * porcentajeDr, 0)

          const totalAbonos = pagosDelDoctor
            .filter((p: any) => {
              const f = new Date((p.fecha_pago || '').replace(' ', 'T'))
              return f.getFullYear() === Number(y) && f.getMonth() === Number(m) - 1
            })
            .reduce((acc: number, p: any) => {
              const montoPago = Number(p.monto || 0)
              const itemEstado = p.presupuesto_items?.estado?.toLowerCase() || ''
              const estaTerminado = ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(itemEstado)
              const tipoReparto = p.presupuesto_items?.tipo_reparto || 'general'
              const pctDrItem = tipoReparto === 'doctor' ? 1 : (tipoReparto === 'clinica' ? 0 : porcentajeDr)
              const comision = estaTerminado ? (montoPago * pctDrItem) : 0
              return acc + comision
            }, 0)

          const totalGenerado = totalAtenciones + totalAbonos

          const totalPagado = (liqs || [])
            .filter((l: any) => {
              const f = new Date(l.fecha_pago || l.periodo_hasta)
              return f.getFullYear() === Number(y) && f.getMonth() === Number(m) - 1
            })
            .reduce((acc: number, l: any) => acc + Number(l.monto_total), 0)

          const saldoPendiente = Math.max(totalGenerado - totalPagado, 0)

          let estado: MesResumen['estado'] = 'Sin Movimiento'
          if (totalGenerado > 0 || totalPagado > 0) {
            estado = saldoPendiente > 0 ? 'Pendiente' : 'Finalizada'
          }

          return {
            mes,
            etiqueta: etiquetaMes(mes),
            totalGenerado,
            totalPagado,
            saldoPendiente,
            estado
          }
        })
        .filter((r) => r.estado !== 'Sin Movimiento')

      setMeses(resumenPorMes)
    } catch (error: any) {
      toast.error(error.message || 'Error al cargar tus liquidaciones')
    } finally {
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FBF8F2] gap-4 relative z-0">
        <Loader2 className="animate-spin text-[#C9A24B]" size={40} />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Cargando tus liquidaciones...</p>
      </div>
    )
  }

  if (errorSesion) {
    return (
      <div className="min-h-screen bg-[#FBF8F2] flex items-center justify-center p-8 relative overflow-hidden z-0">
        <div className="bg-white/90 backdrop-blur-md p-10 rounded-[2.5rem] border border-slate-100 shadow-xl text-center max-w-md relative z-10">
          <p className="text-xs font-black text-red-500 uppercase tracking-widest">{errorSesion}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBF8F2] font-sans relative overflow-hidden z-0 text-left">
      
      <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-8 pb-20 relative z-10 text-left">

        {/* HEADER DE LA SECCIÓN */}
        <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#0A111F] rounded-xl flex items-center justify-center text-[#C9A24B] shadow-lg shrink-0">
                <Wallet size={18} />
              </div>
              <p className="text-[10px] font-black text-[#C9A24B] uppercase tracking-[0.2em]">Mis Finanzas</p>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#0A111F] uppercase italic leading-none tracking-tight">
              Mis Liquidaciones
            </h1>
            {profesional && (
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-4 bg-slate-50 inline-block px-4 py-2 rounded-lg border border-slate-100">
                Dr. {profesional.nombre} {profesional.apellido} · <span className="text-[#0A111F] font-black">Comisión {profesional.porcentaje_comision || 40}%</span>
              </p>
            )}
          </div>
        </div>

        {meses.length === 0 ? (
          <div className="p-16 border border-dashed border-slate-300 rounded-[3rem] text-center bg-white/80 backdrop-blur-sm flex flex-col items-center">
            <CalendarDays size={48} className="text-slate-300 mb-4 opacity-50" />
            <p className="text-xs font-black text-[#0A111F] uppercase tracking-widest">Aún no tienes movimientos</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wide">Cuando tengas producción registrada, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {meses.map((r) => (
              <Link
                key={r.mes}
                href={`/mi-menu/liquidacion/${r.mes}`}
                className="group bg-white/95 backdrop-blur-sm p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#C9A24B]/50 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-6"
              >
                <div className="flex items-center justify-between text-left">
                  <h2 className="text-xl font-black text-[#0A111F] uppercase italic tracking-tight">{r.etiqueta}</h2>
                  {r.estado === 'Finalizada' ? (
                    <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-emerald-50 text-emerald-600 border border-emerald-100/50 shadow-sm">
                      <CheckCircle2 size={12} /> Finalizada
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] bg-amber-50 text-amber-600 border border-amber-100/50 shadow-sm">
                      <Clock size={12} /> Pendiente
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-left p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Generado</p>
                    <p className="text-sm font-black text-[#0A111F]">${Math.round(r.totalGenerado).toLocaleString('es-CL')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pagado</p>
                    <p className="text-sm font-black text-emerald-600">${Math.round(r.totalPagado).toLocaleString('es-CL')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Saldo</p>
                    <p className={`text-sm font-black ${r.saldoPendiente > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      ${Math.round(r.saldoPendiente).toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end text-[10px] font-black text-[#C9A24B] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity gap-1 mt-2">
                  Ver detalle de liquidación <ChevronRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}