'use client'
import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  User, ClipboardList, Activity, Camera, Wallet, 
  ArrowLeft, UserCircle, History, Pill, FileCheck, 
  ClipboardCheck, Tag, Calendar, Loader2, DollarSign,
  AlertCircle, ImageIcon, ChevronRight, Zap, Fingerprint, 
  VenusAndMars, Cake, Coins, AlertTriangle, Heart, Lock, ShieldAlert
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function PacienteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const id = params.id
  const pathname = usePathname()
  const router = useRouter()
  
  const [paciente, setPaciente] = useState<any>(null)
  const [datosPresupuesto, setDatosPresupuesto] = useState<any>(null)
  const [citas, setCitas] = useState<any[]>([])
  const [antecedentes, setAntecedentes] = useState<any[]>([])

  const presupuestoId = pathname.match(/\/tratamientos\/([a-f0-9-]{36})/)?.[1] || null;

  const calcularEdad = (fechaNac: string) => {
    if (!fechaNac) return 'N/A';
    const hoy = new Date();
    const cumple = new Date(fechaNac);
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
    return edad + ' años';
  }

  useEffect(() => {
    if (!id) return;
    fetchDatosMaestros();

    const channel = supabase
      .channel('cambios-paciente')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pacientes', filter: `id=eq.${id}` }, (payload) => { 
        setPaciente(payload.new); 
      })
      .subscribe();

    const handleUpdate = () => fetchDatosMaestros();
    window.addEventListener('pacienteActualizado', handleUpdate);
    
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('pacienteActualizado', handleUpdate);
    };
  }, [id])

  useEffect(() => {
    if (presupuestoId) fetchDatosPresupuesto(presupuestoId)
    else setDatosPresupuesto(null)
  }, [presupuestoId, pathname])

  async function fetchDatosMaestros() {
    try {
      const ahora = new Date();
      const isoLocal = ahora.toLocaleDateString('sv-SE') + 'T' + ahora.toLocaleTimeString('es-CL', { hour12: false });

      const [resPac, resCitas, resAnt] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).maybeSingle(),
        supabase.from('citas').select('id, inicio, motivo, estado').eq('paciente_id', id).gte('inicio', isoLocal).order('inicio', { ascending: true }).limit(3),
        supabase.from('antecedentes').select('*').eq('paciente_id', id)
      ]);

      if (resPac.data) setPaciente(resPac.data);
      if (resCitas.data) setCitas(resCitas.data);
      if (resAnt.data) setAntecedentes(resAnt.data);
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchDatosPresupuesto(pId: string) {
    try {
      const { data } = await supabase.from('presupuestos').select('*, profesionales:especialista_id (nombre, apellido)').eq('id', pId).maybeSingle()
      if (data) setDatosPresupuesto(data)
    } catch (err) {
      console.error(err)
    }
  }

  // 1. PANTALLA DE CARGA
  if (!paciente) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 text-center">
      <Loader2 className="animate-spin text-blue-600" size={48} strokeWidth={1} />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cargando Ficha Maestra...</p>
    </div>
  )

  // 2. MURO DE SEGURIDAD (PACIENTE BLOQUEADO)
  if (paciente && paciente.activo === false) return (
    <div className="h-screen flex items-center justify-center bg-[#FDFDFD] p-6 selection:bg-red-100">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white max-w-lg w-full p-10 md:p-14 rounded-[3.5rem] shadow-2xl shadow-red-900/5 border border-red-50 text-center flex flex-col items-center">
        
        <div className="w-28 h-28 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-8 border-[10px] border-red-500/10 relative">
          <Lock size={48} strokeWidth={2.5} />
          <div className="absolute -bottom-2 -right-2 bg-red-600 text-white p-2 rounded-full border-4 border-white">
            <ShieldAlert size={20} />
          </div>
        </div>

        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-3 leading-none">Ficha Bloqueada</h1>
        <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">
          Este paciente ({paciente.nombre} {paciente.apellido}) ha sido marcado como <strong>inactivo</strong> en el sistema. El acceso a su historial clínico, tratamientos y pagos está restringido.
        </p>

        {paciente.motivo_deshabilitado && (
          <div className="bg-red-50/50 border border-red-100 p-5 rounded-3xl w-full mb-10 text-left">
            <p className="text-[9px] font-black text-red-800 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5"><AlertTriangle size={12}/> Motivo del Bloqueo</p>
            <p className="text-sm font-bold text-red-600 italic">"{paciente.motivo_deshabilitado}"</p>
          </div>
        )}

        <button 
          onClick={() => router.back()} 
          className="w-full bg-slate-900 text-white font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} /> Volver Atrás
        </button>
      </motion.div>
    </div>
  )

  const esFicha = pathname.startsWith(`/pacientes/${id}`) && 
                  !pathname.includes('/datos') && 
                  !pathname.includes('/tratamientos') && 
                  !pathname.includes('/odontograma') && 
                  !pathname.includes('/archivos') &&
                  !pathname.includes('/pagos');

  const alertas = antecedentes.filter(a => a.categoria === 'alerta');
  const enfermedades = antecedentes.filter(a => a.categoria === 'enfermedad');
  const medicamentos = antecedentes.filter(a => a.categoria === 'medicamento');

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-blue-100 text-left">
      
      {/* ========================================================================= */}
      {/* HEADER TIPO DENTALINK (DIVIDIDO EN 2: INFO ARRIBA, MENÚ ABAJO)           */}
      {/* ========================================================================= */}
      <header className="bg-white sticky top-0 z-[100] border-b border-slate-200 shadow-sm print:hidden flex flex-col">
        
        {/* PARTE 1: INFORMACIÓN DEL PACIENTE Y ANTECEDENTES COMPACTOS */}
        <div className="px-6 py-4 max-w-[95%] mx-auto w-full flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
          
          {/* Avatar y Datos Personales */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="relative group">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-3.5 rounded-[1.5rem] text-white shadow-lg shadow-blue-200/50">
                <User size={24} strokeWidth={2.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-[3px] border-white rounded-full"></div>
            </div>
            
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1.5">{paciente.nombre} {paciente.apellido}</h1>
              
              <div className="flex flex-wrap items-center gap-3 text-left">
                <div className="flex items-center gap-1.5">
                  <Fingerprint size={12} className="text-slate-300" />
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">RUT: <span className="text-slate-800">{paciente.rut || 'S/R'}</span></p>
                </div>
                <div className="w-1 h-1 bg-slate-200 rounded-full hidden sm:block"></div>
                <div className="flex items-center gap-1.5">
                  <VenusAndMars size={12} className="text-slate-300" />
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Sexo: <span className="text-slate-800 uppercase">{paciente.sexo || 'N/A'}</span></p>
                </div>
                <div className="w-1 h-1 bg-slate-200 rounded-full hidden sm:block"></div>
                <div className="flex items-center gap-1.5">
                  <Cake size={12} className="text-slate-300" />
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Edad: <span className="text-slate-800">{calcularEdad(paciente.fecha_nacimiento)}</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* CUADROS DE ANTECEDENTES MÉDICOS (COMPACTOS Y ANIMADOS) */}
          <div className="flex-1 flex flex-col sm:flex-row xl:justify-end gap-3 items-stretch w-full xl:w-auto mt-2 xl:mt-0">
            
            {/* 1. ALERTAS MÉDICAS */}
            <div className="flex-1 sm:flex-none w-full sm:w-36 lg:w-44 bg-red-50/40 border border-red-100 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-lg hover:z-10 cursor-default">
              <h3 className="text-[8px] font-black text-red-800 uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle size={10}/> Alertas
              </h3>
              <div className="flex flex-wrap gap-1">
                {alertas.length > 0 ? alertas.map(a => (
                  <span key={a.id} className="bg-red-100/80 text-red-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase leading-tight">
                    {a.contenido}
                  </span>
                )) : <span className="text-[8px] text-red-400/70 font-bold italic uppercase tracking-widest">Ninguna</span>}
              </div>
            </div>

            {/* 2. ENFERMEDADES */}
            <div className="flex-1 sm:flex-none w-full sm:w-36 lg:w-44 bg-blue-50/40 border border-blue-100 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-lg hover:z-10 cursor-default">
              <h3 className="text-[8px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={10}/> Enfermedades
              </h3>
              <div className="flex flex-wrap gap-1">
                {enfermedades.length > 0 ? enfermedades.map(e => (
                  <span key={e.id} className="bg-blue-100/80 text-blue-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase leading-tight">
                    {e.contenido}
                  </span>
                )) : <span className="text-[8px] text-blue-400/70 font-bold italic uppercase tracking-widest">Ninguna</span>}
              </div>
            </div>

            {/* 3. MEDICAMENTOS */}
            <div className="flex-1 sm:flex-none w-full sm:w-36 lg:w-44 bg-purple-50/40 border border-purple-100 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-lg hover:z-10 cursor-default">
              <h3 className="text-[8px] font-black text-purple-800 uppercase tracking-widest flex items-center gap-1.5">
                <Pill size={10}/> Medicamentos
              </h3>
              <div className="flex flex-wrap gap-1">
                {medicamentos.length > 0 ? medicamentos.map(m => (
                  <span key={m.id} className="bg-purple-100/80 text-purple-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase leading-tight">
                    {m.contenido}
                  </span>
                )) : <span className="text-[8px] text-purple-400/70 font-bold italic uppercase tracking-widest">Ninguno</span>}
              </div>
            </div>

          </div>
          
        </div>

        {/* PARTE 2: BARRA DE NAVEGACIÓN COMPACTA */}
        <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-2">
          <div className="max-w-[95%] mx-auto flex items-center justify-between">
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <TabLink href={`/pacientes/${id}`} active={esFicha} icon={<ClipboardList size={14}/>} label="Ficha" />
              <TabLink href={`/pacientes/${id}/datos`} active={pathname.includes('/datos')} icon={<UserCircle size={14}/>} label="Perfil" />
              <TabLink href={`/pacientes/${id}/tratamientos`} active={pathname.includes('/tratamientos')} icon={<Wallet size={14}/>} label="Tratamientos" />
              <TabLink href={`/pacientes/${id}/pagos`} active={pathname.includes('/pagos')} icon={<Coins size={14}/>} label="Pagos" />
              <TabLink href={`/pacientes/${id}/odontograma`} active={pathname.includes('/odontograma')} icon={<Activity size={14}/>} label="Odonto" />
              <TabLink href={`/pacientes/${id}/archivos`} active={pathname.includes('/archivos')} icon={<Camera size={14}/>} label="Galería" />
            </nav>
            <Link href="/agenda" className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 transition-all shrink-0 ml-4 shadow-sm" title="Volver a la Agenda">
              <ArrowLeft size={16} strokeWidth={2.5}/>
            </Link>
          </div>
        </div>

      </header>

      {/* CUERPO PRINCIPAL */}
      <div className="px-6 py-8 max-w-[95%] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 print:p-0 print:block text-left">
        
        {/* ASIDE IZQUIERDO */}
        <aside className="lg:col-span-3 space-y-6 print:hidden text-left">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group text-left">
             <div className="absolute top-0 right-0 p-4 opacity-5 text-slate-900 pointer-events-none"><Tag size={60} /></div>
             <div className="flex items-center gap-4 relative z-10 text-left">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shrink-0"><Tag size={20}/></div>
                <div className="text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">Previsión / Convenio</p>
                    <p className="text-xs font-black text-slate-800 uppercase mt-1 text-left">
                     {paciente.prevision && paciente.prevision !== 'Sin convenio' ? paciente.prevision : 'Particular'}
                    </p>
                </div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-left">
            <h4 className="font-black text-[10px] uppercase text-slate-400 mb-6 flex items-center justify-between text-left">
              <span>Agenda Próxima</span>
              <Calendar size={14} className="text-blue-500"/>
            </h4>
            <div className="space-y-4 text-left">
              {citas.length > 0 ? citas.map(c => (
                <div key={c.id} className="group relative pl-4 border-l-2 border-slate-100 hover:border-blue-500 transition-colors text-left">
                  <p className="text-[11px] font-black text-slate-800 leading-none text-left">
                    {c.inicio ? new Date(c.inicio.replace('T', ' ')).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : 'S/F'} 
                    • {c.inicio ? new Date(c.inicio.replace('T', ' ')).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'S/H'}
                  </p>
                  <p className="text-[10px] text-blue-600 font-bold uppercase mt-2 tracking-tight truncate text-left">{c.motivo || 'Consulta'}</p>
                </div>
              )) : (
                <div className="text-center py-6 text-left">
                  <p className="text-[10px] text-slate-300 font-black uppercase italic text-center">Sin citas pendientes</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ÁREA DE CONTENIDO DINÁMICO */}
        <div className="lg:col-span-9 flex flex-col gap-6 print:block print:w-full text-left">
          {esFicha && (
            <nav className="bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-sm sticky top-[130px] z-50 print:hidden text-left">
              <SubTabLink href={`/pacientes/${id}`} active={pathname === `/pacientes/${id}`} label="Resumen" icon={<History size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/evoluciones`} active={pathname.includes('/evoluciones')} label="Evoluciones" icon={<Activity size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/antecedentes`} active={pathname.includes('/antecedentes')} label="Ant. Médicos" icon={<AlertCircle size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/rx-documentos`} active={pathname.includes('/rx-documentos')} label="RX y Multimedia" icon={<ImageIcon size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/recetas`} active={pathname.includes('/recetas')} label="Recetario" icon={<Pill size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/documentos`} active={pathname.includes('/documentos')} label="Documentos" icon={<FileCheck size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/consentimientos`} active={pathname.includes('/consentimientos')} label="Consentimientos" icon={<ClipboardCheck size={14}/>} />
            </nav>
          )}
          
          {/* ========================================================================================= */}
          {/* AQUI ESTA LA MAGIA: EL CONTENEDOR SE QUEDA SIN BORDES, NI SOMBRAS NI FONDOS AL IMPRIMIR   */}
          {/* ========================================================================================= */}
          <div className="flex-1 print:block bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[600px] text-left print:border-none print:shadow-none print:bg-transparent print:rounded-none print:min-h-0 print:overflow-visible">
            <div className="h-full w-full text-left print:overflow-visible">
               {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabLink({ href, active, icon, label }: any) {
  return (
    <Link href={href} className={`flex items-center gap-2 px-4 py-2 rounded-[1rem] font-black text-[10px] uppercase transition-all shrink-0 ${active ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'}`}>
      {icon} <span className="tracking-tight">{label}</span>
    </Link>
  )
}

function SubTabLink({ href, active, label, icon }: any) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all whitespace-nowrap ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
      <span className={active ? 'text-blue-400' : ''}>{icon}</span> {label}
    </Link>
  )
}