'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Plus, Loader2, Wallet, Stethoscope, ChevronRight,
  FileText, Trash2, CheckCircle2, X, Calendar, Activity, AlertCircle, Tag, StethoscopeIcon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

const ESTADOS_PLAN: Record<string, { label: string, tagColor: string, borderColor: string, progressColor: string }> = {
    BORRADOR: { label: 'Borrador', tagColor: 'bg-slate-100 text-slate-500', borderColor: 'border-slate-200 hover:border-slate-400', progressColor: 'bg-slate-400' },
    POR_INICIAR: { label: 'Por Iniciar', tagColor: 'bg-indigo-100 text-indigo-600', borderColor: 'border-indigo-200 hover:border-indigo-500', progressColor: 'bg-indigo-500' },
    EN_CURSO: { label: 'En Curso', tagColor: 'bg-blue-100 text-blue-600', borderColor: 'border-blue-200 hover:border-blue-500', progressColor: 'bg-blue-500' },
    FINALIZADO_CON_DEUDA: { label: 'Finalizado (con deuda)', tagColor: 'bg-yellow-100 text-yellow-700', borderColor: 'border-yellow-300 hover:border-yellow-500', progressColor: 'bg-yellow-500' },
    FINALIZADO: { label: 'Finalizado y Saldado', tagColor: 'bg-emerald-100 text-emerald-700', borderColor: 'border-emerald-200 hover:border-emerald-500', progressColor: 'bg-emerald-500' },
    IMPORTADO: { label: 'Importado', tagColor: 'bg-amber-100 text-amber-700', borderColor: 'border-amber-200 hover:border-amber-500', progressColor: 'bg-amber-500' },
};


export default function ListaTratamientosPage() {
  const params = useParams()
  const paciente_id = params.id as string
  const router = useRouter()
 
  const [planes, setPlanes] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroActivo, setFiltroActivo] = useState<string>('TODOS')


  // 🔥 NUEVO: CONTROL DE ROLES 🔥
  const [perfil, setPerfil] = useState<any>(null)
 
  const [modalNuevoPlan, setModalNuevoPlan] = useState(false)
  const [creandoPlan, setCreandoPlan] = useState(false)
  const [nuevoPlan, setNuevoPlan] = useState({
    nombre: '',
    especialista_id: ''
  })


  useEffect(() => {
    if (paciente_id) {
      fetchInicial()
    }
  }, [paciente_id])


  async function fetchInicial() {
    setCargando(true)
    try {
      // Obtenemos el perfil del usuario activo para saber qué mostrarle
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: pData } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
        setPerfil(pData)
      }


      await Promise.all([fetchPlanes(), fetchProfesionales()])
    } catch (error) {
      console.error(error)
    } finally {
      setCargando(false)
    }
  }


  // REGLAS VISUALES
  const puedeVerFinanzas = perfil?.rol === 'ADMIN' || perfil?.rol === 'RECEPCIONISTA' || perfil?.rol === 'DENTISTA';


  async function fetchProfesionales() {
    const { data } = await supabase.from('profesionales').select('user_id, nombre, apellido').eq('activo', true)
    setProfesionales(data || [])
  }


  async function fetchPlanes() {
    console.log("%c🚀 INICIANDO CARGA DE HISTORIAL COMPLETO", "background: #2563eb; color: white; padding: 5px; font-weight: bold;");
   
    const { data: paciente } = await supabase.from('pacientes').select('rut, nombre').eq('id', paciente_id).single();
    if (!paciente) return;


    const rutLimpio = paciente.rut.trim();
    const rutFuzzy = `%${rutLimpio.replaceAll('.', '').split('').join('%')}%`;


    // 1. Traer Planes OFICIALES
    const { data: oficiales } = await supabase
      .from('presupuestos')
      .select(`*, profesionales(nombre, apellido, especialidades(nombre)), presupuesto_items(id, estado, precio_pactado, abonado, progreso), citas(inicio)`)
      .eq('paciente_id', paciente_id)
      .order('created_at', { ascending: false });


    // 2. Traer Planes TEMPORALES
    const { data: temporales, error: errT } = await supabase
      .from('temp_presupuestos')
      .select('*')
      .or(`rut.eq.${rutLimpio},rut.ilike.${rutFuzzy}`);
   
    // 3. Traer ITEMS temporales
    const idsDentalinkOficiales = oficiales?.map(p => String(p.id_dentalink)).filter(id => id !== "null") || [];
    const idsSoloTemporales = (temporales || []).map(p => String(p.id_dentalink));
    const todosIdsDentalink = [...new Set([...idsDentalinkOficiales, ...idsSoloTemporales])];


    let itemsTempGlobal: any[] = [];
    if (todosIdsDentalink.length > 0) {
        const { data: it } = await supabase.from('temp_items').select('*').in('id_dentalink', todosIdsDentalink);
        itemsTempGlobal = it || [];
    }


    // 4. PROCESAR Y COMBINAR
    const oficialesProcesados = (oficiales || []).map(plan => {
        let items = plan.presupuesto_items || [];
        if (plan.id_dentalink) {
            const extra = itemsTempGlobal.filter(i => String(i.id_dentalink) === String(plan.id_dentalink));
            if (items.length === 0) items = extra;
        }
        return procesarPlan(plan, items);
    });


    const idsOficialesYaMigrados = oficiales?.map(o => String(o.id_dentalink)) || [];
    const temporalesNoMigrados = (temporales || []).filter(t => !idsOficialesYaMigrados.includes(String(t.id_dentalink)));
   
    const temporalesProcesados = temporalesNoMigrados.map(plan => {
        const items = itemsTempGlobal.filter(i => String(i.id_dentalink) === String(plan.id_dentalink));
        return procesarPlan({ ...plan, id: `temp-${plan.id_dentalink}`, estado: 'pendiente' }, items);
    });


    const listaFinal = [...oficialesProcesados, ...temporalesProcesados];
    setPlanes(listaFinal);
  }


  function procesarPlan(plan: any, items: any[]) {
    const totalItems = items.length;

    // 1. Calcular el progreso clínico promedio
    const sumaProgresos = items.reduce((acc, item) => {
        const estado = String(item.estado).toLowerCase();
        if (['realizado', 'atendido', 'finalizado', 'terminado', 'completado'].includes(estado)) {
            return acc + 100;
        }
        return acc + (Number(item.progreso) || 0);
    }, 0);
    const progreso = totalItems > 0 ? Math.round(sumaProgresos / totalItems) : 0;

    // 2. Calcular valores financieros
    const totalPlan = items.reduce((acc, curr) => acc + Number(curr.precio_pactado || 0), 0) || Number(plan.total || 0);
    const totalAbonado = items.reduce((acc, curr) => acc + Number(curr.abonado || 0), 0) || Number(plan.total_abonado || 0);
    
    // 3. Calcular deuda exigible basada en el progreso de cada item
    const valorExigible = items.reduce((acc, item) => {
        const estado = String(item.estado).toLowerCase();
        const isRealizado = ['realizado', 'atendido', 'finalizado', 'terminado', 'completado'].includes(estado);
        const avance = Number(item.progreso) || 0;
        const precio = Number(item.precio_pactado || 0);

        if (isRealizado) return acc + precio;
        if (avance > 0) return acc + (precio * (avance / 100));
        return acc;
    }, 0);

    const deudaExigible = Math.max(0, valorExigible - totalAbonado);
    const deudaTotalDelPlan = Math.max(0, totalPlan - totalAbonado);

    const estadoFinanciero = deudaExigible > 0 ? 'CON DEUDA' : (deudaTotalDelPlan <= 0 && totalPlan > 0 ? 'SALDADO' : 'AL DIA');

    let estadoGeneral = 'BORRADOR';
    if (String(plan.id).startsWith('temp-')) {
        estadoGeneral = 'IMPORTADO';
    } else if (progreso === 100) {
        if (deudaTotalDelPlan <= 0) {
            estadoGeneral = 'FINALIZADO';
        } else {
            estadoGeneral = 'FINALIZADO_CON_DEUDA';
        }
    } else if (progreso > 0) {
        estadoGeneral = 'EN_CURSO';
    } else if (plan.aprobado || totalAbonado > 0) {
        estadoGeneral = 'POR_INICIAR';
    }
   
    return {
      ...plan,
      progresoClinico: progreso,
      totalCalculado: totalPlan,
      abonadoCalculado: totalAbonado,
      deuda: deudaExigible,
      estadoFinanciero,
      nombreDoctor: plan.profesionales ? `Dr/a. ${plan.profesionales.nombre} ${plan.profesionales.apellido}` : 'Importado de Dentalink',
      especialidad: plan.profesionales?.especialidades?.nombre || 'Odontología',
      estadoGeneral,
    };
  }


  const handleCrearPlan = async () => {
    if (!nuevoPlan.nombre || !nuevoPlan.especialista_id) return toast.error("Completa los datos");
    setCreandoPlan(true);
    try {
      const { error } = await supabase.from('presupuestos').insert([{
          paciente_id: paciente_id,
          nombre_tratamiento: nuevoPlan.nombre.toUpperCase(),
          especialista_id: nuevoPlan.especialista_id,
          estado: 'borrador',
          aprobado: false
      }]);
      if (error) throw error;
      toast.success("Plan creado");
      setModalNuevoPlan(false);
      setNuevoPlan({ nombre: '', especialista_id: '' });
      fetchPlanes();
    } catch (e) { toast.error("Error al crear"); } finally { setCreandoPlan(false); }
  }


  const planesFiltrados = planes.filter(plan => {
    if (filtroActivo === 'TODOS') return true;
    if (filtroActivo === 'EN CURSO') return plan.progresoClinico < 100;
    if (filtroActivo === 'FINALIZADOS') return plan.progresoClinico === 100;
    // Ocultar filtro de deuda si no tiene permisos, por seguridad
    if (puedeVerFinanzas && filtroActivo === 'DEUDA') return plan.estadoFinanciero === 'CON DEUDA';
    return true;
  });


  if (cargando) return (
    <div className="h-96 flex flex-col items-center justify-center bg-white/50 rounded-[3rem] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargando historial completo...</p>
    </div>
  )


  return (
    <div className="space-y-8 text-left font-sans pb-20">
     
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic flex items-center gap-3 leading-none">
            {puedeVerFinanzas ? <Wallet className="text-blue-600" size={24} /> : <StethoscopeIcon className="text-blue-600" size={24} />}
            Tratamientos y Evoluciones
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Historial Clínico del Paciente</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/pacientes/${paciente_id}`} className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors">Volver</Link>
          <button onClick={() => setModalNuevoPlan(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2">
            <Plus size={18} /> Nuevo Tratamiento
          </button>
        </div>
      </div>


      {/* FILTROS (Se oculta DEUDA si es asistente) */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {['TODOS', 'EN CURSO', 'FINALIZADOS', ...(puedeVerFinanzas ? ['DEUDA'] : [])].map(f => (
          <button key={f} onClick={() => setFiltroActivo(f)} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${filtroActivo === f ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>
            {f}
          </button>
        ))}
      </div>


      {/* GRID DE PLANES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {planesFiltrados.length === 0 ? (
          <div className="lg:col-span-2 bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-100">
            <FileText size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Sin registros</p>
          </div>
        ) : (
          planesFiltrados.map((plan) => {
            const configEstado = ESTADOS_PLAN[plan.estadoGeneral] || ESTADOS_PLAN.BORRADOR;
            return (
            <motion.div layout key={plan.id} onClick={() => {
                const idReal = plan.id.startsWith('temp-') ? plan.id_dentalink : plan.id;
                router.push(`/pacientes/${paciente_id}/tratamientos/${idReal}`);
            }} className={`group bg-white p-8 rounded-[2.5rem] border-2 ${configEstado.borderColor} transition-all cursor-pointer shadow-sm relative flex flex-col justify-between h-full`}>
             
              {/* ETIQUETAS FINANCIERAS (Solo se muestran si tienes permisos) */}
              {puedeVerFinanzas && (
                <div className="absolute top-6 right-6">
                   {plan.estadoFinanciero === 'SALDADO' && <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1"><CheckCircle2 size={12}/> Saldado</span>}
                   {plan.estadoFinanciero === 'CON DEUDA' && <span className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1"><AlertCircle size={12}/> Con Deuda</span>}
                </div>
              )}


              <div className="flex items-start gap-5 mb-8">
                <div className="bg-slate-50 w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-slate-400 shrink-0 border transition-colors">
                  <span className="text-[8px] font-black uppercase opacity-50">Folio</span>
                  <span className="text-sm font-black italic">#{String(plan.id_dentalink || plan.id).substring(0,4)}</span>
                </div>
                <div className="flex-1 pr-24 text-left">
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full mb-3 inline-block ${configEstado.tagColor}`}>
                    {configEstado.label}
                  </span>
                  <h3 className="text-xl font-black text-slate-800 uppercase leading-none mb-2 mt-1">{plan.nombre_tratamiento || plan.nombre || 'Diagnóstico'}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Stethoscope size={12}/> {plan.nombreDoctor}</p>
                </div>
              </div>


              <div className="mb-8">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Activity size={12}/> Progreso Clínico</p>
                    <p className="text-xs font-black text-slate-800">{plan.progresoClinico}%</p>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative">
                    <div className={`h-full absolute left-0 top-0 rounded-full ${configEstado.progressColor}`} style={{ width: `${plan.progresoClinico}%` }} />
                  </div>
              </div>


              {/* BLOQUE FINANCIERO (Solo se muestra si tienes permisos) */}
              {puedeVerFinanzas && (
                <div className="flex justify-between items-end border-t border-slate-100 pt-6">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Finanzas</p>
                    <p className="text-[10px] font-bold text-slate-500">
                      Total: ${Number(plan.totalCalculado).toLocaleString('es-CL')} <br/>
                      Abonado: <span className="text-emerald-500">${Number(plan.abonadoCalculado).toLocaleString('es-CL')}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendiente</p>
                    <p className={`text-2xl font-black leading-none mt-1 ${plan.deuda > 0 ? 'text-red-500' : 'text-slate-300'}`}>${Number(plan.deuda).toLocaleString('es-CL')}</p>
                  </div>
                </div>
              )}


            </motion.div>
          )})
        )}
      </div>


      {/* MODAL NUEVO PLAN */}
      <AnimatePresence>
        {modalNuevoPlan && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden text-left">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Nuevo Tratamiento</h2>
                <button onClick={() => setModalNuevoPlan(false)}><X size={20}/></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre del Plan</label><input autoFocus className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-sm uppercase text-slate-800" value={nuevoPlan.nombre} onChange={(e) => setNuevoPlan({...nuevoPlan, nombre: e.target.value})} /></div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Especialista</label>
                  <select className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-sm text-slate-800" value={nuevoPlan.especialista_id} onChange={(e) => setNuevoPlan({...nuevoPlan, especialista_id: e.target.value})}>
                    <option value="">SELECCIONAR...</option>
                    {profesionales.map(p => <option key={p.user_id} value={p.user_id}>DR/A. {p.nombre} {p.apellido}</option>)}
                  </select>
                </div>
                <button onClick={handleCrearPlan} disabled={creandoPlan} className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300">
                  {creandoPlan ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />} Crear Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
