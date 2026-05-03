'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  UserPlus, ArrowLeft, Save, Loader2, CheckCircle2, 
  Info, UserCircle, AlertTriangle, MapPin, Users 
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export default function NuevoPaciente() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [exito, setExito] = useState(false)
  const [listaConvenios, setListaConvenios] = useState<string[]>([])
  
  // Estado inicial robusto
  const [form, setForm] = useState<any>({
    tipo_paciente: '-',
    nombre: '',
    apellido: '',
    rut: '',
    fecha_nacimiento: '',
    nombre_social: '',
    email: '',
    prevision: 'Sin convenio',
    numero_interno: '',
    sexo: '',
    genero: '',
    ciudad: '',
    comuna: '',
    direccion: '',
    telefono_fijo: '',
    telefono: '', 
    actividad_profesion: '',
    empleador: '',
    observaciones_personales: '',
    apoderado_nombre: '',
    apoderado_rut: '',
    referencia: ''
  })

  useEffect(() => {
    async function fetchConvenios() {
      const { data } = await supabase.from('convenios').select('nombre_convenio').eq('estado', 'Habilitado')
      if (data) {
        const nombres = data.map(c => c.nombre_convenio)
        setListaConvenios(['Sin convenio', ...nombres.filter(n => n !== 'Sin convenio')])
      }
    }
    fetchConvenios()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (cargando) return
    
    if (!form.nombre || !form.apellido || !form.rut || !form.fecha_nacimiento) {
        toast.error("Faltan campos obligatorios", {
            description: "Por favor completa Nombre, Apellido, RUT y Fecha de Nacimiento."
        })
        return
    }

    setCargando(true)

    // Normalización de RUT: Solo números y K
    const rutLimpio = form.rut.replace(/[^0-9kK]/g, '').toUpperCase().trim()

    try {
      // 1. VERIFICACIÓN MANUAL DE DUPLICADOS Y ESTADO
      const { data: existente } = await supabase
        .from('pacientes')
        .select('nombre, apellido, activo, motivo_deshabilitado')
        .eq('rut', rutLimpio)
        .maybeSingle()

      if (existente) {
        if (existente.activo === false) {
            toast.warning("PACIENTE RESTRINGIDO", {
                description: `El RUT pertenece a ${existente.nombre} ${existente.apellido}, quien se encuentra deshabilitado. Motivo: ${existente.motivo_deshabilitado || 'No especificado'}.`,
                duration: 8000,
                icon: <AlertTriangle className="text-amber-500" />
            })
        } else {
            toast.error(`El RUT ${form.rut} ya existe`, {
                description: `Pertenece a ${existente.nombre} ${existente.apellido}`,
                duration: 5000
            })
        }
        setCargando(false)
        return
      }

      // 2. INSERCIÓN DE DATOS
      const { error: errorInsert } = await supabase
        .from('pacientes')
        .insert([{ 
          ...form, 
          rut: rutLimpio,
          nombre: form.nombre.toUpperCase().trim(),
          apellido: form.apellido.toUpperCase().trim(),
          activo: true 
        }])

      if (errorInsert) {
        if (errorInsert.code === '23505') {
            throw new Error("El RUT ya se encuentra registrado.")
        }
        throw errorInsert
      }

      setExito(true)
      toast.success("Paciente registrado correctamente")
      setTimeout(() => router.push('/pacientes'), 2000)

    } catch (error: any) {
      console.error("Error completo:", error)
      toast.error("Error al guardar", {
          description: error.message || "No se pudo conectar con el servidor"
      })
      setCargando(false)
    }
  }

  if (exito) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border border-slate-100">
        <CheckCircle2 className="text-emerald-500 mx-auto mb-6" size={80} />
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">¡Registrado!</h2>
        <p className="text-slate-500 font-bold mt-2 text-sm uppercase tracking-widest text-center">Ficha creada con éxito.</p>
      </div>
    </div>
  )

  return (
    <main className="p-6 lg:p-12 max-w-6xl mx-auto min-h-screen bg-slate-50 text-left">
      <Link href="/pacientes" className="inline-flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 mb-8 transition-all">
        <ArrowLeft size={14} /> Volver al Directorio
      </Link>

      <header className="mb-12 text-left">
        <div className="bg-blue-600 w-16 h-16 rounded-[1.8rem] flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-100">
          <UserPlus size={32} />
        </div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight italic text-left">Nueva Ficha</h1>
        <p className="text-slate-500 font-medium mt-2 uppercase text-[10px] tracking-[0.2em] text-left">Registro Integral de Paciente</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8 text-left">
        {/* SECCIÓN 1: DATOS OBLIGATORIOS */}
        <div className="bg-white p-10 lg:p-14 rounded-[3rem] shadow-xl border border-slate-100 text-left">
          <div className="flex items-center gap-2 mb-10 text-blue-600 text-left">
            <Info size={18} />
            <h2 className="font-black text-[10px] uppercase tracking-[0.3em] text-left">Información Obligatoria</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <div className="md:col-span-2 lg:col-span-4 text-left">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block mb-2 text-left">Tipo de Paciente *</label>
               <select required className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 ring-blue-500/20 appearance-none transition-all cursor-pointer border-none"
                value={form.tipo_paciente} onChange={(e) => setForm({...form, tipo_paciente: e.target.value})}>
                 <option value="-">-</option>
                 <option value="discapacidad">Discapacidad</option>
                 <option value="embarazada">Embarazada</option>
                 <option value="funcionario clinica">Funcionario Clínica</option>
                 <option value="menor de edad">Menor de Edad</option>
                 <option value="paciente adulto mayor">Paciente Adulto Mayor</option>
               </select>
            </div>
            <InputGroupSimple label="Nombre *" value={form.nombre} onChange={(v:any) => setForm({...form, nombre: v})} required />
            <InputGroupSimple label="Apellidos *" value={form.apellido} onChange={(v:any) => setForm({...form, apellido: v})} required />
            <InputGroupSimple label="RUT *" placeholder="12.345.678-K" value={form.rut} onChange={(v:any) => setForm({...form, rut: v})} required />
            <InputGroupSimple label="Fecha Nacimiento *" type="date" value={form.fecha_nacimiento} onChange={(v:any) => setForm({...form, fecha_nacimiento: v})} required />
          </div>
        </div>

        {/* SECCIÓN 2: CONTACTO */}
        <div className="bg-white p-10 lg:p-14 rounded-[3rem] shadow-xl border border-slate-100 text-left">
          <div className="flex items-center gap-2 mb-10 text-emerald-600 text-left">
            <MapPin size={18} />
            <h2 className="font-black text-[10px] uppercase tracking-[0.3em] text-left">Contacto y Ubicación</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            <InputGroupSimple label="Dirección" value={form.direccion} onChange={(v:any) => setForm({...form, direccion: v})} />
            <InputGroupSimple label="Comuna" value={form.comuna} onChange={(v:any) => setForm({...form, comuna: v})} />
            <InputGroupSimple label="Ciudad" value={form.ciudad} onChange={(v:any) => setForm({...form, ciudad: v})} />
            <InputGroupSimple label="WhatsApp / Celular" value={form.telefono} onChange={(v:any) => setForm({...form, telefono: v})} />
            <InputGroupSimple label="Teléfono Fijo" value={form.telefono_fijo} onChange={(v:any) => setForm({...form, telefono_fijo: v})} />
            <InputGroupSimple label="Email" type="email" value={form.email} onChange={(v:any) => setForm({...form, email: v})} />
          </div>
        </div>

        {/* SECCIÓN 3: OTROS Y APODERADO */}
        <div className="bg-white p-10 lg:p-14 rounded-[3rem] shadow-xl border border-slate-100 text-left">
          <div className="flex items-center gap-2 mb-10 text-amber-500 text-left">
            <Users size={18} />
            <h2 className="font-black text-[10px] uppercase tracking-[0.3em] text-left">Apoderado y Datos Sociales</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            <InputGroupSimple label="Nombre Apoderado" value={form.apoderado_nombre} onChange={(v:any) => setForm({...form, apoderado_nombre: v})} />
            <InputGroupSimple label="RUT Apoderado" value={form.apoderado_rut} onChange={(v:any) => setForm({...form, apoderado_rut: v})} />
            <InputGroupSimple label="Referencia" value={form.referencia} onChange={(v:any) => setForm({...form, referencia: v})} />
            
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block text-left">Convenio</label>
              <select className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 ring-blue-500/20 appearance-none transition-all cursor-pointer border-none"
                value={form.prevision} onChange={(e) => setForm({...form, prevision: e.target.value})}>
                {listaConvenios.map(conv => <option key={conv} value={conv}>{conv}</option>)}
              </select>
            </div>

            <InputGroupSimple label="Nombre Social" value={form.nombre_social} onChange={(v:any) => setForm({...form, nombre_social: v})} />
            <InputGroupSimple label="Profesión" value={form.actividad_profesion} onChange={(v:any) => setForm({...form, actividad_profesion: v})} />
          </div>
          <div className="mt-8 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block mb-2 text-left">Observaciones Internas</label>
            <textarea className="w-full p-6 bg-slate-50 rounded-[2rem] font-medium outline-none focus:ring-2 ring-blue-500/10 transition-all shadow-inner text-slate-900 border-none" rows={4}
              value={form.observaciones_personales || ''} onChange={(e) => setForm({...form, observaciones_personales: e.target.value})} />
          </div>
        </div>

        <div className="pt-6">
          <button 
            type="submit" 
            disabled={cargando} 
            className="w-full bg-slate-900 text-white py-8 rounded-[3rem] font-black text-2xl shadow-2xl shadow-slate-200 hover:bg-blue-600 transition-all active:scale-[0.98] flex justify-center items-center gap-4 disabled:opacity-50"
          >
            {cargando ? <Loader2 className="animate-spin" size={32} /> : <Save size={32} />}
            {cargando ? 'Registrando...' : 'Finalizar y Crear Paciente'}
          </button>
        </div>
      </form>
    </main>
  )
}

function InputGroupSimple({ label, value, onChange, type = "text", required = false, placeholder = "" }: any) {
  return (
    <div className="space-y-2 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 text-left">{label}</label>
      <input 
        required={required} 
        type={type} 
        placeholder={placeholder}
        className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 ring-blue-500/10 transition-all shadow-inner text-slate-900 border-none"
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
