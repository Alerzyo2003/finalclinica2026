'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Loader2, Database,
  Plus, X, Search, Trash2, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Info, Settings, Layers, FileSignature,
  Stethoscope, Check, RefreshCcw, Undo2, HelpCircle, Printer, Download, User, Baby
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

// DENTICIÓN PERMANENTE
const c1 = [18, 17, 16, 15, 14, 13, 12, 11];
const c2 = [21, 22, 23, 24, 25, 26, 27, 28];
const c3 = [48, 47, 46, 45, 44, 43, 42, 41];
const c4 = [31, 32, 33, 34, 35, 36, 37, 38];

// DENTICIÓN TEMPORAL
const t1 = [55, 54, 53, 52, 51];
const t2 = [61, 62, 63, 64, 65];
const t3 = [85, 84, 83, 82, 81];
const t4 = [71, 72, 73, 74, 75];

const PREEXISTENCIAS_LISTA = [
  "Corona", "Corona provisoria", "Endodoncia", "Restauración", "Implante", "Perno muñon",
  "Prótesis removible", "Corona (mal estado)", "Corona provisoria (mal estado)",
  "Perno muñon (mal estado)", "Restauración (mal estado)", "Amalgama",
  "Amalgama (mal estado)", "Sellante", "Implante (mal estado)", "Endodoncia (mal estado)", "Ausente"
];

const LESIONES_LISTA = [
  "Caries", "Infección Pulpar", "Fractura", "Movilidad", "Residuo Radicular", "Erosión", "Atrición", "Abfracción", "Otro"
];

const ICONOS_DISPONIBLES = [
  { id: "extraccion", label: "Extracción", icon: "extraccion" },
  { id: "endodoncia", label: "Endodoncia", icon: "endodoncia" },
  { id: "restauracion", label: "Restauración", icon: "restauracion" },
  { id: "corona", label: "Corona", icon: "corona" },
  { id: "implante", label: "Implante", icon: "implante" },
  { id: "perno", label: "Perno Muñón", icon: "perno" },
  { id: "rayos", label: "Rayos-X", icon: "rayos" },
  { id: "removible", label: "Prótesis Removible", icon: "removible" },
  { id: "limpieza", label: "Limpieza/Pulido", icon: "limpieza" },
  { id: "caries", label: "Caries", icon: "caries" },
  { id: "sano", label: "Diente Sano", icon: "sano" },
  { id: "otro", label: "Otro (Estrella)", icon: "otro" },
  { id: "default", label: "Círculo (Genérico)", icon: "default" }
];

export default function DetalleTratamientoPage() {
  const params = useParams()
  const pathname = usePathname()
  const idURL = (params?.presupuestoId as string) || pathname.split('/').pop() || ""
  
  const [pacienteId, setPacienteId] = useState<string>('')
  const [presupuestoData, setPresupuestoData] = useState<any>(null)
  
  const [acciones, setAcciones] = useState<any[]>([]) 
  const [historialPaciente, setHistorialPaciente] = useState<any[]>([]) 
  
  const [odontogramaEstado, setOdontogramaEstado] = useState<Record<string, any>>({})
  const [historialOdontograma, setHistorialOdontograma] = useState<Record<string, any>[]>([])
  
  const [dientesSeleccionados, setDientesSeleccionados] = useState<number[]>([])
  const [editandoDienteId, setEditandoDienteId] = useState<string | null>(null)
  const [vistaTemporal, setVistaTemporal] = useState(false) 

  const [modalEditarItem, setModalEditarItem] = useState<{abierto: boolean, item: any}>({abierto: false, item: null})
  const [dctoInput, setDctoInput] = useState(0)

  const [mostrarLeyenda, setMostrarLeyenda] = useState(false)
  const [modalExportar, setModalExportar] = useState<{abierto: boolean, tipo: 'imprimir'|'descargar'|null}>({abierto: false, tipo: null})
  const [exportarOpciones, setExportarOpciones] = useState({ odontograma: true, finanzas: true })

  const [cargando, setCargando] = useState(true)
  const [debug, setDebug] = useState('Sincronizando...')
  
  const [verInfoDiente, setVerInfoDiente] = useState<number | null>(null)
  const [menuContextual, setMenuContextual] = useState<{ x: number, y: number, diente: number, lado: 'derecha' | 'izquierda', cara?: string } | null>(null)
  const [vistaMenu, setVistaMenu] = useState<'principal' | 'preexistencias' | 'lesiones'>('principal')

  const [profesionales, setProfesionales] = useState<any[]>([])
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState<string>('')
  const [seccionesPrests, setSeccionesPrests] = useState<Record<string, any[]>>({})
  const [busqueda, setBusqueda] = useState('')
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Record<string, boolean>>({})

  const [listaSecciones, setListaSecciones] = useState<string[]>(['Plan General'])
  const [modalNuevaSeccion, setModalNuevaSeccion] = useState(false)
  const [nuevaSeccionNombre, setNuevaSeccionNombre] = useState('')

  const [panelAgregarAbierto, setPanelAgregarAbierto] = useState(false)
  const [seccionInput, setSeccionInput] = useState('Plan General')
  const [dienteInput, setDienteInput] = useState<string>('')
  const [caraInput, setCaraInput] = useState<string>('') 
  const [zonaInput, setZonaInput] = useState<string>('')

  const [modalEvolucion, setModalEvolucion] = useState(false)
  const [evolucionNota, setEvolucionNota] = useState('')
  const [itemsAEvolucionar, setItemsAEvolucionar] = useState<string[]>([])
  const [guardandoEvolucion, setGuardandoEvolucion] = useState(false)

  const [modalIcono, setModalIcono] = useState<{abierto: boolean, prestacion: any, autoAdd?: boolean, itemTargetId?: string}>({
    abierto: false, prestacion: null, autoAdd: false, itemTargetId: undefined
  });

  const todasLasAccionesBoca = useMemo(() => {
    const historicasFiltradas = historialPaciente.filter(h => !acciones.some(a => a.id === h.id || a.tempId === h.tempId));
    return [...historicasFiltradas, ...acciones];
  }, [acciones, historialPaciente]);

  useEffect(() => {
    if (idURL) { fetchDatosFinales(); fetchAuxiliares(); }
    const cerrarMenu = () => { setMenuContextual(null); setVistaMenu('principal'); };
    window.addEventListener('click', cerrarMenu);
    return () => window.removeEventListener('click', cerrarMenu);
  }, [idURL])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        handleDeshacer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historialOdontograma, odontogramaEstado]);

  const guardarHistorial = () => {
    setHistorialOdontograma(prev => {
        const nuevoHistorial = [...prev, JSON.parse(JSON.stringify(odontogramaEstado))];
        return nuevoHistorial.slice(-10);
    });
  }

  const handleDeshacer = async () => {
    if (historialOdontograma.length === 0) return toast.info("No hay acciones para deshacer");
    const estadoPrevio = historialOdontograma[historialOdontograma.length - 1];
    const nuevoHistorial = historialOdontograma.slice(0, -1);
    
    const { error } = await supabase.from('presupuestos').update({ odontograma_estado: estadoPrevio }).eq('id', idURL);
    if (!error) {
        setOdontogramaEstado(estadoPrevio);
        setHistorialOdontograma(nuevoHistorial);
        toast.success("Acción deshecha");
    } else {
        toast.error("Error al deshacer");
    }
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, nuevaSeccion: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;

    const item = acciones.find(a => a.id === itemId || a.tempId === itemId);
    if (!item || item.seccion_nombre === nuevaSeccion) return; 

    setAcciones(prev => prev.map(a => (a.id === itemId || a.tempId === itemId) ? { ...a, seccion_nombre: nuevaSeccion } : a));

    let partes = (item.observacion || '').split('|').map((p:string) => p.trim());
    partes[0] = nuevaSeccion; 
    const nuevaObs = partes.join(' | ');

    if (item.id) {
       supabase.from('presupuesto_items').update({ observacion: nuevaObs }).eq('id', item.id).then();
    }
  };

  async function fetchDatosFinales() {
    setCargando(true)
    try {
      const { data: pres } = await supabase.from('presupuestos').select('*').eq('id', idURL).maybeSingle();
      if (pres) {
        if (pres.odontograma_estado) setOdontogramaEstado(typeof pres.odontograma_estado === 'string' ? JSON.parse(pres.odontograma_estado) : pres.odontograma_estado);
        if (pres.paciente_id) setPacienteId(pres.paciente_id);
        setPresupuestoData({ ...pres, isAprobado: pres.aprobado || Number(pres.total_abonado || 0) > 0 });
      }

      let targetID: string = idURL;
      let esNuevo = true;
      if (pres && pres.id_dentalink) { targetID = pres.id_dentalink.toString(); esNuevo = false; }

      let query = esNuevo 
        ? supabase.from('presupuesto_items').select(`*, prestaciones:prestacion_id(icono_tipo, "Nombre Accion", "Nombre", "Precio")`).eq('presupuesto_id', idURL) 
        : supabase.from('temp_items').select('*').eq('id_dentalink', targetID);

      const { data, error } = await query;
      if (error) throw error;

      const itemsMapeados = (data || []).map(item => mapearItem({...item, tempId: item.id || Math.random().toString()}, esNuevo));

      setListaSecciones(prev => Array.from(new Set([...prev, ...Array.from(new Set(itemsMapeados.map(i => i.seccion_nombre)))])).sort((a:any, b:any) => a.localeCompare(b)));
      setAcciones(itemsMapeados);
      setDebug(esNuevo ? "Modo Local" : `Dentalink #${targetID}`);

      if (pres?.paciente_id) {
          const { data: presupuestosPaciente } = await supabase.from('presupuestos').select('id').eq('paciente_id', pres.paciente_id);
          if (presupuestosPaciente) {
              const ids = presupuestosPaciente.map(p => p.id);
              const { data: historial } = await supabase.from('presupuesto_items').select(`*, prestaciones:prestacion_id(icono_tipo, "Nombre Accion", "Nombre", "Precio")`).in('presupuesto_id', ids).neq('presupuesto_id', idURL);
              if (historial) setHistorialPaciente(historial.map(h => mapearItem({...h, tempId: h.id}, true)));
          }
      }

    } catch (err) { setDebug("Error"); } finally { setCargando(false); }
  }

  // 🔥 DIAGNÓSTICO PROFUNDO: Mapeo de ítems con Logs Extremos
  const mapearItem = (item: any, esNuevo: boolean) => {
      const pactado = Number(item.precio_pactado || item.precio || 0);
      const abonado = Number(item.abonado || 0);
      const partes = (item.observacion || 'Plan General').split('|').map((p: string) => p.trim());
      
      let caraMatch = null, zonaMatch = null, iconoMatch = null, dctoMatch = 0, avanceMatch = 0;
      
      let dienteParseado = item.diente_id ? parseInt(item.diente_id) : null; 
      if (isNaN(dienteParseado as any)) dienteParseado = null;

      partes.forEach((p: string) => {
          if (p.startsWith('Cara:')) caraMatch = p.replace('Cara:', '').trim();
          if (p.startsWith('Zona:')) zonaMatch = p.replace('Zona:', '').trim();
          if (p.startsWith('Icono:')) iconoMatch = p.replace('Icono:', '').trim();
          if (p.startsWith('Dcto:')) dctoMatch = parseInt(p.replace('Dcto:', '').trim());
          if (p.startsWith('Avance:')) avanceMatch = parseInt(p.replace('Avance:', '').trim());
      });

      const nombreDisplay = item.prestaciones?.["Nombre Accion"] || item.prestaciones?.["Nombre"] || item.nombre_prestacion || item.observacion || "Tratamiento Genérico";

      if (!caraMatch && nombreDisplay) {
          const regexCara = /\b([VLMDvlmd])\b/; 
          const matchC = String(nombreDisplay).match(regexCara);
          if (matchC) caraMatch = matchC[1].toUpperCase();
      }

      let precioBase = item.prestaciones?.["Precio"] || item.precio;
      if (!precioBase) precioBase = pactado / (1 - (dctoMatch / 100));

      const finalItem = {
          ...item,
          diente_id: dienteParseado, 
          seccion_nombre: partes[0] || 'Plan General',
          cara: caraMatch, zona: zonaMatch,
          display_nombre: nombreDisplay,
          icono_tipo: iconoMatch || item.prestaciones?.icono_tipo,
          precio_base: precioBase,
          descuento: dctoMatch,
          avance: item.estado === 'realizado' ? 100 : avanceMatch,
          tempId: item.tempId || item.id || Math.random().toString(),
          display_pactado: pactado, display_abonado: abonado, display_saldo: pactado - abonado
      };

      // 🚨 LOGS DE DETECTIVES 🚨
      if (finalItem.estado === 'realizado') {
          console.log(`🔎 [ITEM] Nombre: "${finalItem.display_nombre}" | Diente: ${finalItem.diente_id} | Cara: ${finalItem.cara || 'NINGUNA'} | Zona: ${finalItem.zona || 'NINGUNA'}`);
      }

      return finalItem;
  }

  async function fetchAuxiliares() {
    const { data: profs } = await supabase.from('profesionales').select('user_id, nombre, apellido').eq('activo', true);
    if (profs) setProfesionales(profs);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
       const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).maybeSingle();
       if (perfil && perfil.rol !== 'ADMIN' && perfil.rol !== 'RECEPCIONISTA') {
          setProfesionalSeleccionado(session.user.id);
       }
    }
    
    let allPrests: any[] = [];
    let fetchMore = true, from = 0;
    while (fetchMore) {
        const { data, error } = await supabase.from('prestaciones').select('*').range(from, from + 999);
        if (error) break;
        if (data && data.length > 0) { allPrests = [...allPrests, ...data]; from += 1000; } else fetchMore = false;
    }

    if (allPrests.length > 0) {
      const agrupado = allPrests.reduce((acc: any, curr: any) => {
        if (String(curr.Habilitado !== undefined ? curr.Habilitado : curr.habilitado || '').trim().toLowerCase() === 'no' || (curr.Habilitado !== undefined ? curr.Habilitado : curr.habilitado) === false) return acc; 
        const cat = (curr["Nombre Categoria"] || "OTROS").trim();
        if (!acc[cat]) acc[cat] = [];
        curr.display_nombre = curr["Nombre Accion"] || curr["Nombre"] || "Prestación sin nombre";
        acc[cat].push(curr);
        return acc;
      }, {});
      Object.keys(agrupado).forEach(key => agrupado[key].sort((a:any, b:any) => a.display_nombre.localeCompare(b.display_nombre)));
      setSeccionesPrests(agrupado);
    }
  }

  const aprobarPlanManualmente = async () => {
    const { error } = await supabase.from('presupuestos').update({ aprobado: true }).eq('id', idURL);
    if (!error) { setPresupuestoData({ ...presupuestoData, isAprobado: true }); toast.success("Plan de tratamiento aprobado"); }
  }

  const handleCrearSeccion = () => {
    if(!nuevaSeccionNombre.trim()) return toast.error("El nombre de la sección no puede estar vacío");
    const nombre = nuevaSeccionNombre.trim();
    if(!listaSecciones.includes(nombre)) setListaSecciones(prev => [...prev, nombre].sort((a, b) => a.localeCompare(b)));
    setSeccionInput(nombre); setModalNuevaSeccion(false); setNuevaSeccionNombre(''); toast.success("Nueva sección agregada a la lista");
  }

  const abrirPanelAgregar = (dientePreseleccionado: number | null = null, cara: string = '', zona: string = '') => {
    if (zona) { setDienteInput(''); setZonaInput(zona); setDientesSeleccionados([]); } 
    else if (dientePreseleccionado !== null) { setDienteInput(dientePreseleccionado.toString()); setZonaInput(''); setDientesSeleccionados([dientePreseleccionado]); } 
    else {
        if (dientesSeleccionados.length > 0) setDienteInput(dientesSeleccionados.join(', ')); else setDienteInput('');
        setZonaInput('');
    }
    setCaraInput(cara); setPanelAgregarAbierto(true);
  }

  const handleDienteClick = (id: number, e?: React.MouseEvent) => {
    if (e?.shiftKey) {
        setDientesSeleccionados(prev => {
            const newSelection = prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id];
            if (panelAgregarAbierto && !zonaInput && !caraInput) setDienteInput(newSelection.join(', '));
            return newSelection;
        });
    } else {
        setDientesSeleccionados([id]); abrirPanelAgregar(id);
    }
  }

  const handleContextMenu = (e: React.MouseEvent, diente: number, cara?: string) => {
    e.preventDefault(); e.stopPropagation();
    if(dientesSeleccionados.length > 1) return; 
    const container = document.getElementById('odontograma-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setMenuContextual({ x: e.clientX - rect.left, y: e.clientY - rect.top, diente, lado: e.clientX + 480 > window.innerWidth ? 'izquierda' : 'derecha', cara });
    setVistaMenu('principal');
  };

  const procesarAplicacionHallazgo = async (dientesArreglo: number[], tipo: string, esMulti = false) => {
    guardarHistorial();
    let nuevoEstado = { ...odontogramaEstado };
    const t = tipo.toLowerCase();

    dientesArreglo.forEach(diente => {
        const dId = diente.toString();
        let actual = nuevoEstado[dId]?.hallazgos || [];
        if (nuevoEstado[dId]?.center) actual = [nuevoEstado[dId].center];
        
        if (t.includes('sano')) { actual = ['Diente sano']; } 
        else { actual = actual.filter((h:string) => !h.toLowerCase().includes('sano')); if (!actual.some((h:string) => h.toLowerCase() === t)) actual.push(tipo); }
        nuevoEstado[dId] = { ...nuevoEstado[dId], hallazgos: actual };
    });

    const { error } = await supabase.from('presupuestos').update({ odontograma_estado: nuevoEstado }).eq('id', idURL);
    if (!error) { setOdontogramaEstado(nuevoEstado); toast.success(esMulti ? "Hallazgo aplicado a la selección" : "Hallazgo registrado"); if(esMulti) setDientesSeleccionados([]); }
  }

  const aplicarHallazgo = (tipo: string) => { if (menuContextual) procesarAplicacionHallazgo([menuContextual.diente], tipo); };

  const aplicarLesionCara = async () => {
    if (!menuContextual || !menuContextual.cara) return;
    guardarHistorial();
    const dId = menuContextual.diente.toString();
    const carasActuales = odontogramaEstado[dId]?.caras || {};
    const nuevaCara = carasActuales[menuContextual.cara] === 'lesion' ? null : 'lesion';
    const nuevoEstado = { ...odontogramaEstado, [dId]: { ...odontogramaEstado[dId], caras: { ...carasActuales, [menuContextual.cara]: nuevaCara } } };
    
    const { error } = await supabase.from('presupuestos').update({ odontograma_estado: nuevoEstado }).eq('id', idURL);
    if (!error) { setOdontogramaEstado(nuevoEstado); toast.success("Cara actualizada"); setMenuContextual(null); }
  }

  const eliminarHallazgoEspecifico = async (diente: number, hallazgoNombre: string) => {
    guardarHistorial();
    const dId = diente.toString();
    const nuevosHallazgos = odontogramaEstado[dId].hallazgos.filter((h: string) => h !== hallazgoNombre);
    const nuevoEstado = { ...odontogramaEstado };
    if (nuevosHallazgos.length === 0) delete nuevoEstado[dId]; else nuevoEstado[dId] = { hallazgos: nuevosHallazgos };
    const { error } = await supabase.from('presupuestos').update({ odontograma_estado: nuevoEstado }).eq('id', idURL);
    if (!error) { setOdontogramaEstado(nuevoEstado); toast.info("Eliminado"); }
  };

  const eliminarPrestacionLocal = async (id: string, tempId: string) => {
    if (id) {
        const { error } = await supabase.from('presupuesto_items').delete().eq('id', id);
        if (!error) { setAcciones(prev => prev.filter(a => a.id !== id)); toast.info("Acción eliminada"); }
    } else {
        setAcciones(prev => prev.filter(a => a.tempId !== tempId)); toast.info("Acción quitada de la vista");
    }
  }

  const handleCambiarDiente = async (tempId: string, id: string | null, nuevoDiente: string) => {
    setEditandoDienteId(null);
    const val = nuevoDiente.trim();
    const dId = val ? parseInt(val) : null;
    if (val !== '' && isNaN(dId as any)) return toast.error("Número de pieza inválido");
    
    if (id) await supabase.from('presupuesto_items').update({ diente_id: dId }).eq('id', id);
    setAcciones(prev => prev.map(a => (a.id === id || a.tempId === tempId) ? { ...a, diente_id: dId } : a)); 
    toast.success("Pieza actualizada");
  }

  const handleCambiarAvance = async (tempId: string, id: string | null, nuevoAvance: number) => {
    const item = acciones.find(a => a.tempId === tempId);
    if (!item) return;

    let nuevaObs = item.observacion || '';
    nuevaObs = nuevaObs.replace(/ \| Avance: [0-9]+/g, '');
    if (nuevoAvance > 0) nuevaObs += ` | Avance: ${nuevoAvance}`;

    if (id) await supabase.from('presupuesto_items').update({ observacion: nuevaObs }).eq('id', id);
    setAcciones(prev => prev.map(a => a.tempId === tempId ? { ...a, avance: nuevoAvance, observacion: nuevaObs } : a));
  }

  const handleGuardarDescuento = async () => {
    const id = modalEditarItem.item.id;
    const tempId = modalEditarItem.item.tempId;
    const dcto = dctoInput;
    const item = modalEditarItem.item;
    
    const precioBase = item.precio_base || item.precio || 0;
    const nuevoPactado = precioBase * (1 - (dcto / 100));

    let nuevaObs = item.observacion || '';
    nuevaObs = nuevaObs.replace(/ \| Dcto: [0-9]+/g, '');
    if (dcto > 0) nuevaObs += ` | Dcto: ${dcto}`;

    if (id) await supabase.from('presupuesto_items').update({ precio_pactado: nuevoPactado, observacion: nuevaObs }).eq('id', id);

    setAcciones(prev => prev.map(a => a.tempId === tempId ? {
        ...a, descuento: dcto, observacion: nuevaObs, precio_pactado: nuevoPactado, display_pactado: nuevoPactado, display_saldo: nuevoPactado - a.display_abonado
    } : a));
    setModalEditarItem({abierto: false, item: null});
    toast.success("Descuento aplicado correctamente");
  }

  const handleSeleccionarTratamiento = async (prestacion: any, skipIconCheck = false) => {
    if (!profesionalSeleccionado) return toast.error("Seleccione un dentista responsable");
    if (!seccionInput.trim()) return toast.error("Defina una fase o sección");
    
    if (!skipIconCheck && !prestacion.icono_tipo) {
        const h = prestacion.display_nombre.toLowerCase();
        const isKnown = LESIONES_LISTA.some(l => l.toLowerCase() === h) || ["ausente", "extraccion", "extracción", "exodoncia", "sano", "erupcionar", "residuo", "rr", "corona", "endodoncia", "restauración", "restauracion", "tapadura", "implante", "perno", "muñón", "munon", "rayos", "radiografia", "radiografía", "rx", "removible", "protesis", "prótesis", "pulido", "destartraje", "limpieza", "profilaxis", "amalgama", "sellante", "resina", "ionomero", "default", "otro", "ortodoncia", "contención"].some(k => h.includes(k));
        if (!isKnown) { setModalIcono({ abierto: true, prestacion: prestacion, autoAdd: true }); return; }
    }

    const dIds = dienteInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    const observacionFinal = seccionInput.trim() + (caraInput ? ` | Cara: ${caraInput}` : '') + (zonaInput ? ` | Zona: ${zonaInput}` : '') + (prestacion.icono_tipo ? ` | Icono: ${prestacion.icono_tipo}` : '');

    const baseItem = {
        presupuesto_id: idURL, prestacion_id: prestacion.id, precio_pactado: prestacion["Precio"], abonado: 0, 
        estado: 'pendiente', profesional_id: profesionalSeleccionado, observacion: observacionFinal
    };

    let inserts = [];
    if (dIds.length > 0 && !zonaInput) inserts = dIds.map(dId => ({ ...baseItem, diente_id: dId }));
    else inserts = [{ ...baseItem, diente_id: null }];

    const { data, error } = await supabase.from('presupuesto_items').insert(inserts).select('*, prestaciones:prestacion_id(*)');

    if (!error && data) {
        const nuevosItems = data.map((d:any) => ({
            ...d, seccion_nombre: seccionInput.trim(), cara: caraInput || null, zona: zonaInput || null,
            display_nombre: prestacion.display_nombre, icono_tipo: prestacion.icono_tipo || d.prestaciones?.icono_tipo, 
            precio_base: prestacion["Precio"], descuento: 0, avance: 0, tempId: d.id,
            display_pactado: d.precio_pactado, display_abonado: 0, display_saldo: d.precio_pactado 
        }));
        setAcciones(prev => [...prev, ...nuevosItems]);
        setPanelAgregarAbierto(false); setDientesSeleccionados([]); 
        toast.success(`Prestación agregada exitosamente ${inserts.length > 1 ? `(${inserts.length} piezas)` : ''}`);
    } else toast.error("Error al guardar en base de datos. Verifica la columna 'observacion'.");
  };

  const handleEvolucionar = async () => {
    if (itemsAEvolucionar.length === 0) return toast.error("Seleccione al menos un tratamiento pendiente");
    if (!evolucionNota.trim()) return toast.error("Debe ingresar una nota clínica para el registro legal");
    if (!profesionalSeleccionado) return toast.error("Seleccione el profesional que realiza la evolución");

    setGuardandoEvolucion(true);
    try {
      const { error: evoError } = await supabase.from('evoluciones').insert([{ paciente_id: pacienteId || null, profesional_id: profesionalSeleccionado, descripcion_procedimiento: evolucionNota.trim(), observaciones: `Evolución del presupuesto asociado: ${idURL}` }]);
      if (evoError) throw evoError;
      for (const itemId of itemsAEvolucionar) await supabase.from('presupuesto_items').update({ estado: 'realizado' }).eq('id', itemId);
      if (!presupuestoData.isAprobado) { await supabase.from('presupuestos').update({ aprobado: true }).eq('id', idURL); setPresupuestoData({ ...presupuestoData, isAprobado: true }); }
      setAcciones(prev => prev.map(a => itemsAEvolucionar.includes(a.id) ? { ...a, estado: 'realizado', avance: 100 } : a));
      toast.success("Evolución registrada."); setModalEvolucion(false); setEvolucionNota(''); setItemsAEvolucionar([]);
    } catch (err) { toast.error("Error al registrar la evolución"); } finally { setGuardandoEvolucion(false); }
  }

  const handleGuardarIcono = async (iconoId: string | null) => {
    const prestacionActual = modalIcono.prestacion;
    const autoAdd = modalIcono.autoAdd;
    const targetId = modalIcono.itemTargetId; 

    if (targetId) {
        setAcciones(prev => prev.map(a => {
            if (a.tempId === targetId) {
                let nuevaObs = a.observacion || '';
                nuevaObs = nuevaObs.replace(/ \| Icono: [a-zA-Z0-9_-]+/g, ''); 
                if (iconoId) nuevaObs += ` | Icono: ${iconoId}`; 
                if (a.id) supabase.from('presupuesto_items').update({ observacion: nuevaObs }).eq('id', a.id).then();
                return { ...a, icono_tipo: iconoId, observacion: nuevaObs };
            }
            return a;
        }));
        toast.success(iconoId ? "Logo asignado al tratamiento en pantalla" : "Logo restablecido");
        setModalIcono({ abierto: false, prestacion: null, autoAdd: false, itemTargetId: undefined });
        return;
    }

    if (prestacionActual?.id) {
        await supabase.from('prestaciones').update({ icono_tipo: iconoId }).eq('id', prestacionActual.id);
        const nuevasSecciones = { ...seccionesPrests };
        for (const cat in nuevasSecciones) {
           const index = nuevasSecciones[cat].findIndex((p:any) => p.id === prestacionActual.id);
           if (index !== -1) nuevasSecciones[cat][index].icono_tipo = iconoId;
        }
        setSeccionesPrests(nuevasSecciones);
        
        setAcciones(prev => {
            return prev.map(a => {
                if (a.prestacion_id === prestacionActual.id) {
                    let nuevaObs = a.observacion || '';
                    nuevaObs = nuevaObs.replace(/ \| Icono: [a-zA-Z0-9_-]+/g, ''); 
                    if (iconoId) nuevaObs += ` | Icono: ${iconoId}`; 
                    if (a.id) supabase.from('presupuesto_items').update({ observacion: nuevaObs }).eq('id', a.id).then();
                    return { ...a, icono_tipo: iconoId, observacion: nuevaObs };
                }
                return a;
            });
        });
    }

    setModalIcono({ abierto: false, prestacion: null, autoAdd: false, itemTargetId: undefined });
    if (autoAdd && iconoId) handleSeleccionarTratamiento({ ...prestacionActual, icono_tipo: iconoId }, true);
    else toast.success(iconoId ? "Icono actualizado" : "Logo restablecido");
  }

  const procesarExportacion = async () => {
    setModalExportar({...modalExportar, abierto: false});
    const modo = modalExportar.tipo;
    const toastId = toast.loading(`Preparando documento...`);
    
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('odontograma-container');

      const opt = {
        margin:       [15, 15, 20, 15], 
        filename:     `Plan_Tratamiento_${pacienteId || 'General'}.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', scrollY: 0 }, 
        jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const pdf = await html2pdf().set(opt).from(element).toPdf().get('pdf');
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(9);
          pdf.setTextColor(120, 120, 120); 
          pdf.text(`Página ${i} de ${totalPages}`, pdf.internal.pageSize.getWidth() - 35, pdf.internal.pageSize.getHeight() - 8);
      }
        
      if(modo === 'imprimir') window.open(pdf.output('bloburl'), '_blank');
      else pdf.save();
      
      toast.success("Documento generado con éxito", { id: toastId });
    } catch (error) { toast.error("Error al procesar la exportación", { id: toastId }); }
  }

  const totalPlan = acciones.reduce((acc, curr) => acc + curr.display_pactado, 0) || Number(presupuestoData?.total || 0);
  const abonadoPlan = acciones.reduce((acc, curr) => acc + curr.display_abonado, 0) || Number(presupuestoData?.total_abonado || 0);
  const deudaPlan = totalPlan - abonadoPlan;

  const totalPorSeccion = (seccion: string) => { return acciones.filter(a => a.seccion_nombre === seccion).reduce((acc, curr) => acc + curr.display_pactado, 0); }

  if (cargando) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  return (
    <div id="odontograma-container" className="relative w-full text-left font-sans pb-32 bg-[#F8FAFC]">
      <div className="space-y-8 transition-all px-8 pt-8 max-w-7xl mx-auto">
          
          <div className="flex justify-between items-center">
            <Link href={`/pacientes/${pacienteId}`} className="group inline-flex items-center gap-3 font-black text-[10px] text-slate-400 uppercase hover:text-blue-600 transition-all">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:bg-blue-50"><ChevronLeft size={16}/></div> 
                Volver a la ficha
            </Link>
            
            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                <button onClick={() => setVistaTemporal(false)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!vistaTemporal ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <User size={14}/> Adulto
                </button>
                <button onClick={() => setVistaTemporal(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${vistaTemporal ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Baby size={14}/> Niño
                </button>
            </div>
          </div>

          <section data-html2canvas-ignore={!exportarOpciones.odontograma ? "true" : undefined} className="bg-white p-8 md:p-12 rounded-[4rem] shadow-sm border border-slate-100 relative overflow-visible flex flex-col items-center">
            
            <div className="w-full flex justify-between items-center mb-8 px-4" data-html2canvas-ignore="true">
                <button onClick={handleDeshacer} className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm flex items-center gap-2" title="Deshacer (Ctrl + Z)">
                    <Undo2 size={16} /> <span className="text-[10px] font-black uppercase hidden md:block">Deshacer</span>
                </button>
                <button onClick={() => setMostrarLeyenda(true)} className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-2">
                    <HelpCircle size={16} /> <span className="text-[10px] font-black uppercase hidden md:block">Ver Leyenda</span>
                </button>
            </div>

            <div className="flex justify-center gap-5 mb-8 bg-slate-50 py-2 px-6 rounded-full border border-slate-200 shadow-sm">
               <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Realizado</span></div>
               <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pendiente</span></div>
               <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lesión</span></div>
            </div>

            <div className="flex flex-col items-center gap-6 min-w-max">
                {/* ARCADA SUPERIOR */}
                <div className="flex gap-4">
                  <div className="flex gap-0.5 border-r-2 border-slate-100 pr-4">
                    {(!vistaTemporal ? c1 : t1).map(id => (
                      <DienteVisual key={id} id={id} seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} />
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {(!vistaTemporal ? c2 : t2).map(id => (
                      <DienteVisual key={id} id={id} seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} />
                    ))}
                  </div>
                </div>

                {/* ARCADA INFERIOR (invertida) */}
                <div className="flex gap-4 mt-8">
                  <div className="flex gap-0.5 border-r-2 border-slate-100 pr-4">
                    {(!vistaTemporal ? c3 : t3).map(id => (
                      <DienteVisual key={id} id={id} invert seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} />
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {(!vistaTemporal ? c4 : t4).map(id => (
                      <DienteVisual key={id} id={id} invert seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} />
                    ))}
                  </div>
                </div>
            </div>

            <div className="mt-12 flex flex-col md:flex-row gap-10 justify-center items-center w-full max-w-4xl">
              <div className="flex flex-col gap-2">
                 <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">Sextantes</h4>
                 <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      {[{ s: 1, Logo: LogoSextante1 }, { s: 2, Logo: LogoSextante2 }, { s: 3, Logo: LogoSextante3 }].map(({ s, Logo }) => (
                         <button key={s} onClick={() => abrirPanelAgregar(null, '', `Sextante ${s}`)} className="px-4 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-1.5 shadow-sm">
                           <Logo /> <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600">S{s}</span>
                         </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      {[{ s: 6, Logo: LogoSextante6 }, { s: 5, Logo: LogoSextante5 }, { s: 4, Logo: LogoSextante4 }].map(({ s, Logo }) => (
                         <button key={s} onClick={() => abrirPanelAgregar(null, '', `Sextante ${s}`)} className="px-4 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-1.5 shadow-sm">
                           <Logo /> <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600">S{s}</span>
                         </button>
                      ))}
                    </div>
                 </div>
              </div>

              <div className="w-px h-16 bg-slate-200 hidden md:block"></div>

              <div className="flex flex-col gap-2">
                <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">Arcadas</h4>
                <div className="flex flex-col gap-1.5">
                    <button onClick={() => abrirPanelAgregar(null, '', 'Arcada Superior')} className="px-5 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-2 shadow-sm">
                      <LogoArcadaSup /> <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600">Superior</span>
                    </button>
                    <button onClick={() => abrirPanelAgregar(null, '', 'Arcada Inferior')} className="px-5 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-2 shadow-sm">
                      <LogoArcadaInf /> <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600">Inferior</span>
                    </button>
                </div>
              </div>
            </div>
            
            <AnimatePresence>
                {(dientesSeleccionados.length > 1 || (dientesSeleccionados.length === 1 && !panelAgregarAbierto)) && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 p-3 rounded-3xl shadow-2xl z-[99999] flex items-center gap-4" data-html2canvas-ignore="true">
                        <div className="px-4 text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Seleccionados</p>
                            <p className="font-bold">{dientesSeleccionados.length} piezas</p>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-2xl">
                            <button onClick={() => procesarAplicacionHallazgo(dientesSeleccionados, 'Sano', true)} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all">
                                Sano
                            </button>
                            <button onClick={() => abrirPanelAgregar()} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5">
                                <Plus size={14}/> Tratar
                            </button>
                        </div>
                        <button onClick={() => { setDientesSeleccionados([]); if(panelAgregarAbierto) setDienteInput(''); }} className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 rounded-full transition-colors mr-1">
                            <X size={18}/>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="w-full flex items-center justify-center mt-12 mb-8 opacity-20" data-html2canvas-ignore="true">
               <div className="h-[3px] w-[60%] bg-slate-900 rounded-full"></div>
            </div>

            <div className="flex justify-center gap-4 w-full max-w-2xl" data-html2canvas-ignore="true">
               <button onClick={() => setModalNuevaSeccion(true)} className="flex-1 bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-[1.2rem] font-black text-[11px] uppercase shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
                 <Layers size={16} /> Crear Fase Clínica
               </button>
               <button onClick={() => abrirPanelAgregar(null)} className="flex-1 bg-white border-2 border-slate-900 text-slate-900 px-6 py-4 rounded-[1.2rem] font-black text-[11px] uppercase shadow-md hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2">
                 <Plus size={16} /> Tto. General / Receta
               </button>
               <button onClick={() => setModalEvolucion(true)} className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-[1.2rem] font-black text-[11px] uppercase shadow-lg shadow-blue-200 hover:bg-blue-800 transition-all flex items-center justify-center gap-2">
                 <FileSignature size={16} /> Evolucionar
               </button>
            </div>

          </section>

          <div data-html2canvas-ignore={!exportarOpciones.finanzas ? "true" : undefined} className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden text-left flex flex-col">
            
            <div className="p-10 md:p-12 bg-slate-900 text-white flex flex-col xl:flex-row justify-between items-start xl:items-center rounded-t-[3.5rem] gap-6">
                <div>
                    <h1 className="text-3xl font-black uppercase italic tracking-tighter">Plan de Tratamiento</h1>
                    <div className="flex items-center gap-3 mt-3">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${presupuestoData?.isAprobado ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                            {presupuestoData?.isAprobado && <Check size={12}/>}
                            {presupuestoData?.isAprobado ? 'Aprobado / En Curso' : 'Borrador'}
                        </span>
                        {presupuestoData?.isAprobado && (
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${deudaPlan > 0 ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                                {deudaPlan > 0 ? 'Con Deuda Activa' : 'Saldado'}
                            </span>
                        )}
                        <span className="ml-2 text-[9px] text-slate-500 font-bold tracking-widest uppercase">
                          <Database size={10} className="inline mr-1 mb-0.5"/> {debug}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-6 bg-slate-800 p-6 rounded-[2rem] border border-slate-700 w-full xl:w-auto overflow-x-auto custom-scrollbar">
                    <div className="text-right shrink-0">
                       <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Total Plan</p>
                       <p className="text-xl font-black text-white">${totalPlan.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="w-px h-10 bg-slate-700 shrink-0"></div>
                    <div className="text-right shrink-0">
                       <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Abonado</p>
                       <p className="text-xl font-black text-emerald-400">${abonadoPlan.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="w-px h-10 bg-slate-700 shrink-0"></div>
                    <div className="text-right shrink-0 pr-2">
                       <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Saldo</p>
                       <p className={`text-xl font-black ${deudaPlan > 0 && presupuestoData?.isAprobado ? 'text-red-400' : 'text-slate-300'}`}>${deudaPlan.toLocaleString('es-CL')}</p>
                    </div>
                </div>
                
                <div className="shrink-0 flex flex-col gap-2" data-html2canvas-ignore="true">
                    <button onClick={() => setModalExportar({abierto: true, tipo: 'imprimir'})} className="px-5 py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                        <Printer size={16}/> Imprimir
                    </button>
                    <button onClick={() => setModalExportar({abierto: true, tipo: 'descargar'})} className="px-5 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                        <Download size={16}/> Descargar PDF
                    </button>
                </div>
            </div>

            {!presupuestoData?.isAprobado && (
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-center" data-html2canvas-ignore="true">
                <button onClick={aprobarPlanManualmente} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-2">
                  <CheckCircle2 size={16}/> Forzar Aprobación Manual (Sin Pago)
                </button>
              </div>
            )}
            
            <div className="p-6">
              {listaSecciones.length === 0 ? (
                <div className="py-20 text-center">
                  <Layers size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">El presupuesto está vacío</p>
                </div>
              ) : (
                listaSecciones.map((seccion) => {
                  const itemsSeccion = acciones.filter(a => a.seccion_nombre === seccion);
                  return (
                  <div 
                    key={seccion} 
                    className="mb-10 last:mb-0 rounded-3xl transition-all border-2 border-transparent hover:border-dashed hover:border-slate-300"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, seccion)}
                  >
                    <h3 className="px-6 py-4 bg-slate-50 border-l-4 border-blue-500 font-black text-xs uppercase text-slate-700 tracking-widest rounded-r-2xl mb-4 flex justify-between items-center pointer-events-none">
                      <div className="flex items-center gap-3">
                        <Layers size={16} className="text-blue-500" /> {seccion}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">Total Fase: ${totalPorSeccion(seccion).toLocaleString('es-CL')}</span>
                    </h3>
                    
                    {itemsSeccion.length === 0 ? (
                      <div className="px-8 py-6 border-2 border-dashed border-slate-100 rounded-3xl text-center pointer-events-none">
                         <p className="text-[10px] font-black text-slate-300 uppercase italic">Arrastra tratamientos aquí</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic w-24 text-center">Zona / Pieza</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic">Prestación</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-center w-24">Avance</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-right">Pactado</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-right">Abonado</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-right">Saldo</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-center">Estado</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-center w-20" data-html2canvas-ignore="true">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {itemsSeccion.map((item, idx) => (
                              <tr 
                                key={idx} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.tempId)}
                                className="hover:bg-blue-50/40 transition-all group cursor-grab active:cursor-grabbing"
                              >
                                <td className="px-6 py-5 text-center">
                                  <div className={`px-2 py-2 mx-auto rounded-full bg-slate-100 flex flex-col items-center justify-center font-black text-xs text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all leading-none ${item.zona ? 'w-auto' : 'w-10 h-10'}`}>
                                    {editandoDienteId === item.tempId ? (
                                      <input 
                                         type="text" 
                                         autoFocus 
                                         className="w-8 h-6 bg-white text-slate-900 text-center rounded outline-none" 
                                         defaultValue={item.diente_id || ''} 
                                         onBlur={(e) => handleCambiarDiente(item.tempId, item.id, e.target.value)} 
                                         onKeyDown={(e) => { if(e.key === 'Enter') handleCambiarDiente(item.tempId, item.id, e.currentTarget.value) }} 
                                      />
                                    ) : (
                                      <span className="cursor-pointer" onClick={() => setEditandoDienteId(item.tempId)} title="Click para cambiar pieza">
                                        {item.zona ? item.zona : (item.diente_id || <Plus size={14} strokeWidth={4} />)}
                                      </span>
                                    )}
                                    {item.cara && <span className="text-[8px] opacity-70 mt-1">CARA {item.cara}</span>}
                                  </div>
                                </td>
                                <td className="px-6 py-5 font-black uppercase text-slate-800 text-[11px]">{item.display_nombre}</td>
                                
                                <td className="px-6 py-5 text-center">
                                  <select 
                                    disabled={item.estado === 'realizado'}
                                    value={item.avance || 0} 
                                    onChange={(e) => handleCambiarAvance(item.tempId, item.id, parseInt(e.target.value))} 
                                    className="bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none p-1 text-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:border-transparent"
                                  >
                                     <option value={0}>0%</option>
                                     <option value={25}>25%</option>
                                     <option value={50}>50%</option>
                                     <option value={75}>75%</option>
                                     <option value={100}>100%</option>
                                  </select>
                                </td>

                                <td className="px-6 py-5 text-right font-bold text-slate-500 text-[11px]">${Number(item.display_pactado).toLocaleString('es-CL')}</td>
                                <td className="px-6 py-5 text-right font-bold text-emerald-600 text-[11px]">${Number(item.display_abonado).toLocaleString('es-CL')}</td>
                                <td className="px-6 py-5 text-right font-black text-slate-900 text-[11px]">${Number(item.display_saldo).toLocaleString('es-CL')}</td>
                                <td className="px-6 py-5 text-center">
                                  <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${item.estado === 'realizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                    {item.estado || 'Pendiente'}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-center flex items-center justify-center gap-1" data-html2canvas-ignore="true">
                                  {item.estado !== 'realizado' ? (
                                    <>
                                      <button onClick={() => { setModalEditarItem({abierto: true, item}); setDctoInput(item.descuento || 0); }} className="text-slate-400 hover:text-blue-600 transition-colors p-2" title="Aplicar Descuento">
                                        <Settings size={14}/>
                                      </button>
                                      <button onClick={() => eliminarPrestacionLocal(item.id, item.tempId)} className="text-red-300 hover:text-red-500 transition-colors p-2" title="Eliminar Prestación">
                                        <Trash2 size={14}/>
                                      </button>
                                    </>
                                  ) : (
                                    <span className="px-4 py-1.5 rounded-full text-[8px] font-black uppercase border bg-emerald-50 text-emerald-600 border-emerald-100">Realizado</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
                })
              )}
            </div>
          </div>
      </div>

      {/* MODAL EDITAR DESCUENTO */}
      <AnimatePresence>
        {modalEditarItem.abierto && (
          <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Ajustes Clínicos</h3>
                  <button onClick={() => setModalEditarItem({abierto: false, item: null})} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                <div className="p-8 space-y-6">
                   <div>
                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Prestación Seleccionada</p>
                       <p className="text-sm font-bold text-slate-800 leading-tight">{modalEditarItem.item?.display_nombre}</p>
                   </div>
                   
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descuento (%)</label>
                      <select value={dctoInput} onChange={(e) => setDctoInput(parseInt(e.target.value))} className="w-full p-5 rounded-2xl bg-slate-50 font-black text-xs uppercase border border-slate-200 outline-none focus:border-blue-500 transition-all cursor-pointer">
                          <option value={0}>Sin Descuento (0%)</option>
                          <option value={5}>5%</option>
                          <option value={10}>10%</option>
                          <option value={15}>15%</option>
                          <option value={20}>20%</option>
                          <option value={25}>25%</option>
                          <option value={30}>30%</option>
                          <option value={40}>40%</option>
                          <option value={50}>50%</option>
                          <option value={75}>75%</option>
                          <option value={100}>100% (Cortesía)</option>
                      </select>
                   </div>

                   <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase text-blue-800">Precio Final:</span>
                       <span className="text-lg font-black text-blue-600">${((modalEditarItem.item?.precio_base || modalEditarItem.item?.precio || 0) * (1 - (dctoInput / 100))).toLocaleString('es-CL')}</span>
                   </div>

                   <button onClick={handleGuardarDescuento} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-blue-700 transition-all">
                     Guardar Cambios
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL LEYENDA */}
      <AnimatePresence>
        {mostrarLeyenda && (
          <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col max-h-[85vh]">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Leyenda del Odontograma</h3>
                  <button onClick={() => setMostrarLeyenda(false)} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                <div className="p-8 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-6 custom-scrollbar">
                   {ICONOS_DISPONIBLES.map(ico => (
                      <div key={ico.id} className="flex items-center gap-4">
                        <div className="w-12 h-12 shrink-0 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-2">
                           <svg viewBox="-10 -10 120 140" className="w-full h-full drop-shadow-sm"><LogoRender hallazgo={ico.icon} colorOverride="#2563eb" /></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-600 leading-tight">{ico.label}</span>
                      </div>
                   ))}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OPCIONES DE EXPORTACIÓN */}
      <AnimatePresence>
        {modalExportar.abierto && (
          <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Opciones de Exportación</h3>
                  <button onClick={() => setModalExportar({abierto: false, tipo: null})} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                <div className="p-8 space-y-6">
                   <div className="space-y-4">
                      <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                          <span className="text-xs font-black uppercase text-slate-700">Incluir Odontograma</span>
                          <input type="checkbox" checked={exportarOpciones.odontograma} onChange={(e) => setExportarOpciones({...exportarOpciones, odontograma: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                      </label>
                      <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                          <span className="text-xs font-black uppercase text-slate-700">Incluir Tabla Financiera</span>
                          <input type="checkbox" checked={exportarOpciones.finanzas} onChange={(e) => setExportarOpciones({...exportarOpciones, finanzas: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                      </label>
                   </div>
                   <button onClick={procesarExportacion} disabled={!exportarOpciones.odontograma && !exportarOpciones.finanzas} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                     Continuar ({modalExportar.tipo === 'imprimir' ? 'Imprimir' : 'Descargar'})
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menuContextual && (
          <div style={{ position: 'absolute', top: menuContextual.y + 20, left: menuContextual.lado === 'derecha' ? menuContextual.x : menuContextual.x - (vistaMenu === 'principal' ? 200 : 480), zIndex: 9999999 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1, width: (vistaMenu !== 'principal') ? 480 : 200 }} exit={{ opacity: 0 }} className={`bg-white border border-slate-100 shadow-[0_40px_100px_-15px_rgba(0,0,0,0.5)] rounded-[2rem] p-2 flex overflow-hidden ${menuContextual.lado === 'derecha' ? 'flex-row' : 'flex-row-reverse'}`} onClick={(e) => e.stopPropagation()}>
              
              <div className={`w-[200px] shrink-0 p-3 space-y-1 ${menuContextual.lado === 'derecha' ? 'border-r' : 'border-l'} border-slate-50`}>
                <p className="px-3 py-2 text-[10px] font-black uppercase text-blue-600 border-b mb-2 italic text-center">
                  {menuContextual.cara ? `Pieza ${menuContextual.diente} - Cara ${menuContextual.cara}` : `Pieza ${menuContextual.diente}`}
                </p>
                
                {menuContextual.cara ? (
                  <>
                    <button onClick={aplicarLesionCara} className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all group hover:bg-slate-900 text-left font-black uppercase text-[9px] text-slate-700 hover:text-white">
                      <span>Lesión (Negro)</span><ChevronRight size={14}/>
                    </button>
                    <button onClick={() => { abrirPanelAgregar(menuContextual.diente, menuContextual.cara); setMenuContextual(null); }} className="w-full flex items-center gap-2 px-3 py-3 hover:bg-blue-50 rounded-xl transition-all text-left text-blue-600 font-black uppercase text-[9px]">
                      <Settings size={14}/> Agregar Prestación
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setVistaMenu('preexistencias')} className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all group hover:bg-blue-50 text-left font-black uppercase text-[9px] text-slate-700">
                      <span>Preexistencia</span><ChevronRight size={14}/>
                    </button>
                    <button onClick={() => setVistaMenu('lesiones')} className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all group hover:bg-red-50 text-left font-black uppercase text-[9px] text-slate-700">
                      <span>Definir lesión</span><ChevronRight size={14}/>
                    </button>
                    <button onClick={() => { abrirPanelAgregar(menuContextual.diente); setMenuContextual(null); }} className="w-full flex items-center gap-2 px-3 py-3 hover:bg-slate-50 rounded-xl transition-all text-left text-slate-600 font-black uppercase text-[9px]">
                      <Settings size={14}/> Prestación Completa
                    </button>
                    <button onClick={() => { setVerInfoDiente(menuContextual.diente); setMenuContextual(null); }} className="w-full flex items-center gap-2 px-3 py-3 hover:bg-slate-50 rounded-xl transition-all text-left text-slate-600 font-black uppercase text-[9px]">
                      <Info size={14} className="text-blue-500"/> Ver Info
                    </button>
                    <button onClick={() => { aplicarHallazgo('Diente sano'); setMenuContextual(null); }} className="w-full flex items-center gap-2 px-3 py-3 hover:bg-slate-50 rounded-xl transition-all text-left text-slate-600 font-black uppercase text-[9px]">
                      <span className="w-4 text-center font-black text-slate-900">S</span> Diente Sano
                    </button>
                  </>
                )}
              </div>
              
              <AnimatePresence mode="wait">
                {vistaMenu !== 'principal' && (
                  <motion.div key={vistaMenu} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 p-4 bg-slate-50/50 overflow-hidden flex flex-col min-w-[280px]">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 italic">{vistaMenu.toUpperCase()}</p>
                      <button onClick={() => setVistaMenu('principal')} className="bg-slate-200 text-slate-600 text-[8px] px-3 py-1 rounded-full font-black uppercase">Volver</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1 max-h-[300px] custom-scrollbar">
                      {(vistaMenu === 'preexistencias' ? PREEXISTENCIAS_LISTA : LESIONES_LISTA).map((op) => (
                        <button key={op} onClick={() => { aplicarHallazgo(op); setMenuContextual(null); }} className="flex flex-col items-center justify-center p-3 bg-white hover:border-blue-300 rounded-[1.5rem] border border-slate-100 shadow-sm transition-all group">
                          <div className="w-8 h-10 mb-1 group-hover:scale-110 transition-transform">
                             <svg viewBox="-10 -10 120 140" className="w-full h-full drop-shadow-sm">
                                <LogoRender hallazgo={op} colorOverride="#2563eb" />
                             </svg>
                          </div>
                          <span className="text-[7px] font-black uppercase text-slate-500 group-hover:text-blue-600 text-center leading-tight">{op}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PANEL DE INFORMACIÓN DEL DIENTE CON EDICIÓN DE LOGO */}
      <AnimatePresence>
        {verInfoDiente && (
          <motion.aside initial={{ x: -450, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -450, opacity: 0 }} className="fixed top-[130px] left-0 h-[calc(100vh-130px)] w-[420px] bg-white shadow-[20px_0_50px_rgba(0,0,0,0.1)] z-[99999] flex flex-col border-r border-slate-100 overflow-hidden text-left">
            
            <div className="flex justify-between items-center p-6 bg-slate-900 border-b border-slate-800 shrink-0 text-white">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl italic">{verInfoDiente}</div>
                  <h3 className="font-black text-lg uppercase italic tracking-tighter">Info de Pieza</h3>
               </div>
               <button onClick={() => setVerInfoDiente(null)} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-500 transition-all text-white"><X size={16}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 border-b border-slate-100 pb-2"> 
                  <Info size={14} className="text-blue-500"/>
                  <span className="text-[10px] font-black uppercase tracking-widest">Hallazgos Clínicos</span>
                </div>
                {(odontogramaEstado[verInfoDiente.toString()]?.hallazgos || (odontogramaEstado[verInfoDiente.toString()]?.estado_general ? [odontogramaEstado[verInfoDiente.toString()].estado_general] : (odontogramaEstado[verInfoDiente.toString()]?.center ? [odontogramaEstado[verInfoDiente.toString()].center] : [])))?.map((h: string, idx: number) => (
                  <div key={idx} className="p-4 bg-blue-50 rounded-[1.5rem] border border-blue-100 flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <svg viewBox="-10 -10 120 140" className="w-full h-full p-1.5"><LogoRender hallazgo={h} /></svg>
                      </div>
                      <p className="text-[11px] font-black uppercase text-blue-900 italic leading-none">{h}</p>
                    </div>
                    <button onClick={() => eliminarHallazgoEspecifico(verInfoDiente, h)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-2 hover:bg-white rounded-lg">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                )) || <p className="text-[10px] font-bold text-slate-300 uppercase italic px-2">Sin hallazgos clínicos</p>}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 border-b border-slate-100 pb-2">
                  <Stethoscope size={14} className="text-emerald-500"/>
                  <span className="text-[10px] font-black uppercase tracking-widest">Historial de Tratamientos</span>
                </div>
                {todasLasAccionesBoca.filter(a => String(a.diente_id) === String(verInfoDiente)).length > 0 ? (
                  todasLasAccionesBoca.filter(a => String(a.diente_id) === String(verInfoDiente)).map((item, i) => (
                    <div key={i} className="p-5 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm relative group transition-all hover:border-blue-300 hover:shadow-md">
                      
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                        <button 
                            onClick={() => setModalIcono({abierto: true, prestacion: { display_nombre: item.display_nombre }, itemTargetId: item.tempId})} 
                            className="text-slate-400 hover:text-blue-500 transition-all bg-white rounded-full p-1.5 shadow-sm border border-slate-100" 
                            title="Asignar o Cambiar Logo"
                        >
                            <RefreshCcw size={14}/>
                        </button>
                        {item.estado !== 'realizado' && item.presupuesto_id === idURL && (
                            <button onClick={() => eliminarPrestacionLocal(item.id, item.tempId)} className="text-red-400 hover:text-red-600 transition-all bg-white rounded-full p-1.5 shadow-sm border border-slate-100" title="Eliminar Prestación">
                              <Trash2 size={14}/>
                            </button>
                        )}
                      </div>

                      <p className="text-[10px] font-black uppercase text-slate-800 leading-tight mb-3 pr-12">{item.display_nombre}</p>
                      <div className="flex justify-between items-center">
                        <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase border ${item.estado === 'realizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                          {item.estado || 'Pendiente'}
                        </span>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-900">${Number(item.display_pactado).toLocaleString('es-CL')}</p>
                           {item.display_saldo > 0 && <p className="text-[8px] font-bold text-red-400 uppercase">Sal: ${Number(item.display_saldo).toLocaleString('es-CL')}</p>}
                        </div>
                      </div>
                    </div>
                  ))
                ) : <p className="text-[10px] font-bold text-slate-300 uppercase italic px-2">No hay tratamientos asignados</p>}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={() => { abrirPanelAgregar(verInfoDiente); setVerInfoDiente(null); }} className="w-full bg-blue-600 text-white py-4 rounded-[1.2rem] font-black text-[10px] uppercase shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Plus size={16}/> Nueva Prestación
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MODAL PARA CAMBIAR ICONO DE PRESTACIÓN */}
      <AnimatePresence>
        {modalIcono.abierto && (
          <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-32">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col max-h-[70vh]">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Asignar Logo a Prestación</h3>
                  <button onClick={() => setModalIcono({abierto: false, prestacion: null, autoAdd: false, itemTargetId: undefined})} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                <div className="p-6 bg-slate-50 border-b border-slate-100 shrink-0">
                  <p className="text-xs font-bold text-slate-600 text-center">
                    {modalIcono.autoAdd ? (
                        <><span className="text-red-500 font-black mb-1 block text-sm">¡Falta asignar un Logo!</span>Antes de agregar el tratamiento, elige un icono permanente para:</>
                    ) : (
                        "Selecciona un icono permanente para:"
                    )}
                    <br/><span className="text-base font-black text-slate-900 uppercase block mt-2 border-b-2 border-slate-200 pb-2">{modalIcono.prestacion?.display_nombre}</span>
                  </p>
                </div>
                <div className="p-6 overflow-y-auto grid grid-cols-3 md:grid-cols-4 gap-3 custom-scrollbar">
                   {ICONOS_DISPONIBLES.map(ico => (
                      <button key={ico.id} onClick={() => handleGuardarIcono(ico.id)} className="flex flex-col items-center justify-center p-3 bg-white hover:border-blue-400 rounded-2xl border-2 border-slate-100 shadow-sm transition-all group hover:bg-blue-50">
                        <div className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform">
                           <svg viewBox="-10 -10 120 140" className="w-full h-full drop-shadow-sm"><LogoRender hallazgo={ico.icon} colorOverride="#2563eb" /></svg>
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600 text-center leading-tight">{ico.label}</span>
                      </button>
                   ))}
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                   <button onClick={() => handleGuardarIcono(null)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={14}/> Quitar Logo Actual
                   </button>
                   <button onClick={() => setModalIcono({abierto: false, prestacion: null, autoAdd: false, itemTargetId: undefined})} className="px-5 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all rounded-xl text-[10px] font-black uppercase">
                      Cancelar
                   </button>
                </div>

             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CREAR SECCIÓN */}
      <AnimatePresence>
        {modalNuevaSeccion && (
          <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden text-left">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Nueva Sección</h3>
                  <button onClick={() => setModalNuevaSeccion(false)} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                <div className="p-8 space-y-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre de la Fase / Sección</label>
                     <input type="text" autoFocus placeholder="Ej: Fase 2: Cirugía" className="w-full p-5 rounded-2xl bg-slate-50 font-black text-xs border border-slate-200 outline-none focus:border-blue-500 transition-all" value={nuevaSeccionNombre} onChange={(e) => setNuevaSeccionNombre(e.target.value)} />
                   </div>
                   <button onClick={handleCrearSeccion} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-blue-700 transition-all">
                     Guardar Sección
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PANEL UNIVERSAL AGREGAR PRESTACIÓN */}
      <AnimatePresence>
        {panelAgregarAbierto && (
          <motion.aside initial={{ x: -450, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -450, opacity: 0 }} className="fixed top-[130px] left-0 h-[calc(100vh-130px)] w-[400px] bg-white shadow-[20px_0_50px_rgba(0,0,0,0.1)] z-[9999] flex flex-col border-r border-slate-100 overflow-hidden text-left">
            
            <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200 shrink-0">
               {zonaInput ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-lg border border-emerald-200">Añadiendo a: {zonaInput}</span>
               ) : <span className="text-xs font-black uppercase text-slate-400">Menú Prestaciones</span>}
               <button onClick={() => { setPanelAgregarAbierto(false); setDientesSeleccionados([]); }} className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all text-slate-500 shadow-sm"><X size={16}/></button>
            </div>

            <div className="p-5 space-y-4 border-b border-slate-100 bg-white shrink-0 shadow-sm z-10">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-800 ml-1">Fase / Sección</label>
                    <select className="w-full px-3 py-2.5 rounded-xl bg-slate-50 font-bold text-xs uppercase border border-slate-200 text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer" value={seccionInput} onChange={(e) => setSeccionInput(e.target.value)}>
                        {listaSecciones.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-800 ml-1">Dentista</label>
                    <select className="w-full px-3 py-2.5 rounded-xl bg-slate-50 font-bold text-xs uppercase border border-slate-200 text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer" value={profesionalSeleccionado} onChange={(e) => setProfesionalSeleccionado(e.target.value)}>
                        <option value="">Seleccionar...</option>
                        {profesionales.map(p => <option key={p.user_id} value={p.user_id}>Dr. {p.apellido}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-800 ml-1">Pieza Dental</label>
                    <input type="text" disabled={!!zonaInput} placeholder={zonaInput ? "-" : "General"} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 font-bold text-xs uppercase border border-slate-200 text-slate-900 outline-none focus:border-blue-500 transition-all text-center disabled:bg-slate-100 disabled:text-slate-400" value={dienteInput} onChange={(e) => setDienteInput(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-800 ml-1">Cara</label>
                    <select disabled={!!zonaInput} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 font-bold text-xs uppercase border border-slate-200 text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400" value={caraInput} onChange={(e) => setCaraInput(e.target.value)}>
                        <option value="">Completa</option>
                        <option value="O">Oclusal (O)</option>
                        <option value="V">Vestibular (V)</option>
                        <option value="L">Lingual (L)</option>
                        <option value="M">Mesial (M)</option>
                        <option value="D">Distal (D)</option>
                    </select>
                  </div>
                </div>

                <div className="relative mt-2 group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Search size={18} className="text-slate-500 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input 
                     type="text" 
                     placeholder="Buscar tratamiento o categoría..." 
                     className="w-full py-3.5 pl-10 pr-9 rounded-xl bg-white text-xs font-black border-2 border-slate-200 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400" 
                     value={busqueda} 
                     onChange={(e) => setBusqueda(e.target.value)} 
                  />
                  {busqueda && (
                     <button onClick={() => setBusqueda('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-red-500 transition-colors">
                        <X size={18} />
                     </button>
                  )}
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 space-y-3 custom-scrollbar">
                {Object.keys(seccionesPrests).sort((a,b)=>a.localeCompare(b)).map(cat => {
                    const filtradas = seccionesPrests[cat].filter((p:any) => 
                        (p.display_nombre || '').toUpperCase().includes(busqueda.toUpperCase()) || 
                        cat.toUpperCase().includes(busqueda.toUpperCase())
                    );

                    if(busqueda && filtradas.length === 0) return null;

                    return (
                        <div key={cat} className="mb-4">
                            <button onClick={() => setCategoriasAbiertas(prev => ({...prev, [cat]: !prev[cat]}))} className="w-full text-left px-5 py-4 rounded-xl font-black text-xs uppercase bg-white border border-slate-200 shadow-sm text-slate-800 flex justify-between items-center transition-all hover:bg-slate-100 hover:border-slate-300">
                                {cat} 
                                {categoriasAbiertas[cat] ? <ChevronUp size={16} className="text-slate-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                            </button>
                            
                            <AnimatePresence>
                              {(categoriasAbiertas[cat] || busqueda) && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden space-y-2 mt-2">
                                    {filtradas.map((p:any) => (
                                        <div key={p.id} className="w-full flex items-center bg-white border-2 border-slate-100 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-all shadow-sm group">
                                            
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setModalIcono({abierto: true, prestacion: p}); }}
                                                title="Cambiar Logo Permanentemente"
                                                className="w-12 h-12 flex shrink-0 items-center justify-center bg-slate-100 hover:bg-blue-600 rounded-l-lg transition-colors overflow-hidden group/logo relative"
                                            >
                                               <div className="w-8 h-8 group-hover/logo:opacity-0 transition-opacity">
                                                  <svg viewBox="-10 -10 120 140" className="w-full h-full drop-shadow-sm">
                                                     <LogoRender iconoKey={p.icono_tipo} hallazgo={p.display_nombre} colorOverride="#ef4444" />
                                                  </svg>
                                               </div>
                                               
                                               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity text-white flex-col">
                                                  <RefreshCcw size={16} />
                                                  <span className="text-[6px] font-black uppercase mt-0.5 tracking-widest">Editar</span>
                                               </div>
                                            </button>
                                            
                                            <button onClick={() => handleSeleccionarTratamiento(p)} className="flex-1 text-left py-3 px-3 flex justify-between items-center h-full">
                                                <span className="text-xs font-black uppercase text-slate-800 group-hover:text-blue-700 leading-snug">{p.display_nombre}</span>
                                                <Plus size={18} className="shrink-0 text-slate-300 group-hover:text-blue-600"/>
                                            </button>
                                        </div>
                                    ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MODAL DE EVOLUCIÓN */}
      <AnimatePresence>
        {modalEvolucion && (
          <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center"><FileSignature size={24}/></div>
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Evolución Clínica</h2>
                      <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">Firma electrónica de procedimientos</p>
                    </div>
                  </div>
                  <button onClick={() => setModalEvolucion(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-500 transition-all"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">1. Seleccionar Procedimientos</h4>
                    <div className="space-y-3">
                      {acciones.filter(a => a.estado !== 'realizado').length === 0 ? (
                        <div className="p-8 bg-slate-50 rounded-3xl text-center border-2 border-dashed border-slate-200">
                          <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2"/>
                          <p className="text-[10px] font-black text-slate-400 uppercase">No hay procedimientos pendientes</p>
                        </div>
                      ) : (
                        acciones.filter(a => a.estado !== 'realizado').map(item => {
                          const isSelected = itemsAEvolucionar.includes(item.id);
                          return (
                            <div key={item.id} onClick={() => setItemsAEvolucionar(prev => isSelected ? prev.filter(i => i !== item.id) : [...prev, item.id])} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
                               <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                  {isSelected && <CheckCircle2 size={16} className="text-white" />}
                               </div>
                               <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase leading-none">
                                   {item.zona ? item.zona : `Pieza ${item.diente_id || 'General'}`} {item.cara && `- Cara ${item.cara}`}
                                 </p>
                                 <p className="text-xs font-black text-slate-800 uppercase mt-1 leading-tight">{item.display_nombre}</p>
                               </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">2. Registro Clínico Legal</h4>
                    <div className="space-y-4">
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Profesional Actuante</label>
                        <select className="w-full p-5 rounded-2xl bg-slate-50 font-black text-xs uppercase border-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer" value={profesionalSeleccionado} onChange={(e) => setProfesionalSeleccionado(e.target.value)}>
                            <option value="">Seleccione su nombre...</option>
                            {profesionales.map(p => <option key={p.user_id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2 text-left flex-1 flex flex-col">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Observaciones / Evolución</label>
                        <textarea placeholder="Ej: Se realiza exodoncia de pieza 18 sin complicaciones..." className="w-full p-5 rounded-2xl bg-slate-50 font-medium text-sm border-none focus:ring-2 focus:ring-blue-500 transition-all resize-none h-48 custom-scrollbar" value={evolucionNota} onChange={(e) => setEvolucionNota(e.target.value)} />
                      </div>
                    </div>
                  </div>
               </div>

               <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button onClick={handleEvolucionar} disabled={guardandoEvolucion || itemsAEvolucionar.length === 0} className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                    {guardandoEvolucion ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {guardandoEvolucion ? 'Firmando...' : 'Guardar y Firmar Evolución'}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

function LogoRender({ hallazgo, iconoKey, colorOverride, logContext = "General" }: { hallazgo?: string, iconoKey?: string, colorOverride?: string, logContext?: string }) {
  const originalName = (hallazgo || "").toLowerCase();
  const explicitIcon = (iconoKey || "").toLowerCase();
  const h = explicitIcon || originalName; 
  
  const isLesion = LESIONES_LISTA.some(l => l.toLowerCase() === originalName);
  const isMalEstado = originalName.includes("(mal estado)");
  
  let color = isLesion ? "#0f172a" : "#2563eb"; 
  if (colorOverride && !isLesion) color = colorOverride; 

  const patternId = `pattern-hash-${color.replace('#', '')}`;
  const fillStyle = isMalEstado ? `url(#${patternId})` : color;
  
  const HashPattern = () => (
    <defs>
      <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="3" />
      </pattern>
    </defs>
  );

  let shape = null;
  let matched = true; 

  // 🚨 LOG DETECTIVE DE PALABRAS
  if (h && h !== "default") {
     console.log(`🎨 [${logContext}] Analizando para dibujar: Palabra="${h}" | IconoExplícito="${explicitIcon}"`);
  }

  switch (true) {
    case h.includes("caries") || h.includes("restauración") || h.includes("restauracion") || h.includes("tapadura") || h.includes("amalgama") || h.includes("resina") || h.includes("ionomero"): 
        shape = <path d="M 35 75 Q 50 60 65 75 Q 75 90 50 100 Q 25 90 35 75 Z" fill={fillStyle} />; 
        break; 

    case h.includes("corona provisoria"): 
        shape = <g>
            <circle cx="50" cy="80" r="30" fill={isMalEstado ? fillStyle : "none"} stroke={color} strokeWidth="4" />
            <text x="50" y="88" textAnchor="middle" fontSize="24" fontWeight="900" fill={isMalEstado ? "#fff" : color}>P</text>
        </g>; 
        break;

    case h.includes("corona"): 
        shape = <circle cx="50" cy="80" r="30" fill={isMalEstado ? fillStyle : "none"} stroke={color} strokeWidth="4" />; 
        break;

    case h.includes("endodoncia") || h.includes("infección") || h.includes("infeccion"): 
        shape = <path d="M 40 15 L 40 45 A 10 10 0 0 0 60 45 L 60 15" fill={isMalEstado ? fillStyle : "none"} stroke={color} strokeWidth="8" strokeLinecap="round" />; 
        break;

    case h.includes("implante"): 
        shape = <g fill={fillStyle}>
            <path d="M 45 15 L 55 15 L 55 50 L 50 60 L 45 50 Z" />
            <line x1="38" y1="25" x2="62" y2="25" stroke={color} strokeWidth="4" strokeLinecap="round" />
            <line x1="38" y1="35" x2="62" y2="35" stroke={color} strokeWidth="4" strokeLinecap="round" />
            <line x1="42" y1="45" x2="58" y2="45" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </g>; 
        break;

    case h.includes("perno") || h.includes("muñón") || h.includes("munon"): 
        shape = <path d="M 45 15 L 55 15 L 55 60 L 65 85 L 35 85 L 45 60 Z" fill={fillStyle} stroke={color} strokeWidth="2" strokeLinejoin="round" />; 
        break;

    case h.includes("removible") || h.includes("protesis") || h.includes("prótesis"): 
        shape = <g stroke={color} strokeWidth="4" strokeLinecap="round">
            <line x1="30" y1="110" x2="70" y2="110" />
            <line x1="30" y1="118" x2="70" y2="118" />
        </g>; 
        break;

    case h.includes("sellante"): 
        shape = <path d="M 25 95 Q 37 85 50 95 T 75 95" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />; 
        break;

    case h.includes("fractura"): 
        shape = <path d="M 60 10 L 40 60 L 60 60 L 40 110" stroke={color} strokeWidth="6" fill="none" strokeLinejoin="miter" />; 
        break;

    case h.includes("movilidad"): 
        shape = <g stroke={color} strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M 15 50 Q 0 75 15 100" />
            <path d="M 5 55 Q -10 75 5 95" />
            <path d="M 85 50 Q 100 75 85 100" />
            <path d="M 95 55 Q 110 75 95 95" />
        </g>; 
        break;

    case h.includes("residuo radicular") || h.includes("rr"): 
        shape = <g>
            <rect x="30" y="65" width="40" height="25" rx="6" fill={color} />
            <text x="50" y="83" fill="#fff" fontSize="16" fontWeight="900" textAnchor="middle">RR</text>
        </g>; 
        break;

    case h.includes("erosión") || h.includes("erosion"): 
        shape = <line x1="30" y1="80" x2="70" y2="80" stroke={color} strokeWidth="8" strokeLinecap="round" />; 
        break;

    case h.includes("atrición") || h.includes("atricion"): 
        shape = <path d="M 20 95 Q 50 115 80 95" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />; 
        break;

    case h.includes("abfracción") || h.includes("abfraccion"): 
        shape = <line x1="25" y1="55" x2="75" y2="55" stroke={color} strokeWidth="6" strokeLinecap="round" />; 
        break;

    case h.includes("ausente") || h.includes("extraccion") || h.includes("extracción") || h.includes("exodoncia"): 
        shape = <g stroke={color} strokeWidth="8" strokeLinecap="round">
            <line x1="20" y1="20" x2="80" y2="100" />
            <line x1="80" y1="20" x2="20" y2="100" />
        </g>; 
        break;

    case h.includes("sano"): 
        shape = <text x="50" y="85" textAnchor="middle" fontSize="60" fontStyle="italic" fontWeight="900" fill={color}>S</text>; 
        break;

    case h.includes("otro") || h === "otro": 
        shape = <polygon points="50,105 53,112 60,112 55,117 57,125 50,120 43,125 45,117 40,112 47,112" fill={color} />; 
        break;

    case h === "default": 
        shape = <circle cx="50" cy="50" r="20" fill={color} opacity="0.8" />; 
        break;

    default: 
        matched = false;
        console.log(`❌ [LOGO NO RECONOCIDO EN ${logContext}] Palabra="${h}". Cayó al caso Genérico (?)`);
        break;
  }

  if (!matched) {
    shape = <g>
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="6" strokeDasharray="8 6" opacity="0.5"/>
        <text x="50" y="70" textAnchor="middle" fontSize="55" fontWeight="900" fill={color} opacity="0.5">?</text>
    </g>;
  }

  return (
    <g>
      {isMalEstado && <HashPattern />}
      {shape}
    </g>
  );
}

const commonSvgProps = { viewBox: "0 0 100 100", className: "w-4 h-4 text-slate-400 group-hover:text-blue-500", stroke: "currentColor", fill: "none", strokeWidth: "10" };
function LogoSextante1() { return <svg {...commonSvgProps}><polyline points="10,0 100,100 0,100"/></svg>; }
function LogoSextante2() { return <svg {...commonSvgProps}><polyline points="10,20 50,100 90,20"/></svg>; }
function LogoSextante3() { return <svg {...commonSvgProps}><polyline points="90,0 0,100 100,100"/></svg>; }
function LogoSextante4() { return <svg {...commonSvgProps}><polyline points="10,0 100,0 20,100"/></svg>; }
function LogoSextante5() { return <svg {...commonSvgProps}><polyline points="10,80 50,0 90,80"/></svg>; }
function LogoSextante6() { return <svg {...commonSvgProps}><polyline points="90,0 0,0 80,100"/></svg>; }
function LogoArcadaSup() { return <svg viewBox="0 0 100 100" className="w-5 h-5 text-slate-400 group-hover:text-blue-500"><path d="M10,80 Q50,0 90,80" stroke="currentColor" fill="none" strokeWidth="12" /></svg>; }
function LogoArcadaInf() { return <svg viewBox="0 0 100 100" className="w-5 h-5 text-slate-400 group-hover:text-blue-500 rotate-180"><path d="M10,80 Q50,0 90,80" stroke="currentColor" fill="none" strokeWidth="12" /></svg>; }

function CarasDentales({ id, items, estado, abrirPanelAgregar, invert }: any) {
  const screenLeft = (id >= 11 && id <= 18) || (id >= 41 && id <= 48) || (id >= 51 && id <= 55) || (id >= 81 && id <= 85);
  const faceLeft = screenLeft ? 'D' : 'M';
  const faceRight = screenLeft ? 'M' : 'D';

  const getFill = (c: string) => {
    if (estado?.caras?.[c] === 'lesion' || estado?.hallazgos?.some((h: string) => h.toLowerCase().includes('caries'))) return "#0f172a"; 
    
    // 🔥 Pinta las caras del diente basándose en las letras detectadas ("V", "M", etc.)
    if (items.some((i:any) => i.cara?.includes(c) && i.estado === 'realizado')) {
        // console.log(`🟩 [CARA VERDE] Pintando cara ${c} en diente ${id}`); 
        return "#10b981"; 
    }
    if (items.some((i:any) => i.cara?.includes(c) && i.estado !== 'realizado')) return "#ef4444"; 
    
    return "white";
  }

  return (
    <svg viewBox="0 0 100 100" className={`w-9 h-9 drop-shadow-sm ${invert ? 'rotate-180' : ''}`}>
       <path d="M 16 16 A 48 48 0 0 1 84 16 L 64 36 A 20 20 0 0 0 36 36 Z" fill={getFill('V')} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-opacity" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, 'V'); }}><title>Cara Vestibular (V)</title></path>
       <path d="M 84 84 A 48 48 0 0 1 16 84 L 36 64 A 20 20 0 0 0 64 64 Z" fill={getFill('L')} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-opacity" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, 'L'); }}><title>Cara Lingual / Palatina (L)</title></path>
       <path d="M 16 84 A 48 48 0 0 1 16 16 L 36 36 A 20 20 0 0 0 36 64 Z" fill={getFill(faceLeft)} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-opacity" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, faceLeft); }}><title>{`Cara ${faceLeft === 'M' ? 'Mesial' : 'Distal'} (${faceLeft})`}</title></path>
       <path d="M 84 16 A 48 48 0 0 1 84 84 L 64 64 A 20 20 0 0 0 64 36 Z" fill={getFill(faceRight)} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-opacity" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, faceRight); }}><title>{`Cara ${faceRight === 'M' ? 'Mesial' : 'Distal'} (${faceRight})`}</title></path>
       <circle cx="50" cy="50" r="20" fill={getFill('O')} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-opacity" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, 'O'); }}><title>Cara Oclusal / Incisal (O)</title></circle>
    </svg>
  )
}

function DienteVisual({ id, seleccionado, onSelect, onContextMenu, invert = false, itemsDiente = [], estadoDiente, abrirPanelAgregar }: any) {
  const tieneTratamiento = itemsDiente.some((i:any) => !i.cara && !i.zona); 
  const hallazgos = estadoDiente?.hallazgos || (estadoDiente?.estado_general ? [estadoDiente.estado_general] : (estadoDiente?.center ? [estadoDiente.center] : []));
  
  const isRealizado = itemsDiente.some((i:any) => i.estado === 'realizado');
  const isPendiente = itemsDiente.some((i:any) => i.estado !== 'realizado');
  
  let gradientStart = "#ffffff", gradientEnd = "#f1f5f9", strokeColor = "#cbd5e1";
  
  if (hallazgos.length > 0) {
      gradientStart = "#f8fafc"; gradientEnd = "#e2e8f0"; strokeColor = "#94a3b8"; 
  } else if (isPendiente) {
      gradientStart = "#eff6ff"; gradientEnd = "#dbeafe"; strokeColor = "#3b82f6"; 
  } else if (isRealizado) {
      gradientStart = "#ecfdf5"; gradientEnd = "#d1fae5"; strokeColor = "#10b981"; 
  }

  const getToothPath = (num: number) => {
    const n = num % 10;
    if (n === 1 || n === 2) return "M 35 15 Q 50 5 65 15 L 75 60 Q 80 90 75 105 L 25 105 Q 20 90 25 60 Z";
    else if (n === 3) return "M 35 15 Q 50 5 65 15 L 75 50 Q 80 75 50 95 Q 20 75 25 50 Z";
    else if (n >= 4 && n <= 5) return "M 30 15 Q 50 0 70 15 L 75 60 Q 85 90 70 110 Q 50 115 30 110 Q 15 90 25 60 Z";
    else return "M 20 15 Q 30 0 45 15 L 50 45 L 55 15 Q 70 0 80 15 L 85 60 Q 95 90 80 110 Q 50 115 20 110 Q 5 90 15 60 Z";
  }

  // 🚨 LOG DETECTIVE: Revisamos qué va a dibujar en este diente específico
  if (itemsDiente.length > 0) {
      console.log(`🦷 [DIENTE ${id}] Tengo ${itemsDiente.length} tratamientos en total.`);
      const itemsConLogo = itemsDiente.filter((i:any) => !i.cara && !i.zona);
      console.log(`🦷 [DIENTE ${id}] Enviando a LogoRender: ${itemsConLogo.length} (Los demás son Caras o Zonas y se pintarán en los bordes)`);
  }

  return (
    <div className={`flex flex-col items-center gap-1.5 group ${invert ? 'flex-col-reverse' : ''} ${seleccionado ? 'ring-4 ring-blue-400 bg-blue-50 rounded-xl pb-1 px-1' : ''}`}>
      
      <div onClick={(e) => onSelect(id, e)} onContextMenu={onContextMenu} className={`relative w-12 h-14 cursor-pointer transition-all duration-300 drop-shadow-sm hover:drop-shadow-md`}>
        <svg viewBox="-10 -10 120 140" className={`w-full h-full overflow-visible ${invert ? 'rotate-180' : ''}`}>
          <defs>
            <linearGradient id={`gradDiente-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradientStart} />
              <stop offset="100%" stopColor={gradientEnd} />
            </linearGradient>
          </defs>
          <path d={getToothPath(id)} fill={`url(#gradDiente-${id})`} stroke={strokeColor} strokeWidth="4" strokeLinejoin="round" />
          
          {hallazgos.map((h: string, i: number) => <LogoRender key={`h-${i}`} hallazgo={h} logContext={`Hallazgo Diente ${id}`} />)}
          {itemsDiente.filter((i:any) => !i.cara && !i.zona).map((item: any, i: number) => 
              <LogoRender key={`t-${i}`} hallazgo={item.display_nombre} iconoKey={item.icono_tipo} colorOverride={item.estado === 'realizado' ? "#10b981" : "#ef4444"} logContext={`Tto Diente ${id}`} />
          )}
        </svg>
      </div>

      <span className="text-[10px] font-black text-slate-400 italic group-hover:text-blue-500 transition-all cursor-pointer" onClick={(e) => onSelect(id, e)}>
        {id}
      </span>

      <div>
        <CarasDentales id={id} items={itemsDiente} estado={estadoDiente} abrirPanelAgregar={abrirPanelAgregar} invert={invert} />
      </div>

    </div>
  )
}