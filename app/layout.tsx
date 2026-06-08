'use client'
import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { 
  Search, Calendar, Users, Briefcase, BarChart3, LogOut,
  LayoutGrid, Stethoscope, Package, Beaker, Calculator,
  DoorOpen, BadgeDollarSign, Library, FileSignature, Ban,
  FileText, TrendingUp, FileSpreadsheet, ChevronRight,
  Loader2, User, UserCheck, Building2
} from 'lucide-react'
import Link from 'next/link'
import './globals.css'
import ChatGlobal from '@/components/ChatEnVivo' // 🔥 Asegúrate de mantener tu Chat Global

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const isAuthPage = pathname === '/login' || pathname === '/register'
  
  const [session, setSession] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarResultados, setMostrarResultados] = useState(false)

  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const [showReportMenu, setShowReportMenu] = useState(false)
  
  const searchRef = useRef<HTMLDivElement>(null)
  const adminMenuRef = useRef<HTMLDivElement>(null)
  const reportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // --- LÓGICA DE NOTIFICACIONES ---
  useEffect(() => {
    if (!mounted || !session?.user?.id || !perfil) return;

    const canalNotificaciones = supabase
      .channel(`dentista-${session.user.id}`)
      .on('broadcast', { event: 'PACIENTE_LLEGO' }, (payload: any) => {
        toast.info("¡PACIENTE EN ESPERA!", {
          description: `El paciente ${payload.payload.nombre} acaba de llegar.`,
          duration: 10000,
          icon: <UserCheck className="text-blue-500" />,
        });
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(canalNotificaciones); }
  }, [session, perfil, mounted]);

  // --- CLIC FUERA ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) setShowAdminMenu(false)
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target as Node)) setShowReportMenu(false)
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setMostrarResultados(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- BÚSQUEDA AVANZADA ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (busqueda.length > 2) ejecutarBusqueda(busqueda)
      else { setResultados([]); setMostrarResultados(false); }
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [busqueda])

  async function ejecutarBusqueda(term: string) {
    setBuscando(true)
    setMostrarResultados(true)

    const palabras = term.trim().split(/\s+/)
    let query = supabase.from('pacientes').select('id, nombre, apellido, rut')

    palabras.forEach(palabra => {
      const fuzzy = `%${palabra.split('').join('%')}%`
      const palabraRut = palabra.replace(/[^0-9kK]/gi, '').toUpperCase()
      
      if (palabraRut.length > 0) {
        query = query.or(`nombre.ilike.${fuzzy},apellido.ilike.${fuzzy},rut.ilike.%${palabraRut}%`)
      } else {
        query = query.or(`nombre.ilike.${fuzzy},apellido.ilike.${fuzzy}`)
      }
    })

    const { data } = await query.limit(6)
    setResultados(data || [])
    setBuscando(false)
  }

  // --- SESIÓN ---
  useEffect(() => {
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        setSession(currentSession)
        const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle()
        setPerfil(data)
      } else {
        setSession(null)
        setPerfil(null)
      }
    }
    getUserData()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) setPerfil(null)
      else getUserData()
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 🔥 AQUÍ AGREGAMOS AL ASISTENTE Y EL INVENTARIO DIRECTO 🔥
  const modulos = [
    { href: '/agenda', label: 'Agenda', icon: <Calendar size={16}/>, roles: ['ADMIN', 'RECEPCIONISTA', 'DENTISTA', 'ASISTENTE'] },
    { href: '/pacientes', label: 'Pacientes', icon: <Users size={16}/>, roles: ['ADMIN', 'RECEPCIONISTA', 'DENTISTA', 'ASISTENTE'] },
    { href: '/cajas', label: 'Cajas', icon: <Briefcase size={16}/>, roles: ['ADMIN', 'RECEPCIONISTA'] },
    // Módulo extra para que el asistente tenga acceso rápido al stock
  ]

  if (!mounted) return <html lang="es"><body></body></html>

  return (
    <html lang="es">
      <body className="bg-slate-50 min-h-screen font-sans antialiased text-slate-800 text-left print:block print:h-auto">
        <Toaster richColors position="top-right" />

        {!isAuthPage && session && (
          <div className="relative z-[100] flex flex-col print:hidden shadow-sm">
            
            <header className="w-full h-20 bg-slate-950 text-white flex items-center justify-between px-8 border-b border-white/5">
              <div className="flex items-center gap-12 text-left">
                <Link href="/" className="flex items-center gap-4 group transition-all text-left">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg group-hover:scale-105 transition-transform">
                      <img src="https://yqdpmaopnvrgdqbfaiok.supabase.co/storage/v1/object/public/documentos_imagenes/440749454_122171956712064634_7168698893214813270_n.jpg" alt="Logo" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full"></div>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] leading-none mb-1.5 opacity-80 text-left">Centro Médico</span>
                    <span className="text-2xl font-black tracking-tighter uppercase italic leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 text-left">Dignidad</span>
                  </div>
                </Link>

                <div className="relative hidden xl:block" ref={searchRef}>
                  <div className="relative">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${buscando ? 'text-blue-500' : 'text-slate-500'}`} size={16} />
                    <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente o RUT..." className="w-[450px] bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 text-xs text-slate-100 outline-none focus:bg-white/10 transition-all font-medium" />
                    {buscando && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={16} />}
                  </div>
                  <AnimatePresence>
                    {mostrarResultados && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-[115%] left-0 w-full bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 z-[150] text-slate-900 text-left">
                        {resultados.length > 0 ? (
                          <div className="flex flex-col gap-1 text-left">
                            {resultados.map((p) => (
                              <button key={p.id} onClick={() => { router.push(`/pacientes/${p.id}`); setMostrarResultados(false); setBusqueda(''); }} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-all text-left w-full">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><User size={14}/></div>
                                  <div className="text-left">
                                    <p className="text-xs font-black uppercase text-left">{p.nombre} {p.apellido}</p>
                                    <p className="text-[9px] font-bold text-slate-400 text-left">{p.rut}</p>
                                  </div>
                                </div>
                                <ChevronRight size={14} className="text-slate-300" />
                              </button>
                            ))}
                          </div>
                        ) : ( <div className="p-8 text-center text-slate-400 text-xs italic">Sin resultados</div> )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-4 text-left">
                <div className="flex items-center gap-3 bg-white/5 pl-4 pr-2 py-1.5 rounded-full border border-white/10 text-left">
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[11px] font-black text-slate-100 uppercase tracking-tight">{perfil?.nombre_completo || 'Usuario'}</span>
                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{perfil?.rol || 'Dignidad'}</span>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white">{perfil?.nombre_completo?.[0] || 'U'}</div>
                  <button onClick={handleSignOut} className="p-2 text-slate-500 hover:text-red-400 transition-all"><LogOut size={18} /></button>
                </div>
              </div>
            </header>

            <nav className="w-full h-14 bg-white border-b border-slate-200 flex items-center px-8 gap-10">
              {modulos.filter(m => m.roles.includes(perfil?.rol)).map((m) => (
                <ModuleLink key={m.href} href={m.href} label={m.label} icon={m.icon} active={pathname.startsWith(m.href)} />
              ))}

              {perfil?.rol === 'ADMIN' && (
                <>
                  <div className="relative h-full" ref={reportMenuRef}>
                    <button onClick={() => setShowReportMenu(!showReportMenu)} className={`flex items-center gap-2 px-1 h-full border-b-2 transition-all ${showReportMenu || pathname.startsWith('/reportes') ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-400'}`}>
                      <BarChart3 size={18} /> <span className="text-[11px] font-black uppercase tracking-wider">Reportes</span>
                    </button>
                    <AnimatePresence>
                      {showReportMenu && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-[100%] left-0 bg-white shadow-2xl rounded-[2rem] border border-slate-100 p-4 z-[110] w-[260px] mt-1 text-left">
                          <MenuOption href="/reportes/desempeno" label="Desempeño" icon={<TrendingUp size={14}/>} onClick={() => setShowReportMenu(false)} />
                          <MenuOption href="/reportes/excel" label="Excel" icon={<FileSpreadsheet size={14}/>} onClick={() => setShowReportMenu(false)} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative h-full" ref={adminMenuRef}>
                    <button onClick={() => setShowAdminMenu(!showAdminMenu)} className={`flex items-center gap-2 px-1 h-full border-b-2 transition-all ${showAdminMenu || pathname.startsWith('/administracion') ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-400'}`}>
                      <LayoutGrid size={18} /> <span className="text-[11px] font-black uppercase tracking-wider">Administración</span>
                    </button>
                    <AnimatePresence>
                      {showAdminMenu && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-[100%] left-0 bg-white shadow-2xl rounded-[2.5rem] border border-slate-100 p-8 z-[110] w-[850px] mt-1 grid grid-cols-3 gap-8 text-left">
                          
                          {/* COLUMNA 1: GESTIÓN CLÍNICA */}
                          <div className="space-y-2 text-left">
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-4 pl-2">Gestión Clínica</p>
                            <MenuOption href="/administracion/profesionales" label="Personal" icon={<Users size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/especialidades" label="Especialidades" icon={<Stethoscope size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/convenios" label="Convenios" icon={<Building2 size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/box" label="Gestión de Box" icon={<DoorOpen size={12}/>} onClick={() => setShowAdminMenu(false)} />
                          </div>

                          {/* COLUMNA 2: OPERACIONES */}
                          <div className="space-y-2 text-left">
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-4 pl-2">Operaciones</p>                            <MenuOption href="/administracion/laboratorios" label="Laboratorios" icon={<Beaker size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/liquidaciones" label="Liquidaciones" icon={<Calculator size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/configuracion/pagos-pendientes" label="Pagos Pendientes" icon={<Ban size={12}/>} onClick={() => setShowAdminMenu(false)} />
                          </div>

                          {/* COLUMNA 3: CONFIGURACIÓN MAESTRO */}
                          <div className="space-y-2 text-left">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Configuración Maestro</p>
                            <MenuOption href="/administracion/configuracion/aranceles" label="Aranceles Precios" icon={<BadgeDollarSign size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/configuracion/bancos" label="Bancos / Entidades" icon={<Library size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/configuracion/documentos" label="Docs Clínicos" icon={<FileText size={12}/>} onClick={() => setShowAdminMenu(false)} />
                            <MenuOption href="/administracion/configuracion/consentimientos" label="Consentimientos" icon={<FileSignature size={12}/>} onClick={() => setShowAdminMenu(false)} />
                          </div>

                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </nav>
          </div>
        )}

        <main className="flex-1 w-full bg-slate-50 relative z-0 print:bg-white print:overflow-visible">
          {children}
        </main>

        {/* 🔥 Chat Global Integrado 🔥 */}
        {!isAuthPage && session && (
          <ChatGlobal session={session} />
        )}
      </body>
    </html>
  )
}

function MenuOption({ href, label, icon, onClick }: any) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-all group text-left border border-transparent hover:border-slate-100">
      <div className="p-2.5 bg-slate-100 rounded-xl text-slate-400 group-hover:bg-blue-600 group-hover:text-white shrink-0 shadow-sm transition-all">{icon}</div>
      <span className="text-[10px] font-black uppercase text-slate-600 group-hover:text-slate-900 transition-colors leading-tight">{label}</span>
    </Link>
  )
}

function ModuleLink({ href, label, icon, active }: any) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-1 h-full border-b-2 transition-all ${active ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
      {icon} <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
    </Link>
  )
}