import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { Product } from '../src/products/product.entity';
import {
  Reservation,
  ReservationStatus,
} from '../src/reservations/reservation.entity';
import { ReservationsService } from '../src/reservations/reservations.service';

const STOCK = 5;
const CONCURRENT_BUYERS = 50;

describe('Reservations (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let reservationsService: ReservationsService;
  let product: Product;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    // Bind once on a random port. Without a listening server, every supertest
    // call spins up its own ephemeral one, and the concurrent race below then
    // dies with ECONNRESET.
    await app.listen(0);

    dataSource = app.get(DataSource);
    reservationsService = app.get(ReservationsService);

    // The expiry cron would otherwise fire mid-test and make assertions flaky.
    // Expiry is exercised explicitly instead, by calling the service directly.
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => void job.stop());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "reservations", "products" RESTART IDENTITY CASCADE',
    );
    product = await dataSource.getRepository(Product).save({
      name: 'Solstice Field Jacket',
      price: 229,
      totalQuantity: STOCK,
      availableQuantity: STOCK,
    });
  });

  const reserve = () =>
    request(app.getHttpServer())
      .post('/reservations')
      .send({ productId: product.id });

  const reserveOne = async (): Promise<Reservation> => {
    const res = await reserve().expect(201);
    return res.body as Reservation;
  };

  /** Backdates a reservation so it is due for expiry, without waiting out its TTL. */
  const expire = async (reservation: Reservation): Promise<void> => {
    await dataSource
      .getRepository(Reservation)
      .update(reservation.id, { expiresAt: new Date(Date.now() - 1000) });
  };

  const stock = async () =>
    (
      await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id })
    ).availableQuantity;

  it(`never oversells when ${CONCURRENT_BUYERS} buyers race for ${STOCK} units`, async () => {
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_BUYERS }, () => reserve()),
    );

    const reserved = responses.filter((res) => res.status === 201);
    const rejected = responses.filter((res) => res.status === 409);

    expect(reserved).toHaveLength(STOCK);
    expect(rejected).toHaveLength(CONCURRENT_BUYERS - STOCK);
    expect(rejected[0].body as unknown).toMatchObject({
      message: 'Product is sold out',
    });

    // The two sources of truth must agree: stock is gone, and exactly STOCK
    // reservations are holding it.
    expect(await stock()).toBe(0);
    await expect(
      dataSource.getRepository(Reservation).countBy({
        productId: product.id,
        status: ReservationStatus.ACTIVE,
      }),
    ).resolves.toBe(STOCK);
  });

  it('completes a checkout and keeps the unit sold', async () => {
    const reservation = await reserveOne();

    const res = await request(app.getHttpServer())
      .post(`/reservations/${reservation.id}/checkout`)
      .expect(201);

    expect((res.body as Reservation).status).toBe(ReservationStatus.COMPLETED);
    expect(await stock()).toBe(STOCK - 1);
  });

  it('rejects checkout of an expired reservation and does not sell the unit', async () => {
    const reservation = await reserveOne();
    await expire(reservation);

    const res = await request(app.getHttpServer())
      .post(`/reservations/${reservation.id}/checkout`)
      .expect(409);

    expect((res.body as { message: string }).message).toBe(
      'Reservation has expired',
    );
    expect(await stock()).toBe(STOCK - 1);
  });

  it('returns the unit to stock when a reservation expires', async () => {
    const reservation = await reserveOne();
    expect(await stock()).toBe(STOCK - 1);

    await expire(reservation);
    await reservationsService.expireReservations();

    expect(await stock()).toBe(STOCK);
    await expect(
      dataSource.getRepository(Reservation).findOneByOrFail({
        id: reservation.id,
      }),
    ).resolves.toMatchObject({ status: ReservationStatus.EXPIRED });
  });

  it('returns the unit to stock when a reservation is cancelled', async () => {
    const reservation = await reserveOne();
    expect(await stock()).toBe(STOCK - 1);

    await request(app.getHttpServer())
      .delete(`/reservations/${reservation.id}`)
      .expect(200);

    expect(await stock()).toBe(STOCK);
  });

  it('restores stock only once when expiry and cancellation race', async () => {
    const reservation = await reserveOne();
    await expire(reservation);

    // Both paths try to release the same unit. Exactly one may win.
    const [expiry, cancellation] = await Promise.allSettled([
      reservationsService.expireReservations(),
      reservationsService.cancel(reservation.id),
    ]);

    expect([expiry.status, cancellation.status]).toContain('fulfilled');
    expect(await stock()).toBe(STOCK);
  });

  it('rejects a reservation for an unknown product', async () => {
    await request(app.getHttpServer())
      .post('/reservations')
      .send({ productId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
  });
});
