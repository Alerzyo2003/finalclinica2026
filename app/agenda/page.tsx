'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  X, Search, ChevronLeft, ChevronRight, Loader2, Clock, 
  CalendarDays, Timer, UserCheck, Trash2, Activity, ClipboardList, 
  CheckCircle2, Plus, Calendar as CalendarIcon, Briefcase, 
  AlertTriangle, Phone, Mail, MessageCircle, Ban, RefreshCcw, ChevronDown, CalendarClock,
  Coins, ReceiptText, Stethoscope,Users, User, ChevronRight as ChevronRightIcon, LayoutGrid, List, Lock, FileText, Send, ArrowDown, Save, File, Link as LinkIcon
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

const slotsHorarios = [
  "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45",
  "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45",
  "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45",
  "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30", "17:45",
  "18:00", "18:15", "18:30", "18:45", "19:00", "19:15", "19:30", "19:45",
  "20:00", "20:15", "20:30", "20:45", "21:00"
];

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

const getAvatarColorClass = (name: string) => {
  const styles = [
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500' },
    { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-500' },
    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-500' },
    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-500' }
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return styles[Math.abs(hash) % styles.length];
}

const getLocalDateISO = (d: Date) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

const tToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
const minsToT = (m: number) => { const h = Math.floor(m / 60).toString().padStart(2, '0'); const min = (m % 60).toString().padStart(2, '0'); return `${h}:${min}`; }
const getMinsFromDateStr = (dtString: string) => { const timePart = dtString.includes('T') ? dtString.split('T')[1] : dtString.split(' ')[1]; return tToMins(timePart.substring(0,5)); }
const getLunes = (d: Date) => { const date = new Date(d); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); date.setHours(0,0,0,0); return date; }

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [vistaAgenda, setVistaAgenda] = useState<'dia' | 'semana'>('dia')
  const [citasDia, setCitasDia] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [cargandoPagina, setCargandoPagina] = useState(true)
  const [cambiandoFecha, setCambioFecha] = useState(false)
  const [filtroEspecialista, setFiltroEspecialista] = useState('Todos')
  const [citaEnReprogramacion, setCitaEnReprogramacion] = useState<any>(null)
  const [notificacion, setNotificacion] = useState<{ nombre: string } | null>(null)
  
  const [usuarioLogueado, setUsuarioLogueado] = useState<string | null>(null)
  const [userRol, setUserRol] = useState<string>('') 
  
  const puedeVerFinanzas = ['ADMIN', 'RECEPCIONISTA'].includes(userRol);
  const puedeVerAgendaCompleta = ['ADMIN', 'RECEPCIONISTA', 'ASISTENTE'].includes(userRol);

  const [busquedaAgenda, setBusquedaAgenda] = useState('')
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [realtimeTrigger, setRealtimeTrigger] = useState(0);

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
  const [citaEnEdicion, setCitaEnEdicion] = useState<string | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [nuevoEspecialista, setNuevoEspecialista] = useState('');
  const [duracionCitaEdicion, setDuracionCitaEdicion] = useState(45);
  const [semanaInicioEdicion, setSemanaInicioEdicion] = useState<Date>(getLunes(new Date()));
  const [dispoSemanaEdicion, setDispoSemanaEdicion] = useState<any[]>([]);
  const [cargandoSlotsEdicion, setCargandoSlotsEdicion] = useState(false);

  const [modalBloqueo, setModalBloqueo] = useState(false)
  const [profesionalBloqueo, setProfesionalBloqueo] = useState<string>('')
  const [motivoBloqueo, setMotivoBloqueo] = useState('Imprevisto Médico')
  const [bloqueoTodoElDia, setBloqueoTodoElDia] = useState(true)
  const [horaInicioBloqueo, setHoraInicioBloqueo] = useState('13:00')
  const [horaFinBloqueo, setHoraFinBloqueo] = useState('14:00')

  const [modoNuevoPaciente, setModoNuevoPaciente] = useState(false)
  const [esOtroDocumento, setEsOtroDocumento] = useState(false)
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
  const [cajaActivaId, setCajaActivaId] = useState<string | null>(null);
  const [montoIngresado, setMontoIngresado] = useState<number | ''>('')
  const [metodoPago, setMetodoPago] = useState('tarjeta')
  const [codigoTransaccion, setCodigoTransaccion] = useState('')
  
  const [saldoAFavor, setSaldoAFavor] = useState(0)
  const [deudaTotalPlanAgenda, setDeudaTotalPlanAgenda] = useState(0)
  const [planesDetalladosAgenda, setPlanesDetalladosAgenda] = useState<any[]>([])

  const [modalSeleccionTratamiento, setModalSeleccionTratamiento] = useState<{abierto: boolean, cita: any, tratamientos: any[]}>({abierto: false, cita: null, tratamientos: []});
  const [modalEnvioPresupuesto, setModalEnvioPresupuesto] = useState<{abierto: boolean, cita: any, texto: string}>({abierto: false, cita: null, texto: ''});

  const duracionesDisponibles = [15, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300];

  useEffect(() => {
    const setupNotificaciones = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const canalNotif = supabase.channel(`notificaciones-${user.id}-${Date.now()}`)
        .on('broadcast', { event: 'PACIENTE_EN_ESPERA' }, (payload) => {
          setNotificacion({ nombre: payload.payload.nombre });
          setTimeout(() => setNotificacion(null), 120000); 
        })
        .subscribe();

      const canalAgenda = supabase.channel(`agenda-realtime-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_items' }, () => setRealtimeTrigger(prev => prev + 1))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => setRealtimeTrigger(prev => prev + 1))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueos_agenda' }, () => setRealtimeTrigger(prev => prev + 1))
        .subscribe();

      return () => { 
          supabase.removeChannel(canalNotif);
          supabase.removeChannel(canalAgenda);
      }
    };
    setupNotificaciones();
  }, []);

  useEffect(() => { cargarBasicos() }, [])
  useEffect(() => { 
    setCambioFecha(true);
    fetchCitasAgenda().then(() => {
       // Pequeño delay artificial para que se note la transición fluida
       setTimeout(() => setCambioFecha(false), 300);
    });
  }, [selectedDate, filtroEspecialista, vistaAgenda, realtimeTrigger])
  
  useEffect(() => {
    if (modalAbierto && filtro.profesional_id) {
        fetchCitasOcupadas();
        fetchHorariosDoctor();
        fetchBloqueosSemana();
    }
  }, [semanaInicio, modalAbierto, filtro.profesional_id, realtimeTrigger])

  async function cargarBasicos() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let especialistaInicial = 'Todos';

      if (session?.user) {
         setUsuarioLogueado(session.user.id);
         
         const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).maybeSingle();
         if (perfil) {
            setUserRol(perfil.rol);
            const veAgendaCompleta = ['ADMIN', 'RECEPCIONISTA', 'ASISTENTE'].includes(perfil.rol);
            if (!veAgendaCompleta) {
                especialistaInicial = session.user.id;
                setFiltroEspecialista(session.user.id);
                setFiltro(prev => ({ ...prev, profesional_id: session.user.id }));
            }
         }
      }

      const { data: pro } = await supabase.from('profesionales').select('*, especialidades(nombre)').eq('activo', true)
      setProfesionales(pro || [])
      
      const { data: cajaActiva } = await supabase.from('sesiones_caja').select('id').eq('estado', 'abierta').maybeSingle();
      setCajaActivaId(cajaActiva?.id || null);

      if (pro?.length && especialistaInicial === 'Todos' && ['ADMIN', 'RECEPCIONISTA', 'ASISTENTE'].includes(userRol)) {
          setFiltro(prev => ({ ...prev, profesional_id: pro[0].user_id || '' }))
      }

      await fetchCitasAgenda(especialistaInicial);

    } finally { setCargandoPagina(false) }
  }

  async function fetchCitasAgenda(especialistaForzado?: string) {
    let inicioRango, finRango;

    if (vistaAgenda === 'dia') {
        const fechaLocalStr = getLocalDateISO(selectedDate);
        inicioRango = `${fechaLocalStr}T00:00:00`;
        finRango = `${fechaLocalStr}T23:59:59`;
    } else {
        const dias = getDiasLunesSabado(selectedDate);
        inicioRango = new Date(dias[0].setHours(0,0,0,0)).toISOString();
        finRango = new Date(dias[5].setHours(23,59,59,999)).toISOString();
    }
    
    let query = supabase.from('citas').select('*, pacientes(*)').gte('inicio', inicioRango).lte('inicio', finRango);
    
    const especialistaActivo = especialistaForzado !== undefined ? especialistaForzado : filtroEspecialista;
    
    if (especialistaActivo !== 'Todos') {
        query = query.eq('profesional_id', especialistaActivo);
    }
    
    const { data: citasData } = await query.order('inicio', { ascending: true });
    
    if (!citasData || citasData.length === 0) {
        setCitasDia([]);
        return;
    }

    const pacienteIds = [...new Set(citasData.map(c => c.paciente_id).filter(Boolean))];
    
    const { data: presups } = await supabase.from('presupuestos').select('id, paciente_id').in('paciente_id', pacienteIds).eq('aprobado', true);

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
            if (fin.deuda_realizada > 0) {
                estadoFinanciero = 'deuda';
                requiereCobroInmediato = true;
            } else if (fin.deuda <= 0) {
                estadoFinanciero = 'saldado';
            }
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
      const hoy = new Date();
      const limiteDias = new Date();
      limiteDias.setDate(hoy.getDate() + 90);
      
      const hoyStr = hoy.toISOString().split('T')[0];
      const limiteStr = limiteDias.toISOString().split('T')[0];

      let queryCitas = supabase.from('citas')
        .select('*, pacientes(*)')
        .gte('inicio', `${hoyStr}T00:00:00`)
        .lte('inicio', `${limiteStr}T23:59:59`) 
        .not('estado', 'in', '("cancelada","atendido","no_asiste")')
        .order('inicio', { ascending: true });
        
      if (filtroEspecialista !== 'Todos') { queryCitas = queryCitas.eq('profesional_id', filtroEspecialista); }

      const { data: citasFuturas, error: errCitas } = await queryCitas;
      if (errCitas) console.error("❌ Error en BD al traer citas:", errCitas);

      if (!citasFuturas || citasFuturas.length === 0) {
        setCitasHuerfanas([]); setCargandoHuerfanas(false); return;
      }

      let queryBloqueos = supabase.from('bloqueos_agenda').select('*').gte('fecha', hoyStr).lte('fecha', limiteStr);
      if (filtroEspecialista !== 'Todos') queryBloqueos = queryBloqueos.eq('profesional_id', filtroEspecialista);
      const { data: bloqueos, error: errBloq } = await queryBloqueos;
      if (errBloq) console.error("❌ Error en BD al traer bloqueos:", errBloq);

      const huerfanas = citasFuturas.filter(cita => {
        const [fechaStr] = cita.inicio.replace('T', ' ').split(' ');
        if (!cita.profesional_id) return true;
        
        const isBlocked = bloqueos?.some(b => {
           if (b.profesional_id !== cita.profesional_id || b.fecha !== fechaStr) return false;
           if (!b.hora_inicio || !b.hora_fin) return true; 
           
           const citaStart = new Date(cita.inicio.replace(' ', 'T')).getTime();
           const citaEnd = new Date(cita.fin.replace(' ', 'T')).getTime();
           const bStart = new Date(`${fechaStr}T${b.hora_inicio}`).getTime();
           const bEnd = new Date(`${fechaStr}T${b.hora_fin}`).getTime();
           
           return citaStart < bEnd && citaEnd > bStart; 
        });
        
        return isBlocked;
      });

      setCitasHuerfanas(huerfanas);
    } catch (error) { toast.error("Error al escanear la agenda global"); } finally { setCargandoHuerfanas(false); }
  }

  const iniciarReprogramacion = (cita: any) => {
    resetEstados(); 
    
    setCitaEnReprogramacion(cita); 
    
    setFiltro({ ...filtro, profesional_id: cita.profesional_id || '' });
    
    const tInicio = new Date(cita.inicio.replace(' ', 'T')).getTime();
    const tFin = new Date(cita.fin.replace(' ', 'T')).getTime();
    const duracionMinutos = Math.round((tFin - tInicio) / 60000);
    
    const duracionFinal = duracionesDisponibles.includes(duracionMinutos) ? duracionMinutos : 30;
    setFiltro(prev => ({ ...prev, duracionDefault: duracionFinal }));

    seleccionarPacienteExistente(cita.pacientes); 
    setNuevoTratamientoNombre(cita.motivo || ''); 
    
    setSemanaInicio(new Date(cita.inicio.replace(' ', 'T')));

    setModalAbierto(true); 
    setPaso(1);
  };

  useEffect(() => {
    if (nuevoEspecialista && citaEnEdicion) calcularDisponibilidadSemanalEdicion();
  }, [semanaInicioEdicion, nuevoEspecialista, citaEnEdicion, duracionCitaEdicion]);

  async function calcularDisponibilidadSemanalEdicion() {
    setCargandoSlotsEdicion(true);
    try {
      const dias = Array.from({length: 7}).map((_, i) => {
        const d = new Date(semanaInicioEdicion); d.setDate(d.getDate() + i); return d;
      });

      const inicioSemanaStr = dias[0].toISOString().split('T')[0];
      const finSemanaStr = dias[6].toISOString().split('T')[0];

      const [bloqueosRes, dispoRes, citasRes] = await Promise.all([
        supabase.from('bloqueos_agenda').select('fecha, hora_inicio, hora_fin').eq('profesional_id', nuevoEspecialista).gte('fecha', inicioSemanaStr).lte('fecha', finSemanaStr),
        supabase.from('disponibilidad_profesional').select('*').eq('profesional_id', nuevoEspecialista),
        supabase.from('citas').select('inicio, fin').eq('profesional_id', nuevoEspecialista).gte('inicio', `${inicioSemanaStr}T00:00:00`).lte('inicio', `${finSemanaStr}T23:59:59`).neq('estado', 'cancelada')
      ]);

      const semanaProcesada = dias.map(dateObj => {
        const dateStr = dateObj.toISOString().split('T')[0];
        const diaSemanaNum = dateObj.getDay();

        const bloqueosDia = bloqueosRes.data?.filter(b => b.fecha === dateStr) || [];
        if (bloqueosDia.some(b => !b.hora_inicio || !b.hora_fin)) return { date: dateStr, dateObj, status: 'bloqueado', slots: [] };

        const dispoDia = dispoRes.data?.filter(d => (d.dia_semana === diaSemanaNum && !d.fecha_especifica) || d.fecha_especifica === dateStr) || [];
        if (dispoDia.length === 0) return { date: dateStr, dateObj, status: 'sin_horario', slots: [] };

        const citasDia = citasRes.data?.filter(c => c.inicio.startsWith(dateStr)).map(c => ({
          inicio: getMinsFromDateStr(c.inicio), fin: getMinsFromDateStr(c.fin)
        })) || [];

        let slotsLibres: string[] = [];
        dispoDia.forEach(bloque => {
          let currTime = tToMins(bloque.hora_inicio);
          const endTime = tToMins(bloque.hora_fin);

          while (currTime + duracionCitaEdicion <= endTime) {
            const slotEnd = currTime + duracionCitaEdicion;
            const chocaCita = citasDia.some(cita => currTime < cita.fin && slotEnd > cita.inicio);
            const chocaBloqueo = bloqueosDia.some(b => {
              if(!b.hora_inicio || !b.hora_fin) return true;
              return currTime < tToMins(b.hora_fin) && slotEnd > tToMins(b.hora_inicio);
            });
            if (!chocaCita && !chocaBloqueo) slotsLibres.push(minsToT(currTime));
            currTime += 15;
          }
        });

        return { date: dateStr, dateObj, status: slotsLibres.length > 0 ? 'limpio' : 'lleno', slots: [...new Set(slotsLibres)].sort() };
      });

      setDispoSemanaEdicion(semanaProcesada);
    } catch (error) { toast.error("Error al calcular la agenda"); } finally { setCargandoSlotsEdicion(false); }
  }

  const prevWeekEdicion = () => { const d = new Date(semanaInicioEdicion); d.setDate(d.getDate() - 7); setSemanaInicioEdicion(d); }
  const nextWeekEdicion = () => { const d = new Date(semanaInicioEdicion); d.setDate(d.getDate() + 7); setSemanaInicioEdicion(d); }

  const reagendarCitaHuérfanaDirecta = async (citaId: string) => {
    if(!nuevaFecha || !nuevaHora || !nuevoEspecialista) return toast.error("Selecciona un día y hora");
    setCargandoAccion(true);
    try {
      const inicioDate = new Date(`${nuevaFecha}T${nuevaHora}:00`);
      const finDate = new Date(inicioDate.getTime() + duracionCitaEdicion * 60000);
      const finHoraStr = `${finDate.getHours().toString().padStart(2, '0')}:${finDate.getMinutes().toString().padStart(2, '0')}:00`;

      await supabase.from('citas').update({
        inicio: `${nuevaFecha}T${nuevaHora}:00`, fin: `${nuevaFecha}T${finHoraStr}`,
        profesional_id: nuevoEspecialista, estado: 'reprogramada', modificado_por: usuarioLogueado
      }).eq('id', citaId);

      const citaHuérfana = citasHuerfanas.find(c => c.id === citaId);
      if (citaHuérfana) {
          const nombrePaciente = `${citaHuérfana.pacientes?.nombre || ''} ${citaHuérfana.pacientes?.apellido || ''}`.trim();
          await supabase.from('auditoria_clinica').insert([{
              usuario_id: usuarioLogueado,
              accion: 'UPDATE / REPROGRAMACIÓN HUÉRFANA',
              tabla: 'citas',
              detalles: `Reprogramó cita huérfana de ${nombrePaciente} para el ${nuevaFecha} a las ${nuevaHora}.`
          }]);
      }

      toast.success("Cita huérfana reagendada");
      setCitaEnEdicion(null);
      setCitasHuerfanas(prev => prev.filter(c => c.id !== citaId));
      if (citasHuerfanas.length === 1) setModalHuerfanasAbierto(false);
      await fetchCitasAgenda();
    } catch(e) { toast.error("Error al reagendar"); } finally { setCargandoAccion(false); }
  }

  const anularCitaDirecta = async (citaId: string) => {
    if(!confirm("¿Estás seguro de anular la cita de este paciente?")) return;
    try {
      await supabase.from('citas').update({ estado: 'cancelada', modificado_por: usuarioLogueado }).eq('id', citaId);
      const citaAnulada = citasHuerfanas.find(c => c.id === citaId);
      if (citaAnulada) {
          const nombrePaciente = `${citaAnulada.pacientes?.nombre || ''} ${citaAnulada.pacientes?.apellido || ''}`.trim();
          await supabase.from('auditoria_clinica').insert([{
              usuario_id: usuarioLogueado,
              accion: 'UPDATE / ANULACIÓN CITA',
              tabla: 'citas',
              detalles: `Anuló la cita de ${nombrePaciente} del día ${citaAnulada.inicio.split('T')[0]}.`
          }]);
      }
      toast.success("Cita anulada correctamente");
      setCitasHuerfanas(prev => prev.filter(c => c.id !== citaId));
    } catch(e) {
      toast.error("No se pudo anular la cita");
    }
  }

  const handleEliminarCita = async (cita: any) => {
    const nombrePaciente = `${cita.pacientes?.nombre || 'S/N'} ${cita.pacientes?.apellido || ''}`.trim();
    
    if (confirm(`⚠️ ¿Estás seguro de ELIMINAR PERMANENTEMENTE la cita de ${nombrePaciente}? Esta acción no se puede deshacer.`)) {
      try {
        const { error } = await supabase
          .from('citas')
          .delete()
          .eq('id', cita.id);

        if (error) throw error;

        await supabase.from('auditoria_clinica').insert([{
          usuario_id: usuarioLogueado,
          accion: 'DELETE / CITA',
          tabla: 'citas',
          detalles: `Eliminó permanentemente la cita de ${nombrePaciente} del día ${cita.inicio.split('T')[0]}.`
        }]);

        toast.success("Cita eliminada de la base de datos");
        await fetchCitasAgenda(); 
      } catch (e) {
        console.error(e);
        toast.error("No se pudo eliminar la cita");
      }
    }
  };
  
  async function actualizarEstadoCita(citaId: string, nuevoEstado: string) {
    const ahora = new Date(); const offset = ahora.getTimezoneOffset() * 60000; const horaLocalISO = new Date(ahora.getTime() - offset).toISOString();
    const updateData: any = { 
        estado: nuevoEstado,
        modificado_por: usuarioLogueado
    };
    
    if (nuevoEstado === 'cancelada') updateData.cancelado_por = usuarioLogueado;
    if (nuevoEstado === 'en_espera') { updateData.llegada_confirmada = true; updateData.hora_llegada = horaLocalISO; }
    if (nuevoEstado === 'atendiendose') updateData.hora_inicio_atencion = horaLocalISO; 
    if (nuevoEstado === 'atendido') updateData.hora_fin_atencion = horaLocalISO; 
    
    const { data: citaActual, error } = await supabase
        .from('citas')
        .update(updateData)
        .eq('id', citaId)
        .select('*, pacientes(nombre, apellido)')
        .single();
        
    if (error) return toast.error("Error al actualizar");
    
    if (citaActual) {
      const nombrePac = citaActual.pacientes?.nombre || 'Sin nombre';
      const apellidoPac = citaActual.pacientes?.apellido || '';

      await supabase.from('auditoria_clinica').insert([{
          usuario_id: usuarioLogueado,
          accion: `UPDATE / ESTADO CITA`,
          tabla: 'citas',
          detalles: `Cambió estado de la cita de ${nombrePac} ${apellidoPac} a "${nuevoEstado.toUpperCase()}".`
      }]);
    }

    if (nuevoEstado === 'en_espera' && citaActual && citaActual.pacientes) {
      const canalNotif = supabase.channel(`notificaciones-${citaActual.profesional_id}`);
      canalNotif.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalNotif.send({ type: 'broadcast', event: 'PACIENTE_EN_ESPERA', payload: { nombre: `${citaActual.pacientes?.nombre || ''} ${citaActual.pacientes?.apellido || ''}` } });
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

  const generarYMostrarResumen = async (presupuestoId: string, cita: any) => {
    const toastId = toast.loading("Generando resumen del tratamiento...");
    try {
        const { data: items } = await supabase.from('presupuesto_items').select('observacion, precio_pactado, abonado, prestaciones:prestacion_id("Nombre Accion", "Nombre")').eq('presupuesto_id', presupuestoId).neq('estado', 'cancelada');

        if (!items || items.length === 0) {
            toast.error("El plan seleccionado no contiene tratamientos activos.", { id: toastId });
            return;
        }

        let total = 0; let abonado = 0;
        let detalleText = `Hola ${cita.pacientes?.nombre}, te compartimos el detalle actualizado de tu Plan de Tratamiento Dental:\n\n`;

        items.forEach((item: any) => {
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
    } catch (error) {
        toast.error("Error al generar resumen", { id: toastId });
    }
  }

  const abrirEnvioPresupuesto = async (cita: any) => {
    if (!cita.paciente_id) return toast.error("Cita sin paciente asociado");
    
    const toastId = toast.loading("Buscando tratamientos...");
    try {
        const { data: presupuestos } = await supabase
            .from('presupuestos')
            .select('id, nombre_tratamiento')
            .eq('paciente_id', cita.paciente_id)
            .neq('estado', 'finalizado');

        if (!presupuestos || presupuestos.length === 0) {
            toast.error("El paciente no tiene planes de tratamiento activos.", { id: toastId });
            return;
        }

        if (presupuestos.length === 1) {
            await generarYMostrarResumen(presupuestos[0].id, cita);
            toast.dismiss(toastId);
        } else {
            setModalSeleccionTratamiento({ abierto: true, cita, tratamientos: presupuestos });
            toast.dismiss(toastId);
        }

    } catch (error) { toast.error("Error al buscar tratamientos", { id: toastId }); }
  }

  const handleGuardarBloqueoRapido = async () => {
      if (!profesionalBloqueo) return toast.error("Debe seleccionar un profesional para bloquear su agenda.");
      if (!motivoBloqueo.trim()) return toast.error("Debe ingresar un motivo para el bloqueo.");
      if (!bloqueoTodoElDia && (!horaInicioBloqueo || !horaFinBloqueo)) return toast.error("Debe especificar hora de inicio y fin.");
      
      const fechaBloqueo = getLocalDateISO(selectedDate);

      setCargandoAccion(true);
      try {
          const { data: citasAfectadas } = await supabase.from('citas')
            .select('id, inicio, fin')
            .eq('profesional_id', profesionalBloqueo)
            .gte('inicio', `${fechaBloqueo}T00:00:00`)
            .lte('inicio', `${fechaBloqueo}T23:59:59`)
            .not('estado', 'in', '("cancelada","atendido","no_asiste")');

          let choquesCount = 0;
          if (citasAfectadas && citasAfectadas.length > 0) {
              if (bloqueoTodoElDia) {
                  choquesCount = citasAfectadas.length;
              } else {
                  const bStart = new Date(`${fechaBloqueo}T${horaInicioBloqueo}`).getTime();
                  const bEnd = new Date(`${fechaBloqueo}T${horaFinBloqueo}`).getTime();
                  
                  choquesCount = citasAfectadas.filter(c => {
                      const cStart = new Date(c.inicio.replace(' ', 'T')).getTime();
                      const cEnd = new Date(c.fin.replace(' ', 'T')).getTime();
                      return cStart < bEnd && cEnd > bStart;
                  }).length;
              }
          }

          if (choquesCount > 0) {
              const confirmacion = window.confirm(`⚠️ ADVERTENCIA DE CHOQUE:\n\nHay ${choquesCount} cita(s) agendada(s) que choca(n) con este bloqueo.\n\nSi continúas, esas citas quedarán "Huérfanas" y tendrás que reagendarlas manualmente.\n\n¿Estás seguro de bloquear la agenda?`);
              if (!confirmacion) {
                  setCargandoAccion(false);
                  return;
              }
          }

          const payload = {
              profesional_id: profesionalBloqueo,
              fecha: fechaBloqueo,
              motivo: motivoBloqueo,
              hora_inicio: bloqueoTodoElDia ? null : horaInicioBloqueo,
              hora_fin: bloqueoTodoElDia ? null : horaFinBloqueo
          };
          
          const { error } = await supabase.from('bloqueos_agenda').insert([payload]);
          if (error) throw error;
          
          const profesionalBloqueadoData = profesionales.find(p => p.user_id === profesionalBloqueo);
          const nombreProfesional = profesionalBloqueadoData ? `${profesionalBloqueadoData.nombre} ${profesionalBloqueadoData.apellido}` : `ID ${profesionalBloqueo}`;
          await supabase.from('auditoria_clinica').insert([{
              usuario_id: usuarioLogueado,
              accion: 'INSERT / BLOQUEO AGENDA',
              tabla: 'bloqueos_agenda',
              detalles: `Bloqueó agenda para Dr/a. ${nombreProfesional} el día ${fechaBloqueo}. Motivo: ${motivoBloqueo}.`
          }]);

          toast.success("Agenda bloqueada exitosamente");
          setModalBloqueo(false);
          await fetchCitasAgenda();
      } catch (e) { toast.error("Error al bloquear el horario."); } finally { setCargandoAccion(false); }
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

  const esHorarioLaboral = (fecha: string, hora: string, duracionMinutos: number) => {
    const diaSemana = new Date(fecha + 'T00:00:00').getDay();
    const slotStart = new Date(`${fecha}T${hora}:00`).getTime();
    const slotEnd = slotStart + duracionMinutos * 60000;

    return horariosConfigurados.some(h => {
        if (h.dia_semana !== diaSemana) return false;
        const inicioLab = new Date(`${fecha}T${h.hora_inicio.substring(0,5)}:00`).getTime();
        const finLab = new Date(`${fecha}T${h.hora_fin.substring(0,5)}:00`).getTime();
        
        return slotStart >= inicioLab && slotEnd <= finLab;
    });
  }

  const esCitaOcupada = (fecha: string, hora: string, duracionMinutos: number) => {
    const slotStart = new Date(`${fecha}T${hora}:00`).getTime();
    const slotEnd = slotStart + duracionMinutos * 60000;
    
    const chocaCita = citasOcupadas.some(cita => {
        const citaInicio = new Date(cita.inicio.replace(' ', 'T')).getTime();
        const citaFin = new Date(cita.fin.replace(' ', 'T')).getTime();
        return slotStart < citaFin && slotEnd > citaInicio;
    });

    if (chocaCita) return true;

    const chocaBloqueo = bloqueosSemana.some(b => {
        if (b.fecha !== fecha) return false;
        if (!b.hora_inicio || !b.hora_fin) return true; 
        
        const bStart = new Date(`${fecha}T${b.hora_inicio}`).getTime();
        const bEnd = new Date(`${fecha}T${b.hora_fin}`).getTime();
        return slotStart < bEnd && slotEnd > bStart;
    });

    return chocaBloqueo;
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
    if (!paciente.activo) {
        toast.error(`Paciente Inhabilitado: ${paciente.motivo_deshabilitado || 'No se pueden agendar citas.'}`);
        return;
    }
    setPacienteSeleccionado(paciente); 
    setBusqueda(`${paciente.nombre} ${paciente.apellido}`); 
    setPacientesEncontrados([]);
    
    const { data } = await supabase.from('presupuestos')
        .select('id, nombre_tratamiento')
        .eq('paciente_id', paciente.id)
        .neq('estado', 'finalizado')
        .order('fecha_creacion', { ascending: false });
    
    setTratamientosPaciente(data || []);
    setTratamientoSeleccionadoId('MANUAL'); 
    setNuevoTratamientoNombre(citaEnReprogramacion ? citaEnReprogramacion.motivo : ''); 
  };

  const handleGuardar = async () => {
    if (cargandoAccion) return;
    if (modoNuevoPaciente && (!nuevoPaciente.nombre || !nuevoPaciente.apellido)) {
      return toast.error("Faltan datos del nuevo paciente", {
        description: "Nombre y Apellido son obligatorios."
      });
    }
    setCargandoAccion(true);
    try {
      let pId = pacienteSeleccionado?.id;
      let pNombreFull = pacienteSeleccionado ? `${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido}` : "";
      let pTelefono = pacienteSeleccionado?.telefono || null;

      if (modoNuevoPaciente && !citaEnReprogramacion) {
        let rutFinal: string | null = nuevoPaciente.rut.toUpperCase().trim();
        if (esOtroDocumento) {
          if (!rutFinal) rutFinal = `OTRO-DOC-${Date.now()}`;
        } else {
            rutFinal = rutFinal.replace(/[^0-9kK-]/g, '');
        }

        const { data: pNew, error: pErr } = await supabase
          .from('pacientes')
          .insert([{
            nombre: nuevoPaciente.nombre.toUpperCase().trim(),
            apellido: nuevoPaciente.apellido.toUpperCase().trim(),
            rut: rutFinal,
            telefono: nuevoPaciente.telefono,
            fecha_nacimiento: nuevoPaciente.fecha_nacimiento || null,
            sexo: nuevoPaciente.sexo || null,
            activo: true
          }])
          .select().single();
        if (pErr) {
          console.error(pErr);
          throw pErr;
        }
        pId = pNew.id;
        pNombreFull = `${nuevoPaciente.nombre} ${nuevoPaciente.apellido}`;
        pTelefono = nuevoPaciente.telefono;
      }

      const parsearAFechaLocal = (fechaStr: string, horaStr: string, duracionMin: number) => {
        const [h, m] = horaStr.split(':').map(Number);
        const finDate = new Date(new Date(`${fechaStr}T${horaStr}:00`).getTime() + duracionMin * 60000);
        const finH = finDate.getHours().toString().padStart(2, '0');
        const finM = finDate.getMinutes().toString().padStart(2, '0');
        return { inicio: `${fechaStr}T${horaStr}:00`, fin: `${fechaStr}T${finH}:${finM}:00` };
      };

      if (citaEnReprogramacion) {
        const s = horasSeleccionadas[0];
        const { inicio, fin } = parsearAFechaLocal(s.fecha, s.hora, s.duracion);
        await supabase
          .from('citas')
          .update({
            inicio,
            fin,
            profesional_id: filtro.profesional_id,
            estado: 'reprogramada',
            motivo: nuevoTratamientoNombre.toUpperCase() || citaEnReprogramacion.motivo,
            modificado_por: usuarioLogueado
          })
          .eq('id', citaEnReprogramacion.id);

        await supabase.from('auditoria_clinica').insert([{
          usuario_id: usuarioLogueado,
          accion: 'UPDATE / REPROGRAMACIÓN',
          tabla: 'citas',
          detalles: `Reprogramó la cita de ${pNombreFull} para el ${s.fecha} a las ${s.hora}.`
        }]);
      } else {
        const nuevasCitas = horasSeleccionadas.map(s => {
          const { inicio, fin } = parsearAFechaLocal(s.fecha, s.hora, s.duracion);
          return {
            paciente_id: pId,
            profesional_id: filtro.profesional_id,
            presupuesto_id: (tratamientoSeleccionadoId && tratamientoSeleccionadoId !== 'MANUAL') ? tratamientoSeleccionadoId : null,
            inicio,
            fin,
            estado: 'programada',
            motivo: nuevoTratamientoNombre.toUpperCase() || 'CONSULTA',
            creado_por: usuarioLogueado
          };
        });
        await supabase.from('citas').insert(nuevasCitas);

        const detallesCitas = nuevasCitas.map(c => `Cita para ${pNombreFull} el ${c.inicio.split('T')[0]} a las ${c.inicio.split('T')[1].substring(0,5)}`).join('; ');
        await supabase.from('auditoria_clinica').insert([{
          usuario_id: usuarioLogueado,
          accion: 'INSERT / CITA',
          tabla: 'citas',
          detalles: `Agendó: ${detallesCitas}`
        }]);
      }

      setCitaConfirmadaData({
        paciente: pNombreFull.toUpperCase(),
        citas: horasSeleccionadas,
        telefono: pTelefono
      });
      setMostrarTicket(true);
      await fetchCitasAgenda();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al guardar");
      setCargandoAccion(false);
    }
  };

  const toggleHora = (fecha: string, hora: string) => {
    setHorasSeleccionadas(prev => {
      if (citaEnReprogramacion) return [{ fecha, hora, duracion: filtro.duracionDefault }];
      const existe = prev.find(h => h.fecha === fecha && h.hora === hora);
      if (existe) return prev.filter(h => !(h.fecha === fecha && h.hora === hora));
      return [...prev, { fecha, hora, duracion: filtro.duracionDefault }];
    });
  }

  const handleSlotClick = (fecha: string, hora: string) => {
    const sel = horasSeleccionadas.some(x => x.fecha === fecha && x.hora === hora);
    if (sel) {
      toggleHora(fecha, hora);
      return;
    }

    const laboral = esHorarioLaboral(fecha, hora, filtro.duracionDefault);
    const ocupado = esCitaOcupada(fecha, hora, filtro.duracionDefault);
    const diaCompletamenteBloqueado = bloqueosSemana.some(b => b.fecha === fecha && (!b.hora_inicio || !b.hora_fin));
    const chocaConSeleccion = horasSeleccionadas.some(s => {
        if (s.fecha === fecha && s.hora === hora) return false; 
        const selStart = new Date(`${s.fecha}T${s.hora}:00`).getTime();
        const selEnd = selStart + s.duracion * 60000;
        const slotStart = new Date(`${fecha}T${hora}:00`).getTime();
        const slotEnd = slotStart + filtro.duracionDefault * 60000;
        return slotStart < selEnd && slotEnd > selStart;
    });

    if (diaCompletamenteBloqueado) return toast.error("Este día está completamente bloqueado.");
    if (!laboral) return toast.error("Fuera del horario laboral del especialista.");
    if (ocupado) return toast.error("Horario ocupado por otra cita o bloqueo.");
    if (chocaConSeleccion) return toast.warning("El horario choca con otra selección actual.");
    
    toggleHora(fecha, hora);
  };

  const navegarSemana = (sentido: 'atras' | 'adelante') => {
    const nueva = new Date(semanaInicio); nueva.setDate(nueva.getDate() + (sentido === 'adelante' ? 7 : -7)); setSemanaInicio(nueva);
  }

  const resetEstados = () => { setPaso(1); setHorasSeleccionadas([]); setPacienteSeleccionado(null); setBusqueda(''); setModoNuevoPaciente(false); setNuevoTratamientoNombre(''); setCitasOcupadas([]); setCitaEnReprogramacion(null); setSemanaInicio(new Date()); setTratamientosPaciente([]); setTratamientoSeleccionadoId(null); setNuevoPaciente({ nombre: '', apellido: '', rut: '', telefono: '', fecha_nacimiento: '', sexo: '' }); setBloqueosSemana([]); setCargandoAccion(false); }

  const abrirCaja = async (cita: any) => {
    if (!cita.pacientes || !cita.pacientes.id) return toast.error("Cita no tiene paciente asignado");
    
    setPacientePago(cita.pacientes); 
    setMontoIngresado(''); 
    setMetodoPago('tarjeta'); 
    setCodigoTransaccion('');
    setPlanesDetalladosAgenda([]);
    setDeudaTotalPlanAgenda(0);
    setModalPagoAbierto(true); 
    setCargandoDeudas(true);
    
    try {
        const { data: pacData } = await supabase.from('pacientes').select('saldo_a_favor').eq('id', cita.pacientes.id).single();
        setSaldoAFavor(Number(pacData?.saldo_a_favor || 0));

        const { data: presupuestosPaciente, error: errPres } = await supabase.from('presupuestos').select('id, nombre_tratamiento').eq('paciente_id', cita.pacientes.id).eq('aprobado', true);
        if (errPres) throw errPres;
        
        const idsPresupuestos = presupuestosPaciente?.map(p => p.id) || [];
        let itemsData: any[] = [];
        
        if (idsPresupuestos.length > 0) {
            const { data, error } = await supabase.from('presupuesto_items').select(`id, observacion, precio_pactado, abonado, estado, progreso, profesional_id, prestaciones:prestacion_id("Nombre Accion", "Nombre"), profesional:profesional_id(nombre, apellido)`).in('presupuesto_id', idsPresupuestos).not('estado', 'eq', 'cancelada');
            if (error) throw error;
            itemsData = data || [];
        }
        
        const todosLosItemsMapeados = (itemsData || []).map(item => {
            const precio = Number(item.precio_pactado || 0); 
            const abonado = Number(item.abonado || 0); 
            const deuda = precio - abonado;
            
            let nombreDisplay = item.observacion || "Tratamiento";
            if (item.prestaciones) nombreDisplay = item.prestaciones["Nombre Accion"] || item.prestaciones["Nombre"] || nombreDisplay;
            else if (item.observacion && item.observacion.includes('|')) nombreDisplay = item.observacion.split('|')[0].trim();
            const doctor = item.profesional ? `Dr/a. ${item.profesional.nombre} ${item.profesional.apellido}` : 'Sin asignar';
            return { ...item, deuda, nombreDisplay, doctor };
        }).filter(item => item.deuda > 0);

        const planesParaVista = (presupuestosPaciente || []).map(plan => {
          const itemsDelPlan = todosLosItemsMapeados.filter(item => item.presupuesto_id === plan.id);
          const deudaDelPlan = itemsDelPlan.reduce((acc, item) => acc + item.deuda, 0);
          return {
            id: plan.id,
            nombre: plan.nombre_tratamiento || 'Tratamiento General',
            deudaTotal: deudaDelPlan
          };
        }).filter(p => p.deudaTotal > 0);

        setPlanesDetalladosAgenda(planesParaVista);
        setDeudaTotalPlanAgenda(todosLosItemsMapeados.reduce((acc, item) => acc + item.deuda, 0));

        const itemsConDeuda = todosLosItemsMapeados.filter(item => {
            const estado = String(item.estado || 'pendiente').toLowerCase();
            return ['realizado', 'atendido', 'terminado', 'finalizado', 'completado'].includes(estado) || (item.progreso && item.progreso > 0);
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
    const pago = Number(montoIngresado);
    if (!montoIngresado || pago <= 0) return toast.error("Ingrese un monto válido a recaudar");
    
    const requiereComprobante = metodoPago !== 'Saldo a Favor';
    if (requiereComprobante && !codigoTransaccion.trim()) return toast.error("Ingrese el N° de boleta o código de transacción");

    if (metodoPago === 'Saldo a Favor') {
        if (pago > saldoAFavor) return toast.error("El monto supera el saldo disponible en la billetera.");
    }

    setCargandoAccion(true); 
    let montoRestante = pago;
    
    try {
        let currentCajaId = cajaActivaId;
        if (!currentCajaId) {
            const { data: perfilData } = await supabase.from('perfiles').select('nombre_completo').eq('id', usuarioLogueado).maybeSingle();
            const userName = perfilData?.nombre_completo || 'Recepcionista';

            const { data: nuevaCaja, error: errCaja } = await supabase.from('sesiones_caja').insert([{
                usuario_id: usuarioLogueado,
                nombre_responsable: userName,
                monto_apertura: 0,
                estado: 'abierta',
                fecha_apertura: new Date().toISOString()
            }]).select('id').single();

            if (errCaja) throw errCaja;
            currentCajaId = nuevaCaja.id;
            setCajaActivaId(currentCajaId);
            toast.success("Turno de caja iniciado automáticamente ($0 inicial)");
        }

        for (const item of deudasPaciente) {
            if (montoRestante <= 0) break;
            const aAbonar = Math.min(item.deuda, montoRestante);
            
            const detalleAbono = { 
                id: item.id,
                prestacion: item.nombreDisplay, 
                precio: item.precio_pactado, 
                doctor: item.doctor,
                abonado_ahora: aAbonar 
            };

            await supabase.from('pagos').insert([{ 
                paciente_id: pacientePago.id, 
                monto: aAbonar, 
                metodo_pago: metodoPago, 
                numero_referencia: codigoTransaccion.trim() || null, 
                numero_boleta: codigoTransaccion.trim() || 'S/N', 
                fecha_pago: new Date().toISOString(),
                item_id: item.id,
                comentario: JSON.stringify([detalleAbono]),
                caja_id: currentCajaId
            }]);

            await supabase.from('presupuesto_items').update({ abonado: Number(item.abonado) + aAbonar }).eq('id', item.id);
            montoRestante -= aAbonar;
        }
        
        let nuevoSaldo = saldoAFavor;

        if (metodoPago === 'Saldo a Favor') {
            nuevoSaldo = saldoAFavor - pago;
            await supabase.from('pacientes').update({ saldo_a_favor: nuevoSaldo }).eq('id', pacientePago.id);
            toast.success(`Se utilizaron $${pago.toLocaleString('es-CL')} de su saldo a favor.`);
        } else {
            if (montoRestante > 0) {
                const detalleSobrante = [{ prestacion: "Saldo a Favor (Abono extra/Vuelto)", precio: montoRestante, abonado_ahora: montoRestante }];
                await supabase.from('pagos').insert([{ 
                    paciente_id: pacientePago.id, 
                    monto: montoRestante, 
                    metodo_pago: metodoPago, 
                    numero_referencia: codigoTransaccion.trim() || null, 
                    numero_boleta: codigoTransaccion.trim() || 'S/N',
                    fecha_pago: new Date().toISOString(),
                    comentario: JSON.stringify(detalleSobrante),
                    caja_id: currentCajaId
                }]);

                nuevoSaldo = saldoAFavor + montoRestante;
                await supabase.from('pacientes').update({ saldo_a_favor: nuevoSaldo }).eq('id', pacientePago.id);
                toast.info(`¡Quedó un vuelto de $${montoRestante.toLocaleString('es-CL')} guardado a favor del paciente!`);
            } else {
                toast.success(`Pago procesado exitosamente.`);
            }
        }

        setSaldoAFavor(nuevoSaldo);
        setModalPagoAbierto(false); 
        setMontoIngresado(''); 
        setCodigoTransaccion('');
        await fetchCitasAgenda(); 

    } catch (e) { 
        toast.error("Ocurrió un error al procesar el pago"); 
    } finally { 
        setCargandoAccion(false); 
    }
  }

  const calcularDeudaTotalCaja = () => deudasPaciente.reduce((acc, curr) => acc + curr.deuda, 0);

  // --- Renderización Principal ---
  const GOLD = '#C9A24B'
  const NAVY = '#0E1B2E'
  const GOLD_LIGHT = '#E8CD8A'
  const INK = '#0B1220'

  // Pantalla de carga (Splash) mejorada y elegante con Framer Motion
  if (cargandoPagina) return (
    <div className="h-full flex flex-col items-center justify-center bg-[#FBF8F2] relative overflow-hidden">
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center z-10"
        >
            <div className="w-20 h-20 bg-[#0A111F] rounded-3xl flex items-center justify-center mb-6 shadow-2xl relative">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className="absolute inset-[-2px] rounded-3xl border border-transparent border-t-[#C9A24B] border-b-[#C9A24B]/30 opacity-70" />
                <svg width="32" height="36" viewBox="0 0 24 24" fill="none" stroke="#C9A24B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.5C12 20.5 15 19 16 16C17.3333 12 18 8 16 5C15 3 13 3 12 5C11 3 9 3 8 5C6 8 6.66667 12 8 16C9 19 12 20.5 12 20.5Z"/></svg>
            </div>
            <h2 className="text-xl font-black tracking-widest uppercase text-[#0A111F]">Cargando Agenda</h2>
            <p className="text-xs font-bold text-slate-400 mt-2">Sincronizando con la base de datos...</p>
            
            <div className="w-48 h-1 bg-slate-200 rounded-full mt-6 overflow-hidden">
            <motion.div 
                initial={{ width: "0%" }} 
                animate={{ width: "100%" }} 
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} 
                className="h-full bg-[#C9A24B] rounded-full" 
            />
            </div>
        </motion.div>
    </div>
  )

  return (
    <div className="min-h-full bg-[#FBF8F2] font-sans text-slate-800 pb-24 text-left p-6 md:p-10">
      
      {/* HEADER DE LA PÁGINA AGENDA */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0A111F]">
          Agenda <span className="italic font-serif" style={{ color: GOLD }}>Clínica</span>
        </h1>
        
        <div className="flex flex-wrap items-center gap-3">
          {puedeVerFinanzas && (
            <button onClick={() => setModalBloqueo(true)} className="px-5 py-2.5 rounded-lg border border-red-200 text-red-500 text-[11px] font-bold uppercase tracking-wider hover:bg-red-50 transition-colors flex items-center gap-2 bg-white">
              <Lock size={14} /> Bloquear
            </button>
          )}
          <Link href="/semana" className="px-5 py-2.5 rounded-lg border border-[#C9A24B]/30 text-slate-600 text-[11px] font-bold uppercase tracking-wider hover:bg-[#C9A24B]/5 transition-colors flex items-center gap-2 bg-white">
            <CalendarDays size={14} className="text-[#C9A24B]"/> Bloque Semanal
          </Link>
          <button onClick={() => { fetchCitasHuerfanas(); setModalHuerfanasAbierto(true); }} className="px-5 py-2.5 rounded-lg border border-amber-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider hover:bg-amber-50 transition-colors flex items-center gap-2 bg-white">
            <AlertTriangle size={14} className="text-amber-500" /> Huérfanas
          </button>
          <button onClick={() => { resetEstados(); setModalAbierto(true); }} className="px-6 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-wider shadow-md transition-all flex items-center gap-2 text-[#0A111F] bg-[#C9A24B] hover:bg-[#B38D3A]">
            <Plus size={14} strokeWidth={3} /> Agendar
          </button>
        </div>
      </div>

      {/* CONTROLES / FILTROS */}
      <div className="flex flex-col md:flex-row items-center justify-start gap-4 mb-10">
        
        {/* Selector de Especialista */}
        <div className="bg-white border border-slate-200 rounded-full px-5 py-2 shadow-sm flex items-center gap-2">
           <Users size={16} className="text-[#C9A24B]"/>
           <select className="text-[11px] font-bold uppercase text-slate-600 bg-transparent outline-none cursor-pointer pr-4" value={filtroEspecialista} onChange={(e) => setFiltroEspecialista(e.target.value)}>
             <option value="Todos">Todos los especialistas</option>
             {profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
           </select>
        </div>

        {/* Toggle Día / Semana */}
        <div className="flex items-center bg-white rounded-full p-1 border border-slate-200 shadow-sm">
          <button onClick={() => setVistaAgenda('dia')} className={`px-6 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${vistaAgenda === 'dia' ? 'bg-[#C9A24B] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <List size={14}/> Día
          </button>
          <button onClick={() => setVistaAgenda('semana')} className={`px-6 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${vistaAgenda === 'semana' ? 'bg-[#C9A24B] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <LayoutGrid size={14}/> Semana
          </button>
        </div>

        {/* Selector de Fecha */}
        <div className="flex items-center bg-white rounded-full px-4 py-1.5 border border-slate-200 shadow-sm">
          <button onClick={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() - (vistaAgenda === 'semana' ? 7 : 1));
            setSelectedDate(newDate);
          }} className="p-2 text-slate-400 hover:text-[#0A111F] transition-colors"><ChevronLeft size={16}/></button>
          
          <div className="relative flex items-center justify-center px-6 cursor-pointer group" onClick={() => dateInputRef.current?.showPicker()}>
             <CalendarIcon size={16} className="mr-2 text-slate-400" />
             <span className="text-[12px] font-bold text-slate-700 capitalize min-w-[120px] text-center">
               {selectedDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })}
             </span>
             <input ref={dateInputRef} type="date" className="sr-only" value={getLocalDateISO(selectedDate)} onChange={(e) => { if(e.target.value) { const [y, m, d] = e.target.value.split('-'); setSelectedDate(new Date(Number(y), Number(m)-1, Number(d))); } }} />
          </div>

          <button onClick={() => {
            const newDate = new Date(selectedDate);
            newDate.setDate(newDate.getDate() + (vistaAgenda === 'semana' ? 7 : 1));
            setSelectedDate(newDate);
          }} className="p-2 text-slate-400 hover:text-[#0A111F] transition-colors"><ChevronRight size={16}/></button>
        </div>
      </div>

      {/* BUSCADOR Y BADGE */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-10 text-left">
         <div className="relative w-full max-w-lg group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#C9A24B] transition-colors" size={16} />
            <input 
               type="text" 
               placeholder="Buscar por paciente o RUT..." 
               className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-full text-sm outline-none shadow-sm focus:border-[#C9A24B] transition-all"
               value={busquedaAgenda}
               onChange={(e) => setBusquedaAgenda(e.target.value)}
            />
         </div>
         <div className="bg-white text-slate-700 px-6 py-3 rounded-full border border-slate-200 shadow-sm flex items-center gap-2 shrink-0">
            <CalendarDays size={16} className="text-[#C9A24B]" />
            <span className="font-bold text-xs uppercase tracking-widest">{citasFiltradas.length} Citas hoy</span>
         </div>
      </div>

      {/* TIMELINE DE CITAS */}
      {vistaAgenda === 'dia' && (
        <div className="relative pl-[100px] md:pl-[140px] pt-4 pb-20">
          
          {/* Línea Vertical Dorada Animada */}
          {citasFiltradas.length > 0 && (
            <motion.div 
              initial={{ height: 0 }} 
              animate={{ height: '100%' }} 
              transition={{ duration: 0.8, ease: "easeOut" }} 
              className="absolute left-[70px] md:left-[100px] top-8 bottom-0 w-[2px] bg-gradient-to-b from-[#C9A24B]/60 to-[#C9A24B]/10 z-0 hidden md:block origin-top"
            />
          )}

          <AnimatePresence mode="wait">
            <motion.div 
                key={selectedDate.toISOString() + filtroEspecialista}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
            >
                {citasFiltradas.length > 0 && !cambiandoFecha ? citasFiltradas.map((c, index) => {
                const hInicio = new Date(c.inicio).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
                const hFin = new Date(c.fin).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
                const pNombre = c.pacientes?.nombre || 'S/N';
                const pApellido = c.pacientes?.apellido || '';
                const doctor = profesionales.find(p => p.user_id === c.profesional_id);
                const theme = getAvatarColorClass(pNombre + pApellido);

                return (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                        key={c.id} 
                        className="relative mb-6 z-10 flex md:block flex-col gap-2 group"
                    >
                    {/* Tiempos en la izquierda */}
                    <div className="md:absolute md:-left-[140px] md:top-4 md:w-[80px] text-left md:text-right flex md:block items-center gap-2">
                        <p className="text-xl font-black text-[#0A111F] leading-none tracking-tight group-hover:text-[#C9A24B] transition-colors">{hInicio}</p>
                        <p className="text-xs font-semibold text-slate-400 mt-1">{hFin}</p>
                    </div>

                    {/* Círculo en la línea */}
                    <motion.div 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        transition={{ delay: index * 0.05 + 0.2, type: "spring" }}
                        className="hidden md:block absolute -left-[45px] top-5 w-3 h-3 rounded-full bg-white border-[3px] border-[#C9A24B] shadow-[0_0_0_6px_#FBF8F2] z-20 group-hover:scale-125 transition-transform" 
                    />

                    {/* Tarjeta de Cita */}
                    <div className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-100 border-l-4 ${theme.border} p-5 md:p-6 w-full flex flex-col gap-4 hover:-translate-y-0.5`}>
                        {/* Fila Superior: Info Paciente y Dropdown */}
                        <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full ${theme.bg} ${theme.text} flex items-center justify-center font-bold text-lg`}>
                            {getInitials(pNombre, pApellido)}
                            </div>
                            
                            <div>
                            <h3 className="text-base font-black text-[#0A111F] uppercase tracking-wide leading-tight">{pNombre} {pApellido}</h3>
                            <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-slate-400 uppercase">
                                <span>RUT: {c.pacientes?.rut || 'S/N'}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="flex items-center gap-1"><User size={12} className="text-slate-400"/> Dr. {doctor?.apellido || 'S/A'}</span>
                            </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-colors">
                            <div className={`w-2 h-2 rounded-full ${theme.bg.replace('bg-', 'bg-').replace('-100', '-500')}`}></div>
                            <select value={c.estado || 'programada'} onChange={(e) => actualizarEstadoCita(c.id, e.target.value)} className="appearance-none bg-transparent outline-none cursor-pointer pr-4 font-black">
                            {Object.entries(ESTADOS_CITA).map(([key, val]) => ( <option key={key} value={key}>{val.label.toUpperCase()}</option> ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/>
                        </div>
                        </div>

                        {/* Fila Inferior: Badges y Botones */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-2 pt-4 border-t border-slate-50 gap-4">
                        <div>
                            {puedeVerFinanzas && c.requiereCobroInmediato ? (
                                <span onClick={() => abrirCaja(c)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse cursor-pointer">
                                🔔 POR COBRAR: ${c.finanzas?.deuda_realizada.toLocaleString('es-CL')}
                                </span>
                            ) : puedeVerFinanzas && c.estadoFinanciero === 'deuda' ? (
                                <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                DEUDA: ${c.finanzas?.deuda.toLocaleString('es-CL')}
                                </span>
                            ) : puedeVerFinanzas && c.estadoFinanciero === 'saldado' ? (
                            <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider">SALDADO</span>
                            ) : (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider">SIN SALDO</span>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <button onClick={() => iniciarReprogramacion(c)} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-[#C9A24B] hover:bg-slate-50 transition-colors" title="Reprogramar"><CalendarClock size={16}/></button>
                            <button onClick={() => contactarWhatsApp(c.pacientes?.telefono, c.pacientes?.nombre, c.estado, hInicio)} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-500 hover:bg-slate-50 transition-colors" title="WhatsApp"><MessageCircle size={16}/></button>
                            <button onClick={() => abrirEnvioPresupuesto(c)} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-slate-50 transition-colors" title="Enviar Presupuesto"><FileText size={16}/></button>
                            
                            {puedeVerFinanzas && (
                            <button onClick={() => abrirCaja(c)} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-50 transition-colors" title="Caja/Cobrar"><Coins size={16}/></button>
                            )}
                            
                            <button onClick={() => handleEliminarCita(c)} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                            
                            <Link href={`/pacientes/${c.paciente_id}`} className="ml-2 text-[10px] font-black text-blue-600 px-4 py-2 uppercase tracking-widest hover:bg-blue-50 rounded-lg transition-colors">
                            FICHA
                            </Link>
                        </div>
                        </div>
                    </div>
                    </motion.div>
                )
                }) : (!cambiandoFecha && ( 
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center opacity-40 py-24 text-center text-slate-500 bg-transparent rounded-3xl border-2 border-dashed border-slate-200">
                    <CalendarIcon size={48} className="mb-3 text-slate-300"/>
                    <h3 className="font-black uppercase text-base tracking-widest text-center text-slate-700">Agenda Libre</h3>
                    <p className="mt-1 font-bold text-xs tracking-wide text-center">No hay citas programadas para este día.</p>
                </motion.div> 
                ))}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* VISTA SEMANAL */}
      {vistaAgenda === 'semana' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pb-20">
              {getDiasLunesSabado(selectedDate).map((dia, diaIndex) => {
                  const diaISO = getLocalDateISO(dia);
                  const citasEsteDia = citasFiltradas.filter(c => c.inicio.startsWith(diaISO));
                  
                  return (
                      <motion.div 
                          key={diaISO} 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          transition={{ delay: diaIndex * 0.05 }}
                          className="flex flex-col gap-2"
                      >
                          <div className="bg-white rounded-xl p-2.5 text-center sticky top-28 z-10 border border-slate-200 shadow-sm">
                              <p className="text-[9px] font-black uppercase text-slate-500">{dia.toLocaleDateString('es-CL', {weekday: 'long'})}</p>
                              <p className="text-base font-black text-[#0A111F]">{dia.getDate()}</p>
                          </div>
                          
                          <div className="flex flex-col gap-2.5">
                              {citasEsteDia.length > 0 ? citasEsteDia.map((c, cIndex) => {
                                  const hInicio = new Date(c.inicio).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
                                  const configEstado = ESTADOS_CITA[c.estado] || ESTADOS_CITA.programada;
                                  const pNombre = c.pacientes?.nombre || 'S/N';
                                  const pApellido = c.pacientes?.apellido || '';
                                  const theme = getAvatarColorClass(pNombre + pApellido);
                                  
                                  return (
                                      <motion.div 
                                          initial={{ opacity: 0, scale: 0.95 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ delay: (diaIndex * 0.05) + (cIndex * 0.05) }}
                                          key={c.id} 
                                          className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border-l-4 ${theme.border}`}
                                      >
                                          <div className="pl-1">
                                              <p className="text-xs font-black text-slate-900 leading-tight mb-1 truncate">{pNombre} {pApellido}</p>
                                              
                                              <div className="flex flex-col items-start gap-1.5 mt-2">
                                                  <div className="flex items-center justify-between w-full">
                                                      <span className="text-[10px] font-black text-[#8A6D2F] bg-[#C9A24B]/10 px-1.5 py-0.5 rounded-md">{hInicio}</span>
                                                      <span className={`text-[8px] font-black uppercase ${configEstado.text}`}>{configEstado.label}</span>
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          {/* Overlay Hover Actions */}
                                          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                              <button onClick={(e) => { e.stopPropagation(); iniciarReprogramacion(c); }} className="p-1.5 text-slate-500 hover:bg-[#C9A24B]/10 hover:text-[#C9A24B] rounded-md transition-all"><CalendarClock size={14}/></button>
                                              <button onClick={() => abrirEnvioPresupuesto(c)} className="p-1.5 text-slate-500 hover:bg-[#C9A24B]/10 hover:text-[#C9A24B] rounded-md transition-all"><FileText size={14}/></button>
                                              <button onClick={() => contactarWhatsApp(c.pacientes?.telefono, c.pacientes?.nombre, c.estado, hInicio)} className="p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 rounded-md transition-all"><MessageCircle size={14}/></button>
                                              {puedeVerFinanzas && (
                                                  <button onClick={(e) => { e.stopPropagation(); abrirCaja(c); }} className="p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 rounded-md transition-all"><Coins size={14}/></button>
                                              )}
                                          </div>
                                      </motion.div>
                                  )
                              }) : (
                                  <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl opacity-40">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sin citas</span>
                                  </div>
                              )}
                          </div>
                      </motion.div>
                  )
              })}
          </div>
      )}

      {/* MODALES */}
      <AnimatePresence>
        {modalEnvioPresupuesto.abierto && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
             <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left" style={{ background: `linear-gradient(135deg, ${NAVY}, #081420)` }}>
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl shadow-sm" style={{ backgroundColor: 'rgba(201,162,75,0.15)', border: `1px solid ${GOLD}` }}><Send size={20} style={{ color: GOLD_LIGHT }}/></div>
                      <div>
                        <h2 className="font-display text-lg tracking-tight text-white leading-none">Enviar Presupuesto</h2>
                        <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: GOLD }}>Pre-armado automático</p>
                      </div>
                   </div>
                   <button onClick={() => setModalEnvioPresupuesto({...modalEnvioPresupuesto, abierto: false})} className="p-2 text-white/60 hover:bg-white/10 rounded-full transition-colors"><X size={18}/></button>
                </div>
                <div className="p-6 md:p-8 space-y-4">
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">Puedes editar el texto antes de enviarlo. Al hacer clic en enviar, se abrirá WhatsApp Web/Móvil con este mensaje listo para tu paciente <span className="font-black text-slate-800">{modalEnvioPresupuesto.cita?.pacientes?.nombre}</span>.</p>
                    <textarea 
                        className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:border-[#C9A24B] transition-all shadow-inner resize-none custom-scrollbar"
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

      <AnimatePresence>
        {modalSeleccionTratamiento.abierto && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left" style={{ background: `linear-gradient(135deg, ${NAVY}, #081420)` }}>
                  <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl shadow-sm" style={{ backgroundColor: 'rgba(201,162,75,0.15)', border: `1px solid ${GOLD}` }}><FileText size={20} style={{ color: GOLD_LIGHT }}/></div>
                      <div>
                        <h2 className="font-display text-lg tracking-tight text-white leading-none">Seleccionar Tratamiento</h2>
                        <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: GOLD }}>Elige qué plan enviar</p>
                      </div>
                  </div>
                  <button onClick={() => setModalSeleccionTratamiento({abierto: false, cita: null, tratamientos: []})} className="p-2 text-white/60 hover:bg-white/10 rounded-full transition-colors"><X size={18}/></button>
                </div>
                <div className="p-6 md:p-8 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">El paciente tiene varios planes de tratamiento. Por favor, selecciona cuál de ellos deseas enviar por WhatsApp.</p>
                    {modalSeleccionTratamiento.tratamientos.map(t => (
                        <button 
                          key={t.id} 
                          onClick={() => {
                              generarYMostrarResumen(t.id, modalSeleccionTratamiento.cita);
                              setModalSeleccionTratamiento({abierto: false, cita: null, tratamientos: []});
                          }}
                          className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#C9A24B] hover:bg-[#C9A24B]/5 transition-all flex items-center justify-between group text-left"
                        >
                          <span className="font-black text-sm uppercase text-slate-800 group-hover:text-[#8A6D2F]">{t.nombre_tratamiento || 'Tratamiento sin nombre'}</span>
                          <ChevronRightIcon size={20} className="text-slate-300 group-hover:text-[#C9A24B] group-hover:translate-x-1 transition-transform" />
                        </button>
                    ))}
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalBloqueo && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
             <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left" style={{ background: `linear-gradient(135deg, ${NAVY}, #081420)` }}>
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl shadow-sm" style={{ backgroundColor: 'rgba(220,80,70,0.15)', border: '1px solid rgba(220,80,70,0.6)' }}><Lock size={20} className="text-red-300"/></div>
                      <div>
                        <h2 className="font-display text-lg tracking-tight text-white leading-none">Bloquear Agenda</h2>
                        <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: GOLD }}>Bloquea turnos a pacientes</p>
                      </div>
                   </div>
                   <button onClick={() => setModalBloqueo(false)} className="p-2 text-white/60 hover:bg-white/10 rounded-full transition-colors"><X size={18}/></button>
                </div>
                <div className="p-8 space-y-6">
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">Se bloqueará la agenda para el <span className="font-black text-red-500">{selectedDate.toLocaleDateString('es-CL')}</span>.</p>
                    
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Doctor a bloquear</label>
                       <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-red-500 transition-all shadow-sm cursor-pointer" value={profesionalBloqueo} onChange={(e) => setProfesionalBloqueo(e.target.value)}>
                           <option value="">Seleccione especialista...</option>
                           {profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                       </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Motivo del bloqueo</label>
                        <input type="text" placeholder="Ej: Licencia Médica, Colación..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-red-500 transition-all shadow-sm" value={motivoBloqueo} onChange={(e) => setMotivoBloqueo(e.target.value)} />
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">¿Bloquear todo el día?</span>
                            <input type="checkbox" checked={bloqueoTodoElDia} onChange={(e) => setBloqueoTodoElDia(e.target.checked)} className="w-5 h-5 accent-red-500 cursor-pointer" />
                        </div>
                        
                        {!bloqueoTodoElDia && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Desde las</label>
                                    <input type="time" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500" value={horaInicioBloqueo} onChange={e => setHoraInicioBloqueo(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Hasta las</label>
                                    <input type="time" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500" value={horaFinBloqueo} onChange={e => setHoraFinBloqueo(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-6 md:p-8 border-t border-slate-100 bg-white shrink-0 text-left">
                   <button onClick={handleGuardarBloqueoRapido} disabled={cargandoAccion || !motivoBloqueo.trim() || !profesionalBloqueo || (!bloqueoTodoElDia && (!horaInicioBloqueo || !horaFinBloqueo))} className="w-full py-4 bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {cargandoAccion ? <Loader2 className="animate-spin" size={16}/> : <Ban size={16}/>} Confirmar Bloqueo
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalPagoAbierto && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
             <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left" style={{ background: `linear-gradient(135deg, ${NAVY}, #081420)` }}>
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-2xl shadow-sm" style={{ backgroundColor: 'rgba(201,162,75,0.15)', border: `1px solid ${GOLD}` }}><ReceiptText size={24} style={{ color: GOLD_LIGHT }}/></div>
                      <div>
                        <h2 className="font-display text-xl tracking-tight text-white leading-none">Caja y Pagos</h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: GOLD }}>Paciente: {pacientePago?.nombre} {pacientePago?.apellido}</p>
                      </div>
                   </div>
                   <button onClick={() => setModalPagoAbierto(false)} className="p-2 text-white/60 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
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
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deuda Exigible</h4>
                              <p className="text-4xl font-black text-slate-900 tracking-tighter">${calcularDeudaTotalCaja().toLocaleString('es-CL')}</p>
                              {planesDetalladosAgenda.length > 1 && deudaTotalPlanAgenda > calcularDeudaTotalCaja() ? (
                                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Desglose Deuda Total</p>
                                  {planesDetalladosAgenda.map(plan => (
                                    <div key={plan.id} className="flex justify-between items-center text-xs">
                                      <span className="font-bold text-slate-500 uppercase">{plan.nombre}</span>
                                      <span className="font-black text-slate-700">${plan.deudaTotal.toLocaleString('es-CL')}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : deudaTotalPlanAgenda > calcularDeudaTotalCaja() ? (
                                <p className="text-xs font-bold text-slate-400 mt-2 border-t border-slate-100 pt-2">
                                  Deuda Plan Completo: 
                                  <span className="text-slate-600 font-black ml-2">${deudaTotalPlanAgenda.toLocaleString('es-CL')}</span>
                                </p>
                              ) : null}
                           </div>

                           <div className="text-left text-slate-900">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Detalle a pagar</h4>
                              <div className="space-y-2">
                                 {deudasPaciente.map(d => (
                                     <div key={d.id} className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left">
                                         <div className="text-left">
                                            <div className="flex items-center gap-3 mb-1">
                                                <p className="text-xs font-black uppercase text-slate-800 leading-none">{d.nombreDisplay}</p>
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase leading-none ${d.estado === 'realizado' ? 'bg-emerald-100 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-500 border border-red-100'}`}>
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
                                 <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-[#C9A24B] transition-all shadow-sm cursor-pointer" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                                     <option value="tarjeta">Tarjeta (Débito/Crédito)</option>
                                     <option value="efectivo">Efectivo</option>
                                     <option value="transferencia">Transferencia</option>
                                     {saldoAFavor > 0 && (
                                        <option value="Saldo a Favor">💰 Saldo a Favor (${saldoAFavor.toLocaleString('es-CL')})</option>
                                     )}
                                 </select>
                              </div>
                              <div className="space-y-2 text-left">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Monto a Recaudar ($)</label>
                                 <input type="number" placeholder="Ej: 50000" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-lg text-emerald-600 outline-none focus:border-emerald-500 placeholder:text-slate-300 transition-all shadow-sm" value={montoIngresado} onChange={(e) => setMontoIngresado(Number(e.target.value))} />
                              </div>
                              
                              {metodoPago !== 'Saldo a Favor' && (
                                <div className="space-y-2 md:col-span-2 text-left">
                                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">N° Boleta / Cód. Transacción</label>
                                   <input type="text" placeholder="Ej: BOLETA-1234 o TX-987" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-[#C9A24B] placeholder:text-slate-300 uppercase transition-all shadow-sm" value={codigoTransaccion} onChange={(e) => setCodigoTransaccion(e.target.value)} />
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
                      className="w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110"
                      style={{ background: NAVY, color: GOLD_LIGHT }}
                   >
                      {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : <Coins size={18}/>}
                      Registrar Pago Seguro
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalHuerfanasAbierto && (
          <div className="fixed inset-0 z-[99999] flex items-start justify-center px-4 pb-4 pt-16 md:pt-24 bg-slate-900/60 backdrop-blur-sm text-slate-900 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative text-slate-900 text-left">
              <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left" style={{ background: `linear-gradient(135deg, ${NAVY}, #081420)` }}>
                <div className="flex items-center gap-5 text-left">
                  <div className="p-3 rounded-2xl shadow-sm" style={{ backgroundColor: 'rgba(245,180,60,0.15)', border: '1px solid rgba(245,180,60,0.6)' }}><AlertTriangle size={24} className="text-amber-300" /></div>
                  <div>
                    <h2 className="font-display text-xl tracking-tight text-white leading-none text-left">Citas Huérfanas</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: GOLD }}>Requieren Reagendamiento</p>
                  </div>
                </div>
                <button onClick={() => setModalHuerfanasAbierto(false)} className="p-2 text-white/60 hover:bg-white/10 rounded-full transition-all text-left"><X size={20} /></button>
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
                        const isEditing = citaEnEdicion === cita.id;

                        return (
                            <div key={cita.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col group transition-all">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex flex-col items-center justify-center border border-amber-100 shrink-0">
                                    <span className="text-xs font-black">{horaFormat}</span>
                                </div>
                                <div>
                                    <h4 className="font-black text-sm text-slate-800 uppercase leading-none">{cita.pacientes?.nombre} {cita.pacientes?.apellido}</h4>
                                    <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[9px] font-bold text-slate-500 tracking-widest bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                                        <CalendarDays size={10} className="inline mr-1"/> {fechaFormat}
                                    </span>
                                    </div>
                                </div>
                                </div>
                                
                                {!isEditing && (
                                <div className="flex gap-2 self-start md:self-auto">
                                    <button onClick={() => {
                                    const dInicio = new Date(cita.inicio.replace(' ', 'T'));
                                    const dFin = new Date(cita.fin.replace(' ', 'T'));
                                    const calcMins = Math.round((dFin.getTime() - dInicio.getTime()) / 60000);
                                    setDuracionCitaEdicion(calcMins > 0 ? calcMins : 30);
                                    setCitaEnEdicion(cita.id);
                                    setNuevaFecha(''); setNuevaHora('');
                                    setNuevoEspecialista(cita.profesional_id || profesionales[0]?.user_id || '');
                                    setSemanaInicioEdicion(getLunes(new Date()));
                                    }} className="px-4 py-2 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white rounded-xl transition-all flex items-center gap-2 shadow-sm">
                                    <CalendarClock size={14} /> Reagendar
                                    </button>
                                    <button onClick={() => anularCitaDirecta(cita.id)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm">
                                        <Ban size={16} />
                                    </button>
                                </div>
                                )}
                            </div>

                            <AnimatePresence>
                                {isEditing && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-6">
                                    
                                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                        <div className="space-y-2 flex-1 w-full">
                                        <label className="text-[9px] font-black uppercase ml-2 flex items-center gap-1" style={{ color: GOLD }}><UserCheck size={12}/> Especialista a derivar</label>
                                        <select className="w-full p-4 bg-white border border-[#C9A24B]/40 rounded-xl font-bold text-xs outline-none text-slate-700" value={nuevoEspecialista} onChange={(e) => setNuevoEspecialista(e.target.value)}>
                                            {profesionales.map(p => <option key={p.user_id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                                        </select>
                                        </div>
                                        <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 self-end md:self-auto shrink-0 mt-6 md:mt-0">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase">Buscando huecos de {duracionCitaEdicion} min</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col">
                                        <div className="flex items-center justify-between mb-4 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                        <button onClick={prevWeekEdicion} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all"><ChevronLeft size={18}/></button>
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                                            Semana del {semanaInicioEdicion.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                                        </span>
                                        <button onClick={nextWeekEdicion} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all"><ChevronRight size={18}/></button>
                                        </div>

                                        <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                                        {cargandoSlotsEdicion ? (
                                            <div className="w-full py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
                                            <Loader2 className="animate-spin" size={24} />
                                            </div>
                                        ) : (
                                            dispoSemanaEdicion.map((dia, idx) => {
                                            const nombreDia = dia.dateObj.toLocaleDateString('es-CL', { weekday: 'short' });
                                            const numDia = dia.dateObj.getDate();
                                            const esHoy = dia.date === new Date().toISOString().split('T')[0];

                                            return (
                                                <div key={idx} className={`min-w-[110px] flex-1 bg-white border ${esHoy ? 'border-[#C9A24B] shadow-md' : 'border-slate-200'} rounded-2xl p-3 flex flex-col items-center`}>
                                                <div className="text-center mb-3">
                                                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">{nombreDia}</span>
                                                    <span className={`block text-lg font-black ${esHoy ? '' : 'text-slate-800'}`} style={esHoy ? { color: '#8A6D2F' } : undefined}>{numDia}</span>
                                                </div>

                                                <div className="w-full flex-1 flex flex-col gap-2 overflow-y-auto max-h-48 pr-1 custom-scrollbar">
                                                    {dia.status === 'bloqueado' && <span className="text-[9px] font-bold text-red-400 text-center py-4 italic">Bloqueado</span>}
                                                    {dia.status === 'sin_horario' && <span className="text-[9px] font-bold text-slate-300 text-center py-4 italic">Sin Horario</span>}
                                                    {dia.status === 'lleno' && <span className="text-[9px] font-bold text-amber-400 text-center py-4 italic">Agenda Llena</span>}
                                                    
                                                    {dia.status === 'limpio' && dia.slots.map((slot: string, sIdx: number) => {
                                                    const isSelected = nuevaFecha === dia.date && nuevaHora === slot;
                                                    return (
                                                        <button
                                                        key={sIdx}
                                                        onClick={() => { setNuevaFecha(dia.date); setNuevaHora(slot); }}
                                                        className={`w-full py-2 rounded-lg text-[10px] font-black transition-all border ${isSelected ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' : 'bg-slate-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}
                                                        >
                                                        {slot}
                                                        </button>
                                                    )
                                                    })}
                                                </div>
                                                </div>
                                            )
                                            })
                                        )}
                                        </div>
                                        
                                        <div className="mt-2 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-4">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Seleccionado: <span className={nuevaHora ? "text-emerald-600" : "text-red-400"}>
                                            {nuevaHora ? `${nuevaFecha} a las ${nuevaHora}` : "Ninguno"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 w-full md:w-auto">
                                            <button onClick={() => setCitaEnEdicion(null)} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase hover:text-slate-700 transition-all">Cancelar</button>
                                            <button onClick={() => reagendarCitaHuérfanaDirecta(cita.id)} disabled={cargandoAccion || !nuevaHora} className={`flex-1 md:flex-none px-8 py-3 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md flex items-center justify-center gap-2 transition-all ${nuevaHora ? 'bg-emerald-500 hover:bg-emerald-600 active:scale-95' : 'bg-slate-300 cursor-not-allowed'}`}>
                                            {cargandoAccion ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Confirmar
                                            </button>
                                        </div>
                                        </div>

                                    </div>
                                    </div>
                                </motion.div>
                                )}
                            </AnimatePresence>
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

      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 z-[999999] flex items-start justify-center px-4 pb-4 pt-16 md:pt-24 bg-slate-900/60 backdrop-blur-sm text-slate-900 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-7xl h-full max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative text-slate-900 text-left">
              <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0 text-left" style={{ background: `linear-gradient(135deg, ${NAVY}, #081420)` }}>
                <div className="flex items-center gap-5 text-left"><div className="p-3 rounded-2xl" style={{ backgroundColor: citaEnReprogramacion ? 'rgba(168,85,247,0.15)' : 'rgba(201,162,75,0.15)', border: citaEnReprogramacion ? '1px solid rgba(168,85,247,0.5)' : `1px solid ${GOLD}` }}><CalendarDays size={24} className={citaEnReprogramacion ? 'text-purple-300' : ''} style={!citaEnReprogramacion ? { color: GOLD_LIGHT } : undefined} /></div><h2 className="font-display text-xl tracking-tight text-white leading-none text-left">{citaEnReprogramacion ? 'Reagendar Cita' : 'Nueva Reserva'} • Paso {paso}</h2></div>
                <button onClick={() => { setModalAbierto(false); setCitaEnReprogramacion(null); }} className="p-2 text-white/60 hover:bg-white/10 rounded-full transition-all text-left"><X size={20} /></button>
              </div>
              <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
                {paso === 1 ? (
                  <>
                    <aside className="hidden md:block md:w-[300px] border-r border-slate-200 p-8 bg-slate-50 space-y-6 overflow-y-auto text-left text-slate-900 custom-scrollbar">
                      <div className={`p-6 rounded-2xl shadow-sm border text-left bg-white ${citaEnReprogramacion ? 'border-purple-200' : 'border-[#C9A24B]/40'}`}>
                        <p className="text-[10px] font-black uppercase mb-1 text-slate-400 tracking-widest text-left">Seleccionado</p>
                        <p className={`text-4xl font-black leading-none text-left ${citaEnReprogramacion ? 'text-purple-600' : ''}`} style={!citaEnReprogramacion ? { color: '#8A6D2F' } : undefined}>{horasSeleccionadas.length}</p>
                      </div>
                      <div className="space-y-6 text-left">
                        <div className="space-y-2 text-left text-slate-900">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">Especialista</label>
                          <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-900 cursor-pointer shadow-sm focus:border-[#C9A24B]" value={filtro.profesional_id || ""} onChange={(e) => { setFiltro({...filtro, profesional_id: e.target.value}); setHorasSeleccionadas([]); }}>
                            <option value="">Seleccionar...</option>
                            {profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">Duración base</label>
                          <div className="grid grid-cols-3 gap-2 text-left">
                            {duracionesDisponibles.slice(0,6).map(m => ( 
                                <button 
                                  key={m} 
                                  onClick={() => {
                                      setFiltro({...filtro, duracionDefault: m});
                                      
                                      setHorasSeleccionadas(prev => {
                                          const validas = prev.filter(s => {
                                              const laboral = esHorarioLaboral(s.fecha, s.hora, m);
                                              const ocupado = esCitaOcupada(s.fecha, s.hora, m);
                                              if (!laboral || ocupado) {
                                                  toast.warning(`La hora ${s.hora} se quitó por falta de tiempo`);
                                                  return false;
                                              }
                                              return true;
                                          });
                                          return validas.map(v => ({ ...v, duracion: m }));
                                      });
                                  }} 
                                  className={`py-3 rounded-xl text-[10px] font-black border transition-all ${filtro.duracionDefault === m ? 'bg-[#C9A24B]/10 border-[#C9A24B] text-[#8A6D2F] shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 shadow-sm'}`}
                                >
                                  {m}m
                                </button> 
                            ))}
                          </div>
                        </div>
                      </div>
                    </aside>
                    <main className="flex-1 p-4 md:p-8 bg-[#F8FAFC] flex flex-col text-slate-900 text-left overflow-hidden">
                      <div className="md:hidden space-y-4 mb-4 p-4 bg-white rounded-2xl border border-slate-200">
                        <div className="space-y-2 text-left text-slate-900">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">Especialista</label>
                          <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-900 cursor-pointer shadow-sm focus:border-[#C9A24B]" value={filtro.profesional_id || ""} onChange={(e) => { setFiltro({...filtro, profesional_id: e.target.value}); setHorasSeleccionadas([]); }}>
                            <option value="">Seleccionar...</option>
                            {profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 text-left">Duración base</label>
                          <div className="grid grid-cols-3 gap-2 text-left">
                            {duracionesDisponibles.slice(0,6).map(m => ( 
                                <button 
                                  key={m} 
                                  onClick={() => {
                                      setFiltro({...filtro, duracionDefault: m});
                                      setHorasSeleccionadas(prev => {
                                          const validas = prev.filter(s => {
                                              const laboral = esHorarioLaboral(s.fecha, s.hora, m);
                                              const ocupado = esCitaOcupada(s.fecha, s.hora, m);
                                              if (!laboral || ocupado) {
                                                  toast.warning(`La hora ${s.hora} se quitó por falta de tiempo`);
                                                  return false;
                                              }
                                              return true;
                                          });
                                          return validas.map(v => ({ ...v, duracion: m }));
                                      });
                                  }} 
                                  className={`py-3 rounded-xl text-[10px] font-black border transition-all ${filtro.duracionDefault === m ? 'bg-[#C9A24B]/10 border-[#C9A24B] text-[#8A6D2F] shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 shadow-sm'}`}
                                >
                                  {m}m
                                </button> 
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-left">
                        <button onClick={() => navegarSemana('atras')} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg font-black text-[10px] uppercase text-slate-500 transition-all text-left"><ChevronLeft size={14}/> Ant.</button>
                        <span className="font-black text-xs uppercase tracking-widest text-slate-600 text-center">Disponibilidad</span>
                        <button onClick={() => navegarSemana('adelante')} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg font-black text-[10px] uppercase text-slate-700 transition-all text-left">Sig. <ChevronRight size={14}/></button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 pr-4">
                        <div className="grid grid-cols-6 gap-2 md:gap-4 sticky top-0 bg-[#F8FAFC] z-10 py-2 mb-2">
                          {getDiasLunesSabado(semanaInicio).map(dia => (
                            <p key={getLocalDateISO(dia)} className="text-[10px] font-black uppercase text-slate-500 text-center">
                              {dia.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
                            </p>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {slotsHorarios.map(hora => (
                            <div key={hora} className="grid grid-cols-6 gap-2 md:gap-4 items-center min-h-[44px]">
                              {getDiasLunesSabado(semanaInicio).map(dia => {
                                const fStr = getLocalDateISO(dia);
                                const laboral = esHorarioLaboral(fStr, hora, filtro.duracionDefault);
                                const ocupado = esCitaOcupada(fStr, hora, filtro.duracionDefault);
                                const sel = horasSeleccionadas.some(x => x.fecha === fStr && x.hora === hora);
                                const diaCompletamenteBloqueado = bloqueosSemana.some(b => b.fecha === fStr && (!b.hora_inicio || !b.hora_fin));
                                
                                const chocaConSeleccion = horasSeleccionadas.some(s => {
                                  if (s.fecha === fStr && s.hora === hora) return false;
                                  const selStart = new Date(`${s.fecha}T${s.hora}:00`).getTime();
                                  const selEnd = selStart + s.duracion * 60000;
                                  const slotStart = new Date(`${fStr}T${hora}:00`).getTime();
                                  const slotEnd = slotStart + filtro.duracionDefault * 60000;
                                  return slotStart < selEnd && slotEnd > selStart;
                                });

                                let btnClass = "w-full py-2.5 text-[10px] font-black rounded-xl border transition-all ";
                                if (sel) btnClass += "text-white border-[#0E1B2E] shadow-md bg-[#0E1B2E]";
                                else if (ocupado || diaCompletamenteBloqueado || chocaConSeleccion) btnClass += "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed opacity-50 line-through decoration-slate-300";
                                else if (laboral) btnClass += "bg-white border-slate-200 text-slate-600 hover:border-[#C9A24B] hover:text-[#8A6D2F] hover:bg-[#C9A24B]/5 shadow-sm";
                                else return <div key={fStr}></div>;

                                return (
                                  <div key={fStr}>
                                    <button
                                      onClick={() => handleSlotClick(fStr, hora)}
                                      className={btnClass}
                                    >
                                      {hora}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </main>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white text-slate-900 text-left">
                    <div className="w-full md:w-1/2 border-r border-slate-200 p-8 md:p-12 bg-slate-50 overflow-y-auto space-y-6 text-left text-slate-900 custom-scrollbar">
                        <h3 className="text-sm font-black uppercase text-slate-700 flex items-center gap-2 text-left"><Timer size={16}/> Ajustar Tiempos</h3>
                        {horasSeleccionadas.map((s, idx) => (
                          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm text-left text-slate-900 group">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase">{s.fecha}</p>
                              <p className="text-lg font-black text-slate-700">{s.hora} hrs</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none text-slate-900 focus:border-[#C9A24B]"
                                value={s.duracion}
                                onChange={(e) => {
                                  const newDur = Number(e.target.value);
                                  const laboral = esHorarioLaboral(s.fecha, s.hora, newDur);
                                  const ocupado = esCitaOcupada(s.fecha, s.hora, newDur);
                                  const chocaConOtraSeleccion = horasSeleccionadas.some((otra, idxOtra) => {
                                    if (idx === idxOtra) return false;
                                    const otraStart = new Date(`${otra.fecha}T${otra.hora}:00`).getTime();
                                    const otraEnd = otraStart + otra.duracion * 60000;
                                    const miStart = new Date(`${s.fecha}T${s.hora}:00`).getTime();
                                    const miEnd = miStart + newDur * 60000;
                                    return miStart < otraEnd && miEnd > otraStart;
                                  });
                                  if (!laboral || ocupado || chocaConOtraSeleccion) {
                                    toast.error("La nueva duración excede el turno o choca con otra cita.");
                                    return;
                                  }
                                  const c = [...horasSeleccionadas]; c[idx].duracion = newDur; setHorasSeleccionadas(c);
                                }}
                              >
                                {duracionesDisponibles.map(d => <option key={d} value={d} className="text-slate-900">{d} min</option>)}
                              </select>
                              <button onClick={() => toggleHora(s.fecha, s.hora)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100" title="Eliminar bloque">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto space-y-8 text-left text-slate-900 custom-scrollbar">
                        <div className="space-y-4 text-left text-slate-900">
                            <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight text-left">Paciente</h3>
                            {citaEnReprogramacion ? ( <div className="p-6 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-between text-left"><div className="text-left text-slate-900"><p className="text-base font-black uppercase text-purple-900 leading-none text-left">{citaEnReprogramacion.pacientes?.nombre} {citaEnReprogramacion.pacientes?.apellido}</p><p className="text-[10px] font-bold text-purple-500 mt-2 tracking-widest text-left">RUT: {citaEnReprogramacion.pacientes?.rut}</p></div><RefreshCcw className="text-purple-500" size={20} /></div>  ) : (
                        <div className="space-y-4 text-left text-slate-900">
                          {modoNuevoPaciente ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm text-left">
                              <input placeholder="Nombre" className="md:col-span-1 p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-[#C9A24B] text-slate-900" value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente(prev => ({...prev, nombre: e.target.value}))}/>
                              <input placeholder="Apellido" className="md:col-span-1 p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-[#C9A24B] text-slate-900" value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente(prev => ({...prev, apellido: e.target.value}))}/>
                              
                              <div className="md:col-span-2 flex items-center gap-2 mt-2">
                                  <input 
                                      type="checkbox" 
                                      id="otro_documento_agenda" 
                                      className="w-4 h-4 accent-[#C9A24B]"
                                      checked={esOtroDocumento}
                                      onChange={(e) => {
                                          setEsOtroDocumento(e.target.checked);
                                          setNuevoPaciente(prev => ({...prev, rut: ''}));
                                      }}
                                  />
                                  <label htmlFor="otro_documento_agenda" className="text-xs font-bold text-slate-600 cursor-pointer">
                                      Paciente extranjero / Usar otro documento
                                  </label>
                              </div>

                              <div className="md:col-span-2">
                                  <input 
                                      placeholder={esOtroDocumento ? "N° de Pasaporte o Identificación" : "RUT (sin puntos, con guión)"} 
                                      className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-[#C9A24B] text-slate-900" 
                                      value={nuevoPaciente.rut} 
                                      onChange={e => setNuevoPaciente(prev => ({...prev, rut: e.target.value}))}
                                  />
                              </div>

                              <input placeholder="Teléfono" className="md:col-span-1 p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-[#C9A24B] text-slate-900" value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente(prev => ({...prev, telefono: e.target.value}))}/>
                              
                              <div className="space-y-1 md:col-span-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Fecha de Nacimiento</label>
                                  <input 
                                      type="date" 
                                      className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-[#C9A24B] text-slate-900" 
                                      value={nuevoPaciente.fecha_nacimiento} 
                                      onChange={e => setNuevoPaciente(prev => ({...prev, fecha_nacimiento: e.target.value}))}
                                  />
                              </div>

                              <div className="space-y-1 md:col-span-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Sexo</label>
                                  <select 
                                      className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none focus:border-[#C9A24B] text-slate-900"
                                      value={nuevoPaciente.sexo}
                                      onChange={e => setNuevoPaciente(prev => ({...prev, sexo: e.target.value}))}
                                  >
                                      <option value="">Seleccionar...</option>
                                      <option value="Masculino">Masculino</option>
                                      <option value="Femenino">Femenino</option>
                                      <option value="Otro">Otro</option>
                                  </select>
                              </div>
                            </div>
                          ) : (
                            <div className="text-left space-y-4 text-slate-900">
                              <div className="relative group text-left">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input placeholder="Buscar por Nombre o RUT..." className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-[#C9A24B] shadow-sm text-slate-900" value={busqueda} onChange={e => {setBusqueda(e.target.value); buscarPacientes(e.target.value);}} />
                              </div>
                              {pacientesEncontrados.map(p => ( <button key={p.id} onClick={() => seleccionarPacienteExistente(p)} className="w-full p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#C9A24B] shadow-sm transition-all flex items-center justify-between text-left"><div className="text-left text-slate-900"><p className="font-black text-sm uppercase text-left">{p.nombre} {p.apellido}</p><p className="text-[10px] font-bold text-slate-400 text-left mt-1">{p.rut}</p></div><ChevronRightIcon size={16} className="text-slate-300"/></button> ))}
                              {pacienteSeleccionado && pacientesEncontrados.length === 0 && ( <div className="p-5 rounded-2xl border border-[#C9A24B] bg-[#C9A24B]/5 flex items-center justify-between text-left text-slate-900"><p className="font-black text-sm uppercase text-left" style={{ color: '#8A6D2F' }}>{pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}</p><CheckCircle2 style={{ color: '#C9A24B' }} /></div> )}
                            </div>
                          )}
                        </div>
                      )}
                        </div>
                        {(pacienteSeleccionado || modoNuevoPaciente) && ( <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-slate-900 rounded-2xl text-white shadow-xl text-left"><h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2 tracking-widest text-left"><Briefcase size={14}/> Tratamiento</h4>{!modoNuevoPaciente && tratamientosPaciente.length > 0 ? ( <div className="space-y-3 text-left"><label className="text-[9px] font-bold text-slate-400 uppercase pl-1 text-left">Plan activo</label><select className="w-full p-4 bg-white/10 rounded-xl font-bold text-xs outline-none border border-transparent focus:border-[#C9A24B] text-white appearance-none cursor-pointer" value={tratamientoSeleccionadoId || ''} onChange={(e) => { const val = e.target.value; setTratamientoSeleccionadoId(val); if (val !== 'MANUAL') { const t = tratamientosPaciente.find(x => x.id === val); setNuevoTratamientoNombre(t?.nombre_tratamiento || ''); } else setNuevoTratamientoNombre(''); }}>{tratamientosPaciente.map(t => <option key={t.id} value={t.id} className="text-slate-900">{t.nombre_tratamiento.toUpperCase()}</option>)}<option value="MANUAL" className="text-slate-900 italic">+ OTRO MOTIVO</option></select>{(tratamientoSeleccionadoId === 'MANUAL' || !tratamientoSeleccionadoId) && ( <input placeholder="Especifique motivo..." className="w-full p-4 bg-white/10 rounded-xl font-bold text-xs outline-none border border-transparent focus:border-[#C9A24B] text-white uppercase mt-2 shadow-inner" value={nuevoTratamientoNombre} onChange={(e) => setNuevoTratamientoNombre(e.target.value)} /> )}</div> ) : ( <input placeholder="Ej: Evaluación General, Urgencia..." className="w-full p-4 bg-white/10 rounded-xl font-bold text-xs outline-none border border-transparent focus:border-[#C9A24B] text-white uppercase" value={nuevoTratamientoNombre} onChange={(e) => setNuevoTratamientoNombre(e.target.value)} /> )}</motion.div> )}
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
                    <button onClick={() => { setModoNuevoPaciente(!modoNuevoPaciente); setPacienteSeleccionado(null); setBusqueda(''); setEsOtroDocumento(false); }} className="text-[10px] font-black text-[#C9A24B] uppercase underline mr-4 text-left whitespace-nowrap">{paso === 2 && !citaEnReprogramacion && (modoNuevoPaciente ? 'Buscar Existente' : '+ Registrar Nuevo')}</button>
                    {paso === 2 && <button onClick={() => setPaso(1)} className="px-6 py-3.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase text-slate-600 hover:bg-slate-100 shadow-sm transition-all text-left">Atrás</button>}
                    <button disabled={cargandoAccion || horasSeleccionadas.length === 0 || (paso === 2 && !modoNuevoPaciente && !pacienteSeleccionado)} onClick={() => { if(paso === 1) { setPaso(2); } else { handleGuardar(); } }} className={`px-10 py-3.5 rounded-xl font-black text-[10px] uppercase shadow-md transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto ${citaEnReprogramacion ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'hover:brightness-110'}`} style={!citaEnReprogramacion ? { background: `linear-gradient(120deg, ${GOLD_LIGHT}, ${GOLD})`, color: INK } : undefined}>
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
          <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm">
              <div className="bg-white rounded-[3rem] shadow-2xl p-10 text-center space-y-8">
                <CheckCircle2 className="mx-auto text-emerald-500" size={64} />
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">¡Cita Lista!</h2>
                <div className="text-left bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Paciente</p>
                    <p className="font-black text-base text-slate-800 uppercase mt-1 leading-none">{citaConfirmadaData?.paciente}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha y Hora</p>
                    <p className="font-black text-base text-slate-800 uppercase mt-1 leading-none">{citaConfirmadaData?.citas[0]?.fecha} • {citaConfirmadaData?.citas[0]?.hora} hrs</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (!citaConfirmadaData) return;
                      const { paciente, citas, telefono } = citaConfirmadaData;
                      if (!telefono) {
                        toast.error("El paciente no tiene un número de teléfono registrado.");
                        return;
                      }
                      const fecha = new Date(citas[0].fecha + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
                      const hora = citas[0].hora;
                      const mensaje = `Hola ${paciente}, hemos agendado tu cita para el día ${fecha} a las ${hora} hrs. ¡Te esperamos en Clínica Dignidad!`;
                      const numLimpio = telefono.replace(/\D/g, '');
                      const numFinal = numLimpio.length === 9 ? `56${numLimpio}` : numLimpio;
                      window.open(`https://wa.me/${numFinal}?text=${encodeURIComponent(mensaje)}`, '_blank');
                      setMostrarTicket(false);
                      setModalAbierto(false);
                      resetEstados();
                      fetchCitasAgenda();
                    }}
                    className="w-full py-4 bg-emerald-500 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={14} /> Finalizar y Enviar WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      setMostrarTicket(false);
                      setModalAbierto(false);
                      resetEstados();
                      fetchCitasAgenda();
                    }}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Finalizar sin enviar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
