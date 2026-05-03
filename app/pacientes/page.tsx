'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Search, UserPlus, Loader2, Edit3, UserCheck, UserX, 
  ChevronDown, ChevronUp, Activity, Wallet, ShieldCheck, 
  Coins, ReceiptText, CheckCircle2, X, ShieldAlert, AlertTriangle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ClientesPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [verDeshabilitados, setVerDeshabilitados] = useState(false)
  const [pacienteExpandido, setPacienteExpandido] = useState<string | null>(null)
  
  // Refresco dinámico
  const [refreshKey, setRefreshKey] = useState(0)

  // ==========================================
  // ESTADOS MÓDULO CAJA (PAGOS)
  // ==========================================
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [pacientePago, setPacientePago] = useState<any>(null)
  const [deudasPaciente, setDeudasPaciente] = useState<any[]>([])
  const [cargandoDeudas, setCargandoDeudas] = useState(false)
  const [montoIngresado, setMontoIngresado] = useState<number | ''>('')
  const [metodoPago, setMetodoPago] = useState('Tarjeta')
  const [cargandoAccion, setCargandoAccion] = useState(false)

  // ==========================================
  // ESTADOS MÓDULO ESTADO (BLOQUEO PACIENTE)
  // ==========================================
  const [modalEstadoAbierto, setModalEstadoAbierto] = useState(false)
  const [pacienteEstado, setPacienteEstado] = useState<any>(null)
  const [motivoBloqueo, setMotivoBloqueo] = useState('')
  const [cargandoEstado, setCargandoEstado] = useState(false)

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => { fetchInitialPacientes() }, [verDeshabilitados, refreshKey])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (busqueda.trim() === '') { fetchInitialPacientes(); return; }
    if (busqueda.trim().length < 2) return
    setBuscando(true)
    searchTimeoutRef.current = setTimeout(() => ejecutarBusqueda(busqueda), 600)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [busqueda])

  async function fetchInitialPacientes() {
    setLoading(true)
    const { data } = await supabase.from('pacientes').select('*').eq('activo', !verDeshabilitados).order('nombre', { ascending: true }).limit(30) 
    setPacientes(data || [])
    setLoading(false)
  }

  async function ejecutarBusqueda(term: string) {
    const palabras = term.trim().split(/\s+/).filter(p => p.length > 0);
    let query = supabase.from('pacientes').select('*').eq('activo', !verDeshabilitados);
    palabras.forEach((palabra) => {
      query = query.or(`nombre.ilike.%${palabra}%,apellido.ilike.%${palabra}%,rut.ilike.%${palabra}%`);
    });
    const { data } = await query.limit(20);
    setPacientes(data || []);
    setBuscando(false);
  }

  // ==========================================
  // LÓGICA DE RECAUDACIÓN (CAJA)
  // ==========================================
  const abrirCaja = async (paciente: any) => {
    setPacientePago(paciente);
    setMontoIngresado('');
    setMetodoPago('Tarjeta');
    setModalPagoAbierto(true);
    setCargandoDeudas(true);

    try {
        const { data: presupuestosPaciente, error: errPres } = await supabase
            .from('presupuestos').select('id').eq('paciente_id', paciente.id).eq('aprobado', true);

        if (errPres) throw errPres;

        const idsPresupuestos = presupuestosPaciente?.map(p => p.id) || [];
        let itemsData: any[] = [];
        
        if (idsPresupuestos.length > 0) {
            const { data, error } = await supabase
                .from('presupuesto_items')
                .select(`id, observacion, precio_pactado, abonado, estado, prestaciones:prestacion_id("Nombre Accion", "Nombre")`)
                .in('presupuesto_id', idsPresupuestos)
                .not('estado', 'eq', 'cancelada');

            if (error) throw error;
            itemsData = data || [];
        }

        const itemsConDeuda = itemsData.map(item => {
            const precio = Number(item.precio_pactado || 0);
            const abonado = Number(item.abonado || 0);
            const deuda = precio - abonado;
            
            let nombreDisplay = item.observacion || "Tratamiento";
            if (item.prestaciones) {
                nombreDisplay = item.prestaciones["Nombre Accion"] || item.prestaciones["Nombre"] || nombreDisplay;
            } else if (item.observacion && item.observacion.includes('|')) {
                nombreDisplay = item.observacion.split('|')[0].trim();
            }

            return { ...item, deuda, nombreDisplay };
        }).filter(item => item.deuda > 0)
          .sort((a, b) => {
              if (a.estado === 'realizado' && b.estado !== 'realizado') return -1;
              if (a.estado !== 'realizado' && b.estado === 'realizado') return 1;
              return 0;
          });

        setDeudasPaciente(itemsConDeuda);
    } catch (e) {
        console.error(e);
        toast.error("Error al cargar las deudas del paciente");
        setModalPagoAbierto(false);
    } finally {
        setCargandoDeudas(false);
    }
  }

  const procesarPagoCaja = async () => {
    if (!montoIngresado || Number(montoIngresado) <= 0) return toast.error("Ingrese un monto válido a recaudar");

    setCargandoAccion(true);
    let montoRestante = Number(montoIngresado);
    
    try {
        const { error: errPago } = await supabase.from('pagos').insert([{
            paciente_id: pacientePago.id,
            monto: Number(montoIngresado),
            metodo_pago: metodoPago,
            fecha_pago: new Date().toISOString()
        }]);
        
        if (errPago) console.warn("Aviso: No se guardó en la tabla pagos.", errPago);

        for (const item of deudasPaciente) {
            if (montoRestante <= 0) break;
            const aAbonar = Math.min(item.deuda, montoRestante);
            await supabase.from('presupuesto_items').update({ abonado: Number(item.abonado) + aAbonar }).eq('id', item.id);
            montoRestante -= aAbonar;
        }

        toast.success(`Pago de $${Number(montoIngresado).toLocaleString('es-CL')} procesado con éxito.`);
        setModalPagoAbierto(false);
        setMontoIngresado('');
        setRefreshKey(prev => prev + 1);
    } catch (e) {
        toast.error("Ocurrió un error al procesar el pago");
    } finally {
        setCargandoAccion(false);
    }
  }

  const calcularDeudaTotalCaja = () => deudasPaciente.reduce((acc, curr) => acc + curr.deuda, 0);

  // ==========================================
  // LÓGICA DE BLOQUEO / DESBLOQUEO
  // ==========================================
  const abrirModalBloqueo = (paciente: any) => {
    setPacienteEstado(paciente);
    setMotivoBloqueo('');
    setModalEstadoAbierto(true);
  }

  const cambiarEstadoPaciente = async () => {
    if (!pacienteEstado) return;
    setCargandoEstado(true);
    const nuevoEstado = !pacienteEstado.activo;

    try {
      if (!nuevoEstado && !motivoBloqueo.trim()) {
        toast.error("Debe ingresar el motivo de la inhabilitación.");
        setCargandoEstado(false);
        return;
      }

      await supabase.from('pacientes').update({ 
        activo: nuevoEstado,
        motivo_deshabilitado: nuevoEstado ? null : motivoBloqueo.trim()
      }).eq('id', pacienteEstado.id);

      toast.success(nuevoEstado ? "Paciente reactivado exitosamente" : "Paciente inhabilitado con éxito");
      setModalEstadoAbierto(false);
      setMotivoBloqueo('');
      setRefreshKey(prev => prev + 1); // Refrescar la tabla

    } catch (error) {
      toast.error("Error al actualizar el estado del paciente");
    } finally {
      setCargandoEstado(false);
    }
  }

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-left text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">Pacientes</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Base de datos maestra</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setVerDeshabilitados(!verDeshabilitados)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm border ${verDeshabilitados ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
              {verDeshabilitados ? <UserCheck size={14} /> : <UserX size={14} />} {verDeshabilitados ? 'Ver Activos' : 'Ver Inactivos'}
            </button>
            <Link href="/pacientes/nuevo" className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
              <UserPlus size={16} /> Nuevo Ingreso
            </Link>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="relative group text-left">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
            {buscando ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          </div>
          <input type="text" placeholder="Filtrar por nombre, rut o apellidos..." className="w-full bg-white border border-slate-100 p-5 pl-16 rounded-[2.2rem] shadow-sm outline-none font-bold text-slate-700" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        {/* TABLA */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/30">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase text-left">Paciente</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase text-left">Identificación</th>
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase text-right">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
                ) : (
                  pacientes.map((p) => (
                    <FilaPaciente 
                      key={p.id} 
                      p={p} 
                      isExpanded={pacienteExpandido === p.id} 
                      onExpand={() => setPacienteExpandido(pacienteExpandido === p.id ? null : p.id)}
                      onPagar={() => abrirCaja(p)}
                      onCambiarEstado={() => abrirModalBloqueo(p)}
                      refreshKey={refreshKey}
                    />
                  ))
                )}
                {pacientes.length === 0 && !loading && (
                    <tr><td colSpan={3} className="p-10 text-center text-slate-400 font-bold text-sm">No se encontraron pacientes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL CAMBIO DE ESTADO (DESHABILITAR / REACTIVAR)        */}
      {/* ======================================================== */}
      <AnimatePresence>
        {modalEstadoAbierto && pacienteEstado && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
               className="bg-white max-w-md w-full rounded-[3rem] p-10 shadow-2xl text-center"
             >
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 border-[8px] ${pacienteEstado.activo ? 'bg-red-50 text-red-500 border-red-500/10' : 'bg-emerald-50 text-emerald-500 border-emerald-500/10'}`}>
                  {pacienteEstado.activo ? <AlertTriangle size={32}/> : <ShieldCheck size={32}/>}
                </div>
                
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-2">
                  {pacienteEstado.activo ? 'Inhabilitar Paciente' : 'Reactivar Paciente'}
                </h3>
                
                <p className="text-xs font-medium text-slate-500 mb-8 leading-relaxed">
                  {pacienteEstado.activo 
                    ? `Al inhabilitar a ${pacienteEstado.nombre}, se bloqueará el acceso a su ficha y no se le podrán agendar nuevas citas. Por favor, indique el motivo.`
                    : `El paciente ${pacienteEstado.nombre} volverá a tener acceso normal a la clínica y se podrán gestionar sus tratamientos y citas.`}
                </p>

                {pacienteEstado.activo && (
                  <div className="text-left mb-8">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2 block">Motivo del bloqueo</label>
                    <textarea 
                      placeholder="Ej: Deuda pendiente prolongada, Comportamiento inadecuado, etc."
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50 transition-all resize-none"
                      rows={3}
                      value={motivoBloqueo}
                      onChange={(e) => setMotivoBloqueo(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                   <button onClick={() => setModalEstadoAbierto(false)} disabled={cargandoEstado} className="flex-1 p-4 rounded-2xl font-black text-[10px] uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">
                     Cancelar
                   </button>
                   <button onClick={cambiarEstadoPaciente} disabled={cargandoEstado || (pacienteEstado.activo && !motivoBloqueo.trim())} className={`flex-1 p-4 rounded-2xl font-black text-[10px] uppercase text-white shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${pacienteEstado.activo ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}>
                     {cargandoEstado ? <Loader2 size={16} className="animate-spin"/> : pacienteEstado.activo ? 'Bloquear Ficha' : 'Reactivar'}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ======================================================== */}
      {/* MODAL DE CAJA (RECAUDACIÓN DE PAGOS)                       */}
      {/* ======================================================== */}
      <AnimatePresence>
        {modalPagoAbierto && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-8 bg-emerald-500 text-white flex justify-between items-center">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-600 rounded-2xl shadow-inner"><ReceiptText size={28}/></div>
                      <div>
                        <h2 className="font-black text-2xl uppercase tracking-tighter italic leading-none">Caja y Pagos</h2>
                        <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-1">Paciente: {pacientePago?.nombre} {pacientePago?.apellido}</p>
                      </div>
                   </div>
                   <button onClick={() => setModalPagoAbierto(false)} className="p-2 hover:bg-emerald-600 rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="p-8 bg-slate-50 flex-1 overflow-y-auto custom-scrollbar">
                    {cargandoDeudas ? (
                        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={40}/></div>
                    ) : deudasPaciente.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                           <CheckCircle2 size={60} className="mx-auto text-emerald-400 mb-4 opacity-50"/>
                           <p className="text-sm font-black uppercase tracking-widest text-slate-600">Al día</p>
                           <p className="text-xs mt-1">El paciente no tiene tratamientos aprobados con deuda pendiente.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Deuda Pendiente</h4>
                              <p className="text-4xl font-black text-slate-900 tracking-tighter">${calcularDeudaTotalCaja().toLocaleString('es-CL')}</p>
                           </div>

                           <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Detalle de Tratamientos Aprobados</h4>
                              <div className="space-y-2">
                                 {deudasPaciente.map(d => (
                                     <div key={d.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100">
                                         <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-black uppercase text-slate-800">{d.nombreDisplay}</p>
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${d.estado === 'realizado' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                    {d.estado}
                                                </span>
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1">Pactado: ${Number(d.precio_pactado).toLocaleString('es-CL')} | Pagado: ${Number(d.abonado).toLocaleString('es-CL')}</p>
                                         </div>
                                         <p className="text-sm font-black text-red-500">${d.deuda.toLocaleString('es-CL')}</p>
                                     </div>
                                 ))}
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Método de Pago</label>
                                 <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs uppercase outline-none focus:border-emerald-500" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                                     <option value="Tarjeta">Tarjeta (Débito/Crédito)</option>
                                     <option value="Efectivo">Efectivo</option>
                                     <option value="Transferencia">Transferencia</option>
                                 </select>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Monto a Recaudar ($)</label>
                                 <input type="number" placeholder="Ej: 50000" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-lg text-emerald-600 outline-none focus:border-emerald-500 placeholder:text-slate-300" value={montoIngresado} onChange={(e) => setMontoIngresado(Number(e.target.value))} />
                              </div>
                           </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 bg-white">
                   <button 
                      onClick={procesarPagoCaja}
                      disabled={cargandoAccion || deudasPaciente.length === 0 || !montoIngresado}
                      className="w-full py-5 bg-emerald-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                   >
                      {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : <Coins size={18}/>}
                      Procesar Recaudación
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

// --- COMPONENTE FILA CON DATOS REALES DE BD ---
function FilaPaciente({ p, isExpanded, onExpand, onPagar, onCambiarEstado, refreshKey }: any) {
  const [stats, setStats] = useState({ activos: 0, finalizados: 0, totalP: 0, abonado: 0, loading: false });

  // Recarga los datos al expandir la fila o cuando se completa un pago/bloqueo (refreshKey)
  useEffect(() => {
    if (isExpanded) {
      fetchPacienteStats();
    }
  }, [isExpanded, refreshKey]);

  async function fetchPacienteStats() {
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const { data: pres } = await supabase.from('presupuestos').select('total, total_abonado, estado, aprobado').eq('paciente_id', p.id);
      
      const activos = pres?.filter(x => x.estado !== 'finalizado' && x.estado !== 'cancelado').length || 0;
      const finalizados = pres?.filter(x => x.estado === 'finalizado').length || 0;
      
      const presAprobados = pres?.filter(x => x.aprobado === true) || [];
      const totalPresupuestado = presAprobados.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
      const totalAbonado = presAprobados.reduce((acc, curr) => acc + (Number(curr.total_abonado) || 0), 0);

      setStats({ activos, finalizados, totalP: totalPresupuestado, abonado: totalAbonado, loading: false });
    } catch (e) {
      setStats(prev => ({ ...prev, loading: false }));
    }
  }

  const saldoPendiente = stats.totalP - stats.abonado;

  return (
    <>
      <tr onClick={onExpand} className={`cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
        <td className="px-10 py-7">
          <div className="flex items-center gap-5 text-left text-slate-900">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${isExpanded ? 'bg-blue-600 text-white rotate-6 scale-110' : 'bg-slate-100 text-slate-500'} ${!p.activo && !isExpanded && 'bg-red-50 text-red-400'}`}>
              {p.nombre?.[0]}{p.apellido?.[0]}
            </div>
            <div className="text-left text-slate-900">
              <p className={`font-black uppercase text-sm leading-none mb-1.5 ${!p.activo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{p.nombre} {p.apellido}</p>
              <span className={`text-[9px] font-black uppercase tracking-widest ${p.activo ? 'text-slate-400' : 'text-red-500'}`}>
                {p.activo ? 'Paciente Vigente' : 'Archivo Bloqueado / Inactivo'}
              </span>
            </div>
          </div>
        </td>
        <td className="px-10 py-7 text-left text-slate-900">
           <span className="text-[11px] font-black text-slate-500 bg-white border border-slate-100 px-4 py-1.5 rounded-xl shadow-sm">{p.rut}</span>
        </td>
        <td className="px-10 py-7 text-right">
            <div className={`inline-flex p-3 rounded-2xl transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
               {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
        </td>
      </tr>

      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={3} className="p-0 border-none">
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50/50">
                <div className="p-10 pt-2 grid grid-cols-1 md:grid-cols-3 gap-6 text-left text-slate-900">
                  
                  {/* BLOQUE DATOS */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 text-left">
                    <h5 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] flex items-center gap-2 mb-4 text-left"><ShieldCheck size={14}/> Ficha Técnica</h5>
                    <div className="space-y-4 text-left">
                      <div className="text-left"><p className="text-[8px] font-black text-slate-300 uppercase text-left">Correo Electrónico</p><p className="text-xs font-black text-slate-700 text-left truncate">{p.email || 'NO REGISTRADO'}</p></div>
                      <div className="text-left"><p className="text-[8px] font-black text-slate-300 uppercase text-left">Convenio</p><p className="text-xs font-black text-slate-700 uppercase text-left">{p.prevision || 'PARTICULAR'}</p></div>
                      <div className="text-left"><p className="text-[8px] font-black text-slate-300 uppercase text-left">Teléfono</p><p className="text-xs font-black text-slate-700 text-left">{p.telefono || '---'}</p></div>
                    </div>
                  </div>

                  {/* BLOQUE CLÍNICO */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-left">
                    <h5 className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em] flex items-center gap-2 mb-6 text-left"><Activity size={14}/> Resumen Clínico</h5>
                    {stats.loading ? <Loader2 className="animate-spin text-slate-200" /> : (
                      <div className="grid grid-cols-2 gap-4 text-left">
                        <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 text-left">
                           <p className="text-[7px] font-black text-emerald-400 uppercase text-left">P. Activos</p>
                           <p className="text-2xl font-black text-emerald-700 text-left">{stats.activos.toString().padStart(2, '0')}</p>
                        </div>
                        <div className="bg-slate-100 p-5 rounded-3xl border border-slate-200 text-left">
                           <p className="text-[7px] font-black text-slate-400 uppercase text-left">Finalizados</p>
                           <p className="text-2xl font-black text-slate-600 text-left">{stats.finalizados.toString().padStart(2, '0')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BLOQUE FINANCIERO */}
                  <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-left relative overflow-hidden">
                    {/* WIDGET SALDO A FAVOR DECORATIVO */}
                    {p.saldo_a_favor > 0 && (
                      <div className="absolute top-4 right-4 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                        <p className="text-[7px] font-black text-emerald-300 uppercase">A favor: ${Number(p.saldo_a_favor).toLocaleString('es-CL')}</p>
                      </div>
                    )}

                    <h5 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] flex items-center gap-2 mb-6 text-left"><Wallet size={14}/> Estado de Cuenta</h5>
                    {stats.loading ? <Loader2 className="animate-spin text-white/20" /> : (
                      <div className="space-y-4 text-left">
                        <div className="flex justify-between items-center text-left text-white"><span className="text-[8px] font-black text-white/40 uppercase">Total Aprobado</span><span className="text-xs font-black">${stats.totalP.toLocaleString('es-CL')}</span></div>
                        <div className="flex justify-between items-center text-left text-white"><span className="text-[8px] font-black text-white/40 uppercase">Abonado Real</span><span className="text-xs font-black text-emerald-400">${stats.abonado.toLocaleString('es-CL')}</span></div>
                        <div className="h-px bg-white/10 my-1"></div>
                        <div className="bg-white/5 p-4 rounded-2xl flex justify-between items-center text-left text-white">
                          <span className="text-[9px] font-black text-blue-300 uppercase">Saldo Pendiente</span>
                          <span className={`text-lg font-black ${saldoPendiente > 0 ? 'text-red-400' : 'text-white'}`}>
                            ${saldoPendiente.toLocaleString('es-CL')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACCIONES DE LA FILA */}
                  <div className="md:col-span-3 flex flex-wrap justify-end items-center gap-3 pt-4 border-t border-slate-100 text-left">
                    
                    {/* BOTÓN CAMBIAR ESTADO (BLOQUEO) */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onCambiarEstado(); }} 
                      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                        p.activo 
                          ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                      }`}
                    >
                      {p.activo ? <ShieldAlert size={14}/> : <ShieldCheck size={14}/>}
                      {p.activo ? 'Inhabilitar Paciente' : 'Reactivar Paciente'}
                    </button>

                    <div className="flex-1"></div> {/* Empuja los demás a la derecha */}

                    {/* BOTÓN RECAUDAR SOLO VISIBLE SI HAY DEUDA Y ESTÁ ACTIVO */}
                    {(saldoPendiente > 0 && p.activo) && (
                       <button onClick={(e) => { e.stopPropagation(); onPagar(); }} className="bg-emerald-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2">
                         <Coins size={14}/> Recibir Pago
                       </button>
                    )}

                    <Link href={`/pacientes/${p.id}`} className={`bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!p.activo ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'hover:bg-black'}`}>Abrir Ficha</Link>
                    
                    <Link href={`/pacientes/editar/${p.id}`} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 transition-all"><Edit3 size={18} /></Link>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}