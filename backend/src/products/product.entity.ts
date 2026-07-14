import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
@Check(
  'CHK_products_available_quantity',
  '"availableQuantity" >= 0 AND "availableQuantity" <= "totalQuantity"',
)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  price!: number;

  @Column({ type: 'int' })
  totalQuantity!: number;

  @Column({ type: 'int' })
  availableQuantity!: number;
}
