'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import SignatureCanvas from 'react-signature-canvas'
import {
  User, Save, Loader2, Signature, Lock, KeyRound, Eye, EyeOff, Trash2, Terminal, ShieldCheck, Users, RefreshCw, X
} from 'lucide-react'
import { toast } from 'sonner'
import { useRole } from '@/app/hooks/useRole'


export default function PerfilPage() {
  const { user: currentUser, rol: hookRole } = useRole() 
  const [datos, setDatos] = useState({ nombre_completo: '' })
  const [rolLocal, setRolLocal] = useState<string | null>(null)
  const [firmaGuardada, setFirmaGuardada] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
 
  // Estados para Gestión de Usuarios (Solo Admin)
  const [listaUsuarios, setListaUsuarios] = useState<any[]>([])
  const [usuarioAEditar, setUsuarioAEditar] = useState<{id: string, nombre: string} | null>(null)
  const [passAdminReset, setPassAdminReset] = useState('')


  // Estados para contraseña propia
  const [passwords, setPasswords] = useState({ new1: '', new2: '' })
  const [showPass, setShowPass] = useState(false)
  const sigCanvas = useRef<any>(null)


  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        fetchDatosYRol(user.id)
      } else {
        setCargando(false)
      }
    }
    checkSession()
  }, [])


  async function fetchDatosYRol(userId: string) {
    try {
      setCargando(true)
      const { data: perf, error: errorPerf } = await supabase
        .from('perfiles')
        .select('rol, nombre_completo')
        .eq('id', userId)
        .maybeSingle()


      if (perf) {
        const roleFromDB = perf.rol?.toUpperCase() || 'USUARIO'
        setRolLocal(roleFromDB)
        setDatos({ nombre_completo: perf.nombre_completo || '' })


        if (roleFromDB === 'DENTISTA') {
          const { data: prof } = await supabase.from('profesionales').select('firma_base64').eq('user_id', userId).maybeSingle()
          if (prof) setFirmaGuardada(prof.firma_base64 || null)
        }


        if (roleFromDB === 'ADMIN') {
          fetchTodosLosUsuarios()
        }
      }
    } catch (err: any) {
      console.error("Error cargando perfil:", err.message)
    } finally {
      setCargando(false)
    }
  }


  async function fetchTodosLosUsuarios() {
    const { data } = await supabase.from('perfiles').select('id, nombre_completo, rol, rut').order('nombre_completo')
    if (data) setListaUsuarios(data)
  }


  const finalRole = rolLocal || hookRole?.toUpperCase()
  const esAdmin = finalRole === 'ADMIN'
  const puedeFirmar = finalRole === 'DENTISTA'


  // --- LÓGICA DE ADMIN: CAMBIAR PASS DE OTROS VÍA EDGE FUNCTION ---
  const handleAdminResetPassword = async () => {
    if (!usuarioAEditar || !passAdminReset) return toast.error("Ingresa una contraseña")
   
    setGuardando(true)
    const toastId = toast.loading(`Actualizando acceso para ${usuarioAEditar.nombre}...`)


    try {
      const { data, error } = await supabase.functions.invoke('admin-change-password', {
        body: {
          userId: usuarioAEditar.id,
          newPassword: passAdminReset
        }
      })


      if (error) throw error


      toast.success("Contraseña actualizada exitosamente", { id: toastId })
      setUsuarioAEditar(null)
      setPassAdminReset('')
    } catch (err: any) {
      console.error(err)
      toast.error("Error de seguridad: No se pudo actualizar", { id: toastId })
    } finally {
      setGuardando(false)
    }
  }


  // --- ACTUALIZAR MI PROPIA PASS ---
  const handleUpdateOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwords.new1 !== passwords.new2) return toast.error("Las contraseñas no coinciden")
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: passwords.new1 })
    if (!error) {
      toast.success("Tu contraseña ha sido actualizada")
      setPasswords({ new1: '', new2: '' })
    } else {
      toast.error(error.message)
    }
    setGuardando(false)
  }


  const guardarFirma = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return toast.error("Dibuja tu firma")
    setGuardando(true)
    const base64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png')
    const { error } = await supabase.from('profesionales').update({ firma_base64: base64 }).eq('user_id', currentUser?.id)
    if (!error) {
      setFirmaGuardada(base64)
      toast.success("Firma sincronizada")
    }
    setGuardando(false)
  }


  if (cargando) return <div className="h-screen flex flex-col items-center justify-center bg-white gap-4"><Loader2 className="animate-spin text-blue-600" size={40} /></div>


  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-20 text-left">
     
      {/* HEADER */}
      <header className="flex flex-col md:flex-row items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="w-20 h-20 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white shadow-xl shrink-0">
          <User size={32} />
        </div>
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black text-slate-900 uppercase italic leading-none">{datos.nombre_completo}</h1>
          <div className="flex items-center justify-center md:justify-start gap-2 mt-3">
            <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase px-4 py-1.5 rounded-full border border-blue-100">{finalRole}</span>
          </div>
        </div>
      </header>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SEGURIDAD PERSONAL */}
        <section className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center gap-3">
            <Lock className="text-slate-400" size={20} />
            <h2 className="text-xl font-black text-slate-800 uppercase italic">Mi Seguridad</h2>
          </div>
          <form onSubmit={handleUpdateOwnPassword} className="space-y-4">
            <input type={showPass ? "text" : "password"} required value={passwords.new1} onChange={(e) => setPasswords({...passwords, new1: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700" placeholder="Nueva Contraseña" />
            <div className="relative">
              <input type={showPass ? "text" : "password"} required value={passwords.new2} onChange={(e) => setPasswords({...passwords, new2: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700" placeholder="Repetir Nueva Contraseña" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-5 top-4 text-slate-400">{showPass ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
            </div>
            <button type="submit" disabled={guardando} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
               <KeyRound size={16}/> Cambiar mi clave
            </button>
          </form>
        </section>


        {/* FIRMA DIGITAL (DENTISTAS) */}
        {puedeFirmar && (
          <section className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-6">
            <div className="flex items-center gap-3"><Signature className="text-blue-600" size={20} /><h2 className="text-xl font-black text-slate-800 uppercase italic">Firma Médica</h2></div>
            {firmaGuardada ? (
              <div className="space-y-6 text-center">
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-8 flex items-center justify-center shadow-inner"><img src={firmaGuardada} alt="Firma" className="max-h-40 object-contain mix-blend-multiply" /></div>
                <button onClick={() => setFirmaGuardada(null)} className="w-full text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline flex items-center justify-center gap-2"><Trash2 size={14} /> Reemplazar firma</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-end"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Dibuja tu firma abajo:</p><button onClick={() => sigCanvas.current?.clear()} className="text-[9px] font-black text-blue-600 uppercase hover:underline">Limpiar</button></div>
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] h-64 overflow-hidden shadow-inner cursor-crosshair"><SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{ className: 'w-full h-full' }} /></div>
                <button onClick={guardarFirma} disabled={guardando} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3"><Save size={16}/> Guardar firma digital</button>
              </div>
            )}
          </section>
        )}
      </div>


      {/* GESTIÓN DE USUARIOS (SOLO ADMIN) */}
      {esAdmin && (
        <section className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-blue-600" size={24} />
              <h2 className="text-2xl font-black text-slate-900 uppercase italic leading-none">Gestión de Staff</h2>
            </div>
            <button onClick={fetchTodosLosUsuarios} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-blue-600 transition-all"><RefreshCw size={20} /></button>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listaUsuarios.map(u => (
              <div key={u.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col justify-between gap-4">
                <div className="text-left">
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">{u.rol}</p>
                  <h3 className="font-black text-slate-800 uppercase italic truncate">{u.nombre_completo}</h3>
                  <p className="text-[10px] font-mono text-slate-400">{u.rut || 'S/R'}</p>
                </div>
                <button
                  onClick={() => setUsuarioAEditar({id: u.id, nombre: u.nombre_completo})}
                  className="w-full py-3 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <KeyRound size={12} /> Cambiar Clave
                </button>
              </div>
            ))}
          </div>


          {/* MODAL PARA RESETEO */}
          {usuarioAEditar && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md space-y-6 relative">
                <button onClick={() => setUsuarioAEditar(null)} className="absolute right-8 top-8 text-slate-300 hover:text-red-500"><X size={20}/></button>
                <div className="text-center">
                  <h3 className="text-xl font-black text-slate-900 uppercase italic">Nueva Contraseña</h3>
                  <p className="text-[10px] font-black text-blue-600 mt-1 uppercase tracking-widest italic">{usuarioAEditar.nombre}</p>
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    autoFocus
                    value={passAdminReset}
                    onChange={(e) => setPassAdminReset(e.target.value)}
                    className="w-full p-5 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 text-center text-lg"
                    placeholder="Escribe la clave aquí"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setUsuarioAEditar(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase">Cancelar</button>
                    <button onClick={handleAdminResetPassword} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Confirmar Cambio</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}     
    </main>
  )
}

