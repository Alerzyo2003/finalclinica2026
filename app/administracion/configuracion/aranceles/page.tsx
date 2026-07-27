'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  BookOpen, Plus, Loader2, X, Layers, FolderPlus, Search, Tag, Edit3, Save, Trash2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ArancelesCategoriasPage() {
  const router = useRouter()
  const [categorias, setCategorias] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [allPrestaciones, setAllPrestaciones] = useState<any[]>([]) // NEW STATE
  const [nombreNuevaCat, setNombreNuevaCat] = useState('')
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  
  // Estados para el modal de edición
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
  const [itemAEditar, setItemAEditar] = useState<any | null>(null)
  const [editando, setEditando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  useEffect(() => {
    fetchData() // Renamed to fetchData to reflect broader scope
  }, [])

  async function fetchData() { // Renamed function
    setCargando(true)
    try {
      const { data, error } = await supabase
        .from('prestaciones')
        .select('"Nombre Categoria"')
      
      if (error) throw error
      
      const catsUnicas = [...new Set(data?.map(p => p['Nombre Categoria']) || [])].filter(Boolean)
      setCategorias(catsUnicas.map(c => ({ nombre: c })))

      // Fetch all prestaciones for global search
      const { data: prestacionesData, error: prestError } = await supabase
        .from('prestaciones')
        .select('id, "Nombre Accion", "Nombre Categoria", "Nombre", "Precio"') // Select relevant fields
      if (prestError) throw prestError
      setAllPrestaciones(prestacionesData || [])
    } catch (err: any) {
      toast.error("Error al cargar categorías: " + err.message)
    } finally {
      setCargando(false)
    }
  }

  const handleCrearCategoria = async () => {
    if (!nombreNuevaCat.trim()) return toast.error("Escribe un nombre para la categoría")
    
    setCreando(true)
    try {
      const { error } = await supabase.from('prestaciones').insert({
        'Nombre Categoria': nombreNuevaCat.trim(),
        'Nombre Accion': 'Acción de Ejemplo (Puedes borrarla)',
        'Precio': 0,
        'Habilitado': 'No'
      })

      if (error) throw error

      toast.success("Categoría creada con una acción de ejemplo.")
      setModalAbierto(false)
      setNombreNuevaCat('')
      fetchData() // Call fetchData to refresh both categories and prestaciones
    } catch (err: any) {
      toast.error("Error al crear la categoría: " + err.message)
    } finally {
      setCreando(false)
    }
  }

  const handleGuardarCambios = async () => {
    if (!itemAEditar) return;
    const nombre = itemAEditar['Nombre Accion']?.trim();
    const precio = Number(itemAEditar.Precio);

    if (!nombre) return toast.error("El nombre no puede estar vacío.");
    if (isNaN(precio)) return toast.error("El precio debe ser un número.");

    setEditando(true);
    try {
        const { data: originalItem, error: fetchError } = await supabase
            .from('prestaciones')
            .select('"Nombre Accion", "Precio"')
            .eq('id', itemAEditar.id)
            .single();

        if (fetchError || !originalItem) throw new Error("No se pudo encontrar la prestación original.");

        const updates: { [key: string]: any } = {};
        let detallesCambio = [];

        if (nombre !== originalItem['Nombre Accion']) {
            updates['Nombre Accion'] = nombre;
            updates['Nombre'] = nombre; // Also update 'Nombre' column for consistency
            detallesCambio.push(`nombre de "${originalItem['Nombre Accion']}" a "${nombre}"`);
        }
        if (precio !== originalItem.Precio) {
            updates['Precio'] = precio;
            detallesCambio.push(`precio de $${Number(originalItem.Precio || 0).toLocaleString('es-CL')} a $${precio.toLocaleString('es-CL')}`);
        }

        if (Object.keys(updates).length === 0) {
            toast.info("No se realizaron cambios.");
            setModalEditarAbierto(false);
            return;
        }

        const { error: updateError } = await supabase.from('prestaciones').update(updates).eq('id', itemAEditar.id);
        if (updateError) throw updateError;

        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('auditoria_clinica').insert([{
            usuario_id: user?.id,
            accion: 'UPDATE / PRESTACION',
            tabla: 'prestaciones',
            detalles: `Editó la prestación (ID: ${itemAEditar.id.substring(0, 8)}...). Cambió ${detallesCambio.join(' y ')}.`
        }]);

        setAllPrestaciones(prev => prev.map(p => p.id === itemAEditar.id ? { ...p, ...updates } : p));
        toast.success("Prestación actualizada.");
        setModalEditarAbierto(false);
        setItemAEditar(null);
    } catch (err: any) {
        toast.error("Error al guardar los cambios: " + err.message);
    } finally {
        setEditando(false);
    }
  }

  const handleEliminarPrestacion = async (prestacion: any) => {
    if (!prestacion || !prestacion.id) return;
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${prestacion['Nombre Accion']}" de forma permanente? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(prestacion.id);
    try {
      const { error } = await supabase
        .from('prestaciones')
        .delete()
        .eq('id', prestacion.id);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('auditoria_clinica').insert([{
          usuario_id: user?.id,
          accion: 'DELETE / PRESTACION',
          tabla: 'prestaciones',
          detalles: `Eliminó permanentemente la prestación "${prestacion['Nombre Accion']}" (ID: ${prestacion.id}).`
      }]);

      toast.success("Prestación eliminada correctamente.");
      setAllPrestaciones(prev => prev.filter(p => p.id !== prestacion.id));
    } catch (err: any) {
      toast.error("Error al eliminar la prestación. Puede que esté en uso.");
    } finally {
      setEliminandoId(null);
    }
  }

  // 🔥 NUEVO: Filtra prestaciones cuando hay una búsqueda activa 🔥
  const prestacionesFiltradas = useMemo(() => {
    if (!busqueda) return [];
    const busquedaLower = busqueda.toLowerCase();
    return allPrestaciones.filter(prest => {
      const prestacionName = (prest["Nombre Accion"] || prest["Nombre"] || '').toLowerCase();
      return prestacionName.includes(busquedaLower);
    });
  }, [busqueda, allPrestaciones]);

  if (cargando) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-blue-600" size={40}/></div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 pb-20 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-100 text-slate-500 rounded-2xl"><BookOpen size={24} /></div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 uppercase italic leading-none">Arancel de Prestaciones</h1>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">Agrupado por Categorías</p>
            </div>
          </div>
          <button onClick={() => setModalAbierto(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2"><Plus size={18} /> Nueva Categoría</button>
        </header>

        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Buscar prestación por nombre..."
            className="w-full max-w-md bg-white p-4 pl-12 rounded-2xl border border-slate-100 shadow-sm outline-none focus:ring-2 ring-blue-500/20 font-bold text-xs transition-all"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cargando ? (
            <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32}/></div>
          ) : !busqueda ? (
            // 🔥 VISTA DE CATEGORÍAS (CUANDO NO HAY BÚSQUEDA) 🔥
            <>
              {categorias.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <Layers size={40} className="mx-auto text-slate-300 mb-4"/>
                    <p className="font-black text-slate-500">No hay categorías de aranceles.</p>
                    <p className="text-sm text-slate-400 mt-2">Crea la primera para empezar a organizar tus prestaciones.</p>
                </div>
              ) : ( 
                categorias.map((cat) => (
                  <Link key={cat.nombre} href={`/administracion/configuracion/aranceles/${encodeURIComponent(cat.nombre)}`}>
                    <motion.div whileHover={{ y: -5 }} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><BookOpen size={24}/></div>
                        <h3 className="text-lg font-black text-slate-700 uppercase italic leading-tight">{cat.nombre}</h3>
                      </div>
                    </motion.div>
                  </Link>
                ))
              )}
            </>
          ) : (
            // 🔥 VISTA DE RESULTADOS DE BÚSQUEDA (PRESTACIONES) 🔥
            <>
              {prestacionesFiltradas.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <Search size={40} className="mx-auto text-slate-300 mb-4"/>
                    <p className="font-black text-slate-500">No se encontraron prestaciones.</p>
                    <p className="text-sm text-slate-400 mt-2">Intenta con otro término de búsqueda.</p>
                </div>
              ) : (
                prestacionesFiltradas.map((prest) => (
                    <motion.div 
                      key={prest.id}
                      whileHover={{ y: -5 }} 
                      onClick={() => router.push(`/administracion/configuracion/aranceles/${encodeURIComponent(prest['Nombre Categoria'])}`)}
                      className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between h-full relative"
                    >
                        {eliminandoId === prest.id && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-[2rem] flex items-center justify-center z-10">
                                <Loader2 className="animate-spin text-red-500" size={24} />
                            </div>
                        )}
                        <div>
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><Tag size={24}/></div>
                                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">${Number(prest.Precio || 0).toLocaleString('es-CL')}</span>
                            </div>
                            <h3 className="text-base font-black text-slate-700 uppercase italic leading-tight mt-4 group-hover:text-blue-600 transition-colors">{prest['Nombre Accion']}</h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4 border-t border-slate-100 pt-4">Categoría: {prest['Nombre Categoria']}</p>
                        
                        <div className="absolute bottom-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setItemAEditar({...prest}); setModalEditarAbierto(true); }} 
                                className="p-2 bg-white/50 backdrop-blur-sm rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                title="Editar Prestación"
                            >
                                <Edit3 size={16} />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleEliminarPrestacion(prest); }} 
                                className="p-2 bg-white/50 backdrop-blur-sm rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                                title="Eliminar Prestación"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </motion.div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modalAbierto && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative border border-white/20">
              <button onClick={() => setModalAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-8">Nueva Categoría</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Nombre de la Categoría</label>
                  <input autoFocus className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase" value={nombreNuevaCat} onChange={(e) => setNombreNuevaCat(e.target.value)} />
                </div>
                <p className="text-xs text-slate-400 p-2">Se creará una prestación de ejemplo dentro de esta categoría para que no quede vacía. Podrás editarla o borrarla después.</p>
                <button onClick={handleCrearCategoria} disabled={creando} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 mt-6">
                  {creando ? <Loader2 className="animate-spin" /> : <FolderPlus size={18} />} 
                  Crear Categoría
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalEditarAbierto && itemAEditar && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative border border-white/20">
              <button onClick={() => setModalEditarAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-8">Editar Prestación</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Nombre de la Prestación</label>
                  <input 
                    autoFocus 
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase" 
                    value={itemAEditar['Nombre Accion']} 
                    onChange={(e) => setItemAEditar((prev: any) => ({...prev, 'Nombre Accion': e.target.value}))} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Precio ($)</label>
                  <input 
                    type="number"
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner" 
                    value={itemAEditar.Precio} 
                    onChange={(e) => setItemAEditar((prev: any) => ({...prev, 'Precio': e.target.value}))} 
                  />
                </div>
                <button onClick={handleGuardarCambios} disabled={editando} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 mt-6">
                  {editando ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
