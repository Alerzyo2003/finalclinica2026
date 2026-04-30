'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Loader2, LogIn, ClipboardPlus, Stethoscope } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('RECEPCIONISTA')
  const [especialidadId, setEspecialidadId] = useState('')
  const [especialidades, setEspecialidades] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchEspecialidades() {
      try {
        const { data, error } = await supabase.from('especialidades').select('*').order('nombre')
        if (error) throw error
        setEspecialidades(data || [])
      } catch (error: any) {
        console.error("Error cargando especialidades:", error.message)
      }
    }
    fetchEspecialidades()
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rol === 'DENTISTA' && !especialidadId) {
      return toast.error("Por favor, selecciona tu especialidad")
    }

    setCargando(true)

    try {
      const cleanEmail = email.trim().toLowerCase()
      const cleanPassword = password.trim()

      // 1. Registro en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
      })

      if (authError) throw new Error(`Auth: ${authError.message}`)

      if (authData.user) {
        // 2. Creación/Actualización del perfil general
        const { error: profileError } = await supabase
          .from('perfiles')
          .upsert({ 
            id: authData.user.id, 
            nombre_completo: nombre.trim(), 
            rol: rol 
          }, { onConflict: 'id' })

        if (profileError) throw new Error(`Tabla Perfiles: ${profileError.message}`)

        // 3. Registro Profesional (Solo si es DENTISTA)
        if (rol === 'DENTISTA') {
          const partesNombre = nombre.trim().split(' ')
          const nombreSolo = partesNombre[0]
          const apellidoSolo = partesNombre.slice(1).join(' ') || ' '

          const { error: proError } = await supabase
            .from('profesionales')
            .upsert({
              user_id: authData.user.id,
              nombre: nombreSolo,
              apellido: apellidoSolo,
              especialidad_id: especialidadId,
              activo: true
            }, { onConflict: 'user_id' })
          
          if (proError) throw new Error(`Tabla Profesionales: ${proError.message}`)
        }

        toast.success("¡Cuenta configurada exitosamente!")
        // Pequeña pausa para que el usuario vea el toast antes de redirigir
        setTimeout(() => {
          router.push('/login')
        }, 1500)
      }
    } catch (err: any) {
      console.error("DETALLE DEL ERROR:", err)
      toast.error(err.message || "Error al crear la cuenta")
      setCargando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-900 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-[3rem] p-12 max-md:p-8 shadow-2xl border border-slate-100 text-left"
      >
        
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-blue-600 p-4 rounded-3xl text-white mb-4 shadow-xl shadow-blue-200">
            <ClipboardPlus size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter text-center leading-tight">Únete a DentaPro</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-1 text-center">Configuración de cuenta nueva</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-5 text-left">
          <div className="space-y-4 text-left">
            <input 
              type="text" 
              placeholder="Nombre completo" 
              className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 transition-all font-medium text-slate-900 shadow-inner"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)} 
              required 
            />
            
            <input 
              type="email" 
              placeholder="Correo electrónico" 
              className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 transition-all font-medium text-slate-900 shadow-inner"
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            
            <input 
              type="password" 
              placeholder="Contraseña (mín. 6 caracteres)" 
              className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 transition-all font-medium text-slate-900 shadow-inner"
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />

            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest text-left">Tipo de acceso</label>
              <select 
                className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 ring-blue-500/20 transition-all font-bold text-slate-700 shadow-inner appearance-none cursor-pointer"
                value={rol} 
                onChange={(e) => setRol(e.target.value)}
              >
                <option value="RECEPCIONISTA">Recepcionista / Secretaria</option>
                <option value="DENTISTA">Odontólogo / Especialista</option>
                <option value="ADMIN">Administrador (Control total)</option>
              </select>
            </div>

            <AnimatePresence>
              {rol === 'DENTISTA' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden text-left"
                >
                  <label className="text-[10px] font-black text-blue-600 uppercase ml-2 tracking-widest flex items-center gap-1 text-left">
                    <Stethoscope size={10} /> Especialidad Médica
                  </label>
                  <select 
                    required
                    className="w-full p-4 bg-blue-50 border-none rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all font-bold text-blue-900 appearance-none cursor-pointer"
                    value={especialidadId} 
                    onChange={(e) => setEspecialidadId(e.target.value)}
                  >
                    <option value="">Selecciona tu área...</option>
                    {especialidades.map((esp: any) => (
                      <option key={esp.id} value={esp.id}>{esp.nombre}</option>
                    ))}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-4 pt-4 text-center">
            <button 
              type="submit"
              disabled={cargando} 
              className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-blue-100 flex justify-center items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-slate-300"
            >
              {cargando ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
              {cargando ? 'Sincronizando...' : 'Crear mi Cuenta'}
            </button>

            <Link href="/login" className="w-full bg-white text-slate-500 py-4 rounded-2xl font-bold text-sm border-2 border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all flex justify-center items-center gap-2">
              <LogIn size={18} /> Ya tengo cuenta, ir al Login
            </Link>
          </div>
        </form>
      </motion.div>
    </main>
  )
}
