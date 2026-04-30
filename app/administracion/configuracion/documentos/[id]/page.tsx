'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Type, AlignLeft, Image as ImageIcon, 
  Minus, Columns, Eye, Save, Trash2, ChevronUp, 
  ChevronDown, Loader2, X, EyeOff,
  UploadCloud, Layout, List, CheckSquare, AlignJustify, Plus
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function ConstructorDocumentosPage() {
  const { id } = useParams()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState<string | null>(null)
  const [modoVistaPrevia, setModoVistaPrevia] = useState(false)
  const [menuColumnasAbierto, setMenuColumnasAbierto] = useState(false)
  
  const [bloques, setBloques] = useState<any[]>([])
  const [nombrePlantilla, setNombrePlantilla] = useState('Nuevo Documento Clínico')
  const [plantillaId, setPlantillaId] = useState<string | null>(null)

  useEffect(() => { fetchPlantilla() }, [id])

  async function fetchPlantilla() {
    setCargando(true)
    const { data } = await supabase.from('documentos_plantillas').select('*').eq('categoria_id', id).maybeSingle()
    if (data) {
      setPlantillaId(data.id)
      setNombrePlantilla(data.nombre)
      setBloques(data.contenido || [])
    }
    setCargando(false)
  }

  const handleGuardar = async () => {
    setGuardando(true)
    try {
      const payload = { categoria_id: id, nombre: nombrePlantilla.toUpperCase(), contenido: bloques, updated_at: new Date() }
      let error;
      if (plantillaId) {
        const { error: err } = await supabase.from('documentos_plantillas').update(payload).eq('id', plantillaId)
        error = err
      } else {
        const { data, error: err } = await supabase.from('documentos_plantillas').insert([payload]).select().single()
        if (data) setPlantillaId(data.id)
        error = err
      }
      if (error) throw error
      toast.success("Plantilla guardada correctamente")
    } catch (err: any) { toast.error("Error: " + err.message) } 
    finally { setGuardando(false) }
  }

  const crearBloqueBase = (tipo: string) => ({
    id: Math.random().toString(36).substr(2, 9),
    tipo,
    label: ['separador', 'titulo', 'texto', 'imagen'].includes(tipo) ? '' : 'Nueva Etiqueta',
    contenido: '',
    opciones: ['desplegable', 'seleccion_multiple'].includes(tipo) ? ['Opción 1', 'Opción 2'] : [],
  })

  const agregarBloque = (tipo: string, extra: any = {}) => {
    if (tipo === 'fila') {
      const nuevaFila = {
        id: Math.random().toString(36).substr(2, 9),
        tipo: 'fila',
        columnas: extra.columnas || 2,
        slots: Array.from({ length: extra.columnas || 2 }, () => null)
      }
      setBloques([...bloques, nuevaFila])
    } else {
      setBloques([...bloques, crearBloqueBase(tipo)])
    }
    setMenuColumnasAbierto(false)
  }

  const asignarBloqueASlot = (filaId: string, slotIndex: number, tipo: string) => {
    setBloques(bloques.map(b => {
      if (b.id === filaId) {
        const nuevosSlots = [...(b.slots || [])];
        nuevosSlots[slotIndex] = tipo ? crearBloqueBase(tipo) : null;
        return { ...b, slots: nuevosSlots };
      }
      return b;
    }));
  }

  const actualizarBloqueInterno = (filaId: string, slotIndex: number, key: string, valor: any) => {
    setBloques(bloques.map(b => {
      if (b.id === filaId) {
        const nuevosSlots = [...(b.slots || [])];
        nuevosSlots[slotIndex] = { ...nuevosSlots[slotIndex], [key]: valor };
        return { ...b, slots: nuevosSlots };
      }
      return b;
    }));
  }

  const actualizarBloque = (id: string, key: string, valor: any) => {
    setBloques(bloques.map(b => b.id === id ? { ...b, [key]: valor } : b))
  }

  const eliminarBloque = (id: string) => setBloques(bloques.filter(b => b.id !== id))
  
  const moverBloque = (index: number, direccion: 'subir' | 'bajar') => {
    const nuevaLista = [...bloques];
    const item = nuevaLista.splice(index, 1)[0];
    nuevaLista.splice(direccion === 'subir' ? index - 1 : index + 1, 0, item);
    setBloques(nuevaLista);
  }

  const gestionarSubidaImagen = async (bloqueId: string, event: React.ChangeEvent<HTMLInputElement>, filaId?: string, slotIndex?: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubiendoImagen(bloqueId);
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('documentos_imagenes').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('documentos_imagenes').getPublicUrl(fileName);
        
        if (filaId !== undefined && slotIndex !== undefined) {
          actualizarBloqueInterno(filaId, slotIndex, 'contenido', publicUrl);
        } else {
          actualizarBloque(bloqueId, 'contenido', publicUrl);
        }
    } catch (error: any) { toast.error('Error al subir: ' + error.message); } 
    finally { setSubiendoImagen(null); }
  };

  if (cargando) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC] text-slate-900"><Loader2 className="animate-spin text-blue-600" size={40} /></div>

  return (
    <div className={`min-h-screen transition-all duration-500 text-left ${modoVistaPrevia ? 'bg-slate-200 p-0 md:p-12' : 'bg-[#F8FAFC] p-8'}`}>
      
      <AnimatePresence>
        {modoVistaPrevia && (
          <motion.button initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            onClick={() => setModoVistaPrevia(false)}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-8 py-5 bg-slate-900/90 backdrop-blur-xl text-white rounded-full font-black text-xs uppercase shadow-2xl hover:scale-110 active:scale-95 transition-all border border-white/10"
          >
            <EyeOff size={18} className="text-blue-400" /> Volver al Editor
          </motion.button>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-8">
        {!modoVistaPrevia && (
          <header className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center sticky top-8 z-50 transition-all">
            <div className="flex items-center gap-4 text-left">
              <button onClick={() => router.back()} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><ArrowLeft size={20}/></button>
              <div>
                <input className="text-xl font-black text-slate-800 uppercase italic bg-transparent outline-none border-none focus:ring-0" value={nombrePlantilla} onChange={(e) => setNombrePlantilla(e.target.value)}/>
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest ml-1 leading-none">Constructor de Plantillas Clínicas</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModoVistaPrevia(true)} className="flex items-center gap-2 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all"><Eye size={16}/> Vista Previa</button>
              <button onClick={handleGuardar} disabled={guardando} className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-slate-900 transition-all shadow-lg">
                {guardando ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Guardar
              </button>
            </div>
          </header>
        )}

        {!modoVistaPrevia && (
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3">
            <BotonTool icon={<Type size={18}/>} label="Título" onClick={() => agregarBloque('titulo')} />
            <BotonTool icon={<AlignLeft size={18}/>} label="Texto" onClick={() => agregarBloque('texto')} />
            <BotonTool icon={<ImageIcon size={18}/>} label="Imagen" onClick={() => agregarBloque('imagen')} />
            
            <div className="relative">
                <BotonTool active={menuColumnasAbierto} icon={<Layout size={18}/>} label="Fila" onClick={() => setMenuColumnasAbierto(!menuColumnasAbierto)} />
                <AnimatePresence>
                    {menuColumnasAbierto && (
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 5 }}
                            className="absolute top-full mt-2 left-0 w-48 bg-slate-900 rounded-[1.5rem] p-3 shadow-2xl z-[100] space-y-1">
                            {[2, 3, 4].map(n => (
                                <button key={n} onClick={() => agregarBloque('fila', { columnas: n })} className="w-full p-3 rounded-xl text-white font-black text-[10px] uppercase hover:bg-blue-600 flex justify-between items-center transition-all">
                                    {n} Columnas <Columns size={12} />
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <BotonTool icon={<Minus size={18}/>} label="Separador" onClick={() => agregarBloque('separador')} />
            <BotonTool variant="form" icon={<Plus size={18}/>} label="Input" onClick={() => agregarBloque('input')} />
            <BotonTool variant="form" icon={<AlignJustify size={18}/>} label="Multi" onClick={() => agregarBloque('textarea')} />
            <BotonTool variant="form" icon={<List size={18}/>} label="Drop" onClick={() => agregarBloque('desplegable')} />
            <BotonTool variant="form" icon={<CheckSquare size={18}/>} label="Check" onClick={() => agregarBloque('seleccion_multiple')} />
          </div>
        )}

        <div className={`min-h-[1000px] transition-all duration-700 relative shadow-2xl ${modoVistaPrevia ? 'bg-white p-24 rounded-none shadow-black/10' : 'bg-white rounded-[4rem] p-16 border border-slate-100'}`}>
          <div className="space-y-10">
            {bloques.map((bloque, index) => (
              <div key={bloque.id} className="relative group text-left text-slate-900">
                {!modoVistaPrevia && (
                  <div className="absolute -left-16 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button onClick={() => moverBloque(index, 'subir')} className="p-2 bg-white rounded-lg shadow-md hover:text-blue-600 border border-slate-100"><ChevronUp size={14}/></button>
                    <button onClick={() => moverBloque(index, 'bajar')} className="p-2 bg-white rounded-lg shadow-md hover:text-blue-600 border border-slate-100"><ChevronDown size={14}/></button>
                    <button onClick={() => eliminarBloque(bloque.id)} className="p-2 bg-white rounded-lg shadow-md text-red-400 hover:bg-red-50 hover:text-white border border-slate-100"><Trash2 size={14}/></button>
                  </div>
                )}

                {bloque.tipo === 'fila' ? (
                  <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${bloque.columnas}, 1fr)` }}>
                    {(bloque.slots || []).map((slot: any, sIdx: number) => (
                      <div key={sIdx} className={`min-h-[100px] rounded-[2rem] transition-all ${!modoVistaPrevia && !slot ? 'bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center' : ''}`}>
                        {!slot && !modoVistaPrevia ? (
                           <div className="flex flex-wrap gap-1 justify-center p-4">
                              <button onClick={() => asignarBloqueASlot(bloque.id, sIdx, 'input')} className="p-2 bg-white rounded-lg shadow-sm text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white border">Input</button>
                              <button onClick={() => asignarBloqueASlot(bloque.id, sIdx, 'desplegable')} className="p-2 bg-white rounded-lg shadow-sm text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white border">Drop</button>
                              <button onClick={() => asignarBloqueASlot(bloque.id, sIdx, 'seleccion_multiple')} className="p-2 bg-white rounded-lg shadow-sm text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white border">Check</button>
                              <button onClick={() => asignarBloqueASlot(bloque.id, sIdx, 'imagen')} className="p-2 bg-white rounded-lg shadow-sm text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white border">Foto</button>
                              <button onClick={() => asignarBloqueASlot(bloque.id, sIdx, 'texto')} className="p-2 bg-white rounded-lg shadow-sm text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white border">Texto</button>
                           </div>
                        ) : slot ? (
                          <div className="relative">
                            {!modoVistaPrevia && <button onClick={() => asignarBloqueASlot(bloque.id, sIdx, '')} className="absolute -top-2 -right-2 p-1 bg-white shadow rounded-full text-red-400 hover:bg-red-50 z-10"><X size={10}/></button>}
                            <RenderBloque 
                              bloque={slot} 
                              modoVistaPrevia={modoVistaPrevia} 
                              onUpdate={(key:string, val:any) => actualizarBloqueInterno(bloque.id, sIdx, key, val)}
                              onUpload={(e:any) => gestionarSubidaImagen(slot.id, e, bloque.id, sIdx)}
                              subiendoImagen={subiendoImagen}
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <RenderBloque 
                    bloque={bloque} 
                    modoVistaPrevia={modoVistaPrevia} 
                    onUpdate={(key: string, val: any) => actualizarBloque(bloque.id, key, val)} 
                    onUpload={(e:any) => gestionarSubidaImagen(bloque.id, e)}
                    subiendoImagen={subiendoImagen}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RenderBloque({ bloque, modoVistaPrevia, onUpdate, onUpload, subiendoImagen }: any) {
  if (!bloque) return null;

  return (
    <div className="space-y-2">
      {!['separador', 'titulo', 'texto', 'imagen'].includes(bloque.tipo) && (
        !modoVistaPrevia ? (
          <input className="text-[10px] font-black uppercase text-blue-600 bg-transparent outline-none border-none focus:ring-0 w-full" value={bloque.label} onChange={(e) => onUpdate('label', e.target.value)} />
        ) : (
          <label className="block text-[11px] font-black uppercase text-slate-400 mb-1">{bloque.label}</label>
        )
      )}

      {bloque.tipo === 'titulo' && (
        modoVistaPrevia ? <h2 className="text-2xl font-black uppercase italic text-slate-900">{bloque.contenido}</h2> :
        <input className="w-full text-xl font-black uppercase italic text-slate-800 outline-none border-b border-transparent focus:border-blue-500/20" value={bloque.contenido} onChange={(e) => onUpdate('contenido', e.target.value)} placeholder="Título..." />
      )}

      {/* MODIFICADO: TEXTO PARRAFO CON WHITESPACE-PRE-LINE */}
      {bloque.tipo === 'texto' && (
        modoVistaPrevia ? (
          <p className="text-slate-600 text-sm leading-relaxed text-justify whitespace-pre-line">{bloque.contenido}</p>
        ) : (
          <textarea 
            className="w-full min-h-[120px] text-sm text-slate-500 bg-slate-50/50 p-4 rounded-2xl outline-none resize-y" 
            value={bloque.contenido} 
            onChange={(e) => onUpdate('contenido', e.target.value)} 
            placeholder="Escribir instrucciones o texto informativo..." 
          />
        )
      )}

      {bloque.tipo === 'input' && <input readOnly={modoVistaPrevia} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-2 border-transparent outline-none" placeholder="..." />}
      {bloque.tipo === 'textarea' && <textarea readOnly={modoVistaPrevia} rows={3} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-2 border-transparent outline-none resize-none" placeholder="..." />}

      {bloque.tipo === 'desplegable' && (
        <div className="space-y-2">
          {modoVistaPrevia ? (
            <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none appearance-none"><option>Seleccione...</option>{bloque.opciones?.map((o: any, i: number) => <option key={i}>{o}</option>)}</select>
          ) : (
            <div className="space-y-1">
              {bloque.opciones?.map((o: any, i: number) => (
                <div key={i} className="flex gap-2 group/opt">
                  <input className="flex-1 bg-slate-50 p-3 rounded-xl text-[10px] font-black uppercase outline-none focus:bg-blue-50 transition-all shadow-sm" value={o} onChange={(e) => {
                    const n = [...bloque.opciones]; n[i] = e.target.value; onUpdate('opciones', n);
                  }}/>
                  <button onClick={() => onUpdate('opciones', bloque.opciones.filter((_:any,idx:any) => idx !== i))} className="text-red-400 opacity-0 group-hover/opt:opacity-100 transition-all"><X size={14}/></button>
                </div>
              ))}
              <button onClick={() => onUpdate('opciones', [...bloque.opciones, 'NUEVA OPCIÓN'])} className="text-[9px] font-black text-blue-600 uppercase p-2 hover:underline">+ Añadir Opción</button>
            </div>
          )}
        </div>
      )}

      {bloque.tipo === 'seleccion_multiple' && (
        <div className={`grid gap-2 p-4 rounded-2xl ${!modoVistaPrevia ? 'bg-slate-50' : ''}`}>
          {bloque.opciones?.map((o: any, i: number) => (
            <div key={i} className="flex items-center gap-2 group/check">
              <div className="w-4 h-4 border-2 rounded-md border-slate-300 shrink-0" />
              {!modoVistaPrevia ? (
                <>
                  <input className="flex-1 bg-transparent text-[10px] font-black uppercase outline-none" value={o} onChange={(e) => {
                    const n = [...bloque.opciones]; n[i] = e.target.value; onUpdate('opciones', n);
                  }}/>
                  <button onClick={() => onUpdate('opciones', bloque.opciones.filter((_:any,idx:any) => idx !== i))} className="text-red-400 opacity-0 group-hover/check:opacity-100 transition-all"><X size={14}/></button>
                </>
              ) : <span className="text-xs font-bold text-slate-600">{o}</span>}
            </div>
          ))}
          {!modoVistaPrevia && <button onClick={() => onUpdate('opciones', [...bloque.opciones, 'NUEVO CHECK'])} className="text-[8px] font-black text-blue-600 uppercase mt-2">+ Añadir Ítem</button>}
        </div>
      )}

      {bloque.tipo === 'imagen' && (
          <div className={`flex flex-col items-center ${modoVistaPrevia ? '' : 'bg-slate-50 p-6 rounded-2xl border-2 border-dashed'}`}>
              {subiendoImagen === bloque.id ? (
                  <div className="flex flex-col items-center gap-2 py-4"><Loader2 className="animate-spin text-blue-500" size={24} /><p className="text-[8px] font-black uppercase text-slate-400">Subiendo...</p></div>
              ) : bloque.contenido ? (
                  <div className="relative">
                      <img src={bloque.contenido} className="max-h-[200px] rounded-xl shadow-md" alt="Preview" />
                      {!modoVistaPrevia && <button onClick={() => onUpdate('contenido', '')} className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"><X size={12}/></button>}
                  </div>
              ) : (
                  !modoVistaPrevia && (
                      <label className="cursor-pointer flex flex-col items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors">
                          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
                          <UploadCloud size={32}/><span className="text-[8px] font-black uppercase tracking-widest">Subir Imagen</span>
                      </label>
                  )
              )}
          </div>
      )}

      {bloque.tipo === 'separador' && <div className="h-[1px] bg-slate-100 w-full my-4" />}
    </div>
  )
}

function BotonTool({ icon, label, onClick, active, variant = 'design' }: any) {
  return (
    <button onClick={onClick} className={`w-full flex flex-col items-center justify-center gap-2 p-4 border rounded-[1.8rem] transition-all active:scale-95 group ${active ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200 shadow-lg' : variant === 'form' ? 'bg-slate-900 border-slate-900 text-white hover:bg-black shadow-sm' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 shadow-sm'}`}>
      <div className={`p-2.5 rounded-xl ${active ? 'bg-white/20' : variant === 'form' ? 'bg-white/10' : 'bg-slate-50 group-hover:bg-blue-50'}`}>{icon}</div>
      <span className="text-[7px] font-black uppercase tracking-widest text-center leading-tight">{label}</span>
    </button>
  )
}