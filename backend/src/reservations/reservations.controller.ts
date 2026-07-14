import {
  Controller,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Get,
  Delete,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Reservation } from './reservation.entity';

@Controller('reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  async create(@Body() dto: CreateReservationDto): Promise<Reservation> {
    return this.reservationsService.create(dto.productId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Reservation> {
    return this.reservationsService.findOne(id);
  }

  @Post(':id/checkout')
  async checkout(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Reservation> {
    return this.reservationsService.checkout(id);
  }

  @Delete(':id')
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<Reservation> {
    return this.reservationsService.cancel(id);
  }
}
