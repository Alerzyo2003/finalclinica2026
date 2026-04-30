'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { crearCuentaStaff, actualizarCuentaStaff, eliminarCuentaStaff } from '../actions' 
import { 
  Plus, Search, Lock, Trash2, Stethoscope, X, Save, 
  Loader2, UserCircle, KeyRound, UserCog, ShieldCheck, AtSign, Fingerprint
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function GestionStaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [especialidades, setEspecialidades] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [editandoUser, setEditandoUser] = useState<any>(null)
  const [busqueda, setBusqueda] = useState('')

  const initialState = { 
    nombre: '', 
    apellido: '', 
    rut: '',
    username: '', 
    password: '', 
    especialidad_id: '', 
    rol: 'DENTISTA' 
  }
  const [form, setForm] = useState(initialState)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setCargando(true)
    try {
      const { data: perfiles } = await supabase.from('perfiles').select('*').order('rol')
      const { data: esps } = await supabase.from('especialidades').select('*').order('nombre')
      const { data: profs } = await supabase.from('profesionales').select('user_id, especialidades(nombre)')
      
      if (perfiles) {
          const staffMapeado = perfiles.map(p => {
              // Buscamos el registro en la tabla profesionales para obtener la especialidad
              const profData = profs?.find(pr => pr.user_id === p.id);
              
              // Aplicamos casting 'as any' para evitar el error de TypeScript en el build de Vercel
              const nombreEspecialidad = (profData?.especialidades as any)?.nombre;

              return {
                  ...p,
                  especialidad: nombreEspecialidad || 'Área Administrativa'
              }
          })
          setStaff(staffMapeado)
      }
      if (esps) setEspecialidades(esps)
    } catch (error) {
      console.error("Error al cargar datos:", error)
    } finally {
      setCargando(false)
    }
  }

  const handleGuardar = async () => {
    if (guardando) return;
    const esNuevo = !editandoUser;
    
    if (!form.nombre.trim() || !form.apellido.trim() || !form.rut.trim()) {
        return toast.error("Nombre, Apellido y RUT son obligatorios");
    }

    if (esNuevo) {
        if (!form.username.trim()) return toast.error("El usuario es obligatorio");
        if (!form.password.trim()) return toast.error("La contraseña es obligatoria");
        const usernameRegex = /^[a-z0-9.]+$/;
        if (!usernameRegex.test(form.username)) {
            return toast.error("Usuario: solo minúsculas, números y puntos.");
        }
    }

    setGuardando(true);
    const toastId = toast.loading(esNuevo ? "Generando credenciales..." : "Actualizando...");

    try {
      const res = editandoUser 
        ? await actualizarCuentaStaff(editandoUser.id, editandoUser.id, form)
        : await crearCuentaStaff(form);
      
      if (res.error) throw new Error(res.error);

      toast.success(esNuevo ? "Acceso creado" : "Datos actualizados", { id: toastId });
      setModalAbierto(false); 
      fetchData(); 
      resetForm();
    } catch (error: any) { 
      toast.error("Error: " + error.message, { id: toastId });
    } finally { 
      setGuardando(false);
    }
  }

  const abrirEditor = (persona: any) => {
    setEditandoUser(persona)
    const nombres = (persona.nombre_completo || '').split(' ');
    setForm({ 
        ...initialState, 
        nombre: nombres[0] || '', 
        apellido: nombres.slice(1).join(' ') || '', 
        rut: persona.rut || '',
        rol: persona.rol,
        username: persona.username || '', 
        especialidad_id: '' 
    })
    setModalAbierto(true)
  }

  const resetForm = () => { 
    setEditandoUser(null); 
    setForm(initialState);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl">
              <UserCog size={32} />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black text-slate-800 uppercase italic leading-none">Equipo Clínico</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Seguridad y Personal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="text" 
                placeholder="Filtrar por nombre..." 
                className="pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold w-full outline-none shadow-inner text-slate-900"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { resetForm(); setModalAbierto(true); }} 
              className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase hover:bg-slate-900 transition-all shadow-xl flex items-center gap-2"
            >
              <Plus size={18} /> Nuevo Staff
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff
            .filter(p => (p.nombre_completo || '').toLowerCase().includes(busqueda.toLowerCase()))
            .map(persona => (
                <motion.div 
                    key={persona.id} 
                    whileHover={{ y: -5 }} 
                    onClick={() => abrirEditor(persona)} 
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm cursor-pointer group relative overflow-hidden text-left"
                >
                    <div className={`absolute top-0 right-0 p-4 text-[8px] font-black uppercase tracking-widest rounded-bl-2xl ${
                        persona.rol === 'ADMIN' ? 'bg-red-500 text-white' : 
                        persona.rol === 'DENTISTA' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                        {persona.rol}
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                        persona.rol === 'DENTISTA' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                        {persona.rol === 'DENTISTA' ? <Stethoscope size={28}/> : <UserCircle size={28}/>}
                    </div>
                    <h3 className="text-lg font-black text-slate-800 uppercase leading-none">{persona.nombre_completo}</h3>
                    
                    <div className="space-y-1 mt-3">
                      <div className="flex items-center gap-2">
                        <AtSign size={10} className="text-blue-500"/>
                        <p className="text-slate-400 text-[10px] font-bold">{persona.username || 'sin_usuario'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Fingerprint size={10} className="text-slate-400"/>
                        <p className="text-slate-400 text-[10px] font-bold uppercase">RUT: {persona.rut || 'No reg.'}</p>
                      </div>
                    </div>

                    <p className="text-slate-300 text-[9px] font-black uppercase mt-4 tracking-tighter">
                        {persona.especialidad || 'Área Administrativa'}
                    </p>
                </motion.div>
            ))}
        </div>
      </div>

      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999999] flex justify-end items-start p-4">
            <div className="absolute inset-0" onClick={() => !guardando && setModalAbierto(false)} />

            <motion.div 
              initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
              className="bg-white w-full max-w-lg mt-24 rounded-[3rem] shadow-2xl flex flex-col relative z-10 overflow-hidden h-[calc(100vh-140px)]"
            >
              <div className="p-10 flex justify-between items-center border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">
                    {editandoUser ? 'Editar Perfil' : 'Nuevo Staff'}
                </h2>
                <button onClick={() => setModalAbierto(false)} className="p-4 bg-white shadow-lg border border-slate-100 rounded-2xl text-slate-400 hover:text-red-500 transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 p-10 space-y-6 overflow-y-auto text-left">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase italic ml-3 flex items-center gap-2">
                    <ShieldCheck size={12}/> Tipo de Cuenta
                  </label>
                  <select 
                    className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold border-none shadow-inner outline-none text-slate-900" 
                    value={form.rol} 
                    onChange={(e) => setForm({...form, rol: e.target.value})}
                  >
                    <option value="DENTISTA">Dentista / Especialista</option>
                    <option value="RECEPCIONISTA">Recepcionista</option>
                    <option value="ADMIN">Administrador General</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nombre" value={form.nombre} onChange={(v:any) => setForm({...form, nombre: v})} icon={<UserCircle size={14}/>} />
                  <Input label="Apellido" value={form.apellido} onChange={(v:any) => setForm({...form, apellido: v})} icon={<UserCircle size={14}/>} />
                </div>

                <Input 
                  label="RUT del Profesional" 
                  placeholder="12.345.678-9"
                  value={form.rut} 
                  onChange={(v:any) => setForm({...form, rut: v})} 
                  icon={<Fingerprint size={14}/>} 
                />

                {!editandoUser && (
                  <div className="space-y-4 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase italic flex items-center gap-2 mb-2 text-left"><KeyRound size={12}/> Credenciales</p>
                    <Input label="Usuario ID" value={form.username} icon={<AtSign size={14}/>} onChange={(v:any) => setForm({...form, username: v.toLowerCase().replace(/\s+/g, '')})} />
                    <Input label="Contraseña" value={form.password} type="password" icon={<Lock size={14}/>} onChange={(v:any) => setForm({...form, password: v})} />
                  </div>
                )}

                {form.rol === 'DENTISTA' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase italic ml-3 flex items-center gap-2">
                        <Stethoscope size={12}/> Especialidad
                    </label>
                    <select 
                      className="w-full bg-slate-50 p-5 rounded-2xl text-xs font-bold border-none shadow-inner outline-none text-slate-900" 
                      value={form.especialidad_id} 
                      onChange={(e) => setForm({...form, especialidad_id: e.target.value})}
                    >
                      <option value="">Seleccionar...</option>
                      {especialidades.map(esp => <option key={esp.id} value={esp.id}>{esp.nombre}</option>)}
                    </select>
                  </div>
                )}

                {editandoUser && (
                  <div className="pt-6 border-t border-slate-100">
                    <button onClick={() => { setModalAbierto(false); toast.promise(eliminarCuentaStaff(editandoUser.id), { loading: 'Eliminando...', success: () => { fetchData(); return 'Staff eliminado'; }, error: 'Error' }); }} className="w-full p-5 bg-red-50 text-red-500 font-black text-[10px] uppercase hover:bg-red-500 hover:text-white rounded-3xl transition-all flex items-center justify-center gap-2">
                      <Trash2 size={16}/> Eliminar accesos permanentemente
                    </button>
                  </div>
                )}
              </div>

              <div className="p-10 border-t bg-white">
                <button onClick={handleGuardar} disabled={guardando} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300">
                  {guardando ? <Loader2 className="animate-spin" /> : <Save size={18}/>}
                  {editandoUser ? 'Guardar Cambios' : 'Generar Credenciales'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Input({ label, value, onChange, icon, type = "text", placeholder = "" }: any) {
  return (
    <div className="space-y-2 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase italic ml-3 flex items-center gap-2">{icon} {label}</label>
      <input 
        type={type} 
        value={value || ''} 
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} 
        className="w-full bg-white p-5 rounded-2xl text-xs font-bold outline-none border border-slate-100 shadow-sm focus:ring-2 ring-blue-500/10 text-slate-900" 
      />
    </div>
  )
}
