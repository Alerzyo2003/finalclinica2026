                  'use client'
                  import { useState, useEffect, useRef } from 'react'
                  import { supabase } from '@/lib/supabase'
                  import { 
                    Search, UserPlus, Phone, Mail, Loader2, Download, Trash2, Edit3,
                    UserCheck, UserX, AlertCircle, ChevronDown, ChevronUp, CreditCard, 
                    Activity, Briefcase, Wallet, BadgeCheck, ShieldCheck, Coins
                  } from 'lucide-react'
                  import { motion, AnimatePresence } from 'framer-motion'
                  import { toast } from 'sonner'
                  import Link from 'next/link'

                  export default function ClientesPage() {
                    const [pacientes, setPacientes] = useState<any[]>([])
                    const [loading, setLoading] = useState(true)
                    const [busqueda, setBusqueda] = useState('')
                    const [buscando, setBuscando] = useState(false)
                    const [verDeshabilitados, setVerDeshabilitados] = useState(false)
                    const [pacienteExpandido, setPacienteExpandido] = useState<string | null>(null)
                    
                    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

                    useEffect(() => { fetchInitialPacientes() }, [verDeshabilitados])

                    useEffect(() => {
                      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
                      if (busqueda.trim() === '') { fetchInitialPacientes(); return; }
                      if (busqueda.trim().length < 2) return
                      setBuscando(true)
                      searchTimeoutRef.current = setTimeout(() => ejecutarBusqueda(busqueda), 600)
                      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
                    }, [busqueda])

                    async function fetchInitialPacientes() {
                      setLoading(true)
                      const { data } = await supabase.from('pacientes').select('*').eq('activo', !verDeshabilitados).order('nombre', { ascending: true }).limit(30) 
                      setPacientes(data || [])
                      setLoading(false)
                    }

                    async function ejecutarBusqueda(term: string) {
                      const palabras = term.trim().split(/\s+/).filter(p => p.length > 0);
                      let query = supabase.from('pacientes').select('*').eq('activo', !verDeshabilitados);
                      palabras.forEach((palabra) => {
                        query = query.or(`nombre.ilike.%${palabra}%,apellido.ilike.%${palabra}%,rut.ilike.%${palabra}%`);
                      });
                      const { data } = await query.limit(20);
                      setPacientes(data || []);
                      setBuscando(false);
                    }

                    return (
                      <div className="p-8 bg-[#F8FAFC] min-h-screen text-left text-slate-900 font-sans">
                        <div className="max-w-7xl mx-auto space-y-8">
                          {/* HEADER */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="text-left">
                              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">Pacientes</h1>
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Base de datos maestra</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => setVerDeshabilitados(!verDeshabilitados)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm border ${verDeshabilitados ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
                                {verDeshabilitados ? <UserCheck size={14} /> : <UserX size={14} />} {verDeshabilitados ? 'Ver Activos' : 'Ver Inactivos'}
                              </button>
                              <Link href="/pacientes/nuevo" className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-700 transition-all">
                                <UserPlus size={16} /> Nuevo Ingreso
                              </Link>
                            </div>
                          </div>

                          {/* BUSCADOR */}
                          <div className="relative group text-left">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
                              {buscando ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                            </div>
                            <input type="text" placeholder="Filtrar por nombre, rut o apellidos..." className="w-full bg-white border border-slate-100 p-5 pl-16 rounded-[2.2rem] shadow-sm outline-none font-bold text-slate-700" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                          </div>

                          {/* TABLA */}
                          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-50 bg-slate-50/30">
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase text-left">Paciente</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase text-left">Identificación</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase text-left text-right">Ficha</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {loading ? (
                                    <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
                                  ) : (
                                    pacientes.map((p) => (
                                      <FilaPaciente 
                                        key={p.id} 
                                        p={p} 
                                        isExpanded={pacienteExpandido === p.id} 
                                        onExpand={() => setPacienteExpandido(pacienteExpandido === p.id ? null : p.id)}
                                      />
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // --- COMPONENTE FILA CON DATOS REALES DE BD ---
                  function FilaPaciente({ p, isExpanded, onExpand }: any) {
                    const [stats, setStats] = useState({ activos: 0, finalizados: 0, totalP: 0, abonado: 0, loading: false });

                    // Cargar datos financieros solo cuando se expande la fila
                    useEffect(() => {
                      if (isExpanded) {
                        fetchPacienteStats();
                      }
                    }, [isExpanded]);

                    async function fetchPacienteStats() {
                      setStats(prev => ({ ...prev, loading: true }));
                      try {
                        // 1. Consultar Presupuestos
                        const { data: pres } = await supabase.from('presupuestos').select('total, estado').eq('paciente_id', p.id);
                        
                        // 2. Consultar Pagos
                        const { data: pagos } = await supabase.from('pagos').select('monto').eq('paciente_id', p.id);

                        const activos = pres?.filter(x => x.estado !== 'finalizado' && x.estado !== 'cancelado').length || 0;
                        const finalizados = pres?.filter(x => x.estado === 'finalizado').length || 0;
                        const totalPresupuestado = pres?.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0) || 0;
                        const totalAbonado = pagos?.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0) || 0;

                        setStats({ activos, finalizados, totalP: totalPresupuestado, abonado: totalAbonado, loading: false });
                      } catch (e) {
                        setStats(prev => ({ ...prev, loading: false }));
                      }
                    }

                    return (
                      <>
                        <tr onClick={onExpand} className={`cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                          <td className="px-10 py-7">
                            <div className="flex items-center gap-5 text-left text-slate-900">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${isExpanded ? 'bg-blue-600 text-white rotate-6 scale-110' : 'bg-slate-100 text-slate-500'}`}>
                                {p.nombre?.[0]}{p.apellido?.[0]}
                              </div>
                              <div className="text-left text-slate-900">
                                <p className={`font-black uppercase text-sm leading-none mb-1.5 ${!p.activo ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{p.nombre} {p.apellido}</p>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{p.activo ? 'Paciente Vigente' : 'Archivo Inactivo'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-7 text-left text-slate-900">
                            <span className="text-[11px] font-black text-slate-500 bg-white border border-slate-100 px-4 py-1.5 rounded-xl shadow-sm">{p.rut}</span>
                          </td>
                          <td className="px-10 py-7 text-right">
                              <div className={`inline-flex p-3 rounded-2xl transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </div>
                          </td>
                        </tr>

                        <AnimatePresence>
                          {isExpanded && (
                            <tr>
                              <td colSpan={3} className="p-0 border-none">
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50/50">
                                  <div className="p-10 pt-2 grid grid-cols-1 md:grid-cols-3 gap-6 text-left text-slate-900">
                                    
                                    {/* BLOQUE DATOS */}
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 text-left">
                                      <h5 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] flex items-center gap-2 mb-4 text-left"><ShieldCheck size={14}/> Ficha Técnica</h5>
                                      <div className="space-y-4 text-left">
                                        <div className="text-left"><p className="text-[8px] font-black text-slate-300 uppercase text-left">Correo Electrónico</p><p className="text-xs font-black text-slate-700 text-left truncate">{p.email || 'NO REGISTRADO'}</p></div>
                                        <div className="text-left"><p className="text-[8px] font-black text-slate-300 uppercase text-left">Convenio</p><p className="text-xs font-black text-slate-700 uppercase text-left">{p.convenio || 'PARTICULAR'}</p></div>
                                        <div className="text-left"><p className="text-[8px] font-black text-slate-300 uppercase text-left">Teléfono</p><p className="text-xs font-black text-slate-700 text-left">{p.telefono || '---'}</p></div>
                                      </div>
                                    </div>

                                    {/* BLOQUE CLÍNICO (REAL) */}
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm text-left">
                                      <h5 className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em] flex items-center gap-2 mb-6 text-left"><Activity size={14}/> Resumen Clínico</h5>
                                      {stats.loading ? <Loader2 className="animate-spin text-slate-200" /> : (
                                        <div className="grid grid-cols-2 gap-4 text-left">
                                          <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 text-left">
                                            <p className="text-[7px] font-black text-emerald-400 uppercase text-left">P. Aprobados</p>
                                            <p className="text-2xl font-black text-emerald-700 text-left">{stats.activos.toString().padStart(2, '0')}</p>
                                          </div>
                                          <div className="bg-slate-100 p-5 rounded-3xl border border-slate-200 text-left">
                                            <p className="text-[7px] font-black text-slate-400 uppercase text-left">Finalizados</p>
                                            <p className="text-2xl font-black text-slate-600 text-left">{stats.finalizados.toString().padStart(2, '0')}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* BLOQUE FINANCIERO (REAL) */}
                                    <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-left">
                                      <h5 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] flex items-center gap-2 mb-6 text-left"><Wallet size={14}/> Estado de Cuenta</h5>
                                      {stats.loading ? <Loader2 className="animate-spin text-white/20" /> : (
                                        <div className="space-y-4 text-left">
                                          <div className="flex justify-between items-center text-left text-white"><span className="text-[8px] font-black text-white/40 uppercase">Total Tratamientos</span><span className="text-xs font-black">${stats.totalP.toLocaleString('es-CL')}</span></div>
                                          <div className="flex justify-between items-center text-left text-white"><span className="text-[8px] font-black text-white/40 uppercase">Abonado Real</span><span className="text-xs font-black text-emerald-400">${stats.abonado.toLocaleString('es-CL')}</span></div>
                                          <div className="h-px bg-white/10 my-1"></div>
                                          <div className="bg-white/5 p-4 rounded-2xl flex justify-between items-center text-left text-white">
                                            <span className="text-[9px] font-black text-blue-300 uppercase">Saldo Pendiente</span>
                                            <span className={`text-lg font-black ${stats.totalP - stats.abonado > 0 ? 'text-red-400' : 'text-white'}`}>
                                              ${(stats.totalP - stats.abonado).toLocaleString('es-CL')}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* ACCIONES */}
                                    <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100 text-left">
                                      <Link href={`/pacientes/${p.id}`} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Abrir Ficha</Link>
                                      <Link href={`/pacientes/editar/${p.id}`} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 transition-all"><Edit3 size={18} /></Link>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </>
                    )
                  }