import type { PricingEntry, Qualification } from "../types/teacher";

type TeacherPricingFieldsProps = {
  location: string;
  bio: string;
  bioMaxLength: number;
  pricing: PricingEntry[];
  qualifications: Qualification[];
  onLocationChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onPricingChange: (pricing: PricingEntry[]) => void;
  onQualificationsChange: (qualifications: Qualification[]) => void;
};

export function TeacherPricingFields({
  location,
  bio,
  bioMaxLength,
  pricing,
  qualifications,
  onLocationChange,
  onBioChange,
  onPricingChange,
  onQualificationsChange,
}: TeacherPricingFieldsProps) {
  function updatePricing(index: number, patch: Partial<PricingEntry>) {
    onPricingChange(pricing.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateQualification(index: number, patch: Partial<Qualification>) {
    onQualificationsChange(
      qualifications.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  return (
    <>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">About You</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="teacher-location">
            Location
          </label>
          <input
            id="teacher-location"
            type="text"
            placeholder="Tampines"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="teacher-bio">
            Bio
          </label>
          <textarea
            id="teacher-bio"
            maxLength={bioMaxLength}
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
            className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
          />
          <p className="mt-1 text-xs text-slate-500">
            {bio.length}/{bioMaxLength}
          </p>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Subjects & Pricing</h2>
          <button
            type="button"
            onClick={() =>
              onPricingChange([
                ...pricing,
                { subject: "", level: "", hourlyRate: 0, trialRate: 0 },
              ])
            }
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add subject
          </button>
        </div>

        <div className="space-y-4">
          {pricing.map((entry, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Subject"
                  value={entry.subject}
                  onChange={(e) => updatePricing(index, { subject: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
                <input
                  type="text"
                  placeholder="Level"
                  value={entry.level}
                  onChange={(e) => updatePricing(index, { level: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Hourly rate (SGD)"
                  value={entry.hourlyRate}
                  onChange={(e) => updatePricing(index, { hourlyRate: Number(e.target.value) })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Trial rate (SGD)"
                  value={entry.trialRate}
                  onChange={(e) => updatePricing(index, { trialRate: Number(e.target.value) })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
              </div>
              {pricing.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onPricingChange(pricing.filter((_, i) => i !== index))}
                  className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Qualifications</h2>
          <button
            type="button"
            onClick={() =>
              onQualificationsChange([
                ...qualifications,
                { degree: "", institution: "", year: new Date().getFullYear() },
              ])
            }
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add qualification
          </button>
        </div>

        <div className="space-y-4">
          {qualifications.map((q, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Degree"
                  value={q.degree}
                  onChange={(e) => updateQualification(index, { degree: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
                <input
                  type="text"
                  placeholder="Institution"
                  value={q.institution}
                  onChange={(e) => updateQualification(index, { institution: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
                <input
                  type="number"
                  placeholder="Year"
                  value={q.year}
                  onChange={(e) => updateQualification(index, { year: Number(e.target.value) })}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
              </div>
              {qualifications.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onQualificationsChange(qualifications.filter((_, i) => i !== index))}
                  className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function validateTeacherProfileForm(
  location: string,
  pricing: PricingEntry[],
  qualifications: Qualification[]
): string | null {
  if (!location.trim()) return "Location is required";
  if (pricing.length === 0) return "Add at least one subject pricing entry";

  for (const p of pricing) {
    if (!p.subject.trim() || !p.level.trim()) {
      return "Each pricing entry needs subject and level";
    }
    if (!Number.isFinite(p.hourlyRate) || !Number.isFinite(p.trialRate)) {
      return "Hourly and trial rates must be numbers";
    }
    if (p.hourlyRate < 0 || p.trialRate < 0) {
      return "Rates cannot be negative";
    }
  }

  for (const q of qualifications) {
    if (!q.degree.trim() || !q.institution.trim() || !Number.isFinite(q.year)) {
      return "Each qualification needs degree, institution, and year";
    }
  }

  return null;
}
