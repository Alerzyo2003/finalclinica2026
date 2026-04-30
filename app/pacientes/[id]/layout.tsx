'use client'
import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  User, ClipboardList, Activity, Camera, Wallet, 
  ArrowLeft, UserCircle, History, Pill, FileCheck, 
  ClipboardCheck, Tag, Calendar, Loader2, DollarSign,
  AlertCircle, ImageIcon, ChevronRight, Zap, Fingerprint, VenusAndMars, Cake, Coins
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function PacienteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const id = params.id
  const pathname = usePathname()
  
  const [paciente, setPaciente] = useState<any>(null)
  const [datosPresupuesto, setDatosPresupuesto] = useState<any>(null)
  const [citas, setCitas] = useState<any[]>([])

  // Extraer presupuestoId de la URL si existe
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
    fetchPaciente();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('cambios-paciente')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pacientes', filter: `id=eq.${id}` },
        (payload) => { setPaciente(payload.new); }
      )
      .subscribe();

    const handleUpdate = () => fetchPaciente();
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

  async function fetchPaciente() {
    try {
      const { data } = await supabase.from('pacientes').select('*').eq('id', id).maybeSingle()
      if (data) setPaciente(data)

      const ahora = new Date();
      const isoLocal = ahora.toLocaleDateString('sv-SE') + 'T' + ahora.toLocaleTimeString('es-CL', { hour12: false });

      const { data: cData } = await supabase.from('citas')
        .select('id, inicio, motivo, estado')
        .eq('paciente_id', id)
        .gte('inicio', isoLocal)
        .order('inicio', { ascending: true })
        .limit(3)
      
      if (cData) setCitas(cData)
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

  if (!paciente) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 text-center">
      <Loader2 className="animate-spin text-blue-600" size={48} strokeWidth={1} />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cargando Historial...</p>
    </div>
  )

  // Aseguramos que "esFicha" no se ilumine cuando estemos en "/pagos"
  const esFicha = pathname.startsWith(`/pacientes/${id}`) && 
                  !pathname.includes('/datos') && 
                  !pathname.includes('/tratamientos') && 
                  !pathname.includes('/odontograma') && 
                  !pathname.includes('/archivos') &&
                  !pathname.includes('/pagos');

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans selection:bg-blue-100 text-left">
      {/* HEADER PREMIUM */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[100] px-6 py-5 print:hidden text-left">
        <div className="max-w-[95%] mx-auto flex flex-col md:flex-row justify-between items-center w-full gap-4 text-left">
          <div className="flex items-center gap-6 text-left w-full md:w-auto">
            <div className="relative group shrink-0 text-left">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-[2rem] text-white shadow-2xl shadow-blue-200">
                <User size={28} strokeWidth={2.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full"></div>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1 text-left">
                 <span className="bg-blue-50 text-blue-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest">Paciente Activo</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none text-left">{paciente.nombre} {paciente.apellido}</h1>
              
              <div className="flex flex-wrap items-center gap-4 mt-2 text-left">
                <div className="flex items-center gap-1.5 text-left">
                  <Fingerprint size={12} className="text-slate-300" />
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-left">RUT: <span className="text-slate-800">{paciente.rut || 'S/R'}</span></p>
                </div>
                <div className="w-1 h-1 bg-slate-200 rounded-full hidden sm:block"></div>
                <div className="flex items-center gap-1.5 text-left">
                  <VenusAndMars size={12} className="text-slate-300" />
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-left">Sexo: <span className="text-slate-800 uppercase">{paciente.sexo || 'N/A'}</span></p>
                </div>
                <div className="w-1 h-1 bg-slate-200 rounded-full hidden sm:block"></div>
                <div className="flex items-center gap-1.5 text-left">
                  <Cake size={12} className="text-slate-300" />
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-left">Edad: <span className="text-slate-800">{calcularEdad(paciente.fecha_nacimiento)}</span></p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto no-scrollbar py-1">
            <nav className="bg-slate-100/80 p-1.5 rounded-[1.8rem] flex border border-slate-200 shadow-inner">
              <TabLink href={`/pacientes/${id}`} active={esFicha} icon={<ClipboardList size={16}/>} label="Ficha" />
              <TabLink href={`/pacientes/${id}/datos`} active={pathname.includes('/datos')} icon={<UserCircle size={16}/>} label="Perfil" />
              <TabLink href={`/pacientes/${id}/tratamientos`} active={pathname.includes('/tratamientos')} icon={<Wallet size={16}/>} label="Tratamientos" />
              {/* --- NUEVA PESTAÑA DE PAGOS ARRIBA --- */}
              <TabLink href={`/pacientes/${id}/pagos`} active={pathname.includes('/pagos')} icon={<Coins size={16}/>} label="Pagos" />
              <TabLink href={`/pacientes/${id}/odontograma`} active={pathname.includes('/odontograma')} icon={<Activity size={16}/>} label="Odonto" />
              <TabLink href={`/pacientes/${id}/archivos`} active={pathname.includes('/archivos')} icon={<Camera size={16}/>} label="Galería" />
            </nav>
            <Link href="/agenda" className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-blue-600 transition-all shrink-0">
              <ArrowLeft size={20} strokeWidth={2.5}/>
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
            <nav className="bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-sm sticky top-[100px] z-50 print:hidden text-left">
              <SubTabLink href={`/pacientes/${id}`} active={pathname === `/pacientes/${id}`} label="Resumen" icon={<History size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/evoluciones`} active={pathname.includes('/evoluciones')} label="Evoluciones" icon={<Activity size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/antecedentes`} active={pathname.includes('/antecedentes')} label="Ant. Médicos" icon={<AlertCircle size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/rx-documentos`} active={pathname.includes('/rx-documentos')} label="RX y Multimedia" icon={<ImageIcon size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/recetas`} active={pathname.includes('/recetas')} label="Recetario" icon={<Pill size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/documentos`} active={pathname.includes('/documentos')} label="Documentos" icon={<FileCheck size={14}/>} />
              <SubTabLink href={`/pacientes/${id}/consentimientos`} active={pathname.includes('/consentimientos')} label="Consentimientos" icon={<ClipboardCheck size={14}/>} />
            </nav>
          )}
          
          <div className="flex-1 print:block bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[600px] text-left">
            <div className="h-full w-full text-left">
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
    <Link href={href} className={`flex items-center gap-2.5 px-6 py-3 rounded-[1.4rem] font-black text-[11px] uppercase transition-all shrink-0 ${active ? 'bg-white text-blue-600 shadow-xl shadow-blue-100 border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
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