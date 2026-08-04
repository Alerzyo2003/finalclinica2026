'use client'
import { useParams, useSearchParams } from 'next/navigation'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Printer, DollarSign, Loader2, FlaskConical, CheckCircle2, Calculator, ArrowUpRight, History, AlertCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DetalleLiquidacionPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const mesSeleccionado = searchParams.get('mes') || new Date().toISOString().substring(0, 7)

  const [profesional, setProfesional] = useState<any>(null)
  const [itemsPendientes, setItemsPendientes] = useState<any[]>([])
  const [cierresCompletados, setCierresCompletados] = useState<any[]>([])
  const [resumenMes, setResumenMes] = useState({ totalMes: 0, totalPagado: 0, saldoPendiente: 0 })
  const [cargando, setCargando] = useState(true)
  const [fechaEmision, setFechaEmision] = useState('')

  useEffect(() => {
    if (id) fetchData()
  }, [id, mesSeleccionado])

  async function fetchData() {
    setCargando(true)
    try {
      const [year, month] = mesSeleccionado.split('-');
      const ultimoDiaNum = new Date(Number(year), Number(month), 0).getDate();
      const ultimoDia = String(ultimoDiaNum).padStart(2, '0');
      
      const inicioMes = `${year}-${month}-01 00:00:00`;
      const finMes = `${year}-${month}-${ultimoDia} 23:59:59`
      const fechaCortaInicio = `${year}-${month}-01`;
      const fechaCortaFin = `${year}-${month}-${ultimoDia}`;

      // 1. Obtener datos del profesional
      const { data: prof, error: errProf } = await supabase.from('profesionales').select('*').eq('user_id', id).single()
      if (errProf) throw errProf;
      if (!prof) return;

      const { data: perfil } = await supabase.from('perfiles').select('rut').eq('id', prof.user_id).single();
      setProfesional({ ...prof, rut: perfil?.rut || 'Sin registrar' });
      
      const porcentajeDr = Number(prof.porcentaje_comision || 40) / 100;

      // 2. Obtener Liquidaciones Cerradas
      const { data: liqsData } = await supabase
        .from('liquidaciones')
        .select('*')
        .eq('profesional_id', prof.id)
        .gte('periodo_desde', fechaCortaInicio)
        .lte('periodo_hasta', fechaCortaFin)
        .eq('estado', 'Finalizada')
        .order('fecha_pago', { ascending: true });

      const liqsCerradas = liqsData || [];

      // 3. Obtener Atenciones (solo del mes actual)
      const { data: atenciones } = await supabase
        .from('atenciones_realizadas')
        .select(`id, fecha, monto_cobrado, profesional_id, pacientes(nombre, apellido), prestaciones!atenciones_realizadas_prestacion_id_fkey(id, "Nombre Accion")`)
        .eq('profesional_id', prof.user_id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes);

      // 4. Obtener Pagos
      const { data: pagos, error: errPagos } = await supabase
        .from('pagos')
        .select(`
          id, monto, fecha_pago, profesional_id,
          pacientes ( nombre, apellido ),
          presupuesto_items ( profesional_id, nombre_prestacion, precio_pactado, costo_laboratorio, lab_pagado_por_dr, estado, tipo_reparto )
        `)
        .gte('fecha_pago', inicioMes)
        .lte('fecha_pago', finMes)
        .not('estado', 'eq', 'Anulado');

      if (errPagos) throw errPagos;

      const pagosDelDoctor = (pagos || []).filter((pago: any) => {
         const docId = pago.profesional_id || pago.presupuesto_items?.profesional_id || null;
         return docId === prof.user_id;
      });

      // 5. Formatear Datos
      const atencionesFormateadas = (atenciones || []).map((a: any) => ({
        id_origen: a.id,
        fecha: a.fecha,
        paciente: a.pacientes ? `${a.pacientes.nombre} ${a.pacientes.apellido}` : 'Paciente no encontrado',
        prestacion: a.prestaciones?.["Nombre Accion"] || 'Atención Directa',
        montoPago: Number(a.monto_cobrado),
        descuentoLab: 0,
        esReembolso: false,
        imponible: Number(a.monto_cobrado),
        honorario: Number(a.monto_cobrado) * porcentajeDr,
        tipo: 'Atención'
      }));

      const abonosFormateados = pagosDelDoctor.map((pago: any) => {
        const montoPago = Number(pago.monto || 0);
        const costoLab = Number(pago.presupuesto_items?.costo_laboratorio || 0);
        const precioPactado = Number(pago.presupuesto_items?.precio_pactado || montoPago || 1);
        const pagadoPorDr = Boolean(pago.presupuesto_items?.lab_pagado_por_dr);
        
        const itemEstado = pago.presupuesto_items?.estado?.toLowerCase() || '';
        const estaTerminado = ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(itemEstado);

        let fraccionPago = montoPago / precioPactado;
        if (fraccionPago > 1) fraccionPago = 1;

        const labAplicado = costoLab * fraccionPago;
        let montoImponible = montoPago;
        if (montoImponible < 0) montoImponible = 0;

        const tipoReparto = pago.presupuesto_items?.tipo_reparto || 'general';
        const pctDrItem = tipoReparto === 'doctor' ? 1 : (tipoReparto === 'clinica' ? 0 : porcentajeDr);

        const comision = estaTerminado ? (montoImponible * pctDrItem) : 0;
        const reembolso = estaTerminado ? (pagadoPorDr ? labAplicado : 0) : 0;
        const totalAlDoctor = comision + reembolso;

        return {
          id_origen: pago.id,
          fecha: pago.fecha_pago,
          paciente: pago.pacientes ? `${pago.pacientes.nombre} ${pago.pacientes.apellido}` : 'Paciente',
          prestacion: pago.presupuesto_items?.nombre_prestacion || 'Abono Plan',
          montoPago: montoPago,
          descuentoLab: labAplicado,
          esReembolso: pagadoPorDr,
          imponible: montoImponible,
          honorario: totalAlDoctor,
          tipo: 'Abono Plan'
        }
      });

      const produccionCombinada = [...atencionesFormateadas, ...abonosFormateados]
        .sort((a, b) => {
          const tA = new Date(a.fecha?.replace(' ', 'T') || 0).getTime();
          const tB = new Date(b.fecha?.replace(' ', 'T') || 0).getTime();
          return tA - tB;
        });

      let poolProduccion = produccionCombinada.map(p => ({
        ...p,
        honorario_restante: p.honorario
      }));

      const cierresList: any[] = [];

      liqsCerradas.forEach((liq, index) => {
        let montoARepartir = Number(liq.monto_total);
        let itemsDeEstaLiq = [];

        for(let i = 0; i < poolProduccion.length; i++) {
            let item = poolProduccion[i];
            
            if (item.honorario_restante <= 0) continue;
            if (montoARepartir <= 0) break;

            let aDescontar = Math.min(item.honorario_restante, montoARepartir);
            
            itemsDeEstaLiq.push({
                ...item,
                honorario: aDescontar
            });

            item.honorario_restante -= aDescontar;
            montoARepartir -= aDescontar;
        }

        cierresList.push({
          id: liq.id,
          titulo: `Cierre #${index + 1} • Pagado el ${new Date(liq.fecha_pago || liq.periodo_hasta).toLocaleDateString('es-CL')}`,
          items: itemsDeEstaLiq,
          montoTotal: liq.monto_total
        });
      });

      const pendientesFinal = poolProduccion
        .filter(p => p.honorario_restante > 0)
        .map(p => ({
            ...p,
            honorario: p.honorario_restante
        }));

      setItemsPendientes(pendientesFinal);
      setCierresCompletados(cierresList.reverse());

      const produccionDelMes = produccionCombinada.filter(p => {
        const fechaItem = new Date(p.fecha?.replace(' ', 'T') || 0);
        return fechaItem.getFullYear() === Number(year) && fechaItem.getMonth() === (Number(month) - 1);
      });
      const totalMes = produccionDelMes.reduce((acc, curr) => acc + curr.honorario, 0);

      const liqsDelMes = liqsCerradas.filter(l => {
        const fechaLiq = new Date(l.fecha_pago || l.periodo_hasta);
        return fechaLiq.getFullYear() === Number(year) && fechaLiq.getMonth() === (Number(month) - 1);
      });
      const totalPagado = liqsDelMes.reduce((acc, curr) => acc + Number(curr.monto_total), 0);

      const saldoPendiente = pendientesFinal.reduce((acc, curr) => acc + curr.honorario, 0);
      
      setResumenMes({ totalMes, totalPagado, saldoPendiente });

    } catch (error: any) {
      toast.error(`Error al cargar datos: ${error.message}`)
    } finally {
      setCargando(false)
    }
  }

  const handlePrint = () => {
    setFechaEmision(new Date().toLocaleDateString('es-CL'));
    setTimeout(() => {
      window.print();
    }, 100);
  }

  const obtenerFechaFinalizacion = () => {
    const [year, month] = mesSeleccionado.split('-');
    const ultimoDiaNum = new Date(Number(year), Number(month), 0).getDate();
    return `${String(ultimoDiaNum).padStart(2, '0')}/${month}/${year}`;
  }

  if (cargando) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FBF8F2] gap-4">
      <Loader2 className="animate-spin text-[#C9A24B]" size={40}/>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Cargando reporte de liquidación...</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#FBF8F2] p-6 md:p-10 font-sans text-slate-900 relative overflow-hidden z-0">
      
      {/* IMAGEN DE FONDO GLOBAL */}
      <div 
        className="absolute top-0 right-0 w-[700px] h-[800px] bg-[url('/fondo-profesionales.png')] bg-contain bg-right-top bg-no-repeat -z-10 pointer-events-none opacity-40 mix-blend-multiply"
      ></div>

      {/* ========================================================================= */}
      {/* VISTA WEB (OCULTA AL IMPRIMIR) */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto space-y-8 relative z-10 print:hidden text-left">
        
        <Link href="/administracion/liquidaciones" className="flex items-center gap-2 text-slate-400 hover:text-[#0A111F] font-black text-[10px] uppercase tracking-widest transition-all w-fit">
          <ChevronLeft size={16}/> Volver a liquidaciones
        </Link>

        {/* TARJETAS DE RESUMEN SUPERIOR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/95 backdrop-blur-sm p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Generado (Mes)</p>
            <p className="text-3xl font-black text-[#0A111F]">${Math.round(resumenMes.totalMes).toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-emerald-50/80 backdrop-blur-sm p-8 rounded-[2.5rem] border border-emerald-100 flex flex-col justify-center">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Ya Pagado al Doctor</p>
            <p className="text-3xl font-black text-emerald-700">${Math.round(resumenMes.totalPagado).toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-[#0A111F] p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
              <DollarSign size={120} />
            </div>
            <p className="text-[10px] font-black uppercase text-[#C9A24B] tracking-widest relative z-10">Saldo Pendiente a Pagar</p>
            <p className="text-[9px] text-slate-400 uppercase mt-1 relative z-10">Producción nueva no liquidada</p>
            <p className={`text-4xl font-black mt-3 flex items-center gap-2 relative z-10 ${resumenMes.saldoPendiente > 0 ? "text-white" : "text-slate-500"}`}>
              ${Math.round(resumenMes.saldoPendiente).toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 text-left">
          
          {/* HEADER DEL REPORTE */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8 mb-8">
            <div className="text-left">
              <p className="text-[10px] font-black text-[#C9A24B] uppercase tracking-[0.2em] mb-2 text-left">Desglose de Periodo</p>
              <h1 className="text-3xl font-black text-[#0A111F] uppercase italic leading-none text-left tracking-tight">
                Detalle de Producción
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-left">
                <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-black text-slate-700 uppercase border border-slate-200">
                  Dr. {profesional?.nombre} {profesional?.apellido}
                </div>
                <div className="px-4 py-2 border border-[#C9A24B]/30 bg-[#C9A24B]/10 text-[#8A6D2F] rounded-xl text-[10px] font-black uppercase tracking-widest">
                  Contrato Vigente: {profesional?.porcentaje_comision || 40}%
                </div>
                <div className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Periodo: {mesSeleccionado}
                </div>
              </div>
            </div>
            <button onClick={handlePrint} className="bg-[#0A111F] text-white px-6 py-4 rounded-2xl hover:bg-[#1a2538] transition-all shadow-md font-black text-xs uppercase tracking-widest flex items-center gap-2 shrink-0">
              <Printer size={18}/> Imprimir Reporte
            </button>
          </div>

          <div className="space-y-12">
            
            {/* ========================================================= */}
            {/* SECCIÓN 1: PRODUCCIÓN PENDIENTE (LO QUE SE DEBE PAGAR HOY) */}
            {/* ========================================================= */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><AlertCircle size={22} /></div>
                <div>
                  <h2 className="text-xl font-black text-[#0A111F] uppercase tracking-tight">Pendiente de Pago</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tratamientos realizados y abonados que aún no se liquidan al doctor</p>
                </div>
              </div>

              {itemsPendientes.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center bg-slate-50/50">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3 opacity-60" />
                  <p className="text-xs font-black text-slate-700 uppercase tracking-widest">No hay producción pendiente</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Todo está liquidado y al día.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[2.5rem] border border-amber-200/60 shadow-sm bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                      <thead className="bg-amber-50/60 border-b border-amber-100">
                        <tr>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-800 uppercase tracking-widest">Fecha</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-800 uppercase tracking-widest">Paciente</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-800 uppercase tracking-widest">Prestación</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-800 uppercase tracking-widest text-right">Ingreso Bruto</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-800 uppercase tracking-widest text-right">Costo Lab</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-800 uppercase tracking-widest text-right">Base Imponible</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-800 uppercase tracking-widest text-right bg-amber-100/50">A Pagar al Dr.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {itemsPendientes.map((item: any, idx: number) => (
                          <tr key={idx} className="text-xs font-bold text-slate-700 hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-slate-400">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                            <td className="px-6 py-4 uppercase font-black">{item.paciente}</td>
                            <td className="px-6 py-4 uppercase text-slate-600 max-w-[200px] truncate" title={item.prestacion}>{item.prestacion}</td>
                            <td className="px-6 py-4 text-right text-slate-800">${(item.montoPago || 0).toLocaleString('es-CL')}</td>
                            <td className="px-6 py-4 text-right">
                              {item.descuentoLab > 0 ? (
                                <div className="flex flex-col items-end">
                                   <span className={`font-black flex items-center gap-1 ${item.esReembolso ? 'text-amber-600' : 'text-red-500'}`}>
                                     <FlaskConical size={12}/> ${Math.round(item.descuentoLab).toLocaleString('es-CL')}
                                   </span>
                                   <span className="text-[8px] font-bold uppercase opacity-60">
                                     {item.esReembolso ? 'Por Reembolsar' : 'Deducido'}
                                   </span>
                                </div>
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600">${Math.round(item.imponible).toLocaleString('es-CL')}</td>
                            <td className="px-6 py-4 text-right font-black text-amber-700 bg-amber-50/40 text-sm">
                              ${Math.round(item.honorario).toLocaleString('es-CL')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-50/80 border-t border-amber-200">
                        <tr>
                          <td colSpan={6} className="px-6 py-5 text-right font-black text-amber-900 uppercase text-xs">Total Pendiente:</td>
                          <td className="px-6 py-5 text-right font-black text-amber-700 text-base">
                            ${Math.round(resumenMes.saldoPendiente).toLocaleString('es-CL')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* SECCIÓN 2: HISTORIAL DE CIERRES (LO YA PAGADO) */}
            {/* ========================================================= */}
            {cierresCompletados.length > 0 && (
              <div className="pt-8 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><History size={22} /></div>
                  <div>
                    <h2 className="text-xl font-black text-[#0A111F] uppercase tracking-tight">Historial de Liquidaciones</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Cierres completados y pagados en este mes</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {cierresCompletados.map((cierre) => (
                    <div key={cierre.id} className="overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-white shadow-sm">
                      <div className="p-6 md:p-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-emerald-50/40">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 size={20} /></div>
                          <div>
                            <h3 className="font-black uppercase tracking-wider text-sm text-emerald-900">{cierre.titulo}</h3>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Cierre bloqueado e inmodificable</p>
                          </div>
                        </div>
                        <div className="px-5 py-2.5 rounded-2xl text-xs font-black tracking-widest uppercase flex items-center gap-2 bg-emerald-100 text-emerald-800 shadow-sm">
                          Pagado: ${(cierre.montoTotal || 0).toLocaleString('es-CL')}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[800px]">
                          <thead className="bg-slate-50/50 border-y border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Prestación</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ingreso Bruto</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Costo Lab</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Base Imponible</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Pagado al Dr.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {cierre.items.map((item: any, idx: number) => (
                              <tr key={idx} className="text-xs font-bold text-slate-600 hover:bg-slate-50/50 transition-colors opacity-90">
                                <td className="px-6 py-4">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                                <td className="px-6 py-4 uppercase font-black">{item.paciente}</td>
                                <td className="px-6 py-4 uppercase max-w-[200px] truncate" title={item.prestacion}>{item.prestacion}</td>
                                <td className="px-6 py-4 text-right">${(item.montoPago || 0).toLocaleString('es-CL')}</td>
                                <td className="px-6 py-4 text-right">
                                  {item.descuentoLab > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="font-black flex items-center gap-1 text-slate-400">
                                        <FlaskConical size={12}/> ${Math.round(item.descuentoLab).toLocaleString('es-CL')}
                                      </span>
                                    </div>
                                  ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-6 py-4 text-right">${Math.round(item.imponible).toLocaleString('es-CL')}</td>
                                <td className="px-6 py-4 text-right font-black text-slate-500">
                                  ${Math.round(item.honorario).toLocaleString('es-CL')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA IMPRESIÓN (OCULTA EN WEB, VISIBLE AL IMPRIMIR) */}
      {/* ========================================================================= */}
      <div className="hidden print:block bg-white text-black p-4 font-sans text-[11px] leading-tight max-w-[800px] mx-auto">
        
        <div className="text-center mb-6">
          <h1 className="font-bold text-lg mb-1">CENTRO MEDICO Y DENTAL DIGNIDAD SPA</h1>
        </div>

        <div className="mb-4">
          <p>Fecha Finalización: {obtenerFechaFinalizacion()}, Fecha Impresión: {fechaEmision}</p>
          <p>Liquidación Periodo: {mesSeleccionado}</p>
        </div>

        <div className="mb-4">
          <p className="font-bold underline mb-1">Profesional:</p>
          <p>Nombre: {profesional?.nombre} {profesional?.apellido} RUT: {profesional?.rut || ''} Sucursal: CENTRO MEDICO Y DENTAL DIGNIDAD</p>
        </div>

        <div className="mb-6">
          <p className="font-bold underline mb-1">Resumen de la Liquidación:</p>
          <p>Producción Mes ${Math.round(resumenMes.totalMes).toLocaleString('es-CL')}</p>
          <p>Ya Pagado (Cierres Previos) ${Math.round(resumenMes.totalPagado).toLocaleString('es-CL')}</p>
          <p className="font-bold mt-1">Saldo Pendiente a Pagar ${Math.round(resumenMes.saldoPendiente).toLocaleString('es-CL')}</p>
        </div>

        {/* IMPRESIÓN DE PENDIENTES */}
        {itemsPendientes.length > 0 && (
          <div className="mb-6">
            <p className="font-bold underline mb-2">Detalle de Producción Pendiente de Pago:</p>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1 w-20">Fecha</th>
                  <th className="py-1">Paciente</th>
                  <th className="py-1">Acción</th>
                  <th className="py-1 text-right w-24">Honorario</th>
                </tr>
              </thead>
              <tbody>
                {itemsPendientes.map((item: any, idx: number) => (
                  <tr key={`pend-${idx}`}>
                    <td className="py-1">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                    <td className="py-1 uppercase">{item.paciente}</td>
                    <td className="py-1 uppercase pr-2">{item.prestacion}</td>
                    <td className="py-1 text-right font-bold">${Math.round(item.honorario).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* IMPRESIÓN DE CIERRES ANTERIORES */}
        {cierresCompletados.length > 0 && (
          <div className="mb-6">
            <p className="font-bold underline mb-2">Detalle de Historial (Cierres ya pagados este mes):</p>
            {cierresCompletados.map((cierre) => (
              <div key={cierre.id} className="mb-4">
                <p className="font-bold italic text-[10px] mb-1">{cierre.titulo} (Total: ${Number(cierre.montoTotal).toLocaleString('es-CL')})</p>
                <table className="w-full text-left text-[9px] mb-2 text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="py-1 w-20">Fecha</th>
                      <th className="py-1">Paciente</th>
                      <th className="py-1">Acción</th>
                      <th className="py-1 text-right w-24">Pagado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cierre.items.map((item: any, idx: number) => (
                      <tr key={`cierre-${cierre.id}-${idx}`}>
                        <td className="py-1">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                        <td className="py-1 uppercase">{item.paciente}</td>
                        <td className="py-1 uppercase pr-2">{item.prestacion}</td>
                        <td className="py-1 text-right">${Math.round(item.honorario).toLocaleString('es-CL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 text-center border-t border-black pt-4 text-[10px]">
          <p className="font-bold uppercase">CENTRO MEDICO Y DENTAL DIGNIDAD SPA</p>
          <p>Venancia Leiva 1871, Región Metropolitana, La Pintana | +56966467641 / +56994464662</p>
        </div>

      </div>
    </main>
  )
}
