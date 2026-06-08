'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Calculator, Search, Eye, CheckCircle2, 
  Loader2, Calendar as CalendarIcon, DollarSign,
  TrendingUp, Users, ArrowUpRight, Edit3, X, Save, Wallet, Check
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export default function LiquidacionesPage() {
  const [liquidaciones, setLiquidaciones] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().toISOString().substring(0, 7))
  
  const [modalContrato, setModalContrato] = useState<{abierto: boolean, prof: any, porcentaje: number}>({abierto: false, prof: null, porcentaje: 40})
  const [guardandoContrato, setGuardandoContrato] = useState(false)
  const [procesandoPago, setProcesandoPago] = useState<string | null>(null) 

  useEffect(() => {
    fetchData()
  }, [mesSeleccionado])

  async function fetchData() {
    setCargando(true)
    try {
      const [year, month] = mesSeleccionado.split('-');
      const ultimoDia = new Date(Number(year), Number(month), 0).getDate();
      
      // 🔥 FILTRO ESTRICTO NATIVO DE BASE DE DATOS PARA EVITAR QUE SE SUME EL HISTÓRICO 🔥
      const inicioRango = `${year}-${month}-01 00:00:00`;
      const finRango = `${year}-${month}-${ultimoDia} 23:59:59`;
      const fechaCortaInicio = `${year}-${month}-01`;
      const fechaCortaFin = `${year}-${month}-${ultimoDia}`;

      // 1. Obtener profesionales
      const { data: profs, error: errProfs } = await supabase
        .from('profesionales')
        .select('id, nombre, apellido, user_id, porcentaje_comision')
        .eq('activo', true)

      if (errProfs) throw errProfs;
      if (!profs) return

      // 2. Obtener atenciones realizadas estrictamente en el mes seleccionado
      const { data: atenciones } = await supabase
        .from('atenciones_realizadas')
        .select('monto_cobrado, profesional_id')
        .gte('fecha', inicioRango)
        .lte('fecha', finRango)

      // 3. Obtener pagos/abonos cobrados estrictamente en el mes seleccionado
      const { data: abonosData } = await supabase
        .from('pagos')
        .select(`
          id, monto, fecha_pago, profesional_id, item_id,
          presupuesto_items ( profesional_id, precio_pactado, costo_laboratorio, lab_pagado_por_dr, estado )
        `)
        .gte('fecha_pago', inicioRango)
        .lte('fecha_pago', finRango)
        .not('estado', 'eq', 'Anulado');

      // 4. Obtener liquidaciones cerradas en este rango de mes (Para saber cuánto ya le hemos pagado este mes)
      const { data: liquidacionesCerradas } = await supabase
        .from('liquidaciones')
        .select('profesional_id, monto_total')
        .gte('periodo_desde', fechaCortaInicio)
        .lte('periodo_hasta', fechaCortaFin)
        .eq('estado', 'Finalizada')

      const abonosItems = abonosData || [];
      const cerradas = liquidacionesCerradas || [];

      // AGRUPAMOS LO YA PAGADO EN ESTE MES POR PROFESIONAL
      const historialPagosMap: Record<string, number> = {};
      cerradas.forEach(liq => {
        if (liq.profesional_id) {
          historialPagosMap[liq.profesional_id] = (historialPagosMap[liq.profesional_id] || 0) + Number(liq.monto_total || 0);
        }
      });

      const informeReal = profs.map(p => {
        const porcentajeDrNum = Number(p.porcentaje_comision || 40);
        const porcentajeDr = porcentajeDrNum / 100;
        const porcentajeClinica = 1 - porcentajeDr;
        
        const atencionesDelDoc = atenciones?.filter(a => a.profesional_id === p.user_id) || [];
        const sumaAtenciones = atencionesDelDoc.reduce((acc, curr) => acc + Number(curr.monto_cobrado || 0), 0)
        
        const honorarioAtenciones = sumaAtenciones * porcentajeDr;
        const utilidadAtenciones = sumaAtenciones * porcentajeClinica;

        const pagosDelDoctor = (pagos || []).filter((pago: any) => {
         const docId = pago.profesional_id || pago.presupuesto_items?.profesional_id || null;
            return docId === p.user_id;
        });
        
        let sumaAbonos = 0;
        let honorariosAbonos = 0;
        let reembolsosDoctor = 0;
        let utilidadAbonos = 0;

        abonosDelDoc.forEach(pago => {
            const montoPago = Number(pago.monto || 0);
            sumaAbonos += montoPago;

            // 🔥 REGLA DE NEGOCIO: Solo se paga comisión si el tratamiento está 100% terminado.
            const itemEstado = pago.presupuesto_items?.estado?.toLowerCase() || '';
            const estaTerminado = ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(itemEstado);

            const costoLab = Number(pago.presupuesto_items?.costo_laboratorio || 0);
            const precioPactado = Number(pago.presupuesto_items?.precio_pactado || montoPago || 1);
            const pagadoPorDr = Boolean(pago.presupuesto_items?.lab_pagado_por_dr);

            let fraccionPago = montoPago / precioPactado;
            if (fraccionPago > 1) fraccionPago = 1;

            const labADescontar = costoLab * fraccionPago;
            let montoImponible = montoPago - labADescontar;
            if (montoImponible < 0) montoImponible = 0;

            if (estaTerminado) {
              const comision = montoImponible * porcentajeDr;
              const reembolso = pagadoPorDr ? labADescontar : 0; 
              honorariosAbonos += comision;
              reembolsosDoctor += reembolso;
              utilidadAbonos += (montoImponible * porcentajeClinica);
            } else {
              utilidadAbonos += montoImponible;
            }
        });

        const totalProduccion = sumaAtenciones + sumaAbonos;
        
        // Total de dinero líquido generado este mes
        const totalLiquidoMensual = honorarioAtenciones + honorariosAbonos + reembolsosDoctor;
        const margenClinica = utilidadAtenciones + utilidadAbonos;

        // RESTAMOS LO YA PAGADO EN ESTE MES PARA MOSTRAR SOLO EL PENDIENTE
        const totalYaPagadoHistorico = historialPagosMap[p.id] || 0;
        const saldoPendienteDoctor = Math.max(0, totalLiquidoMensual - totalYaPagadoHistorico);

        // Si ya tiene un pago previo guardado y el saldo pendiente es 0, está completamente cerrado
        const completamentePagado = totalYaPagadoHistorico > 0 && saldoPendienteDoctor <= 0;

        return {
          id: p.id, 
          user_id: p.user_id, 
          nombreCompleto: `${p.nombre} ${p.apellido}`,
          porcentaje_comision: porcentajeDrNum,
          atenciones: sumaAtenciones,
          abonos: sumaAbonos,
          total: totalProduccion,
          honorarios: saldoPendienteDoctor, 
          utilidad: margenClinica,
          yaPagado: completamentePagado,
          totalYaPagado: totalYaPagadoHistorico
        }
      })

      informeReal.sort((a, b) => b.total - a.total);
      setLiquidaciones(informeReal)
    } catch (error) {
      toast.error("Error al calcular liquidaciones.")
    } finally {
      setCargando(false)
    }
  }

  const handleGuardarContrato = async () => {
    setGuardandoContrato(true);
    try {
      const { error } = await supabase
        .from('profesionales')
        .update({ porcentaje_comision: modalContrato.porcentaje })
        .eq('id', modalContrato.prof.id);
        
      if (error) throw error;
      toast.success("Contrato actualizado exitosamente");
      setModalContrato({abierto: false, prof: null, porcentaje: 40});
      fetchData(); 
    } catch (error) {
      toast.error("Error al actualizar el contrato");
    } finally {
      setGuardandoContrato(false);
    }
  }

  const handleFinalizarLiquidacion = async (liq: any) => {
    const confirmar = window.confirm(`¿Estás seguro de registrar el pago de $${Math.round(liq.honorarios).toLocaleString('es-CL')} para ${liq.nombreCompleto}? Este proceso generará el cierre de este monto pendiente.`);
    
    if (!confirmar) return;

    setProcesandoPago(liq.id);
    try {
      const [year, month] = mesSeleccionado.split('-');
      const ultimoDia = new Date(Number(year), Number(month), 0).getDate();
      
      const { data: authData } = await supabase.auth.getSession();
      const creadorId = authData.session?.user?.id;

      const { error } = await supabase
        .from('liquidaciones')
        .insert({
          profesional_id: liq.id, 
          monto_total: Math.round(liq.honorarios), 
          periodo_desde: `${year}-${month}-01`,
          periodo_hasta: `${year}-${month}-${ultimoDia}`,
          estado: 'Finalizada',
          creado_por: creadorId || null
        });

      if (error) throw error;
      toast.success(`Pago complementario registrado exitosamente.`);
      fetchData(); 
    } catch (error: any) {
      toast.error(`Error al registrar el pago: ${error.message}`);
    } finally {
      setProcesandoPago(null);
    }
  }

  const globalTotal = liquidaciones.reduce((acc, curr) => acc + curr.total, 0)
  const globalHonorarios = liquidaciones.reduce((acc, curr) => acc + curr.honorarios, 0)
  const globalUtilidad = globalTotal - (liquidaciones.reduce((acc, curr) => acc + (curr.totalYaPagado + curr.honorarios), 0))

  const filtradas = liquidaciones.filter(l => 
    l.nombreCompleto.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-24 font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-10 text-left">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 text-left">
          <div className="flex items-center gap-6 text-left">
            <div className="bg-slate-900 p-5 rounded-[2.2rem] text-white shadow-2xl">
              <Calculator size={30} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Cierre de Caja</h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 mt-2">
                <TrendingUp size={12} className="text-emerald-500"/> Rendimiento por especialista
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 text-left">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-left">
              <CalendarIcon size={16} className="text-blue-600"/>
              <input 
                type="month" 
                value={mesSeleccionado} 
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="bg-transparent font-black text-xs uppercase outline-none text-slate-700 cursor-pointer"
              />
            </div>
            <div className="relative group text-left">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Buscar Dr..." 
                className="pl-11 pr-6 py-3 bg-slate-50 rounded-xl text-xs font-bold border border-transparent focus:border-blue-500 outline-none transition-all w-64 text-slate-900"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <StatCard label="Producción Total" value={globalTotal} icon={<DollarSign size={20}/>} color="blue" />
          <StatCard label="Pendiente de Pago" value={globalHonorarios} icon={<Users size={20}/>} color="emerald" />
          <StatCard label="Margen Clínica Neta" value={globalTotal - liquidaciones.reduce((acc,curr) => acc + curr.totalYaPagado, 0)} icon={<ArrowUpRight size={20}/>} color="slate" isDark />
        </div>

        <div className="bg-white rounded-[3.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden text-left">
          <div className="overflow-x-auto text-left">
            <table className="w-full text-left border-separate border-spacing-0 min-w-[800px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Especialista Responsable</th>
                  <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Contrato (%)</th>
                  <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap">Producción</th>
                  <th className="px-6 py-8 text-[10px] font-black uppercase tracking-widest text-center text-emerald-400 whitespace-nowrap">Líquido a Pagar</th>
                  <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-left">
                {cargando ? (
                  <tr>
                    <td colSpan={5} className="py-32 text-center">
                      <Loader2 className="animate-spin mx-auto text-blue-600 mb-4" size={40} />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Calculando balances y contratos...</p>
                    </td>
                  </tr>
                ) : filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-32 text-center">
                      <CheckCircle2 className="mx-auto text-slate-300 mb-4" size={40} />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">No hay producción en este mes</p>
                    </td>
                  </tr>
                ) : filtradas.map((liq) => (
                  <tr key={liq.id} className={`transition-all group text-left ${liq.yaPagado ? 'bg-slate-50/60 opacity-70' : 'hover:bg-blue-50/40'}`}>
                    <td className="px-10 py-7 text-left">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm shrink-0">
                          {liq.nombreCompleto.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-800 uppercase italic leading-none text-left">{liq.nombreCompleto}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 tracking-widest text-left">ID: {liq.user_id.substring(0,8)}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-7 text-center">
                      <button 
                        onClick={() => setModalContrato({abierto: true, prof: liq, porcentaje: liq.porcentaje_comision})} 
                        className="flex items-center justify-center gap-2 mx-auto bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all text-[11px] font-black text-slate-600"
                        title="Modificar porcentaje del doctor"
                      >
                        {liq.porcentaje_comision}% <Edit3 size={14}/>
                      </button>
                    </td>

                    <td className="px-6 py-7 text-center">
                      <span className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black text-slate-800 shadow-sm border border-slate-200">
                        ${(liq.total || 0).toLocaleString('es-CL')}
                      </span>
                    </td>
                    
                    <td className="px-6 py-7 text-center">
                      <div className="flex flex-col items-center gap-1.5 justify-center">
                        <span className={`text-sm font-black px-4 py-2 rounded-xl border ${
                          liq.honorarios > 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-slate-400 bg-slate-50 border-slate-200'
                        }`}>
                          ${Math.round(liq.honorarios).toLocaleString('es-CL')}
                        </span>
                        {liq.totalYaPagado > 0 && (
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/50">
                            Ya Pagado: ${liq.totalYaPagado.toLocaleString('es-CL')}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-10 py-7 text-right">
                      <div className="flex items-center justify-end gap-3 text-right">
                        <Link 
                          href={`/administracion/liquidaciones/${liq.user_id}?mes=${mesSeleccionado}`}
                          className="inline-flex items-center justify-center w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200"
                          title="Ver Detalle"
                        >
                          <Eye size={18} />
                        </Link>

                        {liq.yaPagado ? (
                          <div className="inline-flex items-center justify-center px-4 h-12 bg-slate-100 text-slate-400 rounded-2xl shadow-sm border border-slate-200 font-black text-[10px] uppercase tracking-widest gap-2 cursor-default">
                            <Check size={16} className="text-emerald-500" />
                            Al día
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleFinalizarLiquidacion(liq)}
                            disabled={procesandoPago === liq.id || liq.honorarios <= 0}
                            className="inline-flex items-center justify-center px-4 h-12 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-sm border border-transparent font-black text-[10px] uppercase tracking-widest gap-2"
                            title="Finalizar y Registrar Pago Complementario"
                          >
                            {procesandoPago === liq.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                <Wallet size={16} />
                                {liq.totalYaPagado > 0 ? 'Pagar Saldo' : 'Pagar'}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL EDITAR CONTRATO */}
      <AnimatePresence>
        {modalContrato.abierto && (
          <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden text-left">
               <div className="p-8 bg-slate-900 text-white flex justify-between items-center text-left">
                 <h3 className="text-xl font-black uppercase italic tracking-tighter text-left">Editar Contrato</h3>
                 <button onClick={() => setModalContrato({abierto: false, prof: null, porcentaje: 40})} className="hover:text-red-400 transition-colors text-left"><X size={20}/></button>
               </div>
               <div className="p-8 space-y-6 text-left">
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Profesional</p>
                    <p className="text-sm font-black text-slate-800 uppercase italic leading-none mt-1 text-left">{modalContrato.prof?.nombreCompleto}</p>
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black uppercase text-blue-600 ml-1 text-left">Porcentaje de Ganancia (%)</label>
                    <input 
                       type="number" 
                       autoFocus 
                       min={0} max={100}
                       className="w-full p-5 rounded-2xl bg-blue-50/50 font-black text-xl text-blue-600 border border-blue-100 outline-none focus:border-blue-500 transition-all text-center" 
                       value={modalContrato.porcentaje} 
                       onChange={(e) => setModalContrato({...modalContrato, porcentaje: Number(e.target.value)})} 
                    />
                    <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest mt-2">La clínica ganará automáticamente el {100 - modalContrato.porcentaje}%</p>
                  </div>
                  <button onClick={handleGuardarContrato} disabled={guardandoContrato} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-left">
                    {guardandoContrato ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                    Actualizar Contrato
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, icon, color, isDark }: any) {
  return (
    <div className={`p-8 md:p-10 rounded-[3rem] border transition-all hover:scale-[1.02] duration-300 text-left ${
      isDark ? 'bg-slate-900 border-slate-800 text-white shadow-2xl' : 'bg-white border-slate-100 text-slate-900 shadow-sm'
    }`}>
      <div className="flex justify-between items-start mb-6 text-left">
        <div className={`p-4 rounded-2xl ${isDark ? 'bg-slate-800 text-blue-400' : `bg-${color}-50 text-${color}-600`}`}>
          {icon}
        </div>
        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>Mes Actual</span>
      </div>
      <p className={`text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 text-left`}>{label}</p>
      <p className="text-3xl lg:text-4xl font-black italic tracking-tighter truncate text-left">${(value || 0).toLocaleString('es-CL')}</p>
    </div>
  )
}
