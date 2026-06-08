'use server'
import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/admin'

const VIRTUAL_DOMAIN = '@clinicadignidad.com' // Dominio virtual para correos de staff

async function verificarAdmin() {
  // 1. Add "await" here
  const cookieStore = await cookies() 
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // 2. cookieStore is now properly resolved
          return cookieStore.get(name)?.value 
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', options)
        },
      },
    }
  )
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'ADMIN') throw new Error('Sin permisos')
}

export async function crearCuentaProfesional(formData: any) {
  let authUserId: string | null = null;

  try {
    await verificarAdmin()
    const { nombre, apellido, username, password, especialidad_id, rol, rut } = formData;
    const nombreCompleto = `${nombre} ${apellido}`;
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9.]/g, "");
    const virtualEmail = `${cleanUsername}${VIRTUAL_DOMAIN}`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: virtualEmail,
      password: password,
      email_confirm: true,
      user_metadata: { nombre_completo: nombreCompleto, rol: rol, username: cleanUsername, rut: rut }
    })
    if (authError) return { error: `Error Auth: ${authError.message}` };
    authUserId = authData.user.id;

    await supabaseAdmin.from('perfiles').upsert([{ 
      id: authUserId, nombre_completo: nombreCompleto, rol: rol, username: cleanUsername, rut: rut
    }]);
    
    if (rol === 'DENTISTA') {
      await supabaseAdmin.from('profesionales').upsert([{
        user_id: authUserId, nombre: nombre.toUpperCase(), apellido: apellido.toUpperCase(),
        especialidad_id: especialidad_id || null, activo: true
      }]);
    }
    
    return { success: true }
  } catch (error: any) {
    if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);
    return { error: error.message }
  }
}

// --- FUNCIÓN PARA ACTUALIZAR ---
export async function actualizarCuentaProfesional(id: string, userId: string, formData: any) {
  try {
    await verificarAdmin()
    const { nombre, apellido, especialidad_id, rol, rut } = formData;
    const nombreCompleto = `${nombre} ${apellido}`
    
    // El 'userId' es el ID de la tabla Auth de Supabase
    await supabaseAdmin.from('perfiles').update({ 
      nombre_completo: nombreCompleto, rol: rol, rut: rut
    }).eq('id', userId)
    
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { nombre_completo: nombreCompleto, rol: rol, rut: rut }
    });

    if (rol === 'DENTISTA') {
      await supabaseAdmin.from('profesionales').update({
        nombre: nombre.toUpperCase(), apellido: apellido.toUpperCase(),
        especialidad_id: especialidad_id || null
      }).eq('user_id', userId)
    }
    
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

/**
 * --- FUNCIÓN PARA ELIMINAR ---
 * Modificada para aceptar 1 o 2 argumentos y evitar el error "Expected 1 arguments, but got 2"
 */
export async function eliminarCuentaProfesional(idOrUserId: string, secondaryId?: string) {
  try {
    await verificarAdmin()
    // Si recibimos dos IDs, el importante para Auth suele ser el segundo (user_id)
    // Si solo recibimos uno, usamos ese.
    const targetId = secondaryId || idOrUserId;

    if (!targetId) throw new Error("ID de usuario no proporcionado");

    // 1. Eliminar de tablas relacionales primero
    await supabaseAdmin.from('profesionales').delete().eq('user_id', targetId);
    await supabaseAdmin.from('perfiles').delete().eq('id', targetId);
    
    // 2. Eliminar de Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (authErr) throw authErr;

    return { success: true }
  } catch (err: any) {
    console.error("Error en eliminarCuentaProfesional:", err.message);
    return { error: err.message }
  }
}

// --- ALIAS DE COMPATIBILIDAD ---
export const crearCuentaStaff = crearCuentaProfesional;
export const actualizarCuentaStaff = actualizarCuentaProfesional;
export const eliminarCuentaStaff = eliminarCuentaProfesional;
