import { Controller, Get } from '@nestjs/common';
import { ProductsService, Product } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}
  @Get()
  async getProducts(): Promise<Product[]> {
    return this.productsService.findAll();
  }
}
