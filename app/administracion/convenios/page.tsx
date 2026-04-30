'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Building2, Plus, Search, FileText, Trash2, 
  ChevronRight, Save, X, Info, CheckCircle2, 
  Loader2, Settings2, Edit3, MapPin, Phone, Mail, User
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ConveniosPage() {
  const [convenios, setConvenios] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const initialState = {
    nombre_empresa: '',
    nombre_convenio: '',
    rut: '',
    telefono_1: '',
    telefono_2: '',
    ciudad: '',
    comuna: '',
    direccion: '',
    email: '',
    persona_contacto: '',
    observacion: '',
    estado: 'Habilitado',
    visibilidad: 'Público',
    descuento_planilla: false,
    arancel_id: 'Arancel base',
    porcentaje_descuento: 0,
    descuento_laboratorios: false,
    descuento_otras_categorias: false
  }

  const [form, setForm] = useState(initialState)

  useEffect(() => {
    fetchConvenios()
  }, [])

  async function fetchConvenios() {
    setCargando(true)
    const { data } = await supabase.from('convenios').select('*').order('nombre_empresa')
    if (data) setConvenios(data)
    setCargando(false)
  }

  const abrirEditor = (conv: any) => {
    setEditandoId(conv.id)
    setForm({ ...conv })
    setModalAbierto(true)
  }

  const handleGuardar = async () => {
    if (!form.nombre_empresa || !form.nombre_convenio) {
      return alert("Nombre de empresa y convenio son obligatorios.")
    }
    setGuardando(true)
    try {
      if (editandoId) {
        const { error } = await supabase.from('convenios').update(form).eq('id', editandoId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('convenios').insert([form])
        if (error) throw error
      }
      setModalAbierto(false)
      fetchConvenios()
      resetForm()
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminarConvenio = async () => {
    if (!confirm("¿Eliminar este convenio permanentemente?")) return
    const { error } = await supabase.from('convenios').delete().eq('id', editandoId)
    if (!error) {
      setModalAbierto(false)
      fetchConvenios()
      resetForm()
    }
  }

  const resetForm = () => {
    setEditandoId(null)
    setForm(initialState)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex justify-between items-center text-left">
          <div className="text-left">
            <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none flex items-center gap-4 text-left">
              <Building2 className="text-blue-600" size={32} /> Convenios
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-3 text-left">Gestión de alianzas y beneficios</p>
          </div>
          <button 
            onClick={() => { resetForm(); setModalAbierto(true); }}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center gap-2"
          >
            <Plus size={18}/> Crear Convenio
          </button>
        </div>

        {/* LISTADO */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {convenios.map(conv => (
            <motion.div 
              key={conv.id} whileHover={{ y: -5 }} onClick={() => abrirEditor(conv)}
              className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-blue-400 transition-all group cursor-pointer text-left"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Building2 size={20}/>
                </div>
                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${conv.estado === 'Habilitado' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {conv.estado}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase leading-tight text-left">{conv.nombre_empresa}</h3>
              <p className="text-blue-500 text-[10px] font-bold uppercase tracking-widest mt-1 text-left">{conv.nombre_convenio}</p>
              
              <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                <p className="text-[10px] text-slate-400 flex items-center gap-2 font-bold uppercase tracking-tighter text-left">
                  <MapPin size={12}/> {conv.comuna || 'Sin comuna'}, {conv.ciudad || 'Sin ciudad'}
                </p>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Dto: {conv.porcentaje_descuento}%</p>
                  <Edit3 size={14} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* MODAL INTEGRAL */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col text-left"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-800 uppercase italic text-left">
                  {editandoId ? 'Editar Parámetros de Convenio' : 'Nuevo Convenio Corporativo'}
                </h2>
                <button onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar text-left">
                
                {/* 1. DATOS DE CONTACTO */}
                <section className="space-y-6">
                  <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2 text-left">
                    <User size={14}/> Ficha de Contacto y Ubicación
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input label="Nombre Empresa" value={form.nombre_empresa} onChange={(v: any) => setForm({...form, nombre_empresa: v})} />
                    <Input label="Nombre Convenio" value={form.nombre_convenio} onChange={(v: any) => setForm({...form, nombre_convenio: v})} />
                    <Input label="RUT" value={form.rut} onChange={(v: any) => setForm({...form, rut: v})} />
                    <Input label="E-Mail" value={form.email} icon={<Mail size={12}/>} onChange={(v: any) => setForm({...form, email: v})} />
                    <Input label="Teléfono 1" value={form.telefono_1} onChange={(v: any) => setForm({...form, telefono_1: v})} />
                    <Input label="Teléfono 2" value={form.telefono_2} onChange={(v: any) => setForm({...form, telefono_2: v})} />
                    <Input label="Ciudad" value={form.ciudad} onChange={(v: any) => setForm({...form, ciudad: v})} />
                    <Input label="Comuna" value={form.comuna} onChange={(v: any) => setForm({...form, comuna: v})} />
                    <Input label="Dirección" value={form.direccion} icon={<MapPin size={12}/>} onChange={(v: any) => setForm({...form, direccion: v})} />
                    <Input label="Persona de Contacto" value={form.persona_contacto} onChange={(v: any) => setForm({...form, persona_contacto: v})} />
                    <div className="md:col-span-2 text-left">
                      <Input label="Observación" value={form.observacion} onChange={(v: any) => setForm({...form, observacion: v})} />
                    </div>
                  </div>
                </section>

                {/* 2. REGLAS COMERCIALES */}
                <section className="space-y-6 bg-slate-50 p-10 rounded-[3rem] border border-slate-100 shadow-inner text-left">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 text-left">
                    <Settings2 size={14}/> Configuración de Arancel y Descuentos
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 text-left">Arancel de Precios</label>
                      <select 
                        className="w-full bg-white p-5 rounded-2xl text-xs font-bold border-none outline-none shadow-sm text-slate-900"
                        value={form.arancel_id}
                        onChange={(e) => setForm({...form, arancel_id: e.target.value})}
                      >
                        <option>Arancel base</option>
                        <option>Biodentine recubrimiento</option>
                        <option>PROMOCION LIMPIEZAS JUNIO</option>
                        <option>ALL ON 6</option>
                      </select>
                    </div>

                    <div className="space-y-3 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 text-left">Descuento (%)</label>
                      <select 
                        className="w-full bg-white p-5 rounded-2xl text-xs font-bold border-none outline-none shadow-sm text-slate-900"
                        value={form.porcentaje_descuento}
                        onChange={(e) => setForm({...form, porcentaje_descuento: parseInt(e.target.value)})}
                      >
                        {[...Array(101)].map((_, i) => <option key={i} value={i}>{i}%</option>)}
                      </select>
                    </div>

                    <div className="space-y-3 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 text-left">Estado / Visibilidad</label>
                      <div className="grid grid-cols-2 gap-2 text-left">
                        <select 
                          className="bg-white p-4 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm text-slate-900"
                          value={form.estado} onChange={(e) => setForm({...form, estado: e.target.value})}
                        >
                          <option value="Habilitado">Habilitado</option>
                          <option value="Deshabilitado">Deshabilitado</option>
                        </select>
                        <select 
                          className="bg-white p-4 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm text-slate-900"
                          value={form.visibilidad} onChange={(e) => setForm({...form, visibilidad: e.target.value})}
                        >
                          <option value="Público">Público</option>
                          <option value="Privado">Privado</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                    <Toggle label="Descuento planilla" active={form.descuento_planilla} onClick={() => setForm({...form, descuento_planilla: !form.descuento_planilla})} />
                    <Toggle label="Dto. Laboratorio" active={form.descuento_laboratorios} onClick={() => setForm({...form, descuento_laboratorios: !form.descuento_laboratorios})} />
                    <Toggle label="Dto. Categorías Otros" active={form.descuento_otras_categorias} onClick={() => setForm({...form, descuento_otras_categorias: !form.descuento_otras_categorias})} />
                  </div>
                </section>
              </div>

              {/* ACCIONES */}
              <div className="p-8 bg-white border-t border-slate-100 flex justify-between items-center text-left">
                {editandoId && (
                  <button onClick={eliminarConvenio} className="px-8 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all flex items-center gap-2">
                    <Trash2 size={16}/> Eliminar Convenio
                  </button>
                )}
                <div className="flex gap-4 ml-auto text-left">
                  <button onClick={() => setModalAbierto(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase hover:text-slate-600">Cancelar</button>
                  <button onClick={handleGuardar} disabled={guardando} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center gap-3 active:scale-95">
                    {guardando ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                    {editandoId ? 'Actualizar Registro' : 'Crear Nuevo Convenio'}
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

function Input({ label, value, onChange, icon }: any) {
  return (
    <div className="space-y-2 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic flex items-center gap-2 text-left">
        {icon} {label}
      </label>
      <input 
        type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 ring-blue-500/20 focus:bg-white transition-all shadow-inner text-slate-900"
      />
    </div>
  )
}

function Toggle({ label, active, onClick }: any) {
  return (
    <div className="flex items-center justify-between bg-white p-5 rounded-[1.8rem] shadow-sm border border-slate-100">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{label}</span>
      <button type="button" onClick={onClick} className={`w-10 h-5 rounded-full transition-all relative ${active ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${active ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
