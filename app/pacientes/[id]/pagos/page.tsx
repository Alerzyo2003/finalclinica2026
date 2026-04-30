'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Loader2, Coins, ReceiptText, CheckCircle2, 
  CreditCard, Banknote, Landmark, History, 
  ChevronDown, Printer, Trash2, FileText, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export default function PagosPacientePage() {
  const { id: paciente_id } = useParams()
  
  const [cargando, setCargando] = useState(true)
  const [cargandoAccion, setCargandoAccion] = useState(false)
  
  const [pacienteInfo, setPacienteInfo] = useState<any>(null)
  const [deudas, setDeudas] = useState<any[]>([])
  const [historialPagos, setHistorialPagos] = useState<any[]>([])
  
  // Estados para el pago
  const [montoIngresado, setMontoIngresado] = useState<number | ''>('')
  const [metodoPago, setMetodoPago] = useState('Transferencia')
  const [numeroOperacion, setNumeroOperacion] = useState('')
  
  // Estado para impresión
  const [pagoAImprimir, setPagoAImprimir] = useState<any>(null)

  useEffect(() => {
    if (paciente_id) {
      cargarDatosFinancieros()
    }
  }, [paciente_id])

  async function cargarDatosFinancieros() {
    setCargando(true)
    try {
      // 0. OBTENER INFO DEL PACIENTE
      const { data: pacData } = await supabase.from('pacientes').select('*').eq('id', paciente_id).single()
      setPacienteInfo(pacData)

      // 1. OBTENER DEUDAS Y DOCTORES ASOCIADOS
      const { data: presupuestosPaciente } = await supabase
        .from('presupuestos')
        .select('id')
        .eq('paciente_id', paciente_id)
        .eq('aprobado', true)

      const idsPresupuestos = presupuestosPaciente?.map(p => p.id) || [];
      let itemsConDeuda = [];

      if (idsPresupuestos.length > 0) {
        // Hacemos un Join para traer el nombre de la prestación y del doctor
        const { data: itemsData } = await supabase
            .from('presupuesto_items')
            .select(`
                id, 
                observacion, 
                precio_pactado, 
                abonado, 
                estado, 
                diente_id,
                prestaciones:prestacion_id("Nombre Accion", "Nombre"),
                profesional:profesional_id(nombre, apellido)
            `)
            .in('presupuesto_id', idsPresupuestos)
            .not('estado', 'eq', 'cancelada');

        itemsConDeuda = (itemsData || []).map(item => {
            const precio = Number(item.precio_pactado || 0);
            const abonado = Number(item.abonado || 0);
            const deuda = precio - abonado;
            
            let nombreDisplay = item.observacion || "Tratamiento";
            if (item.prestaciones) {
                nombreDisplay = item.prestaciones["Nombre Accion"] || item.prestaciones["Nombre"] || nombreDisplay;
            } else if (item.observacion && item.observacion.includes('|')) {
                nombreDisplay = item.observacion.split('|')[0].trim();
            }

            const doctor = item.profesional ? `Dr/a. ${item.profesional.nombre} ${item.profesional.apellido}` : 'Sin asignar';

            return { ...item, deuda, nombreDisplay, doctor };
        }).filter(item => item.deuda > 0).sort((a, b) => {
            if (a.estado === 'realizado' && b.estado !== 'realizado') return -1;
            if (a.estado !== 'realizado' && b.estado === 'realizado') return 1;
            return 0;
        });
      }
      setDeudas(itemsConDeuda);

      // 2. OBTENER HISTORIAL DE PAGOS
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('*')
        .eq('paciente_id', paciente_id)
        .order('fecha_pago', { ascending: false })
      
      setHistorialPagos(pagosData || []);

    } catch (error) {
      console.error(error)
      toast.error("Error al cargar la información financiera")
    } finally {
      setCargando(false)
    }
  }

  // ===============================================
  // PROCESAR PAGO CON DISTRIBUCIÓN DETALLADA
  // ===============================================
  const procesarPagoCaja = async () => {
    if (!montoIngresado || Number(montoIngresado) <= 0) {
        return toast.error("Ingrese un monto válido a recaudar");
    }

    if ((metodoPago === 'Transferencia' || metodoPago === 'Tarjeta') && !numeroOperacion.trim()) {
        return toast.error(`Debe ingresar el ${metodoPago === 'Transferencia' ? 'Código de Transferencia' : 'N° de Voucher'} obligatoriamente.`);
    }

    setCargandoAccion(true);
    let montoRestante = Number(montoIngresado);
    let detallesDelPago = []; // Aquí guardaremos qué se pagó exactamente
    
    try {
        // Repartir el pago y anotar los detalles
        for (const item of deudas) {
            if (montoRestante <= 0) break;
            const aAbonar = Math.min(item.deuda, montoRestante);
            
            // Anotamos el detalle para el comprobante
            detallesDelPago.push({
                prestacion: item.nombreDisplay,
                diente: item.diente_id,
                precio: item.precio_pactado,
                doctor: item.doctor,
                abonado_ahora: aAbonar
            });

            await supabase.from('presupuesto_items').update({ abonado: Number(item.abonado) + aAbonar }).eq('id', item.id);
            montoRestante -= aAbonar;
        }

        // Si sobró dinero, lo agregamos como Saldo a Favor al detalle y a la BD
        if (montoRestante > 0) {
            detallesDelPago.push({
                prestacion: "Saldo a Favor (Abono extra)",
                diente: null,
                precio: montoRestante,
                doctor: "-",
                abonado_ahora: montoRestante
            });

            const saldoActual = Number(pacienteInfo?.saldo_a_favor || 0);
            await supabase.from('pacientes').update({ saldo_a_favor: saldoActual + montoRestante }).eq('id', paciente_id);
            toast.info(`Quedó un saldo a favor de $${montoRestante.toLocaleString('es-CL')}`);
        } else {
            toast.success(`Pago procesado con éxito.`);
        }

        // Insertar en la BD y GUARDAR EL JSON EN LA COLUMNA COMENTARIO
        const { data: nuevoPago, error: errPago } = await supabase.from('pagos').insert([{
            paciente_id: paciente_id,
            monto: Number(montoIngresado),
            metodo_pago: metodoPago,
            numero_boleta: numeroOperacion.trim() || 'S/N', 
            fecha_pago: new Date().toISOString(),
            comentario: JSON.stringify(detallesDelPago) // Magia: Se guarda el detalle en la BD actual
        }]).select().single();
        
        if (errPago) throw errPago;

        setMontoIngresado('');
        setNumeroOperacion('');
        
        await cargarDatosFinancieros();
        
        if(confirm("¿Desea imprimir el comprobante de pago ahora?")) {
            imprimirComprobante(nuevoPago);
        }

    } catch (e) {
        toast.error("Ocurrió un error al procesar el pago");
    } finally {
        setCargandoAccion(false);
    }
  }

  // ===============================================
  // REVERSAR PAGO
  // ===============================================
  const reversarPago = async (pago: any) => {
    const confirmacion = window.confirm(
      "⚠️ ATENCIÓN LEGAL (SII)\n\n" +
      "La anulación de este pago interno NO anula automáticamente la Boleta en el SII. " +
      "Esta acción restaurará la deuda del paciente en el sistema.\n\n" +
      "¿Desea anular este pago?"
    );

    if (!confirmacion) return;

    setCargandoAccion(true);
    try {
      let montoADevolver = Number(pago.monto);

      const { data: itemsPagados } = await supabase
          .from('presupuesto_items')
          .select('id, abonado')
          .eq('paciente_id', paciente_id)
          .gt('abonado', 0)
          .order('id', { ascending: false });

      for (const item of (itemsPagados || [])) {
          if (montoADevolver <= 0) break;
          const aRestar = Math.min(Number(item.abonado), montoADevolver);
          await supabase.from('presupuesto_items')
              .update({ abonado: Number(item.abonado) - aRestar })
              .eq('id', item.id);
          montoADevolver -= aRestar;
      }

      if (montoADevolver > 0) {
          const saldoActual = Number(pacienteInfo?.saldo_a_favor || 0);
          const nuevoSaldo = Math.max(0, saldoActual - montoADevolver);
          await supabase.from('pacientes').update({ saldo_a_favor: nuevoSaldo }).eq('id', paciente_id);
      }

      await supabase.from('pagos').delete().eq('id', pago.id);

      toast.success("Pago anulado exitosamente. Deuda restaurada.");
      cargarDatosFinancieros();
    } catch (e) {
      toast.error("Error al reversar el pago");
    } finally {
      setCargandoAccion(false);
    }
  }

  // ===============================================
  // IMPRESIÓN DEL COMPROBANTE (DENTALINK STYLE)
  // ===============================================
  const imprimirComprobante = (pago: any) => {
    setPagoAImprimir(pago);
    
    setTimeout(() => {
        const elementoOriginal = document.getElementById('comprobante-impresion');
        if (!elementoOriginal) return toast.error("Error al preparar el documento");

        const clon = elementoOriginal.cloneNode(true) as HTMLElement;
        clon.classList.remove('hidden'); 
        const contenido = clon.innerHTML;

        const ventanaPoderosa = window.open('', '_blank', 'width=1000,height=900');
        if (!ventanaPoderosa) return toast.error("Por favor permite los pop-ups en tu navegador");

        ventanaPoderosa.document.write(`
          <html>
            <head>
              <title>Comprobante de Pago - ${pacienteInfo?.nombre} ${pacienteInfo?.apellido}</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                @page { margin: 1cm; size: letter; }
                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: white; color: black; }
                .content-wrapper { padding: 1.5cm 2cm; box-sizing: border-box; width: 100%; max-width: 21cm; margin: 0 auto; }
                * { word-wrap: break-word !important; }
              </style>
            </head>
            <body>
              <div class="content-wrapper">
                ${contenido}
              </div>
              <script>
                window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 800); };
              </script>
            </body>
          </html>
        `);
        ventanaPoderosa.document.close();
    }, 100);
  }

  // Desencriptar los detalles visuales
  const getDetalles = (comentario: string) => {
    try { return JSON.parse(comentario || '[]'); } 
    catch(e) { return []; }
  }

  const formatearFechaLarga = (fechaIso: string) => {
    if (!fechaIso) return 'N/A';
    const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return new Date(fechaIso).toLocaleDateString('es-CL', opciones);
  }

  const calcularDeudaTotal = () => deudas.reduce((acc, curr) => acc + curr.deuda, 0);

  if (cargando) return (
    <div className="h-full min-h-[400px] flex flex-col items-center justify-center print:hidden">
      <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando estado de cuenta...</p>
    </div>
  )

  const deudaTotal = calcularDeudaTotal();
  const saldoAFavor = Number(pacienteInfo?.saldo_a_favor || 0);

  // LOGICA PARA LA VISTA DE IMPRESION (Variables estaticas para el clonado)
  const detallesImpresion = getDetalles(pagoAImprimir?.comentario);

  return (
    <>
      <div className="p-8 md:p-12 text-left h-full print:hidden">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
            <ReceiptText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Caja y Recaudación</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de pagos y estado de cuenta</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* PANEL PRINCIPAL: COBRO */}
          <div className="lg:col-span-7 space-y-8">
            
            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-center sm:items-start gap-6">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Coins size={120} />
              </div>
              <div className="relative z-10 w-full">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Deuda Pendiente Total</p>
                <p className={`text-5xl font-black tracking-tighter ${deudaTotal > 0 ? 'text-white' : 'text-emerald-400'}`}>
                  ${deudaTotal.toLocaleString('es-CL')}
                </p>
              </div>

              {saldoAFavor > 0 && (
                <div className="relative z-10 bg-emerald-500/20 border border-emerald-500/30 p-5 rounded-3xl w-full sm:w-auto shrink-0 text-center sm:text-right">
                  <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Saldo a Favor</p>
                  <p className="text-2xl font-black text-emerald-400">+${saldoAFavor.toLocaleString('es-CL')}</p>
                </div>
              )}
            </div>

            {deudaTotal > 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100">
                <h3 className="text-sm font-black text-emerald-700 uppercase mb-6 flex items-center gap-2">
                  <Coins size={16} /> Recibir Nuevo Pago
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest pl-2">Método de Pago</label>
                    <div className="relative">
                      <select 
                        className="w-full p-4 pl-12 bg-white border border-emerald-200 rounded-2xl font-bold text-xs uppercase text-emerald-700 outline-none focus:border-emerald-500 appearance-none cursor-pointer" 
                        value={metodoPago} 
                        onChange={(e) => setMetodoPago(e.target.value)}
                      >
                          <option value="Transferencia">Transferencia</option>
                          <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                          <option value="Efectivo">Efectivo</option>
                      </select>
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
                        {metodoPago === 'Tarjeta' ? <CreditCard size={18} /> : metodoPago === 'Efectivo' ? <Banknote size={18} /> : <Landmark size={18} />}
                      </div>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300 pointer-events-none" size={16}/>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest pl-2">Monto a pagar</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-lg">$</span>
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-full py-4 pl-10 pr-5 bg-white border border-emerald-200 rounded-2xl font-black text-lg text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-emerald-200" 
                        value={montoIngresado} 
                        onChange={(e) => setMontoIngresado(Number(e.target.value))} 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest pl-2">
                    {metodoPago === 'Transferencia' ? 'Código de Transferencia (*)' : 
                     metodoPago === 'Tarjeta' ? 'N° Voucher Transbank (*)' : 
                     'N° Boleta SII (Opcional)'}
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder={metodoPago === 'Transferencia' ? "Ej: TR-109244" : metodoPago === 'Tarjeta' ? "Ej: V973W6" : "Ej: Boleta 102"} 
                      className={`w-full p-4 pl-12 bg-white border rounded-2xl font-bold text-xs uppercase text-emerald-700 outline-none focus:ring-4 transition-all placeholder:text-emerald-200/70 ${
                        (metodoPago === 'Transferencia' || metodoPago === 'Tarjeta') && !numeroOperacion.trim() 
                          ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/10' 
                          : 'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10'
                      }`} 
                      value={numeroOperacion} 
                      onChange={(e) => setNumeroOperacion(e.target.value)} 
                    />
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                  </div>
                  {(metodoPago === 'Transferencia' || metodoPago === 'Tarjeta') && !numeroOperacion.trim() && (
                    <p className="text-[9px] font-bold text-amber-600 pl-2 mt-1">Este campo es obligatorio para este método de pago.</p>
                  )}
                </div>

                <button 
                  onClick={procesarPagoCaja}
                  disabled={cargandoAccion || !montoIngresado || Number(montoIngresado) <= 0}
                  className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3"
                >
                  {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>}
                  Procesar Pago en Caja
                </button>
              </motion.div>
            ) : (
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center bg-slate-50/50">
                 <CheckCircle2 size={64} className="text-emerald-400 mb-4 opacity-50"/>
                 <h3 className="text-lg font-black uppercase text-slate-800">Paciente al día</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-[250px]">No existen tratamientos aprobados con deuda pendiente por cobrar.</p>
              </div>
            )}

            {/* LISTA DE DEUDAS ACTIVAS */}
            {deudas.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Detalle de Tratamientos a Pagar</h4>
                <div className="space-y-3">
                   {deudas.map(d => (
                       <div key={d.id} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm group hover:border-blue-200 transition-colors">
                           <div>
                              <div className="flex items-center gap-3 mb-1">
                                  <p className="text-xs font-black uppercase text-slate-800">{d.nombreDisplay}</p>
                                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${d.estado === 'realizado' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-500'}`}>
                                      {d.estado}
                                  </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400">Pactado: ${Number(d.precio_pactado).toLocaleString('es-CL')} <span className="mx-2">|</span> Abonado: ${Number(d.abonado).toLocaleString('es-CL')}</p>
                           </div>
                           <div className="text-right">
                             <span className="block text-[8px] font-black text-red-300 uppercase tracking-widest mb-0.5">Falta Pagar</span>
                             <p className="text-sm font-black text-red-500 bg-red-50 px-3 py-1 rounded-lg">${d.deuda.toLocaleString('es-CL')}</p>
                           </div>
                       </div>
                   ))}
                </div>
              </div>
            )}
          </div>

          {/* PANEL SECUNDARIO: HISTORIAL DE PAGOS */}
          <aside className="lg:col-span-5">
            <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 h-full">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <History size={14} /> Historial de Pagos
              </h4>

              {historialPagos.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <ReceiptText size={32} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">No hay pagos registrados</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {historialPagos.map((pago) => {
                    const dt = getDetalles(pago.comentario);
                    
                    return (
                      <div key={pago.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm group">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-3">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                              {pago.metodo_pago === 'Tarjeta' ? <CreditCard size={16}/> : pago.metodo_pago === 'Efectivo' ? <Banknote size={16}/> : <Landmark size={16}/>}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-800 uppercase">{pago.metodo_pago}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {new Date(pago.fecha_pago).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-black text-emerald-600">+${Number(pago.monto).toLocaleString('es-CL')}</p>
                        </div>

                        {/* SUB-DETALLE DE QUÉ SE PAGÓ EN ESTE RECIBO */}
                        {dt.length > 0 && (
                          <div className="mb-3 pl-2 border-l-2 border-emerald-100 space-y-1.5">
                             {dt.map((d:any, i:number) => (
                                <div key={i} className="flex justify-between items-center">
                                   <p className="text-[9px] font-black text-slate-600 uppercase truncate pr-2" title={d.prestacion}>• {d.prestacion} {d.diente ? `(${d.diente})` : ''}</p>
                                   <p className="text-[9px] font-bold text-emerald-500 shrink-0">${Number(d.abonado_ahora).toLocaleString('es-CL')}</p>
                                </div>
                             ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <span className="text-[8px] font-black text-slate-400 uppercase">
                            Ref: {pago.numero_boleta || 'S/N'}
                          </span>
                          
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => imprimirComprobante(pago)} className="p-2 bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-colors" title="Imprimir Comprobante">
                              <Printer size={14} />
                            </button>
                            <button onClick={() => reversarPago(pago)} className="p-2 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Anular Pago">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA DE IMPRESIÓN (DISEÑO EXACTO DENTALINK) - INVISIBLE EN PANTALLA */}
      {/* ========================================================================= */}
      <div id="comprobante-impresion" className="hidden text-left text-slate-900 font-sans">
        
        {/* HEADER */}
        <div className="flex justify-between items-start mb-8 border-b border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-bold uppercase">CENTRO MEDICO Y DENTAL DIGNIDAD SPA</h1>
            <p className="text-[10px] text-slate-600 mt-1">Fecha Impresión: {new Date().toLocaleDateString('es-CL')}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">IDN {pagoAImprimir?.id?.substring(0, 8).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase leading-none">Comprobante<br/>de pago</h2>
          </div>
        </div>

        {/* DATOS PACIENTE (FORMATO DENTALINK) */}
        <div className="mb-8 text-[11px] grid grid-cols-2 gap-y-2">
          <div className="flex"><span className="font-bold w-32 shrink-0">Paciente:</span> <span className="uppercase">{pacienteInfo?.nombre} {pacienteInfo?.apellido}</span></div>
          <div className="flex"><span className="font-bold w-32 shrink-0">RUT:</span> <span className="uppercase">{pacienteInfo?.rut || 'S/N'}</span></div>
          <div className="flex"><span className="font-bold w-32 shrink-0">Fecha de nacimiento:</span> <span>{formatearFechaLarga(pacienteInfo?.fecha_nacimiento)}</span></div>
          <div className="flex"><span className="font-bold w-32 shrink-0">Convenio:</span> <span className="uppercase">{pacienteInfo?.prevision || 'Sin convenio'}</span></div>
        </div>

        {/* TRATAMIENTOS PAGADOS (TABLA DETALLADA) */}
        <div className="mb-8">
          <h3 className="font-bold text-[11px] mb-2">Tratamientos pagados:</h3>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-left py-2 font-bold uppercase w-3/5">Prestación</th>
                <th className="text-center py-2 font-bold uppercase">Precio</th>
                <th className="text-right py-2 font-bold uppercase">Pagado</th>
              </tr>
            </thead>
            <tbody>
              {detallesImpresion.length > 0 ? (
                 detallesImpresion.map((d:any, i:number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 pr-2">
                        <p className="font-bold uppercase text-[10px]">{d.prestacion} {d.diente ? `(Pieza ${d.diente})` : ''}</p>
                        <p className="text-[9px] text-slate-500 uppercase mt-0.5">Doctor/a: {d.doctor}</p>
                      </td>
                      <td className="py-3 text-center text-slate-600">${Number(d.precio).toLocaleString('es-CL')}</td>
                      <td className="py-3 text-right font-bold">${Number(d.abonado_ahora).toLocaleString('es-CL')}</td>
                    </tr>
                 ))
              ) : (
                <tr className="border-b border-slate-100">
                  <td className="py-3 font-bold uppercase">Abono a cuenta clínica</td>
                  <td className="py-3 text-center">-</td>
                  <td className="text-right py-3 font-bold">${Number(pagoAImprimir?.monto || 0).toLocaleString('es-CL')}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
             <p className="font-bold text-sm">Total: ${Number(pagoAImprimir?.monto || 0).toLocaleString('es-CL')}</p>
          </div>
        </div>

        {/* TRANSACCIÓN */}
        <div className="mb-12">
          <h3 className="font-bold text-[11px] mb-2">Transacción:</h3>
          <div className="text-[11px] space-y-1">
            <div className="flex"><span className="font-bold w-32 shrink-0">Forma de pago:</span> <span className="uppercase">{pagoAImprimir?.metodo_pago} {pagoAImprimir?.numero_boleta && pagoAImprimir?.numero_boleta !== 'S/N' ? `(${pagoAImprimir.numero_boleta})` : ''}</span></div>
            <div className="flex"><span className="font-bold w-32 shrink-0">Fecha transacción:</span> <span>{pagoAImprimir?.fecha_pago ? new Date(pagoAImprimir.fecha_pago).toLocaleDateString('es-CL') : ''}</span></div>
            <div className="flex"><span className="font-bold w-32 shrink-0">Total:</span> <span className="font-bold">${Number(pagoAImprimir?.monto || 0).toLocaleString('es-CL')}</span></div>
          </div>
        </div>

        {/* FOOTER / LEGAL */}
        <div className="mt-16 pt-6 border-t border-slate-300 text-center">
          <p className="font-bold text-[10px] uppercase">CENTRO MEDICO Y DENTAL DIGNIDAD SPA</p>
          <p className="text-[9px] text-slate-600">Venancia Leiva 1871, La Pintana, Región Metropolitana</p>
          
          <div className="mt-6 text-[8px] text-slate-500 text-justify leading-relaxed max-w-2xl mx-auto">
            <p>Al iniciar este tratamiento declaro que acepto la política de Privacidad de la clínica y la Plataforma. Este documento certifica la recepción de dinero en la clínica para el abono a la cuenta del paciente, pero no constituye ni reemplaza a la Boleta Electrónica de Servicios regulada por el SII.</p>
          </div>
          
          <div className="mt-4 flex justify-between items-center text-[8px] text-slate-400">
            <p>Documento generado por Software Clínico</p>
            <p>Página 1 / 1</p>
          </div>
        </div>

      </div>

    </>
  )
}