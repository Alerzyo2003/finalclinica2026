import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.delete({ name, ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // 1. Si no hay usuario y no es login/register -> Al Login
  if (!user && pathname !== '/login' && pathname !== '/register') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Si hay usuario y va a login/register -> Al Inicio
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. Protección de administración (Solo ADMIN)
  if (user && pathname.startsWith('/administracion')) {
    // Es mejor y más rápido leer el rol desde el JWT (user_metadata) en el middleware
    // para evitar consultas a la base de datos en el entorno Edge.
    const userRol = user.user_metadata?.rol;

    if (userRol !== 'ADMIN') {
      const redirectUrl = new URL('/', request.url)
      const redirectResponse = NextResponse.redirect(redirectUrl)
      
      // Preservamos las cookies actualizadas de la sesión
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      
      return redirectResponse
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}