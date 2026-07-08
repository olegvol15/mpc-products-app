import { Controller, Post, Body } from '@nestjs/common';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  async create(@Body() body: { productId: string }) {
    return this.reservationsService.create(body.productId);
  }
}
