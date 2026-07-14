import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelReservation,
  checkoutReservation,
  createReservation,
  errorMessage,
  getProduct,
  getReservation,
  isNotFound,
} from '../lib/api';
import {
  forgetReservation,
  recallReservation,
  rememberReservation,
} from '../lib/storage';
import { ReservationStatus } from '../types';
import ReservationTimer from '../components/ReservationTimer';

const priceFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function ProductPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();

  const [reservationId, setReservationId] = useState(() =>
    recallReservation(id),
  );
  // Bumped when the countdown reaches zero, so the view re-derives as expired.
  const [, setExpiryTick] = useState(0);

  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    refetchInterval: 5000,
  });

  const reservation = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      try {
        return await getReservation(reservationId!);
      } catch (error) {
        // Only a 404 means the reservation is truly gone (e.g. the database was
        // reseeded). A network blip or a restarting server must never cost the
        // buyer the unit they are holding.
        if (isNotFound(error)) forgetReservation(id);
        throw error;
      }
    },
    enabled: reservationId !== null,
    // Retrying a 404 is pointless; retrying a dropped connection is not.
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
  });

  const release = useCallback(() => {
    forgetReservation(id);
    setReservationId(null);
  }, [id]);

  const refreshStock = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['product', id] }),
    [queryClient, id],
  );

  const reserve = useMutation({
    mutationFn: () => createReservation(id),
    onSuccess: (created) => {
      rememberReservation(id, created.id);
      setReservationId(created.id);
      queryClient.setQueryData(['reservation', created.id], created);
      void refreshStock();
    },
  });

  const checkout = useMutation({
    mutationFn: () => checkoutReservation(reservationId!),
    onSuccess: (completed) => {
      queryClient.setQueryData(['reservation', completed.id], completed);
      void refreshStock();
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelReservation(reservationId!),
    onSuccess: () => {
      release();
      void refreshStock();
    },
  });

  const onExpire = useCallback(() => {
    setExpiryTick((tick) => tick + 1);
    // The unit goes back on sale once the server-side sweep runs.
    void refreshStock();
  }, [refreshStock]);

  if (product.isPending) return <p className="state">Loading…</p>;
  if (product.isError)
    return (
      <p className="state state-error">
        This product could not be found. <Link to="/">Back to the drop</Link>
      </p>
    );

  const held = reservation.data;
  const isHolding =
    held?.status === ReservationStatus.ACTIVE &&
    new Date(held.expiresAt) > new Date();
  // Either the countdown ran out on our side, or the server's sweep got there first.
  const isExpired =
    held?.status === ReservationStatus.EXPIRED ||
    (held?.status === ReservationStatus.ACTIVE && !isHolding);
  const isCompleted = held?.status === ReservationStatus.COMPLETED;
  const canReserve = !isHolding && !isExpired && !isCompleted;
  const soldOut = product.data.availableQuantity === 0;

  const pending = reserve.isPending || checkout.isPending || cancel.isPending;
  // A forgotten reservation is not something the buyer did wrong, so it is not
  // surfaced here — only failed actions are.
  const failure = reserve.error ?? checkout.error ?? cancel.error;

  return (
    <article className="detail">
      <Link to="/" className="back">
        ← All products
      </Link>

      <h1>{product.data.name}</h1>
      <p className="price price-lg">
        {priceFormat.format(product.data.price)}
      </p>
      <p className="stock-label">
        {soldOut
          ? 'Sold out'
          : `${product.data.availableQuantity} of ${product.data.totalQuantity} left`}
      </p>

      {isCompleted && (
        <div className="panel panel-success">
          <h2>Order complete</h2>
          <p>The unit is yours. Thanks for shopping the drop.</p>
          <button className="btn" onClick={release} disabled={soldOut}>
            {soldOut ? 'Nothing left' : 'Reserve another'}
          </button>
        </div>
      )}

      {isHolding && held && (
        <div className="panel">
          <h2>
            Reserved for{' '}
            <ReservationTimer
              key={held.id}
              expiresAt={held.expiresAt}
              onExpire={onExpire}
            />
          </h2>
          <p>Complete the checkout before the timer runs out.</p>
          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => checkout.mutate()}
              disabled={pending}
            >
              {checkout.isPending ? 'Completing…' : 'Complete checkout'}
            </button>
            <button
              className="btn"
              onClick={() => cancel.mutate()}
              disabled={pending}
            >
              Release
            </button>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="panel panel-warning">
          <h2>Reservation expired</h2>
          <p>The unit went back on sale. Reserve again if it is still there.</p>
          <button className="btn btn-primary" onClick={release}>
            Try again
          </button>
        </div>
      )}

      {canReserve && (
        <div className="panel">
          <button
            className="btn btn-primary"
            onClick={() => reserve.mutate()}
            disabled={soldOut || pending}
          >
            {soldOut
              ? 'Sold out'
              : reserve.isPending
                ? 'Reserving…'
                : 'Reserve for 15 minutes'}
          </button>
        </div>
      )}

      {failure && (
        <p className="state-error">
          {errorMessage(failure, 'Something went wrong. Try again.')}
        </p>
      )}
    </article>
  );
}
