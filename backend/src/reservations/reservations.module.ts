import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { Reservation } from './reservation.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Product])],
  controllers: [ReservationsController],
  providers: [ReservationsService], 
})
export class ReservationsModule {}
