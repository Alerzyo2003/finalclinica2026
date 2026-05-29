'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Search, UserPlus, Loader2, Edit3, UserCheck, UserX, 
  ChevronDown, ChevronUp, Activity, Wallet, ShieldCheck, 
  Coins, ReceiptText, CheckCircle2, X, ShieldAlert, AlertTriangle, 
  ChevronRight, Fingerprint, Phone, Mail, Stethoscope, User
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
  
  // 🔥 ESTADO DEL PERFIL PARA SABER EL ROL 🔥
  const [perfil, setPerfil] = useState<any>(null)
  const puedeVerFinanzas = perfil?.rol === 'ADMIN' || perfil?.rol === 'RECEPCIONISTA' || perfil?.rol === 'DENTISTA';

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
  const [codigoTransaccion, setCodigoTransaccion] = useState('')
  const [cargandoAccion, setCargandoAccion] = useState(false)
  
  // 🔥 ESTADO DE SALDO A FAVOR 🔥
  const [saldoAFavor, setSaldoAFavor] = useState(0)

  // ==========================================
  // ESTADOS MÓDULO ESTADO (BLOQUEO PACIENTE)
  // ==========================================
  const [modalEstadoAbierto, setModalEstadoAbierto] = useState(false)
  const [pacienteEstado, setPacienteEstado] = useState<any>(null)
  const [motivoBloqueo, setMotivoBloqueo] = useState('')
  const [cargandoEstado, setCargandoEstado] = useState(false)

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const getUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
        setPerfil(data)
      }
    }
    getUserProfile()
  }, [])

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
  // LÓGICA DE RECAUDACIÓN UNIFICADA
  // ==========================================
  const abrirCaja = async (paciente: any) => {
    setPacientePago(paciente);
    setMontoIngresado('');
    setMetodoPago('Tarjeta');
    setCodigoTransaccion('');
    setModalPagoAbierto(true);
    setCargandoDeudas(true);

    try {
        // 🔥 NUEVO: Traer el saldo a favor del paciente
        const { data: pacData } = await supabase.from('pacientes').select('saldo_a_favor').eq('id', paciente.id).single();
        setSaldoAFavor(Number(pacData?.saldo_a_favor || 0));

        const rutLimpio = paciente.rut.trim();
        const rutFuzzy = `%${rutLimpio.replaceAll('.', '').split('').join('%')}%`;

        // 1. Buscar Planes Oficiales Aprobados
        const { data: presupuestosPaciente, error: errPres } = await supabase
            .from('presupuestos').select('id, id_dentalink').eq('paciente_id', paciente.id).eq('aprobado', true);
        if (errPres) throw errPres;

        // 2. Buscar Planes Temporales (Dentalink)
        const { data: presTemporales } = await supabase
            .from('temp_presupuestos').select('id_dentalink').or(`rut.eq.${rutLimpio},rut.ilike.${rutFuzzy}`);

        const idsSupabase = presupuestosPaciente?.map(p => p.id) || [];
        const idsDentalinkOficiales = presupuestosPaciente?.filter(p => p.id_dentalink).map(p => String(p.id_dentalink)) || [];
        const idsSoloTemporales = presTemporales?.map(p => String(p.id_dentalink)) || [];
        
        // Unimos todos los IDs de Dentalink sin repetir
        const todosIdsDentalink = [...new Set([...idsDentalinkOficiales, ...idsSoloTemporales])];
        
        let itemsData: any[] = [];
        
        // 3. Traer ítems LOCALES
        if (idsSupabase.length > 0) {
            const { data, error } = await supabase
                .from('presupuesto_items')
                .select(`id, observacion, precio_pactado, abonado, estado, profesional_id, prestaciones:prestacion_id("Nombre Accion", "Nombre")`)
                .in('presupuesto_id', idsSupabase)
                .not('estado', 'eq', 'cancelada');

            if (!error && data) {
                itemsData = [...itemsData, ...data.map(d => ({ ...d, isTemp: false }))];
            }
        }

        // 4. Traer ítems DENTALINK
        if (todosIdsDentalink.length > 0) {
            const { data, error } = await supabase
                .from('temp_items')
                .select(`id, nombre_prestacion, precio_pactado, abonado, estado`)
                .in('id_dentalink', todosIdsDentalink)
                .not('estado', 'eq', 'cancelada');

            if (!error && data) {
                itemsData = [...itemsData, ...data.map((d: any) => ({
                    id: d.id,
                    observacion: d.nombre_prestacion,
                    precio_pactado: d.precio_pactado,
                    abonado: d.abonado,
                    estado: d.estado,
                    isTemp: true,
                    profesional_id: null
                }))];
            }
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

            let estadoNormalizado = String(item.estado || 'pendiente').toLowerCase().trim();
            if (['atendido', 'realizado', 'terminado', 'completado', 'finalizado'].includes(estadoNormalizado)) {
                estadoNormalizado = 'realizado';
            }

            return { ...item, estado: estadoNormalizado, deuda, nombreDisplay };
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
    if ((metodoPago === 'Tarjeta' || metodoPago === 'Transferencia' || metodoPago === 'Efectivo') && !codigoTransaccion.trim()) return toast.error("Ingrese el N° de boleta o código de transacción");

    // 🔥 NUEVO: Validar y descontar Billetera Virtual
    if (metodoPago === 'Saldo a Favor') {
       if (Number(montoIngresado) > saldoAFavor) return toast.error("El monto supera el saldo disponible en la billetera.");
       await supabase.from('pacientes').update({ saldo_a_favor: saldoAFavor - Number(montoIngresado) }).eq('id', pacientePago.id);
    }

    setCargandoAccion(true);
    let montoRestante = Number(montoIngresado);
    
    try {
        for (const item of deudasPaciente) {
            if (montoRestante <= 0) break;
            const aAbonar = Math.min(item.deuda, montoRestante);
            
            // Registramos en la tabla pagos
            await supabase.from('pagos').insert([{
                paciente_id: pacientePago.id,
                monto: aAbonar,
                metodo_pago: metodoPago,
                numero_referencia: codigoTransaccion.trim() || null,
                fecha_pago: new Date().toISOString(),
                item_id: item.isTemp ? null : item.id, 
                profesional_id: item.profesional_id || null
            }]);
            
            // Actualizamos el abono en la tabla correspondiente
            if (item.isTemp) {
                await supabase.from('temp_items').update({ abonado: Number(item.abonado) + aAbonar }).eq('id', item.id);
            } else {
                await supabase.from('presupuesto_items').update({ abonado: Number(item.abonado) + aAbonar }).eq('id', item.id);
            }
            montoRestante -= aAbonar;
        }

        toast.success(`Pago de $${Number(montoIngresado).toLocaleString('es-CL')} procesado con éxito.`);
        setModalPagoAbierto(false);
        setMontoIngresado('');
        setCodigoTransaccion('');
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
      setRefreshKey(prev => prev + 1);

    } catch (error) {
      toast.error("Error al actualizar el estado del paciente");
    } finally {
      setCargandoEstado(false);
    }
  }

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen text-left text-slate-900 font-sans pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">Pacientes</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Base de datos maestra</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setVerDeshabilitados(!verDeshabilitados)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm border ${verDeshabilitados ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:border-slate-300'}`}>
              {verDeshabilitados ? <UserCheck size={14} /> : <UserX size={14} />} {verDeshabilitados ? 'Ver Activos' : 'Ver Inactivos'}
            </button>
            <Link href="/pacientes/nuevo" className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2">
              <UserPlus size={16} /> Nuevo Ingreso
            </Link>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="relative group text-left max-w-2xl">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
            {buscando ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          </div>
          <input type="text" placeholder="Filtrar por nombre, rut o apellidos..." className="w-full bg-white border border-slate-200 p-5 pl-16 rounded-[2.2rem] shadow-sm outline-none font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
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
                      perfil={perfil} 
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

      {/* MODAL CAMBIO DE ESTADO (DESHABILITAR / REACTIVAR) */}
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

      {/* MODAL DE CAJA (RECAUDACIÓN DE PAGOS) */}
      <AnimatePresence>
        {modalPagoAbierto && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left bg-white">
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm"><ReceiptText size={28}/></div>
                      <div>
                        <h2 className="font-black text-2xl uppercase tracking-tighter italic leading-none text-slate-900">Caja y Pagos</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Paciente: {pacientePago?.nombre} {pacientePago?.apellido}</p>
                      </div>
                   </div>
                   <button onClick={() => setModalPagoAbierto(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="p-6 md:p-8 bg-slate-50 flex-1 overflow-y-auto custom-scrollbar">
                    {cargandoDeudas ? (
                        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={40}/></div>
                    ) : deudasPaciente.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                           <CheckCircle2 size={60} className="mx-auto text-emerald-400 mb-4 opacity-50"/>
                           <p className="text-sm font-black uppercase tracking-widest text-slate-600">Al día</p>
                           <p className="text-xs mt-1">El paciente no tiene tratamientos aprobados con deuda pendiente.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deuda Pendiente Total</h4>
                                <p className="text-4xl font-black text-slate-900 tracking-tighter">${calcularDeudaTotalCaja().toLocaleString('es-CL')}</p>
                              </div>
                              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto md:mx-0"><AlertTriangle size={24}/></div>
                           </div>

                           <div>
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Detalle de Tratamientos Aprobados</h4>
                              <div className="space-y-2">
                                 {deudasPaciente.map(d => (
                                     <div key={d.id} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-blue-300">
                                         <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-black uppercase text-slate-800 leading-tight">{d.nombreDisplay}</p>
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${d.estado === 'realizado' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                    {d.estado}
                                                </span>
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 tracking-widest">Pactado: ${Number(d.precio_pactado).toLocaleString('es-CL')} | Pagado: ${Number(d.abonado).toLocaleString('es-CL')}</p>
                                         </div>
                                         <p className="text-sm font-black text-red-500">${d.deuda.toLocaleString('es-CL')}</p>
                                     </div>
                                 ))}
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Método de Pago</label>
                                 <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs uppercase outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer shadow-sm" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                                     <option value="Tarjeta">Tarjeta (Débito/Crédito)</option>
                                     <option value="Efectivo">Efectivo</option>
                                     <option value="Transferencia">Transferencia</option>
                                     {/* 🔥 NUEVA OPCIÓN DE SALDO A FAVOR 🔥 */}
                                     {saldoAFavor > 0 && (
                                        <option value="Saldo a Favor">💰 Saldo a Favor (${saldoAFavor.toLocaleString('es-CL')})</option>
                                     )}
                                 </select>
                              </div>
                              <div className="space-y-2 text-left">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Monto a Recaudar ($)</label>
                                 <input type="number" placeholder="Ej: 50000" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-lg text-emerald-600 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm placeholder:text-slate-300" value={montoIngresado} onChange={(e) => setMontoIngresado(Number(e.target.value))} />
                              </div>
                              
                              {metodoPago !== 'Saldo a Favor' && (
                                <div className="space-y-2 md:col-span-2">
                                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
                                     {metodoPago === 'Efectivo' ? 'N° Boleta' : 'Cód. Transacción'} (*)
                                   </label>
                                   <input 
                                     type="text" 
                                     placeholder={metodoPago === 'Efectivo' ? 'Ej: 12345' : 'Ej: TX-98765'} 
                                     className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 placeholder:text-slate-300 uppercase transition-all shadow-sm" value={codigoTransaccion} onChange={(e) => setCodigoTransaccion(e.target.value)} />
                                </div>
                              )}
                           </div>
                        </div>
                    )}
                </div>

                <div className="p-6 md:p-8 border-t border-slate-100 bg-white shrink-0">
                   <button
                      onClick={procesarPagoCaja}
                      disabled={cargandoAccion || deudasPaciente.length === 0 || !montoIngresado}
                      className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                   >
                      {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : <Coins size={18}/>}
                      Registrar Pago Seguro
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

// --- COMPONENTE FILA CON DATOS REALES DE BD (FUSIÓN NUEVO + DENTALINK + ANTECEDENTES) ---
function FilaPaciente({ p, isExpanded, onExpand, onPagar, onCambiarEstado, refreshKey, perfil }: any) {
  const [stats, setStats] = useState({ activos: 0, finalizados: 0, totalP: 0, abonado: 0, realizado: 0, saldoAFavor: 0, loading: false });
  const [antecedentesBD, setAntecedentesBD] = useState<any[]>([]);
  
  // 🔥 ESTADOS PARA EL BOTÓN "VER MÁS" 🔥
  const [mostrarTodosAntecedentes, setMostrarTodosAntecedentes] = useState(false);
  const MAX_ANT = 3;

  const esAsistente = perfil?.rol === 'ASISTENTE';

  useEffect(() => {
    if (isExpanded) {
      fetchPacienteStats();
    }
  }, [isExpanded, refreshKey]);

  async function fetchPacienteStats() {
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const { data: antData } = await supabase
          .from('antecedentes')
          .select('categoria, contenido')
          .eq('paciente_id', p.id);
      
      if (antData) setAntecedentesBD(antData);

      // Traer el saldo actualizado
      const { data: pacActual } = await supabase.from('pacientes').select('saldo_a_favor').eq('id', p.id).single();
      const saldoReal = Number(pacActual?.saldo_a_favor || 0);

      const rutLimpio = p.rut.trim();
      const rutFuzzy = `%${rutLimpio.replaceAll('.', '').split('').join('%')}%`;

      const { data: presOficiales } = await supabase.from('presupuestos').select('id, estado, aprobado, id_dentalink').eq('paciente_id', p.id);
      const { data: presTemporales } = await supabase.from('temp_presupuestos').select('id_dentalink').or(`rut.eq.${rutLimpio},rut.ilike.${rutFuzzy}`);
      
      const activos = presOficiales?.filter(x => x.estado !== 'finalizado' && x.estado !== 'cancelado').length || 0;
      const finalizados = presOficiales?.filter(x => x.estado === 'finalizado').length || 0;
      const presAprobados = presOficiales?.filter(x => x.aprobado === true) || [];
      
      let totalPresupuestado = 0; let totalAbonado = 0; let totalRealizado = 0;

      if (presAprobados.length > 0) {
          const idsSupabase = presAprobados.filter(x => !x.id_dentalink).map(x => x.id);
          if (idsSupabase.length > 0) {
              const { data: itemsLocal } = await supabase.from('presupuesto_items').select('precio_pactado, abonado, estado').in('presupuesto_id', idsSupabase).not('estado', 'eq', 'cancelada');
              itemsLocal?.forEach(item => {
                  totalPresupuestado += Number(item.precio_pactado || 0);
                  totalAbonado += Number(item.abonado || 0);
                  if (item.estado === 'realizado') totalRealizado += Number(item.precio_pactado || 0);
              });
          }
      }

      const idsDentalinkOficiales = presAprobados.filter(x => x.id_dentalink).map(x => String(x.id_dentalink));
      const idsSoloTemporales = presTemporales?.map(x => String(x.id_dentalink)) || [];
      const todosIdsDentalink = [...new Set([...idsDentalinkOficiales, ...idsSoloTemporales])];

      if (todosIdsDentalink.length > 0) {
          const { data: itemsDentalink } = await supabase.from('temp_items').select('precio_pactado, abonado, estado').in('id_dentalink', todosIdsDentalink).not('estado', 'eq', 'cancelada');
          itemsDentalink?.forEach(item => {
              totalPresupuestado += Number(item.precio_pactado || 0);
              totalAbonado += Number(item.abonado || 0);
              const st = String(item.estado).toLowerCase().trim();
              if (['atendido', 'realizado', 'terminado', 'completado', 'finalizado'].includes(st)) totalRealizado += Number(item.precio_pactado || 0);
          });
      }

      setStats({ activos, finalizados, totalP: totalPresupuestado, abonado: totalAbonado, realizado: totalRealizado, saldoAFavor: saldoReal, loading: false });
    } catch (e) {
      console.error(e);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }

  const calcularEdad = (fechaNacimiento: string) => {
    if (!fechaNacimiento) return '--';
    const hoy = new Date(); const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }

  const saldoPendiente = stats.totalP - stats.abonado;
  const tieneAntecedentes = antecedentesBD.length > 0;

  return (
    <>
      <tr onClick={onExpand} className={`cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
        <td className="px-10 py-7">
          <div className="flex items-center gap-5 text-left text-slate-900">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${isExpanded ? 'bg-blue-600 text-white rotate-6 scale-110 shadow-lg shadow-blue-500/30' : 'bg-slate-100 text-slate-500'} ${!p.activo && !isExpanded && 'bg-red-50 text-red-400'}`}>
              {p.nombre?.[0]}{p.apellido?.[0]}
            </div>
            <div className="text-left text-slate-900">
              <p className={`font-black uppercase text-sm leading-none mb-1.5 ${!p.activo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{p.nombre} {p.apellido}</p>
              <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${p.activo ? 'text-emerald-500' : 'text-red-500'}`}>
                {p.activo ? <><CheckCircle2 size={10}/> Paciente Vigente</> : <><AlertTriangle size={10}/> Archivo Bloqueado</>}
              </span>
            </div>
          </div>
        </td>
        <td className="px-10 py-7 text-left text-slate-900">
           <span className="text-[11px] font-black text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm tracking-wide">{p.rut}</span>
        </td>
        <td className="px-10 py-7 text-right">
            <div className={`inline-flex p-3 rounded-2xl transition-all shadow-sm ${isExpanded ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
               {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
        </td>
      </tr>

      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={3} className="p-0 border-none">
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50/50">
                
                <div className="m-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    {stats.loading ? (
                       <div className="p-16 flex flex-col items-center justify-center gap-3">
                           <Loader2 className="animate-spin text-blue-500" size={32} />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Historial...</p>
                       </div>
                    ) : (
                       <div className={`grid grid-cols-1 md:grid-cols-${esAsistente ? '2' : '3'} divide-y md:divide-y-0 md:divide-x divide-slate-100 text-left`}>
                           
                           {/* COLUMNA 1: DATOS PERSONALES */}
                           <div className="p-8 flex flex-col h-full bg-slate-50/30">
                              <div className="flex-1 space-y-5">
                                 <div>
                                    <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest flex items-center gap-1">
                                        <User size={12}/> Ficha Personal
                                    </p>
                                    <h3 className="text-xl font-black text-slate-900 leading-none mt-2 uppercase">{p.nombre} {p.apellido}</h3>
                                    <p className="text-xs font-bold text-slate-500 mt-2">{calcularEdad(p.fecha_nacimiento)} años</p>
                                 </div>
                                 
                                 {/* CAJA DE ANTECEDENTES CON LÓGICA DE VER MÁS */}
                                 <div className={`p-4 rounded-2xl text-[11px] font-bold flex gap-3 items-start border shadow-sm ${tieneAntecedentes ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                    {tieneAntecedentes ? <AlertTriangle size={18} className="shrink-0 text-red-500" /> : <ShieldCheck size={18} className="shrink-0 text-emerald-500" />}
                                    
                                    {tieneAntecedentes ? (
                                        <div className="flex flex-col w-full items-start">
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1.5">Antecedentes Médicos</span>
                                            <div className="flex flex-wrap gap-1.5">
                                              {antecedentesBD.slice(0, mostrarTodosAntecedentes ? antecedentesBD.length : MAX_ANT).map((ant, idx) => (
                                                <span key={idx} className="bg-white/80 border border-red-200 text-red-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase leading-tight shadow-sm">
                                                  {ant.categoria}: {ant.contenido}
                                                </span>
                                              ))}
                                              
                                              {!mostrarTodosAntecedentes && antecedentesBD.length > MAX_ANT && (
                                                 <button 
                                                    onClick={(e) => { e.stopPropagation(); setMostrarTodosAntecedentes(true); }} 
                                                    className="bg-red-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-red-600 transition-all shadow-sm"
                                                 >
                                                    +{antecedentesBD.length - MAX_ANT} más
                                                 </button>
                                              )}
                                            </div>
                                            
                                            {mostrarTodosAntecedentes && antecedentesBD.length > MAX_ANT && (
                                                 <button 
                                                    onClick={(e) => { e.stopPropagation(); setMostrarTodosAntecedentes(false); }} 
                                                    className="text-[9px] font-black text-red-500 uppercase mt-2 hover:underline tracking-widest"
                                                 >
                                                    Mostrar menos
                                                 </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Antecedentes Médicos</span>
                                            <span>Paciente Sano. Sin antecedentes registrados.</span>
                                        </div>
                                    )}
                                 </div>
                                 
                                 <div className="space-y-2 text-[11px] font-bold text-slate-600 pt-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="flex items-center gap-2"><Fingerprint size={14} className="text-slate-400"/> {p.rut}</p>
                                    <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400"/> {p.email || 'Sin correo'}</p>
                                    <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {p.telefono || 'Sin teléfono'}</p>
                                    <p className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50 text-blue-600"><ShieldCheck size={14} className="text-blue-400"/> {p.prevision || 'Particular'}</p>
                                 </div>
                              </div>
                              <Link href={`/pacientes/editar/${p.id}`} className="w-full mt-6 py-3.5 bg-slate-900 text-white text-[10px] font-black uppercase hover:bg-black rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md">
                                 Actualizar Datos <ChevronRight size={14}/>
                              </Link>
                           </div>

                           {/* COLUMNA 2: TRATAMIENTOS */}
                           <div className="p-8 flex flex-col h-full">
                              <div className="flex-1 space-y-6">
                                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                     <Stethoscope size={14} className="text-blue-500"/> Resumen Clínico
                                 </h4>
                                 
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                         <p className="text-3xl font-black text-blue-600 mb-1">{stats.activos}</p>
                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Planes Activos</p>
                                     </div>
                                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                         <p className="text-3xl font-black text-emerald-500 mb-1">{stats.finalizados}</p>
                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Finalizados</p>
                                     </div>
                                 </div>

                                 
                              </div>
                              <Link href={`/pacientes/${p.id}`} className="w-full mt-6 py-3.5 bg-blue-600 text-white text-[10px] font-black uppercase hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-500/20">
                                 Abrir Ficha Clínica <ChevronRight size={14}/>
                              </Link>
                           </div>

                           {/* COLUMNA 3: RECAUDACIÓN */}
                           {!esAsistente && (
                             <div className="p-8 flex flex-col h-full bg-slate-50/30">
                                <div className="flex-1 space-y-6">
                                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                       <Wallet size={14} className="text-emerald-500"/> Estado Financiero
                                   </h4>
                                   
                                   {/* 🔥 AQUÍ ESTÁ EL RECUADRO VERDE DEL SALDO A FAVOR 🔥 */}
                                   {stats.saldoAFavor > 0 && (
                                     <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 shadow-sm mb-4">
                                         <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Saldo a Favor</span>
                                         <span className="text-sm font-black text-emerald-600">+${stats.saldoAFavor.toLocaleString('es-CL')}</span>
                                     </div>
                                   )}

                                   <div className="space-y-4">
                                      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pactado</span>
                                          <span className="text-sm font-black text-slate-900">${stats.totalP.toLocaleString('es-CL')}</span>
                                      </div>
                                      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Abonado</span>
                                          <span className="text-sm font-black text-emerald-600">${stats.abonado.toLocaleString('es-CL')}</span>
                                      </div>
                                      
                                      <div className={`flex justify-between items-center p-5 rounded-2xl border shadow-sm ${saldoPendiente > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                          <span className={`text-[10px] font-black uppercase tracking-widest ${saldoPendiente > 0 ? 'text-red-800' : 'text-emerald-800'}`}>Saldo por abonar</span>
                                          <span className={`text-xl font-black ${saldoPendiente > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                              ${saldoPendiente > 0 ? saldoPendiente.toLocaleString('es-CL') : '0'}
                                          </span>
                                      </div>
                                   </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); onPagar(); }} className="w-full mt-6 py-3.5 bg-emerald-500 text-white text-[10px] font-black uppercase hover:bg-emerald-600 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20">
                                   <Coins size={14}/> Ir a Recaudación
                                </button>
                             </div>
                           )}

                       </div>
                    )}
                </div>
                
                {['ADMIN', 'RECEPCIONISTA'].includes(perfil?.rol) && (
                  <div className="flex justify-end px-8 pb-6">
                      <button
                        onClick={(e) => { e.stopPropagation(); onCambiarEstado(); }}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border shadow-sm ${
                          p.activo ? 'text-slate-500 border-slate-200 bg-white hover:bg-slate-50' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {p.activo ? <ShieldAlert size={14} className="text-red-400"/> : <ShieldCheck size={14}/>}
                        {p.activo ? 'Inhabilitar Ficha de Paciente' : 'Reactivar Paciente'}
                      </button>
                  </div>
                )}

              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}