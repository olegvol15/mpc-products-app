import { InjectRepository } from '@nestjs/typeorm';
import { Reservation } from './reservation.entity';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const RESERVATION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(productId: string) {
    const product = await this.productsRepository.findOneBy({ id: productId });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.availableQuantity <= 0) {
      throw new ConflictException('Product is sold out');
    }

    product.availableQuantity -= 1;
    await this.productsRepository.save(product);

    const reservation = this.reservationsRepository.create({
      productId: product.id,
      expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
    });

    return this.reservationsRepository.save(reservation);
  }
}
