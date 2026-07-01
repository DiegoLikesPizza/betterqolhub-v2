'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addListing, type AddListingState } from './actions';
import { CATEGORIES } from '@/lib/categories';

export default function AddListingForm() {
  const [state, action, pending] = useActionState<AddListingState, FormData>(addListing, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the fields after a successful submission.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} className="form-card" action={action}>
      {state?.message && (
        <div className={`form-alert ${state.ok ? 'form-alert-success' : 'form-alert-error'}`}>
          {state.message}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="category">Category</label>
        <select id="category" name="category" className="form-input" defaultValue="" required>
          <option value="" disabled>Select a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="name">Name</label>
        <input id="name" name="name" type="text" className="form-input" required />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="description">Description</label>
        <textarea id="description" name="description" className="form-textarea" required />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="url">Primary link (Discord invite or website)</label>
        <input id="url" name="url" type="url" className="form-input" placeholder="https://discord.gg/…" required />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="developer">Developer <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
        <input id="developer" name="developer" type="text" className="form-input" />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="secondaryUrl">Secondary link <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional — e.g. website or source)</span></label>
        <input id="secondaryUrl" name="secondaryUrl" type="url" className="form-input" />
      </div>

      <div className="form-group">
        <label className="form-checkbox">
          <input type="checkbox" name="isTrusted" defaultChecked />
          <span>Mark as trusted</span>
        </label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Adding…' : 'Add Listing'}
      </button>
    </form>
  );
}
