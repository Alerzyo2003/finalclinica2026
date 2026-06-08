'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Loader2, Database, Plus, X, Search, Trash2, CheckCircle2, ChevronLeft, ChevronRight, 
  ChevronUp, ChevronDown, Info, Settings, Layers, FileSignature, Stethoscope, Check, 
  RefreshCcw, Undo2, HelpCircle, Printer, Download, User, Baby, Activity, Wallet, CalendarClock, Building, FileText, EyeOff, Package, Tag, Minus, Save
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
  "Prótesis removible", "Amalgama", "Sellante", "Ausente"
];

const LESIONES_LISTA = [
  "Caries", "Infección Pulpar", "Fractura", "Movilidad", "Residuo Radicular", "Erosión", "Atrición", "Abfracción", 
  "Corona (mal estado)", "Corona provisoria (mal estado)", "Perno muñon (mal estado)", 
  "Restauración (mal estado)", "Amalgama (mal estado)", "Implante (mal estado)", "Endodoncia (mal estado)", "Otro"
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

const obtenerDientesPorZona = (zona: string, temporal: boolean): number[] => {
  if (zona === 'Arcada Superior') return temporal ? [...t1, ...t2] : [...c1, ...c2];
  if (zona === 'Arcada Inferior') return temporal ? [...c3, ...c4] : [...c3, ...c4];
  if (!temporal) {
    if (zona === 'Sextante 1') return [18, 17, 16, 15, 14];
    if (zona === 'Sextante 2') return [13, 12, 11, 21, 22, 23];
    if (zona === 'Sextante 3') return [24, 25, 26, 27, 28];
    if (zona === 'Sextante 4') return [38, 37, 36, 35, 34];
    if (zona === 'Sextante 5') return [33, 32, 31, 41, 42, 43];
    if (zona === 'Sextante 6') return [44, 45, 46, 47, 48];
  } else {
    if (zona === 'Sextante 1') return [55, 54];
    if (zona === 'Sextante 2') return [53, 52, 51, 61, 62, 63];
    if (zona === 'Sextante 3') return [64, 65];
    if (zona === 'Sextante 4') return [75, 74];
    if (zona === 'Sextante 5') return [73, 72, 71, 81, 82, 83];
    if (zona === 'Sextante 6') return [84, 85];
  }
  return [];
}

// LISTA DE LABORATORIOS BASE
const LABORATORIOS_BASE = [
  { id: 'lab_eco', nombre: 'Lab. Dental Económico', costo: 12000 },
  { id: 'lab_est', nombre: 'Lab. Estética Digital HD', costo: 35000 },
  { id: 'lab_prem', nombre: 'Lab. Premium Express', costo: 55000 }
];

export default function DetalleTratamientoPage() {
  const params = useParams()
  const pathname = usePathname()
  const idURL = (params?.presupuestoId as string) || pathname.split('/').pop() || ""
  
  const [pacienteInfo, setPacienteInfo] = useState<any>(null)
  const [pacienteId, setPacienteId] = useState<string>('')
  const [presupuestoData, setPresupuestoData] = useState<any>(null)
  const [citasRelacionadas, setCitasRelacionadas] = useState<any[]>([])
  
  const [acciones, setAcciones] = useState<any[]>([]) 
  const [historialPaciente, setHistorialPaciente] = useState<any[]>([]) 
  
  const [odontogramaEstado, setOdontogramaEstado] = useState<Record<string, any>>({})
  const [historialOdontograma, setHistorialOdontograma] = useState<Record<string, any>[]>([])
  
  const [dientesSeleccionados, setDientesSeleccionados] = useState<number[]>([])
  const [editandoDienteId, setEditandoDienteId] = useState<string | null>(null)
  const [vistaTemporal, setVistaTemporal] = useState(false) 
  const [panelColapsado, setPanelColapsado] = useState(false)

  const [modalEditarItem, setModalEditarItem] = useState<{abierto: boolean, item: any}>({abierto: false, item: null})
  
  const [dctoInput, setDctoInput] = useState(0)
  const [costoLabInput, setCostoLabInput] = useState(0)
  const [labPorDoctorInput, setLabPorDoctorInput] = useState(false)

  const [mostrarLeyenda, setMostrarLeyenda] = useState(false)
  const [modalExportar, setModalExportar] = useState<{abierto: boolean, tipo: 'imprimir'|'descargar'|null}>({abierto: false, tipo: null})
  const [exportarOpciones, setExportarOpciones] = useState({ odontograma: true, finanzas: true })

  const [cargando, setCargando] = useState(true)
  const [debug, setDebug] = useState('Sincronizando...')
  
  const [verInfoElemento, setVerInfoElemento] = useState<number | string | null>(null)
  const [menuContextual, setMenuContextual] = useState<{ x: number, y: number, diente: number | null, zona?: string, lado: 'derecha' | 'izquierda', cara?: string } | null>(null)
  const [vistaMenu, setVistaMenu] = useState<'principal' | 'preexistencias' | 'lesiones'>('principal')

  const [profesionales, setProfesionales] = useState<any[]>([])
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState<string>('')
  
  const [tabPanel, setTabPanel] = useState<'prestaciones'|'packs'>('prestaciones')
  const [seccionesPrests, setSeccionesPrests] = useState<Record<string, any[]>>({})
  const [plantillasDisponibles, setPlantillasDisponibles] = useState<any[]>([])
  
  const [labPrests, setLabPrests] = useState<any[]>([])
  const [laboratoriosDB, setLaboratoriosDB] = useState<Record<string, string>>({})
  
  const [modalPack, setModalPack] = useState<{abierto: boolean, pack: any, configuraciones: Record<string, any>}>({abierto: false, pack: null, configuraciones: {}})

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

  // 🔥 ESTADOS NUEVOS PARA EVOLUCIÓN GRANULAR 🔥
  const [itemsAEvolucionar, setItemsAEvolucionar] = useState<string[]>([]);
  const [modoSeleccionMultiple, setModoSeleccionMultiple] = useState(false);
  const [modalEvolucionAbierto, setModalEvolucionAbierto] = useState(false);
  const [avanceEvolucion, setAvanceEvolucion] = useState(0);
  const [notaClinica, setNotaClinica] = useState('');
  const [guardandoEvolucion, setGuardandoEvolucion] = useState(false)
  const [modalConfirmarPrestacion, setModalConfirmarPrestacion] = useState<{abierto: boolean, prestacion: any}>({abierto: false, prestacion: null});

  const [modalIcono, setModalIcono] = useState<{abierto: boolean, prestacion: any, autoAdd?: boolean}>({
    abierto: false, prestacion: null, autoAdd: false
  });

  const [usuarioLogueado, setUsuarioLogueado] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const puedeVerFinanzas = perfil?.rol === 'ADMIN' || perfil?.rol === 'RECEPCIONISTA' || perfil?.rol === 'DENTISTA';

  const todasLasAccionesBoca = useMemo(() => {
    const historicasFiltradas = historialPaciente.filter(h => 
      h.estado === 'realizado' && 
      !acciones.some(a => a.id === h.id || a.tempId === h.tempId)
    );

    const esImportado = presupuestoData && presupuestoData.id_dentalink;
    const accionesParaOdontograma = acciones.filter(a => {
        if (esImportado) return a.estado === 'realizado';
        return true; 
    });

    return [...historicasFiltradas, ...accionesParaOdontograma];
  }, [acciones, historialPaciente, presupuestoData]);

  const obtenerItemsDelDiente = (id: number) => {
    return todasLasAccionesBoca.filter(a => 
        String(a.diente_id) === String(id) || 
        (a.zona && obtenerDientesPorZona(a.zona, vistaTemporal).includes(id))
    );
  }
  
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
    
    // UI Actualización inmediata
    setOdontogramaEstado(estadoPrevio);
    setHistorialOdontograma(nuevoHistorial);

    const { error } = await supabase.from('presupuestos').update({ odontograma_estado: estadoPrevio }).eq('id', idURL);
    if (!error) {
        toast.success("Acción deshecha");
    } else {
        toast.error("Error al deshacer en BD");
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

    let textoBase = item.texto_db || item.nombre_prestacion || item.observacion || '';
    textoBase = textoBase.replace(/ \| Fase: [^|]+/g, ''); 
    const nuevoTexto = `${textoBase} | Fase: ${nuevaSeccion}`;

    if (item.id) {
       if (item.presupuesto_id) supabase.from('presupuesto_items').update({ observacion: nuevoTexto, nombre_prestacion: nuevoTexto }).eq('id', item.id).then();
       else supabase.from('temp_items').update({ nombre_prestacion: nuevoTexto, observacion: nuevoTexto }).eq('id', item.id).then();
    }
  };

  async function fetchDatosFinales() {
    setCargando(true)
    try {
      const { data: pres } = await supabase.from('presupuestos').select('*, profesionales:especialista_id (nombre, apellido)').eq('id', idURL).maybeSingle();
      if (pres) {
        if (pres.paciente_id) {
            setPacienteId(pres.paciente_id);
            const { data: pac } = await supabase.from('pacientes').select('rut, nombre, apellido, prevision, saldo_a_favor').eq('id', pres.paciente_id).single();
            setPacienteInfo(pac);

            const { data: odontoMaster } = await supabase.from('odontogramas').select('dentadura').eq('paciente_id', pres.paciente_id).maybeSingle();
            if (odontoMaster?.dentadura) {
                setOdontogramaEstado(typeof odontoMaster.dentadura === 'string' ? JSON.parse(odontoMaster.dentadura) : odontoMaster.dentadura);
            } else if (pres.odontograma_estado) { 
                setOdontogramaEstado(typeof pres.odontograma_estado === 'string' ? JSON.parse(pres.odontograma_estado) : pres.odontograma_estado);
            }

            const hoyIso = new Date().toISOString();
            const { data: cits } = await supabase.from('citas').select('id, inicio, motivo').eq('paciente_id', pres.paciente_id).gte('inicio', hoyIso).order('inicio', { ascending: true }).limit(3);
            setCitasRelacionadas(cits || []);
        }

        // 🔥 CARGA LAS FASES/SECCIONES GUARDADAS EN EL PRESUPUESTO 🔥
        if (pres.secciones) {
            let seccionesGuardadas: string[] = [];
            if (Array.isArray(pres.secciones)) { // Soporte para formato de array nativo (text[] o jsonb)
                seccionesGuardadas = pres.secciones;
            } else if (typeof pres.secciones === 'string') { // Soporte para formato de texto (JSON string)
                try {
                    const parsed = JSON.parse(pres.secciones);
                    if (Array.isArray(parsed)) seccionesGuardadas = parsed;
                } catch (e) { /* Ignorar si no es un JSON válido */ }
            }
            if (seccionesGuardadas.length > 0) {
                setListaSecciones(prev => Array.from(new Set([...prev, ...seccionesGuardadas])).sort());
            }
        }

        setPresupuestoData({ ...pres, isAprobado: pres.aprobado || Number(pres.total_abonado || 0) > 0 });
      }

      let targetID: string = idURL;
      let esNuevo = true;
      if (pres && pres.id_dentalink) { targetID = pres.id_dentalink.toString(); esNuevo = false; }

      let query = esNuevo 
        ? supabase.from('presupuesto_items').select(`*, progreso, prestaciones:prestacion_id(icono_tipo, "Nombre Accion", "Nombre", "Precio")`).eq('presupuesto_id', idURL) 
        : supabase.from('temp_items').select('*').eq('id_dentalink', targetID);

      const { data, error } = await query;
      if (error) throw error;

      let itemsMapeados = (data || []).map((item:any) => mapearItem({...item, tempId: item.id || Math.random().toString()}, esNuevo));

      if (!esNuevo && itemsMapeados.length > 1) {
          const indiceFantasma = itemsMapeados.findIndex((i: any) => {
              const n = String(i.display_nombre).toLowerCase().trim();
              const obs = String(i.texto_db).toLowerCase().trim();
              return (n.includes("plan de tratamiento") || n.includes("plan:") || obs.includes("plan: tratamiento") || n === "tratamiento genérico") && !i.diente_id;
          });

          if (indiceFantasma !== -1) {
              const filaFantasma = itemsMapeados[indiceFantasma];
              const totalFantasma = Number(filaFantasma.display_pactado || 0);

              const sumaReal = itemsMapeados.reduce((acc, curr, idx) => {
                  if (idx !== indiceFantasma) return acc + Number(curr.display_pactado || 0);
                  return acc;
              }, 0);

              const dineroEscondido = totalFantasma - sumaReal;

              if (dineroEscondido > 0) {
                  itemsMapeados[indiceFantasma].display_pactado = dineroEscondido;
                  itemsMapeados[indiceFantasma].precio_base = dineroEscondido;
                  itemsMapeados[indiceFantasma].display_abonado = 0; 
                  itemsMapeados[indiceFantasma].display_saldo = dineroEscondido;
                  itemsMapeados[indiceFantasma].display_nombre = "Ajuste de Saldo Dentalink";
                  itemsMapeados[indiceFantasma].es_oculto = true;
              } else {
                  itemsMapeados.splice(indiceFantasma, 1);
              }
          }
      }

      setListaSecciones(prev => Array.from(new Set([...prev, ...Array.from(new Set(itemsMapeados.map((i:any) => i.seccion_nombre)))])).sort((a:any, b:any) => a.localeCompare(b)));
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

  const mapearItem = (item: any, esNuevo: boolean) => {
      const pactado = Number(item.precio_pactado || item.precio || 0);
      const abonado = Number(item.abonado || 0);
      
      const textoBase = item.nombre_prestacion || item.observacion || 'Plan General';
      const partes = textoBase.split('|').map((p: string) => p.trim());
      
      let estadoNormalizado = String(item.estado || 'pendiente').toLowerCase().trim();
      if (['atendido', 'realizado', 'terminado', 'completado', 'finalizado'].includes(estadoNormalizado)) {
          estadoNormalizado = 'realizado';
      }
      
      let caraMatch = item.cara ? String(item.cara).toUpperCase().trim() : null; 
      let zonaMatch = item.zona || null; 
      let iconoMatch = null, dctoMatch = 0, faseMatch = 'Plan General';

      let dienteParseado = null;
      if (item.diente_id !== null && item.diente_id !== undefined) {
          const strDiente = String(item.diente_id).toLowerCase().trim();
          if (!strDiente.includes('arcada') && !strDiente.includes('general')) {
              dienteParseado = parseInt(strDiente);
              if (isNaN(dienteParseado)) dienteParseado = null;
          }
      }

      partes.forEach((p: string) => {
          if (!caraMatch && p.startsWith('Cara:')) caraMatch = p.replace('Cara:', '').trim().replace(/[\s,]/g, '').toUpperCase().replace(/P/g, 'L');
          if (!zonaMatch && p.startsWith('Zona:')) zonaMatch = p.replace('Zona:', '').trim();
          if (p.startsWith('Icono:')) iconoMatch = p.replace('Icono:', '').trim();
          if (p.startsWith('Dcto:')) dctoMatch = parseInt(p.replace('Dcto:', '').trim());
          if (p.startsWith('Fase:')) faseMatch = p.replace('Fase:', '').trim();
      });

      let nombreDisplay = item.prestaciones?.["Nombre Accion"] || item.prestaciones?.["Nombre"] || partes[0] || "Tratamiento Genérico";
      nombreDisplay = String(nombreDisplay).split('|')[0].trim(); 

      if (faseMatch === 'Plan General' && item.observacion && !item.observacion.includes('|')) {
          faseMatch = item.observacion.trim();
      }

      const nombreLower = nombreDisplay.toLowerCase();
      const esGeneral = [
          "ortodoncia", "control", "evolución", "evolucion", "limpieza", "destartraje", 
          "profilaxis", "rx", "radiografía", "radiografia", "panorámica", "scanner", 
          "hialurónico", "blanqueamiento", "peeling", "evaluación", "evaluacion", 
          "consulta", "modelo", "fotografía", "fotografia", "férula", "plano", 
          "placa", "bótox", "botox", "presupuesto", "certificado", "receta", "insumos",
          "contención", "contencion", "retenedor", "instalación", "instalacion", 
          "retiro", "aparato", "estudio", "alta", "brackets", "frenillos"
      ].some(palabra => nombreLower.includes(palabra));

      if (esGeneral) {
          dienteParseado = null; 
          if (!caraMatch) caraMatch = null; 
      }

      if (!caraMatch && dienteParseado && !esGeneral) {
          const regexCara = /\b([VLMDOPvlmdop]{1,5})\b/; 
          const matchC = nombreDisplay.match(regexCara);
          
          if (matchC && matchC[1].length <= 5) {
              caraMatch = matchC[1].toUpperCase().replace(/P/g, 'L');
          } else {
              if (nombreLower.includes('oclusal')) caraMatch = 'O';
              else if (nombreLower.includes('vestibular') || nombreLower.includes('cervical') || nombreLower.includes('carilla')) caraMatch = 'V';
              else if (nombreLower.includes('lingual') || nombreLower.includes('palatin')) caraMatch = 'L';
              else if (nombreLower.includes('mesial')) caraMatch = 'M';
              else if (nombreLower.includes('distal')) caraMatch = 'D';
              else if (nombreLower.includes('simple') || nombreLower.includes('restauración') || nombreLower.includes('resina')) caraMatch = 'O';
          }
      }

      if (caraMatch) {
          caraMatch = caraMatch.toUpperCase().replace(/[\s,]/g, '').replace(/P/g, 'L');
      }

      let precioBase = item.prestaciones?.["Precio"] || item.precio;
      if (!precioBase) precioBase = pactado / (1 - (dctoMatch / 100));

      return {
          ...item,
          estado: estadoNormalizado, 
          diente_id: dienteParseado, 
          seccion_nombre: faseMatch,
          cara: caraMatch, 
          zona: zonaMatch,
          display_nombre: nombreDisplay,
          icono_tipo: iconoMatch || item.prestaciones?.icono_tipo,
          precio_base: precioBase,
          descuento: dctoMatch,          
          avance: estadoNormalizado === 'realizado' ? 100 : (item.progreso || 0),
          progreso: item.progreso || 0,
          tempId: item.tempId || item.id || Math.random().toString(),
          display_pactado: pactado, display_abonado: abonado, display_saldo: pactado - abonado,
          texto_db: textoBase,
          costo_laboratorio: Number(item.costo_laboratorio || 0),
          lab_pagado_por_dr: Boolean(item.lab_pagado_por_dr)
      };
  }

  async function fetchAuxiliares() {
    const { data: profs } = await supabase.from('profesionales').select('user_id, nombre, apellido').eq('activo', true);
    if (profs) setProfesionales(profs);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
       setUsuarioLogueado(session.user);
       const { data: pData } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).maybeSingle();
       if (pData) {
          setPerfil(pData);
          if (pData.rol !== 'ADMIN' && pData.rol !== 'RECEPCIONISTA') {
             setProfesionalSeleccionado(session.user.id);
          }
       }
    }

    const { data: lp } = await supabase.from('laboratorio_prestaciones').select('laboratorio_id, nombre_prestacion, costo_clinica');
    if (lp) setLabPrests(lp);
    const { data: lbs } = await supabase.from('laboratorios').select('id, nombre');
    if (lbs) {
        const map: Record<string, string> = {};
        lbs.forEach(l => map[l.id] = l.nombre);
        setLaboratoriosDB(map);
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

      setAcciones(prev => prev.map(a => {
          if (!a.icono_tipo) {
              const match = allPrests.find(p => p.display_nombre?.toLowerCase() === a.display_nombre?.toLowerCase());
              if (match && match.icono_tipo) return { ...a, icono_tipo: match.icono_tipo };
          }
          return a;
      }));
      setHistorialPaciente(prev => prev.map(h => {
          if (!h.icono_tipo) {
              const match = allPrests.find(p => p.display_nombre?.toLowerCase() === h.display_nombre?.toLowerCase());
              if (match && match.icono_tipo) return { ...h, icono_tipo: match.icono_tipo };
          }
          return h;
      }));
    }

    const { data: packsData } = await supabase.from('plantillas').select('*, plantilla_items(cantidad, prestacion_id)');
    if (packsData && allPrests.length > 0) {
      const packsMapeados = packsData.map(pack => ({
         ...pack,
         items: pack.plantilla_items.map((pi: any) => ({
             cantidad: pi.cantidad,
             prestacion: allPrests.find(p => p.id === pi.prestacion_id)
         })).filter((pi: any) => pi.prestacion) 
      }));
      setPlantillasDisponibles(packsMapeados);
    }
  }

  const aprobarPlanManualmente = async () => {
    const { error } = await supabase.from('presupuestos').update({ aprobado: true }).eq('id', idURL);
    if (!error) { setPresupuestoData({ ...presupuestoData, isAprobado: true }); toast.success("Plan de tratamiento aprobado"); }
  }

  const handleCrearSeccion = async () => {
    if(!nuevaSeccionNombre.trim()) return toast.error("El nombre de la sección no puede estar vacío");
    const nombre = nuevaSeccionNombre.trim();
    
    const nuevaLista = Array.from(new Set([...listaSecciones, nombre])).sort();

    // Actualización optimista de la UI
    if(!listaSecciones.includes(nombre)) {
      setListaSecciones(nuevaLista);
    }
    setSeccionInput(nombre); 
    setModalNuevaSeccion(false); 
    setNuevaSeccionNombre('');

    // Guardado en la base de datos (como string JSON para máxima compatibilidad con columnas de tipo 'text')
    const { error } = await supabase.from('presupuestos').update({ secciones: JSON.stringify(nuevaLista) }).eq('id', idURL);

    if (error) {
      toast.error("Error al guardar la nueva fase. Intenta de nuevo.");
      setListaSecciones(listaSecciones); // Revertir si falla
    } else {
      toast.success("Nueva fase clínica creada y guardada.");
    }
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

  const toggleCara = (c: string) => {
    if (caraInput === '') setCaraInput(c);
    else if (caraInput.includes(c)) setCaraInput(caraInput.replace(c, ''));
    else setCaraInput(caraInput + c);
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

  const handleContextMenu = (e: React.MouseEvent, diente: number | null, cara?: string, zona?: string) => {
    e.preventDefault(); e.stopPropagation();
    if(dientesSeleccionados.length > 1) return; 
    
    const container = document.getElementById('seccion-odontograma');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const lado: 'derecha' | 'izquierda' = e.clientX + 300 > window.innerWidth ? 'izquierda' : 'derecha';
    
    setMenuContextual({ 
       x: e.clientX - rect.left, 
       y: e.clientY - rect.top, 
       diente, 
       lado, 
       cara, 
       zona 
    });
    setVistaMenu('principal');
  };

  const procesarAplicacionHallazgo = async (dientesArreglo: number[], tipo: string, esMulti = false) => {
    guardarHistorial();
    console.log(`[LOG] Procesando hallazgo múltiple/general: ${tipo}`, dientesArreglo);

    let nuevoEstado = { ...odontogramaEstado };
    const t = tipo.toLowerCase();

    dientesArreglo.forEach(diente => {
        const dId = diente.toString();
        let actual = nuevoEstado[dId]?.hallazgos || [];
        if (nuevoEstado[dId]?.center) actual = [nuevoEstado[dId].center];
        
        if (t.includes('sano')) { actual = []; } 
        else { actual = actual.filter((h:string) => !h.toLowerCase().includes('sano')); if (!actual.some((h:string) => h.toLowerCase() === t)) actual.push(tipo); }
        nuevoEstado[dId] = { ...nuevoEstado[dId], hallazgos: actual };
    });

    // Optimistic Update
    setOdontogramaEstado(nuevoEstado);
    setMenuContextual(null);

    const { error } = await supabase.from('odontogramas').upsert({ paciente_id: pacienteId, dentadura: nuevoEstado }, { onConflict: 'paciente_id' });
    if (!error) { 
        toast.success(esMulti ? "Hallazgo aplicado a la selección" : "Hallazgo registrado"); 
        if(esMulti) setDientesSeleccionados([]); 
    } else {
        toast.error("Error al guardar hallazgo en BD");
    }
  }

  const aplicarHallazgo = (tipo: string) => { 
      if (!menuContextual) return;
      if (menuContextual.zona) {
          const dientes = obtenerDientesPorZona(menuContextual.zona, vistaTemporal);
          procesarAplicacionHallazgo(dientes, tipo, true);
      } else if (menuContextual.diente !== null && !menuContextual.cara) {
          procesarAplicacionHallazgo([menuContextual.diente], tipo);
      } else if (menuContextual.diente !== null && menuContextual.cara) {
          aplicarLesionCaraLocal(tipo);
      }
  };

  // 🔥 LÓGICA OPTIMISTA Y LOGS PARA LESIONES EN CARAS 🔥
  const aplicarLesionCaraLocal = async (tipo: string) => {
    if (!menuContextual || !menuContextual.cara || menuContextual.diente === null) return;
    
    console.log(`[LOG - MENU] Aplicando ${tipo} a la cara ${menuContextual.cara} del diente ${menuContextual.diente}`);

    guardarHistorial();
    const dId = menuContextual.diente.toString();
    const carasActuales = odontogramaEstado[dId]?.caras || {};
    
    // Toggle (Si ya tiene esa lesión, se la quita. Si no, se la pone).
    const nuevaCara = carasActuales[menuContextual.cara] === tipo ? null : tipo;
    const nuevoEstado = { 
        ...odontogramaEstado, 
        [dId]: { ...odontogramaEstado[dId], caras: { ...carasActuales, [menuContextual.cara]: nuevaCara } } 
    };
    
    console.log(`[LOG - STATE] Nuevo estado del diente ${dId}:`, nuevoEstado[dId]);

    // Optimistic UI Update (Se pinta instantáneo en la pantalla)
    setOdontogramaEstado(nuevoEstado);
    setMenuContextual(null);
    
    // Guardado en Base de Datos
    const { error } = await supabase.from('odontogramas').upsert({ paciente_id: pacienteId, dentadura: nuevoEstado }, { onConflict: 'paciente_id' });
    if (!error) { 
        toast.success(`Cara ${menuContextual.cara} actualizada a ${tipo}`); 
    } else {
        console.error("[LOG - ERROR] Falla BD al guardar:", error);
        toast.error("Error al guardar en la BD");
    }
  }

  const eliminarHallazgoEspecifico = async (diente: number, hallazgoNombre: string) => {
    guardarHistorial();
    const dId = diente.toString();
    const nuevosHallazgos = odontogramaEstado[dId].hallazgos.filter((h: string) => h !== hallazgoNombre);
    const nuevoEstado = { ...odontogramaEstado };
    if (nuevosHallazgos.length === 0) delete nuevoEstado[dId]; else nuevoEstado[dId] = { hallazgos: nuevosHallazgos };
    const { error } = await supabase.from('odontogramas').upsert({ paciente_id: pacienteId, dentadura: nuevoEstado }, { onConflict: 'paciente_id' });
    if (!error) { setOdontogramaEstado(nuevoEstado); toast.info("Eliminado"); }
  };

  const eliminarPrestacionLocal = async (id: string, tempId: string) => {
    const item = acciones.find(a => a.id === id || a.tempId === tempId);
    if (!item) return;

    // 🔥 REGLA: No se puede eliminar si ya tiene avance.
    if (item.avance > 0 || item.progreso > 0) {
      return toast.error("No se puede eliminar un tratamiento que ya ha sido iniciado.");
    }

    if (!window.confirm(`¿Estás seguro de que quieres eliminar la prestación "${item.display_nombre}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    if (id) {
        // Solo eliminamos si es un item de un presupuesto local (no importado)
        if (item.presupuesto_id) {
            const { error } = await supabase.from('presupuesto_items').delete().eq('id', id);
            if (!error) { 
                setAcciones(prev => prev.filter(a => a.id !== id)); 
                
                // Registro de auditoría
                await supabase.from('auditoria_clinica').insert([{
                    usuario_id: usuarioLogueado?.id,
                    accion: 'DELETE / PRESTACIÓN',
                    tabla: 'presupuesto_items',
                    detalles: `Eliminó la prestación "${item.display_nombre}" (ID: ${item.id}) del presupuesto #${idURL} del paciente ${pacienteInfo?.nombre} ${pacienteInfo?.apellido}.`
                }]);

                toast.info("Acción eliminada del presupuesto."); 
            } else {
                toast.error("Error al eliminar la prestación.");
            }
        } else {
            setAcciones(prev => prev.filter(a => a.tempId !== tempId)); 
            toast.info("Acción importada quitada de la vista (no se elimina de la base de datos de origen).");
        }
    } else {
        setAcciones(prev => prev.filter(a => a.tempId !== tempId)); toast.info("Acción quitada de la vista");
    }
  }

  const handleCambiarDiente = async (tempId: string, id: string | null, nuevoDiente: string) => {
    setEditandoDienteId(null);
    const val = nuevoDiente.trim();
    const dId = val ? parseInt(val) : null;
    if (val !== '' && isNaN(dId as any)) return toast.error("Número de pieza inválido");
    
    const item = acciones.find(a => a.tempId === tempId);
    let nuevaObs = item.texto_db || '';
    
    if (item.zona) {
        nuevaObs = nuevaObs.replace(/ \| Zona: [^|]+/g, '');
    }

    if (id) await supabase.from('presupuesto_items').update({ diente_id: dId, zona: null, observacion: nuevaObs, nombre_prestacion: nuevaObs }).eq('id', id);
    setAcciones(prev => prev.map(a => (a.id === id || a.tempId === tempId) ? { ...a, diente_id: dId, zona: null, texto_db: nuevaObs } : a)); 
    toast.success("Pieza actualizada");
  }

  const handleCambiarAvance = async (tempId: string, id: string | null, nuevoAvance: number) => {
    const item = acciones.find(a => a.tempId === tempId);
    if (!item) return;

    let nuevaObs = item.texto_db || item.display_nombre || '';
    nuevaObs = nuevaObs.replace(/ \| Avance: [0-9]+/g, '');
    if (nuevoAvance > 0) nuevaObs += ` | Avance: ${nuevoAvance}`;

    if (id) {
        if (item.presupuesto_id) supabase.from('presupuesto_items').update({ observacion: nuevaObs, nombre_prestacion: nuevaObs }).eq('id', id).then();
        else supabase.from('temp_items').update({ nombre_prestacion: nuevaObs, observacion: nuevaObs }).eq('id', id).then();
    }
    setAcciones(prev => prev.map(a => a.tempId === tempId ? { ...a, avance: nuevoAvance, texto_db: nuevaObs } : a));
  }

  const handleGuardarAjustes = async () => {
    const id = modalEditarItem.item.id;
    const tempId = modalEditarItem.item.tempId;
    const dcto = dctoInput;
    const item = modalEditarItem.item;
    
    const precioBase = item.precio_base || item.precio || 0;
    const nuevoPactado = precioBase * (1 - (dcto / 100));

    let nuevaObs = item.texto_db || item.display_nombre || '';
    nuevaObs = nuevaObs.replace(/ \| Dcto: [0-9]+/g, '');
    if (dcto > 0) nuevaObs += ` | Dcto: ${dcto}`;

    const updatePayload = {
        observacion: nuevaObs, 
        nombre_prestacion: nuevaObs, 
        precio_pactado: nuevoPactado,
        costo_laboratorio: costoLabInput,
        lab_pagado_por_dr: labPorDoctorInput
    };

    if (id) {
        if (item.presupuesto_id) supabase.from('presupuesto_items').update(updatePayload).eq('id', id).then();
        else supabase.from('temp_items').update(updatePayload).eq('id', id).then();
    }

    if (dcto > 0) {
      await supabase.from('auditoria_clinica').insert([{
        usuario_id: usuarioLogueado?.id,
        accion: 'UPDATE / DESCUENTO',
        tabla: 'presupuesto_items',
        detalles: `Aplicó ${dcto}% de descuento a "${item.display_nombre}" (ID: ${item.id}). Precio original: $${precioBase.toLocaleString('es-CL')}, precio final: $${nuevoPactado.toLocaleString('es-CL')}.`
      }]);
    }



    setAcciones(prev => prev.map(a => a.tempId === tempId ? {
        ...a, 
        descuento: dcto, 
        texto_db: nuevaObs, 
        precio_pactado: nuevoPactado, 
        display_pactado: nuevoPactado, 
        display_saldo: nuevoPactado - a.display_abonado,
        costo_laboratorio: costoLabInput,
        lab_pagado_por_dr: labPorDoctorInput
    } : a));
    
    setModalEditarItem({abierto: false, item: null});
    toast.success("Ajustes clínicos guardados correctamente");
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
    const observacionFinal = `${prestacion.display_nombre} | Fase: ${seccionInput.trim()}` + (caraInput ? ` | Cara: ${caraInput}` : '') + (zonaInput ? ` | Zona: ${zonaInput}` : '') + (prestacion.icono_tipo ? ` | Icono: ${prestacion.icono_tipo}` : '');

    const dispName = prestacion.display_nombre?.toUpperCase().trim();
    const labsRequeridos = labPrests.filter(l => l.nombre_prestacion?.toUpperCase().trim() === dispName);
    let costoLabAuto = 0;
    if (labsRequeridos.length > 0) {
        const sorted = [...labsRequeridos].sort((a,b) => (a.costo_clinica || 0) - (b.costo_clinica || 0));
        costoLabAuto = sorted[0].costo_clinica || 0;
        toast.info("Costo de laboratorio asignado automáticamente.");
    }

    const baseItem = {
        presupuesto_id: idURL, 
        prestacion_id: prestacion.id, 
        precio_pactado: prestacion["Precio"], 
        abonado: 0, 
        estado: 'pendiente', 
        profesional_id: profesionalSeleccionado, 
        nombre_prestacion: observacionFinal, 
        observacion: observacionFinal,
        cara: caraInput || null,
        zona: zonaInput || null,
        costo_laboratorio: costoLabAuto,
        lab_pagado_por_dr: false
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
            display_pactado: d.precio_pactado, display_abonado: 0, display_saldo: d.precio_pactado,
            texto_db: observacionFinal,
            costo_laboratorio: costoLabAuto,
            lab_pagado_por_dr: false
        }));
        setAcciones(prev => [...prev, ...nuevosItems]);
        setPanelAgregarAbierto(false); setDientesSeleccionados([]); 
        toast.success(`Prestación agregada exitosamente ${inserts.length > 1 ? `(${inserts.length} piezas)` : ''}`);
    } else toast.error("Error al guardar en base de datos.");
  };

  const abrirModalPack = (pack: any) => {
     const configs: Record<string, any> = {};
     
     pack.items.forEach((pi: any) => {
         const dispName = pi.prestacion?.display_nombre?.toUpperCase().trim();
         const labsDisp = labPrests.filter(l => l.nombre_prestacion?.toUpperCase().trim() === dispName);
         
         let defaultLab = null;
         let minCosto = 0;
         
         if (labsDisp.length > 0) {
             const sorted = [...labsDisp].sort((a,b) => (a.costo_clinica || 0) - (b.costo_clinica || 0));
             defaultLab = sorted[0].laboratorio_id;
             minCosto = sorted[0].costo_clinica || 0;
         }

         configs[pi.prestacion.id] = {
             cantidad: pi.cantidad,
             descuento: 0,
             labId: defaultLab,
             costoLab: minCosto,
             labsDisponibles: labsDisp
         };
     });

     setModalPack({ abierto: true, pack, configuraciones: configs });
  }

  const updatePackItemConfig = (prestacionId: string, field: string, value: any) => {
      setModalPack(prev => {
          const actual = prev.configuraciones[prestacionId];
          let nuevaConf = { ...actual, [field]: value };
          
          if (field === 'labId') {
              const elLab = actual.labsDisponibles.find((l:any) => l.laboratorio_id === value);
              if (elLab) nuevaConf.costoLab = elLab.costo_clinica || 0;
          }
          
          return {
              ...prev,
              configuraciones: { ...prev.configuraciones, [prestacionId]: nuevaConf }
          };
      });
  }

  const handleAgregarPackCompletos = async () => {
    if (!profesionalSeleccionado) return toast.error("Seleccione un dentista responsable");
    
    const dIds = dienteInput.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    let inserts: any[] = [];
    
    const { pack, configuraciones } = modalPack;
    
    // 🔥 EL NOMBRE DE LA SECCIÓN AHORA ES EL NOMBRE DEL PACK 🔥
    const seccionDelPack = pack.nombre.trim();
    if(!listaSecciones.includes(seccionDelPack)) {
        setListaSecciones(prev => [...prev, seccionDelPack].sort((a, b) => a.localeCompare(b)));
    }

    pack.items.forEach((pi: any) => {
        const prestacion = pi.prestacion;
        const config = configuraciones[prestacion.id] || { cantidad: pi.cantidad, descuento: 0, costoLab: 0 };
        
        const precioBase = prestacion.Precio;
        const precioConDcto = precioBase * (1 - (config.descuento / 100));

        const iconoFinal = prestacion.icono_tipo || pack.icono_tipo;

        for(let i=0; i < config.cantidad; i++) {
            const observacionFinal = `${prestacion.display_nombre} | Fase: ${seccionDelPack}` + 
                (caraInput ? ` | Cara: ${caraInput}` : '') + 
                (zonaInput ? ` | Zona: ${zonaInput}` : '') + 
                (iconoFinal ? ` | Icono: ${iconoFinal}` : '') +
                (config.descuento > 0 ? ` | Dcto: ${config.descuento}` : '');

            const baseItem = {
                presupuesto_id: idURL, 
                prestacion_id: prestacion.id, 
                precio_pactado: precioConDcto, 
                abonado: 0, 
                estado: 'pendiente', 
                profesional_id: profesionalSeleccionado, 
                nombre_prestacion: observacionFinal, 
                observacion: observacionFinal,
                cara: caraInput || null,
                zona: zonaInput || null,
                costo_laboratorio: config.costoLab,
                lab_pagado_por_dr: false
            };

            if (dIds.length > 0 && !zonaInput) {
                dIds.forEach(dId => inserts.push({ ...baseItem, diente_id: dId }));
            } else {
                inserts.push({ ...baseItem, diente_id: null });
            }
        }
    });

    const { data, error } = await supabase.from('presupuesto_items').insert(inserts).select('*, prestaciones:prestacion_id(*)');

    if (!error && data) {
        const nuevosItems = data.map((d:any) => {
            const pMatch = pack.items.find((pi:any) => pi.prestacion.id === d.prestacion_id)?.prestacion;
            const configDcto = configuraciones[d.prestacion_id]?.descuento || 0;
            return {
                ...d, seccion_nombre: seccionDelPack, cara: caraInput || null, zona: zonaInput || null,
                display_nombre: pMatch?.display_nombre || d.prestaciones?.["Nombre Accion"], 
                icono_tipo: pMatch?.icono_tipo || d.prestaciones?.icono_tipo || pack.icono_tipo, 
                precio_base: pMatch?.Precio, descuento: configDcto, avance: 0, tempId: d.id,
                display_pactado: d.precio_pactado, display_abonado: 0, display_saldo: d.precio_pactado,
                texto_db: d.observacion,
                costo_laboratorio: d.costo_laboratorio || 0,
                lab_pagado_por_dr: false
            }
        });
        setAcciones(prev => [...prev, ...nuevosItems]);
        setModalPack({abierto: false, pack: null, configuraciones: {}});
        setPanelAgregarAbierto(false); setDientesSeleccionados([]); 
        toast.success(`Pack "${pack.nombre}" agregado con éxito`);
    } else {
        toast.error("Error al guardar el pack en el presupuesto.");
    }
  }

  // =======================================================
  // 🔥 NUEVA LÓGICA DE EVOLUCIÓN 🔥
  // =======================================================
  const abrirModalEvolucion = (itemIds: string[], avanceInicial: number) => {
    if (itemIds.length === 0) return;

    const itemCompleto = acciones.find(a => itemIds.includes(a.id) && a.avance === 100);
    if (itemCompleto && avanceInicial > 0) {
        return toast.info(`El tratamiento "${itemCompleto.display_nombre}" ya está finalizado.`);
    }

    if (perfil?.rol !== 'ADMIN' && perfil?.rol !== 'DENTISTA') {
        return toast.error("No tienes permisos para evolucionar tratamientos.");
    }

    // 🔥 ALERTA SI SE EVOLUCIONA TRABAJO DE OTRO DOCTOR 🔥
    if (perfil?.rol === 'DENTISTA') {
      const doctorLogueadoId = profesionalSeleccionado;
      const itemsAevaluar = acciones.filter(a => itemIds.includes(a.id));
      
      const itemDeOtroDoctor = itemsAevaluar.find(item => 
        item.profesional_id && item.progreso > 0 && item.profesional_id !== doctorLogueadoId
      );

      if (itemDeOtroDoctor) {
        const doctorOriginal = profesionales.find(p => p.user_id === itemDeOtroDoctor.profesional_id);
        const nombreOriginal = doctorOriginal ? `Dr/a. ${doctorOriginal.apellido}` : 'otro colega';
        toast.warning(`Atención: Estás continuando un tratamiento iniciado por ${nombreOriginal}.`, { duration: 6000 });
      }
    }

    setItemsAEvolucionar(itemIds);
    setAvanceEvolucion(avanceInicial);
    // Si el usuario es admin, se resetea para que deba elegir.
    // Si es dentista, se mantiene el ID del usuario logueado que se cargó al inicio.
    if (perfil?.rol === 'ADMIN') setProfesionalSeleccionado('');
    setModalEvolucionAbierto(true);
  }

  const ejecutarGuardadoEvolucion = async () => {
    const itemIds = itemsAEvolucionar;
    const avance = avanceEvolucion;
    const doctorId = profesionalSeleccionado;

    setGuardandoEvolucion(true);
    try {
      const { error: evoError } = await supabase.from('evoluciones').insert([{ 
          paciente_id: pacienteId, 
          profesional_id: doctorId, 
          descripcion_procedimiento: notaClinica.trim(),
          observaciones: `Evolución de ${itemIds.length} prestacion(es) al ${avance}% en presupuesto ${idURL}` 
      }]);
      if (evoError) throw evoError;

      const nombresPrestaciones = acciones
        .filter(a => itemIds.includes(a.id))
        .map(a => a.display_nombre)
        .join(', ');

      await supabase.from('auditoria_clinica').insert([{
        usuario_id: usuarioLogueado?.id,
        accion: 'UPDATE / EVOLUCIÓN',
        tabla: 'presupuesto_items, evoluciones',
        detalles: `Evolucionó ${itemIds.length} prestación(es) (${nombresPrestaciones}) al ${avance}% para el paciente ${pacienteInfo?.nombre} ${pacienteInfo?.apellido}. Nota: "${notaClinica.trim()}"`
      }]);

      for (const itemId of itemIds) {
        const item = acciones.find(a => a.id === itemId);
        if (!item) continue;

        let nuevaObs = item.texto_db || item.display_nombre || '';
        nuevaObs = nuevaObs.replace(/ \| Avance: [0-9]+/g, ''); // Limpiamos el avance del texto
        
        const nuevoEstado = avance === 100 ? 'realizado' : item.estado;

        if (item.presupuesto_id) {
          await supabase.from('presupuesto_items').update({ 
            observacion: nuevaObs,
            estado: nuevoEstado,
            profesional_id: doctorId,
            progreso: avance // 🔥 GUARDAMOS EN LA NUEVA COLUMNA
          }).eq('id', itemId);
        } else if (item.id_dentalink) {
          // La tabla de importación no tiene profesional_id, solo se actualiza el estado.
          await supabase.from('temp_items').update({ 
            nombre_prestacion: nuevaObs, 
            estado: nuevoEstado 
          }).eq('id', itemId);
        }
      }
      
      if (!presupuestoData.isAprobado) { 
        await supabase.from('presupuestos').update({ aprobado: true }).eq('id', idURL); 
        setPresupuestoData({ ...presupuestoData, isAprobado: true }); 
      }
      
      setAcciones(prev => prev.map(a => {
        if (itemIds.includes(a.id)) {
          let nuevaObs = a.texto_db || a.display_nombre || '';
          nuevaObs = nuevaObs.replace(/ \| Avance: [0-9]+/g, ''); // Limpiamos el estado local también
          return { 
            ...a, 
            estado: avance === 100 ? 'realizado' : a.estado, 
            avance: avance, 
            progreso: avance,
            texto_db: nuevaObs, 
            profesional_id: doctorId // Actualiza el doctor en el estado local también
          };
        }
        return a;
      }));

      toast.success("Evolución registrada."); 
      setModalEvolucionAbierto(false);
      setNotaClinica('');
      setItemsAEvolucionar([]);
      setModoSeleccionMultiple(false);
    } catch (err) { toast.error("Error al registrar la evolución"); } finally { setGuardandoEvolucion(false); }
  }

  const handleGuardarIcono = async (iconoId: string | null) => {
    const prestacionActual = modalIcono.prestacion;
    const autoAdd = modalIcono.autoAdd;
    let prestacionIdParaActualizar = prestacionActual?.id;

    if (!prestacionIdParaActualizar && prestacionActual?.display_nombre) {
        const { data } = await supabase.from('prestaciones').select('id').ilike('Nombre Accion', prestacionActual.display_nombre).limit(1);
        if (data && data.length > 0) {
            prestacionIdParaActualizar = data[0].id;
        }
    }

    if (prestacionIdParaActualizar) {
        await supabase.from('prestaciones').update({ icono_tipo: iconoId }).eq('id', prestacionIdParaActualizar);
    }

    const nuevasSecciones = { ...seccionesPrests };
    for (const cat in nuevasSecciones) {
       const index = nuevasSecciones[cat].findIndex((p:any) => p.id === prestacionIdParaActualizar || p.display_nombre?.toLowerCase() === prestacionActual?.display_nombre?.toLowerCase());
       if (index !== -1) nuevasSecciones[cat][index].icono_tipo = iconoId;
    }
    setSeccionesPrests(nuevasSecciones);

    const inyectarLogoGlobal = (itemsArray: any[]) => itemsArray.map(a => {
        if (a.prestacion_id === prestacionIdParaActualizar || a.display_nombre?.toLowerCase() === prestacionActual?.display_nombre?.toLowerCase()) {
            
            let nuevoTexto = (a.texto_db || a.display_nombre || '').replace(/ \| Icono: [a-zA-Z0-9_-]+/g, ''); 
            if (iconoId) nuevoTexto += ` | Icono: ${iconoId}`; 
            
            if (a.id) {
                if (a.presupuesto_id) {
                    supabase.from('presupuesto_items').update({ observacion: nuevoTexto, nombre_prestacion: nuevoTexto }).eq('id', a.id).then();
                } else {
                    supabase.from('temp_items').update({ nombre_prestacion: nuevoTexto, observacion: nuevoTexto }).eq('id', a.id).then();
                }
            }

            return { ...a, icono_tipo: iconoId, texto_db: nuevoTexto };
        }
        return a;
    });

    setAcciones(prev => inyectarLogoGlobal(prev));
    setHistorialPaciente(prev => inyectarLogoGlobal(prev));

    setModalIcono({ abierto: false, prestacion: null, autoAdd: false });
    if (autoAdd && iconoId) handleSeleccionarTratamiento({ ...prestacionActual, icono_tipo: iconoId }, true);
    else toast.success(iconoId ? "Logo global guardado" : "Logo restablecido");
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

  // 🔥 CÁLCULO DEL PORCENTAJE DE DESCUENTO GLOBAL 🔥
  const totalBasePlan = acciones.reduce((acc, curr) => acc + (Number(curr.precio_base) || Number(curr.display_pactado)), 0);
  const porcentajeDctoGlobal = totalBasePlan > 0 ? Math.round(((totalBasePlan - totalPlan) / totalBasePlan) * 100) : 0;

  const totalPorSeccion = (seccion: string) => { return acciones.filter(a => a.seccion_nombre === seccion && !a.es_oculto).reduce((acc, curr) => acc + curr.display_pactado, 0); }

  // Se corrige la lógica para que muestre todas las secciones, incluidas las vacías recién creadas.
  // Antes, solo se mostraban secciones que ya contenían al menos un tratamiento.
  const seccionesVisibles = listaSecciones;

  if (cargando) return <div className="h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full h-full relative p-6 bg-[#F8FAFC] min-h-screen font-sans" id="odontograma-container" onClick={() => setMenuContextual(null)}>
      
      {/* ======================================================= */}
      {/* PANEL LATERAL FINANCIERO (CLARO Y MODERNO) */}
      {/* ======================================================= */}
      <aside className={`shrink-0 flex flex-col gap-4 print:hidden transition-all duration-300 ease-in-out ${panelColapsado ? 'w-0 opacity-0 overflow-hidden hidden lg:flex' : 'lg:w-[340px] opacity-100'}`}>
        <div className="w-[340px] bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden flex flex-col">
           <div className="bg-[#e0f2fe] border-b border-[#bae6fd] p-5 flex justify-between items-start">
              <div className="flex items-center gap-2">
                 <FileText size={16} className="text-blue-600" />
                 <h2 className="text-sm font-black uppercase text-blue-900 tracking-tighter">
                    Plan #{idURL.substring(0, 5).toUpperCase()}
                 </h2>
              </div>
           </div>

           <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                 <Stethoscope size={16} className="text-slate-700"/>
                 <h3 className="text-xs font-black uppercase text-slate-800">Clínico</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase">{presupuestoData?.nombre_tratamiento || 'Tratamiento Integral'}</p>
           </div>

           {puedeVerFinanzas && (
             <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                   <Wallet size={16} className="text-slate-700"/>
                   <h3 className="text-xs font-black uppercase text-slate-800">Presupuesto</h3>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                   <div className="flex flex-col gap-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase leading-tight">Total Plan</p>
                      <p className="text-[11px] font-black text-slate-800">${totalPlan.toLocaleString('es-CL')}</p>
                   </div>
                   <div className="flex flex-col gap-1 border-l border-slate-100">
                      <p className="text-[9px] font-bold text-slate-500 uppercase leading-tight">Dcto.</p>
                      {/* 🔥 APLICACIÓN DEL PORCENTAJE DE DESCUENTO EN LA VISTA 🔥 */}
                      <p className="text-[11px] font-black text-slate-800">{porcentajeDctoGlobal}%</p>
                   </div>
                   <div className="flex flex-col gap-1 border-l border-slate-100">
                      <p className="text-[9px] font-bold text-slate-500 uppercase leading-tight">Abonado</p>
                      <p className="text-[11px] font-black text-slate-800">${abonadoPlan.toLocaleString('es-CL')}</p>
                   </div>
                   <div className="flex flex-col gap-1 border-l border-slate-100">
                      <p className="text-[9px] font-bold text-slate-500 uppercase leading-tight">Saldo</p>
                      <p className={`text-[11px] font-black px-1 py-0.5 rounded-md ${deudaPlan > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                         ${deudaPlan.toLocaleString('es-CL')}
                      </p>
                   </div>
                </div>
                {abonadoPlan === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 mt-2">No hay abonos ($0)</p>
                )}
             </div>
           )}

           <div className="p-5 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                 <User size={16} className="text-slate-700"/>
                 <h3 className="text-xs font-black uppercase text-slate-800">Equipo</h3>
              </div>
              <p className="text-[10px] font-bold text-slate-600 flex items-center gap-2">
                 <User size={12} className="text-slate-400"/> 
                 Dr(a) {presupuestoData?.profesionales ? `${presupuestoData.profesionales.nombre} ${presupuestoData.profesionales.apellido}` : 'Sin asignar'}
              </p>
              <p className="text-[10px] font-bold text-slate-600 flex items-center gap-2">
                 <Building size={12} className="text-slate-400"/> 
                 Centro Médico y Dental Dignidad SpA
              </p>
           </div>

           <div className="p-5 border-b border-slate-100 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                 <Building size={16} className="text-slate-700"/>
                 <h3 className="text-xs font-black uppercase text-slate-800">Convenio</h3>
              </div>
              <p className="text-[10px] font-bold text-slate-500 pl-6">
                 {pacienteInfo?.prevision && pacienteInfo?.prevision !== 'Sin convenio' ? pacienteInfo.prevision : 'Sin convenio'}
              </p>
           </div>

           <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                 <CalendarClock size={16} className="text-slate-700"/>
                 <h3 className="text-xs font-black uppercase text-slate-800">Citas</h3>
              </div>
              {citasRelacionadas.length > 0 ? (
                 <div className="space-y-2 pl-6 mt-3">
                    {citasRelacionadas.map(c => (
                       <div key={c.id} className="bg-slate-50 border border-slate-100 p-2 rounded-lg flex justify-between items-center">
                          <p className="text-[10px] font-black text-slate-700">{new Date(c.inicio.replace('T', ' ')).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</p>
                          <p className="text-[10px] font-bold text-blue-600">{new Date(c.inicio.replace('T', ' ')).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                       </div>
                    ))}
                 </div>
              ) : (
                 <p className="text-[10px] font-bold text-slate-400 pl-6">Este tratamiento no posee citas</p>
              )}
           </div>
        </div>
      </aside>

      {/* ======================================================= */}
      {/* CONTENIDO PRINCIPAL (ODONTOGRAMA Y TABLAS) */}
      {/* ======================================================= */}
      <div className="flex-1 flex flex-col gap-6 max-w-full">
        
        <div className="flex justify-between items-center print:hidden px-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setPanelColapsado(!panelColapsado); }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 shadow-sm transition-all"
            >
              {panelColapsado ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              <span className="hidden sm:inline">{panelColapsado ? 'Mostrar Info' : 'Ocultar Info'}</span>
            </button>
            <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                <button onClick={() => setVistaTemporal(false)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!vistaTemporal ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <User size={14}/> Adulto
                </button>
                <button onClick={() => setVistaTemporal(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${vistaTemporal ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Baby size={14}/> Niño
                </button>
            </div>
          </div>
            
            <div className="flex gap-2">
                <button onClick={() => setModalExportar({abierto: true, tipo: 'imprimir'})} className="px-5 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                    <Printer size={16}/> Imprimir
                </button>
            </div>
        </div>

        <section id="seccion-odontograma" data-html2canvas-ignore={!exportarOpciones.odontograma ? "true" : undefined} className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-sm border border-slate-200 relative overflow-visible flex flex-col items-center">
          
          <div className="w-full flex justify-between items-center mb-8 px-4" data-html2canvas-ignore="true">
              <button onClick={handleDeshacer} className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm flex items-center gap-2" title="Deshacer (Ctrl + Z)">
                  <Undo2 size={16} /> <span className="text-[10px] font-black uppercase hidden md:block">Deshacer</span>
              </button>
              <button onClick={() => setMostrarLeyenda(true)} className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-2">
                  <HelpCircle size={16} /> <span className="text-[10px] font-black uppercase hidden md:block">Leyenda</span>
              </button>
          </div>
          <div className="w-full overflow-x-auto pb-4">
            <div className="flex justify-center gap-5 mb-8 bg-slate-50 py-2 px-6 rounded-full border border-slate-200 shadow-sm min-w-max mx-auto">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Realizado / Preexistencia</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pendiente</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-sm"></div><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lesión</span></div>
            </div>

            <div className="flex flex-col items-center gap-6 min-w-max">
                {/* ARCADA SUPERIOR */}
                <div className="flex gap-4">
                  <div className="flex gap-0.5 border-r-2 border-slate-100 pr-4">
                    {(!vistaTemporal ? c1 : t1).map(id => (
                      <DienteVisual key={id} id={id} seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} onFaceClick={(e:any, cara:string) => handleContextMenu(e, id, cara)} />
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {(!vistaTemporal ? c2 : t2).map(id => (
                      <DienteVisual key={id} id={id} seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} onFaceClick={(e:any, cara:string) => handleContextMenu(e, id, cara)} />
                    ))}
                  </div>
                </div>

                {/* ARCADA INFERIOR (invertida) */}
                <div className="flex gap-4 mt-8">
                  <div className="flex gap-0.5 border-r-2 border-slate-100 pr-4">
                    {(!vistaTemporal ? c3 : t3).map(id => (
                      <DienteVisual key={id} id={id} invert seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} onFaceClick={(e:any, cara:string) => handleContextMenu(e, id, cara)} />
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {(!vistaTemporal ? c4 : t4).map(id => (
                      <DienteVisual key={id} id={id} invert seleccionado={dientesSeleccionados.includes(id)} onSelect={handleDienteClick} onContextMenu={(e:any) => handleContextMenu(e, id)} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(id))} estadoDiente={odontogramaEstado[id.toString()]} abrirPanelAgregar={abrirPanelAgregar} onFaceClick={(e:any, cara:string) => handleContextMenu(e, id, cara)} />
                    ))}
                  </div>
                </div>
              </div>
          </div>

          <div className="mt-12 flex flex-col md:flex-row gap-10 justify-center items-center w-full max-w-4xl">
            <div className="flex flex-col gap-2">
               <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">Sextantes</h4>
               <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    {[{ s: 1, Logo: LogoSextante1 }, { s: 2, Logo: LogoSextante2 }, { s: 3, Logo: LogoSextante3 }].map(({ s, Logo }) => (
                       <button key={s} onClick={() => abrirPanelAgregar(null, '', `Sextante ${s}`)} onContextMenu={(e) => handleContextMenu(e, null, undefined, `Sextante ${s}`)} className="px-4 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-1.5 shadow-sm">
                         <Logo /> <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600">S{s}</span>
                       </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {[{ s: 6, Logo: LogoSextante6 }, { s: 5, Logo: LogoSextante5 }, { s: 4, Logo: LogoSextante4 }].map(({ s, Logo }) => (
                       <button key={s} onClick={() => abrirPanelAgregar(null, '', `Sextante ${s}`)} onContextMenu={(e) => handleContextMenu(e, null, undefined, `Sextante ${s}`)} className="px-4 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-1.5 shadow-sm">
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
                  <button onClick={() => abrirPanelAgregar(null, '', 'Arcada Superior')} onContextMenu={(e) => handleContextMenu(e, null, undefined, 'Arcada Superior')} className="px-5 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-2 shadow-sm">
                    <LogoArcadaSup /> <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600">Superior</span>
                  </button>
                  <button onClick={() => abrirPanelAgregar(null, '', 'Arcada Inferior')} onContextMenu={(e) => handleContextMenu(e, null, undefined, 'Arcada Inferior')} className="px-5 py-2 bg-white border-2 border-slate-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center justify-center gap-2 shadow-sm">
                    <LogoArcadaInf /> <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600">Inferior</span>
                  </button>
              </div>
            </div>
          </div>
          
          <AnimatePresence>
              {(dientesSeleccionados.length > 1 || (dientesSeleccionados.length === 1 && !panelAgregarAbierto)) && (
                  <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 p-3 rounded-3xl shadow-2xl z-40 flex items-center gap-4" data-html2canvas-ignore="true">
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
             <button onClick={() => setModoSeleccionMultiple(!modoSeleccionMultiple)} className={`flex-1 border-2 px-6 py-4 rounded-[1.2rem] font-black text-[11px] uppercase shadow-sm transition-all flex items-center justify-center gap-2 ${modoSeleccionMultiple ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600'}`}>
               {modoSeleccionMultiple ? <X size={16} /> : <Check size={16} />} {modoSeleccionMultiple ? 'Cancelar Selección' : 'Seleccionar Varios'}
             </button>
             <button onClick={() => setModalNuevaSeccion(true)} className="flex-1 bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-[1.2rem] font-black text-[11px] uppercase shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
               <Layers size={16} /> Crear Fase Clínica
             </button>
             <button onClick={() => abrirPanelAgregar(null)} className="flex-1 bg-white border-2 border-slate-900 text-slate-900 px-6 py-4 rounded-[1.2rem] font-black text-[11px] uppercase shadow-md hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2">
               <Plus size={16} /> Tto. General / Receta
             </button>
          </div>

          {/* MENÚ CONTEXTUAL ABSOLUTO */}
          <AnimatePresence>
            {menuContextual && (
              <div style={{ position: 'absolute', top: menuContextual.y + 10, left: menuContextual.lado === 'derecha' ? menuContextual.x + 20 : menuContextual.x - 220, zIndex: 100 }}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-white border shadow-2xl rounded-[2rem] p-2 w-[220px]" onClick={(e) => e.stopPropagation()}>
                  
                  {vistaMenu === 'principal' ? (
                      <div className="w-[220px] shrink-0 p-3 space-y-1 text-left">
                        <p className="px-3 py-2 text-[10px] font-black uppercase text-blue-600 border-b border-slate-100 mb-2 italic text-center">
                          {menuContextual.zona || (menuContextual.cara ? `Pieza ${menuContextual.diente} (${menuContextual.cara})` : `Pieza ${menuContextual.diente}`)}
                        </p>
                        <button onClick={() => setVistaMenu('preexistencias')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group hover:bg-blue-50 text-left font-black uppercase text-[9px] text-slate-700">
                          <span>Agregar Preexistencia</span><ChevronRight size={14}/>
                        </button>
                        <button onClick={() => setVistaMenu('lesiones')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group hover:bg-red-50 text-left font-black uppercase text-[9px] text-slate-700">
                          <span>Definir Lesión</span><ChevronRight size={14}/>
                        </button>
                        <div className="h-px bg-slate-100 my-2 mx-2"></div>
                        <button onClick={() => { abrirPanelAgregar(menuContextual.diente, menuContextual.cara, menuContextual.zona); setMenuContextual(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all text-left text-slate-600 font-black uppercase text-[9px]">
                          <Settings size={14}/> Agregar Prestación
                        </button>
                        <button onClick={() => { setVerInfoElemento(menuContextual.diente || menuContextual.zona!); setMenuContextual(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all text-left text-slate-600 font-black uppercase text-[9px]">
                          <Info size={14} className="text-blue-500"/> Ver Información
                        </button>
                        {!menuContextual.cara && (
                            <button onClick={() => aplicarHallazgo('Ausente')} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-all text-left text-slate-600 font-black uppercase text-[9px]">
                              <EyeOff size={14} className="text-slate-400"/> Marcar Ausente
                            </button>
                        )}
                        <button onClick={() => aplicarHallazgo('Sano')} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50 rounded-xl transition-all text-left text-emerald-700 font-black uppercase text-[9px]">
                          <CheckCircle2 size={14} className="text-emerald-500"/> Marcar Sano (Borrar)
                        </button>
                      </div>
                  ) : (
                      <div className="p-2 flex flex-col">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 px-2 pt-2">
                          <p className="text-[9px] font-black uppercase text-slate-400 italic">{vistaMenu}</p>
                          <button onClick={() => setVistaMenu('principal')} className="bg-slate-100 text-slate-600 text-[8px] px-3 py-1 rounded-full font-black uppercase hover:bg-slate-200">Volver</button>
                        </div>
                        <div className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                          {(vistaMenu === 'preexistencias' ? PREEXISTENCIAS_LISTA : LESIONES_LISTA).map((op) => (
                            <button key={op} onClick={() => aplicarHallazgo(op)} className="flex items-center gap-3 w-full p-2 hover:bg-blue-50 rounded-lg text-left transition-colors">
                              <div className="w-6 h-6 shrink-0">
                                 <svg viewBox="-10 -10 120 140" className="w-full h-full"><LogoRender hallazgo={op} /></svg>
                              </div>
                              <span className="text-[9px] font-black uppercase text-slate-600">{op}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </section>

        {/* SOLO LOS QUE PUEDEN VER FINANZAS PUEDEN FORZAR LA APROBACIÓN MANUAL (Cobros) */}
        {!presupuestoData?.isAprobado && puedeVerFinanzas && (
          <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-4 flex justify-center mb-6" data-html2canvas-ignore="true">
            <button onClick={aprobarPlanManualmente} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-2">
              <CheckCircle2 size={16}/> Forzar Aprobación Manual (Sin Pago)
            </button>
          </div>
        )}
        
        <div className="bg-white border border-slate-200 shadow-sm rounded-[3.5rem] overflow-hidden">
          {seccionesVisibles.length === 0 ? (
            <div className="py-20 text-center">
              <Layers size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">El presupuesto está vacío</p>
            </div>
          ) : (
            seccionesVisibles.map((seccion) => {
              const itemsSeccion = acciones.filter(a => a.seccion_nombre === seccion && !a.es_oculto);
              return (
              <div 
                key={seccion} 
                className="mb-10 last:mb-0 p-8 transition-all border-2 border-transparent hover:border-dashed hover:border-slate-300"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, seccion)}
              >
                <h3 className="px-6 py-4 bg-slate-50 border-l-4 border-blue-500 font-black text-xs uppercase text-slate-700 tracking-widest rounded-r-2xl mb-4 flex justify-between items-center pointer-events-none">
                  <div className="flex items-center gap-3">
                    <Layers size={16} className="text-blue-500" /> {seccion}
                  </div>
                  {puedeVerFinanzas && (
                    <span className="text-[10px] text-slate-400 font-bold">Subtotal: ${totalPorSeccion(seccion).toLocaleString('es-CL')}</span>
                  )}
                </h3>
                
                {itemsSeccion.length === 0 ? (
                  <div className="px-8 py-6 border-2 border-dashed border-slate-100 rounded-3xl text-center pointer-events-none">
                     <p className="text-[10px] font-black text-slate-300 uppercase italic">Arrastra tratamientos aquí</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          {modoSeleccionMultiple && (
                            <th className="px-4 py-4 text-center">
                              <input type="checkbox" className="w-5 h-5 accent-blue-600" onChange={(e) => setItemsAEvolucionar(e.target.checked ? itemsSeccion.map(i => i.id) : [])} />
                            </th>
                          )}
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic w-24 text-center">Pieza</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic">Prestación</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-center w-32">Avance</th>
                          
                          {puedeVerFinanzas && (
                              <>
                                  <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-right">Pactado</th>
                                  <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-right">Abonado</th>
                                  <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 italic text-right">Saldo</th>
                              </>
                          )}
                          
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
                            {modoSeleccionMultiple && (
                              <td className="px-4 py-5 text-center">
                                <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={itemsAEvolucionar.includes(item.id)} onChange={() => setItemsAEvolucionar(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])} />
                              </td>
                            )}
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
                              <div className="flex items-center justify-center gap-1">
                                {[0, 25, 50, 75, 100].map(p => {
                                  const isDone = item.avance >= p;
                                  const isNext = p > item.avance && (p - 25) === item.avance;
                                  return (
                                    <button
                                      key={p}
                                      disabled={item.avance === 100}
                                      onClick={() => abrirModalEvolucion([item.id], p)}
                                      className={`w-4 h-4 rounded-full border-2 transition-all ${isDone ? 'bg-blue-500 border-blue-600' : 'bg-slate-200 border-slate-300'} ${isNext && 'animate-pulse'}`}
                                      title={`Evolucionar a ${p}%`}
                                    />
                                  )})}
                              </div>
                            </td>

                            {puedeVerFinanzas && (
                                <>
                                    <td className="px-6 py-5 text-right font-bold text-slate-500 text-[11px]">${Number(item.display_pactado).toLocaleString('es-CL')}</td>
                                    <td className="px-6 py-5 text-right font-bold text-emerald-600 text-[11px]">${Number(item.display_abonado).toLocaleString('es-CL')}</td>
                                    <td className="px-6 py-5 text-right font-black text-slate-900 text-[11px]">${Number(item.display_saldo).toLocaleString('es-CL')}</td>
                                </>
                            )}

                            <td className="px-6 py-5 text-center">
                              <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${item.estado === 'realizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                {item.estado || 'Pendiente'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center flex items-center justify-center gap-1" data-html2canvas-ignore="true">
                              {item.estado !== 'realizado' && item.avance === 0 ? (
                                <>
                                  {puedeVerFinanzas && (
                                      <button 
                                          onClick={() => { 
                                              setModalEditarItem({abierto: true, item}); 
                                              setDctoInput(item.descuento || 0); 
                                              setCostoLabInput(item.costo_laboratorio || 0); 
                                              setLabPorDoctorInput(item.lab_pagado_por_dr || false); 
                                          }} 
                                          className="text-slate-400 hover:text-blue-600 transition-colors p-2 bg-white rounded-lg border border-slate-100 shadow-sm" 
                                          title="Ajustes Clínicos (Descuento/Lab)"
                                      >
                                        <Settings size={14}/>
                                      </button>
                                  )}
                                  <button onClick={() => eliminarPrestacionLocal(item.id, item.tempId)} className="text-red-400 hover:text-red-600 transition-colors p-2 bg-white rounded-lg border border-slate-100 shadow-sm" title="Eliminar Prestación">
                                    <Trash2 size={14}/>
                                  </button>
                                </>
                              ) : item.estado === 'realizado' ? (
                                <span className="px-4 py-1.5 rounded-full text-[8px] font-black uppercase border bg-emerald-50 text-emerald-600 border-emerald-100">Realizado</span>
                              ) : (
                                <span className="px-4 py-1.5 rounded-full text-[8px] font-black uppercase border bg-yellow-50 text-yellow-600 border-yellow-100">En Proceso</span>
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

      {/* 🔥 MODAL DE AJUSTES CLÍNICOS (Descuento y Laboratorio) 🔥 */}
      <AnimatePresence>
        {modalEditarItem.abierto && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Ajustes Clínicos</h3>
                  <button onClick={() => setModalEditarItem({abierto: false, item: null})} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                   <div>
                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Prestación Seleccionada</p>
                       <p className="text-sm font-bold text-slate-800 leading-tight">{modalEditarItem.item?.display_nombre}</p>
                   </div>
                   
                   {/* SECCIÓN DESCUENTOS */}
                   <div className="space-y-2 p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                      <label className="text-[10px] font-black uppercase text-slate-500">Descuento al Paciente (%)</label>
                      <select value={dctoInput} onChange={(e) => setDctoInput(parseInt(e.target.value))} className="w-full p-4 rounded-xl bg-white font-black text-xs uppercase border border-slate-200 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm">
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
                      
                      <div className="pt-2 flex justify-between items-center border-t border-slate-200 mt-4">
                         <span className="text-[10px] font-black uppercase text-slate-400">Precio Final Paciente:</span>
                         <span className="text-lg font-black text-blue-600">${((modalEditarItem.item?.precio_base || modalEditarItem.item?.precio || 0) * (1 - (dctoInput / 100))).toLocaleString('es-CL')}</span>
                      </div>
                   </div>

                   {/* SECCIÓN LABORATORIO E INSUMOS */}
                   <div className="space-y-4 p-5 bg-purple-50 border border-purple-100 rounded-2xl">
                      <div>
                          <label className="text-[10px] font-black uppercase text-purple-600">Costo de Insumo / Laboratorio ($)</label>
                          <p className="text-[9px] text-purple-400 font-bold mb-2">Se ha autocompletado si hay un laboratorio registrado.</p>
                          <input 
                              type="number" 
                              placeholder="Ej: 35000"
                              value={costoLabInput || ''}
                              onChange={(e) => setCostoLabInput(Number(e.target.value))}
                              className="w-full p-4 rounded-xl bg-white font-black text-sm text-slate-800 border border-purple-200 outline-none focus:border-purple-500 transition-all shadow-sm"
                          />
                      </div>
                      
                      {costoLabInput > 0 && (
                          <div className="flex items-center justify-between pt-2">
                              <span className="text-[10px] font-black uppercase text-slate-600">¿Material aportado por el Doctor?</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={labPorDoctorInput} onChange={(e) => setLabPorDoctorInput(e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                              </label>
                          </div>
                      )}
                      {costoLabInput > 0 && labPorDoctorInput && (
                          <p className="text-[9px] font-bold text-purple-600 bg-purple-100 p-2 rounded-lg italic">
                              💰 Estos ${costoLabInput.toLocaleString('es-CL')} se le reembolsarán al doctor en su liquidación.
                          </p>
                      )}
                   </div>

                   <button onClick={handleGuardarAjustes} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-slate-800 transition-all">
                     Guardar Ajustes
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PANEL UNIVERSAL AGREGAR PRESTACIÓN Y PACKS */}
      <AnimatePresence>
        {panelAgregarAbierto && (
          <motion.aside initial={{ x: -550, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -550, opacity: 0 }} className="fixed top-0 left-0 h-screen w-[500px] bg-white shadow-[20px_0_50px_rgba(0,0,0,0.1)] z-50 flex flex-col border-r border-slate-100 overflow-hidden text-left">
            
            <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200 shrink-0">
               {zonaInput ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-lg border border-emerald-200">Añadiendo a: {zonaInput}</span>
               ) : <span className="text-xs font-black uppercase text-slate-400">Menú Clínico</span>}
               <button onClick={() => { setPanelAgregarAbierto(false); setDientesSeleccionados([]); }} className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all text-slate-500 shadow-sm"><X size={16}/></button>
            </div>

            <div className="p-6 space-y-4 border-b border-slate-100 bg-white shrink-0 shadow-sm z-10">
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
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-800 ml-1">Pieza Dental</label>
                    <input type="text" disabled={!!zonaInput} placeholder={zonaInput ? "-" : "General"} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 font-bold text-xs uppercase border border-slate-200 text-slate-900 outline-none focus:border-blue-500 transition-all text-center disabled:bg-slate-100 disabled:text-slate-400" value={dienteInput} onChange={(e) => setDienteInput(e.target.value)} />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-800 ml-1">Cara / Superficie</label>
                    <div className="flex flex-wrap gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <button 
                            onClick={() => setCaraInput('')} 
                            disabled={!!zonaInput}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all disabled:opacity-50 ${caraInput === '' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                            Completa
                        </button>
                        {['O', 'V', 'L', 'M', 'D'].map(c => {
                             return (
                                <button 
                                    key={c}
                                    onClick={(e) => { e.preventDefault(); toggleCara(c); }} 
                                    disabled={!!zonaInput}
                                    className={`w-9 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all disabled:opacity-50 ${caraInput.includes(c) ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-400'}`}
                                >
                                    {c}
                                </button>
                             )
                        })}
                    </div>
                  </div>
                </div>

                {/* 🔥 PESTAÑAS: PRESTACIONES VS PACKS 🔥 */}
                <div className="flex p-1 bg-slate-100 rounded-xl mt-4">
                   <button onClick={() => setTabPanel('prestaciones')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${tabPanel === 'prestaciones' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      Individuales
                   </button>
                   <button onClick={() => setTabPanel('packs')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${tabPanel === 'packs' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      <Package size={12}/> Plantillas (Packs)
                   </button>
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Search size={18} className="text-slate-500 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input 
                     type="text" 
                     placeholder={tabPanel === 'prestaciones' ? "Buscar prestación..." : "Buscar pack o categoría..."}
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
            
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50 space-y-3 custom-scrollbar">
                {/* VISTA PRESTACIONES */}
                {tabPanel === 'prestaciones' && Object.keys(seccionesPrests).sort((a,b)=>a.localeCompare(b)).map(cat => {
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
                                            <button onClick={(e) => { e.stopPropagation(); setModalIcono({abierto: true, prestacion: p}); }} title="Cambiar Logo Permanentemente" className="w-12 h-12 flex shrink-0 items-center justify-center bg-slate-100 hover:bg-blue-600 rounded-l-lg transition-colors overflow-hidden group/logo relative">
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
                                             <button onClick={() => {
                                                 if (!profesionalSeleccionado) return toast.error("Seleccione un dentista responsable primero.");
                                                 setModalConfirmarPrestacion({abierto: true, prestacion: p});
                                             }} className="flex-1 text-left py-3 px-3 flex justify-between items-center h-full">
                                                <span className="text-sm font-bold text-slate-800 group-hover:text-blue-700 leading-snug capitalize">{p.display_nombre.toLowerCase()}</span>
                                                <Plus size={20} className="shrink-0 text-slate-300 group-hover:text-blue-600"/>
                                            </button>
                                        </div>
                                    ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                        </div>
                    )
                })}

                {/* VISTA PACKS Y PLANTILLAS */}
                {tabPanel === 'packs' && (
                   <div className="space-y-3">
                      {plantillasDisponibles.filter(p => p.nombre.toUpperCase().includes(busqueda.toUpperCase()) || p.categoria.toUpperCase().includes(busqueda.toUpperCase())).map((pack) => (
                         <div 
                            key={pack.id} 
                            onClick={() => abrirModalPack(pack)}
                            className="bg-white p-5 rounded-2xl border-2 border-emerald-100 hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer shadow-sm flex flex-col group"
                         >
                            <div className="flex items-center gap-3 mb-2">
                               {pack.icono_tipo ? (
                                  <div className="w-6 h-6 shrink-0">
                                     <svg viewBox="-10 -10 120 140" className="w-full h-full drop-shadow-sm">
                                        <LogoRender iconoKey={pack.icono_tipo} hallazgo={pack.nombre} colorOverride="#10b981" />
                                     </svg>
                                  </div>
                               ) : (
                                  <Package size={16} className="text-emerald-500 shrink-0"/>
                               )}
                               <span className="text-[8px] font-black uppercase text-emerald-500">{pack.categoria || 'Sección General'}</span>
                            </div>

                            <h4 className="text-sm font-black uppercase text-slate-800 group-hover:text-emerald-700 leading-tight">{pack.nombre}</h4>
                            <div className="flex items-center justify-between mt-3 border-t border-emerald-100 pt-2">
                               <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Layers size={12}/> {pack.items?.length || 0} ítems</span>
                               <span className="text-[11px] font-black text-emerald-600">${Number(pack.precio_total).toLocaleString('es-CL')}</span>
                            </div>
                         </div>
                      ))}
                      {plantillasDisponibles.length === 0 && (
                         <div className="text-center p-8">
                            <Package className="mx-auto text-slate-300 mb-2" size={32}/>
                            <p className="text-[10px] font-black text-slate-400 uppercase">No hay packs creados en el sistema.</p>
                         </div>
                      )}
                   </div>
                )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MODAL PARA CONFIRMAR SECCIÓN DE PRESTACIÓN */}
      <AnimatePresence>
        {modalConfirmarPrestacion.abierto && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <Plus size={20} />
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">Confirmar Prestación</h3>
                  </div>
                  <button onClick={() => setModalConfirmarPrestacion({abierto: false, prestacion: null})} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-8 space-y-6">
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prestación</p>
                      <p className="text-sm font-bold text-slate-800">{modalConfirmarPrestacion.prestacion?.display_nombre}</p>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aplicar en</p>
                      <p className="text-sm font-bold text-slate-800">
                        {zonaInput ? `Zona: ${zonaInput}` : `Pieza(s): ${dienteInput}`}
                        {caraInput && `, Cara(s): ${caraInput}`}
                      </p>
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block mb-2">Guardar en Fase Clínica</label>
                      <select className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase" value={seccionInput} onChange={(e) => setSeccionInput(e.target.value)}>
                        {listaSecciones.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                      </select>
                   </div>
                   <button onClick={() => {
                       handleSeleccionarTratamiento(modalConfirmarPrestacion.prestacion);
                       setModalConfirmarPrestacion({abierto: false, prestacion: null});
                     }} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3">
                     <Plus size={18} /> Agregar al Plan
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔥 MODAL PARA APLICAR EL PACK (CON DESCUENTOS Y LAB INDIVIDUAL) 🔥 */}
      <AnimatePresence>
         {modalPack.abierto && modalPack.pack && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
               <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 bg-emerald-600 text-white flex justify-between items-center shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                           {modalPack.pack.icono_tipo ? (
                              <div className="w-8 h-8">
                                 <svg viewBox="-10 -10 120 140" className="w-full h-full drop-shadow-sm">
                                    <LogoRender iconoKey={modalPack.pack.icono_tipo} hallazgo={modalPack.pack.nombre} colorOverride="#ffffff" />
                                 </svg>
                              </div>
                           ) : (
                              <Package size={24}/>
                           )}
                        </div>
                        <div>
                           <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{modalPack.pack.nombre}</h2>
                           <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mt-1">Configurar e Insertar Pack</p>
                        </div>
                     </div>
                     <button onClick={() => setModalPack({...modalPack, abierto: false})} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-500 transition-all"><X size={20}/></button>
                  </div>

                  <div className="flex flex-col flex-1 overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
                      <div className="space-y-4">
                         {modalPack.pack.items?.map((pi: any, idx: number) => {
                             const config = modalPack.configuraciones[pi.prestacion.id] || { cantidad: pi.cantidad, descuento: 0, costoLab: 0, labsDisponibles: [] };
                             return (
                                <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-4 group">
                                   <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                         <span className="text-[8px] font-black uppercase text-slate-400 block mb-1">{pi.prestacion?.["Nombre Categoria"]}</span>
                                         <span className="text-sm font-black text-slate-800 uppercase leading-snug block pr-4">{pi.prestacion?.display_nombre}</span>
                                      </div>
                                      <div className="text-right shrink-0">
                                         <span className="text-[10px] font-bold text-slate-400 block line-through">${Number(pi.prestacion?.Precio || 0).toLocaleString('es-CL')}</span>
                                         <span className="text-sm font-black text-blue-600 block">${(Number(pi.prestacion?.Precio || 0) * (1 - config.descuento / 100)).toLocaleString('es-CL')}</span>
                                      </div>
                                   </div>

                                   <div className="flex flex-wrap items-center gap-3">
                                      {/* Cantidad */}
                                      <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                                         <button onClick={() => updatePackItemConfig(pi.prestacion.id, 'cantidad', Math.max(1, config.cantidad - 1))} className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-slate-600 hover:bg-slate-200 border border-slate-200 shadow-sm"><Minus size={12}/></button>
                                         <span className="font-black text-xs w-4 text-center">{config.cantidad}</span>
                                         <button onClick={() => updatePackItemConfig(pi.prestacion.id, 'cantidad', config.cantidad + 1)} className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 shadow-sm"><Plus size={12}/></button>
                                      </div>

                                      {/* Descuento Individual */}
                                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex-1 min-w-[150px]">
                                         <Tag size={12} className="text-blue-500 shrink-0" />
                                         <select value={config.descuento} onChange={(e) => updatePackItemConfig(pi.prestacion.id, 'descuento', parseInt(e.target.value))} className="bg-transparent w-full text-xs font-black text-slate-700 outline-none cursor-pointer">
                                            <option value={0}>0% Descuento</option>
                                            <option value={5}>5% Descuento</option>
                                            <option value={10}>10% Descuento</option>
                                            <option value={15}>15% Descuento</option>
                                            <option value={20}>20% Descuento</option>
                                            <option value={25}>25% Descuento</option>
                                            <option value={30}>30% Descuento</option>
                                            <option value={40}>40% Descuento</option>
                                            <option value={50}>50% Descuento</option>
                                            <option value={100}>100% Cortesía</option>
                                         </select>
                                      </div>

                                      {/* Laboratorio Inteligente (Solo si aplica) */}
                                      {config.labsDisponibles.length > 0 && (
                                         <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 flex-1 min-w-[200px]">
                                            <Activity size={12} className="text-purple-600 shrink-0" />
                                            <select value={config.labId || ''} onChange={(e) => updatePackItemConfig(pi.prestacion.id, 'labId', e.target.value)} className="bg-transparent w-full text-[10px] font-black text-purple-800 outline-none cursor-pointer">
                                               {config.labsDisponibles.map((l:any) => (
                                                  <option key={l.laboratorio_id} value={l.laboratorio_id}>
                                                     {laboratoriosDB[l.laboratorio_id] || 'Laboratorio'} (${(l.costo_clinica || 0).toLocaleString('es-CL')})
                                                  </option>
                                               ))}
                                            </select>
                                         </div>
                                      )}
                                   </div>
                                </div>
                             )
                         })}
                      </div>
                  </div>

                  <div className="p-8 bg-white border-t border-slate-100 shrink-0 flex flex-col md:flex-row justify-between items-center gap-6">
                     <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Precio Final del Pack</span>
                        <span className="text-2xl font-black text-emerald-600">
                            ${modalPack.pack.items.reduce((acc: number, pi: any) => {
                                const cfg = modalPack.configuraciones[pi.prestacion.id];
                                return acc + (Number(pi.prestacion?.Precio || 0) * cfg.cantidad * (1 - cfg.descuento / 100));
                            }, 0).toLocaleString('es-CL')}
                        </span>
                     </div>
                     <button onClick={handleAgregarPackCompletos} className="w-full md:w-auto bg-emerald-600 text-white px-10 py-5 rounded-[1.5rem] font-black text-xs uppercase shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                        <Plus size={18}/> Insertar Pack en Paciente
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* MODAL DE EVOLUCIÓN */}
      {/* MODAL DE EVOLUCIÓN */}
      <AnimatePresence>
        {modalEvolucionAbierto && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center"><FileSignature size={24}/></div>
                    <div>
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Evolución Clínica</h2>
                      <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">Firma electrónica de procedimientos</p>
                    </div>
                  </div>
                  <button onClick={() => setModalEvolucionAbierto(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-500 transition-all"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">1. Procedimientos a Evolucionar</h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
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
                               <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
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
                      {perfil?.rol === 'ADMIN' && (
                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Profesional Actuante</label>
                          <select className="w-full p-4 rounded-xl bg-slate-50 font-bold text-xs uppercase border border-slate-200 text-slate-900 outline-none focus:border-blue-500 transition-all cursor-pointer" value={profesionalSeleccionado} onChange={(e) => setProfesionalSeleccionado(e.target.value)}>
                              <option value="">Seleccione su nombre...</option>
                              {profesionales.map(p => <option key={p.user_id} value={p.user_id}>Dr. {p.nombre} {p.apellido}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Porcentaje de Avance</label>
                        <div className="flex items-center justify-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                          {[0, 25, 50, 75, 100].map(p => (
                            <button
                              key={p}
                              onClick={() => setAvanceEvolucion(p)}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${avanceEvolucion === p ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 text-left flex-1 flex flex-col">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Observaciones / Evolución</label>
                        <textarea placeholder="Ej: Se realiza exodoncia de pieza 18 sin complicaciones..." className="w-full p-4 rounded-xl bg-slate-50 font-medium text-sm border border-slate-200 outline-none focus:border-blue-500 transition-all resize-none h-32 custom-scrollbar" value={notaClinica} onChange={(e) => setNotaClinica(e.target.value)} />
                      </div>
                    </div>
                  </div>
               </div>

               <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button onClick={ejecutarGuardadoEvolucion} disabled={guardandoEvolucion || itemsAEvolucionar.length === 0 || !profesionalSeleccionado || !notaClinica.trim()} className="bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                    {guardandoEvolucion ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {guardandoEvolucion ? 'Firmando...' : 'Guardar y Firmar Evolución'}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PARA CREAR NUEVA SECCIÓN/FASE */}
      <AnimatePresence>
        {modalNuevaSeccion && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <Layers size={20} />
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">Nueva Fase Clínica</h3>
                  </div>
                  <button onClick={() => setModalNuevaSeccion(false)} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-8 space-y-6">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block mb-2">Nombre de la Fase</label>
                      <input 
                        autoFocus
                        placeholder="Ej: Fase de Rehabilitación"
                        className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 ring-blue-500/20 shadow-inner uppercase"
                        value={nuevaSeccionNombre}
                        onChange={(e) => setNuevaSeccionNombre(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCrearSeccion()}
                      />
                   </div>
                   <button onClick={handleCrearSeccion} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3">
                     <Plus size={18} /> Crear Fase
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PANEL DE INFORMACIÓN DEL DIENTE/ZONA (MODAL LATERAL DERECHO) */}
      <AnimatePresence>
        {verInfoElemento && (
          <motion.aside initial={{ x: 450, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 450, opacity: 0 }} className="fixed top-0 right-0 h-screen w-[380px] bg-white shadow-2xl z-50 border-l border-slate-100 flex flex-col overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-lg uppercase italic tracking-tighter">Detalles Pieza {verInfoElemento}</h3>
              <button onClick={() => setVerInfoElemento(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 text-left text-slate-800">
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center">
                  <div className="w-24 h-28 mb-4 pointer-events-none">
                    <DienteVisual id={typeof verInfoElemento === 'number' ? verInfoElemento : 0} estadoDiente={odontogramaEstado[verInfoElemento.toString()]} itemsDiente={todasLasAccionesBoca.filter(a => String(a.diente_id) === String(verInfoElemento))} onFaceClick={()=>{}} onContextMenu={()=>{}} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista Previa</span>
               </div>
               
               <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b pb-2">Hallazgos registrados</h4>
                 {odontogramaEstado[verInfoElemento.toString()]?.hallazgos?.length || odontogramaEstado[verInfoElemento.toString()]?.caras ? (
                   <>
                     {odontogramaEstado[verInfoElemento.toString()]?.hallazgos?.map((h:string, idx:number)=>(
                        <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between group shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8"><svg viewBox="-10 -10 120 140" className="w-full h-full"><LogoRender hallazgo={h} /></svg></div>
                            <span className="text-xs font-black uppercase text-slate-700">{h} (Raíz)</span>
                          </div>
                          <button onClick={() => eliminarHallazgoEspecifico(verInfoElemento as number, h)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-2 hover:bg-slate-50 rounded-lg">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                     ))}
                     {odontogramaEstado[verInfoElemento.toString()]?.caras && Object.entries(odontogramaEstado[verInfoElemento.toString()].caras).map(([cara, val]) => val && (
                        <div key={cara} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between group shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8"><svg viewBox="-10 -10 120 140" className="w-full h-full"><LogoRender hallazgo={val as string} /></svg></div>
                            <span className="text-xs font-black uppercase text-slate-700">{val} (Cara {cara})</span>
                          </div>
                          <button onClick={async () => {
                                guardarHistorial();
                                const dId = verInfoElemento.toString();
                                let nuevoEstado = JSON.parse(JSON.stringify(odontogramaEstado));
                                if (nuevoEstado[dId] && nuevoEstado[dId].caras) {
                                  delete nuevoEstado[dId].caras[cara];
                                }
                                const { error } = await supabase.from('odontogramas').upsert({ paciente_id: pacienteId, dentadura: nuevoEstado }, { onConflict: 'paciente_id' });
                                if (!error) {
                                    setOdontogramaEstado(nuevoEstado);
                                    toast.success("Hallazgo de cara eliminado.");
                                } else { toast.error("Error al eliminar el hallazgo."); }
                            }} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-2 hover:bg-slate-50 rounded-lg" title="Eliminar hallazgo de esta cara">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                     ))}
                   </>
                 ) : <p className="text-xs text-slate-400 italic">Sin hallazgos clínicos manuales</p>}
               </div>

               <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b pb-2 mt-8">Tratamientos Asociados</h4>
                 {(() => {
                    const itemsPanel = typeof verInfoElemento === 'number' 
                         ? todasLasAccionesBoca.filter(a => String(a.diente_id) === String(verInfoElemento))
                         : todasLasAccionesBoca.filter(a => a.zona === verInfoElemento);

                    return itemsPanel.length > 0 ? (
                      itemsPanel.map((item, i) => (
                        <div key={i} className="p-5 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm relative group transition-all hover:border-blue-300 hover:shadow-md">
                          
                          {/* 🔥 BOTONES DE EDITAR LOGO Y ELIMINAR RESTAURADOS 🔥 */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                            <button 
                                onClick={() => {
                                    let prestacionMaestra = { id: item.prestacion_id, display_nombre: item.display_nombre };
                                    if (!prestacionMaestra.id) {
                                        for (const cat in seccionesPrests) {
                                            const match = seccionesPrests[cat].find((p:any) => p.display_nombre?.toLowerCase() === item.display_nombre?.toLowerCase());
                                            if (match) { prestacionMaestra = match; break; }
                                        }
                                    }
                                    setModalIcono({ abierto: true, prestacion: prestacionMaestra });
                                }} 
                                className="text-slate-400 hover:text-blue-500 transition-all bg-white rounded-full p-1.5 shadow-sm border border-slate-100" 
                                title="Asignar o Cambiar Logo"
                            >
                                <RefreshCcw size={14}/>
                            </button>
                            {item.estado !== 'realizado' && item.avance === 0 && item.presupuesto_id === idURL && (
                                <button onClick={() => eliminarPrestacionLocal(item.id, item.tempId)} className="text-red-400 hover:text-red-600 transition-all bg-white rounded-full p-1.5 shadow-sm border border-slate-100" title="Eliminar Prestación">
                                  <Trash2 size={14}/>
                                </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mb-3 pr-12">
                             <div className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0">
                               <svg viewBox="-10 -10 120 140" className="w-full h-full p-1.5">
                                  <LogoRender hallazgo={item.display_nombre} iconoKey={item.icono_tipo} colorOverride={item.estado === 'realizado' ? "#10b981" : "#ef4444"} />
                               </svg>
                             </div>
                             <div className="flex flex-col">
                                {item.zona && <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{item.zona}</span>}
                                <p className="text-[10px] font-black uppercase text-slate-800 leading-tight mt-0.5">{item.display_nombre}</p>
                             </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase border ${item.estado === 'realizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                              {item.estado || 'Pendiente'}
                            </span>
                            
                            {puedeVerFinanzas && (
                                <div className="text-right">
                                   <p className="text-[10px] font-black text-slate-900">${Number(item.display_pactado).toLocaleString('es-CL')}</p>
                                   {item.display_saldo > 0 && <p className="text-[8px] font-bold text-red-400 uppercase">Sal: ${Number(item.display_saldo).toLocaleString('es-CL')}</p>}
                                </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : <p className="text-[10px] font-bold text-slate-300 uppercase italic px-2">No hay tratamientos asignados</p>
                })()}
               </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MODAL PARA CAMBIAR ICONO DE PRESTACIÓN */}
      <AnimatePresence>
        {modalIcono.abierto && (
          <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-32">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden text-left flex flex-col max-h-[70vh]">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Asignar Logo a Prestación</h3>
                  <button onClick={() => setModalIcono({abierto: false, prestacion: null, autoAdd: false})} className="hover:text-red-400 transition-colors"><X size={20}/></button>
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
                           <svg viewBox="-10 -10 120 140" className="w-full h-full drop-shadow-sm"><LogoRender iconoKey={ico.id} hallazgo={ico.label} colorOverride="#2563eb" /></svg>
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600 text-center leading-tight">{ico.label}</span>
                      </button>
                   ))}
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                   <button onClick={() => handleGuardarIcono(null)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={14}/> Quitar Logo Actual
                   </button>
                   <button onClick={() => setModalIcono({abierto: false, prestacion: null, autoAdd: false})} className="px-5 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all rounded-xl text-[10px] font-black uppercase">
                      Cancelar
                   </button>
                </div>

             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔥 BARRA FLOTANTE PARA EVOLUCIÓN MÚLTIPLE 🔥 */}
      <AnimatePresence>
        {modoSeleccionMultiple && itemsAEvolucionar.length > 0 && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 p-3 rounded-[2rem] shadow-2xl z-40 flex items-center gap-4">
              <div className="px-5 text-white border-r border-white/10 pr-6 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Seleccionados</p>
                  <p className="font-bold">{itemsAEvolucionar.length} tratamientos</p>
              </div>
              <div className="flex items-center gap-2">
                  <select onChange={(e) => abrirModalEvolucion(itemsAEvolucionar, parseInt(e.target.value))} className="bg-slate-800 text-white p-3 rounded-xl text-xs font-bold outline-none border border-slate-700 cursor-pointer">
                      <option>Evolucionar a...</option>
                      <option value="25">25%</option>
                      <option value="50">50%</option>
                      <option value="75">75%</option>
                      <option value="100">100%</option>
                  </select>
              </div>
              <button onClick={() => setItemsAEvolucionar([])} className="p-3 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors ml-1">
                  <X size={20}/>
              </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

function CarasDentales({ id, itemsDiente = [], estado, abrirPanelAgregar, onFaceClick, invert }: any) {
  const screenLeft = (id >= 11 && id <= 18) || (id >= 41 && id <= 48) || (id >= 51 && id <= 55) || (id >= 81 && id <= 85);
  const faceLeft = screenLeft ? 'D' : 'M';
  const faceRight = screenLeft ? 'M' : 'D';

  const getFill = (c: string) => {
    // 1. PRIMERA PRIORIDAD: Lesión específica en esta cara
    const valCara = estado?.caras?.[c];
    if (valCara) {
        const low = valCara.toLowerCase();
        // 🔥 AQUÍ ESTÁ EL CAMBIO: SOLO ESTAS 4 LESIONES SE PONEN EN NEGRO 🔥
        if (low.includes('caries') || low.includes('erosi') || low.includes('atrici') || low.includes('abfrac')) {
            return "#0f172a"; // Negro / Gris Oscuro
        }
        // Si es cualquier otro hallazgo en la cara (ej. fractura, sellante), se pone azul
        return "#3b82f6"; 
    }

    // 2. SEGUNDA PRIORIDAD: Lesión General aplicada a todo el diente
    const hallazgosGenerales = estado?.hallazgos || [];
    const tieneLesionGeneralNegra = hallazgosGenerales.some((h: string) => {
        const low = h.toLowerCase();
        // 🔥 LO MISMO AQUÍ: SOLO ESTAS 4 PINTAN TODAS LAS CARAS DE NEGRO 🔥
        return low.includes('caries') || low.includes('erosi') || low.includes('atrici') || low.includes('abfrac');
    });

    if (tieneLesionGeneralNegra) {
        return "#0f172a"; // Negro
    }

    // 3. TERCERA PRIORIDAD: Tratamientos en curso o realizados
    try {
        if (itemsDiente && itemsDiente.length > 0) {
            const realiz = itemsDiente.some((i:any) => i.cara && typeof i.cara === 'string' && i.cara.includes(c) && i.estado === 'realizado');
            if (realiz) return "#10b981"; // Verde
            
            const pend = itemsDiente.some((i:any) => i.cara && typeof i.cara === 'string' && i.cara.includes(c) && i.estado !== 'realizado');
            if (pend) return "#ef4444"; // Rojo
        }
    } catch (error) {
        console.error(`[CARAS] Error al evaluar color en diente ${id}:`, error);
    }

    // 4. Si no hay nada, está sano -> BLANCO
    return "white"; 
  }

  // Rutas redondas originales
  const paths = { 
      V: "M 16 16 A 48 48 0 0 1 84 16 L 64 36 A 20 20 0 0 0 36 36 Z", 
      L: "M 84 84 A 48 48 0 0 1 16 84 L 36 64 A 20 20 0 0 0 64 64 Z", 
      FL: "M 16 84 A 48 48 0 0 1 16 16 L 36 36 A 20 20 0 0 0 36 64 Z", 
      FR: "M 84 16 A 48 48 0 0 1 84 84 L 64 64 A 20 20 0 0 0 64 36 Z" 
  };

  return (
    <svg viewBox="0 0 100 100" className={`w-9 h-9 drop-shadow-sm ${invert ? 'rotate-180' : ''}`}>
       <path d={paths.V} fill={getFill('V')} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, 'V'); }} onContextMenu={(e) => onFaceClick && onFaceClick(e, 'V')} >
           <title>Cara Vestibular</title>
       </path>
       <path d={paths.L} fill={getFill('L')} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, 'L'); }} onContextMenu={(e) => onFaceClick && onFaceClick(e, 'L')} >
           <title>Cara Palatina / Lingual</title>
       </path>
       <path d={paths.FL} fill={getFill(faceLeft)} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, faceLeft); }} onContextMenu={(e) => onFaceClick && onFaceClick(e, faceLeft)} >
           <title>Cara {faceLeft === 'M' ? 'Mesial' : 'Distal'}</title>
       </path>
       <path d={paths.FR} fill={getFill(faceRight)} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, faceRight); }} onContextMenu={(e) => onFaceClick && onFaceClick(e, faceRight)} >
           <title>Cara {faceRight === 'M' ? 'Mesial' : 'Distal'}</title>
       </path>
       <circle cx="50" cy="50" r="20" fill={getFill('O')} stroke="#cbd5e1" strokeWidth="3" className="hover:opacity-70 cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); abrirPanelAgregar(id, 'O'); }} onContextMenu={(e) => onFaceClick && onFaceClick(e, 'O')} >
           <title>Cara Oclusal / Incisal</title>
       </circle>
    </svg>
  )
}

function DienteVisual({ id, seleccionado, onSelect, onContextMenu, onFaceClick, invert = false, itemsDiente = [], estadoDiente, abrirPanelAgregar }: any) {
  const hallazgos = estadoDiente?.hallazgos || [];
  
  // Determinamos si todo en esta pieza dental está finalizado (y hay al menos 1 tratamiento)
  const tratamientosEnPieza = itemsDiente.filter((i:any) => !i.zona);
  const todosRealizados = tratamientosEnPieza.length > 0 && tratamientosEnPieza.every((i:any) => i.estado === 'realizado');
  const tienePendientes = tratamientosEnPieza.some((i:any) => i.estado !== 'realizado');
  
  const isAusenteManual = hallazgos.includes('Ausente');
  const isExodonciaRealizada = itemsDiente.some((i:any) => {
      const n = String(i.display_nombre).toLowerCase();
      const ico = String(i.icono_tipo || "").toLowerCase();
      return n.includes('extrac') || n.includes('exodoncia') || ico.includes('extrac');
  });
  const isAusente = isAusenteManual || isExodonciaRealizada;
  
  let elementosRaiz: any[] = hallazgos.map((h: string) => ({ nombre: h, icono: null, isManual: true }));
  
  itemsDiente.forEach((t:any) => {
      const n = String(t.display_nombre).toLowerCase();
      const ico = String(t.icono_tipo || "").toLowerCase();
      const esRaiz = n.includes("endo") || ico.includes("endo") || 
                     n.includes("impla") || ico.includes("impla") || 
                     n.includes("perno") || ico.includes("perno") || 
                     n.includes("corona") || ico.includes("corona") || 
                     n.includes("extra") || ico.includes("extra") || 
                     n.includes("exodoncia") ||
                     ico === "default" || 
                     ico === "otro"; 
      
      if (!t.cara || esRaiz) {
          if (!elementosRaiz.some(e => e.nombre === t.display_nombre)) {
              elementosRaiz.push({ nombre: t.display_nombre, icono: t.icono_tipo, isManual: false });
          }
      }
  });

  // 🔥 LÓGICA DE COLORES DE LA RAÍZ DEL DIENTE 🔥
  let start = "#ffffff", end = "#f1f5f9", stroke = "#cbd5e1";
  
  if (isAusente) { 
      start = "#f8fafc"; end = "#f1f5f9"; stroke = "#e2e8f0"; 
  } else if (elementosRaiz.length > 0 || tienePendientes || todosRealizados) { 
      if (todosRealizados && !isAusente) { 
          // Si todos los tratamientos en la pieza están terminados, pintar verde.
          start = "#ecfdf5"; end = "#d1fae5"; stroke = "#10b981"; 
      } else if (tienePendientes || hallazgos.some((h:string) => LESIONES_LISTA.includes(h))) { 
          // Si hay tratamientos pendientes o lesiones manuales, pintar rojo.
          start = "#fef2f2"; end = "#fecaca"; stroke = "#f87171"; 
      } else { 
          // Estado de tratamiento genérico o en curso sin definir
          start = "#eff6ff"; end = "#dbeafe"; stroke = "#93c5fd"; 
      }
  } 
  
  const getP = (n: number) => {
    const x = n % 10;
    if (x < 3) return "M 35 15 Q 50 5 65 15 L 75 60 Q 80 90 75 105 L 25 105 Q 20 90 25 60 Z"; 
    if (x === 3) return "M 35 15 Q 50 5 65 15 L 75 50 Q 80 75 50 95 Q 20 75 25 50 Z"; 
    return "M 20 15 Q 30 0 45 15 L 50 45 L 55 15 Q 70 0 80 15 L 85 60 Q 95 90 80 110 Q 50 115 20 110 Q 5 90 15 60 Z"; 
  }

  return (
    <div className={`flex flex-col items-center gap-1.5 group ${invert ? 'flex-col-reverse' : ''} ${seleccionado ? 'ring-4 ring-blue-400 bg-blue-50 rounded-xl pb-1 px-1' : ''} ${isAusenteManual ? 'opacity-40' : ''}`}>
      <div onClick={(e) => onSelect && onSelect(id, e)} onContextMenu={onContextMenu} className="relative w-12 h-14 cursor-pointer transition-all duration-300 drop-shadow-sm hover:scale-105">
        <svg viewBox="-10 -10 120 140" className={`w-full h-full overflow-visible ${invert ? 'rotate-180' : ''}`}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={start} />
              <stop offset="100%" stopColor={end} />
            </linearGradient>
          </defs>
          
          <path d={getP(id)} fill={`url(#g-${id})`} stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
          
          {isAusente ? (
             <g stroke={isExodonciaRealizada ? "#059669" : "#ef4444"} strokeWidth="12" strokeLinecap="round" opacity="0.8">
               <line x1="10" y1="20" x2="90" y2="100" />
               <line x1="90" y1="20" x2="10" y2="100" />
             </g>
          ) : (
              elementosRaiz.map((el, i) => {
                  const isTtoRealizado = !el.isManual && itemsDiente.some((t:any) => t.display_nombre === el.nombre && t.estado === 'realizado');
                  const isTtoPendiente = !el.isManual && itemsDiente.some((t:any) => t.display_nombre === el.nombre && t.estado !== 'realizado');
                  return <LogoRender key={`h-${i}`} hallazgo={el.nombre} iconoKey={el.icono} isRealizado={isTtoRealizado} isPendiente={isTtoPendiente} />
              })
          )}
        </svg>
      </div>
      <span className="text-[10px] font-black text-slate-400 italic group-hover:text-blue-500 cursor-pointer" onClick={(e) => onSelect && onSelect(id, e)} onContextMenu={onContextMenu}>{id}</span>
      
      <div className={isAusente ? 'pointer-events-none' : ''}>
         <CarasDentales id={id} estado={estadoDiente} itemsDiente={itemsDiente} onFaceClick={onFaceClick} abrirPanelAgregar={abrirPanelAgregar} invert={invert} />
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENTE DE RENDERIZADO DE ICONOS (Odontograma)
// ============================================================================
function LogoRender({ hallazgo, iconoKey, colorOverride, isRealizado, isPendiente }: { hallazgo?: string, iconoKey?: string, colorOverride?: string, isRealizado?: boolean, isPendiente?: boolean }) {
  const originalName = (hallazgo || "").toLowerCase();
  const explicitIcon = (iconoKey || "").toLowerCase();
  const h = explicitIcon || originalName; 
  
  const isLesion = LESIONES_LISTA.some(l => l.toLowerCase() === originalName);
  const isMalEstado = originalName.includes("mal estado") || originalName.includes("fractu") || originalName.includes("infec");
  
  let color = "#2563eb"; // Azul base (Preexistencias buenas)
  if (colorOverride) color = colorOverride;
  else if (isRealizado) color = "#059669"; // Verde
  else if (isPendiente) color = "#ef4444"; // Rojo
  else if (isLesion || isMalEstado) color = "#0f172a"; // Negro / Gris muy oscuro para lesiones

  const patternId = `hash-${Math.random().toString(36).substr(2, 9)}`;
  const pattern = isMalEstado ? (<defs><pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="3" /></pattern></defs>) : null;
  const fill = isMalEstado ? `url(#${patternId})` : color;
  
  // 1. ESTRELLA (Otro)
  if (h === "otro" || h.includes("estrella")) return <g>{pattern}<polygon points="50,15 61,35 83,38 68,54 71,76 50,66 29,76 32,54 17,38 39,35" fill={fill} /></g>;

  // 2. EROSIÓN Y ABFRACCIÓN (Línea curva en el cuello del diente, zona baja)
  if (h.includes("erosi") || h.includes("abfrac")) return <g>{pattern}<path d="M 25 80 Q 50 100 75 80" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" /></g>;

  // 3. ATRICIÓN (Línea plana arriba, en la corona / oclusal)
  if (h.includes("atrici")) return <g>{pattern}<line x1="20" y1="10" x2="80" y2="10" stroke={color} strokeWidth="10" strokeLinecap="round" /></g>;

  // 4. INFECCIÓN PULPAR (Absceso en la punta de la raíz)
  if (h.includes("infecci")) return <g>{pattern}<circle cx="50" cy="110" r="14" fill={fill} /></g>;

  // 5. FRACTURA (Línea de rayo atravesando el diente)
  if (h.includes("fractu")) return <path d="M 65 10 L 45 50 L 60 50 L 35 100" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />;

  // 6. MOVILIDAD (Líneas de movimiento a los lados)
  if (h.includes("movilidad")) return <g stroke={color} strokeWidth="6" fill="none" strokeLinecap="round"><path d="M 15 30 Q -5 60 15 90" /><path d="M 85 30 Q 105 60 85 90" /></g>;

  // 7. ENDODONCIA (Líneas rectas simulando los conductos en las raíces)
  if (h.includes("endo")) return <g><path d="M 35 25 L 35 95 M 65 25 L 65 95" stroke={isMalEstado ? "url(#" + patternId + ")" : color} strokeWidth="8" strokeLinecap="round" /></g>;

  // 8. IMPLANTE (Tornillo)
  if (h.includes("impla")) return <g fill={fill}><rect x="40" y="20" width="20" height="70" rx="4" /><line x1="32" y1="35" x2="68" y2="35" stroke={color} strokeWidth="6" strokeLinecap="round"/><line x1="32" y1="55" x2="68" y2="55" stroke={color} strokeWidth="6" strokeLinecap="round"/><line x1="32" y1="75" x2="68" y2="75" stroke={color} strokeWidth="6" strokeLinecap="round"/></g>;

  // 9. PERNO MUÑÓN (Triángulo invertido)
  if (h.includes("perno") || h.includes("muñón") || h.includes("munon")) return <path d="M 25 20 L 75 20 L 50 90 Z" fill={fill} stroke={color} strokeWidth="4" strokeLinejoin="round" />;

  // 10. CORONA PROVISORIA (Círculo con letra P)
  if (h.includes("provisoria")) return <g><circle cx="50" cy="50" r="35" fill={isMalEstado ? fill : "none"} stroke={color} strokeWidth="6" /><text x="50" y="65" textAnchor="middle" fontSize="40" fontWeight="900" fill={isMalEstado ? "#fff" : color}>P</text></g>;

  // 11. CORONA DEFINITIVA (Círculo hueco)
  if (h.includes("corona")) return <circle cx="50" cy="50" r="35" fill={isMalEstado ? fill : "none"} stroke={color} strokeWidth="6" />;

  // 12. PRÓTESIS REMOVIBLE (Dos líneas horizontales gruesas)
  if (h.includes("protesis") || h.includes("removible")) return <g stroke={color} strokeWidth="8" strokeLinecap="round"><line x1="15" y1="40" x2="85" y2="40" /><line x1="15" y1="60" x2="85" y2="60" /></g>;

  // 13. SELLANTE (Línea curva superior protegiendo la corona)
  if (h.includes("sellante")) return <path d="M 20 30 Q 50 50 80 30" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />;

  // 14. RESIDUO RADICULAR (Cuadro con RR)
  if (h.includes("rr") || h.includes("residuo radicular")) return <g><rect x="15" y="30" width="70" height="40" rx="8" fill={color} /><text x="50" y="58" fill="#fff" fontSize="28" fontWeight="900" textAnchor="middle">RR</text></g>;

  // 15. EXTRACCIÓN / EXODONCIA / AUSENTE (Gran X)
  if (h.includes("extrac") || h.includes("exodoncia") || h.includes("ausente")) return <g stroke={color} strokeWidth="12" strokeLinecap="round" opacity="0.8"><line x1="15" y1="15" x2="85" y2="85" /><line x1="85" y1="15" x2="15" y2="85" /></g>;

  // 16. LIMPIEZA / DESTARTRAJE / PULIDO (Destellos o burbujas)
  if (h.includes("limpieza") || h.includes("pulido") || h.includes("destartraje") || h.includes("profilaxis")) return <g fill={color}><circle cx="30" cy="30" r="10"/><circle cx="75" cy="45" r="8"/><circle cx="45" cy="75" r="14"/></g>;

  // 17. RAYOS X / RADIOGRAFÍA (Cámara / Sensor)
  if (h.includes("rayos") || h.includes("radiografia") || h.includes("scanner") || h.includes("panoramica")) return <g stroke={color} strokeWidth="8" fill="none"><rect x="15" y="20" width="70" height="60" rx="8" /><circle cx="50" cy="50" r="16"/></g>;

  // 18. SANO (Checkmark grande)
  if (h.includes("sano")) return <path d="M 25 50 L 45 70 L 80 30" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />;

  // 19. CARIES / RESTAURACIÓN / AMALGAMA / RESINA (Mancha central tradicional)
  if (h.includes("caries") || h.includes("restauraci") || h.includes("amalgama") || h.includes("resina") || h.includes("ionomero")) return <g>{pattern}<path d="M 35 35 Q 50 20 65 35 Q 80 50 65 65 Q 50 80 35 65 Q 20 50 35 35 Z" fill={fill} /></g>;

  // DEFAULT (Círculo base en caso de no coincidir ninguna palabra)
  return <circle cx="50" cy="50" r="25" fill={fill} opacity="0.8" />;
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