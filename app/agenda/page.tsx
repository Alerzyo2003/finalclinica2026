'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  X, Search, ChevronLeft, ChevronRight, Loader2, Clock, 
  CalendarDays, Timer, UserCheck, Trash2, Activity, ClipboardList, 
  CheckCircle2, Plus, Calendar as CalendarIcon, Briefcase, 
  AlertTriangle, Phone, Mail, MessageCircle, Ban, RefreshCcw, ChevronDown, CalendarClock,
  Coins, ReceiptText, Stethoscope, ChevronRight as ChevronRightIcon, LayoutGrid, List, Lock, FileText, Send
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner' 
import Link from 'next/link'

const ESTADOS_CITA: Record<string, { label: string, bg: string, text: string, dot: string, icon: any }> = {
  programada: { label: 'No Confirmado', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', icon: <Clock size={14}/> },
  confirmado_tel: { label: 'Confirmado', bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500', icon: <Phone size={14}/> },
  en_espera: { label: 'En Espera', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', icon: <Timer size={14}/> },
  atendiendose: { label: 'En Box', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', icon: <Activity size={14}/> },
  atendido: { label: 'Atendido', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', icon: <CheckCircle2 size={14}/> },
  no_asiste: { label: 'No Asistió', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', icon: <Ban size={14}/> },
  cancelada: { label: 'Anulada', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', icon: <Trash2 size={14}/> },
  reprogramada: { label: 'Reprogramada', bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500', icon: <RefreshCcw size={14}/> }
};

interface NuevoPaciente {
  nombre: string; apellido: string; rut: string; telefono: string; fecha_nacimiento: string; sexo: string;
}

const getDiasLunesSabado = (d: Date) => {
  const curr = new Date(d); 
  const day = curr.getDay();
  const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
  return Array.from({ length: 6 }, (_, i) => new Date(curr.getFullYear(), curr.getMonth(), diff + i));
}

const getInitials = (n: string, a: string) => {
  return `${n?.charAt(0) || ''}${a?.charAt(0) || ''}`.toUpperCase();
}

const getAvatarColor = (name: string) => {
  const colors = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const getLocalDateISO = (d: Date) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [vistaAgenda, setVistaAgenda] = useState<'dia' | 'semana'>('dia')
  const [citasDia, setCitasDia] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [cargandoPagina, setCargandoPagina] = useState(true)
  const [filtroEspecialista, setFiltroEspecialista] = useState('Todos')
  const [citaEnReprogramacion, setCitaEnReprogramacion] = useState<any>(null)
  const [notificacion, setNotificacion] = useState<{ nombre: string } | null>(null)
  
  const [busquedaAgenda, setBusquedaAgenda] = useState('')
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [realtimeTrigger, setRealtimeTrigger] = useState(0);

  const statsDia = useMemo(() => {
    const anuladas = citasDia.filter(c => c.estado === 'cancelada').length;
    const reprogramadas = citasDia.filter(c => c.estado === 'reprogramada').length;
    return { totalPerdidas: anuladas + reprogramadas };
  }, [citasDia]);

  const citasFiltradas = useMemo(() => {
    if (!busquedaAgenda.trim()) return citasDia;
    const term = busquedaAgenda.toLowerCase().trim();
    return citasDia.filter(c => {
       const nombreCompleto = `${c.pacientes?.nombre} ${c.pacientes?.apellido}`.toLowerCase();
       const rut = c.pacientes?.rut?.toLowerCase() || '';
       return nombreCompleto.includes(term) || rut.includes(term);
    });
  }, [citasDia, busquedaAgenda]);

  const [modalAbierto, setModalAbierto] = useState(false)
  const [paso, setPaso] = useState(1) 
  const [semanaInicio, setSemanaInicio] = useState(new Date())
  const [filtro, setFiltro] = useState({ profesional_id: '', box_id: 1, duracionDefault: 30 })
  const [horasSeleccionadas, setHorasSeleccionadas] = useState<{fecha: string, hora: string, duracion: number}[]>([])
  const [horariosConfigurados, setHorariosConfigurados] = useState<any[]>([])
  const [citasOcupadas, setCitasOcupadas] = useState<any[]>([])
  const [bloqueosSemana, setBloqueosSemana] = useState<any[]>([]) 

  const [modalHuerfanasAbierto, setModalHuerfanasAbierto] = useState(false)
  const [citasHuerfanas, setCitasHuerfanas] = useState<any[]>([])
  const [cargandoHuerfanas, setCargandoHuerfanas] = useState(false)

  const [modalBloqueo, setModalBloqueo] = useState(false)
  const [profesionalBloqueo, setProfesionalBloqueo] = useState<string>('')
  const [motivoBloqueo, setMotivoBloqueo] = useState('Imprevisto Médico')

  const [modoNuevoPaciente, setModoNuevoPaciente] = useState(false)
  const [nuevoPaciente, setNuevoPaciente] = useState<NuevoPaciente>({ nombre: '', apellido: '', rut: '', telefono: '', fecha_nacimiento: '', sexo: '' })
  const [busqueda, setBusqueda] = useState('')
  const [pacientesEncontrados, setPacientesEncontrados] = useState<any[]>([])
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<any>(null)
  const [cargandoAccion, setCargandoAccion] = useState(false)
  
  const [nuevoTratamientoNombre, setNuevoTratamientoNombre] = useState('')
  const [tratamientosPaciente, setTratamientosPaciente] = useState<any[]>([])
  const [tratamientoSeleccionadoId, setTratamientoSeleccionadoId] = useState<string | null>(null)
  
  const [mostrarTicket, setMostrarTicket] = useState(false)
  const [citaConfirmadaData, setCitaConfirmadaData] = useState<any>(null)

  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [pacientePago, setPacientePago] = useState<any>(null)
  const [deudasPaciente, setDeudasPaciente] = useState<any[]>([])
  const [cargandoDeudas, setCargandoDeudas] = useState(false)
  const [montoIngresado, setMontoIngresado] = useState<number | ''>('')
  const [metodoPago, setMetodoPago] = useState('tarjeta')
  const [codigoTransaccion, setCodigoTransaccion] = useState('')

  const [modalEnvioPresupuesto, setModalEnvioPresupuesto] = useState<{abierto: boolean, cita: any, texto: string}>({abierto: false, cita: null, texto: ''});

  const duracionesDisponibles = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];

  useEffect(() => {
    const setupNotificaciones = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const canalNotif = supabase.channel(`notificaciones-${user.id}`)
        .on('broadcast', { event: 'PACIENTE_EN_ESPERA' }, (payload) => {
          setNotificacion({ nombre: payload.payload.nombre });
          setTimeout(() => setNotificacion(null), 120000); 
        })
        .subscribe();

      const canalAgenda = supabase.channel('agenda-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_items' }, () => {
            setRealtimeTrigger(prev => prev + 1); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => {
            setRealtimeTrigger(prev => prev + 1); 
        })
        .subscribe();

      return () => { 
          supabase.removeChannel(canalNotif);
          supabase.removeChannel(canalAgenda);
      }
    };
    setupNotificaciones();
  }, []);

  useEffect(() => { cargarBasicos() }, [])
  useEffect(() => { fetchCitasAgenda() }, [selectedDate, filtroEspecialista, vistaAgenda, realtimeTrigger])
  
  useEffect(() => {
    if (modalAbierto && filtro.profesional_id) {
        fetchCitasOcupadas();
        fetchHorariosDoctor();
        fetchBloqueosSemana();
    }
  }, [semanaInicio, modalAbierto, filtro.profesional_id])

  async function cargarBasicos() {
    try {
      const { data: pro } = await supabase.from('profesionales').select('*, especialidades(nombre)').eq('activo', true)
      setProfesionales(pro || [])
      if (pro?.length) setFiltro(prev => ({ ...prev, profesional_id: pro[0].user_id || '' }))
    } finally { setCargandoPagina(false) }
  }

  async function fetchCitasAgenda() {
    let inicioRango, finRango;

    if (vistaAgenda === 'dia') {
        const d = new Date(selectedDate);
        inicioRango = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
        finRango = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
    } else {
        const dias = getDiasLunesSabado(selectedDate);
        inicioRango = new Date(dias[0].setHours(0,0,0,0)).toISOString();
        finRango = new Date(dias[5].setHours(23,59,59,999)).toISOString();
    }
    
    let query = supabase.from('citas').select('*, pacientes(*)').gte('inicio', inicioRango).lte('inicio', finRango);
    if (filtroEspecialista !== 'Todos') query = query.eq('profesional_id', filtroEspecialista);
    
    const { data: citasData } = await query.order('inicio', { ascending: true });
    
    if (!citasData || citasData.length === 0) {
        setCitasDia([]);
        return;
    }

    const pacienteIds = [...new Set(citasData.map(c => c.paciente_id).filter(Boolean))];
    
    const { data: presups } = await supabase
        .from('presupuestos')
        .select('id, paciente_id')
        .in('paciente_id', pacienteIds)
        .eq('aprobado', true);

    const presupsIds = presups?.map(p => p.id) || [];
    
    let finanzasMap: Record<string, { total: number, abonado: number, deuda: number, deuda_realizada: number }> = {};
    pacienteIds.forEach(id => finanzasMap[id] = { total: 0, abonado: 0, deuda: 0, deuda_realizada: 0 });

    if (presupsIds.length > 0) {
        const { data: items } = await supabase.from('presupuesto_items').select('presupuesto_id, precio_pactado, abonado, estado').in('presupuesto_id', presupsIds).neq('estado', 'cancelada');
        items?.forEach(item => {
            const p = presups?.find(x => x.id === item.presupuesto_id);
            if (p) {
                const precio = Number(item.precio_pactado || 0); 
                const abono = Number(item.abonado || 0);
                const deudaItem = precio - abono;

                finanzasMap[p.paciente_id].total += precio; 
                finanzasMap[p.paciente_id].abonado += abono; 
                finanzasMap[p.paciente_id].deuda += deudaItem;

                if (item.estado === 'realizado' && deudaItem > 0) {
                    finanzasMap[p.paciente_id].deuda_realizada += deudaItem;
                }
            }
        });
    }

    const citasConFinanzas = citasData.map(c => {
        const fin = finanzasMap[c.paciente_id];
        let estadoFinanciero = 'sin_saldo'; 
        let requiereCobroInmediato = false;

        if (fin && fin.total > 0) { 
            if (fin.deuda > 0) estadoFinanciero = 'deuda'; else estadoFinanciero = 'saldado'; 
            if (fin.deuda_realizada > 0) requiereCobroInmediato = true;
        }
        return { ...c, finanzas: fin, estadoFinanciero, requiereCobroInmediato };
    });

    setCitasDia(citasConFinanzas);
  }

  async function fetchBloqueosSemana() {
    const dias = getDiasLunesSabado(semanaInicio);
    const inicioSemana = dias[0].toLocaleDateString('sv-SE');
    const finSemana = dias[5].toLocaleDateString('sv-SE');
    const { data } = await supabase.from('bloqueos_agenda').select('*').eq('profesional_id', filtro.profesional_id).gte('fecha', inicioSemana).lte('fecha', finSemana);
    setBloqueosSemana(data || []);
  }

  async function fetchCitasHuerfanas() {
    setCargandoHuerfanas(true);
    try {
      const hoy = new Date().toISOString().split('T')[0];
      let queryCitas = supabase.from('citas').select('*, pacientes(*)').gte('inicio', `${hoy}T00:00:00`).not('estado', 'in', '("cancelada","atendido","no_asiste")').order('inicio', { ascending: true });
      if (filtroEspecialista !== 'Todos') { queryCitas = queryCitas.eq('profesional_id', filtroEspecialista); }

      const { data: citasFuturas, error: errCitas } = await queryCitas;
      if (errCitas) console.error("❌ Error en BD al traer citas:", errCitas);

      if (!citasFuturas || citasFuturas.length === 0) {
        setCitasHuerfanas([]); setCargandoHuerfanas(false); return;
      }

      let queryBloqueos = supabase.from('bloqueos_agenda').select('*').gte('fecha', hoy);
      if (filtroEspecialista !== 'Todos') queryBloqueos = queryBloqueos.eq('profesional_id', filtroEspecialista);
      const { data: bloqueos, error: errBloq } = await queryBloqueos;
      if (errBloq) console.error("❌ Error en BD al traer bloqueos:", errBloq);

      const huerfanas = citasFuturas.filter(cita => {
        const [fechaStr] = cita.inicio.replace('T', ' ').split(' ');
        if (!cita.profesional_id) return true;
        const isBlocked = bloqueos?.some(b => b.profesional_id === cita.profesional_id && b.fecha === fechaStr);
        if (isBlocked) return true;
        return false; 
      });

      setCitasHuerfanas(huerfanas);
    } catch (error) { toast.error("Error al escanear la agenda global"); } finally { setCargandoHuerfanas(false); }
  }

  const iniciarReprogramacion = (cita: any) => {
    resetEstados(); setCitaEnReprogramacion(cita); setFiltro({ ...filtro, profesional_id: cita.profesional_id || '' });
    seleccionarPacienteExistente(cita.pacientes); setNuevoTratamientoNombre(cita.motivo || ''); setModalAbierto(true); setPaso(1);
  };

  async function actualizarEstadoCita(citaId: string, nuevoEstado: string) {
    const ahora = new Date(); const offset = ahora.getTimezoneOffset() * 60000; const horaLocalISO = new Date(ahora.getTime() - offset).toISOString();
    const updateData: any = { estado: nuevoEstado };
    if (nuevoEstado === 'en_espera') { updateData.llegada_confirmada = true; updateData.hora_llegada = horaLocalISO; }
    if (nuevoEstado === 'atendiendose') updateData.hora_inicio_atencion = horaLocalISO; 
    if (nuevoEstado === 'atendido') updateData.hora_fin_atencion = horaLocalISO; 
    
    const { data: citaActual, error } = await supabase.from('citas').update(updateData).eq('id', citaId).select('*, pacientes(nombre, apellido)').single();
    if (error) return toast.error("Error al actualizar");
    
    if (nuevoEstado === 'en_espera' && citaActual) {
      const canalNotif = supabase.channel(`notificaciones-${citaActual.profesional_id}`);
      canalNotif.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalNotif.send({ type: 'broadcast', event: 'PACIENTE_EN_ESPERA', payload: { nombre: `${citaActual.pacientes.nombre} ${citaActual.pacientes.apellido}` } });
          supabase.removeChannel(canalNotif);
        }
      });
    }
    toast.success("Estado actualizado"); await fetchCitasAgenda();
  }

  const contactarWhatsApp = (telefono: string, nombre: string, estado: string, hora: string) => {
    if (!telefono) return toast.error("Paciente sin teléfono");
    const num = telefono.replace(/\D/g, '');
    let mensaje = `Hola ${nombre}, nos comunicamos de la clínica dental.`;
    if (estado === 'programada' || estado === 'confirmado_tel') {
        mensaje = `Hola ${nombre}, te escribimos de la clínica para recordar tu cita de hoy a las ${hora} hrs. ¿Nos confirmas tu asistencia por favor?`;
    } else if (estado === 'atendido') {
        mensaje = `Hola ${nombre}, esperamos que estés muy bien tras tu atención de hoy en la clínica. ¡Cualquier consulta no dudes en escribirnos!`;
    } else if (estado === 'no_asiste') {
        mensaje = `Hola ${nombre}, notamos que no pudiste asistir a tu cita de hoy. ¿Te gustaría reagendar para otro día?`;
    }
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }

  const abrirEnvioPresupuesto = async (cita: any) => {
    if (!cita.paciente_id) return toast.error("Cita sin paciente asociado");
    
    const toastId = toast.loading("Buscando tratamientos...");
    try {
        const { data: presupuestos } = await supabase.from('presupuestos').select('id').eq('paciente_id', cita.paciente_id).eq('aprobado', true);
        if (!presupuestos || presupuestos.length === 0) {
            toast.error("El paciente no tiene planes de tratamiento aprobados.", { id: toastId });
            return;
        }

        const ids = presupuestos.map(p => p.id);
        const { data: items } = await supabase.from('presupuesto_items').select('observacion, precio_pactado, abonado, prestaciones:prestacion_id("Nombre Accion", "Nombre")').in('presupuesto_id', ids).neq('estado', 'cancelada');

        if (!items || items.length === 0) {
            toast.error("El plan no contiene tratamientos activos.", { id: toastId });
            return;
        }

        let total = 0; let abonado = 0;
        let detalleText = `Hola ${cita.pacientes?.nombre}, te compartimos el detalle actualizado de tu Plan de Tratamiento Dental:\n\n`;

        items.forEach(item => {
            let nombreDisplay = item.prestaciones?.["Nombre Accion"] || item.prestaciones?.["Nombre"] || 'Tratamiento';
            if (item.observacion && item.observacion.includes('|')) nombreDisplay = item.observacion.split('|')[0].trim();
            
            let precio = Number(item.precio_pactado || 0);
            total += precio; abonado += Number(item.abonado || 0);
            detalleText += `🔸 ${nombreDisplay} - $${precio.toLocaleString('es-CL')}\n`;
        });

        detalleText += `\n💰 *Total Plan:* $${total.toLocaleString('es-CL')}`;
        if (abonado > 0) detalleText += `\n✅ *Abonado:* $${abonado.toLocaleString('es-CL')}`;
        if (total - abonado > 0) detalleText += `\n🔴 *Saldo Pendiente:* $${(total - abonado).toLocaleString('es-CL')}`;

        detalleText += `\n\nCualquier consulta, estamos a tu disposición. ¡Saludos! 🦷`;

        setModalEnvioPresupuesto({ abierto: true, cita, texto: detalleText });
        toast.success("Resumen generado", { id: toastId });

    } catch (error) { toast.error("Error al generar resumen", { id: toastId }); }
  }

  const handleGuardarBloqueoRapido = async () => {
      if (!profesionalBloqueo) return toast.error("Debe seleccionar un profesional para bloquear su agenda.");
      if (!motivoBloqueo.trim()) return toast.error("Debe ingresar un motivo para el bloqueo.");
      
      setCargandoAccion(true);
      try {
          const { error } = await supabase.from('bloqueos_agenda').insert([{
              profesional_id: profesionalBloqueo,
              fecha: getLocalDateISO(selectedDate),
              motivo: motivoBloqueo
          }]);
          if (error) throw error;
          
          toast.success("Agenda bloqueada exitosamente");
          setModalBloqueo(false);
          await fetchCitasAgenda();
      } catch (e) { toast.error("Error al bloquear el horario"); } finally { setCargandoAccion(false); }
  }

  async function fetchCitasOcupadas() {
    const dias = getDiasLunesSabado(semanaInicio);
    const inicioSemana = new Date(dias[0].getFullYear(), dias[0].getMonth(), dias[0].getDate(), 0, 0, 0).toISOString();
    const finSemana = new Date(dias[5].getFullYear(), dias[5].getMonth(), dias[5].getDate(), 23, 59, 59).toISOString();
    const { data } = await supabase.from('citas').select('id, inicio, fin').eq('profesional_id', filtro.profesional_id).gte('inicio', inicioSemana).lte('inicio', finSemana).neq('estado', 'cancelada');
    const filtradas = citaEnReprogramacion ? (data || []).filter(c => c.id !== citaEnReprogramacion.id) : (data || []);
    setCitasOcupadas(filtradas);
  }

  async function fetchHorariosDoctor() {
    const { data } = await supabase.from('disponibilidad_profesional').select('*').eq('profesional_id', filtro.profesional_id)
    setHorariosConfigurados(data || [])
  }

  const esHorarioLaboral = (fecha: string, hora: string) => {
    const diaSemana = new Date(fecha + 'T00:00:00').getDay()
    return horariosConfigurados.some(h => h.dia_semana === diaSemana && hora >= h.hora_inicio.substring(0,5) && hora < h.hora_fin.substring(0,5))
  }

  const esCitaOcupada = (fecha: string, hora: string) => {
    const slotTime = new Date(`${fecha}T${hora}:00`).getTime();
    return citasOcupadas.some(cita => {
        const citaInicio = new Date(cita.inicio.replace(' ', 'T')).getTime();
        const citaFin = new Date(cita.fin.replace(' ', 'T')).getTime();
        return slotTime >= citaInicio && slotTime < citaFin;
    });
  }

  const buscarPacientes = async (term: string) => {
    if (!term.trim()) { setPacientesEncontrados([]); return; }
    const palabras = term.trim().split(/\s+/);
    let query = supabase.from('pacientes').select('*');
    palabras.forEach(palabra => {
      const fuzzy = `%${palabra.split('').join('%')}%`;
      const palabraRut = palabra.replace(/[^0-9kK]/gi, '').toUpperCase();
      if (palabraRut.length > 0) { query = query.or(`nombre.ilike.${fuzzy},apellido.ilike.${fuzzy},rut.ilike.%${palabraRut}%`); } 
      else { query = query.or(`nombre.ilike.${fuzzy},apellido.ilike.${fuzzy}`); }
    });
    const { data } = await query.limit(5); setPacientesEncontrados(data || []);
  }

  const seleccionarPacienteExistente = async (paciente: any) => {
    if (!paciente) return;
    setPacienteSeleccionado(paciente); setBusqueda(`${paciente.nombre} ${paciente.apellido}`); setPacientesEncontrados([]);
    const { data } = await supabase.from('presupuestos').select('id, nombre_tratamiento').eq('paciente_id', paciente.id).neq('estado', 'finalizado').order('fecha_creacion', { ascending: false });
    setTratamientosPaciente(data || []);
    if (data?.length) { setTratamientoSeleccionadoId(data[0].id); setNuevoTratamientoNombre(data[0].nombre_tratamiento); }
    else { setTratamientoSeleccionadoId('MANUAL'); setNuevoTratamientoNombre(''); }
  };

  const handleGuardar = async () => {
    if (cargandoAccion) return; setCargandoAccion(true);
    try {
      let pId = pacienteSeleccionado?.id;
      let pNombreFull = pacienteSeleccionado ? `${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido}` : "";
      if (modoNuevoPaciente && !citaEnReprogramacion) {
        const rutLimpio = nuevoPaciente.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim();
        const { data: pNew, error: pErr } = await supabase.from('pacientes').insert([{ nombre: nuevoPaciente.nombre.toUpperCase().trim(), apellido: nuevoPaciente.apellido.toUpperCase().trim(), rut: rutLimpio, telefono: nuevoPaciente.telefono, fecha_nacimiento: nuevoPaciente.fecha_nacimiento, sexo: nuevoPaciente.sexo, activo: true }]).select().single();
        if (pErr) throw pErr;
        pId = pNew.id; pNombreFull = `${nuevoPaciente.nombre} ${nuevoPaciente.apellido}`;
      }
      const parsearAFechaLocal = (fechaStr: string, horaStr: string, duracionMin: number) => {
        const d = new Date(`${fechaStr}T${horaStr}:00`); const off = d.getTimezoneOffset() * 60000;
        const inicio = new Date(d.getTime() - off).toISOString();
        const fin = new Date(d.getTime() + (duracionMin * 60000) - off).toISOString();
        return { inicio, fin };
      }
      if (citaEnReprogramacion) {
        const s = horasSeleccionadas[0]; const { inicio, fin } = parsearAFechaLocal(s.fecha, s.hora, s.duracion);
        await supabase.from('citas').update({ inicio, fin, profesional_id: filtro.profesional_id, estado: 'reprogramada', motivo: nuevoTratamientoNombre.toUpperCase() || citaEnReprogramacion.motivo }).eq('id', citaEnReprogramacion.id);
      } else {
        const nuevasCitas = horasSeleccionadas.map(s => {
          const { inicio, fin } = parsearAFechaLocal(s.fecha, s.hora, s.duracion);
          return { paciente_id: pId, profesional_id: filtro.profesional_id, presupuesto_id: (tratamientoSeleccionadoId && tratamientoSeleccionadoId !== 'MANUAL') ? tratamientoSeleccionadoId : null, inicio, fin, estado: 'programada', motivo: nuevoTratamientoNombre.toUpperCase() || 'CONSULTA' };
        });
        await supabase.from('citas').insert(nuevasCitas);
      }
      setCitaConfirmadaData({ paciente: pNombreFull.toUpperCase(), citas: horasSeleccionadas });
      setMostrarTicket(true); await fetchCitasAgenda();
    } catch (e: any) { console.error(e); toast.error("Error al guardar"); } finally { setCargandoAccion(false); }
  }

  const toggleHora = (fecha: string, hora: string) => {
    setHorasSeleccionadas(prev => {
      if (citaEnReprogramacion) return [{ fecha, hora, duracion: filtro.duracionDefault }];
      const existe = prev.find(h => h.fecha === fecha && h.hora === hora);
      if (existe) return prev.filter(h => !(h.fecha === fecha && h.hora === hora));
      return [...prev, { fecha, hora, duracion: filtro.duracionDefault }];
    });
  }

  const navegarSemana = (sentido: 'atras' | 'adelante') => {
    const nueva = new Date(semanaInicio); nueva.setDate(nueva.getDate() + (sentido === 'adelante' ? 7 : -7)); setSemanaInicio(nueva);
  }

  const resetEstados = () => { setPaso(1); setHorasSeleccionadas([]); setPacienteSeleccionado(null); setBusqueda(''); setModoNuevoPaciente(false); setNuevoTratamientoNombre(''); setCitasOcupadas([]); setCitaEnReprogramacion(null); setSemanaInicio(new Date()); setTratamientosPaciente([]); setTratamientoSeleccionadoId(null); setNuevoPaciente({ nombre: '', apellido: '', rut: '', telefono: '', fecha_nacimiento: '', sexo: '' }); setBloqueosSemana([]); }

  const abrirCaja = async (cita: any) => {
    if (!cita.pacientes || !cita.pacientes.id) return toast.error("Cita no tiene paciente asignado");
    setPacientePago(cita.pacientes); setMontoIngresado(''); setMetodoPago('tarjeta'); setCodigoTransaccion('');
    setModalPagoAbierto(true); setCargandoDeudas(true);
    try {
        const { data: presupuestosPaciente, error: errPres } = await supabase.from('presupuestos').select('id').eq('paciente_id', cita.pacientes.id).eq('aprobado', true);
        if (errPres) throw errPres;
        const idsPresupuestos = presupuestosPaciente?.map(p => p.id) || [];
        let itemsData: any[] = [];
        if (idsPresupuestos.length > 0) {
            const { data, error } = await supabase.from('presupuesto_items').select(`id, observacion, precio_pactado, abonado, estado, prestaciones:prestacion_id("Nombre Accion", "Nombre")`).in('presupuesto_id', idsPresupuestos).not('estado', 'eq', 'cancelada');
            if (error) throw error;
            itemsData = data || [];
        }
        const itemsConDeuda = itemsData.map(item => {
            const precio = Number(item.precio_pactado || 0); const abonado = Number(item.abonado || 0); const deuda = precio - abonado;
            let nombreDisplay = item.observacion || "Tratamiento";
            if (item.prestaciones) nombreDisplay = item.prestaciones["Nombre Accion"] || item.prestaciones["Nombre"] || nombreDisplay;
            else if (item.observacion && item.observacion.includes('|')) nombreDisplay = item.observacion.split('|')[0].trim();
            return { ...item, deuda, nombreDisplay };
        }).filter(item => item.deuda > 0).sort((a, b) => {
              if (a.estado === 'realizado' && b.estado !== 'realizado') return -1;
              if (a.estado !== 'realizado' && b.estado === 'realizado') return 1;
              return 0;
        });
        setDeudasPaciente(itemsConDeuda);
    } catch (e) { console.error(e); toast.error("Error al cargar las deudas del paciente"); setModalPagoAbierto(false); } finally { setCargandoDeudas(false); }
  }

  const procesarPagoCaja = async () => {
    if (!montoIngresado || Number(montoIngresado) <= 0) return toast.error("Ingrese un monto válido a recaudar");
    if ((metodoPago === 'tarjeta' || metodoPago === 'transferencia') && !codigoTransaccion.trim()) return toast.error("Ingrese el código de transacción o comprobante");

    setCargandoAccion(true); let montoRestante = Number(montoIngresado);
    try {
        const { error: errPago } = await supabase.from('pagos').insert([{ paciente_id: pacientePago.id, monto: Number(montoIngresado), metodo_pago: metodoPago, numero_referencia: codigoTransaccion.trim() || null, fecha_pago: new Date().toISOString() }]);
        if (errPago) console.warn("Error al registrar en tabla pagos", errPago);

        for (const item of deudasPaciente) {
            if (montoRestante <= 0) break;
            const aAbonar = Math.min(item.deuda, montoRestante);
            await supabase.from('presupuesto_items').update({ abonado: Number(item.abonado) + aAbonar }).eq('id', item.id);
            montoRestante -= aAbonar;
        }
        toast.success(`Pago de $${Number(montoIngresado).toLocaleString('es-CL')} procesado.`);
        setModalPagoAbierto(false); setMontoIngresado(''); setCodigoTransaccion('');
        await fetchCitasAgenda(); 
    } catch (e) { toast.error("Ocurrió un error al procesar el pago"); } finally { setCargandoAccion(false); }
  }

  const calcularDeudaTotalCaja = () => deudasPaciente.reduce((acc, curr) => acc + curr.deuda, 0);

  if (cargandoPagina) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500 mb-4" size={40} /></div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 pb-24 text-left">
      
      <AnimatePresence>
        {notificacion && (
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed top-24 right-8 z-[9999] bg-white text-slate-900 px-5 py-4 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-100 flex items-center gap-4 min-w-[280px]">
            <div className="bg-amber-100 text-amber-600 p-3 rounded-2xl"><Timer size={20} /></div>
            <div className="flex-1 text-left"><p className="text-[10px] font-black uppercase text-amber-500 mb-0.5 tracking-widest text-left">En Sala de Espera</p><h4 className="font-black uppercase text-sm leading-tight text-slate-800 text-left">{notificacion.nombre}</h4></div>
            <button onClick={() => setNotificacion(null)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-6 md:px-12 py-5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 shadow-[0_4px_30px_-10px_rgba(0,0,0,0.05)]">
        
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10 w-full xl:w-auto">
          <div className="space-y-1.5 text-left">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Agenda Clínica</h1>
            <div className="flex items-center gap-2 text-slate-500">
               <Stethoscope size={14}/>
               <select className="text-[11px] font-bold uppercase bg-transparent outline-none cursor-pointer hover:text-blue-600 transition-colors" value={filtroEspecialista} onChange={(e) => setFiltroEspecialista(e.target.value)}>
                 <option value="Todos">Todos los especialistas</option>
                 {profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
               </select>
            </div>
          </div>
          
          <div className="flex items-center gap-4 xl:border-l xl:border-slate-200 xl:pl-10 w-full xl:w-auto overflow-x-auto pb-2 md:pb-0">
              
              <div className="flex items-center bg-slate-100/80 rounded-2xl p-1.5 border border-slate-200 shrink-0 shadow-sm">
                  <button onClick={() => setVistaAgenda('dia')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${vistaAgenda === 'dia' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                      <List size={14}/> Día
                  </button>
                  <button onClick={() => setVistaAgenda('semana')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${vistaAgenda === 'semana' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                      <LayoutGrid size={14}/> Semana
                  </button>
              </div>
              
              <div className="flex items-center bg-white rounded-2xl p-1.5 border border-slate-200 shrink-0 shadow-sm">
                <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()-(vistaAgenda === 'semana'?7:1))))} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"><ChevronLeft size={18}/></button>
                
                <div className="relative flex items-center justify-center px-4 cursor-pointer group" onClick={() => { try { dateInputRef.current?.showPicker(); } catch (e) { dateInputRef.current?.focus(); } }}>
                   <CalendarIcon size={16} className="mr-2.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                   <span className="text-xs font-black capitalize min-w-[130px] text-center text-slate-700 group-hover:text-blue-600 transition-colors">{vistaAgenda === 'dia' ? selectedDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Semana Actual'}</span>
                   <input ref={dateInputRef} type="date" className="sr-only" value={getLocalDateISO(selectedDate)} onChange={(e) => { if(e.target.value) { const [y, m, d] = e.target.value.split('-'); setSelectedDate(new Date(Number(y), Number(m)-1, Number(d))); } }} />
                </div>

                <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()+(vistaAgenda === 'semana'?7:1))))} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"><ChevronRight size={18}/></button>
              </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto shrink-0">
          
          <button onClick={() => {
              setProfesionalBloqueo(filtroEspecialista === 'Todos' ? '' : filtroEspecialista);
              setModalBloqueo(true);
          }} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-sm hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 whitespace-nowrap">
            <Lock size={14} /> <span className="hidden md:inline">Bloquear</span>
          </button>

          <Link href="/semana" className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-sm hover:border-slate-300 hover:text-blue-600 transition-all flex items-center gap-2 whitespace-nowrap">
            <CalendarDays size={14} className="text-blue-500" /> <span className="hidden md:inline">Bloque Semanal</span>
          </Link>

          <Link href="/agenda/reprogramar" className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-sm hover:border-slate-300 hover:text-slate-900 transition-all flex items-center gap-2 whitespace-nowrap">
            <CalendarClock size={14} className="text-purple-500" /> <span className="hidden md:inline">Reprogramar</span>
          </Link>

          <button onClick={() => { fetchCitasHuerfanas(); setModalHuerfanasAbierto(true); }} className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-sm hover:border-slate-300 hover:text-slate-900 transition-all flex items-center gap-2 whitespace-nowrap">
            <AlertTriangle size={14} className="text-amber-500" /> <span className="hidden md:inline">Huérfanas</span>
          </button>

          <button onClick={() => { resetEstados(); setModalAbierto(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-md hover:bg-slate-800 transition-all flex items-center gap-2 whitespace-nowrap ml-1">
            <Plus size={14} strokeWidth={3} /> Agendar
          </button>
        </div>
      </header>

      <main className={`mx-auto w-full pt-8 px-6 text-left ${vistaAgenda === 'dia' ? 'max-w-5xl' : 'max-w-full'}`}>
        
        {/* BUSCADOR Y CONTADOR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 text-left">
           <div className="relative w-full max-w-md group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                 type="text" 
                 placeholder="Buscar por paciente o RUT..." 
                 className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-full text-xs font-bold outline-none shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 transition-all"
                 value={busquedaAgenda}
                 onChange={(e) => setBusquedaAgenda(e.target.value)}
              />
           </div>
           
           <div className="bg-white text-slate-600 px-5 py-2.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2 shrink-0">
              <CalendarDays size={14} className="text-blue-500" />
              <span className="font-black text-xs uppercase tracking-widest">{citasFiltradas.length} Citas hoy</span>
           </div>
        </div>

        {/* VISTA DIARIA (TIMELINE) */}
        {vistaAgenda === 'dia' && (
            <div className="space-y-4 text-left relative pb-20">
              {citasFiltradas.length > 0 && ( <div className="absolute left-[88px] top-6 bottom-0 w-px bg-slate-200 hidden md:block z-0"></div> )}
              
              {citasFiltradas.length > 0 ? citasFiltradas.map(c => {
                const hInicio = new Date(c.inicio).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
                const hFin = new Date(c.fin).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
                const configEstado = ESTADOS_CITA[c.estado] || ESTADOS_CITA.programada;
                const hLlegadaStr = c.hora_llegada ? new Date(c.hora_llegada).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }) : null;
                const doctor = profesionales.find(p => p.user_id === c.profesional_id);
                
                const pNombre = c.pacientes?.nombre || 'S/N';
                const pApellido = c.pacientes?.apellido || '';
                const avatarColor = getAvatarColor(pNombre + pApellido);

                return (
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} key={c.id} className="flex flex-col md:flex-row items-start gap-3 md:gap-6 relative z-10 text-left">
                    
                    <div className="w-full md:w-16 pt-3 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-1 shrink-0 text-left">
                      <span className="text-lg font-black text-slate-800 tracking-tighter leading-none">{hInicio}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{hFin}</span>
                    </div>
                    
                    <div className="hidden md:flex pt-4 relative text-left">
                       <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow-[0_0_0_4px_#F8FAFC]"></div>
                    </div>
                    
                    <div className="flex-1 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] hover:border-slate-300 transition-all flex flex-col gap-4 w-full text-left">
                      
                      <div className="flex items-start justify-between gap-3 text-left">
                         <div className="flex items-center gap-3 text-left">
                            <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center font-black text-xs tracking-widest shadow-inner ring-2 ring-slate-50 shrink-0`}>
                               {getInitials(pNombre, pApellido)}
                            </div>
                            <div className="text-left text-slate-900">
                               <h3 className="text-base font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{pNombre} {pApellido}</h3>
                               <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                  <span>RUT: {c.pacientes?.rut || 'S/N'}</span>
                                  <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-200"></span>
                                  <span className="flex items-center gap-1"><Stethoscope size={10} className="text-blue-500"/> Dr. {doctor?.apellido || 'S/A'}</span>
                               </div>
                            </div>
                         </div>
                         <div className={`relative flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-xl transition-colors ${configEstado.bg} ${configEstado.text} border border-transparent hover:border-slate-200 shrink-0 text-left`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${configEstado.dot}`}></div>
                            <select value={c.estado || 'programada'} onChange={(e) => actualizarEstadoCita(c.id, e.target.value)} className="appearance-none bg-transparent font-black text-[9px] uppercase outline-none cursor-pointer pr-5 w-full text-inherit">
                              {Object.entries(ESTADOS_CITA).map(([key, val]) => ( <option key={key} value={key} className="text-slate-800">{val.label.toUpperCase()}</option> ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={10}/>
                         </div>
                      </div>
                      
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-t border-slate-100 pt-3 text-left">
                         <div className="flex items-center gap-2 flex-wrap text-left text-slate-900">
                            {/* ALERTA REALTIME DE COBRO */}
                            {c.requiereCobroInmediato ? (
                               <span onClick={() => abrirCaja(c)} className="text-[9px] font-black text-white uppercase tracking-widest bg-red-500 px-2 py-1 rounded-lg shadow-sm animate-pulse cursor-pointer hover:scale-105 transition-transform">
                                  🔔 Por Cobrar: ${c.finanzas?.deuda_realizada.toLocaleString('es-CL')}
                               </span>
                            ) : c.estadoFinanciero === 'deuda' && ( 
                               <span className="text-[9px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-lg border border-red-100/50 flex items-center gap-1">
                                  Deuda: ${c.finanzas?.deuda.toLocaleString('es-CL')}
                               </span> 
                            )}

                            {c.estadoFinanciero === 'saldado' && ( <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/50 flex items-center gap-1">Saldado</span> )}
                            {c.estadoFinanciero === 'sin_saldo' && ( <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/50 flex items-center gap-1">Sin Saldo</span> )}
                            {c.estado === 'en_espera' && hLlegadaStr && ( <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase tracking-widest px-2 py-1 bg-amber-50 rounded-lg"><Timer size={12} /> Sala ({hLlegadaStr})</div> )}
                         </div>
                         
                         {/* TOOLBAR */}
                         <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1 w-full xl:w-auto text-left overflow-x-auto">
                            <button onClick={() => contactarWhatsApp(c.pacientes?.telefono, c.pacientes?.nombre, c.estado, hInicio)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-all shrink-0" title="WhatsApp Inteligente">
                                <MessageCircle size={14}/>
                            </button>
                            <button onClick={() => abrirEnvioPresupuesto(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shrink-0" title="Enviar Presupuesto">
                                <FileText size={14}/>
                            </button>
                            <button onClick={() => abrirCaja(c)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-white rounded-lg transition-all shrink-0" title="Caja / Pagar">
                                <Coins size={14}/>
                            </button>
                            <Link href={`/pacientes/${c.paciente_id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all flex items-center gap-1.5 font-black text-[9px] uppercase pr-3 shrink-0" title="Ver Ficha">
                                <ClipboardList size={14}/> Ficha
                            </Link>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                )
              }) : ( 
                <div className="flex flex-col items-center justify-center opacity-40 py-24 text-center text-slate-500 bg-transparent rounded-3xl border-2 border-dashed border-slate-200">
                   <CalendarIcon size={48} className="mb-3 text-slate-300"/>
                   <h3 className="font-black uppercase text-base tracking-widest text-center text-slate-700">Agenda Libre</h3>
                   <p className="mt-1 font-bold text-xs tracking-wide text-center">No hay citas programadas para este día.</p>
                </div> 
              )}
            </div>
        )}

        {/* VISTA SEMANAL (GRID DE LUNES A SÁBADO) COMPACTA */}
        {vistaAgenda === 'semana' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pb-20">
                {getDiasLunesSabado(selectedDate).map(dia => {
                    const diaISO = getLocalDateISO(dia);
                    const citasEsteDia = citasFiltradas.filter(c => c.inicio.startsWith(diaISO));
                    
                    return (
                        <div key={diaISO} className="flex flex-col gap-2">
                            <div className="bg-slate-200/50 rounded-xl p-2.5 text-center sticky top-28 z-10 backdrop-blur-md border border-slate-200 shadow-sm">
                                <p className="text-[9px] font-black uppercase text-slate-500">{dia.toLocaleDateString('es-CL', {weekday: 'long'})}</p>
                                <p className="text-base font-black text-slate-800">{dia.getDate()}</p>
                            </div>
                            
                            <div className="flex flex-col gap-2.5">
                                {citasEsteDia.length > 0 ? citasEsteDia.map(c => {
                                    const hInicio = new Date(c.inicio).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
                                    const configEstado = ESTADOS_CITA[c.estado] || ESTADOS_CITA.programada;
                                    const pNombre = c.pacientes?.nombre || 'S/N';
                                    const pApellido = c.pacientes?.apellido || '';
                                    
                                    return (
                                        <div key={c.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                            <div className={`absolute top-0 left-0 bottom-0 w-1 ${configEstado.bg} border-r ${configEstado.bg.replace('bg-', 'border-')}`}></div>
                                            <div className="pl-2">
                                                <p className="text-xs font-black text-slate-900 leading-tight mb-1 truncate">{pNombre} {pApellido}</p>
                                                
                                                <div className="flex flex-col items-start gap-1.5 mt-2">
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{hInicio}</span>
                                                        <span className={`text-[8px] font-black uppercase ${configEstado.text}`}>{configEstado.label}</span>
                                                    </div>
                                                    
                                                    {/* FINANZAS EN VISTA SEMANAL */}
                                                    {c.requiereCobroInmediato ? (
                                                        <span className="w-full text-center text-[8px] font-black text-white bg-red-500 px-1.5 py-1 rounded shadow-sm animate-pulse cursor-pointer" onClick={(e) => { e.stopPropagation(); abrirCaja(c); }}>
                                                           🔔 Cobrar: ${c.finanzas?.deuda_realizada.toLocaleString('es-CL')}
                                                        </span>
                                                    ) : c.estadoFinanciero === 'deuda' ? (
                                                        <span className="text-[8px] font-black text-red-600 bg-red-50 px-1.5 py-1 rounded border border-red-100 w-full text-center">Deuda: ${c.finanzas?.deuda.toLocaleString('es-CL')}</span>
                                                    ) : c.estadoFinanciero === 'saldado' ? (
                                                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-1 rounded border border-emerald-100 w-full text-center">Saldado</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            
                                            {/* Hover Toolbar Mini */}
                                            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                                <button onClick={() => abrirEnvioPresupuesto(c)} className="p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-all"><FileText size={14}/></button>
                                                <button onClick={() => contactarWhatsApp(c.pacientes?.telefono, c.pacientes?.nombre, c.estado, hInicio)} className="p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 rounded-md transition-all"><MessageCircle size={14}/></button>
                                                <button onClick={() => abrirCaja(c)} className="p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 rounded-md transition-all"><Coins size={14}/></button>
                                            </div>
                                        </div>
                                    )
                                }) : (
                                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl opacity-40">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin citas</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        )}
      </main>

      {/* MODAL ENVÍO DE PRESUPUESTO WHATSAPP */}
      <AnimatePresence>
        {modalEnvioPresupuesto.abierto && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left bg-emerald-50">
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-sm"><Send size={20}/></div>
                      <div>
                        <h2 className="font-black text-lg uppercase tracking-tighter text-emerald-600 leading-none">Enviar Presupuesto</h2>
                        <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Pre-armado automático</p>
                      </div>
                   </div>
                   <button onClick={() => setModalEnvioPresupuesto({...modalEnvioPresupuesto, abierto: false})} className="p-2 text-emerald-500 hover:bg-emerald-200 rounded-full transition-colors"><X size={18}/></button>
                </div>
                <div className="p-6 md:p-8 space-y-4">
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">Puedes editar el texto antes de enviarlo. Al hacer clic en enviar, se abrirá WhatsApp Web/Móvil con este mensaje listo para tu paciente <span className="font-black text-slate-800">{modalEnvioPresupuesto.cita?.pacientes?.nombre}</span>.</p>
                    
                    <textarea 
                        className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:border-emerald-500 transition-all shadow-inner resize-none custom-scrollbar"
                        value={modalEnvioPresupuesto.texto}
                        onChange={(e) => setModalEnvioPresupuesto({...modalEnvioPresupuesto, texto: e.target.value})}
                    />
                </div>
                <div className="p-6 md:p-8 border-t border-slate-100 bg-white shrink-0 text-left">
                   <button 
                       onClick={() => {
                           const telefono = modalEnvioPresupuesto.cita?.pacientes?.telefono?.replace(/\D/g, '');
                           if (!telefono) return toast.error("El paciente no tiene teléfono registrado");
                           window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(modalEnvioPresupuesto.texto)}`, '_blank');
                           setModalEnvioPresupuesto({...modalEnvioPresupuesto, abierto: false});
                       }} 
                       className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                   >
                      <MessageCircle size={16}/> Abrir WhatsApp y Enviar
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL BLOQUEO RÁPIDO */}
      <AnimatePresence>
        {modalBloqueo && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left bg-red-50">
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 bg-red-500 text-white rounded-xl shadow-sm"><Lock size={20}/></div>
                      <div>
                        <h2 className="font-black text-lg uppercase tracking-tighter text-red-600 leading-none">Bloquear Agenda</h2>
                        <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest mt-1">Cierra el día seleccionado</p>
                      </div>
                   </div>
                   <button onClick={() => setModalBloqueo(false)} className="p-2 text-red-400 hover:bg-red-200 rounded-full transition-colors"><X size={18}/></button>
                </div>
                <div className="p-8 space-y-6">
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">Se bloqueará la agenda para el <span className="font-black text-red-500">{selectedDate.toLocaleDateString('es-CL')}</span>. Nadie podrá agendar en este día.</p>
                    
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Doctor a bloquear</label>
                       <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-red-500 transition-all shadow-sm cursor-pointer" value={profesionalBloqueo} onChange={(e) => setProfesionalBloqueo(e.target.value)}>
                           <option value="">Seleccione especialista...</option>
                           {profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                       </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Motivo del bloqueo</label>
                        <input type="text" placeholder="Ej: Licencia Médica, Trámite..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-red-500 transition-all shadow-sm" value={motivoBloqueo} onChange={(e) => setMotivoBloqueo(e.target.value)} />
                    </div>
                </div>
                <div className="p-6 md:p-8 border-t border-slate-100 bg-white shrink-0 text-left">
                   <button onClick={handleGuardarBloqueoRapido} disabled={cargandoAccion || !motivoBloqueo.trim() || !profesionalBloqueo} className="w-full py-4 bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {cargandoAccion ? <Loader2 className="animate-spin" size={16}/> : <Ban size={16}/>} Confirmar Bloqueo
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CAJA (RECAUDACIÓN DE PAGOS) */}
      <AnimatePresence>
        {modalPagoAbierto && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left bg-white">
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm"><ReceiptText size={24}/></div>
                      <div>
                        <h2 className="font-black text-xl uppercase tracking-tighter text-slate-900 leading-none">Caja y Pagos</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Paciente: {pacientePago?.nombre} {pacientePago?.apellido}</p>
                      </div>
                   </div>
                   <button onClick={() => setModalPagoAbierto(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 md:p-8 bg-slate-50 flex-1 overflow-y-auto custom-scrollbar text-left text-slate-900">
                    {cargandoDeudas ? (
                        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={40}/></div>
                    ) : deudasPaciente.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                           <CheckCircle2 size={60} className="mx-auto text-emerald-400 mb-4 opacity-50"/>
                           <p className="text-sm font-black uppercase tracking-widest text-slate-600">Al día</p>
                           <p className="text-xs mt-1">El paciente no tiene tratamientos aprobados con deuda pendiente.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 text-left">
                           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm text-left">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Deuda Pendiente</h4>
                              <p className="text-4xl font-black text-slate-900 tracking-tighter">${calcularDeudaTotalCaja().toLocaleString('es-CL')}</p>
                           </div>

                           <div className="text-left text-slate-900">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Detalle a pagar</h4>
                              <div className="space-y-2">
                                 {deudasPaciente.map(d => (
                                     <div key={d.id} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left">
                                         <div className="text-left">
                                            <div className="flex items-center gap-3">
                                                <p className="text-xs font-black uppercase text-slate-800 leading-none">{d.nombreDisplay}</p>
                                                <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase leading-none ${d.estado === 'realizado' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                                                    {d.estado}
                                                </span>
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 mt-2 tracking-widest">Pactado: ${Number(d.precio_pactado).toLocaleString('es-CL')} | Pagado: ${Number(d.abonado).toLocaleString('es-CL')}</p>
                                         </div>
                                         <p className="text-sm font-black text-red-500">${d.deuda.toLocaleString('es-CL')}</p>
                                     </div>
                                 ))}
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-200 text-left text-slate-900">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Método de Pago</label>
                                 <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-500 transition-all shadow-sm cursor-pointer" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                                     <option value="tarjeta">Tarjeta (Débito/Crédito)</option>
                                     <option value="efectivo">Efectivo</option>
                                     <option value="transferencia">Transferencia</option>
                                 </select>
                              </div>
                              <div className="space-y-2 text-left">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Monto a Recaudar ($)</label>
                                 <input type="number" placeholder="Ej: 50000" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-lg text-emerald-600 outline-none focus:border-emerald-500 placeholder:text-slate-300 transition-all shadow-sm" value={montoIngresado} onChange={(e) => setMontoIngresado(Number(e.target.value))} />
                              </div>
                              
                              {(metodoPago === 'tarjeta' || metodoPago === 'transferencia') && (
                                <div className="space-y-2 md:col-span-2 text-left">
                                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Cód. Transacción / Comprobante</label>
                                   <input type="text" placeholder="Ej: TX-123456789" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 placeholder:text-slate-300 uppercase transition-all shadow-sm" value={codigoTransaccion} onChange={(e) => setCodigoTransaccion(e.target.value)} />
                                </div>
                              )}
                           </div>
                        </div>
                    )}
                </div>

                <div className="p-6 md:p-8 border-t border-slate-100 bg-white shrink-0 text-left">
                   <button 
                      onClick={procesarPagoCaja}
                      disabled={cargandoAccion || deudasPaciente.length === 0 || !montoIngresado}
                      className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                   >
                      {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : <Coins size={18}/>}
                      Registrar Pago Seguro
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CITAS HUÉRFANAS */}
      <AnimatePresence>
        {modalHuerfanasAbierto && (
          <div className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pb-4 pt-16 md:pt-24 bg-slate-900/60 backdrop-blur-sm text-slate-900 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative text-slate-900 text-left">
              <div className="p-6 md:p-8 border-b border-amber-100 bg-amber-50 flex justify-between items-center shrink-0 text-left">
                <div className="flex items-center gap-5 text-left">
                  <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-sm"><AlertTriangle size={24} /></div>
                  <div>
                    <h2 className="font-black uppercase text-xl tracking-tight text-slate-900 leading-none text-left">Citas Huérfanas</h2>
                    <p className="text-amber-600 text-[10px] font-bold uppercase tracking-widest mt-1">Requieren Reagendamiento</p>
                  </div>
                </div>
                <button onClick={() => setModalHuerfanasAbierto(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all text-left"><X size={20} /></button>
              </div>
              
              <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50/50">
                {cargandoHuerfanas ? (
                  <div className="h-full py-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Loader2 className="animate-spin" size={40} />
                    <p className="text-xs font-black uppercase tracking-widest">Analizando agenda global...</p>
                  </div>
                ) : citasHuerfanas.length === 0 ? (
                  <div className="h-full py-12 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-60">
                    <CheckCircle2 size={60} className="text-emerald-500" />
                    <p className="text-sm font-black uppercase tracking-widest text-slate-600">No hay citas huérfanas</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-500 mb-6">Se encontraron <span className="font-black text-amber-600">{citasHuerfanas.length} citas</span> afectadas por bloqueos.</p>
                    {citasHuerfanas.map(cita => {
                      const fechaFormat = new Date(cita.inicio).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
                      const horaFormat = new Date(cita.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' });
                      
                      return (
                        <div key={cita.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-xl bg-amber-50 text-amber-600 flex flex-col items-center justify-center border border-amber-100 shrink-0">
                              <span className="text-xs font-black">{horaFormat}</span>
                            </div>
                            <div>
                              <h4 className="font-black text-sm text-slate-800 uppercase leading-none">{cita.pacientes?.nombre} {cita.pacientes?.apellido}</h4>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-[9px] font-bold text-slate-500 tracking-widest bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                                  <CalendarDays size={10} className="inline mr-1"/> {fechaFormat}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 self-end md:self-center">
                            <button onClick={() => { setModalHuerfanasAbierto(false); iniciarReprogramacion(cita); }} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all flex items-center gap-2 shadow-sm">
                              <CalendarClock size={14} className="text-purple-500" /> Reagendar
                            </button>
                            <button onClick={async () => { if(confirm("¿Anular cita?")) { await actualizarEstadoCita(cita.id, 'cancelada'); setCitasHuerfanas(prev => prev.filter(c => c.id !== cita.id)); } }} className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm">
                              <Ban size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE AGENDAMIENTO / REAGENDAMIENTO */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pb-4 pt-16 md:pt-24 bg-slate-900/60 backdrop-blur-sm text-slate-900 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-7xl h-full max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative text-slate-900 text-left">
              <div className="p-6 md:p-8 border-b border-slate-100 bg-white flex justify-between items-center shrink-0 text-left">
                <div className="flex items-center gap-5 text-left"><div className={`p-3 rounded-2xl ${citaEnReprogramacion ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}><CalendarDays size={24} /></div><h2 className="font-black uppercase text-xl tracking-tight text-slate-900 leading-none text-left">{citaEnReprogramacion ? 'Reagendar Cita' : 'Nueva Reserva'} • Paso {paso}</h2></div>
                <button onClick={() => { setModalAbierto(false); setCitaEnReprogramacion(null); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all text-left"><X size={20} /></button>
              </div>
              <div className="flex flex-1 overflow-hidden">
                {paso === 1 ? (
                  <>
                    <aside className="w-[300px] border-r border-slate-200 p-8 bg-slate-50 space-y-8 overflow-y-auto hidden md:block text-left text-slate-900">
                      <div className={`p-6 rounded-2xl shadow-sm border text-left ${citaEnReprogramacion ? 'bg-white border-purple-200' : 'bg-white border-blue-200'}`}><p className="text-[10px] font-black uppercase mb-1 text-slate-400 tracking-widest text-left">Seleccionado</p><p className={`text-4xl font-black leading-none text-left ${citaEnReprogramacion ? 'text-purple-600' : 'text-blue-600'}`}>{horasSeleccionadas.length}</p></div>
                      <div className="space-y-6 text-left">
                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">Especialista</label>
                          <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-900 cursor-pointer shadow-sm focus:border-blue-500" value={filtro.profesional_id || ""} onChange={(e) => { setFiltro({...filtro, profesional_id: e.target.value}); setHorasSeleccionadas([]); }}><option value="">Seleccionar...</option>{profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}</select>
                        </div>
                        <div className="space-y-2 text-left"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">Duración base</label><div className="grid grid-cols-2 gap-2 text-left">{duracionesDisponibles.slice(0,4).map(m => ( <button key={m} onClick={() => setFiltro({...filtro, duracionDefault: m})} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${filtro.duracionDefault === m ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 shadow-sm'}`}>{m}m</button> ))}</div></div>
                      </div>
                    </aside>
                    <main className="flex-1 p-6 md:p-8 bg-[#F8FAFC] overflow-hidden flex flex-col text-slate-900 text-left">
                      <div className="flex justify-between items-center mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-left">
                        <button onClick={() => navegarSemana('atras')} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg font-black text-[10px] uppercase text-slate-500 transition-all text-left"><ChevronLeft size={14}/> Ant.</button>
                        <span className="font-black text-xs uppercase tracking-widest text-slate-600 text-center">Disponibilidad</span>
                        <button onClick={() => navegarSemana('adelante')} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg font-black text-[10px] uppercase text-slate-700 transition-all text-left">Sig. <ChevronRight size={14}/></button>
                      </div>
                      <div className="flex-1 grid grid-cols-6 gap-2 md:gap-4 overflow-y-auto pr-2 custom-scrollbar text-left text-slate-900">
                        {getDiasLunesSabado(semanaInicio).map(dia => { 
                          const fStr = dia.toLocaleDateString('sv-SE'); 
                          const diaBloqueado = bloqueosSemana.some(b => b.fecha === fStr); 

                          return ( 
                            <div key={fStr} className="space-y-2 text-center text-slate-900 relative">
                              <p className="text-[10px] font-black uppercase text-slate-500 bg-white py-2 rounded-lg border border-slate-200 shadow-sm">{dia.toLocaleDateString('es-CL', {weekday: 'short', day: 'numeric'})}</p>
                              {diaBloqueado && (
                                <div className="absolute top-10 inset-x-0 z-10 flex flex-col items-center justify-start pt-10 h-full bg-white/60 backdrop-blur-[1px] rounded-lg">
                                  <Ban className="text-red-500 mb-2" size={20} />
                                </div>
                              )}
                              <div className="space-y-1.5 text-left text-slate-900">
                                {slotsHorarios.map(h => { 
                                  const laboral = esHorarioLaboral(fStr, h); 
                                  const ocupado = esCitaOcupada(fStr, h); 
                                  const sel = horasSeleccionadas.some(x => x.fecha === fStr && x.hora === h); 
                                  
                                  let btnClass = "w-full py-2.5 text-[10px] font-black rounded-lg border transition-all "; 
                                  if (sel) btnClass += "bg-blue-600 text-white border-blue-600 shadow-md"; 
                                  else if (ocupado || diaBloqueado) btnClass += "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed opacity-50 line-through decoration-slate-300"; 
                                  else if (laboral) btnClass += "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 shadow-sm"; 
                                  else btnClass += "bg-transparent text-slate-300 border-transparent cursor-not-allowed opacity-40"; 
                                  
                                  return ( 
                                    <button 
                                      key={h} 
                                      disabled={(!laboral || ocupado || diaBloqueado) && !sel} 
                                      onClick={() => toggleHora(fStr, h)} 
                                      className={btnClass}
                                    >
                                      {h}
                                    </button> 
                                  ) 
                                })}
                              </div>
                            </div> 
                          ) 
                        })}
                      </div>
                    </main>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white text-slate-900 text-left">
                    <div className="w-full md:w-1/2 border-r border-slate-200 p-8 md:p-12 bg-slate-50 overflow-y-auto space-y-6 text-left text-slate-900">
                        <h3 className="text-sm font-black uppercase text-slate-700 flex items-center gap-2 text-left"><Timer size={16}/> Ajustar Tiempos</h3>
                        {horasSeleccionadas.map((s, idx) => ( <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm text-left text-slate-900"><div className="text-left text-slate-900"><p className="text-[10px] font-black text-slate-400 uppercase text-left">{s.fecha}</p><p className="text-lg font-black text-slate-700 text-left">{s.hora} hrs</p></div><select className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none text-slate-900 focus:border-blue-500" value={s.duracion} onChange={(e) => { const c = [...horasSeleccionadas]; c[idx].duracion = Number(e.target.value); setHorasSeleccionadas(c); }}>{duracionesDisponibles.map(d => <option key={d} value={d} className="text-slate-900">{d} min</option>)}</select></div> ))}
                    </div>
                    <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto space-y-8 text-left text-slate-900">
                        <div className="space-y-4 text-left text-slate-900">
                            <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight text-left">Paciente</h3>
                            {citaEnReprogramacion ? ( <div className="p-6 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-between text-left"><div className="text-left text-slate-900"><p className="text-base font-black uppercase text-purple-900 leading-none text-left">{citaEnReprogramacion.pacientes?.nombre} {citaEnReprogramacion.pacientes?.apellido}</p><p className="text-[10px] font-bold text-purple-500 mt-2 tracking-widest text-left">RUT: {citaEnReprogramacion.pacientes?.rut}</p></div><RefreshCcw className="text-purple-500" size={20} /></div> ) : ( <div className="space-y-4 text-left text-slate-900">{modoNuevoPaciente ? ( <div className="grid grid-cols-1 gap-3 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm text-left"><input placeholder="Nombre" className="p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-500 text-slate-900" value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente(prev => ({...prev, nombre: e.target.value}))}/><input placeholder="Apellido" className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-500 text-slate-900" value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente(prev => ({...prev, apellido: e.target.value}))}/><input placeholder="RUT" className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-500 text-slate-900" value={nuevoPaciente.rut} onChange={e => setNuevoPaciente(prev => ({...prev, rut: e.target.value}))}/><input placeholder="Teléfono" className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-500 text-slate-900" value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente(prev => ({...prev, telefono: e.target.value}))}/></div> ) : ( <div className="text-left space-y-4 text-slate-900"><div className="relative group text-left"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input placeholder="Buscar por Nombre o RUT..." className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 shadow-sm text-slate-900" value={busqueda} onChange={e => {setBusqueda(e.target.value); buscarPacientes(e.target.value);}} /></div>{pacientesEncontrados.map(p => ( <button key={p.id} onClick={() => seleccionarPacienteExistente(p)} className="w-full p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 shadow-sm transition-all flex items-center justify-between text-left"><div className="text-left text-slate-900"><p className="font-black text-sm uppercase text-left">{p.nombre} {p.apellido}</p><p className="text-[10px] font-bold text-slate-400 text-left mt-1">{p.rut}</p></div><ChevronRightIcon size={16} className="text-slate-300"/></button> ))}{pacienteSeleccionado && pacientesEncontrados.length === 0 && ( <div className="p-5 rounded-2xl border border-blue-500 bg-blue-50 flex items-center justify-between text-left text-slate-900"><p className="font-black text-sm uppercase text-blue-900 text-left">{pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}</p><CheckCircle2 className="text-blue-500" /></div> )}</div> )}</div> )}
                        </div>
                        {(pacienteSeleccionado || modoNuevoPaciente) && ( <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-slate-900 rounded-2xl text-white shadow-xl text-left"><h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2 tracking-widest text-left"><Briefcase size={14}/> Tratamiento</h4>{!modoNuevoPaciente && tratamientosPaciente.length > 0 ? ( <div className="space-y-3 text-left"><label className="text-[9px] font-bold text-slate-400 uppercase pl-1 text-left">Plan activo</label><select className="w-full p-4 bg-white/10 rounded-xl font-bold text-xs outline-none border border-transparent focus:border-blue-500 text-white appearance-none cursor-pointer" value={tratamientoSeleccionadoId || ''} onChange={(e) => { const val = e.target.value; setTratamientoSeleccionadoId(val); if (val !== 'MANUAL') { const t = tratamientosPaciente.find(x => x.id === val); setNuevoTratamientoNombre(t?.nombre_tratamiento || ''); } else setNuevoTratamientoNombre(''); }}>{tratamientosPaciente.map(t => <option key={t.id} value={t.id} className="text-slate-900">{t.nombre_tratamiento.toUpperCase()}</option>)}<option value="MANUAL" className="text-slate-900 italic">+ OTRO MOTIVO</option></select>{(tratamientoSeleccionadoId === 'MANUAL' || !tratamientoSeleccionadoId) && ( <input placeholder="Especifique motivo..." className="w-full p-4 bg-white/10 rounded-xl font-bold text-xs outline-none border border-transparent focus:border-blue-500 text-white uppercase mt-2 shadow-inner" value={nuevoTratamientoNombre} onChange={(e) => setNuevoTratamientoNombre(e.target.value)} /> )}</div> ) : ( <input placeholder="Ej: Evaluación General, Urgencia..." className="w-full p-4 bg-white/10 rounded-xl font-bold text-xs outline-none border border-transparent focus:border-blue-500 text-white uppercase" value={nuevoTratamientoNombre} onChange={(e) => setNuevoTratamientoNombre(e.target.value)} /> )}</motion.div> )}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 text-slate-900 text-left">
                 <div className="flex items-center gap-3 text-left text-slate-900">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-600 font-black border border-slate-200 shadow-sm">{horasSeleccionadas.length}</div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Turnos</p>
                 </div>
                 <div className="flex gap-3 items-center text-left text-slate-900 w-full sm:w-auto">
                    <button onClick={() => { setModoNuevoPaciente(!modoNuevoPaciente); setPacienteSeleccionado(null); setBusqueda(''); }} className="text-[10px] font-black text-blue-600 uppercase underline mr-4 text-left whitespace-nowrap">{paso === 2 && !citaEnReprogramacion && (modoNuevoPaciente ? 'Buscar Existente' : '+ Registrar Nuevo')}</button>
                    {paso === 2 && <button onClick={() => setPaso(1)} className="px-6 py-3.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase text-slate-600 hover:bg-slate-100 shadow-sm transition-all text-left">Atrás</button>}
                    <button disabled={cargandoAccion || horasSeleccionadas.length === 0 || (paso === 2 && !modoNuevoPaciente && !pacienteSeleccionado)} onClick={() => { if(paso === 1) { setPaso(2); } else { handleGuardar(); } }} className={`px-10 py-3.5 rounded-xl font-black text-white text-[10px] uppercase shadow-md transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto ${citaEnReprogramacion ? 'bg-purple-600 hover:bg-purple-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                        {cargandoAccion ? <Loader2 className="animate-spin" size={16} /> : (paso === 1 ? 'Continuar' : citaEnReprogramacion ? 'Confirmar Cambio' : 'Agendar Cita')}
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mostrarTicket && (
            <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 text-slate-900 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm text-left text-slate-900">
                <div className="bg-white rounded-3xl shadow-2xl p-10 text-center space-y-6 text-slate-900">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
                    <h2 className="text-xl font-black uppercase text-slate-900">¡Cita Lista!</h2>
                    <div className="text-left bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 text-slate-900">
                        <div className="text-left text-slate-900"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Paciente</p><p className="font-bold text-sm text-slate-800 uppercase leading-tight text-left mt-1">{citaConfirmadaData?.paciente}</p></div>
                        <div className="text-left text-slate-900"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Fecha y Hora</p><p className="font-bold text-sm text-slate-800 uppercase leading-tight text-left mt-1">{citaConfirmadaData?.citas[0]?.fecha} • {citaConfirmadaData?.citas[0]?.hora} hrs</p></div>
                    </div>
                    <button onClick={() => { setMostrarTicket(false); setModalAbierto(false); resetEstados(); }} className="w-full py-4 bg-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-md hover:bg-slate-800 transition-all">Finalizar</button>
                </div>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  )
}