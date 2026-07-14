import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockGuardAndExpiryIndex1784063493172 implements MigrationInterface {
  name = 'AddStockGuardAndExpiryIndex1784063493172';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Last line of defence against overselling: even if application logic were
    // to regress, the database itself refuses to take stock below zero.
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "CHK_products_available_quantity" CHECK ("availableQuantity" >= 0 AND "availableQuantity" <= "totalQuantity")`,
    );
    // The expiry cron scans on (status, expiresAt) every 30 seconds.
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_status_expires_at" ON "reservations" ("status", "expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reservations_status_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "CHK_products_available_quantity"`,
    );
  }
}
