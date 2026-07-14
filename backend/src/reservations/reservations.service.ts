import { Reservation, ReservationStatus } from './reservation.entity';
import { DataSource } from 'typeorm';
import { Product } from '../products/product.entity';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const RESERVATION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
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
    const updateStatus = await this.dataSource
      .createQueryBuilder()
      .update(Reservation)
      .set({ status: ReservationStatus.COMPLETED })
      .where('id = :id AND "expiresAt" > NOW() AND status = :status', {
        id,
        status: ReservationStatus.ACTIVE,
      })
      .returning('*')
      .execute();

    if (updateStatus.affected === 0) {
      const reservation = await this.dataSource.manager.findOneBy(Reservation, {
        id: id,
      });
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

  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireReservations(): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const update = await manager
        .createQueryBuilder()
        .update(Reservation)
        .set({ status: ReservationStatus.EXPIRED })
        .where('"expiresAt" <= NOW() AND status = :status', {
          status: ReservationStatus.ACTIVE,
        })
        .returning('"productId"')
        .execute();

      const rows = update.raw as { productId: string }[];
      if (rows.length === 0) return;

      const counts = new Map<string, number>();
      for (const { productId } of rows) {
        counts.set(productId, (counts.get(productId) || 0) + 1);
      }

      for (const [productId, count] of counts) {
        await manager
          .createQueryBuilder()
          .update(Product)
          .set({ availableQuantity: () => '"availableQuantity" + :count' })
          .where('id = :id', { id: productId, count })
          .execute();
      }

      this.logger.log(
        `Expired ${rows.length} reservations and restored product quantities`,
      );
    });
  }
}
