'use client'
import { useParams } from 'next/navigation'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Printer, DollarSign, Loader2, CheckCircle2, History, AlertCircle, Eye, X, Wallet } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export default function MiDetalleLiquidacionPage() {
  const params = useParams()
  const mesSeleccionado = (params.id as string) || new Date().toISOString().substring(0, 7)

  const [profesional, setProfesional] = useState<any>(null)
  const [itemsPendientes, setItemsPendientes] = useState<any[]>([])
  const [cierresCompletados, setCierresCompletados] = useState<any[]>([])
  const [resumenMes, setResumenMes] = useState({ totalMes: 0, totalPagado: 0, saldoPendiente: 0 })
  const [cargando, setCargando] = useState(true)
  const [errorSesion, setErrorSesion] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [detalleItem, setDetalleItem] = useState<any>(null)
  
  // Estado para los Portals
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    fetchData()
  }, [mesSeleccionado])

  async function fetchData() {
    setCargando(true)
    try {
      // 0. Validar sesión y resolver el profesional dueño de la sesión
      const { data: { user }, error: errUser } = await supabase.auth.getUser()
      if (errUser || !user) {
        setErrorSesion('No se encontró una sesión activa. Por favor inicia sesión nuevamente.')
        return
      }

      const [year, month] = mesSeleccionado.split('-');
      const ultimoDiaNum = new Date(Number(year), Number(month), 0).getDate();
      const ultimoDia = String(ultimoDiaNum).padStart(2, '0');

      const inicioMes = `${year}-${month}-01 00:00:00`;
      const finMes = `${year}-${month}-${ultimoDia} 23:59:59`
      const fechaCortaInicio = `${year}-${month}-01`;
      const fechaCortaFin = `${year}-${month}-${ultimoDia}`;

      // 1. Obtener datos del profesional (siempre el dueño de la sesión)
      const { data: prof, error: errProf } = await supabase.from('profesionales').select('*').eq('user_id', user.id).single()
      if (errProf || !prof) {
        setErrorSesion('Tu usuario no tiene un perfil de profesional asociado.')
        return
      }

      const { data: perfil } = await supabase.from('perfiles').select('rut').eq('id', prof.user_id).single();
      setProfesional({ ...prof, rut: perfil?.rut || 'Sin registrar' });

      const porcentajeDr = Number(prof.porcentaje_comision || 40) / 100;

      // 2. Obtener Liquidaciones Cerradas del mes
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
        .select(`id, fecha, monto_cobrado, profesional_id, paciente_id, pacientes(id, nombre, apellido), prestaciones!atenciones_realizadas_prestacion_id_fkey(id, "Nombre Accion")`)
        .eq('profesional_id', prof.user_id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes);

      // 4. Obtener Pagos
      const { data: pagos, error: errPagos } = await supabase
        .from('pagos')
        .select(`
          id, monto, fecha_pago, profesional_id, paciente_id,
          pacientes ( id, nombre, apellido ),
          presupuesto_items ( id, presupuesto_id, profesional_id, nombre_prestacion, precio_pactado, costo_laboratorio, lab_pagado_por_dr, estado, tipo_reparto, progreso, abonado )
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
        tipo: 'Atención',
        paciente_id: a.paciente_id,
        presupuesto_id: null,
        tratamiento_id: a.id,
        estaEvolucionado: true,
        paymentStatus: 'paid',
        costoTotalPrestacion: Number(a.monto_cobrado),
        pagadoTotalPrestacion: Number(a.monto_cobrado)
      }));

      const abonosFormateados = pagosDelDoctor.map((pago: any) => {
        const montoPago = Number(pago.monto || 0);
        const costoLab = Number(pago.presupuesto_items?.costo_laboratorio || 0);
        const precioPactado = Number(pago.presupuesto_items?.precio_pactado || montoPago || 1);
        const pagadoPorDr = Boolean(pago.presupuesto_items?.lab_pagado_por_dr);

        // Regla de negocio: solo se paga comisión si el tratamiento está 100% terminado.
        const itemEstado = pago.presupuesto_items?.estado?.toLowerCase() || '';
        const estaTerminado = ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(itemEstado);

        const progreso = Number(pago.presupuesto_items?.progreso || 0);
        const totalAbonado = Number(pago.presupuesto_items?.abonado || 0);
        const estaEvolucionado = estaTerminado || progreso > 0 || totalAbonado > 0;

        let paymentStatus = 'unpaid';
        if (totalAbonado > 0 && totalAbonado < precioPactado) {
          paymentStatus = 'partially-paid';
        } else if (totalAbonado >= precioPactado) {
          paymentStatus = 'paid';
        }

        let fraccionPago = montoPago / precioPactado;
        if (fraccionPago > 1) fraccionPago = 1;

        const labAplicado = costoLab * fraccionPago;
        let montoImponible = montoPago; // Nunca se descuenta el laboratorio del imponible para la comisión.
        if (montoImponible < 0) montoImponible = 0;

        const tipoReparto = pago.presupuesto_items?.tipo_reparto || 'general';
        const pctDrItem = tipoReparto === 'doctor' ? 1 : (tipoReparto === 'clinica' ? 0 : porcentajeDr);

        // Si no está terminado, el honorario es cero para el doctor.
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
          tipo: 'Abono Plan',
          paciente_id: pago.paciente_id,
          presupuesto_id: pago.presupuesto_items?.presupuesto_id,
          tratamiento_id: pago.presupuesto_items?.id,
          estaEvolucionado,
          paymentStatus,
          costoTotalPrestacion: precioPactado,
          pagadoTotalPrestacion: totalAbonado
        }
      });

      const produccionCombinada = [...atencionesFormateadas, ...abonosFormateados]
        .sort((a, b) => {
          const tA = new Date(a.fecha?.replace(' ', 'T') || 0).getTime();
          const tB = new Date(b.fecha?.replace(' ', 'T') || 0).getTime();
          return tA - tB;
        });

      // 6. Asignación de producción a liquidaciones (soporta cortes y pagos parciales)
      let poolProduccion = produccionCombinada.map(p => ({
        ...p,
        honorario_restante: p.honorario
      }));

      const cierresList: any[] = [];

      liqsCerradas.forEach((liq, index) => {
        let montoARepartir = Number(liq.monto_total);
        let itemsDeEstaLiq = [];

        for (let i = 0; i < poolProduccion.length; i++) {
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

      // 7. Separar lo que quedó pendiente
      const pendientesFinal = poolProduccion
        .filter(p => p.honorario_restante > 0)
        .map(p => ({
          ...p,
          honorario: p.honorario_restante
        }));

      setItemsPendientes(pendientesFinal);

      // 8. Resumen del mes
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

      // 9. Obtener items en seguimiento (evolucionados o con abonos parciales)
      const { data: itemsEnSeguimientoData, error: itemsSeguimientoError } = await supabase
        .from('presupuesto_items')
        .select('*, presupuestos(paciente_id, pacientes(id, nombre, apellido))')
        .eq('profesional_id', user.id)
        .or('progreso.gt.0,abonado.gt.0');

      if (itemsSeguimientoError) {
        console.error("Error fetching tracking items:", itemsSeguimientoError);
        toast.error("Error al buscar tratamientos en seguimiento.");
      }

      const itemsDeSeguimiento = (itemsEnSeguimientoData || [])
        .map((item: any) => {
            const precioPactado = Number(item.precio_pactado || 0);
            const totalAbonado = Number(item.abonado || 0);

            // Ignorar si ya está pagado completo
            if (totalAbonado >= precioPactado) return null;
            
            // Ignorar si ya está en la lista de pendientes que generan comisión este mes
            if (pendientesFinal.some(p => p.tratamiento_id === item.id)) return null;

            const estaTerminado = ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(item.estado?.toLowerCase() || '');
            const progreso = Number(item.progreso || 0);
            // Un item se considera "evolucionado" para mostrar su estado si tiene progreso clínico O financiero.
            const estaEvolucionado = estaTerminado || progreso > 0 || totalAbonado > 0;

            let paymentStatus = 'unpaid';
            if (totalAbonado > 0) {
                paymentStatus = 'partially-paid';
            }

            const pacienteData = item.presupuestos?.pacientes;
            return {
              id_origen: item.id,
              fecha: item.updated_at,
              paciente: pacienteData ? `${pacienteData.nombre} ${pacienteData.apellido}` : 'Paciente',
              prestacion: item.nombre_prestacion || 'Prestación sin nombre',
              montoPago: totalAbonado,
              honorario: 0, // No genera honorario pendiente aún
              tipo: 'Seguimiento',
              paciente_id: item.presupuestos?.paciente_id,
              presupuesto_id: item.presupuesto_id,
              tratamiento_id: item.id,
              estaEvolucionado: estaEvolucionado,
              paymentStatus: paymentStatus,
              costoTotalPrestacion: precioPactado,
              pagadoTotalPrestacion: totalAbonado
            };
        })
        .filter(Boolean);

      setItemsPendientes([...pendientesFinal, ...itemsDeSeguimiento]);
      setCierresCompletados(cierresList.reverse());

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

  if (cargando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FBF8F2] gap-4 relative z-0">
        <Loader2 className="animate-spin text-[#C9A24B]" size={40} />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Calculando liquidación...</p>
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

      {/* ========================================================================= */}
      {/* VISTA WEB (OCULTA AL IMPRIMIR) */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-8 pb-20 print:hidden relative z-10 text-left">

        <Link href="/mi-menu/liquidacion" className="flex items-center gap-2 text-slate-500 hover:text-[#C9A24B] font-black text-[10px] uppercase tracking-widest transition-all w-fit bg-white/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200 hover:border-[#C9A24B]/30 shadow-sm">
          <ChevronLeft size={14} /> Volver a mis liquidaciones
        </Link>

        {/* TARJETAS DE RESUMEN SUPERIOR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/95 backdrop-blur-sm p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center text-left transition-all hover:shadow-md">
            <p className="text-[10px] font-black text-[#C9A24B] uppercase tracking-[0.2em] mb-2">Total Generado (Mes)</p>
            <p className="text-3xl md:text-4xl font-black text-[#0A111F]">${Math.round(resumenMes.totalMes).toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-white/95 backdrop-blur-sm p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center text-left transition-all hover:shadow-md">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2">Ya Pagado</p>
            <p className="text-3xl md:text-4xl font-black text-emerald-700">${Math.round(resumenMes.totalPagado).toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-[#0A111F] p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-center relative overflow-hidden transition-all hover:shadow-xl">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
              <DollarSign size={140} className="text-[#C9A24B]" />
            </div>
            <p className="text-[10px] font-black uppercase text-[#C9A24B] tracking-[0.2em] relative z-10">Saldo Pendiente a Pagar</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1 relative z-10">Producción nueva no liquidada</p>
            <p className={`text-4xl md:text-5xl font-black mt-4 flex items-center gap-2 relative z-10 ${resumenMes.saldoPendiente > 0 ? "text-white" : "text-slate-500"}`}>
              ${Math.round(resumenMes.saldoPendiente).toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100 text-left">

          {/* HEADER DEL REPORTE */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 pb-8 mb-8 text-left">
            <div className="text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#C9A24B]/10 rounded-xl flex items-center justify-center text-[#C9A24B] shrink-0">
                  <Wallet size={18} />
                </div>
                <p className="text-[10px] font-black text-[#C9A24B] uppercase tracking-[0.2em]">Desglose de Periodo</p>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-[#0A111F] uppercase italic leading-none tracking-tight text-left">
                Detalle de Producción
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-5 text-left">
                <div className="bg-[#0A111F] px-4 py-2.5 rounded-xl text-[10px] font-black text-[#C9A24B] uppercase tracking-widest shadow-sm">
                  Dr. {profesional?.nombre} {profesional?.apellido}
                </div>
                <div className="px-4 py-2.5 border border-[#C9A24B]/30 bg-[#C9A24B]/5 text-[#0A111F] rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                  Contrato Vigente: {profesional?.porcentaje_comision || 40}%
                </div>
                <div className="px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                  Periodo: {mesSeleccionado}
                </div>
              </div>
            </div>
            <button onClick={handlePrint} className="w-full md:w-auto bg-[#0A111F] text-[#C9A24B] px-6 py-4 rounded-2xl hover:bg-[#1a2538] hover:text-white transition-all shadow-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95">
              <Printer size={16} /> Imprimir Reporte
            </button>
          </div>

          <div className="space-y-12">

            {/* ========================================================= */}
            {/* SECCIÓN 1: PRODUCCIÓN PENDIENTE */}
            {/* ========================================================= */}
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 flex items-center justify-center bg-[#C9A24B]/10 text-[#C9A24B] rounded-[1.2rem] shrink-0"><AlertCircle size={20} /></div>
                <div>
                  <h2 className="text-xl font-black text-[#0A111F] uppercase tracking-tight">Pendiente de Pago</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tratamientos realizados y abonados aún no liquidados</p>
                </div>
              </div>

              {itemsPendientes.length === 0 ? (
                <div className="p-12 border border-dashed border-slate-300 rounded-[2.5rem] text-center bg-slate-50/50 flex flex-col items-center">
                  <CheckCircle2 size={40} className="text-emerald-500 mb-4 opacity-80" />
                  <p className="text-xs font-black text-[#0A111F] uppercase tracking-widest">No hay producción pendiente</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wide">Todo está liquidado y al día.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm text-left">
                  <div className="overflow-x-auto text-left">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase text-center tracking-widest w-32">Estado</th>
                          <th className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                          <th className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Paciente</th>
                          <th className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest max-w-[200px]">Prestación</th>
                          <th className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase text-right tracking-widest">Total Prest.</th>
                          <th className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase text-right tracking-widest">Total Pagado</th>
                          <th className="px-5 py-4 text-[10px] font-black text-[#0A111F] uppercase text-right tracking-widest bg-[#C9A24B]/10 w-32">A Pagar</th>
                          <th className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase text-center tracking-widest w-20">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {itemsPendientes.map((item: any, idx: number) => (
                          <tr key={idx} className="text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-4">
                              {item.estaEvolucionado && (
                                <div className="flex items-center justify-center gap-2">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                                    item.paymentStatus === 'paid' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                    item.paymentStatus === 'partially-paid' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                    'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                  }`}></div>
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                                    item.paymentStatus === 'paid' ? 'text-emerald-600' :
                                    item.paymentStatus === 'partially-paid' ? 'text-amber-600' :
                                    'text-red-600'
                                  }`}>
                                    { item.paymentStatus === 'paid' ? 'Pagado' : item.paymentStatus === 'partially-paid' ? 'Parcial' : 'Deuda' }
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 text-slate-400">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                            <td className="px-5 py-4 uppercase text-[#0A111F]">{item.paciente}</td>
                            <td className="px-5 py-4 uppercase text-slate-500 max-w-[200px] truncate" title={item.prestacion}>{item.prestacion}</td>
                            <td className="px-5 py-4 text-right text-slate-800">${(item.costoTotalPrestacion || 0).toLocaleString('es-CL')}</td>
                            <td className="px-5 py-4 text-right text-slate-500">${(item.pagadoTotalPrestacion || 0).toLocaleString('es-CL')}</td>
                            <td className="px-5 py-4 text-right font-black text-[#0A111F] bg-[#C9A24B]/5 text-[13px]">
                              ${Math.round(item.honorario).toLocaleString('es-CL')}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button onClick={() => setDetalleItem(item)} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-[#0A111F] hover:text-[#C9A24B] hover:border-[#0A111F] transition-all shadow-sm">
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#0A111F] border-t-2 border-[#C9A24B]">
                        <tr>
                          <td colSpan={6} className="px-5 py-4 text-right font-black text-slate-300 uppercase text-[10px] tracking-widest">Total Pendiente:</td>
                          <td className="px-5 py-4 text-right font-black text-[#C9A24B] text-base">
                            ${Math.round(resumenMes.saldoPendiente).toLocaleString('es-CL')}
                          </td>
                          <td></td>
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
              <div className="pt-10 border-t border-slate-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-[1.2rem] border border-emerald-100 shrink-0"><History size={20} /></div>
                  <div>
                    <h2 className="text-xl font-black text-[#0A111F] uppercase tracking-tight">Historial de Liquidaciones</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cierres completados y pagados en este mes</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {cierresCompletados.map((cierre) => (
                    <div key={cierre.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm text-left">
                      <div className="p-6 md:p-8 flex flex-col sm:flex-row justify-between sm:items-center gap-5 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 shadow-sm"><CheckCircle2 size={20} /></div>
                          <div>
                            <h3 className="font-black uppercase tracking-tight text-sm md:text-base text-[#0A111F]">{cierre.titulo}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cierre bloqueado e inmodificable</p>
                          </div>
                        </div>
                        <div className="px-5 py-3.5 rounded-xl text-[11px] font-black tracking-widest uppercase flex items-center gap-2 bg-[#0A111F] text-emerald-400 shadow-md">
                          Pagado: ${(cierre.montoTotal || 0).toLocaleString('es-CL')}
                        </div>
                      </div>

                      <div className="overflow-x-auto text-left">
                        <table className="w-full text-left min-w-[800px]">
                          <thead className="bg-white border-b border-slate-100">
                            <tr>
                              <th className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase text-center tracking-widest w-32">Estado</th>
                              <th className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                              <th className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                              <th className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Prestación</th>
                              <th className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase text-right tracking-widest">Total Prest.</th>
                              <th className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase text-right tracking-widest">Total Pagado</th>
                              <th className="px-5 py-4 text-[10px] font-black text-[#0A111F] uppercase text-right tracking-widest bg-emerald-50">Honorario Pagado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {cierre.items.map((item: any, idx: number) => (
                              <tr key={idx} className="text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors opacity-90">
                                <td className="px-5 py-4">
                                  {item.estaEvolucionado && (
                                    <div className="flex items-center justify-center gap-2">
                                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                                        item.paymentStatus === 'paid' ? 'bg-emerald-500' :
                                        item.paymentStatus === 'partially-paid' ? 'bg-amber-500' :
                                        'bg-red-500'
                                      }`}></div>
                                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                                        item.paymentStatus === 'paid' ? 'text-emerald-600' :
                                        item.paymentStatus === 'partially-paid' ? 'text-amber-600' :
                                        'text-red-600'
                                      }`}>
                                        { item.paymentStatus === 'paid' ? 'Pagado' : item.paymentStatus === 'partially-paid' ? 'Parcial' : 'Deuda' }
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-slate-400">{item.fecha ? new Date(item.fecha.replace(' ', 'T')).toLocaleDateString('es-CL') : 'S/F'}</td>
                                <td className="px-5 py-4 uppercase text-slate-700">{item.paciente}</td>
                                <td className="px-5 py-4 uppercase max-w-[200px] truncate" title={item.prestacion}>{item.prestacion}</td>
                                <td className="px-5 py-4 text-right">${(item.costoTotalPrestacion || 0).toLocaleString('es-CL')}</td>
                                <td className="px-5 py-4 text-right">${(item.pagadoTotalPrestacion || 0).toLocaleString('es-CL')}</td>
                                <td className="px-5 py-4 text-right font-black text-[#0A111F] bg-emerald-50/50">
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
      <div className="hidden print:block bg-white text-black p-4 font-sans text-[11px] leading-tight max-w-[800px] mx-auto text-left">

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

      {/* ========================================================================= */}
      {/* MODAL DETALLE ITEM MEDIANTE CREATEPORTAL */}
      {/* ========================================================================= */}
      {isMounted && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {detalleItem && (
            <div className="fixed inset-0 bg-[#0A111F]/70 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 text-left" onClick={() => setDetalleItem(null)}>
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                className="bg-white rounded-[2rem] p-8 md:p-10 w-full max-w-md shadow-2xl text-left border border-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-8 text-left">
                  <div>
                    <h3 className="text-xl font-black text-[#0A111F] uppercase italic tracking-tight">Detalle del Movimiento</h3>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">{detalleItem.paciente}</p>
                  </div>
                  <button onClick={() => setDetalleItem(null)} className="p-2 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4 text-left">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Prestación</p>
                    <p className="text-[13px] font-bold text-[#0A111F]">{detalleItem.prestacion}</p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Costo Prestación</p>
                    <p className="text-[13px] font-bold text-[#0A111F]">${(detalleItem.costoTotalPrestacion || 0).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pagado Prestación</p>
                    <p className="text-[13px] font-bold text-[#0A111F]">${(detalleItem.pagadoTotalPrestacion || 0).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Saldo por Pagar a la Clínica</p>
                    <p className="text-[13px] font-bold text-red-700">${((detalleItem.costoTotalPrestacion || 0) - (detalleItem.pagadoTotalPrestacion || 0)).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ID de Tratamiento/Atención</p>
                    <p className="text-[13px] font-bold text-slate-500">{detalleItem.tratamiento_id}</p>
                  </div>
                  {detalleItem.presupuesto_id && detalleItem.paciente_id && (
                    <Link href={`/pacientes/${detalleItem.paciente_id}/tratamientos/${detalleItem.presupuesto_id}`} className="flex w-full justify-center items-center gap-2 bg-[#0A111F] text-[#C9A24B] py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-[#1a2538] transition-all mt-8 active:scale-95">
                      Ir al Plan de Tratamiento
                    </Link>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      ) : null}
    </div>
  )
}