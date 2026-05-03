'use client'
import { useState } from 'react'
import { 
  Wallet, Search, CreditCard, Banknote, 
  Receipt, CheckCircle2, ChevronRight, User
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

// Datos falsos para probar la UI
const MOCK_PACIENTE = {
  nombre: "Millaray González",
  rut: "19.876.543-2",
  saldo_favor: 0
}

const MOCK_CARGOS = [
  { id: 1, fecha: '2026-04-28', descripcion: 'Extracción Muela del Juicio (Pieza 18)', monto: 60000, doctor: 'Dr. Gutiérrez' },
  { id: 2, fecha: '2026-04-28', descripcion: 'Radiografía Panorámica', monto: 15000, doctor: 'Dr. Gutiérrez' },
  { id: 3, fecha: '2026-04-15', descripcion: 'Limpieza con Ultrasonido', monto: 35000, doctor: 'Dra. Soto' },
]

export default function CajaPage() {
  const [cargos, setCargos] = useState(MOCK_CARGOS)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [metodoPago, setMetodoPago] = useState<string>('debito')
  const [procesando, setProcesando] = useState(false)

  // Cálculos automáticos
  const totalDeuda = cargos.reduce((acc, cargo) => acc + cargo.monto, 0)
  const montoAPagar = cargos
    .filter(c => seleccionados.includes(c.id))
    .reduce((acc, c) => acc + c.monto, 0)

  const toggleCargo = (id: number) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const seleccionarTodo = () => {
    if (seleccionados.length === cargos.length) {
      setSeleccionados([]) // Deseleccionar todo
    } else {
      setSeleccionados(cargos.map(c => c.id)) // Seleccionar todo
    }
  }

  const procesarPago = () => {
    if (montoAPagar === 0) return toast.error("Seleccione al menos un tratamiento para cobrar")
    
    setProcesando(true)
    
    // Simulamos el tiempo de conexión con el servidor/Transbank
    setTimeout(() => {
      toast.success(`Pago de $${montoAPagar.toLocaleString('es-CL')} registrado con éxito`)
      // Quitamos los cargos pagados de la lista visual
      setCargos(prev => prev.filter(c => !seleccionados.includes(c.id)))
      setSeleccionados([])
      setProcesando(false)
    }, 1500)
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 pb-20 text-left bg-slate-50 min-h-screen">
      
      {/* HEADER DE CAJA */}
      <header className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
        <div className="text-left">
          <h3 className="text-3xl font-black text-slate-800 uppercase italic flex items-center gap-3 text-left leading-none">
            <Wallet className="text-blue-600" size={32} /> Caja y Recaudación
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 text-left">
            Módulo de pagos y facturación
          </p>
        </div>
        
        {/* BUSCADOR RÁPIDO DE PACIENTES (Simulado) */}
        <div className="w-full md:w-96 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar paciente por RUT o Nombre..." 
            className="w-full bg-slate-50 pl-12 pr-4 py-4 rounded-2xl text-xs font-bold border-none outline-none focus:ring-2 ring-blue-500/20 text-slate-700"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start text-left">
        
        {/* COLUMNA IZQUIERDA: DATOS Y DEUDAS */}
        <div className="lg:col-span-2 space-y-6 text-left">
          
          {/* TARJETA DEL PACIENTE */}
          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white flex justify-between items-center text-left">
            <div className="flex items-center gap-4 text-left">
              <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center">
                <User size={24} className="text-white/70" />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-blue-300 font-black uppercase tracking-widest text-left">Paciente Activo</p>
                <h4 className="text-xl font-black uppercase tracking-tight text-left">{MOCK_PACIENTE.nombre}</h4>
                <p className="text-xs text-slate-400 font-bold mt-1 text-left">RUT: {MOCK_PACIENTE.rut}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-right">Deuda Total</p>
              <p className="text-2xl font-black text-white text-right">${totalDeuda.toLocaleString('es-CL')}</p>
            </div>
          </div>

          {/* LISTA DE TRATAMIENTOS POR COBRAR */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-left">
            <div className="flex justify-between items-center mb-6 text-left">
              <h4 className="text-sm font-black text-slate-800 uppercase italic text-left">Cargos Pendientes</h4>
              <button 
                onClick={seleccionarTodo}
                className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 tracking-widest bg-blue-50 px-4 py-2 rounded-xl transition-colors"
              >
                {seleccionados.length === cargos.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
              </button>
            </div>

            {cargos.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">El paciente no registra deudas</p>
              </div>
            ) : (
              <div className="space-y-3 text-left">
                {cargos.map(cargo => {
                  const isSelected = seleccionados.includes(cargo.id)
                  return (
                    <motion.div 
                      key={cargo.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => toggleCargo(cargo.id)}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-5 text-left select-none ${isSelected ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-blue-200'}`}
                    >
                      {/* Custom Checkbox */}
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                      
                      <div className="flex-1 text-left">
                        <p className="text-[10px] font-bold text-slate-400 uppercase text-left">{cargo.fecha} • {cargo.doctor}</p>
                        <p className="text-xs font-black text-slate-800 uppercase mt-0.5 leading-tight text-left">{cargo.descripcion}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-base font-black text-slate-900 text-right">${cargo.monto.toLocaleString('es-CL')}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: MÓDULO DE PAGO */}
        <div className="lg:col-span-1 text-left">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 sticky top-8 text-left">
            <h4 className="text-sm font-black text-slate-800 uppercase italic mb-6 text-left">Resumen de Cobro</h4>
            
            <div className="bg-slate-50 p-6 rounded-3xl mb-8 border border-slate-100 text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Monto a Pagar</p>
              <p className="text-4xl font-black text-blue-600 text-center tracking-tighter">
                ${montoAPagar.toLocaleString('es-CL')}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase text-center mt-3">
                {seleccionados.length} prestaciones seleccionadas
              </p>
            </div>

            <div className="space-y-4 mb-8 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block text-left">Medio de Pago</label>
              
              <div className="grid grid-cols-2 gap-3 text-left">
                <button 
                  onClick={() => setMetodoPago('debito')}
                  className={`p-4 rounded-2xl border-2 font-black text-[10px] uppercase flex flex-col items-center gap-2 transition-all ${metodoPago === 'debito' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}`}
                >
                  <CreditCard size={20} /> Tarjeta
                </button>
                <button 
                  onClick={() => setMetodoPago('efectivo')}
                  className={`p-4 rounded-2xl border-2 font-black text-[10px] uppercase flex flex-col items-center gap-2 transition-all ${metodoPago === 'efectivo' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}`}
                >
                  <Banknote size={20} /> Efectivo
                </button>
                <button 
                  onClick={() => setMetodoPago('transferencia')}
                  className={`col-span-2 p-4 rounded-2xl border-2 font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all ${metodoPago === 'transferencia' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}`}
                >
                  <Receipt size={16} /> Transferencia Bancaria
                </button>
              </div>
            </div>

            <button 
              onClick={procesarPago}
              disabled={montoAPagar === 0 || procesando}
              className={`w-full py-6 rounded-3xl font-black text-xs uppercase transition-all shadow-xl flex items-center justify-center gap-2
                ${montoAPagar === 0 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'
                }`}
            >
              {procesando ? 'Procesando...' : `Cobrar $${montoAPagar.toLocaleString('es-CL')}`}
              {!procesando && montoAPagar > 0 && <ChevronRight size={18} />}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}