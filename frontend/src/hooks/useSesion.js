import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cerrarSesion, iniciarSesion, obtenerSesion } from '../api/auth.js';

export function useSesion() {
  return useQuery({
    queryKey: ['sesion'],
    queryFn: obtenerSesion,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: iniciarSesion,
    onSuccess: (datos) => {
      // La sesión ya está en la cookie; guardamos el usuario en la caché para
      // no volver a pedirlo apenas termina el login.
      queryClient.setQueryData(['sesion'], datos);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cerrarSesion,
    onSettled: () => {
      queryClient.clear();
    },
  });
}
