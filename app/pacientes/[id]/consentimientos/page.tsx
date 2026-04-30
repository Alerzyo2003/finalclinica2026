'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  FileSignature, FileCheck, Plus, Trash2, Loader2, X,
  ChevronRight, CheckCircle2, Clock
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'


export default function ConsentimientosPacientePage() {
  const { id: pacienteId } = useParams()
  const router = useRouter()
  
  const [consentimientosEmitidos, setConsentimientosEmitidos] = useState<any[]>([])
  const [tiposConsentimientos, setTiposConsentimientos] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [creando, setCreando] = useState(false)


  const [form, setForm] = useState({
    tipo_id: '',
    presupuesto_id: '',
    especialista_id: ''
  })


  useEffect(() => {
    if (pacienteId) fetchData()
  }, [pacienteId])


  async function fetchData() {
    setCargando(true)
    try {
      const { data: emitidos, error: errEmitidos } = await supabase
        .from('paciente_consentimientos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha_creacion', { ascending: false });


      const [tipos, pres, pros] = await Promise.all([
        supabase.from('consentimientos').select('*').eq('estado', 'Sí'),
        supabase.from('presupuestos').select('id, nombre_tratamiento').eq('paciente_id', pacienteId),
        supabase.from('profesionales').select('user_id, nombre, apellido').eq('activo', true)
      ]);


      setConsentimientosEmitidos(emitidos || []);
      setTiposConsentimientos(tipos.data || []);
      setPresupuestos(pres.data || []);
      setProfesionales(pros.data || []);


    } catch (error: any) {
      console.error("Error al cargar:", error);
      toast.error("Error de conexión con AureoDent");
    } finally {
      setCargando(false);
    }
  }


  async function handleCrearConsentimiento() {
    if (!form.tipo_id || !form.especialista_id) {
      toast.error("Selecciona plantilla y especialista");
      return;
    }


    setCreando(true);
    try {
      const plantilla = tiposConsentimientos.find(t => t.id === form.tipo_id);
      const pro = profesionales.find(p => p.user_id === form.especialista_id);


      // MAPEADO SEGÚN TU SQL:
      const nuevoRegistro = {
        paciente_id: pacienteId,
        consentimiento_id: form.tipo_id,
        especialista_id: form.especialista_id, // Coincide con FK
        presupuesto_id: form.presupuesto_id || null,
        nombre_consentimiento: plantilla?.nombre || 'Sin nombre',
        contenido_legal: plantilla?.texto || '', // Cambiado de 'contenido' a 'texto'
        creado_por: `${pro?.nombre} ${pro?.apellido}`,
        firma_paciente: 'Pendiente',
        firma_profesional: 'Pendiente',
        fecha_creacion: new Date().toISOString()
      };


      const { data, error } = await supabase
        .from('paciente_consentimientos')
        .insert([nuevoRegistro])
        .select()
        .single();


      if (error) throw error;


      toast.success("¡Registro legal generado exitosamente!");
      setModalAbierto(false);
      setForm({ tipo_id: '', presupuesto_id: '', especialista_id: '' });
      fetchData(); 


    } catch (error: any) {
      console.error("Error Supabase:", error);
      toast.error("Error: " + error.message);
    } finally {
      setCreando(false);
    }
  }


  async function eliminarDocumento(id: string) {
    if (!confirm("¿Deseas eliminar este registro permanentemente?")) return;
    try {
      const { error } = await supabase.from('paciente_consentimientos').delete().eq('id', id);
      if (error) throw error;
      toast.success("Eliminado");
      fetchData();
    } catch (e) {
      toast.error("Error al eliminar");
    }
  }


  if (cargando) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#D4AF37]" size={40} />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">AureoDent está cargando...</p>
    </div>
  )


  return (
    <main className="p-8 max-w-7xl mx-auto space-y-8 font-sans pb-20 text-left">
      
      {/* Header */}
      <header className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-left">
        <div className="flex items-center gap-6 text-left">
          <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl"><FileSignature size={32} /></div>
          <div className="text-left">
            <h1 className="text-2xl font-black text-slate-800 uppercase italic leading-none">Consentimientos</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Gestión Legal Áurea</p>
          </div>
        </div>
        <button 
          onClick={() => setModalAbierto(true)} 
          className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center gap-3 active:scale-95"
        >
          <Plus size={18} /> Generar Registro
        </button>
      </header>


      {/* Tabla */}
      <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Documento</th>
              <th className="px-6 py-6 text-center">Especialista</th>
              <th className="px-6 py-6 text-center">Estado</th>
              <th className="px-10 py-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {consentimientosEmitidos.length === 0 ? (
                <tr>
                    <td colSpan={4} className="py-24 text-center text-slate-300 font-black uppercase italic text-xs tracking-widest">
                        No hay registros en la bitácora
                    </td>
                </tr>
            ) : (
              consentimientosEmitidos.map((doc) => (
                <tr key={doc.id} className="hover:bg-blue-50/30 transition-all group">
                  <td className="px-10 py-7">
                      <p className="text-sm font-black text-slate-800 uppercase italic leading-none">{doc.nombre_consentimiento}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1.5">{new Date(doc.fecha_creacion).toLocaleDateString('es-CL')}</p>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-4 py-2 rounded-xl border uppercase">
                      {doc.creado_por}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {doc.firma_paciente === 'Firmado'
                          ? <><CheckCircle2 size={18} className="text-emerald-500" /> <span className="text-[9px] font-black text-emerald-600 uppercase">Firmado</span></>
                          : <><Clock size={18} className="text-orange-400" /> <span className="text-[9px] font-black text-orange-500 uppercase">Pendiente</span></>}
                      </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/pacientes/${pacienteId}/consentimientos/${doc.id}`} className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><ChevronRight size={20} /></Link>
                      <button onClick={() => eliminarDocumento(doc.id)} className="w-12 h-12 bg-red-50 text-red-400 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


      {/* Modal Integrado */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalAbierto(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl relative overflow-hidden z-[1000] p-10 space-y-8 text-left">
                <div className="flex justify-between items-start text-left">
                  <div className="text-left">
                    <h3 className="text-xl font-black text-slate-800 uppercase italic">Nuevo Registro</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">AureoDent Legal System</p>
                  </div>
                  <button onClick={() => setModalAbierto(false)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-red-500 transition-all"><X size={20}/></button>
                </div>


                <div className="space-y-6 text-left">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Plantilla de Consentimiento</label>
                    <select value={form.tipo_id} onChange={(e) => setForm({...form, tipo_id: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:border-blue-500 outline-none font-bold text-xs text-slate-700">
                      <option value="">Selecciona plantilla...</option>
                      {tiposConsentimientos.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                    </select>
                  </div>


                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Especialista</label>
                    <select value={form.especialista_id} onChange={(e) => setForm({...form, especialista_id: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:border-blue-500 outline-none font-bold text-xs text-slate-700">
                      <option value="">Selecciona especialista...</option>
                      {profesionales.map(p => <option key={p.user_id} value={p.user_id}>{p.nombre.toUpperCase()} {p.apellido.toUpperCase()}</option>)}
                    </select>
                  </div>


                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Presupuesto (Opcional)</label>
                    <select value={form.presupuesto_id} onChange={(e) => setForm({...form, presupuesto_id: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:border-blue-500 outline-none font-bold text-xs text-slate-700">
                      <option value="">Sin presupuesto asociado</option>
                      {presupuestos.map(pr => <option key={pr.id} value={pr.id}>{pr.nombre_tratamiento.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>


                <button 
                  onClick={handleCrearConsentimiento} 
                  disabled={creando} 
                  className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {creando ? <Loader2 className="animate-spin" size={18} /> : <FileCheck size={18} />}
                  {creando ? 'Generando...' : 'Crear Documento Legal'}
                </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}


