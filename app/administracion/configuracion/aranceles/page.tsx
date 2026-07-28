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
  const [allPrestaciones, setAllPrestaciones] = useState<any[]>([]) 
  const [nombreNuevaCat, setNombreNuevaCat] = useState('')
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  
  // Estados para doctores
  const [profesionales, setProfesionales] = useState<any[]>([])

  // Estados para el modal de edición de prestación
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false)
  const [itemAEditar, setItemAEditar] = useState<any | null>(null)
  const [editando, setEditando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  
  // Estados para el reparto de categorías
  const [tipoRepartoNuevaCat, setTipoRepartoNuevaCat] = useState<'general'|'doctor'|'clinica'>('general')
  const [profesionalRepartoNuevaCat, setProfesionalRepartoNuevaCat] = useState('')
  
  const [modalEditarCatAbierto, setModalEditarCatAbierto] = useState(false)
  const [catAEditar, setCatAEditar] = useState<{nombre: string, tipo_reparto: string, profesional_id?: string | null} | null>(null)
  
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setCargando(true)
    try {
      // 1. Obtener todas las prestaciones
      const { data: prestacionesData, error: prestError } = await supabase
        .from('prestaciones')
        .select('id, "Nombre Accion", "Nombre Categoria", "Nombre", "Precio"')
      if (prestError) throw prestError
      setAllPrestaciones(prestacionesData || [])

      // 2. Obtener lista de profesionales activos
      const { data: profsData } = await supabase.from('profesionales').select('user_id, nombre, apellido').eq('activo', true)
      setProfesionales(profsData || [])

      // 3. Obtener el tipo de reparto y doctor vinculado (reglas de categoría)
      const { data: catsData } = await supabase.from('categorias_prestaciones').select('nombre, tipo_reparto, profesional_id')
      const map: Record<string, any> = {}
      catsData?.forEach(c => { 
        map[c.nombre] = { tipo: c.tipo_reparto, profesional_id: c.profesional_id } 
      })

      // 4. Unir categorías de prestaciones y categorías con reglas para no omitir ninguna
      const catsDePrestaciones = [...new Set(prestacionesData?.map(p => p['Nombre Categoria']) || [])].filter(Boolean)
      const catsConRegla = catsData?.map(c => c.nombre) || []
      const todasLasCategoriasNombres = [...new Set([...catsDePrestaciones, ...catsConRegla])]

      // 5. Unir la información para renderizar las tarjetas
      const categoriasFinal = todasLasCategoriasNombres.map(c => ({ 
        nombre: c,
        tipo_reparto: map[c]?.tipo || 'general',
        profesional_id: map[c]?.profesional_id || null
      })).sort((a, b) => a.nombre.localeCompare(b.nombre));

      setCategorias(categoriasFinal)

    } catch (err: any) {
      toast.error("Error al cargar categorías: " + err.message)
    } finally {
      setCargando(false)
    }
  }

  const handleCrearCategoria = async () => {
    if (!nombreNuevaCat.trim()) return toast.error("Escribe un nombre para la categoría")
    if (tipoRepartoNuevaCat === 'doctor' && !profesionalRepartoNuevaCat) return toast.error("Debes seleccionar un doctor")
    
    setCreando(true)
    try {
      const { error } = await supabase.from('prestaciones').insert({
        'Nombre Categoria': nombreNuevaCat.trim(),
        'Nombre Accion': 'Acción de Ejemplo (Puedes borrarla)',
        'Precio': 0,
        'Habilitado': 'No'
      })
      if (error) throw error
      
      // Guardar en la base de datos la regla y el doctor
      await supabase.from('categorias_prestaciones').upsert({
        nombre: nombreNuevaCat.trim(),
        tipo_reparto: tipoRepartoNuevaCat,
        profesional_id: tipoRepartoNuevaCat === 'doctor' ? profesionalRepartoNuevaCat : null
      }, { onConflict: 'nombre' })

      toast.success("Categoría creada con éxito.")
      setModalAbierto(false)
      setNombreNuevaCat('')
      setTipoRepartoNuevaCat('general')
      setProfesionalRepartoNuevaCat('')
      fetchData() 
    } catch (err: any) {
      toast.error("Error al crear la categoría: " + err.message)
    } finally {
      setCreando(false)
    }
  }

  const handleGuardarRepartoCat = async () => {
    if (!catAEditar) return;
    if (catAEditar.tipo_reparto === 'doctor' && !catAEditar.profesional_id) return toast.error("Debes seleccionar un doctor")

    try {
      const { error } = await supabase.from('categorias_prestaciones').upsert({
        nombre: catAEditar.nombre,
        tipo_reparto: catAEditar.tipo_reparto,
        profesional_id: catAEditar.tipo_reparto === 'doctor' ? catAEditar.profesional_id : null
      }, { onConflict: 'nombre' });
      
      if (error) throw error;

      toast.success("Reparto de la categoría actualizado");
      setModalEditarCatAbierto(false);
      fetchData();
    } catch (error: any) {
      toast.error("Error al actualizar: " + error.message);
    }
  }

  const handleEliminarCategoria = async (nombreCategoria: string) => {
    const totalPrestaciones = allPrestaciones.filter(p => p['Nombre Categoria'] === nombreCategoria).length;
    const confirmMessage = `¿Estás seguro de eliminar la carpeta "${nombreCategoria}"? Se eliminarán permanentemente ${totalPrestaciones} prestaciones asociadas. Esta acción no se puede deshacer.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setEliminandoId(nombreCategoria);
    try {
      // Eliminar todas las prestaciones de la categoría
      const { error: prestError } = await supabase
        .from('prestaciones')
        .delete()
        .eq('Nombre Categoria', nombreCategoria);
      if (prestError) throw prestError;

      // Eliminar la regla de reparto de la categoría
      await supabase.from('categorias_prestaciones').delete().eq('nombre', nombreCategoria);

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('auditoria_clinica').insert([{
          usuario_id: user?.id,
          accion: 'DELETE / CATEGORIA ARANCEL',
          tabla: 'prestaciones, categorias_prestaciones',
          detalles: `Eliminó la categoría "${nombreCategoria}" y todas sus ${totalPrestaciones} prestaciones.`
      }]);

      toast.success(`Categoría "${nombreCategoria}" y sus prestaciones han sido eliminadas.`);
      fetchData();
    } catch (err: any) { toast.error("Error al eliminar la categoría: " + err.message); } finally { setEliminandoId(null); }
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
            updates['Nombre'] = nombre; 
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
      const { error } = await supabase.from('prestaciones').delete().eq('id', prestacion.id);
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
            <>
              {categorias.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <Layers size={40} className="mx-auto text-slate-300 mb-4"/>
                    <p className="font-black text-slate-500">No hay categorías de aranceles.</p>
                    <p className="text-sm text-slate-400 mt-2">Crea la primera para empezar a organizar tus prestaciones.</p>
                </div>
              ) : ( 
                categorias.map((cat) => {
                  const profVinculado = cat.profesional_id ? profesionales.find(p => p.user_id === cat.profesional_id) : null;
                  return (
                  <div key={cat.nombre} className="relative group" title={`Click para ver las ${allPrestaciones.filter(p => p['Nombre Categoria'] === cat.nombre).length} prestaciones`}>
                    {eliminandoId === cat.nombre && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-[2rem] flex items-center justify-center z-10">
                            <Loader2 className="animate-spin text-red-500" size={32} />
                        </div>
                    )}
                    <div className="relative">
                      <Link href={`/administracion/configuracion/aranceles/${encodeURIComponent(cat.nombre)}`}>
                        <motion.div whileHover={{ y: -5 }} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer h-full flex flex-col justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><BookOpen size={24}/></div>
                            <h3 className="text-lg font-black text-slate-700 uppercase italic leading-tight">{cat.nombre}</h3>
                          </div>
                          
                          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                            <span className="text-[9px] font-black uppercase text-slate-400">Reparto de pago:</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                              cat.tipo_reparto === 'doctor' ? 'bg-blue-100 text-blue-700' :
                              cat.tipo_reparto === 'clinica' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {cat.tipo_reparto === 'doctor' ? `100% Dr. ${profVinculado ? profVinculado.apellido : ''}` : cat.tipo_reparto === 'clinica' ? '100% Clínica' : 'General (%)'}
                            </span>
                          </div>
                        </motion.div>
                      </Link>

                      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCatAEditar(cat); setModalEditarCatAbierto(true); }} className="p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-blue-600 border border-slate-100" title="Editar Regla de Pago"><Edit3 size={16} /></button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEliminarCategoria(cat.nombre); }} className="p-2 bg-white rounded-full shadow-md text-slate-400 hover:text-red-600 border border-slate-100" title="Eliminar Carpeta y Prestaciones"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                )})
              )}
            </>
          ) : (
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

      {/* MODAL NUEVA CATEGORÍA */}
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Vincular a</label>
                  <select
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase"
                    value={tipoRepartoNuevaCat}
                    onChange={(e) => setTipoRepartoNuevaCat(e.target.value as any)}
                  >
                    <option value="general">General (según % contrato del doctor)</option>
                    <option value="doctor">100% Doctor</option>
                    <option value="clinica">100% Clínica</option>
                  </select>
                </div>

                {/* 🔥 NUEVO: MOSTRAR DOCTORES SI SELECCIONA 100% DOCTOR 🔥 */}
                {tipoRepartoNuevaCat === 'doctor' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4 block">Seleccionar Doctor</label>
                    <select
                      className="w-full p-4 bg-blue-50 text-blue-800 rounded-xl font-bold border border-blue-200 outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase"
                      value={profesionalRepartoNuevaCat}
                      onChange={(e) => setProfesionalRepartoNuevaCat(e.target.value)}
                    >
                      <option value="">-- Elija un Doctor --</option>
                      {profesionales.map(p => (
                        <option key={p.user_id} value={p.user_id}>Dr(a). {p.nombre} {p.apellido}</option>
                      ))}
                    </select>
                  </div>
                )}

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

      {/* MODAL EDITAR PRESTACIÓN */}
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

      {/* MODAL EDITAR CATEGORÍA Y REPARTO */}
      <AnimatePresence>
        {modalEditarCatAbierto && catAEditar && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative border border-white/20">
              <button onClick={() => setModalEditarCatAbierto(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-2">Editar Categoría</h2>
              <p className="text-sm font-bold text-slate-500 mb-8">{catAEditar.nombre}</p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block">Vincular ganancia a</label>
                  <select
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase"
                    value={catAEditar.tipo_reparto}
                    onChange={(e) => setCatAEditar({...catAEditar, tipo_reparto: e.target.value, profesional_id: e.target.value === 'doctor' ? catAEditar.profesional_id : null})}
                  >
                    <option value="general">General (según % contrato del doctor)</option>
                    <option value="doctor">100% Doctor</option>
                    <option value="clinica">100% Clínica</option>
                  </select>
                </div>

                {/* 🔥 NUEVO: MOSTRAR DOCTORES EN MODO EDICIÓN SI ES 100% DOCTOR 🔥 */}
                {catAEditar.tipo_reparto === 'doctor' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4 block">Seleccionar Doctor</label>
                    <select
                      className="w-full p-4 bg-blue-50 text-blue-800 rounded-xl font-bold border border-blue-200 outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase"
                      value={catAEditar.profesional_id || ''}
                      onChange={(e) => setCatAEditar({...catAEditar, profesional_id: e.target.value})}
                    >
                      <option value="">-- Elija un Doctor --</option>
                      {profesionales.map(p => (
                        <option key={p.user_id} value={p.user_id}>Dr(a). {p.nombre} {p.apellido}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <button onClick={handleGuardarRepartoCat} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 mt-6">
                  <Save size={18} /> Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
