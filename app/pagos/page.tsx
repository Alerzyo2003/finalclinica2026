'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  DollarSign, TrendingUp, Users, 
  Download, Loader2, Calendar as CalendarIcon,
  ArrowUpRight, Wallet, Receipt, Stethoscope, Trash2, CreditCard, Banknote, Inbox
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

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
      // 1. Obtenemos el catálogo de profesionales (Como respaldo)
      const { data: profs } = await supabase.from('profesionales').select('user_id, nombre, apellido');
      
      const getDentista = (id: string) => {
          if (!id || !profs) return 'Sin asignar';
          const doc = profs.find((p: any) => p.user_id === id);
          return doc ? `Dr. ${doc.apellido}` : 'Sin asignar';
      }

      // 2. Traer todos los pagos cruzando explícitamente con el Perfil del Doctor
      const { data: resPagos, error } = await supabase
        .from('pagos')
        .select(`
            id, monto, comentario, fecha_pago, metodo_pago, numero_referencia, numero_boleta, paciente_id,
            profesional_id, item_id, presupuesto_id, caja_id,
            pacientes (nombre, apellido, rut),
            sesiones_caja (estado, nombre_responsable, fecha_apertura),
            presupuestos (nombre_tratamiento),
            presupuesto_items (
                observacion, 
                diente_id,
                cara,
                prestaciones:prestacion_id ("Nombre Accion", "Nombre", "Codigo Accion")
            ),
            receptor:profesional_id(nombre_completo)
        `)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;

      const consolidado: any[] = []

      resPagos?.forEach((p: any) => {
        // 🔥 ARMADO INTELIGENTE DEL DETALLE DEL TRATAMIENTO 🔥
        let detallePrestacion = 'Abono General';
        let nombrePresupuesto = p.presupuestos?.nombre_tratamiento || 'Tratamiento Clínico';
        let doctorJSON = null;
        
        if (p.presupuesto_items) {
            const prestacionData = p.presupuesto_items.prestaciones;
            let nombreReal = prestacionData?.["Nombre Accion"] || prestacionData?.["Nombre"] || p.presupuesto_items.observacion || 'Tratamiento';
            
            if (nombreReal.includes('|')) nombreReal = nombreReal.split('|')[0].trim();
            detallePrestacion = nombreReal;
            
            if (p.presupuesto_items.diente_id) {
               detallePrestacion += ` (Pieza: ${p.presupuesto_items.diente_id}`;
               if (p.presupuesto_items.cara) detallePrestacion += ` - Cara: ${p.presupuesto_items.cara}`;
               detallePrestacion += `)`;
            }
        } else if (p.comentario) {
            try { 
                const parsed = JSON.parse(p.comentario);
                detallePrestacion = parsed[0]?.prestacion || p.comentario;
                doctorJSON = parsed[0]?.doctor; // Extraemos el doctor del JSON si existe
            } catch(e) { detallePrestacion = p.comentario }
        }

        // 🔥 ASIGNACIÓN BLINDADA DEL ESPECIALISTA 🔥
        let doctorFinal = 'Sin asignar';
        if (p.receptor?.nombre_completo) {
            doctorFinal = `Dr/a. ${p.receptor.nombre_completo}`;
        } else if (doctorJSON && doctorJSON !== '-') {
            doctorFinal = doctorJSON;
        } else {
            doctorFinal = getDentista(p.profesional_id);
        }

        consolidado.push({
          id: p.id,
          monto: Number(p.monto || 0),
          detalle_prestacion: detallePrestacion,
          nombre_presupuesto: nombrePresupuesto,
          metodo_pago: p.metodo_pago,
          numero_boleta: p.numero_boleta || p.numero_referencia || 'N/A', 
          fecha: p.fecha_pago,
          paciente: p.pacientes ? `${p.pacientes.nombre} ${p.pacientes.apellido}` : 'S/N',
          rut_paciente: p.pacientes?.rut || 'S/RUT',
          dentista: doctorFinal,
          paciente_id: p.paciente_id,
          caja_info: p.sesiones_caja ? `Caja de ${p.sesiones_caja.nombre_responsable} (${new Date(p.sesiones_caja.fecha_apertura).toLocaleDateString('es-CL')})` : 'Pago sin caja abierta',
          item_id: p.item_id, 
          presupuesto_id: p.presupuesto_id 
        })
      })

      const total = consolidado.reduce((acc: number, curr: any) => acc + (curr.monto || 0), 0)
      
      setPagos(consolidado)
      setStats({
        total: total,
        cantidad: consolidado.length,
        promedio: consolidado.length > 0 ? total / consolidado.length : 0
      })
    } catch (error) {
      console.error("Error en finanzas:", error)
      toast.error("Error al cargar la caja global")
    } finally {
      setCargando(false)
    }
  }

  const handleAnularPago = async (pago: any) => {
    const enviarASaldo = window.confirm(
      `Estás a punto de anular un pago por $${pago.monto.toLocaleString('es-CL')}.\n\n` +
      `Al presionar "ACEPTAR", el pago se anulará y el monto se agregará al Saldo a Favor (Billetera Virtual) del paciente.\n\n` +
      `Si presionas "CANCELAR", no se realizará ninguna acción.`
    );

    if (!enviarASaldo) {
      return; // Si el usuario aprieta "Cancelar", no hacemos nada.
    }
    
    const toastId = toast.loading("Reversando finanzas y restaurando deuda...");

    try {
      const montoReversado = Number(pago.monto);

      if (pago.item_id) {
         const { data: itemActual } = await supabase.from('presupuesto_items').select('abonado').eq('id', pago.item_id).single();
         if (itemActual) {
            const nuevoAbono = Math.max(0, Number(itemActual.abonado || 0) - montoReversado);
            await supabase.from('presupuesto_items').update({ abonado: nuevoAbono }).eq('id', pago.item_id);
         }
      }

      if (pago.presupuesto_id) {
         const { data: presupuestoActual } = await supabase.from('presupuestos').select('total_abonado').eq('id', pago.presupuesto_id).single();
         if (presupuestoActual) {
            const nuevoTotalAbonado = Math.max(0, Number(presupuestoActual.total_abonado || 0) - montoReversado);
            await supabase.from('presupuestos').update({ total_abonado: nuevoTotalAbonado }).eq('id', pago.presupuesto_id);
         }
      }

      if (pago.paciente_id) {
         // Solo se suma a la billetera si el pago era de un tratamiento.
         // Si era un abono libre, el dinero ya estaba en la billetera, por lo que no se toca.
         if (pago.item_id) {
             const { data: pacActual } = await supabase.from('pacientes').select('saldo_a_favor').eq('id', pago.paciente_id).single();
             const saldoActual = Number(pacActual?.saldo_a_favor || 0);
             const nuevoSaldo = saldoActual + montoReversado;
             await supabase.from('pacientes').update({ saldo_a_favor: nuevoSaldo }).eq('id', pago.paciente_id);
             toast.success(`Se agregaron $${pago.monto.toLocaleString('es-CL')} a su Saldo a Favor.`);
         }
      }

      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('pagos').update({
        estado: 'Anulado',
        anulado_por: session?.user?.id,
        fecha_anulacion: new Date().toISOString()
      }).eq('id', pago.id);

      await supabase.from('auditoria_clinica').insert([{
         usuario_id: session?.user?.id,
         accion: 'UPDATE / ANULACIÓN PAGO',
         tabla: 'pagos',
         detalles: `Anuló pago de $${pago.monto}. Destino: SALDO A FAVOR`
      }]);

      toast.success("Pago anulado exitosamente.", { id: toastId });
      fetchFinanzas();

    } catch (error) {
      toast.error("Ocurrió un error al anular el pago.", { id: toastId });
    }
  }

  if (!mounted || cargando) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consolidando Caja Global...</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans text-left">
      <div className="max-w-screen-2xl mx-auto space-y-10 text-left">
        
        <header className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 text-left">
          <div className="flex items-center gap-6 text-left">
            <div className="bg-emerald-500 p-5 rounded-[2rem] text-white shadow-xl shadow-emerald-100">
              <Wallet size={32} />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none text-left">Registro de Pagos</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3 text-left">Auditoría completa de movimientos e ingresos</p>
            </div>
          </div>
          <button 
            onClick={() => window.print()}
            className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95 text-left"
          >
            <Download size={18} /> Exportar
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
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest text-left border-b border-slate-100">
                  <th className="p-6 text-left whitespace-nowrap">Fecha y Caja</th>
                  <th className="p-6 text-left">Paciente</th>
                  <th className="p-6 text-left">Dr / Especialista</th>
                  <th className="p-6 text-left">Detalle de Prestación</th>
                  <th className="p-6 text-left">Información de Pago</th>
                  <th className="p-6 text-right">Monto</th>
                  <th className="p-6 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-left">
                {pagos.length > 0 ? pagos.map((p, index) => (
                  <motion.tr 
                    key={`pago-${p.id}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.01 }}
                    className="hover:bg-slate-50 transition-colors group text-left align-top"
                  >
                    {/* FECHA Y CAJA */}
                    <td className="p-6 text-left">
                      <div className="flex flex-col gap-1.5 text-left">
                        <span className="text-xs font-black text-slate-800 text-left whitespace-nowrap">
                          {p.fecha ? new Date(p.fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'S/F'}
                        </span>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight w-48">
                           <Inbox size={12} className="shrink-0 text-amber-500" /> 
                           <span>{p.caja_info}</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* PACIENTE */}
                    <td className="p-6 text-left">
                        <div className="flex flex-col text-left">
                            <span className="font-black text-slate-800 uppercase text-xs text-left leading-tight">{p.paciente}</span>
                            <span className="text-[10px] font-bold text-slate-400 mt-1">{p.rut_paciente}</span>
                        </div>
                    </td>
                    
                    {/* ESPECIALISTA */}
                    <td className="p-6 text-left">
                      <div className="flex items-center gap-2">
                        <Stethoscope size={14} className="text-slate-400 shrink-0" />
                        <span className={`text-[10px] font-black uppercase ${p.dentista === 'Sin asignar' ? 'text-slate-400 italic' : 'text-blue-600'}`}>
                          {p.dentista}
                        </span>
                      </div>
                    </td>

                    {/* DETALLE PRESTACIÓN */}
                    <td className="p-6 text-left">
                       <div className="flex flex-col gap-1 text-left max-w-sm">
                          <span className="text-xs font-bold text-slate-700 leading-tight">
                             {p.detalle_prestacion}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                             Ppto: {p.nombre_presupuesto}
                          </span>
                       </div>
                    </td>

                    {/* METODO DE PAGO Y BOLETA */}
                    <td className="p-6 text-left">
                        <div className="flex flex-col gap-2">
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 w-fit rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                p.metodo_pago?.toLowerCase() === 'efectivo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                p.metodo_pago?.toLowerCase() === 'transferencia' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                p.metodo_pago?.toLowerCase() === 'saldo a favor' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                {p.metodo_pago?.toLowerCase() === 'efectivo' ? <Banknote size={12} /> : <CreditCard size={12} />}
                                {p.metodo_pago}
                            </span>
                            
                            <span className="flex items-center gap-1.5 px-2.5 py-1 w-fit bg-slate-50 text-slate-500 rounded-md text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                <Receipt size={12} /> N°: {p.numero_boleta}
                            </span>
                        </div>
                    </td>

                    {/* MONTO */}
                    <td className="p-6 text-right font-black text-emerald-600 text-lg align-middle">
                      ${p.monto.toLocaleString('es-CL')}
                    </td>

                    {/* ACCIONES */}
                    <td className="p-6 text-center align-middle">
                        <button 
                          onClick={() => handleAnularPago(p)}
                          className="bg-white border border-red-100 text-red-400 hover:text-white hover:bg-red-500 hover:border-red-500 p-2.5 rounded-xl transition-all shadow-sm mx-auto flex items-center justify-center group"
                          title="Anular pago y restaurar deuda"
                        >
                          <Trash2 size={16} className="group-hover:scale-110 transition-transform"/>
                        </button>
                    </td>
                  </motion.tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="p-20 text-center">
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