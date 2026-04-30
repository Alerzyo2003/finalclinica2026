'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Save, Loader2, Clock, Calendar, Trash2,
  LayoutGrid, Sparkles, CalendarDays, AlertCircle, XCircle,
  MessageCircle, Phone, X, CalendarClock, Ban, CheckCircle2, UserCircle,
  ChevronLeft, ChevronRight, Users
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'


const DIAS = [
  { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' }, { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' }, { id: 0, label: 'Domingo' }
];


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


export default function BoxConfigPage() {
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [profesionalId, setProfesionalId] = useState('')
  const [disponibilidad, setDisponibilidad] = useState<any[]>([])
  const [bloqueosActivos, setBloqueosActivos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [modo, setModo] = useState<'semanal' | 'extraordinario'>('semanal')


  const [fechaInasistencia, setFechaInasistencia] = useState('')
  const [motivoInasistencia, setMotivoInasistencia] = useState('')


  // ESTADOS DEL MODAL Y GESTIÓN EN LÍNEA
  const [citasConflictivas, setCitasConflictivas] = useState<any[]>([])
  const [mostrarModalConflictos, setMostrarModalConflictos] = useState(false)
  const [modoModal, setModoModal] = useState<'bloquear' | 'revisar'>('bloquear')
  const [citaEnEdicion, setCitaEnEdicion] = useState<string | null>(null)
 
  // Datos para reagendar
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [nuevoBox, setNuevoBox] = useState(1)
  const [nuevoEspecialista, setNuevoEspecialista] = useState('')
 
  // Estado para guardar cuánto duraba la cita original en minutos
  const [duracionCitaEdicion, setDuracionCitaEdicion] = useState(45)


  // MOTOR DE DISPONIBILIDAD SEMANAL
  const [semanaInicio, setSemanaInicio] = useState<Date>(getLunes(new Date()))
  const [dispoSemana, setDispoSemana] = useState<any[]>([])
  const [cargandoSlots, setCargandoSlots] = useState(false)


  const [nuevoBloque, setNuevoBloque] = useState({
    dia_semana: 1,
    hora_inicio: '09:00',
    hora_fin: '13:00',
    box_id: 1,
    fecha_especifica: ''
  })


  useEffect(() => { fetchInicial() }, [])
 
  useEffect(() => {
    if (profesionalId) {
        fetchDisponibilidad();
        fetchBloqueos();
    }
  }, [profesionalId])


  // CALCULAR SEMANA CUANDO CAMBIA DOCTOR, SEMANA O LA DURACIÓN DE LA CITA
  useEffect(() => {
    if (nuevoEspecialista && citaEnEdicion) {
      calcularDisponibilidadSemanal()
    }
  }, [semanaInicio, nuevoEspecialista, citaEnEdicion, duracionCitaEdicion])


  async function calcularDisponibilidadSemanal() {
    setCargandoSlots(true);
    try {
      const dias = Array.from({length: 7}).map((_, i) => {
        const d = new Date(semanaInicio);
        d.setDate(d.getDate() + i);
        return d;
      });


      const inicioSemanaStr = dias[0].toISOString().split('T')[0];
      const finSemanaStr = dias[6].toISOString().split('T')[0];


      const { data: bloqueos } = await supabase.from('bloqueos_agenda')
        .select('fecha').eq('profesional_id', nuevoEspecialista)
        .gte('fecha', inicioSemanaStr).lte('fecha', finSemanaStr);


      const { data: dispo } = await supabase.from('disponibilidad_profesional')
        .select('*').eq('profesional_id', nuevoEspecialista);


      const { data: citas } = await supabase.from('citas')
        .select('inicio, fin').eq('profesional_id', nuevoEspecialista)
        .gte('inicio', `${inicioSemanaStr}T00:00:00`)
        .lte('inicio', `${finSemanaStr}T23:59:59`)
        .neq('estado', 'cancelada');


      const semanaProcesada = dias.map(dateObj => {
        const dateStr = dateObj.toISOString().split('T')[0];
        const diaSemanaNum = dateObj.getDay();


        if (bloqueos?.some(b => b.fecha === dateStr)) {
          return { date: dateStr, dateObj, status: 'bloqueado', slots: [] };
        }


        const dispoDia = dispo?.filter(d => (d.dia_semana === diaSemanaNum && !d.fecha_especifica) || d.fecha_especifica === dateStr) || [];
        if (dispoDia.length === 0) {
          return { date: dateStr, dateObj, status: 'sin_horario', slots: [] };
        }


        const citasDia = citas?.filter(c => c.inicio.startsWith(dateStr)).map(c => ({
          inicio: getMinsFromDateStr(c.inicio),
          fin: getMinsFromDateStr(c.fin)
        })) || [];


        let slotsLibres: string[] = [];
        dispoDia.forEach(bloque => {
          let currTime = tToMins(bloque.hora_inicio);
          const endTime = tToMins(bloque.hora_fin);


          while (currTime + duracionCitaEdicion <= endTime) {
            const slotEnd = currTime + duracionCitaEdicion;
            const choca = citasDia.some(cita => currTime < cita.fin && slotEnd > cita.inicio);
            if (!choca) slotsLibres.push(minsToT(currTime));
            currTime += 15;
          }
        });


        slotsLibres = [...new Set(slotsLibres)].sort();


        return {
          date: dateStr,
          dateObj,
          status: slotsLibres.length > 0 ? 'limpio' : 'lleno',
          slots: slotsLibres
        };
      });


      setDispoSemana(semanaProcesada);
    } catch (error) {
      toast.error("Error al calcular la agenda semanal");
    } finally {
      setCargandoSlots(false);
    }
  }


  const prevWeek = () => {
    const newDate = new Date(semanaInicio);
    newDate.setDate(newDate.getDate() - 7);
    setSemanaInicio(newDate);
  }


  const nextWeek = () => {
    const newDate = new Date(semanaInicio);
    newDate.setDate(newDate.getDate() + 7);
    setSemanaInicio(newDate);
  }


  async function fetchInicial() {
    const { data } = await supabase.from('profesionales').select('*').eq('activo', true).order('nombre')
    if (data?.length) {
      setProfesionales(data)
      setProfesionalId(data[0].user_id)
    }
    setCargando(false)
  }


  async function fetchDisponibilidad() {
    const { data } = await supabase
      .from('disponibilidad_profesional')
      .select('*')
      .eq('profesional_id', profesionalId)
      .order('dia_semana', { ascending: true })
    setDisponibilidad(data || [])
  }


  async function fetchBloqueos() {
    const { data } = await supabase
      .from('bloqueos_agenda')
      .select('*')
      .eq('profesional_id', profesionalId)
      .gte('fecha', new Date().toISOString().split('T')[0])
      .order('fecha', { ascending: true })
    setBloqueosActivos(data || [])
  }


  const agregarBloque = async () => {
    if (nuevoBloque.hora_inicio >= nuevoBloque.hora_fin) return toast.error("Horario inválido");
    setGuardando(true)
    try {
      const [year, month, day] = (modo === 'extraordinario' ? nuevoBloque.fecha_especifica : "2024-01-01").split('-').map(Number);
      const diaCalculado = modo === 'extraordinario' ? new Date(year, month - 1, day).getDay() : nuevoBloque.dia_semana;


      const { error } = await supabase.from('disponibilidad_profesional').insert([{
        profesional_id: profesionalId,
        dia_semana: diaCalculado,
        hora_inicio: nuevoBloque.hora_inicio,
        hora_fin: nuevoBloque.hora_fin,
        box_id: nuevoBloque.box_id,
        fecha_especifica: modo === 'extraordinario' ? nuevoBloque.fecha_especifica : null
      }])
      if (error) throw error;
      toast.success("Disponibilidad actualizada");
      fetchDisponibilidad();
    } catch (e) { toast.error("Error al guardar"); }
    finally { setGuardando(false) }
  }


  const validarInasistencia = async () => {
    if (!fechaInasistencia) return toast.error("Seleccione una fecha");


    setGuardando(true);
    try {
      const inicioDia = `${fechaInasistencia}T00:00:00`;
      const finDia = `${fechaInasistencia}T23:59:59`;


      const { data: citas, error: errCitas } = await supabase
        .from('citas')
        .select(`id, inicio, fin, pacientes (nombre, apellido, telefono, rut)`)
        .eq('profesional_id', profesionalId)
        .gte('inicio', inicioDia)
        .lte('inicio', finDia)
        .neq('estado', 'cancelada')
        .order('inicio', { ascending: true });


      if (errCitas) throw errCitas;


      if (citas && citas.length > 0) {
        setCitasConflictivas(citas);
        setSemanaInicio(getLunes(new Date(`${fechaInasistencia}T12:00:00`)));
        setModoModal('bloquear');
        setMostrarModalConflictos(true);
        setGuardando(false);
        return;
      }


      await ejecutarBloqueoFinal();


    } catch (error: any) {
      toast.error("Error al validar la fecha");
      setGuardando(false);
    }
  };


  const ejecutarBloqueoFinal = async () => {
    setGuardando(true);
    try {
      const { error: errBloqueo } = await supabase
        .from('bloqueos_agenda')
        .insert([{
          profesional_id: profesionalId,
          fecha: fechaInasistencia,
          motivo: motivoInasistencia || "Inasistencia programada"
        }]);


      if (errBloqueo) throw errBloqueo;


      toast.success("Jornada bloqueada con éxito");
      setFechaInasistencia('');
      setMotivoInasistencia('');
      setMostrarModalConflictos(false);
      fetchBloqueos();
    } catch (error) {
      toast.error("Error al registrar el bloqueo");
    } finally {
      setGuardando(false);
    }
  }


  // --- NUEVA ELIMINACIÓN INTELIGENTE DE HORARIOS ---
  const eliminarBloque = async (bloque: any) => {
    if(!confirm("¿Estás seguro de eliminar este horario base?")) return;


    setGuardando(true);
    try {
      // 1. Borramos la disponibilidad. Las citas en base de datos NO se borran solas.
      await supabase.from('disponibilidad_profesional').delete().eq('id', bloque.id);
      fetchDisponibilidad();


      // 2. Buscamos si quedaron citas a futuro en ese día específico para advertirle a la recepcionista
      const hoy = new Date().toISOString().split('T')[0];
      const { data: citasFuturas } = await supabase
        .from('citas')
        .select('inicio')
        .eq('profesional_id', profesionalId)
        .gte('inicio', `${hoy}T00:00:00`)
        .neq('estado', 'cancelada');


      let cantidadAfectadas = 0;
      if (citasFuturas && !bloque.fecha_especifica) {
        cantidadAfectadas = citasFuturas.filter(c => {
          const diaSemanaCita = new Date(c.inicio).getDay();
          return diaSemanaCita === (bloque.dia_semana === 7 ? 0 : bloque.dia_semana);
        }).length;
      }


      if (cantidadAfectadas > 0) {
        toast.warning(
          `Horario eliminado. PERO tienes ${cantidadAfectadas} pacientes a futuro en este día. Sus horas NO se han borrado de la agenda, pero deberías reagendarlos.`,
          { duration: 8000, icon: <AlertCircle className="text-amber-500"/> }
        );
      } else {
        toast.success("Horario eliminado correctamente. Agenda limpia.");
      }
    } catch (error) {
      toast.error("Error al eliminar el bloque");
    } finally {
      setGuardando(false);
    }
  }


  const revisarPacientesPendientes = async (fechaBloqueada: string) => {
    const loadingToast = toast.loading("Buscando pacientes...");
    try {
      const inicioDia = `${fechaBloqueada}T00:00:00`;
      const finDia = `${fechaBloqueada}T23:59:59`;


      const { data: citas, error: errCitas } = await supabase
        .from('citas')
        .select(`id, inicio, fin, pacientes (nombre, apellido, telefono, rut)`)
        .eq('profesional_id', profesionalId)
        .gte('inicio', inicioDia)
        .lte('inicio', finDia)
        .neq('estado', 'cancelada')
        .order('inicio', { ascending: true });


      if (errCitas) throw errCitas;


      setFechaInasistencia(fechaBloqueada);
      setCitasConflictivas(citas || []);
      setSemanaInicio(getLunes(new Date(`${fechaBloqueada}T12:00:00`)));
      setModoModal('revisar');
      setMostrarModalConflictos(true);
      toast.dismiss(loadingToast);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Error al buscar pacientes");
    }
  }


  const anularCitaDirecta = async (citaId: string) => {
    if(!confirm("¿Estás seguro de anular la cita de este paciente?")) return;
    try {
      await supabase.from('citas').update({ estado: 'cancelada' }).eq('id', citaId);
      toast.success("Cita anulada correctamente");
      setCitasConflictivas(prev => prev.filter(c => c.id !== citaId));
    } catch(e) {
      toast.error("No se pudo anular la cita");
    }
  }


  const reagendarCitaDirecta = async (citaId: string) => {
    if(!nuevaFecha || !nuevaHora || !nuevoEspecialista) return toast.error("Selecciona un día y hora del calendario");
   
    setGuardando(true);
    try {
      const inicioDate = new Date(`${nuevaFecha}T${nuevaHora}:00`);
      const finDate = new Date(inicioDate.getTime() + duracionCitaEdicion * 60000);
      const finHoraStr = `${finDate.getHours().toString().padStart(2, '0')}:${finDate.getMinutes().toString().padStart(2, '0')}:00`;


      await supabase.from('citas').update({
        inicio: `${nuevaFecha}T${nuevaHora}:00`,
        fin: `${nuevaFecha}T${finHoraStr}`,
        box_id: nuevoBox,
        profesional_id: nuevoEspecialista
      }).eq('id', citaId);


      toast.success("Cita reagendada con éxito");
      setCitaEnEdicion(null);
      setCitasConflictivas(prev => prev.filter(c => c.id !== citaId));
    } catch(e) {
      toast.error("Error al reagendar");
    } finally {
      setGuardando(false);
    }
  }


  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-[#D4AF37]" size={40} />
    </div>
  )


  const profesionalSeleccionado = profesionales.find(p => p.user_id === profesionalId);


  return (
    <div className="min-h-screen bg-[#FDFDFD] p-6 md:p-12 font-sans text-slate-900 text-left relative">
      <div className="max-w-7xl mx-auto space-y-12">
       
        {/* HEADER */}
        <header className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-8">
            <div className="bg-slate-900 p-6 rounded-[2.2rem] text-[#D4AF37] shadow-2xl">
              <LayoutGrid size={35} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Boxes & Horarios</h1>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.4em] mt-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
                AureoDent Clinical System
              </p>
            </div>
          </div>


          <div className="bg-slate-50 p-3 rounded-[2.5rem] border border-slate-100 flex items-center pr-8 gap-5 min-w-[320px]">
            <div className="w-14 h-14 rounded-full bg-slate-900 border-2 border-[#D4AF37] flex items-center justify-center text-[#D4AF37] font-black text-xl">
              {profesionalSeleccionado?.nombre?.[0]}
            </div>
            <div className="flex flex-col text-left flex-1">
              <span className="text-[8px] font-black text-[#D4AF37] uppercase tracking-widest mb-1">Especialista</span>
              <select className="bg-transparent font-black text-sm text-slate-800 uppercase outline-none cursor-pointer" value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)}>
                {profesionales.map(p => <option key={p.user_id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
              </select>
            </div>
          </div>
        </header>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* FORMULARIOS */}
          <div className="lg:col-span-4 space-y-8">
           
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-50 space-y-8">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                <button onClick={() => setModo('semanal')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${modo === 'semanal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                  Semanal
                </button>
                <button onClick={() => setModo('extraordinario')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${modo === 'extraordinario' ? 'bg-slate-900 text-[#D4AF37] shadow-lg' : 'text-slate-400'}`}>
                  Especial
                </button>
              </div>


              <div className="space-y-6">
                {modo === 'semanal' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Día de Repetición</label>
                    <select className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs" value={nuevoBloque.dia_semana} onChange={(e) => setNuevoBloque({...nuevoBloque, dia_semana: Number(e.target.value)})}>
                      {DIAS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4">Fecha Única</label>
                    <input type="date" className="w-full p-5 bg-amber-50/30 border-amber-100 border rounded-2xl font-bold text-xs" value={nuevoBloque.fecha_especifica} onChange={(e) => setNuevoBloque({...nuevoBloque, fecha_especifica: e.target.value})} />
                  </div>
                )}


                <div className="grid grid-cols-2 gap-4">
                  <input type="time" className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs" value={nuevoBloque.hora_inicio} onChange={(e) => setNuevoBloque({...nuevoBloque, hora_inicio: e.target.value})} />
                  <input type="time" className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs" value={nuevoBloque.hora_fin} onChange={(e) => setNuevoBloque({...nuevoBloque, hora_fin: e.target.value})} />
                </div>


                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setNuevoBloque({...nuevoBloque, box_id: n})} className={`py-4 rounded-2xl text-xs font-black transition-all border-2 ${nuevoBloque.box_id === n ? 'bg-slate-900 text-[#D4AF37] border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>BOX {n}</button>
                  ))}
                </div>


                <button onClick={agregarBloque} disabled={guardando} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3">
                  {guardando ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Guardar
                </button>
              </div>
            </motion.div>


            {/* SEGURIDAD INASISTENCIA */}
            <div className="bg-red-50 p-10 rounded-[3.5rem] border border-red-100 space-y-8">
              <div className="flex items-center gap-4 text-left">
                <div className="bg-red-500 p-4 rounded-2xl text-white shadow-lg"><XCircle size={24} /></div>
                <div className="text-left">
                  <h2 className="text-lg font-black text-red-900 uppercase italic leading-none">Inasistencia</h2>
                  <p className="text-red-400 text-[8px] font-black uppercase tracking-widest mt-2">Cierre de Jornada</p>
                </div>
              </div>


              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-red-300 uppercase ml-4">Día a Cancelar</label>
                  <input type="date" className="w-full p-5 bg-white border-2 border-red-100 rounded-2xl font-bold text-xs text-red-900 outline-none" value={fechaInasistencia} onChange={(e) => setFechaInasistencia(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-red-300 uppercase ml-4">Motivo</label>
                  <input type="text" placeholder="Ej: Licencia médica..." className="w-full p-5 bg-white border-2 border-red-100 rounded-2xl font-bold text-xs text-red-900" value={motivoInasistencia} onChange={(e) => setMotivoInasistencia(e.target.value)} />
                </div>
                <button onClick={validarInasistencia} disabled={guardando} className="w-full py-6 bg-red-600 text-white rounded-[2.2rem] font-black text-xs uppercase shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3">
                  Validar y Bloquear
                </button>
              </div>
            </div>
          </div>


          {/* COLUMNA DERECHA */}
          <div className="lg:col-span-8 bg-white p-12 rounded-[4rem] shadow-xl border border-slate-50 space-y-12">
           
            {bloqueosActivos.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-3"><AlertCircle size={16} /> Jornadas Bloqueadas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bloqueosActivos.map(b => (
                    <div key={b.id} className="bg-red-50/40 border border-red-100 p-6 rounded-[2rem] flex justify-between items-center group">
                      <div className="text-left">
                        <p className="text-[9px] font-black text-red-600 uppercase mb-1">{new Date(b.fecha + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        <p className="text-xs font-bold text-slate-600 italic uppercase tracking-tighter">Sin atención disponible</p>
                      </div>
                      <div className="flex gap-2">
                        {/* NUEVO BOTÓN PARA VER PACIENTES PENDIENTES */}
                        <button onClick={() => revisarPacientesPendientes(b.fecha)} className="p-3 text-blue-400 hover:text-blue-600 hover:bg-blue-50 bg-white rounded-xl shadow-sm transition-all" title="Ver pacientes pendientes por reagendar">
                          <Users size={16}/>
                        </button>
                        <button onClick={async () => { await supabase.from('bloqueos_agenda').delete().eq('id', b.id); fetchBloqueos(); toast.success("Día rehabilitado"); }} className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 bg-white rounded-xl shadow-sm transition-all" title="Eliminar Bloqueo">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3 mb-8"><CalendarDays size={16} /> Horarios Semanales Maestro</h3>
              {DIAS.map((dia) => {
                const bloques = disponibilidad.filter(b => b.dia_semana === dia.id && !b.fecha_especifica);
                return (
                  <div key={dia.id} className="flex flex-col md:flex-row items-center gap-8 p-6 hover:bg-slate-50/80 rounded-[2.5rem] transition-all group">
                    <div className="w-32 text-left shrink-0"><span className="text-xs font-black uppercase text-slate-900 italic group-hover:text-[#D4AF37] transition-colors">{dia.label}</span></div>
                    <div className="flex-1 flex flex-wrap gap-4 justify-start">
                        {bloques.length === 0 ? (<span className="text-[9px] font-black text-slate-200 uppercase italic py-2">Libre</span>) : bloques.map(b => (
                          <div key={b.id} className="bg-white border border-slate-100 px-6 py-3 rounded-2xl flex items-center gap-5 shadow-sm group/item">
                            <div className="text-left">
                              <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">Bloque</span>
                              <span className="text-xs font-black text-slate-700">{b.hora_inicio.substring(0,5)} - {b.hora_fin.substring(0,5)}</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#D4AF37] flex items-center justify-center text-[10px] font-black border border-slate-800">S{b.box_id}</div>
                            {/* AQUÍ ESTÁ EL BOTÓN DE ELIMINAR ACTUALIZADO */}
                            <button onClick={() => eliminarBloque(b)} className="p-2 text-slate-100 hover:text-red-500 transition-all opacity-0 group-hover/item:opacity-100"><Trash2 size={16}/></button>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>


      {/* MODAL DE CONFLICTOS DE AGENDA Y REAGENDAMIENTO SEMANAL */}
      <AnimatePresence>
        {mostrarModalConflictos && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#FDFDFD] w-full max-w-5xl max-h-[90vh] flex flex-col rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              {/* HEADER MODAL */}
              <div className={`${modoModal === 'bloquear' ? 'bg-red-500' : 'bg-blue-500'} p-8 flex items-center justify-between shrink-0 shadow-sm relative z-10 transition-colors`}>
                <div className="flex items-center gap-4 text-white">
                  {modoModal === 'bloquear' ? <AlertCircle size={36} /> : <Users size={36} />}
                  <div>
                    <h2 className="text-2xl font-black uppercase italic leading-none tracking-tighter">Pacientes Pendientes</h2>
                    <p className={`${modoModal === 'bloquear' ? 'text-red-200' : 'text-blue-200'} text-[10px] font-black uppercase tracking-[0.3em] mt-1.5`}>
                      {citasConflictivas.length} citas detectadas el {fechaInasistencia}
                    </p>
                  </div>
                </div>
                <button onClick={() => setMostrarModalConflictos(false)} className={`p-3 text-white rounded-full transition-all ${modoModal === 'bloquear' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  <X size={20} />
                </button>
              </div>


              {/* CONTENIDO SCROLLABLE */}
              <div className="p-8 overflow-y-auto bg-slate-50 flex-1 space-y-4">
               
                {citasConflictivas.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center opacity-70">
                    <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                    <p className="text-sm font-black text-slate-800 uppercase">Agenda Limpia</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Todos los pacientes de este día han sido gestionados.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-slate-500 mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-800">
                      Puedes gestionar a los pacientes directamente desde aquí. <br/>
                      {modoModal === 'bloquear' && 'Si decides no hacerlo ahora, presiona "Forzar Bloqueo" al final y las citas quedarán pendientes.'}
                    </p>


                    {citasConflictivas.map((cita) => {
                      let horaFomateada = "Sin hora";
                      try { horaFomateada = new Date(cita.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }); } catch (e) {}
                     
                      const telefonoLimpio = cita.pacientes?.telefono ? cita.pacientes.telefono.replace(/\D/g, '') : '';
                      const isEditing = citaEnEdicion === cita.id;


                      // Calcular duración visual de la cita original
                      let durationStr = "45 min";
                      try {
                        const dMins = Math.round((new Date(cita.fin).getTime() - new Date(cita.inicio).getTime()) / 60000);
                        if (dMins > 0) durationStr = `${dMins} min`;
                      } catch (e) {}


                      return (
                        <div key={cita.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col group transition-all">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-600 flex flex-col items-center justify-center border border-slate-100 shrink-0">
                                <Clock size={14} className="mb-1 opacity-50" />
                                <span className="text-[10px] font-black">{horaFomateada}</span>
                              </div>
                              <div>
                                <h4 className="font-black text-sm text-slate-800 uppercase leading-none">{cita.pacientes?.nombre} {cita.pacientes?.apellido}</h4>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-[9px] font-bold text-slate-400 tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-100 flex items-center gap-1">
                                    <Clock size={10}/> {durationStr}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-100">RUT: {cita.pacientes?.rut || 'Sin registrar'}</span>
                                  {telefonoLimpio && (
                                    <span className="text-[9px] font-bold text-blue-500 tracking-widest flex items-center gap-1">
                                      <Phone size={10}/> {cita.pacientes.telefono}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>


                            {/* ACCIONES DEL PACIENTE */}
                            {!isEditing && (
                              <div className="flex gap-2 self-start md:self-auto">
                                {telefonoLimpio && (
                                  <>
                                    <a href={`tel:${telefonoLimpio}`} className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all" title="Llamar">
                                      <Phone size={16} />
                                    </a>
                                    <a href={`https://wa.me/${telefonoLimpio}`} target="_blank" rel="noreferrer" className="p-3 bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all" title="WhatsApp">
                                      <MessageCircle size={16} />
                                    </a>
                                  </>
                                )}
                                <div className="w-px h-8 bg-slate-100 mx-1 self-center"></div>
                                <button onClick={() => {
                                  const dInicio = new Date(cita.inicio);
                                  const dFin = new Date(cita.fin);
                                  const calcMins = Math.round((dFin.getTime() - dInicio.getTime()) / 60000);
                                  setDuracionCitaEdicion(calcMins > 0 ? calcMins : 45);


                                  setCitaEnEdicion(cita.id);
                                  setNuevaFecha(''); setNuevaHora(''); setNuevoBox(1);
                                  setNuevoEspecialista(profesionalId);
                                }} className="px-4 py-2 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white rounded-xl transition-all flex items-center gap-2" title="Reagendar">
                                  <CalendarClock size={14} /> Reagendar
                                </button>
                                <button onClick={() => anularCitaDirecta(cita.id)} className="p-3 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all" title="Cancelar Cita">
                                  <Ban size={16} />
                                </button>
                              </div>
                            )}
                          </div>


                          {/* PANEL DE EDICIÓN (AGENDA SEMANAL) */}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-6">
                                 
                                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                    <div className="flex gap-4 w-full md:w-auto flex-1">
                                      <div className="space-y-2 flex-1">
                                        <label className="text-[9px] font-black text-blue-400 uppercase ml-2 flex items-center gap-1"><UserCircle size={12}/> Especialista a derivar</label>
                                        <select className="w-full p-4 bg-white border border-blue-200 rounded-xl font-bold text-xs outline-none text-slate-700" value={nuevoEspecialista} onChange={(e) => setNuevoEspecialista(e.target.value)}>
                                          {profesionales.map(p => <option key={p.user_id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                                        </select>
                                      </div>
                                      <div className="space-y-2 w-32 shrink-0">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Asignar Box</label>
                                        <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" value={nuevoBox} onChange={(e) => setNuevoBox(Number(e.target.value))}>
                                          <option value={1}>BOX 1</option><option value={2}>BOX 2</option><option value={3}>BOX 3</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 self-end md:self-auto">
                                      <span className="text-[10px] font-black text-emerald-600 uppercase">Buscando huecos de {duracionCitaEdicion} min</span>
                                    </div>
                                  </div>


                                  {/* CALENDARIO SEMANAL */}
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col">
                                   
                                    <div className="flex items-center justify-between mb-4 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                      <button onClick={prevWeek} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all"><ChevronLeft size={18}/></button>
                                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                                        Semana del {semanaInicio.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                                      </span>
                                      <button onClick={nextWeek} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all"><ChevronRight size={18}/></button>
                                    </div>


                                    <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                                      {cargandoSlots ? (
                                        <div className="w-full py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
                                          <Loader2 className="animate-spin" size={24} />
                                          <span className="text-[10px] font-black uppercase">Calculando disponibilidad...</span>
                                        </div>
                                      ) : (
                                        dispoSemana.map((dia, idx) => {
                                          const nombreDia = dia.dateObj.toLocaleDateString('es-CL', { weekday: 'short' });
                                          const numDia = dia.dateObj.getDate();
                                          const esHoy = dia.date === new Date().toISOString().split('T')[0];


                                          return (
                                            <div key={idx} className={`min-w-[110px] flex-1 bg-white border ${esHoy ? 'border-blue-300 shadow-md' : 'border-slate-200'} rounded-2xl p-3 flex flex-col items-center`}>
                                              <div className="text-center mb-3">
                                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">{nombreDia}</span>
                                                <span className={`block text-lg font-black ${esHoy ? 'text-blue-600' : 'text-slate-800'}`}>{numDia}</span>
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
                                        <button onClick={() => reagendarCitaDirecta(cita.id)} disabled={guardando || !nuevaHora} className={`flex-1 md:flex-none px-8 py-3 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md flex items-center justify-center gap-2 transition-all ${nuevaHora ? 'bg-emerald-500 hover:bg-emerald-600 active:scale-95' : 'bg-slate-300 cursor-not-allowed'}`}>
                                          {guardando ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Confirmar
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
                  </>
                )}
              </div>


              {/* FOOTER MODAL - CAMBIA SEGÚN EL MODO */}
              <div className="p-6 bg-white border-t border-slate-100 shrink-0 flex flex-col md:flex-row gap-4">
                {modoModal === 'bloquear' ? (
                  <>
                    <button onClick={() => setMostrarModalConflictos(false)} className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">
                      Cancelar y Cerrar
                    </button>
                    <button onClick={ejecutarBloqueoFinal} disabled={guardando} className="flex-1 py-5 bg-slate-900 text-[#D4AF37] border-2 border-slate-900 font-black text-xs uppercase tracking-[0.2em] rounded-[2rem] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3">
                      {guardando ? <Loader2 className="animate-spin" size={18}/> : <AlertCircle size={18}/>}
                      {citasConflictivas.length > 0 ? "Forzar Bloqueo del Día (Dejar Pendientes)" : "Confirmar Bloqueo de Agenda"}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setMostrarModalConflictos(false)} className="w-full py-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[2rem] shadow-xl hover:bg-blue-700 transition-all">
                    Finalizar Revisión y Cerrar Panel
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
     
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  )
}

