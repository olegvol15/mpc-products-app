export type Product = {
  id: string;
  name: string;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
};

export const ReservationStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

export type Reservation = {
  id: string;
  status: ReservationStatus;
  productId: string;
  createdAt: string;
  expiresAt: string;
};
