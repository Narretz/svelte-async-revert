export function load({ params }) {
  const id = Number(params.id);
  return {
    fundraiser: { id, needsReview: `LABEL for id=${id}` },
    updates: [{ id: id * 100, url: `https://example.com/status/${id * 100}` }]
  };
}
