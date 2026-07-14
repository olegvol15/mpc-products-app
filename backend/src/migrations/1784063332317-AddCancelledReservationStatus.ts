import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelledReservationStatus1784063332317
  implements MigrationInterface
{
  name = 'AddCancelledReservationStatus1784063332317';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."reservations_status_enum" RENAME TO "reservations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_status_enum" AS ENUM('active', 'completed', 'expired', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "status" TYPE "public"."reservations_status_enum" USING "status"::"text"::"public"."reservations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."reservations_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "reservations" SET "status" = 'expired' WHERE "status" = 'cancelled'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."reservations_status_enum" RENAME TO "reservations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_status_enum" AS ENUM('active', 'completed', 'expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "status" TYPE "public"."reservations_status_enum" USING "status"::"text"::"public"."reservations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."reservations_status_enum_old"`);
  }
}
