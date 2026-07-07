import { Injectable } from '@nestjs/common';

export interface Product {
  id: string;
  name: string;
  price: number;
  totalQuantity: number;
  availableQuantity: number;
}

@Injectable()
export class ProductsService {
  private readonly products: Product[] = [
    {
      id: '1',
      name: 'Product 1',
      price: 10.99,
      totalQuantity: 100,
      availableQuantity: 50,
    },
    {
      id: '2',
      name: 'Product 2',
      price: 19.99,
      totalQuantity: 200,
      availableQuantity: 150,
    },
  ];

  findAll(): Product[] {
    return this.products;
  }
}
