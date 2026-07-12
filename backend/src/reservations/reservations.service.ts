import { Reservation, ReservationStatus } from './reservation.entity';
import { DataSource } from 'typeorm';
import { Product } from '../products/product.entity';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const RESERVATION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class ReservationsService {
  constructor(private readonly dataSource: DataSource) {}

  async create(productId: string): Promise<Reservation> {
    return this.dataSource.transaction(async (manager) => {
      const decrementResult = await manager
        .createQueryBuilder()
        .update(Product)
        .set({ availableQuantity: () => '"availableQuantity" - 1' })
        .where('id = :id AND "availableQuantity" > 0', { id: productId })
        .execute();

      if (decrementResult.affected === 0) {
        const product = await manager.findOneBy(Product, { id: productId });
        if (!product) {
          throw new NotFoundException('Product not found');
        }
        throw new ConflictException('Product is sold out');
      }

      const reservation = manager.create(Reservation, {
        productId,
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
      });
      return manager.save(reservation);
    });
  }

  async checkout(id: string): Promise<Reservation> {
        const updateStatus = await this.dataSource.createQueryBuilder()
        .update(Reservation)
        .set({status: ReservationStatus.COMPLETED})
        .where('id = :id AND "expiresAt" > NOW() AND status = :status', { id, status: ReservationStatus.ACTIVE })
        .returning('*')
        .execute();

        if(updateStatus.affected === 0) {
          const reservation = await this.dataSource.manager.findOneBy(Reservation, {id: id});
          if (!reservation) {
            throw new NotFoundException('Reservation not found');
          }
          if (reservation.status === ReservationStatus.COMPLETED) {
            throw new ConflictException('Reservation has already been completed');
          }
          throw new ConflictException('Reservation has expired');
        }

        return (updateStatus.raw as Reservation[])[0];
    }
  }
