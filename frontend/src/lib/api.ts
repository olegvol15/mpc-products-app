import axios from 'axios';
import type { Product, Reservation } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

/** Turns a Nest error response into a message worth showing a buyer. */
export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (message) return message;
  }
  return fallback;
}

export const getProducts = async (): Promise<Product[]> =>
  (await api.get<Product[]>('/products')).data;

export const getProduct = async (id: string): Promise<Product> =>
  (await api.get<Product>(`/products/${id}`)).data;

export const getReservation = async (id: string): Promise<Reservation> =>
  (await api.get<Reservation>(`/reservations/${id}`)).data;

export const createReservation = async (
  productId: string,
): Promise<Reservation> =>
  (await api.post<Reservation>('/reservations', { productId })).data;

export const checkoutReservation = async (id: string): Promise<Reservation> =>
  (await api.post<Reservation>(`/reservations/${id}/checkout`)).data;

export const cancelReservation = async (id: string): Promise<Reservation> =>
  (await api.delete<Reservation>(`/reservations/${id}`)).data;
