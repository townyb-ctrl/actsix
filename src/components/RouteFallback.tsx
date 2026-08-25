/**
 * What shows while a lazy route chunk is in flight.
 *
 * Shared by the two Suspense boundaries that can hit it: the one inside
 * `AppLayout`, around the `<Outlet />`, which is the common case and keeps the
 * shell standing; and the one in `App` around the whole router, which only ever
 * fires for the routes that render outside the shell (auth, the public token
 * pages).
 */
export const RouteFallback = () => (
  <div className="actsix-page-body pt-8">
    <div className="actsix-loading-state" role="status">
      Loading...
    </div>
  </div>
);

export default RouteFallback;
