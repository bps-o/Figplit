import { motion } from 'framer-motion';

interface Metric {
  label: string;
  value: string;
}

interface LogoMarqueeProps {
  heading?: string;
  metrics: Metric[];
  logos: string[];
}

/**
 * Auto-scrolling marquee mixing customer logos with key metrics.
 * Edge gradients fade the loop to avoid harsh seams.
 */
export function MetricsMarquee({ heading = 'Loved by teams shipping fast', metrics, logos }: LogoMarqueeProps) {
  const loop = [...logos, ...logos];

  return (
    <section className="relative overflow-hidden bg-slate-950 py-16 text-white">
      <div
        className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent"
        aria-hidden
      />
      <div
        className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-950 via-slate-950/70 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-8 px-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-semibold text-white/90 sm:text-3xl">{heading}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-white/70">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.28em] text-white/50">{metric.label}</div>
                <div className="text-lg font-semibold text-white">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {[0, 1].map((row) => (
            <motion.div
              key={row}
              className="flex min-w-full gap-10"
              initial={{ x: row % 2 === 0 ? 0 : -200 }}
              animate={{ x: row % 2 === 0 ? -600 : 0 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            >
              {loop.map((logo, index) => (
                <div key={`${row}-${index}`} className="flex items-center gap-3 opacity-70 hover:opacity-100">
                  <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                    <span className="text-sm font-semibold uppercase tracking-wide">{logo.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-white/80">{logo}</span>
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
