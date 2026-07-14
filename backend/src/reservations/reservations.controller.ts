import { Controller, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Controller('reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  async create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto.productId);
  }

  @Post(':id/checkout')
  async checkout(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.checkout(id);
  }
}
