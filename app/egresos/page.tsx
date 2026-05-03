'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/app/hooks/useRole'
import { Receipt, Plus, Trash2, TrendingDown, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function GestionEgresos() {
  const { isAdmin, cargando: cargandoRol } = useRole()
  const [egresos, setEgresos] = useState<any[]>([])
  const [nuevoEgreso, setNuevoEgreso] = useState({ monto: '', categoria: 'Materiales', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [mounted, setMounted] = useState(false) // Para evitar errores de hidratación de fecha

  // Evitamos que el cliente intente renderizar fechas antes de estar montado
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => { 
    if (isAdmin) fetchEgresos() 
  }, [isAdmin])

  async function fetchEgresos() {
    const { data } = await supabase.from('egresos').select('*').order('fecha', { ascending: false })
    setEgresos(data || [])
  }

  async function guardarEgreso(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoEgreso.monto) return
    setGuardando(true)
    try {
      const { error } = await supabase.from('egresos').insert([{ 
        ...nuevoEgreso, 
        monto: Number(nuevoEgreso.monto) 
      }])
      if (error) throw error
      
      setNuevoEgreso({ monto: '', categoria: 'Materiales', descripcion: '' })
      fetchEgresos()
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Mientras se verifica el rol o no está montado, mostramos loader
  if (cargandoRol || !mounted) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-red-500" size={40} />
    </div>
  )

  if (!isAdmin) return <div className="p-20 text-center font-black">ACCESO RESTRINGIDO</div>

  return (
    <main className="p-8 max-w-6xl mx-auto bg-slate-50 min-h-screen text-left">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-left">
          <Link href="/" className="text-slate-400 font-bold text-xs uppercase flex items-center gap-2 mb-2 hover:text-slate-600 transition-colors">
            <ArrowLeft size={14}/> Volver al Inicio
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 text-left">Gestión de Gastos</h1>
          <p className="text-slate-500 font-medium text-left">Controla los egresos de la clínica</p>
        </div>
        
        <div className="bg-red-500 text-white p-6 rounded-[2rem] shadow-xl shadow-red-100 flex items-center gap-4 transition-transform hover:scale-105">
          <TrendingDown size={32} />
          <div className="text-left">
            <p className="text-[10px] font-black uppercase opacity-80 text-left">Total Gastado</p>
            <p className="text-3xl font-black text-left">
              ${egresos.reduce((acc: number, curr: any) => acc + Number(curr.monto || 0), 0).toLocaleString('es-CL')}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        {/* FORMULARIO */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-fit text-left">
          <form onSubmit={guardarEgreso} className="space-y-4 text-left">
            <h3 className="font-black text-lg mb-4 text-left text-slate-800">Registrar Gasto</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Monto</label>
              <input 
                type="number" 
                placeholder="0" 
                className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none focus:ring-2 ring-red-500 text-slate-900" 
                value={nuevoEgreso.monto} 
                onChange={e => setNuevoEgreso({...nuevoEgreso, monto: e.target.value})} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Categoría</label>
              <select 
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-slate-900 border-none appearance-none cursor-pointer" 
                value={nuevoEgreso.categoria} 
                onChange={e => setNuevoEgreso({...nuevoEgreso, categoria: e.target.value})}
              >
                <option>Materiales</option>
                <option>Arriendo</option>
                <option>Sueldos</option>
                <option>Servicios</option>
                <option>Marketing</option>
                <option>Otros</option>
              </select>
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Descripción</label>
              <textarea 
                placeholder="Detalles del gasto..." 
                className="w-full p-4 bg-slate-50 rounded-2xl font-medium outline-none text-slate-900 min-h-[100px]" 
                value={nuevoEgreso.descripcion} 
                onChange={e => setNuevoEgreso({...nuevoEgreso, descripcion: e.target.value})} 
              />
            </div>
            <button 
              disabled={guardando || !nuevoEgreso.monto} 
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-600 transition-all active:scale-95 disabled:bg-slate-200"
            >
              {guardando ? <Loader2 className="animate-spin mx-auto"/> : 'Guardar Gasto'}
            </button>
          </form>
        </div>

        {/* LISTADO */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 text-left">
           <div className="space-y-3">
             {egresos.length === 0 ? (
               <div className="py-20 text-center text-slate-300 italic font-bold uppercase text-xs tracking-widest">
                 No hay gastos registrados
               </div>
             ) : (
               egresos.map(eg => (
                 <div key={eg.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-red-100 transition-all group text-left">
                   <div className="flex items-center gap-4 text-left">
                      <div className="bg-white p-3 rounded-xl text-red-500 shadow-sm"><Receipt size={20}/></div>
                      <div className="text-left">
                        <p className="font-black text-slate-800 text-sm leading-none mb-1 uppercase">{eg.descripcion || eg.categoria}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(eg.fecha).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                   </div>
                   <p className="font-black text-red-500 text-lg">-${Number(eg.monto || 0).toLocaleString('es-CL')}</p>
                 </div>
               ))
             )}
           </div>
        </div>
      </div>
    </main>
  )
}
