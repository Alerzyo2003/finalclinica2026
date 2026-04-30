'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useRole() {
  const [rol, setRol] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function getRole() {
      // 1. Obtenemos el usuario autenticado
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUser(user)
        // 2. Buscamos su rol en la tabla 'perfiles' que creamos en SQL
        const { data, error } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle()

        if (data) {
          setRol(data.rol)
        } else {
          // Si no tiene perfil aún (pero está logueado), por defecto es RECEPCIONISTA
          setRol('RECEPCIONISTA')
        }
      }
      setCargando(false)
    }
    getRole()
  }, [])

  return { 
    rol, 
    user, 
    isAdmin: rol === 'ADMIN', 
    isDentista: rol === 'DENTISTA',
    isRecepcionista: rol === 'RECEPCIONISTA',
    cargando 
  }
}