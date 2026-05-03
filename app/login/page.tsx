'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LogIn, Loader2, UserCircle, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // URL de Supabase proporcionada
  const LOGO_URL = "https://yqdpmaopnvrgdqbfaiok.supabase.co/storage/v1/object/public/logos/logo.jpeg";
  // Color dorado elegante
  const GOLD_COLOR = "#D4AF37";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cargando) return
    
    setCargando(true)
    setError('')

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9.]/g, "");
      
      if (!cleanUsername) {
        setError('Ingrese un nombre de usuario válido')
        setCargando(false)
        return
      }

      const virtualEmail = `${cleanUsername}@dentapro.com`;

      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email: virtualEmail, 
        password 
      })

      if (authError) {
        setError('Credenciales inválidas o cuenta inexistente')
        setCargando(false)
        return
      }

      if (data?.session) {
        window.location.replace('/')
      }
    } catch (err) {
      setError('Error de comunicación con el servidor')
      setCargando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6 font-sans relative overflow-hidden text-left">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#F9F6EE] rounded-full blur-[120px] opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-100 rounded-full blur-[120px] opacity-60" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.08)] border border-slate-50 relative z-10 text-left"
      >
        
        {/* ENCABEZADO CON LOGO DE SUPABASE */}
        <div className="flex flex-col items-center mb-10 text-center">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="mb-6 overflow-hidden rounded-[2.2rem] shadow-xl border border-slate-50 w-[120px] h-[120px] bg-white flex items-center justify-center"
          >
            <img 
              src={LOGO_URL} 
              alt="Logo AureoDent" 
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error("❌ Error cargando imagen desde Supabase");
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </motion.div>
          
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Aureo<span style={{ color: GOLD_COLOR }}>Dent</span>
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <div className="h-[1px] w-8 bg-slate-200" />
            <p className="text-slate-400 font-black uppercase text-[8px] tracking-[0.5em]">Gestión Clínica Exclusiva</p>
            <div className="h-[1px] w-8 bg-slate-200" />
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-7 text-left">
          <div className="space-y-5 text-left">
            
            {/* Campo: Identificador */}
            <div className="space-y-2.5 text-left">
              <label htmlFor="username" className="text-[10px] font-black text-slate-400 ml-5 uppercase tracking-widest flex items-center gap-2 text-left">
                <UserCircle size={14} style={{ color: GOLD_COLOR }} /> Usuario del Sistema
              </label>
              <input 
                id="username"
                type="text" 
                placeholder="ej: dr.vargas" 
                className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.8rem] focus:border-[#D4AF37]/30 focus:bg-white outline-none text-slate-900 font-bold transition-all placeholder:text-slate-300 text-left"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
              />
            </div>

            {/* Campo: Contraseña */}
            <div className="space-y-2.5 text-left">
              <label htmlFor="password" className="text-[10px] font-black text-slate-400 ml-5 uppercase tracking-widest flex items-center gap-2 text-left">
                <Lock size={14} style={{ color: GOLD_COLOR }} /> Clave de Acceso
              </label>
              <input 
                id="password"
                type="password" 
                placeholder="••••••••" 
                className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.8rem] focus:border-[#D4AF37]/30 focus:bg-white outline-none text-slate-900 font-bold transition-all placeholder:text-slate-300 text-left"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-red-500 text-[10px] font-black uppercase text-center bg-red-50/50 p-4 rounded-2xl border border-red-100/50 backdrop-blur-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-4 text-left">
            <button 
              type="submit"
              disabled={cargando}
              style={{ backgroundColor: '#1a1a1a' }}
              className="w-full text-white py-6 rounded-[2.2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:opacity-90 transition-all active:scale-[0.98] flex justify-center items-center gap-3 disabled:bg-slate-100 disabled:text-slate-400 group"
            >
              {cargando ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                  <span>Entrar al Sistema</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Decoración final */}
        <div className="mt-14 flex flex-col items-center gap-5">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD_COLOR }} />
            <div className="w-8 h-1.5 bg-slate-100 rounded-full" />
          </div>
        </div>
      </motion.div>
    </main>
  )
}