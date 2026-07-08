import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({type: 'decimal', precision: 10, scale: 2})
  price!: number;

  @Column({type: 'int'})
  totalQuantity!: number;

  @Column({type: 'int'})
  availableQuantity!: number;
}