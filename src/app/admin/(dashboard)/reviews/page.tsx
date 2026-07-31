import { getAdminReviews } from '../../queries';
import ReviewFeed from '../../ReviewFeed';

export const revalidate = 0;

export default async function AdminReviewsPage() {
  const reviews = await getAdminReviews();

  return (
    <section className="admin-section">
      <h2 className="admin-section-title">Reviews</h2>
      <p className="admin-section-sub">
        Every review, newest first.
      </p>
      <ReviewFeed
        reviews={reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </section>
  );
}
