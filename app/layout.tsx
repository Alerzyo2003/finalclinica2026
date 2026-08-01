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
import ChatGlobal from '@/components/ChatEnVivo'

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
  const [showMiMenu, setShowMiMenu] = useState(false)
  
  const searchRef = useRef<HTMLDivElement>(null)
  const adminMenuRef = useRef<HTMLDivElement>(null)
  const reportMenuRef = useRef<HTMLDivElement>(null)
  const miMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && (showAdminMenu || showReportMenu || showMiMenu)) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [showAdminMenu, showReportMenu, showMiMenu]);

  useEffect(() => { setMounted(true) }, [])

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
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(canalNotificaciones); }
  }, [session, perfil, mounted]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) setShowAdminMenu(false)
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target as Node)) setShowReportMenu(false)
      if (miMenuRef.current && !miMenuRef.current.contains(event.target as Node)) setShowMiMenu(false)
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setMostrarResultados(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const palabras = term.trim().split(/\s+/).filter(p => p.length > 0)
  let query = supabase.from('pacientes').select('id, nombre, apellido, rut')

  palabras.forEach((palabra) => {
    query = query.or(`nombre.ilike.%${palabra}%,apellido.ilike.%${palabra}%,rut.ilike.%${palabra}%`)
  })

  const { data, error } = await query.limit(6)

  if (error) {
    console.error('Error en búsqueda de pacientes:', error)
    toast.error('Ocurrió un error al buscar pacientes.')
    setResultados([])
  } else {
    setResultados(data || [])
  }

  setBuscando(false)
}

  useEffect(() => {
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        setSession(currentSession)
        const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle()
        setPerfil(data)
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

  const modulos = [
    { href: '/agenda', label: 'Agenda', icon: <Calendar size={16}/>, roles: ['ADMIN', 'RECEPCIONISTA', 'DENTISTA', 'ASISTENTE'] },
    { href: '/pacientes', label: 'Pacientes', icon: <Users size={16}/>, roles: ['ADMIN', 'RECEPCIONISTA', 'DENTISTA', 'ASISTENTE'] },
    { href: '/cajas', label: 'Cajas', icon: <Briefcase size={16}/>, roles: ['ADMIN', 'RECEPCIONISTA'] },
    { href: '/perfil', label: 'Perfil', icon: <User size={16}/>, roles: ['ADMIN', 'RECEPCIONISTA', 'DENTISTA', 'ASISTENTE'] },
  ]

  if (!mounted) return <html lang="es"><body></body></html>

  return (
    <html lang="es">
      <body className="bg-slate-50 min-h-screen font-sans antialiased text-slate-800 text-left print:block print:h-auto">
        <Toaster richColors position="top-right" />
        {!isAuthPage && session && (
          <div className="relative z-[100] flex flex-col print:hidden shadow-sm">
            <header className="w-full h-20 bg-slate-950 text-white flex items-center justify-between px-4 md:px-8 border-b border-white/5 gap-8">
              <div className="flex items-center gap-8 text-left flex-1">
                <Link href="/" className="flex items-center gap-3 group transition-all text-left">
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
                <div ref={searchRef} className="relative w-full max-w-xl hidden md:block">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        {buscando ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar paciente por nombre o RUT..."
                        className="w-full bg-slate-800 border border-slate-700 h-10 pl-10 pr-4 rounded-full text-sm font-bold text-white shadow-sm outline-none focus:border-blue-500 placeholder:text-slate-500"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        onFocus={() => busqueda.length > 2 && setMostrarResultados(true)}
                    />
                    <AnimatePresence>
                        {mostrarResultados && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden text-slate-900 z-50">
                                {resultados.length > 0 ? (
                                    resultados.map(p => (
                                        <Link key={p.id} href={`/pacientes/${p.id}`} onClick={() => { setBusqueda(''); setMostrarResultados(false); }} className="flex items-center gap-4 p-4 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-b-0">
                                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-sm">{p.nombre[0]}{p.apellido[0]}</div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{p.nombre} {p.apellido}</p>
                                                <p className="text-xs text-slate-500">{p.rut}</p>
                                            </div>
                                            <ChevronRight className="ml-auto text-slate-300" size={16} />
                                        </Link>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-sm text-slate-500">No se encontraron resultados.</div>
                                )}
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

            <nav className="w-full h-14 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
              <div className="flex-1 flex items-center justify-start gap-6 overflow-x-auto md:overflow-visible no-scrollbar h-full min-w-0">
                <div className="flex items-center gap-6 h-full shrink-0">
                  {modulos.filter(m => m.roles.includes(perfil?.rol)).map((m) => (
                    <ModuleLink key={m.href} href={m.href} label={m.label} icon={m.icon} active={pathname.startsWith(m.href)} />
                  ))}
                  {['ADMIN', 'RECEPCIONISTA', 'DENTISTA'].includes(perfil?.rol) && (
                    <div className="relative h-full" ref={miMenuRef}>
                      <button onClick={() => setShowMiMenu(!showMiMenu)} className={`flex items-center gap-2.5 px-3 h-full border-b-2 transition-all ${showMiMenu ? 'bg-white border-white text-blue-600 font-black rounded-t-lg mb-[-2px]' : 'border-transparent text-slate-400'}`}>
                        <Stethoscope size={18} /> <span className="text-[11px] font-black uppercase tracking-wider">Mi Menú</span>
                      </button>
                      <AnimatePresence>
                        {showMiMenu && (
                          <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-x-0 bottom-0 top-[136px] bg-black/50 z-[105] md:hidden" onClick={() => setShowMiMenu(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                              className="fixed md:absolute top-[140px] md:top-[100%] left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 bg-white shadow-2xl rounded-3xl md:rounded-b-[2rem] md:rounded-tl-none border border-slate-100 p-4 z-[110] w-full max-w-xs md:w-[260px] text-left"
                                onClick={(e) => { e.stopPropagation(); setShowMiMenu(false); }}
                            >
                              <MenuOption href="/mi-menu/plantillas" label="Plantillas" icon={<Package size={14}/>} onClick={() => setShowMiMenu(false)} />
                                <MenuOption href="/mi-menu/liquidacion" label="Liquidaciones" icon={<Calculator size={14}/>} onClick={() => setShowMiMenu(false)} />
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {perfil?.rol === 'ADMIN' && (
                    <>
                      {/* Menú Reportes */}
                      <div className="relative h-full" ref={reportMenuRef}>
                        <button onClick={() => setShowReportMenu(!showReportMenu)} className={`flex items-center gap-2.5 px-3 h-full border-b-2 transition-all ${showReportMenu || pathname.startsWith('/reportes') ? 'bg-white border-white text-blue-600 font-black rounded-t-lg mb-[-2px]' : 'border-transparent text-slate-400'}`}>
                          <BarChart3 size={18} /> <span className="text-[11px] font-black uppercase tracking-wider">Reportes</span>
                        </button>
                        <AnimatePresence>
                          {showReportMenu && (
                            <>
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-x-0 bottom-0 top-[136px] bg-black/50 z-[105] md:hidden" onClick={() => setShowReportMenu(false)} />
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                                className="fixed md:absolute top-[140px] md:top-[100%] left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 bg-white shadow-2xl rounded-3xl md:rounded-b-[2rem] md:rounded-tl-none border border-slate-100 p-4 z-[110] w-full max-w-xs md:w-[260px] text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MenuOption href="/reportes/desempeno" label="Desempeño" icon={<TrendingUp size={14}/>} onClick={() => setShowReportMenu(false)} />
                                <MenuOption href="/reportes/excel" label="Excel" icon={<FileSpreadsheet size={14}/>} onClick={() => setShowReportMenu(false)} />
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      {/* Menú Administración */}
                      <div className="relative h-full" ref={adminMenuRef}>
                        <button onClick={() => setShowAdminMenu(!showAdminMenu)} className={`flex items-center gap-2.5 px-3 h-full border-b-2 transition-all ${showAdminMenu || pathname.startsWith('/administracion') ? 'bg-white border-white text-blue-600 font-black rounded-t-lg mb-[-2px]' : 'border-transparent text-slate-400'}`}>
                          <LayoutGrid size={18} /> <span className="text-[11px] font-black uppercase tracking-wider">Administración</span>
                        </button>
                        <AnimatePresence>
                          {showAdminMenu && (
                            <>
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-x-0 bottom-0 top-[136px] bg-black/50 z-[105] md:hidden" onClick={() => setShowAdminMenu(false)} />
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} 
                                className="fixed md:absolute top-[140px] md:top-[100%] left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 bg-white shadow-2xl rounded-3xl md:rounded-b-[2.5rem] md:rounded-tr-none border border-slate-100 p-6 md:p-8 z-[110] w-[calc(100vw-2rem)] max-w-lg md:max-w-none md:w-[850px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 text-left max-h-[70vh] md:max-h-none overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-2 text-left"><p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-4 pl-2">Gestión Clínica</p><MenuOption href="/administracion/profesionales" label="Personal" icon={<Users size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/especialidades" label="Especialidades" icon={<Stethoscope size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/convenios" label="Convenios" icon={<Building2 size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/box" label="Gestión de Box" icon={<DoorOpen size={12}/>} onClick={() => setShowAdminMenu(false)} /></div>
                                <div className="space-y-2 text-left"><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-4 pl-2">Operaciones</p><MenuOption href="/administracion/laboratorios" label="Laboratorios" icon={<Beaker size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/liquidaciones" label="Liquidaciones" icon={<Calculator size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/configuracion/pagos-pendientes" label="Pagos Pendientes" icon={<Ban size={12}/>} onClick={() => setShowAdminMenu(false)} /></div>
                                <div className="space-y-2 text-left"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Configuración Maestro</p><MenuOption href="/administracion/configuracion/aranceles" label="Aranceles Precios" icon={<BadgeDollarSign size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/configuracion/bancos" label="Bancos / Entidades" icon={<Library size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/configuracion/documentos" label="Docs Clínicos" icon={<FileText size={12}/>} onClick={() => setShowAdminMenu(false)} /><MenuOption href="/administracion/configuracion/consentimientos" label="Consentimientos" icon={<FileSignature size={12}/>} onClick={() => setShowAdminMenu(false)} /></div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </nav>
          </div>
        )}
        <main className="flex-1 w-full bg-slate-50 relative print:bg-white print:overflow-visible">
          {children}
        </main>
        {!isAuthPage && session && <ChatGlobal session={session} />}
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
    <Link href={href} className={`flex items-center gap-2.5 px-1 h-full border-b-2 transition-all shrink-0 ${active ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
      {icon} <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
    </Link>
  )
}
