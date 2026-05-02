'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  X, Search, ChevronLeft, ChevronRight, Loader2, Clock, 
  CalendarDays, Timer, UserCheck, Trash2, Activity, ClipboardList, 
  CheckCircle2, ArrowDown, Plus, Calendar as CalendarIcon, Briefcase, 
  AlertTriangle, Phone, Mail, MessageCircle, MoreHorizontal, Ban, RefreshCcw, ChevronDown, CalendarClock,
  Coins, CreditCard, Banknote, ReceiptText
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner' 
import Link from 'next/link'

const ESTADOS_CITA: Record<string, { label: string, color: string, icon: any }> = {
  programada: { label: 'No Confirmado', color: 'bg-slate-100 text-slate-500', icon: <Clock size={12}/> },
  confirmado_tel: { label: 'Conf. Teléfono', color: 'bg-indigo-100 text-indigo-600', icon: <Phone size={12}/> },
  en_espera: { label: 'En Sala de Espera', color: 'bg-amber-100 text-amber-600', icon: <Timer size={12}/> },
  atendiendose: { label: 'En Box', color: 'bg-blue-100 text-blue-600', icon: <Activity size={12}/> },
  atendido: { label: 'Atendido', color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle2 size={12}/> },
  no_asiste: { label: 'No Asistió', color: 'bg-red-100 text-red-600', icon: <Ban size={12}/> },
  cancelada: { label: 'Anulada', color: 'bg-gray-200 text-gray-500', icon: <Trash2 size={12}/> },
  reprogramada: { label: 'Cambio Fecha', color: 'bg-purple-100 text-purple-600', icon: <RefreshCcw size={12}/> }
};

interface NuevoPaciente {
  nombre: string;
  apellido: string;
  rut: string;
  telefono: string;
  fecha_nacimiento: string;
  sexo: string;
}

// Utilidades para calcular tiempos
const tToMins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
const minsToT = (m: number) => {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
}
const getMinsFromDateStr = (dtString: string) => {
  const timePart = dtString.includes('T') ? dtString.split('T')[1] : dtString.split(' ')[1];
  return tToMins(timePart.substring(0,5));
}

// Obtener el Lunes de una fecha dada
const getLunes = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay() || 7; 
  date.setDate(date.getDate() - day + 1);
  date.setHours(0,0,0,0);
  return date;
}

export default function AgendaPage() {
  // --- ESTADOS VISTA PRINCIPAL ---
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [citasDia, setCitasDia] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [cargandoPagina, setCargandoPagina] = useState(true)
  const [filtroEspecialista, setFiltroEspecialista] = useState('Todos')
  const [citaEnReprogramacion, setCitaEnReprogramacion] = useState<any>(null)
  const [notificacion, setNotificacion] = useState<{ nombre: string } | null>(null)

  const statsDia = useMemo(() => {
    const anuladas = citasDia.filter(c => c.estado === 'cancelada').length;
    const reprogramadas = citasDia.filter(c => c.estado === 'reprogramada').length;
    return { totalPerdidas: anuladas + reprogramadas };
  }, [citasDia]);

  // --- ESTADOS MODAL AGENDAMIENTO ---
  const [modalAbierto, setModalAbierto] = useState(false)
  const [paso, setPaso] = useState(1) 
  const [semanaInicio, setSemanaInicio] = useState(new Date())
  const [filtro, setFiltro] = useState({ profesional_id: '', box_id: 1, duracionDefault: 30 })
  const [horasSeleccionadas, setHorasSeleccionadas] = useState<{fecha: string, hora: string, duracion: number}[]>([])
  const [horariosConfigurados, setHorariosConfigurados] = useState<any[]>([])
  const [citasOcupadas, setCitasOcupadas] = useState<any[]>([])
  const [bloqueosSemana, setBloqueosSemana] = useState<any[]>([]) 

  // --- ESTADOS CITAS HUÉRFANAS ---
  const [modalHuerfanasAbierto, setModalHuerfanasAbierto] = useState(false)
  const [citasHuerfanas, setCitasHuerfanas] = useState<any[]>([])
  const [cargandoHuerfanas, setCargandoHuerfanas] = useState(false)

  // --- ESTADOS PACIENTE ---
  const [modoNuevoPaciente, setModoNuevoPaciente] = useState(false)
  const [nuevoPaciente, setNuevoPaciente] = useState<NuevoPaciente>({ nombre: '', apellido: '', rut: '', telefono: '', fecha_nacimiento: '', sexo: '' })
  const [busqueda, setBusqueda] = useState('')
  const [pacientesEncontrados, setPacientesEncontrados] = useState<any[]>([])
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<any>(null)
  const [cargandoAccion, setCargandoAccion] = useState(false)
  
  // --- TRATAMIENTOS ---
  const [nuevoTratamientoNombre, setNuevoTratamientoNombre] = useState('')
  const [tratamientosPaciente, setTratamientosPaciente] = useState<any[]>([])
  const [tratamientoSeleccionadoId, setTratamientoSeleccionadoId] = useState<string | null>(null)
  
  // --- TICKET ---
  const [mostrarTicket, setMostrarTicket] = useState(false)
  const [citaConfirmadaData, setCitaConfirmadaData] = useState<any>(null)

  // --- ESTADOS MÓDULO CAJA / PAGOS ---
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false)
  const [pacientePago, setPacientePago] = useState<any>(null)
  const [deudasPaciente, setDeudasPaciente] = useState<any[]>([])
  const [cargandoDeudas, setCargandoDeudas] = useState(false)
  const [montoIngresado, setMontoIngresado] = useState<number | ''>('')
  const [metodoPago, setMetodoPago] = useState('tarjeta')
  const [codigoTransaccion, setCodigoTransaccion] = useState('')

  const duracionesDisponibles = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];

  useEffect(() => {
    const setupNotificaciones = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const canal = supabase.channel(`notificaciones-${user.id}`)
        .on('broadcast', { event: 'PACIENTE_EN_ESPERA' }, (payload) => {
          setNotificacion({ nombre: payload.payload.nombre });
          setTimeout(() => setNotificacion(null), 120000); 
        })
        .subscribe();
      return () => { supabase.removeChannel(canal) }
    };
    setupNotificaciones();
  }, []);

  useEffect(() => { cargarBasicos() }, [])
  useEffect(() => { fetchCitasDia() }, [selectedDate, filtroEspecialista])
  
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

  async function fetchCitasDia() {
    const d = new Date(selectedDate);
    const inicioDía = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString();
    const finDía = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
    let query = supabase.from('citas').select('*, pacientes(*)').gte('inicio', inicioDía).lte('inicio', finDía);
    if (filtroEspecialista !== 'Todos') query = query.eq('profesional_id', filtroEspecialista);
    const { data } = await query.order('inicio', { ascending: true });
    setCitasDia(data || []);
  }

  async function fetchBloqueosSemana() {
    const dias = getDiasLunesSabado();
    const inicioSemana = dias[0].toLocaleDateString('sv-SE');
    const finSemana = dias[5].toLocaleDateString('sv-SE');
    const { data } = await supabase.from('bloqueos_agenda').select('*').eq('profesional_id', filtro.profesional_id).gte('fecha', inicioSemana).lte('fecha', finSemana);
    setBloqueosSemana(data || []);
  }

  async function fetchCitasHuerfanas() {
    setCargandoHuerfanas(true);
    try {
      const hoy = new Date().toISOString().split('T')[0];

      let queryCitas = supabase
        .from('citas')
        .select('*, pacientes(*)')
        .gte('inicio', `${hoy}T00:00:00`)
        .not('estado', 'in', '("cancelada","atendido","no_asiste")')
        .order('inicio', { ascending: true });

      if (filtroEspecialista !== 'Todos') {
        queryCitas = queryCitas.eq('profesional_id', filtroEspecialista);
      }

      const { data: citasFuturas, error: errCitas } = await queryCitas;
      if (errCitas) console.error("❌ Error en BD al traer citas:", errCitas);

      if (!citasFuturas || citasFuturas.length === 0) {
        setCitasHuerfanas([]);
        setCargandoHuerfanas(false);
        return;
      }

      let queryBloqueos = supabase.from('bloqueos_agenda').select('*').gte('fecha', hoy);
      if (filtroEspecialista !== 'Todos') queryBloqueos = queryBloqueos.eq('profesional_id', filtroEspecialista);
      const { data: bloqueos, error: errBloq } = await queryBloqueos;
      
      if (errBloq) console.error("❌ Error en BD al traer bloqueos:", errBloq);

      const huerfanas = citasFuturas.filter(cita => {
        const [fechaStr, horaStr] = cita.inicio.replace('T', ' ').split(' ');
        const citaDate = fechaStr; 
        
        if (!cita.profesional_id) return true;

        const isBlocked = bloqueos?.some(b => b.profesional_id === cita.profesional_id && b.fecha === citaDate);
        if (isBlocked) return true;

        return false; 
      });

      setCitasHuerfanas(huerfanas);
    } catch (error) {
      console.error("Excepción en fetchCitasHuerfanas:", error);
      toast.error("Error al escanear la agenda global");
    } finally {
      setCargandoHuerfanas(false);
    }
  }

  const iniciarReprogramacion = (cita: any) => {
    resetEstados();
    setCitaEnReprogramacion(cita);
    setFiltro({ ...filtro, profesional_id: cita.profesional_id || '' });
    seleccionarPacienteExistente(cita.pacientes);
    setNuevoTratamientoNombre(cita.motivo || '');
    setModalAbierto(true);
    setPaso(1);
  };

  async function actualizarEstadoCita(citaId: string, nuevoEstado: string) {
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset() * 60000;
    const horaLocalISO = new Date(ahora.getTime() - offset).toISOString();
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
    toast.success("Estado actualizado"); await fetchCitasDia();
  }

  const contactarWhatsApp = (telefono: string, nombre: string) => {
    if (!telefono) return toast.error("Paciente sin teléfono");
    const num = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${num}`, '_blank');
  }

  async function fetchCitasOcupadas() {
    const dias = getDiasLunesSabado();
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
      
      if (palabraRut.length > 0) {
        query = query.or(`nombre.ilike.${fuzzy},apellido.ilike.${fuzzy},rut.ilike.%${palabraRut}%`);
      } else {
        query = query.or(`nombre.ilike.${fuzzy},apellido.ilike.${fuzzy}`);
      }
    });

    const { data } = await query.limit(5);
    setPacientesEncontrados(data || []);
  }

  const seleccionarPacienteExistente = async (paciente: any) => {
    if (!paciente) return;
    setPacienteSeleccionado(paciente);
    setBusqueda(`${paciente.nombre} ${paciente.apellido}`);
    setPacientesEncontrados([]);
    const { data } = await supabase.from('presupuestos').select('id, nombre_tratamiento').eq('paciente_id', paciente.id).neq('estado', 'finalizado').order('fecha_creacion', { ascending: false });
    setTratamientosPaciente(data || []);
    if (data?.length) { setTratamientoSeleccionadoId(data[0].id); setNuevoTratamientoNombre(data[0].nombre_tratamiento); }
    else { setTratamientoSeleccionadoId('MANUAL'); setNuevoTratamientoNombre(''); }
  };

  const handleGuardar = async () => {
    if (cargandoAccion) return;
    setCargandoAccion(true);
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
        const d = new Date(`${fechaStr}T${horaStr}:00`);
        const off = d.getTimezoneOffset() * 60000;
        const inicio = new Date(d.getTime() - off).toISOString();
        const fin = new Date(d.getTime() + (duracionMin * 60000) - off).toISOString();
        return { inicio, fin };
      }
      if (citaEnReprogramacion) {
        const s = horasSeleccionadas[0];
        const { inicio, fin } = parsearAFechaLocal(s.fecha, s.hora, s.duracion);
        await supabase.from('citas').update({ inicio, fin, profesional_id: filtro.profesional_id, estado: 'reprogramada', motivo: nuevoTratamientoNombre.toUpperCase() || citaEnReprogramacion.motivo }).eq('id', citaEnReprogramacion.id);
      } else {
        const nuevasCitas = horasSeleccionadas.map(s => {
          const { inicio, fin } = parsearAFechaLocal(s.fecha, s.hora, s.duracion);
          return { paciente_id: pId, profesional_id: filtro.profesional_id, presupuesto_id: (tratamientoSeleccionadoId && tratamientoSeleccionadoId !== 'MANUAL') ? tratamientoSeleccionadoId : null, inicio, fin, estado: 'programada', motivo: nuevoTratamientoNombre.toUpperCase() || 'CONSULTA' };
        });
        await supabase.from('citas').insert(nuevasCitas);
      }
      setCitaConfirmadaData({ paciente: pNombreFull.toUpperCase(), citas: horasSeleccionadas });
      setMostrarTicket(true); await fetchCitasDia();
    } catch (e: any) { console.error(e); toast.error("Error al guardar"); } 
    finally { setCargandoAccion(false); }
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
    const nueva = new Date(semanaInicio);
    nueva.setDate(nueva.getDate() + (sentido === 'adelante' ? 7 : -7));
    setSemanaInicio(nueva);
  }

  const getDiasLunesSabado = () => {
    const curr = new Date(semanaInicio); const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    return Array.from({ length: 6 }, (_, i) => new Date(curr.getFullYear(), curr.getMonth(), diff + i))
  }

  const slotsHorarios = useMemo(() => {
    const slots = []; let inicioC = new Date(); inicioC.setHours(8, 30, 0, 0)
    while (inicioC.getHours() < 20) { slots.push(inicioC.toLocaleTimeString('es-CL', { hour12: false, hour: '2-digit', minute: '2-digit' })); inicioC.setMinutes(inicioC.getMinutes() + 30) }
    return slots
  }, [])

  const resetEstados = () => { setPaso(1); setHorasSeleccionadas([]); setPacienteSeleccionado(null); setBusqueda(''); setModoNuevoPaciente(false); setNuevoTratamientoNombre(''); setCitasOcupadas([]); setCitaEnReprogramacion(null); setSemanaInicio(new Date()); setTratamientosPaciente([]); setTratamientoSeleccionadoId(null); setNuevoPaciente({ nombre: '', apellido: '', rut: '', telefono: '', fecha_nacimiento: '', sexo: '' }); setBloqueosSemana([]); }

  // ==========================================
  // LÓGICA DEL MÓDULO DE CAJA (RECAUDACIÓN)
  // ==========================================

  const abrirCaja = async (cita: any) => {
    if (!cita.pacientes || !cita.pacientes.id) {
        return toast.error("Cita no tiene paciente asignado");
    }
    
    setPacientePago(cita.pacientes);
    setMontoIngresado('');
    setMetodoPago('tarjeta');
    setCodigoTransaccion('');
    setModalPagoAbierto(true);
    setCargandoDeudas(true);

    try {
        const { data: presupuestosPaciente, error: errPres } = await supabase
            .from('presupuestos')
            .select('id')
            .eq('paciente_id', cita.pacientes.id)
            .eq('aprobado', true);

        if (errPres) throw errPres;

        const idsPresupuestos = presupuestosPaciente?.map(p => p.id) || [];

        let itemsData: any[] = [];
        
        if (idsPresupuestos.length > 0) {
            const { data, error } = await supabase
                .from('presupuesto_items')
                .select(`
                    id,
                    observacion,
                    precio_pactado,
                    abonado,
                    estado,
                    prestaciones:prestacion_id("Nombre Accion", "Nombre")
                `)
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
    if (!montoIngresado || Number(montoIngresado) <= 0) {
        return toast.error("Ingrese un monto válido a recaudar");
    }

    if ((metodoPago === 'tarjeta' || metodoPago === 'transferencia') && !codigoTransaccion.trim()) {
        return toast.error("Ingrese el código de transacción o comprobante");
    }

    setCargandoAccion(true);
    let montoRestante = Number(montoIngresado);
    
    try {
        // ACTUALIZADO: Haciendo match exacto con el esquema de la tabla public.pagos
        const { error: errPago } = await supabase.from('pagos').insert([{
            paciente_id: pacientePago.id,
            monto: Number(montoIngresado),
            metodo_pago: metodoPago, // Nombre de columna exacto
            numero_referencia: codigoTransaccion.trim() || null, // Nombre de columna exacto
            fecha_pago: new Date().toISOString() // Nombre de columna exacto
        }]);
        
        if (errPago) {
            console.warn("Error al registrar en tabla pagos. Revisa consola.", errPago);
            toast.error("El pago no pudo ser registrado en el historial, pero se intentará actualizar la deuda.");
        }

        for (const item of deudasPaciente) {
            if (montoRestante <= 0) break;

            const aAbonar = Math.min(item.deuda, montoRestante);
            
            await supabase
                .from('presupuesto_items')
                .update({ abonado: Number(item.abonado) + aAbonar })
                .eq('id', item.id);
                
            montoRestante -= aAbonar;
        }

        toast.success(`Pago de $${Number(montoIngresado).toLocaleString('es-CL')} procesado.`);
        setModalPagoAbierto(false);
        setMontoIngresado('');
        setCodigoTransaccion('');
        
    } catch (e) {
        toast.error("Ocurrió un error al procesar el pago");
    } finally {
        setCargandoAccion(false);
    }
  }

  const calcularDeudaTotalCaja = () => {
      return deudasPaciente.reduce((acc, curr) => acc + curr.deuda, 0);
  }

  if (cargandoPagina) return <div className="h-screen flex flex-col items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500 mb-4" size={40} /></div>

  return (
    <div className="flex h-screen bg-[#FDFDFD] overflow-hidden font-sans text-slate-800 text-left">
      
      <AnimatePresence>
        {notificacion && (
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed top-24 right-8 z-[9999] bg-slate-900/95 backdrop-blur-md text-white px-5 py-4 rounded-3xl shadow-2xl border border-blue-500/20 flex items-center gap-4 min-w-[240px] max-w-[300px]">
            <div className="bg-blue-600 p-2.5 rounded-xl"><UserCheck size={18} /></div>
            <div className="flex-1 text-left"><p className="text-[8px] font-black uppercase text-blue-400 mb-0.5 text-left">En Sala de Espera</p><h4 className="font-black uppercase text-[11px] leading-tight truncate text-left">{notificacion.nombre}</h4></div>
            <button onClick={() => setNotificacion(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col overflow-hidden text-left">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 py-6 flex items-center justify-between sticky top-0 z-30 shadow-sm text-left">
          <div className="flex items-center gap-10">
            <div className="space-y-1 text-left">
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">Agenda Clínica</h1>
              <select className="text-blue-500 text-xs font-bold uppercase bg-transparent outline-none cursor-pointer" value={filtroEspecialista} onChange={(e) => setFiltroEspecialista(e.target.value)}>
                <option value="Todos">Todos los especialistas</option>
                {profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4 border-l border-slate-100 pl-10 text-left">
                <div className="bg-red-50 px-4 py-2 rounded-2xl border border-red-100 text-center">
                    <p className="text-[8px] font-black text-red-400 uppercase tracking-widest text-left">Anuladas/Cambios</p>
                    <p className="text-lg font-black text-red-600 leading-none text-left">{statsDia.totalPerdidas}</p>
                </div>
                <div className="flex items-center bg-slate-50 rounded-2xl p-1.5 border border-slate-100/50">
                  <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()-1)))} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft size={18}/></button>
                  <span className="px-6 text-xs font-black capitalize min-w-[210px] text-center text-slate-900">{selectedDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()+1)))} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight size={18}/></button>
                </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { fetchCitasHuerfanas(); setModalHuerfanasAbierto(true); }} 
              className="bg-amber-100 text-amber-600 px-6 py-4 rounded-[1.5rem] font-bold text-xs uppercase shadow-sm hover:bg-amber-200 transition-all flex items-center gap-2 active:scale-95"
            >
              <AlertTriangle size={16} /> Ver Huérfanas
            </button>

            <button onClick={() => { resetEstados(); setModalAbierto(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-bold text-xs uppercase shadow-xl hover:bg-black transition-all flex items-center gap-2 active:scale-95">
              <Plus size={16} /> Agendar Cita
            </button>
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto space-y-4 bg-[#FAFBFC] text-left text-slate-900">
          {citasDia.length > 0 ? citasDia.map(c => {
            const hInicio = new Date(c.inicio).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
            const hFin = new Date(c.fin).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'America/Santiago'});
            const configEstado = ESTADOS_CITA[c.estado] || ESTADOS_CITA.programada;
            const hLlegadaStr = c.hora_llegada ? new Date(c.hora_llegada).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }) : null;
            const hEnBoxStr = c.hora_inicio_atencion ? new Date(c.hora_inicio_atencion).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }) : null;

            return (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} key={c.id} className="group bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between transition-all hover:shadow-lg relative overflow-hidden text-left text-slate-900">
                <div className="flex items-center gap-8">
                  <div className={`w-24 h-24 rounded-[2rem] flex flex-col items-center justify-center font-black transition-colors ${c.llegada_confirmada ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-900 text-white'}`}>
                    <span className="text-[10px] tracking-tighter opacity-80">{hInicio}</span>
                    <ArrowDown size={14} className={`my-0.5 ${c.llegada_confirmada ? 'text-white/40' : 'text-blue-400'}`} strokeWidth={3} />
                    <span className="text-[10px] tracking-tighter">{hFin}</span>
                  </div>
                  <div className="text-left text-slate-900">
                    <h3 className="font-black uppercase text-lg tracking-tight mb-1 text-left">{c.pacientes?.nombre} {c.pacientes?.apellido}</h3>
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${configEstado.color}`}>
                        {configEstado.icon}
                        <span className="text-[9px] font-black uppercase">{configEstado.label}</span>
                      </div>
                      
                      {c.estado === 'en_espera' && hLlegadaStr && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-100 bg-amber-50 text-amber-600 animate-in fade-in slide-in-from-left-2">
                           <Timer size={10} />
                           <span className="text-[9px] font-black uppercase tracking-tight">Llegó a las {hLlegadaStr}</span>
                        </div>
                      )}

                      {c.estado === 'atendiendose' && hEnBoxStr && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-600 animate-in fade-in slide-in-from-left-2">
                           <Activity size={10} />
                           <span className="text-[9px] font-black uppercase tracking-tight">En Box desde {hEnBoxStr}</span>
                        </div>
                      )}

                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">RUT: {c.pacientes?.rut}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  
                  <button onClick={() => abrirCaja(c)} className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-all shadow-sm" title="Ir a Caja / Recibir Pago">
                    <Coins size={18}/>
                  </button>

                  <div className="relative">
                      <select value={c.estado || 'programada'} onChange={(e) => actualizarEstadoCita(c.id, e.target.value)} className="appearance-none bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-[10px] font-black uppercase outline-none cursor-pointer hover:bg-slate-100 pr-10 text-slate-900">
                        {Object.entries(ESTADOS_CITA).map(([key, val]) => ( <option key={key} value={key}>{val.label.toUpperCase()}</option> ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14}/>
                  </div>
                  <button onClick={() => contactarWhatsApp(c.pacientes?.telefono, c.pacientes?.nombre)} className="p-4 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-900 hover:text-white transition-all"><MessageCircle size={18}/></button>
                  <button onClick={() => iniciarReprogramacion(c)} className="p-4 bg-slate-50 text-purple-600 rounded-2xl hover:bg-purple-500 hover:text-white transition-all"><RefreshCcw size={18}/></button>
                  <Link href={`/pacientes/${c.paciente_id}`} className="p-4 bg-slate-50 text-blue-500 hover:bg-blue-600 hover:text-white rounded-2xl transition-all border border-transparent"><ClipboardList size={18}/></Link>
                  <button onClick={async () => { if(confirm("¿Anular?")) { actualizarEstadoCita(c.id, 'cancelada'); } }} className="p-4 bg-slate-50 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all"><Ban size={20}/></button>
                </div>
              </motion.div>
            )
          }) : ( <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 text-center text-slate-900"><CalendarIcon size={80} /><p className="mt-4 font-bold uppercase text-xs tracking-widest text-left">Sin citas programadas</p></div> )}
        </div>
      </main>

      {/* MODAL DE CAJA (RECAUDACIÓN DE PAGOS) */}
      <AnimatePresence>
        {modalPagoAbierto && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
                <div className="p-8 bg-emerald-500 text-white flex justify-between items-center shrink-0">
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
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">Detalle de Tratamientos Aprobados a pagar</h4>
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

                           {/* FORMULARIO DE PAGO */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Método de Pago</label>
                                 <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs uppercase outline-none focus:border-emerald-500" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                                     <option value="tarjeta">Tarjeta (Débito/Crédito)</option>
                                     <option value="efectivo">Efectivo</option>
                                     <option value="transferencia">Transferencia</option>
                                 </select>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Monto a Recaudar ($)</label>
                                 <input type="number" placeholder="Ej: 50000" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-lg text-emerald-600 outline-none focus:border-emerald-500 placeholder:text-slate-300" value={montoIngresado} onChange={(e) => setMontoIngresado(Number(e.target.value))} />
                              </div>
                              
                              {/* CÓDIGO TRANSACCIÓN (Oculto si es efectivo) */}
                              {(metodoPago === 'tarjeta' || metodoPago === 'transferencia') && (
                                <div className="space-y-2 md:col-span-2">
                                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Código Transacción / Comprobante</label>
                                   <input type="text" placeholder="Ej: TX-123456789" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-emerald-500 placeholder:text-slate-300 uppercase" value={codigoTransaccion} onChange={(e) => setCodigoTransaccion(e.target.value)} />
                                </div>
                              )}
                           </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 bg-white shrink-0">
                   <button 
                      onClick={procesarPagoCaja}
                      disabled={cargandoAccion || deudasPaciente.length === 0 || !montoIngresado}
                      className="w-full py-5 bg-emerald-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                   >
                      {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : <Coins size={18}/>}
                      Registrar Pago
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CITAS HUÉRFANAS */}
      <AnimatePresence>
        {modalHuerfanasAbierto && (
          <div className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pb-4 pt-24 md:px-8 md:pb-8 md:pt-36 bg-slate-900/60 backdrop-blur-md text-slate-900 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-4xl max-h-[75vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden relative text-slate-900 text-left">
              <div className="p-8 border-b border-slate-50 bg-amber-500 flex justify-between items-center shrink-0 text-left">
                <div className="flex items-center gap-6 text-left">
                  <div className="p-4 rounded-3xl bg-amber-600 text-white shadow-xl"><AlertTriangle size={28} /></div>
                  <div>
                    <h2 className="font-black uppercase text-xl tracking-tight text-white leading-none text-left">Citas Huérfanas</h2>
                    <p className="text-amber-100 text-[10px] font-black uppercase tracking-widest mt-1">Requieren Reagendamiento</p>
                  </div>
                </div>
                <button onClick={() => setModalHuerfanasAbierto(false)} className="p-4 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-all text-left"><X size={24} /></button>
              </div>
              
              <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
                {cargandoHuerfanas ? (
                  <div className="h-full py-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Loader2 className="animate-spin" size={40} />
                    <p className="text-xs font-black uppercase tracking-widest">Analizando agenda global...</p>
                  </div>
                ) : citasHuerfanas.length === 0 ? (
                  <div className="h-full py-12 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-60">
                    <CheckCircle2 size={60} className="text-emerald-500" />
                    <p className="text-sm font-black uppercase tracking-widest text-slate-600">No hay citas huérfanas</p>
                    <p className="text-[10px] font-bold text-center max-w-sm">No existen conflictos con los bloqueos agendados.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-500 mb-6">Se encontraron <span className="font-black text-amber-600">{citasHuerfanas.length} citas</span> afectadas por inasistencias o bloqueos.</p>
                    {citasHuerfanas.map(cita => {
                      const fechaFormat = new Date(cita.inicio).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
                      const horaFormat = new Date(cita.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' });
                      const telefonoLimpio = cita.pacientes?.telefono ? cita.pacientes.telefono.replace(/\D/g, '') : '';
                      
                      return (
                        <div key={cita.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex flex-col items-center justify-center border border-amber-100 shrink-0">
                              <Clock size={14} className="mb-1 opacity-50" />
                              <span className="text-[10px] font-black">{horaFormat}</span>
                            </div>
                            <div>
                              <h4 className="font-black text-sm text-slate-800 uppercase leading-none">{cita.pacientes?.nombre} {cita.pacientes?.apellido}</h4>
                              <div className="flex flex-col gap-1.5 my-2.5">
                                {cita.pacientes?.telefono ? (
                                  <div className="flex items-center gap-2 text-blue-600 bg-blue-50/50 w-fit px-2.5 py-1.5 rounded-lg border border-blue-100">
                                    <Phone size={14} className="animate-pulse" />
                                    <span className="font-black text-sm tracking-widest">{cita.pacientes.telefono}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-red-400 bg-red-50/50 w-fit px-2.5 py-1.5 rounded-lg border border-red-100">
                                    <Phone size={14} />
                                    <span className="font-bold text-[10px] uppercase tracking-widest">Sin teléfono</span>
                                  </div>
                                )}
                                {cita.pacientes?.email && (
                                  <div className="flex items-center gap-2 text-slate-500 px-2.5">
                                    <Mail size={12} />
                                    <span className="font-bold text-[11px] tracking-wide">{cita.pacientes.email}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 mt-1">
                                <span className="text-[9px] font-bold text-slate-400 tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                  <CalendarDays size={10} className="inline mr-1"/> {fechaFormat}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-100">RUT: {cita.pacientes?.rut || 'S/N'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 self-start md:self-auto">
                            {telefonoLimpio && (
                              <a href={`https://wa.me/${telefonoLimpio}`} target="_blank" rel="noreferrer" className="p-3 bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all" title="WhatsApp">
                                <MessageCircle size={16} />
                              </a>
                            )}
                            <button onClick={() => { 
                              setModalHuerfanasAbierto(false); 
                              iniciarReprogramacion(cita); 
                            }} className="px-4 py-2 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white rounded-xl transition-all flex items-center gap-2">
                              <CalendarClock size={14} /> Reagendar
                            </button>
                            <button onClick={async () => {
                              if(confirm("¿Anular esta cita huérfana?")) {
                                await actualizarEstadoCita(cita.id, 'cancelada');
                                setCitasHuerfanas(prev => prev.filter(c => c.id !== cita.id));
                              }
                            }} className="p-3 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all" title="Cancelar Cita">
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
          <div className="fixed inset-0 z-[1000] flex items-start justify-center px-4 pb-4 pt-24 md:px-8 md:pb-8 md:pt-36 bg-slate-900/60 backdrop-blur-md text-slate-900 text-left">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-7xl h-full max-h-[85vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden relative text-slate-900 text-left">
              <div className="p-8 border-b border-slate-50 bg-white flex justify-between items-center shrink-0 text-left">
                <div className="flex items-center gap-6 text-left"><div className={`p-4 rounded-3xl ${citaEnReprogramacion ? 'bg-purple-500' : 'bg-blue-500'} text-white shadow-xl`}><CalendarDays size={28} /></div><h2 className="font-black uppercase text-lg tracking-tight text-slate-900 leading-none text-left">{citaEnReprogramacion ? 'Reagendar Cita' : 'Nueva Reserva'} • Paso {paso}</h2></div>
                <button onClick={() => { setModalAbierto(false); setCitaEnReprogramacion(null); }} className="p-4 bg-slate-50 text-slate-400 hover:bg-red-50 rounded-full transition-all text-left"><X size={24} /></button>
              </div>
              <div className="flex flex-1 overflow-hidden">
                {paso === 1 ? (
                  <>
                    <aside className="w-[320px] border-r border-slate-50 p-10 bg-[#FAFBFC]/50 space-y-8 overflow-y-auto hidden md:block text-left text-slate-900">
                      <div className={`${citaEnReprogramacion ? 'bg-purple-900' : 'bg-slate-900'} p-8 rounded-[2.5rem] text-white shadow-2xl text-left`}><p className="text-[10px] font-bold uppercase mb-2 opacity-50 tracking-widest text-left">Seleccionado</p><p className="text-5xl font-black leading-none text-left">{horasSeleccionadas.length}</p></div>
                      <div className="space-y-6 text-left">
                        <div className="space-y-3 text-left">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 text-left">Especialista</label>
                          <select className="w-full p-5 bg-white border border-slate-100 rounded-3xl font-bold text-xs shadow-sm outline-none text-slate-900 cursor-pointer" value={filtro.profesional_id || ""} onChange={(e) => { setFiltro({...filtro, profesional_id: e.target.value}); setHorasSeleccionadas([]); }}><option value="">Seleccionar...</option>{profesionales.map(p => <option key={p.id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}</select>
                        </div>
                        <div className="space-y-3 text-left"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 text-left">Duración base</label><div className="grid grid-cols-2 gap-2 text-left">{duracionesDisponibles.slice(0,4).map(m => ( <button key={m} onClick={() => setFiltro({...filtro, duracionDefault: m})} className={`py-4 rounded-2xl text-[10px] font-black border transition-all ${filtro.duracionDefault === m ? 'bg-white text-blue-600 border-blue-500 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>{m}m</button> ))}</div></div>
                      </div>
                    </aside>
                    <main className="flex-1 p-6 bg-white overflow-hidden flex flex-col text-slate-900 text-left">
                      <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-3xl border border-slate-100 text-left">
                        <button onClick={() => navegarSemana('atras')} className="flex items-center gap-2 px-4 py-2 hover:bg-white rounded-xl font-black text-[10px] uppercase text-slate-400 transition-all text-left"><ChevronLeft size={16}/> Anterior</button>
                        <span className="font-black text-xs uppercase tracking-widest text-slate-600 italic text-slate-900 text-center">Cartola de Disponibilidad</span>
                        <button onClick={() => navegarSemana('adelante')} className="flex items-center gap-2 px-4 py-2 hover:bg-white rounded-xl font-black text-[10px] uppercase text-blue-600 transition-all text-left">Siguiente <ChevronRight size={16}/></button>
                      </div>
                      <div className="flex-1 grid grid-cols-6 gap-3 md:gap-5 overflow-y-auto pr-2 custom-scrollbar text-left text-slate-900">
                        {getDiasLunesSabado().map(dia => { 
                          const fStr = dia.toLocaleDateString('sv-SE'); 
                          const diaBloqueado = bloqueosSemana.some(b => b.fecha === fStr); 

                          return ( 
                            <div key={fStr} className="space-y-2 text-center text-slate-900 relative">
                              <p className="text-[10px] font-black uppercase text-slate-400">{dia.toLocaleDateString('es-CL', {weekday: 'short', day: 'numeric'})}</p>
                              {diaBloqueado && (
                                <div className="absolute top-10 inset-x-0 z-10 flex flex-col items-center justify-start pt-10 h-full bg-white/60 backdrop-blur-[1px] rounded-2xl">
                                  <Ban className="text-red-500 mb-2" size={24} />
                                  <p className="text-[8px] font-black text-red-600 uppercase tracking-tighter">Jornada<br/>Cancelada</p>
                                </div>
                              )}
                              <div className="space-y-1.5 text-left text-slate-900">
                                {slotsHorarios.map(h => { 
                                  const laboral = esHorarioLaboral(fStr, h); 
                                  const ocupado = esCitaOcupada(fStr, h); 
                                  const sel = horasSeleccionadas.some(x => x.fecha === fStr && x.hora === h); 
                                  
                                  let btnClass = "w-full py-3.5 text-[10px] font-black rounded-2xl border transition-all "; 
                                  if (sel) btnClass += "bg-blue-600 text-white border-blue-600 shadow-xl scale-95"; 
                                  else if (ocupado || diaBloqueado) btnClass += "bg-red-50 text-red-200 border-red-50 cursor-not-allowed opacity-40"; 
                                  else if (laboral) btnClass += "bg-white border-slate-100 text-slate-600 hover:border-blue-300 hover:bg-blue-50"; 
                                  else btnClass += "bg-slate-50/50 text-slate-200 border-transparent cursor-not-allowed opacity-20"; 
                                  
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
                    <div className="w-full md:w-1/2 border-r border-slate-50 p-12 bg-[#FAFBFC]/50 overflow-y-auto space-y-6 text-left text-slate-900">
                        <h3 className="text-sm font-black uppercase text-blue-600 flex items-center gap-2 text-left"><Timer size={18}/> Ajustar Tiempos</h3>
                        {horasSeleccionadas.map((s, idx) => ( <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm text-left text-slate-900"><div className="text-left text-slate-900"><p className="text-[10px] font-black text-slate-400 uppercase text-left">{s.fecha}</p><p className="text-lg font-black text-slate-700 text-left">{s.hora} hrs</p></div><select className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black outline-none text-slate-900" value={s.duracion} onChange={(e) => { const c = [...horasSeleccionadas]; c[idx].duracion = Number(e.target.value); setHorasSeleccionadas(c); }}>{duracionesDisponibles.map(d => <option key={d} value={d} className="text-slate-900">{d} min</option>)}</select></div> ))}
                    </div>
                    <div className="w-full md:w-1/2 p-12 overflow-y-auto space-y-10 text-left text-slate-900">
                        <div className="space-y-4 text-left text-slate-900">
                            <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight text-left">Paciente</h3>
                            {citaEnReprogramacion ? ( <div className="p-8 rounded-[2.5rem] bg-purple-50 border-2 border-purple-200 flex items-center justify-between text-left"><div className="text-left text-slate-900"><p className="text-lg font-black uppercase text-purple-900 leading-none text-left">{citaEnReprogramacion.pacientes?.nombre} {citaEnReprogramacion.pacientes?.apellido}</p><p className="text-[10px] font-bold text-purple-400 mt-2 tracking-widest text-left">RUT: {citaEnReprogramacion.pacientes?.rut}</p></div><RefreshCcw className="text-purple-500" /></div> ) : ( <div className="space-y-4 text-left text-slate-900">{modoNuevoPaciente ? ( <div className="grid grid-cols-1 gap-4 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner text-left"><input placeholder="Nombre" className="p-5 bg-white rounded-2xl font-bold text-xs uppercase outline-none shadow-sm text-slate-900" value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente(prev => ({...prev, nombre: e.target.value}))}/><input placeholder="Apellido" className="p-5 bg-white rounded-2xl font-bold text-xs uppercase outline-none shadow-sm text-slate-900" value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente(prev => ({...prev, apellido: e.target.value}))}/><input placeholder="RUT" className="p-5 bg-white rounded-2xl font-bold text-xs uppercase outline-none shadow-sm text-slate-900" value={nuevoPaciente.rut} onChange={e => setNuevoPaciente(prev => ({...prev, rut: e.target.value}))}/><input placeholder="Teléfono" className="p-5 bg-white rounded-2xl font-bold text-xs uppercase outline-none shadow-sm text-slate-900" value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente(prev => ({...prev, telefono: e.target.value}))}/></div> ) : ( <div className="text-left space-y-4 text-slate-900"><div className="relative group text-left"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20}/><input placeholder="Buscar por Nombre o RUT..." className="w-full p-5 pl-14 bg-slate-50 border border-slate-100 rounded-[1.8rem] font-bold text-xs outline-none shadow-inner text-slate-900" value={busqueda} onChange={e => {setBusqueda(e.target.value); buscarPacientes(e.target.value);}} /></div>{pacientesEncontrados.map(p => ( <button key={p.id} onClick={() => seleccionarPacienteExistente(p)} className="w-full p-6 rounded-[2rem] bg-slate-50 hover:border-blue-500 border-2 border-transparent transition-all flex items-center justify-between text-left"><div className="text-left text-slate-900"><p className="font-black text-sm uppercase text-left">{p.nombre} {p.apellido}</p><p className="text-[10px] font-bold text-slate-400 text-left">{p.rut}</p></div></button> ))}{pacienteSeleccionado && pacientesEncontrados.length === 0 && ( <div className="p-6 rounded-[2rem] border-2 border-blue-500 bg-blue-50/50 flex items-center justify-between text-left text-slate-900"><p className="font-black text-sm uppercase text-slate-900 text-left">{pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}</p><CheckCircle2 className="text-blue-500" /></div> )}</div> )}</div> )}
                        </div>
                        {(pacienteSeleccionado || modoNuevoPaciente) && ( <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-8 bg-slate-900 rounded-[2.8rem] text-white shadow-2xl text-left"><h4 className="text-[10px] font-black uppercase text-blue-400 mb-5 flex items-center gap-2 tracking-widest text-left"><Briefcase size={14}/> Tratamiento</h4>{!modoNuevoPaciente && tratamientosPaciente.length > 0 ? ( <div className="space-y-4 text-left"><label className="text-[9px] font-black text-white/40 uppercase ml-2 text-left">Plan activo</label><select className="w-full p-5 bg-white/10 rounded-2xl font-black text-xs outline-none border border-white/10 text-white appearance-none cursor-pointer" value={tratamientoSeleccionadoId || ''} onChange={(e) => { const val = e.target.value; setTratamientoSeleccionadoId(val); if (val !== 'MANUAL') { const t = tratamientosPaciente.find(x => x.id === val); setNuevoTratamientoNombre(t?.nombre_tratamiento || ''); } else setNuevoTratamientoNombre(''); }}>{tratamientosPaciente.map(t => <option key={t.id} value={t.id} className="text-slate-900">{t.nombre_tratamiento.toUpperCase()}</option>)}<option value="MANUAL" className="text-slate-900 italic">+ OTRO MOTIVO</option></select>{(tratamientoSeleccionadoId === 'MANUAL' || !tratamientoSeleccionadoId) && ( <input placeholder="Especifique motivo..." className="w-full p-5 bg-white/10 rounded-2xl font-black text-xs outline-none border border-white/10 text-white uppercase mt-2 shadow-inner" value={nuevoTratamientoNombre} onChange={(e) => setNuevoTratamientoNombre(e.target.value)} /> )}</div> ) : ( <input placeholder="Ej: Evaluación General, Urgencia..." className="w-full p-5 bg-white/10 rounded-2xl font-black text-xs outline-none border border-white/10 text-white uppercase shadow-inner" value={nuevoTratamientoNombre} onChange={(e) => setNuevoTratamientoNombre(e.target.value)} /> )}</motion.div> )}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-slate-50 bg-white flex justify-between items-center shrink-0 px-14 text-slate-900 text-left"><div className="flex items-center gap-4 text-left text-slate-900"><div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black border border-slate-100">{horasSeleccionadas.length}</div><p className="text-sm font-black text-slate-900 leading-none text-left">Turnos elegidos</p></div><div className="flex gap-4 items-center text-left text-slate-900"><button onClick={() => { setModoNuevoPaciente(!modoNuevoPaciente); setPacienteSeleccionado(null); setBusqueda(''); }} className="text-[10px] font-black text-blue-600 uppercase underline mr-4 text-left">{paso === 2 && !citaEnReprogramacion && (modoNuevoPaciente ? 'Buscar Existente' : '+ Registrar Nuevo')}</button>{paso === 2 && <button onClick={() => setPaso(1)} className="px-8 py-4 font-black text-[11px] uppercase text-slate-400 tracking-widest hover:text-slate-900 transition-colors text-left">Atrás</button>}<button disabled={cargandoAccion || horasSeleccionadas.length === 0 || (paso === 2 && !modoNuevoPaciente && !pacienteSeleccionado)} onClick={() => { if(paso === 1) { setPaso(2); } else { handleGuardar(); } }} className={`px-16 py-5 rounded-[1.8rem] font-black text-white text-xs uppercase shadow-xl transition-all active:scale-95 ${citaEnReprogramacion ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}>{cargandoAccion ? <Loader2 className="animate-spin" /> : (paso === 1 ? 'Siguiente' : citaEnReprogramacion ? 'Confirmar Cambio' : 'Agendar Cita')}</button></div></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mostrarTicket && (
            <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 text-slate-900 text-left">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative w-full max-w-sm text-left text-slate-900">
                <div className="bg-white rounded-[3rem] shadow-2xl p-10 text-center space-y-6 text-slate-900">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={60} />
                    <h2 className="text-2xl font-black uppercase italic text-slate-900">¡Cita Lista!</h2>
                    <div className="text-left bg-slate-50 p-6 rounded-[2.5rem] space-y-4 text-slate-900">
                        <div className="text-left text-slate-900"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Paciente</p><p className="font-black text-slate-800 uppercase leading-none text-left">{citaConfirmadaData?.paciente}</p></div>
                        <div className="text-left text-slate-900"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Fecha y Hora</p><p className="font-black text-slate-800 uppercase leading-none text-left">{citaConfirmadaData?.citas[0]?.fecha} • {citaConfirmadaData?.citas[0]?.hora} hrs</p></div>
                    </div>
                    <button onClick={() => { setMostrarTicket(false); setModalAbierto(false); resetEstados(); }} className="w-full py-6 bg-slate-900 rounded-[2rem] font-black text-[10px] uppercase tracking-widest text-white shadow-xl">Finalizar</button>
                </div>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  )
}