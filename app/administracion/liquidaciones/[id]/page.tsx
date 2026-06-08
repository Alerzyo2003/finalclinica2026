'use client'
import { useParams, useSearchParams } from 'next/navigation'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Printer, DollarSign, Loader2, FlaskConical, CheckCircle2, Calculator, ArrowUpRight, History, AlertCircle } from 'lucide-react'
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
        .lte('periodo_hasta', fechaCortaFin)
        .eq('estado', 'Finalizada')
        .order('fecha_pago', { ascending: true }); // Orden cronológico para repartir el dinero

      const liqsCerradas = liqsData || [];

      // 3. Obtener Atenciones
      const { data: atenciones } = await supabase
        .from('atenciones_realizadas')
        .select(`id, fecha, monto_cobrado, profesional_id, pacientes(nombre, apellido), prestaciones!atenciones_realizadas_prestacion_id_fkey(id, "Nombre Accion")`)
        .eq('profesional_id', prof.user_id)
        .lte('fecha', finMes);

      // 4. Obtener Pagos
      const { data: pagos, error: errPagos } = await supabase
        .from('pagos')
        .select(`
          id, monto, fecha_pago, profesional_id,
          pacientes ( nombre, apellido ),
          presupuesto_items ( profesional_id, nombre_prestacion, precio_pactado, costo_laboratorio, lab_pagado_por_dr, estado )
        `)
        // .gte('fecha_pago', inicioMes) // Se quita para traer el histórico completo y pagar comisiones de tratamientos terminados este mes pero pagados en meses anteriores.
        .lte('fecha_pago', finMes);

      if (errPagos) throw errPagos;

      const pagosDelDoctor = (pagos || []).filter(pago => {
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
        
        // 🔥 REGLA DE NEGOCIO: Solo se paga comisión si el tratamiento está 100% terminado.
        const itemEstado = pago.presupuesto_items?.estado?.toLowerCase() || '';
        const estaTerminado = ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(itemEstado);

        let fraccionPago = montoPago / precioPactado;
        if (fraccionPago > 1) fraccionPago = 1;

        const labAplicado = costoLab * fraccionPago;
        let montoImponible = montoPago - labAplicado;
        if (montoImponible < 0) montoImponible = 0;

        // Si no está terminado, el honorario es CERO para el doctor.
        const comision = estaTerminado ? (montoImponible * porcentajeDr) : 0;
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
          return tA - tB; // Orden cronológico estricto
        });

      // 🔥 6. NUEVA ASIGNACIÓN (SOPORTA CORTES Y PAGOS PARCIALES) 🔥
      // Preparamos un "pool" de producción. A medida que le asignamos una liquidación, restamos el saldo.
      let poolProduccion = produccionCombinada.map(p => ({
        ...p,
        honorario_restante: p.honorario // Saldo disponible de este item
      }));

      const cierresList: any[] = [];

      liqsCerradas.forEach((liq, index) => {
        let montoARepartir = Number(liq.monto_total);
        let itemsDeEstaLiq = [];

        for(let i = 0; i < poolProduccion.length; i++) {
            let item = poolProduccion[i];
            
            // Si este tratamiento ya se pagó completo, pasamos al siguiente
            if (item.honorario_restante <= 0) continue;
            
            // Si ya no nos queda dinero de esta liquidación para repartir, paramos
            if (montoARepartir <= 0) break;

            // Tomamos el dinero que necesitemos de este tratamiento (hasta donde alcance)
            let aDescontar = Math.min(item.honorario_restante, montoARepartir);
            
            // Agregamos este item al comprobante del cierre actual
            itemsDeEstaLiq.push({
                ...item,
                honorario: aDescontar // En este cierre, mostramos solo la porción que usamos
            });

            // Restamos lo usado al tratamiento y a la liquidación
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

      // 7. SEPARAR LO QUE QUEDÓ PENDIENTE (REMANENTES Y NUEVOS)
      const pendientesFinal = poolProduccion
        .filter(p => p.honorario_restante > 0) // Todo lo que sobró, o que no se ha tocado
        .map(p => ({
            ...p,
            honorario: p.honorario_restante // El honorario pendiente es solo lo que falta por pagar
        }));

      setItemsPendientes(pendientesFinal);
      setCierresCompletados(cierresList.reverse()); // Mostrar el cierre más reciente primero

      // 8. Calcular Resumen Global
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

      // El saldo pendiente ahora es el cálculo real de lo que queda en el pool de producción.
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

  if (cargando) return <div className="p-40 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40}/></div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      
      {/* ========================================================================= */}
      {/* VISTA WEB (OCULTA AL IMPRIMIR) */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto space-y-8 p-8 pb-20 print:hidden text-left">
        
        <Link href="/administracion/liquidaciones" className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-widest transition-all w-fit">
          <ChevronLeft size={16}/> Volver a liquidaciones
        </Link>

        {/* TARJETAS DE RESUMEN SUPERIOR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Generado (Mes)</p>
            <p className="text-3xl font-black text-slate-800">${Math.round(resumenMes.totalMes).toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 flex flex-col justify-center">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Ya Pagado al Doctor</p>
            <p className="text-3xl font-black text-emerald-700">${Math.round(resumenMes.totalPagado).toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
              <DollarSign size={120} />
            </div>
            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest relative z-10">Saldo Pendiente a Pagar</p>
            <p className="text-[9px] text-slate-400 uppercase mt-1 relative z-10">Producción nueva no liquidada</p>
            <p className={`text-4xl font-black mt-3 flex items-center gap-2 relative z-10 ${resumenMes.saldoPendiente > 0 ? "text-white" : "text-slate-500"}`}>
              ${Math.round(resumenMes.saldoPendiente).toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-left">
          
          {/* HEADER DEL REPORTE */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8 mb-8">
            <div className="text-left">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 text-left">Desglose de Periodo</p>
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none text-left">
                Detalle de Producción
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-left">
                <div className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-600 uppercase">
                  Dr. {profesional?.nombre} {profesional?.apellido}
                </div>
                <div className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  Contrato Vigente: {profesional?.porcentaje_comision || 40}%
                </div>
                <div className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Periodo: {mesSeleccionado}
                </div>
              </div>
            </div>
            <button onClick={handlePrint} className="bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <Printer size={18}/> Imprimir Reporte
            </button>
          </div>

          <div className="space-y-12">
            
            {/* ========================================================= */}
            {/* SECCIÓN 1: PRODUCCIÓN PENDIENTE (LO QUE SE DEBE PAGAR HOY) */}
            {/* ========================================================= */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><AlertCircle size={24} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Pendiente de Pago</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tratamientos realizados y abonados que aún no se liquidan al doctor</p>
                </div>
              </div>

              {itemsPendientes.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2rem] text-center bg-slate-50/50">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3 opacity-50" />
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">No hay producción pendiente</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Todo está liquidado y al día.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[2rem] border border-amber-200 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                      <thead className="bg-amber-50/50 border-b border-amber-100">
                        <tr>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-700 uppercase">Fecha</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-700 uppercase">Paciente</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-700 uppercase">Prestación</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-700 uppercase text-right">Ingreso Bruto</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-700 uppercase text-right">Costo Lab</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-700 uppercase text-right">Base Imponible</th>
                          <th className="px-6 py-4 text-[9px] font-black text-amber-700 uppercase text-right bg-amber-100/50">A Pagar al Dr.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {itemsPendientes.map((item: any, idx: number) => (
                          <tr key={idx} className="text-xs font-bold text-slate-600 hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-slate-400">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                            <td className="px-6 py-4 uppercase">{item.paciente}</td>
                            <td className="px-6 py-4 uppercase text-slate-500 max-w-[200px] truncate" title={item.prestacion}>{item.prestacion}</td>
                            <td className="px-6 py-4 text-right text-slate-800">${(item.montoPago || 0).toLocaleString('es-CL')}</td>
                            <td className="px-6 py-4 text-right">
                              {item.descuentoLab > 0 ? (
                                <div className="flex flex-col items-end">
                                   <span className={`font-black flex items-center gap-1 ${item.esReembolso ? 'text-amber-500' : 'text-red-400'}`}>
                                     <FlaskConical size={12}/> ${Math.round(item.descuentoLab).toLocaleString('es-CL')}
                                   </span>
                                   <span className="text-[8px] font-bold uppercase opacity-60">
                                     {item.esReembolso ? 'Por Reembolsar' : 'Deducido'}
                                   </span>
                                </div>
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-500">${Math.round(item.imponible).toLocaleString('es-CL')}</td>
                            <td className="px-6 py-4 text-right font-black text-amber-600 bg-amber-50/30 text-sm">
                              ${Math.round(item.honorario).toLocaleString('es-CL')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-50 border-t border-amber-200">
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-right font-black text-amber-800 uppercase text-xs">Total Pendiente:</td>
                          <td className="px-6 py-4 text-right font-black text-amber-600 text-base">
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
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><History size={24} /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Historial de Liquidaciones</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cierres completados y pagados en este mes</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {cierresCompletados.map((cierre) => (
                    <div key={cierre.id} className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-sm">
                      <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-emerald-50/50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle2 size={20} /></div>
                          <div>
                            <h3 className="font-black uppercase tracking-widest text-sm text-emerald-800">{cierre.titulo}</h3>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Cierre bloqueado e inmodificable</p>
                          </div>
                        </div>
                        <div className="px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase flex items-center gap-2 bg-emerald-100 text-emerald-700">
                          Pagado: ${(cierre.montoTotal || 0).toLocaleString('es-CL')}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[800px]">
                          <thead className="bg-slate-50/50 border-y border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Fecha</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Paciente</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Prestación</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Ingreso Bruto</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Costo Lab</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Base Imponible</th>
                              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Pagado al Dr.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {cierre.items.map((item: any, idx: number) => (
                              <tr key={idx} className="text-xs font-bold text-slate-500 hover:bg-slate-50/50 transition-colors opacity-90">
                                <td className="px-6 py-4">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                                <td className="px-6 py-4 uppercase">{item.paciente}</td>
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
                                <td className="px-6 py-4 text-right font-black text-slate-400">
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
    </div>
  )
}