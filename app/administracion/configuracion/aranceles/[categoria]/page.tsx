'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Loader2, CheckCircle2, 
  XCircle, RefreshCw, Plus, X, Save, Trash2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// 🔥 AÑADIMOS LA LISTA OFICIAL DE ICONOS DEL ODONTOGRAMA 🔥
const ICONOS_DISPONIBLES = [
  { id: "default", label: "Círculo (Genérico)" },
  { id: "extraccion", label: "Extracción (X Roja/Verde)" },
  { id: "endodoncia", label: "Endodoncia (Línea en raíz)" },
  { id: "restauracion", label: "Restauración / Tapadura" },
  { id: "corona", label: "Corona" },
  { id: "implante", label: "Implante" },
  { id: "perno", label: "Perno Muñón" },
  { id: "rayos", label: "Rayos-X" },
  { id: "removible", label: "Prótesis Removible" },
  { id: "limpieza", label: "Limpieza/Pulido" },
  { id: "caries", label: "Caries" },
  { id: "sano", label: "Diente Sano" },
  { id: "otro", label: "Otro (Estrella)" }
];

export default function DetalleArancelPage() {
  const { categoria } = useParams()
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)

  // 🔥 NUEVO ESTADO PARA LAS PESTAÑAS 🔥
  const [tabActiva, setTabActiva] = useState<'habilitados' | 'deshabilitados'>('habilitados');
  
  // Estados para el Modal de Nueva Prestación
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  
  const decodedCat = decodeURIComponent(categoria as string)

  // Formulario inicial con el icono 'default' para que coincida con el odontograma
  const formInicial = {
    nombre_accion: '',
    codigo_accion: '',
    uco: '',
    precio: '',
    nombre_arancel: 'Arancel Base',
    id_accion_ext: '', 
    icono_tipo: 'default'
  }
  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setCargando(true)
    try {
      const { data: prestacionesData, error: prestError } = await supabase
        .from('prestaciones')
        .select('*')
        .eq('Nombre Categoria', decodedCat)
        .order('Nombre Accion', { ascending: true })

      if (prestError) throw prestError;
      if (!prestacionesData || prestacionesData.length === 0) {
        setItems([]);
        return;
      }

      const prestacionIds = prestacionesData.map(p => p.id);
      const usageMap = new Map<string, number>();

      // 🔥 PASO 1: Contar desde los planes de tratamiento (presupuesto_items)
      const { data: realizadoItems, error: realizadoError } = await supabase
        .from('presupuesto_items')
        .select('prestacion_id')
        .in('prestacion_id', prestacionIds)
        .in('estado', ['realizado', 'atendido', 'terminado', 'completado', 'finalizado']);

      if (realizadoError) toast.warning("No se pudieron cargar las estadísticas de planes.");
      
      if (realizadoItems) {
        for (const item of realizadoItems) {
          if (item.prestacion_id) {
            usageMap.set(item.prestacion_id, (usageMap.get(item.prestacion_id) || 0) + 1);
          }
        }
      }

      // 🔥 PASO 2: Contar desde atenciones directas (atenciones_realizadas)
      // Esta tabla registra prestaciones que no necesariamente están en un plan de tratamiento.
      const { data: atencionesDirectas, error: atencionesError } = await supabase
        .from('atenciones_realizadas')
        .select('prestacion_id')
        .in('prestacion_id', prestacionIds);

      if (atencionesError) toast.warning("No se pudieron cargar las estadísticas de atenciones directas.");

      if (atencionesDirectas) {
        for (const item of atencionesDirectas) {
          if (item.prestacion_id) {
            usageMap.set(item.prestacion_id, (usageMap.get(item.prestacion_id) || 0) + 1);
          }
        }
      }

      const itemsConConteo = prestacionesData.map(p => ({ ...p, veces_usado: usageMap.get(p.id) || 0 }));
      setItems(itemsConConteo);
    } catch (error: any) {
      toast.error("Error al cargar las prestaciones");
      setItems([]);
    } finally {
      setCargando(false);
    }
  }

  // FUNCIÓN PARA CREAR NUEVA PRESTACIÓN
  async function handleCrearPrestacion() {
    if (!form.nombre_accion || !form.precio) return toast.error("Nombre y Precio son obligatorios")
    
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('prestaciones')
        .insert([{
          "Nombre": form.nombre_accion, 
          "Nombre Categoria": decodedCat,
          "Nombre Accion": form.nombre_accion,
          "Codigo Accion": form.codigo_accion,
          "UCO": parseFloat(form.uco) || 0,
          "Precio": parseInt(form.precio) || 0,
          "Nombre Arancel": form.nombre_arancel,
          "Habilitado": "si",
          "ID Acción": form.id_accion_ext,
          "icono_tipo": form.icono_tipo
        }])

      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('auditoria_clinica').insert([{
          usuario_id: user?.id,
          accion: 'CREATE / PRESTACION',
          tabla: 'prestaciones',
          detalles: `Creó la prestación "${form.nombre_accion}" en la categoría "${decodedCat}" con un precio de $${form.precio}.`
      }])

      toast.success("Prestación creada con éxito.")
      setModalAbierto(false)
      setForm(formInicial)
      fetchItems() // Recargar lista
    } catch (err: any) {
      toast.error("Error al guardar la prestación")
    } finally {
      setGuardando(false)
    }
  }

  // FUNCIÓN PARA CAMBIAR ESTADO
  async function toggleEstado(id: string, estadoActual: string) {
    setActualizandoId(id)
    const valorLimpio = (estadoActual || "").trim().toLowerCase();
    const nuevoEstado = (valorLimpio === 'si' || valorLimpio === 'sí') ? 'no' : 'si';
    
    try {
      const { error } = await supabase
        .from('prestaciones')
        .update({ "Habilitado": nuevoEstado }) 
        .eq('id', id)

      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      const item = items.find(i => i.id === id)
      await supabase.from('auditoria_clinica').insert([{
          usuario_id: user?.id,
          accion: 'UPDATE / ESTADO PRESTACION',
          tabla: 'prestaciones',
          detalles: `Cambió el estado de la prestación "${item?.['Nombre Accion'] || 'N/A'}" a "${nuevoEstado}".`
      }])
      toast.success("Estado actualizado.")
      setItems(items.map(item => 
        item.id === id ? { ...item, Habilitado: nuevoEstado } : item
      ))
    } catch (err: any) {
      toast.error("Error al actualizar el estado")
    } finally {
      setActualizandoId(null)
    }
  }

  // 🔥 NUEVA FUNCIÓN PARA ELIMINAR PRESTACIÓN 🔥
  async function handleEliminarPrestacion(id: string, nombre: string) {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${nombre}" de forma permanente? Esta acción no se puede deshacer.`)) {
      return;
    }

    setActualizandoId(id);
    try {
      const { error } = await supabase
        .from('prestaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('auditoria_clinica').insert([{
          usuario_id: user?.id,
          accion: 'DELETE / PRESTACION',
          tabla: 'prestaciones',
          detalles: `Eliminó permanentemente la prestación "${nombre}" (ID: ${id}).`
      }])

      toast.success("Prestación eliminada correctamente.");
      setItems(items.filter(item => item.id !== id));
    } catch (err: any) {
      toast.error("Error al eliminar la prestación");
    } finally {
      setActualizandoId(null);
    }
  }

  if (cargando) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="animate-spin text-blue-600" size={40}/>
    </div>
  )

  // 🔥 FILTRADO DE ITEMS PARA LAS PESTAÑAS 🔥
  const itemsHabilitados = items.filter(item => {
    const valor = (item.Habilitado || "").trim().toLowerCase();
    return valor === 'si' || valor === 'sí';
  });

  const itemsDeshabilitados = items.filter(item => {
    const valor = (item.Habilitado || "").trim().toLowerCase();
    return valor !== 'si' && valor !== 'sí';
  });

  const itemsMostrados = tabActiva === 'habilitados' ? itemsHabilitados : itemsDeshabilitados;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* NAVEGACIÓN */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase hover:text-blue-600 transition-colors group"
        >
          <div className="p-2 bg-white rounded-lg shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all border border-slate-100">
            <ArrowLeft size={14}/>
          </div>
          Volver a Categorías
        </button>

        {/* HEADER */}
        <header className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
           <div>
             <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">Arancel Clínico</span>
             <h1 className="text-4xl font-black text-slate-800 uppercase italic leading-none mt-4">{decodedCat}</h1>
           </div>
           <button 
            onClick={() => setModalAbierto(true)}
            className="bg-slate-900 text-white px-8 py-5 rounded-3xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95"
           >
             <Plus size={18} /> Nueva Acción
           </button>
        </header>

        {/* TABLA DE ACCIONES */}
        <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
          
          {/* 🔥 PESTAÑAS HABILITADOS / DESHABILITADOS 🔥 */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <button onClick={() => setTabActiva('habilitados')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-2 ${tabActiva === 'habilitados' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
              <CheckCircle2 size={16}/> Habilitados ({itemsHabilitados.length})
            </button>
            <button onClick={() => setTabActiva('deshabilitados')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-2 ${tabActiva === 'deshabilitados' ? 'bg-red-50 text-red-500 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
              <XCircle size={16}/> Deshabilitados ({itemsDeshabilitados.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">
                  <th className="p-10">Tratamiento / Acción</th>
                  <th className="p-10 text-center">Uso (Realizadas)</th>
                  <th className="p-10 text-center">Estado</th>
                  <th className="p-10 text-center">Precio</th>
                  <th className="p-10 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {itemsMostrados.length === 0 && (
                  <tr><td colSpan={5} className="text-center p-20 text-slate-400 font-bold text-sm">No hay prestaciones en esta sección.</td></tr>
                )}
                {itemsMostrados.map((item) => {
                  const valorNormalizado = (item.Habilitado || "").trim().toLowerCase();
                  const esSi = valorNormalizado === 'si' || valorNormalizado === 'sí';

                  return (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="p-10">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800 uppercase italic group-hover:text-blue-600 transition-colors leading-tight">
                            {item["Nombre Accion"]}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase mt-2">
                            Cod: {item["Codigo Accion"] || '---'} | Icono: {item.icono_tipo || 'default'}
                          </span>
                        </div>
                      </td>

                      <td className="p-10 text-center">
                        {item.veces_usado > 0 ? (
                          <span className="font-black text-emerald-600 text-lg">{item.veces_usado}</span>
                        ) : (
                          <span className="font-bold text-slate-300">-</span>
                        )}
                      </td>

                      <td className="p-10 text-center">
                        <button 
                          onClick={() => toggleEstado(item.id, item.Habilitado)}
                          disabled={actualizandoId === item.id}
                          className={`
                            relative inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm
                            ${esSi 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-red-50 text-red-500 border border-red-100'
                            }
                            ${actualizandoId === item.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                          `}
                        >
                          {actualizandoId === item.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : esSi ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          {esSi ? 'Habilitado' : 'Deshabilitado'}
                        </button>
                      </td>

                      <td className="p-10 text-center font-black text-slate-900 text-xl tracking-tighter">
                        ${Number(item.Precio || 0).toLocaleString('es-CL')}
                      </td>

                      <td className="p-10 text-center">
                        <button 
                          onClick={() => handleEliminarPrestacion(item.id, item["Nombre Accion"])}
                          disabled={actualizandoId === item.id}
                          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                          title="Eliminar Prestación Permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL NUEVA PRESTACIÓN */}
      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl relative border border-white/20 overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setModalAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors">
                <X size={24}/>
              </button>
              
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-2">Añadir Acción</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-8">Categoría: {decodedCat}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Nombre de la Acción Clínica</label>
                  <input 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="Ej: Obturación Resina Composite"
                    value={form.nombre_accion}
                    onChange={(e) => setForm({...form, nombre_accion: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Código Interno</label>
                  <input 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="0101001"
                    value={form.codigo_accion}
                    onChange={(e) => setForm({...form, codigo_accion: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Precio ($)</label>
                  <input 
                    type="number"
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="0"
                    value={form.precio}
                    onChange={(e) => setForm({...form, precio: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Valor UCO</label>
                  <input 
                    type="number" step="0.01"
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                    placeholder="0.00"
                    value={form.uco}
                    onChange={(e) => setForm({...form, uco: e.target.value})}
                  />
                </div>

                {/* 🔥 SELECT DE ICONOS ACTUALIZADO 🔥 */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Icono en Odontograma</label>
                  <select 
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none shadow-inner text-xs appearance-none"
                    value={form.icono_tipo}
                    onChange={(e) => setForm({...form, icono_tipo: e.target.value})}
                  >
                    {ICONOS_DISPONIBLES.map(ico => (
                      <option key={ico.id} value={ico.id}>{ico.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleCrearPrestacion}
                disabled={guardando}
                className="w-full mt-10 bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200"
              >
                {guardando ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                {guardando ? 'Guardando...' : 'Guardar Prestación'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}