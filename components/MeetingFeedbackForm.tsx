import React, { useState } from 'react';

interface MeetingFeedbackFormProps {
  matchKey: string;
  onSubmit?: () => void;
}

const MeetingFeedbackForm: React.FC<MeetingFeedbackFormProps> = ({ matchKey, onSubmit }) => {
  const [feedback, setFeedback] = useState({
    rating: 5,
    seller_rating: 5,
    buyer_rating: 5,
    meeting_successful: true,
    comments: '',
    would_meet_again: true,
    seller_behavior: '',
    location_rating: 5,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/meeting/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_key: matchKey,
          ...feedback,
        }),
      });

      if (response.ok) {
        alert('✅ Děkujeme za váš feedback!');
        setFeedback({
          rating: 5,
          seller_rating: 5,
          buyer_rating: 5,
          meeting_successful: true,
          comments: '',
          would_meet_again: true,
          seller_behavior: '',
          location_rating: 5,
        });
        onSubmit?.();
      }
    } catch (error) {
      alert('❌ Chyba při odesílání feedbacku');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value: number, onChange: (value: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="text-2xl focus:outline-none transition-transform hover:scale-110"
          >
            {star <= value ? '⭐' : '☆'}
          </button>
        ))}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-sky-400 mb-4">📝 Feedback po setkání</h3>

        {/* Overall Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Celkové hodnocení setkání
          </label>
          {renderStars(feedback.rating, (value) => setFeedback(s => ({ ...s, rating: value })))}
        </div>

        {/* Meeting Success */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={feedback.meeting_successful}
              onChange={(e) => setFeedback(s => ({ ...s, meeting_successful: e.target.checked }))}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-slate-300">Setkání bylo úspěšné</span>
          </label>
        </div>

        {/* Seller Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Hodnocení prodejce
          </label>
          {renderStars(feedback.seller_rating, (value) => setFeedback(s => ({ ...s, seller_rating: value })))}
        </div>

        {/* Buyer Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Hodnocení kupujícího
          </label>
          {renderStars(feedback.buyer_rating, (value) => setFeedback(s => ({ ...s, buyer_rating: value })))}
        </div>

        {/* Location Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Hodnocení místa setkání
          </label>
          {renderStars(feedback.location_rating, (value) => setFeedback(s => ({ ...s, location_rating: value })))}
        </div>

        {/* Would Meet Again */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={feedback.would_meet_again}
              onChange={(e) => setFeedback(s => ({ ...s, would_meet_again: e.target.checked }))}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-slate-300">Setkal/a bych se znovu</span>
          </label>
        </div>

        {/* Seller Behavior */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Chování prodejce (volitelné)
          </label>
          <textarea
            value={feedback.seller_behavior}
            onChange={(e) => setFeedback(s => ({ ...s, seller_behavior: e.target.value }))}
            placeholder="Popište chování prodejce..."
            rows={3}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Comments */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Komentář (volitelné)
          </label>
          <textarea
            value={feedback.comments}
            onChange={(e) => setFeedback(s => ({ ...s, comments: e.target.value }))}
            placeholder="Podělte se o vaše zkušenosti..."
            rows={4}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          {submitting ? '📝 Odesílám...' : '✅ Odeslat feedback'}
        </button>
      </div>
    </form>
  );
};

export default MeetingFeedbackForm;
